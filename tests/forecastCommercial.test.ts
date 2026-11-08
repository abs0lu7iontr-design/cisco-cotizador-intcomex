// ============================================================================
// TESTS: CISCO FORECAST COMERCIAL INTCOMEX (36 COLUMNAS) (v2.9)
// ============================================================================

import assert from 'node:assert/strict';
import { INITIAL_FORECAST_SEEDS } from '../src/modules/forecast/forecastSeeds';
import {
  FORECAST_36_COLUMNS,
  ForecastRecord,
} from '../src/modules/forecast/forecastTypes';
import {
  computeForecastStats,
  filterForecastRecords,
  findMatchingForecastRecord,
  crossSyncEstimateToForecast,
  crossSyncBoToForecast,
  crossSyncDsvToForecast,
  convertPipelineDealsToForecast,
  generateForecastReminders,
  exportForecastToCsv,
  parseCsvToForecastRecords,
  importForecastFromExcel,
  parseFlexibleNumber,
} from '../src/modules/forecast/forecastService';
import * as XLSX from 'xlsx';
import { generatePipelineReminders } from '../src/modules/pipeline/pipelineService';
import { ProcessedEstimateResult } from '../src/core/types';
import { BoOrderTrackingRecord } from '../src/modules/bo/boTrackingTypes';
import { DsvModalFormData } from '../src/modules/dsv/types';
import { PipelineDealRecord } from '../src/modules/pipeline/pipelineTypes';

console.log('🧪 Iniciando Suite de Pruebas: Forecast Comercial Cisco Intcomex (v2.9)...\n');

// ----------------------------------------------------------------------------
// Test 1: Verificación de Integridad de las 36 Columnas Oficiales
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Verificación de las 36 Columnas Oficiales');
assert.strictEqual(FORECAST_36_COLUMNS.length, 36, `Se esperaban exactamente 36 columnas, se obtuvieron ${FORECAST_36_COLUMNS.length}`);

// Validar orden y etiquetas de columnas clave
assert.strictEqual(FORECAST_36_COLUMNS[0].label, 'Fecha de Levantamiento');
assert.strictEqual(FORECAST_36_COLUMNS[1].label, 'Fecha de Cotizacion');
assert.strictEqual(FORECAST_36_COLUMNS[2].label, 'Marca');
assert.strictEqual(FORECAST_36_COLUMNS[3].label, 'PM Responsable');
assert.strictEqual(FORECAST_36_COLUMNS[4].label, 'Partner');
assert.strictEqual(FORECAST_36_COLUMNS[7].label, 'USD Intcomex');
assert.strictEqual(FORECAST_36_COLUMNS[13].label, 'Deal');
assert.strictEqual(FORECAST_36_COLUMNS[23].label, 'SO');
assert.strictEqual(FORECAST_36_COLUMNS[29].label, 'Numero de Venta');
assert.strictEqual(FORECAST_36_COLUMNS[30].label, 'Bodega');
assert.strictEqual(FORECAST_36_COLUMNS[32].label, 'Price Protection Expiry Date');
assert.strictEqual(FORECAST_36_COLUMNS[33].label, 'Credit');
assert.strictEqual(FORECAST_36_COLUMNS[35].label, 'Confirmación Credito');
console.log('  ✅ Las 36 columnas oficiales coinciden exactamente con la planilla de Intcomex.');

// ----------------------------------------------------------------------------
// Test 2: Catálogo Base de 158 Registros Oficiales de Seeds
// ----------------------------------------------------------------------------
console.log('▶ Test 2: Catálogo Inicial de Seeds Oficiales');
assert.strictEqual(INITIAL_FORECAST_SEEDS.length, 158, `Se esperaban 158 registros iniciales, se obtuvieron ${INITIAL_FORECAST_SEEDS.length}`);

const seed1 = INITIAL_FORECAST_SEEDS[0];
assert.strictEqual(seed1.id, 'FC-0001');
assert.strictEqual(seed1.partner, '2Celectricidad');
assert.strictEqual(seed1.usdIntcomex, 1761);
assert.strictEqual(seed1.pmResponsable, 'Mauricio Skill');

