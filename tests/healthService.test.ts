// ============================================================================
// CISCO AUTOMATED v2.12.0 - SYSTEM HEALTH & DIAGNOSTIC SERVICE TEST SUITE
// ============================================================================

import assert from 'node:assert/strict';

// Polyfill in-memory localStorage for Node.js execution before importing storage modules
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

import {
  getLocalStorageMetrics,
  checkExchangeRatesHealth,
  checkRuntimeEnvironment,
  calculateOverallHealth,
  repairStorageCache,
  exportDiagnosticReportMarkdown,
} from '../src/modules/health/healthService';
import {
  getModernStorageQuota,
  optimizeAndMigrateLocalStorage,
  formatStorageBytes,
} from '../src/core/storage/modernStorageEngine';
import { HealthCheckResult, SystemHealthReport } from '../src/modules/health/healthTypes';

console.log('🧪 Iniciando Suite de Pruebas: Monitor de Salud & Diagnóstico (v2.12.0)...');

// Test 1: LocalStorage Metrics
localStorage.clear();
localStorage.setItem('test_health_1', 'abc');
localStorage.setItem('test_health_2', '1234567890');
const metrics = getLocalStorageMetrics();
assert.ok(metrics.bytes > 0, 'Bytes de LocalStorage deben ser mayores a 0');
assert.ok(metrics.formatted.includes('MB'), 'Métrica formateada debe incluir MB');
assert.ok(metrics.pct >= 0 && metrics.pct <= 100, 'Porcentaje debe estar entre 0 y 100');
console.log('  ✅ Test 1: Métricas de LocalStorage calculadas correctamente.');

// Test 2: Exchange Rates Health
const ratesHealth = checkExchangeRatesHealth();
assert.equal(ratesHealth.result.id, 'rates');
assert.equal(ratesHealth.result.category, 'external');
assert.ok(ratesHealth.metrics.usdObs > 0, 'Dólar observado debe ser mayor a 0');
assert.ok(ratesHealth.metrics.uf > 0, 'UF debe ser mayor a 0');
assert.equal(ratesHealth.metrics.effectiveUsd, ratesHealth.metrics.usdObs);
assert.equal(ratesHealth.result.status, 'healthy');
console.log('  ✅ Test 2: Diagnóstico de Indicadores Oficiales BCCh validado.');

// Test 3: Runtime Environment
const runtimeHealth = checkRuntimeEnvironment();
assert.equal(runtimeHealth.result.id, 'runtime');
assert.equal(typeof runtimeHealth.metrics.isDesktop, 'boolean');
assert.equal(typeof runtimeHealth.metrics.isOnline, 'boolean');
assert.ok(runtimeHealth.metrics.sessionUptimeMinutes >= 0);
assert.equal(runtimeHealth.result.status, 'healthy');
console.log('  ✅ Test 3: Diagnóstico de Entorno de Ejecución & Red validado.');

// Test 4: Weighted Health Score Calculation
const healthyChecks: HealthCheckResult[] = [
  { id: 'firestore', name: 'Firestore', category: 'cloud', status: 'healthy', latencyMs: 15, message: 'OK', lastChecked: '' },
  { id: 'storage', name: 'Storage', category: 'storage', status: 'healthy', latencyMs: 1, message: 'OK', lastChecked: '' },
  { id: 'rates', name: 'Rates', category: 'external', status: 'healthy', latencyMs: 1, message: 'OK', lastChecked: '' },
  { id: 'cdn', name: 'CDN', category: 'cloud', status: 'healthy', latencyMs: 20, message: 'OK', lastChecked: '' },
];
const healthyScore = calculateOverallHealth(healthyChecks);
assert.equal(healthyScore.score, 100, 'Score con todos los checks sanos debe ser 100');
assert.equal(healthyScore.status, 'healthy');

const degradedChecks: HealthCheckResult[] = [
  { id: 'firestore', name: 'Firestore', category: 'cloud', status: 'degraded', latencyMs: 80, message: 'Slow', lastChecked: '' },
  { id: 'storage', name: 'Storage', category: 'storage', status: 'healthy', latencyMs: 1, message: 'OK', lastChecked: '' },
  { id: 'rates', name: 'Rates', category: 'external', status: 'healthy', latencyMs: 1, message: 'OK', lastChecked: '' },
  { id: 'cdn', name: 'CDN', category: 'cloud', status: 'healthy', latencyMs: 20, message: 'OK', lastChecked: '' },
];
const degradedScore = calculateOverallHealth(degradedChecks);
assert.ok(degradedScore.score < 100 && degradedScore.score > 70, 'Score degradado debe ser menor a 100 y mayor a 70');

const criticalChecks: HealthCheckResult[] = [
  { id: 'firestore', name: 'Firestore', category: 'cloud', status: 'critical', latencyMs: 0, message: 'Down', lastChecked: '' },
  { id: 'storage', name: 'Storage', category: 'storage', status: 'critical', latencyMs: 0, message: 'Down', lastChecked: '' },
];
const criticalScore = calculateOverallHealth(criticalChecks);
assert.equal(criticalScore.score, 0, 'Score con componentes críticos caídos debe ser 0');
assert.equal(criticalScore.status, 'critical');
console.log('  ✅ Test 4: Ponderación de Score de Salud (100, degradado y crítico) validada.');

