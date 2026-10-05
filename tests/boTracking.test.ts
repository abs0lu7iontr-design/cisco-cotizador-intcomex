// ============================================================================
// CISCO AUTOMATED v2.1 - BO ORDER TRACKING & FULFILLMENT TEST SUITE
// ============================================================================

import assert from 'node:assert';
import {
  getCourierTrackingUrl,
  getOrderHealthStatus,
  ORDERED_BO_STAGES,
  BO_STAGES_METADATA,
  BoOrderTrackingRecord,
} from '../src/modules/bo/boTrackingTypes';
import {
  createBoTrackingRecordFromEstimate,
  getLocalBoTrackingCache,
  saveLocalBoTrackingCache,
  getBoTrackings,
  updateBoTrackingStage,
  updateBoTrackingCourier,
  addBoDailyNote,
} from '../src/modules/bo/boTrackingService';
import { ProcessedEstimateResult } from '../src/core/types';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DE SEGUIMIENTO Y CICLO DE VIDA BO (CISCO AUTOMATED v2.1)...\n');

// ----------------------------------------------------------------------------
// Test 1: Generación de URLs de Seguimiento de Courier (FedEx, UPS, DHL)
// ----------------------------------------------------------------------------
console.log('--- 1. Validación de Generación de URLs de Tracking ---');

const fedexUrl = getCourierTrackingUrl('FedEx', '771234567890');
assert.strictEqual(
  fedexUrl,
  'https://www.fedex.com/fedextrack/?trknbr=771234567890',
  'Debe generar la URL oficial de FedEx con parámetro trknbr'
);

const upsUrl = getCourierTrackingUrl('UPS', '1Z9999999999999999');
assert.strictEqual(
  upsUrl,
  'https://www.ups.com/track?tracknum=1Z9999999999999999',
  'Debe generar la URL oficial de UPS'
);

const dhlUrl = getCourierTrackingUrl('DHL', '1234567890');
assert.strictEqual(
  dhlUrl,
  'https://www.dhl.com/en/express/tracking.html?AWB=1234567890&brand=DHL',
  'Debe generar la URL oficial de DHL'
);

assert.strictEqual(getCourierTrackingUrl('FedEx', ''), '', 'Guía vacía debe retornar string vacío');
assert.strictEqual(getCourierTrackingUrl('FedEx', '   '), '', 'Guía con espacios debe retornar string vacío');
console.log('✅ URLs oficiales de tracking (FedEx, UPS, DHL) validadas correctamente.');

// ----------------------------------------------------------------------------
// Test 2: Secuencia de Etapas del Ciclo de Vida y Metadatos
// ----------------------------------------------------------------------------
console.log('\n--- 2. Validación de Secuencia de Etapas (8 Hitos) ---');

assert.strictEqual(ORDERED_BO_STAGES.length, 8, 'El ciclo debe tener exactamente 8 etapas consecutivas');
assert.strictEqual(ORDERED_BO_STAGES[0], 'OC_RECEIVED', 'Hito 1 debe ser OC_RECEIVED');
assert.strictEqual(ORDERED_BO_STAGES[1], 'CISCO_SO_BOOKED', 'Hito 2 debe ser CISCO_SO_BOOKED');
assert.strictEqual(ORDERED_BO_STAGES[2], 'IN_PRODUCTION', 'Hito 3 debe ser IN_PRODUCTION');
assert.strictEqual(ORDERED_BO_STAGES[3], 'SHIPPED_COURIER', 'Hito 4 debe ser SHIPPED_COURIER');
assert.strictEqual(ORDERED_BO_STAGES[4], 'MIAMI_FORWARDER', 'Hito 5 debe ser MIAMI_FORWARDER');
assert.strictEqual(ORDERED_BO_STAGES[5], 'CUSTOMS_CLEARANCE', 'Hito 6 debe ser CUSTOMS_CLEARANCE');
assert.strictEqual(ORDERED_BO_STAGES[6], 'INTCOMEX_WAREHOUSE', 'Hito 7 debe ser INTCOMEX_WAREHOUSE');
assert.strictEqual(ORDERED_BO_STAGES[7], 'DELIVERED', 'Hito 8 debe ser DELIVERED');

ORDERED_BO_STAGES.forEach((stage, idx) => {
  const meta = BO_STAGES_METADATA[stage];
  assert.ok(meta, `Etapa ${stage} debe tener metadatos definidos`);
  assert.strictEqual(meta.stepNumber, idx + 1, `Etapa ${stage} debe tener el número de paso correlativo ${idx + 1}`);
  assert.ok(meta.shortLabel.length > 0, `Etapa ${stage} debe tener shortLabel`);
});
console.log('✅ Secuencia de 8 etapas y metadatos verificados al 100%.');

