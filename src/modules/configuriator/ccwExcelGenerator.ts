// ============================================================================
// CISCO AUTOMATED v2.1 - CCW UPLOAD EXCEL GENERATOR (10-COLUMN MADRE-HIJO)
// Genera el archivo Excel oficial "UploadExcelTemplate" con hoja "Sheet1" y
// orden secuencial estricto MADRE -> HIJOS para ensamblado VALID en Cisco CCW.
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
  checkSkuInFastTrackDb,
  normalizeCiscoDnaTermYears,
  sanitizeAndValidateCcwSku,
  SubItemConfig,
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
  // Metadatos enriquecidos para vista previa en UI
  rawMentionedSku?: string;
  resolvedChildModel?: string;
  wasReplacedFromEol?: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
  fastTrackInfo?: FastTrackProduct | null;
}

/**
 * Resuelve el SKU Madre objetivo de un ítem respetando:
 * 1) Si el ingeniero seleccionó una tarjeta de alternativa EOL en UI (`selectedEolAlternativeSku`).
 * 2) Si el modelo está en EOL 2026 o fue corregido por `sanitizeAndValidateCcwSku`.
 * 3) Si es un contenedor Meraki MS130 (`MS130-SWITCHES:MS130-48P`).
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

  // 1. Si el usuario eligió explícitamente una alternativa EOL en las tarjetas interactivas
  if (item.selectedEolAlternativeSku && !item.keepOriginalSku) {
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

  if (item.keepOriginalSku && rawSku) {
    return {
      targetSku: rawSku,
      wasReplacedFromEol: false,
      eolReason: item.eolReason,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  // 2. Si el SKU original está en el catálogo EOL 2026
  if (rawSku && eolEntry) {
    // Si suggested ya fue cambiado a una alternativa válida distinta del EOL original, respetarlo
    const isCustomValidAlt =
      suggested &&
      suggested !== rawSku &&
      suggested !== `${rawSku}-HW` &&
      (suggested.startsWith('MS130-SWITCHES:') ||
        suggested.startsWith('MS225-') ||
        suggested.startsWith('C9200') ||
        suggested.startsWith('C9300'));

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
 * que NUNCA falle la estructura Madre-Hijo.
 */
function resolveFallbackSubItems(
  targetSku: string,
  item: ExtractedRequirementItem,
  merakiLicenseMode: 'coterm' | 'subscription'
): SubItemConfig[] {
  // 1. Verificar si es Meraki (MR, CW-MR, MS, MX)
  const merakiSub = resolveMerakiSubLicense(targetSku, {
    licenseTier: item.licenseTier || 'Essentials',
    termYears: item.termYears || 3,
    merakiLicenseMode,
  });
  if (merakiSub) {
    return [merakiSub];
  }

  // 2. Si la IA ya estructuró los aiSubItems (Hijos), ajustarlos dinámicamente al plazo/tier seleccionado
  if (Array.isArray(item.aiSubItems) && item.aiSubItems.length > 0) {
    const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(item.termYears);
    const tierCode = item.licenseTier === 'Advantage' ? 'A' : 'E';

    return item.aiSubItems
      .filter((sub) => sub && sub.partNumber && sub.partNumber.trim().toUpperCase() !== targetSku)
      .map((sub) => {
        let pNum = sub.partNumber.trim().toUpperCase();
        const isDnaOrLic =
          pNum.includes('-DNA-') ||
          pNum.startsWith('DNA-') ||
          pNum.startsWith('LIC-') ||
          pNum.startsWith('L-FPR') ||
          Boolean(sub.durationMonths);

        // Sincronizar tier y años si el usuario cambió los selectores en la UI
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
          description: sub.description || `Sub-componente CCW (${pNum})`,
        };
      });
  }

  // 3. Fallback universal por tipo de dispositivo para que siempre exista Madre-Hijo
  const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(item.termYears);
  const tierCode = item.licenseTier === 'Advantage' ? 'A' : 'E';

  if (targetSku.startsWith('FPR') || item.deviceType === 'firewall') {
    const baseFpr = targetSku.split('-')[0] || 'FPR1010';
    return [
      {
        partNumber: `L-${baseFpr}T-TMC-${skuSuffixYear}Y`,
        qtyMultiplier: 1,
        durationMonths: months,
        initialTerm: months,
        billingModel: 'Prepaid Term',
        description: `Cisco Secure Firewall ${baseFpr} Threat, Malware & URL License (${skuSuffixYear}Y)`,
      },
      {
        partNumber: 'CAB-ACE',
        qtyMultiplier: 1,
        description: 'AC Power Cord (Europe/Chile), CEE 7/7, 1.5M',
      },
    ];
  }

  if (targetSku.startsWith('CW91') || item.deviceType === 'access_point') {
    return [
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
      },
    ];
  }

  if (targetSku.startsWith('ISR') || targetSku.startsWith('C11') || item.deviceType === 'router') {
    return [
      {
        partNumber: `DNA-C-T0-${tierCode}-${skuSuffixYear}Y`,
        qtyMultiplier: 1,
        durationMonths: months,
        initialTerm: months,
        billingModel: 'Prepaid Term',
        description: `Cisco DNA Subscription for Router (${skuSuffixYear}Y)`,
      },
      {
        partNumber: 'CAB-ACE',
        qtyMultiplier: 1,
        description: 'AC Power Cord (Europe/Chile), CEE 7/7, 1.5M',
      },
    ];
  }

  return [];
}

