// ============================================================================
// CISCO AUTOMATED v2.14.0 - LOCAL DEVICE PLATFORM CONFIGURATION (LOCAL-FIRST)
// Persistencia por computador/equipo de:
// - Modo Offline / Online permanente
// - Tema visual y experiencia UI (Cyber HUD / Enterprise, Aesthetic / Classic)
// - Parámetros comerciales base (Margen, Internación, Arancel)
// - Preferencias de interfaz (pestañas, paneles, cliente) y último usuario
// Garantiza funcionamiento 100% autosuficiente sin depender de la nube.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { QuoteParameters, PricingParameterMode } from '../types';

export const LOCAL_PLATFORM_CONFIG_STORAGE_KEY = 'cisco_local_platform_config_v2';
export const LOCAL_PLATFORM_CONFIG_CHANGED_EVENT = 'cisco-local-platform-config-changed';

export interface LocalPlatformConfig {
  version: number;
  isManualOffline: boolean;
  themeId: string;
  appTheme: 'cyber' | 'enterprise';
  uiMode: 'classic' | 'aesthetic';
  defaultParams: {
    internacionPct: number;
    arancelPct: number;
    margenPct: number;
    parameterMode: PricingParameterMode;
  };
  rememberLastUser: boolean;
  lastUsername: string;
  isClientMode: boolean;
  activeQuoterTab: 'excel' | 'table' | 'calculator';
  navSidebarOpen: boolean;
  paramSidebarOpen: boolean;
  lastSavedAt: string;
}

export const FACTORY_DEFAULT_PLATFORM_CONFIG: LocalPlatformConfig = {
  version: 2,
  isManualOffline: false,
  themeId: 'cisco-blue',
  appTheme: 'cyber',
  uiMode: 'classic',
  defaultParams: {
    internacionPct: 7.0,
    arancelPct: 6.0,
    margenPct: 5.0,
    parameterMode: 'standard',
  },
  rememberLastUser: true,
  lastUsername: '',
  isClientMode: false,
  activeQuoterTab: 'excel',
  navSidebarOpen: true,
  paramSidebarOpen: true,
  lastSavedAt: new Date().toISOString(),
};

let memoryConfigCache: LocalPlatformConfig | null = null;
let configVersion = 0;
const configListeners = new Set<() => void>();

function notifyConfigChanged(): void {
  configVersion += 1;
  for (const listener of Array.from(configListeners)) {
    try {
      listener();
    } catch {}
  }
}

/**
 * Lee la configuración local del equipo desde localStorage con tolerancia a fallos y migración de claves previas.
 */
export function getLocalPlatformConfig(): LocalPlatformConfig {
  if (memoryConfigCache !== null) {
    return memoryConfigCache;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_PLATFORM_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Saneamiento obligatorio: limpiar 'pm_cisco' heredado de valores de prueba anteriores
        const cleanLastUsername = parsed.lastUsername === 'pm_cisco' ? '' : (parsed.lastUsername || '');
        memoryConfigCache = {
          ...FACTORY_DEFAULT_PLATFORM_CONFIG,
          ...parsed,
          lastUsername: cleanLastUsername,
          defaultParams: {
            ...FACTORY_DEFAULT_PLATFORM_CONFIG.defaultParams,
            ...(parsed.defaultParams || {}),
          },
        };

        // Si se saneó 'pm_cisco', actualizar de inmediato la persistencia en disco
        if (parsed.lastUsername === 'pm_cisco') {
          try {
            localStorage.setItem(LOCAL_PLATFORM_CONFIG_STORAGE_KEY, JSON.stringify(memoryConfigCache));
          } catch {}
        }
        return memoryConfigCache;
      }

      // Migración inicial desde claves individuales históricas del PC
      const legacyManualOffline = localStorage.getItem('cisco_manual_offline_mode_v1') === 'true';
      const legacyTheme = localStorage.getItem('cisco_active_theme_id') || 'cisco-blue';
      const legacyAppTheme = (localStorage.getItem('cisco_app_theme') as any) || 'cyber';
      const legacyUiMode = (localStorage.getItem('cisco_ui_experience_mode') as any) || 'classic';
      const legacyClientMode = localStorage.getItem('cisco_client_presentation_mode') === 'true';

      memoryConfigCache = {
        ...FACTORY_DEFAULT_PLATFORM_CONFIG,
        isManualOffline: legacyManualOffline,
        themeId: legacyTheme,
        appTheme: legacyAppTheme,
        uiMode: legacyUiMode,
        isClientMode: legacyClientMode,
        lastSavedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(
          LOCAL_PLATFORM_CONFIG_STORAGE_KEY,
          JSON.stringify(memoryConfigCache)
        );
      } catch {}

      return memoryConfigCache;
    }
  } catch (_) {}

  memoryConfigCache = { ...FACTORY_DEFAULT_PLATFORM_CONFIG };
  return memoryConfigCache;
}

/**
 * Guarda o actualiza campos específicos en la configuración local de este equipo.
 */
export function saveLocalPlatformConfig(
  partial: Partial<LocalPlatformConfig>
): LocalPlatformConfig {
  const current = getLocalPlatformConfig();
  const next: LocalPlatformConfig = {
    ...current,
    ...partial,
    defaultParams: {
      ...current.defaultParams,
      ...(partial.defaultParams || {}),
    },
    lastSavedAt: new Date().toISOString(),
  };

  memoryConfigCache = next;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_PLATFORM_CONFIG_STORAGE_KEY, JSON.stringify(next));

      // Sincronizar compatibilidad con claves de legacy
      if (typeof partial.isManualOffline === 'boolean') {
        localStorage.setItem('cisco_manual_offline_mode_v1', String(partial.isManualOffline));
      }
      if (partial.themeId) {
        localStorage.setItem('cisco_active_theme_id', partial.themeId);
      }
      if (partial.appTheme) {
        localStorage.setItem('cisco_app_theme', partial.appTheme);
      }
      if (partial.uiMode) {
        localStorage.setItem('cisco_ui_experience_mode', partial.uiMode);
      }
      if (typeof partial.isClientMode === 'boolean') {
        localStorage.setItem('cisco_client_presentation_mode', String(partial.isClientMode));
      }
    }
  } catch (_) {}

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(LOCAL_PLATFORM_CONFIG_CHANGED_EVENT, { detail: next })
      );
    } catch {}
  }

  notifyConfigChanged();
  return next;
}

/**
 * Restablece la configuración del equipo a los valores de fábrica Intcomex Chile.
 */
export function resetLocalPlatformConfig(): LocalPlatformConfig {
  return saveLocalPlatformConfig(FACTORY_DEFAULT_PLATFORM_CONFIG);
}

/**
 * Suscribe un callback a cambios de configuración local.
 */
export function subscribeLocalPlatformConfig(listener: () => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

export function getLocalPlatformConfigSnapshot(): string {
  const cfg = getLocalPlatformConfig();
  return `${cfg.isManualOffline ? 'M1' : 'M0'}|${cfg.themeId}|${cfg.uiMode}|${cfg.appTheme}|${
    cfg.defaultParams.margenPct
  }|${configVersion}`;
}

/**
 * Hook reactivo compatible con React 19 para observar en vivo la configuración del equipo.
 */
export function useLocalPlatformConfig(): LocalPlatformConfig {
  useSyncExternalStore(
    subscribeLocalPlatformConfig,
    getLocalPlatformConfigSnapshot,
    getLocalPlatformConfigSnapshot
  );
  return getLocalPlatformConfig();
}
