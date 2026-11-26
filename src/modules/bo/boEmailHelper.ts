// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: EMAIL & HTML CLIPBOARD
// ============================================================================

import { BoLineItem } from './boTypes';
import { getMotherLineKey } from '../../core/calculations';
import {
  copyHtmlAndTextToClipboard,
  ClipboardCopyDetailedResult,
} from '../../core/emailClipboardHelper';
import { escapeHtml } from '../../utils/exportSanitizers';

export const DEFAULT_BO_EMAIL_TO = 'ventascore.cl@intcomex.com';
export const DEFAULT_BO_EMAIL_CC = 'ciscoteam.cl@intcomex.com';
export const BO_EMAIL_TO = DEFAULT_BO_EMAIL_TO;
export const BO_EMAIL_CC = DEFAULT_BO_EMAIL_CC;

export const formatCLP = (val: number, decimals: number = 2): string => {
  return Number(val || 0).toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCL = formatCLP;

export interface BoTableExportOptions {
  groupByLine?: boolean;
  selectedLine?: string; // 'ALL' or specific motherLine like '1.0'
  partnerPosByLine?: Record<string, string>; // Mapeo de N° de OC del Partner por cada Línea Madre
  partnerName?: string; // Nombre del Partner o Reseller para cruce comercial
  clientName?: string; // Nombre del Cliente Final para cruce comercial
  dealId?: string; // Deal ID Cisco CCW
  estimateId?: string; // Estimate ID Cisco CCW
}

/**
 * Siglas y acrónimos comerciales corporativos que deben mantenerse en mayúsculas.
 */
const BUSINESS_ACRONYMS = new Set([
  'SA', 'S.A.', 'SPA', 'S.P.A.', 'LTDA', 'EIRL', 'SL', 'SRL', 'LLC', 'INC', 'CORP',
  'IBM', 'TI', 'HW', 'SW', 'BO', 'OC', 'CCW', 'VPN', 'IP', 'GPL', 'USA', 'USA.', 'PCS'
]);

/**
 * Normaliza nombres comerciales de Partners y Clientes Finales asegurando
 * que cada palabra comience con letra Mayúscula (Title Case), preservando
 * siglas comunes (S.A., SpA, LTDA, IBM, etc.).
 */
export function capitalizeBusinessName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  let text = trimmed;
  const lettersOnly = text.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g, '');
  if (lettersOnly.length > 3 && text === text.toUpperCase()) {
    text = text.toLowerCase();
  }

  return text
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      const cleanUpper = word.replace(/[^a-zA-Z.]/g, '').toUpperCase();
      if (BUSINESS_ACRONYMS.has(cleanUpper) || BUSINESS_ACRONYMS.has(word.toUpperCase())) {
        return word.toUpperCase();
      }
      if (/^[a-zA-Z]\.([a-zA-Z]\.?)+$/.test(word)) {
        return word.toUpperCase();
      }
      if (word.includes('-')) {
        return word
          .split('-')
          .map((sub) => sub.charAt(0).toUpperCase() + sub.slice(1))
          .join('-');
      }
      if (word.startsWith('(') && word.length > 1) {
        return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Obtiene el saludo dinámico según la hora local del sistema:
 * - Antes de las 12:00 hrs -> "Buenos días"
 * - Desde las 12:00 hrs en adelante -> "Buenas tardes"
 */
export function getBoTimeBasedGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'Buenos días' : 'Buenas tardes';
}

/**
 * Genera la tabla HTML compatible con el portapapeles de Microsoft Outlook.
 * Admite tanto vista unificada estándar como agrupación por Línea Madre (con subtotales por OC
 * y Total General al final).
 */
