// ============================================================================
// CISCO AUTOMATED v2.1 - QA FINDINGS VERIFICATION SUITE (QA-01 to QA-07)
// Verifica empíricamente la fórmula central y los 7 hallazgos de auditoría QA
// ============================================================================

import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  calculateLineItemCosts,
  calculateMerakiLicenseCosts,
  recalculateEstimateResult,
  solveGoalSeekParameters,
} from '../src/core/calculations';
import { synthesizeOfficialEstimateWorkbook } from '../src/core/excelEngine';
import { calculateDsvPrices } from '../src/modules/dsv/dsvEngine';
import { auditEstimateWithFastTrack } from '../src/modules/fasttrack/fastTrackAuditor';

async function runQaFindingsTests() {
  console.log('🧪 INICIANDO VERIFICACIÓN DE FÓRMULA CENTRAL Y HALLAZGOS QA-01 A QA-07...\n');

  // --------------------------------------------------------------------------
  // 0. Base Cases: Neto Cisco 100, Internación 7%, Arancel 6%, Margen 5%
  // --------------------------------------------------------------------------
  console.log('--- 0. Verificación de Casos Estándar (Neto 100, Int 7%, Ara 6%, Mar 5%) ---');
  const stdParams = { internacionPct: 7, arancelPct: 6, margenPct: 5 };

  const eqSinArancel = calculateLineItemCosts(100, 1, 'C9200L-24P-4G-E', 'Switch', stdParams, 'equipo', '1.0');
  assert.strictEqual(eqSinArancel.costoTotalUnitario, 107.0);
  assert.strictEqual(eqSinArancel.precioVentaUnitario, 112.63);

  const accConArancel = calculateLineItemCosts(100, 1, 'CAB-TA-IT=', 'Power Cord', stdParams, undefined, '1.0');
  assert.strictEqual(accConArancel.costoTotalUnitario, 113.0);
  assert.strictEqual(accConArancel.precioVentaUnitario, 118.95);

  const intangibleItem = calculateLineItemCosts(100, 1, 'CON-SNT-C9200L24', 'SmartNet', stdParams, undefined, '1.0');
  assert.strictEqual(intangibleItem.costoTotalUnitario, 100.0);
  assert.strictEqual(intangibleItem.precioVentaUnitario, 105.26);
  console.log('  ✅ Casos estándar validados: Equipo=$112.63, Accesorio=$118.95, Intangible=$105.26\n');

  // --------------------------------------------------------------------------
  // QA-01: Margen 100% debe ser rechazado (división por cero), 99% = 10,700
  // --------------------------------------------------------------------------
  console.log('--- QA-01: Rechazo de Margen 100% (División por Cero) ---');
  const qa01_99 = calculateLineItemCosts(
    100,
    1,
    'C9200L-24P-4G-E',
    'Switch',
    { internacionPct: 7, arancelPct: 6, margenPct: 99 },
    'equipo',
    '1.0'
  );
  assert.strictEqual(qa01_99.precioVentaUnitario, 10700.0);

  assert.throws(
    () =>
      calculateLineItemCosts(
        100,
        1,
        'C9200L-24P-4G-E',
        'Switch',
        { internacionPct: 7, arancelPct: 6, margenPct: 100 },
        'equipo',
        '1.0'
      ),
    RangeError,
    'Margen 100% debe lanzar RangeError en calculateLineItemCosts'
  );

  assert.throws(
    () =>
      calculateMerakiLicenseCosts(100, 0, 1, 12, {
        internacionPct: 7,
        arancelPct: 6,
        margenPct: 100,
      }),
    RangeError,
    'Margen 100% debe lanzar RangeError en calculateMerakiLicenseCosts'
  );
  console.log('  ✅ QA-01 validado: 99% -> $10,700.00; 100% es rechazado explícitamente (RangeError).\n');

  // --------------------------------------------------------------------------
  // QA-02: Servicio DSV, lista anual 100, descuento 1% y 0.5%, plazo 12 meses
  // --------------------------------------------------------------------------
  console.log('--- QA-02: Servicio DSV con Descuento <= 1% (1% y 0.5%) ---');
  const qa02_1pct = calculateDsvPrices('CON-SNT-C9200L24', 100, 1, 12);
  const qa02_05pct = calculateDsvPrices('CON-SNT-C9200L24', 100, 0.5, 12);
  assert.strictEqual(qa02_1pct.reportedNetPrice, 99.0, 'Con 1% de descuento sobre 100 debe devolver 99.00');
  assert.strictEqual(qa02_05pct.reportedNetPrice, 99.5, 'Con 0.5% de descuento sobre 100 debe devolver 99.50');
  console.log(`  ✅ QA-02 validado: 1% -> $${qa02_1pct.reportedNetPrice}, 0.5% -> $${qa02_05pct.reportedNetPrice}\n`);

  // --------------------------------------------------------------------------
  // QA-03: Servicio DSV, lista anual 100, descuento 37%, 18m y 30m (meses / 12)
  // --------------------------------------------------------------------------
  console.log('--- QA-03: Servicio DSV Prorrateo Exacto de Plazo (18m y 30m) ---');
  const qa03_18m = calculateDsvPrices('CON-SNT-C9200L24', 100, 37, 18);
  const qa03_30m = calculateDsvPrices('CON-SNT-C9200L24', 100, 37, 30);
  assert.strictEqual(qa03_18m.reportedNetPrice, 94.5, 'Para 18 meses (1.5 años) corresponde 94.50');
  assert.strictEqual(qa03_30m.reportedNetPrice, 157.5, 'Para 30 meses (2.5 años) corresponde 157.50');
  console.log(`  ✅ QA-03 validado: 18m -> $${qa03_18m.reportedNetPrice}, 30m -> $${qa03_30m.reportedNetPrice}\n`);

  // --------------------------------------------------------------------------
  // QA-04: Hardware DSV, lista 100, descuento explícito 0%, sin neto informado
  // --------------------------------------------------------------------------
  console.log('--- QA-04: Hardware DSV con Descuento Explícito 0% ---');
  const qa04_std = calculateDsvPrices('C9200L-24P-4G-E', 100, 0, 0);
  const qa04_smb = calculateDsvPrices('C1300-24P-4G', 100, 0, 0);
  assert.strictEqual(qa04_std.reportedNetPrice, 100.0, 'Hardware estándar con 0% descuento explícito debe ser 100.00');
  assert.strictEqual(qa04_smb.reportedNetPrice, 100.0, 'Hardware SMB con 0% descuento explícito debe ser 100.00');
  console.log(`  ✅ QA-04 validado: Std HW 0% -> $${qa04_std.reportedNetPrice}, SMB HW 0% -> $${qa04_smb.reportedNetPrice}\n`);

  // --------------------------------------------------------------------------
  // QA-05: Neto unitario 1.005, cantidad 10, parámetros en cero -> Total 10.10 y Excel 10.10
  // --------------------------------------------------------------------------
  console.log('--- QA-05: Política Única de Redondeo en Total General y Fórmula Excel ---');
  const mockEst: any = {
    fileName: 'Test_Rounding.xlsx',
    originalProductTotal: 10.05,
    calculatedProductTotal: 10.1,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 10.1,
    headerRowIndex: 13,
    workbookBuffer: new ArrayBuffer(0),
    items: [
      {
        rowIdx: 14,
        lineNumber: '1.0',
        partNumber: 'C9200L-24P-4G-E',
        smartAccountMandatory: 'No',
        description: 'Switch',
        serviceDurationMonths: '-',
        originalLeadTimeDays: 14,
        transformedLeadTime: '4-6 semanas',
        unitListPrice: 1.005,
        pricingTerm: '',
        qty: 10,
        netCiscoUnit: 1.005,
        discPct: 0,
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 1.01,
        precioVentaUnitario: 1.01,
        precioVentaExtendido: 10.1,
      },
    ],
  };
  const qa05 = recalculateEstimateResult(mockEst, { internacionPct: 0, arancelPct: 0, margenPct: 0 });
  assert.strictEqual(qa05.items[0].precioVentaUnitario, 1.01);
  assert.strictEqual(qa05.items[0].precioVentaExtendido, 10.1);
  assert.strictEqual(qa05.calculatedProductTotal, 10.1, 'calculatedProductTotal debe coincidir con la suma de líneas (10.10)');
  assert.strictEqual(qa05.finalTotalPrice, 10.1, 'finalTotalPrice debe coincidir con la suma de líneas (10.10)');

  const excelBuf = await synthesizeOfficialEstimateWorkbook(qa05, { internacionPct: 0, arancelPct: 0, margenPct: 0 });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(excelBuf));
  const ws = wb.getWorksheet('Price Estimate')!;
  const totalCell = ws.getRow(15).getCell(7).value as { formula: string; result: number };
  assert.strictEqual(totalCell.formula, 'SUM(G14:G14)');
  assert.strictEqual(totalCell.result, 10.1, 'El resultado en caché de la fórmula Excel debe ser 10.10');
  console.log(`  ✅ QA-05 validado: Unit=$1.01, Línea=$10.10, Total=$10.10, Excel SUM(G14:G14)=${totalCell.result}\n`);

  // --------------------------------------------------------------------------
  // QA-06: Licencia prepaga 36 meses no periódica con Fast Track 60%
  // --------------------------------------------------------------------------
  console.log('--- QA-06: Auditor Fast Track en Licencia Prepaga 36m No Periódica ---');
  const qa06 = await auditEstimateWithFastTrack(
    [
      {
        rowIdx: 14,
        lineNumber: '1.0',
        partNumber: 'DNA-P-T1-E-3Y',
        smartAccountMandatory: 'Yes',
        description: 'DNA Premier 3Y Prepaid',
        serviceDurationMonths: '36 Months',
        originalLeadTimeDays: 2,
        transformedLeadTime: '2 días',
        unitListPrice: 1000,
        pricingTerm: '36',
        qty: 1,
        netCiscoUnit: 500,
        discPct: 50,
        detectedDurationMonths: 36,
        months: 36,
        isPeriodicSubscription: false,
        isIntangible: true,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 500,
        precioVentaUnitario: 526.32,
        precioVentaExtendido: 526.32,
      },
    ],
    async () => ({
      partNumber: 'DNA-P-T1-E-3Y',
      description: 'DNA Premier 3Y',
      listPrice: 1000,
      distributorDiscount: 60,
      netPrice: 400,
      updatedAt: Date.now(),
    })
  );
  assert.ok(qa06, 'Resultado de auditoría Fast Track debe existir');
  assert.strictEqual(qa06.hasOpportunity, true, 'Debe detectar oportunidad de ahorro en licencia prepaga 36m');
  assert.strictEqual(qa06.matches.length, 1);
  assert.strictEqual(qa06.matches[0].promoUnitNetPrice, 400, 'Neto promocional debe ser $400');
  assert.strictEqual(qa06.matches[0].unitSavings, 100, 'Ahorro unitario debe ser $100');
  assert.strictEqual(qa06.totalSavings, 100, 'Ahorro total debe ser $100');
  console.log(`  ✅ QA-06 validado: Neto promo=$${qa06.matches[0].promoUnitNetPrice}, Ahorro=$${qa06.totalSavings}\n`);

  // --------------------------------------------------------------------------
  // QA-07: Goal Seek con objetivo inalcanzable ($50 sobre costo neto $100)
  // --------------------------------------------------------------------------
  console.log('--- QA-07: Goal Seek con Objetivo Inalcanzable (< Costo Piso) ---');
  const qa07 = solveGoalSeekParameters(
    [
      {
        netCiscoUnit: 100,
        qty: 1,
        partNumber: 'C9200L-24P-4G-E',
        description: 'Switch',
        lineNumber: '1.0',
      },
    ],
    50,
    'target_price',
    { internacionPct: 7, arancelPct: 6, margenPct: 5 }
  );
  assert.strictEqual(qa07.success, false, 'Goal Seek debe marcar success: false cuando el objetivo es menor al piso de costo');
  assert.strictEqual(qa07.isBelowMinimumCost, true, 'Debe indicar isBelowMinimumCost: true');
  assert.strictEqual(qa07.minPossibleTotal, 100, 'El piso mínimo alcanzable debe ser 100');
  assert.strictEqual(qa07.achievedTotal, 100, 'El valor piso alcanzado es 100');
  assert.strictEqual(qa07.difference, 50, 'La diferencia con el objetivo 50 es 50');
  assert.ok(qa07.error && qa07.error.includes('Objetivo inalcanzable'), 'Debe incluir mensaje explícito de objetivo inalcanzable');
  console.log(`  ✅ QA-07 validado: success=${qa07.success}, minPossibleTotal=$${qa07.minPossibleTotal}, error="${qa07.error}"\n`);

  console.log('🎉 ¡TODOS LOS 7 HALLAZGOS QA (QA-01 A QA-07) Y LA FÓRMULA CENTRAL PASARON AL 100%!');
}

runQaFindingsTests().catch((err) => {
  console.error('❌ Error en suite QA-01 a QA-07:', err);
  process.exit(1);
});
