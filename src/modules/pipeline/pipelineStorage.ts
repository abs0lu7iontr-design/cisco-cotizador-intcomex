// ============================================================================
// CISCO AUTOMATED v2.11 - PIPELINE PERSISTENCE ENGINE (INDEXEDDB + VAULT + FIRESTORE)
// Implements Database Armor Architecture:
// - Durable IndexedDB Primary Store + LocalStorage Fallback Vault + Tombstones
// - Full Bidirectional Firestore Synchronization (Zero 50-item truncation / Zero orderBy drops)
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
import { PipelineDealRecord } from './pipelineTypes';
import { PIPELINE_INITIAL_SEEDS } from './pipelineSeeds';
import { idbGet, idbSet, STORES } from '../../core/storage/indexedDbStorage';
import { isAppOffline } from '../../core/storage/offlineModeManager';
import { enqueueOfflineAction } from '../../core/storage/offlineSyncQueue';

export const PIPELINE_COLLECTION = 'cisco_pipeline_deals';
const LOCAL_PIPELINE_PRIMARY_KEY = 'cisco_pipeline_deals_cache_v1';
const LOCAL_PIPELINE_VAULT_KEY = 'cisco_pipeline_deals_vault_v1';
const LOCAL_PIPELINE_TOMBSTONES_KEY = 'cisco_pipeline_deals_tombstones_v1';
const LOCAL_PIPELINE_SEEDED_KEY = 'cisco_pipeline_seed_initialized_v1';
const IDB_PIPELINE_KEY_PREFIX = 'pipeline_deals_idb_v1::';

const CLOUD_BATCH_CHUNK_SIZE = 350;

let inMemoryPipelineCache: PipelineDealRecord[] = [];
let inMemoryScopeKey = '';
let isHydrated = false;

registerProjectScopedCleanup(() => {
  inMemoryPipelineCache = [];
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

function clampProgressPct(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function sanitizeOptionalStr(val: unknown, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = String(val).trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

// ----------------------------------------------------------------------------
// Tombstones & Durable Multi-Tier Storage Helpers (IndexedDB + LocalStorage)
// ----------------------------------------------------------------------------

function getTombstones(projectScope?: string): Set<string> {
  const raw = readProjectScopedStorage(LOCAL_PIPELINE_TOMBSTONES_KEY, projectScope);
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
      LOCAL_PIPELINE_TOMBSTONES_KEY,
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
        LOCAL_PIPELINE_TOMBSTONES_KEY,
        JSON.stringify(Array.from(stones)),
        projectScope
      );
    } catch {}
  }
}

function readLocalStorageDeals(projectScope: string, stones: Set<string>): PipelineDealRecord[] {
  let raw = readProjectScopedStorage(LOCAL_PIPELINE_PRIMARY_KEY, projectScope);
  if (!raw) {
    raw = readProjectScopedStorage(LOCAL_PIPELINE_VAULT_KEY, projectScope);
  }
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((d: PipelineDealRecord) => d && d.id && !stones.has(d.id));
  } catch {
    return [];
  }
}

