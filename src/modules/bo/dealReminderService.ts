// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL REMINDER SERVICE (FIRESTORE + OFFLINE CACHE)
// Gestión y persistencia de recordatorios de DEALS escalados a AM Cisco y Velocity Hub
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
  DealReminderRecord,
  DealEscalationChannel,
  DealReminderStatus,
  DealHistoryNote,
} from './dealReminderTypes';
import { ProcessedEstimateResult } from '../../core/types';

export const DEAL_REMINDERS_COLLECTION = 'deal_reminders';
const LOCAL_DEAL_REMINDERS_CACHE_KEY = 'cisco_deal_reminders_cache_v1';

// ----------------------------------------------------------------------------
// Caché Local en Memoria + LocalStorage (Carga Instantánea en 0ms y Modo Offline)
// ----------------------------------------------------------------------------
let inMemoryDealRemindersCache: DealReminderRecord[] = [];

export function getLocalDealRemindersCache(): DealReminderRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_DEAL_REMINDERS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    // ignorar error de parseo
  }
  return inMemoryDealRemindersCache;
}

export function saveLocalDealRemindersCache(records: DealReminderRecord[]): void {
  inMemoryDealRemindersCache = [...records];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_DEAL_REMINDERS_CACHE_KEY, JSON.stringify(records));
    }
  } catch (err) {
    // ignorar error de almacenamiento local
  }
}

