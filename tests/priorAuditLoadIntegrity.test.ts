// ============================================================================
// CISCO AUTOMATED v2.4.1 - PRIOR AUDIT & CUSTOM PARAMS INITIAL LOAD TEST
// Valida la restauración inmediata y sin saltos de Internación, Arancel y Margen
// al cargar cotizaciones previamente procesadas o con parámetros por línea
// ============================================================================

import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { parseEstimateWorkbook, encodeBase64Utf8 } from '../src/core/excelEngine';
import { QuoteParameters } from '../src/core/types';

const DEFAULT_PARAMS: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'standard',
  lineCustomParams: {},
};

console.log('🧪 INICIANDO TEST SUITE: RESTAURACIÓN DE PARÁMETROS PREVIOS EN CARGA DE ESTIMATES...\n');

async function runTests() {
  // 1. Crear un workbook simulando un Estimate exportado previamente con 23% Int, 6% Ar, 6% Margen
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Quotation');

  // Cabecera compacta o estándar
  ws.addRow(['Line #', 'Part Number', 'Description', 'Qty', 'Unit List Price', 'Unit Net Price', 'Ext Net Price']);
  ws.addRow(['1.0', 'C9300-48P-A', 'Catalyst 9300 48-port PoE+', 1, 10000, 5000, 5000]);
  ws.addRow(['2.0', 'C9300-24P-A', 'Catalyst 9300 24-port PoE+', 2, 6000, 3000, 6000]);

  // Hoja sys_metadata con 23% Internación, 6% Arancel y 6% Margen
  const metaSheet = workbook.addWorksheet('sys_metadata');
  const payload = {
    platano: 6.0,  // Margen 6%
    uva: 23.0,     // Internación 23%
    naranja: 6.0,  // Arancel 6%
    kiwi: '2026-10-23T12:00:00Z',
    token: 'cisco-ca-v2',
    modo: 'custom_lines',
    lineasCustom: {
      '2.0': { internacionPct: 8.0, arancelPct: 6.0, margenPct: 10.0 },
    },
    huerto: [
      { line: '1.0', manzana: 10000, cereza: 50, pera: 5000, mango: 1, sandia: false, limon: 0, nuez: 'Stock Inmediato' },
      { line: '2.0', manzana: 6000, cereza: 50, pera: 3000, mango: 1, sandia: false, limon: 0, nuez: 'Stock Inmediato' },
    ],
  };

  metaSheet.getCell('A1').value = encodeBase64Utf8(JSON.stringify(payload));

  const buffer = await workbook.xlsx.writeBuffer();

  console.log('--- 1. Carga inicial del archivo con DEFAULT_PARAMS (sin forceParams) ---');
  // Simula la llamada en processFileBuffer
  const { result } = await parseEstimateWorkbook(buffer, DEFAULT_PARAMS, 'Test_Estimate.xlsx');

  // Validar detectedAudit
  assert.ok(result.detectedAudit, 'detectedAudit debe existir');
  assert.strictEqual(result.detectedAudit.isRecalculated, true, 'isRecalculated debe ser true');
  assert.strictEqual(result.detectedAudit.previousInternacionPct, 23.0, 'Internación previa debe ser 23%');
  assert.strictEqual(result.detectedAudit.previousArancelPct, 6.0, 'Arancel previo debe ser 6%');
  assert.strictEqual(result.detectedAudit.previousMarginPct, 6.0, 'Margen previo debe ser 6%');
  assert.strictEqual(result.detectedAudit.parameterMode, 'custom_lines', 'Modo debe ser custom_lines');
  assert.deepStrictEqual(result.detectedAudit.lineCustomParams?.['2.0'], { internacionPct: 8.0, arancelPct: 6.0, margenPct: 10.0 });
  console.log('✅ detectedAudit extrajo exactamente Internación 23%, Arancel 6%, Margen 6% y línea custom 2.0.');

  // Validar que la línea 1.0 usó los parámetros base del archivo (23% Int, 6% Margen, 6% Arancel)
  const item1 = result.items.find((i) => i.lineNumber === '1.0');
  assert.ok(item1, 'Línea 1.0 debe existir');
  // Costo Internación = 5000 * 0.23 = 1150
  assert.strictEqual(item1.costoInternacion, 1150, 'Línea 1.0 costo internación debe ser 1150 (23%)');
  // Costo Arancel = 0 (equipo hardware sin = no lleva arancel por defecto a menos que tenga =)
  // Margen = 6% -> PV = (5000 + 1150) / (1 - 0.06) = 6150 / 0.94 = 6542.55
  const expectedPv1 = Math.round((6150 / 0.94) * 100) / 100;
  assert.strictEqual(item1.precioVentaUnitario, expectedPv1, `PV Línea 1.0 debe ser ${expectedPv1}`);
  console.log(`✅ Línea 1.0 calculada inmediatamente con 23% Internación y 6% Margen: PV = $${item1.precioVentaUnitario}.`);

  // Validar que la línea 2.0 usó sus parámetros custom (8% Int, 10% Margen)
  const item2 = result.items.find((i) => i.lineNumber === '2.0');
  assert.ok(item2, 'Línea 2.0 debe existir');
  // Costo Internación = 3000 * 0.08 = 240
  assert.strictEqual(item2.costoInternacion, 240, 'Línea 2.0 costo internación debe ser 240 (8%)');
  // Margen = 10% -> PV = (3000 + 240) / (1 - 0.10) = 3240 / 0.90 = 3600
  assert.strictEqual(item2.precioVentaUnitario, 3600, 'PV Línea 2.0 debe ser 3600 (10% margen)');
  assert.strictEqual(item2.isCustomParamApplied, true, 'isCustomParamApplied debe ser true');
  console.log(`✅ Línea 2.0 calculada inmediatamente con parámetros custom (8% Int, 10% Margen): PV = $${item2.precioVentaUnitario}.`);

  console.log('\n--- 2. Re-cálculo forzado con parámetros explícitos (forceParams: true) ---');
  // Simula el usuario moviendo un slider a 15% margen o restaurando a original sin editar
  const forcedParams: QuoteParameters = {
    ...DEFAULT_PARAMS,
    internacionPct: 7.0,
    arancelPct: 6.0,
    margenPct: 15.0,
    parameterMode: 'standard',
  };
  const { result: forcedResult } = await parseEstimateWorkbook(
    buffer,
    forcedParams,
    'Test_Estimate.xlsx',
    undefined,
    undefined,
    { forceParams: true }
  );

  const forcedItem1 = forcedResult.items.find((i) => i.lineNumber === '1.0');
  assert.ok(forcedItem1);
  // Con 7% internacion: Costo Int = 5000 * 0.07 = 350. Costo Total = 5350.
  // Con 15% margen: PV = 5350 / 0.85 = 6294.12
  assert.strictEqual(forcedItem1.costoInternacion, 350, 'Con forceParams, costo internacion debe ser 350 (7%)');
  assert.strictEqual(forcedItem1.precioVentaUnitario, 6294.12, 'Con forceParams, PV debe ser 6294.12 (15% margen)');
  console.log(`✅ Con forceParams: true, el re-cálculo respeta estrictamente los parámetros forzados: PV = $${forcedItem1.precioVentaUnitario}.`);

  console.log('\n🎉 TODOS LOS TESTS DE INTEGRIDAD DE RESTAURACIÓN DE PARÁMETROS PASARON EXITOSAMENTE!');
}

runTests().catch((err) => {
  console.error('❌ Error en tests:', err);
  process.exit(1);
});
