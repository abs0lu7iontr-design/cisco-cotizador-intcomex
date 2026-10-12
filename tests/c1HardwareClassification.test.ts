import assert from 'node:assert';
import {
  checkIsIntangible,
  checkLlevaArancel,
  calculateLineItemCosts,
  recalculateEstimateResult,
} from '../src/core/calculations';
import { isCiscoLicenseSku, isCiscoIntangibleSku } from '../src/core/ciscoTaxonomy';
import { getEstimatesMirrorSnapshot, saveEstimatesMirrorSnapshot } from '../src/hooks/useEstimatesMirror';

console.log('🧪 Iniciando Suite de Verificación de Clasificación C1, Cables CAB-X (con/sin =) y Snapshot Espejo...');

// ----------------------------------------------------------------------------
// 1. Verificación del caso exacto reportado por el usuario: C1300-24P-4G
// ----------------------------------------------------------------------------
console.log('\n--- 1. Verificación de SKU C1300-24P-4G (Catalyst 1300 Switch Físico) ---');
const c1300Sku = 'C1300-24P-4G';
const c1300Desc = 'Catalyst 1300 24-port GE, PoE, 4x1G SFP';

assert.strictEqual(
  checkIsIntangible(c1300Sku, c1300Desc),
  false,
  'C1300-24P-4G debe ser clasificado como TANGIBLE (Hardware), no como Intangible'
);
assert.strictEqual(
  isCiscoLicenseSku(c1300Sku, c1300Desc),
  false,
  'C1300-24P-4G no debe ser clasificado como Licencia Cisco'
);
assert.strictEqual(
  isCiscoIntangibleSku(c1300Sku, c1300Desc),
  false,
  'C1300-24P-4G no debe ser intangible'
);

const c1300Costs = calculateLineItemCosts(
  500.0,
  1,
  c1300Sku,
  c1300Desc,
  { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 }
);

assert.strictEqual(c1300Costs.isIntangible, false, 'isIntangible debe ser false en calculateLineItemCosts');
assert.strictEqual(c1300Costs.costoInternacion, 35.0, 'Debe cobrar 7% de internación ($35 USD sobre $500)');
assert.strictEqual(c1300Costs.costoArancel, 0.0, 'No debe llevar arancel a menos que termine en =');
console.log('✅ C1300-24P-4G verificado: Clasificado como EQUIPO (Físico) con 7.0% de Internación ($35 USD).');

// ----------------------------------------------------------------------------
// 2. Cobertura de familias Catalyst 1000, 1200, 1300 y Routers Cisco 1100
// ----------------------------------------------------------------------------
console.log('\n--- 2. Verificación de Familias de Hardware C1 (Catalyst 1000, 1200, 1300, ISR 1100) ---');
const hardwareCases = [
  { sku: 'C1000-8T-2G-L', desc: 'Catalyst 1000 8-port GE, 2x1G SFP' },
  { sku: 'C1000-24P-4G-L', desc: 'Catalyst 1000 24-port GE, Full PoE, 4x1G SFP' },
  { sku: 'C1200-8T-D', desc: 'Catalyst 1200 8-port GE, Desktop' },
  { sku: 'C1200-24P-4G', desc: 'Catalyst 1200 24-port GE, PoE, 4x1G SFP' },
  { sku: 'C1300-48P-4G', desc: 'Catalyst 1300 48-port GE, PoE, 4x1G SFP' },
  { sku: 'C1111-8P', desc: 'Cisco 1100 8-Port Dual GE WAN Ethernet Router' },
  { sku: 'C1117-4P', desc: 'Cisco 1100 4-Port VDSL2/ADSL2+ GE Router' },
  { sku: 'C1121-4P', desc: 'Cisco 1100 ISR 4-Port with LTE Advanced' },
];

for (const hw of hardwareCases) {
  assert.strictEqual(
    checkIsIntangible(hw.sku, hw.desc),
    false,
    `Hardware SKU ${hw.sku} debe ser Tangible`
  );
  console.log(`✅ Hardware verificado: ${hw.sku} -> Tangible / Equipo`);
}

