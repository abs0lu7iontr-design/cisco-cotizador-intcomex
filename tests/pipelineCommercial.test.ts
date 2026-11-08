// ============================================================================
// TESTS: CISCO PIPELINE COMERCIAL & OPORTUNIDADES (v2.8)
// ============================================================================

import assert from 'node:assert/strict';
import {
  PIPELINE_INITIAL_SEEDS,
} from '../src/modules/pipeline/pipelineSeeds';
import {
  calculatePipelineStats,
  filterPipelineDeals,
  extractPipelineDealFromEstimate,
  findMatchingPipelineDeal,
  importPipelineFromExcel,
  PIPELINE_EXCEL_HEADERS,
} from '../src/modules/pipeline/pipelineService';
import * as XLSX from 'xlsx';
import {
  PipelineDealRecord,
} from '../src/modules/pipeline/pipelineTypes';
import { ProcessedEstimateResult, EstimateLineItem } from '../src/core/types';

console.log('🧪 Iniciando Suite de Pruebas: Pipeline Comercial Cisco Intcomex (v2.8)...\n');

// ----------------------------------------------------------------------------
// Test 1: Catálogo Base de 70 Deals Oficiales (Integridad de Seeds)
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Verificación de Integridad de Seeds Iniciales (70 Deals)');
assert.strictEqual(PIPELINE_INITIAL_SEEDS.length, 70, `Se esperaban 70 deals iniciales, se obtuvieron ${PIPELINE_INITIAL_SEEDS.length}`);

// Validar deal insignia 1: Advisers Tic / BHP
const deal1 = PIPELINE_INITIAL_SEEDS[0];
assert.strictEqual(deal1.partner, 'Advisers Tic');
assert.strictEqual(deal1.endUser, 'BHP');
assert.strictEqual(deal1.usd, 1085000);
assert.strictEqual(deal1.pmResponsable, 'Marta Adasme');
assert.strictEqual(deal1.porcentajeAvance, 20);
assert.strictEqual(deal1.dealId, '80156257');
assert.strictEqual(deal1.grupoVentas, 'Enterprise');

// Validar deal con Price Protection: Business Conected / Maxagro
const deal2 = PIPELINE_INITIAL_SEEDS[1];
assert.strictEqual(deal2.partner, 'Business Conected');
assert.strictEqual(deal2.endUser, 'Maxagro');
assert.strictEqual(deal2.usd, 107849);
assert.strictEqual(deal2.priceProtectionExpiryDate, '11/3/2026');

// Validar deal Meraki: Claro / Grupo Tresa
const deal3 = PIPELINE_INITIAL_SEEDS[2];
assert.strictEqual(deal3.partner, 'Claro');
assert.strictEqual(deal3.endUser, 'Grupo Tresa');
assert.strictEqual(deal3.meraki, 175000);

// Validar deal con desglose Productos + Servicios: Comtec Global / Chubb ($440,000)
const dealChubb = PIPELINE_INITIAL_SEEDS.find((d) => d.dealId === '84443241');
assert.ok(dealChubb, 'Deal Chubb 84443241 debe existir');
assert.strictEqual(dealChubb.usd, 440000);
assert.strictEqual(dealChubb.productosSuscripciones, 250000);
assert.strictEqual(dealChubb.servicios, 190000);

console.log('  ✅ 70 Deals iniciales validados con montos, fechas, PMs y desgloses correctos.');

// ----------------------------------------------------------------------------
// Test 2: Cálculo de Estadísticas y Forecast Ponderado
// ----------------------------------------------------------------------------
console.log('\n▶ Test 2: Cálculo de Estadísticas, Agregaciones y Forecast Ponderado');
const stats = calculatePipelineStats(PIPELINE_INITIAL_SEEDS);

