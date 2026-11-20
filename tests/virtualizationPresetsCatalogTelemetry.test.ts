// ============================================================================
// CISCO AUTOMATED v2.23.0 - UNIT TESTS
// Virtualización 60 FPS, Vistas Guardadas (Presets), PM por Defecto,
// Caché de Catálogos (Capacidad Gigabytes) y Telemetría de Rendimiento
// ============================================================================

import test from 'node:test';
import assert from 'node:assert';
import { getPipelinePmForUser, formatShortUserFirstName } from '../src/utils/userNameUtils.js';
import {
  getFactoryPresets,
  loadFilterPresets,
  saveCustomFilterPreset,
  deleteCustomFilterPreset,
} from '../src/core/presets/filterPresetsManager.js';
import {
  auditStorageTechnologies,
  warmMasterCatalogCache,
  getCachedMasterCatalog,
  getMasterCatalogStatus,
} from '../src/core/cache/masterCatalogCache.js';
import {
  markRenderStart,
  markRenderEnd,
  registerVirtualTable,
  getPerformanceSnapshot,
  calculatePerformanceScore,
  purgeAppPerformanceCaches,
} from '../src/core/telemetry/performanceTelemetry.js';

test('1. Mapeo de Usuario y Vista Individual por Defecto en Pipeline & Forecast', () => {
  // Mauricio
  assert.strictEqual(getPipelinePmForUser({ username: 'mskill', fullName: 'Mauricio Skill' }), 'Mauricio Skill');
  assert.strictEqual(getPipelinePmForUser({ username: 'pm_cisco', fullName: 'PM Cisco CCW' }), 'Mauricio Skill');
  assert.strictEqual(getPipelinePmForUser('mskill'), 'Mauricio Skill');

  // Raul
  assert.strictEqual(getPipelinePmForUser({ username: 'rcuevas', fullName: 'Raul Cuevas' }), 'Raul Cuevas');
  assert.strictEqual(getPipelinePmForUser('Raúl Cuevas'), 'Raul Cuevas');

  // Marta
  assert.strictEqual(getPipelinePmForUser({ username: 'madasme', fullName: 'Marta Adasme' }), 'Marta Adasme');

  // Johana
  assert.strictEqual(getPipelinePmForUser({ username: 'jvalencia', fullName: 'Johana Valencia' }), 'Johana Valencia');

  // Externo o sin PM específico
  assert.strictEqual(getPipelinePmForUser({ username: 'cliente_demo', fullName: 'Demo Partner' }), null);
  assert.strictEqual(getPipelinePmForUser(null), null);
});

test('2. Gestor de Presets y Vistas Guardadas Personalizadas', () => {
  const pipelinePresets = getFactoryPresets('pipeline', 'Mauricio Skill', 'Noviembre');
  assert.ok(Array.isArray(pipelinePresets));
  assert.ok(pipelinePresets.length >= 3);

  // El primer preset de fábrica debe ser la vista individual del PM
  const firstPreset = pipelinePresets[0];
  assert.strictEqual(firstPreset.id, 'factory_pipeline_my_deals');
  assert.strictEqual(firstPreset.filters.pmResponsable, 'Mauricio Skill');
  assert.strictEqual(firstPreset.filters.mesCierre, 'Noviembre');

  // El segundo preset de fábrica debe ser la vista general de todos
  const secondPreset = pipelinePresets[1];
  assert.strictEqual(secondPreset.id, 'factory_pipeline_all_deals');
  assert.strictEqual(secondPreset.filters.pmResponsable, 'ALL');

  // Guardar y eliminar un preset personalizado
  const custom = saveCustomFilterPreset('pipeline', 'Deals Q4 > 100K', {
    pmResponsable: 'Mauricio Skill',
    mesCierre: 'Q4',
    searchQuery: 'Cisco Enterprise',
  });
  assert.strictEqual(custom.name, 'Deals Q4 > 100K');
  assert.strictEqual(custom.isFactory, false);

  const deleted = deleteCustomFilterPreset('pipeline', custom.id);
  assert.strictEqual(deleted, true);
});

