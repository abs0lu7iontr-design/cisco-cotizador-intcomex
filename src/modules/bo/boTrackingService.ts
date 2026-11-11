// ============================================================================
// CISCO AUTOMATED v2.1 - BO ORDER TRACKING SERVICE (FIRESTORE + INDEXEDDB + EVENT LOG)
// Implements Item 11 (IndexedDB Collection Store), Item 12 (Idempotent Event Log), Item 15 (Project Scope)
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  getFirestoreInstance,
  getActiveProjectScopeKey,
  readProjectScopedStorage,
  writeProjectScopedStorage,
  registerProjectScopedCleanup,
} from '../cloud/firebaseConfig';
import {
  BoOrderTrackingRecord,
  BoStage,
  CourierProvider,
  getCourierTrackingUrl,
  BoDailyNote,
  isRealPoNumber,
  isRealSoNumber,
  getEffectivePoAddedDate,
  getEffectiveSoAddedDate,
} from './boTrackingTypes';
import { ProcessedEstimateResult } from '../../core/types';
import { BoLineItem } from './boTypes';
import { sanitizeForFirestore } from '../cloud/firestoreService';
import { detectSkuCategory } from '../dsv/dsvEngine';
import { isAppOffline } from '../../core/storage/offlineModeManager';
import { enqueueOfflineAction } from '../../core/storage/offlineSyncQueue';
import { getEstimatesMirrorSnapshot } from '../../hooks/useEstimatesMirror';
import {
  getCollectionRecordsSync,
  putCollectionRecordsBatch,
  deleteCollectionRecord,
  appendEntityEventAtomic,
  mergeAndQueryEntityEvents,
  EventQueryOptions,
  EntityHistoryEvent,
} from '../storage/indexedDbCollectionStore';

const BO_TRACKING_COLLECTION = 'bo_order_tracking';
const LOCAL_BO_TRACKING_PRIMARY_KEY = 'cisco_bo_order_tracking_cache_v2';
const LOCAL_BO_TRACKING_VAULT_KEY = 'cisco_bo_order_tracking_vault_v1';
const LOCAL_BO_TRACKING_LEGACY_KEY = 'cisco_bo_order_tracking_cache_v1';
const LOCAL_BO_TRACKING_DELETED_KEY = 'cisco_bo_order_tracking_deleted_ids_v1';
const LOCAL_BO_TRACKING_INIT_KEY = 'cisco_bo_order_tracking_initialized_flag_v1';

// ----------------------------------------------------------------------------
// Local Storage Multi-Tier Vault, IndexedDB & Idempotent Event Helpers
// ----------------------------------------------------------------------------
let inMemoryTrackingCache: BoOrderTrackingRecord[] = [];
let inMemoryScopeKey: string = '';

registerProjectScopedCleanup(() => {
  inMemoryTrackingCache = [];
  inMemoryScopeKey = '';
});

export interface DsvBodegaRowInput {
  sku?: string;
  partNumber?: string;
  detectedType?: string;
  overrideType?: string;
  productQuantity?: number;
}

/**
 * Determina la bodega correcta a partir de las líneas de un DSV:
 * - Si existe al menos 1 ítem de hardware activo -> 'E1' (Bodega física ENEA)
 * - Si el 100% de las líneas son intangibles (subscription/service) -> 'ED' (Bodega digital)
 */
export function detectBodegaFromDsvRows(rows?: DsvBodegaRowInput[]): 'E1' | 'ED' | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const activeRows = rows.filter((r) => Number(r.productQuantity ?? 1) > 0);
  const targetRows = activeRows.length > 0 ? activeRows : rows;
  const hasHardware = targetRows.some((r) => {
    const skuCode = String(r.sku || r.partNumber || '').trim();
    const effectiveCategory =
      r.overrideType ||
      r.detectedType ||
      (skuCode ? detectSkuCategory(skuCode) : undefined);
    return effectiveCategory === 'hardware';
  });
  return hasHardware ? 'E1' : 'ED';
}

