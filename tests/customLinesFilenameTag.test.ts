// ============================================================================
// CISCO AUTOMATED v2.4.3 - CUSTOM PARAMETERS FILENAME TAG TEST SUITE
// Valida que en modo 'custom_lines', el nombre corporativo del archivo
// refleje exactamente las tasas custom aplicadas (ej. _I23M6_) y no los defaults CCW estándar (_I7M5_).
// ============================================================================

import assert from 'node:assert';
import { generateQuotationFileName, resolveEffectiveQuoteRates } from '../src/core/exportUtils';
import { recalculateEstimateResult } from '../src/core/calculations';
import { QuoteParameters, ProcessedEstimateResult, EstimateItem } from '../src/core/types';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DE NOMENCLATURA CON PARÁMETROS CUSTOM (v2.4.3)...\n');

// ----------------------------------------------------------------------------
// Test 1: Modo Custom Lines directo sin ítems en memoria (desde lineCustomParams)
// ----------------------------------------------------------------------------
console.log('--- 1. Prueba de Nomenclatura con Parámetros Custom desde lineCustomParams ---');

const customParams: QuoteParameters = {
  internacionPct: 7.0, // Default CCW sin tocar
  arancelPct: 6.0,
  margenPct: 5.0,     // Default CCW sin tocar
  parameterMode: 'custom_lines',
  lineCustomParams: {
    '1.0': { internacionPct: 23.0, margenPct: 6.0, arancelPct: 6.0 },
  },
};

const rates1 = resolveEffectiveQuoteRates(customParams);
console.log(`Tasas efectivas resueltas (1.0 = 23% int, 6% margen):`, rates1);
assert.strictEqual(rates1.internacionPct, 23.0, 'Debe resolver internación al 23%');
assert.strictEqual(rates1.marginPct, 6.0, 'Debe resolver margen al 6%');

const fileNameCustom1 = generateQuotationFileName({
  partner: 'PartnerDemo',
  customerName: 'ClienteDemo',
  technologyOrFamily: 'Catalyst',
  estimateId: 'OE169999999',
  internacionPct: customParams.internacionPct, // Pasa 7.0
  marginPct: customParams.margenPct,           // Pasa 5.0
  isRecalculated: true,
  params: customParams,
});

console.log(`Nombre generado con params custom: ${fileNameCustom1}`);
assert.ok(fileNameCustom1.includes('_I23M6_'), `El nombre debe contener _I23M6_, obtenido: ${fileNameCustom1}`);
assert.ok(!fileNameCustom1.includes('_I7M5_'), `No debe contener los defaults _I7M5_`);
console.log('✅ generateQuotationFileName detecta y plasma _I23M6_ correctamente.');

// ----------------------------------------------------------------------------
// Test 2: Modo Standard sin custom lines (debe preservar _I7M5_)
// ----------------------------------------------------------------------------
console.log('\n--- 2. Prueba de Nomenclatura en Modo Standard (Preservación _I7M5_) ---');

const standardParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'standard',
  lineCustomParams: {},
};

const ratesStandard = resolveEffectiveQuoteRates(standardParams);
assert.strictEqual(ratesStandard.internacionPct, 7.0);
assert.strictEqual(ratesStandard.marginPct, 5.0);

const fileNameStandard = generateQuotationFileName({
  partner: 'PartnerDemo',
  customerName: 'ClienteDemo',
  technologyOrFamily: 'Catalyst',
  estimateId: 'OE169999999',
  internacionPct: standardParams.internacionPct,
  marginPct: standardParams.margenPct,
  isRecalculated: false,
  params: standardParams,
});

console.log(`Nombre generado en modo standard: ${fileNameStandard}`);
assert.ok(fileNameStandard.includes('_I7M5_'), 'Debe contener _I7M5_');
console.log('✅ Modo standard preserva _I7M5_ de manera impecable.');

// ----------------------------------------------------------------------------
// Test 3: RecalculateEstimateResult con Ítems calculados
// ----------------------------------------------------------------------------
console.log('\n--- 3. Prueba de recalculateEstimateResult con Líneas Custom ---');

