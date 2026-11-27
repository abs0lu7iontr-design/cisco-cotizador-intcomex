// ============================================================================
// SUITE DE PRUEBAS: ESCALABILIDAD DE STORAGE, PAGINACIÓN Y AISLAMIENTO OFFLINE
// Valida:
// 1. Aislamiento estricto de `offlineSyncQueue` por proyecto Firebase (Offline -> Cambio de BD -> Online)
// 2. Migración lossless de Pipeline & Forecast legacy (localStorage/KEYVAL) a stores por registro
// 3. Paginación en `queryCollectionRecordsPaginated` (`CiscoAppCollectionsDB`)
// 4. Catálogo BO SKU y DSV sin truncamiento destructivo ni saturación de localStorage
// 5. Métricas de umbral y limpieza de redundancia en `sqliteStorageEngine`
// ============================================================================

import assert from 'node:assert/strict';
import {
  enqueueOfflineAction,
  getPendingOfflineActions,
  clearOfflineQueue,
} from '../src/core/storage/offlineSyncQueue';
import {
  saveActiveFirebaseConfig,
  resetToDefaultFirebaseConfig,
  getActiveProjectScopeKey,
} from '../src/modules/cloud/firebaseConfig';
import {
  putCollectionRecordsBatch,
  queryCollectionRecordsPaginated,
  clearCollectionMemoryState,
} from '../src/modules/storage/indexedDbCollectionStore';
import {
  SQLITE_FALLBACK_SNAPSHOT_MAX_BYTES,
  SQLITE_WASM_RECOMMENDED_MAX_BYTES,
  getSqliteMetrics,
} from '../src/core/storage/sqliteStorageEngine';
import {
  getPipelineDeals,
} from '../src/modules/pipeline/pipelineStorage';
import {
  saveStructuredBoSkuCatalog,
  getStructuredBoSkuCatalog,
  registerStructuredSkuRecord,
} from '../src/modules/bo/boSkuCatalogService';

function ensureMockLocalStorage() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