// Test 5: Storage Cache Repair
localStorage.setItem('cisco_pipeline_vault_v1', '{"deal":"123"}');
localStorage.setItem('temp_export_123', 'stale-data');
localStorage.setItem('cache_log_old', 'log-data');
const repairRes = repairStorageCache();
assert.equal(repairRes.clearedKeys, 2, 'Debe limpiar exactamente las 2 claves temporales');
assert.ok(repairRes.freedBytes > 0, 'Debe reportar bytes liberados');
assert.equal(localStorage.getItem('cisco_pipeline_vault_v1'), '{"deal":"123"}', 'Bóveda de negocio debe permanecer intacta');
assert.equal(localStorage.getItem('temp_export_123'), null);
assert.equal(localStorage.getItem('cache_log_old'), null);
console.log('  ✅ Test 5: Auto-reparación y purga de caché residual validada.');

// Test 6: Markdown Diagnostic Report Formatting
const mockReport: SystemHealthReport = {
  overallStatus: 'healthy',
  score: 98,
  timestamp: '2026-11-14T20:00:00.000Z',
  appVersion: 'v2.12.0',
  checks: {
    firestore: {
      id: 'firestore',
      name: 'Firestore',
      category: 'cloud',
      status: 'healthy',
      latencyMs: 18,
      message: 'Todo en orden',
      lastChecked: '',
    },
  },
  storage: {
    storageManagerSupported: true,
    storageManagerUsageBytes: 15000000,
    storageManagerQuotaBytes: 53687091200,
    storageManagerUsageFormatted: '14.3 MB',
    storageManagerQuotaFormatted: '50.00 GB',
    storageManagerPct: 0.03,
    isPersistentStorage: true,
    storageEngineName: 'StorageManager / IndexedDB',
    localStorageBytes: 500000,
    localStorageFormatted: '0.48 MB (10%)',
    localStoragePct: 10,
    indexedDbSupported: true,
    indexedDbReady: true,
    offlineQueueCount: 0,
    offlineQueueFailedCount: 0,
    tombstonesCount: 0,
  },
  runtime: {
    isDesktop: false,
    isOnline: true,
    isManualOffline: false,
    userAgent: 'Mozilla/5.0 Node',
    heapUsedMb: 45,
    heapTotalMb: 120,
    sessionUptimeMinutes: 15,
  },
  rates: {
    usdObs: 979.5,
    uf: 38255.4,
    spreadClp: 10,
    effectiveUsd: 989.5,
    provider: 'Mindicador',
    dateKey: '2026-11-14',
    lastUpdated: '2026-11-14T10:00:00Z',
    isCached: true,
  },
};
const md = exportDiagnosticReportMarkdown(mockReport);
assert.ok(md.includes('# 🏥 REPORTE DE SALUD Y DIAGNÓSTICO DEL SISTEMA'));
assert.ok(md.includes('v2.12.0'));
assert.ok(md.includes('98/100'));
assert.ok(md.includes('Firestore'));
assert.ok(md.includes('0.48 MB (10%)'));
assert.ok(md.includes('$979.50 CLP'));
assert.ok(md.includes('Dólar Actual (BCCh)'));
console.log('  ✅ Test 6: Exportación de reporte Markdown estructurado validada.');

// Test 7: Motor Moderno de Alta Capacidad (StorageManager / IndexedDB - Gigabytes)
const modernQuota = await getModernStorageQuota();
assert.ok(modernQuota.quotaBytes > 1024 * 1024 * 1024, 'La cuota moderna debe soportar Gigabytes');
assert.ok(modernQuota.quotaFormatted.includes('GB'), 'Cuota formateada debe expresar Gigabytes');
assert.ok(typeof modernQuota.isSupported === 'boolean');
assert.ok(formatStorageBytes(1073741824).includes('1.00 GB'));

// Simular clave pesada de respaldo para verificar optimización y purga de LocalStorage
localStorage.setItem('cisco_automated_emergency_vault_backup_v1', JSON.stringify({ heavy: 'x'.repeat(2000) }));
const optRes = await optimizeAndMigrateLocalStorage();
assert.ok(optRes.clearedKeys.includes('cisco_automated_emergency_vault_backup_v1'), 'Debe migrar y purgar el respaldo masivo de LocalStorage');
assert.equal(localStorage.getItem('cisco_automated_emergency_vault_backup_v1'), null, 'Respaldo masivo no debe permanecer en LocalStorage');
console.log('  ✅ Test 7: Motor Moderno de Alta Capacidad (Gigabytes) y purga de LocalStorage validados.');

console.log('🎉 ¡TODAS LAS PRUEBAS DE SALUD Y DIAGNÓSTICO (v2.12.0) PASARON AL 100%!');
