// ============================================================================
// TESTS: CISCO CCW-R QUOTE PARA SERVICIOS & LICENCIAS (v2.9)
// ============================================================================

import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import {
  parseCcwrWorkbook,
  formatCcwrDate,
} from '../src/modules/ccwrQuote/ccwrParser';
import { detectCiscoFileType } from '../src/core/fileTypeDetector';
import {
  calculateCcwrItemPricing,
  recalculateCcwrQuote,
  calculateCcwrGoalSeekMargin,
} from '../src/modules/ccwrQuote/ccwrPricingEngine';
import {
  generateCcwrQuoteExcel,
  generateCcwrEmailHtml,
  CCWR_EXPORT_COLUMNS,
} from '../src/modules/ccwrQuote/ccwrExcelExporter';
import {
  CcwrHeaderInfo,
  CcwrLineItem,
  CcwrQuoteParameters,
  DEFAULT_CCWR_PARAMS,
} from '../src/modules/ccwrQuote/ccwrTypes';

console.log('🧪 Iniciando Suite de Pruebas: Cotizador CCW-R de Servicios & Licencias...\n');

// ----------------------------------------------------------------------------
// Test 1: Parser de Fechas CCW-R (formatCcwrDate)
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Normalización de Fechas de Contrato y Seriales Excel');
assert.strictEqual(formatCcwrDate(46329), '03-nov-2026', 'Serial Excel 46329 debe ser 03-nov-2026');
assert.strictEqual(formatCcwrDate(46693), '02-nov-2027', 'Serial Excel 46693 debe ser 02-nov-2027');
assert.strictEqual(formatCcwrDate('03-nov-2026'), '03-nov-2026');
assert.strictEqual(formatCcwrDate(''), '');
assert.strictEqual(formatCcwrDate(null), '');
console.log('  ✅ Formato de fechas normalizado a especificación Intcomex (DD-mmm-YYYY).');

// ----------------------------------------------------------------------------
// Test 2: Ingesta y Extracción de Archivo Real CCW-R
// ----------------------------------------------------------------------------
console.log('\n▶ Test 2: Ingesta y Extracción de Estructura CCW-R (74 columnas)');

const sampleFilePath = path.join(process.cwd(), 'temp_ccwr_sample.xlsx');
let fileBuffer: Buffer | Uint8Array;

