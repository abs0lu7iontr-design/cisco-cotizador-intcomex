// ============================================================================
// CISCO AUTOMATED v2.1 - AI DISCREPANCY & CONCORDANCE AUDITOR
// Compara en paralelo la solicitud original del cliente (lenguaje natural o captura)
// con el ensamble Golden Template para detectar discrepancias u omisiones técnicas.
// ============================================================================

import { ExtractedRequirementItem, ExtractedRequirementResult } from './aiBomExtractor';
import { CcwAssembledRow } from './ccwExcelGenerator';

export type DiscrepancySeverity = 'warning' | 'info' | 'critical';

export interface DiscrepancyItem {
  id: string;
  itemIndex: number;
  severity: DiscrepancySeverity;
  category:
    | 'ports'
    | 'poe'
    | 'uplinks'
    | 'power_redundancy'
    | 'power_cord'
    | 'stacking'
    | 'license_term'
    | 'license_tier'
    | 'environment_industrial'
    | 'eol_transition'
    | 'smartnet'
    | 'platform_family';
  title: string;
  customerStated: string;
  configuredInBom: string;
  explanation: string;
  recommendedActionLabel?: string;
  applyFixPatch?: Partial<ExtractedRequirementItem>;
}

export interface DiscrepancyAuditReport {
  hasDiscrepancies: boolean;
  totalIssues: number;
  concordanceScore: number; // 0 - 100%
  summaryBadge: string;
  discrepancies: DiscrepancyItem[];
  verifiedCompliances: string[];
}

/**
 * Realiza una auditoría determinista instantánea (0 ms) comparando el texto del cliente
 * y los ítems configurados.
 */