/**
 * Construye las filas secuenciales de ensamblado CCW (MADRE -> HIJOS) y las cruza con Fast Track DB
 */
export async function buildAssembledCcwRows(
  req: ExtractedRequirementResult,
  merakiLicenseMode: 'coterm' | 'subscription' = 'subscription'
): Promise<CcwAssembledRow[]> {
  const rows: CcwAssembledRow[] = [];

  for (let idx = 0; idx < (req.items || []).length; idx++) {
    const item = req.items[idx];
    const qty = item.quantity > 0 ? item.quantity : 1;
    const { targetSku, wasReplacedFromEol, eolReason, officialCiscoUrl } = resolveTargetSkuForItem(item);

    const containerChildModel = targetSku.includes(':') ? targetSku.split(':')[1] : undefined;
    const ftMatch = await checkSkuInFastTrackDb(containerChildModel || targetSku);
    const rule = resolveChassisRule(targetSku);

    if (rule) {
      // 1. Fila MADRE (Chasis Principal o Contenedor Oficial CCW como MS130-SWITCHES)
      rows.push({
        rowId: `row-${idx}-parent`,
        parentIndex: idx,
        isParent: true,
        partNumber: rule.parentSku,
        quantity: qty,
        durationMonths: '',
        listPrice: '',
        discountPct: '',
        initialTerm: '',
        autoRenewTerm: '',
        billingModel: '',
        requestedStartDate: '',
        notes: item.notes || rule.description,
        rawMentionedSku: item.rawMentionedSku,
        resolvedChildModel: containerChildModel,
        wasReplacedFromEol,
        eolReason,
        officialCiscoUrl: officialCiscoUrl || rule.officialUrl,
        fastTrackInfo: ftMatch,
      });

      // 2. Filas HIJAS consecutivas (Hardware MS130 / Licencia DNA o Meraki / Fuente PoE / Cable CAB-ACE / Network Stack)
      const subItems = rule.defaultSubItems({
        licenseTier: item.licenseTier || 'Essentials',
        termYears: item.termYears || 3,
        isPoe: item.isPoe ?? true,
        includeStackingKit: item.includeStacking,
        includeRedundantPsu: item.includeRedundantPsu,
        selectedModel: containerChildModel,
      });

      for (let sIdx = 0; sIdx < subItems.length; sIdx++) {
        const sub = subItems[sIdx];
        rows.push({
          rowId: `row-${idx}-sub-${sIdx}`,
          parentIndex: idx,
          isParent: false,
          partNumber: sub.partNumber,
          quantity: qty * sub.qtyMultiplier,
          durationMonths: sub.durationMonths || '',
          listPrice: '',
          discountPct: '',
          initialTerm: sub.initialTerm || '',
          autoRenewTerm: sub.autoRenewTerm || '',
          billingModel: sub.billingModel || '',
          requestedStartDate: '',
          notes: sub.description,
        });
      }
    } else {
      // 1. Fila MADRE (Equipo principal)
      rows.push({
        rowId: `row-${idx}-parent`,
        parentIndex: idx,
        isParent: true,
        partNumber: targetSku,
        quantity: qty,
        durationMonths: '',
        listPrice: '',
        discountPct: '',
        initialTerm: '',
        autoRenewTerm: '',
        billingModel: '',
        requestedStartDate: '',
        notes: item.notes || `Cisco Hardware (${targetSku})`,
        rawMentionedSku: item.rawMentionedSku,
        wasReplacedFromEol,
        eolReason,
        officialCiscoUrl,
        fastTrackInfo: ftMatch,
      });

      // 2. Filas HIJAS (Meraki, aiSubItems de la IA o fallback universal por familia)
      const fallbackSubs = resolveFallbackSubItems(targetSku, item, merakiLicenseMode);
      for (let sIdx = 0; sIdx < fallbackSubs.length; sIdx++) {
        const sub = fallbackSubs[sIdx];
        rows.push({
          rowId: `row-${idx}-sub-${sIdx}`,
          parentIndex: idx,
          isParent: false,
          partNumber: sub.partNumber,
          quantity: qty * sub.qtyMultiplier,
          durationMonths: sub.durationMonths || '',
          listPrice: '',
          discountPct: '',
          initialTerm: sub.initialTerm || '',
          autoRenewTerm: sub.autoRenewTerm || '',
          billingModel: sub.billingModel || '',
          requestedStartDate: '',
          notes: sub.description,
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
    worksheet.addRow({
      partNumber: r.partNumber,
      quantity: r.quantity,
      durationMonths: r.durationMonths === '' ? '' : Number(r.durationMonths),
      listPrice: r.listPrice === '' ? '' : Number(r.listPrice),
      discountPct: r.discountPct === '' ? '' : Number(r.discountPct),
      initialTerm: r.initialTerm === '' ? '' : Number(r.initialTerm),
      autoRenewTerm: r.autoRenewTerm === '' ? '' : Number(r.autoRenewTerm),
      billingModel: r.billingModel || '',
      requestedStartDate: r.requestedStartDate || '',
      notes: r.notes || '',
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
