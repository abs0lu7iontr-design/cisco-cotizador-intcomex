// ============================================================================
// CISCO AUTOMATED v2.11 - TRACKING BO (FECHAS OC/SO + BODEGA E1/ED),
// PIPELINE/FORECAST SANITIZERS & MANUAL OFFLINE MODE TEST SUITE
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
  isRealPoNumber,
  isRealSoNumber,
  inferSoDateFromNotes,
  getEffectivePoAddedDate,
  getEffectiveSoAddedDate,
  formatShortTrackingDate,
  BoOrderTrackingRecord,
} from '../src/modules/bo/boTrackingTypes';
import {
  detectBodegaFromDsvRows,
  autoRepairBoRecordBodega,
  applyPoAndSoTimestamps,
} from '../src/modules/bo/boTrackingService';
import {
  sanitizePipelineDealForCloud,
  bulkSavePipelineDeals,
  getPipelineDeals,
} from '../src/modules/pipeline/pipelineStorage';
import {
  sanitizeForecastRecordForCloud,
  bulkSaveForecastRecords,
  getForecastRecords,
} from '../src/modules/forecast/forecastStorage';
import {
  isManualOfflineMode,
  setManualOfflineMode,
  isAppOffline,
} from '../src/core/storage/offlineModeManager';
import {
  enqueueOfflineAction,
  getOfflineQueueSummary,
  clearOfflineQueue,
  flushOfflineQueue,
} from '../src/core/storage/offlineSyncQueue';

function createBaseBoRecord(overrides: Partial<BoOrderTrackingRecord> = {}): BoOrderTrackingRecord {
  const now = '2026-11-10T10:00:00.000Z';
  return {
    id: 'bo_test_1',
    estimateId: 'EST-1001',
    estimateVersionTag: 'DSV',
    dealId: '86803694',
    partnerName: 'ANGLOAMERICAN SUR SA',
    endCustomerName: 'SUPPLYLINE IMPORTADORA LTDA',
    clientPoNumber: 'OC-PENDIENTE',
    ciscoSoNumber: '',
    courier: 'FedEx',
    currentStage: 'OC_RECEIVED',
    bodegaDestino: 'E1',
    totalSaleUsd: 1500,
    grossProfitUsd: 120,
    itemsCount: 1,
    createdAt: now,
    updatedAt: now,
    lastDailyReviewAt: now,
    notes: [],
    ...overrides,
  };
}