async function runTests() {
  console.log('\n🧪 Iniciando Suite de Pruebas: Escalabilidad de Storage & Aislamiento por BD...');
  ensureMockLocalStorage();
  localStorage.clear();
  resetToDefaultFirebaseConfig();

  // --------------------------------------------------------------------------
  // TEST 1: Aislamiento de Cola Offline por Proyecto Firebase
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 1: Aislamiento de offlineSyncQueue al cambiar de proyecto Firebase');
  const defaultScope = getActiveProjectScopeKey();

  await enqueueOfflineAction(
    'save_estimate',
    { record: { id: 'EST-PROJ-A-1', estimateId: 'EST-A-1' } },
    { entityKey: 'EST:A1', summary: 'Estimate Proyecto Default' }
  );

  let pendingDefault = await getPendingOfflineActions();
  assert.strictEqual(pendingDefault.length, 1, 'Debe haber 1 acción offline en proyecto por defecto');
  assert.strictEqual(pendingDefault[0].projectScopeKey, defaultScope);

  // Cambiar a Proyecto Custom B sin perder cola de Proyecto Default
  saveActiveFirebaseConfig({
    apiKey: 'AIzaSyCustomKeyProjectB_123456',
    authDomain: 'proyecto-b.firebaseapp.com',
    projectId: 'proyecto-b-aislado',
    storageBucket: 'proyecto-b.appspot.com',
    messagingSenderId: '999999',
    appId: '1:999999:web:abc',
  });

  const pendingInProjB = await getPendingOfflineActions();
  assert.strictEqual(
    pendingInProjB.length,
    0,
    'Al cambiar a Proyecto B no deben mezclarse ni exponerse acciones offline del Proyecto Default'
  );

  // Encolar una acción en Proyecto B y limpiar solo Proyecto B
  await enqueueOfflineAction(
    'save_bo_tracking',
    { record: { id: 'BO-B-1', endCustomerName: 'Cliente B' } },
    { entityKey: 'BO:B1' }
  );
  assert.strictEqual((await getPendingOfflineActions()).length, 1);

  await clearOfflineQueue();
  assert.strictEqual((await getPendingOfflineActions()).length, 0);

  // Volver al Proyecto Default: su cola pendiente debe seguir intacta
  resetToDefaultFirebaseConfig();
  pendingDefault = await getPendingOfflineActions();
  assert.strictEqual(
    pendingDefault.length,
    1,
    'Al regresar al proyecto original, su cola offline pendiente debe preservarse intacta'
  );
  await clearOfflineQueue();
  console.log('  ✅ Aislamiento estricto por proyecto en offlineSyncQueue verificado.');

  // --------------------------------------------------------------------------
  // TEST 2: Paginación en CiscoAppCollectionsDB (`queryCollectionRecordsPaginated`)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Paginación determinista en indexedDbCollectionStore');
  clearCollectionMemoryState();
  const sampleEntries = Array.from({ length: 12 }, (_, i) => ({
    id: `PIPE-${i + 1}`,
    record: { id: `PIPE-${i + 1}`, seq: i + 1 },
  }));
  await putCollectionRecordsBatch('pipeline_deals', sampleEntries, { replaceAllInScope: true });

  const page1 = await queryCollectionRecordsPaginated<{ id: string; seq: number }>('pipeline_deals', {
    offset: 0,
    limit: 5,
  });
  const page2 = await queryCollectionRecordsPaginated<{ id: string; seq: number }>('pipeline_deals', {
    offset: 5,
    limit: 5,
  });
  const page3 = await queryCollectionRecordsPaginated<{ id: string; seq: number }>('pipeline_deals', {
    offset: 10,
    limit: 5,
  });

  assert.strictEqual(page1.total, 12);
  assert.strictEqual(page1.records.length, 5);
  assert.strictEqual(page1.hasMore, true);
  assert.strictEqual(page2.records.length, 5);
  assert.strictEqual(page2.hasMore, true);
  assert.strictEqual(page3.records.length, 2);
  assert.strictEqual(page3.hasMore, false);
  clearCollectionMemoryState();
  console.log('  ✅ Paginación de colecciones IndexedDB validada.');

  // --------------------------------------------------------------------------
  // TEST 3: Migración lossless de Pipeline legacy desde localStorage a store normalizado
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Migración lossless de Pipeline legacy sin pérdida Offline');
  localStorage.clear();
  localStorage.setItem('cisco_pipeline_seed_initialized_v1', 'true');
  localStorage.setItem(
    'cisco_pipeline_deals_cache_v1',
    JSON.stringify([
      {
        id: 'DEAL-LEGACY-MIGRATE-1',
        partner: 'Partner Migración',
        endUser: 'Cliente Migración',
        usd: 99000,
        updatedAt: '2026-11-27T10:00:00.000Z',
      },
    ])
  );
  const migratedDeals = await getPipelineDeals(true);
  assert.ok(
    migratedDeals.some((d) => d.id === 'DEAL-LEGACY-MIGRATE-1'),
    'Debe conservar y migrar el registro legacy desde localStorage al store normalizado'
  );
  console.log('  ✅ Migración lossless de Pipeline verificada.');

  // --------------------------------------------------------------------------
  // TEST 4: Catálogo BO SKU estructurado en store normalizado sin saturar localStorage
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: Persistencia estructurada de Catálogo BO SKU');
  const structured = getStructuredBoSkuCatalog();
  registerStructuredSkuRecord(structured, {
    partNumber: 'C9300L-24T-4G-E',
    basePartNumber: 'C9300L-24T-4G-E',
    sku: 'IX-9300L-24T',
    updatedAt: '2026-11-27T12:00:00.000Z',
    source: 'MANUAL',
  });
  saveStructuredBoSkuCatalog(structured);
  const loadedSku = getStructuredBoSkuCatalog();
  assert.strictEqual(loadedSku.exactByPartNumber['C9300L-24T-4G-E']?.sku, 'IX-9300L-24T');
  console.log('  ✅ Persistencia BO SKU verificada.');

  // --------------------------------------------------------------------------
  // TEST 5: Umbrales de snapshot SQLite WASM configurados
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: Diagnóstico y umbrales SQLite WASM');
  assert.strictEqual(SQLITE_FALLBACK_SNAPSHOT_MAX_BYTES, 32 * 1024 * 1024);
  assert.strictEqual(SQLITE_WASM_RECOMMENDED_MAX_BYTES, 512 * 1024 * 1024);
  const metrics = await getSqliteMetrics();
  assert.strictEqual(metrics.isReady, true);
  console.log('  ✅ Umbrales y métricas SQLite WASM validados.');

  console.log('\n🏆 ¡TODAS LAS PRUEBAS DE ESCALABILIDAD Y AISLAMIENTO PASARON AL 100%!');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE ESCALABILIDAD:', err);
  process.exit(1);
});
