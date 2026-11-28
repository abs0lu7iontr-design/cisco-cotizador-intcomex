// ============================================================================
// CISCO AUTOMATED v2.16.0 - PREVENTA IA & COMPETITOR HOMOLOGATION TEST SUITE
// Verifica el rebranding a "Preventa IA", la detección de marcas competidoras
// (Aruba, Fortinet, Huawei, Dell, Juniper, Ubiquiti, etc.), la comparativa
// técnica de 10 aspectos relevantes y la preservación del % de homologación.
// ============================================================================

import assert from 'node:assert/strict';

// Provide in-memory storage mock to suppress Node 22 ExperimentalWarning
const mockStorageBackend = new Map<string, string>();
const mockStorageObj = {
  getItem: (k: string) => mockStorageBackend.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorageBackend.set(k, String(v)),
  removeItem: (k: string) => mockStorageBackend.delete(k),
  clear: () => mockStorageBackend.clear(),
  key: (i: number) => Array.from(mockStorageBackend.keys())[i] ?? null,
  get length() {
    return mockStorageBackend.size;
  },
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
  detectCompetitorEquipment,
  generateHomologationComparison,
  COMPETITOR_HOMOLOGATION_CATALOG,
  CISCO_SPECS_DATABASE,
} from '../src/modules/configuriator/competitorHomologationRules';
import {
  extractWithLocalDeterministicEngine,
  postProcessExtractedResult,
} from '../src/modules/configuriator/aiBomExtractor';

console.log('🧪 Iniciando Suite de Pruebas: Preventa IA & Comparativa de Homologación (v2.16.0)...');

// ----------------------------------------------------------------------------
// Test 1: Catálogo de Competidores y Mapeo a Cisco 2026
// ----------------------------------------------------------------------------
console.log('  Testing Competitor Catalog & Cisco Mappings...');
assert.ok(COMPETITOR_HOMOLOGATION_CATALOG.length >= 15, 'El catálogo debe contener al menos 15 modelos de competidores');

const arubaEntry = COMPETITOR_HOMOLOGATION_CATALOG.find((e) => e.aliases.includes('JL726A'));
assert.ok(arubaEntry, 'Debe existir la entrada de Aruba CX 6200F 24G PoE+ (JL726A)');
assert.equal(arubaEntry?.recommendedCiscoSku, 'C9200L-24P-4X-E', 'Aruba JL726A debe homologar a C9200L-24P-4X-E');
assert.equal(arubaEntry?.homologationPct, 100, 'Aruba JL726A debe tener 100% de homologación');

const fortigateEntry = COMPETITOR_HOMOLOGATION_CATALOG.find((e) => e.aliases.includes('FG-60F'));
assert.ok(fortigateEntry, 'Debe existir la entrada de FortiGate 60F');
assert.equal(fortigateEntry?.recommendedCiscoSku, 'FPR1010-NGFW-K9', 'FG-60F debe homologar a FPR1010-NGFW-K9');

const huaweiEntry = COMPETITOR_HOMOLOGATION_CATALOG.find((e) => e.aliases.includes('S5735-L48P4X'));
assert.ok(huaweiEntry, 'Debe existir la entrada de Huawei S5735-L48P4X');
assert.equal(huaweiEntry?.recommendedCiscoSku, 'C9200L-48P-4X-E', 'Huawei 48P debe homologar a C9200L-48P-4X-E');

console.log('  ✅ Test 1: Catálogo y equivalencias oficiales de competidores verificadas.');

// ----------------------------------------------------------------------------
// Test 2: Detección Automática de Equipos Rivales (Exacta y Heurística)
// ----------------------------------------------------------------------------
console.log('  Testing Automatic Competitor Equipment Detection...');

// 2.1 Por SKU exacto o alias
const detAruba = detectCompetitorEquipment('JL726A');
assert.equal(detAruba.isCompetitor, true);
assert.equal(detAruba.detectedBrand, 'Aruba / HPE');
assert.equal(detAruba.suggestedCiscoSku, 'C9200L-24P-4X-E');

