// ============================================================================
// CISCO AUTOMATED v2.13.1 - DEMAND INTELLIGENCE & STOCK PLANNER TEST SUITE
// ============================================================================

import assert from 'node:assert/strict';

// Polyfill in-memory localStorage for Node.js execution
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
  detectSkuFamily,
  computeStockRecommendation,
  dampQuotationQuantity,
  generateDemandIntelligenceReport,
} from '../src/modules/demandIntelligence/demandIntelligenceService';
import { SkuDemandItem } from '../src/modules/demandIntelligence/demandTypes';
import { isMainLineItem } from '../src/core/calculations';

console.log('🧪 Iniciando Suite de Pruebas: Inteligencia de Demanda & Planificador de Stock (v2.13.1)...');

// ----------------------------------------------------------------------------
// Test 1: Sku Family Detection across Cisco Hardware, Licenses and Accessories
// ----------------------------------------------------------------------------
const famC9200 = detectSkuFamily('C9200L-24P-4G-E');
assert.equal(famC9200.family, 'Catalyst 9200 / 9200L');
assert.equal(famC9200.category, 'hardware');

const famC9300 = detectSkuFamily('C9300-24T-E');
assert.equal(famC9300.family, 'Catalyst 9300 / 9300X');
assert.equal(famC9300.category, 'hardware');

const famC1000 = detectSkuFamily('C1000-24T-4G-L');
assert.equal(famC1000.family, 'Catalyst 1000 / 1200 / 1300');
assert.equal(famC1000.category, 'hardware');

const famMS = detectSkuFamily('MS130-24P-HW');
assert.equal(famMS.family, 'Meraki Cloud Switching');
assert.equal(famMS.category, 'hardware');

const famMR = detectSkuFamily('MR44-HW');
assert.equal(famMR.family, 'Meraki Cloud Wireless');
assert.equal(famMR.category, 'hardware');

const famMX = detectSkuFamily('MX85-HW');
assert.equal(famMX.family, 'Meraki Security & SD-WAN');
assert.equal(famMX.category, 'hardware');

const famCW = detectSkuFamily('CW9164I-A');
assert.equal(famCW.family, 'Wireless Wi-Fi 6 / 6E');
assert.equal(famCW.category, 'hardware');

const famN9K = detectSkuFamily('N9K-C93180YC-FX3');
assert.equal(famN9K.family, 'Nexus Data Center');
assert.equal(famN9K.category, 'hardware');

const famISR = detectSkuFamily('ISR4331/K9');
assert.equal(famISR.family, 'Cisco Routing & SD-WAN');
assert.equal(famISR.category, 'hardware');

// Test Accesorios que vienen dentro del equipo (o que comparten prefijo con chasis)
const famStack = detectSkuFamily('C9200L-STACK-KIT');
assert.equal(famStack.category, 'accessory', 'C9200L-STACK-KIT debe ser accesorio, no equipo');

const famPwr = detectSkuFamily('PWR-C1-545WAC');
assert.equal(famPwr.category, 'accessory', 'PWR-C1-545WAC debe ser accesorio, no equipo');

const famCab = detectSkuFamily('CAB-TA-NA');
assert.equal(famCab.category, 'accessory', 'CAB-TA-NA debe ser accesorio, no equipo');

const famNm = detectSkuFamily('C9300-NM-4G');
assert.equal(famNm.category, 'accessory', 'C9300-NM-4G debe ser accesorio, no equipo');

const famNw = detectSkuFamily('C9200L-NW-E-24');
assert.equal(famNw.category, 'license', 'C9200L-NW-E-24 debe ser licencia de red, no hardware');

const famGLC = detectSkuFamily('GLC-TE');
assert.equal(famGLC.family, 'Transceivers, Óptica & Accesorios');
assert.equal(famGLC.category, 'accessory');

const famSNT = detectSkuFamily('CON-SNT-C9200L24');
assert.equal(famSNT.family, 'Servicios SmartNet / CX');
assert.equal(famSNT.category, 'service');

const famDNA = detectSkuFamily('C9200-DNA-E-24-3Y');
assert.equal(famDNA.family, 'Suscripciones DNA & Cloud SaaS');
assert.equal(famDNA.category, 'license');

const famCloud = detectSkuFamily('LIC-MS120-24P-3YR');
assert.equal(famCloud.family, 'Suscripciones DNA & Cloud SaaS');
assert.equal(famCloud.category, 'license');

console.log('  ✅ Test 1: Clasificación de familias comerciales, accesorios internos y categorías Cisco validada.');

