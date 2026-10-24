// ============================================================================
// CISCO AUTOMATED v2.4.5 - BO SEPARACIÓN POR LÍNEA, SUB TOTALES, ENCABEZADOS Y OC TEST SUITE
// Valida la agrupación por número de línea madre (ej. 1.0, 2.0),
// cálculo de subtotales por línea, saludo "Estimados,", encabezado repetido en líneas 2.0+,
// tipificación de hardware/licencias e inyección de N° OC de Partner por línea.
// ============================================================================

import assert from 'node:assert';
import { prepareBoLinesFromCalculated, partitionBoLinesByCost } from '../src/modules/bo/boTypes';
import { generateBoHtmlTable, generateBoPlainTextTable, formatCLP } from '../src/modules/bo/boEmailHelper';
import { EstimateLineItem } from '../src/core/types';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DE AGRUPACIÓN, ENCABEZADOS Y OC PARTNER BO (v2.4.5)...\n');

// 1. Simulación de ítems de cotización con 2 líneas madre (1.0 y 2.0)
const mockEstimateItems: EstimateLineItem[] = [
  {
    rowIdx: 14,
    lineNumber: '1.0',
    partNumber: 'C9300-48P-A',
    smartAccountMandatory: 'No',
    description: 'Catalyst 9300 48-port PoE+',
    serviceDurationMonths: '',
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 días',
    unitListPrice: 10000,
    pricingTerm: '1',
    qty: 2,
    netCiscoUnit: 5000,
    discPct: 50,
    realUnitCost: 5000,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 5000,
    precioVentaUnitario: 5500,
    precioVentaExtendido: 11000,
  },
  {
    rowIdx: 15,
    lineNumber: '1.1',
    partNumber: 'PWR-C1-715WAC-P',
    smartAccountMandatory: 'No',
    description: '715W AC 80+ Platinum Power Supply',
    serviceDurationMonths: '',
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 días',
    unitListPrice: 1200,
    pricingTerm: '1',
    qty: 2,
    netCiscoUnit: 600,
    discPct: 50,
    realUnitCost: 600,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 600,
    precioVentaUnitario: 660,
    precioVentaExtendido: 1320,
  },
  {
    rowIdx: 16,
    lineNumber: '2.0',
    partNumber: 'C9200L-24P-4G-E',
    smartAccountMandatory: 'No',
    description: 'Catalyst 9200L 24-port PoE+',
    serviceDurationMonths: '',
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 días',
    unitListPrice: 2500,
    pricingTerm: '1',
    qty: 1,
    netCiscoUnit: 1250,
    discPct: 50,
    realUnitCost: 1250,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 1250,
    precioVentaUnitario: 1400,
    precioVentaExtendido: 1400,
  },
  {
    rowIdx: 17,
    lineNumber: '2.1',
    partNumber: 'CAB-TA-NA',
    smartAccountMandatory: 'No',
    description: 'North America AC Type A Power Cable',
    serviceDurationMonths: '',
    originalLeadTimeDays: 0,
    transformedLeadTime: '0 días',
    unitListPrice: 0,
    pricingTerm: '1',
    qty: 1,
    netCiscoUnit: 0,
    discPct: 0,
    realUnitCost: 0,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 0,
    precioVentaUnitario: 0,
    precioVentaExtendido: 0,
  },
];

// --- Test 1: prepareBoLinesFromCalculated asigna motherLine y maneja descartados de $0 ---
console.log('--- 1. Prueba de Mapeo de Líneas y Detección de Mother Line ---');
const rawConverted = mockEstimateItems.map((item) => ({
  partNumber: item.partNumber,
  qty: item.qty,
  unitSalePrice: item.precioVentaUnitario,
  extendedSalePrice: item.precioVentaExtendido,
  isIntangible: item.isIntangible,
  lineNumber: item.lineNumber,
}));

const { lines } = prepareBoLinesFromCalculated(rawConverted);
const { activeLines, zeroCostLines } = partitionBoLinesByCost(lines);