const seed2 = INITIAL_FORECAST_SEEDS[1];
assert.strictEqual(seed2.id, 'FC-0002');
assert.strictEqual(seed2.partner, 'Advisers TIC');
assert.strictEqual(seed2.endUser, 'SAESA');
assert.strictEqual(seed2.usdIntcomex, 11248.41);
assert.strictEqual(seed2.deal, '84365221');
assert.strictEqual(seed2.so, '120636454');
assert.strictEqual(seed2.numeroVenta, '4977892');
console.log('  ✅ Catálogo de 158 seeds cargado correctamente con datos consistentes.');

// ----------------------------------------------------------------------------
// Test 3: Motor Anti-Duplicación (findMatchingForecastRecord)
// ----------------------------------------------------------------------------
console.log('▶ Test 3: Motor Anti-Duplicación (3 Niveles)');

// Nivel 1: Por Deal ID
const matchDeal = findMatchingForecastRecord(INITIAL_FORECAST_SEEDS, {
  dealId: '84365221',
  partner: 'Otro Partner Distinto',
});
assert.ok(matchDeal, 'Debe coincidir por Deal ID 84365221');
assert.strictEqual(matchDeal?.id, 'FC-0002');

// Nivel 2: Por Sales Order (SO)
const matchSo = findMatchingForecastRecord(INITIAL_FORECAST_SEEDS, {
  so: '120636454',
});
assert.ok(matchSo, 'Debe coincidir por Cisco SO 120636454');
assert.strictEqual(matchSo?.id, 'FC-0002');

// Nivel 3: Por Partner + End User normalizados
const matchPartnerClient = findMatchingForecastRecord(INITIAL_FORECAST_SEEDS, {
  partner: 'Advisers TIC SpA',
  endUser: 'SAESA',
});
assert.ok(matchPartnerClient, 'Debe coincidir por Partner y End User');
assert.strictEqual(matchPartnerClient?.id, 'FC-0002');

console.log('  ✅ Motor anti-duplicación validado en todos sus niveles.');

// ----------------------------------------------------------------------------
// Test 4: Reconciliación Cruzada con CCW Estimates
// ----------------------------------------------------------------------------
console.log('▶ Test 4: Reconciliación Cruzada con CCW Estimate');

const mockEstimate: ProcessedEstimateResult = {
  fileName: 'Estimate_Advisers_SAESA.xlsx',
  headerInfo: {
    customerName: 'Advisers TIC',
    companyName: 'Advisers TIC',
    address: 'Av. Providencia 1234',
    city: 'Santiago',
    country: 'Chile',
    phone: '',
    estimateId: 'EST-998811',
    dealId: '84365221',
    priceList: 'Global',
    date: '11-09-2026',
    endUser: 'SAESA',
  },
  items: [
    {
      rowIdx: 1,
      lineNumber: '1.0',
      partNumber: 'IR8340-K9',
      smartAccountMandatory: 'No',
      description: 'Router Cisco IR8340',
      serviceDurationMonths: '',
      originalLeadTimeDays: 30,
      transformedLeadTime: '4 semanas',
      unitListPrice: 10000,
      pricingTerm: '',
      qty: 1,
      netCiscoUnit: 5000,
      discPct: 50,
      isIntangible: false,
      llevaArancel: true,
      costoInternacion: 350,
      costoArancel: 300,
      costoTotalUnitario: 5650,
      precioVentaUnitario: 6000,
      precioVentaExtendido: 6000,
    },
  ],
  originalProductTotal: 10000,
  calculatedProductTotal: 9990.9,
  serviceTotal: 1257.5,
  subscriptionTotal: 0,
  finalTotalPrice: 11248.41,
  headerRowIndex: 0,
};

// Debe fusionar en vez de duplicar
const syncResult = crossSyncEstimateToForecast(mockEstimate, INITIAL_FORECAST_SEEDS);
assert.strictEqual(syncResult.isNew, false, 'No debe crear registro nuevo para un deal existente');
assert.strictEqual(syncResult.affectedRecord.id, 'FC-0002');
assert.strictEqual(syncResult.affectedRecord.sourceEstimateId, 'EST-998811');
assert.strictEqual(syncResult.updatedList.length, INITIAL_FORECAST_SEEDS.length);

console.log('  ✅ Reconciliación con Estimate CCW ejecutada sin duplicar registros.');

// ----------------------------------------------------------------------------
// Test 5: Reconciliación Cruzada con Back Order Tracking (BO)
// ----------------------------------------------------------------------------
console.log('▶ Test 5: Reconciliación Cruzada con BO Tracking');

