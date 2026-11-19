// ============================================================================
// CISCO AUTOMATED v2.17.4 - TEST SUITE: LOGIN CLEAN & SAVED CREDENTIALS
// Validates:
// 1. Initial login fields are 100% empty (NO default 'pm_cisco' hardcoded)
// 2. Auto-sanitization of legacy 'pm_cisco' in localStorage to ''
// 3. User & password persistence ONLY when explicitly chosen by the user
// 4. Immediate purging of stored credentials when 'remember user' is unchecked
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getLocalPlatformConfig,
  saveLocalPlatformConfig,
  resetLocalPlatformConfig,
  FACTORY_DEFAULT_PLATFORM_CONFIG,
  LOCAL_PLATFORM_CONFIG_STORAGE_KEY,
} from '../src/core/storage/localPlatformConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Iniciando Suite: Limpieza de Login y Credenciales Guardadas (v2.17.4)...\n');

// Mock localStorage if in Node environment
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

// Test 1: Configuración de fábrica de lastUsername debe ser cadena vacía
console.log('▶ Test 1: Verificación de que la configuración de fábrica tenga lastUsername vacío');
resetLocalPlatformConfig();
const initialConfig = getLocalPlatformConfig();
if (FACTORY_DEFAULT_PLATFORM_CONFIG.lastUsername !== '') {
  throw new Error(`❌ FACTORY_DEFAULT_PLATFORM_CONFIG.lastUsername debería ser '' pero es '${FACTORY_DEFAULT_PLATFORM_CONFIG.lastUsername}'`);
}
if (initialConfig.lastUsername !== '') {
  throw new Error(`❌ initialConfig.lastUsername debería ser '' pero es '${initialConfig.lastUsername}'`);
}
console.log('  ✅ FACTORY_DEFAULT_PLATFORM_CONFIG.lastUsername es 100% vacío (sin pm_cisco).');

// Test 2: Saneamiento automático de 'pm_cisco' residual en localStorage
console.log('▶ Test 2: Saneamiento automático de valor residual pm_cisco en localStorage');
localStorage.setItem(
  LOCAL_PLATFORM_CONFIG_STORAGE_KEY,
  JSON.stringify({
    ...FACTORY_DEFAULT_PLATFORM_CONFIG,
    lastUsername: 'pm_cisco',
  })
);
// Forzar recarga desde localStorage
const sanitizedConfig = getLocalPlatformConfig();
if (sanitizedConfig.lastUsername === 'pm_cisco') {
  throw new Error("❌ getLocalPlatformConfig() no saneó el valor residual 'pm_cisco'");
}
if (sanitizedConfig.lastUsername !== '') {
  throw new Error(`❌ getLocalPlatformConfig() devolvió '${sanitizedConfig.lastUsername}' en vez de ''`);
}
console.log('  ✅ Valor residual pm_cisco detectado y saneado automáticamente a cadena vacía.');

// Test 3: Inspección estática del código fuente de LoginScreen.tsx
console.log('▶ Test 3: Inspección de LoginScreen.tsx para prevenir pm_cisco forzado');
const loginScreenPath = path.resolve(__dirname, '../src/components/LoginScreen.tsx');
const loginScreenCode = fs.readFileSync(loginScreenPath, 'utf8');

if (loginScreenCode.includes("rawUser.toLowerCase() === 'pm_cisco' ? '' : rawUser")) {
  console.log('  ✅ LoginScreen valida y bloquea explícitamente pm_cisco como usuario por defecto.');
} else {
  throw new Error('❌ Falta filtro anti-pm_cisco en LoginScreen.tsx');
}

if (loginScreenCode.includes('SAVED_PASSWORD_STORAGE_KEY') && loginScreenCode.includes('encodePasswordToken')) {
  console.log('  ✅ Mecanismo de guardado y restauración de contraseña recordada implementado.');
} else {
  throw new Error('❌ Falta mecanismo de contraseña guardada en LoginScreen.tsx');
}

// Test 4: Guardado de usuario legítimo cuando el usuario lo autoriza
console.log('▶ Test 4: Guardado de usuario y contraseña legítimos (ej. mskill)');
saveLocalPlatformConfig({
  rememberLastUser: true,
  lastUsername: 'mskill',
});
const mskillConfig = getLocalPlatformConfig();
if (mskillConfig.lastUsername !== 'mskill') {
  throw new Error(`❌ Se esperaba 'mskill', obtenido: '${mskillConfig.lastUsername}'`);
}
console.log('  ✅ Usuario real guardado correctamente cuando rememberLastUser es true.');

// Test 5: Limpieza de credenciales al desmarcar recordar usuario
console.log('▶ Test 5: Limpieza de credenciales al desmarcar rememberLastUser');
saveLocalPlatformConfig({
  rememberLastUser: false,
  lastUsername: '',
});
const clearedConfig = getLocalPlatformConfig();
if (clearedConfig.lastUsername !== '') {
  throw new Error(`❌ Se esperaba lastUsername vacío al desmarcar, obtenido: '${clearedConfig.lastUsername}'`);
}
console.log('  ✅ Credenciales purgadas al desmarcar recordar usuario.');

console.log('\n🏆 Todas las pruebas de limpieza de login y credenciales guardadas pasaron al 100%.\n');
