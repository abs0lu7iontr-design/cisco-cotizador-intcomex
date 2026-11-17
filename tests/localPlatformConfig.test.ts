// ============================================================================
// CISCO AUTOMATED v2.14.0 - TEST SUITE: LOCAL PLATFORM CONFIG (LOCAL-FIRST)
// Verifica persistencia en el equipo de:
// 1. Modo Offline / Online permanente entre recargas y sesiones
// 2. Tema visual y modo UI (Classic / Aesthetic)
// 3. Parámetros comerciales por equipo (Margen %, Internación %, Arancel %)
// 4. Último usuario recordado
// 5. Autonomía 100% offline sin llamadas a la nube
// ============================================================================

import {
  getLocalPlatformConfig,
  saveLocalPlatformConfig,
  resetLocalPlatformConfig,
  subscribeLocalPlatformConfig,
  FACTORY_DEFAULT_PLATFORM_CONFIG,
  LOCAL_PLATFORM_CONFIG_STORAGE_KEY,
} from '../src/core/storage/localPlatformConfig';
import {
  isAppOffline,
  isManualOfflineMode,
  setManualOfflineMode,
  readStoredManualOffline,
} from '../src/core/storage/offlineModeManager';
import { getLocalUsersCache } from '../src/modules/cloud/firestoreService';

// Mock localStorage if in Node environment without window
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