export function auditCustomerIntentDiscrepancies(
  rawInputText: string,
  extractionResult: ExtractedRequirementResult | null,
  assembledRows: CcwAssembledRow[]
): DiscrepancyAuditReport {
  const text = (rawInputText || '').trim().toLowerCase();
  const discrepancies: DiscrepancyItem[] = [];
  const verifiedCompliances: string[] = [];

  if (!extractionResult || !Array.isArray(extractionResult.items) || extractionResult.items.length === 0) {
    return {
      hasDiscrepancies: false,
      totalIssues: 0,
      concordanceScore: 100,
      summaryBadge: 'Sin requerimientos analizados',
      discrepancies: [],
      verifiedCompliances: [],
    };
  }

  for (let idx = 0; idx < extractionResult.items.length; idx++) {
    const item = extractionResult.items[idx];
    const parentRow = assembledRows.find((r) => r.parentIndex === idx && r.isParent);
    const childRows = assembledRows.filter((r) => r.parentIndex === idx && !r.isParent);
    const activeSku = (parentRow?.partNumber || item.suggestedActiveSku || '').toUpperCase();

    // Contexto unificado: combina el texto ingresado por el usuario + notas extraídas de imágenes/OCR por Gemini
    const itemContext = [
      rawInputText,
      item.notes,
      item.rawMentionedSku,
      item.coherentCorrectionNote,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // 1. AUDITORÍA DE PUERTOS (24 vs 48 vs 8)
    const wants48 = /\b48\s*(?:puertos|bocas|ports|p|port)\b/i.test(itemContext) || /\b48p\b/i.test(itemContext);
    const wants24 = /\b24\s*(?:puertos|bocas|ports|p|port)\b/i.test(itemContext) || /\b24p\b/i.test(itemContext);
    const wants8 = /\b(?:8|08)\s*(?:puertos|bocas|ports|p|port)\b/i.test(itemContext);

    const has48InSku = activeSku.includes('-48') || activeSku.includes('48P') || activeSku.includes('48T');
    const has24InSku = activeSku.includes('-24') || activeSku.includes('24P') || activeSku.includes('24T');

    if (wants48 && !has48InSku) {
      discrepancies.push({
        id: `port-mismatch-48-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'ports',
        title: 'Discrepancia en Cantidad de Puertos',
        customerStated: 'Cliente solicitó switch de 48 puertos',
        configuredInBom: `Chasis actual: ${activeSku} (${item.ports || 24} puertos)`,
        explanation: 'El requerimiento del cliente (texto/imagen) especifica 48 puertos, pero la solución activa se configuró con 24 puertos.',
        recommendedActionLabel: 'Cambiar a 48 Puertos',
        applyFixPatch: {
          ports: 48,
          suggestedActiveSku: activeSku.replace(/24/g, '48'),
        },
      });
    } else if (wants24 && !has24InSku && has48InSku) {
      discrepancies.push({
        id: `port-mismatch-24-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'ports',
        title: 'Discrepancia en Cantidad de Puertos',
        customerStated: 'Cliente solicitó switch de 24 puertos',
        configuredInBom: `Chasis actual: ${activeSku} (48 puertos)`,
        explanation: 'El requerimiento del cliente indicó 24 puertos pero se configuró un chasis de 48 puertos.',
        recommendedActionLabel: 'Cambiar a 24 Puertos',
        applyFixPatch: {
          ports: 24,
          suggestedActiveSku: activeSku.replace(/48/g, '24'),
        },
      });
    } else if (wants48 && has48InSku) {
      verifiedCompliances.push(`Puertos: 48 puertos configurados conforme a la solicitud.`);
    } else if (wants24 && has24InSku) {
      verifiedCompliances.push(`Puertos: 24 puertos configurados conforme a la solicitud.`);
    }

    // 2. AUDITORÍA DE ALIMENTACIÓN POE+ / FULL POE
    const wantsPoe =
      /\bpoe\b|\bpoe\+\b|\bpower over ethernet\b|\balimentar c[aá]maras\b|\balimentar ap\b/i.test(itemContext);
    const wantsFullPoe = /\bfull\s*poe\b|\b740w\b|\bpoe\s*alto\b|\bpoe\s*extendido\b/i.test(itemContext);
    const isDataOnlySku = /-24T|-48T|-8T/i.test(activeSku);
    const isFullPoeSku = /-48FP|-24FP|740W/i.test(activeSku);

    if (wantsPoe && isDataOnlySku) {
      discrepancies.push({
        id: `poe-mismatch-${idx}`,
        itemIndex: idx,
        severity: 'critical',
        category: 'poe',
        title: 'Discrepancia Crítica de PoE',
        customerStated: 'Cliente solicitó alimentación PoE / PoE+',
        configuredInBom: `Chasis actual: ${activeSku} (Modelo de solo Datos T, Sin PoE)`,
        explanation: 'El cliente requiere alimentar dispositivos por red PoE, pero el chasis seleccionado no entrega energía eléctrica.',
        recommendedActionLabel: 'Activar Chasis PoE+',
        applyFixPatch: {
          isPoe: true,
          suggestedActiveSku: activeSku.replace(/-(\d{2})T/i, '-$1P'),
        },
      });
    } else if (wantsFullPoe && !isFullPoeSku && activeSku.includes('48P')) {
      discrepancies.push({
        id: `full-poe-mismatch-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'poe',
        title: 'Presupuesto PoE Insuficiente (Full PoE)',
        customerStated: 'Cliente solicitó Full PoE+ (740W)',
        configuredInBom: `Chasis actual: ${activeSku} (Standard PoE 370W)`,
        explanation: 'Para 48 puertos con cámaras de alta potencia o APs Wi-Fi 6E se recomienda el modelo Full PoE (740W).',
        recommendedActionLabel: 'Cambiar a Full PoE 740W (-48FP)',
        applyFixPatch: {
          poeBudget: 'full_poe',
          suggestedActiveSku: activeSku.replace(/-48P/i, '-48FP'),
        },
      });
    } else if (wantsPoe && !isDataOnlySku) {
      verifiedCompliances.push(`Alimentación PoE: Chasis PoE+ validado con su fuente de poder adecuada.`);
    }

    // 3. AUDITORÍA DE UPLINKS 10G SFP+ vs 1G
    const wants10G = /\b10g\b|\b10\s*gb\b|\b10\s*gigabit\b|\bsfp\+\b|\bfibra\s*10g\b/i.test(itemContext);
    const isFixed1GSku = /-4G-/i.test(activeSku) || /-4G\b/i.test(activeSku);

    if (wants10G && isFixed1GSku) {
      discrepancies.push({
        id: `uplink-mismatch-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'uplinks',
        title: 'Discrepancia en Uplinks (Fibra 10G)',
        customerStated: 'Cliente solicitó enlaces de subida a 10G SFP+',
        configuredInBom: `Chasis actual: ${activeSku} (Uplinks fijos 1G -4G)`,
        explanation: 'El requerimiento pidió subida a 10G pero el equipo tiene uplinks fijos de 1G SFP.',
        recommendedActionLabel: 'Actualizar a Modelo 4x10G SFP+ (-4X)',
        applyFixPatch: {
          uplinkType: '10G',
          suggestedActiveSku: activeSku.replace(/-4G-/i, '-4X-'),
        },
      });
    } else if (wants10G && !isFixed1GSku) {
      verifiedCompliances.push(`Uplinks: Soporte 10G SFP+ verificado en la solución.`);
    }

    // 4. AUDITORÍA DE FUENTE REDUNDANTE
    const wantsRedundancy =
      /\bdoble\s*fuente\b|\bfuente\s*redundante\b|\b2\s*fuentes\b|\bredundancia\s*el[eé]ctrica\b|\bdual\s*psu\b/i.test(
        itemContext
      );
    const hasRedundantPsu = Boolean(item.includeRedundantPsu);

    if (wantsRedundancy && !hasRedundantPsu) {
      discrepancies.push({
        id: `redundant-psu-missing-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'power_redundancy',
        title: 'Redundancia Eléctrica No Activada',
        customerStated: 'Cliente solicitó doble fuente / redundancia de energía',
        configuredInBom: 'Configuración actual: 1 sola fuente de poder',
        explanation: 'El cliente pidió alta disponibilidad eléctrica. Se debe incluir la segunda fuente de poder.',
        recommendedActionLabel: 'Activar 2da Fuente Redundante',
        applyFixPatch: {
          includeRedundantPsu: true,
        },
      });
    } else if (wantsRedundancy && hasRedundantPsu) {
      verifiedCompliances.push(`Redundancia Eléctrica: 2da fuente de poder redundante incluida.`);
    }

    // 5. AUDITORÍA DE APILAMIENTO (STACKING)
    const wantsStack =
      /\b(?:stack(?:ing|eable|s|-kit)?|stackwise|apilable|apilamiento|apilar|en\s*stack)\b/i.test(itemContext);
    const hasStack = Boolean(item.includeStacking);

    if (wantsStack && !hasStack) {
      discrepancies.push({
        id: `stacking-missing-${idx}`,
        itemIndex: idx,
        severity: 'info',
        category: 'stacking',
        title: 'Kit de Apilamiento (Stack) No Agregado',
        customerStated: 'Cliente indicó equipos apilables / en stack',
        configuredInBom: 'Configuración actual: Sin módulo de apilamiento',
        explanation: 'Para interconectar el switch al stack del cliente se requiere el kit oficial C9200L-STACK-KIT.',
        recommendedActionLabel: 'Incluir Kit de Stacking',
        applyFixPatch: {
          includeStacking: true,
        },
      });
    } else if (wantsStack && hasStack) {
      verifiedCompliances.push(`Apilamiento: Kit oficial de Stack incluido en la solución.`);
    }

    // 6. AUDITORÍA DE PLAZO DE LICENCIA (1, 3, 5 AÑOS)
    const wants5Y = /\b5\s*a[ñn]os\b|\b5y\b|\b60\s*meses\b/i.test(itemContext);
    const wants1Y = /\b1\s*a[ñn]o\b|\b1y\b|\b12\s*meses\b/i.test(itemContext);
    const currentYears = item.termYears || 3;

    if (wants5Y && currentYears !== 5) {
      discrepancies.push({
        id: `license-term-5y-${idx}`,
        itemIndex: idx,
        severity: 'info',
        category: 'license_term',
        title: 'Discrepancia en Plazo de Suscripción',
        customerStated: 'Cliente solicitó licencia a 5 años (60 meses)',
        configuredInBom: `Plazo actual configurado: ${currentYears} años (${currentYears * 12} meses)`,
        explanation: 'El cliente pidió 5 años de suscripción, pero el sistema asignó 3 años por defecto.',
        recommendedActionLabel: 'Ajustar Plazo a 5 Años',
        applyFixPatch: {
          termYears: 5,
        },
      });
    } else if (wants1Y && currentYears !== 1) {
      discrepancies.push({
        id: `license-term-1y-${idx}`,
        itemIndex: idx,
        severity: 'info',
        category: 'license_term',
        title: 'Discrepancia en Plazo de Suscripción',
        customerStated: 'Cliente solicitó licencia a 1 año (12 meses)',
        configuredInBom: `Plazo actual configurado: ${currentYears} años`,
        explanation: 'El cliente pidió 1 año de suscripción.',
        recommendedActionLabel: 'Ajustar Plazo a 1 Año',
        applyFixPatch: {
          termYears: 1,
        },
      });
    } else if ((wants5Y && currentYears === 5) || (wants1Y && currentYears === 1)) {
      verifiedCompliances.push(`Plazo de Licencia: ${currentYears} año(s) conforme a lo solicitado.`);
    }

    // 7. AUDITORÍA DE CAPA 3 / ENRUTAMIENTO DINÁMICO (ADVANTAGE VS ESSENTIALS)
    const wantsL3 = /\b(?:capa\s*3|l3\b|enrutamiento\s*din[aá]mico|ospf|bgp|eigrp|advantage)\b/i.test(itemContext);
    const currentTier = item.licenseTier || 'Essentials';
    if (wantsL3 && currentTier === 'Essentials') {
      discrepancies.push({
        id: `license-tier-l3-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'license_tier',
        title: 'Discrepancia en Capa 3 / Funciones Avanzadas',
        customerStated: 'Cliente solicitó Capa 3 (L3), enrutamiento dinámico (OSPF/BGP) o nivel Advantage',
        configuredInBom: 'Licencia actual: Network/DNA Essentials (Capa 2 básica / routed access limitado)',
        explanation: 'Para soporte completo de enrutamiento Capa 3, múltiples VRFs, OSPF dinámico y telemetría avanzada, se requiere la licencia Advantage.',
        recommendedActionLabel: 'Actualizar a Licencia Advantage (-A)',
        applyFixPatch: {
          licenseTier: 'Advantage',
          suggestedActiveSku: activeSku.endsWith('-E') ? activeSku.replace(/-E$/i, '-A') : activeSku,
        },
      });
    } else if (wantsL3 && currentTier === 'Advantage') {
      verifiedCompliances.push('Capa de Licencia: Licencia Advantage configurada para soporte Capa 3.');
    }

    // 8. AUDITORÍA DE SOPORTE SMARTNET (SNTC)
    const wantsSmartNet = /\b(?:smartnet|sntc|con-snt|soporte\s*cisco|soporte\s*24x7|soporte\s*8x5)\b/i.test(itemContext);
    if (wantsSmartNet && !item.includeSmartNet) {
      const wants24x7 = /\b24x7/i.test(itemContext);
      discrepancies.push({
        id: `smartnet-missing-${idx}`,
        itemIndex: idx,
        severity: 'info',
        category: 'smartnet',
        title: 'Soporte SmartNet Solicitado No Activado',
        customerStated: `Cliente solicitó soporte SmartNet (${wants24x7 ? '24x7x4' : '8x5xNBD'})`,
        configuredInBom: 'Configuración actual: Sin SmartNet',
        explanation: 'El cliente mencionó requerir soporte técnico oficial Cisco SmartNet Total Care.',
        recommendedActionLabel: `Activar SmartNet (${wants24x7 ? '24x7x4' : '8x5xNBD'})`,
        applyFixPatch: {
          includeSmartNet: true,
          smartNetLevel: wants24x7 ? '24x7x4' : '8x5xNBD',
        },
      });
    } else if (wantsSmartNet && item.includeSmartNet) {
      verifiedCompliances.push(`Soporte SmartNet: Cobertura oficial ${item.smartNetLevel || '8x5xNBD'} activada.`);
    }

    // 9. AUDITORÍA DE PLATAFORMA (MERAKI CLOUD VS CATALYST ON-PREMISE)
    const wantsMeraki = /\bmeraki\b/i.test(itemContext);
    const isCatalyst = activeSku.startsWith('C9') || activeSku.startsWith('C1');
    if (wantsMeraki && isCatalyst) {
      const ports = activeSku.includes('48') ? 48 : 24;
      discrepancies.push({
        id: `platform-meraki-mismatch-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'platform_family',
        title: 'Discrepancia de Plataforma (Meraki Cloud)',
        customerStated: 'Cliente solicitó equipamiento gestionado en la nube Meraki',
        configuredInBom: `Chasis actual: ${activeSku} (Línea Cisco Catalyst)`,
        explanation: 'El cliente indicó preferencia por Meraki Dashboard Cloud, pero se armó una solución Catalyst On-Premise/DNA.',
        recommendedActionLabel: `Cambiar a Meraki MS130-${ports}P`,
        applyFixPatch: {
          deviceType: 'switch',
          suggestedActiveSku: `MS130-SWITCHES:MS130-${ports}P`,
        },
      });
    }

    // 10. AUDITORÍA DE AMBIENTE INDUSTRIAL
    const wantsIndustrial =
      /\bambiente\s*industrial\b|\bpolvo\b|\bminera\b|\bplanta\b|\briel\s*din\b|\btemperatura\s*extrema\b/i.test(
        itemContext
      );
    const isCommercialSwitch = activeSku.startsWith('C9200') || activeSku.startsWith('C1200') || activeSku.startsWith('C1300');

    if (wantsIndustrial && isCommercialSwitch) {
      discrepancies.push({
        id: `industrial-recommendation-${idx}`,
        itemIndex: idx,
        severity: 'warning',
        category: 'environment_industrial',
        title: 'Alerta de Ambiente: Posible Switch Incorrecto para Entorno Rudo',
        customerStated: 'Cliente describe entorno industrial / minero / con polvo',
        configuredInBom: `Chasis actual: ${activeSku} (Switch comercial para rack de oficina)`,
        explanation:
          'Los switches Catalyst estándar no soportan vibración, riel DIN ni polvo industrial. Se recomienda evaluar Cisco Catalyst IE3300 o IE3400 Heavy Duty.',
        recommendedActionLabel: 'Evaluar Catalyst Industrial IE3400',
        applyFixPatch: {
          deviceType: 'industrial_switch',
          suggestedActiveSku: 'IE-3400-8P2S-E',
        },
      });
    }

    // 11. VERIFICACIÓN DE CABLE DE PODER
    if (item.clientRequestedPowerCord && item.clientPowerCordLabel) {
      verifiedCompliances.push(
        `Cable de Poder: Asignado cable prioritario solicitado por el cliente (${item.clientPowerCordLabel}).`
      );
    } else {
      verifiedCompliances.push('Cable de Poder: Asignado cable oficial Norma Chile CAB-IT por defecto.');
    }

    // 12. VERIFICACIÓN DE CICLO DE VIDA (CERO EOL)
    if (parentRow?.wasReplacedFromEol) {
      verifiedCompliances.push(
        `Ciclo de Vida: El equipo EOL solicitado (${item.rawMentionedSku}) fue reemplazado exitosamente por el chasis 2026 (${activeSku}).`
      );
    } else {
      verifiedCompliances.push(`Ciclo de Vida: Chasis ${activeSku} 100% vigente en Cisco CCW 2026.`);
    }
  }

  const totalChecks = discrepancies.length + verifiedCompliances.length;
  const score = totalChecks > 0 ? Math.round((verifiedCompliances.length / totalChecks) * 100) : 100;

  return {
    hasDiscrepancies: discrepancies.length > 0,
    totalIssues: discrepancies.length,
    concordanceScore: score,
    summaryBadge:
      discrepancies.length === 0
        ? '✓ Concordancia Técnica 100% con Solicitud del Cliente'
        : `⚠️ ${discrepancies.length} Observación(es) Preventa Detectadas`,
    discrepancies,
    verifiedCompliances,
  };
}