// ----------------------------------------------------------------------------
// 3. Verificación de Cables CAB-X (CAB-ACI, CAB-C13, CAB-C14, CAB-C15, etc.)
//    - Sin signo '=' al final: Tangible (Hardware / Equipo: 7% internación, 0% arancel)
//    - Con signo '=' al final: Arancel (7% internación + 6% arancel)
//    - A costo $0.00 (sub-línea hija en CCW): mantiene su clasificación física (Tangible o Arancel, NUNCA Intangible)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Verificación de Cables CAB-X (CAB-ACI, CAB-C13, CAB-C14, CAB-C15) con y sin signo = ---');
const cableSkus = [
  { sku: 'CAB-ACI', desc: 'AC Power Cord (Italy), C13, CEI 23-16, 2.5m' },
  { sku: 'CAB-C13-C14-2M', desc: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter Length' },
  { sku: 'CAB-C13-CBN', desc: 'Cabinet Jumper Power Cord, 250 VAC 10A, C14-C13 Connectors' },
  { sku: 'CAB-C14-C15', desc: 'Jumper Cord 250VAC 10A C14-C15' },
  { sku: 'CAB-C15-CBN', desc: 'Cabinet Jumper Power Cord, 250 VAC 13A, C14-C15 Connectors' },
  { sku: 'CAB-ACA', desc: 'AC Power Cord (Italy/Chile), C13, CEI 23-16, 2.5m' },
  { sku: 'CAB-TA-IT', desc: 'Italy AC Type A Power Cable' },
];

for (const cab of cableSkus) {
  // Caso A: Sin '=' -> Tangible / Equipo (7% internación, 0% arancel)
  assert.strictEqual(
    checkIsIntangible(cab.sku, cab.desc),
    false,
    `${cab.sku} (sin =) debe ser TANGIBLE (Hardware), jamás Intangible`
  );
  assert.strictEqual(
    checkLlevaArancel(cab.sku),
    false,
    `${cab.sku} (sin =) no debe llevar arancel`
  );
  const calcHardware = calculateLineItemCosts(100, 1, cab.sku, cab.desc, {
    internacionPct: 7.0,
    arancelPct: 6.0,
    margenPct: 5.0,
  });
  assert.strictEqual(calcHardware.isIntangible, false);
  assert.strictEqual(calcHardware.llevaArancel, false);
  assert.strictEqual(calcHardware.costoInternacion, 7.0, `${cab.sku} debe llevar 7% internación`);
  assert.strictEqual(calcHardware.costoArancel, 0.0, `${cab.sku} sin = debe llevar 0% arancel`);

  // Caso B: Con '=' -> Arancel (7% internación + 6% arancel)
  const skuWithEqual = `${cab.sku}=`;
  assert.strictEqual(
    checkIsIntangible(skuWithEqual, cab.desc),
    false,
    `${skuWithEqual} (con =) debe ser TANGIBLE`
  );
  assert.strictEqual(
    checkLlevaArancel(skuWithEqual),
    true,
    `${skuWithEqual} (con =) DEBE llevar arancel (6%)`
  );
  const calcArancel = calculateLineItemCosts(100, 1, skuWithEqual, cab.desc, {
    internacionPct: 7.0,
    arancelPct: 6.0,
    margenPct: 5.0,
  });
  assert.strictEqual(calcArancel.isIntangible, false);
  assert.strictEqual(calcArancel.llevaArancel, true);
  assert.strictEqual(calcArancel.costoInternacion, 7.0, `${skuWithEqual} debe llevar 7% internación`);
  assert.strictEqual(calcArancel.costoArancel, 6.0, `${skuWithEqual} debe llevar 6% arancel`);

  console.log(`✅ Cable verificado: ${cab.sku} -> EQUIPO (Hardware) | ${skuWithEqual} -> ARANCEL (+6%)`);
}

// Verificación en Sub-líneas a costo $0.00 (ej. línea 2.1 CAB-ACI incluida en switch C1300-24P-4G)
const mockResultWithZeroCostCables = recalculateEstimateResult(
  {
    fileName: 'test.xlsx',
    originalProductTotal: 684.67,
    calculatedProductTotal: 787.0,
    params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
    items: [
      {
        rowIdx: 21,
        lineNumber: '2.1',
        partNumber: 'CAB-ACI',
        description: 'AC Power Cord (Italy), C13, CEI 23-16, 2.5m',
        qty: 18,
        unitListPrice: 0,
        netCiscoUnit: 0,
        realUnitCost: 0,
        discPct: 0,
        isIntangible: true, // Incluso si venía mal clasificado antes, debe autocurarse a false (Equipo)
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
      } as any,
      {
        rowIdx: 22,
        lineNumber: '2.2',
        partNumber: 'CAB-C13-C14-2M=',
        description: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter Length',
        qty: 2,
        unitListPrice: 0,
        netCiscoUnit: 0,
        realUnitCost: 0,
        discPct: 0,
        isIntangible: true,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
      } as any,
    ],
  } as any,
  { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 }
);

assert.strictEqual(
  mockResultWithZeroCostCables.items[0].isIntangible,
  false,
  'Sub-línea $0.00 CAB-ACI debe clasificarse como EQUIPO (isIntangible: false), NO como Intangible'
);
assert.strictEqual(
  mockResultWithZeroCostCables.items[0].llevaArancel,
  false,
  'Sub-línea $0.00 CAB-ACI sin = no lleva arancel'
);
assert.strictEqual(
  mockResultWithZeroCostCables.items[1].isIntangible,
  false,
  'Sub-línea $0.00 CAB-C13-C14-2M= debe tener isIntangible: false'
);
assert.strictEqual(
  mockResultWithZeroCostCables.items[1].llevaArancel,
  true,
  'Sub-línea $0.00 CAB-C13-C14-2M= con = debe clasificarse como ARANCEL (llevaArancel: true)'
);
console.log('✅ Sub-líneas $0.00 de cables CAB-ACI y CAB-C13-C14-2M= verificadas (EQUIPO y ARANCEL respectivamente).');

// ----------------------------------------------------------------------------
// 4. Verificación de Licencias Cisco ONE genuinas (C1-, C1A, C1F, C1P)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Verificación de Licencias Genuinas Cisco ONE (Intangibles) ---');
const ciscoOneLicenses = [
  { sku: 'C1-N9K-X', desc: 'Cisco ONE Foundation Suite for Nexus 9000' },
  { sku: 'C1A1TC4P1-3Y', desc: 'Cisco ONE Advantage 3Y Subscription' },
  { sku: 'C1F1PC100-3Y', desc: 'Cisco ONE Foundation 3Y Subscription' },
  { sku: 'LIC-MS120-24P-3YR', desc: 'Meraki MS120 Enterprise License 3YR' },
  { sku: 'CON-SNT-C130024P', desc: 'SNTC-8X5XNBD Catalyst 1300 24-port GE PoE' },
];

for (const lic of ciscoOneLicenses) {
  assert.strictEqual(
    checkIsIntangible(lic.sku, lic.desc),
    true,
    `Licencia/Servicio ${lic.sku} debe ser Intangible`
  );
  console.log(`✅ Licencia/Servicio verificado: ${lic.sku} -> Intangible`);
}

// ----------------------------------------------------------------------------
// 5. Verificación de Referencia Estable en getEstimatesMirrorSnapshot (Fix React Error #185)
// ----------------------------------------------------------------------------
console.log('\n--- 5. Verificación de Blindaje contra React Error #185 en getEstimatesMirrorSnapshot ---');

// Mock localStorage if in node environment without window
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: store.size,
  } as any;
}