async function readDurableDeals(projectScope: string): Promise<PipelineDealRecord[]> {
  const stones = getTombstones(projectScope);
  const map = new Map<string, PipelineDealRecord>();

  // 1. Leer desde IndexedDB (sin límite de 5MB de localStorage)
  try {
    const idbList = await idbGet<PipelineDealRecord[]>(
      STORES.KEYVAL,
      `${IDB_PIPELINE_KEY_PREFIX}${projectScope}`
    );
    if (Array.isArray(idbList)) {
      for (const item of idbList) {
        if (item && item.id && !stones.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('[PipelineStorage] Error leyendo IndexedDB:', err);
  }

  // 2. Reconciliar con localStorage por si existe un registro más reciente
  const lsList = readLocalStorageDeals(projectScope, stones);
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

async function persistDurableDeals(
  deals: PipelineDealRecord[],
  projectScope: string
): Promise<void> {
  inMemoryPipelineCache = [...deals];
  inMemoryScopeKey = projectScope;

  try {
    await idbSet(STORES.KEYVAL, `${IDB_PIPELINE_KEY_PREFIX}${projectScope}`, deals);
  } catch (err) {
    console.warn('[PipelineStorage] Error persistiendo en IndexedDB:', err);
  }

  try {
    const serialized = JSON.stringify(deals);
    writeProjectScopedStorage(LOCAL_PIPELINE_PRIMARY_KEY, serialized, projectScope);
    writeProjectScopedStorage(LOCAL_PIPELINE_VAULT_KEY, serialized, projectScope);
  } catch {
    // QuotaExceededError en localStorage no afecta la durabilidad en IndexedDB
  }
}

// ----------------------------------------------------------------------------
// Cloud Sanitizers & Batch Push Helpers (firestore.rules Compliant)
// ----------------------------------------------------------------------------

export function sanitizePipelineDealForCloud(deal: PipelineDealRecord): PipelineDealRecord {
  const safeId = truncateStr(deal.id, 100) || `deal_${Date.now().toString(36)}`;
  const sanitized: PipelineDealRecord = {
    id: safeId,
    fechaLevantamiento: truncateStr(deal.fechaLevantamiento, 100),
    fechaCotizacion: truncateStr(deal.fechaCotizacion, 100),
    marca: truncateStr(deal.marca || 'CISCO', 100),
    pmResponsable: truncateStr(deal.pmResponsable, 200),
    partner: truncateStr(deal.partner, 200) || '-',
    ejecutivoPartner: truncateStr(deal.ejecutivoPartner, 200),
    endUser: truncateStr(deal.endUser, 200) || '-',
    usd: clampNonNegative(deal.usd),
    mesCierre: truncateStr(deal.mesCierre, 100),
    mesFacturacion: truncateStr(deal.mesFacturacion, 100),
    porcentajeAvance: clampProgressPct(deal.porcentajeAvance),
    dealId: truncateStr(deal.dealId, 100),
    productosSuscripciones: clampNonNegative(deal.productosSuscripciones),
    servicios: clampNonNegative(deal.servicios),
    meraki: clampNonNegative(deal.meraki),
    am: truncateStr(deal.am, 200),
    grupoVentas: truncateStr(deal.grupoVentas, 100),
    notas: truncateStr(deal.notas, 5000),
    priceProtectionExpiryDate: truncateStr(deal.priceProtectionExpiryDate, 100),
    createdAt: truncateStr(deal.createdAt || new Date().toISOString(), 100),
    updatedAt: truncateStr(deal.updatedAt || new Date().toISOString(), 100),
  };

  const srcEst = sanitizeOptionalStr(deal.sourceEstimateId, 100);
  if (srcEst !== undefined) sanitized.sourceEstimateId = srcEst;

  const srcVer = sanitizeOptionalStr(deal.sourceEstimateVersion, 100);
  if (srcVer !== undefined) sanitized.sourceEstimateVersion = srcVer;

  const boId = sanitizeOptionalStr(deal.boTrackingId, 100);
  if (boId !== undefined) sanitized.boTrackingId = boId;

  if (typeof deal.isSeed === 'boolean') {
    sanitized.isSeed = deal.isSeed;
  }

  return sanitized;
}

export async function pushPipelineDealToCloud(
  deal: PipelineDealRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (!firestoreDb) {
      return { success: false, error: instance?.error || 'Firestore no disponible' };
    }
    const clean = sanitizeForFirestore(sanitizePipelineDealForCloud(deal));
    await withTimeout(
      setDoc(doc(firestoreDb, PIPELINE_COLLECTION, clean.id), clean, { merge: true }),
      5000
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error subiendo oportunidad a Firestore' };
  }
}

export async function pushPipelineDealsBatchToCloud(
  deals: PipelineDealRecord[]
): Promise<{ success: boolean; uploaded: number; error?: string }> {
  if (!Array.isArray(deals) || deals.length === 0) {
    return { success: true, uploaded: 0 };
  }

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { success: false, uploaded: 0, error: instance?.error || 'Firestore no disponible' };
  }

  let uploaded = 0;
  let lastError: string | undefined;

  for (let i = 0; i < deals.length; i += CLOUD_BATCH_CHUNK_SIZE) {
    const chunk = deals.slice(i, i + CLOUD_BATCH_CHUNK_SIZE);
    try {
      const batch = writeBatch(firestoreDb);
      for (const deal of chunk) {
        const clean = sanitizeForFirestore(sanitizePipelineDealForCloud(deal));
        batch.set(doc(firestoreDb, PIPELINE_COLLECTION, clean.id), clean, { merge: true });
      }
      await withTimeout(batch.commit(), 8000);
      uploaded += chunk.length;
    } catch (batchErr: any) {
      lastError = batchErr?.message || 'Error en lote batch de pipeline';
      // Fallback individual por si algún documento puntual falló validación
      for (const deal of chunk) {
        const res = await pushPipelineDealToCloud(deal);
        if (res.success) uploaded += 1;
        else if (res.error) lastError = res.error;
      }
    }
  }

  return {
    success: uploaded > 0 || deals.length === 0,
    uploaded,
    error: uploaded === deals.length ? undefined : lastError,
  };
}

export async function pushPipelineDeleteToCloud(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (!firestoreDb) {
      return { success: false, error: instance?.error || 'Firestore no disponible' };
    }
    await withTimeout(deleteDoc(doc(firestoreDb, PIPELINE_COLLECTION, id)), 4000);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error eliminando deal en Firestore' };
  }
}

// ----------------------------------------------------------------------------
// Public Storage API
// ----------------------------------------------------------------------------

/**
 * Obtiene todas las oportunidades del pipeline desde IndexedDB o almacenamiento local blindado.
 * Si es la primera vez que se ejecuta, auto-hidrata con las 70 oportunidades oficiales iniciales.
 */
export async function getPipelineDeals(forceRefresh = false): Promise<PipelineDealRecord[]> {
  const projectScope = getActiveProjectScopeKey();

  if (
    !forceRefresh &&
    isHydrated &&
    inMemoryScopeKey === projectScope &&
    inMemoryPipelineCache.length > 0
  ) {
    return inMemoryPipelineCache;
  }

  let deals = await readDurableDeals(projectScope);

  const alreadySeeded =
    readProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, projectScope) === 'true';
  const stones = getTombstones(projectScope);

  if (deals.length === 0 && !alreadySeeded) {
    deals = [...PIPELINE_INITIAL_SEEDS];
    await persistDurableDeals(deals, projectScope);
    writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);
  } else if (deals.length === 0 && alreadySeeded && stones.size === 0 && !isAppOffline()) {
    // Auto-recuperación si la cache local quedó vacía pero no hubo borrados explícitos
    inMemoryPipelineCache = [];
    inMemoryScopeKey = projectScope;
    isHydrated = true;
    return deals;
  }

  inMemoryPipelineCache = deals;
  inMemoryScopeKey = projectScope;
  isHydrated = true;
  return deals;
}

