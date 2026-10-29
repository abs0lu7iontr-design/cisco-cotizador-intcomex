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

export interface EstimateEmailOptions {
  includeSignature?: boolean;
}

/**
 * Genera la plantilla HTML corporativa con estilos inline garantizados para Outlook,
 * adaptada con total fidelidad a la vista oficial del "Estimate Customizado" de 7 columnas.
 * Excluye etiquetas internas de margen/arancel/licencia y omite la firma personal
 * por defecto para respetar la firma predeterminada que el usuario ya tiene configurada en Outlook.
 */
export function generateEstimateEmailHtml(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date,
  signatureProfile?: EmailSignatureProfile,
  options?: EstimateEmailOptions
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Intcomex Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.quoteName || header.estimateId || 'N/A';

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
      const isSub = String(item.lineNumber || '').includes('.');
      const indent = isSub ? 'padding-left: 14px;' : '';
      const leadTime = item.transformedLeadTime || 'Estándar';

      // Descripción oficial Cisco limpia (sin etiquetas internas como "(Licencia)" o "(Arancel 6%)")
      const cleanDesc = (item.description || '-').trim();

      return `
      <tr style="background-color: ${bg}; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #1e293b;">
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; color: #64748b; font-size: 9pt;">${item.lineNumber || String(idx + 1)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; font-weight: bold; color: #0f172a; font-family: Consolas, 'Courier New', monospace; ${indent}">${item.partNumber}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; ${indent}">${cleanDesc}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; text-align: center; color: #4338ca; font-size: 8.5pt; font-weight: 600; white-space: nowrap;">${leadTime}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-weight: bold;">${item.qty}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; white-space: nowrap;">${formatUsdCurrency(item.precioVentaUnitario)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; font-weight: bold; color: #0f172a; white-space: nowrap;">${formatUsdCurrency(item.precioVentaExtendido)}</td>
      </tr>`;
    })
    .join('');

  // Firma opcional (sólo se incluye si se solicita explícitamente en options.includeSignature)
  let signatureBlock = '';
  if (options?.includeSignature && signatureProfile) {
    signatureBlock = `
  <!-- Firma Personalizada del PM -->
  <table style="border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #334155; margin-top: 16px;">
    <tr>
      <td style="padding-right: 15px; border-right: 2px solid #4338ca; vertical-align: top;">
        <strong style="color: #0f172a; font-size: 11.5pt; display: block;">${signatureProfile.senderName}</strong>
        <span style="color: #4338ca; font-weight: bold; font-size: 9.5pt; display: block;">${signatureProfile.jobTitle}</span>
        <span style="color: #64748b; font-size: 9pt; display: block;">Intcomex Chile &bull; Cisco Division</span>
      </td>
      <td style="padding-left: 15px; vertical-align: top; font-size: 9pt; color: #475569;">
        ${signatureProfile.phone ? `<span>📞 ${signatureProfile.phone}</span><br/>` : ''}
        ${signatureProfile.email ? `<span>✉️ <a href="mailto:${signatureProfile.email}" style="color: #4338ca; text-decoration: none;">${signatureProfile.email}</a></span><br/>` : ''}
        <span style="color: #94a3b8; font-size: 8.5pt;">${signatureProfile.disclaimerText || DEFAULT_EMAIL_SIGNATURE.disclaimerText}</span>
      </td>
    </tr>
  </table>`;
  }

  return `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; max-width: 960px;">
  <p style="margin: 0 0 12px 0; font-size: 11.5pt;"><strong>${greeting},</strong></p>
  
  <p style="margin: 0 0 14px 0;">
    Junto con saludar, comparto la propuesta comercial oficial de cotización <strong>Cisco Commercial</strong>:
  </p>

  <!-- Encabezado Oficial Price Estimate Cisco CCW -->
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 8px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
    <tr>
      <td style="padding: 10px 14px; width: 55%; vertical-align: top;">
        <div style="font-size: 13pt; font-weight: bold; color: #0f172a; margin-bottom: 2px;">Price Estimate</div>
        <div style="font-size: 9.5pt; font-weight: bold; color: #64748b; text-transform: uppercase;">INTCOMEX CHILE SA</div>
        <div style="font-size: 9pt; color: #475569; margin-top: 4px;"><strong>Partner:</strong> ${partnerName} &bull; <strong>Cliente Final:</strong> ${clientName}</div>
      </td>
      <td style="padding: 10px 14px; width: 45%; vertical-align: top; text-align: right;">
        <span style="color: #64748b; font-size: 8.5pt; text-transform: uppercase; font-weight: bold; display: block;">Datos de Cotización</span>
        <div style="margin-top: 2px;">
          <span style="color: #64748b; font-size: 9pt;">Estimate ID:</span> <strong style="color: #4338ca; font-family: Consolas, monospace; font-size: 10pt;">${estimateId}${data.versionTag ? ` (${data.versionTag})` : ''}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9pt;">Deal ID:</span> <strong style="color: #0f172a; font-family: Consolas, monospace; font-size: 10pt;">${dealId}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 9pt;">Fecha / Date:</span> <span style="color: #334155; font-size: 9pt;">${fechaStr}</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Cisco Official Red Notice Banner -->
  <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 7px 12px; margin-bottom: 8px; font-size: 9pt; font-weight: bold; color: #be123c; text-align: center;">
    Price Estimate for planning and information purposes only and is not a binding offer from Cisco.
  </div>

  <div style="text-align: right; margin-bottom: 6px; font-size: 8.5pt; font-style: italic; color: #64748b;">
    All prices are shown in USD
  </div>

  <!-- Tabla Oficial 7 Columnas del Estimate Customizado -->
  <table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin-bottom: 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; text-align: center; font-weight: bold; font-size: 9pt;">
        <th style="border: 1px solid #0f172a; padding: 8px 6px; width: 45px;">Line</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 155px; text-align: left;">Part Number</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; text-align: left;">Description</th>
        <th style="border: 1px solid #0f172a; padding: 8px 8px; width: 100px;">Lead Time</th>
        <th style="border: 1px solid #0f172a; padding: 8px 6px; width: 45px;">Qty</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 110px; text-align: right;">Unit Net Price</th>
        <th style="border: 1px solid #0f172a; padding: 8px 10px; width: 125px; text-align: right;">Extended Net Price</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <!-- Fila de Total General -->
      <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a;">
        <td colspan="5" style="border: 1px solid #cbd5e1; padding: 9px 12px; text-align: right; font-size: 10pt; color: #0f172a;">
          Total Net Price (${totalQty} unidades):
        </td>
        <td colspan="2" style="border: 1px solid #cbd5e1; padding: 9px 12px; text-align: right; font-size: 11.5pt; color: #0f172a; white-space: nowrap;">
          ${formatUsdCurrency(totalNeto)} USD
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Nota de Cierre Oficial -->
  <p style="margin: 0 0 10px 0; font-size: 9pt; color: #64748b;">
    * Precios sugeridos netos en USD (no incluyen IVA 19%). Cotización sujeta a disponibilidad de stock y vigencia oficial en Cisco Commerce Workspace (CCW).
  </p>
  <p style="margin: 0 0 16px 0; font-size: 9.5pt; color: #334155;">
    Quedamos atentos a sus comentarios para coordinar la generación de la orden respectiva.
  </p>
  ${signatureBlock}
</div>
`;
}