function findBodegaFromLocalDsvOrEstimateCaches(
  dealId?: string,
  soNumber?: string,
  estimateId?: string,
  poNumber?: string,
  scopeKey?: string
): 'E1' | 'ED' | undefined {
  const cleanDeal = String(dealId || '').trim();
  const cleanSo = String(soNumber || '').trim();
  const cleanEst = String(estimateId || '').trim();
  const cleanPo = String(poNumber || '').trim();

  // 1. Buscar en caché local de DSVs exportados/guardados
  try {
    if (typeof localStorage !== 'undefined') {
      const dsvKeys = ['cisco_cloud_dsv_cache_v2', 'cisco_dsv_permanent_vault_v1'];
      for (const k of dsvKeys) {
        const raw = readProjectScopedStorage(k, scopeKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        const matchedDsv = parsed.find((d: any) => {
          if (!d) return false;
          if (cleanDeal && cleanDeal !== 'DEAL-N/A' && d.dealId === cleanDeal) return true;
          if (cleanSo && d.soNumber === cleanSo) return true;
          if (cleanEst && d.dealId === cleanEst) return true;
          if (cleanPo && isRealPoNumber(cleanPo) && d.poNumber === cleanPo) return true;
          return false;
        });
        if (matchedDsv && Array.isArray(matchedDsv.items) && matchedDsv.items.length > 0) {
          const detected = detectBodegaFromDsvRows(matchedDsv.items);
          if (detected) return detected;
        }
      }
    }
  } catch (_) {}

  // 2. Buscar en caché mirror de Estimates guardados
  try {
    const estimates = getEstimatesMirrorSnapshot();
    const matchedEst = estimates.find((e) => {
      if (!e) return false;
      if (cleanEst && e.estimateId === cleanEst) return true;
      if (cleanDeal && cleanDeal !== 'DEAL-N/A' && e.dealId === cleanDeal) return true;
      return false;
    });
    if (matchedEst && Array.isArray(matchedEst.items) && matchedEst.items.length > 0) {
      const activeItems = matchedEst.items.filter((it) => (Number(it.qty) || 0) > 0);
      if (activeItems.length > 0) {
        return activeItems.some((it) => !it.isIntangible) ? 'E1' : 'ED';
      }
    }
  } catch (_) {}

  return undefined;
}

export function autoRepairBoRecordBodega(
  record: BoOrderTrackingRecord,
  scopeKey?: string
): { record: BoOrderTrackingRecord; changed: boolean } {
  if (!record || record.bodegaDestino === 'E1') {
    return { record, changed: false };
  }

  // Si ya tiene guía física FedEx/UPS/DHL o sin bodega, es un despacho físico E1
  const hasPhysicalTracking = Boolean(record.courierTrackingNumber && record.courierTrackingNumber.trim().length >= 5);
  if (hasPhysicalTracking) {
    return {
      record: { ...record, bodegaDestino: 'E1' },
      changed: true,
    };
  }

  // Si fue creado vía DSV o no tiene bodega asignada, contrastar con caché DSV/Estimates
  const isDsvOrMissing = record.estimateVersionTag === 'DSV' || !record.bodegaDestino;
  if (isDsvOrMissing) {
    const detected = findBodegaFromLocalDsvOrEstimateCaches(
      record.dealId,
      record.ciscoSoNumber,
      record.estimateId,
      record.clientPoNumber,
      scopeKey
    );
    if (detected === 'E1' || (!record.bodegaDestino && detected)) {
      return {
        record: { ...record, bodegaDestino: detected || 'E1' },
        changed: true,
      };
    }
  }

  return { record, changed: false };
}

/**
 * Estampa y preserva las fechas de ingreso real de OC y SO Cisco en un registro BO.
 */
export function applyPoAndSoTimestamps(
  record: BoOrderTrackingRecord,
  previous?: BoOrderTrackingRecord,
  nowIso: string = new Date().toISOString()
): BoOrderTrackingRecord {
  const next: BoOrderTrackingRecord = { ...record };

  const prevPo = String(previous?.clientPoNumber || '').trim();
  const currPo = String(next.clientPoNumber || '').trim();
  if (isRealPoNumber(currPo)) {
    const poChanged = Boolean(previous) && prevPo !== currPo;
    const explicitCustomPoDate =
      Boolean(next.clientPoAddedAt) && next.clientPoAddedAt !== previous?.clientPoAddedAt;
    if (!explicitCustomPoDate) {
      if (next.clientPoAddedAt && !poChanged) {
        // Mantiene timestamp previo
      } else if (previous && !poChanged) {
        next.clientPoAddedAt = previous.clientPoAddedAt || getEffectivePoAddedDate(previous) || nowIso;
      } else {
        next.clientPoAddedAt = nowIso;
      }
    }
  }

  const prevSo = String(previous?.ciscoSoNumber || '').trim();
  const currSo = String(next.ciscoSoNumber || '').trim();
  if (isRealSoNumber(currSo)) {
    const soChanged = Boolean(previous) && prevSo !== currSo;
    const explicitCustomSoDate =
      Boolean(next.ciscoSoAddedAt) && next.ciscoSoAddedAt !== previous?.ciscoSoAddedAt;
    if (!explicitCustomSoDate) {
      if (next.ciscoSoAddedAt && !soChanged) {
        // Mantiene timestamp previo
      } else if (previous && !soChanged) {
        next.ciscoSoAddedAt = previous.ciscoSoAddedAt || getEffectiveSoAddedDate(previous) || nowIso;
      } else {
        next.ciscoSoAddedAt = nowIso;
      }
    }
  }

  return next;
}

/**
 * Merges a BO order's inline `notes` array with the idempotent event store so concurrent
 * additions never overwrite each other and duplicate retries are deduplicated (Item 12).
 */
export function reconcileBoOrderNotesWithEventStore(
  record: BoOrderTrackingRecord,
  projectScope?: string
): BoOrderTrackingRecord {
  if (!record || !record.id) return record;
  const mergedEvents = mergeAndQueryEntityEvents(
    'BO_TRACKING',
    record.id,
    (record.notes || []).map((n) => ({
      id: n.id,
      date: n.date,
      author: n.author,
      stage: n.stage,
      comment: n.comment,
    })),
    { direction: 'asc', projectScope }
  );

  const notes: BoDailyNote[] = mergedEvents.map((evt) => ({
    id: evt.id,
    date: evt.createdAt,
    author: evt.author,
    stage: (evt.actionOrStage as BoStage) || record.currentStage,
    comment: evt.comment,
  }));

  return {
    ...record,
    notes,
  };
}

export function getBoOrderEventsPaginated(
  orderId: string,
  options?: EventQueryOptions
): EntityHistoryEvent[] {
  const existing = getLocalBoTrackingCache().find((r) => r.id === orderId);
  return mergeAndQueryEntityEvents(
    'BO_TRACKING',
    orderId,
    (existing?.notes || []).map((n) => ({
      id: n.id,
      date: n.date,
      author: n.author,
      stage: n.stage,
      comment: n.comment,
    })),
    options
  );
}

export function getDeletedBoTrackingIds(projectId?: string): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = readProjectScopedStorage(LOCAL_BO_TRACKING_DELETED_KEY, projectId);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    }
  } catch (_) {}
  return new Set();
}

export function addDeletedBoTrackingId(id: string, projectId?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const deleted = getDeletedBoTrackingIds(projectId);
      deleted.add(id);
      writeProjectScopedStorage(
        LOCAL_BO_TRACKING_DELETED_KEY,
        JSON.stringify(Array.from(deleted)),
        projectId
      );
    }
  } catch (_) {}
}

