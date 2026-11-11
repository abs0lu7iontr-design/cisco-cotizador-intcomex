// ============================================================================
// CISCO AUTOMATED - OFFLINE FIRESTORE SYNC QUEUE (v2.11)
// Encola transacciones locales en IndexedDB cuando el usuario trabaja offline
// (por botón manual OFFLINE o caída de red) y permite subirlas bajo confirmación.
// ============================================================================

import { idbSet, idbGetAll, idbDelete, idbClear, STORES } from './indexedDbStorage';
import {
  isAppOffline,
  isManualOfflineMode,
  isNavigatorOffline,
  setFlushingOfflineQueueNow,
  notifyOfflineQueueChanged,
  notifyOfflineSyncCompleted,
} from './offlineModeManager';

export type OfflineActionType =
  | 'save_estimate'
  | 'save_bo_tracking'
  | 'delete_bo_tracking'
  | 'save_pipeline_deal'
  | 'bulk_save_pipeline'
  | 'delete_pipeline_deal'
  | 'save_forecast_record'
  | 'bulk_save_forecast'
  | 'delete_forecast_record'
  | 'save_dsv_record'
  | 'save_ccwr_quote'
  | 'save_deal_reminder'
  | 'delete_deal_reminder'
  | 'save_sku_override'
  | 'save_ticket';

export interface OfflineQueueItem {
  id: string;
  action: OfflineActionType;
  entityKey?: string;
  moduleLabel?: string;
  summary?: string;
  payload: any;
  createdAt: number;
  updatedAt?: number;
  retryCount: number;
  lastError?: string;
}

export interface OfflineActionMetadata {
  entityKey?: string;
  moduleLabel?: string;
  summary?: string;
}

export function getOfflineModuleLabel(action: OfflineActionType): string {
  switch (action) {
    case 'save_estimate':
      return 'Estimates CCW';
    case 'save_bo_tracking':
    case 'delete_bo_tracking':
      return 'Tracking BO';
    case 'save_pipeline_deal':
    case 'bulk_save_pipeline':
    case 'delete_pipeline_deal':
      return 'Pipeline Comercial';
    case 'save_forecast_record':
    case 'bulk_save_forecast':
    case 'delete_forecast_record':
      return 'Forecast Comercial';
    case 'save_dsv_record':
      return 'Generador DSV';
    case 'save_ccwr_quote':
      return 'Cotizador CCW-R';
    case 'save_deal_reminder':
    case 'delete_deal_reminder':
      return 'Recordatorios Deal';
    case 'save_sku_override':
      return 'Reglas SKU';
    case 'save_ticket':
      return 'Feedback & Tickets';
    default:
      return 'Nube';
  }
}

function buildDefaultSummary(action: OfflineActionType, payload: any): string {
  if (!payload) return getOfflineModuleLabel(action);
  if (action === 'save_estimate') {
    const rec = payload?.record || payload;
    return `Estimate ${rec.estimateId || rec.headerInfo?.estimateId || rec.originalFileName || 'CCW'}`;
  }
  if (action === 'save_bo_tracking') {
    const rec = payload?.record || payload;
    return `BO ${rec.endCustomerName || rec.clientPoNumber || rec.id || ''}`.trim();
  }
  if (action === 'delete_bo_tracking') {
    return `Eliminar BO ${payload?.orderId || payload?.id || payload}`;
  }
  if (action === 'save_pipeline_deal') {
    const d = payload?.deal || payload;
    return `Deal ${d.partner || ''} - ${d.endUser || d.id || ''}`.trim();
  }
  if (action === 'bulk_save_pipeline') {
    const len = Array.isArray(payload) ? payload.length : payload?.deals?.length || 0;
    return `Lote Pipeline (${len} registros)`;
  }
  if (action === 'delete_pipeline_deal') {
    return `Eliminar Deal ${payload?.id || payload}`;
  }
  if (action === 'save_forecast_record') {
    const r = payload?.record || payload;
    return `Forecast ${r.partner || ''} - ${r.endUser || r.id || ''}`.trim();
  }
  if (action === 'bulk_save_forecast') {
    const len = Array.isArray(payload) ? payload.length : payload?.records?.length || 0;
    return `Lote Forecast (${len} registros)`;
  }
  if (action === 'delete_forecast_record') {
    return `Eliminar Forecast ${payload?.id || payload}`;
  }
  if (action === 'save_dsv_record') {
    const r = payload?.record || payload;
    return `DSV Deal ${r.dealId || ''} / SO ${r.soNumber || ''}`.trim();
  }
  if (action === 'save_ccwr_quote') {
    return `CCW-R #${payload?.headerInfo?.quoteNumber || 'Quote'}`;
  }
  if (action === 'save_deal_reminder') {
    const r = payload?.deal || payload;
    return `Deal Reminder ${r.dealId || r.endCustomerName || ''}`.trim();
  }
  return getOfflineModuleLabel(action);
}