const mockItems: EstimateItem[] = [
  {
    rowIdx: 14,
    lineNumber: '1.0',
    partNumber: 'C9300-48P-A',
    description: 'Catalyst 9300 48-port PoE+',
    qty: 2,
    unitListPrice: 10000,
    netCiscoUnit: 5000,
    discPct: 50,
    realUnitCost: 5000,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 5000,
    precioVentaUnitario: 5000,
    precioVentaExtendido: 10000,
  },
];

const mockResult: ProcessedEstimateResult = {
  fileName: 'Partner_Cliente_Cisco_Estimate_OE12345_I7M5_v1_12-00_23-10-26.xlsx',
  headerInfo: {
    customerName: 'ClienteFinal',
    companyName: 'CanalPartner',
    address: '',
    city: '',
    country: '',
    phone: '',
    estimateId: 'OE12345',
    dealId: 'DEAL-111',
    priceList: 'GLOBAL',
    date: '2026-10-23',
  },
  items: mockItems,
  originalProductTotal: 10000,
  calculatedProductTotal: 10000,
  serviceTotal: 0,
  subscriptionTotal: 0,
};

const recalculated = recalculateEstimateResult(mockResult, customParams);
console.log(`Nombre generado tras recálculo: ${recalculated.fileName}`);
assert.ok(recalculated.fileName.includes('_I23M6_'), `Debe tener tag _I23M6_ tras recálculo, obtenido: ${recalculated.fileName}`);
assert.ok(recalculated.items[0].effectiveInternacionPct === 23, 'El ítem debe tener effectiveInternacionPct = 23');
assert.ok(recalculated.items[0].effectiveMargenPct === 6, 'El ítem debe tener effectiveMargenPct = 6');
console.log('✅ recalculateEstimateResult actualiza fileName con las tasas custom exactas.');

// ----------------------------------------------------------------------------
// Test 4: Solo Licencias con Margen Custom (Tag stealth _M6_)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Prueba de Solo Licencias en Modo Custom Lines ---');

const licensingParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'custom_lines',
  lineCustomParams: {
    '1.0': { internacionPct: 23.0, margenPct: 8.0 },
  },
};

const mockLicensingItems: EstimateItem[] = [
  {
    rowIdx: 14,
    lineNumber: '1.0',
    partNumber: 'DNA-C-A-3Y',
    description: 'Cisco DNA Advantage 3 Year Term License',
    qty: 1,
    unitListPrice: 3000,
    netCiscoUnit: 1500,
    discPct: 50,
    realUnitCost: 1500,
    isIntangible: true,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 1500,
    precioVentaUnitario: 1630.43,
    precioVentaExtendido: 1630.43,
  },
];

const mockLicensingResult: ProcessedEstimateResult = {
  fileName: 'Partner_Cliente_Cisco_Estimate_OE55555_M5_v1_12-00_23-10-26.xlsx',
  headerInfo: {
    customerName: 'ClienteFinal',
    companyName: 'CanalPartner',
    address: '',
    city: '',
    country: '',
    phone: '',
    estimateId: 'OE55555',
    dealId: 'DEAL-222',
    priceList: 'GLOBAL',
    date: '2026-10-23',
  },
  items: mockLicensingItems,
  originalProductTotal: 1500,
  calculatedProductTotal: 1630.43,
  serviceTotal: 0,
  subscriptionTotal: 0,
};

const recalculatedLic = recalculateEstimateResult(mockLicensingResult, licensingParams);
console.log(`Nombre generado para licencias: ${recalculatedLic.fileName}`);
assert.ok(recalculatedLic.fileName.includes('_M8_'), `Debe contener _M8_ (omitiendo internación), obtenido: ${recalculatedLic.fileName}`);
assert.ok(!recalculatedLic.fileName.includes('I23'), 'No debe incluir la I de internación para licencias');
console.log('✅ Solo licencias en modo custom plasma _M8_ sin exponer internación.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE NOMENCLATURA CUSTOM PASARON AL 100% CON ÉXITO!');
