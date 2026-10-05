// ============================================================================
// CISCO AUTOMATED v2.1 - SNT SERVICES & OFFICIAL HISTORY DOWNLOAD SYNTHESIS
// ============================================================================

import assert from 'assert';
import ExcelJS from 'exceljs';
import { parseEstimateWithHierarchy } from '../src/modules/estimate/estimateHierarchyParser';
import { checkIsIntangible, calculateLineItemCosts, roundFinancial } from '../src/core/calculations';
import { synthesizeOfficialEstimateWorkbook } from '../src/core/excelEngine';
import { INTCOMEX_LOGO_RAW_BASE64 } from '../src/lib/intcomexLogoBase64';
import { ProcessedEstimateResult, QuoteParameters } from '../src/core/types';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DE SERVICIOS SNT Y DESCARGA OFICIAL DESDE HISTORIAL...\n');

const defaultParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
};

async function runTests() {
  // ----------------------------------------------------------------------------
  // 1. SNT lines are identified as Intangibles with 0% Internación and 0% Arancel by default
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verificación de Clasificación SNT (Intangible por Defecto) ---');
  const sntSku = 'CON-SNT-C920048P';
  const isIntangible = checkIsIntangible(sntSku, 'SNTC-8X5XNBD Catalyst 9200L 48-port PoE+');
  assert.strictEqual(isIntangible, true, 'SNT debe ser intangible por defecto');

  const calc = calculateLineItemCosts(1000, 1, sntSku, 'SNTC-8X5XNBD', defaultParams);
  assert.strictEqual(calc.costoInternacion, 0, 'Internación SNT debe ser 0%');
  assert.strictEqual(calc.costoArancel, 0, 'Arancel SNT debe ser 0%');
  assert.strictEqual(calc.costoTotalUnitario, 1000, 'Costo unitario SNT debe ser exactamente el neto Cisco');
  assert.strictEqual(calc.precioVentaUnitario, 1052.63, 'Precio venta con 5% margen debe ser 1052.63');
  assert.strictEqual(calc.precioVentaExtendido, 1052.63, 'Precio extendido (Qty 1) debe ser 1052.63');
  console.log('✅ Clasificación y precio de venta base de SNT validado exitosamente.\n');

  // ----------------------------------------------------------------------------
  // 2. Manual override on SNT correctly adds internación or arancel when requested
  // ----------------------------------------------------------------------------
  console.log('--- 2. Verificación de Overrides Manuales sobre SNT ---');
  const calcEquipo = calculateLineItemCosts(1000, 1, sntSku, 'SNTC-8X5XNBD', defaultParams, 'equipo');
  assert.strictEqual(calcEquipo.isIntangible, false);
  assert.strictEqual(calcEquipo.costoInternacion, 70, '7% internación en override equipo');
  assert.strictEqual(calcEquipo.costoArancel, 0);
  assert.strictEqual(calcEquipo.costoTotalUnitario, 1070);
  assert.strictEqual(calcEquipo.precioVentaUnitario, roundFinancial(1070 / 0.95));

  const calcArancel = calculateLineItemCosts(1000, 1, sntSku, 'SNTC-8X5XNBD', defaultParams, 'arancel');
  assert.strictEqual(calcArancel.llevaArancel, true);
  assert.strictEqual(calcArancel.costoInternacion, 70, '7% internación');
  assert.strictEqual(calcArancel.costoArancel, 60, '6% arancel');
  assert.strictEqual(calcArancel.costoTotalUnitario, 1130);
  assert.strictEqual(calcArancel.precioVentaUnitario, roundFinancial(1130 / 0.95));
  console.log('✅ Overrides manuales en SNT (equipo y arancel) calculados correctamente.\n');

  // ----------------------------------------------------------------------------
  // 3. Multi-year SNT contract does NOT get contaminated as a periodic Meraki subscription
  // ----------------------------------------------------------------------------
  console.log('--- 3. Verificación de Contratos Multi-Año SNT (Blindaje Anti-Contaminación) ---');
  const rawRows = [
    ['Line', 'Part Number', '', 'Description', '', '', 'List Price', '', 'Qty', 'Unit Net Price', '', 'Extended Net Price'],
    ['1.0', 'C9200L-48P-4G-E', '', 'Catalyst 9200L 48-port PoE+', '', '', '4500.00', '', '1', '2250.00', '', '2250.00'],
    ['1.1', 'CON-SNT-C920048P', '', 'SNTC-8X5XNBD Catalyst 9200L 48P (36 Months)', '', '', '1500.00', '', '1', '500.00', '', '1500.00'],
  ];

  const lines = parseEstimateWithHierarchy(rawRows);
  assert.strictEqual(lines.length, 2);

  const sntLine = lines.find((l) => l.partNumber === 'CON-SNT-C920048P');
  assert(sntLine !== undefined, 'Línea SNT debe existir en resultado');
  assert.strictEqual(sntLine!.isPeriodicSubscription, false, 'SNT multi-año NO debe ser marcada como suscripción periódica');
  assert.strictEqual(sntLine!.realUnitCost, 1500, 'El costo unitario real debe ser $1500 (36 meses) y no $500');
  console.log('✅ SNT multi-año preserva costo unitario real prepago ($1500) sin contaminación mensual.\n');

  // ----------------------------------------------------------------------------
  // 4. synthesizeOfficialEstimateWorkbook builds an official 7-column Intcomex Excel with logo and formulas
  // ----------------------------------------------------------------------------
  console.log('--- 4. Verificación de Síntesis de Plantilla Oficial Intcomex desde Historial ---');
  const mockEstimate: ProcessedEstimateResult = {
    fileName: 'Cotizacion_Test_Intcomex.xlsx',
    headerInfo: {
      companyName: 'Canal Asociado SpA',
      customerName: 'Cliente Corporativo',
      address: 'Av. Providencia 1234',
      city: 'Santiago',
      country: 'Chile',
      phone: '+56 2 2222 3333',
      estimateId: 'ZF1690439',
      dealId: 'D12345678',
      priceList: 'GLOBAL PRICE LIST',
      date: '05-Oct-2026',
    },
    items: [
      {
        rowIdx: 14,
        lineNumber: '1.0',
        partNumber: 'MX95',
        description: 'Meraki MX95 Cloud Managed Security Appliance',
        transformedLeadTime: '4 a 5 semanas a pedido',
        qty: 2,
        unitListPrice: 8833.85,
        discPct: 42,
        netCiscoUnit: 5123.63,
        realUnitCost: 5123.63,
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 358.65,
        costoArancel: 0,
        costoTotalUnitario: 5482.28,
        precioVentaUnitario: 5770.82,
        precioVentaExtendido: 11541.64,
        months: 1,
        smartAccountMandatory: '-',
        serviceDurationMonths: '---',
        originalLeadTimeDays: 21,
        pricingTerm: '',
      },
      {
        rowIdx: 15,
        lineNumber: '1.0.1',
        partNumber: 'CON-L1NBD-MX95',
        description: 'ENH 8X5XNBD Meraki MX95 (36 Months)',
        transformedLeadTime: '',
        qty: 2,
        unitListPrice: 2213.64,
        discPct: 37,
        netCiscoUnit: 1394.59,
        realUnitCost: 1394.59,
        isIntangible: true,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 1394.59,
        precioVentaUnitario: 1467.99,
        precioVentaExtendido: 2935.98,
        months: 36,
        smartAccountMandatory: '-',
        serviceDurationMonths: '36 Months',
        originalLeadTimeDays: 0,
        pricingTerm: '',
      },
    ],
    originalProductTotal: 13036.44,
    calculatedProductTotal: 14477.62,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 14477.62,
    headerRowIndex: 13,
    workbookBuffer: new ArrayBuffer(0),
  };

  const buffer = await synthesizeOfficialEstimateWorkbook(mockEstimate, defaultParams);
  assert(buffer.byteLength > 1000, 'El buffer generado debe tener contenido válido');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buffer));

  const ws = wb.getWorksheet('Price Estimate');
  assert(ws !== undefined, 'Hoja Price Estimate debe existir');

  // Check 7 columns
  const headerRow = ws!.getRow(13);
  assert.strictEqual(headerRow.getCell(1).value, 'Line Number');
  assert.strictEqual(headerRow.getCell(2).value, 'Part Number');
  assert.strictEqual(headerRow.getCell(3).value, 'Description');
  assert.strictEqual(headerRow.getCell(4).value, 'Estimated Lead Time (Days)');
  assert.strictEqual(headerRow.getCell(5).value, 'Qty');
  assert.strictEqual(headerRow.getCell(6).value, 'Unit Net Price');
  assert.strictEqual(headerRow.getCell(7).value, 'Extended Net Price');

  // Check item values
  const row1 = ws!.getRow(14);
  assert.strictEqual(row1.getCell(1).value, '1.0');
  assert.strictEqual(row1.getCell(2).value, 'MX95');
  assert.strictEqual(row1.getCell(6).value, 5770.82);
  assert.strictEqual(row1.getCell(7).value, 11541.64);

  const row2 = ws!.getRow(15);
  assert.strictEqual(row2.getCell(1).value, '1.0.1');
  assert.strictEqual(row2.getCell(2).value, 'CON-L1NBD-MX95');
  assert.strictEqual(row2.getCell(6).value, 1467.99);
  assert.strictEqual(row2.getCell(7).value, 2935.98);

  // Check Total Row (Row 16)
  const totalRow = ws!.getRow(16);
  assert.strictEqual(totalRow.getCell(2).value, 'Price Total:');
  const totalCellVal = totalRow.getCell(7).value as any;
  assert.strictEqual(totalCellVal.formula, 'SUM(G14:G15)');

  // Verify logo image is present in the media of the workbook
  assert(wb.model.media && wb.model.media.length > 0, 'El logo corporativo debe estar insertado en los medios del libro');
  console.log('✅ Formato oficial de 7 columnas, logo Intcomex, estilos y fórmulas verificados exitosamente.\n');

  // ----------------------------------------------------------------------------
  // 5. Corporate logo base64 is lightweight and contains official Intcomex logo
  // ----------------------------------------------------------------------------
  console.log('--- 5. Verificación de Integridad del Logo Corporativo Intcomex 2024 ---');
  assert(INTCOMEX_LOGO_RAW_BASE64.length < 50000, 'El logo en Base64 debe ser liviano (< 50KB)');
  assert(INTCOMEX_LOGO_RAW_BASE64.startsWith('iVBORw0KGgo'), 'Debe tener encabezado PNG válido');
  console.log(`✅ Logo Intcomex 2024 validado (${INTCOMEX_LOGO_RAW_BASE64.length} caracteres base64).\n`);

  console.log('🎉 ¡TODAS LAS PRUEBAS DE SNT Y DESCARGA OFICIAL DESDE HISTORIAL COMPLETADAS AL 100%!');
}

runTests().catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
