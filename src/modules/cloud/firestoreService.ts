// ============================================================================
// CISCO AUTOMATED - FIRESTORE CLOUD PERSISTENCE SERVICE (MODULAR SDK v10+)
// Pure Fetch-on-Demand (NO onSnapshot realtime listeners) with Local Failsafe
// ============================================================================

import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import {
  getFirestoreInstance,
  captureProjectContext,
  isProjectContextCurrent,
  readProjectScopedStorage,
  writeProjectScopedStorage,
} from './firebaseConfig';
import {
  CloudEstimateRecord,
  EstimateAccessRequest,
  CloudDsvRecord,
  CloudUserRecord,
  SharedSkuOverrideRecord,
  SharedSkuPackageRecord,
  EstimateVersionSummary,
  EstimateVersionDetail,
  EstimateVersionInfo,
} from './types';
import {
  getEstimatesMirrorSnapshot,
  saveEstimatesMirrorSnapshot,
  getMirrorLastSyncTimestamp,
  getDeletedEstimateIds,
  addDeletedEstimateId,
} from '../../hooks/useEstimatesMirror';
import {
  normalizeIsoTimestamp,
  compareDatesUnknownLast,
  extractYearMonth,
} from '../../utils/dateUtils';

const ESTIMATES_COLLECTION = 'estimates';
const DSV_COLLECTION = 'dsv_records';

export const CANONICAL_V0_TAG = 'v0_RAW';
export const LEGACY_V0_TAG = 'v0';
export const LOCAL_ESTIMATE_VERSIONS_VAULT_KEY = 'cisco_estimate_versions_vault_v1';
export const LOCAL_ESTIMATES_PENDING_DELETE_KEY = 'cisco_estimates_pending_delete_v1';

// Claves de Bóveda Redundante Multi-Capa para Registros DSV
const LOCAL_DSV_BACKUP_KEY = 'cisco_cloud_dsv_cache_v2';
const LOCAL_DSV_VAULT_KEY = 'cisco_dsv_permanent_vault_v1';
const LOCAL_DSV_LEGACY_KEY = 'cisco_dsv_backup_cache_v1';
const LOCAL_DSV_DELETED_KEY = 'cisco_dsv_deleted_ids_v1';

