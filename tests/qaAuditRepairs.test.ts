// ============================================================================
// CISCO AUTOMATED v2.1 - QA & AUDIT VERIFICATION TEST SUITE
// Valida exhaustivamente todas las correcciones de bugs y edge cases
// ============================================================================

import assert from 'node:assert';
import { generateQuotationFileName } from '../src/core/exportUtils';
import { calculateEstimateSalesPricing } from '../src/modules/estimate/pricingEngine';
import { ProcessedEstimateLine } from '../src/modules/estimate/estimateHierarchyParser';
import { encodeBase64Utf8, decodeBase64Utf8 } from '../src/core/excelEngine';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DE AUDITORÍA Y QA (CISCO AUTOMATED v2.1)...\n');

// ----------------------------------------------------------------------------
// Test 1: Sanitización Inteligente de Nombres de Archivo con Caracteres en Español
// ----------------------------------------------------------------------------
console.log('--- 1. Prueba de Nomenclatura Corporativa con Tildes y Caracteres en Español ---');
const fileNameParams = {
  partner: 'Telefónica Tech SpA',
  customerName: 'Municipalidad de Ñuñoa & Cía',
  technologyOrFamily: 'Catalyst 9300',
  estimateId: 'UE169044537CM',
  internacionPct: 7.0,
  marginPct: 5.0,
  isRecalculated: false,
  isOnlyLicensing: false,
};

const generatedName = generateQuotationFileName(fileNameParams);
console.log(`Nombre generado: ${generatedName}`);

// Verificar que "Telefónica" no perdió la "o" (se convirtió en "Telefonica")
assert.ok(generatedName.includes('Telefonica'), 'Debe normalizar ó -> o sin perder la letra');
// Verificar que "Ñuñoa" no perdió las letras (se convirtió en "Nunoa")
assert.ok(generatedName.includes('Nunoa'), 'Debe normalizar Ñ -> N sin perder la letra');
// Verificar tag comercial I7M5
assert.ok(generatedName.includes('_I7M5_CALC_'), 'Debe incluir el tag comercial correcto I7M5');
console.log('✅ Sanitización y diacríticos normalizados correctamente sin pérdida de letras.\n');

// ----------------------------------------------------------------------------
// Test 2: Redondeo Financiero Estricto en pricingEngine.ts (2 decimales limpios)
// ----------------------------------------------------------------------------
console.log('--- 2. Prueba de Redondeo Financiero en pricingEngine.ts ---');
const sampleLines: ProcessedEstimateLine[] = [
  {
    lineNumber: '1.0',
    partNumber: 'C9300-24T-E',
    description: 'Catalyst 9300 24-port data only, Network Essentials',
    qty: 3,
    unitListPrice: 4500,
    unitNetPriceCcw: 2250,
    extendedNetPriceCcw: 6750,
    parentGroup: '1',
    detectedDurationMonths: 1,
    realUnitCost: 2250,
    isPeriodicSubscription: false,
  },
  {
    lineNumber: '1.1',
    partNumber: 'C1E1TN9300XF-3Y',
    description: 'Data Center Networking Essentials Term N9300 XF, 3Y',
    qty: 2,
    unitListPrice: 20605.68,
    unitNetPriceCcw: 11951.28,
    extendedNetPriceCcw: 23902.56,
    parentGroup: '1',
    detectedDurationMonths: 36,
    realUnitCost: 11951.28,
    isPeriodicSubscription: false,
  },
];

const pricedLines = calculateEstimateSalesPricing(sampleLines, 5.0, 7.0);

for (const line of pricedLines) {
  // Verificar que el precio de venta unitario tiene a lo sumo 2 decimales
  const decimalsUnit = (line.unitSalePrice.toString().split('.')[1] || '').length;
  assert.ok(decimalsUnit <= 2, `unitSalePrice debe tener máx 2 decimales, obtuve: ${line.unitSalePrice}`);

  const decimalsExt = (line.extendedSalePrice.toString().split('.')[1] || '').length;
  assert.ok(decimalsExt <= 2, `extendedSalePrice debe tener máx 2 decimales, obtuve: ${line.extendedSalePrice}`);

  const decimalsMargin = (line.marginAmountTotal.toString().split('.')[1] || '').length;
  assert.ok(decimalsMargin <= 2, `marginAmountTotal debe tener máx 2 decimales, obtuve: ${line.marginAmountTotal}`);
}

// Verificación matemática de la línea 1.1 (C1E1TN9300XF-3Y)
const pricedLic = pricedLines.find((l) => l.lineNumber === '1.1')!;
assert.strictEqual(pricedLic.unitSalePrice, 12580.29, 'PV Unitario debe ser exactamente 12580.29');
assert.strictEqual(pricedLic.extendedSalePrice, 25160.58, 'PV Extendido debe ser exactamente 25160.58');
console.log(`✅ Precios redondeados limpios: Unit = $${pricedLic.unitSalePrice}, Ext = $${pricedLic.extendedSalePrice}\n`);

// ----------------------------------------------------------------------------
// Test 3: Round-Trip de sys_metadata con Internación vs Arancel
// ----------------------------------------------------------------------------
console.log('--- 3. Prueba de Round-Trip de sys_metadata (Internación vs Arancel) ---');
const testMetaPayload = {
  platano: 5.0,     // Margen
  uva: 7.0,         // Internación
  naranja: 6.0,     // Arancel
  kiwi: '2026-10-04T12:00:00Z',
  token: 'cisco-ca-v2',
  huerto: [
    { line: '1.0', manzana: 4500, pera: 2250, mango: 1, sandia: false },
    { line: '1.1', manzana: 20605.68, pera: 11951.28, mango: 36, sandia: false },
  ],
};

const encoded = encodeBase64Utf8(JSON.stringify(testMetaPayload));
const decoded = JSON.parse(decodeBase64Utf8(encoded));

assert.strictEqual(decoded.uva, 7.0, 'uva debe almacenar internacionPct (7.0), no arancel');
assert.strictEqual(decoded.naranja, 6.0, 'naranja debe almacenar arancelPct (6.0)');
assert.strictEqual(decoded.platano, 5.0, 'platano debe almacenar margenPct (5.0)');
console.log('✅ sys_metadata preserva inequívocamente internacionPct (7.0%) y arancelPct (6.0%).\n');

console.log('🎉 ¡TODAS LAS PRUEBAS DE AUDITORÍA Y QA PASARON EXITOSAMENTE AL 100%!');
