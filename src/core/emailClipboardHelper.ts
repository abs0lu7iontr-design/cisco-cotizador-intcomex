// ============================================================================
// CISCO AUTOMATED v2.7 - ESTIMATE & BO EMAIL CLIPBOARD HELPER (OUTLOOK / GMAIL)
// Unifies rich HTML + plain-text clipboard copying with customizable PM signatures
// ============================================================================

import { ProcessedEstimateResult, EstimateHeaderInfo } from './types';
import {
  EmailSignatureProfile,
  DEFAULT_EMAIL_SIGNATURE,
  getSavedEmailSignature,
} from './emailSignatureProfile';

export type ClipboardCopyMode = 'rich' | 'plain' | 'none';

export interface ClipboardCopyDetailedResult {
  success: boolean;
  mode: ClipboardCopyMode;
  message: string;
  error?: string;
}

/**
 * Unifies rich HTML + plain-text clipboard copying across Quote Summary, BO, and Deal Reminders.
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

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempContainer);
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      document.addEventListener('copy', listener);
      const successful = document.execCommand('copy');
      document.removeEventListener('copy', listener);

      if (successful || intercepted) {
        return {
          success: true,
          mode: 'rich',
          message: 'Copia enriquecida (vía eventos HTML) completada con éxito.',
        };
      }
      if (!lastError) {
        lastError = 'document.execCommand("copy") devolvió false sin interceptar datos.';
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      if (listener) {
        try {
          document.removeEventListener('copy', listener);
        } catch {}
      }
      if (tempContainer && tempContainer.parentNode) {
        try {
          tempContainer.parentNode.removeChild(tempContainer);
        } catch {}
      }
    }
  }

  // 3. Modern writeText fallback
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
        message: 'Copia en texto plano completada (formato HTML no soportado por el navegador).',
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // 4. Legacy textarea fallback
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = plainText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand('copy');
      if (successful) {
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
        } catch {}
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
 * Obtiene el saludo dinámico según la hora local del sistema.
 */
export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'Buenos días' : 'Buenas tardes';
}

function formatUsdCurrency(val: number): string {
  return Number(val || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Genera la plantilla HTML corporativa con estilos inline garantizados para Outlook.
 */
export function generateEstimateEmailHtml(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date,
  signatureProfile?: EmailSignatureProfile
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.quoteName || header.estimateId || 'N/A';

  const sig = signatureProfile || DEFAULT_EMAIL_SIGNATURE;

  const today = targetDate || new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fechaStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

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

  const termsHtml = (sig.commercialTerms || DEFAULT_EMAIL_SIGNATURE.commercialTerms)
    .map((t) => `<li>${t}</li>`)
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
      ${termsHtml}
    </ul>
  </div>

  <p style="margin: 0 0 16px 0;">Quedamos atentos a sus comentarios para coordinar la generación de la orden respectiva.</p>

  <!-- Firma Personalizada del PM -->
  <table style="border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #334155; margin-top: 10px;">
    <tr>
      <td style="padding-right: 15px; border-right: 2px solid #4338ca; vertical-align: top;">
        <strong style="color: #0f172a; font-size: 11.5pt; display: block;">${sig.senderName}</strong>
        <span style="color: #4338ca; font-weight: bold; font-size: 9.5pt; display: block;">${sig.jobTitle}</span>
        <span style="color: #64748b; font-size: 9pt; display: block;">Intcomex Chile &bull; Cisco Division</span>
      </td>
      <td style="padding-left: 15px; vertical-align: top; font-size: 9pt; color: #475569;">
        ${sig.phone ? `<span>📞 ${sig.phone}</span><br/>` : ''}
        ${sig.email ? `<span>✉️ <a href="mailto:${sig.email}" style="color: #4338ca; text-decoration: none;">${sig.email}</a></span><br/>` : ''}
        <span style="color: #94a3b8; font-size: 8.5pt;">${sig.disclaimerText || DEFAULT_EMAIL_SIGNATURE.disclaimerText}</span>
      </td>
    </tr>
  </table>
</div>
`;
}

/**
 * Genera el texto plano en formato tabulado (fallback).
 */
export function generateEstimatePlainText(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date,
  signatureProfile?: EmailSignatureProfile
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.quoteName || header.estimateId || 'N/A';

  const sig = signatureProfile || DEFAULT_EMAIL_SIGNATURE;

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

  const termsText = (sig.commercialTerms || DEFAULT_EMAIL_SIGNATURE.commercialTerms)
    .map((t) => `- ${t}`)
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
${termsText}

Saludos cordiales,
${sig.senderName}
${sig.jobTitle}
${sig.phone ? `Tel: ${sig.phone}` : ''}
${sig.email ? `Email: ${sig.email}` : ''}
${sig.disclaimerText || DEFAULT_EMAIL_SIGNATURE.disclaimerText}
`;
}

/**
 * Copia el resumen de cotización al portapapeles con la firma personalizada activa.
 */
export async function copyEstimateEmailSummaryWithDetail(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  customSignature?: EmailSignatureProfile
): Promise<ClipboardCopyDetailedResult> {
  const sig = customSignature || (await getSavedEmailSignature());
  const htmlContent = generateEstimateEmailHtml(data, detectedPartner, new Date(), sig);
  const plainText = generateEstimatePlainText(data, detectedPartner, new Date(), sig);
  return copyHtmlAndTextToClipboard(htmlContent, plainText);
}

/**
 * Copia el HTML con formato directamente al portapapeles con soporte dual.
 */
export async function copyEstimateEmailSummaryToClipboard(
  data: ProcessedEstimateResult,
  detectedPartner?: string
): Promise<boolean> {
  const res = await copyEstimateEmailSummaryWithDetail(data, detectedPartner);
  return res.success;
}