export function getLocalBoTrackingCache(projectId?: string): BoOrderTrackingRecord[] {
  const scopeKey = projectId || getActiveProjectScopeKey();
  const deletedIds = getDeletedBoTrackingIds(scopeKey);
  const map = new Map<string, BoOrderTrackingRecord>();

  // 1. Read from IndexedDB collection mirror (Item 11)
  const idbRecords = getCollectionRecordsSync<BoOrderTrackingRecord>('bo_trackings', scopeKey);
  for (const item of idbRecords) {
    if (item && item.id && !deletedIds.has(item.id)) {
      map.set(item.id, reconcileBoOrderNotesWithEventStore(item, scopeKey));
    }
  }

  const keysToRead = [
    LOCAL_BO_TRACKING_LEGACY_KEY,
    LOCAL_BO_TRACKING_VAULT_KEY,
    LOCAL_BO_TRACKING_PRIMARY_KEY,
  ];

  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of keysToRead) {
        const raw = readProjectScopedStorage(k, scopeKey);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !deletedIds.has(item.id)) {
                const reconciledItem = reconcileBoOrderNotesWithEventStore(item, scopeKey);
                const existing = map.get(reconciledItem.id);
                if (!existing) {
                  map.set(reconciledItem.id, reconciledItem);
                } else {
                  const existingTs = existing.updatedAt || existing.createdAt || '';
                  const itemTs = reconciledItem.updatedAt || reconciledItem.createdAt || '';
                  const combinedNotes = reconcileBoOrderNotesWithEventStore(
                    {
                      ...(itemTs >= existingTs ? reconciledItem : existing),
                      notes: [...(existing.notes || []), ...(reconciledItem.notes || [])],
                    },
                    scopeKey
                  );
                  map.set(reconciledItem.id, combinedNotes);
                }
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // Si hay datos en memoria del mismo scope que no están en localStorage, incluirlos
  if (inMemoryScopeKey === scopeKey) {
    for (const mem of inMemoryTrackingCache) {
      if (mem && mem.id && !deletedIds.has(mem.id) && !map.has(mem.id)) {
        map.set(mem.id, reconcileBoOrderNotesWithEventStore(mem, scopeKey));
      }
    }
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return result.length > 0 ? result : inMemoryScopeKey === scopeKey ? inMemoryTrackingCache : [];
}

export function saveLocalBoTrackingCache(
  records: BoOrderTrackingRecord[],
  projectId?: string
): void {
  const scopeKey = projectId || getActiveProjectScopeKey();
  const deletedIds = getDeletedBoTrackingIds(scopeKey);
  const cleanRecords = records
    .filter((r) => r && r.id && !deletedIds.has(r.id))
    .map((r) => reconcileBoOrderNotesWithEventStore(r, scopeKey));
  inMemoryTrackingCache = [...cleanRecords];
  inMemoryScopeKey = scopeKey;

  // Persist per-record in IndexedDB collection store (Item 11)
  putCollectionRecordsBatch(
    'bo_trackings',
    cleanRecords.map((r) => ({ id: r.id, record: r })),
    { projectScope: scopeKey, replaceAllInScope: true }
  ).catch(() => {});

  try {
    if (typeof localStorage !== 'undefined') {
      const json = JSON.stringify(cleanRecords);
      writeProjectScopedStorage(LOCAL_BO_TRACKING_PRIMARY_KEY, json, scopeKey);
      writeProjectScopedStorage(LOCAL_BO_TRACKING_VAULT_KEY, json, scopeKey);
      writeProjectScopedStorage(LOCAL_BO_TRACKING_LEGACY_KEY, json, scopeKey);
      writeProjectScopedStorage(LOCAL_BO_TRACKING_INIT_KEY, 'true', scopeKey);
    }
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// Semillas de Demostración Iniciales (Realistic Intcomex Chile BO Tracking)
// ----------------------------------------------------------------------------
const SEED_BO_ORDERS: BoOrderTrackingRecord[] = [
  {
    id: 'BO-OC99102-OE169047114NP',
    estimateId: 'OE169047114NP',
    estimateVersionTag: 'v1',
    dealId: 'DEAL-8899201',
    partnerName: 'Sonda Chile',
    endCustomerName: 'Banco Santander',
    clientPoNumber: 'OC-99102',
    ciscoSoNumber: 'SO-10928371',
    courier: 'FedEx',
    courierTrackingNumber: '771234567890',
    courierTrackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=771234567890',
    currentStage: 'SHIPPED_COURIER',
    estimatedShipDate: '2026-10-02',
    estimatedArrivalDate: '2026-10-12',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lastDailyReviewAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    totalSaleUsd: 48500.0,
    grossProfitUsd: 5820.0,
    marginPct: 12.0,
    internacionUsd: 650.0,
    arancelUsd: 1450.0,
    itemsCount: 14,
    bodegaDestino: 'E1',
    notes: [
      {
        id: 'note-1',
        date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        stage: 'OC_RECEIVED',
        comment: 'OC recibida conforme de Sonda. Margen y aranceles validados según v1.',
      },
      {
        id: 'note-2',
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        author: 'operaciones',
        stage: 'CISCO_SO_BOOKED',
        comment: 'Cisco SO-10928371 confirmada en CCW.',
      },
      {
        id: 'note-3',
        date: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        stage: 'SHIPPED_COURIER',
        comment: 'Despachado desde planta Guadalajara vía FedEx 771234567890 con destino casillero Miami.',
      },
    ],
  },
  {
    id: 'BO-OC4412-UE169044537CM',
    estimateId: 'UE169044537CM',
    estimateVersionTag: 'v2',
    dealId: 'DEAL-7744102',
    partnerName: 'Telefónica Tech SpA',
    endCustomerName: 'Municipalidad de Ñuñoa',
    clientPoNumber: 'OC-4412',
    ciscoSoNumber: 'SO-10934112',
    courier: 'FedEx',
    courierTrackingNumber: '794561230089',
    courierTrackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=794561230089',
    currentStage: 'MIAMI_FORWARDER',
    estimatedShipDate: '2026-09-28',
    estimatedArrivalDate: '2026-10-09',
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    lastDailyReviewAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    totalSaleUsd: 19800.0,
    grossProfitUsd: 2970.0,
    marginPct: 15.0,
    internacionUsd: 280.0,
    arancelUsd: 590.0,
    itemsCount: 6,
    bodegaDestino: 'E1',
    notes: [
      {
        id: 'note-t1',
        date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        author: 'preventa',
        stage: 'OC_RECEIVED',
        comment: 'OC recibida por renovación switches Catalyst 9300.',
      },
      {
        id: 'note-t2',
        date: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        author: 'operaciones',
        stage: 'MIAMI_FORWARDER',
        comment: 'Bultos recibidos en forwarder Miami. WR #45882 emitido para vuelo de consolidación a Santiago.',
      },
    ],
  },
  {
    id: 'BO-OC1109-OE168772091KL',
    estimateId: 'OE168772091KL',
    estimateVersionTag: 'v1',
    dealId: 'DEAL-6612984',
    partnerName: 'Entel Chile',
    endCustomerName: 'Clínica Las Condes',
    clientPoNumber: 'OC-1109',
    ciscoSoNumber: 'SO-10899432',
    courier: 'FedEx',
    courierTrackingNumber: '781900112233',
    courierTrackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=781900112233',
    currentStage: 'INTCOMEX_WAREHOUSE',
    estimatedShipDate: '2026-09-20',
    estimatedArrivalDate: '2026-10-04',
    actualDeliveryDate: '2026-10-04',
    createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastDailyReviewAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    totalSaleUsd: 31200.0,
    grossProfitUsd: 4368.0,
    marginPct: 14.0,
    internacionUsd: 420.0,
    arancelUsd: 910.0,
    itemsCount: 8,
    bodegaDestino: 'E1',
    notes: [
      {
        id: 'note-e1',
        date: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
        author: 'operaciones',
        stage: 'OC_RECEIVED',
        comment: 'Ingreso inicial de orden por licencias y equipos Meraki.',
      },
      {
        id: 'note-e2',
        date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        author: 'logistica',
        stage: 'INTCOMEX_WAREHOUSE',
        comment: 'Ingresado físicamente a Bodega ENEA Pudahuel. Disponible para retiro/despacho a Entel.',
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// Operaciones CRUD Principales
// ----------------------------------------------------------------------------

/**
 * Obtiene todas las órdenes de seguimiento BO con fusión bidireccional inteligente,
 * soporte completo para Modo Offline y auto-reparación de bodegas DSV mal clasificadas.
 */
export async function getBoTrackings(): Promise<BoOrderTrackingRecord[]> {
  const scopeKey = getActiveProjectScopeKey();
  const rawLocalRecords = getLocalBoTrackingCache(scopeKey);
  const deletedIds = getDeletedBoTrackingIds(scopeKey);

  let localRepairedAny = false;
  const localRecords = rawLocalRecords.map((lr) => {
    const repaired = autoRepairBoRecordBodega(lr, scopeKey);
    if (repaired.changed) localRepairedAny = true;
    return repaired.record;
  });

  if (localRepairedAny && localRecords.length > 0) {
    saveLocalBoTrackingCache(localRecords, scopeKey);
  }

  // En modo Offline (manual o sin red), operar exclusivamente con la bóveda local del PC
  if (isAppOffline()) {
    if (localRecords.length > 0) {
      return localRecords;
    }
    const isInitializedOffline =
      typeof localStorage !== 'undefined' && readProjectScopedStorage(LOCAL_BO_TRACKING_INIT_KEY, scopeKey);
    if (!isInitializedOffline) {
      saveLocalBoTrackingCache(SEED_BO_ORDERS, scopeKey);
      return SEED_BO_ORDERS;
    }
    return [];
  }

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      // Consultar colección completa sin orderBy para no omitir documentos sin campo createdAt indexado
      const snapshot = await getDocs(collection(db, BO_TRACKING_COLLECTION));

      const cloudRecords: BoOrderTrackingRecord[] = [];
      const pendingSyncToCloudMap = new Map<string, BoOrderTrackingRecord>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BoOrderTrackingRecord;
        const docId = data?.id || docSnap.id;
        if (!docId) return;
        if (deletedIds.has(docId)) {
          deleteDoc(doc(db, BO_TRACKING_COLLECTION, docId)).catch(() => {});
          return;
        }
        const normalizedCloud: BoOrderTrackingRecord = { ...data, id: docId };
        const repairedCloud = autoRepairBoRecordBodega(normalizedCloud, scopeKey);
        if (repairedCloud.changed) {
          pendingSyncToCloudMap.set(docId, repairedCloud.record);
        }
        cloudRecords.push(repairedCloud.record);
      });

      const mergedMap = new Map<string, BoOrderTrackingRecord>();
      for (const cr of cloudRecords) {
        mergedMap.set(cr.id, cr);
      }

      for (const lr of localRecords) {
        if (deletedIds.has(lr.id)) continue;

        const existingCloud = mergedMap.get(lr.id);
        if (!existingCloud) {
          mergedMap.set(lr.id, lr);
          pendingSyncToCloudMap.set(lr.id, lr);
        } else {
          const preferE1 =
            lr.bodegaDestino === 'E1' && existingCloud.bodegaDestino === 'ED';

          if (lr.currentStage === 'DELIVERED' && existingCloud.currentStage !== 'DELIVERED') {
            const nextRec = preferE1 ? { ...lr, bodegaDestino: 'E1' as const } : lr;
            mergedMap.set(lr.id, nextRec);
            pendingSyncToCloudMap.set(lr.id, nextRec);
          } else {
            const localTs = lr.updatedAt || lr.createdAt || '';
            const cloudTs = existingCloud.updatedAt || existingCloud.createdAt || '';
            if (localTs >= cloudTs) {
              const nextRec: BoOrderTrackingRecord = {
                ...lr,
                bodegaDestino: preferE1 ? 'E1' : (lr.bodegaDestino || existingCloud.bodegaDestino),
                clientPoAddedAt: lr.clientPoAddedAt || existingCloud.clientPoAddedAt,
                ciscoSoAddedAt: lr.ciscoSoAddedAt || existingCloud.ciscoSoAddedAt,
              };
              mergedMap.set(lr.id, nextRec);
              if (localTs > cloudTs || preferE1) {
                pendingSyncToCloudMap.set(lr.id, nextRec);
              }
            } else if (preferE1) {
              const repairedMerge: BoOrderTrackingRecord = {
                ...existingCloud,
                bodegaDestino: 'E1',
                clientPoAddedAt: existingCloud.clientPoAddedAt || lr.clientPoAddedAt,
                ciscoSoAddedAt: existingCloud.ciscoSoAddedAt || lr.ciscoSoAddedAt,
              };
              mergedMap.set(lr.id, repairedMerge);
              pendingSyncToCloudMap.set(lr.id, repairedMerge);
            }
          }
        }
      }

      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      if (pendingSyncToCloudMap.size > 0) {
        for (const item of pendingSyncToCloudMap.values()) {
          try {
            const docRef = doc(db, BO_TRACKING_COLLECTION, item.id);
            const sanitized = sanitizeForFirestore(item);
            setDoc(docRef, sanitized, { merge: true }).catch((errCloud) => {
              console.warn('[BoTrackingService] Auto-sincronización pendiente:', errCloud);
            });
          } catch (_) {}
        }
      }

      if (mergedList.length > 0) {
        saveLocalBoTrackingCache(mergedList, scopeKey);
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[BoTrackingService] Firestore no disponible o sin conexión. Usando caché local blindada:', err);
  }

  if (localRecords.length > 0) {
    return localRecords;
  }

  const isInitialized =
    typeof localStorage !== 'undefined' && readProjectScopedStorage(LOCAL_BO_TRACKING_INIT_KEY, scopeKey);
  if (!isInitialized && localRecords.length === 0) {
    saveLocalBoTrackingCache(SEED_BO_ORDERS, scopeKey);
    return SEED_BO_ORDERS;
  }

  return [];
}

/**
 * Envía directamente un registro BO a Cloud Firestore (usado en modo online y en el flush de cola offline).
 */
export async function pushBoTrackingToCloud(
  record: BoOrderTrackingRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (!isReady || !db) {
      return { success: false, error: error || 'Firestore no disponible' };
    }
    const docRef = doc(db, BO_TRACKING_COLLECTION, record.id);
    const sanitized = sanitizeForFirestore(record);
    await setDoc(docRef, sanitized, { merge: true });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al subir seguimiento BO a Firestore' };
  }
}

/**
 * Envía directamente la eliminación de un registro BO a Cloud Firestore.
 */
export async function pushBoTrackingDeleteToCloud(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (!isReady || !db) {
      return { success: false, error: error || 'Firestore no disponible' };
    }
    await deleteDoc(doc(db, BO_TRACKING_COLLECTION, orderId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar seguimiento BO en Firestore' };
  }
}

/**
 * Guarda o actualiza un registro completo de seguimiento BO con sanitización estricta,
 * sellado automático de fechas de ingreso OC/SO, cola offline y reconciliación idempotente.
 */
export async function saveBoTracking(
  record: BoOrderTrackingRecord
): Promise<{ success: boolean; offlineQueued?: boolean; error?: string }> {
  try {
    const scopeKey = getActiveProjectScopeKey();
    const nowIso = new Date().toISOString();
    const current = getLocalBoTrackingCache(scopeKey);
    const existingIdx = current.findIndex((r) => r.id === record.id);
    const existingRecord = existingIdx >= 0 ? current[existingIdx] : undefined;

    const mergedNotesBase = existingRecord
      ? {
          ...record,
          notes: [...(existingRecord.notes || []), ...(record.notes || [])],
        }
      : record;

    const reconciled = reconcileBoOrderNotesWithEventStore(mergedNotesBase, scopeKey);
    const stamped = applyPoAndSoTimestamps(reconciled, existingRecord, nowIso);
    const finalRecord: BoOrderTrackingRecord = {
      ...stamped,
      courierTrackingUrl: getCourierTrackingUrl(stamped.courier, stamped.courierTrackingNumber),
      updatedAt: nowIso,
    };

    let nextList: BoOrderTrackingRecord[];
    if (existingIdx >= 0) {
      nextList = [...current];
      nextList[existingIdx] = finalRecord;
    } else {
      nextList = [finalRecord, ...current];
    }
    saveLocalBoTrackingCache(nextList, scopeKey);

    if (isAppOffline()) {
      await enqueueOfflineAction('save_bo_tracking', finalRecord, {
        entityKey: `bo:${finalRecord.id}`,
      });
      return { success: true, offlineQueued: true };
    }

    const cloudRes = await pushBoTrackingToCloud(finalRecord);
    if (!cloudRes.success) {
      console.warn('[BoTrackingService] Sincronización nube pendiente, encolando para reintento:', cloudRes.error);
      await enqueueOfflineAction('save_bo_tracking', finalRecord, {
        entityKey: `bo:${finalRecord.id}`,
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('[BoTrackingService] Error al guardar seguimiento:', err);
    return { success: false, error: err?.message || 'Error desconocido al guardar' };
  }
}

/**
 * Avanza o cambia la etapa de una orden registrando la transición y nota como un evento idempotente (Item 12).
 */
export async function updateBoTrackingStage(
  orderId: string,
  newStage: BoStage,
  author: string,
  noteText?: string,
  options?: { eventId?: string; idempotencyKey?: string; createdAt?: string }
): Promise<{ success: boolean; wasDuplicateEvent?: boolean; error?: string }> {
  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = options?.createdAt || new Date().toISOString();
    let wasDuplicateEvent = false;

    if (noteText && noteText.trim()) {
      const evtRes = await appendEntityEventAtomic({
        entityType: 'BO_TRACKING',
        entityId: orderId,
        actionOrStage: newStage,
        author: author || 'Usuario',
        comment: noteText.trim(),
        createdAt: nowIso,
        eventId: options?.eventId,
        idempotencyKey: options?.idempotencyKey,
      });
      if (!evtRes.success) {
        return { success: false, error: evtRes.error || 'Error registrando evento de cambio de etapa' };
      }
      wasDuplicateEvent = evtRes.wasDuplicate;
    }

    const reconciledOrder = reconcileBoOrderNotesWithEventStore(order);
    const updatedOrder: BoOrderTrackingRecord = {
      ...reconciledOrder,
      currentStage: newStage,
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    if (newStage === 'DELIVERED' && !updatedOrder.actualDeliveryDate) {
      updatedOrder.actualDeliveryDate = nowIso.slice(0, 10);
    }

    const saveRes = await saveBoTracking(updatedOrder);
    return { ...saveRes, wasDuplicateEvent };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar etapa' };
  }
}

/**
 * Actualiza los datos de Courier y Tracking registrando un evento idempotente en la bitácora (Item 12).
 */
export async function updateBoTrackingCourier(
  orderId: string,
  courier: CourierProvider,
  trackingNumber: string,
  author: string,
  options?: { eventId?: string; idempotencyKey?: string; createdAt?: string }
): Promise<{ success: boolean; wasDuplicateEvent?: boolean; error?: string }> {
  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = options?.createdAt || new Date().toISOString();
    let wasDuplicateEvent = false;

    if (trackingNumber.trim() && trackingNumber !== order.courierTrackingNumber) {
      const evtRes = await appendEntityEventAtomic({
        entityType: 'BO_TRACKING',
        entityId: orderId,
        actionOrStage: order.currentStage,
        author: author || 'Usuario',
        comment: `Guía ${courier} registrada / actualizada: ${trackingNumber.trim()}`,
        createdAt: nowIso,
        eventId: options?.eventId,
        idempotencyKey: options?.idempotencyKey,
      });
      if (!evtRes.success) {
        return { success: false, error: evtRes.error || 'Error registrando evento de guía courier' };
      }
      wasDuplicateEvent = evtRes.wasDuplicate;
    }

    const reconciledOrder = reconcileBoOrderNotesWithEventStore(order);
    const updatedOrder: BoOrderTrackingRecord = {
      ...reconciledOrder,
      courier,
      courierTrackingNumber: trackingNumber.trim(),
      courierTrackingUrl: getCourierTrackingUrl(courier, trackingNumber.trim()),
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    const saveRes = await saveBoTracking(updatedOrder);
    return { ...saveRes, wasDuplicateEvent };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar tracking' };
  }
}

/**
 * Agrega un comentario o nota de seguimiento diario como evento idempotente (Item 12).
 * Si se reintenta la misma nota o dos usuarios agregan notas concurrentemente, ninguna nota se pierde ni se duplica.
 */
export async function addBoDailyNote(
  orderId: string,
  author: string,
  comment: string,
  options?: { eventId?: string; idempotencyKey?: string; createdAt?: string }
): Promise<{ success: boolean; wasDuplicateEvent?: boolean; error?: string }> {
  if (!comment || !comment.trim()) {
    return { success: false, error: 'El comentario no puede estar vacío' };
  }

  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = options?.createdAt || new Date().toISOString();
    const evtRes = await appendEntityEventAtomic({
      entityType: 'BO_TRACKING',
      entityId: orderId,
      actionOrStage: order.currentStage,
      author: author || 'Usuario',
      comment: comment.trim(),
      createdAt: nowIso,
      eventId: options?.eventId,
      idempotencyKey: options?.idempotencyKey,
    });

    if (!evtRes.success) {
      return { success: false, error: evtRes.error || 'Error registrando evento de nota BO' };
    }

    const reconciledOrder = reconcileBoOrderNotesWithEventStore(order);
    const updatedOrder: BoOrderTrackingRecord = {
      ...reconciledOrder,
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    const saveRes = await saveBoTracking(updatedOrder);
    return { ...saveRes, wasDuplicateEvent: evtRes.wasDuplicate };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al agregar nota' };
  }
}

/**
 * Elimina o archiva un registro de seguimiento con registro de tombstone, soporte offline y limpieza en IndexedDB.
 */
export async function deleteBoTracking(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Registrar en lista negra de tumbstones para evitar resurrección
    addDeletedBoTrackingId(orderId);
    await deleteCollectionRecord('bo_trackings', orderId);

    // 2. Eliminar de caché local redundante
    const current = getLocalBoTrackingCache();
    const nextList = current.filter((r) => r.id !== orderId);
    saveLocalBoTrackingCache(nextList);

    // 3. Eliminar de Cloud Firestore (o encolar si estamos offline)
    if (isAppOffline()) {
      await enqueueOfflineAction('delete_bo_tracking', { id: orderId }, {
        entityKey: `bo:${orderId}`,
      });
      return { success: true };
    }

    const cloudRes = await pushBoTrackingDeleteToCloud(orderId);
    if (!cloudRes.success) {
      console.warn('[BoTrackingService] Eliminación en nube pendiente, encolando para reintento:', cloudRes.error);
      await enqueueOfflineAction('delete_bo_tracking', { id: orderId }, {
        entityKey: `bo:${orderId}`,
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar seguimiento' };
  }
}

/**
 * Genera un nuevo registro de seguimiento pre-llenado a partir del Estimate actual
 */
export function createBoTrackingRecordFromEstimate(
  estimate: ProcessedEstimateResult,
  clientPoNumber: string,
  ciscoSoNumber?: string,
  detectedPartner?: string,
  author: string = 'Usuario'
): BoOrderTrackingRecord {
  const header = estimate.headerInfo || ({} as any);
  const partner = detectedPartner || header.customerName || 'Partner Intcomex';
  const client = header.companyName || header.endUser || 'Cliente Final';
  const estimateId = header.estimateId || header.quoteName || 'OE-SIN-ID';
  const dealId = header.dealId || 'DEAL-N/A';
  const versionTag = estimate.versionTag || 'v1';

  const cleanPo = (clientPoNumber || 'OC-PENDIENTE').trim();
  const cleanSo = (ciscoSoNumber || '').trim() || undefined;
  const trackingId = `BO-${cleanPo.replace(/[^A-Za-z0-9_-]/g, '')}-${estimateId}`;

  const validItems = (estimate.items || []).filter((it) => !it.isInfoRow && it.qty > 0);
  const totalSale = estimate.calculatedProductTotal || estimate.finalTotalPrice || 0;
  const netCisco = estimate.originalProductTotal || 0;
  const grossProfit = Math.max(0, totalSale - netCisco);

  const hasHardware = validItems.some((it) => !it.isIntangible);
  const bodegaDestino = hasHardware ? 'E1' : 'ED';

  const nowIso = new Date().toISOString();

  return {
    id: trackingId,
    estimateId,
    estimateVersionTag: versionTag,
    dealId,
    partnerName: partner,
    endCustomerName: client,
    clientPoNumber: cleanPo,
    ciscoSoNumber: cleanSo,
    clientPoAddedAt: isRealPoNumber(cleanPo) ? nowIso : undefined,
    ciscoSoAddedAt: isRealSoNumber(cleanSo) ? nowIso : undefined,
    courier: 'FedEx',
    currentStage: 'OC_RECEIVED',
    createdAt: nowIso,
    updatedAt: nowIso,
    lastDailyReviewAt: nowIso,
    totalSaleUsd: totalSale,
    grossProfitUsd: grossProfit,
    marginPct: netCisco > 0 ? Number(((grossProfit / totalSale) * 100).toFixed(1)) : 0,
    itemsCount: validItems.length,
    bodegaDestino,
    notes: [
      {
        id: `note-${Date.now()}`,
        date: nowIso,
        author,
        stage: 'OC_RECEIVED',
        comment: `Seguimiento de orden BO iniciado para Estimate ${estimateId} (${versionTag}) con OC ${cleanPo}.`,
      },
    ],
  };
}

export interface SyncBoOrderFromEstimateParams {
  estimate?: ProcessedEstimateResult | null;
  clientName: string;
  lines: BoLineItem[];
  bodega: 'E1' | 'ED';
  author?: string;
  partnerName?: string;
  actionSource?: 'COPY_HTML' | 'OPEN_OUTLOOK' | 'MODAL_ACTION';
}

/**
 * Registra o actualiza de forma automática e idempotente la transición de un Estimate a BO (Etapa 1: OC_RECEIVED)
 * en la base de datos de seguimiento logístico (Firestore + IndexedDB + LocalStorage).
 */
export async function syncBoOrderFromEstimateModal(
  params: SyncBoOrderFromEstimateParams
): Promise<{ success: boolean; record?: BoOrderTrackingRecord; error?: string }> {
  try {
    const {
      estimate,
      clientName,
      lines,
      bodega,
      author = 'Usuario',
      partnerName,
      actionSource = 'MODAL_ACTION',
    } = params;

    const header = estimate?.headerInfo || ({} as any);
    const resolvedPartner = partnerName || header.customerName || 'Partner Intcomex';
    const resolvedClient = (clientName || header.companyName || header.endUser || 'Cliente Final').trim();
    const estimateId = header.estimateId || header.quoteName || `EST-${Date.now().toString(36).toUpperCase()}`;
    const dealId = header.dealId || '';
    const versionTag = estimate?.versionTag || 'v1';

    const activeLines = lines.filter((l) => (Number(l.qty) || 0) > 0);
    const totalSale = activeLines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);
    const netCisco = estimate?.originalProductTotal || 0;
    const grossProfit = Math.max(0, totalSale - netCisco);
    const marginPct =
      totalSale > 0 && grossProfit > 0 ? Number(((grossProfit / totalSale) * 100).toFixed(1)) : 0;

    const existingRecords = await getBoTrackings();
    // Buscar si ya existe una orden de seguimiento para este Estimate o Deal
    const existingOrder = existingRecords.find(
      (r) =>
        (estimateId && r.estimateId === estimateId) ||
        (dealId && r.dealId && r.dealId === dealId)
    );

    const nowIso = new Date().toISOString();
    const sourceLabel =
      actionSource === 'OPEN_OUTLOOK'
        ? 'Solicitud abierta en Outlook'
        : actionSource === 'COPY_HTML'
        ? 'Tabla HTML copiada para Outlook'
        : 'Confirmación BO en Cotizador';

    const noteComment = `Cotización confirmada por el cliente (${resolvedClient}). BO generado para compras (${sourceLabel}). Bodega: ${bodega}, Total Venta: US$ ${totalSale.toLocaleString(
      'en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )} (${activeLines.length} líneas).`;

    let orderRecord: BoOrderTrackingRecord;

    if (existingOrder) {
      // Reconciliar con bitácora existente sin perder notas
      const reconciled = reconcileBoOrderNotesWithEventStore(existingOrder);
      orderRecord = {
        ...reconciled,
        partnerName: resolvedPartner,
        endCustomerName: resolvedClient,
        estimateVersionTag: versionTag,
        totalSaleUsd: totalSale > 0 ? totalSale : reconciled.totalSaleUsd,
        grossProfitUsd: grossProfit > 0 ? grossProfit : reconciled.grossProfitUsd,
        marginPct: marginPct > 0 ? marginPct : reconciled.marginPct,
        itemsCount: activeLines.length > 0 ? activeLines.length : reconciled.itemsCount,
        bodegaDestino: bodega,
        updatedAt: nowIso,
        lastDailyReviewAt: nowIso,
        notes: [
          ...(reconciled.notes || []),
          {
            id: `note-${Date.now()}`,
            date: nowIso,
            author,
            stage: reconciled.currentStage || 'OC_RECEIVED',
            comment: noteComment,
          },
        ],
      };
    } else {
      const cleanEstimate = estimateId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);
      const trackingId = `BO-${cleanEstimate}-${Date.now().toString(36).toUpperCase()}`;

      orderRecord = {
        id: trackingId,
        estimateId,
        estimateVersionTag: versionTag,
        dealId: dealId || 'DEAL-N/A',
        partnerName: resolvedPartner,
        endCustomerName: resolvedClient,
        clientPoNumber: 'OC-PENDIENTE', // Requerido por reglas de seguridad Firestore
        courier: 'FedEx',
        currentStage: 'OC_RECEIVED',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastDailyReviewAt: nowIso,
        totalSaleUsd: totalSale,
        grossProfitUsd: grossProfit,
        marginPct,
        itemsCount: activeLines.length,
        bodegaDestino: bodega,
        notes: [
          {
            id: `note-${Date.now()}`,
            date: nowIso,
            author,
            stage: 'OC_RECEIVED',
            comment: noteComment,
          },
        ],
      };
    }

    const saveResult = await saveBoTracking(orderRecord);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    return { success: true, record: orderRecord };
  } catch (err: any) {
    console.error('[BoTrackingService] Error en syncBoOrderFromEstimateModal:', err);
    return { success: false, error: err?.message || 'Error al sincronizar orden BO' };
  }
}

export interface SyncBoOrderFromDsvParams {
  dealId?: string;
  soNumber?: string;
  poNumber?: string;
  partnerName?: string;
  endCustomerName?: string;
  totalSaleUsd?: number;
  itemsCount?: number;
  bodegaDestino?: 'E1' | 'ED';
  dsvRows?: DsvBodegaRowInput[];
  author?: string;
  notesComment?: string;
}

/**
 * Sincroniza una orden procesada o exportada en el módulo DSV con la base de datos de seguimiento
 * de Back Orders (bo_order_tracking), vinculando SO Cisco y PO Cliente, determinando correctamente
 * si requiere bodega física E1 (hardware) o digital ED (sólo licencias/servicios).
 */
export async function syncBoOrderFromDsvRecord(
  params: SyncBoOrderFromDsvParams
): Promise<{ success: boolean; record?: BoOrderTrackingRecord; error?: string }> {
  try {
    const {
      dealId = '',
      soNumber = '',
      poNumber = '',
      partnerName = 'Intcomex Partner',
      endCustomerName = 'Cliente Final',
      totalSaleUsd = 0,
      itemsCount = 0,
      bodegaDestino,
      dsvRows,
      author = 'Usuario Intcomex',
      notesComment,
    } = params;

    const cleanSo = (soNumber || '').trim();
    const cleanPo = (poNumber || '').trim() || 'OC-DSV';
    const cleanDeal = (dealId || '').trim();

    if (!cleanSo && !cleanDeal && !cleanPo) {
      return { success: false, error: 'Se requiere al menos Deal ID, SO o PO para sincronizar el DSV' };
    }

    const existingRecords = await getBoTrackings();
    const existingOrder = existingRecords.find(
      (r) =>
        (cleanDeal && r.dealId && r.dealId === cleanDeal) ||
        (cleanDeal && r.estimateId && r.estimateId === cleanDeal) ||
        (cleanSo && r.ciscoSoNumber && r.ciscoSoNumber === cleanSo) ||
        (cleanPo && cleanPo !== 'OC-DSV' && cleanPo !== 'PO-PENDING' && r.clientPoNumber === cleanPo)
    );

    const resolvedDsvBodega =
      bodegaDestino ||
      detectBodegaFromDsvRows(dsvRows) ||
      findBodegaFromLocalDsvOrEstimateCaches(cleanDeal, cleanSo, cleanDeal, cleanPo);

    const nowIso = new Date().toISOString();
    const comment =
      notesComment ||
      `Orden confirmada en Cisco CCW (DSV). SO Cisco: ${cleanSo || 'Pendiente'}, PO Cliente: ${cleanPo || 'Pendiente'}.`;

    let orderRecord: BoOrderTrackingRecord;

    if (existingOrder) {
      const reconciled = reconcileBoOrderNotesWithEventStore(existingOrder);
      // Avanzar automáticamente a CISCO_SO_BOOKED si la orden aún estaba en OC_RECEIVED
      const nextStage: BoStage =
        reconciled.currentStage === 'OC_RECEIVED' ? 'CISCO_SO_BOOKED' : reconciled.currentStage;
      const mergedBodega: 'E1' | 'ED' =
        resolvedDsvBodega === 'E1' || reconciled.bodegaDestino === 'E1'
          ? 'E1'
          : resolvedDsvBodega || reconciled.bodegaDestino || 'ED';

      orderRecord = {
        ...reconciled,
        ciscoSoNumber: cleanSo || reconciled.ciscoSoNumber,
        clientPoNumber: cleanPo && cleanPo !== 'PO-PENDING' ? cleanPo : reconciled.clientPoNumber,
        currentStage: nextStage,
        bodegaDestino: mergedBodega,
        partnerName: partnerName || reconciled.partnerName,
        endCustomerName: endCustomerName || reconciled.endCustomerName,
        totalSaleUsd: totalSaleUsd > 0 ? totalSaleUsd : reconciled.totalSaleUsd,
        itemsCount: itemsCount > 0 ? itemsCount : reconciled.itemsCount,
        updatedAt: nowIso,
        lastDailyReviewAt: nowIso,
        notes: [
          ...(reconciled.notes || []),
          {
            id: `note-${Date.now()}`,
            date: nowIso,
            author,
            stage: nextStage,
            comment,
          },
        ],
      };
    } else {
      // Crear nueva orden de seguimiento en etapa CISCO_SO_BOOKED
      const idSeed = (cleanSo || cleanDeal || 'DSV').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);
      const trackingId = `BO-DSV-${idSeed}-${Date.now().toString(36).toUpperCase()}`;

      orderRecord = {
        id: trackingId,
        estimateId: cleanDeal || cleanSo || 'DSV-ORDEN',
        estimateVersionTag: 'DSV',
        dealId: cleanDeal || 'DEAL-N/A',
        partnerName,
        endCustomerName,
        clientPoNumber: cleanPo,
        ciscoSoNumber: cleanSo || undefined,
        clientPoAddedAt: isRealPoNumber(cleanPo) ? nowIso : undefined,
        ciscoSoAddedAt: isRealSoNumber(cleanSo) ? nowIso : undefined,
        courier: 'FedEx',
        currentStage: 'CISCO_SO_BOOKED',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastDailyReviewAt: nowIso,
        totalSaleUsd,
        grossProfitUsd: 0,
        itemsCount,
        bodegaDestino: resolvedDsvBodega || 'ED',
        notes: [
          {
            id: `note-${Date.now()}`,
            date: nowIso,
            author,
            stage: 'CISCO_SO_BOOKED',
            comment,
          },
        ],
      };
    }

    const saveResult = await saveBoTracking(orderRecord);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    return { success: true, record: orderRecord };
  } catch (err: any) {
    console.error('[BoTrackingService] Error en syncBoOrderFromDsvRecord:', err);
    return { success: false, error: err?.message || 'Error al sincronizar DSV en tracking' };
  }
}