console.log(`Líneas activas (precio > 0): ${activeLines.length}`);
console.log(`Líneas descartadas (precio = 0): ${zeroCostLines.length}`);

assert.strictEqual(activeLines.length, 3, 'Debe haber 3 líneas activas');
assert.strictEqual(zeroCostLines.length, 1, 'CAB-TA-NA ($0) debe estar en descartadas');

// Verificar asignación de motherLine
const line1_0 = activeLines.find((l) => l.partNumber === 'C9300-48P-A-CBN');
const line1_1 = activeLines.find((l) => l.partNumber === 'PWR-C1-715WAC-P-CBN');
const line2_0 = activeLines.find((l) => l.partNumber === 'C9200L-24P-4G-E-CBN');

assert.ok(line1_0, 'Línea 1.0 debe existir');
assert.strictEqual(line1_0?.motherLine, '1.0', 'Motherline de 1.0 debe ser 1.0');
assert.strictEqual(line1_1?.motherLine, '1.0', 'Motherline de 1.1 debe ser 1.0');
assert.strictEqual(line2_0?.motherLine, '2.0', 'Motherline de 2.0 debe ser 2.0');
console.log('✅ Asignación de motherLine (1.0, 2.0) y sufijo -CBN validados con éxito.');

// --- Test 2: generateBoHtmlTable en modo Unificado (Tradicional) ---
console.log('\n--- 2. Prueba de Generación HTML en Modo Unificado y Saludo "Estimados," ---');
const htmlUnified = generateBoHtmlTable(activeLines, {
  groupByLine: false,
});

assert.ok(htmlUnified.includes('Estimados,'), 'El saludo debe ser en plural: "Estimados,"');
assert.ok(htmlUnified.includes('C9300-48P-A-CBN'), 'Debe incluir ítem C9300');
assert.ok(htmlUnified.includes('PWR-C1-715WAC-P-CBN'), 'Debe incluir ítem PWR');
assert.ok(htmlUnified.includes('C9200L-24P-4G-E-CBN'), 'Debe incluir ítem C9200L');
assert.ok(htmlUnified.includes('Total General'), 'Debe incluir Total General');
assert.ok(!htmlUnified.includes('Subtotal Línea 1.0'), 'Modo unificado no debe tener subtotales por línea');
console.log('✅ Modo unificado genera tabla estándar con saludo plural "Estimados," y Total General.');

// --- Test 3: generateBoHtmlTable en Modo Separar por Líneas (Agrupado con Subtotales, Encabezados y OC) ---
console.log('\n--- 3. Prueba de Generación HTML con Agrupación por Línea, Encabezados Repetidos y N° OC ---');
const partnerPos = {
  '1.0': 'OC-77881',
  '2.0': 'OC-77882',
};

const htmlGrouped = generateBoHtmlTable(activeLines, {
  groupByLine: true,
  partnerPosByLine: partnerPos,
});

// Verificaciones de agrupación y saludo
assert.ok(htmlGrouped.includes('Estimados,'), 'Debe incluir saludo plural "Estimados,"');
assert.ok(htmlGrouped.includes('Bloque Línea 1.0'), 'Debe incluir cabecera de grupo Bloque Línea 1.0');
assert.ok(htmlGrouped.includes('Bloque Línea 2.0'), 'Debe incluir cabecera de grupo Bloque Línea 2.0');

// Verificaciones de N° OC Partner inyectada
assert.ok(htmlGrouped.includes('OC Partner: OC-77881'), 'Debe inyectar N° OC-77881 en Línea 1.0');
assert.ok(htmlGrouped.includes('OC Partner: OC-77882'), 'Debe inyectar N° OC-77882 en Línea 2.0');

// Verificaciones de Encabezado repetido de columnas en cada bloque
const headerCount = (htmlGrouped.match(/Extended Net Price/g) || []).length;
assert.ok(headerCount >= 3, `Debe contener al menos 3 filas de encabezado (1 global + 2 por bloque), encontrado: ${headerCount}`);

