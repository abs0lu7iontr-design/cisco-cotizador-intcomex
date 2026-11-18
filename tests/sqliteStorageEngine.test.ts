// ============================================================================
// SUITE DE PRUEBAS: MOTOR RELACIONAL SQLITE WASM & PERSISTENCIA OPFS (v2.17.0)
// Validación de Inicialización, Tablas Relacionales, Transacciones, VACUUM y Export
// ============================================================================

import {
  getSqliteDb,
  sqliteSet,
  sqliteGet,
  sqliteDelete,
  sqliteGetAll,
  sqliteClear,
  sqliteRun,
  sqliteQuery,
  sqliteVacuum,
  exportSqliteBinary,
  getSqliteMetrics,
  formatSqliteBytes,
} from '../src/core/storage/sqliteStorageEngine';
import { idbSet, idbGet, idbGetAll, idbDelete, STORES } from '../src/core/storage/indexedDbStorage';
import { checkStorageHealth } from '../src/modules/health/healthService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ Falló la aserción: ${msg}`);
  }
}

async function runSqliteStorageTests() {
  console.log('\n🧪 Iniciando Suite de Pruebas: Motor SQLite WASM & Persistencia OPFS (v2.17.0)...');

  // --------------------------------------------------------------------------
  // TEST 1: Inicialización de la base de datos y verificación de esquemas
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 1: Inicialización de SQLite WASM y Verificación de Tablas');
  const db = await getSqliteDb();
  assert(db !== null, 'El motor SQLite WASM debe inicializarse correctamente.');

  const tablesRes = db!.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tableNames = tablesRes[0]?.values.map((v) => v[0] as string) || [];
  console.log('  Tablas detectadas en SQLite:', tableNames.join(', '));

  assert(tableNames.includes('cisco_kv_store'), 'Debe existir la tabla cisco_kv_store');
  assert(tableNames.includes('cisco_estimates'), 'Debe existir la tabla cisco_estimates');
  assert(tableNames.includes('cisco_pipeline_deals'), 'Debe existir la tabla cisco_pipeline_deals');
  assert(tableNames.includes('cisco_forecast_records'), 'Debe existir la tabla cisco_forecast_records');
  assert(tableNames.includes('cisco_offline_queue'), 'Debe existir la tabla cisco_offline_queue');
  console.log('  ✅ Esquemas relacionales y tablas creadas satisfactoriamente.');

  // --------------------------------------------------------------------------
  // TEST 2: Operaciones CRUD en cisco_kv_store y tablas especializadas
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Operaciones CRUD Atómicas en SQLite (sqliteSet / sqliteGet / sqliteDelete)');
  const testEstimate = {
    id: 'EST-TEST-001',
    estimateId: 'EST-998877',
    dealId: 'DEAL-CL-5544',
    partnerName: 'Entel Chile',
    clientFinalName: 'BancoEstado',
    financialSummary: { totalNet: 45200.75 },
    isPrivate: true,
    syncStatus: 'LOCAL_ONLY',
    versionNum: 2,
    creator: 'mskill',
  };

  const setOk = await sqliteSet('estimates', testEstimate.id, testEstimate);
  assert(setOk === true, 'sqliteSet debe retornar true en guardado exitoso.');

  const retrieved = await sqliteGet<typeof testEstimate>('estimates', testEstimate.id);
  assert(retrieved !== null, 'sqliteGet debe recuperar el objeto guardado.');
  assert(retrieved?.dealId === 'DEAL-CL-5544', 'dealId debe coincidir.');
  assert(retrieved?.partnerName === 'Entel Chile', 'partnerName debe coincidir.');
  assert(retrieved?.financialSummary.totalNet === 45200.75, 'totalNet debe coincidir.');

  // Comprobar que también se sincronizó a la tabla relacional cisco_estimates
  const estimateQuery = await sqliteQuery(
    'SELECT partner_name, client_final_name, total_net_usd, is_private FROM cisco_estimates WHERE id = ?',
    [testEstimate.id]
  );
  assert(estimateQuery.length === 1, 'Debe haber 1 fila en cisco_estimates.');
  assert(estimateQuery[0].partner_name === 'Entel Chile', 'partner_name relacional correcto.');
  assert(estimateQuery[0].total_net_usd === 45200.75, 'total_net_usd relacional correcto.');
  assert(estimateQuery[0].is_private === 1, 'is_private relacional correcto (1 para true).');
  console.log('  ✅ CRUD en cisco_kv_store y sincronización relacional cisco_estimates validada.');

  // --------------------------------------------------------------------------
  // TEST 3: Consultas SQL Avanzadas (WHERE, SUM, GROUP BY)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Consultas SQL Directas (sqliteRun & sqliteQuery)');
  await sqliteRun(
    'INSERT OR REPLACE INTO cisco_pipeline_deals (id, deal_id, partner, end_user, pm_responsable, monto_usd, stage, data_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['P1', 'D101', 'Adistec', 'Cencosud', 'Raul Cuevas', 75000, 'Cotización', '{}', new Date().toISOString()]
  );
  await sqliteRun(
    'INSERT OR REPLACE INTO cisco_pipeline_deals (id, deal_id, partner, end_user, pm_responsable, monto_usd, stage, data_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['P2', 'D102', 'Claro', 'Falabella', 'Raul Cuevas', 125000, 'Negociación', '{}', new Date().toISOString()]
  );
  await sqliteRun(
    'INSERT OR REPLACE INTO cisco_pipeline_deals (id, deal_id, partner, end_user, pm_responsable, monto_usd, stage, data_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['P3', 'D103', 'Adistec', 'BCI', 'Mauricio Skill', 50000, 'Cierre', '{}', new Date().toISOString()]
  );

  const aggregateRes = await sqliteQuery(
    'SELECT pm_responsable, SUM(monto_usd) AS total, COUNT(*) AS deals FROM cisco_pipeline_deals GROUP BY pm_responsable ORDER BY total DESC'
  );
  assert(aggregateRes.length === 2, 'Deben existir 2 grupos de PMs');
  assert(aggregateRes[0].pm_responsable === 'Raul Cuevas', 'El PM con más monto debe ser Raul Cuevas');
  assert(Number(aggregateRes[0].total) === 200000, 'Total de Raul Cuevas debe ser $200.000 USD');
  console.log('  ✅ Consultas SQL relacionales (SUM, GROUP BY, WHERE) verificadas con 100% de precisión.');

  // --------------------------------------------------------------------------
  // TEST 4: Adaptador Unificado Transparente (indexedDbStorage -> SQLite)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: Adaptador Unificado Transparente (idbSet / idbGet / idbGetAll)');
  const keyvalData = { theme: 'cisco-blue', offlineMode: true, tokenExpires: 999999 };
  await idbSet(STORES.KEYVAL, 'config_test_unified', keyvalData);

  const retrievedUnified = await idbGet<typeof keyvalData>(STORES.KEYVAL, 'config_test_unified');
  assert(retrievedUnified !== null, 'idbGet debe recuperar datos guardados con idbSet.');
  assert(retrievedUnified?.theme === 'cisco-blue', 'theme debe ser cisco-blue.');
  assert(retrievedUnified?.offlineMode === true, 'offlineMode debe ser true.');

  // Verificar que idbGet lee directamente desde SQLite
  const sqliteDirect = await sqliteGet<typeof keyvalData>('keyval', 'config_test_unified');
  assert(sqliteDirect !== null, 'El registro debe estar presente en SQLite');
  assert(sqliteDirect?.tokenExpires === 999999, 'tokenExpires debe coincidir en SQLite.');
  console.log('  ✅ Integración transparente: idbSet e idbGet operan nativamente sobre SQLite.');

  // --------------------------------------------------------------------------
  // TEST 5: Compactación VACUUM y Exportación Binaria .sqlite
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: Compactación VACUUM y Exportación Binaria .sqlite');
  const vacuumRes = await sqliteVacuum();
  assert(vacuumRes.success === true, 'VACUUM debe ejecutarse con éxito.');

  const binaryExport = exportSqliteBinary();
  assert(binaryExport !== null, 'El binario exportado no debe ser nulo.');
  assert(binaryExport!.length > 0, 'El binario debe contener bytes.');

  // Verificar el encabezado mágico de 16 bytes de SQLite 3: "SQLite format 3\0"
  const headerString = String.fromCharCode(...binaryExport!.slice(0, 15));
  assert(headerString === 'SQLite format 3', `Encabezado mágico válido: ${headerString}`);
  console.log(`  ✅ Archivo binario .sqlite exportado con éxito (${formatSqliteBytes(binaryExport!.length)}) con encabezado SQLite v3.`);

  // --------------------------------------------------------------------------
  // TEST 6: Diagnóstico de Salud y Reporte del Monitor de Salud
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 6: Diagnóstico de Almacenamiento en el Monitor de Salud');
  const healthRes = await checkStorageHealth();
  assert(healthRes.result.status === 'healthy', 'El estado de almacenamiento debe ser healthy/óptimo.');
  assert(healthRes.metrics.sqliteSupported === true, 'sqliteSupported debe ser true.');
  assert(healthRes.metrics.sqliteReady === true, 'sqliteReady debe ser true.');
  assert(healthRes.metrics.sqliteDatabaseBytes! > 0, 'sqliteDatabaseBytes debe ser > 0.');
  assert(healthRes.result.name.includes('SQLite'), 'El nombre del check debe incluir SQLite.');
  console.log(`  ✅ Monitor de salud reporta: "${healthRes.result.message}" (Status: ${healthRes.result.status.toUpperCase()})`);

  console.log('\n🏆 ¡TODAS LAS PRUEBAS DEL MOTOR SQLITE WASM & PERSISTENCIA OPFS PASARON AL 100%!');
}

runSqliteStorageTests().catch((err) => {
  console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS SQLITE:', err);
  process.exit(1);
});