/**
 * Genera el texto plano en formato tabulado (fallback),
 * adaptado a la estructura de 7 columnas del Estimate Customizado.
 */
export function generateEstimatePlainText(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  targetDate?: Date,
  signatureProfile?: EmailSignatureProfile,
  options?: EstimateEmailOptions
): string {
  const greeting = getTimeBasedGreeting(targetDate);
  const header = (data.headerInfo || {}) as Partial<EstimateHeaderInfo>;
  const partnerName = detectedPartner || header.customerName || 'Intcomex Partner';
  const clientName = header.companyName || header.endUser || 'Cliente Final';
  const dealId = header.dealId || 'N/A';
  const estimateId = header.quoteName || header.estimateId || 'N/A';

  const activeItems = (data.items || []).filter(
    (item) => !item.isInfoRow && (item.precioVentaExtendido > 0 || item.precioVentaUnitario > 0 || item.qty > 0)
  );

  const totalNeto = data.calculatedProductTotal || data.financialSummary?.totalVentaUSD || 0;
  const totalQty = activeItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

  const linesText = activeItems
    .map(
      (item, idx) =>
        `${item.lineNumber || idx + 1}\t${item.partNumber}\t${(item.description || '-').trim()}\t${item.transformedLeadTime || 'Estándar'}\t${item.qty}\t${formatUsdCurrency(
          item.precioVentaUnitario
        )}\t${formatUsdCurrency(item.precioVentaExtendido)}`
    )
    .join('\n');

  let text = `${greeting},

Junto con saludar, comparto la propuesta comercial oficial Cisco Official Estimate:

Price Estimate - INTCOMEX CHILE SA
Partner: ${partnerName} | Cliente Final: ${clientName}
Estimate ID: ${estimateId}${data.versionTag ? ` (${data.versionTag})` : ''} | Deal ID: ${dealId}
[Price Estimate for planning and information purposes only and is not a binding offer from Cisco.]
All prices are shown in USD

Line\tPart Number\tDescription\tLead Time\tQty\tUnit Net Price\tExtended Net Price
${linesText}

Total Net Price (${totalQty} unidades):\t\t\t\t\t\t${formatUsdCurrency(totalNeto)} USD

* Precios netos en USD (no incluyen IVA 19%). Cotización sujeta a disponibilidad y vigencia en Cisco CCW.
`;

  if (options?.includeSignature && signatureProfile) {
    text += `\nSaludos cordiales,
${signatureProfile.senderName}
${signatureProfile.jobTitle}
${signatureProfile.phone ? `Tel: ${signatureProfile.phone}\n` : ''}${signatureProfile.email ? `Email: ${signatureProfile.email}\n` : ''}${signatureProfile.disclaimerText || ''}\n`;
  }

  return text;
}

/**
 * Copia el resumen de cotización al portapapeles con el formato oficial del Estimate Customizado.
 * Por defecto no incluye firma personal para respetar la firma nativa configurada en Outlook.
 */
export async function copyEstimateEmailSummaryWithDetail(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  customSignature?: EmailSignatureProfile,
  options?: EstimateEmailOptions
): Promise<ClipboardCopyDetailedResult> {
  const sig = customSignature || (await getSavedEmailSignature());
  const htmlContent = generateEstimateEmailHtml(data, detectedPartner, new Date(), sig, options);
  const plainText = generateEstimatePlainText(data, detectedPartner, new Date(), sig, options);
  return copyHtmlAndTextToClipboard(htmlContent, plainText);
}

/**
 * Copia el HTML con formato directamente al portapapeles con soporte dual.
 */
export async function copyEstimateEmailSummaryToClipboard(
  data: ProcessedEstimateResult,
  detectedPartner?: string,
  options?: EstimateEmailOptions
): Promise<boolean> {
  const res = await copyEstimateEmailSummaryWithDetail(data, detectedPartner, undefined, options);
  return res.success;
}
