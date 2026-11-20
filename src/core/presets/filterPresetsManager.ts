// ============================================================================
// CISCO AUTOMATED v2.23.0 - FILTER PRESETS & SAVED VIEWS MANAGER
// Permite guardar combinaciones de filtros recurrentes por usuario y módulo
// (Pipeline Comercial, Forecast Comercial, Historial de Cotizaciones)
// ============================================================================

export type PresetModuleType = 'pipeline' | 'forecast' | 'estimates';

export interface FilterPreset<T = Record<string, any>> {
  id: string;
  name: string;
  module: PresetModuleType;
  description?: string;
  isFactory?: boolean;
  filters: T;
  createdAt: string;
  iconName?: string;
}

const STORAGE_PREFIX = 'cisco_filter_presets_';

const inMemoryPresetsStorage = new Map<string, string>();

function safeGetStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch (_) {}
  return inMemoryPresetsStorage.get(key) || null;
}

function safeSetStorageItem(key: string, value: string): void {
  inMemoryPresetsStorage.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch (_) {}
}

/**
 * Obtiene los presets de fábrica por defecto para cada módulo.
 */
export function getFactoryPresets(module: PresetModuleType, userPmName?: string | null, currentMonth?: string): FilterPreset[] {
  const month = currentMonth || 'Noviembre';
  const myPm = userPmName || 'Mauricio Skill';

  if (module === 'pipeline') {
    return [
      {
        id: 'factory_pipeline_my_deals',
        name: `👤 Mi Pipeline (${myPm.split(' ')[0]})`,
        module: 'pipeline',
        description: 'Muestra exclusivamente tus oportunidades asignadas en el mes actual.',
        isFactory: true,
        iconName: 'User',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: myPm,
          mesCierre: month,
          porcentajeAvance: 'ALL',
          grupoVentas: 'ALL',
          partner: 'ALL',
          searchQuery: '',
        },
      },
      {
        id: 'factory_pipeline_all_deals',
        name: '🌐 Vista General (Todos los PMs)',
        module: 'pipeline',
        description: 'Muestra todas las oportunidades de todo el equipo en el mes actual.',
        isFactory: true,
        iconName: 'Globe',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          mesCierre: month,
          porcentajeAvance: 'ALL',
          grupoVentas: 'ALL',
          partner: 'ALL',
          searchQuery: '',
        },
      },
      {
        id: 'factory_pipeline_hot_deals',
        name: '🔥 Oportunidades Calientes (>= 70%)',
        module: 'pipeline',
        description: 'Deals avanzados en fase de adjudicación o facturación.',
        isFactory: true,
        iconName: 'Flame',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          mesCierre: month,
          porcentajeAvance: 70,
          grupoVentas: 'ALL',
          partner: 'ALL',
          searchQuery: '',
        },
      },
      {
        id: 'factory_pipeline_annual_full',
        name: '📅 Histórico Completo (Todos los Meses)',
        module: 'pipeline',
        description: 'Panorama anual completo de todo el Pipeline acumulado.',
        isFactory: true,
        iconName: 'Calendar',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          mesCierre: 'ALL',
          porcentajeAvance: 'ALL',
          grupoVentas: 'ALL',
          partner: 'ALL',
          searchQuery: '',
        },
      },
    ];
  }

  if (module === 'forecast') {
    return [
      {
        id: 'factory_forecast_my_records',
        name: `👤 Mi Forecast (${myPm.split(' ')[0]})`,
        module: 'forecast',
        description: 'Tus negocios y proyecciones individuales del mes en curso.',
        isFactory: true,
        iconName: 'User',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: myPm,
          periodoMes: month,
          bodega: 'ALL',
          grupoVentas: 'ALL',
          credit: 'ALL',
          am: 'ALL',
          searchQuery: '',
          onlyWithReminders: false,
        },
      },
      {
        id: 'factory_forecast_all_records',
        name: '🌐 Vista General (Todos los PMs)',
        module: 'forecast',
        description: 'Proyección completa consolidada de todas las 36 columnas oficiales.',
        isFactory: true,
        iconName: 'Globe',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          periodoMes: month,
          bodega: 'ALL',
          grupoVentas: 'ALL',
          credit: 'ALL',
          am: 'ALL',
          searchQuery: '',
          onlyWithReminders: false,
        },
      },
      {
        id: 'factory_forecast_bodega_e1',
        name: '📦 Solo Bodega E1 (Física)',
        module: 'forecast',
        description: 'Equipos físicos con internación y despacho desde bodega local.',
        isFactory: true,
        iconName: 'Package',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          periodoMes: month,
          bodega: 'E1',
          grupoVentas: 'ALL',
          credit: 'ALL',
          am: 'ALL',
          searchQuery: '',
          onlyWithReminders: false,
        },
      },
      {
        id: 'factory_forecast_annual',
        name: '📅 Histórico Anual',
        module: 'forecast',
        description: 'Todos los periodos y meses consolidados.',
        isFactory: true,
        iconName: 'Calendar',
        createdAt: new Date().toISOString(),
        filters: {
          pmResponsable: 'ALL',
          periodoMes: 'ALL',
          bodega: 'ALL',
          grupoVentas: 'ALL',
          credit: 'ALL',
          am: 'ALL',
          searchQuery: '',
          onlyWithReminders: false,
        },
      },
    ];
  }

  // Estimates History
  return [
    {
      id: 'factory_estimates_all',
      name: '🌐 Todas las Cotizaciones',
      module: 'estimates',
      isFactory: true,
      iconName: 'Globe',
      createdAt: new Date().toISOString(),
      filters: {},
    },
  ];
}

