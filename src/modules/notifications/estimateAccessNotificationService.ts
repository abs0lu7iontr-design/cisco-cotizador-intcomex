/**
 * estimateAccessNotificationService.ts
 *
 * Servicio de notificaciones y gestión de permisos para cotizaciones restringidas.
 * Permite a los PMs y preventas:
 * 1. Monitorear solicitudes de acceso pendientes a sus cotizaciones.
 * 2. Recibir notificaciones en tiempo real cuando un colega pide ver un estimate.
 * 3. Aprobar o rechazar permisos en 1 solo clic desde el Navbar o el Historial.
 * 4. Notificar al solicitante cuando su solicitud fue aprobada.
 */

import { CloudEstimateRecord, EstimateAccessRequest } from '../cloud/types';
import { resolveEstimateAccessRequest } from '../cloud/firestoreService';

export interface PendingAccessNotification {
  docId: string;
  estimateId: string;
  partnerName: string;
  clientFinalName: string;
  totalCotizadoIntcomex?: number;
  requesterUsername: string;
  requesterFullName: string;
  requesterRole: string;
  requestedAt: string;
}

export interface MyAccessResolutionNotice {
  docId: string;
  estimateId: string;
  partnerName: string;
  clientFinalName: string;
  status: 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: string;
}

const DISMISSED_RESOLUTIONS_KEY = 'cisco_dismissed_access_resolution_ids_v1';

function getDismissedResolutions(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_RESOLUTIONS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function dismissAccessResolutionNotice(key: string): void {
  try {
    const set = getDismissedResolutions();
    set.add(key);
    localStorage.setItem(DISMISSED_RESOLUTIONS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Extrae todas las solicitudes de acceso pendientes dirigidas al usuario actual
 * (cotizaciones creadas por el usuario actual donde alguien solicitó acceso).
 */
export function getPendingAccessRequestsForUser(
  estimates: CloudEstimateRecord[],
  currentUsername?: string
): PendingAccessNotification[] {
  if (!currentUsername) return [];
  const normUser = currentUsername.trim().toLowerCase();

  const notifications: PendingAccessNotification[] = [];

  for (const est of estimates) {
    const creatorUser = (est.creator?.username || '').trim().toLowerCase();
    // Solo si el usuario actual es el creador
    if (creatorUser !== normUser) continue;

    const docId = est.id || `est_${est.estimateId}`;
    const requests = Array.isArray(est.accessRequests) ? est.accessRequests : [];

    for (const req of requests) {
      if (req.status === 'pending') {
        notifications.push({
          docId,
          estimateId: est.estimateId || 'NA',
          partnerName: est.partnerName || 'Partner',
          clientFinalName: est.clientFinalName || 'Cliente Final',
          totalCotizadoIntcomex: est.financialSummary?.totalCotizadoIntcomex,
          requesterUsername: req.username,
          requesterFullName: req.fullName || req.username,
          requesterRole: req.role || 'pm',
          requestedAt: req.requestedAt,
        });
      }
    }
  }

  // Ordenar de más reciente a más antiguo
  return notifications.sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

/**
 * Extrae notificaciones de solicitudes que el usuario actual hizo y que han sido
 * aprobadas o rechazadas por el autor.
 */
export function getMyAccessResolutionNotices(
  estimates: CloudEstimateRecord[],
  currentUsername?: string
): MyAccessResolutionNotice[] {
  if (!currentUsername) return [];
  const normUser = currentUsername.trim().toLowerCase();
  const dismissed = getDismissedResolutions();

  const notices: MyAccessResolutionNotice[] = [];

  for (const est of estimates) {
    const docId = est.id || `est_${est.estimateId}`;
    const requests = Array.isArray(est.accessRequests) ? est.accessRequests : [];

    for (const req of requests) {
      if (req.username.trim().toLowerCase() === normUser && req.status !== 'pending') {
        const key = `${docId}::${req.status}::${req.resolvedAt || ''}`;
        if (!dismissed.has(key)) {
          notices.push({
            docId,
            estimateId: est.estimateId || 'NA',
            partnerName: est.partnerName || 'Partner',
            clientFinalName: est.clientFinalName || 'Cliente Final',
            status: req.status as 'approved' | 'rejected',
            resolvedBy: req.resolvedBy,
            resolvedAt: req.resolvedAt,
          });
        }
      }
    }
  }

  return notices;
}

/**
 * Resuelve una solicitud de acceso rápida (Aprobar / Rechazar)
 */
export async function quickResolveAccessRequest(
  docId: string,
  estimateId: string,
  targetUsername: string,
  approve: boolean,
  currentUsername: string
): Promise<{ success: boolean; error?: string }> {
  return await resolveEstimateAccessRequest(
    docId,
    estimateId,
    targetUsername,
    approve,
    currentUsername
  );
}