// Llamadas consecutivas con almacenamiento vacío DEBEN retornar la misma referencia exacta (===)
const snapshot1 = getEstimatesMirrorSnapshot();
const snapshot2 = getEstimatesMirrorSnapshot();
assert.strictEqual(
  snapshot1,
  snapshot2,
  'getEstimatesMirrorSnapshot debe devolver exactamente la misma referencia en llamadas consecutivas cuando está vacío (Previene React Error #185)'
);
console.log('✅ Referencia referencialmente idéntica en estado vacío verificada (snapshot1 === snapshot2).');

// Llamadas consecutivas con datos guardados también DEBEN retornar la misma referencia exacta (===)
saveEstimatesMirrorSnapshot([
  {
    id: 'est_test_123',
    estimateId: '011234567890',
    dealId: '98765432',
    partnerName: 'Partner Test',
    clientFinalName: 'Cliente Test',
    originalFileName: 'test.xlsx',
    createdAt: new Date().toISOString(),
    itemsCount: 1,
    items: [],
  } as any,
]);

const snapshotWithData1 = getEstimatesMirrorSnapshot();
const snapshotWithData2 = getEstimatesMirrorSnapshot();
assert.strictEqual(
  snapshotWithData1,
  snapshotWithData2,
  'getEstimatesMirrorSnapshot debe devolver exactamente la misma referencia en llamadas consecutivas con datos'
);
console.log('✅ Referencia referencialmente idéntica con datos verificada (snapshotWithData1 === snapshotWithData2).');