// 2.2 Por texto natural con nombre de modelo
const detFg = detectCompetitorEquipment('Reemplazar Fortinet FG-60F en sucursal');
assert.equal(detFg.isCompetitor, true);
assert.equal(detFg.detectedBrand, 'Fortinet');
assert.equal(detFg.suggestedCiscoSku, 'FPR1010-NGFW-K9');

// 2.3 Heurística genérica de otra marca
const detGeneric = detectCompetitorEquipment('Homologar switch Huawei de 48 puertos PoE con fibra 10G a Cisco');
assert.equal(detGeneric.isCompetitor, true);
assert.equal(detGeneric.detectedBrand, 'Huawei');
assert.equal(detGeneric.suggestedCiscoSku, 'C9200L-48P-4X-E');

// 2.4 Equipo Cisco NO debe detectarse como competidor
const detCisco = detectCompetitorEquipment('C9200L-24P-4G-E');
assert.equal(detCisco.isCompetitor, false, 'Un equipo Cisco no debe clasificarse como competidor');

console.log('  ✅ Test 2: Detección multi-marca (exacta, por alias y heurística) validada exitosamente.');

// ----------------------------------------------------------------------------
// Test 3: Comparativa Técnica de Homologación de 10 Criterios y % Preservado
// ----------------------------------------------------------------------------
console.log('  Testing Side-by-Side Homologation Spec Comparison Generation...');

const comparison = generateHomologationComparison({
  rawCompetitorText: 'Aruba CX 6200F 24G PoE+ (JL726A)',
  catalogEntry: arubaEntry,
  selectedCiscoSku: 'C9200L-24P-4X-E',
  homologationPct: 100,
});

assert.equal(comparison.homologationPct, 100, 'Debe preservar el 100% de homologación');
assert.equal(comparison.competitor.brand, 'Aruba / HPE');
assert.equal(comparison.cisco.sku, 'C9200L-24P-4X-E');
assert.equal(comparison.specRows.length, 10, 'La comparativa debe contener los 10 criterios técnicos más relevantes');

// Validar criterios esenciales
const portsRow = comparison.specRows.find((r) => r.label.includes('Puertos de Acceso'));
assert.ok(portsRow, 'Debe incluir comparación de puertos de acceso');
assert.ok(portsRow?.ciscoValue.includes('24x'), 'Cisco debe proveer 24 puertos');

const uplinksRow = comparison.specRows.find((r) => r.label.includes('Uplinks'));
assert.ok(uplinksRow, 'Debe incluir comparación de uplinks');
assert.ok(uplinksRow?.ciscoValue.includes('10G'), 'Cisco debe proveer 4x 10G SFP+');

const poeRow = comparison.specRows.find((r) => r.label.includes('Presupuesto Eléctrico PoE'));
assert.ok(poeRow, 'Debe incluir comparación de presupuesto PoE');
assert.ok(poeRow?.ciscoValue.includes('370W'), 'Cisco debe proveer 370W PoE+');

const powerCordRow = comparison.specRows.find((r) => r.label.includes('Fuente de Poder'));
assert.ok(powerCordRow, 'Debe incluir norma eléctrica chilena');
assert.ok(powerCordRow?.ciscoValue.includes('CAB-ACA'), 'Debe incluir cable Norma Chile CAB-ACA');

assert.ok(comparison.verdict.includes('100% Equivalente'), 'El veredicto debe certificar 100% Equivalente');
assert.ok(comparison.keyAdvantages.length >= 4, 'Debe proveer al menos 4 ventajas comerciales para licitaciones');

console.log('  ✅ Test 3: Comparativa técnica lado a lado de 10 aspectos y % de homologación aprobados al 100%.');

// ----------------------------------------------------------------------------
// Test 4: Extracción de Lenguaje Natural en Preventa IA con Marcas Rivales
// ----------------------------------------------------------------------------
console.log('  Testing Preventa IA Extraction with Competitor Models...');

const nlpResult = extractWithLocalDeterministicEngine('Homologar switch Aruba CX 6200F 24G PoE+ (JL726A) con SmartNet a 3 años');
assert.equal(nlpResult.items.length, 1, 'Debe extraer 1 ítem para homologar');

