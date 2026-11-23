// ============================================================================
// TEST: CISCO MODERN COMMERCE GRAPHQL API INTEGRATION & LEAD TIME EXTRACTION
// Valida la conversión de respuestas GraphQL de Cisco (it-developer.cisco.com)
// incluyendo la jerarquía Madre-Hijo, el Lead Time por ítem y el Lead Time máximo.
// ============================================================================

import assert from 'node:assert/strict';
import {
  convertCiscoEstimateToProcessedResult,
  fetchEstimateFromCiscoApi,
} from '../src/modules/ciscoApi/ciscoCommerceService';
import { CiscoGraphQLEstimate } from '../src/modules/ciscoApi/types';

console.log('🧪 INICIANDO TEST: Cisco Modern Commerce GraphQL API & Lead Time...\n');

async function runTests() {
  // Test 1: Conversión de respuesta oficial de Cisco GraphQL a ProcessedEstimateResult
  console.log('▶ Test 1: Mapeo de Estimate GraphQL con líneas Madre-Hijo y Lead Time');

  // Payload idéntico al documentado oficialmente en Cisco Modern Commerce
  const mockGqlEstimate: CiscoGraphQLEstimate = {
    id: 'OI161111385UO',
    name: 'Estimate_OI161111385UO',
    estimateStatus: 'VALID',
    expirationDate: '2026-08-30',
    priceList: {
      code: 'GLUS',
      description: 'Global Price List US Availability',
      currencies: ['USD'],
    },
    lines: [
      {
        line: {
          configurationLineReference: {
            lineId: 113247576387,
            parentLineId: 0, // Línea Madre
            magicKey: 'E503d39b0-bb5a-4783-8f55-237c53e78bfa',
          },
          item: {
            sku: 'WS-C3560CX-8PT-S',
            description: 'Cisco Catalyst 3560-CX PD PSE 8 Port PoE, 1G Uplinks IP Base',
            leadTime: {
              measurement: 14,
              unitOfMeasure: 'Day(s)',
            },
          },
          quantity: {
            measurement: 1,
            unitOfMeasure: 'ea',
          },
          financialDetails: {
            unitListPrice: { amount: 2643.59, currency: 'USD' },
            discounts: [{ rate: { measurement: 42, unitOfMeasure: 'Percentage(%)' } }],
            unitNetPrice: { amount: 1533.28, currency: 'USD' },
            extendedNetPrice: { amount: 1533.28, currency: 'USD' },
          },
        },
      },
      {
        line: {
          configurationLineReference: {
            lineId: 113403906728,
            parentLineId: 113247576387, // Línea Hija 1
            magicKey: 'Eb1b0f38d-725a-43a2-951b-cd5316aab6e8',
          },
          item: {
            sku: 'CAB-AC2',
            description: 'AC Power cord North America',
            leadTime: {
              measurement: 7,
              unitOfMeasure: 'Day(s)',
            },
          },
          quantity: {
            measurement: 1,
            unitOfMeasure: 'ea',
          },
          financialDetails: {
            unitListPrice: { amount: 0, currency: 'USD' },
            discounts: [{ rate: { measurement: 42, unitOfMeasure: 'Percentage(%)' } }],
            unitNetPrice: { amount: 0, currency: 'USD' },
            extendedNetPrice: { amount: 0, currency: 'USD' },
          },
        },
      },
      {
        line: {
          configurationLineReference: {
            lineId: 113403906729,
            parentLineId: 113247576387, // Línea Hija 2
            magicKey: 'Eace83887-1afc-417c-ae21-a94ddf309737',
          },
          item: {
            sku: 'PSU-L-80W-ADPT',
            description: 'Slim 80W power adaptor for micro and compact switches',
            leadTime: {
              measurement: 21,
              unitOfMeasure: 'Day(s)',
            },
          },
          quantity: {
            measurement: 1,
            unitOfMeasure: 'ea',
          },
          financialDetails: {
            unitListPrice: { amount: 128.43, currency: 'USD' },
            discounts: [{ rate: { measurement: 42, unitOfMeasure: 'Percentage(%)' } }],
            unitNetPrice: { amount: 74.49, currency: 'USD' },
            extendedNetPrice: { amount: 74.49, currency: 'USD' },
          },
        },
      },
    ],
  };

  const conversion = convertCiscoEstimateToProcessedResult(mockGqlEstimate, {
    partnerFallback: 'Sonda Chile',
    clientFallback: 'Banco Santander',
  });

  const res = conversion.result;
  assert.strictEqual(res.headerInfo.estimateId, 'OI161111385UO', 'Estimate ID debe coincidir');
  assert.strictEqual(res.headerInfo.customerName, 'Sonda Chile', 'Partner debe ser Sonda Chile');
  assert.strictEqual(res.headerInfo.companyName, 'Banco Santander', 'Cliente final debe ser Banco Santander');
  assert.strictEqual(res.items.length, 3, 'Debe haber 3 ítems mapeados');

  // Jerarquía
  assert.strictEqual(res.items[0].lineNumber, '1.0', 'Switch principal debe ser 1.0 (Línea Madre)');
  assert.strictEqual(res.items[1].lineNumber, '1.0.1', 'Cable debe ser 1.0.1 (Hijo 1)');
  assert.strictEqual(res.items[2].lineNumber, '1.0.2', 'Adaptador debe ser 1.0.2 (Hijo 2)');

  // Lead Times (aplicando la regla oficial de tránsito de Intcomex Chile: Math.ceil(días/7) + 2 semanas de tránsito)
  assert.strictEqual(res.items[0].originalLeadTimeDays, 14);
  assert.strictEqual(res.items[0].transformedLeadTime, '4 a 5 semanas a pedido');
  assert.strictEqual(res.items[1].originalLeadTimeDays, 7);
  assert.strictEqual(res.items[1].transformedLeadTime, '4 semanas a pedido');
  assert.strictEqual(res.items[2].originalLeadTimeDays, 21);
  assert.strictEqual(res.items[2].transformedLeadTime, '5 semanas a pedido');

  // Lead Time Máximo de la Solución (Regla: The Longest Line Wins)
  assert.strictEqual(conversion.maxLeadTimeDays, 21, 'El tiempo máximo debe ser 21 días');
  assert.strictEqual(conversion.maxLeadTimeFormatted, '5 semanas a pedido', 'El tiempo máximo formateado debe ser 5 semanas a pedido');

  // Finanzas
  assert.ok(res.calculatedProductTotal > 0, 'Total calculado debe ser mayor a cero');
  assert.strictEqual(res.items[0].netCiscoUnit, 1533.28);

  console.log('  ✅ Jerarquía Madre-Hijo y numeración multinivel calculadas con éxito.');
  console.log('  ✅ Extracción de Lead Time por componente y Lead Time global de orden validados.\n');

  // Test 2: Validación de entrada para IDs vacíos
  console.log('▶ Test 2: Validación de manejo de errores en fetchEstimateFromCiscoApi');
  const emptyRes = await fetchEstimateFromCiscoApi('   ');
  assert.strictEqual(emptyRes.success, false);
  assert.ok(emptyRes.error?.includes('válido'));
  console.log('  ✅ Rechazo correcto ante IDs vacíos.\n');

  console.log('🏆 Todas las pruebas de Cisco Modern Commerce GraphQL API pasaron al 100%.\n');
}

runTests().catch((err) => {
  console.error('❌ Error en test suite de Cisco Modern Commerce:', err);
  process.exit(1);
});