if (fs.existsSync(sampleFilePath)) {
  fileBuffer = fs.readFileSync(sampleFilePath);
} else {
  // Generar workbook sintético en memoria con estructura CCW-R idéntica (74 columnas)
  const rows: any[][] = [];
  rows.push(['Quote Number', '452055115']);
  rows.push(['Quote Name', 'itq_metro']);
  rows.push(['Buy Method', 'Distribution']);
  rows.push(['Quote Net Amount', 22489.9]);
  rows.push(['Reseller Net Amount', 22489.9]);
  rows.push(['Deal ID', '452055115']);
  
  // Rellenar hasta fila 29
  while (rows.length < 30) {
    rows.push([]);
  }

  // Fila 30: Encabezados de 74 columnas
  const headerCols = new Array(74).fill('');
  headerCols[0] = 'Product Number';
  headerCols[1] = 'Product Description';
  headerCols[2] = 'Last Date of Support';
  headerCols[3] = 'PAK/Serial Number';
  headerCols[4] = 'Instance Number';
  headerCols[5] = 'Major Minor';
  headerCols[9] = 'Service Level';
  headerCols[10] = 'Service Level Description';
  headerCols[11] = 'SKU';
  headerCols[12] = 'Service Type';
  headerCols[16] = 'Start Date';
  headerCols[17] = 'End Date';
  headerCols[18] = 'Quantity';
  headerCols[25] = 'Extended Net Price'; // Col Z
  headerCols[28] = 'End Customer ID';
  headerCols[29] = 'End Customer Name';
  headerCols[30] = 'End Customer Address Line 1';
  headerCols[33] = 'End Customer City';
  headerCols[35] = 'End Customer Country';
  rows.push(headerCols);

  // 66 ítems de AP C9115AXI-A
  for (let i = 1; i <= 66; i++) {
    const itemRow = new Array(74).fill('');
    itemRow[0] = 'C9115AXI-A';
    itemRow[1] = 'Cisco Catalyst 9115AX Series';
    itemRow[3] = `FOC2418${String(i).padStart(4, '0')}`;
    itemRow[4] = `100${i}`;
    itemRow[5] = 'MAJOR';
    itemRow[9] = 'SNT';
    itemRow[10] = 'SNTC-8X5XNBD';
    itemRow[11] = 'CON-SNT-C9115AXI';
    itemRow[12] = 'WARRANTY';
    itemRow[16] = 46329; // 03-nov-2026
    itemRow[17] = 46693; // 02-nov-2027
    itemRow[18] = 1;
    itemRow[25] = 122.81;
    itemRow[28] = '1008150224';
    itemRow[29] = 'EMPRESA DE TRANSPORTE DE PASAJEROS METRO SA';
    itemRow[30] = 'AV LIBERTADOR BERNARDO O HIGGINS 1426';
    itemRow[33] = 'SANTIAGO';
    itemRow[35] = 'CL';
    rows.push(itemRow);
  }

  // 28 ítems de Switch C9200L-24P-4G-E
  for (let i = 1; i <= 28; i++) {
    const itemRow = new Array(74).fill('');
    itemRow[0] = 'C9200L-24P-4G-E';
    itemRow[1] = 'Catalyst 9200L 24-port PoE+';
    itemRow[3] = `JAE2519${String(i).padStart(4, '0')}`;
    itemRow[4] = `200${i}`;
    itemRow[5] = 'MAJOR';
    itemRow[9] = 'SNT';
    itemRow[10] = 'SNTC-8X5XNBD';
    itemRow[11] = 'CON-SNT-C920L24G';
    itemRow[12] = 'WARRANTY';
    itemRow[16] = 46329; // 03-nov-2026
    itemRow[17] = 46693; // 02-nov-2027
    itemRow[18] = 1;
    itemRow[25] = 513.73;
    itemRow[28] = '1008150224';
    itemRow[29] = 'EMPRESA DE TRANSPORTE DE PASAJEROS METRO SA';
    itemRow[30] = 'AV LIBERTADOR BERNARDO O HIGGINS 1426';
    itemRow[33] = 'SANTIAGO';
    itemRow[35] = 'CL';
    rows.push(itemRow);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '452055115');
  fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const { headerInfo, items } = parseCcwrWorkbook(fileBuffer, 'CCWR_Quote_452055115.xlsx');

assert.strictEqual(headerInfo.quoteNumber, '452055115', 'Quote Number debe ser 452055115');
assert.strictEqual(headerInfo.quoteName, 'itq_metro', 'Quote Name debe ser itq_metro');
assert.strictEqual(headerInfo.quoteNetAmount, 22489.9, 'Quote Net Amount debe ser 22489.90');
assert.strictEqual(headerInfo.buyMethod, 'Distribution');
assert.ok(headerInfo.endCustomerName?.includes('METRO SA'), 'Cliente debe ser METRO SA');
assert.strictEqual(headerInfo.endCustomerId, '1008150224', 'ID Cliente debe ser 1008150224');

// Validar que se extrajeron las líneas de servicio con costo
const serviceItems = items.filter((it) => it.isServiceOrLicense && it.extendedNetPrice > 0);
assert.strictEqual(serviceItems.length, 94, `Se esperaban 94 ítems de servicio con costo, se obtuvieron ${serviceItems.length}`);

// Validar Catalyst 9115AX
const apItems = serviceItems.filter((it) => it.productNumber === 'C9115AXI-A');
assert.strictEqual(apItems.length, 66, 'Deben haber 66 APs C9115AXI-A');
assert.strictEqual(apItems[0].serviceSku, 'CON-SNT-C9115AXI');
assert.strictEqual(apItems[0].serviceLevel, 'SNT');
assert.strictEqual(apItems[0].extendedNetPrice, 122.81, 'Columna Z Extended Net Price debe ser 122.81');

// Validar Catalyst 9200L
const swItems = serviceItems.filter((it) => it.productNumber === 'C9200L-24P-4G-E');
assert.strictEqual(swItems.length, 28, 'Deben haber 28 switches C9200L-24P-4G-E');
assert.strictEqual(swItems[0].serviceSku, 'CON-SNT-C920L24G');
assert.strictEqual(swItems[0].extendedNetPrice, 513.73, 'Columna Z Extended Net Price debe ser 513.73');

console.log(`  ✅ Extracción completa: Quote #${headerInfo.quoteNumber} | ${serviceItems.length} seriales | Costo Neto Cisco: $${headerInfo.quoteNetAmount?.toLocaleString()} USD.`);

// ----------------------------------------------------------------------------
// Test 3: Motor de Precios y Margen sobre Columna Z
// ----------------------------------------------------------------------------
console.log('\n▶ Test 3: Motor de Precios sobre Columna Z (Extended Net Price)');

const testParams: CcwrQuoteParameters = {
  ...DEFAULT_CCWR_PARAMS,
  margenPct: 10.0, // 10% de margen
  arancelPct: 0.0,
  internacionPct: 0.0,
};

const apItem = apItems[0];
const pricedAp = calculateCcwrItemPricing(apItem, testParams);

// Costo = 122.81, Margen = 10% -> PV = 122.81 / (1 - 0.10) = 136.455 -> 136.46
assert.strictEqual(pricedAp.costoNetoUnitario, 122.81);
assert.strictEqual(pricedAp.costoTotalUnitario, 122.81);
assert.strictEqual(pricedAp.precioVentaUnitario, 136.46);
assert.strictEqual(pricedAp.precioVentaExtendido, 136.46);

// Validar cuando se aplica Arancel especial (ej: 6%)
const pricedApWithArancel = calculateCcwrItemPricing(
  { ...apItem, overrideRule: 'arancel' },
  { ...testParams, arancelPct: 6.0 }
);
// Costo arancel = 122.81 * 0.06 = 7.37 -> Costo total = 130.18 -> PV = 130.18 / 0.90 = 144.64
assert.strictEqual(pricedApWithArancel.costoArancel, 7.37);
assert.strictEqual(pricedApWithArancel.costoTotalUnitario, 130.18);
assert.strictEqual(pricedApWithArancel.precioVentaUnitario, 144.64);

console.log('  ✅ Fórmulas de margen comercial y aranceles validadas al centavo.');

// ----------------------------------------------------------------------------
// Test 4: Recálculo Global de Cotización y Agrupación por Modelo
// ----------------------------------------------------------------------------
console.log('\n▶ Test 4: Recálculo Global y Resumen Agrupado');

const { summary } = recalculateCcwrQuote(items, testParams, true);

assert.strictEqual(summary.totalItems, 94);
assert.strictEqual(summary.totalQuantity, 94);
assert.strictEqual(summary.uniqueSerialsCount, 94);
assert.strictEqual(summary.totalExtendedNetCost, 22489.9);
assert.ok(summary.totalPrecioVenta > 24000, `Total venta esperado > $24k, obtenido: $${summary.totalPrecioVenta}`);
assert.strictEqual(summary.byProduct.length, 2, 'Deben haber 2 grupos de producto (AP y Switch)');

console.log(`  ✅ Total Ítems: ${summary.totalItems} | Costo Neto: $${summary.totalExtendedNetCost.toLocaleString()} | Venta: $${summary.totalPrecioVenta.toLocaleString()} USD.`);

// ----------------------------------------------------------------------------
// Test 5: Buscador de Objetivo (Goal Seek)
// ----------------------------------------------------------------------------
console.log('\n▶ Test 5: Buscador de Objetivo (Goal Seek)');

const targetPrice = 25000.0;
const goalSeekRes = calculateCcwrGoalSeekMargin(items, targetPrice, testParams, true);

assert.ok(goalSeekRes.success, 'Goal Seek debe encontrar el margen adecuado');
assert.ok(Math.abs(goalSeekRes.achievedTotal - targetPrice) <= 0.5, 'Total alcanzado debe coincidir con $25,000 USD');
assert.ok(goalSeekRes.targetMarginPct > 10.0, 'El margen debe ser > 10%');

console.log(`  ✅ Goal Seek: Para alcanzar $${targetPrice.toLocaleString()} USD, el margen requerido es ${goalSeekRes.targetMarginPct}% (Logrado: $${goalSeekRes.achievedTotal.toLocaleString()} USD).`);

// ----------------------------------------------------------------------------
// Test 6: Verificación de Columnas y Generación de Excel Oficial Intcomex
// ----------------------------------------------------------------------------
console.log('\n▶ Test 6: Verificación de Formato Oficial de 13 Columnas Intcomex');

assert.strictEqual(CCWR_EXPORT_COLUMNS.length, 13, 'Deben haber exactamente 13 columnas de exportación');
assert.strictEqual(CCWR_EXPORT_COLUMNS[0].header, 'Product Number');
assert.strictEqual(CCWR_EXPORT_COLUMNS[2].header, 'PAK/Serial Number');
assert.strictEqual(CCWR_EXPORT_COLUMNS[3].header, 'Nivel Servicios');
assert.strictEqual(CCWR_EXPORT_COLUMNS[5].header, 'SKU');
assert.strictEqual(CCWR_EXPORT_COLUMNS[9].header, 'Unit');
assert.strictEqual(CCWR_EXPORT_COLUMNS[11].header, 'Nombre Cliente Final');

const excelBuffer = await generateCcwrQuoteExcel(items, headerInfo, testParams, summary, true);
assert.ok(excelBuffer.byteLength > 10000, 'El archivo Excel generado debe ser un buffer válido');

console.log(`  ✅ Planilla Excel generada exitosamente (${excelBuffer.byteLength} bytes) con las 13 columnas oficiales.`);

// ----------------------------------------------------------------------------
// Test 7: Generador de Correo Outlook (HTML)
// ----------------------------------------------------------------------------
console.log('\n▶ Test 7: Generador de Correo para Outlook');

const emailHtml = generateCcwrEmailHtml(headerInfo, summary, testParams);
assert.ok(emailHtml.includes('EMPRESA DE TRANSPORTE DE PASAJEROS METRO SA'), 'Debe incluir nombre del cliente');
assert.ok(emailHtml.includes('452055115'), 'Debe incluir número de cotización');
assert.ok(emailHtml.includes('CON-SNT-C9115AXI'), 'Debe incluir SKUs');
assert.ok(emailHtml.includes('#92D050'), 'Debe usar estilo corporativo verde');

console.log('  ✅ Tabla HTML para Outlook generada con diseño corporativo.');

// ----------------------------------------------------------------------------
// Test 8: Detección Automática de Formato y Margen Base del 5%
// ----------------------------------------------------------------------------
console.log('\n▶ Test 8: Detección Automática de Formato (CCW Estimate vs CCW-R Quote)');

assert.strictEqual(DEFAULT_CCWR_PARAMS.margenPct, 5.0, 'El margen base predeterminado de CCW-R debe ser 5.0%');
console.log('  ✅ Margen inicial de CCW-R verificado en 5.0%.');

// 8.1 Detectar CCW-R
const ccwrDetection = detectCiscoFileType(fileBuffer);
assert.strictEqual(ccwrDetection.fileType, 'ccwr_quote', 'Debe clasificar como ccwr_quote');
assert.strictEqual(ccwrDetection.quoteNumber, '452055115', 'Debe extraer el Quote Number 452055115');

// 8.2 Detectar CCW Price Estimate
const estRows = [
  [],
  ['Price Estimate'],
  [],
  ['Estimate ID: 987654321', '', 'Deal ID: 112233'],
  ['Customer: Banco Estado'],
  [],
  ['Line #', 'Part Number', 'Description', 'Qty', 'Unit List Price', 'Unit Net Price', 'Extended Net Price'],
  ['1.0', 'C9200L-24P-4G-E', 'Catalyst 9200L', 1, 1000, 500, 500],
];
const estWb = XLSX.utils.book_new();
const estWs = XLSX.utils.aoa_to_sheet(estRows);
XLSX.utils.book_append_sheet(estWb, estWs, 'Price Estimate');
const estBuffer = XLSX.write(estWb, { type: 'buffer', bookType: 'xlsx' });

const estDetection = detectCiscoFileType(estBuffer);
assert.strictEqual(estDetection.fileType, 'ccw_estimate', 'Debe clasificar como ccw_estimate');
console.log('  ✅ Clasificación bidireccional CCW Estimate vs CCW-R Quote validada.');

console.log('\n============================================================');
console.log('🎉 TODAS LAS PRUEBAS DE CCW-R SERVICIOS Y LICENCIAS PASARON AL 100%!');
console.log('============================================================\n');

process.exit(0);