// ----------------------------------------------------------------------------
// 6. Verificación de Regla de Accesorios en Formato Línea Madre (1.0, 2.0, 3.0, 4.0, 5, 6, 7, 8... al infinito)
//    - Accesorios No-EOL en Línea Madre (1.0, 2.0, 3.0, 5.0, 5, 6, 7, 8, 50.0, 100...) SIN '=' -> ARANCEL (6% + 7%)
//    - Accesorios No-EOL en Sub-Línea Hija (1.1, 1.2, 2.1, 3.4, 5.1...) SIN '=' -> EQUIPO / TANGIBLE (0% Arancel, 7% Internación)
//    - Accesorios con '=' en cualquier línea (1.0 o 1.1) -> ARANCEL (6% + 7%)
//    - Equipos Principales (Switches, Routers, APs, Firewalls, Cámaras, Teléfonos, Servidores) en Línea Madre SIN '=' -> EQUIPO (0% Arancel)
//    - Accesorios EOL excluidos del catálogo No-EOL 2026
// ----------------------------------------------------------------------------
import {
  isCiscoAccessorySku,
  isMotherLineFormat,
  isEolAccessoryOrProductSku,
  NON_EOL_CISCO_ACCESSORIES_SET,
} from '../src/core/calculations';

console.log('\n--- 6. Verificación de Formato Línea Madre (1.0, 2.0, 3.0, 5, 6, 7, 8... al infinito) para Accesorios No-EOL ---');

// 6.1 Formato de línea madre infinito vs sub-líneas hijas
const motherLineNumbers = ['1.0', '2.0', '3.0', '4.0', '5.0', '1', '2', '3', '4', '5', '6', '7', '8', '15.0', '42', '100.0', '9999'];
for (const ln of motherLineNumbers) {
  assert.strictEqual(
    isMotherLineFormat(ln),
    true,
    `El número de línea "${ln}" debe ser reconocido como formato Línea Madre`
  );
}

const childLineNumbers = ['1.1', '1.2', '2.1', '3.4', '5.1', '1.0.1', '2.1.3', '10.2'];
for (const ln of childLineNumbers) {
  assert.strictEqual(
    isMotherLineFormat(ln),
    false,
    `El número de línea "${ln}" debe ser reconocido como Sub-Línea Hija (NO madre)`
  );
}
console.log('✅ Detector infinito de Línea Madre (1.0..N.0 y 1..N) vs Sub-Línea Hija verificado.');

