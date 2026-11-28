// ============================================================================
// SUITE DE PRUEBAS: FEDEX TRACK API AUTO-SYNC & MAPEO LOGÍSTICO CHILE
// Valida:
// 1. Mapeo determinista de hitos FedEx -> BoStage (Courier, Hub Miami, Aduana Chile, Bodega ENEA)
// 2. Protección monotónica (nunca retrocede etapas ni cierra automáticamente a DELIVERED)
// 3. Deduplicación de notas automáticas en bitácora (`[FedEx:eventKey]`)
// 4. Actualización automática de ETA y fecha real de llegada
// ============================================================================

import assert from 'node:assert/strict';
import {
  mapFedExTrackResultToBoStage,
  applyFedExUpdateToOrder,
  FedExTrackResult,
} from '../src/modules/bo/fedexTrackingService';
import { BoOrderTrackingRecord } from '../src/modules/bo/boTrackingTypes';

function makeOrder(overrides: Partial<BoOrderTrackingRecord> = {}): BoOrderTrackingRecord {
  return {
    id: 'BO-TEST-FEDEX-1',
    estimateId: 'LX169026572SA',
    estimateVersionTag: 'v1',
    dealId: '86491928',
    partnerName: 'infostore',
    endCustomerName: 'Codelco',
    clientPoNumber: 'P025635',
    courier: 'FedEx',
    courierTrackingNumber: '538951481730',
    courierTrackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=538951481730',
    currentStage: 'OC_RECEIVED',
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
    totalSaleUsd: 8138,
    grossProfitUsd: 900,
    itemsCount: 3,
    bodegaDestino: 'E1',
    notes: [],
    ...overrides,
  };
}

function makeTrack(overrides: Partial<FedExTrackResult> = {}): FedExTrackResult {
  return {
    trackingNumber: '538951481730',
    found: true,
    statusCode: 'IT',
    statusDescription: 'En tránsito',
    locationLabel: 'MEMPHIS, TN, US',
    city: 'MEMPHIS',
    stateOrProvince: 'TN',
    countryCode: 'US',
    estimatedDeliveryDate: '2026-11-30',
    lastScanTimestamp: '2026-11-27T14:20:00Z',
    events: [],
    ...overrides,
  };
}

console.log('\n🧪 Iniciando Suite de Pruebas: FedEx Tracking Auto-Sync...');

// 1. Mapeo de etapas logísticas FedEx -> Intcomex Chile
assert.equal(mapFedExTrackResultToBoStage(makeTrack()), 'SHIPPED_COURIER');
assert.equal(
  mapFedExTrackResultToBoStage(
    makeTrack({ statusCode: 'AR', locationLabel: 'MIAMI, FL, US', city: 'MIAMI', stateOrProvince: 'FL' })
  ),
  'MIAMI_FORWARDER'
);
assert.equal(
  mapFedExTrackResultToBoStage(
    makeTrack({
      statusCode: 'CD',
      statusDescription: 'Liberación de aduana en proceso',
      locationLabel: 'SANTIAGO, RM, CL',
      city: 'SANTIAGO',
      stateOrProvince: 'RM',
      countryCode: 'CL',
    })
  ),
  'CUSTOMS_CLEARANCE'
);
assert.equal(
  mapFedExTrackResultToBoStage(
    makeTrack({
      statusCode: 'DL',
      statusDescription: 'Delivered',
      locationLabel: 'PUDAHUEL, RM, CL',
      city: 'PUDAHUEL',
      stateOrProvince: 'RM',
      countryCode: 'CL',
      actualDeliveryDate: '2026-11-29',
    })
  ),
  'INTCOMEX_WAREHOUSE',
  'Entrega física en Chile debe mapear a INTCOMEX_WAREHOUSE (sin cerrar comercialmente a DELIVERED)'
);

// 2. Avance automático de etapa + ETA + nota única (sin duplicar al re-ejecutar polling)
const order0 = makeOrder({ currentStage: 'OC_RECEIVED' });
const trackMiami = makeTrack({
  statusCode: 'AR',
  statusDescription: 'Arrived at FedEx hub',
  locationLabel: 'MIAMI, FL, US',
  city: 'MIAMI',
  stateOrProvince: 'FL',
  estimatedDeliveryDate: '2026-12-02',
  lastScanTimestamp: '2026-11-27T18:00:00Z',
});

const pass1 = applyFedExUpdateToOrder(order0, trackMiami, '2026-11-27T18:05:00Z');
assert.equal(pass1.changed, true);
assert.equal(pass1.stageAdvanced, true);
assert.equal(pass1.noteAdded, true);
assert.equal(pass1.updatedOrder.currentStage, 'MIAMI_FORWARDER');
assert.equal(pass1.updatedOrder.estimatedArrivalDate, '2026-12-02');
assert.equal(pass1.updatedOrder.notes.length, 1);

// Re-polling exact same FedEx event must be idempotent (no duplicate notes)
const pass2 = applyFedExUpdateToOrder(pass1.updatedOrder, trackMiami, '2026-11-27T18:20:00Z');
assert.equal(pass2.changed, false);
assert.equal(pass2.noteAdded, false);
assert.equal(pass2.updatedOrder.notes.length, 1);

// 3. Monotonic guard: manual advance to CUSTOMS_CLEARANCE must NOT regress back to MIAMI_FORWARDER
const manualCustomsOrder = makeOrder({ currentStage: 'CUSTOMS_CLEARANCE', notes: [] });
const pass3 = applyFedExUpdateToOrder(manualCustomsOrder, trackMiami, '2026-11-27T18:25:00Z');
assert.equal(pass3.stageAdvanced, false);
assert.equal(pass3.updatedOrder.currentStage, 'CUSTOMS_CLEARANCE');

console.log('✅ Todas las pruebas de FedEx Track API Auto-Sync pasaron al 100%!');