// ----------------------------------------------------------------------------
// Test 3: Semáforo de Salud y Alerta de Actualización Diaria (> 24h)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Validación de Indicador de Salud y Revisión Diaria ---');

const baseMockOrder: BoOrderTrackingRecord = {
  id: 'BO-OC100-TEST',
  estimateId: 'OE169047114NP',
  estimateVersionTag: 'v1',
  dealId: 'DEAL-1122',
  partnerName: 'Sonda',
  endCustomerName: 'Banco Santander',
  clientPoNumber: 'OC-100',
  courier: 'FedEx',
  currentStage: 'SHIPPED_COURIER',
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
  totalSaleUsd: 10000,
  grossProfitUsd: 1500,
  itemsCount: 5,
  notes: [],
};

// 3.1 Orden actualizada hace 2 horas -> Al día (up_to_date)
const nowRef = new Date('2026-10-05T12:00:00.000Z');
const recentOrder: BoOrderTrackingRecord = {
  ...baseMockOrder,
  lastDailyReviewAt: '2026-10-05T10:00:00.000Z', // Hace 2 horas
};
const healthRecent = getOrderHealthStatus(recentOrder, nowRef);
assert.strictEqual(healthRecent.status, 'up_to_date', 'Debe estar al día si se actualizó hace menos de 24h');

// 3.2 Orden sin actualizar por 30 horas -> Requiere actualización diaria (needs_review)
const staleOrder: BoOrderTrackingRecord = {
  ...baseMockOrder,
  lastDailyReviewAt: '2026-10-04T05:00:00.000Z', // Hace 31 horas
};
const healthStale = getOrderHealthStatus(staleOrder, nowRef);
assert.strictEqual(healthStale.status, 'needs_review', 'Debe marcar needs_review si pasaron más de 24h');

// 3.3 Orden con fecha de embarque (ESD) vencida en etapa previa a courier -> delayed
const delayedOrder: BoOrderTrackingRecord = {
  ...baseMockOrder,
  currentStage: 'IN_PRODUCTION',
  estimatedShipDate: '2026-10-01', // Venció hace 4 días y sigue en producción
  lastDailyReviewAt: '2026-10-05T11:00:00.000Z',
};
const healthDelayed = getOrderHealthStatus(delayedOrder, nowRef);
assert.strictEqual(healthDelayed.status, 'delayed', 'Debe marcar delayed si la fecha ESD ya venció');

// 3.4 Orden entregada -> siempre completada
const deliveredOrder: BoOrderTrackingRecord = {
  ...baseMockOrder,
  currentStage: 'DELIVERED',
  lastDailyReviewAt: '2026-09-01T00:00:00.000Z',
};
const healthDelivered = getOrderHealthStatus(deliveredOrder, nowRef);
assert.strictEqual(healthDelivered.status, 'up_to_date', 'Orden entregada debe estar al día / completada');
console.log('✅ Semáforo de salud (Al día, Revisión Diaria > 24h, Retrasada) verificado.');

// ----------------------------------------------------------------------------
// Test 4: Creación de Seguimiento a partir de un Estimate Procesado
// ----------------------------------------------------------------------------
console.log('\n--- 4. Validación de Creación de Orden a partir de Estimate ---');

const mockEstimate: ProcessedEstimateResult = {
  fileName: 'Sonda_Santander_Catalyst_Estimate_OE169047114NP_I7M5_v1.xlsx',
  headerInfo: {
    customerName: 'Sonda Chile',
    companyName: 'Banco Santander',
    address: 'Av. Libertador 1234',
    city: 'Santiago',
    country: 'Chile',
    phone: '+56 2 2345 6789',
    estimateId: 'OE169047114NP',
    dealId: 'DEAL-998877',
    priceList: 'Global Price List',
    date: '05/10/2026',
    endUser: 'Banco Santander',
    quoteName: 'OE169047114NP',
  },
  versionTag: 'v1',
  calculatedProductTotal: 25000,
  originalProductTotal: 20000,
  serviceTotal: 0,
  subscriptionTotal: 0,
  finalTotalPrice: 25000,
  headerRowIndex: 5,
  items: [
    {
      rowIdx: 1,
      lineNumber: '1',
      partNumber: 'C9300-48P-A',
      smartAccountMandatory: 'No',
      description: 'Catalyst 9300 48-port PoE+',
      serviceDurationMonths: '',
      originalLeadTimeDays: 14,
      transformedLeadTime: '14 días',
      unitListPrice: 5000,
      pricingTerm: '1',
      qty: 2,
      netCiscoUnit: 2000,
      discPct: 60,
      isIntangible: false,
      llevaArancel: true,
      costoInternacion: 140,
      costoArancel: 120,
      costoTotalUnitario: 2260,
      precioVentaUnitario: 2600,
      precioVentaExtendido: 5200,
      isInfoRow: false,
    },
  ],
};

