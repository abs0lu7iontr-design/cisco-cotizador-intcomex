// ============================================================================
// TESTS: PIPELINE & FORECAST PERSISTENCE ARMOR (v2.16.1)
// Garantiza que tras actualizaciones, limpiezas de caché o modo offline,
// Pipeline Comercial y Forecast Comercial NUNCA queden en 0 deals / $0 USD.
// ============================================================================

import assert from 'node:assert/strict';
import { PIPELINE_INITIAL_SEEDS } from '../src/modules/pipeline/pipelineSeeds';
import { INITIAL_FORECAST_SEEDS } from '../src/modules/forecast/forecastSeeds';
import {
  getPipelineDeals,
  deletePipelineDeal,
  resetPipelineToInitialSeeds,
} from '../src/modules/pipeline/pipelineStorage';
import {
  getForecastRecords,
  deleteForecastRecord,
  resetForecastToSeeds,
} from '../src/modules/forecast/forecastStorage';
import { optimizeAndMigrateLocalStorage } from '../src/core/storage/modernStorageEngine';
import { repairStorageCache } from '../src/modules/health/healthService';

console.log('🧪 Iniciando Suite de Pruebas: Pipeline & Forecast Persistence Armor (v2.16.1)...\n');

async function runTests() {
  // Mock localStorage in Node.js environment if needed
  if (typeof globalThis.localStorage === 'undefined') {
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

  // ----------------------------------------------------------------------------
  // Test 1: Verificación de Semillas Oficiales Base
  // ----------------------------------------------------------------------------
  console.log('▶ Test 1: Verificación de Semillas Oficiales Base');
  assert.strictEqual(PIPELINE_INITIAL_SEEDS.length, 70, 'Pipeline oficial debe contener 70 deals iniciales');
  assert.strictEqual(INITIAL_FORECAST_SEEDS.length, 158, 'Forecast oficial debe contener 158 registros iniciales');
  console.log(`  ✅ Semillas verificadas: 70 deals Pipeline, 158 registros Forecast.\n`);

  // ----------------------------------------------------------------------------
  // Test 2: Auto-hidratación de Pipeline cuando la base está limpia o vacía
  // ----------------------------------------------------------------------------
  console.log('▶ Test 2: Auto-hidratación de Pipeline Comercial');
  localStorage.clear();
  // Simular que alreadySeeded estaba en 'true' por una versión previa, pero los datos se borraron por caché
  localStorage.setItem('cisco_pipeline_seed_initialized_v1', 'true');
  
  const deals = await getPipelineDeals(true);
  assert.ok(deals.length >= 70, `Se esperaba auto-hidratar al menos 70 deals, se obtuvieron ${deals.length}`);
  const totalUsdPipeline = deals.reduce((acc, d) => acc + (d.usd || 0), 0);
  assert.ok(totalUsdPipeline > 20_000_000, `El monto total de pipeline ($${totalUsdPipeline}) debe superar los $20M USD`);
  console.log(`  ✅ Pipeline auto-hidratado con ${deals.length} deals y $${totalUsdPipeline.toLocaleString()} USD.\n`);

  // ----------------------------------------------------------------------------
  // Test 3: Auto-hidratación de Forecast cuando la base está limpia o vacía
  // ----------------------------------------------------------------------------
  console.log('▶ Test 3: Auto-hidratación de Forecast Comercial');
  localStorage.clear();
  localStorage.setItem('cisco_forecast_seed_initialized_v1', 'true');

  const records = await getForecastRecords(true);
  assert.ok(records.length >= 158, `Se esperaba auto-hidratar al menos 158 registros, se obtuvieron ${records.length}`);
  const totalUsdForecast = records.reduce((acc, r) => acc + (r.usdIntcomex || 0), 0);
  assert.ok(totalUsdForecast > 0, `El monto total de forecast ($${totalUsdForecast}) debe ser mayor a $0 USD`);
  console.log(`  ✅ Forecast auto-hidratado con ${records.length} registros y $${totalUsdForecast.toLocaleString()} USD.\n`);

  // ----------------------------------------------------------------------------
  // Test 4: Preservación de Datos ante repairStorageCache y optimizeAndMigrateLocalStorage
  // ----------------------------------------------------------------------------
  console.log('▶ Test 4: Preservación de Datos ante Purga de Caché');
  repairStorageCache();
  await optimizeAndMigrateLocalStorage();

  const dealsAfterCacheRepair = await getPipelineDeals(true);
  assert.strictEqual(dealsAfterCacheRepair.length, 70, 'Pipeline debe seguir teniendo 70 deals tras reparar caché');

  const recordsAfterCacheRepair = await getForecastRecords(true);
  assert.strictEqual(recordsAfterCacheRepair.length, 158, 'Forecast debe seguir teniendo 158 registros tras reparar caché');
  console.log('  ✅ Caché reparada y optimizada sin ninguna pérdida en Pipeline ni Forecast.\n');

  // ----------------------------------------------------------------------------
  // Test 5: Manejo de Tombstone individual vs Catálogo Maestro
  // ----------------------------------------------------------------------------
  console.log('▶ Test 5: Manejo de Tombstones individuales');
  const targetDealId = PIPELINE_INITIAL_SEEDS[0].id;
  await deletePipelineDeal(targetDealId);

  const dealsWithTombstone = await getPipelineDeals(true);
  assert.strictEqual(dealsWithTombstone.length, 69, 'Eliminar 1 deal debe dejar 69 deals (nunca 0)');
  assert.ok(!dealsWithTombstone.some((d) => d.id === targetDealId), 'El deal eliminado no debe figurar');

  // Restaurar con resetPipelineToInitialSeeds
  const restoredCount = await resetPipelineToInitialSeeds();
  assert.strictEqual(restoredCount, 70, 'Restauración debe devolver los 70 deals completos');
  const fullyRestored = await getPipelineDeals(true);
  assert.strictEqual(fullyRestored.length, 70, 'Pipeline reestablecido al 100%');
  console.log('  ✅ Tombstones gestionados correctamente y restauración manual validada.\n');

  console.log('🏆 Todas las pruebas de persistencia de Pipeline & Forecast pasaron exitosamente.\n');
}

runTests().catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
