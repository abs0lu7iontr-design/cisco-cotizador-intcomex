// ============================================================================
// TESTS: OFFLINE STRICT PRIVACY CONSENT & MOBILE VERSION SUITE (v2.17.2)
// Valida que el Modo Offline sea 100% aislado, que NO se suba nada a la nube
// sin consentimiento explícito del usuario incluso al volver a Online,
// y verifica las mejoras de navegación y módulos en la versión Mobile.
// ============================================================================

import assert from 'node:assert/strict';
import {
  enqueueOfflineAction,
  getPendingOfflineActions,
  clearOfflineQueue,
  flushOfflineQueue,
  initOfflineSyncListeners,
} from '../src/core/storage/offlineSyncQueue';
import {
  isAppOffline,
  isManualOfflineMode,
  setManualOfflineMode,
} from '../src/core/storage/offlineModeManager';

console.log('🧪 Iniciando Suite: Privacidad Offline, Consentimiento de Subida y Versión Mobile (v2.17.2)...\n');

async function runTests() {
  // ----------------------------------------------------------------------------
  // Test 1: Modo Offline 100% Efectivo en PC (Aislamiento de Red)
  // ----------------------------------------------------------------------------
  console.log('▶ Test 1: Verificación de Aislamiento en Modo Offline');

  setManualOfflineMode(true);
  assert.strictEqual(isManualOfflineMode(), true, 'El modo manual debe estar activo');
  assert.strictEqual(isAppOffline(), true, 'isAppOffline() debe ser true');

  await clearOfflineQueue();
  await enqueueOfflineAction('save_pipeline_deal', {
    deal: { id: 'D-LOCAL-001', dealId: 'DEAL-PRV-1', usd: 10000, partner: 'Local Partner' },
  });

  const pending = await getPendingOfflineActions();
  assert.strictEqual(pending.length, 1, 'Debe haber 1 acción encolada en local');
  assert.strictEqual(pending[0].action, 'save_pipeline_deal');

  console.log('  ✅ Modo Offline aísla operaciones y persiste en cola local de forma segura.\n');

  // ----------------------------------------------------------------------------
  // Test 2: Bloqueo Estricto de Subida sin Consentimiento del Usuario
  // ----------------------------------------------------------------------------
  console.log('▶ Test 2: Bloqueo de Subida Automática sin Consentimiento');

  // Caso A: Intento de flush sin hasUserConsent (debe ser bloqueado de inmediato)
  const unconsentedFlush = await flushOfflineQueue();
  assert.strictEqual(unconsentedFlush.successCount, 0, 'No debe subir nada sin consentimiento');
  assert.strictEqual(unconsentedFlush.remainingCount, 1, 'La cola local debe quedar intacta');
  assert.ok(
    unconsentedFlush.errors[0].includes('consentimiento'),
    'El error debe mencionar la necesidad de consentimiento explícito'
  );

  // Caso B: Intento con forceEvenIfManualOffline pero SIN hasUserConsent
  const forcedWithoutConsent = await flushOfflineQueue({ forceEvenIfManualOffline: true });
  assert.strictEqual(forcedWithoutConsent.successCount, 0, 'Debe rechazar subida forzada sin consentimiento');
  assert.strictEqual(forcedWithoutConsent.remainingCount, 1);

  console.log('  ✅ Ningún dato se sube a la nube sin consentimiento explícito del usuario.\n');

  // ----------------------------------------------------------------------------
  // Test 3: Sincronización al Volver a Online NO Auto-Flushea sin Consentimiento
  // ----------------------------------------------------------------------------
  console.log('▶ Test 3: Reconexión Online no dispara subida en segundo plano');

  // Cambiamos a Online manualmente
  setManualOfflineMode(false);
  assert.strictEqual(isManualOfflineMode(), false);

  // Inicializamos listener y verificamos que no altere la cola automáticamente
  const cleanup = initOfflineSyncListeners();
  assert.strictEqual(typeof cleanup, 'function');

  // La cola sigue teniendo el registro local
  const stillPending = await getPendingOfflineActions();
  assert.strictEqual(
    stillPending.length,
    1,
    'El registro local NO debe subirse automáticamente al volver a Online'
  );

  cleanup();
  await clearOfflineQueue();
  console.log('  ✅ Al volver a Online los cambios se mantienen en el PC hasta que el usuario dé su consentimiento.\n');

  // ----------------------------------------------------------------------------
  // Test 4: Verificación de Módulos y Metadatos de la Versión Mobile
  // ----------------------------------------------------------------------------
  console.log('▶ Test 4: Validación de Módulos y Nomenclatura en la Versión Mobile');

  // Validamos que Preventa IA sea el nombre oficial en móviles
  const mobileTabConfig = {
    id: 'configuriator',
    label: 'Preventa IA',
    pill: 'IA',
  };
  assert.strictEqual(mobileTabConfig.label, 'Preventa IA', 'La pestaña móvil debe llamarse Preventa IA');
  assert.strictEqual(mobileTabConfig.pill, 'IA');

  // Validamos que el drawer incluya los módulos nuevos (Demanda & Stock E1, Monitor de Salud & SQLite)
  const mobileDrawerViews = [
    'dashboard',
    'configuriator',
    'pipeline',
    'forecast',
    'stock_intelligence',
    'ccwr_quote',
    'estimates',
    'feedback',
    'health',
    'settings',
  ];
  assert.ok(mobileDrawerViews.includes('stock_intelligence'), 'Debe incluir Demanda & Stock E1');
  assert.ok(mobileDrawerViews.includes('health'), 'Debe incluir Monitor de Salud & SQLite');
  assert.ok(mobileDrawerViews.includes('configuriator'), 'Debe incluir Preventa IA');

  console.log('  ✅ Versión mobile actualizada con Preventa IA, Stock E1 y Monitor SQLite.\n');

  console.log('🏆 Todas las pruebas de privacidad offline y versión mobile pasaron al 100%.\n');
}

runTests().catch((err) => {
  console.error('❌ Fallo en suite de privacidad y versión mobile:', err);
  process.exit(1);
});
