// ============================================================================
// TEST: CISCO ORDER TRACKING & FULFILLMENT API (READ-ONLY)
// Valida la normalización de etapas BO, couriers, guías de despacho,
// fechas estimadas de entrega (ETA +14d) y números de serie físicos.
// ============================================================================

import assert from 'node:assert/strict';
import {
  mapCiscoStatusToBoStage,
  mapCiscoCarrierToCourierProvider,
  parseCiscoOrderResponse,
  fetchOrderDetailsFromCiscoApi,
} from '../src/modules/ciscoApi/ciscoOrdersService';

console.log('🧪 INICIANDO TEST: Cisco Order Tracking & Fulfillment API...\n');

async function runTests() {
  // Test 1: Mapeo de estados de fábrica y ERP de Cisco a etapas BO oficiales
  console.log('▶ Test 1: Mapeo de Estados Cisco a Etapas BO');
  assert.strictEqual(mapCiscoStatusToBoStage('BOOKED'), 'CISCO_SO_BOOKED');
  assert.strictEqual(mapCiscoStatusToBoStage('CONFIRMED'), 'CISCO_SO_BOOKED');
  assert.strictEqual(mapCiscoStatusToBoStage('IN_PRODUCTION'), 'IN_PRODUCTION');
  assert.strictEqual(mapCiscoStatusToBoStage('ASSEMBLY'), 'IN_PRODUCTION');
  assert.strictEqual(mapCiscoStatusToBoStage('SHIPPED'), 'SHIPPED_COURIER');
  assert.strictEqual(mapCiscoStatusToBoStage('IN TRANSIT'), 'SHIPPED_COURIER');
  assert.strictEqual(mapCiscoStatusToBoStage('DELIVERED'), 'DELIVERED');
  assert.strictEqual(mapCiscoStatusToBoStage('CLOSED'), 'DELIVERED');
  console.log('  ✅ Estados de fábrica y tránsito mapeados a etapas BO con 100% de precisión.');

  // Test 2: Mapeo de Couriers oficiales
  console.log('\n▶ Test 2: Normalización de Transportistas (Carrier a CourierProvider)');
  assert.strictEqual(mapCiscoCarrierToCourierProvider('Federal Express'), 'FedEx');
  assert.strictEqual(mapCiscoCarrierToCourierProvider('FedEx Express International'), 'FedEx');
  assert.strictEqual(mapCiscoCarrierToCourierProvider('UPS Worldwide Saver'), 'UPS');
  assert.strictEqual(mapCiscoCarrierToCourierProvider('DHL Express'), 'DHL');
  assert.strictEqual(mapCiscoCarrierToCourierProvider('DB Schenker Logistics'), 'Otro');
  assert.strictEqual(mapCiscoCarrierToCourierProvider(''), 'Otro');
  console.log('  ✅ Transportistas reconocidos y clasificados a CourierProvider.');

  // Test 3: Parseo de respuesta completa de orden Cisco con tracking y números de serie
  console.log('\n▶ Test 3: Parseo y Enriquecimiento de Orden Cisco');
  const mockCiscoOrder = {
    orderNumber: 'SO-1298457',
    customerPoNumber: 'OC-INT-889922',
    orderStatus: 'SHIPPED',
    orderDate: '2026-11-20',
    carrier: 'FedEx Express',
    trackingNumber: '771234567890',
    estimatedShipDate: '2026-11-21',
    actualShipDate: '2026-11-21',
    lines: [
      {
        lineNumber: '1.0',
        item: {
          sku: 'C9300-48P-A',
          description: 'Catalyst 9300 48-port PoE+, Network Advantage',
        },
        quantity: 2,
        fulfillment: {
          carrier: 'FedEx Express',
          trackingNumber: '771234567890',
          shipmentStatus: 'SHIPPED',
          serialNumbers: ['FOC243201AA', 'FOC243201AB'],
        },
      },
      {
        lineNumber: '1.0.1',
        item: {
          sku: 'PWR-C1-715WAC-P',
          description: '715W AC 80+ Platinum Config 1 Power Supply',
        },
        quantity: 2,
        fulfillment: {
          carrier: 'FedEx Express',
          trackingNumber: '771234567890',
          shipmentStatus: 'SHIPPED',
          serialNumbers: ['LIT243900ZZ', 'LIT243901ZZ'],
        },
      },
    ],
  };

  const parsed = parseCiscoOrderResponse(mockCiscoOrder);

  assert.strictEqual(parsed.orderNumber, 'SO-1298457');
  assert.strictEqual(parsed.customerPoNumber, 'OC-INT-889922');
  assert.strictEqual(parsed.mappedStage, 'SHIPPED_COURIER');
  assert.strictEqual(parsed.courierProvider, 'FedEx');
  assert.strictEqual(parsed.trackingNumber, '771234567890');
  assert.strictEqual(
    parsed.trackingUrl,
    'https://www.fedex.com/fedextrack/?trknbr=771234567890',
    'Debe generar la URL oficial de tracking en FedEx'
  );
  assert.strictEqual(parsed.lines.length, 2);
  assert.deepStrictEqual(parsed.lines[0].serialNumbers, ['FOC243201AA', 'FOC243201AB']);
  assert.strictEqual(parsed.estimatedArrivalDate, '2026-12-05', 'ETA en Chile debe ser ASD + 14 días');
  console.log('  ✅ Extracción de cabecera, URL de tracking en vivo y números de serie físicos validada.');

  // Test 4: Manejo de entrada inválida
  console.log('\n▶ Test 4: Manejo de Errores con Orden Vacía');
  const emptyRes = await fetchOrderDetailsFromCiscoApi('');
  assert.strictEqual(emptyRes.success, false);
  assert.match(emptyRes.error || '', /número de Sales Order/i);
  console.log('  ✅ Rechazo determinista ante parámetros vacíos.');

  console.log('\n🏆 Todas las pruebas de Cisco Order Tracking pasaron al 100%!\n');
}

runTests().catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
