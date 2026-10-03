import assert from 'node:assert';
import { encodeBase64Utf8, decodeBase64Utf8 } from '../src/core/excelEngine';
import { isCiscoServiceSku, isCiscoLicenseSku, isCiscoIntangibleSku } from '../src/core/ciscoTaxonomy';
import { checkIsIntangible, solveGoalSeekParameters } from '../src/core/calculations';
import { detectSkuCategory } from '../src/modules/dsv/dsvEngine';

console.log('🧪 Iniciando verificación de Quick Wins y Mejoras del Core...');

// 1. Verificación UTF-8 Base64
console.log('\n--- 1. Prueba de Codificación Base64 UTF-8 (sys_metadata) ---');
const testPayload = {
  partner: 'Ajj Redes & Conectividad SpA — Ñandú 123 🇨🇱',
  nota: 'Cotización con tildes, caracteres especiales: áéíóú ñ ¿¡ y emojis 🚀',
  platano: 5.0,
  uva: 0.06,
};
const jsonStr = JSON.stringify(testPayload);
const encoded = encodeBase64Utf8(jsonStr);
const decoded = decodeBase64Utf8(encoded);
const roundTrip = JSON.parse(decoded);

assert.strictEqual(roundTrip.partner, testPayload.partner, 'El nombre con caracteres especiales debe coincidir exactamente');
assert.strictEqual(roundTrip.nota, testPayload.nota, 'La nota con caracteres UTF-8 debe coincidir');
console.log('✅ Serialización y deserialización UTF-8 Base64 sin error URIError completada con éxito.');

// 2. Verificación de Taxonomía Unificada
console.log('\n--- 2. Prueba de Taxonomía Unificada (ciscoTaxonomy & DSV & Calculations) ---');
// Cisco ONE
assert.strictEqual(isCiscoLicenseSku('C1E1TN9300XF-3Y'), true, 'C1E1TN9300XF-3Y debe ser detectado como licencia');
assert.strictEqual(isCiscoLicenseSku('C1-N9K-ADD-T'), true, 'C1-N9K-ADD-T debe ser detectado como licencia');
assert.strictEqual(detectSkuCategory('C1-N9K-ADD-T'), 'subscription', 'DSV debe detectar C1-N9K-ADD-T como subscription');
assert.strictEqual(checkIsIntangible('C1-N9K-ADD-T', ''), true, 'checkIsIntangible debe marcar C1-N9K-ADD-T como intangible');

// DCN & DNA
assert.strictEqual(isCiscoLicenseSku('DCN-SEC-XF'), true, 'DCN-SEC-XF debe ser detectado como licencia');
assert.strictEqual(detectSkuCategory('DCN-SEC-XF'), 'subscription', 'DSV debe clasificar DCN-SEC-XF como subscription');

// SmartNet & Services
assert.strictEqual(isCiscoServiceSku('CON-SNT-C9200L24'), true, 'CON-SNT debe ser servicio');
assert.strictEqual(isCiscoLicenseSku('CON-SNT-C9200L24'), false, 'CON-SNT no debe ser clasificado como software license');
assert.strictEqual(detectSkuCategory('CON-SNT-C9200L24'), 'service', 'DSV debe clasificar CON-SNT como service');

// Hardware
assert.strictEqual(isCiscoLicenseSku('C9200L-24P-4G-E'), false, 'Switch hardware no debe ser licencia');
assert.strictEqual(isCiscoServiceSku('C9200L-24P-4G-E'), false, 'Switch hardware no debe ser servicio');
assert.strictEqual(detectSkuCategory('C9200L-24P-4G-E'), 'hardware', 'DSV debe clasificar switch como hardware');

console.log('✅ Taxonomía unificada validada en ciscoTaxonomy, dsvEngine y calculations.');

// 3. Verificación de Goal Seek a 0% de Internación
console.log('\n--- 3. Prueba de Goal Seek con Internación 0% ---');
const dummyItems: any[] = [
  {
    isInfoRow: false,
    costoTotalUnitario: 1000,
    qty: 1,
    unitListPrice: 2000,
    unitNetPriceCcw: 1000,
    realUnitCost: 1000,
    netCiscoUnit: 1000,
    originalNetCiscoUnit: 1000,
    isIntangible: false,
    llevaArancel: false,
    partNumber: 'C9200L-24P-4G-E',
    description: 'Switch Catalyst 9200L',
  },
];

const goalSeekResult = solveGoalSeekParameters(
  dummyItems,
  1050, // El cliente pide descuento a $1050 (el total actual es ~$1115.79)
  'target_price',
  {
    internacionPct: 0, // El usuario configuró 0% de internación explícitamente
    arancelPct: 6.0,
    margenPct: 5.0,
  }
);

assert.strictEqual(goalSeekResult.newInternacionPct, 0, 'La internación debe permanecer estrictamente en 0% si el usuario la configuró en 0');
assert(goalSeekResult.newMargenPct < 5.0, 'El margen debe reducirse para alcanzar el descuento sin inyectar internación');
console.log(`✅ Goal Seek con Internación 0%: Internación = ${goalSeekResult.newInternacionPct}%, Margen ajustado = ${goalSeekResult.newMargenPct}%, Total logrado = $${goalSeekResult.achievedTotal}`);

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE QUICK WINS COMPLETADAS AL 100%!');