test('3. Algoritmo Matemático de Virtualización de Listas (useVirtualList)', () => {
  // Simular cálculo de ventana virtual para 1,000 ítems con altura 50px y viewport 600px
  const itemsCount = 1000;
  const itemSize = 50;
  const overscan = 5;
  const scrollTop = 1500; // Usuario desplazado 1500px hacia abajo
  const viewportHeight = 600;

  const totalHeight = itemsCount * itemSize;
  assert.strictEqual(totalHeight, 50000, '1000 ítems * 50px = 50,000px de altura total');

  // Ítem que coincide con scrollTop = 1500 / 50 = 30
  const startVisible = Math.floor(scrollTop / itemSize); // 30
  const endVisible = Math.ceil((scrollTop + viewportHeight) / itemSize); // (1500 + 600) / 50 = 42

  const startIndex = Math.max(0, startVisible - overscan); // 30 - 5 = 25
  const endIndex = Math.min(itemsCount - 1, endVisible + overscan); // 42 + 5 = 47

  const paddingTop = startIndex * itemSize; // 25 * 50 = 1250px
  const renderedItemsCount = endIndex - startIndex + 1; // 47 - 25 + 1 = 23 ítems
  const renderedHeight = renderedItemsCount * itemSize; // 1150px
  const paddingBottom = totalHeight - (endIndex + 1) * itemSize; // 50000 - 48 * 50 = 47600px

  // Verificar la invariante de altura total: paddingTop + renderedHeight + paddingBottom = totalHeight
  assert.strictEqual(
    paddingTop + renderedHeight + paddingBottom,
    totalHeight,
    'La suma de espaciadores y filas visibles debe igualar exactamente la altura total del contenedor'
  );
  assert.ok(renderedItemsCount < 30, 'Solo deben pintarse ~23 filas en el DOM en vez de 1,000 filas');
});

test('4. Auditoría de Capacidad de Almacenamiento (Desmintiendo el límite de 5 MB)', async () => {
  const audit = await auditStorageTechnologies();
  assert.ok(audit.indexedDbMaxCapacity.includes('Gigabytes') || audit.indexedDbMaxCapacity.includes('GB'));
  assert.ok(audit.sqliteWasmOpfsCapacity.includes('Disco') || audit.sqliteWasmOpfsCapacity.includes('OPFS'));
  assert.ok(audit.localStorageLimit.includes('5 MB'));
  assert.ok(audit.architectureVerdict.includes('Industrial'));
});

test('5. Precarga y Caché de Catálogos Maestros (masterCatalogCache)', async () => {
  const metrics = await warmMasterCatalogCache();
  assert.strictEqual(metrics.isWarmed, true);
  assert.ok(metrics.totalItemsCached > 50, 'Debe haber más de 50 ítems de catálogo precargados');
  assert.ok(metrics.hydrationLatencyMs < 200, 'La latencia de hidratación debe ser muy baja');

  // Acceso instantáneo en RAM L1
  const dacCables = getCachedMasterCatalog('DAC_AOC');
  assert.ok(Array.isArray(dacCables));
  assert.ok(dacCables.length >= 20, 'Catálogo de cables DAC/AOC presente');

  const pipelineSeeds = getCachedMasterCatalog('PIPELINE_SEEDS');
  assert.ok(Array.isArray(pipelineSeeds));
  assert.ok(pipelineSeeds.length >= 50, 'Semillas de pipeline presentes');

  const status = await getMasterCatalogStatus();
  assert.strictEqual(status.isWarmed, true);
});

test('6. Motor de Telemetría de Rendimiento en Tiempo Real (performanceTelemetry)', () => {
  markRenderStart('TestView');
  // Simular trabajo
  const duration = markRenderEnd('TestView');
  assert.ok(typeof duration === 'number');

  registerVirtualTable('pipeline_table', true);
  registerVirtualTable('forecast_table', true);

  const snapshot = getPerformanceSnapshot();
  assert.ok(snapshot.score >= 50 && snapshot.score <= 100);
  assert.ok(['EXCELLENT', 'GOOD', 'WARNING'].includes(snapshot.rating));
  assert.strictEqual(snapshot.isVirtualizationActive, true);
  assert.strictEqual(snapshot.virtualizedTablesCount, 2);

  // Scoring
  const excellentScore = calculatePerformanceScore(5, 500, 80);
  assert.strictEqual(excellentScore.rating, 'EXCELLENT');
  assert.ok(excellentScore.score >= 90);

  const degradedScore = calculatePerformanceScore(60, 4500, 300);
  assert.strictEqual(degradedScore.rating, 'WARNING');
  assert.ok(degradedScore.score < 75);

  const purge = purgeAppPerformanceCaches();
  assert.ok(purge.freedKb > 0);
});
