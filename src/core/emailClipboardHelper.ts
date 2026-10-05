// ============================================================================
// CISCO AUTOMATED v2.1 - ESTIMATE EMAIL CLIPBOARD HELPER (OUTLOOK / GMAIL)
// Genera resumen comercial HTML estilizado para pegar directamente en Outlook
// ============================================================================

import { ProcessedEstimateResult, EstimateHeaderInfo } from './types';

/**
 * Obtiene el saludo dinámico según la hora local del sistema:
 * - Antes de las 12:00 hrs -> "Buenos días"
 * - Desde las 12:00 hrs en adelante -> "Buenas tardes"
 */
export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'Buenos días' : 'Buenas tardes';
}

/**
 * Formatea un número a formato monetario USD con 2 decimales ($ 1,234.56)
 */
function formatUsdCurrency(val: number): string {
  return Number(val || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Genera la plantilla HTML corporativa con estilos inline garantizados
 * para máxima compatibilidad con Microsoft Outlook (Desktop / Web), Gmail y Teams.
 */
export function generateEstimateEmailHtml(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.estimateId || header.quoteName || 'N/A';

  const today = targetDate || new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fechaStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

  // Filtrar líneas válidas (excluyendo filas informativas puras sin precio)
  const activeItems = (data.items || []).filter(
    (item) => !item.isInfoRow && (item.precioVentaExtendido > 0 || item.precioVentaUnitario > 0 || item.qty > 0)
  );

  const totalNeto = data.calculatedProductTotal || data.financialSummary?.totalVentaUSD || 0;
  const totalQty = activeItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

  const rowsHtml = activeItems
    .map((item, idx) => {
      const isEven = idx % 2 === 0;
      const bg = isEven ? '#ffffff' : '#f8fafc';
      const typeBadge = item.isIntangible
        ? '<span style="color: #d97706; font-size: 8.5pt; font-weight: bold;">(Licencia)</span>'
        : item.llevaArancel
        ? '<span style="color: #7c3aed; font-size: 8.5pt; font-weight: bold;">(Arancel 6%)</span>'
        : '';

      return `
      <tr style="background-color: ${bg}; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1e293b;">
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: center; color: #64748b; font-size: 9.5pt;">${item.lineNumber || String(idx + 1)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: bold; color: #0f172a; font-family: Consolas, 'Courier New', monospace;">${item.partNumber}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left;">${item.description || '-'} ${typeBadge}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: center; font-weight: bold;">${item.qty}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; white-space: nowrap;">${formatUsdCurrency(item.precioVentaUnitario)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; font-weight: bold; color: #0f172a; white-space: nowrap;">${formatUsdCurrency(item.precioVentaExtendido)}</td>
      </tr>`;
    })
    .join('');

  return `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; max-width: 900px;">
  <p style="margin: 0 0 12px 0; font-size: 11.5pt;"><strong>${greeting},</strong></p>
  
  <p style="margin: 0 0 16px 0;">
    Junto con saludar, comparto el resumen oficial de cotización <strong>Cisco Commercial</strong> preparado por <strong>Intcomex Chile</strong>:
  </p>

  <!-- Ficha de Datos del Negocio -->
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px; background-color: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
    <tr>
      <td style="padding: 8px 14px; width: 50%; border-right: 1px solid #cbd5e1;">
        <span style="color: #64748b; font-size: 9pt; text-transform: uppercase; font-weight: bold; display: block;">Partner / Reseller</span>
        <strong style="color: #0f172a; font-size: 11pt;">${partnerName}</strong>
      </td>
      <td style="padding: 8px 14px; width: 50%;">
        <span style="color: #64748b; font-size: 9pt; text-transform: uppercase; font-weight: bold; display: block;">Cliente Final</span>
        <strong style="color: #0f172a; font-size: 11pt;">${clientName}</strong>
      </td>
    </tr>
    <tr style="border-top: 1px solid #cbd5e1;">
      <td style="padding: 8px 14px; border-right: 1px solid #cbd5e1;">
        <span style="color: #64748b; font-size: 9pt; text-transform: uppercase; font-weight: bold; display: block;">Deal ID / CCW Estimate</span>
        <strong style="color: #4338ca; font-family: Consolas, monospace; font-size: 10.5pt;">${dealId}</strong> &bull; <strong style="color: #0f172a; font-family: Consolas, monospace; font-size: 10.5pt;">${estimateId}${data.versionTag ? ` (${data.versionTag})` : ''}</strong>
      </td>
      <td style="padding: 8px 14px;">
        <span style="color: #64748b; font-size: 9pt; text-transform: uppercase; font-weight: bold; display: block;">Fecha de Emisión</span>
        <span style="color: #334155; font-size: 10pt;">${fechaStr}</span>
      </td>
    </tr>
  </table>

  <!-- Tabla de Cotización Oficial -->
  <table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin-bottom: 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; text-align: center; font-weight: bold;">
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 45px;">#</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 150px; text-align: left;">Part Number</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; text-align: left;">Descripción</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 55px;">Qty</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 120px; text-align: right;">P. Venta Unit.</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 130px; text-align: right;">Total Venta</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <!-- Fila de Total General -->
      <tr style="background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #0f172a;">
        <td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: right; font-size: 11pt; color: #0f172a;">
          TOTAL NETO COTIZADO (${totalQty} unidades):
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 10px 8px; text-align: center; font-size: 11pt; color: #0f172a;">
          ${totalQty}
        </td>
        <td colspan="2" style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: right; font-size: 13pt; color: #1e1b4b; white-space: nowrap;">
          ${formatUsdCurrency(totalNeto)} USD
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Condiciones Comerciales -->
  <div style="background-color: #f8fafc; border-left: 4px solid #4338ca; padding: 10px 14px; margin-bottom: 20px; font-size: 9pt; color: #475569;">
    <strong style="color: #1e293b; display: block; margin-bottom: 4px;">Condiciones Comerciales Estándar:</strong>
    <ul style="margin: 0; padding-left: 18px; line-height: 1.5;">
      <li>Valores unitarios y totales expresados en <strong>Dólares Americanos (USD)</strong>, valores <strong>Netos</strong> (no incluyen IVA).</li>
      <li>Precios calculados con internación y arancel aduanero chileno según aplique por SKU.</li>
      <li>Cotización sujeta a disponibilidad de stock y vigencia oficial en Cisco Commerce Workspace (CCW).</li>
      <li>Validez de la oferta: 30 días calendario desde su fecha de emisión.</li>
    </ul>
  </div>

  <p style="margin: 0 0 4px 0;">Quedamos atentos a sus comentarios para coordinar la generación de la orden respectiva.</p>
  <br/>
  <p style="margin: 0; color: #334155; font-size: 10.5pt;">
    Saludos cordiales,<br/>
    <strong style="color: #0f172a; font-size: 11pt;">Equipo Cisco &bull; Intcomex Chile</strong><br/>
    <span style="font-size: 9pt; color: #64748b;">Distribuidor Mayorista Autorizado Cisco</span>
  </p>
</div>
`;
}

/**
 * Genera el texto plano en formato tabulado (fallback)
 */
export function generateEstimatePlainText(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.estimateId || header.quoteName || 'N/A';

  const activeItems = (data.items || []).filter(
    (item) => !item.isInfoRow && (item.precioVentaExtendido > 0 || item.precioVentaUnitario > 0 || item.qty > 0)
  );

  const totalNeto = data.calculatedProductTotal || data.financialSummary?.totalVentaUSD || 0;
  const totalQty = activeItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

  const linesText = activeItems
    .map(
      (item, idx) =>
        `${item.lineNumber || idx + 1}\t${item.partNumber}\t${item.description}\t${item.qty}\t${formatUsdCurrency(
          item.precioVentaUnitario
        )}\t${formatUsdCurrency(item.precioVentaExtendido)}`
    )
    .join('\n');

  return `${greeting},

Junto con saludar, comparto el resumen oficial de cotización comercial Cisco (Intcomex Chile):

Partner / Reseller: ${partnerName}
Cliente Final: ${clientName}
Deal ID: ${dealId} | Estimate ID: ${estimateId}${data.versionTag ? ` (${data.versionTag})` : ''}

#\tPart Number\tDescripción\tQty\tP. Venta Unit.\tTotal Venta
${linesText}

TOTAL NETO COTIZADO (${totalQty} unidades): ${formatUsdCurrency(totalNeto)} USD

Condiciones Comerciales:
- Precios en Dólares Americanos (USD), valores netos sin IVA.
- Incluye internación y aranceles según corresponda.
- Sujeto a vigencia de precios Cisco CCW.
- Validez de la oferta: 30 días calendario.

Saludos cordiales,
Equipo Cisco • Intcomex Chile
`;
}

/**
 * Copia el HTML con formato directamente al portapapeles con compatibilidad dual
 * (HTML enriquecido para Outlook/Gmail y Texto Plano como fallback)
 */
export async function copyEstimateEmailSummaryToClipboard(
  data: ProcessedEstimateResult,
  detectedPartner?: string
): Promise<boolean> {
  const htmlContent = generateEstimateEmailHtml(data, detectedPartner);
  const plainText = generateEstimatePlainText(data, detectedPartner);

  try {
    if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem API falló, intentando fallback legacy...', err);
  }

  // Fallback para navegadores antiguos o restricciones de iframe
  if (typeof document !== 'undefined') {
    try {
      const listener = (e: ClipboardEvent) => {
        e.preventDefault();
        e.clipboardData?.setData('text/html', htmlContent);
        e.clipboardData?.setData('text/plain', plainText);
      };
      document.addEventListener('copy', listener);
      document.execCommand('copy');
      document.removeEventListener('copy', listener);
      return true;
    } catch (e2) {
      console.error('Error en fallback de portapapeles:', e2);
      return false;
    }
  }

  return false;
}
