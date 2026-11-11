// ============================================================================
// CISCO AUTOMATED v2.11 - FORECAST STORAGE ENGINE (INDEXEDDB + VAULT + FIRESTORE)
// Durable IndexedDB + LocalStorage Fallback + Tombstones + Bidirectional Cloud Sync
// - Zero 50-item truncation / Zero orderBy document drops
// - Strict firestore.rules Schema Sanitizer + Manual Offline Queue Integration
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  getFirestoreInstance,
  getActiveProjectScopeKey,
  readProjectScopedStorage,
  writeProjectScopedStorage,
  registerProjectScopedCleanup,
} from '../cloud/firebaseConfig';
import { sanitizeForFirestore, withTimeout } from '../cloud/firestoreService';
import { ForecastRecord } from './forecastTypes';
import { INITIAL_FORECAST_SEEDS } from './forecastSeeds';
import { idbGet, idbSet, STORES } from '../../core/storage/indexedDbStorage';
import { isAppOffline } from '../../core/storage/offlineModeManager';
import { enqueueOfflineAction } from '../../core/storage/offlineSyncQueue';

export const FORECAST_COLLECTION = 'cisco_forecast_records';
const LOCAL_FORECAST_PRIMARY_KEY = 'cisco_forecast_records_cache_v1';
const LOCAL_FORECAST_VAULT_KEY = 'cisco_forecast_records_vault_v1';
const LOCAL_FORECAST_TOMBSTONES_KEY = 'cisco_forecast_records_tombstones_v1';
const LOCAL_FORECAST_SEEDED_KEY = 'cisco_forecast_seed_initialized_v1';
const IDB_FORECAST_KEY_PREFIX = 'forecast_records_idb_v1::';

const CLOUD_BATCH_CHUNK_SIZE = 350;

let inMemoryForecastCache: ForecastRecord[] = [];
let inMemoryScopeKey = '';
let isHydrated = false;

registerProjectScopedCleanup(() => {
  inMemoryForecastCache = [];
  inMemoryScopeKey = '';
  isHydrated = false;
});

