// ============================================================================
// CISCO AUTOMATED - OFFLINE CONCURRENCY & CONFLICT DETECTOR (v2.22.0)
// Detects multi-user edit conflicts when syncing offline queued actions with the cloud.
// Provides 3-way conflict resolution: Keep Cloud, Overwrite Local, or Fork Version.
// ============================================================================

import { OfflineQueueItem, OfflineActionType } from './offlineSyncQueue';
import { idbGet, idbSet, idbDelete, STORES } from './indexedDbStorage';
import { getEstimateVersionInfo, getCloudEstimates } from '../../modules/cloud/firestoreService';

export interface ConflictRecordSummary {
  id: string;
  title: string;
  author: string;
  timestamp: string;
  amountUsd?: number;
  itemsCount?: number;
  versionTag?: string;
  stageOrStatus?: string;
}

export interface OfflineConflictItem {
  queueItemId: string;
  action: OfflineActionType;
  entityKey: string;
  entityTitle: string;
  conflictReason: string;
  local: ConflictRecordSummary;
  remote: ConflictRecordSummary;
  rawLocalPayload: any;
  rawRemoteSnapshot: any;
}

export type ConflictResolutionMode = 'keep_cloud' | 'overwrite_local' | 'fork_version';

/**
 * Inspecciona un ítem de la cola offline y verifica si existe una colisión concurrente
 * con los datos existentes en la nube o en la caché sincronizada.
 */
