// ============================================================================
// CISCO AUTOMATED - SERVICE WORKER & PWA INSTALLATION MANAGER (v2.22.0)
// Manages registration of /sw.js, update lifecycle and PWA install events.
// ============================================================================

import { triggerGlobalToast } from '../context/ToastContext';

let deferredInstallPrompt: any = null;

/**
 * Registra el Service Worker en el navegador para habilitar capacidades PWA y caché offline.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Evitar registrar Service Worker en entornos PyWebView Desktop (.exe)
  if (Boolean((window as any).pywebview?.api)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado con éxito. Scope:', registration.scope);

        // Detectar si hay una nueva versión del Service Worker lista
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nueva actualización de la aplicación disponible en segundo plano.');
                triggerGlobalToast(
                  '✨ Nueva actualización de la aplicación disponible. Puedes refrescar para cargarla.',
                  'info',
                  6000
                );
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] No se pudo registrar el Service Worker:', err);
      });
  });

  // Capturar evento beforeinstallprompt para permitir instalación PWA asistida
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Aplicación lista para instalarse como aplicación de escritorio o móvil.');
  });
}

/**
 * Retorna true si el navegador tiene disponible el prompt de instalación PWA.
 */
export function canInstallPwa(): boolean {
  return Boolean(deferredInstallPrompt);
}

/**
 * Dispara el diálogo nativo de instalación PWA ("Agregar a pantalla de inicio").
 */
export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return outcome === 'accepted';
  } catch (err) {
    console.warn('[PWA] Error en prompt de instalación:', err);
    return false;
  }
}