assert.strictEqual(stats.totalDeals, 70);
assert.ok(stats.totalUsd > 21000000, `Total USD esperado > $21M, obtenido: $${stats.totalUsd}`);
assert.ok(stats.forecastPonderadoUsd > 5000000, `Forecast ponderado esperado > $5M, obtenido: $${stats.forecastPonderadoUsd}`);
assert.ok(stats.totalProductosSuscripciones > 0, 'Total Productos + Suscripciones debe ser > 0');
assert.ok(stats.totalServicios > 0, 'Total Servicios debe ser > 0');
assert.ok(stats.totalMeraki > 0, 'Total Meraki debe ser > 0');

console.log(`  ✅ Total Pipeline: $${stats.totalUsd.toLocaleString()} USD`);
console.log(`  ✅ Forecast Ponderado: $${stats.forecastPonderadoUsd.toLocaleString()} USD`);
console.log(`  ✅ Mix: Prod+Sub: $${stats.totalProductosSuscripciones.toLocaleString()} | Serv: $${stats.totalServicios.toLocaleString()} | Meraki: $${stats.totalMeraki.toLocaleString()}`);

// ----------------------------------------------------------------------------
// Test 3: Filtros Multicriterio del Pipeline
// ----------------------------------------------------------------------------
console.log('\n▶ Test 3: Filtros Multicriterio (PM, Grupo, Mes, Avance, Búsqueda)');

// Filtro por PM Raul Cuevas
const raulDeals = filterPipelineDeals(PIPELINE_INITIAL_SEEDS, { pmResponsable: 'Raul Cuevas' });
assert.ok(raulDeals.length > 30, 'Raul Cuevas debe tener más de 30 deals');
assert.ok(raulDeals.every((d) => d.pmResponsable === 'Raul Cuevas'));

// Filtro por Grupo Top Volume
const topVolDeals = filterPipelineDeals(PIPELINE_INITIAL_SEEDS, { grupoVentas: 'Top Volume' });
assert.ok(topVolDeals.length > 5, 'Deben existir deals en Top Volume');
assert.ok(topVolDeals.every((d) => d.grupoVentas === 'Top Volume'));

// Búsqueda por texto (ej. "Chubb")
const chubbDeals = filterPipelineDeals(PIPELINE_INITIAL_SEEDS, { searchQuery: 'Chubb' });
assert.ok(chubbDeals.length >= 6, 'Deben existir al menos 6 deals de Chubb');

console.log('  ✅ Filtros por PM, Grupo de Ventas y Búsqueda operan correctamente.');

// ----------------------------------------------------------------------------
// Test 4: Cruce de Datos Automático con Cotizador Cisco CCW
// ----------------------------------------------------------------------------
console.log('\n▶ Test 4: Extracción y Clasificación Automática desde Cotización CCW');

const mockEstimateItems: EstimateLineItem[] = [
  // 1. Hardware tradicional
  {
    rowIdx: 1,
    lineNumber: '1.0',
    partNumber: 'C9300-24P-A',
    smartAccountMandatory: 'No',
    description: 'Catalyst 9300 24-port PoE+',
    serviceDurationMonths: '',
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 días',
    unitListPrice: 5000,
    pricingTerm: '1',
    qty: 2,
    netCiscoUnit: 2500,
    discPct: 50,
    isIntangible: false,
    llevaArancel: true,
    costoInternacion: 175,
    costoArancel: 150,
    costoTotalUnitario: 2825,
    precioVentaUnitario: 3000,
    precioVentaExtendido: 6000,
  },
  // 2. Meraki Access Point
  {
    rowIdx: 2,
    lineNumber: '2.0',
    partNumber: 'MR36-HW',
    smartAccountMandatory: 'No',
    description: 'Meraki MR36 Cloud Managed AP',
    serviceDurationMonths: '',
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 días',
    unitListPrice: 700,
    pricingTerm: '1',
    qty: 3,
    netCiscoUnit: 350,
    discPct: 50,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 24.5,
    costoArancel: 0,
    costoTotalUnitario: 374.5,
    precioVentaUnitario: 400,
    precioVentaExtendido: 1200,
  },
  // 3. Soporte SmartNet
  {
    rowIdx: 3,
    lineNumber: '3.0',
    partNumber: 'CON-SNT-C930024A',
    smartAccountMandatory: 'No',
    description: 'SNTC 8X5XNBD Catalyst 9300',
    serviceDurationMonths: '36',
    originalLeadTimeDays: 0,
    transformedLeadTime: 'Estándar',
    unitListPrice: 600,
    pricingTerm: '36',
    qty: 2,
    netCiscoUnit: 300,
    discPct: 50,
    isIntangible: true,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 300,
    precioVentaUnitario: 320,
    precioVentaExtendido: 640,
  },
];