const createdOrder = createBoTrackingRecordFromEstimate(
  mockEstimate,
  'OC-45892',
  'SO-99201',
  'Sonda Chile',
  'carlos_pm'
);

assert.strictEqual(createdOrder.estimateId, 'OE169047114NP', 'Estimate ID debe coincidir');
assert.strictEqual(createdOrder.estimateVersionTag, 'v1', 'Debe preservar la versión comercial del estimate');
assert.strictEqual(createdOrder.clientPoNumber, 'OC-45892', 'OC del cliente debe coincidir');
assert.strictEqual(createdOrder.ciscoSoNumber, 'SO-99201', 'SO de Cisco debe coincidir');
assert.strictEqual(createdOrder.bodegaDestino, 'E1', 'Hardware debe asignar bodega E1');
assert.strictEqual(createdOrder.currentStage, 'OC_RECEIVED', 'Etapa inicial debe ser OC_RECEIVED');
assert.strictEqual(createdOrder.totalSaleUsd, 25000, 'Total venta debe coincidir');
assert.strictEqual(createdOrder.grossProfitUsd, 5000, 'Margen bruto debe calcularse correctamente ($25000 - $20000)');
assert.strictEqual(createdOrder.marginPct, 20.0, 'Margen porcentual debe ser 20.0%');
assert.strictEqual(createdOrder.notes.length, 1, 'Debe incluir nota de registro inicial');
assert.strictEqual(createdOrder.notes[0].author, 'carlos_pm', 'Autor de la nota inicial debe coincidir');
console.log('✅ Creación de registro BO desde Estimate verificado al 100%.');

// ----------------------------------------------------------------------------
// Test 5: Simulación de Transición de Etapas y Adición de Guía FedEx
// ----------------------------------------------------------------------------
console.log('\n--- 5. Simulación de Transición de Etapa y Guía FedEx ---');

(async () => {
  // Inicializar caché con orden de prueba
  saveLocalBoTrackingCache([createdOrder]);

  const allBefore = await getBoTrackings();
  assert.strictEqual(allBefore.length, 1, 'Debe haber 1 orden en caché');

  // Avanzar a etapa SHIPPED_COURIER con guía FedEx
  const stageRes = await updateBoTrackingStage(
    createdOrder.id,
    'SHIPPED_COURIER',
    'operaciones_cisco',
    'Cisco confirmó despacho de fábrica'
  );
  assert.strictEqual(stageRes.success, true, 'Transición de etapa debe ser exitosa');

  const courierRes = await updateBoTrackingCourier(
    createdOrder.id,
    'FedEx',
    '779988112233',
    'operaciones_cisco'
  );
  assert.strictEqual(courierRes.success, true, 'Asignación de courier debe ser exitosa');

  // Agregar nota diaria
  const noteRes = await addBoDailyNote(
    createdOrder.id,
    'pm_cisco',
    'Paquete en tránsito entre Memphis y Miami'
  );
  assert.strictEqual(noteRes.success, true, 'Adición de nota debe ser exitosa');

  const allAfter = await getBoTrackings();
  const updated = allAfter.find((o) => o.id === createdOrder.id);
  assert.ok(updated, 'La orden debe existir');
  assert.strictEqual(updated.currentStage, 'SHIPPED_COURIER', 'Etapa debe ser SHIPPED_COURIER');
  assert.strictEqual(updated.courier, 'FedEx', 'Courier debe ser FedEx');
  assert.strictEqual(updated.courierTrackingNumber, '779988112233', 'Guía debe coincidir');
  assert.ok(
    updated.courierTrackingUrl?.includes('779988112233'),
    'URL de FedEx debe contener el número de guía'
  );
  assert.ok(updated.notes.length >= 3, 'Debe tener al menos 3 notas en bitácora');

  console.log('✅ Transiciones de etapa, actualización de FedEx y bitácora validadas exitosamente.');
  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE SEGUIMIENTO Y CICLO DE VIDA BO PASARON AL 100%!\n');
})();
