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
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebaseConfig';
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
} from '../../hooks/useEstimatesMirror';
import { normalizeIsoTimestamp } from '../../utils/dateUtils';

const ESTIMATES_COLLECTION = 'estimates';
const DSV_COLLECTION = 'dsv_records';

const LOCAL_DSV_BACKUP_KEY = 'cisco_cloud_dsv_cache_v2';

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
export { getEstimatesMirrorSnapshot, getMirrorLastSyncTimestamp };

function getLocalDsvCache(): CloudDsvRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DSV_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalDsvCache(list: CloudDsvRecord[]) {
  try {
    localStorage.setItem(LOCAL_DSV_BACKUP_KEY, JSON.stringify(list));
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

/**
 * Saves or updates a completed CCW Estimate record in Firestore 'estimates' collection.
 * Preserves financial summary, items array, customOverrideMap, and privacy/access permissions.
 */
export async function saveEstimateToCloud(
  record: Omit<CloudEstimateRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
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
    record.createdAt || existingLocal?.createdAt || nowIso
  );
  const normalizedUpdatedAt = nowIso;

  // Determine active version number & tags
  let versionNumber: number;
  if (record.activeVersion !== undefined) {
    versionNumber = record.activeVersion;
  } else if (existingLocal?.activeVersion !== undefined) {
    versionNumber = existingLocal.activeVersion === 0 ? 1 : existingLocal.activeVersion + 1;
  } else {
    versionNumber = 1;
  }

  const versionTag =
    record.activeVersionTag || (versionNumber === 0 ? 'v0_RAW' : `v${versionNumber}`);

  const baselineV0Amount = Number(
    record.baselineV0Amount ??
      existingLocal?.baselineV0Amount ??
      record.financialSummary?.totalNetCisco ??
      0
  );

  const currentAmount = Number(
    record.currentAmount ??
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
    internacionPct: record.financialSummary?.params?.internacionPct,
    arancelPct: record.financialSummary?.params?.arancelPct,
    itemsCount: record.itemsCount || (record.items || []).length,
    createdAt: nowIso,
    creatorUsername: record.creator?.username || 'anonymous',
    creatorFullName: record.creator?.fullName || '',
    originalFileName: record.originalFileName || '',
  };

  // Compile full versions summary list
  const existingSummaries: EstimateVersionSummary[] = existingLocal?.versionsSummary
    ? [...existingLocal.versionsSummary]
    : [];

  if (!existingSummaries.some((v) => v.versionNumber === 0) && baselineV0Amount > 0) {
    existingSummaries.unshift({
      versionNumber: 0,
      versionTag: 'v0_RAW',
      type: 'ORIGINAL_RAW',
      totalAmount: baselineV0Amount,
      netCiscoTotal: baselineV0Amount,
      marginPct: 0,
      internacionPct: 0,
      arancelPct: 0,
      itemsCount: record.itemsCount || (record.items || []).length,
      createdAt: normalizedCreatedAt,
      creatorUsername: record.creator?.username || 'system',
      creatorFullName: 'BOM Cisco Original (CCW)',
      originalFileName: record.originalFileName || '',
      note: 'BOM Original CCW (Sin Márgenes)',
    });
  }

  const filteredSummaries = existingSummaries.filter((v) => v.versionNumber !== versionNumber);
  const updatedSummaries = [...filteredSummaries, versionSummaryEntry].sort(
    (a, b) => a.versionNumber - b.versionNumber
  );

  const mergedRecord: CloudEstimateRecord = {
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
  };

  // Save immediately to multi-tier redundant local cache as failsafe
  const filteredLocal = localList.filter(
    (x) =>
      x.id !== docId &&
      !(record.estimateId && record.estimateId !== 'NA' && x.estimateId === record.estimateId)
  );
  saveLocalEstimatesCache([mergedRecord, ...filteredLocal].slice(0, 300));

  try {
    const { db, isReady, error } = getFirestoreInstance();

    if (!isReady || !db) {
      return {
        success: true,
        id: docId,
        error: error ? `Guardado localmente (Aviso Cloud: ${error})` : undefined,
      };
    }

    const docRef = doc(db, ESTIMATES_COLLECTION, docId);

    // If not in local cache, check remote doc briefly to preserve remote accessRequests / allowedUsers
    if (!existingLocal) {
      try {
        const existingSnap = await withTimeout(getDoc(docRef), 3500);
        if (existingSnap.exists()) {
          const remoteData = existingSnap.data() as Partial<CloudEstimateRecord>;
          if (record.isRestricted === undefined && remoteData.isRestricted !== undefined) {
            mergedRecord.isRestricted = Boolean(remoteData.isRestricted);
          }
          if (remoteData.allowedUsers && (!mergedRecord.allowedUsers || mergedRecord.allowedUsers.length === 0)) {
            mergedRecord.allowedUsers = remoteData.allowedUsers;
          }
          if (remoteData.accessRequests && (!mergedRecord.accessRequests || mergedRecord.accessRequests.length === 0)) {
            mergedRecord.accessRequests = remoteData.accessRequests;
          }
          if (remoteData.baselineV0Amount && !mergedRecord.baselineV0Amount) {
            mergedRecord.baselineV0Amount = remoteData.baselineV0Amount;
          }
        }
      } catch (_) {}
    }

    // 1. Write root document with active version metadata (used by Dashboard without duplicates)
    const { id: _omitId, ...payloadWithoutId } = {
      ...mergedRecord,
      syncedToCloud: true,
    };
    const sanitizedRecord = sanitizeForFirestore(payloadWithoutId);
    await withTimeout(setDoc(docRef, sanitizedRecord, { merge: true }), 8000);

    // 2. Write subcollection version document (for audit history and rollback/comparison)
    try {
      const versionDocRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', versionTag);
      const versionPayload = sanitizeForFirestore({
        ...versionSummaryEntry,
        estimateId: record.estimateId || 'NA',
        items: record.items || [],
        customOverrideMap: record.customOverrideMap || {},
        fastTrackPromoMap: record.fastTrackPromoMap || {},
        headerInfo: record.headerInfo,
      });
      await withTimeout(setDoc(versionDocRef, versionPayload, { merge: true }), 6000);

      // If writing v1 and v0 is not yet in subcollection, ensure v0 is stored as immutable backup
      if (versionNumber > 0 && baselineV0Amount > 0) {
        const v0DocRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', 'v0');
        const v0Snap = await withTimeout(getDoc(v0DocRef), 2000).catch(() => null);
        if (!v0Snap || !v0Snap.exists()) {
          const v0Payload = sanitizeForFirestore({
            versionNumber: 0,
            versionTag: 'v0_RAW',
            type: 'ORIGINAL_RAW',
            totalAmount: baselineV0Amount,
            netCiscoTotal: baselineV0Amount,
            marginPct: 0,
            internacionPct: 0,
            arancelPct: 0,
            itemsCount: record.itemsCount || (record.items || []).length,
            items: record.items || [],
            createdAt: normalizedCreatedAt,
            creatorUsername: record.creator?.username || 'system',
            creatorFullName: 'BOM Cisco Original (CCW)',
            originalFileName: record.originalFileName || '',
            note: 'BOM Original CCW (Sin Márgenes)',
          });
          setDoc(v0DocRef, v0Payload, { merge: true }).catch(() => {});
        }
      }
    } catch (vErr) {
      console.warn('[Firestore Cloud Subcollection Version Warning]:', vErr);
    }

    // Mark as synced in local cache
    const syncedRecord: CloudEstimateRecord = { ...mergedRecord, syncedToCloud: true };
    saveLocalEstimatesCache([syncedRecord, ...filteredLocal].slice(0, 300));

    return { success: true, id: docId };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveEstimate]:', err);
    return {
      success: true,
      id: docId,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Saves the immutable original v0 raw BOM directly from Cisco CCW (0% margins).
 * Guarantees that v0 is stored permanently and never overwritten by subsequent edits.
 */
export async function saveOriginalV0Estimate(
  record: Omit<CloudEstimateRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  return await saveEstimateToCloud({
    ...record,
    activeVersion: 0,
    activeVersionTag: 'v0_RAW',
    baselineV0Amount: Number(record.financialSummary?.totalNetCisco || 0),
    currentAmount: Number(record.financialSummary?.totalNetCisco || 0),
  });
}

/**
 * Saves an edited version (v1, v2, v3...) with updated margins, custom overrides, and pricing.
 */
export async function saveModifiedEstimateVersion(
  record: Omit<CloudEstimateRecord, 'id'>,
  customVersionNum?: number
): Promise<{ success: boolean; id?: string; error?: string }> {
  const versionNum = customVersionNum !== undefined ? customVersionNum : undefined;
  return await saveEstimateToCloud({
    ...record,
    activeVersion: versionNum,
  });
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
      activeVersionTag: 'v0_RAW',
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
      existing.activeVersionTag || (activeVer === 0 ? 'v0_RAW' : `v${activeVer}`),
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
 * Retrieves all versions of a specific estimate (v0, v1, v2...) from subcollection or root summary.
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
      const versions: EstimateVersionSummary[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const vNum =
          data.versionNumber ??
          (d.id === 'v0' || d.id === 'v0_RAW'
            ? 0
            : parseInt(d.id.replace('v', ''), 10) || 1);
        versions.push({
          versionNumber: vNum,
          versionTag: data.versionTag || (vNum === 0 ? 'v0_RAW' : `v${vNum}`),
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
      versions.sort((a, b) => a.versionNumber - b.versionNumber);
      return { success: true, data: versions };
    }

    return { success: true, data: localSummaries };
  } catch (err: any) {
    return { success: true, data: localSummaries, error: err?.message };
  }
}

/**
 * Loads the full detail (including items and overrides) of a specific version from the subcollection.
 */
export async function loadEstimateVersionDetail(
  docIdOrEstimateId: string,
  versionId: string
): Promise<{ success: boolean; data?: EstimateVersionDetail; error?: string }> {
  const docId = docIdOrEstimateId.startsWith('est_')
    ? docIdOrEstimateId
    : buildEstimateDocId(docIdOrEstimateId);

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const vRef = doc(db, ESTIMATES_COLLECTION, docId, 'versions', versionId);
      const snap = await withTimeout(getDoc(vRef), 5000);
      if (snap.exists()) {
        const d = snap.data();
        const vNum =
          d.versionNumber ??
          (versionId === 'v0' || versionId === 'v0_RAW'
            ? 0
            : parseInt(versionId.replace('v', ''), 10) || 1);
        return {
          success: true,
          data: {
            id: snap.id,
            estimateId: docIdOrEstimateId,
            versionNumber: vNum,
            versionTag: d.versionTag || versionId,
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
          },
        };
      }
    }

    // Fallback: check local root doc
    const localList = getLocalEstimatesCache();
    const existing = localList.find((x) => x.id === docId || x.estimateId === docIdOrEstimateId);
    if (existing) {
      return {
        success: true,
        data: {
          id: versionId,
          estimateId: existing.estimateId || docId,
          versionNumber: existing.activeVersion ?? 1,
          versionTag: existing.activeVersionTag ?? 'v1',
          type: 'EDITED',
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

    return { success: false, error: 'Versión no encontrada' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error cargando detalle de versión' };
  }
}


/**
 * Fetches CCW Estimates from Firestore on-demand using getDocs().
 * Orders by createdAt descending, deduplicates by Estimate ID, and auto-syncs any pending local estimates to Cloud.
 * Ingests Desktop SQLite quotes when executing inside PyWebView.
 */
export async function getCloudEstimates(
  limitCount: number = 300,
  _sinceIso?: string
): Promise<{ success: boolean; data: CloudEstimateRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalEstimatesCache();

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
                  date: dCreatedAt.slice(0, 10),
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

    if (!isReady || !db) {
      // Offline / Local Mode: seed with localCache + desktopEsts
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
      const mergedLocal = Array.from(dedupMap.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      saveLocalEstimatesCache(mergedLocal.slice(0, 300));
      return {
        success: true,
        data: mergedLocal,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }

    const colRef = collection(db, ESTIMATES_COLLECTION);
    const fetchLimit = Math.max(limitCount || 300, 300);

    let snapshot;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(fetchLimit));
      snapshot = await withTimeout(getDocs(q), 8000);
    } catch {
      // Fallback query if ordering by createdAt encounters any unindexed or missing legacy field
      const qFallback = query(colRef, limit(fetchLimit));
      snapshot = await withTimeout(getDocs(qFallback), 8000);
    }

    const remoteList: CloudEstimateRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<CloudEstimateRecord, 'id'>;
      const normalizedCreatedAt = normalizeIsoTimestamp(data.createdAt);
      const normalizedUpdatedAt = normalizeIsoTimestamp(data.updatedAt || data.createdAt);

      const activeVersion = data.activeVersion !== undefined ? data.activeVersion : 1;
      const activeVersionTag =
        data.activeVersionTag || (activeVersion === 0 ? 'v0_RAW' : `v${activeVersion}`);
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
        (data.versionsSummary?.length || (activeVersion > 0 ? activeVersion : 1));

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
        accessRequests: Array.isArray(data.accessRequests) ? data.accessRequests : [],
        syncedToCloud: true,
      });
    });

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
        // Prefer deterministic docId `est_...` or newer updatedAt/createdAt, while merging accessRequests/allowedUsers
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

    const merged = Array.from(dedupMap.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    // Update multi-tier local mirror snapshot cache and timestamp
    saveLocalEstimatesCache(merged.slice(0, 300), true);

    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getEstimates]:', err);
    return {
      success: true,
      data: getLocalEstimatesCache(),
      error: `Mostrando registros locales (Aviso Cloud: ${err?.message || 'Sin conexión'})`,
    };
  }
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

/**
 * Deletes an estimate document from Firestore and local cache.
 */
export async function deleteCloudEstimate(
  docId: string,
  estimateId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Remove from local cache
    const localList = getLocalEstimatesCache().filter(
      (x) => x.id !== docId && !(estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );
    saveLocalEstimatesCache(localList);

    // 2. Remove from Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      if (!docId.startsWith('cloud-est-')) {
        await withTimeout(deleteDoc(doc(db, ESTIMATES_COLLECTION, docId)), 4000);
      }
      if (estimateId && estimateId !== 'NA') {
        const detId = buildEstimateDocId(estimateId);
        if (detId !== docId) {
          deleteDoc(doc(db, ESTIMATES_COLLECTION, detId)).catch(() => {});
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteEstimate]:', err);
    return { success: false, error: err?.message || 'Error eliminando registro' };
  }
}

// ----------------------------------------------------------------------------
// 2. DSV (DIRECT SHIP VENDOR) CLOUD SERVICE
// ----------------------------------------------------------------------------

/**
 * Saves a generated DSV record to Firestore 'dsv_records' collection.
 */
export async function saveDsvToCloud(
  record: Omit<CloudDsvRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();

    // 1. Local Cache Persistence
    const localList = getLocalDsvCache();
    const localId = 'cloud-dsv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const newRecordWithId: CloudDsvRecord = { ...record, id: localId };
    
    const updatedLocal = [newRecordWithId, ...localList.filter((x) => x.soNumber !== record.soNumber || x.dealId !== record.dealId)];
    saveLocalDsvCache(updatedLocal.slice(0, 100));

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
      createdAt: record.createdAt || new Date().toISOString(),
    });
    const docRef = await withTimeout(addDoc(colRef, sanitizedRecord), 3000);

    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveDsv]:', err);
    return {
      success: true,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Fetches DSV Records from Firestore on-demand using getDocs().
 */
export async function getCloudDsvs(
  limitCount: number = 50
): Promise<{ success: boolean; data: CloudDsvRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalDsvCache();

    if (!isReady || !db) {
      return {
        success: true,
        data: localCache,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }

    const colRef = collection(db, DSV_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withTimeout(getDocs(q), 2500);

    const remoteList: CloudDsvRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<CloudDsvRecord, 'id'>;
      remoteList.push({
        ...data,
        id: docSnap.id,
      });
    });

    const remoteKeys = new Set(remoteList.map((r) => `${r.soNumber}__${r.createdAt}`));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteKeys.has(`${l.soNumber}__${l.createdAt}`));
    const merged = [...remoteList, ...nonDuplicatedLocal];

    saveLocalDsvCache(merged.slice(0, 100));

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
 * Deletes a DSV document from Firestore and local cache.
 */
export async function deleteCloudDsv(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const localList = getLocalDsvCache().filter((x) => x.id !== docId);
    saveLocalDsvCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db && !docId.startsWith('cloud-dsv-')) {
      const docRef = doc(db, DSV_COLLECTION, docId);
      await withTimeout(deleteDoc(docRef), 2000);
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
    username: 'mskill',
    full_name: 'Mauricio Skill (Administrador)',
    email: 'mauricio.skill@mayor.cl',
    role: 'admin',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8', // Intcomex2026!
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'madasme',
    full_name: 'M. Adasme (Product Manager)',
    email: 'madasme@intcomex.com',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'rcuevas',
    full_name: 'R. Cuevas (Product Manager)',
    email: 'rcuevas@intcomex.com',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'jvalancia',
    full_name: 'J. Valancia (Product Manager)',
    email: 'jvalancia@intcomex.com',
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

export function getLocalSharedSkuCache(): SharedSkuOverrideRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARED_SKU_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalSharedSkuCache(rules: SharedSkuOverrideRecord[]) {
  try {
    localStorage.setItem(LOCAL_SHARED_SKU_BACKUP_KEY, JSON.stringify(rules));
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

    // 1. Update local cache
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
        await withTimeout(setDoc(ruleDocRef, sanitizeForFirestore(rule), { merge: true }), 2500);
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
 * Retrieves all shared SKU overrides from Firestore & local backup
 */
export async function getSharedSkuRules(): Promise<{
  success: boolean;
  data: SharedSkuOverrideRecord[];
  error?: string;
}> {
  try {
    const localCache = getLocalSharedSkuCache();
    const { db, isReady, error } = getFirestoreInstance();

    if (!isReady || !db) {
      return { success: true, data: localCache, error: error ? `Modo local activo (${error})` : undefined };
    }

    const colRef = collection(db, SHARED_SKU_COLLECTION);
    const snapshot = await withTimeout(getDocs(colRef), 3000);

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

      remoteList.push({
        ...data,
        id: docSnap.id,
        sku: (rawSku || docSnap.id).toUpperCase(),
        rule: normalizeRuleValue(data.rule),
        previousType: data.previousType || 'Hardware',
      });
    });

    const remoteSkus = new Set(remoteList.map((r) => r.sku));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteSkus.has(l.sku));
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
 * Deletes a shared SKU rule from Firestore & local cache
 */
export async function deleteSharedSkuRule(
  sku: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSku = sku.trim().toUpperCase();
    const localList = getLocalSharedSkuCache().filter((r) => r.sku !== cleanSku);
    saveLocalSharedSkuCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, SHARED_SKU_COLLECTION, cleanSku);
      await withTimeout(deleteDoc(docRef), 2000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteSharedSkuRule]:', err);
    return { success: false, error: err?.message || 'Error eliminando regla' };
  }
}