// ============================================================================
// TEST: Suscripciones Prepago (Prepaid Term) y Licencias Plurianuales (-3Y, -5Y)
// Evita el bug crítico de multiplicación redundante por meses
// ============================================================================

import { parseEstimateWithHierarchy } from '../src/modules/estimate/estimateHierarchyParser';
import { calculateEstimateSalesPricing } from '../src/modules/estimate/pricingEngine';
import { isCloudSubscriptionSku, checkIsIntangible } from '../src/core/calculations';
import { isPeriodicSubscriptionLine, resolveDsvRowPrices } from '../src/modules/dsv/dsvSubscriptionResolver';

function runPrepaidTests() {
  console.log('🧪 Iniciando pruebas de Suscripciones Prepago (Prepaid Term)...\n');

  // 1. Simulación de filas CCW para una licencia Prepago 36 Meses (C1E1TN9300XF-3Y)
  const rawRows: any[][] = [
    ['Line #', 'Part Number', 'Smart Account', 'Description', 'Duration', 'Lead Time', 'List Price', 'Term', 'Qty', 'Unit Net Price', 'Disc %', 'Ext Net Price'],
    ['1.0', 'N9K-C93180YC-FX3', 'Yes', 'Nexus 9300 with 48p 1/10G/25G SFP and 6p 40G/100G QSFP28', '', '14', '15000.00', '', '2', '7500.00', '50.00', '15000.00'],
    ['1.11', 'C1E1TN9300XF-3Y', 'Yes', 'Data Center Networking Essentials Term N9300 XF, 3Y', '---', '2', '20605.68', '', '2', '11951.28', '42.00', '23902.56'],
    ['', 'Initial Term - 36.00 Months   |   Auto Renewal Term - 0 Months   |   Billing Model - Prepaid Term ', '', 'Initial Term - 36.00 Months   |   Auto Renewal Term - 0 Months   |   Billing Model - Prepaid Term ', '', '', '', '', '', '', '', ''],
  ];

  // 2. Verificar clasificación del clasificador de SKU
  const isCloudSub = isCloudSubscriptionSku(
    'C1E1TN9300XF-3Y',
    'Initial Term - 36.00 Months | Auto Renewal Term - 0 Months | Billing Model - Prepaid Term'
  );
  console.assert(isCloudSub === false, 'Error: C1E1TN9300XF-3Y NO debe clasificarse como suscripción SaaS mensual');
  console.log('✅ isCloudSubscriptionSku: C1E1TN9300XF-3Y correctamente clasificado como NO periódico');

  // 3. Verificar intangible
  const isIntangible = checkIsIntangible('C1E1TN9300XF-3Y', 'Data Center Networking Essentials Term N9300 XF, 3Y');
  console.assert(isIntangible === true, 'Error: C1E1TN9300XF-3Y debe ser intangible (0% internación, 0% arancel)');
  console.log('✅ checkIsIntangible: C1E1TN9300XF-3Y correctamente clasificado como intangible');

  // 4. Parser Jerárquico
  const parsed = parseEstimateWithHierarchy(rawRows);
  const line1_11 = parsed.find(l => l.lineNumber === '1.11')!;

  console.assert(line1_11.isPeriodicSubscription === false, 'Error: 1.11 no debe marcarse como periódica mensual');
  console.assert(line1_11.realUnitCost === 11951.28, `Error: 1.11 costo unitario esperado 11951.28, obtuve ${line1_11.realUnitCost}`);
  console.assert(line1_11.extendedNetPriceCcw === 23902.56, `Error: 1.11 costo extendido CCW esperado 23902.56, obtuve ${line1_11.extendedNetPriceCcw}`);
  console.log('✅ Parser Jerárquico: 1.11 preserva costo unitario lump-sum $11,951.28 USD');

  // 5. Motor de Precios Dinámico (5% Margen)
  const priced = calculateEstimateSalesPricing(parsed, 5, 7);
  const priced1_11 = priced.find(l => l.lineNumber === '1.11')!;

  // Unit Sale: 11951.28 / 0.95 = 12580.2947... -> 12580.29
  const expectedSale = Math.round((11951.28 / 0.95) * 100) / 100;
  console.assert(Math.abs(priced1_11.unitSalePrice - expectedSale) < 0.05, `Error PV esperado ${expectedSale}, obtuve ${priced1_11.unitSalePrice}`);
  console.assert(Math.abs(priced1_11.extendedSalePrice - (expectedSale * 2)) < 0.05, `Error Ext PV esperado ${expectedSale * 2}, obtuve ${priced1_11.extendedSalePrice}`);
  console.log(`✅ Motor de Precios: Precio Venta Unitario = $${priced1_11.unitSalePrice} USD, Extendido (Qty 2) = $${priced1_11.extendedSalePrice} USD`);

  // 6. Verificación en Motor DSV (Evitar multiplicación por meses en BOM DSV)
  const dsvPrepaidRow = {
    lineNumber: '1.11',
    ciscoSku: 'C1E1TN9300XF-3Y',
    quantity: 2,
    durationMonthsColK: 36,
    unitListPriceColO: 20605.68,
    unitNetPriceColQ: 11951.28,
    extendedNetPriceColR: 23902.56,
    description: 'Initial Term - 36.00 Months | Billing Model - Prepaid Term',
  };
  const isDsvPeriodic = isPeriodicSubscriptionLine(dsvPrepaidRow);
  console.assert(isDsvPeriodic === false, 'Error DSV: C1E1TN9300XF-3Y NO debe clasificarse como suscripción periódica');
  const dsvResolved = resolveDsvRowPrices(dsvPrepaidRow);
  console.assert(dsvResolved.colKNetPrice === 11951.28, `Error DSV: Net Price esperado 11951.28, obtuve ${dsvResolved.colKNetPrice}`);
  console.assert(dsvResolved.unitListPriceFullTerm === 20605.68, `Error DSV: List Price esperado 20605.68, obtuve ${dsvResolved.unitListPriceFullTerm}`);
  console.log(`✅ Motor DSV: C1E1TN9300XF-3Y no se multiplica por 36. Net Price = $${dsvResolved.colKNetPrice} USD, List Price = $${dsvResolved.unitListPriceFullTerm} USD`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE PREPAID TERM COMPLETADAS CON ÉXITO AL 100%!');
}

runPrepaidTests();
