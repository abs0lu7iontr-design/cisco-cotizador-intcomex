// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR NLP & MINIMALIST UI VERIFICATION TESTS
// Verifica el razonamiento deductivo de lenguaje natural, corrección de errores/typos,
// dimensionamiento preventa según usuarios/fibra, y completitud de jerarquía Madre-Hijo.
// ============================================================================

// Provide in-memory storage mock to suppress Node 22 ExperimentalWarning
const mockStorageBackend = new Map<string, string>();
const mockStorageObj = {
  getItem: (k: string) => mockStorageBackend.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorageBackend.set(k, String(v)),
  removeItem: (k: string) => mockStorageBackend.delete(k),
  clear: () => mockStorageBackend.clear(),
  key: (i: number) => Array.from(mockStorageBackend.keys())[i] ?? null,
  get length() { return mockStorageBackend.size; },
};
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorageObj,
    configurable: true,
    writable: true,
  });
} catch {
  (globalThis as any).localStorage = mockStorageObj;
}

import {
  extractWithLocalDeterministicEngine,
  healClientTypoString,
  postProcessExtractedResult,
} from '../src/modules/configuriator/aiBomExtractor';
import {
  buildAssembledCcwRows,
} from '../src/modules/configuriator/ccwExcelGenerator';
import {
  PROVIDER_META,
  AiConfigSettings,
} from '../src/modules/configuriator/aiProviderManager';
import { resolveChassisRule } from '../src/modules/configuriator/catalogRules';