async function runSuite() {
  console.log('🧪 INICIANDO SUITE QA v2.11: BO Dates/Bodega + Pipeline/Forecast + Offline Mode...\n');

  // --------------------------------------------------------------------------
  // 1. Detección de Bodega DSV (E1 Hardware vs ED 100% Intangibles) y Auto-Repair
  // --------------------------------------------------------------------------
  console.log('--- 1. Detección E1 vs ED en DSV y Reparación Histórica BO ---');

  assert.strictEqual(
    detectBodegaFromDsvRows([
      { sku: 'C9200L-24P-4G-E', detectedType: 'hardware', productQuantity: 2 },
      { sku: 'C9200L-DNA-E-24-3Y', detectedType: 'subscription', productQuantity: 2 },
    ]),
    'E1',
    'DSV mixto (Hardware + Suscripción) debe asignarse a bodega física E1'
  );

  assert.strictEqual(
    detectBodegaFromDsvRows([
      { sku: 'CON-SNT-C9115AXI', detectedType: 'service', productQuantity: 5 },
      { sku: 'DNA-P-T0-E-3Y', detectedType: 'subscription', productQuantity: 5 },
    ]),
    'ED',
    'DSV 100% intangibles debe asignarse a bodega digital ED'
  );

  assert.strictEqual(
    detectBodegaFromDsvRows([
      { sku: 'C9300-48P-E', detectedType: 'hardware', productQuantity: 0 },
      { sku: 'CON-SNT-C930048P', detectedType: 'service', productQuantity: 1 },
    ]),
    'ED',
    'Líneas hardware con cantidad 0 no deben forzar E1 sobre líneas activas digitales'
  );

  assert.strictEqual(
    detectBodegaFromDsvRows([{ partNumber: 'C9200L-48P-4X-E', productQuantity: 1 }]),
    'E1',
    'Debe inferir categoría por SKU cuando detectedType viene omitido'
  );

  const misclassifiedEdWithFedex = createBaseBoRecord({
    id: 'bo_ed_fedex',
    bodegaDestino: 'ED',
    courierTrackingNumber: '538951553170',
    estimateVersionTag: 'DSV',
  });
  const repaired = autoRepairBoRecordBodega(misclassifiedEdWithFedex);
  assert.strictEqual(repaired.changed, true, 'Registro ED con guía física FedEx debe repararse');
  assert.strictEqual(repaired.record.bodegaDestino, 'E1', 'Bodega reparada debe ser E1');

  const healthyE1 = createBaseBoRecord({ bodegaDestino: 'E1', courierTrackingNumber: '77123456' });
  assert.strictEqual(
    autoRepairBoRecordBodega(healthyE1).changed,
    false,
    'Registro ya en E1 no necesita reparación'
  );
  console.log('✅ Bodega DSV (E1/ED) y auto-reparación validados.');

  // --------------------------------------------------------------------------
  // 2. Fechas de Registro de OC y SO en Tracking BO
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Fechas de Ingreso OC y SO Cisco en Tracking BO ---');

  assert.strictEqual(isRealPoNumber('OC-PENDIENTE'), false);
  assert.strictEqual(isRealPoNumber('OC-DSV'), false);
  assert.strictEqual(isRealPoNumber('332154'), true);
  assert.strictEqual(isRealSoNumber('PENDIENTE'), false);
  assert.strictEqual(isRealSoNumber('120809148'), true);

  const pendingPoRec = applyPoAndSoTimestamps(
    createBaseBoRecord({ clientPoNumber: 'OC-PENDIENTE', ciscoSoNumber: '' }),
    undefined,
    '2026-11-10T11:00:00.000Z'
  );
  assert.strictEqual(
    pendingPoRec.clientPoAddedAt,
    undefined,
    'No debe estampar clientPoAddedAt si la OC es placeholder'
  );
  assert.strictEqual(
    pendingPoRec.ciscoSoAddedAt,
    undefined,
    'No debe estampar ciscoSoAddedAt si la SO está vacía'
  );

  const stampedWithPo = applyPoAndSoTimestamps(
    { ...pendingPoRec, clientPoNumber: 'OC-45001' },
    pendingPoRec,
    '2026-11-10T12:30:00.000Z'
  );
  assert.strictEqual(
    stampedWithPo.clientPoAddedAt,
    '2026-11-10T12:30:00.000Z',
    'Debe estampar clientPoAddedAt al ingresar OC real'
  );

  const updatedLaterWithSo = applyPoAndSoTimestamps(
    { ...stampedWithPo, ciscoSoNumber: '120998877', currentStage: 'CISCO_SO_BOOKED' },
    stampedWithPo,
    '2026-11-11T09:15:00.000Z'
  );
  assert.strictEqual(
    updatedLaterWithSo.clientPoAddedAt,
    '2026-11-10T12:30:00.000Z',
    'Agregar SO posterior debe preservar fecha original de OC'
  );
  assert.strictEqual(
    updatedLaterWithSo.ciscoSoAddedAt,
    '2026-11-11T09:15:00.000Z',
    'Debe estampar ciscoSoAddedAt al registrar número SO Cisco'
  );

  const legacyWithNote = createBaseBoRecord({
    clientPoNumber: '331559',
    ciscoSoNumber: '120758539',
    currentStage: 'CISCO_SO_BOOKED',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-05T16:00:00.000Z',
    notes: [
      {
        id: 'n1',
        date: '2026-11-03T14:20:00.000Z',
        author: 'PM',
        stage: 'CISCO_SO_BOOKED',
        comment: 'SO Cisco 120758539 confirmada por fábrica',
      },
    ],
  });
  assert.strictEqual(
    inferSoDateFromNotes(legacyWithNote),
    '2026-11-03T14:20:00.000Z',
    'Debe inferir fecha SO desde nota histórica si ciscoSoAddedAt aún no existía'
  );
  assert.strictEqual(getEffectivePoAddedDate(legacyWithNote), '2026-11-01T10:00:00.000Z');
  assert.strictEqual(getEffectiveSoAddedDate(legacyWithNote), '2026-11-03T14:20:00.000Z');
  assert.ok(formatShortTrackingDate('2026-11-03T14:20:00.000Z').length >= 8);
  console.log('✅ Trazabilidad de fechas OC/SO y fallbacks históricos validados.');

  // --------------------------------------------------------------------------
  // 3. Sanitizadores firestore.rules y Persistencia >50 ítems (Pipeline/Forecast)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Sanitizadores Pipeline/Forecast y Carga Masiva >50 Registros ---');

  setManualOfflineMode(true);
  await clearOfflineQueue();

  const dirtyDeal = sanitizePipelineDealForCloud({
    id: 'X'.repeat(150),
    fechaLevantamiento: '10/11/2026',
    fechaCotizacion: '10/11/2026',
    marca: 'CISCO',
    pmResponsable: 'A'.repeat(250),
    partner: 'Partner Test',
    ejecutivoPartner: 'Ejecutivo',
    endUser: 'B'.repeat(260),
    usd: -500,
    mesCierre: 'NOVIEMBRE',
    mesFacturacion: 'NOVIEMBRE',
    porcentajeAvance: 145,
    dealId: 'D'.repeat(130),
    productosSuscripciones: -10,
    servicios: 2500,
    meraki: 1000,
    am: 'AM Test',
    grupoVentas: 'Enterprise',
    notas: 'N'.repeat(6000),
    priceProtectionExpiryDate: '',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  });
  assert.strictEqual(dirtyDeal.id.length, 100, 'ID Pipeline debe truncarse a <=100 chars');
  assert.strictEqual(dirtyDeal.pmResponsable.length, 200, 'pmResponsable <=200 chars');
  assert.strictEqual(dirtyDeal.endUser.length, 200, 'endUser <=200 chars');
  assert.strictEqual(dirtyDeal.notas.length, 5000, 'notas <=5000 chars');
  assert.strictEqual(dirtyDeal.usd, 0, 'USD negativo debe ajustarse a 0');
  assert.strictEqual(dirtyDeal.productosSuscripciones, 0);
  assert.strictEqual(dirtyDeal.porcentajeAvance, 100, 'porcentajeAvance máximo es 100');

  const dirtyForecast = sanitizeForecastRecordForCloud({
    id: 'F'.repeat(150),
    fechaLevantamiento: '10/11/2026',
    fechaCotizacion: '10/11/2026',
    marca: 'CISCO',
    pmResponsable: 'PM',
    partner: 'Partner',
    ejecutivoPartner: 'Ejecutivo',
    endUser: 'End User',
    usdIntcomex: -120,
    emailEjecutivoPartner: 'test@partner.cl',
    mesFacturacion: 'NOV',
    emailClienteFinal: 'client@corp.cl',
    detalleProductos: 'P'.repeat(2500),
    oc: 'OC1',
    deal: 'DEAL1',
    productos: -5,
    suscripciones: 100,
    servicios: 50,
    meraki: -1,
    am: 'AM',
    grupoVentas: 'Ent',
    observacion: 'O'.repeat(2400),
    dsvSubmission: '',
    po: '',
    so: '',
    submittedDate: '',
    clienteCisco: '',
    promotionAuthorizationNumber: '',
    endCustomerName: '',
    endCustomerAddress1: 'A'.repeat(700),
    numeroVenta: '',
    bodega: 'E1',
    caso: '',
    credit: '',
    nuevoCaso: '',
    confirmacionCredito: '',
    priceProtectionExpiryDate: '',
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  });
  assert.strictEqual(dirtyForecast.id.length, 100);
  assert.strictEqual(dirtyForecast.detalleProductos.length, 2000);
  assert.strictEqual(dirtyForecast.observacion.length, 2000);
  assert.strictEqual(dirtyForecast.endCustomerAddress1.length, 500);
  assert.strictEqual(dirtyForecast.usdIntcomex, 0);
  assert.strictEqual(dirtyForecast.productos, 0);
  assert.strictEqual(dirtyForecast.meraki, 0);

  // Probar carga masiva de 65 deals y 65 forecasts (> límite antiguo de 50)
  const bulkDeals = Array.from({ length: 65 }, (_, idx) => ({
    ...dirtyDeal,
    id: `bulk_pipe_test_${idx}`,
    dealId: `9900${idx}`,
    partner: `Partner Bulk ${idx}`,
    endUser: `Cliente Bulk ${idx}`,
    usd: 1000 + idx,
    porcentajeAvance: 50,
    notas: 'Test batch sin límite',
  }));
  await bulkSavePipelineDeals(bulkDeals);
  const allDeals = await getPipelineDeals();
  const matchedBulkDeals = allDeals.filter((d) => d.id.startsWith('bulk_pipe_test_'));
  assert.strictEqual(
    matchedBulkDeals.length,
    65,
    'bulkSavePipelineDeals debe persistir TODOS los 65 registros sin cortar en 50'
  );

  const bulkForecasts = Array.from({ length: 65 }, (_, idx) => ({
    ...dirtyForecast,
    id: `bulk_fc_test_${idx}`,
    partner: `Partner FC ${idx}`,
    endUser: `EndUser FC ${idx}`,
    usdIntcomex: 2000 + idx,
    detalleProductos: 'Switches Cisco',
    observacion: 'Batch >50',
    endCustomerAddress1: 'Santiago, Chile',
  }));
  await bulkSaveForecastRecords(bulkForecasts);
  const allForecasts = await getForecastRecords();
  const matchedBulkForecasts = allForecasts.filter((r) => r.id.startsWith('bulk_fc_test_'));
  assert.strictEqual(
    matchedBulkForecasts.length,
    65,
    'bulkSaveForecastRecords debe persistir TODOS los 65 registros sin cortar en 50'
  );
  console.log('✅ Sanitizadores firestore.rules y carga masiva >50 ítems validados.');

  // --------------------------------------------------------------------------
  // 4. Modo Offline Manual, Deduplicación de Cola PC y Bloqueo de Sync Automático
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Modo Offline Manual, Deduplicación Cola PC y Guardas de Sincronización ---');

  await clearOfflineQueue();
  setManualOfflineMode(true);
  assert.strictEqual(isManualOfflineMode(), true);
  assert.strictEqual(isAppOffline(), true);

  // Encolar dos veces el mismo entityKey -> debe consolidar en 1 sola entrada
  await enqueueOfflineAction('save_bo_tracking', { id: 'bo-1', clientPoNumber: 'OC-1' }, {
    entityKey: 'bo:bo-1',
  });
  await enqueueOfflineAction('save_bo_tracking', { id: 'bo-1', clientPoNumber: 'OC-2' }, {
    entityKey: 'bo:bo-1',
  });
  await enqueueOfflineAction('save_pipeline_deal', { id: 'deal-1', partner: 'P1' }, {
    entityKey: 'pipeline:deal-1',
  });
  await enqueueOfflineAction('save_forecast_record', { id: 'fc-1', partner: 'P2' }, {
    entityKey: 'forecast:fc-1',
  });

  const summary = await getOfflineQueueSummary();
  assert.strictEqual(
    summary.total,
    3,
    'Ediciones repetidas del mismo entityKey deben deduplicarse a 1 sola entrada pendiente'
  );
  const boItem = summary.items.find((i) => i.entityKey === 'bo:bo-1');
  assert.ok(boItem, 'Debe existir el ítem consolidado bo:bo-1');
  assert.strictEqual(boItem.payload.clientPoNumber, 'OC-2', 'Debe conservar la última versión local');
  assert.strictEqual(summary.byModule['Tracking BO'], 1);
  assert.strictEqual(summary.byModule['Pipeline Comercial'], 1);
  assert.strictEqual(summary.byModule['Forecast Comercial'], 1);

  // Flush sin autorización explícita mientras está Offline manual debe bloquear subida
  const blockedFlush = await flushOfflineQueue();
  assert.strictEqual(blockedFlush.successCount, 0);
  assert.strictEqual(blockedFlush.remainingCount, 3, 'Cola PC no debe vaciarse sin pasar a Online');
  assert.ok(blockedFlush.errors.length > 0);

  await clearOfflineQueue();
  setManualOfflineMode(false);
  const clearedSummary = await getOfflineQueueSummary();
  assert.strictEqual(clearedSummary.total, 0, 'Cola debe quedar vacía tras limpieza');
  assert.strictEqual(isManualOfflineMode(), false);

  console.log('✅ Modo Offline Manual, deduplicación entityKey y bloqueos de subida validados.\n');
  console.log('🎉 TODAS LAS PRUEBAS QA DE v2.11 FINALIZARON EXITOSAMENTE.');
}

runSuite().catch((err) => {
  console.error('❌ Error en suite QA v2.11:', err);
  process.exit(1);
});
