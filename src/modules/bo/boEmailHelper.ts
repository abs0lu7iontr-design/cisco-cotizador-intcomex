// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: EMAIL & HTML CLIPBOARD
// ============================================================================

import { BoLineItem } from './boTypes';

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

/**
 * Genera la tabla HTML compatible con el portapapeles de Microsoft Outlook,
 * mostrando siempre 2 decimales obligatorios con formato chileno y fila de Total General.
 */
export function generateBoHtmlTable(lines: BoLineItem[]): string {
  const activeLines = lines.filter((l) => !l.isExcludedZeroCost && (l.extendedNetPrice > 0 || l.unitNetPrice > 0));

  const rowsHtml = activeLines
    .map(
      (line) => `
    <tr style="text-align: center; font-family: Calibri, sans-serif; font-size: 11pt;">
      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${line.sku || 'N/A'}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${line.partNumber}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${line.bodega}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${line.qty}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatCLP(line.unitNetPrice, 2)}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatCLP(line.extendedNetPrice, 2)}</td>
    </tr>`
    )
    .join('');

  const totalVenta = activeLines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);

  return `
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">Estimado,</p>
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">Buenos días, por favor crear BO.</p>
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
      <tr style="font-family: Calibri, sans-serif; font-size: 11pt; font-weight: bold; background-color: #f2f2f2;">
        <td colspan="4" style="border: 1px solid #000; padding: 6px; text-align: right;">Total General:</td>
        <td colspan="2" style="border: 1px solid #000; padding: 6px; text-align: right;">$${formatCLP(totalVenta, 2)} USD</td>
      </tr>
    </tbody>
  </table>
  <br/>
  `;
}

/**
 * Copia el HTML con formato directamente al portapapeles para pegar en Outlook
 */
export async function copyBoTableToClipboard(lines: BoLineItem[]): Promise<boolean> {
  const activeLines = lines.filter((l) => !l.isExcludedZeroCost && (l.extendedNetPrice > 0 || l.unitNetPrice > 0));
  const htmlContent = generateBoHtmlTable(lines);
  const plainText = activeLines
    .map(
      (l) =>
        `${l.sku || 'N/A'}\t${l.partNumber}\t${l.bodega}\t${l.qty}\t${formatCLP(l.unitNetPrice, 2)}\t${formatCLP(l.extendedNetPrice, 2)}`
    )
    .join('\n');

  try {
    const blobHtml = new Blob([htmlContent], { type: 'text/html' });
    const blobText = new Blob([plainText], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      }),
    ]);
    return true;
  } catch (err) {
    console.error('Error al copiar tabla BO al portapapeles:', err);
    return false;
  }
}
