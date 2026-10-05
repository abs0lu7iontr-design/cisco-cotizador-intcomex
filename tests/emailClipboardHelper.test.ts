// ============================================================================
// CISCO AUTOMATED v2.1 - OUTLOOK EMAIL SUMMARY & GREETING TEST SUITE
// ============================================================================

import assert from 'node:assert';
import {
  getTimeBasedGreeting,
  generateEstimateEmailHtml,
  generateEstimatePlainText,
  copyEstimateEmailSummaryToClipboard,
} from '../src/core/emailClipboardHelper';
import { ProcessedEstimateResult } from '../src/core/types';

console.log('🧪 INICIANDO SUITE DE PRUEBAS DEL RESUMEN PARA CORREO Y SALUDO DINÁMICO (CISCO AUTOMATED v2.1)...\n');

// ----------------------------------------------------------------------------
// Test 1: Saludo dinámico según la hora (Buenos días < 12:00 vs Buenas tardes >= 12:00)
// ----------------------------------------------------------------------------
console.log('--- 1. Validación de Saludo Dinámico por Hora ---');

const morning1 = new Date(2026, 9, 5, 8, 30, 0);
const morning2 = new Date(2026, 9, 5, 11, 59, 59);
assert.strictEqual(getTimeBasedGreeting(morning1), 'Buenos días', '8:30 AM debe ser Buenos días');
assert.strictEqual(getTimeBasedGreeting(morning2), 'Buenos días', '11:59:59 AM debe ser Buenos días');

const noon = new Date(2026, 9, 5, 12, 0, 0);
const afternoon = new Date(2026, 9, 5, 15, 45, 0);
const night = new Date(2026, 9, 5, 23, 59, 0);
assert.strictEqual(getTimeBasedGreeting(noon), 'Buenas tardes', '12:00 PM debe ser Buenas tardes');
assert.strictEqual(getTimeBasedGreeting(afternoon), 'Buenas tardes', '15:45 PM debe ser Buenas tardes');
assert.strictEqual(getTimeBasedGreeting(night), 'Buenas tardes', '23:59 PM debe ser Buenas tardes');

const defaultGreeting = getTimeBasedGreeting();
assert.ok(
  defaultGreeting === 'Buenos días' || defaultGreeting === 'Buenas tardes',
  'El saludo por defecto debe ser válido según la hora actual'
);
console.log('✅ Saludo dinámico por horario verificado correctamente (Buenos días < 12:00 / Buenas tardes >= 12:00).');

// ----------------------------------------------------------------------------
// Test 2: Generación de Plantilla HTML Oficial para Outlook / Gmail
// ----------------------------------------------------------------------------
console.log('\n--- 2. Validación de Plantilla HTML para Outlook ---');

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
  calculatedProductTotal: 12500,
  originalProductTotal: 10000,
  serviceTotal: 0,
  subscriptionTotal: 0,
  finalTotalPrice: 12500,
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

const fixedMorning = new Date(2026, 9, 5, 9, 30, 0);
const htmlMorning = generateEstimateEmailHtml(mockEstimate, 'Sonda Chile', fixedMorning);

assert.ok(htmlMorning.includes('Buenos días,'), 'HTML matutino debe contener "Buenos días,"');
assert.ok(htmlMorning.includes('DEAL-998877'), 'HTML debe incluir Deal ID');
assert.ok(htmlMorning.includes('OE169047114NP (v1)'), 'HTML debe incluir Estimate ID con tag de versión (v1)');
assert.ok(htmlMorning.includes('Sonda Chile'), 'HTML debe incluir Reseller/Partner');
assert.ok(htmlMorning.includes('Banco Santander'), 'HTML debe incluir Cliente Final');
assert.ok(htmlMorning.includes('C9300-48P-A'), 'HTML debe listar el part number');
assert.ok(htmlMorning.includes('$12,500.00 USD'), 'HTML debe mostrar total neto cotizado');
assert.ok(htmlMorning.includes('Validez de la oferta: 30 días'), 'HTML debe incluir condiciones comerciales');
assert.ok(htmlMorning.includes('Distribuidor Mayorista Autorizado Cisco'), 'HTML debe incluir firma de Intcomex Chile');

const fixedAfternoon = new Date(2026, 9, 5, 14, 15, 0);
const htmlAfternoon = generateEstimateEmailHtml(mockEstimate, 'Sonda Chile', fixedAfternoon);
assert.ok(htmlAfternoon.includes('Buenas tardes,'), 'HTML vespertino debe contener "Buenas tardes,"');

console.log('✅ Plantilla HTML con compatibilidad Outlook verificada exitosamente.');

// ----------------------------------------------------------------------------
// Test 3: Generación de Texto Plano Tabulado (Fallback)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Validación de Fallback en Texto Plano ---');

const plainText = generateEstimatePlainText(mockEstimate, 'Sonda Chile', fixedMorning);
assert.ok(plainText.includes('Buenos días,'), 'Texto plano matutino debe comenzar con "Buenos días,"');
assert.ok(plainText.includes('Deal ID: DEAL-998877 | Estimate ID: OE169047114NP (v1)'), 'Texto plano debe incluir encabezado estructurado');
assert.ok(plainText.includes('C9300-48P-A'), 'Texto plano debe incluir SKU');
assert.ok(plainText.includes('$12,500.00 USD'), 'Texto plano debe incluir monto total');
assert.ok(plainText.includes('Equipo Cisco • Intcomex Chile'), 'Texto plano debe incluir pie de firma');

console.log('✅ Fallback de texto plano verificado exitosamente.');

// ----------------------------------------------------------------------------
// Test 4: Función de Escritura al Portapapeles (Fallback seguro sin excepciones)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Validación de Escritura al Portapapeles ---');

// En entorno Node.js sin DOM, copyEstimateEmailSummaryToClipboard debe atrapar y retornar boolean
copyEstimateEmailSummaryToClipboard(mockEstimate, 'Sonda Chile')
  .then((res) => {
    assert.strictEqual(typeof res, 'boolean', 'Debe retornar un valor booleano');
    console.log('✅ Manejo de portapapeles y captura de errores verificado.');
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE RESUMEN DE CORREO Y SALUDO PASARON AL 100%!\n');
  })
  .catch((err) => {
    console.error('Error inesperado en portapapeles:', err);
    process.exit(1);
  });