/**
 * Encola una acción de sincronización con la nube en el almacenamiento local del PC (IndexedDB).
 * Consolida automáticamente múltiples ediciones del mismo `entityKey` para evitar redundancia.
 */
export async function enqueueOfflineAction(
  action: OfflineActionType,
  payload: any,
  meta?: OfflineActionMetadata
): Promise<string> {
  const existingItems = await getPendingOfflineActions();
  const entityKey = meta?.entityKey;

  if (entityKey) {
    // Si ya existen elementos previos para la misma entidad, consolidar en el más reciente
    const matching = existingItems.filter((item) => item.entityKey === entityKey);
    for (const prev of matching) {
      await idbDelete(STORES.OFFLINE_QUEUE, prev.id);
    }
  }

  const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: OfflineQueueItem = {
    id,
    action,
    entityKey,
    moduleLabel: meta?.moduleLabel || getOfflineModuleLabel(action),
    summary: meta?.summary || buildDefaultSummary(action, payload),
    payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
  };

  await idbSet(STORES.OFFLINE_QUEUE, id, item);
  notifyOfflineQueueChanged();
  console.log(`[OfflineQueue] Acción guardada en PC (${action}):`, id);
  return id;
}

/**
 * Obtiene todas las acciones pendientes en la cola offline ordenadas cronológicamente.
 */
