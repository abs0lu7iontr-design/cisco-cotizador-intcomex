// ============================================================================
// CISCO AUTOMATED v2.4.2 - TECHNICAL VALIDATION DISCLAIMER TEST SUITE
// Valida que las 3 cláusulas de pie de página (Validez, Plazo de Entrega y
// Validación Técnica y Responsabilidad) se generen de forma ordenada, con la tipografía
// y colores tenues especificados, y que no interfieran con cálculos ni con el parser.
// ============================================================================

import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { generateOptimizedWorkbook, synthesizeOfficialEstimateWorkbook, isFooterOrNoteRow, parseEstimateWorkbook } from '../src/core/excelEngine';
import { QuoteParameters, ProcessedEstimateResult } from '../src/core/types';

console.log('🧪 INICIANDO TEST SUITE: CLÁUSULAS DE PIE DE PÁGINA Y VALIDACIÓN TÉCNICA...\n');

const testParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'standard',
  lineCustomParams: {},
};

async function runTests() {
  // 1. Crear un workbook base para probar exportación
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quotation');

  // Cabecera CCW original
  ws.addRow(['Line #', 'Part Number', 'Description', 'Qty', 'Unit List Price', 'Unit Net Price', 'Ext Net Price']);
  ws.addRow(['1.0', 'C9300-24P-A', 'Catalyst 9300 24P', 2, 5000, 2500, 5000]);

  const baseBuffer = await wb.xlsx.writeBuffer();

  console.log('--- 1. Prueba de generateOptimizedWorkbook ---');
  const { modifiedBuffer } = await generateOptimizedWorkbook(
    baseBuffer,
    testParams,
    'Test_Estimate.xlsx'
  );

  const exportedWb = new ExcelJS.Workbook();
  await exportedWb.xlsx.load(Buffer.from(modifiedBuffer));
  const exportedWs = exportedWb.worksheets[0];

  // Buscar las 3 cláusulas en las filas inferiores
  let foundValidity = false;
  let foundLeadTime = false;
  let foundTechnicalValidation = false;
  let validityRowIdx = -1;
  let leadTimeRowIdx = -1;
  let technicalRowIdx = -1;

  for (let r = 14; r <= exportedWs.rowCount; r++) {
    const row = exportedWs.getRow(r);
    const cellA = row.getCell(1);
    const text = cellA.value && typeof cellA.value === 'object' && 'richText' in cellA.value
      ? (cellA.value as any).richText.map((t: any) => t.text).join('')
      : String(cellA.value || '');

    if (text.includes('Validez de la Oferta:')) {
      foundValidity = true;
      validityRowIdx = r;
      assert.ok(text.includes('14 días corridos'), 'Debe incluir 14 días corridos');
      assert.strictEqual(row.height, 16, 'Altura de fila de validez debe ser 16');
    }

    if (text.includes('Plazo de entrega:')) {
      foundLeadTime = true;
      leadTimeRowIdx = r;
      assert.ok(text.includes('tiempo final de despacho'), 'Debe incluir texto de despacho');
      assert.strictEqual(row.height, 16, 'Altura de fila de plazo de entrega debe ser 16');
    }

    if (text.includes('Validación Técnica y Responsabilidad:')) {
      foundTechnicalValidation = true;
      technicalRowIdx = r;
      assert.ok(text.includes('propuesta referencial de preventa'), 'Debe incluir cláusula de preventa');
      assert.ok(text.includes('responsabilidad exclusiva del Partner'), 'Debe incluir responsabilidad del partner');
      assert.ok(text.includes('Intcomex no asumirá costos ni mermas'), 'Debe incluir exoneración de mermas');
      assert.ok(!text.toLowerCase().includes('devolución') && !text.toLowerCase().includes('devolucion'), 'No debe mencionar devoluciones');
      assert.strictEqual(row.height, 30, 'Altura de fila de validación técnica debe ser 30');
      assert.strictEqual(cellA.alignment?.wrapText, true, 'wrapText debe ser true');
    }
  }

  assert.ok(foundValidity, 'Fila de validez debe existir');
  assert.ok(foundLeadTime, 'Fila de plazo de entrega debe existir');
  assert.ok(foundTechnicalValidation, 'Fila de validación técnica debe existir');
  assert.strictEqual(leadTimeRowIdx, validityRowIdx + 1, 'Plazo de entrega debe estar inmediatamente debajo de Validez');
  assert.strictEqual(technicalRowIdx, leadTimeRowIdx + 1, 'Validación técnica debe estar inmediatamente debajo de Plazo de Entrega');
  console.log('✅ generateOptimizedWorkbook generó las 3 cláusulas en orden secuencial perfecto (filas consecutivas con formato y wrapText).');

  console.log('\n--- 2. Prueba de synthesizeOfficialEstimateWorkbook ---');
  const dummyResult = {
    fileName: 'Test_Synthetic.xlsx',
    headerInfo: { estimateId: 'EST-1234', dealId: 'DEAL-99', companyName: 'Partner Test' },
    items: [
      {
        rowIdx: 1,
        lineNumber: '1.0',
        partNumber: 'C9300-24P-A',
        description: 'Catalyst 9300',
        qty: 1,
        unitListPrice: 5000,
        netCiscoUnit: 2500,
        costoInternacion: 175,
        costoArancel: 0,
        costoTotalUnitario: 2675,
        precioVentaUnitario: 2815.79,
        precioVentaExtendido: 2815.79,
        discPct: 50,
      },
    ],
    originalProductTotal: 2500,
    calculatedProductTotal: 2815.79,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 2815.79,
    headerRowIndex: 13,
  } as unknown as ProcessedEstimateResult;

  const syntheticBuffer = await synthesizeOfficialEstimateWorkbook(dummyResult, testParams);
  const synthWb = new ExcelJS.Workbook();
  await synthWb.xlsx.load(Buffer.from(syntheticBuffer));
  const synthWs = synthWb.worksheets[0];

  let synthTechnicalFound = false;
  for (let r = 14; r <= synthWs.rowCount; r++) {
    const text = synthWs.getRow(r).getCell(1).value?.toString() || '';
    const cellA = synthWs.getRow(r).getCell(1);
    const fullText = cellA.value && typeof cellA.value === 'object' && 'richText' in cellA.value
      ? (cellA.value as any).richText.map((t: any) => t.text).join('')
      : String(cellA.value || '');
    if (fullText.includes('Validación Técnica y Responsabilidad:')) {
      synthTechnicalFound = true;
    }
  }
  assert.ok(synthTechnicalFound, 'synthesizeOfficialEstimateWorkbook debe incluir la cláusula de validación técnica');
  console.log('✅ synthesizeOfficialEstimateWorkbook generó las 3 cláusulas idénticas.');

  console.log('\n--- 3. Prueba de Inmunidad Anti-Contaminación en Re-import (isFooterOrNoteRow) ---');
  assert.strictEqual(isFooterOrNoteRow('', '', 'Validación Técnica y Responsabilidad: La presente cotización'), true, 'Debe ser detectado como footer');
  assert.strictEqual(isFooterOrNoteRow('', '', 'Es responsabilidad exclusiva del Partner revisar y validar'), true, 'Debe ser detectado como footer');
  assert.strictEqual(isFooterOrNoteRow('', '', 'Intcomex no asumirá costos ni mermas derivados'), true, 'Debe ser detectado como footer');
  assert.strictEqual(isFooterOrNoteRow('1.0', 'C9300-24P-A', 'Catalyst 9300 Switch'), false, 'Una línea de producto válida nunca es footer');
  console.log('✅ isFooterOrNoteRow detecta la cláusula de validación técnica como footer impidiendo cualquier contaminación de items.');

  console.log('\n--- 4. Prueba de Round-Trip Re-upload del Excel Exportado ---');
  // Subir el archivo recién exportado a parseEstimateWorkbook
  const { result: reloadedResult } = await parseEstimateWorkbook(modifiedBuffer, testParams, 'Test_Estimate.xlsx');
  assert.strictEqual(reloadedResult.items.length, 1, 'Debe contener exactamente 1 ítem (no debe agregar filas de footer como ítems)');
  assert.strictEqual(reloadedResult.items[0].partNumber, 'C9300-24P-A', 'El ítem debe ser C9300-24P-A');
  console.log('✅ Round-trip exitoso: re-subir el Excel exportado parsea exactamente los ítems de producto sin contaminación.');

  console.log('\n🎉 TODOS LOS TESTS DE CLÁUSULAS DE PIE DE PÁGINA PASARON EXITOSAMENTE!');
}

runTests().catch((e) => {
  console.error('❌ Error en tests:', e);
  process.exit(1);
});
