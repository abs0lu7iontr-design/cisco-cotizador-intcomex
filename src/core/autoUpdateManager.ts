// ============================================================================
// CISCO AUTOMATED - NATIVE AUTO-UPDATE SERVICE & LIFECYCLE CONTROLLER
// Las actualizaciones NUNCA quedan offline: se comprueban en el inicio,
// en cada conexión/reconexión, al cerrar sesión y al reiniciar.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { APP_VERSION, getFormattedAppVersion } from './appVersion';
import {
  checkDesktopUpdate,
  applyDesktopUpdate,
  DesktopUpdateResult,
  isDesktopApp,
} from './desktopBridge';

export interface AutoUpdateState {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  isChecking: boolean;
  isApplying: boolean;
  lastCheckedAt: string | null;
  error?: string | null;
}

const DEFAULT_UPDATE_STATE: AutoUpdateState = {
  hasUpdate: false,
  latestVersion: APP_VERSION,
  currentVersion: APP_VERSION,
  releaseNotes: '',
  downloadUrl: undefined,
  isChecking: false,
  isApplying: false,
  lastCheckedAt: null,
  error: null,
};

let currentUpdateState: AutoUpdateState = { ...DEFAULT_UPDATE_STATE };
const updateListeners = new Set<() => void>();

function notifyUpdateListeners(): void {
  for (const listener of Array.from(updateListeners)) {
    try {
      listener();
    } catch {}
  }
}

/**
 * React External Store Snapshot
 */
export function getAutoUpdateSnapshot(): AutoUpdateState {
  return currentUpdateState;
}

/**
 * Suscripción reactiva para componentes React
 */
export function subscribeAutoUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

/**
 * React Hook para suscribirse al estado de actualizaciones automáticas
 */
export function useAutoUpdate(): AutoUpdateState {
  return useSyncExternalStore(subscribeAutoUpdate, getAutoUpdateSnapshot, getAutoUpdateSnapshot);
}

/**
 * Comprueba si hay una actualización disponible en la nube de Cloudflare / GitHub.
 * Las actualizaciones NUNCA quedan bloqueadas por el modo offline si hay acceso a la red.
 */
export async function checkForUpdates(silent: boolean = false): Promise<DesktopUpdateResult | null> {
  // Si el navegador reporta explícitamente sin red, no hacer petición
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!silent) {
      console.log('[AutoUpdateManager] Sin conexión a internet física. Comprobación pospuesta.');
    }
    return null;
  }

  currentUpdateState = {
    ...currentUpdateState,
    isChecking: true,
    error: null,
  };
  notifyUpdateListeners();

  try {
    const res = await checkDesktopUpdate();
    if (res && res.success) {
      const hasUpdate = Boolean(res.has_update);
      currentUpdateState = {
        hasUpdate,
        latestVersion: res.latest_version || currentUpdateState.latestVersion,
        currentVersion: res.current_version || APP_VERSION,
        releaseNotes: res.release_notes || '',
        downloadUrl: res.download_url,
        isChecking: false,
        isApplying: false,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      };
      notifyUpdateListeners();

      if (hasUpdate && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cisco-update-available', {
            detail: {
              latestVersion: res.latest_version,
              releaseNotes: res.release_notes,
            },
          })
        );
      }

      return res;
    } else {
      currentUpdateState = {
        ...currentUpdateState,
        isChecking: false,
        lastCheckedAt: new Date().toISOString(),
      };
      notifyUpdateListeners();
      return null;
    }
  } catch (err: any) {
    currentUpdateState = {
      ...currentUpdateState,
      isChecking: false,
      error: err?.message || 'Error al comprobar actualizaciones',
    };
    notifyUpdateListeners();
    return null;
  }
}

/**
 * Aplica la actualización de forma inmediata (en caliente en Desktop o recargando en Web).
 */
export async function applyUpdateNow(): Promise<{ success: boolean; error?: string }> {
  currentUpdateState = {
    ...currentUpdateState,
    isApplying: true,
  };
  notifyUpdateListeners();

  try {
    if (isDesktopApp()) {
      const res = await applyDesktopUpdate(currentUpdateState.downloadUrl);
      if (!res.success) {
        currentUpdateState = {
          ...currentUpdateState,
          isApplying: false,
          error: res.error,
        };
        notifyUpdateListeners();
        return { success: false, error: res.error };
      }
      return { success: true };
    } else {
      // Entorno Web: Forzar recarga de versión desde CDN Cloudflare Pages
      if (typeof window !== 'undefined') {
        // Cache-busting reload
        const url = new URL(window.location.href);
        url.searchParams.set('v_sync', Date.now().toString());
        window.location.href = url.toString();
      }
      return { success: true };
    }
  } catch (err: any) {
    currentUpdateState = {
      ...currentUpdateState,
      isApplying: false,
      error: err?.message || 'Error al aplicar actualización',
    };
    notifyUpdateListeners();
    return { success: false, error: err?.message };
  }
}

/**
 * Se ejecuta al cerrar sesión. Si hay una actualización disponible (o se detecta al consultar),
 * se aplica de forma automática para que el próximo ingreso esté 100% actualizado.
 */
export async function checkAndApplyUpdateOnLogout(): Promise<void> {
  try {
    // Si ya sabíamos que hay una actualización lista
    if (currentUpdateState.hasUpdate) {
      console.log('[AutoUpdateManager] Aplicando actualización pendiente durante el cierre de sesión...');
      await applyUpdateNow();
      return;
    }

    // Si hay conexión, hacer una comprobación rápida de 1.5s
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const checkRes = await Promise.race([
        checkDesktopUpdate(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);

      if (checkRes && checkRes.has_update) {
        console.log('[AutoUpdateManager] Nueva versión detectada al cerrar sesión. Aplicando actualización...');
        if (isDesktopApp()) {
          await applyDesktopUpdate(checkRes.download_url);
        } else if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('v_sync', Date.now().toString());
          window.location.href = url.toString();
        }
      }
    }
  } catch (err) {
    console.warn('[AutoUpdateManager] Error comprobando actualización durante logout:', err);
  }
}

// ----------------------------------------------------------------------------
// DISPARADORES AUTOMÁTICOS (INICIO, RECONEXIÓN Y PERIÓDICO)
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  // 1. Comprobación inicial al arrancar
  setTimeout(() => {
    checkForUpdates(true).catch(() => {});
  }, 2500);

  // 2. Comprobación en cada reconexión a internet física
  window.addEventListener('online', () => {
    console.log('[AutoUpdateManager] Reconexión de red detectada: verificando si hay versión nueva...');
    checkForUpdates(false).catch(() => {});
  });

  // 3. Comprobación periódica cada 5 minutos
  setInterval(() => {
    if (navigator.onLine) {
      checkForUpdates(true).catch(() => {});
    }
  }, 5 * 60 * 1000);
}