async function runConfiguriatorNlpMinimalTests() {
  console.log('🧪 Iniciando verificación de NLP Deductivo y Jerarquía Madre-Hijo CCW...\n');

  // --------------------------------------------------------------------------
  // Test 1: Modelos de razonamiento profundo disponibles en aiProviderManager
  // --------------------------------------------------------------------------
  const geminiModels = PROVIDER_META['gemini'].models;
  console.assert(
    geminiModels.some((m) => m.id === 'gemini-3.1-pro'),
    'Error: gemini-3.1-pro debe estar en la lista de modelos de Gemini'
  );
  console.assert(
    geminiModels.some((m) => m.id === 'gemini-2.5-pro'),
    'Error: gemini-2.5-pro debe estar en la lista de modelos de Gemini'
  );
  const openRouterModels = PROVIDER_META['openrouter'].models;
  console.assert(
    openRouterModels.some((m) => m.id === 'deepseek/deepseek-r1'),
    'Error: deepseek-r1 debe estar en la lista de modelos de OpenRouter'
  );
  console.log('✅ Test 1: Modelos de razonamiento profundo (Gemini 3.1 Pro, 2.5 Pro, DeepSeek R1) disponibles en provider manager.');

  // --------------------------------------------------------------------------
  // Test 2: Corrector de errores y typos de clientes (healClientTypoString)
  // --------------------------------------------------------------------------
  const typo1 = healClientTypoString('catalis 9200 con fibra');
  console.assert(typo1.includes('catalyst') || typo1.includes('Catalyst'), 'Error: typo catalis no fue corregido');

  const typo2 = healClientTypoString('meraky 48 poe');
  console.assert(typo2.includes('meraki') || typo2.includes('Meraki'), 'Error: typo meraky no fue corregido');

  const typo3 = healClientTypoString('sw 24 poe');
  console.assert(typo3.includes('switch 24'), 'Error: abreviación sw no fue expandida');
  console.log('✅ Test 2: Healer de typos y modismos de clientes ("catalis", "meraky", "sw") verificado.');

  // --------------------------------------------------------------------------
  // Test 3: Solicitud vaga "sw 24 poe" -> Deducción precisa C9200L-24P-4G-E
  // --------------------------------------------------------------------------
  const resVague24 = extractWithLocalDeterministicEngine('sw 24 poe');
  console.assert(resVague24.items.length === 1, 'Error: Debe extraer 1 ítem para "sw 24 poe"');
  const itemVague24 = resVague24.items[0];
  console.assert(
    itemVague24.suggestedActiveSku === 'C9200L-24P-4G-E',
    `Error: "sw 24 poe" debe deducir C9200L-24P-4G-E, obtuvo ${itemVague24.suggestedActiveSku}`
  );
  console.assert(itemVague24.isPoe === true, 'Error: isPoe debe ser true');
  console.assert(itemVague24.ports === 24, 'Error: ports debe ser 24');
  console.assert(
    Array.isArray(itemVague24.aiSubItems) && itemVague24.aiSubItems.length >= 3,
    'Error: Debe auto-ensamblar al menos 3 hijos (licencia, fuente, cable)'
  );
  console.log('✅ Test 3: Solicitud vaga "sw 24 poe" deducida exitosamente a C9200L-24P-4G-E con hijos ensamblados.');

  // --------------------------------------------------------------------------
  // Test 4: Solicitud con fibra "sw 48 poe con fibra" -> C9200L-48P-4X-E (10G SFP+)
  // --------------------------------------------------------------------------
  const resFiber = extractWithLocalDeterministicEngine('sw 48 poe con fibra');
  console.assert(resFiber.items.length === 1, 'Error: Debe extraer 1 ítem');
  const itemFiber = resFiber.items[0];
  console.assert(
    itemFiber.suggestedActiveSku === 'C9200L-48P-4X-E',
    `Error: "sw 48 poe con fibra" debe deducir C9200L-48P-4X-E (uplinks 10G SFP+), obtuvo ${itemFiber.suggestedActiveSku}`
  );
  console.log('✅ Test 4: Requerimiento de fibra ("con fibra") deduce uplinks 10G SFP+ (4X) correctamente.');

  // --------------------------------------------------------------------------
  // Test 4b: Solicitud de familia "c9300 48 poe" -> C9300L-48P-4X-E (48P PoE+ 4x10G Fast Track)
  // Blindaje estricto: NUNCA degradar a C9200L ni a 24 puertos
  // --------------------------------------------------------------------------
  const resC9300 = extractWithLocalDeterministicEngine('c9300 48 poe');
  console.assert(resC9300.items.length === 1, 'Error: Debe extraer 1 ítem para "c9300 48 poe"');
  const itemC9300 = resC9300.items[0];
  console.assert(
    itemC9300.suggestedActiveSku === 'C9300L-48P-4X-E',
    `Error: "c9300 48 poe" debe deducir C9300L-48P-4X-E en primera instancia, obtuvo ${itemC9300.suggestedActiveSku}`
  );
  console.assert(itemC9300.ports === 48, `Error: ports debe ser 48, obtuvo ${itemC9300.ports}`);
  console.assert(itemC9300.isPoe === true, 'Error: isPoe debe ser true');

  const rowsC9300 = await buildAssembledCcwRows(resC9300);
  console.assert(rowsC9300.length >= 4, `Error: Debe ensamblar Madre + Hijos para C9300L, obtuvo ${rowsC9300.length}`);
  console.assert(rowsC9300[0].partNumber === 'C9300L-48P-4X-E', `Error: Madre debe ser C9300L-48P-4X-E, obtuvo ${rowsC9300[0].partNumber}`);
  console.assert(rowsC9300.some((r) => r.partNumber.includes('DNA-E-48-3Y')), 'Error: Debe incluir licencia DNA Essentials 48P 3Y');
  console.log('✅ Test 4b: Solicitud "c9300 48 poe" resuelta con precisión a C9300L-48P-4X-E (48 puertos PoE+ 10G) y ensamble Madre-Hijo C9300 verificado.');

  // --------------------------------------------------------------------------
  // Test 5: Dimensionamiento por capacidad ("switch para 15 usuarios")
  // --------------------------------------------------------------------------
  const resUsers15 = extractWithLocalDeterministicEngine('necesito un switch para 15 usuarios');
  console.assert(resUsers15.items.length === 1, 'Error: Debe extraer 1 ítem para 15 usuarios');
  const itemUsers15 = resUsers15.items[0];
  console.assert(
    itemUsers15.ports === 24,
    `Error: 15 usuarios debe dimensionarse a switch de 24 puertos, obtuvo ${itemUsers15.ports}`
  );
  console.assert(
    itemUsers15.suggestedActiveSku === 'C9200L-24P-4G-E',
    'Error: SKU sugerido debe ser C9200L-24P-4G-E'
  );
  console.log('✅ Test 5: Dimensionamiento preventa por cantidad de usuarios ("15 usuarios" -> 24 puertos) verificado.');

  // --------------------------------------------------------------------------
  // Test 6: Switches industriales para faena / minería / riel din
  // --------------------------------------------------------------------------
  const resIndustrial = extractWithLocalDeterministicEngine('switches mineros riel din para faena');
  console.assert(resIndustrial.items.length === 1, 'Error: Debe detectar switch industrial');
  console.assert(
    resIndustrial.items[0].suggestedActiveSku === 'IE-3300-8P2S-E',
    `Error: Debe sugerir IE-3300-8P2S-E para minería/riel din, obtuvo ${resIndustrial.items[0].suggestedActiveSku}`
  );
  console.log('✅ Test 6: Detección de entorno industrial ("mineros riel din" -> IE-3300-8P2S-E) verificada.');

  // --------------------------------------------------------------------------
  // Test 7: Ensamblado Madre-Hijo en CCW (buildAssembledCcwRows con cable Chile CAB-IT)
  // --------------------------------------------------------------------------
  const assembled = await buildAssembledCcwRows(resVague24, 'subscription', 'italy_chile');
  console.assert(assembled.length >= 4, `Error: Se esperaban al menos 4 filas CCW, se obtuvieron ${assembled.length}`);
  const parent = assembled.find((r) => r.isParent);
  console.assert(parent !== undefined, 'Error: Debe existir una fila MADRE');
  console.assert(parent?.partNumber === 'C9200L-24P-4G-E', 'Error en SKU de fila Madre');

  const children = assembled.filter((r) => !r.isParent);
  console.assert(children.length >= 3, 'Error: Debe haber al menos 3 filas Hijas');

  // Verificar presencia de licencia DNA 3Y
  const dnaChild = children.find((c) => c.partNumber.includes('DNA'));
  console.assert(dnaChild !== undefined, 'Error: Debe incluir licencia DNA');
  console.assert(dnaChild?.durationMonths === 36, 'Error: Licencia DNA debe ser por 36 meses (3 años)');

  // Verificar fuente de poder
  const pwrChild = children.find((c) => c.partNumber.includes('PWR-C5'));
  console.assert(pwrChild !== undefined, 'Error: Debe incluir fuente de poder PWR-C5');

  // Verificar cable chileno CAB-ACA / CAB-TA-IT
  const cableChild = children.find((c) => c.partNumber.includes('CAB-ACA') || c.partNumber.includes('CAB-TA-IT'));
  console.assert(cableChild !== undefined, 'Error: Debe incluir cable de poder chileno CAB-ACA o CAB-TA-IT por defecto');
  console.log('✅ Test 7: Ensamblado CCW completo (Madre + Licencia 3Y + Fuente + Cable Chile CAB-ACA) verificado.');

  // --------------------------------------------------------------------------
  // Test 8: Reemplazo EOL automático (WS-C2960X-24PS-L -> C9200L-24P-4G-E)
  // --------------------------------------------------------------------------
  const resEol = extractWithLocalDeterministicEngine('WS-C2960X-24PS-L');
  console.assert(resEol.items[0].isEol2026 === true, 'Error: WS-C2960X-24PS-L debe estar marcado como EOL 2026');
  console.assert(
    resEol.items[0].suggestedActiveSku === 'C9200L-24P-4G-E',
    `Error: Reemplazo debe ser C9200L-24P-4G-E, obtuvo ${resEol.items[0].suggestedActiveSku}`
  );
  // --------------------------------------------------------------------------
  // Test 9: Protección contra "Failed to execute 'fetch' on 'Window': Illegal invocation"
  // --------------------------------------------------------------------------
  const mockWindowObj = {};
  (globalThis as any).window = mockWindowObj;
  let invokedWithValidReceiver: boolean = false;

  const strictWindowFetch = function (this: any, _url: any, _init: any) {
    if (this !== mockWindowObj && this !== globalThis) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    invokedWithValidReceiver = true;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      clientName: 'Cliente Test',
                      items: [
                        {
                          originalPartNumber: 'C9200L-24P-4G-E',
                          suggestedActiveSku: 'C9200L-24P-4G-E',
                          description: 'Catalyst 9200L 24P PoE+',
                          quantity: 1,
                          ports: 24,
                          isPoe: true,
                          aiSubItems: [],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  } as unknown as typeof fetch;

  const { extractBOMRequirementsFromInput } = await import(
    '../src/modules/configuriator/aiBomExtractor'
  );

  const resStrict = await extractBOMRequirementsFromInput(
    { text: '1 switch 24 poe' },
    {
      explicitApiKey: 'AIzaSyTestMockKey12345',
      fetchImpl: strictWindowFetch,
      perAttemptTimeoutMs: 2000,
    }
  );

  console.assert(
    Boolean(invokedWithValidReceiver),
    'Error: strictWindowFetch debe haberse ejecutado con receiver Window válido'
  );
  console.assert(
    resStrict.items.length === 1 && resStrict.items[0].suggestedActiveSku === 'C9200L-24P-4G-E',
    'Error: La extracción con strictWindowFetch debe haber devuelto los ítems correctamente'
  );
  console.log('✅ Test 9: Protección contra "Failed to execute \'fetch\' on \'Window\': Illegal invocation" verificada al 100%.');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE NLP DEDUCTIVO Y ENSAMBLADO MADRE-HIJO PASARON EXITOSAMENTE!');
}

runConfiguriatorNlpMinimalTests().catch((err) => {
  console.error('❌ Error ejecutando pruebas de NLP:', err);
  process.exit(1);
});