export async function getPendingOfflineActions(): Promise<OfflineQueueItem[]> {
  const items = await idbGetAll<OfflineQueueItem>(STORES.OFFLINE_QUEUE);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Resumen agrupado por módulo para mostrar en el modal de confirmación al volver Online.
 */
export async function getOfflineQueueSummary(): Promise<{
  total: number;
  byModule: Record<string, number>;
  items: OfflineQueueItem[];
}> {
  const items = await getPendingOfflineActions();
  const byModule: Record<string, number> = {};
  for (const item of items) {
    const label = item.moduleLabel || getOfflineModuleLabel(item.action);
    byModule[label] = (byModule[label] || 0) + 1;
  }
  return {
    total: items.length,
    byModule,
    items,
  };
}

/**
 * Limpia manualmente toda la cola offline.
 */
export async function clearOfflineQueue(): Promise<void> {
  const pending = await getPendingOfflineActions();
  for (const item of pending) {
    await idbDelete(STORES.OFFLINE_QUEUE, item.id);
  }
  await idbClear(STORES.OFFLINE_QUEUE);
  notifyOfflineQueueChanged();
}

async function executeQueuedItem(item: OfflineQueueItem): Promise<{ ok: boolean; error?: string }> {
  switch (item.action) {
    case 'save_estimate': {
      const { saveEstimateToCloud } = await import('../../modules/cloud/firestoreService');
      const record = item.payload?.record || item.payload;
      const options = item.payload?.options;
      const res = await saveEstimateToCloud(record, options);
      if (!res.success || res.syncStatus === 'PENDING_SYNC' || res.syncStatus === 'UNCERTAIN_COMMIT') {
        return { ok: false, error: res.error || 'Firestore aún no disponible para Estimate' };
      }
      return { ok: true };
    }

    case 'save_bo_tracking': {
      const { pushBoTrackingToCloud } = await import('../../modules/bo/boTrackingService');
      const record = item.payload?.record || item.payload;
      const res = await pushBoTrackingToCloud(record);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'delete_bo_tracking': {
      const { pushBoTrackingDeleteToCloud } = await import('../../modules/bo/boTrackingService');
      const id =
        typeof item.payload === 'string'
          ? item.payload
          : item.payload?.orderId || item.payload?.id;
      if (!id) return { ok: true };
      const res = await pushBoTrackingDeleteToCloud(id);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'save_pipeline_deal': {
      const { pushPipelineDealToCloud } = await import('../../modules/pipeline/pipelineStorage');
      const deal = item.payload?.deal || item.payload;
      const res = await pushPipelineDealToCloud(deal);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'bulk_save_pipeline': {
      const { pushPipelineDealsBatchToCloud } = await import('../../modules/pipeline/pipelineStorage');
      const deals = Array.isArray(item.payload) ? item.payload : item.payload?.deals || [];
      const res = await pushPipelineDealsBatchToCloud(deals);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'delete_pipeline_deal': {
      const { pushPipelineDeleteToCloud } = await import('../../modules/pipeline/pipelineStorage');
      const id = typeof item.payload === 'string' ? item.payload : item.payload?.id;
      if (!id) return { ok: true };
      const res = await pushPipelineDeleteToCloud(id);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'save_forecast_record': {
      const { pushForecastRecordToCloud } = await import('../../modules/forecast/forecastStorage');
      const rec = item.payload?.record || item.payload;
      const res = await pushForecastRecordToCloud(rec);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'bulk_save_forecast': {
      const { pushForecastRecordsBatchToCloud } = await import('../../modules/forecast/forecastStorage');
      const recs = Array.isArray(item.payload) ? item.payload : item.payload?.records || [];
      const res = await pushForecastRecordsBatchToCloud(recs);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'delete_forecast_record': {
      const { pushForecastDeleteToCloud } = await import('../../modules/forecast/forecastStorage');
      const id = typeof item.payload === 'string' ? item.payload : item.payload?.id;
      if (!id) return { ok: true };
      const res = await pushForecastDeleteToCloud(id);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'save_dsv_record': {
      const { saveDsvToCloud } = await import('../../modules/cloud/firestoreService');
      const rec = item.payload?.record || item.payload;
      const res = await saveDsvToCloud(rec);
      if (res.offlineQueued) {
        return { ok: false, error: res.error || 'DSV pendiente de red' };
      }
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'save_deal_reminder': {
      const { pushDealReminderToCloud } = await import('../../modules/bo/dealReminderService');
      const rec = item.payload?.deal || item.payload;
      const res = await pushDealReminderToCloud(rec);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'delete_deal_reminder': {
      const { pushDealReminderDeleteToCloud } = await import('../../modules/bo/dealReminderService');
      const id =
        typeof item.payload === 'string'
          ? item.payload
          : item.payload?.dealId || item.payload?.id;
      if (!id) return { ok: true };
      const res = await pushDealReminderDeleteToCloud(id);
      return res.success ? { ok: true } : { ok: false, error: res.error };
    }

    case 'save_ccwr_quote': {
      // Historial local CCW-R ya persistido en el PC (cruce con Forecast/Pipeline usa acciones dedicadas)
      return { ok: true };
    }

    default:
      return { ok: true };
  }
}

/**
 * Procesa y envía a Firestore todos los registros encolados en IndexedDB.
 */
export async function flushOfflineQueue(options?: {
  forceEvenIfManualOffline?: boolean;
  onProgress?: (processed: number, total: number, currentItem?: OfflineQueueItem) => void;
}): Promise<{
  successCount: number;
  failedCount: number;
  remainingCount: number;
  errors: string[];
}> {
  if (isNavigatorOffline()) {
    const pending = await getPendingOfflineActions();
    return {
      successCount: 0,
      failedCount: 0,
      remainingCount: pending.length,
      errors: ['Sin conexión a internet en el equipo.'],
    };
  }

  if (!options?.forceEvenIfManualOffline && isManualOfflineMode()) {
    const pending = await getPendingOfflineActions();
    return {
      successCount: 0,
      failedCount: 0,
      remainingCount: pending.length,
      errors: ['Modo Offline manual activo. Cambia a Online para autorizar la subida.'],
    };
  }

  const items = await getPendingOfflineActions();
  if (items.length === 0) {
    return { successCount: 0, failedCount: 0, remainingCount: 0, errors: [] };
  }

  console.log(`[OfflineQueue] Procesando ${items.length} acciones pendientes hacia la nube...`);
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  setFlushingOfflineQueueNow(true);
  try {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      options?.onProgress?.(idx, items.length, item);
      try {
        const res = await executeQueuedItem(item);
        if (res.ok) {
          await idbDelete(STORES.OFFLINE_QUEUE, item.id);
          successCount++;
        } else {
          item.retryCount++;
          item.lastError = res.error || 'Fallo desconocido al subir cambio offline';
          item.updatedAt = Date.now();
          await idbSet(STORES.OFFLINE_QUEUE, item.id, item);
          failedCount++;
          if (item.lastError) errors.push(`${item.summary || item.action}: ${item.lastError}`);
        }
      } catch (err: any) {
        item.retryCount++;
        item.lastError = err?.message || String(err);
        item.updatedAt = Date.now();
        await idbSet(STORES.OFFLINE_QUEUE, item.id, item);
        failedCount++;
        if (item.lastError) errors.push(`${item.summary || item.action}: ${item.lastError}`);
      }
      options?.onProgress?.(idx + 1, items.length, item);
    }
  } finally {
    setFlushingOfflineQueueNow(false);
    notifyOfflineQueueChanged();
  }

  const remaining = (await getPendingOfflineActions()).length;
  notifyOfflineSyncCompleted({ uploadedCount: successCount, failedCount });
  console.log(
    `[OfflineQueue] Flush completado: ${successCount} exitosas, ${failedCount} fallidas, ${remaining} restantes.`
  );
  return { successCount, failedCount, remainingCount: remaining, errors };
}

/**
 * Inicializa los listeners nativos de online/offline.
 * Respeta el Modo Offline manual: NO sube cambios automáticamente si el usuario activó el botón Offline.
 */
export function initOfflineSyncListeners(onSyncSuccess?: (count: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    if (isAppOffline()) {
      console.log('[OfflineQueue] Modo Offline manual activo; subida en pausa hasta confirmación del usuario.');
      return;
    }
    console.log('[OfflineQueue] Conexión a internet activa. Verificando cola pendiente...');
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

  if (typeof navigator !== 'undefined' && navigator.onLine && !isManualOfflineMode()) {
    setTimeout(handleOnline, 3000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
