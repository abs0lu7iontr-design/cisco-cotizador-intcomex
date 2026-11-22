// ============================================================================
// CISCO AUTOMATED - TEST SUITE: MOBILE SHARE HELPER & CLIENT DATA PRIVACY
// Validates that customer-facing share text never leaks confidential margin info
// and does not duplicate URLs.
// ============================================================================

import assert from 'node:assert/strict';
import { formatQuoteShareText, shareQuote, ShareQuoteData } from '../src/utils/mobileShareHelper';

console.log('🧪 INICIANDO TEST: mobileShareHelper & Confidencialidad de Margen Comercial...\n');

async function runTests() {
  // Test 1: formatQuoteShareText nunca debe exponer Margen Objetivo
  console.log('▶ Test 1: Verificación de exclusión estricta de Margen Objetivo en resumen comercial');
  const testDataWithMargin: ShareQuoteData = {
    clientName: 'Apronta',
    partnerName: 'Sonda',
    dealId: 'DEAL-12345',
    itemsCount: 1,
    totalUsd: 12377.55,
    totalClp: 11500000,
    marginPct: 5, // Pasado intencionalmente
  };

  const output = formatQuoteShareText(testDataWithMargin);

  assert.ok(output.includes('👤 *Cliente Final:* Apronta'), 'Debe incluir Cliente Final');
  assert.ok(output.includes('🤝 *Partner / Reseller:* Sonda'), 'Debe incluir Partner');
  assert.ok(output.includes('🎯 *Deal ID:* DEAL-12345'), 'Debe incluir Deal ID');
  assert.ok(output.includes('📦 *Líneas Cotizadas:* 1'), 'Debe incluir Líneas');
  assert.ok(output.includes('💵 *Total Venta USD:* US$ 12,377.55'), 'Debe formatear monto USD');
  assert.ok(output.includes('🇨🇱 *Total Venta CLP:* $11.500.000 CLP'), 'Debe formatear CLP');

  // Aserción crítica: NO debe contener Margen ni Margen Objetivo
  assert.strictEqual(
    output.includes('Margen'),
    false,
    'El resumen para cliente NUNCA debe contener la palabra Margen'
  );
  assert.strictEqual(
    output.includes('Margen Objetivo'),
    false,
    'El resumen para cliente NUNCA debe contener "Margen Objetivo"'
  );
  assert.strictEqual(
    output.includes('5%'),
    false,
    'El resumen no debe exponer el porcentaje de margen interno'
  );

  // Aserción de URL única (sin duplicados)
  const urlMatches = output.match(/https:\/\/develop\.cisco-automated\.pages\.dev/g);
  assert.strictEqual(urlMatches?.length, 1, 'Debe haber exactamente 1 URL en el texto');

  console.log('  ✅ Margen Objetivo correctamente excluido y protegido contra fugas a clientes.');
  console.log('  ✅ Formato de URL verificado como único y limpio.\n');

  // Test 2: Fallback al portapapeles cuando Web Share API no está disponible
  console.log('▶ Test 2: Verificación de copia en portapapeles sin duplicación de URL ni márgenes');
  let copiedClipboardText = '';
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: async (text: string) => {
          copiedClipboardText = text;
        },
      },
    },
    configurable: true,
    writable: true,
  });

  const shareResult = await shareQuote(testDataWithMargin);
  assert.strictEqual(shareResult.shared, true);
  assert.strictEqual(shareResult.method, 'clipboard');
  assert.ok(
    !copiedClipboardText.includes('Margen'),
    'El texto copiado al portapapeles no debe contener Margen'
  );
  assert.ok(
    copiedClipboardText.includes('US$ 12,377.55'),
    'El texto copiado al portapapeles debe contener el Total Venta USD'
  );

  console.log('  ✅ Copia en portapapeles comprobada exitosamente sin datos confidenciales.\n');

  // Test 3: Web Share API nativa no envía url duplicada
  console.log('▶ Test 3: Verificación de llamada a navigator.share sin parámetro url redundante');
  let capturedSharePayload: any = null;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      share: async (payload: any) => {
        capturedSharePayload = payload;
      },
    },
    configurable: true,
    writable: true,
  });

  const nativeResult = await shareQuote(testDataWithMargin);
  assert.strictEqual(nativeResult.shared, true);
  assert.strictEqual(nativeResult.method, 'native_share');
  assert.strictEqual(
    capturedSharePayload.url,
    undefined,
    'No debe enviar url separada para evitar duplicar https://develop.cisco-automated.pages.dev en WhatsApp'
  );
  assert.ok(
    capturedSharePayload.text.includes('https://develop.cisco-automated.pages.dev'),
    'El texto ya incluye la URL institucional'
  );

  console.log('  ✅ Web Share API invocado limpiamente sin duplicación de enlace.\n');

  console.log('🏆 Todas las pruebas de mobileShareHelper pasaron satisfactoriamente (100%).\n');
}

runTests().catch((err) => {
  console.error('❌ Error en suite de pruebas mobileShareHelper:', err);
  process.exit(1);
});