// Verificaciones de subtotales y total
assert.ok(htmlGrouped.includes('Subtotal Línea 1.0'), 'Debe incluir fila de Subtotal Línea 1.0');
assert.ok(htmlGrouped.includes('Subtotal Línea 2.0'), 'Debe incluir fila de Subtotal Línea 2.0');
assert.ok(htmlGrouped.includes('Total General'), 'Debe incluir Total General al final');
assert.ok(htmlGrouped.includes(formatCLP(12320, 2)), 'Subtotal Línea 1.0 debe ser 12.320,00');
assert.ok(htmlGrouped.includes(formatCLP(1400, 2)), 'Subtotal Línea 2.0 debe ser 1.400,00');
assert.ok(htmlGrouped.includes(formatCLP(13720, 2)), 'Total General debe ser 13.720,00');
console.log('✅ Agrupación HTML genera cabeceras de bloque con OC Partner, encabezados repetidos y subtotales.');

// --- Test 4: Filtrado para una sola OC (selectedLine: '1.0') ---
console.log('\n--- 4. Prueba de Filtrado por Línea para OC Individual (selectedLine: "1.0") ---');
const htmlLine1Only = generateBoHtmlTable(activeLines, {
  groupByLine: true,
  selectedLine: '1.0',
  partnerPosByLine: partnerPos,
});

assert.ok(htmlLine1Only.includes('C9300-48P-A-CBN'), 'Debe incluir C9300 de Línea 1');
assert.ok(htmlLine1Only.includes('PWR-C1-715WAC-P-CBN'), 'Debe incluir PWR de Línea 1');
assert.ok(!htmlLine1Only.includes('C9200L-24P-4G-E-CBN'), 'NO debe incluir ítem de Línea 2.0');
assert.ok(htmlLine1Only.includes('Total Línea 1.0') || htmlLine1Only.includes(formatCLP(12320, 2)), 'Debe reflejar total de Línea 1.0');
console.log('✅ Filtrado por línea individual aísla perfectamente los ítems de la OC seleccionada.');

// --- Test 5: Plain Text Table con Subtotales, OC Partner y "Estimados," ---
console.log('\n--- 5. Prueba de Texto Plano con Subtotales y OC Partner ---');
const textGrouped = generateBoPlainTextTable(activeLines, {
  groupByLine: true,
  partnerPosByLine: partnerPos,
});
assert.ok(textGrouped.startsWith('Estimados,'), 'Texto plano debe iniciar con "Estimados,"');
assert.ok(textGrouped.includes('Bloque Línea 1.0'), 'Debe incluir separador de LÍNEA 1.0');
assert.ok(textGrouped.includes('OC-77881'), 'Debe incluir OC-77881 en bloque 1.0');
assert.ok(textGrouped.includes(`Subtotal Línea 1.0:\t\t\t4\t—\t$${formatCLP(12320, 2)} USD`), 'Debe incluir subtotal texto de Línea 1.0');
assert.ok(textGrouped.includes('Bloque Línea 2.0'), 'Debe incluir separador de LÍNEA 2.0');
assert.ok(textGrouped.includes('OC-77882'), 'Debe incluir OC-77882 en bloque 2.0');
assert.ok(textGrouped.includes(`Subtotal Línea 2.0:\t\t\t1\t—\t$${formatCLP(1400, 2)} USD`), 'Debe incluir subtotal texto de Línea 2.0');
assert.ok(textGrouped.includes(`Total General (Todas las Líneas):\t\t\t5\t—\t$${formatCLP(13720, 2)} USD`), 'Debe incluir total general texto de 13.720,00');
console.log('✅ Texto plano con subtotales, encabezados y OC Partner validado al 100%.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE AGRUPACIÓN, ENCABEZADOS Y OC PARTNER BO PASARON CON ÉXITO AL 100%!');