const mockBoList: BoOrderTrackingRecord[] = [
  {
    id: 'BO-SAESA-001',
    estimateId: 'EST-998811',
    estimateVersionTag: 'v1',
    dealId: '84365221',
    partnerName: 'Advisers TIC',
    endCustomerName: 'SAESA',
    clientPoNumber: 'OC-TEST-4455',
    ciscoSoNumber: 'SO-999888777',
    currentStage: 'CISCO_SO_BOOKED',
    courier: 'FedEx',
    totalSaleUsd: 11248.41,
    grossProfitUsd: 500,
    itemsCount: 1,
    notes: [],
    bodegaDestino: 'ED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const boSyncRes = crossSyncBoToForecast(mockBoList, INITIAL_FORECAST_SEEDS);
assert.ok(boSyncRes.updatedCount >= 1, 'Debe haber actualizado el registro correspondiente en Forecast');
const updatedSaesa = boSyncRes.updatedList.find((r) => r.deal === '84365221');
assert.ok(updatedSaesa, 'Registro Saesa debe existir');
assert.strictEqual(updatedSaesa?.sourceBoTrackingId, 'BO-SAESA-001');

console.log('  ✅ Reconciliación con BO Tracking completada.');

// ----------------------------------------------------------------------------
// Test 6: Reconciliación Cruzada con DSV
// ----------------------------------------------------------------------------
console.log('▶ Test 6: Reconciliación Cruzada con DSV');

const mockDsvList: DsvModalFormData[] = [
  {
    so: '120636454',
    po: '329692',
    dealId: '84365221',
    partnerId: 'XCLN17128',
    endCustomerAddress: 'Av. Los Conquistadores 2000, Santiago',
    partnerName: 'Advisers TIC',
    endCustomerName: 'SAESA',
  },
];

const dsvSyncRes = crossSyncDsvToForecast(mockDsvList, INITIAL_FORECAST_SEEDS);
const dsvUpdated = dsvSyncRes.updatedList.find((r) => r.deal === '84365221');
assert.strictEqual(dsvUpdated?.endCustomerAddress1, 'Av. Los Conquistadores 2000, Santiago');
console.log('  ✅ Datos de DSV inyectados correctamente.');

// ----------------------------------------------------------------------------
// Test 7: Motor de Recordatorios Comerciales (Forecast & Pipeline)
// ----------------------------------------------------------------------------
console.log('▶ Test 7: Motor de Recordatorios Comerciales');

const testRecordsForReminders: ForecastRecord[] = [
  {
    ...INITIAL_FORECAST_SEEDS[0],
    id: 'FC-TEST-EXP',
    deal: 'DEAL-EXP',
    priceProtectionExpiryDate: '01-01-2020', // Vencida
    credit: 'Aprobado',
  },
  {
    ...INITIAL_FORECAST_SEEDS[1],
    id: 'FC-TEST-CRED',
    deal: 'DEAL-CRED',
    credit: 'Pdte', // Crédito pendiente
    caso: 'CAS-998822',
  },
];

const forecastReminders = generateForecastReminders(testRecordsForReminders);
assert.ok(forecastReminders.length >= 2, 'Debe generar al menos 2 recordatorios');
const expReminder = forecastReminders.find((r) => r.type === 'EXPIRY');
assert.ok(expReminder, 'Debe detectar Price Protection vencida');
assert.strictEqual(expReminder?.severity, 'CRITICAL');

const credReminder = forecastReminders.find((r) => r.type === 'CREDIT');
assert.ok(credReminder, 'Debe detectar Crédito Pendiente');

// Validar también recordatorios del Pipeline
const mockPipelineDeals: PipelineDealRecord[] = [
  {
    id: 'p1',
    fechaLevantamiento: '1/8/2026',
    fechaCotizacion: '1/8/2026',
    marca: 'Cisco',
    pmResponsable: 'Raul Cuevas',
    partner: 'Test Partner',
    ejecutivoPartner: 'Juan Perez',
    endUser: 'Test Client',
    usd: 150000,
    mesCierre: 'Julio',
    mesFacturacion: 'Julio',
    porcentajeAvance: 50,
    dealId: '88776655',
    productosSuscripciones: 100000,
    servicios: 50000,
    meraki: 0,
    am: 'J. Galloni',
    grupoVentas: 'Enterprise',
    notas: 'Test',
    priceProtectionExpiryDate: '2020-01-01', // Vencida
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const pipelineReminders = generatePipelineReminders(mockPipelineDeals);
assert.strictEqual(pipelineReminders.length, 1, 'Pipeline debe reportar 1 recordatorio de vencimiento');
assert.strictEqual(pipelineReminders[0].type, 'PRICE_PROTECTION_EXPIRED');

console.log('  ✅ Motor de recordatorios validado tanto en Forecast como en Pipeline.');

// ----------------------------------------------------------------------------
// Test 8: Exportación e Importación CSV de 36 Columnas
// ----------------------------------------------------------------------------
console.log('▶ Test 8: Exportación e Importación CSV de 36 Columnas');

const csvExport = exportForecastToCsv(INITIAL_FORECAST_SEEDS.slice(0, 5));
assert.ok(csvExport.includes('"Fecha de Levantamiento"'), 'CSV debe contener encabezados');
assert.ok(csvExport.includes('"2Celectricidad"'), 'CSV debe contener registros exportados');

const { imported, duplicateCount } = parseCsvToForecastRecords(csvExport, INITIAL_FORECAST_SEEDS);
assert.strictEqual(duplicateCount, 5, 'Debe detectar que los 5 registros ya existen y omitir duplicados');
assert.strictEqual(imported.length, 0, 'No debe importar duplicados');

console.log('  ✅ Exportación e Importación CSV de 36 columnas verificada.');

// ----------------------------------------------------------------------------
// Test 9: Parser Flexible de Moneda y Números (. y , / CLP & USD)
// ----------------------------------------------------------------------------
console.log('▶ Test 9: Parser Flexible de Números y Divisas (parseFlexibleNumber)');

assert.strictEqual(parseFlexibleNumber(1085000), 1085000);
assert.strictEqual(parseFlexibleNumber('1,085,000'), 1085000);
assert.strictEqual(parseFlexibleNumber('1.085.000'), 1085000);
assert.strictEqual(parseFlexibleNumber('$ 1,085,000'), 1085000);
assert.strictEqual(parseFlexibleNumber('$107,849.40'), 107849.40);
assert.strictEqual(parseFlexibleNumber('107.849,40 USD'), 107849.40);
assert.strictEqual(parseFlexibleNumber('45.0'), 45);
assert.strictEqual(parseFlexibleNumber(''), 0);
assert.strictEqual(parseFlexibleNumber(null), 0);

console.log('  ✅ Parser flexible tolera formatos mixtos de miles y decimales sin corrupción.');

// ----------------------------------------------------------------------------
// Test 10: Recálculo Dinámico de KPIs al Aplicar Filtros
// ----------------------------------------------------------------------------
console.log('▶ Test 10: Recálculo Dinámico de KPIs al Filtrar (PM, Bodega, etc.)');

const allStats = computeForecastStats(INITIAL_FORECAST_SEEDS);
const raulRecords = filterForecastRecords(INITIAL_FORECAST_SEEDS, { pmResponsable: 'Raul Cuevas' });
const raulStats = computeForecastStats(raulRecords);

assert.ok(raulRecords.length > 0 && raulRecords.length < INITIAL_FORECAST_SEEDS.length, 'Debe haber filtrado un subconjunto de Raul Cuevas');
assert.strictEqual(raulStats.totalRecords, raulRecords.length, 'totalRecords debe ser el número filtrado');
assert.ok(raulStats.totalUsdIntcomex < allStats.totalUsdIntcomex, 'El monto sumado de Raul Cuevas debe ser menor al total global');
assert.ok(raulStats.totalUsdIntcomex > 0, 'El monto sumado de Raul Cuevas debe ser mayor a 0');

console.log(`  ✅ KPIs dinámicos verificados: Global=${allStats.totalUsdIntcomex.toLocaleString()} USD (${allStats.totalRecords}) vs Raul Cuevas=${raulStats.totalUsdIntcomex.toLocaleString()} USD (${raulStats.totalRecords}).`);

// ----------------------------------------------------------------------------
// Test 11: Motor Anti-Duplicación Multi-Vectorial y Carga Excel en Forecast
// ----------------------------------------------------------------------------
console.log('\n▶ Test 11: Motor Anti-Duplicación Multi-Vectorial (findMatchingForecastRecord & importForecastFromExcel)');

// 11.1: Coincidencia por Cisco SO
const matchSoRecord = findMatchingForecastRecord(INITIAL_FORECAST_SEEDS, {
  so: '  #120636454  ',
  partner: 'Otro Partner Inventado',
});
assert.ok(matchSoRecord, 'Debe coincidir por Cisco SO');
assert.strictEqual(matchSoRecord?.id, 'FC-0002');

// 11.2: Coincidencia por Purchase Order (PO) / OC
const seedsWithPo: ForecastRecord[] = [
  ...INITIAL_FORECAST_SEEDS,
  {
    ...INITIAL_FORECAST_SEEDS[0],
    id: 'FC-9999',
    po: 'PO-CLIENT-7788',
    partner: 'Claro Chile',
    endUser: 'Entel',
  },
];
const matchPoRecord = findMatchingForecastRecord(seedsWithPo, {
  po: 'PO-CLIENT-7788',
  partner: 'Claro Chile',
});
assert.ok(matchPoRecord, 'Debe coincidir por PO + Partner');
assert.strictEqual(matchPoRecord?.id, 'FC-9999');

// 11.3: Coincidencia por Huella Compuesta Partner + EndUser + Monto USD (±2%)
const matchCompositeForecast = findMatchingForecastRecord(INITIAL_FORECAST_SEEDS, {
  partner: 'Advisers TIC',
  endUser: 'SAESA',
  usd: 11249, // Original es 11248.41
});
assert.ok(matchCompositeForecast, 'Debe coincidir por huella compuesta Partner + EndUser + USD ±2%');
assert.strictEqual(matchCompositeForecast?.id, 'FC-0002');

// 11.4: Importación Excel sin duplicar
const forecastExcelRows = [
  FORECAST_36_COLUMNS.map((c) => c.label),
  // Fila duplicada existente (FC-0002 SAESA / Deal 84365221) pero con nuevo número de venta
  [
    '22-10-2026',
    '22-10-2026',
    'CISCO',
    'Raul Cuevas',
    'Advisers TIC',
    'Nelson Martinez',
    'SAESA',
    '11,248.41',
    'nelson@advisers.cl',
    '31-12-2026',
    'saesa@saesa.cl',
    'Switching Catalyst',
    'OC-SAESA-11',
    '84365221',
    '10,000',
    '0',
    '1,248.41',
    '0',
    'J. Galloni',
    'Top Volume',
    'Actualización vía Excel',
    'DSV-OK',
    'PO-9911',
    '120636454',
    '2026-10-22',
    'SAESA SPA',
    '84365221',
    'SAESA',
    'Av. Los Conquistadores',
    '55554444', // Nuevo NV
    'E1',
    'CAS-1122',
    '2026-12-31',
    'Aprobado',
    'NC-99',
    'Aprobado',
  ],
  // Fila 100% nueva
  [
    '01-11-2026',
    '01-11-2026',
    'CISCO',
    'Raul Cuevas',
    'Partner Inédito SpA',
    'Maria Lopez',
    'Banco Nuevo',
    '50,000.00',
    'maria@inedito.cl',
    '15-12-2026',
    'banco@nuevo.cl',
    'Meraki MR',
    'OC-BN-01',
    '99887766',
    '40,000',
    '0',
    '0',
    '10,000',
    'AM Gomez',
    'Corporate',
    'Deal nuevo cargado por Excel',
    '',
    '',
    '',
    '',
    'Banco Nuevo',
    '99887766',
    'Banco Nuevo',
    'Av. Providencia 1234',
    '',
    'E1',
    '',
    '',
    'Aprobado',
    '',
    '',
  ],
];

const wbFc = XLSX.utils.book_new();
const wsFc = XLSX.utils.aoa_to_sheet(forecastExcelRows);
XLSX.utils.book_append_sheet(wbFc, wsFc, 'Forecast');
const fcBuffer = XLSX.write(wbFc, { type: 'array', bookType: 'xlsx' });

const fcRes = await importForecastFromExcel(fcBuffer, INITIAL_FORECAST_SEEDS.slice(0, 10));
assert.strictEqual(fcRes.addedCount, 1, 'Debe haber agregado solo 1 deal nuevo');
assert.strictEqual(fcRes.updatedCount, 1, 'Debe haber actualizado 1 deal existente sin duplicar');

console.log('  ✅ Carga e Importación Excel en Forecast con motor Anti-Duplicación validada exitosamente.');

console.log('\n============================================================');
console.log('🎉 TODAS LAS PRUEBAS DE FORECAST COMERCIAL (v2.9) PASARON CON ÉXITO!');
console.log('============================================================\n');

process.exit(0);