function truncateStr(val: unknown, maxLen: number): string {
  const s = String(val ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNonNegative(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sanitizeOptionalStr(val: unknown, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// ----------------------------------------------------------------------------
// Tombstones & Durable Multi-Tier Storage Helpers (IndexedDB + LocalStorage)
// ----------------------------------------------------------------------------

function getTombstones(projectScope?: string): Set<string> {
  const raw = readProjectScopedStorage(LOCAL_FORECAST_TOMBSTONES_KEY, projectScope);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function recordTombstone(id: string, projectScope?: string): void {
  const stones = getTombstones(projectScope);
  stones.add(id);
  try {
    writeProjectScopedStorage(
      LOCAL_FORECAST_TOMBSTONES_KEY,
      JSON.stringify(Array.from(stones)),
      projectScope
    );
  } catch {}
}

function clearTombstone(id: string, projectScope?: string): void {
  const stones = getTombstones(projectScope);
  if (stones.delete(id)) {
    try {
      writeProjectScopedStorage(
        LOCAL_FORECAST_TOMBSTONES_KEY,
        JSON.stringify(Array.from(stones)),
        projectScope
      );
    } catch {}
  }
}

function readLocalStorageRecords(projectScope: string, stones: Set<string>): ForecastRecord[] {
  let raw = readProjectScopedStorage(LOCAL_FORECAST_PRIMARY_KEY, projectScope);
  if (!raw) {
    raw = readProjectScopedStorage(LOCAL_FORECAST_VAULT_KEY, projectScope);
  }
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((r: ForecastRecord) => r && r.id && !stones.has(r.id));
  } catch {
    return [];
  }
}

async function readDurableRecords(projectScope: string): Promise<ForecastRecord[]> {
  const stones = getTombstones(projectScope);
  const map = new Map<string, ForecastRecord>();

  // 1. Leer desde IndexedDB (almacenamiento de alta capacidad sin límite de 5MB)
  try {
    const idbList = await idbGet<ForecastRecord[]>(
      STORES.KEYVAL,
      `${IDB_FORECAST_KEY_PREFIX}${projectScope}`
    );
    if (Array.isArray(idbList)) {
      for (const item of idbList) {
        if (item && item.id && !stones.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('[ForecastStorage] Error leyendo IndexedDB:', err);
  }

  // 2. Reconciliar con localStorage preservando la versión más reciente
  const lsList = readLocalStorageRecords(projectScope, stones);
  for (const item of lsList) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const lsTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (lsTs > existingTs) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

async function persistDurableRecords(
  records: ForecastRecord[],
  projectScope: string
): Promise<void> {
  inMemoryForecastCache = [...records];
  inMemoryScopeKey = projectScope;

  try {
    await idbSet(STORES.KEYVAL, `${IDB_FORECAST_KEY_PREFIX}${projectScope}`, records);
  } catch (err) {
    console.warn('[ForecastStorage] Error persistiendo en IndexedDB:', err);
  }

  try {
    const serialized = JSON.stringify(records);
    writeProjectScopedStorage(LOCAL_FORECAST_PRIMARY_KEY, serialized, projectScope);
    writeProjectScopedStorage(LOCAL_FORECAST_VAULT_KEY, serialized, projectScope);
  } catch {
    // QuotaExceededError en localStorage no afecta la durabilidad en IndexedDB
  }
}

// ----------------------------------------------------------------------------
// Cloud Sanitizers & Batch Push Helpers (firestore.rules Compliant)
// ----------------------------------------------------------------------------

export function sanitizeForecastRecordForCloud(record: ForecastRecord): ForecastRecord {
  const safeId = truncateStr(record.id, 100) || `FC-${Date.now().toString(36).toUpperCase()}`;
  const sanitized: ForecastRecord = {
    id: safeId,
    fechaLevantamiento: truncateStr(record.fechaLevantamiento, 100),
    fechaCotizacion: truncateStr(record.fechaCotizacion, 100),
    marca: truncateStr(record.marca || 'CISCO', 100),
    pmResponsable: truncateStr(record.pmResponsable, 200),
    partner: truncateStr(record.partner, 200),
    ejecutivoPartner: truncateStr(record.ejecutivoPartner, 200),
    endUser: truncateStr(record.endUser, 200),
    usdIntcomex: clampNonNegative(record.usdIntcomex),
    emailEjecutivoPartner: truncateStr(record.emailEjecutivoPartner, 200),
    mesFacturacion: truncateStr(record.mesFacturacion, 100),
    emailClienteFinal: truncateStr(record.emailClienteFinal, 200),
    detalleProductos: truncateStr(record.detalleProductos, 2000),
    oc: truncateStr(record.oc, 100),
    deal: truncateStr(record.deal, 200),
    productos: clampNonNegative(record.productos),
    suscripciones: clampNonNegative(record.suscripciones),
    servicios: clampNonNegative(record.servicios),
    meraki: clampNonNegative(record.meraki),
    am: truncateStr(record.am, 200),
    grupoVentas: truncateStr(record.grupoVentas, 100),
    observacion: truncateStr(record.observacion, 2000),
    dsvSubmission: truncateStr(record.dsvSubmission, 100),
    po: truncateStr(record.po, 100),
    so: truncateStr(record.so, 100),
    submittedDate: truncateStr(record.submittedDate, 100),
    clienteCisco: truncateStr(record.clienteCisco, 100),
    promotionAuthorizationNumber: truncateStr(record.promotionAuthorizationNumber, 200),
    endCustomerName: truncateStr(record.endCustomerName, 200),
    endCustomerAddress1: truncateStr(record.endCustomerAddress1, 500),
    numeroVenta: truncateStr(record.numeroVenta, 100),
    bodega: truncateStr(record.bodega, 100),
    caso: truncateStr(record.caso, 200),
    credit: truncateStr(record.credit, 100),
    nuevoCaso: truncateStr(record.nuevoCaso, 200),
    confirmacionCredito: truncateStr(record.confirmacionCredito, 200),
    priceProtectionExpiryDate: truncateStr(record.priceProtectionExpiryDate, 100),
    createdAt: truncateStr(record.createdAt || new Date().toISOString(), 100),
    updatedAt: truncateStr(record.updatedAt || new Date().toISOString(), 100),
  };

  const srcEst = sanitizeOptionalStr(record.sourceEstimateId, 100);
  if (srcEst !== undefined) sanitized.sourceEstimateId = srcEst;

  const srcBo = sanitizeOptionalStr(record.sourceBoTrackingId, 100);
  if (srcBo !== undefined) sanitized.sourceBoTrackingId = srcBo;

  const srcDsv = sanitizeOptionalStr(record.sourceDsvId, 100);
  if (srcDsv !== undefined) sanitized.sourceDsvId = srcDsv;

  const srcPipe = sanitizeOptionalStr(record.sourcePipelineId, 100);
  if (srcPipe !== undefined) sanitized.sourcePipelineId = srcPipe;

  if (typeof record.isSeed === 'boolean') {
    sanitized.isSeed = record.isSeed;
  }

  return sanitized;
}

export async function pushForecastRecordToCloud(
  record: ForecastRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (!firestoreDb) {
      return { success: false, error: instance?.error || 'Firestore no disponible' };
    }
    const clean = sanitizeForFirestore(sanitizeForecastRecordForCloud(record));
    await withTimeout(
      setDoc(doc(firestoreDb, FORECAST_COLLECTION, clean.id), clean, { merge: true }),
      5000
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error subiendo registro de Forecast a Firestore' };
  }
}

export async function pushForecastRecordsBatchToCloud(
  records: ForecastRecord[]
): Promise<{ success: boolean; uploaded: number; error?: string }> {
  if (!Array.isArray(records) || records.length === 0) {
    return { success: true, uploaded: 0 };
  }

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { success: false, uploaded: 0, error: instance?.error || 'Firestore no disponible' };
  }

  let uploaded = 0;
  let lastError: string | undefined;

  for (let i = 0; i < records.length; i += CLOUD_BATCH_CHUNK_SIZE) {
    const chunk = records.slice(i, i + CLOUD_BATCH_CHUNK_SIZE);
    try {
      const batch = writeBatch(firestoreDb);
      for (const rec of chunk) {
        const clean = sanitizeForFirestore(sanitizeForecastRecordForCloud(rec));
        batch.set(doc(firestoreDb, FORECAST_COLLECTION, clean.id), clean, { merge: true });
      }
      await withTimeout(batch.commit(), 8000);
      uploaded += chunk.length;
    } catch (batchErr: any) {
      lastError = batchErr?.message || 'Error en lote batch de forecast';
      for (const rec of chunk) {
        const res = await pushForecastRecordToCloud(rec);
        if (res.success) uploaded += 1;
        else if (res.error) lastError = res.error;
      }
    }
  }

  return {
    success: uploaded > 0 || records.length === 0,
    uploaded,
    error: uploaded === records.length ? undefined : lastError,
  };
}

export async function pushForecastDeleteToCloud(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (!firestoreDb) {
      return { success: false, error: instance?.error || 'Firestore no disponible' };
    }
    await withTimeout(deleteDoc(doc(firestoreDb, FORECAST_COLLECTION, id)), 4000);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error eliminando forecast en Firestore' };
  }
}

// ----------------------------------------------------------------------------
// Public Storage API
// ----------------------------------------------------------------------------

/**
 * Obtiene todos los registros de Forecast desde IndexedDB o almacenamiento local blindado.
 * Si es la primera vez que se ejecuta, auto-hidrata con los 158 registros oficiales iniciales.
 */
export async function getForecastRecords(forceRefresh = false): Promise<ForecastRecord[]> {
  const projectScope = getActiveProjectScopeKey();

  if (
    !forceRefresh &&
    isHydrated &&
    inMemoryScopeKey === projectScope &&
    inMemoryForecastCache.length > 0
  ) {
    return inMemoryForecastCache;
  }

  let records = await readDurableRecords(projectScope);

  const alreadySeeded =
    readProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, projectScope) === 'true';
  if (records.length === 0 && !alreadySeeded) {
    records = [...INITIAL_FORECAST_SEEDS];
    await persistDurableRecords(records, projectScope);
    writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);
  }

  inMemoryForecastCache = records;
  inMemoryScopeKey = projectScope;
  isHydrated = true;
  return records;
}

/**
 * Guarda o actualiza un registro en el forecast local y sincroniza con Firestore (o encola offline).
 */
export async function saveForecastRecord(record: ForecastRecord): Promise<ForecastRecord> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getForecastRecords();

  clearTombstone(record.id, projectScope);

  const updatedRecord: ForecastRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  const idx = existing.findIndex((r) => r.id === record.id);
  let updatedList: ForecastRecord[];
  if (idx >= 0) {
    updatedList = [...existing];
    updatedList[idx] = updatedRecord;
  } else {
    updatedList = [updatedRecord, ...existing];
  }

  await persistDurableRecords(updatedList, projectScope);
  writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);

  if (isAppOffline()) {
    await enqueueOfflineAction('save_forecast_record', updatedRecord, {
      entityKey: `forecast:${updatedRecord.id}`,
    });
    return updatedRecord;
  }

  const cloudRes = await pushForecastRecordToCloud(updatedRecord);
  if (!cloudRes.success) {
    console.warn('[ForecastStorage] Sincronización pendiente, encolando forecast:', cloudRes.error);
    await enqueueOfflineAction('save_forecast_record', updatedRecord, {
      entityKey: `forecast:${updatedRecord.id}`,
    });
  }

  return updatedRecord;
}

/**
 * Guarda un lote de registros (bulk upsert) de forma atómica en IndexedDB
 * y sincroniza TODOS los elementos en lotes batch hacia Firestore (sin límite de 50).
 */
export async function bulkSaveForecastRecords(
  newOrUpdated: ForecastRecord[]
): Promise<ForecastRecord[]> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getForecastRecords();
  const map = new Map<string, ForecastRecord>();
  const nowIso = new Date().toISOString();

  existing.forEach((r) => map.set(r.id, r));
  const stampedBatch: ForecastRecord[] = newOrUpdated.map((r) => {
    clearTombstone(r.id, projectScope);
    const stamped: ForecastRecord = {
      ...r,
      updatedAt: nowIso,
    };
    map.set(stamped.id, stamped);
    return stamped;
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );

  await persistDurableRecords(merged, projectScope);
  writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);

  if (stampedBatch.length > 0) {
    if (isAppOffline()) {
      await enqueueOfflineAction('bulk_save_forecast', stampedBatch, {
        entityKey: `forecast:bulk:${Date.now().toString(36)}`,
      });
    } else {
      const pushRes = await pushForecastRecordsBatchToCloud(stampedBatch);
      if (!pushRes.success) {
        await enqueueOfflineAction('bulk_save_forecast', stampedBatch, {
          entityKey: `forecast:bulk:${Date.now().toString(36)}`,
        });
      }
    }
  }

  return merged;
}

/**
 * Elimina un registro de forecast registrando un tombstone para evitar resurrección.
 */
export async function deleteForecastRecord(id: string): Promise<boolean> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getForecastRecords();

  recordTombstone(id, projectScope);

  const updatedList = existing.filter((r) => r.id !== id);
  await persistDurableRecords(updatedList, projectScope);

  if (isAppOffline()) {
    await enqueueOfflineAction('delete_forecast_record', { id }, {
      entityKey: `forecast:${id}`,
    });
    return true;
  }

  const cloudRes = await pushForecastDeleteToCloud(id);
  if (!cloudRes.success) {
    console.warn('[ForecastStorage] Error eliminando en nube, encolado tombstone:', cloudRes.error);
    await enqueueOfflineAction('delete_forecast_record', { id }, {
      entityKey: `forecast:${id}`,
    });
  }

  return true;
}