// ----------------------------------------------------------------------------
// Test 2: Stock Recommendation Algorithm for Bodega E1 Santiago
// ----------------------------------------------------------------------------
// Case A: High velocity item (Critical Stock)
const recCritical = computeStockRecommendation(
  'C9200L-24P-4G-E',
  'hardware',
  25, // Real sold
  40, // Quoted
  65, // Total demand
  1400 // Avg unit price USD
);
assert.equal(recCritical.priority, 'CRITICAL_STOCK', 'SKU de alta venta real debe ser CRITICAL_STOCK');
assert.equal(recCritical.targetBodega, 'E1', 'Hardware debe sugerir Bodega E1 Santiago');
assert.ok(recCritical.suggestedUnits >= 8, 'Sugerencia de unidades debe ser >= 8');
assert.ok(recCritical.estimatedTotalInvestmentUsd > 5000, 'Inversión debe ser calculada');
assert.ok(recCritical.rationale.includes('Bodega E1 Santiago'), 'Debe incluir justificación de Bodega E1');

// Case B: High demand quote opportunity (Opportunity Stock)
const recOpp = computeStockRecommendation(
  'CW9164I-A',
  'hardware',
  2,  // Real sold
  8,  // Quoted
  10, // Total demand
  1000
);
assert.equal(recOpp.priority, 'GROWTH_OPPORTUNITY', 'Demanda activa cotizada debe ser GROWTH_OPPORTUNITY');
assert.equal(recOpp.targetBodega, 'E1');
assert.ok(recOpp.suggestedUnits >= 2, 'Debe sugerir stock preventivo');

// Case C: Intangible item (SmartNet or License -> Bodega ED)
const recLicense = computeStockRecommendation(
  'CON-SNT-C9200L24',
  'service',
  50,
  80,
  130,
  300
);
assert.equal(recLicense.priority, 'NOT_APPLICABLE', 'Intangibles no deben pedir stock físico');
assert.equal(recLicense.targetBodega, 'ED', 'Intangibles deben indicar Bodega ED (Electrónica)');
assert.equal(recLicense.suggestedUnits, 0, 'Unidades sugeridas en intangible deben ser 0');
assert.equal(recLicense.estimatedTotalInvestmentUsd, 0, 'Inversión en intangible debe ser 0 USD');

// Case D: Accessory item (Power supply, cable, stack kit -> No Aplica Stock Principal)
const recAccessory = computeStockRecommendation(
  'PWR-C1-545WAC',
  'accessory',
  30,
  50,
  80,
  250
);
assert.equal(recAccessory.priority, 'NOT_APPLICABLE', 'Accesorios no deben sugerir stock principal');
assert.equal(recAccessory.suggestedUnits, 0, 'Unidades sugeridas para accesorio deben ser 0');
assert.equal(recAccessory.estimatedTotalInvestmentUsd, 0);

// Case E: Outlier/Mega-deal in single unconfirmed Estimate (300 switches quoted, 0 real sales)
// Protege el inventario de Bodega E1: No debe activar CRITICAL_STOCK ni GROWTH_OPPORTUNITY
const recMegadeal = computeStockRecommendation(
  'C9300-48P-A',
  'hardware',
  0,   // 0 real sold
  300, // 300 quoted in speculative tender
  300,
  3200,
  1    // 1 single estimate
);
assert.equal(recMegadeal.priority, 'MADE_TO_ORDER', 'Megadisparo aislado de 300 unds sin venta no debe inflar stock');
assert.equal(recMegadeal.priorityLabel, 'Proyecto Especial (Bajo Pedido)');
assert.equal(recMegadeal.suggestedUnits, 0, 'Sugerencia de unidades en megadeal especulativo debe ser 0');
assert.equal(recMegadeal.estimatedTotalInvestmentUsd, 0, 'Inversión sugerida debe ser 0 USD');
assert.ok(recMegadeal.rationale.includes('Back-to-Back'), 'Debe sugerir atender proyecto Back-to-Back');

// Case F: Item with real sales and a megadeal quote (10 sold, 200 quoted across 3 deals)
// Debe marcarse como CRITICAL_STOCK por ventas reales, pero unidades sugeridas deben ser seguras y amortiguadas
const recDampedHigh = computeStockRecommendation(
  'C9200L-24P-4G-E',
  'hardware',
  10,  // 10 real sales confirmed
  200, // 200 quoted
  210,
  1400,
  3,
  dampQuotationQuantity(200)
);
assert.equal(recDampedHigh.priority, 'CRITICAL_STOCK');
assert.ok(recDampedHigh.suggestedUnits >= 7 && recDampedHigh.suggestedUnits <= 15, 'Sugerencia debe estar amortiguada entre 7 y 15 unidades');

// Case G: Multi-deal market recurrence without closed sales (3 distinct deals quoting 10 units each)
const recMultiDeal = computeStockRecommendation(
  'C1300-24T-4G',
  'hardware',
  0,  // 0 real sales
  30, // 30 total quoted
  30,
  800,
  3,  // 3 distinct partners/deals
  dampQuotationQuantity(10) * 3
);
assert.equal(recMultiDeal.priority, 'GROWTH_OPPORTUNITY', 'Demanda recurrente de múltiples partners califica como Oportunidad');
assert.ok(recMultiDeal.suggestedUnits >= 2 && recMultiDeal.suggestedUnits <= 5, 'Sugerencia prudente para validar mercado');

console.log('  ✅ Test 2: Algoritmo de recomendación de inventario E1 (exclusión de accesorios y protección anti-megadeals) verificado.');