const mockEstimate: ProcessedEstimateResult = {
  fileName: 'Cotizacion_Netics_Hospital.xlsx',
  headerInfo: {
    companyName: 'Netics',
    address: 'Av Providencia 123',
    city: 'Santiago',
    country: 'Chile',
    phone: '+56911223344',
    estimateId: 'TEST_EST_9999',
    dealId: '88889999',
    priceList: 'Global Price List',
    date: '2026-11-02',
    customerName: 'Hospital Regional',
    endUser: 'Hospital Regional',
  },
  items: mockEstimateItems,
  originalProductTotal: 6250,
  calculatedProductTotal: 7840,
  serviceTotal: 640,
  subscriptionTotal: 0,
  finalTotalPrice: 7840,
  headerRowIndex: 12,
};

const extractedDeal = extractPipelineDealFromEstimate(mockEstimate, {
  username: 'rcuevas',
  full_name: 'Raul Cuevas',
  role: 'pm',
  email: 'rcuevas@intcomex.com',
});

assert.strictEqual(extractedDeal.partner, 'Netics');
assert.strictEqual(extractedDeal.endUser, 'Hospital Regional');
assert.strictEqual(extractedDeal.dealId, '88889999');
assert.strictEqual(extractedDeal.pmResponsable, 'Raul Cuevas');
assert.strictEqual(extractedDeal.porcentajeAvance, 30); // 30% Propuesta Oficial
assert.strictEqual(extractedDeal.usd, 7840);
assert.strictEqual(extractedDeal.productosSuscripciones, 6000, 'Hardware Catalyst debe clasificarse en Prod+Sub ($6000)');
assert.strictEqual(extractedDeal.meraki, 1200, 'MR36-HW debe clasificarse en Meraki ($1200)');
assert.strictEqual(extractedDeal.servicios, 640, 'CON-SNT debe clasificarse en Servicios SmartNet ($640)');

console.log('  ✅ Extracción y desglose automático HW ($6000), Meraki ($1200) y Servicios ($640) verificado al 100%.');

// ----------------------------------------------------------------------------
// Test 5: Estructura de Columnas Oficiales para Exportación Excel (19 Columnas)
// ----------------------------------------------------------------------------
console.log('\n▶ Test 5: Validación de 19 Columnas Oficiales para Excel');
assert.strictEqual(PIPELINE_EXCEL_HEADERS.length, 19, 'Deben existir exactamente 19 columnas');
assert.deepStrictEqual(PIPELINE_EXCEL_HEADERS, [
  'Fecha de Levantamiento',
  'Fecha de Cotizacion',
  'Marca',
  'PM Responsable',
  'Partner/Reseller',
  'Ejecutivo Partner',
  'End User',
  'USD',
  'Mes de Cierre',
  'Mes de Facturación',
  'Porcentaje de Avance',
  '#Registro Oportunidad Marca',
  'Productos + Suscripciones',
  'Servicios',
  'Meraki',
  'AM',
  'GRUPO DE Ventas',
  'Notas',
  'Price Protection Expiry Date',
]);
console.log('  ✅ Encabezados de exportación Excel idénticos a la estructura requerida.');

// ----------------------------------------------------------------------------
// Test 6: Recálculo Dinámico de Estadísticas al Filtrar (PM, Grupo, Mes, etc.)
// ----------------------------------------------------------------------------
console.log('\n▶ Test 6: Recálculo Dinámico de Estadísticas al Filtrar');
const globalStats = calculatePipelineStats(PIPELINE_INITIAL_SEEDS);
const raulDealsFiltered = filterPipelineDeals(PIPELINE_INITIAL_SEEDS, { pmResponsable: 'Raul Cuevas' });
const raulStats = calculatePipelineStats(raulDealsFiltered);