export function generateBoHtmlTable(
  lines: BoLineItem[],
  options?: BoTableExportOptions
): string {
  const isGrouped = Boolean(options?.groupByLine);
  const selectedLine = options?.selectedLine && options.selectedLine !== 'ALL' ? options.selectedLine : null;

  let activeLines = lines.filter(
    (l) => !l.isExcludedZeroCost && (l.extendedNetPrice > 0 || l.unitNetPrice > 0)
  );

  if (selectedLine) {
    activeLines = activeLines.filter(
      (l) => (l.motherLine || getMotherLineKey(l.lineNumber)) === selectedLine
    );
  }

  const greeting = getBoTimeBasedGreeting();
  const totalVenta = activeLines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);
  const totalQty = activeLines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);

  let rowsHtml = '';

  if (isGrouped && !selectedLine) {
    // Agrupar ítems por línea madre (ej. 1.0, 2.0...)
    const groupMap = new Map<string, BoLineItem[]>();
    for (const line of activeLines) {
      const motherKey = line.motherLine || getMotherLineKey(line.lineNumber) || '1.0';
      if (!groupMap.has(motherKey)) {
        groupMap.set(motherKey, []);
      }
      groupMap.get(motherKey)!.push(line);
    }

    // Ordenar numéricamente por línea madre
    const sortedKeys = Array.from(groupMap.keys()).sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
    );

    const groupSections: string[] = [];
    for (const motherKey of sortedKeys) {
      const groupItems = groupMap.get(motherKey)!;
      const groupQty = groupItems.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
      const groupSubtotal = groupItems.reduce(
        (acc, l) => acc + (Number(l.extendedNetPrice) || 0),
        0
      );

      // Identificar naturaleza del bloque (Hardware E1 vs Licencias ED vs Mixto)
      const hasHw = groupItems.some((l) => l.isHardware);
      const hasSvc = groupItems.some((l) => l.isServiceOrLicense);
      const typeBadge = hasHw && !hasSvc
        ? ' [🔧 Hardware - Bodega E1]'
        : !hasHw && hasSvc
        ? ' [☁️ Licencias / SaaS - Bodega ED]'
        : ' [📦 Mixto HW + SW]';

      const partnerPo = options?.partnerPosByLine?.[motherKey]?.trim();
      const poLabel = partnerPo ? ` — OC Partner: ${escapeHtml(partnerPo)}` : '';

      // Fila de encabezado de bloque de línea madre con Badge de Tipo y OC
      const headerRow = `
      <tr style="background-color: #e2e8f0; font-family: Calibri, sans-serif; font-size: 11pt; font-weight: bold; color: #1e293b;">
        <td colspan="6" style="border: 1px solid #000; padding: 6px; text-align: left;">
          📦 Bloque Línea ${escapeHtml(motherKey)}${escapeHtml(typeBadge)}${poLabel} (${groupItems.length} ${groupItems.length === 1 ? 'ítem' : 'ítems'})
        </td>
      </tr>
      <tr style="background-color: #cbd5e1; color: #000; font-weight: bold; font-family: Calibri, sans-serif; font-size: 10pt; text-align: center;">
        <th style="border: 1px solid #000; padding: 4px;">SKU</th>
        <th style="border: 1px solid #000; padding: 4px;">Part Number</th>
        <th style="border: 1px solid #000; padding: 4px;">Bodega</th>
        <th style="border: 1px solid #000; padding: 4px;">Qty</th>
        <th style="border: 1px solid #000; padding: 4px;">Unit Net Price</th>
        <th style="border: 1px solid #000; padding: 4px;">Extended Net Price</th>
      </tr>`;

      // Filas de los ítems del bloque
      const itemRows = groupItems
        .map(
          (line) => `
      <tr style="text-align: center; font-family: Calibri, sans-serif; font-size: 11pt;">
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(line.sku || 'N/A')}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(line.partNumber)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(line.bodega)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${line.qty}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCLP(line.unitNetPrice, 2)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCLP(line.extendedNetPrice, 2)}</td>
      </tr>`
        )
        .join('');

      // Fila de Subtotal de este bloque de línea
      const subtotalRow = `
      <tr style="background-color: #f1f5f9; font-family: Calibri, sans-serif; font-size: 11pt; font-weight: bold; color: #334155;">
        <td colspan="3" style="border: 1px solid #000; padding: 6px; text-align: right;">Subtotal Línea ${escapeHtml(motherKey)}:</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${groupQty}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">—</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; color: #059669;">$${formatCLP(groupSubtotal, 2)}</td>
      </tr>`;

      groupSections.push(headerRow + itemRows + subtotalRow);
    }

    rowsHtml = groupSections.join('');
  } else {
    // Vista unificada estándar (o línea única filtrada)
    rowsHtml = activeLines
      .map(
        (line) => `
      <tr style="text-align: center; font-family: Calibri, sans-serif; font-size: 11pt;">
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(line.sku || 'N/A')}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${escapeHtml(line.partNumber)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(line.bodega)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${line.qty}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCLP(line.unitNetPrice, 2)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCLP(line.extendedNetPrice, 2)}</td>
      </tr>`
      )
      .join('');
  }

  const grandTotalLabel = selectedLine
    ? `Total Línea ${escapeHtml(selectedLine)}:`
    : isGrouped
    ? `Total General (Todas las Líneas):`
    : `Total General:`;

  // Ficha de Referencia y Cruce Comercial: Partner y Cliente Final (como abajo de la cotización)
  let referenceBlockHtml = '';
  if (options?.partnerName || options?.clientName || options?.dealId || options?.estimateId) {
    const partner = escapeHtml(capitalizeBusinessName(options.partnerName) || 'Intcomex Partner');
    const client = escapeHtml(capitalizeBusinessName(options.clientName) || 'Cliente Final');
    const dealId = options.dealId && options.dealId !== 'NA' ? escapeHtml(options.dealId) : null;
    const estimateId = options.estimateId && options.estimateId !== 'NA' ? escapeHtml(options.estimateId) : null;
    const currentPo = selectedLine && options.partnerPosByLine?.[selectedLine]?.trim()
      ? escapeHtml(options.partnerPosByLine[selectedLine].trim())
      : null;

    referenceBlockHtml = `
  <!-- Ficha de Referencia y Cruce Comercial: Partner y Cliente Final -->
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 850px; margin-top: 10px; margin-bottom: 6px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 4px;">
    <tr>
      <td width="140" style="border: 1px solid #cbd5e1; padding: 6px 12px; background-color: #f1f5f9; font-weight: bold; color: #475569; width: 140px;">
        Partner / Reseller:
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 12px; color: #0f172a; font-weight: bold;">
        ${partner}
      </td>
      <td width="140" style="border: 1px solid #cbd5e1; padding: 6px 12px; background-color: #f1f5f9; font-weight: bold; color: #475569; width: 140px;">
        Cliente Final:
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 12px; color: #0f172a; font-weight: bold;">
        ${client}
      </td>
    </tr>
    ${(dealId || estimateId || currentPo) ? `
    <tr>
      <td width="140" style="border: 1px solid #cbd5e1; padding: 5px 12px; background-color: #f8fafc; font-size: 9pt; color: #64748b; width: 140px;">
        Deal ID:
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 12px; font-size: 9pt; font-family: Consolas, monospace; color: #1e293b;">
        ${dealId || 'N/A'}
      </td>
      <td width="140" style="border: 1px solid #cbd5e1; padding: 5px 12px; background-color: #f8fafc; font-size: 9pt; color: #64748b; width: 140px;">
        ${estimateId ? 'Estimate ID:' : 'OC Partner:'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 12px; font-size: 9pt; font-family: Consolas, monospace; color: #4338ca; font-weight: bold;">
        ${estimateId ? (currentPo ? `${estimateId} (OC: ${currentPo})` : estimateId) : (currentPo || 'N/A')}
      </td>
    </tr>` : ''}
  </table>`;
  }

  return `
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">Estimados,</p>
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">${greeting}, por favor crear BO${selectedLine ? ` para Línea ${escapeHtml(selectedLine)}` : ''}.</p>
  <table style="border-collapse: collapse; width: 100%; max-width: 850px; font-family: Calibri, sans-serif; font-size: 11pt; border: 1px solid #000;">
    <thead>
      <tr style="background-color: #808080; color: #000; font-weight: bold; text-align: center;">
        <th style="border: 1px solid #000; padding: 6px;">SKU</th>
        <th style="border: 1px solid #000; padding: 6px;">Part Number</th>
        <th style="border: 1px solid #000; padding: 6px;">Bodega</th>
        <th style="border: 1px solid #000; padding: 6px;">Qty</th>
        <th style="border: 1px solid #000; padding: 6px;">Unit Net Price</th>
        <th style="border: 1px solid #000; padding: 6px;">Extended Net Price</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="font-family: Calibri, sans-serif; font-size: 11pt; font-weight: bold; background-color: #f2f2f2; border-top: 2px solid #000;">
        <td colspan="3" style="border: 1px solid #000; padding: 6px; text-align: right;">${grandTotalLabel}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${totalQty}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">—</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; color: #047857;">$${formatCLP(totalVenta, 2)} USD</td>
      </tr>
    </tbody>
  </table>
  ${referenceBlockHtml}
  <br/>
  `;
}

