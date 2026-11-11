// ============================================================================
// CISCO AUTOMATED - MANUAL OFFLINE MODE & LOCAL SYNC STATE MANAGER
// Controla el modo Offline voluntario del usuario para trabajar localmente con
// lo mínimo indispensable (cotizar, DSV, BO, Pipeline, Forecast, Estimates)
// y coordinar la subida segura al volver a Online.
// ============================================================================

import { useSyncExternalStore } from 'react';

export const MANUAL_OFFLINE_STORAGE_KEY = 'cisco_manual_offline_mode_v1';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'cisco-offline-queue-updated';
export const OFFLINE_MODE_CHANGED_EVENT = 'cisco-offline-mode-changed';
export const OFFLINE_SYNC_COMPLETED_EVENT = 'cisco-offline-sync-completed';

let cachedManualOffline: boolean | null = null;
let stateVersion = 0;
let isFlushingQueue = false;
const listeners = new Set<() => void>();

function readStoredManualOffline(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(MANUAL_OFFLINE_STORAGE_KEY) === 'true';
    }
  } catch {}
  return false;
}

function emitChange(): void {
  stateVersion += 1;
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {}
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => emitChange());
  window.addEventListener('offline', () => emitChange());
  window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, () => emitChange());
  window.addEventListener('storage', (e) => {
    if (e.key === MANUAL_OFFLINE_STORAGE_KEY) {
      cachedManualOffline = e.newValue === 'true';
      emitChange();
    }
  });
}

/**
 * Indica si el usuario activó manualmente el Modo Offline desde el Frontend.
 */
export function isManualOfflineMode(): boolean {
  if (cachedManualOffline === null) {
    cachedManualOffline = readStoredManualOffline();
  }
  return cachedManualOffline;
}

/**
 * Activa o desactiva el Modo Offline manual en el PC.
 */
export function setManualOfflineMode(enabled: boolean): void {
  const next = Boolean(enabled);
  cachedManualOffline = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MANUAL_OFFLINE_STORAGE_KEY, String(next));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_MODE_CHANGED_EVENT, { detail: { isManualOffline: next } })
      );
    } catch {}
  }
  emitChange();
}

/**
 * Indica si el navegador reporta falta de conexión física a internet.
 */
export function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Indica si la aplicación debe operar estrictamente en modo local (sin escribir ni leer en la nube),
 * ya sea por activación manual del botón OFFLINE o por caída real de red.
 */
export function isAppOffline(): boolean {
  return isManualOfflineMode() || isNavigatorOffline();
}

/**
 * Controla la bandera interna durante el flush de la cola para evitar re-encolamiento circular.
 */
export function isFlushingOfflineQueueNow(): boolean {
  return isFlushingQueue;
}

export function setFlushingOfflineQueueNow(flushing: boolean): void {
  isFlushingQueue = flushing;
  emitChange();
}

export function notifyOfflineQueueChanged(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
    } catch {}
  }
  emitChange();
}

export function notifyOfflineSyncCompleted(details: {
  uploadedCount: number;
  failedCount: number;
}): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNC_COMPLETED_EVENT, { detail: details })
      );
    } catch {}
  }
  emitChange();
}

export function subscribeOfflineState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineStateSnapshot(): string {
  return `${isManualOfflineMode() ? 'M1' : 'M0'}|${isNavigatorOffline() ? 'N1' : 'N0'}|${
    isFlushingQueue ? 'F1' : 'F0'
  }|v${stateVersion}`;
}

export interface OfflineModeSnapshot {
  isManualOffline: boolean;
  isNavigatorOffline: boolean;
  isOffline: boolean;
  isFlushing: boolean;
}

/**
 * Hook reactivo compatible con React 19 para observar en tiempo real el estado Offline/Online.
 */
export function useOfflineMode(): OfflineModeSnapshot {
  useSyncExternalStore(
    subscribeOfflineState,
    getOfflineStateSnapshot,
    getOfflineStateSnapshot
  );

  const manual = isManualOfflineMode();
  const net = isNavigatorOffline();

  return {
    isManualOffline: manual,
    isNavigatorOffline: net,
    isOffline: manual || net,
    isFlushing: isFlushingQueue,
  };
}
