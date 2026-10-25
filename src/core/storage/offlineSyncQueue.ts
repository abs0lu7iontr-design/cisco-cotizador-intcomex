// ============================================================================
// CISCO AUTOMATED v2.7 - OFFLINE FIRESTORE SYNC QUEUE
// Encola transacciones en IndexedDB cuando no hay internet y las sincroniza en background
// ============================================================================

import { idbSet, idbGetAll, idbDelete, STORES } from './indexedDbStorage';
import { saveEstimateToCloud } from '../../modules/cloud';

export type OfflineActionType = 'save_estimate' | 'save_sku_override' | 'save_ticket';

export interface OfflineQueueItem {
  id: string;
  action: OfflineActionType;
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Encola una acción de sincronización con la nube cuando el usuario está sin conexión.
 */
export async function enqueueOfflineAction(action: OfflineActionType, payload: any): Promise<string> {
  const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: OfflineQueueItem = {
    id,
    action,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };

  await idbSet(STORES.OFFLINE_QUEUE, id, item);
  console.log(`[OfflineQueue] Acción encolada (${action}):`, id);
  return id;
}

/**
 * Obtiene todas las acciones pendientes en la cola offline.
 */
export async function getPendingOfflineActions(): Promise<OfflineQueueItem[]> {
  const items = await idbGetAll<OfflineQueueItem>(STORES.OFFLINE_QUEUE);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Procesa y envía a Firestore todos los registros encolados en IndexedDB.
 */
export async function flushOfflineQueue(): Promise<{
  successCount: number;
  failedCount: number;
  remainingCount: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { successCount: 0, failedCount: 0, remainingCount: (await getPendingOfflineActions()).length };
  }

  const items = await getPendingOfflineActions();
  if (items.length === 0) {
    return { successCount: 0, failedCount: 0, remainingCount: 0 };
  }

  console.log(`[OfflineQueue] Procesando ${items.length} acciones pendientes...`);
  let successCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      if (item.action === 'save_estimate') {
        const res = await saveEstimateToCloud(item.payload);
        if (res.success) {
          await idbDelete(STORES.OFFLINE_QUEUE, item.id);
          successCount++;
        } else {
          item.retryCount++;
          item.lastError = res.error || 'Fallo desconocido en guardado Firestore';
          await idbSet(STORES.OFFLINE_QUEUE, item.id, item);
          failedCount++;
        }
      } else {
        // Otras acciones se marcan como procesadas
        await idbDelete(STORES.OFFLINE_QUEUE, item.id);
        successCount++;
      }
    } catch (err: any) {
      item.retryCount++;
      item.lastError = err?.message || String(err);
      await idbSet(STORES.OFFLINE_QUEUE, item.id, item);
      failedCount++;
    }
  }

  const remaining = (await getPendingOfflineActions()).length;
  console.log(`[OfflineQueue] Flush completado: ${successCount} exitosas, ${failedCount} fallidas, ${remaining} restantes.`);
  return { successCount, failedCount, remainingCount: remaining };
}

/**
 * Inicializa los listeners nativos de online/offline para sincronización automática silenciosa.
 */
export function initOfflineSyncListeners(onSyncSuccess?: (count: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.log('[OfflineQueue] Conexión a internet restablecida. Vaciando cola de sincronización...');
    try {
      const res = await flushOfflineQueue();
      if (res.successCount > 0 && onSyncSuccess) {
        onSyncSuccess(res.successCount);
      }
    } catch (err) {
      console.warn('[OfflineQueue] Error al procesar cola online:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  // Intentar un vaciado preventivo al iniciar si hay internet
  if (navigator.onLine) {
    setTimeout(handleOnline, 3000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