/**
 * Genera el texto plano tabulado de la tabla BO como fallback.
 */
export function generateBoPlainTextTable(
  lines: BoLineItem[],
  options?: BoTableExportOptions
): string {
  const isGrouped = Boolean(options?.groupByLine);
  const selectedLine = options?.selectedLine && options.selectedLine !== 'ALL' ? options.selectedLine : null;

  let activeLines = lines.filter(
    (l) => !l.isExcludedZeroCost && (l.extendedNetPrice > 0 || l.unitNetPrice > 0)
  );

  if (selectedLine) {
    activeLines = activeLines.filter(
      (l) => (l.motherLine || getMotherLineKey(l.lineNumber)) === selectedLine
    );
  }

  const greeting = getBoTimeBasedGreeting();
  const totalVenta = activeLines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);
  const totalQty = activeLines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);

  let rowsText = '';

  if (isGrouped && !selectedLine) {
    const groupMap = new Map<string, BoLineItem[]>();
    for (const line of activeLines) {
      const motherKey = line.motherLine || getMotherLineKey(line.lineNumber) || '1.0';
      if (!groupMap.has(motherKey)) {
        groupMap.set(motherKey, []);
      }
      groupMap.get(motherKey)!.push(line);
    }

    const sortedKeys = Array.from(groupMap.keys()).sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
    );

    const sections: string[] = [];
    for (const motherKey of sortedKeys) {
      const groupItems = groupMap.get(motherKey)!;
      const groupQty = groupItems.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
      const groupSubtotal = groupItems.reduce(
        (acc, l) => acc + (Number(l.extendedNetPrice) || 0),
        0
      );

      // Identificar naturaleza del bloque (Hardware E1 vs Licencias ED vs Mixto)
      const hasHw = groupItems.some((l) => l.isHardware);
      const hasSvc = groupItems.some((l) => l.isServiceOrLicense);
      const typeBadge = hasHw && !hasSvc
        ? ' [🔧 Hardware - E1]'
        : !hasHw && hasSvc
        ? ' [☁️ Licencias / SaaS - ED]'
        : ' [📦 Mixto HW + SW]';

      const partnerPo = options?.partnerPosByLine?.[motherKey]?.trim();
      const poLabel = partnerPo ? ` (OC Partner: ${partnerPo})` : '';

      const itemsText = groupItems
        .map(
          (l) =>
            `${l.sku || 'N/A'}\t${l.partNumber}\t${l.bodega}\t${l.qty}\t${formatCLP(l.unitNetPrice, 2)}\t${formatCLP(l.extendedNetPrice, 2)}`
        )
        .join('\n');
      sections.push(
        `--- Bloque Línea ${motherKey}${typeBadge}${poLabel} (${groupItems.length} ítems) ---\nSKU\tPart Number\tBodega\tQty\tUnit Net Price\tExtended Net Price\n${itemsText}\nSubtotal Línea ${motherKey}:\t\t\t${groupQty}\t—\t$${formatCLP(groupSubtotal, 2)} USD`
      );
    }
    rowsText = sections.join('\n\n');
  } else {
    rowsText = activeLines
      .map(
        (l) =>
          `${l.sku || 'N/A'}\t${l.partNumber}\t${l.bodega}\t${l.qty}\t${formatCLP(l.unitNetPrice, 2)}\t${formatCLP(l.extendedNetPrice, 2)}`
      )
      .join('\n');
  }

  const grandTotalLabel = selectedLine
    ? `Total Línea ${selectedLine}:`
    : isGrouped
    ? `Total General (Todas las Líneas):`
    : `Total General:`;

  let refText = '';
  if (options?.partnerName || options?.clientName || options?.dealId || options?.estimateId) {
    const partner = capitalizeBusinessName(options.partnerName) || 'Intcomex Partner';
    const client = capitalizeBusinessName(options.clientName) || 'Cliente Final';
    const dealId = options.dealId && options.dealId !== 'NA' ? options.dealId : null;
    const estimateId = options.estimateId && options.estimateId !== 'NA' ? options.estimateId : null;
    const currentPo = selectedLine ? options.partnerPosByLine?.[selectedLine]?.trim() : null;

    refText = `\n\nDATOS DE REFERENCIA COMERCIAL (CRUCE):\n• Partner / Reseller: ${partner}\n• Cliente Final: ${client}`;
    if (dealId || estimateId) {
      refText += `\n• Deal ID: ${dealId || 'N/A'}${estimateId ? ` | Estimate ID: ${estimateId}` : ''}`;
    }
    if (currentPo) {
      refText += `\n• OC Partner (Línea ${selectedLine}): ${currentPo}`;
    }
  }

  return `Estimados,\n${greeting}, por favor crear BO${selectedLine ? ` para Línea ${selectedLine}` : ''}.\n\nSKU\tPart Number\tBodega\tQty\tUnit Net Price\tExtended Net Price\n${rowsText}\n\n${grandTotalLabel}\t\t\t${totalQty}\t—\t$${formatCLP(totalVenta, 2)} USD${refText}`;
}

/**
 * Copia la tabla BO al portapapeles devolviendo el modo ('rich' | 'plain' | 'none').
 */
export async function copyBoTableWithDetail(
  lines: BoLineItem[],
  options?: BoTableExportOptions
): Promise<ClipboardCopyDetailedResult> {
  const htmlContent = generateBoHtmlTable(lines, options);
  const plainText = generateBoPlainTextTable(lines, options);
  return copyHtmlAndTextToClipboard(htmlContent, plainText);
}

/**
 * Copia el HTML con formato directamente al portapapeles para pegar en Outlook (con fallback a texto plano).
 */
export async function copyBoTableToClipboard(
  lines: BoLineItem[],
  options?: BoTableExportOptions
): Promise<boolean> {
  const res = await copyBoTableWithDetail(lines, options);
  return res.success;
}

