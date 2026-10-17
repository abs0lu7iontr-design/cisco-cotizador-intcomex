// ============================================================================
// CISCO AUTOMATED v2.1 - FEEDBACK & IMPROVEMENT TICKETING SERVICE
// Firestore Cloud Sync + Local Fallback Vault + SLA Tracking Engine
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFirestoreInstance } from '../cloud/firebaseConfig';
import { sanitizeForFirestore } from '../cloud/firestoreService';
import { UserSession } from '../../core/types';
import {
  FeedbackTicket,
  CreateTicketInput,
  TicketStatus,
  TicketPriority,
  SlaInfo,
  SlaStatus,
  TechnicalContext,
  TicketFeedbackMessage,
} from './types';

export const FEEDBACK_TICKETS_COLLECTION = 'app_feedback_tickets';
const LOCAL_FEEDBACK_CACHE_KEY = 'cisco_feedback_tickets_cache_v1';

// SLA Target Hours by Priority
export const SLA_TARGET_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,   // 4 horas - Bloqueo de cotización / falla crítica
  HIGH: 24,      // 24 horas (1 día) - Falla importante sin workaround ágil
  MEDIUM: 72,    // 72 horas (3 días) - Ajuste relevante o mejora
  LOW: 120,      // 120 horas (5 días) - Sugerencia o idea a futuro
};

// In-Memory Cache for fast UI renders
let inMemoryTickets: FeedbackTicket[] = [];

/**
 * Computes live SLA status and remaining time for any ticket.
 */
export function computeSlaInfo(ticket: FeedbackTicket): SlaInfo {
  const targetMs = (ticket.targetHours || 72) * 60 * 60 * 1000;
  const createdMs = new Date(ticket.createdAt).getTime();
  const endMs =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ? ticket.resolvedAt
        ? new Date(ticket.resolvedAt).getTime()
        : Date.now()
      : Date.now();

  const elapsedMs = Math.max(0, endMs - createdMs);
  const remainingMs = targetMs - elapsedMs;
  const percentUsed = Math.min(100, Math.max(0, Math.round((elapsedMs / targetMs) * 100)));
  const isBreached = remainingMs < 0;

  let status: SlaStatus = 'ON_TIME';
  if (isBreached) {
    status = 'BREACHED';
  } else if (percentUsed >= 75) {
    status = 'NEAR_BREACH';
  }

  // Format remaining or breached time
  let formattedRemaining = '';
  const absRemainingMs = Math.abs(remainingMs);
  const totalMinutes = Math.floor(absRemainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    if (isBreached) {
      formattedRemaining = `Resuelto fuera de SLA (+${days > 0 ? `${days}d ` : ''}${remHours}h)`;
    } else {
      formattedRemaining = `Resuelto a tiempo (${percentUsed}% SLA usado)`;
    }
  } else {
    if (isBreached) {
      formattedRemaining = `SLA Vencido hace ${days > 0 ? `${days}d ` : ''}${remHours}h ${minutes}m`;
    } else {
      if (days > 0) {
        formattedRemaining = `${days}d ${remHours}h restantes`;
      } else if (hours > 0) {
        formattedRemaining = `${hours}h ${minutes}m restantes`;
      } else {
        formattedRemaining = `${minutes} min restantes`;
      }
    }
  }

  return {
    status,
    remainingMs,
    formattedRemaining,
    isBreached,
    percentUsed,
  };
}

/**
 * Automatically captures technical diagnostic metadata to help support troubleshoot.
 */
export function captureTechnicalContext(
  activeView: string = 'feedback',
  currentEstimateFileName?: string,
  dealId?: string,
  estimateId?: string
): TechnicalContext {
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).pywebview);
  const isPagesDev = typeof window !== 'undefined' && window.location.hostname.includes('pages.dev');

  let environment: 'Desktop' | 'Web Cloudflare' | 'Local Dev' = 'Local Dev';
  if (isDesktop) {
    environment = 'Desktop';
  } else if (isPagesDev) {
    environment = 'Web Cloudflare';
  }

  // Try to inspect global build information if stored
  let gitCommit = 'develop';
  let appVersion = '2.1.0';
  try {
    const rawVersion = localStorage.getItem('cisco_latest_version_cache');
    if (rawVersion) {
      const parsed = JSON.parse(rawVersion);
      if (parsed.git_commit) gitCommit = parsed.git_commit;
      if (parsed.version) appVersion = parsed.version;
    }
  } catch {
    // fallback
  }

  return {
    appVersion,
    gitCommit,
    environment,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    activeView,
    currentEstimateFileName,
    dealId,
    estimateId,
  };
}