// 6.2 Accesorios de todas las familias (Antenas, Cables, Transceivers, Fuentes/Inyectores, Brackets/Montaje, Módulos/Stack Kits)
const representativeAccessories = [
  // Antenas (sin '=')
  { sku: 'C-ANT9101', desc: 'Ceiling Mount Omni Self-Identifying Antenna with 4-Port N', lineMother: '1.0', lineChild: '1.1' },
  { sku: 'C-ANT9102', desc: 'Wall Mount Omni Antenna with 4-Port RP-TNC', lineMother: '2.0', lineChild: '2.1' },
  { sku: 'CW-ANT-O1-NS-00', desc: 'Catalyst Wireless Omni Antenna', lineMother: '3.0', lineChild: '3.1' },
  { sku: 'AIR-ANT2524DW-R', desc: '2.4 GHz 2 dBi/5 GHz 4 dBi Dipole Ant., White, RP-TNC', lineMother: '5.0', lineChild: '5.1' },
  { sku: 'MA-ANT-3-A6', desc: 'Meraki Dual-Band Omni Antennas (RP-TNC)', lineMother: '5', lineChild: '5.2' },
  { sku: 'MA-ANT-20', desc: 'Meraki Dual-Band Omni Antennas', lineMother: '6', lineChild: '6.1' },
  { sku: '5G-ANTM-O-4-B', desc: '5G Outdoor Dipole Antenna', lineMother: '7', lineChild: '7.1' },
  // Cables (sin '=')
  { sku: 'CAB-ACI', desc: 'AC Power Cord (Italy), C13, CEI 23-16, 2.5m', lineMother: '8', lineChild: '8.1' },
  { sku: 'CAB-C13-C14-2M', desc: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter Length', lineMother: '9.0', lineChild: '9.1' },
  { sku: 'CAB-C15-CBN', desc: 'Cabinet Jumper Power Cord, 250 VAC 13A, C14-C15 Connectors', lineMother: '10', lineChild: '10.1' },
  { sku: 'STACK-T1-50CM', desc: '50CM Type 1 Stacking Cable', lineMother: '11.0', lineChild: '11.1' },
  { sku: 'SFP-H10GB-CU3M', desc: '10GBASE-CU SFP+ Cable 3 Meter', lineMother: '12', lineChild: '12.1' },
  { sku: 'MA-PWR-CORD-IT', desc: 'Meraki AC Power Cord for Italy/Chile', lineMother: '13.0', lineChild: '13.1' },
  // Transceivers (sin '=')
  { sku: 'GLC-TE', desc: '1000BASE-T SFP transceiver module for Category 5 copper wire', lineMother: '14.0', lineChild: '14.1' },
  { sku: 'GLC-SX-MMD', desc: '1000BASE-SX SFP transceiver module, MMF, 850nm, DOM', lineMother: '15', lineChild: '15.1' },
  { sku: 'SFP-10G-SR', desc: '10GBASE-SR SFP Module', lineMother: '16.0', lineChild: '16.1' },
  { sku: 'QSFP-100G-SR4-S', desc: '100GBASE SR4 QSFP Transceiver, MPO, 100m over OM4 MMF', lineMother: '17', lineChild: '17.1' },
  { sku: 'MA-SFP-10GB-SR', desc: 'Meraki 10G Base SR Multi-Mode', lineMother: '18.0', lineChild: '18.1' },
  // Fuentes e Inyectores PoE (sin '=')
  { sku: 'PWR-C1-715WAC-P', desc: '715W AC 80+ platinum Config 1 Power Supply', lineMother: '19.0', lineChild: '19.1' },
  { sku: 'AIR-PWRINJ6', desc: 'Power Injector (802.3at) for Aironet Access Points', lineMother: '20', lineChild: '20.1' },
  { sku: 'MA-INJ-4', desc: 'Meraki 802.3at PoE Injector', lineMother: '21.0', lineChild: '21.1' },
  { sku: 'CW-INJ-8', desc: 'Cisco Catalyst Wireless PoE Injector', lineMother: '22', lineChild: '22.1' },
  // Brackets, Montaje, Ventiladores y Blanks (sin '=')
  { sku: 'AIR-AP-BRACKET-1', desc: '802.11 AP Low Profile Mounting Bracket (Default)', lineMother: '23.0', lineChild: '23.1' },
  { sku: 'CW-MNT-ART1-00', desc: 'Catalyst Wireless Articulating Mount Kit', lineMother: '24', lineChild: '24.1' },
  { sku: 'MA-MNT-MR-17', desc: 'Meraki Mount Kit for MR', lineMother: '25.0', lineChild: '25.1' },
  { sku: 'C9200-ACC-KIT-19', desc: '19 inch Rack Mount Kit for Catalyst 9200', lineMother: '26', lineChild: '26.1' },
  { sku: 'FAN-T2', desc: 'Cisco Type 2 Fan Module', lineMother: '27.0', lineChild: '27.1' },
  { sku: 'C9200-STACK-BLANK', desc: 'Catalyst 9200 Blank Stack Module', lineMother: '28', lineChild: '28.1' },
  // Módulos de Expansión y Stack Kits (sin '=')
  { sku: 'C9200-NM-4X', desc: 'Catalyst 9200 4 x 10G Network Module', lineMother: '29.0', lineChild: '29.1' },
  { sku: 'C9300-NM-8X', desc: 'Catalyst 9300 8 x 10GE Network Module', lineMother: '30', lineChild: '30.1' },
  { sku: 'C9200L-STACK-KIT', desc: 'Catalyst 9200L Stack Module', lineMother: '31.0', lineChild: '31.1' },
  { sku: 'C-NIM-2T', desc: '2-port 100M/1G RJ45/SFP NIM', lineMother: '32', lineChild: '32.1' },
  { sku: 'NIM-4FXO', desc: '4-Port Network Interface Module - FXO (Universal)', lineMother: '33.0', lineChild: '33.1' },
];

for (const acc of representativeAccessories) {
  assert.strictEqual(
    isCiscoAccessorySku(acc.sku, acc.desc),
    true,
    `El SKU ${acc.sku} debe ser reconocido como Accesorio Cisco/Meraki No-EOL`
  );

  // En Línea Madre (1.0, 2.0, 3.0, 5, 6, 7, 8...) SIN '=' -> DEBE cobrar Arancel (6% + 7%)
  assert.strictEqual(
    checkLlevaArancel(acc.sku, acc.desc, acc.lineMother),
    true,
    `Accesorio ${acc.sku} en Línea Madre (${acc.lineMother}) SIN '=' DEBE llevar Arancel`
  );
  const motherCosts = calculateLineItemCosts(
    100.0,
    1,
    acc.sku,
    acc.desc,
    { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
    undefined,
    acc.lineMother
  );
  assert.strictEqual(motherCosts.isIntangible, false, `${acc.sku} en línea madre debe tener isIntangible: false`);
  assert.strictEqual(motherCosts.llevaArancel, true, `${acc.sku} en línea madre (${acc.lineMother}) debe tener llevaArancel: true`);
  assert.strictEqual(motherCosts.costoInternacion, 7.0, `${acc.sku} en línea madre debe cobrar 7% internación`);
  assert.strictEqual(motherCosts.costoArancel, 6.0, `${acc.sku} en línea madre debe cobrar 6% arancel`);

  // En Sub-Línea Hija (1.1, 2.1, 5.1...) SIN '=' -> NO lleva Arancel (es EQUIPO: 7% internación, 0% arancel)
  assert.strictEqual(
    checkLlevaArancel(acc.sku, acc.desc, acc.lineChild),
    false,
    `Accesorio ${acc.sku} en Sub-Línea Hija (${acc.lineChild}) SIN '=' NO debe llevar Arancel (es Equipo incluido)`
  );
  const childCosts = calculateLineItemCosts(
    100.0,
    1,
    acc.sku,
    acc.desc,
    { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
    undefined,
    acc.lineChild
  );
  assert.strictEqual(childCosts.isIntangible, false);
  assert.strictEqual(childCosts.llevaArancel, false);
  assert.strictEqual(childCosts.costoInternacion, 7.0);
  assert.strictEqual(childCosts.costoArancel, 0.0);
}
console.log(`✅ ${representativeAccessories.length} accesorios representativos verificados en Línea Madre (ARANCEL) vs Sub-Línea Hija (EQUIPO).`);

// 6.3 Equipos Principales en Línea Madre (1.0, 2.0, 3.0, 5, 6, 7, 8...) SIN '=' NUNCA llevan Arancel
const mainEquipmentOnMotherLines = [
  { sku: 'C1300-24P-4G', desc: 'Catalyst 1300 24-port GE, PoE, 4x1G SFP', line: '1.0' },
  { sku: 'C9200L-24P-4G-E', desc: 'Catalyst 9200L 24-port PoE+, 4 x 1G, Network Essentials', line: '2.0' },
  { sku: 'C9300-48P-A', desc: 'Catalyst 9300 48-port PoE+, Network Advantage', line: '3.0' },
  { sku: 'MS130-24P-HW', desc: 'Meraki MS130 24-Port PoE Switch', line: '4.0' },
  { sku: 'C8200-1N-4T', desc: 'Cisco Catalyst 8200 Series Edge Platform', line: '5' },
  { sku: 'C1111-8P', desc: 'ISR 1100 8 Ports Dual GE WAN Ethernet Router', line: '6' },
  { sku: 'CW9162I-ROW', desc: 'Catalyst 9162I AP Wi-Fi 6E', line: '7' },
  { sku: 'MR46-HW', desc: 'Meraki MR46 Wi-Fi 6 Indoor AP', line: '8' },
  { sku: 'FPR1010-NGFW-K9', desc: 'Cisco Firepower 1010 NGFW Appliance', line: '9.0' },
  { sku: 'C9800-L-F-K9', desc: 'Cisco Catalyst 9800-L Wireless Controller Fiber', line: '10.0' },
  { sku: 'MV22X-HW', desc: 'Meraki MV22X Indoor Varifocal Camera', line: '11' },
  { sku: 'MT10-HW', desc: 'Meraki MT10 Indoor Temperature and Humidity Sensor', line: '12' },
  { sku: 'CP-8845-K9', desc: 'Cisco IP Phone 8845', line: '13.0' },
  { sku: 'CS-BAR-T-K9', desc: 'Cisco Room Bar', line: '14' },
  { sku: 'UCSC-C220-M7S', desc: 'UCS C220 M7 Rack Server', line: '15.0' },
];

for (const eq of mainEquipmentOnMotherLines) {
  assert.strictEqual(
    isCiscoAccessorySku(eq.sku, eq.desc),
    false,
    `El equipo principal ${eq.sku} NUNCA debe ser clasificado como accesorio`
  );
  assert.strictEqual(
    checkLlevaArancel(eq.sku, eq.desc, eq.line),
    false,
    `El equipo principal ${eq.sku} en línea madre (${eq.line}) sin '=' NO debe llevar arancel`
  );
}
console.log(`✅ ${mainEquipmentOnMotherLines.length} Equipos Principales verificados: en Línea Madre (1.0..15.0) sin '=' son EQUIPO (0% Arancel).`);

// 6.4 Verificación de exclusión de SKUs End-of-Life (EOL) del catálogo de accesorios No-EOL 2026
const eolAccessorySkus = [
  'AIR-ANT2422DW-R',
  'AIR-PWRINJ4',
  'AIR-PWRINJ5',
  'GLC-LH-SM',
  'GLC-SX-MM',
  'CAB-STACK-50CM',
  'C3850-NM-4-1G',
];
for (const eolSku of eolAccessorySkus) {
  assert.strictEqual(
    isEolAccessoryOrProductSku(eolSku),
    true,
    `El SKU histórico ${eolSku} debe estar marcado como EOL`
  );
  assert.strictEqual(
    NON_EOL_CISCO_ACCESSORIES_SET.has(eolSku),
    false,
    `El SKU EOL ${eolSku} NO debe existir en NON_EOL_CISCO_ACCESSORIES_SET`
  );
  assert.strictEqual(
    isCiscoAccessorySku(eolSku),
    false,
    `El SKU EOL ${eolSku} debe quedar excluido del clasificador No-EOL`
  );
}
console.log(`✅ Exclusión de SKUs EOL verificada (${NON_EOL_CISCO_ACCESSORIES_SET.size} SKUs de accesorios vigentes No-EOL en catálogo base + cobertura RegExp infinita).`);

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE HARDWARE C1, CABLES CAB-X, ACCESORIOS EN LÍNEA MADRE (1.0..∞) Y BLINDAJE REACT ERROR #185 PASARON EXITOSAMENTE!');
