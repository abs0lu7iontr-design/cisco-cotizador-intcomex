// ============================================================================
// CISCO AUTOMATED v2.9 - FORECAST STORAGE ENGINE (INDEXEDDB + VAULT + FIRESTORE)
// Multi-tier storage with Local Vault, Tombstones and Cloud Synchronization
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  getFirestoreInstance,
  getActiveProjectScopeKey,
  readProjectScopedStorage,
  writeProjectScopedStorage,
} from '../cloud/firebaseConfig';
import { sanitizeForFirestore, withTimeout } from '../cloud/firestoreService';
import { ForecastRecord } from './forecastTypes';
import { INITIAL_FORECAST_SEEDS } from './forecastSeeds';

export const FORECAST_COLLECTION = 'cisco_forecast_records';
const LOCAL_FORECAST_PRIMARY_KEY = 'cisco_forecast_records_cache_v1';
const LOCAL_FORECAST_VAULT_KEY = 'cisco_forecast_records_vault_v1';
const LOCAL_FORECAST_TOMBSTONES_KEY = 'cisco_forecast_records_tombstones_v1';
const LOCAL_FORECAST_SEEDED_KEY = 'cisco_forecast_seed_initialized_v1';

let inMemoryForecastCache: ForecastRecord[] = [];
let isHydrated = false;

// ----------------------------------------------------------------------------
// Local Storage Multi-Tier Vault Helpers
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
  writeProjectScopedStorage(
    LOCAL_FORECAST_TOMBSTONES_KEY,
    JSON.stringify(Array.from(stones)),
    projectScope
  );
}

function clearTombstone(id: string, projectScope?: string): void {
  const stones = getTombstones(projectScope);
  if (stones.delete(id)) {
    writeProjectScopedStorage(
      LOCAL_FORECAST_TOMBSTONES_KEY,
      JSON.stringify(Array.from(stones)),
      projectScope
    );
  }
}

function readLocalRecords(projectScope?: string): ForecastRecord[] {
  const stones = getTombstones(projectScope);
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

function writeLocalRecords(records: ForecastRecord[], projectScope?: string): void {
  const serialized = JSON.stringify(records);
  writeProjectScopedStorage(LOCAL_FORECAST_PRIMARY_KEY, serialized, projectScope);
  writeProjectScopedStorage(LOCAL_FORECAST_VAULT_KEY, serialized, projectScope);
  inMemoryForecastCache = [...records];
}

// ----------------------------------------------------------------------------
// Public Storage API
// ----------------------------------------------------------------------------

/**
 * Obtiene todos los registros de Forecast desde memoria o almacenamiento local blindado.
 * Si es la primera vez que se ejecuta, auto-hidrata con los 158 registros oficiales iniciales.
 */
export async function getForecastRecords(forceRefresh = false): Promise<ForecastRecord[]> {
  const projectScope = getActiveProjectScopeKey();

  if (!forceRefresh && isHydrated && inMemoryForecastCache.length > 0) {
    return inMemoryForecastCache;
  }

  let records = readLocalRecords(projectScope);

  // Auto-hidratación inicial si no existen registros y no ha sido marcado como sembrado
  const alreadySeeded = readProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, projectScope) === 'true';
  if (records.length === 0 && !alreadySeeded) {
    records = [...INITIAL_FORECAST_SEEDS];
    writeLocalRecords(records, projectScope);
    writeProjectScopedStorage(LOCAL_FORECAST_SEEDED_KEY, 'true', projectScope);
  }

  inMemoryForecastCache = records;
  isHydrated = true;
  return records;
}