/**
 * Carga los presets para un módulo (fábrica + personalizados guardados por el usuario).
 */
export function loadFilterPresets<T = Record<string, any>>(
  module: PresetModuleType,
  userPmName?: string | null,
  currentMonth?: string
): FilterPreset<T>[] {
  const factory = getFactoryPresets(module, userPmName, currentMonth);
  const customKey = `${STORAGE_PREFIX}${module}`;

  try {
    const stored = safeGetStorageItem(customKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return [...(factory as any), ...parsed];
      }
    }
  } catch (err) {
    console.warn('[FilterPresetsManager] Error leyendo presets personalizados:', err);
  }

  return factory as any;
}

/**
 * Guarda un preset personalizado del usuario.
 */
export function saveCustomFilterPreset<T = Record<string, any>>(
  module: PresetModuleType,
  name: string,
  filters: T,
  description?: string
): FilterPreset<T> {
  const customKey = `${STORAGE_PREFIX}${module}`;
  let existingCustom: FilterPreset<T>[] = [];

  try {
    const stored = safeGetStorageItem(customKey);
    if (stored) {
      existingCustom = JSON.parse(stored);
      if (!Array.isArray(existingCustom)) existingCustom = [];
    }
  } catch (err) {
    existingCustom = [];
  }

  const newPreset: FilterPreset<T> = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    module,
    description: description?.trim(),
    isFactory: false,
    filters,
    createdAt: new Date().toISOString(),
    iconName: 'Bookmark',
  };

  existingCustom.push(newPreset);

  try {
    safeSetStorageItem(customKey, JSON.stringify(existingCustom));
  } catch (err) {
    console.warn('[FilterPresetsManager] Error guardando preset personalizado:', err);
  }

  return newPreset;
}

/**
 * Elimina un preset personalizado por ID.
 */
export function deleteCustomFilterPreset(module: PresetModuleType, presetId: string): boolean {
  const customKey = `${STORAGE_PREFIX}${module}`;
  try {
    const stored = safeGetStorageItem(customKey);
    if (stored) {
      const existing: FilterPreset[] = JSON.parse(stored);
      if (Array.isArray(existing)) {
        const filtered = existing.filter((p) => p.id !== presetId);
        safeSetStorageItem(customKey, JSON.stringify(filtered));
        return true;
      }
    }
  } catch (err) {
    console.warn('[FilterPresetsManager] Error eliminando preset:', err);
  }
  return false;
}