/**
 * Restaura los datos del Forecast al conjunto inicial de semillas oficiales Intcomex.
 */
export async function resetForecastToSeeds(): Promise<ForecastRecord[]> {
  const projectScope = getActiveProjectScopeKey();
  writeProjectScopedStorage(LOCAL_FORECAST_TOMBSTONES_KEY, '[]', projectScope);
  writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);

  const fresh = [...INITIAL_FORECAST_SEEDS];
  await persistDurableRecords(fresh, projectScope);
  isHydrated = true;
  return fresh;
}

/**
 * Sincroniza bidireccionalmente el Forecast con Firestore Cloud sin truncamiento ni orderBy restrictivo.
 */
export async function syncForecastWithCloud(): Promise<{
  count: number;
  source: 'cloud' | 'local';
  uploadedCount?: number;
}> {
  const projectScope = getActiveProjectScopeKey();
  const localRecords = await getForecastRecords(true);
  const stones = getTombstones(projectScope);

  if (isAppOffline()) {
    return { count: localRecords.length, source: 'local' };
  }

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { count: localRecords.length, source: 'local' };
  }

  try {
    // Consultar colección completa sin orderBy para no excluir registros antiguos sin campo updatedAt
    const snap = await withTimeout(getDocs(collection(firestoreDb, FORECAST_COLLECTION)), 8000);

    if (snap.empty) {
      if (localRecords.length > 0) {
        const pushRes = await pushForecastRecordsBatchToCloud(localRecords);
        return {
          count: localRecords.length,
          source: pushRes.uploaded > 0 ? 'cloud' : 'local',
          uploadedCount: pushRes.uploaded,
        };
      }
      return { count: 0, source: 'local' };
    }

    const cloudRecordsMap = new Map<string, ForecastRecord>();
    snap.forEach((d) => {
      const data = d.data() as ForecastRecord;
      const docId = data?.id || d.id;
      if (docId && !stones.has(docId)) {
        cloudRecordsMap.set(docId, { ...data, id: docId });
      } else if (docId && stones.has(docId)) {
        deleteDoc(doc(firestoreDb, FORECAST_COLLECTION, docId)).catch(() => {});
      }
    });

    const mergedMap = new Map<string, ForecastRecord>(cloudRecordsMap);
    const pendingToPush: ForecastRecord[] = [];

    for (const local of localRecords) {
      if (stones.has(local.id)) continue;
      const cloud = mergedMap.get(local.id);
      if (!cloud) {
        mergedMap.set(local.id, local);
        pendingToPush.push(local);
      } else {
        const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
        const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || 0).getTime();
        if (localTime > cloudTime) {
          mergedMap.set(local.id, local);
          pendingToPush.push(local);
        }
      }
    }

    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );

    if (pendingToPush.length > 0) {
      await pushForecastRecordsBatchToCloud(pendingToPush);
    }

    if (mergedList.length > 0) {
      writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);
    }
    await persistDurableRecords(mergedList, projectScope);
    isHydrated = true;

    return { count: mergedList.length, source: 'cloud', uploadedCount: pendingToPush.length };
  } catch (err) {
    console.warn('[ForecastStorage] Fallback a datos locales tras error de sincronización nube:', err);
    return { count: localRecords.length, source: 'local' };
  }
}