/**
 * Reads local cached feedback tickets.
 */
export function getLocalCachedTickets(): FeedbackTicket[] {
  if (inMemoryTickets.length > 0) return inMemoryTickets;
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryTickets = parsed;
        return inMemoryTickets;
      }
    }
  } catch (err) {
    console.warn('[feedbackService] Error al leer caché local de tickets:', err);
  }
  return [];
}

/**
 * Writes tickets to local storage cache.
 */
function setLocalCachedTickets(tickets: FeedbackTicket[]) {
  inMemoryTickets = tickets;
  try {
    localStorage.setItem(LOCAL_FEEDBACK_CACHE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.warn('[feedbackService] No se pudo guardar caché local de tickets:', err);
  }
}

/**
 * Generates human-friendly ticket ID: e.g. TICK-202610-8F2A
 */
function generateTicketId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TICK-${year}${month}-${rand}`;
}

/**
 * Retrieves all feedback tickets from Firestore with automatic local fallback.
 */
export async function getFeedbackTickets(forceRefresh = false): Promise<FeedbackTicket[]> {
  if (!forceRefresh && inMemoryTickets.length > 0) {
    return inMemoryTickets;
  }

  try {
    const { db, isReady } = getFirestoreInstance();
    if (!isReady || !db) {
      return getLocalCachedTickets();
    }
    const colRef = collection(db, FEEDBACK_TICKETS_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(150));
    
    // 8-second network timeout safeguard
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 8000)
    );

    const snapshot = await Promise.race([getDocs(q), timeoutPromise]);
    const remoteTickets: FeedbackTicket[] = [];

    snapshot.forEach((d) => {
      const data = d.data() as FeedbackTicket;
      if (data && data.title) {
        remoteTickets.push({
          ...data,
          id: data.id || d.id,
          responses: Array.isArray(data.responses) ? data.responses : [],
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
        });
      }
    });

    if (remoteTickets.length > 0) {
      setLocalCachedTickets(remoteTickets);
      return remoteTickets;
    }
  } catch (err) {
    console.warn('[feedbackService] Firestore no disponible o timeout, usando caché local:', err);
  }

  return getLocalCachedTickets();
}

/**
 * Creates a new feedback ticket, persists it to Firestore and updates local cache.
 */
export async function createFeedbackTicket(
  input: CreateTicketInput,
  currentUser: UserSession
): Promise<{ success: boolean; ticket?: FeedbackTicket; error?: string }> {
  try {
    const ticketId = generateTicketId();
    const createdAt = new Date().toISOString();
    const targetHours = SLA_TARGET_HOURS[input.priority] || 72;
    const dueAt = new Date(Date.now() + targetHours * 60 * 60 * 1000).toISOString();

    const techContext = {
      ...captureTechnicalContext(
        input.customContext?.activeView,
        input.customContext?.currentEstimateFileName,
        input.customContext?.dealId,
        input.customContext?.estimateId
      ),
      ...(input.customContext || {}),
    };

    const newTicket: FeedbackTicket = {
      id: ticketId,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      priority: input.priority,
      status: 'OPEN',
      module: input.module,
      targetHours,
      dueAt,
      author: {
        username: currentUser.username,
        fullName: currentUser.full_name || currentUser.username,
        email: currentUser.email || '',
        role: currentUser.role,
      },
      technicalContext: techContext,
      attachments: input.attachments || [],
      responses: [],
      readByAuthor: true,
      readBySupport: false,
      createdAt,
      updatedAt: createdAt,
    };

    // Update local cache immediately for optimistic UI response
    const cached = getLocalCachedTickets();
    const updated = [newTicket, ...cached.filter((t) => t.id !== newTicket.id)];
    setLocalCachedTickets(updated);

    // Save to Firestore
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, FEEDBACK_TICKETS_COLLECTION, ticketId);
        const cleanPayload = sanitizeForFirestore(newTicket);
        await setDoc(docRef, cleanPayload);
      }
    } catch (fsErr) {
      console.warn('[feedbackService] Guardado en Firestore falló, conservado en caché local:', fsErr);
    }

    return { success: true, ticket: newTicket };
  } catch (err: any) {
    console.error('[feedbackService] Error creando ticket:', err);
    return { success: false, error: err?.message || 'Error desconocido al crear ticket' };
  }
}

/**
 * Appends a new feedback message to the ticket conversation thread and optionally updates status.
 */
export async function addFeedbackResponse(
  ticketId: string,
  message: string,
  currentUser: UserSession,
  newStatus?: TicketStatus,
  isInternalNote: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanMsg = message.trim();
    if (!cleanMsg) return { success: false, error: 'El mensaje de respuesta no puede estar vacío' };

    const tickets = await getFeedbackTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) return { success: false, error: 'Ticket no encontrado' };

    const currentTicket = tickets[index];
    const isSupport = currentUser.role === 'admin' || currentUser.role === 'pm';

    const responseItem: TicketFeedbackMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: {
        username: currentUser.username,
        fullName: currentUser.full_name || currentUser.username,
        role: currentUser.role,
        isSupportTeam: isSupport,
      },
      message: cleanMsg,
      createdAt: new Date().toISOString(),
      statusChange: newStatus,
      isInternalNote,
    };

    const updatedResponses = [...(currentTicket.responses || []), responseItem];
    const updatedStatus = newStatus || currentTicket.status;
    const nowIso = new Date().toISOString();

    let resolvedAt = currentTicket.resolvedAt;
    let timeToResolutionMinutes = currentTicket.timeToResolutionMinutes;

    if (updatedStatus === 'RESOLVED' && !currentTicket.resolvedAt) {
      resolvedAt = nowIso;
      const createdMs = new Date(currentTicket.createdAt).getTime();
      timeToResolutionMinutes = Math.round((Date.now() - createdMs) / (1000 * 60));
    } else if (updatedStatus !== 'RESOLVED' && updatedStatus !== 'CLOSED') {
      resolvedAt = undefined;
      timeToResolutionMinutes = undefined;
    }

    const updatedTicket: FeedbackTicket = {
      ...currentTicket,
      status: updatedStatus,
      resolvedAt,
      timeToResolutionMinutes,
      responses: updatedResponses,
      updatedAt: nowIso,
      // If support replied, author has unread feedback
      readByAuthor: isSupport ? false : true,
      readBySupport: isSupport ? true : false,
    };

    tickets[index] = updatedTicket;
    setLocalCachedTickets([...tickets]);

    // Firestore sync
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, FEEDBACK_TICKETS_COLLECTION, ticketId);
        await setDoc(docRef, sanitizeForFirestore(updatedTicket), { merge: true });
      }
    } catch (fsErr) {
      console.warn('[feedbackService] Error sincronizando respuesta en Firestore:', fsErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al agregar respuesta' };
  }
}

/**
 * Updates status of a ticket directly (e.g. In Progress, Resolved, Closed).
 */
export async function updateFeedbackTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  currentUser: UserSession,
  statusNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const tickets = await getFeedbackTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) return { success: false, error: 'Ticket no encontrado' };

    const currentTicket = tickets[index];
    const nowIso = new Date().toISOString();

    let resolvedAt = currentTicket.resolvedAt;
    let timeToResolutionMinutes = currentTicket.timeToResolutionMinutes;

    if (newStatus === 'RESOLVED' && !currentTicket.resolvedAt) {
      resolvedAt = nowIso;
      const createdMs = new Date(currentTicket.createdAt).getTime();
      timeToResolutionMinutes = Math.round((Date.now() - createdMs) / (1000 * 60));
    } else if (newStatus !== 'RESOLVED' && newStatus !== 'CLOSED') {
      resolvedAt = undefined;
      timeToResolutionMinutes = undefined;
    }

    const updatedResponses = [...(currentTicket.responses || [])];
    if (statusNote && statusNote.trim()) {
      updatedResponses.push({
        id: `sys-${Date.now()}`,
        author: {
          username: currentUser.username,
          fullName: currentUser.full_name || currentUser.username,
          role: currentUser.role,
          isSupportTeam: currentUser.role === 'admin' || currentUser.role === 'pm',
        },
        message: statusNote.trim(),
        createdAt: nowIso,
        statusChange: newStatus,
      });
    }

    const updatedTicket: FeedbackTicket = {
      ...currentTicket,
      status: newStatus,
      resolvedAt,
      timeToResolutionMinutes,
      responses: updatedResponses,
      updatedAt: nowIso,
    };

    tickets[index] = updatedTicket;
    setLocalCachedTickets([...tickets]);

    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, FEEDBACK_TICKETS_COLLECTION, ticketId);
        await setDoc(docRef, sanitizeForFirestore(updatedTicket), { merge: true });
      }
    } catch (fsErr) {
      console.warn('[feedbackService] Error actualizando estado en Firestore:', fsErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cambiar estado' };
  }
}

/**
 * Permanently deletes a feedback ticket.
 */
export async function deleteFeedbackTicket(ticketId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const tickets = await getFeedbackTickets();
    const filtered = tickets.filter((t) => t.id !== ticketId);
    setLocalCachedTickets(filtered);

    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, FEEDBACK_TICKETS_COLLECTION, ticketId);
        await deleteDoc(docRef);
      }
    } catch (fsErr) {
      console.warn('[feedbackService] Error eliminando ticket de Firestore:', fsErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error eliminando ticket' };
  }
}

/**
 * Marks ticket feedback as read by author or support team.
 */
export async function markTicketAsRead(ticketId: string, isAuthor: boolean): Promise<void> {
  const tickets = getLocalCachedTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return;

  const current = tickets[index];
  if (isAuthor && current.readByAuthor) return;
  if (!isAuthor && current.readBySupport) return;

  const updated: FeedbackTicket = {
    ...current,
    readByAuthor: isAuthor ? true : current.readByAuthor,
    readBySupport: !isAuthor ? true : current.readBySupport,
  };

  tickets[index] = updated;
  setLocalCachedTickets([...tickets]);

  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, FEEDBACK_TICKETS_COLLECTION, ticketId);
      await setDoc(
        docRef,
        {
          readByAuthor: updated.readByAuthor,
          readBySupport: updated.readBySupport,
        },
        { merge: true }
      );
    }
  } catch {
    // silent catch
  }
}

/**
 * Generates an Outlook mailto: link to reply via email directly to the ticket author or Intcomex Cisco Support.
 */
export function generateOutlookMailtoLink(ticket: FeedbackTicket, replyText?: string): string {
  const targetEmail = ticket.author.email || 'soporte.cisco@intcomex.com';
  const subject = encodeURIComponent(
    `[${ticket.id}] Feedback Cisco Automated: ${ticket.title} (${ticket.status})`
  );

  const slaInfo = computeSlaInfo(ticket);
  const bodyText = [
    `Hola ${ticket.author.fullName},`,
    '',
    `Respecto a tu reporte en Cisco Automated:`,
    `-------------------------------------------------------`,
    `Ticket ID: ${ticket.id}`,
    `Título: ${ticket.title}`,
    `Tipo: ${ticket.type} | Prioridad: ${ticket.priority}`,
    `Módulo: ${ticket.module}`,
    `Estado Actual: ${ticket.status}`,
    `SLA: ${slaInfo.formattedRemaining}`,
    `-------------------------------------------------------`,
    '',
    replyText ? `Respuesta del Equipo Técnico:` : '',
    replyText || '',
    '',
    `Atentamente,`,
    `Equipo de Desarrollo & Producto Cisco Automated`,
    `Intcomex Chile`,
  ].join('\r\n');

  return `mailto:${targetEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
}
