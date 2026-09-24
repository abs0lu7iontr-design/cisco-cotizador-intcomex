// ============================================================================
// CISCO AUTOMATED v2.1 - CCW UPLOAD EXCEL GENERATOR (10-COLUMN OFFICIAL FORMAT)
// Genera el archivo Excel oficial "UploadExcelTemplate" con hoja "Sheet1" y
// orden secuencial estricto Padre -> Hijas para ensamblado VALID en Cisco CCW.
// ============================================================================

import ExcelJS from 'exceljs';
import { ExtractedRequirementResult, ExtractedRequirementItem } from './aiBomExtractor';
import {
  EOL_CATALOG_2026,
  EOL_MAPPING,
  resolveChassisRule,
  resolveMerakiSubLicense,
  checkSkuInFastTrackDb,
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
  wasReplacedFromEol?: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
  fastTrackInfo?: FastTrackProduct | null;
}

/**
 * Resuelve el SKU objetivo de un ítem respetando si el modelo sigue vigente en 2026
 * o si el usuario eligió mantener el SKU original.
 */
export function resolveTargetSkuForItem(item: ExtractedRequirementItem): {
  targetSku: string;
  wasReplacedFromEol: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
} {
  const rawSku = (item.rawMentionedSku || '').trim().toUpperCase();
  const suggested = (item.suggestedActiveSku || '').trim().toUpperCase();

  // Si el usuario pidió explícitamente mantener el SKU original (cuando no está bloqueado o por decisión propia)
  if (item.keepOriginalSku && rawSku) {
    return {
      targetSku: rawSku,
      wasReplacedFromEol: false,
      eolReason: item.eolReason,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  // Verificar catálogo EOL 2026
  if (rawSku && EOL_CATALOG_2026[rawSku]) {
    const entry = EOL_CATALOG_2026[rawSku];
    return {
      targetSku: entry.replacementSku,
      wasReplacedFromEol: true,
      eolReason: entry.eolNote,
      officialCiscoUrl: entry.officialCiscoDocUrl || item.officialCiscoUrl,
    };
  }

  // Si la IA detectó que es EOL 2026 y dio un reemplazo distinto
  if (rawSku && item.isEol2026 && suggested && suggested !== rawSku) {
    return {
      targetSku: suggested,
      wasReplacedFromEol: true,
      eolReason: item.eolReason || `Reemplazo sugerido 2026 para ${rawSku}`,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  // Si el modelo NO es EOL en 2026 y existe rawSku, se mantiene el SKU original sin reemplazarlo
  if (rawSku && !item.isEol2026 && !EOL_MAPPING[rawSku]) {
    return {
      targetSku: rawSku,
      wasReplacedFromEol: false,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  if (suggested) {
    return {
      targetSku: suggested,
      wasReplacedFromEol: Boolean(rawSku && rawSku !== suggested),
      eolReason: item.eolReason,
      officialCiscoUrl: item.officialCiscoUrl,
    };
  }

  // Deducción determinista por características cuando no vino SKU
  if (item.deviceType === 'switch') {
    const ports = item.ports === 48 ? '48' : '24';
    const poe = item.isPoe === false ? 'T' : item.poeBudget === 'full_poe' && ports === '48' ? 'FP' : 'P';
    const uplink = item.uplinkType === '10G' || item.uplinkType === 'SFP+' ? '4X' : '4G';
    const tier = item.licenseTier === 'Advantage' ? 'A' : 'E';
    return {
      targetSku: `C9200L-${ports}${poe}-${uplink}-${tier}`,
      wasReplacedFromEol: false,
      officialCiscoUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html',
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
      officialCiscoUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
    };
  }

  if (item.deviceType === 'firewall') {
    return {
      targetSku: 'FPR1010-NGFW-K9',
      wasReplacedFromEol: false,
    };
  }

  return {
    targetSku: rawSku || 'C9200L-24P-4G-E',
    wasReplacedFromEol: false,
  };
}

/**
 * Construye las filas secuenciales de ensamblado CCW y las cruza con Fast Track DB
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

    // Cruce con base de datos local Fast Track
    const ftMatch = await checkSkuInFastTrackDb(targetSku);

    // Verificar si el SKU tiene regla de ensamblaje (Catalyst 9200/9300/1200/1300/8000)
    const rule = resolveChassisRule(targetSku);

    if (rule) {
      // 1. Fila Padre (Chasis Principal)
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
        wasReplacedFromEol,
        eolReason,
        officialCiscoUrl: officialCiscoUrl || rule.officialUrl,
        fastTrackInfo: ftMatch,
      });

      // 2. Filas Hijas consecutivas (Licencia DNA, Fuente PoE, Cable CAB-ACE, Network Stack, Stacking Kit)
      const subItems = rule.defaultSubItems({
        licenseTier: item.licenseTier || 'Essentials',
        termYears: item.termYears || 3,
        isPoe: item.isPoe ?? true,
        includeStackingKit: item.includeStacking,
        includeRedundantPsu: item.includeRedundantPsu,
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
      // Producto plano o Meraki (MR / CW / MS / MX)
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

      // Si es equipo Meraki, agregar su licencia inmediatamente debajo
      const merakiSub = resolveMerakiSubLicense(targetSku, {
        licenseTier: item.licenseTier || 'Essentials',
        termYears: item.termYears || 3,
        merakiLicenseMode,
      });

      if (merakiSub) {
        rows.push({
          rowId: `row-${idx}-meraki-lic`,
          parentIndex: idx,
          isParent: false,
          partNumber: merakiSub.partNumber,
          quantity: qty * merakiSub.qtyMultiplier,
          durationMonths: merakiSub.durationMonths || '',
          listPrice: '',
          discountPct: '',
          initialTerm: merakiSub.initialTerm || '',
          autoRenewTerm: '',
          billingModel: merakiSub.billingModel || '',
          requestedStartDate: '',
          notes: merakiSub.description,
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
): Promise<{ buffer: ArrayBuffer; filename: string; summaryRows: number; assembledRows: CcwAssembledRow[] }> {
  const assembledRows = precomputedRows || (await buildAssembledCcwRows(req));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // Encabezados oficiales exactos de UploadExcelTemplate de Cisco CCW (Fila 1)
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

  // Estilizar sutilmente la fila 1 de encabezados para legibilidad sin alterar el parser de CCW
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