/**
 * Guarda o actualiza una oportunidad en el pipeline local y sincroniza con Firestore (o encola offline).
 */
export async function savePipelineDeal(deal: PipelineDealRecord): Promise<PipelineDealRecord> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getPipelineDeals();

  clearTombstone(deal.id, projectScope);

  const updatedDeal: PipelineDealRecord = {
    ...deal,
    updatedAt: new Date().toISOString(),
  };

  const idx = existing.findIndex((d) => d.id === deal.id);
  let updatedList: PipelineDealRecord[];
  if (idx >= 0) {
    updatedList = [...existing];
    updatedList[idx] = updatedDeal;
  } else {
    updatedList = [updatedDeal, ...existing];
  }

  await persistDurableDeals(updatedList, projectScope);
  writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);

  if (isAppOffline()) {
    await enqueueOfflineAction('save_pipeline_deal', updatedDeal, {
      entityKey: `pipeline:${updatedDeal.id}`,
    });
    return updatedDeal;
  }

  const pushRes = await pushPipelineDealToCloud(updatedDeal);
  if (!pushRes.success) {
    console.warn('[PipelineStorage] Sincronización pendiente, encolando deal:', pushRes.error);
    await enqueueOfflineAction('save_pipeline_deal', updatedDeal, {
      entityKey: `pipeline:${updatedDeal.id}`,
    });
  }

  return updatedDeal;
}

/**
 * Guarda o actualiza múltiples oportunidades en bloque (usado en importación Excel masiva),
 * persistiendo en IndexedDB y sincronizando TODOS los registros sin límite de 50 ítems.
 */