// ----------------------------------------------------------------------------
// Semillas de Demostración Iniciales (Deals Reales Cisco Intcomex Chile)
// ----------------------------------------------------------------------------
const SEED_DEAL_REMINDERS: DealReminderRecord[] = [
  {
    id: 'DEAL-REM-9912048',
    dealId: 'DEAL-9912048',
    partnerName: 'Sonda Chile',
    endCustomerName: 'Banco de Chile',
    escalationChannel: 'AM_CISCO',
    amContactName: 'Rodrigo Alarcón',
    amContactEmail: 'ralarcon@cisco.com',
    targetDiscountPct: 68.5,
    estimatedTotalUsd: 142500.0,
    estimateId: 'OE169047114NP',
    notes: 'Solicitud de DART especial para renovación de core Nexus 9300. Deal competido con Arista.',
    status: 'PENDING_APPROVAL',
    escalatedAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(), // Hace 32 horas (Requiere seguimiento)
    lastReminderSentAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    reminderCount: 1,
    createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    createdBy: 'pm_cisco',
    history: [
      {
        id: 'hist-1',
        date: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'CREATED',
        comment: 'Deal escalado a AM Cisco Rodrigo Alarcón solicitando 68.5% de descuento.',
      },
      {
        id: 'hist-2',
        date: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'REMINDER_COPIED',
        comment: 'Recordatorio enviado por correo Outlook a AM.',
      },
    ],
  },
  {
    id: 'DEAL-REM-8841029',
    dealId: 'DEAL-8841029',
    partnerName: 'Telefónica Tech SpA',
    endCustomerName: 'Falabella Retail',
    escalationChannel: 'VELOCITY_HUB',
    vfTicketNumber: 'VF-782910',
    targetDiscountPct: 64.0,
    estimatedTotalUsd: 78900.0,
    estimateId: 'UE169044537CM',
    notes: 'Escalamiento express por Fast Track Switches Catalyst 9200L y APs Wi-Fi 6 Catalyst 9100.',
    status: 'PENDING_APPROVAL',
    escalatedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(), // Hace 14 horas (Al día)
    reminderCount: 0,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    createdBy: 'preventa_cisco',
    history: [
      {
        id: 'hist-3',
        date: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        author: 'preventa_cisco',
        action: 'CREATED',
        comment: 'Ingresado caso en Cisco Velocity Hub con ticket VF-782910.',
      },
    ],
  },
  {
    id: 'DEAL-REM-7731940',
    dealId: 'DEAL-7731940',
    partnerName: 'Adexus',
    endCustomerName: 'Codelco Chile - División El Teniente',
    escalationChannel: 'AM_CISCO',
    amContactName: 'Carolina Morales',
    amContactEmail: 'cmorales@cisco.com',
    targetDiscountPct: 71.0,
    estimatedTotalUsd: 215400.0,
    notes: 'Licitación pública de Switches Industriales Rugged IE-3300 y Routers Catalyst IR1101.',
    status: 'PENDING_APPROVAL',
    escalatedAt: new Date(Date.now() - 76 * 3600 * 1000).toISOString(), // Hace 76 horas (Demorado > 48h)
    lastReminderSentAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    reminderCount: 2,
    createdAt: new Date(Date.now() - 76 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    createdBy: 'pm_cisco',
    history: [
      {
        id: 'hist-4',
        date: new Date(Date.now() - 76 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'CREATED',
        comment: 'Escalamiento inicial a AM Carolina Morales para licitación Codelco.',
      },
      {
        id: 'hist-5',
        date: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'REMINDER_COPIED',
        comment: 'Primer recordatorio enviado a AM.',
      },
      {
        id: 'hist-6',
        date: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'REMINDER_COPIED',
        comment: 'Segundo recordatorio enviado a AM y copia a líder de ventas.',
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// Operaciones CRUD de Recordatorios de Deals
// ----------------------------------------------------------------------------

/**
 * Obtiene todos los recordatorios de Deals (Cloud Firestore + Caché Local Instantáneo)
 */
export async function getDealReminders(): Promise<DealReminderRecord[]> {
  const localCache = getLocalDealRemindersCache();

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const q = query(collection(db, DEAL_REMINDERS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const records: DealReminderRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as DealReminderRecord);
        });
        saveLocalDealRemindersCache(records);
        return records;
      }
    }
  } catch (err) {
    console.warn('[DealReminderService] Modo offline o Firestore no disponible. Usando caché local.', err);
  }

  // Si no hay datos en caché ni en la nube, inicializar con las semillas
  if (localCache.length === 0) {
    saveLocalDealRemindersCache(SEED_DEAL_REMINDERS);
    return SEED_DEAL_REMINDERS;
  }

  return localCache;
}

/**
 * Guarda o actualiza un recordatorio de Deal
 */
export async function saveDealReminder(deal: DealReminderRecord): Promise<void> {
  // 1. Actualizar caché local de inmediato
  const current = getLocalDealRemindersCache();
  const existingIndex = current.findIndex((d) => d.id === deal.id);
  let updatedList: DealReminderRecord[];

  if (existingIndex >= 0) {
    updatedList = [...current];
    updatedList[existingIndex] = { ...deal, updatedAt: new Date().toISOString() };
  } else {
    updatedList = [{ ...deal, updatedAt: new Date().toISOString() }, ...current];
  }

  saveLocalDealRemindersCache(updatedList);

  // 2. Sincronizar en Cloud Firestore
  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, DEAL_REMINDERS_COLLECTION, deal.id);
      await setDoc(docRef, deal, { merge: true });
    }
  } catch (err) {
    console.warn('[DealReminderService] Error sincronizando con Firestore (guardado en caché local):', err);
  }
}

/**
 * Actualiza el estado de un Deal (Aprobado, Rechazado, Requiere Info, etc.) y añade una nota a la bitácora
 */
export async function updateDealReminderStatus(
  dealId: string,
  newStatus: DealReminderStatus,
  author: string,
  comment?: string
): Promise<void> {
  const allDeals = getLocalDealRemindersCache();
  const deal = allDeals.find((d) => d.id === dealId);
  if (!deal) return;

  const nowIso = new Date().toISOString();
  const newNote: DealHistoryNote = {
    id: `hist-${Date.now()}`,
    date: nowIso,
    author: author || 'Usuario',
    action: 'STATUS_CHANGED',
    comment: comment || `Estado actualizado a: ${newStatus}`,
  };

  const updatedDeal: DealReminderRecord = {
    ...deal,
    status: newStatus,
    updatedAt: nowIso,
    history: [newNote, ...(deal.history || [])],
  };

  await saveDealReminder(updatedDeal);
}

/**
 * Registra que se ha generado y copiado un recordatorio de correo
 */
