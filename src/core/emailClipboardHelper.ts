// ============================================================================
// CISCO AUTOMATED v2.1 - ESTIMATE & BO EMAIL CLIPBOARD HELPER (OUTLOOK / GMAIL)
// Unifies rich HTML + plain-text clipboard copying with verified fallbacks
// ============================================================================

import { ProcessedEstimateResult, EstimateHeaderInfo } from './types';

export type ClipboardCopyMode = 'rich' | 'plain' | 'none';

export interface ClipboardCopyDetailedResult {
  success: boolean;
  mode: ClipboardCopyMode;
  message: string;
  error?: string;
}

/**
 * Unifies rich HTML + plain-text clipboard copying across Quote Summary, BO, and Deal Reminders.
 * 1. Tries modern ClipboardItem ('text/html' + 'text/plain') -> mode: 'rich'
 * 2. Tries legacy copy event + document.execCommand('copy') verifying boolean result -> mode: 'rich'
 * 3. Tries navigator.clipboard.writeText(plainText) -> mode: 'plain'
 * 4. Tries legacy textarea + document.execCommand('copy') verifying boolean result -> mode: 'plain'
 * Always cleans up temporary DOM elements and listeners in `finally`.
 */
export async function copyHtmlAndTextToClipboard(
  htmlContent: string,
  plainText: string
): Promise<ClipboardCopyDetailedResult> {
  let lastError = '';

  // 1. Modern Clipboard API with ClipboardItem (HTML + Plain Text)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      return {
        success: true,
        mode: 'rich',
        message: 'Copia enriquecida (HTML para Outlook/Gmail + texto plano) realizada con éxito.',
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // 2. Legacy rich HTML copy via ClipboardEvent listener + verified execCommand('copy')
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    let listener: ((e: ClipboardEvent) => void) | null = null;
    let tempContainer: HTMLDivElement | null = null;
    try {
      let intercepted = false;
      listener = (e: ClipboardEvent) => {
        if (e.clipboardData) {
          e.preventDefault();
          e.clipboardData.setData('text/html', htmlContent);
          e.clipboardData.setData('text/plain', plainText);
          intercepted = true;
        }
      };

      if (document.body) {
        tempContainer = document.createElement('div');
        tempContainer.contentEditable = 'true';
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.opacity = '0';
        tempContainer.innerHTML = htmlContent;
        document.body.appendChild(tempContainer);

        if (typeof window !== 'undefined' && typeof window.getSelection === 'function' && typeof document.createRange === 'function') {
          const range = document.createRange();
          range.selectNodeContents(tempContainer);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }

      document.addEventListener('copy', listener);
      const execOk = Boolean(document.execCommand('copy'));
      if (execOk && (intercepted || tempContainer !== null)) {
        return {
          success: true,
          mode: 'rich',
          message: 'Copia enriquecida (modo compatible HTML) realizada con éxito.',
        };
      }
      if (!execOk && !lastError) {
        lastError = 'document.execCommand("copy") devolvió false.';
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      if (listener) {
        try {
          document.removeEventListener('copy', listener);
        } catch {
          // Ignore listener cleanup errors
        }
      }
      if (typeof window !== 'undefined' && typeof window.getSelection === 'function') {
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          // Ignore selection cleanup errors
        }
      }
      if (tempContainer && tempContainer.parentNode) {
        try {
          tempContainer.parentNode.removeChild(tempContainer);
        } catch {
          // Ignore DOM removal errors
        }
      }
    }
  }

  // 3. Plain-text fallback via navigator.clipboard.writeText
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(plainText);
      return {
        success: true,
        mode: 'plain',
        message: 'Copia en texto plano completada (formato enriquecido HTML no disponible en este navegador).',
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // 4. Plain-text fallback via temporary textarea + verified execCommand('copy')
  if (
    typeof document !== 'undefined' &&
    document.body &&
    typeof document.execCommand === 'function'
  ) {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = plainText;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const execPlainOk = Boolean(document.execCommand('copy'));
      if (execPlainOk) {
        return {
          success: true,
          mode: 'plain',
          message: 'Copia en texto plano (modo compatible) completada.',
        };
      }
      if (!lastError) {
        lastError = 'document.execCommand("copy") en texto plano devolvió false.';
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      if (textarea && textarea.parentNode) {
        try {
          textarea.parentNode.removeChild(textarea);
        } catch {
          // Ignore DOM removal errors
        }
      }
    }
  }

  return {
    success: false,
    mode: 'none',
    message: 'No se pudo copiar al portapapeles.',
    error: lastError || 'El navegador o entorno bloqueó el acceso al portapapeles.',
  };
}

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
 * Copia el resumen de cotización al portapapeles devolviendo el detalle del modo de copia ('rich' | 'plain' | 'none').
 */
export async function copyEstimateEmailSummaryWithDetail(
  data: ProcessedEstimateResult,
  detectedPartner?: string
): Promise<ClipboardCopyDetailedResult> {
  const htmlContent = generateEstimateEmailHtml(data, detectedPartner);
  const plainText = generateEstimatePlainText(data, detectedPartner);
  return copyHtmlAndTextToClipboard(htmlContent, plainText);
}

/**
 * Copia el HTML con formato directamente al portapapeles con compatibilidad dual
 * (HTML enriquecido para Outlook/Gmail y Texto Plano como fallback).
 */
export async function copyEstimateEmailSummaryToClipboard(
  data: ProcessedEstimateResult,
  detectedPartner?: string
): Promise<boolean> {
  const res = await copyEstimateEmailSummaryWithDetail(data, detectedPartner);
  return res.success;
}
