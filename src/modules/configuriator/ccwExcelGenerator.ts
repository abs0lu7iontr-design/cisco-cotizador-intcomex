// ============================================================================
// CISCO AUTOMATED v2.1 - CCW UPLOAD EXCEL GENERATOR (10-COLUMN MADRE-HIJO)
// Genera el archivo Excel oficial "UploadExcelTemplate" con hoja "Sheet1" y
// orden secuencial estricto MADRE -> HIJOS para ensamblado VALID en Cisco CCW.
// Soporta todo el portafolio Cisco & Meraki (Enterprise, Industrial IE, UCS M7,
// Nexus DC, Seguridad FPR/MX, Colaboración DP-9800/Room Bar), cable por defecto
// Norma Chile/Italia (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT), SmartNet
// (CON-SNT) y transceivers SFP compatibles.
// ============================================================================

import ExcelJS from 'exceljs';
import {
  ExtractedRequirementResult,
  ExtractedRequirementItem,
  normalizeParentChassisSku,
} from './aiBomExtractor';
import {
  EOL_CATALOG_2026,
  EOL_MAPPING,
  resolveChassisRule,
  resolveMerakiSubLicense,
  resolvePowerCordSubItem,
  resolveSmartNetSubItem,
  estimateReferencePriceUsd,
  checkSkuInFastTrackDb,
  normalizeCiscoDnaTermYears,
  sanitizeAndValidateCcwSku,
  SubItemConfig,
  PowerCordStandard,
  HomologatedProposal,
  ProposalPrioritySortMode,
  generateHomologatedProposalsForItem,
} from './catalogRules';
import { FastTrackProduct } from '../fasttrack/types';

export interface CcwAssembledRow {
  rowId: string;
  parentIndex: number;
  isParent: boolean;
  partNumber: string;
  quantity: number;
  durationMonths: number | '';
  listPrice: number | '';
  discountPct: number | '';
  initialTerm: number | '';
  autoRenewTerm: number | '';
  billingModel: string;
  requestedStartDate: string;
  notes: string;
  // Metadatos enriquecidos para vista previa en UI y Valor GPL (Sin Descuento)
  rawMentionedSku?: string;
  resolvedChildModel?: string;
  wasReplacedFromEol?: boolean;
  isNonExistentSku?: boolean;
  clientRequestedPowerCord?: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
  fastTrackInfo?: FastTrackProduct | null;
  estimatedUnitListUsd?: number;
  estimatedTotalListUsd?: number;
  isGoldenTemplate?: boolean;
  goldenTemplateName?: string;
  goldenTemplateSource?: string;
  /** Valor GPL Unitario del Chasis físico (Sin Descuento) */
  unitChassisGplUsd?: number;
  /** Valor GPL Unitario de la Solución Madre-Hijo completa (Chasis + Licencia + Fuente/Módulo, Sin Descuento) */
  unitSolutionGplUsd?: number;
  /** Valor GPL Total de la Solución Madre-Hijo completa (Sin Descuento) */
  totalSolutionGplUsd?: number;
  clientDiscountPct?: number;
  estimatedUnitNetUsd?: number;
  estimatedTotalNetUsd?: number;
}

/**
 * Resuelve el SKU Madre objetivo de un ítem respetando:
 * 1) Si el ingeniero seleccionó una tarjeta de alternativa EOL en UI (`selectedEolAlternativeSku`).
 * 2) Si el modelo está en EOL 2026 o fue corregido por `sanitizeAndValidateCcwSku`.
 * 3) Si es un contenedor Meraki MS130 (`MS130-SWITCHES:MS130-48P`) o cualquier línea Cisco vigente.
 */