export async function recordDealReminderSent(dealId: string, author: string): Promise<void> {
  const allDeals = getLocalDealRemindersCache();
  const deal = allDeals.find((d) => d.id === dealId);
  if (!deal) return;

  const nowIso = new Date().toISOString();
  const reminderNumber = (deal.reminderCount || 0) + 1;

  const newNote: DealHistoryNote = {
    id: `hist-${Date.now()}`,
    date: nowIso,
    author: author || 'Usuario',
    action: 'REMINDER_COPIED',
    comment: `Recordatorio #${reminderNumber} copiado para envío por correo a ${
      deal.escalationChannel === 'VELOCITY_HUB' ? 'Cisco Velocity Hub' : deal.amContactName || 'AM Cisco'
    }.`,
  };

  const updatedDeal: DealReminderRecord = {
    ...deal,
    reminderCount: reminderNumber,
    lastReminderSentAt: nowIso,
    updatedAt: nowIso,
    history: [newNote, ...(deal.history || [])],
  };

  await saveDealReminder(updatedDeal);
}

/**
 * Agrega una nota de seguimiento personalizada a la bitácora del Deal
 */
export async function addDealHistoryNote(
  dealId: string,
  author: string,
  comment: string
): Promise<void> {
  const allDeals = getLocalDealRemindersCache();
  const deal = allDeals.find((d) => d.id === dealId);
  if (!deal) return;

  const nowIso = new Date().toISOString();
  const newNote: DealHistoryNote = {
    id: `hist-${Date.now()}`,
    date: nowIso,
    author: author || 'Usuario',
    action: 'NOTE_ADDED',
    comment: comment.trim(),
  };

  const updatedDeal: DealReminderRecord = {
    ...deal,
    updatedAt: nowIso,
    history: [newNote, ...(deal.history || [])],
  };

  await saveDealReminder(updatedDeal);
}

/**
 * Elimina un recordatorio de Deal
 */
export async function deleteDealReminder(dealId: string): Promise<void> {
  const current = getLocalDealRemindersCache();
  const updatedList = current.filter((d) => d.id !== dealId);
  saveLocalDealRemindersCache(updatedList);

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, DEAL_REMINDERS_COLLECTION, dealId);
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.warn('[DealReminderService] Error eliminando en Firestore:', err);
  }
}

/**
 * Helper para crear un DealReminderRecord a partir del Estimate actualmente procesado
 */
export function createDealReminderFromEstimate(
  estimate: ProcessedEstimateResult,
  escalationChannel: DealEscalationChannel,
  author: string,
  options?: {
    amContactName?: string;
    amContactEmail?: string;
    vfTicketNumber?: string;
    notes?: string;
    targetDiscountPct?: number;
  }
): DealReminderRecord {
  const header = estimate.headerInfo || ({} as any);
  const cleanDealId = (header.dealId || 'DEAL-MANUAL').trim();
  const partnerName = (header.customerName || 'Partner Intcomex').trim();
  const endCustomerName = (header.companyName || header.endUser || 'Cliente Final').trim();
  const nowIso = new Date().toISOString();
  const id = `DEAL-REM-${cleanDealId.replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now().toString().slice(-4)}`;

  return {
    id,
    dealId: cleanDealId,
    partnerName,
    endCustomerName,
    escalationChannel,
    amContactName: options?.amContactName,
    amContactEmail: options?.amContactEmail,
    vfTicketNumber: options?.vfTicketNumber,
    targetDiscountPct: options?.targetDiscountPct,
    estimatedTotalUsd: estimate.calculatedProductTotal || estimate.originalProductTotal || 0,
    estimateId: header.estimateId || header.quoteName || '',
    notes: options?.notes,
    status: 'PENDING_APPROVAL',
    escalatedAt: nowIso,
    reminderCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: author || 'Usuario',
    history: [
      {
        id: `hist-${Date.now()}`,
        date: nowIso,
        author: author || 'Usuario',
        action: 'CREATED',
        comment: `Recordatorio creado desde el Estimate ${header.estimateId || ''} escalado a ${
          escalationChannel === 'VELOCITY_HUB' ? 'Cisco Velocity Hub' : 'AM Cisco'
        }.`,
      },
    ],
  };
}
