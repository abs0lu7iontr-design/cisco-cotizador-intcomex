// ============================================================================
// CISCO AUTOMATED v2.1 - BO ORDER TRACKING SERVICE (FIRESTORE + OFFLINE CACHE)
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
import { getFirestoreInstance } from '../cloud/firebaseConfig';
import {
  BoOrderTrackingRecord,
  BoStage,
  CourierProvider,
  getCourierTrackingUrl,
  BoDailyNote,
} from './boTrackingTypes';
import { ProcessedEstimateResult } from '../../core/types';
import { sanitizeForFirestore } from '../cloud/firestoreService';

const BO_TRACKING_COLLECTION = 'bo_order_tracking';
const LOCAL_BO_TRACKING_PRIMARY_KEY = 'cisco_bo_order_tracking_cache_v2';
const LOCAL_BO_TRACKING_VAULT_KEY = 'cisco_bo_order_tracking_vault_v1';
const LOCAL_BO_TRACKING_LEGACY_KEY = 'cisco_bo_order_tracking_cache_v1';
const LOCAL_BO_TRACKING_DELETED_KEY = 'cisco_bo_order_tracking_deleted_ids_v1';
const LOCAL_BO_TRACKING_INIT_KEY = 'cisco_bo_tracking_initialized_flag_v1';

// ----------------------------------------------------------------------------
// Local Storage Multi-Tier Vault & Tombstone Helpers (Blindaje Anti-Pérdida)
// ----------------------------------------------------------------------------
let inMemoryTrackingCache: BoOrderTrackingRecord[] = [];

export function getDeletedBoTrackingIds(): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_BO_TRACKING_DELETED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    }
  } catch (_) {}
  return new Set();
}

export function addDeletedBoTrackingId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const deleted = getDeletedBoTrackingIds();
      deleted.add(id);
      localStorage.setItem(LOCAL_BO_TRACKING_DELETED_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch (_) {}
}