export function resolveTargetSkuForItem(item: ExtractedRequirementItem): {
  targetSku: string;
  wasReplacedFromEol: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
} {
  const tier = item.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
  const rawSku = (item.rawMentionedSku || '').trim().toUpperCase();
  const eolEntry = EOL_CATALOG_2026[rawSku] || EOL_CATALOG_2026[rawSku.replace(/-HW$/i, '')];

  // 1. Si el usuario eligió explícitamente una alternativa EOL / Oficial en las tarjetas interactivas
  if (item.selectedEolAlternativeSku && (!item.keepOriginalSku || item.isNonExistentSku)) {
    const chosen = normalizeParentChassisSku(item.selectedEolAlternativeSku, tier);
    return {
      targetSku: chosen,
      wasReplacedFromEol: Boolean(rawSku && rawSku !== chosen),
      eolReason: item.eolReason || eolEntry?.eolNote,
      officialCiscoUrl: item.officialCiscoUrl || eolEntry?.officialCiscoDocUrl,
    };
  }

  const sanitizedSuggested = sanitizeAndValidateCcwSku(item.suggestedActiveSku || '');
  const suggested = normalizeParentChassisSku(sanitizedSuggested.sanitizedSku || item.suggestedActiveSku || '', tier);

  // Nunca permitir mantener un SKU inventado/inexistente en CCW
  if (item.keepOriginalSku && rawSku && !item.isNonExistentSku && !sanitizedSuggested.isNonExistentSku) {
    return {
      targetSku: rawSku,
      wasReplacedFromEol: false,
      eolReason: item.eolReason,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  // 2. Si el SKU original está en el catálogo EOL 2026
  if (rawSku && eolEntry) {
    const isCustomValidAlt =
      suggested &&
      suggested !== rawSku &&
      suggested !== `${rawSku}-HW` &&
      (suggested.startsWith('MS130-SWITCHES:') ||
        suggested.startsWith('MS225-') ||
        suggested.startsWith('C9200') ||
        suggested.startsWith('C9300') ||
        suggested.startsWith('C1200') ||
        suggested.startsWith('C1300') ||
        suggested.startsWith('IE-3') ||
        suggested.startsWith('UCSC-C2') ||
        suggested.startsWith('N9K-') ||
        suggested.startsWith('FPR') ||
        suggested.startsWith('MX') ||
        suggested.startsWith('DP-98') ||
        suggested.startsWith('CS-BAR'));

    const target = isCustomValidAlt
      ? suggested
      : normalizeParentChassisSku(eolEntry.replacementSku, tier);

    return {
      targetSku: target,
      wasReplacedFromEol: true,
      eolReason: sanitizedSuggested.correctionReason || item.eolReason || eolEntry.eolNote,
      officialCiscoUrl: eolEntry.officialCiscoDocUrl || item.officialCiscoUrl,
    };
  }

  if (rawSku && item.isEol2026 && suggested && suggested !== rawSku) {
    return {
      targetSku: suggested,
      wasReplacedFromEol: true,
      eolReason: sanitizedSuggested.correctionReason || item.eolReason || `Reemplazo sugerido 2026 para ${rawSku}`,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  if (suggested) {
    return {
      targetSku: suggested,
      wasReplacedFromEol: Boolean(
        (item.isEol2026 && rawSku && rawSku !== suggested) || sanitizedSuggested.inferredLegacyEolSku
      ),
      eolReason: sanitizedSuggested.correctionReason || item.eolReason,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  if (rawSku && !item.isEol2026 && !EOL_MAPPING[rawSku] && !rawSku.includes(' ')) {
    return {
      targetSku: normalizeParentChassisSku(rawSku, tier),
      wasReplacedFromEol: false,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  if (item.deviceType === 'industrial_switch') {
    return {
      targetSku: item.isPoe === false ? 'IE-3300-8T2S-E' : 'IE-3300-8P2S-E',
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3300-rugged-series/index.html',
    };
  }

  if (item.deviceType === 'server_ucs') {
    return {
      targetSku: 'UCSC-C220-M7S',
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/servers-unified-computing/ucs-c220-m7-rack-server/index.html',
    };
  }

  if (item.deviceType === 'nexus_dc') {
    return {
      targetSku: 'N9K-C93180YC-FX3',
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/switches/nexus-9000-series-switches/index.html',
    };
  }

  if (item.deviceType === 'collaboration') {
    return {
      targetSku: 'DP-9851-K9',
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/collaboration-endpoints/desk-phone-9800-series/index.html',
    };
  }

  if (item.deviceType === 'switch') {
    const ports = item.ports === 48 ? '48' : '24';
    const poe =
      item.isPoe === false ? 'T' : item.poeBudget === 'full_poe' && ports === '48' ? 'FP' : 'P';
    const uplink = item.uplinkType === '10G' || item.uplinkType === 'SFP+' ? '4X' : '4G';
    const tierCode = tier === 'Advantage' ? 'A' : 'E';
    return {
      targetSku: `C9200L-${ports}${poe}-${uplink}-${tierCode}`,
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html',
    };
  }

  if (item.deviceType === 'access_point') {
    return {
      targetSku: 'MR46-HW',
      wasReplacedFromEol: false,
      officialCiscoUrl: 'https://meraki.cisco.com/product/wi-fi/indoor-access-points/mr46/',
    };
  }

  if (item.deviceType === 'router') {
    return {
      targetSku: 'C8200-1N-4T',
      wasReplacedFromEol: false,
      officialCiscoUrl:
        'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
    };
  }

  if (item.deviceType === 'firewall') {
    return {
      targetSku: 'FPR1010-NGFW-K9',
      wasReplacedFromEol: false,
    };
  }

  return {
    targetSku: normalizeParentChassisSku(rawSku || 'C9200L-24P-4G-E', tier),
    wasReplacedFromEol: false,
  };
}

/**
 * Garantiza que cualquier equipo Cisco que no esté en CHASSIS_RULES ni Meraki
 * aún tenga sus sub-líneas Hijo (de la IA o de ingeniería por familia) para
 * que NUNCA falle la estructura Madre-Hijo, respetando Norma Chile/Italia (CAB-IT).
 */
function resolveFallbackSubItems(
  targetSku: string,
  item: ExtractedRequirementItem,
  merakiLicenseMode: 'coterm' | 'subscription',
  defaultPowerCordStandard: PowerCordStandard = 'italy_chile'
): SubItemConfig[] {
  const effectiveMerakiMode = item.merakiLicenseMode || merakiLicenseMode;
  const cordStd = item.powerCordStandard || defaultPowerCordStandard || 'italy_chile';

  // 1. Verificar si es Meraki (MR, CW-MR, MS, MX)
  const merakiSub = resolveMerakiSubLicense(targetSku, {
    licenseTier: item.licenseTier || 'Essentials',
    termYears: item.termYears || 3,
    merakiLicenseMode: effectiveMerakiMode,
  });
  if (merakiSub) {
    const subs: SubItemConfig[] = [merakiSub];
    if (targetSku.startsWith('MS') || targetSku.startsWith('MX')) {
      subs.push(resolvePowerCordSubItem('meraki_ms', cordStd));
    }
    return subs;
  }

  // 2. Si la IA ya estructuró los aiSubItems (Hijos), ajustarlos dinámicamente al plazo/tier/enchufe seleccionado
  if (Array.isArray(item.aiSubItems) && item.aiSubItems.length > 0) {
    const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(item.termYears);
    const tierCode = item.licenseTier === 'Advantage' ? 'A' : 'E';
    const isC9300 = targetSku.startsWith('C9300');
    const isC1200Or1300 = targetSku.startsWith('C1200') || targetSku.startsWith('C1300');
    const resolvedCord = resolvePowerCordSubItem(
      isC9300 ? 'catalyst9300' : isC1200Or1300 ? 'catalyst1200_1300' : 'catalyst9200',
      cordStd
    );

    const mappedSubs: SubItemConfig[] = item.aiSubItems
      .filter((sub) => sub && sub.partNumber && sub.partNumber.trim().toUpperCase() !== targetSku)
      .map((sub) => {
        let pNum = sub.partNumber.trim().toUpperCase();
        let desc = sub.description || `Sub-componente CCW (${pNum})`;

        // Sincronizar cable de poder según el selector Norma Chile/Italia vs PDU vs Schuko vs NEMA USA vs Argentina
        if (
          /^(?:CAB-ACA|CAB-ACE|CAB-TA-IT|CAB-TA-EU|CAB-TA-NA|CAB-TA-AR|CAB-C13-IT|CAB-C13-CE|CAB-C13-C14-2M|CAB-C15-CBN|CAB-AC|CAB-ACR|MA-PWR-CORD-IT|MA-PWR-CORD-EU|MA-PWR-CORD-US|MA-PWR-CORD-AR)$/i.test(
            pNum
          )
        ) {
          pNum = resolvedCord.partNumber;
          desc = resolvedCord.description;
        }

        const isDnaOrLic =
          pNum.includes('-DNA-') ||
          pNum.startsWith('DNA-') ||
          pNum.startsWith('LIC-') ||
          pNum.startsWith('L-FPR') ||
          pNum.startsWith('DC-') ||
          pNum.startsWith('DCN-') ||
          pNum.startsWith('IE3') ||
          Boolean(sub.durationMonths);

        if (pNum.includes('-DNA-')) {
          pNum = pNum
            .replace(/-DNA-(E|A)-/i, `-DNA-${tierCode}-`)
            .replace(/-(1|3|5|7)Y$/i, `-${skuSuffixYear}Y`);
        } else if (pNum.includes('-NW-')) {
          pNum = pNum.replace(/-NW-(E|A)-/i, `-NW-${tierCode}-`);
        }

        return {
          partNumber: pNum,
          qtyMultiplier: Number(sub.qtyMultiplier) > 0 ? Number(sub.qtyMultiplier) : 1,
          durationMonths: isDnaOrLic ? months : undefined,
          initialTerm: isDnaOrLic ? months : undefined,
          billingModel: isDnaOrLic ? sub.billingModel || 'Prepaid Term' : undefined,
          description: desc,
        };
      });

    if (item.includeSmartNet && !mappedSubs.some((s) => s.partNumber.startsWith('CON-SNT'))) {
      const sntSub = resolveSmartNetSubItem(targetSku, {
        licenseTier: item.licenseTier || 'Essentials',
        termYears: item.termYears || 3,
        includeSmartNet: true,
        smartNetLevel: item.smartNetLevel || '8x5xNBD',
      });
      if (sntSub) mappedSubs.push(sntSub);
    }

    return mappedSubs;
  }

  // 3. Fallback universal por tipo de dispositivo para que siempre exista Madre-Hijo con cable Norma Chile/Italia
  const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(item.termYears);
  const tierCode = item.licenseTier === 'Advantage' ? 'A' : 'E';
  const cordItem = resolvePowerCordSubItem('catalyst9200', cordStd);
  const baseSubs: SubItemConfig[] = [];

  if (targetSku.startsWith('FPR') || item.deviceType === 'firewall') {
    const baseFpr = targetSku.split('-')[0] || 'FPR1010';
    baseSubs.push(
      {
        partNumber: `L-${baseFpr}T-TMC-${skuSuffixYear}Y`,
        qtyMultiplier: 1,
        durationMonths: months,
        initialTerm: months,
        billingModel: 'Prepaid Term',
        description: `Cisco Secure Firewall ${baseFpr} Threat, Malware & URL License (${skuSuffixYear}Y)`,
      },
      cordItem
    );
  } else if (targetSku.startsWith('CW91') || item.deviceType === 'access_point') {
    baseSubs.push(
      {
        partNumber: `DNA-E-${skuSuffixYear}Y`,
        qtyMultiplier: 1,
        durationMonths: months,
        initialTerm: months,
        billingModel: 'Prepaid Term',
        description: `Cisco Wireless DNA ${item.licenseTier || 'Essentials'} Term (${skuSuffixYear}Y)`,
      },
      {
        partNumber: 'AIR-AP-BRACKET-2',
        qtyMultiplier: 1,
        description: 'Cisco AP Universal Mounting Bracket',
      }
    );
  } else if (targetSku.startsWith('ISR') || targetSku.startsWith('C11') || item.deviceType === 'router') {
    baseSubs.push(
      {
        partNumber: `DNA-C-T0-${tierCode}-${skuSuffixYear}Y`,
        qtyMultiplier: 1,
        durationMonths: months,
        initialTerm: months,
        billingModel: 'Prepaid Term',
        description: `Cisco DNA Subscription for Router (${skuSuffixYear}Y)`,
      },
      cordItem
    );
  }

  if (item.includeSmartNet) {
    const sntSub = resolveSmartNetSubItem(targetSku, {
      licenseTier: item.licenseTier || 'Essentials',
      termYears: item.termYears || 3,
      includeSmartNet: true,
      smartNetLevel: item.smartNetLevel || '8x5xNBD',
    });
    if (sntSub) baseSubs.push(sntSub);
  }

  return baseSubs;
}

/**
 * Construye las filas secuenciales de ensamblado CCW (MADRE -> HIJOS) y las cruza con Fast Track DB
 */
export async function buildAssembledCcwRows(
  req: ExtractedRequirementResult,
  merakiLicenseMode: 'coterm' | 'subscription' = 'subscription',
  defaultPowerCordStandard: PowerCordStandard = 'italy_chile'
): Promise<CcwAssembledRow[]> {
  const rows: CcwAssembledRow[] = [];

  for (let idx = 0; idx < (req.items || []).length; idx++) {
    const item = req.items[idx];
    const qty = item.quantity > 0 ? item.quantity : 1;
    const { targetSku, wasReplacedFromEol, eolReason, officialCiscoUrl } = resolveTargetSkuForItem(item);

    const containerChildModel = targetSku.includes(':') ? targetSku.split(':')[1] : undefined;
    const ftMatch = await checkSkuInFastTrackDb(containerChildModel || targetSku);
    const rule = resolveChassisRule(targetSku);
    const effectiveCordStd = item.powerCordStandard || defaultPowerCordStandard || 'italy_chile';
    const effectiveMerakiMode = item.merakiLicenseMode || merakiLicenseMode;
    const itemDiscountPct =
      typeof item.discountPct === 'number' && item.discountPct >= 0 && item.discountPct <= 99
        ? item.discountPct
        : item.unitListPriceUsd && item.unitNetPriceUsd && item.unitListPriceUsd > 0
          ? Number(((1 - item.unitNetPriceUsd / item.unitListPriceUsd) * 100).toFixed(2))
          : 0;

    if (rule) {
      const subItems = rule.defaultSubItems({
        licenseTier: item.licenseTier || 'Essentials',
        termYears: item.termYears || 3,
        isPoe: item.isPoe ?? true,
        uplinkType: item.uplinkType,
        includeStackingKit: item.includeStacking,
        includeRedundantPsu: item.includeRedundantPsu,
        includeSmartNet: item.includeSmartNet,
        smartNetLevel: item.smartNetLevel || '8x5xNBD',
        powerCordStandard: effectiveCordStd,
        merakiLicenseMode: effectiveMerakiMode,
        selectedModel: containerChildModel,
      });

      const isVirtualContainer = rule.parentSku === 'MS130-SWITCHES';
      const rawChassisGpl =
        (item.unitListPriceUsd && item.unitListPriceUsd > 0 ? item.unitListPriceUsd : undefined) ||
        ftMatch?.listPrice ||
        estimateReferencePriceUsd(containerChildModel ? targetSku : rule.parentSku, true);

      const parentUnitUsd = isVirtualContainer ? 0 : rawChassisGpl;
      const parentUnitNet = Number((parentUnitUsd * (1 - itemDiscountPct / 100)).toFixed(2));

      let childrenUnitGplSum = 0;
      const builtChildRows: CcwAssembledRow[] = [];

      for (let sIdx = 0; sIdx < subItems.length; sIdx++) {
        const sub = subItems[sIdx];
        const childQty = qty * sub.qtyMultiplier;
        const aiMatchingSub = Array.isArray(item.aiSubItems)
          ? item.aiSubItems.find(
              (a) => (a.partNumber || '').trim().toUpperCase() === sub.partNumber.trim().toUpperCase()
            )
          : undefined;
        const childUnitUsd =
          (aiMatchingSub?.unitListPriceUsd !== undefined && aiMatchingSub.unitListPriceUsd >= 0
            ? aiMatchingSub.unitListPriceUsd
            : undefined) ?? estimateReferencePriceUsd(sub.partNumber, false);
        const childDiscPct =
          aiMatchingSub?.discountPct !== undefined ? aiMatchingSub.discountPct : itemDiscountPct;
        const childUnitNet = Number((childUnitUsd * (1 - childDiscPct / 100)).toFixed(2));

        childrenUnitGplSum += childUnitUsd * sub.qtyMultiplier;

        builtChildRows.push({
          rowId: `row-${idx}-sub-${sIdx}`,
          parentIndex: idx,
          isParent: false,
          partNumber: sub.partNumber,
          quantity: childQty,
          durationMonths: sub.durationMonths || '',
          listPrice: '',
          discountPct: childDiscPct > 0 ? childDiscPct : '',
          initialTerm: sub.initialTerm || '',
          autoRenewTerm: sub.autoRenewTerm || '',
          billingModel: sub.billingModel || '',
          requestedStartDate: '',
          notes: sub.description,
          estimatedUnitListUsd: childUnitUsd,
          estimatedTotalListUsd: childUnitUsd * childQty,
          clientDiscountPct: childDiscPct,
          estimatedUnitNetUsd: childUnitNet,
          estimatedTotalNetUsd: childUnitNet * childQty,
        });
      }

      const unitSolutionGplUsd = Number((parentUnitUsd + childrenUnitGplSum).toFixed(2));
      const totalSolutionGplUsd = Number((unitSolutionGplUsd * qty).toFixed(2));

      // 1. Fila MADRE (Chasis Principal o Contenedor Oficial CCW como MS130-SWITCHES)
      rows.push({
        rowId: `row-${idx}-parent`,
        parentIndex: idx,
        isParent: true,
        partNumber: rule.parentSku,
        quantity: qty,
        durationMonths: '',
        listPrice: item.unitListPriceUsd && item.unitListPriceUsd > 0 ? item.unitListPriceUsd : '',
        discountPct: itemDiscountPct > 0 ? itemDiscountPct : '',
        initialTerm: '',
        autoRenewTerm: '',
        billingModel: '',
        requestedStartDate: '',
        notes: item.notes || rule.description,
        rawMentionedSku: item.rawMentionedSku,
        resolvedChildModel: containerChildModel,
        wasReplacedFromEol,
        isNonExistentSku: Boolean(item.isNonExistentSku),
        clientRequestedPowerCord: Boolean(item.clientRequestedPowerCord),
        eolReason,
        officialCiscoUrl: officialCiscoUrl || rule.officialUrl,
        isGoldenTemplate: Boolean(rule.isGoldenTemplate),
        goldenTemplateName: rule.goldenTemplateName,
        goldenTemplateSource: rule.goldenTemplateSource,
        fastTrackInfo: ftMatch,
        estimatedUnitListUsd: parentUnitUsd,
        estimatedTotalListUsd: parentUnitUsd * qty,
        unitChassisGplUsd: rawChassisGpl,
        unitSolutionGplUsd,
        totalSolutionGplUsd,
        clientDiscountPct: itemDiscountPct,
        estimatedUnitNetUsd: parentUnitNet,
        estimatedTotalNetUsd: parentUnitNet * qty,
      });

      // 2. Filas HIJAS consecutivas
      rows.push(...builtChildRows);
    } else {
      const parentUnitUsd =
        (item.unitListPriceUsd && item.unitListPriceUsd > 0 ? item.unitListPriceUsd : undefined) ||
        ftMatch?.listPrice ||
        estimateReferencePriceUsd(targetSku, true);
      const parentUnitNet = Number((parentUnitUsd * (1 - itemDiscountPct / 100)).toFixed(2));

      const fallbackSubs = resolveFallbackSubItems(
        targetSku,
        item,
        effectiveMerakiMode,
        effectiveCordStd
      );

      let childrenUnitGplSum = 0;
      const builtFallbackChildRows: CcwAssembledRow[] = [];

      for (let sIdx = 0; sIdx < fallbackSubs.length; sIdx++) {
        const sub = fallbackSubs[sIdx];
        const childQty = qty * sub.qtyMultiplier;
        const childUnitUsd =
          (sub.unitListPriceUsd !== undefined && sub.unitListPriceUsd >= 0
            ? sub.unitListPriceUsd
            : undefined) ?? estimateReferencePriceUsd(sub.partNumber, false);
        const childDiscPct =
          sub.discountPct !== undefined ? sub.discountPct : itemDiscountPct;
        const childUnitNet = Number((childUnitUsd * (1 - childDiscPct / 100)).toFixed(2));

        childrenUnitGplSum += childUnitUsd * sub.qtyMultiplier;

        builtFallbackChildRows.push({
          rowId: `row-${idx}-sub-${sIdx}`,
          parentIndex: idx,
          isParent: false,
          partNumber: sub.partNumber,
          quantity: childQty,
          durationMonths: sub.durationMonths || '',
          listPrice: '',
          discountPct: childDiscPct > 0 ? childDiscPct : '',
          initialTerm: sub.initialTerm || '',
          autoRenewTerm: sub.autoRenewTerm || '',
          billingModel: sub.billingModel || '',
          requestedStartDate: '',
          notes: sub.description,
          estimatedUnitListUsd: childUnitUsd,
          estimatedTotalListUsd: childUnitUsd * childQty,
          clientDiscountPct: childDiscPct,
          estimatedUnitNetUsd: childUnitNet,
          estimatedTotalNetUsd: childUnitNet * childQty,
        });
      }

      const unitSolutionGplUsd = Number((parentUnitUsd + childrenUnitGplSum).toFixed(2));
      const totalSolutionGplUsd = Number((unitSolutionGplUsd * qty).toFixed(2));

      // 1. Fila MADRE (Equipo principal)
      rows.push({
        rowId: `row-${idx}-parent`,
        parentIndex: idx,
        isParent: true,
        partNumber: targetSku,
        quantity: qty,
        durationMonths: '',
        listPrice: item.unitListPriceUsd && item.unitListPriceUsd > 0 ? item.unitListPriceUsd : '',
        discountPct: itemDiscountPct > 0 ? itemDiscountPct : '',
        initialTerm: '',
        autoRenewTerm: '',
        billingModel: '',
        requestedStartDate: '',
        notes: item.notes || `Cisco Hardware (${targetSku})`,
        rawMentionedSku: item.rawMentionedSku,
        wasReplacedFromEol,
        isNonExistentSku: Boolean(item.isNonExistentSku),
        clientRequestedPowerCord: Boolean(item.clientRequestedPowerCord),
        eolReason,
        officialCiscoUrl,
        fastTrackInfo: ftMatch,
        estimatedUnitListUsd: parentUnitUsd,
        estimatedTotalListUsd: parentUnitUsd * qty,
        unitChassisGplUsd: parentUnitUsd,
        unitSolutionGplUsd,
        totalSolutionGplUsd,
        clientDiscountPct: itemDiscountPct,
        estimatedUnitNetUsd: parentUnitNet,
        estimatedTotalNetUsd: parentUnitNet * qty,
      });

      // 2. Filas HIJAS
      rows.push(...builtFallbackChildRows);
    }

    // 3. Si el ingeniero agregó Transceivers SFP / Fibra / DAC compatibles en este bloque Madre-Hijo
    if (Array.isArray(item.extraTransceivers) && item.extraTransceivers.length > 0) {
      for (let tIdx = 0; tIdx < item.extraTransceivers.length; tIdx++) {
        const tr = item.extraTransceivers[tIdx];
        if (!tr || !tr.sku) continue;
        const sanitizedTr = sanitizeAndValidateCcwSku(tr.sku).sanitizedSku;
        const trQty = (tr.qty > 0 ? tr.qty : 2) * qty;
        const trUnitUsd = estimateReferencePriceUsd(sanitizedTr, false);
        const trUnitNet = Number((trUnitUsd * (1 - itemDiscountPct / 100)).toFixed(2));
        rows.push({
          rowId: `row-${idx}-sfp-${tIdx}`,
          parentIndex: idx,
          isParent: false,
          partNumber: sanitizedTr,
          quantity: trQty,
          durationMonths: '',
          listPrice: '',
          discountPct: itemDiscountPct > 0 ? itemDiscountPct : '',
          initialTerm: '',
          autoRenewTerm: '',
          billingModel: '',
          requestedStartDate: '',
          notes: `${tr.description || 'Cisco Validated Transceiver Module'} (${tr.qty}x por equipo)`,
          estimatedUnitListUsd: trUnitUsd,
          estimatedTotalListUsd: trUnitUsd * trQty,
          clientDiscountPct: itemDiscountPct,
          estimatedUnitNetUsd: trUnitNet,
          estimatedTotalNetUsd: trUnitNet * trQty,
        });
      }
    }
  }

  return rows;
}

/**
 * Genera el Workbook Excel (.xlsx) con las 10 columnas oficiales de UploadExcelTemplate de Cisco CCW
 */
export async function generateCcwUploadWorkbook(
  req: ExtractedRequirementResult,
  precomputedRows?: CcwAssembledRow[]
): Promise<{
  buffer: ArrayBuffer;
  filename: string;
  summaryRows: number;
  assembledRows: CcwAssembledRow[];
}> {
  const assembledRows = precomputedRows || (await buildAssembledCcwRows(req));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  worksheet.columns = [
    { header: 'Part Number', key: 'partNumber', width: 28 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Duration (Mnths)', key: 'durationMonths', width: 18 },
    { header: 'List Price', key: 'listPrice', width: 14 },
    { header: 'Discount %', key: 'discountPct', width: 14 },
    { header: 'Initial Term(Months)', key: 'initialTerm', width: 20 },
    { header: 'Auto Renew Term(Months)', key: 'autoRenewTerm', width: 22 },
    { header: 'Billing Model', key: 'billingModel', width: 18 },
    { header: 'Requested Start Date', key: 'requestedStartDate', width: 20 },
    { header: 'Notes', key: 'notes', width: 38 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 10 };

  for (const r of assembledRows) {
    // Dejar la columna Notes vacía en el archivo UploadExcelTemplate (.xlsx) para evitar que
    // Cisco CCW inserte una fila extra de comentario sin precio (Fila 19) al exportar el Estimate.
    worksheet.addRow({
      partNumber: r.partNumber,
      quantity: r.quantity,
      durationMonths: r.durationMonths === '' ? '' : Number(r.durationMonths),
      listPrice: '',
      discountPct: r.discountPct === '' ? '' : Number(r.discountPct),
      initialTerm: r.initialTerm === '' ? '' : Number(r.initialTerm),
      autoRenewTerm: r.autoRenewTerm === '' ? '' : Number(r.autoRenewTerm),
      billingModel: r.billingModel || '',
      requestedStartDate: r.requestedStartDate || '',
      notes: '',
    });
  }

  const clientTag = (req.clientName || 'Cliente')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const filename = `CCW_BOM_Upload_${clientTag || 'Cliente'}.xlsx`;
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const buffer = rawBuffer as ArrayBuffer;

  return {
    buffer,
    filename,
    summaryRows: assembledRows.length,
    assembledRows,
  };
}

/**
 * Genera un Workbook Ejecutivo Comparativo de las 3+ Propuestas Homologadas con Valor GPL (Sin Descuentos),
 * % Homologación, Mejor % Descuento, Valor Neto Estimado y desglose Madre-Hijo, además de la hoja "Sheet1" oficial CCW.
 */
export async function generateProposalsComparisonWorkbook(params: {
  req: ExtractedRequirementResult;
  proposalsByItemIdx: Record<number, HomologatedProposal[]>;
  sortMode: ProposalPrioritySortMode;
  assembledRows: CcwAssembledRow[];
  pureGplMode?: boolean;
}): Promise<{
  buffer: ArrayBuffer;
  filename: string;
}> {
  const { req, proposalsByItemIdx, sortMode, assembledRows, pureGplMode } = params;
  const workbook = new ExcelJS.Workbook();

  // Hoja 1: Comparativo Ejecutivo de las 3+ Propuestas Homologadas (Valor GPL Sin Descuento + Prioridad)
  const compSheet = workbook.addWorksheet('Comparativo 3 Propuestas GPL');
  compSheet.columns = [
    { header: 'Prioridad #', key: 'rank', width: 14 },
    { header: 'Equipo Solicitado / EOL', key: 'requestedSku', width: 24 },
    { header: 'Propuesta SKU Madre CCW', key: 'recommendedSku', width: 28 },
    { header: 'Estrategia / Tier', key: 'strategyTag', width: 28 },
    { header: '% Homologación Técnica', key: 'compatibilityPct', width: 22 },
    { header: 'Cant.', key: 'qty', width: 10 },
    { header: 'Valor GPL Chasis Unit. (Sin Dcto USD)', key: 'unitChassisGplUsd', width: 32 },
    { header: 'Valor GPL Solución Madre-Hijo Unit. (Sin Dcto USD)', key: 'unitSolutionGplUsd', width: 42 },
    { header: 'Valor GPL Total Solución (Sin Dcto USD)', key: 'totalSolutionGplUsd', width: 36 },
    { header: '% Mejor Descuento', key: 'bestDiscountPct', width: 18 },
    { header: 'Origen Descuento', key: 'discountSourceLabel', width: 26 },
    { header: 'Valor Neto Estimado Total (USD)', key: 'totalEstimatedNetUsd', width: 28 },
    { header: 'Ahorro Estimado (USD)', key: 'totalSavingsUsd', width: 22 },
    { header: 'Score Prioridad', key: 'priorityScore', width: 16 },
    { header: 'Desglose Sub-SKUs Hijos (Licencia / Fuente / Cable)', key: 'subItemsDetail', width: 58 },
    { header: 'Justificación de Homologación', key: 'description', width: 55 },
  ];

  const headerRow = compSheet.getRow(1);
  headerRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  (req.items || []).forEach((it, idx) => {
    const qty = it.quantity > 0 ? it.quantity : 1;
    const proposals =
      proposalsByItemIdx[idx] ||
      generateHomologatedProposalsForItem({
        rawMentionedSku: it.rawMentionedSku,
        suggestedActiveSku: it.suggestedActiveSku,
        deviceType: it.deviceType,
        ports: it.ports,
        isPoe: it.isPoe,
        poeBudget: it.poeBudget,
        uplinkType: it.uplinkType,
        licenseTier: it.licenseTier || 'Essentials',
        termYears: it.termYears || 3,
        quantity: qty,
        includeStacking: it.includeStacking,
        includeRedundantPsu: it.includeRedundantPsu,
        includeSmartNet: it.includeSmartNet,
        smartNetLevel: it.smartNetLevel || '8x5xNBD',
        powerCordStandard: it.powerCordStandard || 'italy_chile',
        merakiLicenseMode: it.merakiLicenseMode || 'subscription',
        sortMode,
      });

    proposals.forEach((prop) => {
      const rawDisc = Number(prop.bestDiscountPct ?? prop.estimatedDiscountPct) || 0;
      const effectiveDisc = pureGplMode ? 0 : rawDisc;
      const gplSolutionTotal = Number(prop.totalSolutionGplUsd) || 0;
      const estNetTotal =
        Number(prop.totalEstimatedNetUsd ?? prop.estimatedTotalNetUsd) || 0;
      const effectiveNetTotal = pureGplMode ? gplSolutionTotal : estNetTotal;
      const estSavings = Number(prop.totalSavingsUsd ?? prop.estimatedSavingsUsd) || 0;
      const effectiveSavings = pureGplMode ? 0 : estSavings;
      const subList = prop.subItemsSummary || prop.subItemsBreakdown || [];

      const subDetail = subList
        .map(
          (s) =>
            `${s.qty}x ${s.partNumber} (GPL: US$${(Number(s.totalGplUsd) || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })})`
        )
        .join(' + ');

      const added = compSheet.addRow({
        rank: `Propuesta #${prop.priorityRank}`,
        requestedSku: it.rawMentionedSku || it.suggestedActiveSku || `Ítem #${idx + 1}`,
        recommendedSku: prop.recommendedSku.replace(':', ' → '),
        strategyTag: `${prop.strategyTag || 'Propuesta Homologada'} — ${prop.title}`,
        compatibilityPct: `${Number(prop.compatibilityPct) || 100}%`,
        qty,
        unitChassisGplUsd: Number(prop.unitChassisGplUsd) || 0,
        unitSolutionGplUsd: Number(prop.unitSolutionGplUsd) || 0,
        totalSolutionGplUsd: gplSolutionTotal,
        bestDiscountPct: `${effectiveDisc.toFixed(1)}%`,
        discountSourceLabel: pureGplMode
          ? 'Valor GPL Puro (0% Descuento)'
          : prop.discountSourceLabel || prop.promoBadge || 'Deal Reg',
        totalEstimatedNetUsd: effectiveNetTotal,
        totalSavingsUsd: effectiveSavings,
        priorityScore: Number(prop.priorityScore) || 0,
        subItemsDetail: subDetail,
        description: prop.description,
      });

      if (prop.priorityRank === 1) {
        added.font = { bold: true };
      }
    });
  });

  // Hoja 2: Sheet1 oficial para carga directa en Cisco CCW
  const ccwSheet = workbook.addWorksheet('Sheet1');
  ccwSheet.columns = [
    { header: 'Part Number', key: 'partNumber', width: 28 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Duration (Mnths)', key: 'durationMonths', width: 18 },
    { header: 'List Price', key: 'listPrice', width: 14 },
    { header: 'Discount %', key: 'discountPct', width: 14 },
    { header: 'Initial Term(Months)', key: 'initialTerm', width: 20 },
    { header: 'Auto Renew Term(Months)', key: 'autoRenewTerm', width: 22 },
    { header: 'Billing Model', key: 'billingModel', width: 18 },
    { header: 'Requested Start Date', key: 'requestedStartDate', width: 20 },
    { header: 'Notes', key: 'notes', width: 38 },
  ];
  ccwSheet.getRow(1).font = { bold: true, size: 10 };

  for (const r of assembledRows) {
    ccwSheet.addRow({
      partNumber: r.partNumber,
      quantity: r.quantity,
      durationMonths: r.durationMonths === '' ? '' : Number(r.durationMonths),
      listPrice: '',
      discountPct: r.discountPct === '' ? '' : Number(r.discountPct),
      initialTerm: r.initialTerm === '' ? '' : Number(r.initialTerm),
      autoRenewTerm: r.autoRenewTerm === '' ? '' : Number(r.autoRenewTerm),
      billingModel: r.billingModel || '',
      requestedStartDate: r.requestedStartDate || '',
      notes: '',
    });
  }

  const clientTag = (req.clientName || 'Cliente')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const filename = `Comparativo_3_Propuestas_GPL_${clientTag || 'Cliente'}.xlsx`;
  const rawBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: rawBuffer as ArrayBuffer,
    filename,
  };
}

/**
 * Exporta el BOM en formato compatible con Netformx DesignXpert (.csv).
 * Formato estándar Netformx: Part Number, Quantity, Description, Category, Parent Index
 */
export function generateNetformxCsv(
  req: ExtractedRequirementResult,
  assembledRows: CcwAssembledRow[]
): { content: string; filename: string } {
  const headers = 'Part Number,Quantity,Description,Category,Parent Index\n';
  const lines = assembledRows.map((r) => {
    const pn = `"${(r.partNumber || '').replace(/"/g, '""')}"`;
    const qty = r.quantity || 1;
    const desc = `"${(r.notes || r.partNumber || '').replace(/"/g, '""')}"`;
    const cat = r.isParent ? '"Chassis / Parent"' : '"Sub-Item / License"';
    const parentIdx = r.isParent ? '""' : `"${r.parentIndex}"`;
    return `${pn},${qty},${desc},${cat},${parentIdx}`;
  });

  const clientTag = (req.clientName || 'Cliente')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const filename = `Netformx_BOM_${clientTag || 'Cliente'}.csv`;
  return {
    content: headers + lines.join('\n'),
    filename,
  };
}

