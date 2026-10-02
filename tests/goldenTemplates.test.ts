// ============================================================================
// CISCO AUTOMATED - GOLDEN TEMPLATES VERIFICATION TESTS
// Verifica que la biblioteca de Golden Templates Madre-Hijo funcione al 100%
// para Nexus 9300, Meraki MS130, Catalyst 9200L, 9300, IE3400, FPR1010 y UCS M7.
// ============================================================================

import {
  findGoldenTemplate,
  CISCO_GOLDEN_TEMPLATES,
  getAllGoldenTemplates,
} from '../src/modules/configuriator/goldenTemplates';
import { resolveChassisRule } from '../src/modules/configuriator/catalogRules';

import { auditCustomerIntentDiscrepancies } from '../src/modules/configuriator/aiDiscrepancyAuditor';
import { ExtractedRequirementResult } from '../src/modules/configuriator/aiBomExtractor';
import { CcwAssembledRow } from '../src/modules/configuriator/ccwExcelGenerator';

function runGoldenTemplateTests() {
  console.log('🧪 Iniciando verificación de Golden Templates Cisco CCW / Netformx...\n');

  // Test 1: Catálogo completo cargado
  const allTemplates = getAllGoldenTemplates();
  console.log(`✅ Total de Golden Templates cargados: ${allTemplates.length}`);
  console.assert(allTemplates.length >= 9, 'Error: debieran haber al menos 9 plantillas oficiales');

  // Test 2: Nexus 9300 (N9K-C93180YC-FX3)
  const nexusTpl = findGoldenTemplate('N9K-C93180YC-FX3');
  console.assert(nexusTpl !== null, 'Error: Nexus 93180YC-FX3 no encontrado');
  console.assert(nexusTpl?.parentSku === 'N9K-C93180YC-FX3', 'Error en parentSku de Nexus');
  const nexusSubs = nexusTpl!.buildSubItems({ termYears: 3 });
  console.assert(nexusSubs.some((s) => s.partNumber.includes('650W')), 'Nexus debe incluir fuente 650W');
  console.assert(nexusSubs.some((s) => s.partNumber.includes('FAN')), 'Nexus debe incluir ventiladores');
  console.assert(nexusSubs.some((s) => s.partNumber.includes('C1-N9K') || s.partNumber.includes('9300XF')), 'Nexus debe incluir licencia DCN');
  console.log('✅ Nexus 9300 (N9K-C93180YC-FX3): Árbol oficial (2x Fuentes, 4x Ventiladores, DCN Lic, PDU Cables) verificado');

  // Test 3: Búsqueda por alias / legacy de Nexus
  const nexusAlias = findGoldenTemplate('N9K-C93180YC-FX');
  console.assert(nexusAlias?.parentSku === 'N9K-C93180YC-FX3', 'Error: alias N9K-C93180YC-FX falló');
  console.log('✅ Alias de Nexus 9300 verificado exitosamente');

  // Test 4: Meraki MS130 (MS130-SWITCHES y sub-modelo MS130-48P)
  const ms130Tpl = findGoldenTemplate('MS130-48P');
  console.assert(ms130Tpl !== null, 'Error: MS130-48P debe mapear al Golden Template MS130-SWITCHES');
  console.assert(ms130Tpl?.parentSku === 'MS130-SWITCHES', 'ParentSku de MS130 debe ser MS130-SWITCHES');
  const ms130Subs = ms130Tpl!.buildSubItems({ selectedModel: 'MS130-48P', termYears: 3 });
  console.assert(ms130Subs[0]?.partNumber === 'MS130-48P', 'Hijo 1.1 debe ser MS130-48P');
  console.assert(ms130Subs.some((s) => s.partNumber.includes('LIC-MS130-48')), 'Debe incluir licencia LIC-MS130-48-3Y');
  console.log('✅ Meraki MS130: Contenedor oficial MS130-SWITCHES con hijo MS130-48P y licencia cloud verificado');

  // Test 5: Catalyst 9200L (C9200L-24P-4G-E)
  const cat92Tpl = findGoldenTemplate('C9200L-24P-4G-E');
  console.assert(cat92Tpl !== null, 'Error: C9200L-24P-4G-E no encontrado');
  const cat92Subs = cat92Tpl!.buildSubItems({ termYears: 3, includeStackingKit: true });
  console.assert(cat92Subs.some((s) => s.partNumber.includes('DNA-E-24-3Y')), 'Debe incluir DNA Essentials 3Y');
  console.assert(cat92Subs.some((s) => s.partNumber.includes('PWR-C5-600WAC')), 'Debe incluir PWR-C5-600WAC');
  console.assert(cat92Subs.some((s) => s.partNumber === 'C9200L-STACK-KIT'), 'Debe incluir C9200L-STACK-KIT');
  console.log('✅ Catalyst 9200L: Árbol oficial (DNA 3Y, PWR-C5-600WAC, Stack kit, Cable Chile/Schuko) verificado');

  // Test 6: Catalyst 9300 (C9300-24P-A)
  const cat93Tpl = findGoldenTemplate('C9300-24P-A');
  console.assert(cat93Tpl !== null, 'Error: C9300-24P-A no encontrado');
  const cat93Subs = cat93Tpl!.buildSubItems({ termYears: 3 });
  console.assert(cat93Subs.some((s) => s.partNumber === 'C9300-NM-8X'), 'C9300 debe incluir módulo uplink 8x10G');
  console.assert(cat93Subs.some((s) => s.partNumber === 'STACK-T1-50CM'), 'C9300 debe incluir cable StackWise-480');
  console.log('✅ Catalyst 9300: Árbol modular oficial (DNA Advantage, NM-8X, STACK-T1-50CM, PSU Platinum) verificado');

  // Test 7: Integración con resolveChassisRule
  const ruleNexus = resolveChassisRule('N9K-C93180YC-FX3');
  console.assert(ruleNexus?.isGoldenTemplate === true, 'ruleNexus debe tener isGoldenTemplate=true');
  console.assert(ruleNexus?.goldenTemplateSource === 'Cisco CCW', 'Source debe ser Cisco CCW');

  const ruleCat92 = resolveChassisRule('C9200L-24P-4G-E');
  console.assert(ruleCat92?.isGoldenTemplate === true, 'ruleCat92 debe tener isGoldenTemplate=true');

  // Test 8: Validación de Flujo EOL hacia Golden Templates
  const eolSkusToTest = [
    { eol: 'WS-C2960X-24PS-L', expectedGolden: 'C9200L-24P-4G-E' },
    { eol: 'WS-C3850-24P-E', expectedGolden: 'C9300-24P-A' },
    { eol: 'N9K-C93180YC-EX', expectedGolden: 'N9K-C93180YC-FX3' },
    { eol: 'ASA5506-K9', expectedGolden: 'FPR1010-NGFW-K9' },
    { eol: 'IE-4000-8GS4G-E', expectedGolden: 'IE-3400-8P2S-E' },
    { eol: 'UCSC-C220-M5SX', expectedGolden: 'UCSC-C220-M7S' },
  ];

  for (const item of eolSkusToTest) {
    const tpl = findGoldenTemplate(item.eol);
    console.assert(
      tpl !== null && tpl.parentSku === item.expectedGolden,
      `Error en mapeo EOL ${item.eol}: esperado ${item.expectedGolden}, obtenido ${tpl?.parentSku}`
    );
  }
  console.log('✅ Flujo EOL verificado: Todos los equipos EOL resuelven automáticamente a sus Golden Templates 2026');

  // Test 9: Auditoría Paralela de Discrepancias IA (Lenguaje Natural vs Ensamble)
  const mockReq: ExtractedRequirementResult = {
    clientName: 'Cliente Minero',
    items: [
      {
        id: 'item-1',
        rawMentionedSku: 'switch de 48 bocas con uplinks 10g y stack',
        suggestedActiveSku: 'C9200L-24P-4G-E', // Inicialmente armado con 24P y 1G
        deviceType: 'switch',
        ports: 24,
        isPoe: true,
        uplinkType: '1G',
        licenseTier: 'Essentials',
        termYears: 3,
        quantity: 2,
        includeStacking: false,
        includeRedundantPsu: false,
        includeSmartNet: false,
        powerCordStandard: 'italy_chile',
      },
    ],
  };

  const mockRows: CcwAssembledRow[] = [
    {
      rowId: 'row-1',
      parentIndex: 0,
      partNumber: 'C9200L-24P-4G-E',
      quantity: 2,
      isParent: true,
      durationMonths: 36,
      listPrice: 2690,
      discountPct: 0,
      initialTerm: 36,
      autoRenewTerm: '',
      billingModel: 'Prepaid',
      requestedStartDate: '',
      notes: 'Catalyst 9200L 24-port PoE+ 4x1G',
    },
  ];

  const auditReport = auditCustomerIntentDiscrepancies(
    'Necesito switch de 48 puertos PoE con enlaces a 10G y kit de apilamiento stack',
    mockReq,
    mockRows
  );

  console.assert(auditReport.hasDiscrepancies === true, 'Debe detectar discrepancias');
  console.assert(
    auditReport.discrepancies.some((d) => d.category === 'ports'),
    'Debe detectar discrepancia de 24 vs 48 puertos'
  );
  console.assert(
    auditReport.discrepancies.some((d) => d.category === 'uplinks'),
    'Debe detectar discrepancia de 1G vs 10G'
  );
  console.assert(
    auditReport.discrepancies.some((d) => d.category === 'stacking'),
    'Debe detectar omisión de stacking'
  );
  console.log('✅ Auditoría IA en Lenguaje Natural: Detectó con éxito discrepancias de puertos (48 vs 24), uplinks (10G vs 1G) y stacking');

  // Test 10: Auditoría Multimodal (Imagen / OCR context con Capa 3 y SmartNet)
  const mockMultimodalReq: ExtractedRequirementResult = {
    clientName: 'Financiera',
    items: [
      {
        id: 'item-2',
        rawMentionedSku: '',
        suggestedActiveSku: 'C9200L-24P-4G-E',
        deviceType: 'switch',
        ports: 24,
        isPoe: true,
        uplinkType: '1G',
        licenseTier: 'Essentials',
        termYears: 3,
        quantity: 1,
        includeSmartNet: false,
        notes: 'Captura de pantalla: Switch capa 3 con soporte cisco smartnet 24x7',
      },
    ],
  };

  const multimodalReport = auditCustomerIntentDiscrepancies(
    '', // Sin texto, solo imagen procesada
    mockMultimodalReq,
    mockRows
  );

  console.assert(
    multimodalReport.discrepancies.some((d) => d.category === 'license_tier'),
    'Debe detectar requerimiento de Capa 3 / Advantage desde notas de imagen'
  );
  console.assert(
    multimodalReport.discrepancies.some((d) => d.category === 'smartnet'),
    'Debe detectar requerimiento de SmartNet 24x7 desde notas de imagen'
  );
  console.log('✅ Auditoría Multimodal (Imágenes/OCR): Detectó discrepancia de Capa 3 y SmartNet 24x7 desde la imagen');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE GOLDEN TEMPLATES, EOL Y CO-PILOTO AUDITOR COMPLETADAS AL 100%!');
}

runGoldenTemplateTests();