const extractedItem = nlpResult.items[0];
assert.equal(extractedItem.isCompetitorBrand, true, 'El ítem debe marcarse con isCompetitorBrand = true');
assert.equal(extractedItem.competitorBrand, 'Aruba / HPE');
assert.equal(extractedItem.suggestedActiveSku, 'C9200L-24P-4X-E', 'Debe homologar al SKU Cisco equivalente C9200L-24P-4X-E');
assert.equal(extractedItem.includeSmartNet, true, 'Debe respetar inclusión de SmartNet');

// Sub-hijos ensamblados
assert.ok(extractedItem.aiSubItems && extractedItem.aiSubItems.length >= 3, 'Debe generar sub-líneas Hijo Madre-Hijo');
const hasDna = extractedItem.aiSubItems?.some((sub) => sub.partNumber.includes('DNA'));
assert.ok(hasDna, 'Debe incluir licencia Cisco DNA');
const hasPsu = extractedItem.aiSubItems?.some((sub) => sub.partNumber.includes('PWR'));
assert.ok(hasPsu, 'Debe incluir fuente de poder modular');
const hasChileCord = extractedItem.aiSubItems?.some((sub) => sub.partNumber === 'CAB-ACA');
assert.ok(hasChileCord, 'Debe incluir cable Norma Chile CAB-ACA');

console.log('  ✅ Test 4: Extracción en Preventa IA de equipo rival y ensamblado Madre-Hijo completada.');

// ----------------------------------------------------------------------------
// Test 5: Comparativa Multi-Configuración Cisco y Multi-Marca Equivalente
// ----------------------------------------------------------------------------
console.log('  Testing Multi-Config & Multi-Brand Benchmark Matrix...');

const autoMatrix = generateHomologationComparison({
  rawCompetitorText: 'JL726A',
  selectedCiscoSku: 'C9200L-24P-4X-E',
  establishedProposals: [
    {
      sku: 'C9200L-24P-4X-E',
      title: 'Catalyst 9200L 24P PoE+ 4x10G',
      strategyTag: 'Óptima Recomendada',
      homologationPct: 100,
      unitGplUsd: 4200,
      discountPct: 50,
      isFastTrackEligible: true,
    },
    {
      sku: 'C1300-24P-4X',
      title: 'Catalyst 1300 24P PoE+ 4x10G',
      strategyTag: 'Económica PyME',
      homologationPct: 96,
      unitGplUsd: 2100,
      discountPct: 43,
    },
  ],
});

assert.equal(
  autoMatrix.competitor.brand,
  'Aruba / HPE',
  'Debe auto-resolver la marca desde el texto sin requerir catalogEntry explícito'
);
assert.ok(
  autoMatrix.ciscoConfigurations.length >= 3,
  'Debe comparar contra las configuraciones Cisco establecidas y alternativas del catálogo'
);
assert.ok(
  autoMatrix.ciscoConfigurations.some((c) => c.sku === 'C9200L-24P-4X-E' && c.isActiveSelected),
  'Debe marcar como activa la configuración seleccionada'
);
assert.ok(
  autoMatrix.ciscoConfigurations.some((c) => c.sku === 'C1300-24P-4X' && c.unitGplUsd === 2100),
  'Debe incluir las configuraciones ya establecidas con GPL y descuento'
);

assert.ok(
  autoMatrix.peerBrandsMatrix.length >= 5,
  'Debe comparar la marca solicitada contra Cisco y múltiples marcas equivalentes (Huawei, Fortinet, Dell, Juniper, etc.)'
);
assert.equal(autoMatrix.peerBrandsMatrix[0].role, 'requested');
assert.equal(autoMatrix.peerBrandsMatrix[1].role, 'cisco_reference');
assert.ok(
  autoMatrix.peerBrandsMatrix.some((p) => p.role === 'peer_competitor' && p.brand === 'Huawei'),
  'Debe incluir benchmark contra Huawei equivalente'
);
assert.ok(
  autoMatrix.peerBrandsMatrix.some((p) => p.role === 'peer_competitor' && p.brand === 'Fortinet'),
  'Debe incluir benchmark contra Fortinet equivalente'
);

console.log('  ✅ Test 5: Comparativas Multi-Configuración y Multi-Marca validadas al 100%.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE PREVENTA IA Y COMPARATIVA DE HOMOLOGACIÓN PASARON AL 100%!\n');
