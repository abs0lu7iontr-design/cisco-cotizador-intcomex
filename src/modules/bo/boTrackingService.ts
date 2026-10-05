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

const BO_TRACKING_COLLECTION = 'bo_order_tracking';
const LOCAL_BO_TRACKING_CACHE_KEY = 'cisco_bo_order_tracking_cache_v1';

// ----------------------------------------------------------------------------
// Local Storage Cache Helpers (0ms Instant Load + Offline Failsafe)
// ----------------------------------------------------------------------------
let inMemoryTrackingCache: BoOrderTrackingRecord[] = [];

export function getLocalBoTrackingCache(): BoOrderTrackingRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_BO_TRACKING_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    // ignore
  }
  return inMemoryTrackingCache;
}

export function saveLocalBoTrackingCache(records: BoOrderTrackingRecord[]): void {
  inMemoryTrackingCache = [...records];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_BO_TRACKING_CACHE_KEY, JSON.stringify(records));
    }
  } catch (err) {
    // ignore
  }
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
 * Obtiene todas las órdenes de seguimiento BO (desde Firestore o caché local)
 */
export async function getBoTrackings(): Promise<BoOrderTrackingRecord[]> {
  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const q = query(
        collection(db, BO_TRACKING_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const records: BoOrderTrackingRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as BoOrderTrackingRecord);
        });
        saveLocalBoTrackingCache(records);
        return records;
      }
    }
  } catch (err) {
    console.warn('[BoTrackingService] Firestore no disponible o sin conexión. Usando caché local:', err);
  }

  // Fallback: leer de caché local
  const cached = getLocalBoTrackingCache();
  if (cached.length > 0) {
    return cached;
  }

  // Si no hay nada, inicializar con las semillas predeterminadas
  saveLocalBoTrackingCache(SEED_BO_ORDERS);
  return SEED_BO_ORDERS;
}

/**
 * Guarda o actualiza un registro completo de seguimiento BO
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

    // Actualizar caché local inmediatamente
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

    // Persistir en Firestore si está conectado
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, BO_TRACKING_COLLECTION, normalizedRecord.id);
        await setDoc(docRef, normalizedRecord, { merge: true });
      }
    } catch (errCloud) {
      console.warn('[BoTrackingService] Sincronización nube pendiente, guardado localmente:', errCloud);
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
 * Elimina o archiva un registro de seguimiento
 */
export async function deleteBoTracking(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const current = getLocalBoTrackingCache();
    const nextList = current.filter((r) => r.id !== orderId);
    saveLocalBoTrackingCache(nextList);

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
