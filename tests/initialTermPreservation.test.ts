import { parseEstimateWorkbook, generateOptimizedWorkbook } from '../src/core/excelEngine';
import { QuoteParameters } from '../src/core/types';
import ExcelJS from 'exceljs';

async function testInitialTermPreservation() {
  console.log('🧪 Iniciando prueba de preservación de filas Initial Term (Líneas de meses)...');

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Estimate');

  // Metadatos clásicos de CCW
  ws.getCell('A1').value = 'Prepared For: Test Customer';
  ws.getCell('L13').value = 'EST-12345';
  ws.getCell('L14').value = 'DEAL-67890';

  // Fila 18: Cabecera
  const headers = [
    'Line Number',
    'Part Number',
    'Smart Account',
    'Description',
    'Duration',
    'Lead Time',
    'List Price',
    'Term',
    'Qty',
    'Unit Net Price',
    'Disc %',
    'Ext Net Price'
  ];
  headers.forEach((h, idx) => {
    ws.getCell(18, idx + 1).value = h;
  });

  // Fila 19: Hardware Switch 1.0
  ws.getCell(19, 1).value = '1.0';
  ws.getCell(19, 2).value = 'C8200-1N-4T';
  ws.getCell(19, 3).value = 'No';
  ws.getCell(19, 4).value = 'Cisco Catalyst 8200 Series Edge uCPE';
  ws.getCell(19, 7).value = 2500;
  ws.getCell(19, 9).value = 1;
  ws.getCell(19, 10).value = 1250;
  ws.getCell(19, 11).value = 50;
  ws.getCell(19, 12).value = 1250;

  // Fila 20: Fila informativa de Initial Term (SIN número de línea, típica de CCW)
  ws.getCell(20, 1).value = '';
  ws.getCell(20, 2).value = 'Initial Term - 60.00 Months | Auto Renewal Term - 0 Months | Billing Model - Prepaid Term';
  ws.getCell(20, 4).value = 'Initial Term - 60.00 Months | Auto Renewal Term - 0 Months | Billing Model - Prepaid Term';

  // Fila 21: Licencia DNA 60 Meses
  ws.getCell(21, 1).value = '1.1';
  ws.getCell(21, 2).value = 'C8200-DNA-E-5Y';
  ws.getCell(21, 3).value = 'Yes';
  ws.getCell(21, 4).value = 'Cisco DNA Essentials 5 Year Term License';
  ws.getCell(21, 5).value = '60';
  ws.getCell(21, 7).value = 1800;
  ws.getCell(21, 9).value = 1;
  ws.getCell(21, 10).value = 900;
  ws.getCell(21, 11).value = 50;
  ws.getCell(21, 12).value = 900;

  // Fila 22: Servicio SmartNet 60 Meses (CON-SNT)
  ws.getCell(22, 1).value = '1.0.1';
  ws.getCell(22, 2).value = 'CON-SNT-C82001N4';
  ws.getCell(22, 3).value = 'No';
  ws.getCell(22, 4).value = 'SNTC-8X5XNBD Cisco Catalyst 8200 1RU with 1';
  ws.getCell(22, 5).value = '60';
  ws.getCell(22, 7).value = 600;
  ws.getCell(22, 9).value = 1;
  ws.getCell(22, 10).value = 300;
  ws.getCell(22, 11).value = 50;
  ws.getCell(22, 12).value = 300;

  const buffer = await workbook.xlsx.writeBuffer();
  const params: QuoteParameters = {
    internacionPct: 7,
    arancelPct: 6,
    margenPct: 5,
    parameterMode: 'standard',
  };

  // --- FASE 1: Parseo en memoria ---
  const { result } = await parseEstimateWorkbook(buffer as ArrayBuffer, params, 'test.xlsx');

  console.log(`Filas totales analizadas: ${result.items.length}`);
  
  // 1. Verificar la fila informativa de Initial Term
  const infoItem = result.items.find(it => it.isInfoRow);
  if (!infoItem) {
    throw new Error('FALLO: No se encontró la fila informativa de Initial Term!');
  }
  console.log('✅ Fila informativa detectada:', infoItem.description);
  if (infoItem.lineNumber !== '') {
    throw new Error(`FALLO: La fila informativa no debe tener lineNumber, pero tiene: "${infoItem.lineNumber}"`);
  }
  console.log('✅ La fila informativa tiene lineNumber vacío ("") exactamente como se esperaba.');

  // 2. Verificar que la licencia 1.1 preservó su número y detectó 60 meses
  const dnaItem = result.items.find(it => it.partNumber === 'C8200-DNA-E-5Y');
  if (!dnaItem) {
    throw new Error('FALLO: No se encontró la licencia C8200-DNA-E-5Y!');
  }
  if (dnaItem.lineNumber !== '1.1') {
    throw new Error(`FALLO: El número de línea de la licencia debería ser "1.1", pero es: "${dnaItem.lineNumber}"`);
  }
  console.log('✅ Licencia 1.1 preservó lineNumber "1.1".');

  // 3. Verificar que la descripción de la licencia rescató (5Y)
  if (!dnaItem.description.includes('(5Y)')) {
    throw new Error(`FALLO: La descripción debería incluir "(5Y)", pero es: "${dnaItem.description}"`);
  }
  console.log('✅ Descripción de licencia formateada correctamente:', dnaItem.description);

  // 4. Verificar que el servicio SmartNet preservó 1.0.1
  const sntItem = result.items.find(it => it.partNumber === 'CON-SNT-C82001N4');
  if (!sntItem) {
    throw new Error('FALLO: No se encontró el servicio CON-SNT-C82001N4!');
  }
  if (sntItem.lineNumber !== '1.0.1') {
    throw new Error(`FALLO: El número de línea del servicio debería ser "1.0.1", pero es: "${sntItem.lineNumber}"`);
  }
  console.log('✅ Servicio 1.0.1 preservó lineNumber "1.0.1".');

  // --- FASE 2: Generación y exportación de Excel Modificado ---
  const { modifiedBuffer } = await generateOptimizedWorkbook(
    buffer as ArrayBuffer,
    params,
    'test.xlsx',
    undefined,
    undefined,
    result,
    { groupByLine: true }
  );

  const exportedWb = new ExcelJS.Workbook();
  await exportedWb.xlsx.load(Buffer.from(modifiedBuffer));
  const expWs = exportedWb.worksheets[0];

  let foundExportedInfoRow = false;
  let infoRowNumber = -1;
  for (let r = 13; r <= expWs.rowCount; r++) {
    const col2 = String(expWs.getCell(r, 2).value || '');
    if (col2.includes('Initial Term')) {
      foundExportedInfoRow = true;
      infoRowNumber = r;

      const col1 = expWs.getCell(r, 1).value;
      if (col1 !== '' && col1 !== null && col1 !== undefined) {
        throw new Error(`FALLO: Columna 1 de la fila de Initial Term en Excel exportado debería ser vacía, pero tiene: "${col1}"`);
      }

      const cell2 = expWs.getCell(r, 2);
      const cell5 = expWs.getCell(r, 5);
      const cell7 = expWs.getCell(r, 7);

      // Comprobar que las celdas C a G están fusionadas con la celda B
      if (!cell5.isMerged || cell5.master?.address !== cell2.address) {
        throw new Error(`FALLO: Columna 5 debería estar fusionada con B${r}, pero no lo está.`);
      }
      if (!cell7.isMerged || cell7.master?.address !== cell2.address) {
        throw new Error(`FALLO: Columna 7 debería estar fusionada con B${r}, pero no lo está.`);
      }

      console.log(`✅ Fila ${infoRowNumber}: Columna A está vacía; Columnas B a G están correctamente fusionadas.`);
      break;
    }
  }

  if (!foundExportedInfoRow) {
    throw new Error('FALLO: No se encontró la fila informativa de Initial Term en el Excel exportado!');
  }

  // --- FASE 3: Verificar Subtotales y Total General ---
  // Switch: $1,250 net + internación 7% ($87.5) + arancel 0 = $1337.5 / 0.95 = $1,407.89
  // DNA: $900 net + internación 0 + arancel 0 = $900 / 0.95 = $947.37
  // SNTC: $300 net + internación 0 + arancel 0 = $300 / 0.95 = $315.79
  // Subtotal esperado: $1,407.89 + $947.37 + $315.79 = $2,671.05
  // Cantidad total esperada: 1 + 1 + 1 = 3 (la fila de Initial Term NO suma cantidad)
  let subtotalFound = false;
  for (let r = 14; r <= expWs.rowCount; r++) {
    const text2 = String(expWs.getCell(r, 2).value || '');
    if (text2.includes('Subtotal Línea 1.0:')) {
      subtotalFound = true;
      const qtySubVal = expWs.getCell(r, 5).value;
      const qtyResult = typeof qtySubVal === 'object' && qtySubVal !== null ? (qtySubVal as any).result : qtySubVal;
      if (qtyResult !== 3) {
        throw new Error(`FALLO: Subtotal Qty debería ser 3 (excluyendo Initial Term), pero es: ${qtyResult}`);
      }
      console.log(`✅ Subtotal Qty correcto: ${qtyResult} unidades (la fila de Initial Term no sumó unidades).`);
      break;
    }
  }
  if (!subtotalFound) {
    throw new Error('FALLO: No se encontró la fila de Subtotal Línea 1.0!');
  }

  console.log('\n🎉 ¡TODAS LAS ASIGNACIONES, PRESERVACIONES Y EXPORTACIONES DE INITIAL TERM FUNCIONAN AL 100%!');
}

testInitialTermPreservation().catch((err) => {
  console.error('❌ Error en prueba:', err);
  process.exit(1);
});
