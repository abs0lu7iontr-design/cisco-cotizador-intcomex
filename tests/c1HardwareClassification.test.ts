import assert from 'node:assert';
import {
  checkIsIntangible,
  checkLlevaArancel,
  calculateLineItemCosts,
} from '../src/core/calculations';
import { isCiscoLicenseSku, isCiscoIntangibleSku } from '../src/core/ciscoTaxonomy';
import { getEstimatesMirrorSnapshot, saveEstimatesMirrorSnapshot } from '../src/hooks/useEstimatesMirror';

console.log('🧪 Iniciando Suite de Verificación de Clasificación C1 (Hardware vs Software) y Snapshot Espejo...');

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
// 3. Verificación de Licencias Cisco ONE genuinas (C1-, C1A, C1F, C1P)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Verificación de Licencias Genuinas Cisco ONE (Intangibles) ---');
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
// 4. Verificación de Referencia Estable en getEstimatesMirrorSnapshot (Fix React Error #185)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Verificación de Blindaje contra React Error #185 en getEstimatesMirrorSnapshot ---');

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

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE HARDWARE C1 Y BLINDAJE CONTRA REACT ERROR #185 PASARON EXITOSAMENTE!');
