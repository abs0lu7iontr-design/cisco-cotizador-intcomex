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
  checkDealPopupDue,
} from './dealReminderTypes';
import { ProcessedEstimateResult } from '../../core/types';
import { sanitizeForFirestore } from '../cloud/firestoreService';

export const DEAL_REMINDERS_COLLECTION = 'deal_reminders';
const LOCAL_DEAL_REMINDERS_PRIMARY_KEY = 'cisco_deal_reminders_cache_v2';
const LOCAL_DEAL_REMINDERS_VAULT_KEY = 'cisco_deal_reminders_vault_v1';
const LOCAL_DEAL_REMINDERS_LEGACY_KEY = 'cisco_deal_reminders_cache_v1';
const LOCAL_DEAL_REMINDERS_DELETED_KEY = 'cisco_deal_reminders_deleted_ids_v1';
const LOCAL_DEAL_REMINDERS_INIT_KEY = 'cisco_deal_reminders_initialized_flag_v1';

// ----------------------------------------------------------------------------
// Caché Local Multi-Tier Vault + Tombstones (Blindaje Anti-Pérdida de Deals)
// ----------------------------------------------------------------------------
let inMemoryDealRemindersCache: DealReminderRecord[] = [];

export function getDeletedDealReminderIds(): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_DEAL_REMINDERS_DELETED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    }
  } catch (_) {}
  return new Set();
}

export function addDeletedDealReminderId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const deleted = getDeletedDealReminderIds();
      deleted.add(id);
      localStorage.setItem(LOCAL_DEAL_REMINDERS_DELETED_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch (_) {}
}