export function getDeletedDsvIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = readProjectScopedStorage(LOCAL_DSV_DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addDeletedDsvId(id: string): void {
  try {
    if (typeof localStorage === 'undefined' || !id) return;
    const current = getDeletedDsvIds();
    current.add(id.trim());
    writeProjectScopedStorage(LOCAL_DSV_DELETED_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

// ----------------------------------------------------------------------------
// Local Storage Cache & Mirror Snapshot Helpers (0ms Instant Load + Failsafe)
// ----------------------------------------------------------------------------
function getLocalEstimatesCache(): CloudEstimateRecord[] {
  return getEstimatesMirrorSnapshot();
}

function saveLocalEstimatesCache(list: CloudEstimateRecord[], markSyncedNow: boolean = false) {
  saveEstimatesMirrorSnapshot(list, markSyncedNow);
}

// Re-export mirror snapshot helpers for backwards-compatible consumers
export { getEstimatesMirrorSnapshot, getMirrorLastSyncTimestamp, getDeletedEstimateIds, addDeletedEstimateId };

function getLocalDsvCache(): CloudDsvRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const deletedIds = getDeletedDsvIds();
    const rawV2 = readProjectScopedStorage(LOCAL_DSV_BACKUP_KEY);
    const rawVault = readProjectScopedStorage(LOCAL_DSV_VAULT_KEY);
    const rawLegacy = readProjectScopedStorage(LOCAL_DSV_LEGACY_KEY);

    const listV2: CloudDsvRecord[] = rawV2 ? JSON.parse(rawV2) : [];
    const listVault: CloudDsvRecord[] = rawVault ? JSON.parse(rawVault) : [];
    const listLegacy: CloudDsvRecord[] = rawLegacy ? JSON.parse(rawLegacy) : [];

    const map = new Map<string, CloudDsvRecord>();
    for (const r of [...listLegacy, ...listVault, ...listV2]) {
      if (!r || !r.id || deletedIds.has(r.id)) continue;
      map.set(r.id, r);
    }
    return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (_) {
    return [];
  }
}

function saveLocalDsvCache(list: CloudDsvRecord[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    const deletedIds = getDeletedDsvIds();
    const cleanList = list.filter((r) => r && r.id && !deletedIds.has(r.id)).slice(0, 500);
    const serialized = JSON.stringify(cleanList);
    writeProjectScopedStorage(LOCAL_DSV_BACKUP_KEY, serialized);
    writeProjectScopedStorage(LOCAL_DSV_VAULT_KEY, serialized);
    writeProjectScopedStorage(LOCAL_DSV_LEGACY_KEY, serialized);
  } catch (_) {}
}

/**
 * Recursively removes all `undefined` fields from objects and arrays,
 * preventing Firebase Firestore's "Unsupported field value: undefined" error.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result as T;
}

/**
 * Wraps any promise with a strict timeout so that cloud operations
 * never hang or block the application UI if network is slow or credentials are demo/invalid.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 6000,
  fallbackError: string = 'Tiempo de espera de Firebase agotado (Timeout)'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(fallbackError));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 1. ESTIMATES (CCW QUOTER) CLOUD SERVICE
// ----------------------------------------------------------------------------

/**
 * Generates a deterministic Firestore Document ID for an Estimate so re-saving
 * or re-downloading the same Estimate updates it cleanly without creating duplicates.
 */
export function buildEstimateDocId(
  estimateId?: string,
  dealId?: string,
  fileName?: string
): string {
  const cleanEst = String(estimateId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleanEst && cleanEst.toUpperCase() !== 'NA' && cleanEst.toUpperCase() !== 'ESTIMATE') {
    return `est_${cleanEst}`;
  }
  const cleanDeal = String(dealId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanFile = String(fileName || '')
    .trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
  if (cleanDeal && cleanDeal.toUpperCase() !== 'NA') {
    return `est_${cleanDeal}_${cleanFile || 'doc'}`;
  }
  if (cleanFile) {
    return `est_file_${cleanFile}`;
  }
  return 'est_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export interface EstimateAtomicWritePayload {
  docId: string;
  rootPayload: Record<string, any>;
  versionTag: string;
  versionPayload: Record<string, any>;
  v0Payload?: Record<string, any> | null;
  operationId: string;
}

export interface EstimatePersistenceDriver {
  readRootDoc?: (docId: string) => Promise<{ exists: boolean; data?: Partial<CloudEstimateRecord> }>;
  checkV0Doc?: (
    docId: string
  ) => Promise<{ status: 'EXISTS' | 'CONFIRMED_ABSENT' | 'READ_ERROR'; data?: EstimateVersionDetail; error?: string }>;
  commitAtomicEstimateAndVersion: (payload: EstimateAtomicWritePayload) => Promise<void>;
  listVersionDocIds?: (docId: string) => Promise<string[]>;
  deleteEstimateAndVersionsBatch?: (docId: string, versionIds: string[]) => Promise<void>;
}

/**
 * Reads the project-scoped local versions vault (`docId -> versionTag -> EstimateVersionDetail`).
 */
export function getLocalEstimateVersionsVault(
  projectId?: string
): Record<string, Record<string, EstimateVersionDetail>> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = readProjectScopedStorage(LOCAL_ESTIMATE_VERSIONS_VAULT_KEY, projectId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalEstimateVersionsVault(
  vault: Record<string, Record<string, EstimateVersionDetail>>,
  projectId?: string
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    writeProjectScopedStorage(
      LOCAL_ESTIMATE_VERSIONS_VAULT_KEY,
      JSON.stringify(vault),
      projectId
    );
  } catch {}
}

export function getLocalEstimateVersionDetail(
  docId: string,
  versionTag: string,
  projectId?: string
): EstimateVersionDetail | null {
  const vault = getLocalEstimateVersionsVault(projectId);
  const docVersions = vault[docId];
  if (!docVersions) return null;
  if (versionTag === CANONICAL_V0_TAG || versionTag === LEGACY_V0_TAG) {
    return docVersions[CANONICAL_V0_TAG] || docVersions[LEGACY_V0_TAG] || null;
  }
  return docVersions[versionTag] || null;
}

export function putLocalEstimateVersionDetail(
  docId: string,
  versionTag: string,
  detail: EstimateVersionDetail,
  options?: { immutableIfV0?: boolean; projectId?: string }
): void {
  const vault = getLocalEstimateVersionsVault(options?.projectId);
  if (!vault[docId]) {
    vault[docId] = {};
  }
  const canonicalTag =
    versionTag === LEGACY_V0_TAG || versionTag === CANONICAL_V0_TAG
      ? CANONICAL_V0_TAG
      : versionTag;

  // Never overwrite an existing v0_RAW in local vault when immutableIfV0 is true (default)
  if (
    canonicalTag === CANONICAL_V0_TAG &&
    (options?.immutableIfV0 ?? true) &&
    (vault[docId][CANONICAL_V0_TAG] || vault[docId][LEGACY_V0_TAG])
  ) {
    return;
  }

  vault[docId][canonicalTag] = {
    ...detail,
    id: canonicalTag,
    versionTag: canonicalTag,
  };
  saveLocalEstimateVersionsVault(vault, options?.projectId);
}

/**
 * Verifies whether a candidate payload represents authentic original `v0` data (unmodified CCW BOM)
 * rather than an already-edited `v1+` quote with commercial margins or internación/arancel markups.
 */
export function isAuthenticRawV0Payload(
  record: Omit<CloudEstimateRecord, 'id'>,
  versionNumber: number
): boolean {
  if (versionNumber !== 0 && record.activeVersionTag !== CANONICAL_V0_TAG && record.activeVersionTag !== LEGACY_V0_TAG) {
    return false;
  }
  const marginPct = Number(record.financialSummary?.margenPct ?? 0);
  if (marginPct > 0.0001) {
    return false;
  }
  const items = Array.isArray(record.items) ? record.items : [];
  for (const item of items) {
    const netUnit = Number(item.netCiscoUnit ?? 0);
    const saleUnit = Number(item.precioVentaUnitario ?? netUnit);
    if (netUnit > 0 && saleUnit > netUnit * 1.001) {
      return false;
    }
  }
  return true;
}

/**
 * Distinguishes 3 states for `v0_RAW` (and legacy alias `v0`):
 * - `EXISTS`: `v0_RAW` or `v0` already exists (must NOT be overwritten).
 * - `CONFIRMED_ABSENT`: Confirmed that neither `v0_RAW` nor `v0` exists.
 * - `READ_ERROR`: Read failed (network/timeout/permission); must NOT assume absence or overwrite!
 */
export async function checkV0ExistenceState(
  docId: string,
  options?: { driver?: EstimatePersistenceDriver; projectId?: string }
): Promise<{
  status: 'EXISTS' | 'CONFIRMED_ABSENT' | 'READ_ERROR';
  existingV0?: EstimateVersionDetail;
  error?: string;
}> {
  const localV0 = getLocalEstimateVersionDetail(docId, CANONICAL_V0_TAG, options?.projectId);

  if (options?.driver?.checkV0Doc) {
    const remoteRes = await options.driver.checkV0Doc(docId);
    if (remoteRes.status === 'EXISTS') {
      return { status: 'EXISTS', existingV0: remoteRes.data || localV0 || undefined };
    }
    if (remoteRes.status === 'READ_ERROR') {
      return localV0
        ? { status: 'EXISTS', existingV0: localV0 }
        : { status: 'READ_ERROR', error: remoteRes.error || 'Error leyendo v0_RAW remoto' };
    }
    if (localV0) {
      return { status: 'EXISTS', existingV0: localV0 };
    }
    return { status: 'CONFIRMED_ABSENT' };
  }

  if (localV0) {
    return { status: 'EXISTS', existingV0: localV0 };
  }

  const { db, isReady } = getFirestoreInstance();
  if (!isReady || !db) {
    return { status: 'CONFIRMED_ABSENT' };
  }

  try {
    const canonicalRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', CANONICAL_V0_TAG);
    const legacyRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', LEGACY_V0_TAG);

    const [canonicalSnap, legacySnap] = await Promise.all([
      withTimeout(getDoc(canonicalRef), 1800).catch(() => null),
      withTimeout(getDoc(legacyRef), 1800).catch(() => null),
    ]);

    if (canonicalSnap && canonicalSnap.exists()) {
      const d = canonicalSnap.data() as EstimateVersionDetail;
      return {
        status: 'EXISTS',
        existingV0: { ...d, id: CANONICAL_V0_TAG, versionTag: CANONICAL_V0_TAG },
      };
    }

    if (legacySnap && legacySnap.exists()) {
      const d = legacySnap.data() as EstimateVersionDetail;
      return {
        status: 'EXISTS',
        existingV0: { ...d, id: CANONICAL_V0_TAG, versionTag: CANONICAL_V0_TAG },
      };
    }

    return { status: 'CONFIRMED_ABSENT' };
  } catch (err: any) {
    return {
      status: 'READ_ERROR',
      error: err?.message || 'Error de lectura al verificar v0_RAW en Firestore',
    };
  }
}

/**
 * Saves or updates a completed CCW Estimate record and its active version atomically in Firestore.
 * Guarantees:
 * - Item 1: Root header (`estimates/{docId}`) and version document (`estimates/{docId}/versions/{versionTag}`)
 *   are committed together via `writeBatch` (or injectable atomic driver). Header `activeVersionTag` never points
 *   to an unpersisted version, and `syncedToCloud: true` is set ONLY after full confirmation.
 * - Item 2: `v0_RAW` is conditionally created only from authentic unmodified `v0` data and is strictly immutable.
 *   Read errors never trigger `v0` overwrite, and modified `v1+` lines are never fabricated into a fake `v0`.
 */
export async function saveEstimateToCloud(
  record: Omit<CloudEstimateRecord, 'id'>,
  options?: {
    driver?: EstimatePersistenceDriver;
    operationId?: string;
    rawV0Snapshot?: {
      items: CloudEstimateRecord['items'];
      totalNetCisco: number;
      createdAt?: string;
    };
  }
): Promise<{
  success: boolean;
  id?: string;
  versionTag?: string;
  operationId?: string;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC' | 'UNCERTAIN_COMMIT';
  v0Status?: 'PRESENT_IMMUTABLE' | 'UNAVAILABLE_ORIGINAL' | 'READ_ERROR_DEFERRED';
  skippedImmutableV0?: boolean;
  error?: string;
}> {
  const capturedCtx = captureProjectContext();
  const docId = buildEstimateDocId(record.estimateId, record.dealId, record.originalFileName);
  const nowIso = new Date().toISOString();

  // 1. Check existing local record to preserve permissions, baseline, and versions
  const localList = getLocalEstimatesCache();
  const existingLocal = localList.find(
    (x) =>
      x.id === docId ||
      (record.estimateId &&
        record.estimateId !== 'NA' &&
        x.estimateId === record.estimateId)
  );

  const normalizedCreatedAt = normalizeIsoTimestamp(
    record.createdAt || existingLocal?.createdAt || nowIso,
    nowIso
  );
  const normalizedUpdatedAt = nowIso;

  // Determine active version number & canonical tags
  let versionNumber: number;
  if (record.activeVersion !== undefined) {
    versionNumber = record.activeVersion;
  } else if (existingLocal?.activeVersion !== undefined) {
    // If retrying a pending/uncertain operation with the same operationId, reuse the same versionNumber!
    if (
      options?.operationId &&
      existingLocal.lastOperationId === options.operationId &&
      existingLocal.activeVersion !== undefined
    ) {
      versionNumber = existingLocal.activeVersion;
    } else {
      versionNumber = existingLocal.activeVersion === 0 ? 1 : existingLocal.activeVersion + 1;
    }
  } else {
    versionNumber = 1;
  }

  const rawTag =
    record.activeVersionTag || (versionNumber === 0 ? CANONICAL_V0_TAG : `v${versionNumber}`);
  const versionTag =
    rawTag === LEGACY_V0_TAG || versionNumber === 0 ? CANONICAL_V0_TAG : rawTag;

  const operationId =
    options?.operationId || `${docId}::${versionTag}::${normalizedCreatedAt.slice(0, 19)}`;

  // Check v0 state (Item 2: distinguish EXISTS, CONFIRMED_ABSENT, READ_ERROR)
  const v0Check = await checkV0ExistenceState(docId, {
    driver: options?.driver,
    projectId: capturedCtx.projectId,
  });

  // If caller explicitly asked to save v0_RAW (`versionNumber === 0`):
  if (versionNumber === 0) {
    if (v0Check.status === 'EXISTS' && v0Check.existingV0) {
      // Immutability guarantee: never overwrite an existing v0_RAW!
      putLocalEstimateVersionDetail(docId, CANONICAL_V0_TAG, v0Check.existingV0, {
        immutableIfV0: true,
        projectId: capturedCtx.projectId,
      });
      return {
        success: true,
        id: docId,
        versionTag: CANONICAL_V0_TAG,
        operationId,
        syncStatus: 'SYNCED',
        v0Status: 'PRESENT_IMMUTABLE',
        skippedImmutableV0: true,
      };
    }
    if (v0Check.status === 'READ_ERROR') {
      return {
        success: false,
        id: docId,
        versionTag: CANONICAL_V0_TAG,
        operationId,
        syncStatus: 'PENDING_SYNC',
        v0Status: 'READ_ERROR_DEFERRED',
        error:
          v0Check.error ||
          'Lectura de v0_RAW falló; se bloquea escritura para evitar sobrescribir el original.',
      };
    }
    if (!isAuthenticRawV0Payload(record, 0)) {
      return {
        success: false,
        id: docId,
        versionTag: CANONICAL_V0_TAG,
        operationId,
        syncStatus: 'PENDING_SYNC',
        v0Status: 'UNAVAILABLE_ORIGINAL',
        error:
          'Los datos suministrados para v0_RAW contienen márgenes o modificaciones; no se permite fabricar v0 desde una versión editada.',
      };
    }
  }

  const immutableV0Amount =
    v0Check.status === 'EXISTS' && v0Check.existingV0
      ? Number(v0Check.existingV0.netCiscoTotal || v0Check.existingV0.totalAmount || 0)
      : undefined;

  const baselineV0Amount = Number(
    immutableV0Amount ??
      record.baselineV0Amount ??
      existingLocal?.baselineV0Amount ??
      record.financialSummary?.totalNetCisco ??
      0
  );

  const currentAmount = Number(
    versionNumber === 0
      ? baselineV0Amount
      : record.currentAmount ??
          record.financialSummary?.totalCotizadoIntcomex ??
          baselineV0Amount
  );

  // Build version summary entry
  const versionSummaryEntry: EstimateVersionSummary = {
    versionNumber,
    versionTag,
    type: versionNumber === 0 ? 'ORIGINAL_RAW' : 'EDITED',
    totalAmount: currentAmount,
    netCiscoTotal: Number(record.financialSummary?.totalNetCisco || baselineV0Amount),
    marginPct: Number(record.financialSummary?.margenPct ?? (versionNumber === 0 ? 0 : 5.0)),
    internacionPct:
      versionNumber === 0 ? 0 : record.financialSummary?.params?.internacionPct,
    arancelPct: versionNumber === 0 ? 0 : record.financialSummary?.params?.arancelPct,
    itemsCount: record.itemsCount || (record.items || []).length,
    createdAt: versionNumber === 0 ? normalizedCreatedAt : nowIso,
    creatorUsername: record.creator?.username || 'anonymous',
    creatorFullName: record.creator?.fullName || '',
    originalFileName: record.originalFileName || '',
    ...(versionNumber === 0 ? { note: 'BOM Original CCW (Sin Márgenes)' } : {}),
  };

  // Determine whether we have authentic v0 data to include in the atomic batch
  let v0PayloadForBatch: EstimateVersionDetail | null = null;
  let v0Status: 'PRESENT_IMMUTABLE' | 'UNAVAILABLE_ORIGINAL' | 'READ_ERROR_DEFERRED' =
    v0Check.status === 'EXISTS'
      ? 'PRESENT_IMMUTABLE'
      : v0Check.status === 'READ_ERROR'
      ? 'READ_ERROR_DEFERRED'
      : 'UNAVAILABLE_ORIGINAL';

  if (v0Check.status === 'CONFIRMED_ABSENT') {
    if (versionNumber === 0 && isAuthenticRawV0Payload(record, 0)) {
      v0Status = 'PRESENT_IMMUTABLE';
    } else if (options?.rawV0Snapshot && Array.isArray(options.rawV0Snapshot.items)) {
      v0PayloadForBatch = {
        id: CANONICAL_V0_TAG,
        estimateId: record.estimateId || 'NA',
        versionNumber: 0,
        versionTag: CANONICAL_V0_TAG,
        type: 'ORIGINAL_RAW',
        totalAmount: Number(options.rawV0Snapshot.totalNetCisco || baselineV0Amount),
        netCiscoTotal: Number(options.rawV0Snapshot.totalNetCisco || baselineV0Amount),
        marginPct: 0,
        internacionPct: 0,
        arancelPct: 0,
        itemsCount: options.rawV0Snapshot.items.length,
        items: options.rawV0Snapshot.items,
        customOverrideMap: {},
        fastTrackPromoMap: {},
        headerInfo: record.headerInfo,
        createdAt: options.rawV0Snapshot.createdAt || normalizedCreatedAt,
        creatorUsername: record.creator?.username || 'system',
        creatorFullName: 'BOM Cisco Original (CCW)',
        originalFileName: record.originalFileName || '',
        note: 'BOM Original CCW (Sin Márgenes)',
      };
      v0Status = 'PRESENT_IMMUTABLE';
    }
  }

  // Compile full versions summary list without fabricating fake v0 if original is unavailable
  const existingSummaries: EstimateVersionSummary[] = existingLocal?.versionsSummary
    ? [...existingLocal.versionsSummary]
    : [];

  if (v0Check.status === 'EXISTS' && v0Check.existingV0) {
    const existingV0Sum: EstimateVersionSummary = {
      versionNumber: 0,
      versionTag: CANONICAL_V0_TAG,
      type: 'ORIGINAL_RAW',
      totalAmount: Number(v0Check.existingV0.totalAmount || baselineV0Amount),
      netCiscoTotal: Number(v0Check.existingV0.netCiscoTotal || baselineV0Amount),
      marginPct: 0,
      internacionPct: 0,
      arancelPct: 0,
      itemsCount: Number(v0Check.existingV0.itemsCount || (v0Check.existingV0.items || []).length),
      createdAt: v0Check.existingV0.createdAt || normalizedCreatedAt,
      creatorUsername: v0Check.existingV0.creatorUsername || 'system',
      creatorFullName: v0Check.existingV0.creatorFullName || 'BOM Cisco Original (CCW)',
      originalFileName: v0Check.existingV0.originalFileName || record.originalFileName || '',
      note: v0Check.existingV0.note || 'BOM Original CCW (Sin Márgenes)',
    };
    const withoutV0 = existingSummaries.filter((v) => v.versionNumber !== 0);
    existingSummaries.length = 0;
    existingSummaries.push(existingV0Sum, ...withoutV0);
  } else if (v0PayloadForBatch) {
    const withoutV0 = existingSummaries.filter((v) => v.versionNumber !== 0);
    existingSummaries.length = 0;
    existingSummaries.push(
      {
        versionNumber: 0,
        versionTag: CANONICAL_V0_TAG,
        type: 'ORIGINAL_RAW',
        totalAmount: v0PayloadForBatch.totalAmount,
        netCiscoTotal: v0PayloadForBatch.netCiscoTotal,
        marginPct: 0,
        internacionPct: 0,
        arancelPct: 0,
        itemsCount: v0PayloadForBatch.itemsCount,
        createdAt: v0PayloadForBatch.createdAt,
        creatorUsername: v0PayloadForBatch.creatorUsername,
        creatorFullName: v0PayloadForBatch.creatorFullName,
        originalFileName: v0PayloadForBatch.originalFileName,
        note: v0PayloadForBatch.note,
      },
      ...withoutV0
    );
  }

  const filteredSummaries = existingSummaries.filter((v) => v.versionNumber !== versionNumber);
  const updatedSummaries = [...filteredSummaries, versionSummaryEntry].sort(
    (a, b) => a.versionNumber - b.versionNumber
  );

  // Preserve previous activeVersionTag on local record until atomic commit succeeds if we want strict consistency,
  // while storing the full pending version in local cache marked as `syncedToCloud: false, syncStatus: 'PENDING_SYNC'`
  const pendingLocalRecord: CloudEstimateRecord = {
    ...record,
    id: docId,
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    activeVersion: versionNumber,
    activeVersionTag: versionTag,
    baselineV0Amount,
    currentAmount,
    versionsCount: updatedSummaries.length,
    versionsSummary: updatedSummaries,
    isRestricted:
      record.isRestricted !== undefined
        ? Boolean(record.isRestricted)
        : Boolean(existingLocal?.isRestricted ?? false),
    allowedUsers: record.allowedUsers ?? existingLocal?.allowedUsers ?? [],
    accessRequests: record.accessRequests ?? existingLocal?.accessRequests ?? [],
    syncedToCloud: false,
    syncStatus: 'PENDING_SYNC',
    lastOperationId: operationId,
    v0Status,
    lifecycleState: record.lifecycleState || existingLocal?.lifecycleState || 'ACTIVE',
  };

  const versionDetailObject: EstimateVersionDetail = {
    ...versionSummaryEntry,
    id: versionTag,
    estimateId: record.estimateId || 'NA',
    items:
      versionNumber === 0 && v0Check.status === 'EXISTS' && v0Check.existingV0
        ? v0Check.existingV0.items
        : record.items || [],
    customOverrideMap: versionNumber === 0 ? {} : record.customOverrideMap || {},
    fastTrackPromoMap: versionNumber === 0 ? {} : record.fastTrackPromoMap || {},
    headerInfo: record.headerInfo,
  };

  // Persist local version detail and pending estimate in local cache BEFORE remote call
  putLocalEstimateVersionDetail(docId, versionTag, versionDetailObject, {
    immutableIfV0: true,
    projectId: capturedCtx.projectId,
  });
  if (v0PayloadForBatch) {
    putLocalEstimateVersionDetail(docId, CANONICAL_V0_TAG, v0PayloadForBatch, {
      immutableIfV0: true,
      projectId: capturedCtx.projectId,
    });
  }

  const filteredLocal = localList.filter(
    (x) =>
      x.id !== docId &&
      !(record.estimateId && record.estimateId !== 'NA' && x.estimateId === record.estimateId)
  );
  if (isProjectContextCurrent(capturedCtx)) {
    saveLocalEstimatesCache([pendingLocalRecord, ...filteredLocal]);
  }

  const isBrowserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  try {
    // Prepare sanitized atomic payloads for root document and version subcollection document(s)
    const { id: _omitId, ...rootPayloadRaw } = {
      ...pendingLocalRecord,
      syncedToCloud: true,
      syncStatus: 'SYNCED' as const,
    };
    const sanitizedRootPayload = sanitizeForFirestore(rootPayloadRaw);
    const sanitizedVersionPayload = sanitizeForFirestore(versionDetailObject);
    const sanitizedV0BatchPayload = v0PayloadForBatch
      ? sanitizeForFirestore(v0PayloadForBatch)
      : null;

    if (options?.driver) {
      if (!existingLocal && options.driver.readRootDoc) {
        try {
          const remoteSnap = await options.driver.readRootDoc(docId);
          if (remoteSnap.exists && remoteSnap.data) {
            if (record.isRestricted === undefined && remoteSnap.data.isRestricted !== undefined) {
              sanitizedRootPayload.isRestricted = Boolean(remoteSnap.data.isRestricted);
            }
          }
        } catch {}
      }

      await options.driver.commitAtomicEstimateAndVersion({
        docId,
        rootPayload: sanitizedRootPayload,
        versionTag,
        versionPayload: sanitizedVersionPayload,
        v0Payload: sanitizedV0BatchPayload,
        operationId,
      });
    } else {
      const { db, isReady, error } = getFirestoreInstance();
      if (!isReady || !db || isBrowserOffline) {
        return {
          success: true,
          id: docId,
          versionTag,
          operationId,
          syncStatus: 'PENDING_SYNC',
          v0Status,
          error: isBrowserOffline
            ? 'Guardado localmente (Sin conexión: sincronización pendiente)'
            : error
            ? `Guardado localmente (Aviso Cloud: ${error})`
            : undefined,
        };
      }

      const docRef = doc(db, ESTIMATES_COLLECTION, docId);

      // If not in local cache, check remote doc briefly to preserve remote accessRequests / allowedUsers
      if (!existingLocal) {
        try {
          const existingSnap = await withTimeout(getDoc(docRef), 1800);
          if (existingSnap.exists()) {
            const remoteData = existingSnap.data() as Partial<CloudEstimateRecord>;
            if (record.isRestricted === undefined && remoteData.isRestricted !== undefined) {
              sanitizedRootPayload.isRestricted = Boolean(remoteData.isRestricted);
              pendingLocalRecord.isRestricted = Boolean(remoteData.isRestricted);
            }
            if (
              remoteData.allowedUsers &&
              (!pendingLocalRecord.allowedUsers || pendingLocalRecord.allowedUsers.length === 0)
            ) {
              sanitizedRootPayload.allowedUsers = remoteData.allowedUsers;
              pendingLocalRecord.allowedUsers = remoteData.allowedUsers;
            }
            if (
              remoteData.accessRequests &&
              (!pendingLocalRecord.accessRequests || pendingLocalRecord.accessRequests.length === 0)
            ) {
              sanitizedRootPayload.accessRequests = remoteData.accessRequests;
              pendingLocalRecord.accessRequests = remoteData.accessRequests;
            }
            if (remoteData.baselineV0Amount && !pendingLocalRecord.baselineV0Amount) {
              sanitizedRootPayload.baselineV0Amount = remoteData.baselineV0Amount;
              pendingLocalRecord.baselineV0Amount = remoteData.baselineV0Amount;
            }
          }
        } catch (_) {}
      }

      // Single atomic writeBatch for root Estimate header + active Version doc (+ conditional v0_RAW doc)
      const batch = writeBatch(db);
      const versionDocRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', versionTag);

      batch.set(docRef, sanitizedRootPayload, { merge: true });
      batch.set(versionDocRef, sanitizedVersionPayload, { merge: true });

      if (sanitizedV0BatchPayload && versionTag !== CANONICAL_V0_TAG) {
        const v0DocRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', CANONICAL_V0_TAG);
        batch.set(v0DocRef, sanitizedV0BatchPayload, { merge: true });
      }

      await withTimeout(batch.commit(), 8000);
    }

    // Mark as synced in local cache ONLY after the atomic commit completes and project context is still current
    if (isProjectContextCurrent(capturedCtx)) {
      const syncedRecord: CloudEstimateRecord = {
        ...pendingLocalRecord,
        syncedToCloud: true,
        syncStatus: 'SYNCED',
        lastOperationId: operationId,
        v0Status,
      };
      const latestLocal = getLocalEstimatesCache().filter(
        (x) =>
          x.id !== docId &&
          !(record.estimateId && record.estimateId !== 'NA' && x.estimateId === record.estimateId)
      );
      saveLocalEstimatesCache([syncedRecord, ...latestLocal]);
    }

    return {
      success: true,
      id: docId,
      versionTag,
      operationId,
      syncStatus: 'SYNCED',
      v0Status,
    };
  } catch (err: any) {
    const errMsg = String(err?.message || 'Offline');
    const isTimeout =
      errMsg.toLowerCase().includes('timeout') ||
      errMsg.toLowerCase().includes('tiempo de espera');
    const fallbackStatus: 'PENDING_SYNC' | 'UNCERTAIN_COMMIT' = isTimeout
      ? 'UNCERTAIN_COMMIT'
      : 'PENDING_SYNC';

    if (isProjectContextCurrent(capturedCtx)) {
      // If atomic commit failed (non-timeout), revert header activeVersionTag to previous persisted version if one existed
      const revertedLocal: CloudEstimateRecord =
        !isTimeout && existingLocal && existingLocal.syncedToCloud
          ? {
              ...pendingLocalRecord,
              activeVersion: existingLocal.activeVersion,
              activeVersionTag: existingLocal.activeVersionTag,
              syncedToCloud: false,
              syncStatus: fallbackStatus,
              lastOperationId: operationId,
            }
          : {
              ...pendingLocalRecord,
              syncedToCloud: false,
              syncStatus: fallbackStatus,
              lastOperationId: operationId,
            };

      const latestLocal = getLocalEstimatesCache().filter(
        (x) =>
          x.id !== docId &&
          !(record.estimateId && record.estimateId !== 'NA' && x.estimateId === record.estimateId)
      );
      saveLocalEstimatesCache([revertedLocal, ...latestLocal]);
    }

    console.warn('[Firestore Cloud Warning - saveEstimate]:', err);
    return {
      success: true,
      id: docId,
      versionTag,
      operationId,
      syncStatus: fallbackStatus,
      v0Status,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${errMsg})`,
    };
  }
}

/**
 * Saves the immutable original v0 raw BOM directly from Cisco CCW (0% margins).
 * Guarantees that v0 is stored permanently under canonical ID `v0_RAW`, is never overwritten
 * by subsequent or concurrent calls, and rejects modified (`v1+`) items or read-error states.
 */
export async function saveOriginalV0Estimate(
  record: Omit<CloudEstimateRecord, 'id'>,
  options?: { driver?: EstimatePersistenceDriver; operationId?: string }
): Promise<{
  success: boolean;
  id?: string;
  versionTag?: string;
  skippedImmutableV0?: boolean;
  v0Status?: 'PRESENT_IMMUTABLE' | 'UNAVAILABLE_ORIGINAL' | 'READ_ERROR_DEFERRED';
  error?: string;
}> {
  const netCisco = Number(record.financialSummary?.totalNetCisco || 0);
  return await saveEstimateToCloud(
    {
      ...record,
      activeVersion: 0,
      activeVersionTag: CANONICAL_V0_TAG,
      baselineV0Amount: netCisco,
      currentAmount: netCisco,
    },
    options
  );
}

/**
 * Saves an edited version (v1, v2, v3...) with updated margins, custom overrides, and pricing.
 */
export async function saveModifiedEstimateVersion(
  record: Omit<CloudEstimateRecord, 'id'>,
  customVersionNum?: number,
  options?: {
    driver?: EstimatePersistenceDriver;
    operationId?: string;
    rawV0Snapshot?: {
      items: CloudEstimateRecord['items'];
      totalNetCisco: number;
      createdAt?: string;
    };
  }
): Promise<{
  success: boolean;
  id?: string;
  versionTag?: string;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC' | 'UNCERTAIN_COMMIT';
  v0Status?: 'PRESENT_IMMUTABLE' | 'UNAVAILABLE_ORIGINAL' | 'READ_ERROR_DEFERRED';
  error?: string;
}> {
  const versionNum = customVersionNum !== undefined ? customVersionNum : undefined;
  return await saveEstimateToCloud(
    {
      ...record,
      activeVersion: versionNum,
    },
    options
  );
}

/**
 * Inspects whether an Estimate ID already exists in Cloud / Local Cache,
 * returning version status, active version, next version number, and baseline amount.
 */
export async function getEstimateVersionInfo(
  estimateId?: string,
  dealId?: string,
  fileName?: string
): Promise<EstimateVersionInfo> {
  const docId = buildEstimateDocId(estimateId, dealId, fileName);
  const localList = getLocalEstimatesCache();
  const existingLocal = localList.find(
    (x) =>
      x.id === docId ||
      (estimateId &&
        estimateId !== 'NA' &&
        x.estimateId?.trim().toUpperCase() === estimateId.trim().toUpperCase())
  );

  let remoteData: Partial<CloudEstimateRecord> | null = null;
  const { db, isReady } = getFirestoreInstance();
  if (isReady && db) {
    try {
      const snap = await withTimeout(getDoc(doc(db, ESTIMATES_COLLECTION, docId)), 3500);
      if (snap.exists()) {
        remoteData = snap.data() as Partial<CloudEstimateRecord>;
      }
    } catch (_) {}
  }

  const existing = remoteData || existingLocal;
  if (!existing) {
    return {
      exists: false,
      activeVersion: 0,
      activeVersionTag: CANONICAL_V0_TAG,
      nextVersionNumber: 1,
      nextVersionTag: 'v1',
      baselineV0Amount: 0,
      currentAmount: 0,
      versionsCount: 0,
      versionsSummary: [],
      docId,
    };
  }

  const activeVer = existing.activeVersion ?? 1;
  const vCount =
    existing.versionsCount ??
    (existing.versionsSummary?.length || (activeVer > 0 ? activeVer : 1));
  const nextVer = Math.max(activeVer, vCount) + 1;

  return {
    exists: true,
    activeVersion: activeVer,
    activeVersionTag:
      existing.activeVersionTag || (activeVer === 0 ? CANONICAL_V0_TAG : `v${activeVer}`),
    nextVersionNumber: nextVer,
    nextVersionTag: `v${nextVer}`,
    baselineV0Amount:
      existing.baselineV0Amount ?? existing.financialSummary?.totalNetCisco ?? 0,
    currentAmount:
      existing.currentAmount ?? existing.financialSummary?.totalCotizadoIntcomex ?? 0,
    versionsCount: vCount,
    versionsSummary: existing.versionsSummary || [],
    docId,
  };
}

/**
 * Retrieves all versions of a specific estimate (v0_RAW, v1, v2...) from subcollection, local vault, or root summary.
 */
export async function getEstimateVersions(
  docIdOrEstimateId: string
): Promise<{ success: boolean; data: EstimateVersionSummary[]; error?: string }> {
  const docId = docIdOrEstimateId.startsWith('est_')
    ? docIdOrEstimateId
    : buildEstimateDocId(docIdOrEstimateId);

  const localList = getLocalEstimatesCache();
  const existingLocal = localList.find((x) => x.id === docId || x.estimateId === docIdOrEstimateId);
  const localSummaries = existingLocal?.versionsSummary || [];

  try {
    const { db, isReady } = getFirestoreInstance();
    if (!isReady || !db) {
      return { success: true, data: localSummaries };
    }

    const versionsColRef = collection(db, ESTIMATES_COLLECTION, docId, 'versions');
    const snap = await withTimeout(getDocs(versionsColRef), 5000);
    if (!snap.empty) {
      const byVersionNum = new Map<number, EstimateVersionSummary>();
      snap.forEach((d) => {
        const data = d.data();
        const vNum =
          data.versionNumber ??
          (d.id === LEGACY_V0_TAG || d.id === CANONICAL_V0_TAG
            ? 0
            : parseInt(d.id.replace('v', ''), 10) || 1);
        const canonicalTag = vNum === 0 ? CANONICAL_V0_TAG : data.versionTag || `v${vNum}`;
        // Prefer canonical v0_RAW if both v0 and v0_RAW exist
        if (vNum === 0 && byVersionNum.has(0) && d.id === LEGACY_V0_TAG) {
          return;
        }
        byVersionNum.set(vNum, {
          versionNumber: vNum,
          versionTag: canonicalTag,
          type: data.type || (vNum === 0 ? 'ORIGINAL_RAW' : 'EDITED'),
          totalAmount: Number(data.totalAmount) || 0,
          netCiscoTotal: Number(data.netCiscoTotal) || 0,
          marginPct: Number(data.marginPct) || 0,
          internacionPct: data.internacionPct,
          arancelPct: data.arancelPct,
          itemsCount: Number(data.itemsCount) || (data.items || []).length || 0,
          createdAt: normalizeIsoTimestamp(data.createdAt),
          creatorUsername: data.creatorUsername,
          creatorFullName: data.creatorFullName,
          originalFileName: data.originalFileName,
          note: data.note,
        });
      });
      const versions = Array.from(byVersionNum.values()).sort(
        (a, b) => a.versionNumber - b.versionNumber
      );
      return { success: true, data: versions };
    }

    return { success: true, data: localSummaries };
  } catch (err: any) {
    return { success: true, data: localSummaries, error: err?.message };
  }
}

/**
 * Loads the full detail (including items and overrides) of a specific version from the subcollection
 * or local versions vault. Supports both canonical `v0_RAW` and legacy alias `v0`.
 */
export async function loadEstimateVersionDetail(
  docIdOrEstimateId: string,
  versionId: string
): Promise<{ success: boolean; data?: EstimateVersionDetail; error?: string }> {
  const docId = docIdOrEstimateId.startsWith('est_')
    ? docIdOrEstimateId
    : buildEstimateDocId(docIdOrEstimateId);

  const isV0Query = versionId === CANONICAL_V0_TAG || versionId === LEGACY_V0_TAG;
  const candidateIds = isV0Query ? [CANONICAL_V0_TAG, LEGACY_V0_TAG] : [versionId];

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      for (const candidateId of candidateIds) {
        const vRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', candidateId);
        const snap = await withTimeout(getDoc(vRef), 5000);
        if (snap.exists()) {
          const d = snap.data();
          const vNum =
            d.versionNumber ??
            (candidateId === LEGACY_V0_TAG || candidateId === CANONICAL_V0_TAG
              ? 0
              : parseInt(candidateId.replace('v', ''), 10) || 1);
          const canonicalTag = vNum === 0 ? CANONICAL_V0_TAG : d.versionTag || candidateId;
          const detail: EstimateVersionDetail = {
            id: canonicalTag,
            estimateId: docIdOrEstimateId,
            versionNumber: vNum,
            versionTag: canonicalTag,
            type: d.type || (vNum === 0 ? 'ORIGINAL_RAW' : 'EDITED'),
            totalAmount: Number(d.totalAmount) || 0,
            netCiscoTotal: Number(d.netCiscoTotal) || 0,
            marginPct: Number(d.marginPct) || 0,
            internacionPct: d.internacionPct,
            arancelPct: d.arancelPct,
            itemsCount: Number(d.itemsCount) || (d.items || []).length || 0,
            items: d.items || [],
            customOverrideMap: d.customOverrideMap || {},
            fastTrackPromoMap: d.fastTrackPromoMap || {},
            headerInfo: d.headerInfo,
            createdAt: normalizeIsoTimestamp(d.createdAt),
            creatorUsername: d.creatorUsername,
            creatorFullName: d.creatorFullName,
            originalFileName: d.originalFileName,
            note: d.note,
          };
          putLocalEstimateVersionDetail(docId, canonicalTag, detail, { immutableIfV0: true });
          return {
            success: true,
            data: detail,
          };
        }
      }
    }

    // Fallback 1: check local versions vault (supports offline v0_RAW and v1..vN)
    const vaultVersion = getLocalEstimateVersionDetail(docId, versionId);
    if (vaultVersion) {
      return {
        success: true,
        data: vaultVersion,
      };
    }

    // Fallback 2: check local root doc ONLY if the requested version matches its activeVersionTag
    const localList = getLocalEstimatesCache();
    const existing = localList.find((x) => x.id === docId || x.estimateId === docIdOrEstimateId);
    if (existing) {
      const existingTag =
        existing.activeVersionTag ||
        (existing.activeVersion === 0 ? CANONICAL_V0_TAG : `v${existing.activeVersion ?? 1}`);
      if (!isV0Query || existing.activeVersion === 0 || existingTag === CANONICAL_V0_TAG) {
        return {
          success: true,
          data: {
            id: isV0Query ? CANONICAL_V0_TAG : versionId,
            estimateId: existing.estimateId || docId,
            versionNumber: existing.activeVersion ?? 1,
            versionTag: existingTag,
            type: existing.activeVersion === 0 ? 'ORIGINAL_RAW' : 'EDITED',
            totalAmount:
              existing.currentAmount ?? existing.financialSummary?.totalCotizadoIntcomex ?? 0,
            netCiscoTotal:
              existing.baselineV0Amount ?? existing.financialSummary?.totalNetCisco ?? 0,
            marginPct: existing.financialSummary?.margenPct ?? 5.0,
            itemsCount: existing.itemsCount ?? (existing.items || []).length,
            items: existing.items || [],
            customOverrideMap: existing.customOverrideMap,
            fastTrackPromoMap: existing.fastTrackPromoMap,
            headerInfo: existing.headerInfo,
            createdAt: existing.createdAt || new Date().toISOString(),
            creatorUsername: existing.creator?.username,
            creatorFullName: existing.creator?.fullName,
          },
        };
      }
      return {
        success: false,
        error: 'El BOM original (v0_RAW) no está disponible para esta cotización.',
      };
    }

    return { success: false, error: 'Versión no encontrada' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error cargando detalle de versión' };
  }
}

// ----------------------------------------------------------------------------
// VERSION REQUEST CONCURRENCY CONTROLLER (ITEM 2)
// ----------------------------------------------------------------------------
export interface VersionRequestTicket {
  estimateId: string;
  versionTag: string;
  requestId: number;
}

export interface VersionSelectionController {
  beginRequest: (estimateId: string, versionTag: string) => VersionRequestTicket;
  isCurrentRequest: (ticket: VersionRequestTicket) => boolean;
  invalidate: () => void;
  getActiveRequest: () => VersionRequestTicket | null;
}

/**
 * Creates a concurrency controller for version detail requests.
 * Associates every request with `{ estimateId, versionTag, requestId }` and ensures
 * stale out-of-order responses never overwrite a newer selection, closed panel, or unmounted view.
 */
export function createVersionSelectionController(): VersionSelectionController {
  let seq = 0;
  let activeTicket: VersionRequestTicket | null = null;

  return {
    beginRequest(estimateId: string, versionTag: string): VersionRequestTicket {
      seq += 1;
      const ticket: VersionRequestTicket = {
        estimateId: String(estimateId || '').trim(),
        versionTag: String(versionTag || '').trim(),
        requestId: seq,
      };
      activeTicket = ticket;
      return ticket;
    },
    isCurrentRequest(ticket: VersionRequestTicket): boolean {
      if (!activeTicket || !ticket) return false;
      return (
        activeTicket.requestId === ticket.requestId &&
        activeTicket.estimateId === ticket.estimateId &&
        activeTicket.versionTag === ticket.versionTag
      );
    },
    invalidate(): void {
      seq += 1;
      activeTicket = null;
    },
    getActiveRequest(): VersionRequestTicket | null {
      return activeTicket ? { ...activeTicket } : null;
    },
  };
}

// ----------------------------------------------------------------------------
// CURSOR PAGINATION, DETERMINISTIC ORDERING & FULL-HISTORY SEARCH (ITEM 3)
// ----------------------------------------------------------------------------
/**
 * Required Firestore index specification for cursor pagination:
 * Collection: `estimates`
 * Fields: `createdAt` (DESCENDING), `__name__` (DESCENDING)
 */
export const ESTIMATES_FIRESTORE_INDEX_SPEC =
  'COLLECTION: estimates | FIELDS: createdAt DESC, __name__ DESC';

export interface EstimatePaginationCursor {
  createdAt: string;
  id: string;
}

export interface EstimateQueryOptions {
  pageSize?: number;
  cursor?: EstimatePaginationCursor | null;
  searchQuery?: string;
  filterCreator?: string;
  filterMonth?: string;
}

export interface EstimatePaginatedResult {
  success: boolean;
  items: CloudEstimateRecord[];
  allMatchedCount: number;
  totalLoadedRecords: number;
  nextCursor: EstimatePaginationCursor | null;
  hasMore: boolean;
  fromCacheOnly: boolean;
  indexSpec: string;
  error?: string;
}

/**
 * Deterministic comparator for CloudEstimateRecord:
 * 1. Valid `createdAt` descending, with unknown/empty dates always sorted last.
 * 2. Tie-breaker by `id` descending (and `estimateId` descending) so identical timestamps never shift across pages.
 */
export function compareEstimateRecordsDeterministic(
  a: Pick<CloudEstimateRecord, 'id' | 'estimateId' | 'createdAt'>,
  b: Pick<CloudEstimateRecord, 'id' | 'estimateId' | 'createdAt'>
): number {
  const cmpDate = compareDatesUnknownLast(a.createdAt, b.createdAt, 'desc');
  if (cmpDate !== 0) return cmpDate;
  const idA = String(a.id || a.estimateId || '');
  const idB = String(b.id || b.estimateId || '');
  return idB.localeCompare(idA);
}

/**
 * Pure cursor-based pagination and full-dataset filtering helper.
 * Applies search and filters across the ENTIRE dataset (including >300 historical records),
 * orders deterministically with ID tie-breaker, and returns the requested page slice + nextCursor.
 */
export function paginateAndFilterEstimates(
  records: CloudEstimateRecord[],
  options: EstimateQueryOptions = {}
): Omit<EstimatePaginatedResult, 'fromCacheOnly' | 'error'> {
  const pageSize = Math.max(1, Math.min(options.pageSize || 50, 500));
  const q = (options.searchQuery || '').trim().toLowerCase();
  const filterCreator = options.filterCreator || 'ALL';
  const filterMonth = options.filterMonth || 'ALL';

  const sorted = [...records].sort(compareEstimateRecordsDeterministic);

  const matched = sorted.filter((est) => {
    const matchesSearch =
      !q ||
      (est.estimateId || '').toLowerCase().includes(q) ||
      (est.dealId || '').toLowerCase().includes(q) ||
      (est.partnerName || '').toLowerCase().includes(q) ||
      (est.clientFinalName || '').toLowerCase().includes(q) ||
      (est.originalFileName || '').toLowerCase().includes(q) ||
      (est.creator?.username || '').toLowerCase().includes(q) ||
      (est.creator?.fullName || '').toLowerCase().includes(q);

    const matchesCreator =
      filterCreator === 'ALL' || est.creator?.username === filterCreator;

    const estMonth = extractYearMonth(est.createdAt);
    const matchesMonth = filterMonth === 'ALL' || estMonth === filterMonth;

    return matchesSearch && matchesCreator && matchesMonth;
  });

  let startIndex = 0;
  if (options.cursor && (options.cursor.id || options.cursor.createdAt !== undefined)) {
    const cursorIdx = matched.findIndex(
      (item) =>
        item.id === options.cursor!.id &&
        (item.createdAt || '') === (options.cursor!.createdAt || '')
    );
    if (cursorIdx >= 0) {
      startIndex = cursorIdx + 1;
    } else {
      // If exact cursor document was deleted/updated, advance to first item strictly after cursor in deterministic order
      const cursorProbe: Pick<CloudEstimateRecord, 'id' | 'estimateId' | 'createdAt'> = {
        id: options.cursor.id,
        estimateId: options.cursor.id,
        createdAt: options.cursor.createdAt,
      };
      const firstAfter = matched.findIndex(
        (item) => compareEstimateRecordsDeterministic(cursorProbe, item) < 0
      );
      startIndex = firstAfter >= 0 ? firstAfter : matched.length;
    }
  }

  const pageItems = matched.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < matched.length;
  const lastItem = pageItems.length > 0 ? pageItems[pageItems.length - 1] : null;
  const nextCursor: EstimatePaginationCursor | null =
    hasMore && lastItem
      ? { createdAt: lastItem.createdAt || '', id: lastItem.id || '' }
      : null;

  return {
    success: true,
    items: pageItems,
    allMatchedCount: matched.length,
    totalLoadedRecords: sorted.length,
    nextCursor,
    hasMore,
    indexSpec: ESTIMATES_FIRESTORE_INDEX_SPEC,
  };
}

/**
 * Fetches CCW Estimates from Firestore on-demand using cursor-capable batch retrieval.
 * Orders by createdAt descending with deterministic ID tie-breaker, deduplicates by Estimate ID,
 * and supports >300 historical records without silent truncation.
 */
export async function getCloudEstimates(
  limitCount: number = 1000,
  _sinceIso?: string
): Promise<{
  success: boolean;
  data: CloudEstimateRecord[];
  fromCacheOnly?: boolean;
  error?: string;
}> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalEstimatesCache();
    const isBrowserOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;

    const dedupMap = new Map<string, CloudEstimateRecord>();

    // 1. Ingest Desktop SQLite estimates if running within PyWebView desktop app
    if (typeof window !== 'undefined' && (window as any).pywebview?.api?.get_estimates_list) {
      try {
        const desktopEsts = await (window as any).pywebview.api.get_estimates_list();
        if (Array.isArray(desktopEsts)) {
          for (const d of desktopEsts) {
            const estId = String(d.estimate_id_cisco || d.estimate_id || '').trim();
            const fName = String(d.original_filename || d.filename || '').trim();
            if (
              estId === '011682708571Z' ||
              estId === '011682994012A' ||
              fName === 'Intcomex_BancoDeChile_Estimate_2026.xlsx'
            ) {
              continue;
            }
            const key =
              estId && estId.toUpperCase() !== 'NA'
                ? `EST:${estId.toUpperCase()}`
                : `FILE:${fName.toLowerCase()}`;
            if (!dedupMap.has(key)) {
              const dCreatedAt = normalizeIsoTimestamp(d.created_at);
              dedupMap.set(key, {
                id: `est_${(estId || fName || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`,
                dealId: String(d.deal_id || 'NA'),
                estimateId: estId || 'NA',
                partnerName: String(d.partner_name || d.company_name || 'Intcomex Partner'),
                clientFinalName: String(d.client_final_name || d.customer_name || 'Cliente Final'),
                originalFileName: fName || `${estId || 'Estimate'}.xlsx`,
                createdAt: dCreatedAt,
                updatedAt: dCreatedAt,
                creator: {
                  username: String(d.username || 'mskill'),
                  fullName: String(d.full_name || d.username || 'Usuario Intcomex'),
                  role: 'pm',
                },
                financialSummary: {
                  totalNetCisco: Number(d.net_cisco_total) || 0,
                  totalCotizadoIntcomex: Number(d.total_cotizado_intcomex) || 0,
                  gananciaIntcomexUsd: Number(d.ganancia_intcomex_usd) || 0,
                  margenPct: 5.0,
                  currency: 'USD',
                  params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
                },
                headerInfo: {
                  customerName: String(d.client_final_name || d.customer_name || 'Cliente Final'),
                  companyName: String(d.partner_name || d.company_name || 'Intcomex Partner'),
                  address: '',
                  city: 'Santiago',
                  country: 'Chile',
                  phone: '',
                  estimateId: estId || 'NA',
                  dealId: String(d.deal_id || 'NA'),
                  priceList: 'Global Price List',
                  date: dCreatedAt ? dCreatedAt.slice(0, 10) : '',
                },
                itemsCount: Number(d.items_count) || 0,
                items: [],
                customOverrideMap: {},
                isRestricted: false,
                syncedToCloud: false,
              });
            }
          }
        }
      } catch (desktopErr) {
        console.warn('[Desktop Bridge Warning - get_estimates_list]:', desktopErr);
      }
    }

    if (!isReady || !db || isBrowserOffline) {
      // Offline / Local Cache Mode: seed with localCache + desktopEsts
      for (const l of localCache) {
        const key =
          l.estimateId && l.estimateId !== 'NA'
            ? `EST:${l.estimateId.trim().toUpperCase()}`
            : `ID:${l.id}`;
        if (!dedupMap.has(key)) {
          const actVer = l.activeVersion !== undefined ? l.activeVersion : 1;
          const actVerTag = l.activeVersionTag || (actVer === 0 ? 'v0_RAW' : `v${actVer}`);
          const baseV0 = Number(
            l.baselineV0Amount ??
              l.financialSummary?.totalNetCisco ??
              l.financialSummary?.totalCotizadoIntcomex ??
              0
          );
          const curAmt = Number(
            l.currentAmount ??
              l.financialSummary?.totalCotizadoIntcomex ??
              baseV0
          );
          dedupMap.set(key, {
            ...l,
            activeVersion: actVer,
            activeVersionTag: actVerTag,
            baselineV0Amount: baseV0,
            currentAmount: curAmt,
            versionsCount:
              l.versionsCount ??
              (l.versionsSummary?.length || (actVer > 0 ? actVer : 1)),
          });
        }
      }
      const mergedLocal = Array.from(dedupMap.values()).sort(
        compareEstimateRecordsDeterministic
      );
      saveLocalEstimatesCache(mergedLocal);
      return {
        success: true,
        data: mergedLocal,
        fromCacheOnly: true,
        error: isBrowserOffline
          ? 'Modo sin conexión activo (mostrando caché local)'
          : error
          ? `Modo local activo (${error})`
          : undefined,
      };
    }

    const colRef = collection(db, ESTIMATES_COLLECTION);
    const targetMax = Math.max(limitCount || 1000, 300);
    const batchSize = 250;
    const remoteList: CloudEstimateRecord[] = [];

    try {
      let lastDocSnap: any = null;
      let keepPaging = true;

      while (keepPaging && remoteList.length < targetMax) {
        const remaining = targetMax - remoteList.length;
        const pageLimit = Math.min(batchSize, remaining);
        const q = lastDocSnap
          ? query(
              colRef,
              orderBy('createdAt', 'desc'),
              startAfter(lastDocSnap),
              limit(pageLimit)
            )
          : query(colRef, orderBy('createdAt', 'desc'), limit(pageLimit));

        const snapshot = await withTimeout(getDocs(q), 8000);
        if (snapshot.empty) {
          keepPaging = false;
          break;
        }

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<CloudEstimateRecord, 'id'>;
          const normalizedCreatedAt = normalizeIsoTimestamp(data.createdAt);
          const normalizedUpdatedAt = normalizeIsoTimestamp(
            data.updatedAt || data.createdAt
          );

          const activeVersion =
            data.activeVersion !== undefined ? data.activeVersion : 1;
          const activeVersionTag =
            data.activeVersionTag ||
            (activeVersion === 0 ? 'v0_RAW' : `v${activeVersion}`);
          const baselineV0Amount = Number(
            data.baselineV0Amount ??
              data.financialSummary?.totalNetCisco ??
              data.financialSummary?.totalCotizadoIntcomex ??
              0
          );
          const currentAmount = Number(
            data.currentAmount ??
              data.financialSummary?.totalCotizadoIntcomex ??
              baselineV0Amount
          );
          const versionsCount =
            data.versionsCount ??
            (data.versionsSummary?.length ||
              (activeVersion > 0 ? activeVersion : 1));

          remoteList.push({
            ...data,
            id: docSnap.id,
            createdAt: normalizedCreatedAt,
            updatedAt: normalizedUpdatedAt,
            activeVersion,
            activeVersionTag,
            baselineV0Amount,
            currentAmount,
            versionsCount,
            versionsSummary: data.versionsSummary || [],
            isRestricted: Boolean(data.isRestricted),
            allowedUsers: Array.isArray(data.allowedUsers) ? data.allowedUsers : [],
            accessRequests: Array.isArray(data.accessRequests)
              ? data.accessRequests
              : [],
            syncedToCloud: true,
          });
        });

        lastDocSnap = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < pageLimit) {
          keepPaging = false;
        }
      }
    } catch {
      // Fallback query if ordering by createdAt encounters any unindexed or missing legacy field
      const qFallback = query(colRef, limit(targetMax));
      const snapshot = await withTimeout(getDocs(qFallback), 8000);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<CloudEstimateRecord, 'id'>;
        const normalizedCreatedAt = normalizeIsoTimestamp(data.createdAt);
        const normalizedUpdatedAt = normalizeIsoTimestamp(
          data.updatedAt || data.createdAt
        );
        const activeVersion =
          data.activeVersion !== undefined ? data.activeVersion : 1;
        const activeVersionTag =
          data.activeVersionTag ||
          (activeVersion === 0 ? 'v0_RAW' : `v${activeVersion}`);
        const baselineV0Amount = Number(
          data.baselineV0Amount ??
            data.financialSummary?.totalNetCisco ??
            data.financialSummary?.totalCotizadoIntcomex ??
            0
        );
        const currentAmount = Number(
          data.currentAmount ??
            data.financialSummary?.totalCotizadoIntcomex ??
            baselineV0Amount
        );
        const versionsCount =
          data.versionsCount ??
          (data.versionsSummary?.length ||
            (activeVersion > 0 ? activeVersion : 1));

        remoteList.push({
          ...data,
          id: docSnap.id,
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
          activeVersion,
          activeVersionTag,
          baselineV0Amount,
          currentAmount,
          versionsCount,
          versionsSummary: data.versionsSummary || [],
          isRestricted: Boolean(data.isRestricted),
          allowedUsers: Array.isArray(data.allowedUsers) ? data.allowedUsers : [],
          accessRequests: Array.isArray(data.accessRequests)
            ? data.accessRequests
            : [],
          syncedToCloud: true,
        });
      });
    }

    // Deduplicate remote list by estimateId (keep newest / deterministic docId first)
    for (const r of remoteList) {
      const key =
        r.estimateId && r.estimateId !== 'NA'
          ? `EST:${r.estimateId.trim().toUpperCase()}`
          : `ID:${r.id}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, r);
      } else {
        const existingTime = existing.updatedAt || existing.createdAt || '';
        const candidateTime = r.updatedAt || r.createdAt || '';
        const mergedAllowed = Array.from(
          new Set([...(existing.allowedUsers || []), ...(r.allowedUsers || [])])
        );
        const mergedReqsMap = new Map<string, EstimateAccessRequest>();
        for (const req of [...(r.accessRequests || []), ...(existing.accessRequests || [])]) {
          if (req?.username && !mergedReqsMap.has(req.username.toLowerCase())) {
            mergedReqsMap.set(req.username.toLowerCase(), req);
          }
        }
        const winner = candidateTime > existingTime ? r : existing;
        const highestVer = Math.max(existing.activeVersion ?? 1, r.activeVersion ?? 1);
        const resolvedBaseline =
          existing.baselineV0Amount || r.baselineV0Amount || winner.baselineV0Amount;
        const resolvedCurrent =
          winner.currentAmount || winner.financialSummary?.totalCotizadoIntcomex || 0;

        // Merge versions summary lists if present
        const sumMap = new Map<number, EstimateVersionSummary>();
        (existing.versionsSummary || []).forEach((v) => sumMap.set(v.versionNumber, v));
        (r.versionsSummary || []).forEach((v) => sumMap.set(v.versionNumber, v));
        const mergedSummaries = Array.from(sumMap.values()).sort(
          (a, b) => a.versionNumber - b.versionNumber
        );

        dedupMap.set(key, {
          ...winner,
          id: existing.id?.startsWith('est_') ? existing.id : r.id?.startsWith('est_') ? r.id : winner.id,
          activeVersion: highestVer,
          activeVersionTag: winner.activeVersionTag || `v${highestVer}`,
          baselineV0Amount: resolvedBaseline,
          currentAmount: resolvedCurrent,
          versionsCount: Math.max(
            mergedSummaries.length,
            existing.versionsCount || 1,
            r.versionsCount || 1
          ),
          versionsSummary: mergedSummaries,
          isRestricted: Boolean(existing.isRestricted || r.isRestricted),
          allowedUsers: mergedAllowed,
          accessRequests: Array.from(mergedReqsMap.values()),
        });
      }
    }

    // Check local cache for any unsynced or older cached records and push unsynced ones to Firestore in background
    for (const l of localCache) {
      const key =
        l.estimateId && l.estimateId !== 'NA'
          ? `EST:${l.estimateId.trim().toUpperCase()}`
          : `ID:${l.id}`;
      if (!dedupMap.has(key)) {
        const targetId = buildEstimateDocId(l.estimateId, l.dealId, l.originalFileName);
        const promoted: CloudEstimateRecord = {
          ...l,
          id: targetId,
          isRestricted: Boolean(l.isRestricted),
          allowedUsers: Array.isArray(l.allowedUsers) ? l.allowedUsers : [],
          accessRequests: Array.isArray(l.accessRequests) ? l.accessRequests : [],
          syncedToCloud: true,
        };
        dedupMap.set(key, promoted);

        // Background push to Firestore if it wasn't synced yet
        if (!l.syncedToCloud) {
          const { id: _omit, ...payload } = promoted;
          setDoc(doc(db, ESTIMATES_COLLECTION, targetId), sanitizeForFirestore(payload), {
            merge: true,
          }).catch(() => {});
        }
      }
    }

    const merged = Array.from(dedupMap.values()).sort(
      compareEstimateRecordsDeterministic
    );

    // Update multi-tier local mirror snapshot cache and timestamp without 300-record truncation
    saveLocalEstimatesCache(merged, true);

    return { success: true, data: merged, fromCacheOnly: false };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getEstimates]:', err);
    return {
      success: true,
      data: getLocalEstimatesCache(),
      fromCacheOnly: true,
      error: `Mostrando registros locales (Aviso Cloud: ${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Executes a cursor-paginated and filtered query over the full Estimates history.
 * Avoids re-downloading Firestore on every keystroke by operating over the synchronized
 * dataset when provided, or fetching from Cloud when initial load is requested.
 */
export async function queryCloudEstimatesPaginated(
  options: EstimateQueryOptions & { cachedRecords?: CloudEstimateRecord[] } = {}
): Promise<EstimatePaginatedResult> {
  if (Array.isArray(options.cachedRecords)) {
    const isOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    const paged = paginateAndFilterEstimates(options.cachedRecords, options);
    return {
      ...paged,
      fromCacheOnly: isOffline,
    };
  }

  const res = await getCloudEstimates(1500);
  const paged = paginateAndFilterEstimates(res.data || [], options);
  return {
    ...paged,
    fromCacheOnly: Boolean(res.fromCacheOnly),
    error: res.error,
  };
}

/**
 * Toggles manual privacy/restriction on an Estimate (`isRestricted: true | false`).
 * Even when restricted, the Estimate remains visible in search/history table, requiring permission to open.
 */
export async function toggleEstimateRestriction(
  docId: string,
  estimateId: string,
  isRestricted: boolean
): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  try {
    // 1. Update local cache immediately
    const localList = getLocalEstimatesCache().map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return { ...item, isRestricted, updatedAt: nowIso };
      }
      return item;
    });
    saveLocalEstimatesCache(localList);

    // 2. Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            isRestricted,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - toggleEstimateRestriction]:', err);
    return { success: false, error: err?.message || 'Error actualizando visibilidad' };
  }
}

/**
 * Submits a permission request from a user to view/load a restricted Estimate.
 */
export async function requestEstimateAccess(
  docId: string,
  estimateId: string,
  requester: { username: string; fullName: string; role?: string }
): Promise<{ success: boolean; updatedRequests?: EstimateAccessRequest[]; error?: string }> {
  const nowIso = new Date().toISOString();
  const normUsername = (requester.username || '').trim().toLowerCase();
  if (!normUsername) {
    return { success: false, error: 'Usuario inválido para solicitar permiso.' };
  }

  try {
    const localList = getLocalEstimatesCache();
    const targetRecord = localList.find(
      (x) => x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );

    const existingRequests: EstimateAccessRequest[] = Array.isArray(targetRecord?.accessRequests)
      ? [...targetRecord!.accessRequests!]
      : [];

    const newReq: EstimateAccessRequest = {
      username: requester.username,
      fullName: requester.fullName || requester.username,
      role: requester.role || 'pm',
      requestedAt: nowIso,
      status: 'pending',
    };

    const existingIdx = existingRequests.findIndex(
      (r) => r.username.trim().toLowerCase() === normUsername
    );
    if (existingIdx >= 0) {
      existingRequests[existingIdx] = newReq;
    } else {
      existingRequests.push(newReq);
    }

    // Update local cache
    const updatedLocal = localList.map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return { ...item, accessRequests: existingRequests, updatedAt: nowIso };
      }
      return item;
    });
    saveLocalEstimatesCache(updatedLocal);

    // Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            accessRequests: existingRequests,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return { success: true, updatedRequests: existingRequests };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - requestEstimateAccess]:', err);
    return { success: false, error: err?.message || 'Error enviando solicitud de permiso' };
  }
}

/**
 * Approves or rejects a user's permission request on a restricted Estimate.
 */
export async function resolveEstimateAccessRequest(
  docId: string,
  estimateId: string,
  targetUsername: string,
  approve: boolean,
  resolverUsername: string
): Promise<{
  success: boolean;
  allowedUsers?: string[];
  accessRequests?: EstimateAccessRequest[];
  error?: string;
}> {
  const nowIso = new Date().toISOString();
  const normTarget = (targetUsername || '').trim().toLowerCase();

  try {
    const localList = getLocalEstimatesCache();
    const targetRecord = localList.find(
      (x) => x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );

    const currentAllowed = new Set<string>(
      (targetRecord?.allowedUsers || []).map((u) => u.trim().toLowerCase())
    );
    if (approve) {
      currentAllowed.add(normTarget);
    } else {
      currentAllowed.delete(normTarget);
    }
    const updatedAllowed = Array.from(currentAllowed);

    const updatedRequests: EstimateAccessRequest[] = (targetRecord?.accessRequests || []).map((req) => {
      if (req.username.trim().toLowerCase() === normTarget) {
        return {
          ...req,
          status: approve ? 'approved' : 'rejected',
          resolvedAt: nowIso,
          resolvedBy: resolverUsername,
        };
      }
      return req;
    });

    // Update local cache
    const updatedLocal = localList.map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return {
          ...item,
          allowedUsers: updatedAllowed,
          accessRequests: updatedRequests,
          updatedAt: nowIso,
        };
      }
      return item;
    });
    saveLocalEstimatesCache(updatedLocal);

    // Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            allowedUsers: updatedAllowed,
            accessRequests: updatedRequests,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return {
      success: true,
      allowedUsers: updatedAllowed,
      accessRequests: updatedRequests,
    };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - resolveEstimateAccessRequest]:', err);
    return { success: false, error: err?.message || 'Error resolviendo solicitud de permiso' };
  }
}

export interface PendingEstimateDeletionEntry {
  docId: string;
  estimateId?: string;
  knownVersionIds: string[];
  startedAt: string;
  lastError?: string;
}

export function getPendingEstimateDeletions(
  projectId?: string
): Record<string, PendingEstimateDeletionEntry> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = readProjectScopedStorage(LOCAL_ESTIMATES_PENDING_DELETE_KEY, projectId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePendingEstimateDeletions(
  map: Record<string, PendingEstimateDeletionEntry>,
  projectId?: string
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    writeProjectScopedStorage(LOCAL_ESTIMATES_PENDING_DELETE_KEY, JSON.stringify(map), projectId);
  } catch {}
}

/**
 * Archives an estimate logically (`lifecycleState: 'ARCHIVED'`) without destroying historical versions.
 */
export async function archiveCloudEstimate(
  docId: string,
  estimateId?: string,
  archivedBy: string = 'system'
): Promise<{ success: boolean; lifecycleState: 'ARCHIVED'; error?: string }> {
  const nowIso = new Date().toISOString();
  try {
    const localList = getLocalEstimatesCache().map((item) => {
      if (
        item.id === docId ||
        (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)
      ) {
        return {
          ...item,
          lifecycleState: 'ARCHIVED' as const,
          archivedAt: nowIso,
          archivedBy,
          updatedAt: nowIso,
        };
      }
      return item;
    });
    saveLocalEstimatesCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db && !docId.startsWith('cloud-est-')) {
      const docRef = doc(db, ESTIMATES_COLLECTION, docId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            lifecycleState: 'ARCHIVED',
            archivedAt: nowIso,
            archivedBy,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        4000
      );
    }

    return { success: true, lifecycleState: 'ARCHIVED' };
  } catch (err: any) {
    return {
      success: false,
      lifecycleState: 'ARCHIVED',
      error: err?.message || 'Error archivando cotización',
    };
  }
}

/**
 * Deletes an estimate document AND all of its `versions/*` subcollection documents from Firestore
 * and local cache with multi-step `PENDING_DELETE` tracking and idempotent retry (Item 8).
 * Also supports `options.mode === 'archive'` for logical archiving when preserving history.
 */
export async function deleteCloudEstimate(
  docId: string,
  estimateId?: string,
  options?: {
    mode?: 'archive' | 'hard_delete';
    archivedBy?: string;
    driver?: EstimatePersistenceDriver;
  }
): Promise<{
  success: boolean;
  completed?: boolean;
  partialDeletePending?: boolean;
  deletedVersionsCount?: number;
  lifecycleState?: 'ARCHIVED' | 'PENDING_DELETE' | 'DELETED';
  error?: string;
}> {
  if (options?.mode === 'archive') {
    const archRes = await archiveCloudEstimate(docId, estimateId, options.archivedBy);
    return {
      success: archRes.success,
      completed: archRes.success,
      lifecycleState: 'ARCHIVED',
      error: archRes.error,
    };
  }

  const capturedCtx = captureProjectContext();
  const targetDocIds = new Set<string>([docId]);
  if (estimateId && estimateId !== 'NA') {
    targetDocIds.add(buildEstimateDocId(estimateId));
  }

  // 1. Collect known version IDs from local cache, local versions vault, and any prior pending delete entry
  const localList = getLocalEstimatesCache();
  const targetLocalRecord = localList.find(
    (x) => x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
  );
  const versionsVault = getLocalEstimateVersionsVault(capturedCtx.projectId);
  const pendingDeletes = getPendingEstimateDeletions(capturedCtx.projectId);

  const knownVersionIdsSet = new Set<string>([CANONICAL_V0_TAG, LEGACY_V0_TAG]);
  if (targetLocalRecord?.versionsSummary) {
    for (const vs of targetLocalRecord.versionsSummary) {
      if (vs.versionTag) knownVersionIdsSet.add(vs.versionTag);
      if (vs.versionNumber !== undefined) {
        knownVersionIdsSet.add(vs.versionNumber === 0 ? CANONICAL_V0_TAG : `v${vs.versionNumber}`);
      }
    }
  }
  if (targetLocalRecord?.activeVersionTag) {
    knownVersionIdsSet.add(targetLocalRecord.activeVersionTag);
  }
  for (const tDocId of targetDocIds) {
    if (versionsVault[tDocId]) {
      for (const vKey of Object.keys(versionsVault[tDocId])) {
        knownVersionIdsSet.add(vKey);
      }
    }
    if (pendingDeletes[tDocId]?.knownVersionIds) {
      for (const vKey of pendingDeletes[tDocId].knownVersionIds) {
        knownVersionIdsSet.add(vKey);
      }
    }
  }

  // 2. Mark as PENDING_DELETE before starting remote subcollection + root purge
  pendingDeletes[docId] = {
    docId,
    estimateId,
    knownVersionIds: Array.from(knownVersionIdsSet),
    startedAt: pendingDeletes[docId]?.startedAt || new Date().toISOString(),
  };
  savePendingEstimateDeletions(pendingDeletes, capturedCtx.projectId);

  try {
    let deletedVersionsCount = 0;

    if (options?.driver) {
      let remoteVerIds: string[] = [];
      if (options.driver.listVersionDocIds) {
        remoteVerIds = await options.driver.listVersionDocIds(docId);
      }
      const allVerIds = Array.from(new Set([...knownVersionIdsSet, ...remoteVerIds]));
      if (options.driver.deleteEstimateAndVersionsBatch) {
        await options.driver.deleteEstimateAndVersionsBatch(docId, allVerIds);
      }
      deletedVersionsCount = allVerIds.length;
    } else {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        for (const tDocId of targetDocIds) {
          if (tDocId.startsWith('cloud-est-')) continue;

          // Enumerate remote subcollection versions so no orphan version docs remain
          const remoteVerIds = new Set<string>(knownVersionIdsSet);
          try {
            const verColRef = collection(db, ESTIMATES_COLLECTION, tDocId, 'versions');
            const verSnap = await withTimeout(getDocs(verColRef), 4000);
            verSnap.forEach((vDoc) => remoteVerIds.add(vDoc.id));
          } catch (_) {
            // Even if getDocs fails, we still batch-delete all known version tags
          }

          const allVerIds = Array.from(remoteVerIds);
          // Delete versions + root doc in atomic writeBatch chunks (<= 450 ops per batch)
          const batchSize = 400;
          for (let i = 0; i < allVerIds.length; i += batchSize) {
            const slice = allVerIds.slice(i, i + batchSize);
            const batch = writeBatch(db);
            for (const vId of slice) {
              batch.delete(doc(db, ESTIMATES_COLLECTION, tDocId, 'versions', vId));
            }
            if (i + batchSize >= allVerIds.length) {
              batch.delete(doc(db, ESTIMATES_COLLECTION, tDocId));
            }
            await withTimeout(batch.commit(), 5000);
          }

          if (allVerIds.length === 0) {
            await withTimeout(deleteDoc(doc(db, ESTIMATES_COLLECTION, tDocId)), 4000);
          }
          deletedVersionsCount += allVerIds.length;
        }
      }
    }

    // 3. Only AFTER all version subcollection docs and root doc are confirmed deleted:
    //    - Register permanent tombstone
    //    - Remove from local estimates cache and local versions vault
    //    - Clear from pending deletions queue
    addDeletedEstimateId(docId, capturedCtx.projectId);
    if (estimateId && estimateId !== 'NA') {
      addDeletedEstimateId(estimateId, capturedCtx.projectId);
    }

    const updatedLocal = getLocalEstimatesCache().filter(
      (x) => x.id !== docId && !(estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );
    saveLocalEstimatesCache(updatedLocal);

    const updatedVault = getLocalEstimateVersionsVault(capturedCtx.projectId);
    for (const tDocId of targetDocIds) {
      delete updatedVault[tDocId];
      delete pendingDeletes[tDocId];
    }
    delete pendingDeletes[docId];
    saveLocalEstimateVersionsVault(updatedVault, capturedCtx.projectId);
    savePendingEstimateDeletions(pendingDeletes, capturedCtx.projectId);

    return {
      success: true,
      completed: true,
      partialDeletePending: false,
      deletedVersionsCount,
      lifecycleState: 'DELETED',
    };
  } catch (err: any) {
    const errMsg = err?.message || 'Error eliminando cotización y sus versiones';
    pendingDeletes[docId] = {
      ...pendingDeletes[docId],
      lastError: errMsg,
    };
    savePendingEstimateDeletions(pendingDeletes, capturedCtx.projectId);

    // Mark record in local cache as PENDING_DELETE so UI/Sync knows deletion is incomplete
    const markedLocal = getLocalEstimatesCache().map((x) => {
      if (x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)) {
        return { ...x, lifecycleState: 'PENDING_DELETE' as const };
      }
      return x;
    });
    saveLocalEstimatesCache(markedLocal);

    console.warn('[Firestore Cloud Warning - deleteEstimate]:', err);
    return {
      success: false,
      completed: false,
      partialDeletePending: true,
      lifecycleState: 'PENDING_DELETE',
      error: errMsg,
    };
  }
}

/**
 * Resumes any interrupted `PENDING_DELETE` estimate purges idempotently.
 */
export async function resumePendingEstimateDeletions(options?: {
  driver?: EstimatePersistenceDriver;
}): Promise<{ completed: number; remaining: number }> {
  const pendingMap = getPendingEstimateDeletions();
  const entries = Object.values(pendingMap);
  let completed = 0;
  for (const entry of entries) {
    const res = await deleteCloudEstimate(entry.docId, entry.estimateId, {
      mode: 'hard_delete',
      driver: options?.driver,
    });
    if (res.success && res.completed) {
      completed += 1;
    }
  }
  const remaining = Object.keys(getPendingEstimateDeletions()).length;
  return { completed, remaining };
}

// ----------------------------------------------------------------------------
// 2. DSV (DIRECT SHIP VENDOR) CLOUD SERVICE (WITH MULTI-TIER VAULT & AUTO-SYNC)
// ----------------------------------------------------------------------------

/**
 * Saves a generated DSV record to Firestore 'dsv_records' collection with redundant vault persistence.
 */
export async function saveDsvToCloud(
  record: Omit<CloudDsvRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();

    // 1. Local Cache Persistence in Multi-Tier Vault
    const cleanCreatedAt = record.createdAt || new Date().toISOString();
    const localId = 'cloud-dsv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const newRecordWithId: CloudDsvRecord = { ...record, id: localId, createdAt: cleanCreatedAt };
    
    const localList = getLocalDsvCache();
    const updatedLocal = [newRecordWithId, ...localList.filter((x) => x.id !== localId && (x.soNumber !== record.soNumber || x.dealId !== record.dealId))];
    saveLocalDsvCache(updatedLocal);

    // 2. Firestore Cloud Persistence
    if (!isReady || !db) {
      return {
        success: true,
        id: localId,
        error: error ? `Guardado localmente (Aviso Cloud: ${error})` : undefined,
      };
    }

    const colRef = collection(db, DSV_COLLECTION);
    const sanitizedRecord = sanitizeForFirestore({
      ...record,
      createdAt: cleanCreatedAt,
    });
    const docRef = await withTimeout(addDoc(colRef, sanitizedRecord), 6000);

    // Actualizar ID local con el ID real de Firestore
    if (docRef?.id) {
      const confirmedList = updatedLocal.map((item) => (item.id === localId ? { ...item, id: docRef.id } : item));
      saveLocalDsvCache(confirmedList);
    }

    return { success: true, id: docRef ? docRef.id : localId };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveDsv]:', err);
    return {
      success: true,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Fetches DSV Records from Firestore on-demand using getDocs() with smart bidirectional merge.
 */
export async function getCloudDsvs(
  limitCount: number = 200
): Promise<{ success: boolean; data: CloudDsvRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalDsvCache();
    const deletedIds = getDeletedDsvIds();

    if (!isReady || !db) {
      return {
        success: true,
        data: localCache,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }

    const colRef = collection(db, DSV_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withTimeout(getDocs(q), 6000);

    const remoteList: CloudDsvRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<CloudDsvRecord, 'id'>;
      if (deletedIds.has(docSnap.id)) {
        // Purgar de Firestore en segundo plano si está tombstoned
        deleteDoc(doc(db, DSV_COLLECTION, docSnap.id)).catch(() => {});
        return;
      }
      remoteList.push({
        ...data,
        id: docSnap.id,
      });
    });

    const remoteKeys = new Set(remoteList.map((r) => r.id));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteKeys.has(l.id) && !deletedIds.has(l.id));

    // Auto-sincronizar registros locales pendientes a Firestore
    if (nonDuplicatedLocal.length > 0) {
      for (const pending of nonDuplicatedLocal) {
        if (pending.id.startsWith('cloud-dsv-')) {
          const { id: _omit, ...payload } = pending;
          addDoc(colRef, sanitizeForFirestore(payload)).then((newDoc) => {
            if (newDoc?.id) {
              const current = getLocalDsvCache().map((x) => (x.id === pending.id ? { ...x, id: newDoc.id } : x));
              saveLocalDsvCache(current);
            }
          }).catch(() => {});
        }
      }
    }

    const merged = [...remoteList, ...nonDuplicatedLocal].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    saveLocalDsvCache(merged);

    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getDsvs]:', err);
    return {
      success: true,
      data: getLocalDsvCache(),
      error: `Mostrando registros locales (Aviso Cloud: ${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Deletes a DSV document from Firestore and local cache with permanent tombstone tracking.
 */
export async function deleteCloudDsv(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Registrar lápida para evitar resurrección
    addDeletedDsvId(docId);

    // 2. Eliminar de caché local
    const localList = getLocalDsvCache().filter((x) => x.id !== docId);
    saveLocalDsvCache(localList);

    // 3. Eliminar de Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db && !docId.startsWith('cloud-dsv-')) {
      const docRef = doc(db, DSV_COLLECTION, docId);
      await withTimeout(deleteDoc(docRef), 3000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteDsv]:', err);
    return { success: false, error: err?.message || 'Error eliminando registro DSV' };
  }
}

// ----------------------------------------------------------------------------
// 3. RBAC USERS & AUTHENTICATION CLOUD SERVICE (WITH OFFLINE FALLBACK)
// ----------------------------------------------------------------------------
const USERS_COLLECTION = 'users';
const LOCAL_USERS_BACKUP_KEY = 'cisco_users_cloud_cache_v2';

export async function sha256Salted(password: string): Promise<string> {
  const salt = 'Cisco_Automated_Intcomex_Salt_2026!';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_BASE_USERS: CloudUserRecord[] = [
  {
    username: 'admin',
    full_name: 'Administrador del Sistema',
    email: 'admin@cotizador.local',
    role: 'admin',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'pm_cisco',
    full_name: 'Product Manager Cisco',
    email: 'pm@cotizador.local',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
];

export function getLocalUsersCache(): CloudUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_BACKUP_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem('cisco_users_local');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: any) => ({
          ...u,
          password_hash: u.password_hash || '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
        }));
      }
    }
  } catch (_) {}
  return DEFAULT_BASE_USERS;
}

export function saveLocalUsersCache(list: CloudUserRecord[]) {
  try {
    localStorage.setItem(LOCAL_USERS_BACKUP_KEY, JSON.stringify(list));
    localStorage.setItem('cisco_users_local', JSON.stringify(list));
  } catch (_) {}
}

export async function getCloudUsers(): Promise<{ success: boolean; data: CloudUserRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localUsers = getLocalUsersCache();

    if (!isReady || !db) {
      return { success: true, data: localUsers, error: error ? `Modo local (${error})` : undefined };
    }

    const colRef = collection(db, USERS_COLLECTION);
    const snapshot = await withTimeout(getDocs(colRef), 2000);

    if (snapshot.empty) {
      // Auto-seed default users in Firestore on first cloud load
      const defaultHash = await sha256Salted('Intcomex2026!');
      const seededList: CloudUserRecord[] = DEFAULT_BASE_USERS.map((u) => ({
        ...u,
        password_hash: defaultHash,
      }));

      for (const u of seededList) {
        try {
          const userDocRef = doc(db, USERS_COLLECTION, u.username.toLowerCase());
          await withTimeout(setDoc(userDocRef, sanitizeForFirestore(u)), 1500);
        } catch (seedErr) {
          console.warn('Error auto-seeding user:', u.username, seedErr);
        }
      }

      saveLocalUsersCache(seededList);
      return { success: true, data: seededList };
    }

    const remoteUsers: CloudUserRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CloudUserRecord;
      remoteUsers.push({
        ...data,
        id: docSnap.id,
        username: (data.username || docSnap.id).toLowerCase(),
      });
    });

    saveLocalUsersCache(remoteUsers);
    return { success: true, data: remoteUsers };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getCloudUsers]:', err);
    return {
      success: true,
      data: getLocalUsersCache(),
      error: `Modo local activo (${err?.message || 'Sin conexión'})`,
    };
  }
}

export async function saveCloudUser(
  user: CloudUserRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUser: CloudUserRecord = {
      ...user,
      username: user.username.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    // 1. Update local cache
    const localList = getLocalUsersCache();
    const filtered = localList.filter((u) => u.username.toLowerCase() !== cleanUser.username);
    const updatedLocal = [cleanUser, ...filtered];
    saveLocalUsersCache(updatedLocal);

    // 2. Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const userDocRef = doc(db, USERS_COLLECTION, cleanUser.username);
      await withTimeout(setDoc(userDocRef, sanitizeForFirestore(cleanUser), { merge: true }), 2500);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveCloudUser]:', err);
    return { success: false, error: err?.message || 'Error guardando usuario' };
  }
}

export async function deleteCloudUser(
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const clean = username.trim().toLowerCase();
    const localList = getLocalUsersCache().filter((u) => u.username.toLowerCase() !== clean);
    saveLocalUsersCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const userDocRef = doc(db, USERS_COLLECTION, clean);
      await withTimeout(deleteDoc(userDocRef), 2000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteCloudUser]:', err);
    return { success: false, error: err?.message || 'Error eliminando usuario' };
  }
}

// ----------------------------------------------------------------------------
// 4. SHARED SKU OVERRIDES & COMMUNITY RULES (CLOUD & LOCAL SYNC)
// ----------------------------------------------------------------------------
const SHARED_SKU_COLLECTION = 'shared_sku_rules';
const LOCAL_SHARED_SKU_BACKUP_KEY = 'cisco_shared_sku_rules_cache_v2';
const LOCAL_SHARED_SKU_VAULT_KEY = 'cisco_shared_sku_permanent_vault_v1';
const LOCAL_SHARED_SKU_LEGACY_KEY = 'cisco_shared_sku_rules_cache_v1';
const LOCAL_SHARED_SKU_DELETED_KEY = 'cisco_shared_sku_deleted_ids_v1';

export function getDeletedSharedSkuIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(LOCAL_SHARED_SKU_DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addDeletedSharedSkuId(sku: string): void {
  try {
    if (typeof localStorage === 'undefined' || !sku) return;
    const current = getDeletedSharedSkuIds();
    const clean = sku.trim().toUpperCase();
    current.add(clean);
    localStorage.setItem(LOCAL_SHARED_SKU_DELETED_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function getLocalSharedSkuCache(): SharedSkuOverrideRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const deletedIds = getDeletedSharedSkuIds();
    const rawV2 = localStorage.getItem(LOCAL_SHARED_SKU_BACKUP_KEY);
    const rawVault = localStorage.getItem(LOCAL_SHARED_SKU_VAULT_KEY);
    const rawLegacy = localStorage.getItem(LOCAL_SHARED_SKU_LEGACY_KEY);

    const listV2: SharedSkuOverrideRecord[] = rawV2 ? JSON.parse(rawV2) : [];
    const listVault: SharedSkuOverrideRecord[] = rawVault ? JSON.parse(rawVault) : [];
    const listLegacy: SharedSkuOverrideRecord[] = rawLegacy ? JSON.parse(rawLegacy) : [];

    const map = new Map<string, SharedSkuOverrideRecord>();
    for (const r of [...listLegacy, ...listVault, ...listV2]) {
      if (!r || !r.sku) continue;
      const cleanSku = r.sku.trim().toUpperCase();
      if (deletedIds.has(cleanSku)) continue;
      map.set(cleanSku, { ...r, sku: cleanSku });
    }
    return Array.from(map.values());
  } catch (_) {
    return [];
  }
}

export function saveLocalSharedSkuCache(rules: SharedSkuOverrideRecord[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    const deletedIds = getDeletedSharedSkuIds();
    const cleanList = rules.filter((r) => r && r.sku && !deletedIds.has(r.sku.trim().toUpperCase()));
    const serialized = JSON.stringify(cleanList);
    localStorage.setItem(LOCAL_SHARED_SKU_BACKUP_KEY, serialized);
    localStorage.setItem(LOCAL_SHARED_SKU_VAULT_KEY, serialized);
    localStorage.setItem(LOCAL_SHARED_SKU_LEGACY_KEY, serialized);
  } catch (_) {}
}

function normalizeRuleValue(rule: any): 'equipo' | 'intangible' | 'arancel' {
  const s = String(rule || '').trim().toLowerCase();
  if (s === 'intangible') return 'intangible';
  if (s === 'arancel') return 'arancel';
  return 'equipo';
}

/**
 * Publishes/Shares SKU rules to Firestore and local backup
 */
export async function publishSharedSkuRules(
  rules: SharedSkuOverrideRecord[],
  author: { username: string; fullName: string; role: string },
  _title?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRules: SharedSkuOverrideRecord[] = rules.map((r) => ({
      ...r,
      sku: r.sku.trim().toUpperCase(),
      rule: normalizeRuleValue(r.rule),
      previousType: r.previousType || 'Hardware',
      author: {
        username: author.username,
        fullName: author.fullName,
        role: author.role,
      },
      updatedAt: new Date().toISOString(),
      createdAt: r.createdAt || new Date().toISOString(),
    }));

    // 1. Update local cache redundantly
    const existingLocal = getLocalSharedSkuCache();
    const cleanSkus = new Set(cleanRules.map((r) => r.sku));
    const mergedLocal = [
      ...cleanRules,
      ...existingLocal.filter((e) => !cleanSkus.has(e.sku)),
    ];
    saveLocalSharedSkuCache(mergedLocal);

    // 2. Persist to Firestore
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db) {
      for (const rule of cleanRules) {
        const safeDocId = encodeURIComponent(rule.sku).replace(/\./g, '%2E');
        const ruleDocRef = doc(db, SHARED_SKU_COLLECTION, safeDocId);
        await withTimeout(setDoc(ruleDocRef, sanitizeForFirestore(rule), { merge: true }), 3500);
      }
    }

    return {
      success: true,
      error: !isReady && error ? `Guardado localmente (${error})` : undefined,
    };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - publishSharedSkuRules]:', err);
    return {
      success: true,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Retrieves all shared SKU overrides from Firestore & local backup with auto-sync
 */
export async function getSharedSkuRules(): Promise<{
  success: boolean;
  data: SharedSkuOverrideRecord[];
  error?: string;
}> {
  try {
    const localCache = getLocalSharedSkuCache();
    const deletedIds = getDeletedSharedSkuIds();
    const { db, isReady, error } = getFirestoreInstance();

    if (!isReady || !db) {
      return { success: true, data: localCache, error: error ? `Modo local activo (${error})` : undefined };
    }

    const colRef = collection(db, SHARED_SKU_COLLECTION);
    const snapshot = await withTimeout(getDocs(colRef), 4000);

    const remoteList: SharedSkuOverrideRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SharedSkuOverrideRecord;
      let rawSku = data.sku;
      try {
        if (!rawSku || rawSku.includes('%')) {
          rawSku = decodeURIComponent(docSnap.id);
        }
      } catch (_) {
        rawSku = docSnap.id;
      }

      const finalSku = (rawSku || docSnap.id).toUpperCase();
      if (deletedIds.has(finalSku)) {
        // Purgar de Firestore si está tombstoned
        deleteDoc(doc(db, SHARED_SKU_COLLECTION, docSnap.id)).catch(() => {});
        return;
      }

      remoteList.push({
        ...data,
        id: docSnap.id,
        sku: finalSku,
        rule: normalizeRuleValue(data.rule),
        previousType: data.previousType || 'Hardware',
      });
    });

    const remoteSkus = new Set(remoteList.map((r) => r.sku));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteSkus.has(l.sku) && !deletedIds.has(l.sku));

    // Auto-sincronizar reglas locales pendientes a Firestore
    if (nonDuplicatedLocal.length > 0) {
      for (const rule of nonDuplicatedLocal) {
        const safeDocId = encodeURIComponent(rule.sku).replace(/\./g, '%2E');
        setDoc(doc(db, SHARED_SKU_COLLECTION, safeDocId), sanitizeForFirestore(rule), { merge: true }).catch(() => {});
      }
    }

    const merged = [...remoteList, ...nonDuplicatedLocal];
    saveLocalSharedSkuCache(merged);

    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getSharedSkuRules]:', err);
    return {
      success: true,
      data: getLocalSharedSkuCache(),
      error: `Mostrando reglas locales (${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Deletes a shared SKU rule from Firestore & local cache with permanent tombstone tracking
 */
export async function deleteSharedSkuRule(
  sku: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSku = sku.trim().toUpperCase();
    // 1. Registrar lápida (tombstone)
    addDeletedSharedSkuId(cleanSku);

    // 2. Eliminar de caché local redundante
    const localList = getLocalSharedSkuCache().filter((r) => r.sku !== cleanSku);
    saveLocalSharedSkuCache(localList);

    // 3. Eliminar de overrides en memoria y vault
    try {
      if (typeof localStorage !== 'undefined') {
        const rawOverrides = localStorage.getItem('cisco_sku_overrides_v2');
        if (rawOverrides) {
          const parsed = JSON.parse(rawOverrides);
          delete parsed[cleanSku];
          localStorage.setItem('cisco_sku_overrides_v2', JSON.stringify(parsed));
          localStorage.setItem('cisco_sku_overrides_vault_v1', JSON.stringify(parsed));
        }
      }
    } catch (_) {}

    // 4. Eliminar de Firestore con docId codificado correcto
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const safeDocId = encodeURIComponent(cleanSku).replace(/\./g, '%2E');
      await withTimeout(deleteDoc(doc(db, SHARED_SKU_COLLECTION, safeDocId)), 3000);
      if (safeDocId !== cleanSku) {
        deleteDoc(doc(db, SHARED_SKU_COLLECTION, cleanSku)).catch(() => {});
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteSharedSkuRule]:', err);
    return { success: false, error: err?.message || 'Error eliminando regla' };
  }
}