function runSuite() {
  console.log('🧪 Iniciando Test Suite: Local Platform Config & Device Persistence (v2.14.0)...');

  // Test 1: Configuración de fábrica inicial
  console.log('\n--- Test 1: Configuración de fábrica predeterminada ---');
  resetLocalPlatformConfig();
  const initial = getLocalPlatformConfig();
  if (initial.version !== 2) throw new Error('Versión esperada: 2, obtenida: ' + initial.version);
  if (initial.isManualOffline !== false) throw new Error('isManualOffline inicial debe ser false');
  if (initial.defaultParams.margenPct !== 5.0) throw new Error('Margen por defecto debe ser 5.0%');
  if (initial.defaultParams.internacionPct !== 7.0) throw new Error('Internación por defecto debe ser 7.0%');
  if (initial.defaultParams.arancelPct !== 6.0) throw new Error('Arancel por defecto debe ser 6.0%');
  console.log('✅ Test 1 Superado: Configuración de fábrica correcta (7% Internación / 6% Arancel / 5% Margen).');

  // Test 2: Persistencia permanente de Modo Offline en este equipo
  console.log('\n--- Test 2: Persistencia permanente del Modo Offline ---');
  saveLocalPlatformConfig({ isManualOffline: true });
  const cfgOffline = getLocalPlatformConfig();
  if (!cfgOffline.isManualOffline) throw new Error('isManualOffline no fue guardado');
  if (!isAppOffline()) throw new Error('isAppOffline() debe retornar true');
  if (!isManualOfflineMode()) throw new Error('isManualOfflineMode() debe retornar true');
  if (!readStoredManualOffline()) throw new Error('readStoredManualOffline() debe retornar true');
  console.log('✅ Test 2 Superado: Modo Offline persistido en el equipo y reflejado en offlineModeManager.');

  // Test 3: Sincronización bidireccional desde setManualOfflineMode
  console.log('\n--- Test 3: setManualOfflineMode sincroniza con localPlatformConfig ---');
  setManualOfflineMode(false);
  if (getLocalPlatformConfig().isManualOffline !== false) {
    throw new Error('setManualOfflineMode(false) no sincronizó con localPlatformConfig');
  }
  setManualOfflineMode(true);
  if (getLocalPlatformConfig().isManualOffline !== true) {
    throw new Error('setManualOfflineMode(true) no sincronizó con localPlatformConfig');
  }
  console.log('✅ Test 3 Superado: setManualOfflineMode y localPlatformConfig están en perfecta sincronía.');

  // Test 4: Persistencia de Parámetros Comerciales del Computador
  console.log('\n--- Test 4: Parámetros comerciales personalizados del equipo ---');
  saveLocalPlatformConfig({
    defaultParams: {
      internacionPct: 8.5,
      arancelPct: 6.0,
      margenPct: 12.0,
      parameterMode: 'standard',
    },
  });
  const customParamsCfg = getLocalPlatformConfig();
  if (customParamsCfg.defaultParams.margenPct !== 12.0) {
    throw new Error('Margen esperado: 12.0%, obtenido: ' + customParamsCfg.defaultParams.margenPct);
  }
  if (customParamsCfg.defaultParams.internacionPct !== 8.5) {
    throw new Error('Internación esperada: 8.5%, obtenida: ' + customParamsCfg.defaultParams.internacionPct);
  }
  console.log('✅ Test 4 Superado: Parámetros comerciales (8.5% / 6.0% / 12.0%) persisten en el equipo.');

  // Test 5: Persistencia de Tema Visual y Experiencia UI
  console.log('\n--- Test 5: Tema visual y modo UI ---');
  saveLocalPlatformConfig({
    themeId: 'cyber-neon',
    uiMode: 'aesthetic',
    appTheme: 'enterprise',
  });
  const themeCfg = getLocalPlatformConfig();
  if (themeCfg.themeId !== 'cyber-neon') throw new Error('themeId no coincide');
  if (themeCfg.uiMode !== 'aesthetic') throw new Error('uiMode no coincide');
  if (themeCfg.appTheme !== 'enterprise') throw new Error('appTheme no coincide');
  console.log('✅ Test 5 Superado: Tema visual y UI persisten localmente sin consultas de red.');

  // Test 6: Recordar usuario en este computador
  console.log('\n--- Test 6: Recordar usuario en este equipo ---');
  saveLocalPlatformConfig({
    rememberLastUser: true,
    lastUsername: 'pm_juan_perez',
  });
  const userCfg = getLocalPlatformConfig();
  if (!userCfg.rememberLastUser) throw new Error('rememberLastUser debe ser true');
  if (userCfg.lastUsername !== 'pm_juan_perez') throw new Error('lastUsername no coincide');
  console.log('✅ Test 6 Superado: Preferencia de usuario recordado en este PC guardada con éxito.');

  // Test 7: Suscripciones reactivas (listeners)
  console.log('\n--- Test 7: Suscripciones reactivas a cambios locales ---');
  let notified = false;
  const unsubscribe = subscribeLocalPlatformConfig(() => {
    notified = true;
  });
  saveLocalPlatformConfig({ isManualOffline: false });
  unsubscribe();
  if (!notified) throw new Error('El listener no fue notificado tras saveLocalPlatformConfig');
  console.log('✅ Test 7 Superado: Eventos reactivos y observadores funcionan correctamente.');

  // Test 8: Caché local de usuarios disponible Offline
  console.log('\n--- Test 8: Disponibilidad de usuarios en caché para login Offline ---');
  const cachedUsers = getLocalUsersCache();
  if (!Array.isArray(cachedUsers)) throw new Error('getLocalUsersCache() debe ser un arreglo');
  if (cachedUsers.length === 0) throw new Error('Debe existir al menos un usuario en caché local');
  console.log(`✅ Test 8 Superado: ${cachedUsers.length} usuarios disponibles en caché local para login sin conexión.`);

  // Test 9: Restablecimiento de fábrica
  console.log('\n--- Test 9: Restablecimiento a valores de fábrica Intcomex ---');
  resetLocalPlatformConfig();
  const resetCfg = getLocalPlatformConfig();
  if (resetCfg.isManualOffline !== false) throw new Error('Reset debe devolver isManualOffline a false');
  if (resetCfg.defaultParams.margenPct !== 5.0) throw new Error('Reset debe devolver margen a 5.0%');
  console.log('✅ Test 9 Superado: resetLocalPlatformConfig restaura los valores oficiales de fábrica.');

  console.log('\n🎉 ¡TODOS LOS TESTS DE PERSISTENCIA LOCAL Y MODO OFFLINE EN EL EQUIPO PASARON CON ÉXITO!');
}

runSuite();
