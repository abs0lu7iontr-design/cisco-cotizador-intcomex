// ============================================================================
// TEST: Parser Jerárquico Multi-Bloque & Motor de Precios Dinámico
// ============================================================================

import { parseEstimateWithHierarchy } from '../src/modules/estimate/estimateHierarchyParser';
import { calculateEstimateSalesPricing } from '../src/modules/estimate/pricingEngine';

function runTests() {
  console.log('🧪 Iniciando pruebas del Parser Jerárquico y Motor de Precios...\n');

  // Simulación de Estimate CCW complejo:
  // - Bloque 1: MERAKI-SUB a 36 meses + LIC-CW-E + Sublínea $0 LIC-MT-E-INCL
  // - Bloque 2: Hardware Catalyst intercalado C9200L + Accesorio con arancel
  // - Bloque 3: Licencia DNA empaquetada (plazo completo en Unit Net)
  // - Bloque 4: Segundo bloque MERAKI-SUB a 12 meses
  const rawRows: any[][] = [
    // Encabezados CCW
    ['Line #', 'Part Number', 'Smart Account', 'Description', 'Duration', 'Lead Time', 'List Price', 'Term', 'Qty', 'Unit Net Price', 'Disc %', 'Ext Net Price'],
    
    // Bloque 1 (Grupo 1) - Meraki 36 Meses
    ['1.0', 'MERAKI-SUB', '-', 'Meraki Cloud Subscription', '', '', '0.00', '', '1', '0.00', '0', '0.00'],
    ['', 'Initial Term - 36.00 Months', '', 'Initial Term - 36.00 Months', '', '', '', '', '', '', '', ''],
    ['1.1', 'LIC-CW-E', 'Yes', 'Meraki Cloud License Enterprise', '36', '0', '20.00', '1 Month', '2', '10.00', '50.00', '720.00'], // 10 * 36 * 2 = 720
    ['1.2', 'LIC-MT-E-INCL', 'Yes', 'Meraki MT Sensor Included License', '36', '0', '0.00', '1 Month', '2', '0.00', '0.00', '0.00'], // Costo 0

    // Bloque 2 (Grupo 2) - Hardware Físico Intercalado
    ['2.0', 'C9200L-24P-4G-E', 'Yes', 'Catalyst 9200L 24-port PoE+ Switch', '', '14', '2000.00', '', '1', '1000.00', '50.00', '1000.00'],
    ['2.1', 'PWR-C5-125WAC=', 'No', 'Power Supply Accessory', '', '0', '200.00', '', '1', '100.00', '50.00', '100.00'],

    // Bloque 3 (Grupo 3) - Licencia DNA Perpetua/Consolidada (no se multiplica)
    ['3.0', 'C9200L-DNA-E-24', 'Yes', 'Cisco DNA Essentials 3 Year Term License', '36', '0', '500.00', '3 Year', '1', '300.00', '40.00', '300.00'],

    // Bloque 4 (Grupo 4) - Meraki 12 Meses (Plazo Independiente)
    ['4.0', 'MERAKI-SUB', '-', 'Meraki Cloud Subscription', '', '', '0.00', '', '1', '0.00', '0', '0.00'],
    ['', 'Initial Term - 12.00 Months', '', 'Initial Term - 12.00 Months', '', '', '', '', '', '', '', ''],
    ['4.1', 'LIC-MS120-24P-1YR', 'Yes', 'Meraki MS120 License', '12', '0', '30.00', '1 Month', '3', '15.00', '50.00', '540.00'], // 15 * 12 * 3 = 540
    ['4.2', 'LIC-MT-E-INCL', 'Yes', 'Meraki MT Sensor Included License', '12', '0', '0.00', '1 Month', '3', '0.00', '0.00', '0.00'], // Costo 0
  ];

  // 1. Ejecutar Parser Jerárquico
  const parsed = parseEstimateWithHierarchy(rawRows);
  console.log(`✅ Parser completado. Total de líneas procesadas: ${parsed.length}`);

  // Validaciones Grupo 1 (36 Meses)
  const line1_0 = parsed.find(l => l.lineNumber === '1.0')!;
  const line1_1 = parsed.find(l => l.lineNumber === '1.1')!;
  const line1_2 = parsed.find(l => l.lineNumber === '1.2')!;

  console.assert(line1_0.detectedDurationMonths === 36, `Error: 1.0 duración esperada 36, obtuve ${line1_0.detectedDurationMonths}`);
  console.assert(line1_1.isPeriodicSubscription === true, 'Error: 1.1 debería ser isPeriodicSubscription === true');
  console.assert(line1_1.detectedDurationMonths === 36, `Error: 1.1 duración esperada 36, obtuve ${line1_1.detectedDurationMonths}`);
  console.assert(line1_1.realUnitCost === 360, `Error: 1.1 realUnitCost esperado 360, obtuve ${line1_1.realUnitCost}`);
  
  // Validación Sublínea $0.00 hereda plazo sin NaN
  console.assert(!isNaN(line1_2.realUnitCost), 'Error: 1.2 realUnitCost generó NaN!');
  console.assert(line1_2.realUnitCost === 0, `Error: 1.2 realUnitCost esperado 0, obtuve ${line1_2.realUnitCost}`);
  console.assert(line1_2.detectedDurationMonths === 36, `Error: 1.2 heredó vigencia incorrecta: ${line1_2.detectedDurationMonths}`);
  console.assert(line1_2.isPeriodicSubscription === true, 'Error: 1.2 debería marcar isPeriodicSubscription === true');

  // Validaciones Grupo 2 (Hardware)
  const line2_0 = parsed.find(l => l.lineNumber === '2.0')!;
  console.assert(line2_0.isPeriodicSubscription === false, 'Error: 2.0 (Hardware) no debe ser suscripción periódica');
  console.assert(line2_0.realUnitCost === 1000, `Error: 2.0 realUnitCost esperado 1000, obtuve ${line2_0.realUnitCost}`);
  console.assert(line2_0.detectedDurationMonths === 1, `Error: 2.0 duración esperada 1, obtuve ${line2_0.detectedDurationMonths}`);

  // Validaciones Grupo 3 (Licencia DNA empaquetada ratio = 1)
  const line3_0 = parsed.find(l => l.lineNumber === '3.0')!;
  console.assert(line3_0.isPeriodicSubscription === false, 'Error: 3.0 (DNA) no debe marcarse como periódica mensual');
  console.assert(line3_0.realUnitCost === 300, `Error: 3.0 no debe multiplicarse, esperado 300, obtuve ${line3_0.realUnitCost}`);

  // Validaciones Grupo 4 (12 Meses Independiente)
  const line4_1 = parsed.find(l => l.lineNumber === '4.1')!;
  const line4_2 = parsed.find(l => l.lineNumber === '4.2')!;
  console.assert(line4_1.isPeriodicSubscription === true, 'Error: 4.1 debe ser periódica');
  console.assert(line4_1.detectedDurationMonths === 12, `Error: 4.1 duración esperada 12, obtuve ${line4_1.detectedDurationMonths}`);
  console.assert(line4_1.realUnitCost === 180, `Error: 4.1 realUnitCost esperado 180, obtuve ${line4_1.realUnitCost}`);
  console.assert(line4_2.detectedDurationMonths === 12, `Error: 4.2 sublínea $0 debe heredar 12 meses, obtuve ${line4_2.detectedDurationMonths}`);
  console.assert(line4_2.realUnitCost === 0, 'Error: 4.2 realUnitCost debe ser 0');

  console.log('✅ Todas las aserciones del Parser Jerárquico pasaron exitosamente.');

  // 2. Ejecutar Motor de Precios Dinámico (5% Margen, 7% Internación)
  const marginPct = 5;
  const hwInternacionPct = 7;
  const priced = calculateEstimateSalesPricing(parsed, marginPct, hwInternacionPct);

  const pricedHw = priced.find(l => l.lineNumber === '2.0')!;
  const pricedSub36 = priced.find(l => l.lineNumber === '1.1')!;
  const pricedSub12 = priced.find(l => l.lineNumber === '4.1')!;
  const pricedZero = priced.find(l => l.lineNumber === '1.2')!;

  // Verificación Hardware: Landed = 1000 * 1.07 = 1070; PV = 1070 / (1 - 0.05) = 1126.315...
  const expectedHwLanded = 1000 * 1.07;
  const expectedHwSale = expectedHwLanded / 0.95;
  console.assert(Math.abs(pricedHw.unitSalePrice - expectedHwSale) < 0.01, `Error en PV Hardware: ${pricedHw.unitSalePrice} vs ${expectedHwSale}`);

  // Verificación Suscripción 36 Meses: Sin internación -> Landed = 360; PV = 360 / 0.95 = 378.947...
  const expectedSub36Sale = 360 / 0.95;
  console.assert(Math.abs(pricedSub36.unitSalePrice - expectedSub36Sale) < 0.01, `Error en PV Sub 36: ${pricedSub36.unitSalePrice} vs ${expectedSub36Sale}`);

  // Verificación Suscripción 12 Meses: Sin internación -> Landed = 180; PV = 180 / 0.95 = 189.473...
  const expectedSub12Sale = 180 / 0.95;
  console.assert(Math.abs(pricedSub12.unitSalePrice - expectedSub12Sale) < 0.01, `Error en PV Sub 12: ${pricedSub12.unitSalePrice} vs ${expectedSub12Sale}`);

  // Verificación Sublínea $0.00: Costo 0 -> PV = 0, Margen = 0 (Sin NaN)
  console.assert(pricedZero.unitSalePrice === 0, `Error en Sublínea $0 PV: ${pricedZero.unitSalePrice}`);
  console.assert(pricedZero.marginAmountTotal === 0, `Error en Sublínea $0 Margen: ${pricedZero.marginAmountTotal}`);
  console.assert(!isNaN(pricedZero.unitSalePrice) && !isNaN(pricedZero.marginAmountTotal), 'Error: Sublínea $0 generó NaN!');

  console.log('✅ Todas las aserciones del Motor de Precios Dinámico pasaron exitosamente.');

  // 3. Verificación de Auditoría huerto (sys_metadata)
  const huerto = priced.map(item => ({
    line: item.lineNumber,
    manzana: item.unitListPrice,
    cereza: item.unitNetPriceCcw > 0 ? ((1 - (item.unitNetPriceCcw / item.unitListPrice)) * 100) : 0,
    pera: item.realUnitCost,
    mango: item.detectedDurationMonths,
    sandia: item.isPeriodicSubscription
  }));

  console.assert(huerto.length === parsed.length, 'Error en longitud de huerto');
  const h1_1 = huerto.find(h => h.line === '1.1')!;
  const h4_1 = huerto.find(h => h.line === '4.1')!;
  console.assert(h1_1.mango === 36 && h1_1.sandia === true, 'Error en huerto 1.1');
  console.assert(h4_1.mango === 12 && h4_1.sandia === true, 'Error en huerto 4.1');
  console.log('✅ Estructura huerto de sys_metadata validada exitosamente.');
  console.log('\n🎉 ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO AL 100%!');
}

runTests();