assert.ok(raulDealsFiltered.length > 0 && raulDealsFiltered.length < PIPELINE_INITIAL_SEEDS.length);
assert.strictEqual(raulStats.totalDeals, raulDealsFiltered.length, 'totalDeals debe ser el subconjunto filtrado');
assert.ok(raulStats.totalUsd < globalStats.totalUsd, 'El total USD filtrado debe ser menor al global');
assert.ok(raulStats.totalUsd > 0, 'El total USD filtrado debe ser mayor a 0');
assert.ok(raulStats.forecastPonderadoUsd < globalStats.forecastPonderadoUsd, 'El forecast ponderado filtrado debe ser menor al global');

console.log(`  ✅ Estadísticas dinámicas verificadas: Global=${globalStats.totalUsd.toLocaleString()} USD (${globalStats.totalDeals}) vs Raul Cuevas=${raulStats.totalUsd.toLocaleString()} USD (${raulStats.totalDeals}).`);

// ----------------------------------------------------------------------------
// Test 7: Tolerancia a Formatos de Moneda (. y , / CLP & USD) y Fallback de Suma
// ----------------------------------------------------------------------------
console.log('\n▶ Test 7: Tolerancia a Formatos de Moneda (. y ,) y Fallback de Desglose');

const mockDealsMixedFormats: PipelineDealRecord[] = [
  {
    ...PIPELINE_INITIAL_SEEDS[0],
    id: 'deal_fmt_1',
    usd: ('$ 1,085,000' as any),
    porcentajeAvance: 20,
    productosSuscripciones: ('1,085,000' as any),
    servicios: 0,
    meraki: 0,
  },
  {
    ...PIPELINE_INITIAL_SEEDS[1],
    id: 'deal_fmt_2',
    usd: ('107.849,40' as any),
    porcentajeAvance: 30,
    productosSuscripciones: ('100.000,00' as any),
    servicios: ('7.849,40' as any),
    meraki: 0,
  },
  {
    ...PIPELINE_INITIAL_SEEDS[2],
    id: 'deal_fmt_3',
    usd: 0, // Fallback: debe auto-sumar el desglose tecnológico
    porcentajeAvance: 50,
    productosSuscripciones: 50000,
    servicios: 25000,
    meraki: 25000,
  },
];

const mixedStats = calculatePipelineStats(mockDealsMixedFormats);
assert.strictEqual(mixedStats.totalDeals, 3);
// 1085000 + 107849.40 + 100000 = 1292849.40
assert.strictEqual(mixedStats.totalUsd, 1292849.40, `Suma esperada 1292849.40, obtenida ${mixedStats.totalUsd}`);
assert.strictEqual(mixedStats.totalMeraki, 25000);
assert.strictEqual(mixedStats.totalServicios, 32849.40);
console.log(`  ✅ Parser y suma flexible verificada: Total USD = $${mixedStats.totalUsd.toLocaleString()} USD.`);

// ----------------------------------------------------------------------------
// Test 8: Motor Anti-Duplicación Multi-Vectorial y Conciliación Inteligente
// ----------------------------------------------------------------------------
console.log('\n▶ Test 8: Motor Anti-Duplicación Multi-Vectorial (findMatchingPipelineDeal)');

// 8.1: Vector 1 - Deal ID oficial Cisco CCW (incluso con espacios o prefijo '#')
const matchByDealId = findMatchingPipelineDeal(PIPELINE_INITIAL_SEEDS, {
  dealId: '  #80156257  ',
  partner: 'Nombre Partner Distinto',
  endUser: 'Otro Cliente',
});
assert.ok(matchByDealId, 'Debe coincidir por Deal ID 80156257');
assert.strictEqual(matchByDealId?.partner, 'Advisers Tic');
assert.strictEqual(matchByDealId?.endUser, 'BHP');