export function getLocalBoTrackingCache(): BoOrderTrackingRecord[] {
  const deletedIds = getDeletedBoTrackingIds();
  const map = new Map<string, BoOrderTrackingRecord>();

  const keysToRead = [
    LOCAL_BO_TRACKING_LEGACY_KEY,
    LOCAL_BO_TRACKING_VAULT_KEY,
    LOCAL_BO_TRACKING_PRIMARY_KEY,
  ];

  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of keysToRead) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !deletedIds.has(item.id)) {
                const existing = map.get(item.id);
                if (!existing) {
                  map.set(item.id, item);
                } else {
                  const existingTs = existing.updatedAt || existing.createdAt || '';
                  const itemTs = item.updatedAt || item.createdAt || '';
                  if (itemTs >= existingTs) {
                    map.set(item.id, item);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // Si hay datos en memoria que no están en localStorage, incluirlos
  for (const mem of inMemoryTrackingCache) {
    if (mem && mem.id && !deletedIds.has(mem.id) && !map.has(mem.id)) {
      map.set(mem.id, mem);
    }
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return result.length > 0 ? result : inMemoryTrackingCache;
}

export function saveLocalBoTrackingCache(records: BoOrderTrackingRecord[]): void {
  const deletedIds = getDeletedBoTrackingIds();
  const cleanRecords = records.filter((r) => r && r.id && !deletedIds.has(r.id));
  inMemoryTrackingCache = [...cleanRecords];

  try {
    if (typeof localStorage !== 'undefined') {
      const json = JSON.stringify(cleanRecords);
      localStorage.setItem(LOCAL_BO_TRACKING_PRIMARY_KEY, json);
      localStorage.setItem(LOCAL_BO_TRACKING_VAULT_KEY, json);
      localStorage.setItem(LOCAL_BO_TRACKING_LEGACY_KEY, json);
      localStorage.setItem(LOCAL_BO_TRACKING_INIT_KEY, 'true');
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
 * Obtiene todas las órdenes de seguimiento BO con fusión bidireccional inteligente
 * (Garantiza que ningún registro local se pierda y sincroniza con Cloud Firestore)
 */
export async function getBoTrackings(): Promise<BoOrderTrackingRecord[]> {
  const localRecords = getLocalBoTrackingCache();
  const deletedIds = getDeletedBoTrackingIds();

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const q = query(
        collection(db, BO_TRACKING_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      const cloudRecords: BoOrderTrackingRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BoOrderTrackingRecord;
        if (data && data.id && !deletedIds.has(data.id)) {
          cloudRecords.push(data);
        } else if (data && data.id && deletedIds.has(data.id)) {
          // Si el registro fue eliminado por el usuario, purgarlo de Firestore en segundo plano
          deleteDoc(doc(db, BO_TRACKING_COLLECTION, data.id)).catch(() => {});
        }
      });

      // SMART BIDIRECTIONAL MERGE:
      // Combinamos nube con caché local para que NINGÚN ingreso reciente se pierda
      const mergedMap = new Map<string, BoOrderTrackingRecord>();

      // 1. Incorporar registros de Firestore
      for (const cr of cloudRecords) {
        mergedMap.set(cr.id, cr);
      }

      // 2. Fusionar con registros locales (preservando ingresos recientes no sincronizados)
      const pendingSyncToCloud: BoOrderTrackingRecord[] = [];
      for (const lr of localRecords) {
        if (deletedIds.has(lr.id)) continue;

        const existingCloud = mergedMap.get(lr.id);
        if (!existingCloud) {
          // El registro existe localmente pero aún no en Firestore -> PRESERVAR y auto-sincronizar
          mergedMap.set(lr.id, lr);
          pendingSyncToCloud.push(lr);
        } else {
          // Si la versión local ya fue entregada/completada (DELIVERED) y la nube no, gana DELIVERED
          if (lr.currentStage === 'DELIVERED' && existingCloud.currentStage !== 'DELIVERED') {
            mergedMap.set(lr.id, lr);
            pendingSyncToCloud.push(lr);
          } else {
            const localTs = lr.updatedAt || lr.createdAt || '';
            const cloudTs = existingCloud.updatedAt || existingCloud.createdAt || '';
            if (localTs >= cloudTs) {
              mergedMap.set(lr.id, lr);
              if (localTs > cloudTs) {
                pendingSyncToCloud.push(lr);
              }
            }
          }
        }
      }

      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // Auto-reparación / Auto-sincronización con la nube para registros locales faltantes
      if (pendingSyncToCloud.length > 0) {
        for (const item of pendingSyncToCloud) {
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
        saveLocalBoTrackingCache(mergedList);
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[BoTrackingService] Firestore no disponible o sin conexión. Usando caché local blindada:', err);
  }

  // Fallback: leer de caché local blindada
  if (localRecords.length > 0) {
    return localRecords;
  }

  // Inicializar con semillas SOLO si es primera ejecución absoluta y no hay flag de inicio
  const isInitialized = typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_BO_TRACKING_INIT_KEY);
  if (!isInitialized && localRecords.length === 0) {
    saveLocalBoTrackingCache(SEED_BO_ORDERS);
    return SEED_BO_ORDERS;
  }

  return [];
}

/**
 * Guarda o actualiza un registro completo de seguimiento BO con sanitización estricta
 */
export async function saveBoTracking(
  record: BoOrderTrackingRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedRecord: BoOrderTrackingRecord = {
      ...record,
      courierTrackingUrl: getCourierTrackingUrl(record.courier, record.courierTrackingNumber),
      updatedAt: new Date().toISOString(),
    };

    // Actualizar caché local inmediatamente en todos los almacenes redundantes
    const current = getLocalBoTrackingCache();
    const existingIdx = current.findIndex((r) => r.id === normalizedRecord.id);
    let nextList: BoOrderTrackingRecord[];
    if (existingIdx >= 0) {
      nextList = [...current];
      nextList[existingIdx] = normalizedRecord;
    } else {
      nextList = [normalizedRecord, ...current];
    }
    saveLocalBoTrackingCache(nextList);

    // Persistir en Firestore sanitizando campos undefined (elimina error "Unsupported field value: undefined")
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, BO_TRACKING_COLLECTION, normalizedRecord.id);
        const sanitized = sanitizeForFirestore(normalizedRecord);
        await setDoc(docRef, sanitized, { merge: true });
      }
    } catch (errCloud) {
      console.warn('[BoTrackingService] Sincronización nube pendiente, guardado localmente en vault:', errCloud);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[BoTrackingService] Error al guardar seguimiento:', err);
    return { success: false, error: err?.message || 'Error desconocido al guardar' };
  }
}

/**
 * Avanza o cambia la etapa de una orden agregando una nota automática a la bitácora
 */
export async function updateBoTrackingStage(
  orderId: string,
  newStage: BoStage,
  author: string,
  noteText?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = new Date().toISOString();
    const updatedNotes: BoDailyNote[] = [...(order.notes || [])];

    if (noteText && noteText.trim()) {
      updatedNotes.push({
        id: `note-${Date.now()}`,
        date: nowIso,
        author: author || 'Usuario',
        stage: newStage,
        comment: noteText.trim(),
      });
    }

    const updatedOrder: BoOrderTrackingRecord = {
      ...order,
      currentStage: newStage,
      notes: updatedNotes,
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    if (newStage === 'DELIVERED' && !updatedOrder.actualDeliveryDate) {
      updatedOrder.actualDeliveryDate = nowIso.slice(0, 10);
    }

    return await saveBoTracking(updatedOrder);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar etapa' };
  }
}

/**
 * Actualiza los datos de Courier y Tracking (ej. FedEx)
 */
export async function updateBoTrackingCourier(
  orderId: string,
  courier: CourierProvider,
  trackingNumber: string,
  author: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = new Date().toISOString();
    const updatedNotes: BoDailyNote[] = [...(order.notes || [])];

    if (trackingNumber.trim() && trackingNumber !== order.courierTrackingNumber) {
      updatedNotes.push({
        id: `note-${Date.now()}`,
        date: nowIso,
        author: author || 'Usuario',
        stage: order.currentStage,
        comment: `Guía ${courier} registrada / actualizada: ${trackingNumber.trim()}`,
      });
    }

    const updatedOrder: BoOrderTrackingRecord = {
      ...order,
      courier,
      courierTrackingNumber: trackingNumber.trim(),
      courierTrackingUrl: getCourierTrackingUrl(courier, trackingNumber.trim()),
      notes: updatedNotes,
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    return await saveBoTracking(updatedOrder);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar tracking' };
  }
}

/**
 * Agrega un comentario o nota de seguimiento diario
 */
export async function addBoDailyNote(
  orderId: string,
  author: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  if (!comment || !comment.trim()) {
    return { success: false, error: 'El comentario no puede estar vacío' };
  }

  try {
    const records = await getBoTrackings();
    const order = records.find((r) => r.id === orderId);
    if (!order) {
      return { success: false, error: `Orden ${orderId} no encontrada` };
    }

    const nowIso = new Date().toISOString();
    const newNote: BoDailyNote = {
      id: `note-${Date.now()}`,
      date: nowIso,
      author: author || 'Usuario',
      stage: order.currentStage,
      comment: comment.trim(),
    };

    const updatedOrder: BoOrderTrackingRecord = {
      ...order,
      notes: [...(order.notes || []), newNote],
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
    };

    return await saveBoTracking(updatedOrder);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al agregar nota' };
  }
}

/**
 * Elimina o archiva un registro de seguimiento con registro de tombstone
 */
export async function deleteBoTracking(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Registrar en lista negra de tumbstones para evitar resurrección
    addDeletedBoTrackingId(orderId);

    // 2. Eliminar de caché local redundante
    const current = getLocalBoTrackingCache();
    const nextList = current.filter((r) => r.id !== orderId);
    saveLocalBoTrackingCache(nextList);

    // 3. Eliminar de Cloud Firestore
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, BO_TRACKING_COLLECTION, orderId);
        await deleteDoc(docRef);
      }
    } catch (errCloud) {
      console.warn('[BoTrackingService] Eliminación en nube pendiente, eliminado localmente:', errCloud);
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
    ciscoSoNumber: (ciscoSoNumber || '').trim() || undefined,
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