export function getLocalDealRemindersCache(): DealReminderRecord[] {
  const deletedIds = getDeletedDealReminderIds();
  const map = new Map<string, DealReminderRecord>();

  const keysToRead = [
    LOCAL_DEAL_REMINDERS_LEGACY_KEY,
    LOCAL_DEAL_REMINDERS_VAULT_KEY,
    LOCAL_DEAL_REMINDERS_PRIMARY_KEY,
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
                  // Si el que ya tenemos o el nuevo está aprobado, conservar el aprobado
                  if (item.status === 'APPROVED' && existing.status !== 'APPROVED') {
                    map.set(item.id, item);
                  } else if (existing.status === 'APPROVED' && item.status !== 'APPROVED') {
                    // Mantener el existente aprobado
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
    }
  } catch (_) {}

  // Si hay datos en memoria que no están en localStorage, incluirlos
  for (const mem of inMemoryDealRemindersCache) {
    if (mem && mem.id && !deletedIds.has(mem.id) && !map.has(mem.id)) {
      map.set(mem.id, mem);
    }
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return result.length > 0 ? result : inMemoryDealRemindersCache;
}

export function saveLocalDealRemindersCache(records: DealReminderRecord[]): void {
  const deletedIds = getDeletedDealReminderIds();
  const cleanRecords = records.filter((r) => r && r.id && !deletedIds.has(r.id));
  inMemoryDealRemindersCache = [...cleanRecords];

  try {
    if (typeof localStorage !== 'undefined') {
      const json = JSON.stringify(cleanRecords);
      localStorage.setItem(LOCAL_DEAL_REMINDERS_PRIMARY_KEY, json);
      localStorage.setItem(LOCAL_DEAL_REMINDERS_VAULT_KEY, json);
      localStorage.setItem(LOCAL_DEAL_REMINDERS_LEGACY_KEY, json);
      localStorage.setItem(LOCAL_DEAL_REMINDERS_INIT_KEY, 'true');
    }
  } catch (_) {}
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
    status: 'APPROVED',
    discountsApprovedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    escalatedAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
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
        action: 'STATUS_CHANGED',
        comment: 'Descuentos aprobados formalmente por Cisco.',
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
    status: 'APPROVED',
    discountsApprovedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    escalatedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    reminderCount: 0,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    createdBy: 'preventa_cisco',
    history: [
      {
        id: 'hist-3',
        date: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        author: 'preventa_cisco',
        action: 'CREATED',
        comment: 'Ingresado caso en Cisco Velocity Hub con ticket VF-782910.',
      },
      {
        id: 'hist-3b',
        date: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        author: 'preventa_cisco',
        action: 'STATUS_CHANGED',
        comment: 'Descuentos confirmados en CCW.',
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
    status: 'CONVERTED_TO_BO',
    discountsApprovedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    escalatedAt: new Date(Date.now() - 76 * 3600 * 1000).toISOString(),
    lastReminderSentAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    reminderCount: 2,
    createdAt: new Date(Date.now() - 76 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
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
        date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        author: 'pm_cisco',
        action: 'STATUS_CHANGED',
        comment: 'OC recibida y convertida a seguimiento logístico Back Order (BO).',
      },
    ],
  },
];

// ----------------------------------------------------------------------------
// Operaciones CRUD de Recordatorios de Deals
// ----------------------------------------------------------------------------

/**
 * Obtiene todos los recordatorios de Deals con fusión bidireccional inteligente
 * (Garantiza que ningún Deal ingresado recientemente se pierda y sincroniza con Cloud Firestore)
 */
export async function getDealReminders(): Promise<DealReminderRecord[]> {
  const localRecords = getLocalDealRemindersCache();
  const deletedIds = getDeletedDealReminderIds();

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const q = query(collection(db, DEAL_REMINDERS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const cloudRecords: DealReminderRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as DealReminderRecord;
        if (data && data.id && !deletedIds.has(data.id)) {
          cloudRecords.push(data);
        } else if (data && data.id && deletedIds.has(data.id)) {
          // Si el Deal fue eliminado por el usuario, purgarlo de Firestore en segundo plano
          deleteDoc(doc(db, DEAL_REMINDERS_COLLECTION, data.id)).catch(() => {});
        }
      });

      // SMART BIDIRECTIONAL MERGE:
      // Combinamos nube con caché local para que ningún registro se pierda ni se reviertan estados listos
      const mergedMap = new Map<string, DealReminderRecord>();

      // 1. Incorporar registros de Firestore
      for (const cr of cloudRecords) {
        mergedMap.set(cr.id, cr);
      }

      // 2. Fusionar con registros locales (preservando aprobados y deals recientes no sincronizados)
      const pendingSyncToCloud: DealReminderRecord[] = [];
      for (const lr of localRecords) {
        if (deletedIds.has(lr.id)) continue;

        const existingCloud = mergedMap.get(lr.id);
        if (!existingCloud) {
          // Existe localmente pero no en Firestore -> PRESERVAR y auto-sincronizar
          mergedMap.set(lr.id, lr);
          pendingSyncToCloud.push(lr);
        } else {
          // Si la versión local ya fue aprobada (APPROVED) y la nube sigue pendiente, GANA APPROVED
          if (lr.status === 'APPROVED' && existingCloud.status !== 'APPROVED') {
            mergedMap.set(lr.id, lr);
            pendingSyncToCloud.push(lr);
          } else if (lr.status === 'CONVERTED_TO_BO' && existingCloud.status !== 'CONVERTED_TO_BO') {
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

      // Auto-reparación / Auto-sincronización con la nube para Deals locales pendientes
      if (pendingSyncToCloud.length > 0) {
        for (const item of pendingSyncToCloud) {
          try {
            const docRef = doc(db, DEAL_REMINDERS_COLLECTION, item.id);
            const sanitized = sanitizeForFirestore(item);
            setDoc(docRef, sanitized, { merge: true }).catch((errCloud) => {
              console.warn('[DealReminderService] Auto-sincronización pendiente:', errCloud);
            });
          } catch (_) {}
        }
      }

      if (mergedList.length > 0) {
        saveLocalDealRemindersCache(mergedList);
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[DealReminderService] Modo offline o Firestore no disponible. Usando caché local blindada.', err);
  }

  // Fallback: leer de caché local blindada
  if (localRecords.length > 0) {
    return localRecords;
  }

  // Inicializar con semillas SOLO si es primera ejecución absoluta y no hay flag de inicio
  const isInitialized = typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_DEAL_REMINDERS_INIT_KEY);
  if (!isInitialized && localRecords.length === 0) {
    saveLocalDealRemindersCache(SEED_DEAL_REMINDERS);
    return SEED_DEAL_REMINDERS;
  }

  return [];
}

/**
 * Guarda o actualiza un recordatorio de Deal con sanitización estricta
 */
export async function saveDealReminder(deal: DealReminderRecord): Promise<void> {
  // 1. Actualizar caché local inmediatamente en todos los almacenes redundantes
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

  // 2. Sincronizar en Cloud Firestore con sanitización para evitar errores de undefined
  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, DEAL_REMINDERS_COLLECTION, deal.id);
      const sanitized = sanitizeForFirestore(deal);
      await setDoc(docRef, sanitized, { merge: true });
    }
  } catch (err) {
    console.warn('[DealReminderService] Error sincronizando con Firestore (guardado en caché local blindada):', err);
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
 * Pospone (Snooze) un recordatorio de Deal hasta una fecha/hora específica.
 * Si el usuario presiona "Recordar más tarde" o la "X", se pospone automáticamente.
 */
export async function snoozeDealReminder(
  dealId: string,
  snoozeUntilIso: string,
  author: string,
  reason: string = 'Recordatorio pospuesto'
): Promise<void> {
  const allDeals = getLocalDealRemindersCache();
  const deal = allDeals.find((d) => d.id === dealId);
  if (!deal) return;

  const nowIso = new Date().toISOString();
  const snoozeFormatted = new Date(snoozeUntilIso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const newNote: DealHistoryNote = {
    id: `hist-${Date.now()}`,
    date: nowIso,
    author: author || 'Usuario',
    action: 'NOTE_ADDED',
    comment: `${reason} hasta las ${snoozeFormatted} (${new Date(snoozeUntilIso).toLocaleDateString('es-CL')}).`,
  };

  const updatedDeal: DealReminderRecord = {
    ...deal,
    snoozedUntil: snoozeUntilIso,
    lastPopupDismissedAt: nowIso,
    updatedAt: nowIso,
    history: [newNote, ...(deal.history || [])],
  };

  await saveDealReminder(updatedDeal);
}

/**
 * Marca los descuentos del Deal como formalmente aprobados por Cisco.
 * Esta acción DETIENE definitivamente los pop-ups para este Deal ("parar los pop up").
 */
export async function markDealDiscountsApproved(
  dealId: string,
  author: string,
  note: string = 'Descuentos aprobados por Cisco'
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
    comment: `✅ ${note}. Pop-ups de recordatorio finalizados.`,
  };

  const updatedDeal: DealReminderRecord = {
    ...deal,
    status: 'APPROVED',
    discountsApprovedAt: nowIso,
    snoozedUntil: undefined,
    updatedAt: nowIso,
    history: [newNote, ...(deal.history || [])],
  };

  await saveDealReminder(updatedDeal);
}

/**
 * Retorna todos los Deals que actualmente requieren mostrar un Pop-up en Cisco Automated
 */
export async function getDealsDueForPopup(now: Date = new Date()): Promise<DealReminderRecord[]> {
  const allDeals = await getDealReminders();
  return allDeals.filter((d) => checkDealPopupDue(d, now).isDue);
}

/**
 * Dispara la notificación offline por correo a través del endpoint de Cloudflare Pages
 * Destinatario por defecto: mauricio.skill@intcomex.com
 */
export async function triggerOfflineEmailNotification(
  deal: DealReminderRecord,
  recipientEmail: string = 'mauricio.skill@intcomex.com'
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/deal-reminder-cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: deal.dealId,
        recipientEmail: recipientEmail.trim() || deal.notificationEmail || 'mauricio.skill@intcomex.com',
        partnerName: deal.partnerName,
        endCustomerName: deal.endCustomerName,
        escalationChannel: deal.escalationChannel,
        amContactName: deal.amContactName,
        vfTicketNumber: deal.vfTicketNumber,
        notes: deal.notes,
        estimatedTotalUsd: deal.estimatedTotalUsd,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      return { success: true, message: data.message || 'Correo offline despachado exitosamente.' };
    }

    const errData = (await res.json().catch(() => ({}))) as any;
    return {
      success: false,
      message: errData.error || `Error HTTP ${res.status} despachando correo offline.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de red contactando servicio de correo Cloudflare.',
    };
  }
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
  // Registrar lápida (tombstone) para que no resucite en sincronizaciones cloud o recargas
  addDeletedDealReminderId(dealId);

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