/**
 * Guarda o actualiza un registro en el forecast local y sincroniza asíncronamente con Firestore Cloud.
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

  writeLocalRecords(updatedList, projectScope);

  // Sincronización con Firestore Cloud (No bloqueante si no hay conexión)
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (firestoreDb) {
      await withTimeout(
        setDoc(
          doc(firestoreDb, FORECAST_COLLECTION, record.id),
          sanitizeForFirestore(updatedRecord),
          { merge: true }
        ),
        4000
      );
    }
  } catch (err) {
    console.warn('[ForecastStorage] No se pudo sincronizar en la nube inmediatamente (modo offline activo):', err);
  }

  return updatedRecord;
}

/**
 * Guarda un lote de registros (bulk upsert) de forma atómica en caché y local vault.
 */
export async function bulkSaveForecastRecords(newOrUpdated: ForecastRecord[]): Promise<ForecastRecord[]> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getForecastRecords();
  const map = new Map<string, ForecastRecord>();

  existing.forEach((r) => map.set(r.id, r));
  newOrUpdated.forEach((r) => {
    clearTombstone(r.id, projectScope);
    map.set(r.id, {
      ...r,
      updatedAt: new Date().toISOString(),
    });
  });

  const merged = Array.from(map.values());
  writeLocalRecords(merged, projectScope);

  // Background cloud batch sync if available
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (firestoreDb) {
      // Sync in non-blocking promises
      Promise.all(
        newOrUpdated.slice(0, 50).map((rec) =>
          setDoc(doc(firestoreDb, FORECAST_COLLECTION, rec.id), sanitizeForFirestore(rec), { merge: true }).catch(() => {})
        )
      ).catch(() => {});
    }
  } catch {
    // Offline safe
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
  writeLocalRecords(updatedList, projectScope);

  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (firestoreDb) {
      await withTimeout(deleteDoc(doc(firestoreDb, FORECAST_COLLECTION, id)), 4000);
    }
  } catch (err) {
    console.warn('[ForecastStorage] Error eliminando en la nube:', err);
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
  writeLocalRecords(fresh, projectScope);
  return fresh;
}

/**
 * Sincroniza bidireccionalmente el Forecast con Firestore Cloud reconciliando por `updatedAt`.
 */
export async function syncForecastWithCloud(): Promise<{ count: number; source: 'cloud' | 'local' }> {
  const projectScope = getActiveProjectScopeKey();
  const localRecords = await getForecastRecords();
  const stones = getTombstones(projectScope);

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { count: localRecords.length, source: 'local' };
  }

  try {
    const q = query(collection(firestoreDb, FORECAST_COLLECTION), orderBy('updatedAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 6000);

    if (snap.empty) {
      // Si la nube está vacía pero local tiene datos, subirlos en lote
      if (localRecords.length > 0) {
        for (const rec of localRecords.slice(0, 50)) {
          await setDoc(doc(firestoreDb, FORECAST_COLLECTION, rec.id), sanitizeForFirestore(rec), { merge: true }).catch(() => {});
        }
      }
      return { count: localRecords.length, source: 'local' };
    }

    const cloudRecordsMap = new Map<string, ForecastRecord>();
    snap.forEach((d) => {
      const data = d.data() as ForecastRecord;
      if (data && data.id && !stones.has(data.id)) {
        cloudRecordsMap.set(data.id, data);
      }
    });

    const mergedMap = new Map<string, ForecastRecord>(cloudRecordsMap);

    for (const local of localRecords) {
      if (stones.has(local.id)) continue;
      const cloud = mergedMap.get(local.id);
      if (!cloud) {
        mergedMap.set(local.id, local);
      } else {
        const localTime = new Date(local.updatedAt || local.createdAt).getTime();
        const cloudTime = new Date(cloud.updatedAt || cloud.createdAt).getTime();
        if (localTime > cloudTime) {
          mergedMap.set(local.id, local);
        }
      }
    }

    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );

    writeLocalRecords(mergedList, projectScope);
    return { count: mergedList.length, source: 'cloud' };
  } catch (err) {
    console.warn('[ForecastStorage] Fallback a datos locales tras error de sincronización nube:', err);
    return { count: localRecords.length, source: 'local' };
  }
}