export async function checkItemConflict(item: OfflineQueueItem): Promise<OfflineConflictItem | null> {
  if (item.payload?._forceOverwrite) {
    return null; // El usuario ya autorizó explícitamente forzar la sobrescritura
  }

  const itemCreatedTs = item.createdAt || Date.now();

  // 1. Conflicto en Cotizaciones (save_estimate)
  if (item.action === 'save_estimate') {
    const localRec = item.payload?.record || item.payload;
    const estId = localRec?.estimateId || localRec?.headerInfo?.estimateId || localRec?.id;
    if (!estId || localRec?.isLocalOnly) return null;

    try {
      const vInfo = await getEstimateVersionInfo(estId, localRec.dealId, localRec.originalFileName);
      if (vInfo && vInfo.exists) {
        const cloudRes = await getCloudEstimates();
        const cloudList = cloudRes.success && Array.isArray(cloudRes.data) ? cloudRes.data : [];
        const remoteRec = cloudList.find(
          (c) =>
            c.id === vInfo.docId ||
            (c.estimateId && c.estimateId !== 'NA' && c.estimateId === estId)
        );

        if (remoteRec) {
          const remoteCreatedTs = remoteRec.createdAt ? new Date(remoteRec.createdAt).getTime() : 0;
          const remoteUpdatedTs = (remoteRec as any).updatedAt
            ? new Date((remoteRec as any).updatedAt).getTime()
            : remoteCreatedTs;

        // Se considera conflicto si la versión en la nube fue modificada después de que se encoló la versión offline,
        // o si los montos o versiones activas difieren significativamente.
        const remoteIsNewer = remoteUpdatedTs > itemCreatedTs + 2000;
        const versionsDiffer =
          remoteRec.activeVersion !== undefined &&
          localRec.activeVersion !== undefined &&
          remoteRec.activeVersion > localRec.activeVersion;

        const amountDiffers =
          Math.abs((remoteRec.currentAmount || 0) - (localRec.currentAmount || 0)) > 0.05;

          const localCreatedRaw = (localRec as any).createdAt;
          const localCreatedTs =
            typeof localCreatedRaw === 'number'
              ? localCreatedRaw
              : localCreatedRaw
              ? new Date(localCreatedRaw).getTime()
              : 0;
          const safeLocalCreatedTs = Number.isFinite(localCreatedTs) ? localCreatedTs : 0;

          if (remoteIsNewer || versionsDiffer || (amountDiffers && remoteCreatedTs > safeLocalCreatedTs)) {
          return {
            queueItemId: item.id,
            action: item.action,
            entityKey: estId,
            entityTitle: `Cotización CCW #${estId} (${localRec.clientFinalName || 'Cliente'})`,
            conflictReason: versionsDiffer
              ? `La nube tiene una versión más avanzada (v${remoteRec.activeVersion}) que tu versión local (v${localRec.activeVersion}).`
              : `La nube fue actualizada después de que guardaste tu copia local offline.`,
            local: {
              id: estId,
              title: localRec.clientFinalName || 'Cliente Local',
              author: localRec.creator?.fullName || localRec.creator?.username || 'Tú (Offline)',
              timestamp: new Date(itemCreatedTs).toLocaleString('es-CL'),
              amountUsd: localRec.currentAmount || 0,
              itemsCount: localRec.itemsCount || (localRec.items || []).length,
              versionTag: localRec.activeVersionTag || `v${localRec.activeVersion ?? 1}`,
            },
            remote: {
              id: estId,
              title: remoteRec.clientFinalName || 'Cliente Remoto',
              author: remoteRec.creator?.fullName || remoteRec.creator?.username || 'Usuario en Nube',
              timestamp: new Date(remoteUpdatedTs || remoteCreatedTs).toLocaleString('es-CL'),
              amountUsd: remoteRec.currentAmount || 0,
              itemsCount: remoteRec.itemsCount || (remoteRec.items || []).length,
              versionTag: remoteRec.activeVersionTag || `v${remoteRec.activeVersion ?? 1}`,
            },
            rawLocalPayload: localRec,
            rawRemoteSnapshot: remoteRec,
          };
        }
      }
    }
  } catch (e) {
      // Si falla la consulta a la nube (sin red), no se puede determinar conflicto
      console.warn('[ConflictDetector] No se pudo verificar versión remota para', estId, e);
    }
  }

  // 2. Conflicto en Tracking de Back Order (save_bo_tracking)
  if (item.action === 'save_bo_tracking') {
    const localOrder = item.payload?.record || item.payload;
    const orderId = localOrder?.id;
    if (!orderId) return null;

    try {
      const { getBoTrackings } = await import('../../modules/bo/boTrackingService');
      const allTrackings = await getBoTrackings();
      const existing = allTrackings.find((o) => o.id === orderId);
      if (existing) {
        const existingTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (existingTs > itemCreatedTs + 3000 && existing.currentStage !== localOrder.currentStage) {
          return {
            queueItemId: item.id,
            action: item.action,
            entityKey: orderId,
            entityTitle: `Orden Back Order ${localOrder.endCustomerName || orderId}`,
            conflictReason: `La etapa logística en la nube (${existing.currentStage}) es diferente a la guardada offline (${localOrder.currentStage}).`,
            local: {
              id: orderId,
              title: localOrder.endCustomerName || 'Cliente',
              author: 'Tú (Offline)',
              timestamp: new Date(itemCreatedTs).toLocaleString('es-CL'),
              stageOrStatus: localOrder.currentStage,
            },
            remote: {
              id: orderId,
              title: existing.endCustomerName || 'Cliente',
              author: 'Logística / Nube',
              timestamp: new Date(existingTs).toLocaleString('es-CL'),
              stageOrStatus: existing.currentStage,
            },
            rawLocalPayload: localOrder,
            rawRemoteSnapshot: existing,
          };
        }
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Escanea la totalidad de la cola offline y devuelve los conflictos encontrados.
 */
export async function detectAllOfflineConflicts(
  queueItems: OfflineQueueItem[]
): Promise<OfflineConflictItem[]> {
  const conflicts: OfflineConflictItem[] = [];
  for (const item of queueItems) {
    try {
      const conflict = await checkItemConflict(item);
      if (conflict) {
        conflicts.push(conflict);
      }
    } catch (err) {
      console.warn('[ConflictDetector] Error analizando ítem', item.id, err);
    }
  }
  return conflicts;
}

/**
 * Aplica la resolución de un conflicto detectado:
 * 1. 'keep_cloud': Descarta el cambio offline conflictivo de la cola.
 * 2. 'overwrite_local': Marca el ítem para sobrescribir forzadamente en la nube.
 * 3. 'fork_version': Duplica o incrementa la versión para preservar ambos sin pérdida de datos.
 */
export async function resolveOfflineConflict(
  conflict: OfflineConflictItem,
  resolution: ConflictResolutionMode
): Promise<{ success: boolean; message: string }> {
  try {
    const existingItem = await idbGet<OfflineQueueItem>(STORES.OFFLINE_QUEUE, conflict.queueItemId);
    if (!existingItem) {
      return { success: false, message: 'El elemento ya no se encuentra en la cola offline.' };
    }

    if (resolution === 'keep_cloud') {
      // 1. Conservar versión de la nube: descartar ítem local de la cola
      await idbDelete(STORES.OFFLINE_QUEUE, conflict.queueItemId);
      return {
        success: true,
        message: `Se conservó la versión de la nube. El cambio offline de "${conflict.entityTitle}" fue descartado con seguridad.`,
      };
    }

    if (resolution === 'overwrite_local') {
      // 2. Sobrescribir con versión local: marcar con flag forzado
      const updatedItem: OfflineQueueItem = {
        ...existingItem,
        payload: {
          ...existingItem.payload,
          _forceOverwrite: true,
        },
        summary: `[Sobrescritura Forzada] ${existingItem.summary || conflict.entityTitle}`,
      };
      await idbSet(STORES.OFFLINE_QUEUE, conflict.queueItemId, updatedItem);
      return {
        success: true,
        message: `Se configuró la versión local para sobrescribir con prioridad en la nube.`,
      };
    }

    if (resolution === 'fork_version') {
      // 3. Crear nueva versión derivada (Cero Pérdida)
      if (conflict.action === 'save_estimate') {
        const localRec = existingItem.payload?.record || existingItem.payload;
        const nextVersionNum = (conflict.remote.amountUsd !== undefined ? (conflict.rawRemoteSnapshot?.activeVersion ?? 1) : 1) + 1;
        const forkedRecord = {
          ...localRec,
          activeVersion: nextVersionNum,
          activeVersionTag: `v${nextVersionNum}_OFFLINE_SYNC`,
          id: `${localRec.id || localRec.estimateId}_v${nextVersionNum}`,
          note: `Versión bifurcada automáticamente tras sincronización offline (${new Date().toLocaleDateString('es-CL')})`,
        };

        const updatedItem: OfflineQueueItem = {
          ...existingItem,
          payload: {
            ...existingItem.payload,
            record: forkedRecord,
            _forceOverwrite: true,
          },
          summary: `[Nueva Versión v${nextVersionNum}] ${existingItem.summary || conflict.entityTitle}`,
        };
        await idbSet(STORES.OFFLINE_QUEUE, conflict.queueItemId, updatedItem);
        return {
          success: true,
          message: `Se generó una nueva versión (v${nextVersionNum}) para preservar tanto los cambios de la nube como los locales.`,
        };
      }

      // Para otros módulos (BO, Pipeline, etc.), crear copia nombrada
      const payloadObj = existingItem.payload?.record || existingItem.payload?.deal || existingItem.payload;
      const forkedId = `${payloadObj.id || Date.now()}_offline_copy`;
      const forkedPayload = {
        ...payloadObj,
        id: forkedId,
        endCustomerName: payloadObj.endCustomerName ? `${payloadObj.endCustomerName} (Copia Offline)` : undefined,
        partner: payloadObj.partner ? `${payloadObj.partner} (Copia Offline)` : undefined,
      };

      const updatedItem: OfflineQueueItem = {
        ...existingItem,
        payload: {
          ...existingItem.payload,
          record: forkedPayload,
          deal: forkedPayload,
          _forceOverwrite: true,
        },
        summary: `[Copia Bifurcada] ${existingItem.summary || conflict.entityTitle}`,
      };
      await idbSet(STORES.OFFLINE_QUEUE, conflict.queueItemId, updatedItem);
      return {
        success: true,
        message: `Se creó una copia separada para conservar ambos registros en paralelo sin colisión.`,
      };
    }

    return { success: false, message: 'Modo de resolución no reconocido.' };
  } catch (err: any) {
    return { success: false, message: `Error al aplicar resolución: ${err?.message || err}` };
  }
}
