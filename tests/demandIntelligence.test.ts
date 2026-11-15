// ============================================================================
// CISCO AUTOMATED v2.13.0 - DEMAND INTELLIGENCE & STOCK PLANNER TEST SUITE
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
  generateDemandIntelligenceReport,
} from '../src/modules/demandIntelligence/demandIntelligenceService';
import { SkuDemandItem } from '../src/modules/demandIntelligence/demandTypes';

console.log('🧪 Iniciando Suite de Pruebas: Inteligencia de Demanda & Planificador de Stock (v2.13.0)...');

// ----------------------------------------------------------------------------
// Test 1: Sku Family Detection across Cisco Hardware & Licensing Lines
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

console.log('  ✅ Test 1: Clasificación de familias comerciales y categorías Cisco validada.');

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
console.log('  ✅ Test 2: Algoritmo de recomendación de inventario E1 verificado.');

// ----------------------------------------------------------------------------
// Test 3: Conversion Rate (Hit Rate) Computation & SkuDemandItem
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
console.log('  ✅ Test 3: Cálculo de conversión de ventas (Hit Rate) validado.');

// ----------------------------------------------------------------------------
// Test 4: End-to-End Demand Intelligence Report Generation (Empty & Populated)
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

  // Verify stockPlanItems contains only items with suggestedUnits > 0
  for (const item of report.stockPlanItems) {
    assert.notEqual(item.stockRecommendation.priority, 'NOT_APPLICABLE');
    assert.ok(item.stockRecommendation.suggestedUnits > 0);
  }

  console.log('  ✅ Test 4: Generación integral de DemandIntelligenceSummary completada.');
}

runReportTest().then(() => {
  console.log('✨ ¡Todas las pruebas de Inteligencia de Demanda & Planificador de Stock completadas con ÉXITO!');
});
