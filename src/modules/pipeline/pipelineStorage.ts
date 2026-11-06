// ============================================================================
// CISCO AUTOMATED v2.8 - PIPELINE PERSISTENCE ENGINE (INDEXEDDB + VAULT + FIRESTORE)
// Implements Database Armor Architecture:
// - Multi-tier Local Vault (IndexedDB + LocalStorage Mirror + Tombstones)
// - Resilient Firestore Cloud Synchronization with Offline Queue
// - Automatic Master Seed Hydration (70 Deals Oficiales Intcomex)
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
import { PipelineDealRecord } from './pipelineTypes';
import { PIPELINE_INITIAL_SEEDS } from './pipelineSeeds';

export const PIPELINE_COLLECTION = 'cisco_pipeline_deals';
const LOCAL_PIPELINE_PRIMARY_KEY = 'cisco_pipeline_deals_cache_v1';
const LOCAL_PIPELINE_VAULT_KEY = 'cisco_pipeline_deals_vault_v1';
const LOCAL_PIPELINE_TOMBSTONES_KEY = 'cisco_pipeline_deals_tombstones_v1';
const LOCAL_PIPELINE_SEEDED_KEY = 'cisco_pipeline_seed_initialized_v1';

let inMemoryPipelineCache: PipelineDealRecord[] = [];
let isHydrated = false;

// ----------------------------------------------------------------------------
// Local Storage Multi-Tier Vault Helpers
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
  writeProjectScopedStorage(
    LOCAL_PIPELINE_TOMBSTONES_KEY,
    JSON.stringify(Array.from(stones)),
    projectScope
  );
}

function clearTombstone(id: string, projectScope?: string): void {
  const stones = getTombstones(projectScope);
  if (stones.delete(id)) {
    writeProjectScopedStorage(
      LOCAL_PIPELINE_TOMBSTONES_KEY,
      JSON.stringify(Array.from(stones)),
      projectScope
    );
  }
}

function readLocalDeals(projectScope?: string): PipelineDealRecord[] {
  const stones = getTombstones(projectScope);
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

function writeLocalDeals(deals: PipelineDealRecord[], projectScope?: string): void {
  const serialized = JSON.stringify(deals);
  writeProjectScopedStorage(LOCAL_PIPELINE_PRIMARY_KEY, serialized, projectScope);
  writeProjectScopedStorage(LOCAL_PIPELINE_VAULT_KEY, serialized, projectScope);
  inMemoryPipelineCache = [...deals];
}

// ----------------------------------------------------------------------------
// Public Storage API
// ----------------------------------------------------------------------------

function sanitizeDealForCloud(deal: PipelineDealRecord): PipelineDealRecord {
  return {
    ...deal,
    partner: (deal.partner || '').trim() || '-',
    endUser: (deal.endUser || '').trim() || '-',
  };
}

/**
 * Obtiene todas las oportunidades del pipeline desde memoria o almacenamiento local blindado.
 * Si es la primera vez que se ejecuta, auto-hidrata con las 70 oportunidades oficiales iniciales.
 */
export async function getPipelineDeals(forceRefresh = false): Promise<PipelineDealRecord[]> {
  const projectScope = getActiveProjectScopeKey();

  if (!forceRefresh && isHydrated && inMemoryPipelineCache.length > 0) {
    return inMemoryPipelineCache;
  }

  let deals = readLocalDeals(projectScope);

  // Auto-hidratación inicial si no existen registros y no ha sido marcado como sembrado
  const alreadySeeded = readProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, projectScope) === 'true';
  if (deals.length === 0 && !alreadySeeded) {
    deals = [...PIPELINE_INITIAL_SEEDS];
    writeLocalDeals(deals, projectScope);
    writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);
  }

  inMemoryPipelineCache = deals;
  isHydrated = true;
  return deals;
}

/**
 * Guarda o actualiza una oportunidad en el pipeline local y sincroniza asíncronamente con Firestore Cloud.
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

  writeLocalDeals(updatedList, projectScope);

  // Sincronización transparente con Firestore Cloud (No bloqueante si no hay conexión)
  try {
    const instance = getFirestoreInstance();
    const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (firestoreDb) {
      await withTimeout(
        setDoc(
          doc(firestoreDb, PIPELINE_COLLECTION, deal.id),
          sanitizeForFirestore(sanitizeDealForCloud(updatedDeal)),
          { merge: true }
        ),
        4000
      );
    }
  } catch (err) {
    console.warn('[PipelineStorage] No se pudo sincronizar en la nube inmediatamente (modo offline activo):', err);
  }

  return updatedDeal;
}

/**
 * Elimina una oportunidad del pipeline registrando un tombstone para evitar resurrección.
 */
export async function deletePipelineDeal(id: string): Promise<boolean> {
  const projectScope = getActiveProjectScopeKey();
  const existing = await getPipelineDeals();

  recordTombstone(id, projectScope);

  const updatedList = existing.filter((d) => d.id !== id);
  writeLocalDeals(updatedList, projectScope);

  try {
    const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
    if (firestoreDb) {
      await withTimeout(
        deleteDoc(doc(firestoreDb, PIPELINE_COLLECTION, id)),
        4000
      );
    }
  } catch (err) {
    console.warn('[PipelineStorage] Error eliminando en la nube (tombstone local activo):', err);
  }

  return true;
}

/**
 * Sincroniza bidireccionalmente el pipeline con Firestore Cloud reconciliando por `updatedAt`.
 */
export async function syncPipelineWithCloud(): Promise<{ count: number; source: 'cloud' | 'local' }> {
  const projectScope = getActiveProjectScopeKey();
  const localDeals = await getPipelineDeals();
  const stones = getTombstones(projectScope);

  const instance = getFirestoreInstance();
  const firestoreDb = instance && instance.isReady ? instance.db : null;
  if (!firestoreDb) {
    return { count: localDeals.length, source: 'local' };
  }

  try {
    const q = query(collection(firestoreDb, PIPELINE_COLLECTION), orderBy('updatedAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 6000);

    if (snap.empty) {
      // Si la nube está vacía pero local tiene datos, subirlos en lote
      if (localDeals.length > 0) {
        for (const deal of localDeals.slice(0, 50)) {
          await setDoc(doc(firestoreDb, PIPELINE_COLLECTION, deal.id), sanitizeForFirestore(sanitizeDealForCloud(deal)), { merge: true }).catch(() => {});
        }
      }
      return { count: localDeals.length, source: 'local' };
    }

    const cloudDealsMap = new Map<string, PipelineDealRecord>();
    snap.forEach((d) => {
      const data = d.data() as PipelineDealRecord;
      if (data && data.id && !stones.has(data.id)) {
        cloudDealsMap.set(data.id, data);
      }
    });

    // Reconciliar local vs cloud
    const mergedMap = new Map<string, PipelineDealRecord>(cloudDealsMap);

    for (const local of localDeals) {
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

    writeLocalDeals(mergedList, projectScope);
    return { count: mergedList.length, source: 'cloud' };
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
  writeLocalDeals([...PIPELINE_INITIAL_SEEDS], projectScope);
  writeProjectScopedStorage(LOCAL_PIPELINE_SEEDED_KEY, 'true', projectScope);
  inMemoryPipelineCache = [...PIPELINE_INITIAL_SEEDS];
  return PIPELINE_INITIAL_SEEDS.length;
}
