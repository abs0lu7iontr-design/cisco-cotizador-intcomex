// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: EMAIL & HTML CLIPBOARD
// ============================================================================

import { BoLineItem } from './boTypes';

export const BO_EMAIL_TO = 'ventascore.cl@intcomex.com';
export const BO_EMAIL_CC = 'ciscoteam.cl@intcomex.com';

const formatCL = (val: number, decimals: number = 2) => {
  return val.toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Genera la tabla HTML compatible con el portapapeles de Microsoft Outlook
 */
export function generateBoHtmlTable(lines: BoLineItem[]): string {
  const rowsHtml = lines
    .map(
      (line) => `
    <tr style="text-align: center; font-family: Calibri, sans-serif; font-size: 11pt;">
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${line.sku || 'N/A'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${line.partNumber}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${line.bodega}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${line.qty}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatCL(line.unitNetPrice, 2)}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatCL(line.extendedNetPrice, 0)}</td>
    </tr>`
    )
    .join('');

  return `
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">Estimado,</p>
  <p style="font-family: Calibri, sans-serif; font-size: 11pt;">Buenos días, por favor crear BO.</p>
  <table style="border-collapse: collapse; width: 100%; max-width: 800px; font-family: Calibri, sans-serif; font-size: 11pt; border: 1px solid #000;">
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
    </tbody>
  </table>
  <br/>
  `;
}

/**
 * Copia el HTML con formato directamente al portapapeles para pegar en Outlook
 */
export async function copyBoTableToClipboard(lines: BoLineItem[]): Promise<boolean> {
  const htmlContent = generateBoHtmlTable(lines);
  const plainText = lines
    .map((l) => `${l.sku}\t${l.partNumber}\t${l.bodega}\t${l.qty}\t${l.unitNetPrice}\t${l.extendedNetPrice}`)
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
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
}