export async function bulkSavePipelineDeals(
  newOrUpdated: PipelineDealRecord[]
): Promise<PipelineDealRecord[]> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getPipelineDeals();
  const map = new Map<string, PipelineDealRecord>();
  const nowIso = new Date().toISOString();

  existing.forEach((d) => map.set(d.id, d));
  const stampedBatch: PipelineDealRecord[] = newOrUpdated.map((d) => {
    clearTombstone(d.id, projectScope);
    const stamped: PipelineDealRecord = {
      ...d,
      updatedAt: nowIso,
    };
    map.set(stamped.id, stamped);
    return stamped;
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );

  await persistDurableDeals(merged, projectScope);
  writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);

  if (stampedBatch.length > 0) {
    if (isAppOffline()) {
      await enqueueOfflineAction('bulk_save_pipeline', stampedBatch, {
        entityKey: `pipeline:bulk:${Date.now().toString(36)}`,
      });
    } else {
      const pushRes = await pushPipelineDealsBatchToCloud(stampedBatch);
      if (!pushRes.success) {
        await enqueueOfflineAction('bulk_save_pipeline', stampedBatch, {
          entityKey: `pipeline:bulk:${Date.now().toString(36)}`,
        });
      }
    }
  }

  return merged;
}

/**
 * Elimina una oportunidad del pipeline registrando un tombstone para evitar resurrección.
 */
export async function deletePipelineDeal(id: string): Promise<boolean> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getPipelineDeals();

  recordTombstone(id, projectScope);

  const updatedList = existing.filter((d) => d.id !== id);
  await persistDurableDeals(updatedList, projectScope);

  if (isAppOffline()) {
    await enqueueOfflineAction('delete_pipeline_deal', { id }, {
      entityKey: `pipeline:${id}`,
    });
    return true;
  }

  const cloudRes = await pushPipelineDeleteToCloud(id);
  if (!cloudRes.success) {
    console.warn('[PipelineStorage] Error eliminando en nube, encolado tombstone:', cloudRes.error);
    await enqueueOfflineAction('delete_pipeline_deal', { id }, {
      entityKey: `pipeline:${id}`,
    });
  }

  return true;
}

/**
 * Sincroniza bidireccionalmente el pipeline con Firestore Cloud sin truncamiento ni orderBy restrictivo.
 */
export async function syncPipelineWithCloud(): Promise<{
  count: number;
  source: 'cloud' | 'local';
  uploadedCount?: number;
}> {
  const projectScope = getActiveProjectScopeKey();
  const localDeals = await getPipelineDeals(true);
  const stones = getTombstones(projectScope);

  if (isAppOffline()) {
    return { count: localDeals.length, source: 'local' };
  }

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { count: localDeals.length, source: 'local' };
  }

  try {
    // Consultar colección completa sin orderBy para no omitir registros sin updatedAt indexado
    const snap = await withTimeout(getDocs(collection(firestoreDb, PIPELINE_COLLECTION)), 8000);

    if (snap.empty) {
      if (localDeals.length > 0) {
        const pushRes = await pushPipelineDealsBatchToCloud(localDeals);
        return {
          count: localDeals.length,
          source: pushRes.uploaded > 0 ? 'cloud' : 'local',
          uploadedCount: pushRes.uploaded,
        };
      }
      return { count: 0, source: 'local' };
    }

    const cloudDealsMap = new Map<string, PipelineDealRecord>();
    snap.forEach((d) => {
      const data = d.data() as PipelineDealRecord;
      const docId = data?.id || d.id;
      if (docId && !stones.has(docId)) {
        cloudDealsMap.set(docId, { ...data, id: docId });
      } else if (docId && stones.has(docId)) {
        deleteDoc(doc(firestoreDb, PIPELINE_COLLECTION, docId)).catch(() => {});
      }
    });

    const mergedMap = new Map<string, PipelineDealRecord>(cloudDealsMap);
    const pendingToPush: PipelineDealRecord[] = [];

    for (const local of localDeals) {
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
      await pushPipelineDealsBatchToCloud(pendingToPush);
    }

    if (mergedList.length > 0) {
      writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);
    }
    await persistDurableDeals(mergedList, projectScope);
    isHydrated = true;

    return { count: mergedList.length, source: 'cloud', uploadedCount: pendingToPush.length };
  } catch (err) {
    console.warn('[PipelineStorage] Fallback a datos locales tras error de sincronización nube:', err);
    return { count: localDeals.length, source: 'local' };
  }
}

/**
 * Restablece las oportunidades al catálogo maestro inicial de 70 deals.
 */
export async function resetPipelineToInitialSeeds(): Promise<number> {
  const projectScope = getActiveProjectScopeKey();
  writeProjectScopedStorage(LOCAL_PIPELINE_TOMBSTONES_KEY, '[]', projectScope);
  writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);
  await persistDurableDeals([...PIPELINE_INITIAL_SEEDS], projectScope);
  isHydrated = true;
  return PIPELINE_INITIAL_SEEDS.length;
}