// 8.2: Vector 2 - Estimate ID
const dealsWithEstimate: PipelineDealRecord[] = [
  ...PIPELINE_INITIAL_SEEDS,
  {
    ...PIPELINE_INITIAL_SEEDS[0],
    id: 'deal_custom_est',
    sourceEstimateId: 'EST-998877',
  },
];
const matchByEst = findMatchingPipelineDeal(dealsWithEstimate, {
  sourceEstimateId: 'est-998877',
});
assert.ok(matchByEst, 'Debe coincidir por sourceEstimateId');
assert.strictEqual(matchByEst?.id, 'deal_custom_est');

// 8.3: Vector 3 - Huella Compuesta Partner + End User + Monto USD (±2%)
const matchByComposite = findMatchingPipelineDeal(PIPELINE_INITIAL_SEEDS, {
  partner: 'Business Conected S.A.',
  endUser: 'Maxagro',
  usd: 107850, // Deal real es 107849 (diferencia de $1 USD)
});
assert.ok(matchByComposite, 'Debe coincidir por Partner + EndUser + Monto USD ±2%');
assert.strictEqual(matchByComposite?.dealId, '84450929');

// 8.4: Protección de Múltiples Negocios para el Mismo Cliente (No colapsar erróneamente)
// Comtec Global tiene varios negocios con Chubb (ej. 84443241 por $440k vs 85949828 por $78,130)
const matchChubbSmall = findMatchingPipelineDeal(PIPELINE_INITIAL_SEEDS, {
  dealId: '85949828',
  partner: 'Comtec Global',
  endUser: 'Chubb',
  usd: 78130,
});
assert.strictEqual(matchChubbSmall?.usd, 78130, 'Debe coincidir con el negocio específico de $78,130 y no con el de $440k');

// 8.5: Carga e Importación desde Excel sin Duplicar (importPipelineFromExcel)
const excelRows = [
  [
    'FECHA LEV.',
    'FECHA COT.',
    'MARCA',
    'PM RESP.',
    'PARTNER / RESELLER',
    'EJECUTIVO PARTNER',
    'END USER (CLIENTE FINAL)',
    'MONTO USD',
    'MES CIERRE',
    'MES FACTURACION',
    '% AVANCE',
    '# REG. OPORTUNIDAD MARCA',
    'PROD. + SUSCRIPCIONES',
    'SERVICIOS',
    'MERAKI',
    'AM',
    'GRUPO DE VENTAS',
    'NOTAS',
    'Price Protection Expiry Date',
  ],
  // Fila duplicada existente (BHP / Deal 80156257) pero con notas actualizadas
  [
    '1/8/2026',
    '1/8/2026',
    'Cisco',
    'Marta Adasme',
    'Advisers Tic',
    'Nelson Martinez',
    'BHP',
    '1,085,000',
    'Julio',
    'Julio',
    '25%',
    '80156257',
    '1,085,000',
    '0',
    '0',
    'J. Galloni',
    'Enterprise',
    'Nota de actualización desde Excel',
    '2026-12-31',
  ],
  // Fila totalmente nueva
  [
    '2/8/2026',
    '2/8/2026',
    'Cisco',
    'Raul Cuevas',
    'Partner Inédito SpA',
    'Pedro Gomez',
    'Cliente Nuevo Global',
    '95,000',
    'Agosto',
    'Agosto',
    '40%',
    '99998888',
    '75,000',
    '20,000',
    '0',
    'M. Skill',
    'Corporate',
    'Oportunidad nueva',
    '',
  ],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(excelRows);
XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

const importResult = await importPipelineFromExcel(excelBuffer);
assert.strictEqual(importResult.addedCount, 1, 'Debe haber agregado solo 1 oportunidad nueva');
assert.strictEqual(importResult.updatedCount, 1, 'Debe haber actualizado 1 oportunidad existente sin duplicar');

console.log('  ✅ Motor Anti-Duplicación y reconciliación Excel validado exitosamente en Pipeline.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DEL PIPELINE COMERCIAL COMPLETADAS AL 100% CON ÉXITO!\n');
process.exit(0);
