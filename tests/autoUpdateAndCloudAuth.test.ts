// ============================================================================
// CISCO AUTOMATED v2.15.1 - AUTO-UPDATE CHECK & CLOUD-ONLY AUTH TEST SUITE
// ============================================================================

import assert from 'node:assert/strict';

// Polyfill in-memory localStorage for Node.js test execution
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

import { isNewerVersion } from '../src/core/appVersion';
import {
  saveLocalUsersCache,
  getLocalUsersCache,
  authenticateCloudUser,
  DEFAULT_BASE_USERS,
} from '../src/modules/cloud/firestoreService';
import {
  repairStorageCache,
  getLocalStorageMetrics,
} from '../src/modules/health/healthService';
import {
  optimizeAndMigrateLocalStorage,
} from '../src/core/storage/modernStorageEngine';

console.log('🧪 Iniciando Suite de Pruebas: Auto-Update Permanente, Seguridad de Credenciales & Alta Capacidad...');

// Test 1: SemVer Version Comparison (isNewerVersion)
console.log('  Testing SemVer Comparison...');
assert.equal(isNewerVersion('2.15.1', '2.15.0'), true, '2.15.1 debe ser mayor a 2.15.0');
assert.equal(isNewerVersion('2.16.0', '2.15.0'), true, '2.16.0 debe ser mayor a 2.15.0');
assert.equal(isNewerVersion('3.0.0', '2.15.0'), true, '3.0.0 debe ser mayor a 2.15.0');
assert.equal(isNewerVersion('2.15.0', '2.15.0'), false, 'Misma versión debe ser false');
assert.equal(isNewerVersion('2.14.9', '2.15.0'), false, 'Versión menor debe ser false');
assert.equal(isNewerVersion('v2.16.0', '2.15.0'), true, 'Prefijo v debe parsearse correctamente');
console.log('  ✅ Test 1: Comparador SemVer isNewerVersion verificado exitosamente.');

// Test 2: Passwords are NEVER saved locally (saveLocalUsersCache & getLocalUsersCache)
console.log('  Testing Password Stripping from Local Storage...');
localStorage.clear();

// Guardar lista con password_hash
const rawUsersWithPasswords = [
  {
    username: 'test_admin',
    full_name: 'Admin Test',
    email: 'admin@test.local',
    role: 'admin' as const,
    password_hash: 'secret_hash_12345',
    is_active: 1,
  },
  {
    username: 'test_pm',
    full_name: 'PM Test',
    email: 'pm@test.local',
    role: 'pm' as const,
    password_hash: 'another_secret_hash_67890',
    is_active: 1,
  },
];

saveLocalUsersCache(rawUsersWithPasswords as any);

// Verificar lo que quedó en localStorage físicamente
const storedRaw = localStorage.getItem('cisco_users_cloud_cache_v2');
assert.ok(storedRaw !== null, 'Debe existir la clave de caché de usuarios');
assert.equal(storedRaw.includes('secret_hash_12345'), false, 'password_hash NUNCA debe guardarse en localStorage');
assert.equal(storedRaw.includes('another_secret_hash_67890'), false, 'password_hash NUNCA debe guardarse en localStorage');
assert.equal(localStorage.getItem('cisco_users_local'), null, 'La clave legacy cisco_users_local debe ser eliminada');

// Verificar getLocalUsersCache
const cachedUsers = getLocalUsersCache();
for (const u of cachedUsers) {
  assert.equal(u.password_hash, undefined, 'Ningún usuario devuelto por getLocalUsersCache debe tener password_hash');
}
console.log('  ✅ Test 2: Las contraseñas quedan estrictamente excluidas de cualquier almacenamiento local.');

// Test 3: Large LocalStorage Keys are cleaned & migrated to Modern Engine
console.log('  Testing Modern Storage Migration & LocalStorage Cleanup...');
localStorage.clear();

// Simular claves pesadas que saturaban LocalStorage a 9.99 MB (como en la captura del usuario)
const hugeDummyPayload = JSON.stringify(Array.from({ length: 500 }, (_, i) => ({
  id: `dsv_${i}`,
  soNumber: `SO_${i}`,
  customerName: `Customer_${i}`,
  items: Array.from({ length: 10 }, (_, j) => ({ sku: `SKU_${i}_${j}`, qty: 5, price: 100 })),
})));

localStorage.setItem('cisco_cloud_dsv_cache_v2', hugeDummyPayload);
localStorage.setItem('cisco_dsv_permanent_vault_v1', hugeDummyPayload);
localStorage.setItem('cisco_partners_xcl_cache_v2', hugeDummyPayload);

// Verificar que LocalStorage esté saturado antes de optimizar
const saturatedMetrics = getLocalStorageMetrics();
assert.ok(saturatedMetrics.bytes > 100_000, 'LocalStorage debe tener datos pesados cargados');

// Ejecutar reparación
const repairResult = repairStorageCache();
assert.ok(repairResult.clearedKeys > 0, 'repairStorageCache debe haber detectado y limpiado claves masivas');

// Ejecutar optimización profunda
await optimizeAndMigrateLocalStorage();

// Verificar que las claves masivas hayan sido eliminadas de LocalStorage
assert.equal(localStorage.getItem('cisco_dsv_permanent_vault_v1'), null, 'cisco_dsv_permanent_vault_v1 debe estar purgado');
const remainingMetrics = getLocalStorageMetrics();
assert.ok(remainingMetrics.pct < 5, 'Uso de LocalStorage debe caer drásticamente tras la optimización');
console.log('  ✅ Test 3: Optimización y purga de LocalStorage masivo comprobada exitosamente.');

// Test 4: Offline Login Cloud Requirement
console.log('  Testing Cloud-Only Authentication Requirement...');
const offlineAuthResult = await authenticateCloudUser('admin', 'Intcomex2026!');
// En entorno Node.js / offline, debe indicar bloqueo por falta de conexión o credenciales de la nube
assert.equal(offlineAuthResult.success, false, 'No se debe autenticar sin conexión segura a la nube');
assert.ok(
  offlineAuthResult.error?.includes('nube') ||
  offlineAuthResult.error?.includes('seguridad') ||
  offlineAuthResult.error?.includes('Firebase') ||
  offlineAuthResult.error?.includes('Internet') ||
  offlineAuthResult.error?.includes('conexión'),
  'El mensaje de error debe indicar requerimiento de conexión a la nube'
);
console.log('  ✅ Test 4: Autenticación 100% en la nube y protección offline comprobadas.');

console.log('🎉 TODAS LAS PRUEBAS DE AUTO-UPDATE Y SEGURIDAD CLOUD PASARON SATISFACTORIAMENTE.');