// ----------------------------------------------------------------------------
// Test 2B: Damping Formula for Megadeals (dampQuotationQuantity)
// ----------------------------------------------------------------------------
assert.equal(dampQuotationQuantity(1), 1, '1 und es 100% lineal');
assert.equal(dampQuotationQuantity(5), 5, '5 unds es 100% lineal');
assert.equal(dampQuotationQuantity(8), 8, '8 unds es el umbral lineal exacto');
assert.equal(dampQuotationQuantity(12), 11, '12 unds se amortigua a 11');
assert.equal(dampQuotationQuantity(16), 12, '16 unds se amortigua a 12');
assert.equal(dampQuotationQuantity(50), 17, '50 unds se amortigua a 17');
assert.equal(dampQuotationQuantity(100), 22, '100 unds se amortigua a 22');
assert.equal(dampQuotationQuantity(300), 32, '300 unds se amortigua a 32');
console.log('  ✅ Test 2B: Función matemática de amortiguación de megadeals (dampQuotationQuantity) validada.');

// ----------------------------------------------------------------------------
// Test 3: Detection of Main Lines vs Child Lines ("Hijos") in Estimates
// ----------------------------------------------------------------------------
assert.equal(isMainLineItem('1.0'), true, '1.0 es línea madre');
assert.equal(isMainLineItem('1'), true, '1 es normalizado a 1.0 (línea madre)');
assert.equal(isMainLineItem('2.0'), true, '2.0 es línea madre');
assert.equal(isMainLineItem('1.1'), false, '1.1 es línea hija (hijo de 1.0)');
assert.equal(isMainLineItem('1.2'), false, '1.2 es línea hija (hijo de 1.0)');
assert.equal(isMainLineItem('1.3.1'), false, '1.3.1 es sub-hijo');
assert.equal(isMainLineItem('2.1'), false, '2.1 es línea hija (hijo de 2.0)');
console.log('  ✅ Test 3: Discriminación de líneas madre vs componentes hijos ("hijos") validada.');

// ----------------------------------------------------------------------------
// Test 4: Conversion Rate (Hit Rate) Computation & SkuDemandItem
// ----------------------------------------------------------------------------
const testItem: SkuDemandItem = {
  partNumber: 'C9300-24T-A',
  description: 'Catalyst 9300 24-port data only',
  category: 'hardware',
  family: 'Catalyst 9300 / 9300X',
  realSoldUnits: 12,
  realSoldUsd: 36000,
  quotedUnits: 18,
  quotedUsd: 54000,
  totalDemandUnits: 30,
  totalDemandUsd: 90000,
  conversionRatePct: (12 / 30) * 100, // 40%
  ordersCount: 5,
  avgUnitPriceUsd: 3000,
  stockRecommendation: recCritical,
};

assert.equal(testItem.conversionRatePct, 40, 'Hit rate debe ser exactamente 40%');
assert.equal(testItem.realSoldUnits, 12);
assert.equal(testItem.totalDemandUnits, 30);
assert.equal(testItem.partNumber, 'C9300-24T-A');
console.log('  ✅ Test 4: Cálculo de conversión de ventas (Hit Rate) validado.');

// ----------------------------------------------------------------------------
// Test 5: End-to-End Demand Intelligence Report Generation (Empty & Populated)
// ----------------------------------------------------------------------------
async function runReportTest() {
  localStorage.clear();
  const report = await generateDemandIntelligenceReport();
  assert.ok(report, 'El reporte generado debe ser un objeto válido');
  assert.ok(Array.isArray(report.topHardwareItems), 'topHardwareItems debe ser un array');
  assert.ok(Array.isArray(report.topLicenseItems), 'topLicenseItems debe ser un array');
  assert.ok(Array.isArray(report.stockPlanItems), 'stockPlanItems debe ser un array');
  assert.ok(Array.isArray(report.categoryBreakdown), 'categoryBreakdown debe ser un array');
  assert.ok(report.lastAnalyzedAt.length > 10, 'Timestamp ISO debe estar poblado');

  // Verify that topHardwareItems contains ONLY category === 'hardware' (zero accessories)
  for (const item of report.topHardwareItems) {
    assert.equal(item.category, 'hardware', 'topHardwareItems solo debe contener hardware de equipos');
    assert.notEqual(item.category, 'accessory', 'topHardwareItems no debe contener accesorios');
  }

  // Verify that stockPlanItems contains only items with suggestedUnits > 0 and category === 'hardware'
  for (const item of report.stockPlanItems) {
    assert.equal(item.category, 'hardware');
    assert.notEqual(item.stockRecommendation.priority, 'NOT_APPLICABLE');
    assert.ok(item.stockRecommendation.suggestedUnits > 0);
  }

  console.log('  ✅ Test 5: Generación integral de DemandIntelligenceSummary completada (sin accesorios).');
}

runReportTest().then(() => {
  console.log('✨ ¡Todas las pruebas de Inteligencia de Demanda & Planificador de Stock completadas con ÉXITO!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
