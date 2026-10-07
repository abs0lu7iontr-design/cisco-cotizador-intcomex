// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL EMAIL & OUTLOOK HTML REMINDER GENERATOR
// Genera texto enriquecido y HTML compatible con portapapeles de Outlook
// Con saludo automático según la hora ("Buenos días" / "Buenas tardes")
// Adaptado para AM Cisco y Cisco Velocity Hub (VF)
// ============================================================================

import { DealReminderRecord, calculateDealAging } from './dealReminderTypes';

export interface DealEmailPayload {
  subject: string;
  greeting: string;
  recipientLabel: string;
  htmlContent: string;
  plainTextContent: string;
}

/**
 * Obtiene el saludo protocolar chileno/latino según la hora local:
 * - < 12:00: "Buenos días"
 * - >= 12:00 y < 19:30: "Buenas tardes"
 * - >= 19:30: "Buenas tardes" (o "Buenas noches")
 */
export function getDealTimeGreeting(now: Date = new Date()): string {
  const hours = now.getHours();
  if (hours < 12) {
    return 'Buenos días';
  }
  return 'Buenas tardes';
}

/**
 * Genera el asunto y cuerpo de correo para el recordatorio de Deal
 */
export function generateDealReminderEmail(deal: DealReminderRecord, now: Date = new Date()): DealEmailPayload {
  const greeting = getDealTimeGreeting(now);
  const aging = calculateDealAging(deal, now);
  
  const isVelocityHub = deal.escalationChannel === 'VELOCITY_HUB';
  const recipientLabel = isVelocityHub
    ? 'Equipo Cisco Velocity Hub'
    : (deal.amContactName ? `Estimado(a) ${deal.amContactName}` : 'Estimado(a) AM Cisco');

  const subject = `[SEGUIMIENTO DEAL] Deal ${deal.dealId} - ${deal.partnerName} / ${deal.endCustomerName} (${isVelocityHub ? 'VF Velocity Hub' : 'AM Cisco'})`;

  const dateFormatted = new Date(deal.escalatedAt || deal.createdAt).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const timeElapsedText =
    aging.elapsedDays > 0
      ? `${aging.elapsedDays} día(s) (${aging.elapsedHours} horas)`
      : `${aging.elapsedHours} hora(s)`;

  // Cuerpo Texto Plano
  const plainTextContent = `${greeting} ${recipientLabel},

Junto con saludar cordialmente, solicitamos su amable apoyo y gestión con la revisión y aprobación del siguiente Deal que se encuentra escalado en ${isVelocityHub ? 'Cisco Velocity Hub (VF)' : 'revisión con AM Cisco'}:

DETALLE DEL DEAL:
• Deal ID: ${deal.dealId}
• Partner / Canal: ${deal.partnerName}
• Cliente Final: ${deal.endCustomerName}
• Canal de Escalamiento: ${isVelocityHub ? 'Cisco Velocity Hub (VF)' : 'AM Cisco'}
• Fecha de Escalamiento: ${dateFormatted} (${timeElapsedText} en espera)
${deal.targetDiscountPct ? `• Descuento Solicitado: ${deal.targetDiscountPct}%\n` : ''}${deal.estimatedTotalUsd ? `• Monto Estimado: US$ ${deal.estimatedTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}${deal.vfTicketNumber ? `• Caso / Ticket VF: ${deal.vfTicketNumber}\n` : ''}${deal.notes ? `• Notas / Justificación: ${deal.notes}\n` : ''}
Agradecemos enormemente su gestión y pronta respuesta para poder avanzar con el cierre comercial y la emisión de la Orden de Compra por parte del partner.

Quedamos atentos a sus comentarios.

Saludos cordiales,
Equipo Especialistas Cisco - Intcomex Chile`;

  // Cuerpo HTML Optimizado para Microsoft Outlook (Estilos Inline Robustos)
  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.5; margin: 0; padding: 0;">
  <div style="max-width: 650px; background-color: #ffffff; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
    
    <!-- Encabezado / Saludo -->
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a;">
      <strong>${greeting} ${recipientLabel},</strong>
    </p>

    <p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">
      Junto con saludar cordialmente, solicitamos su amable apoyo y gestión con la revisión y aprobación del siguiente <strong>Deal Cisco</strong> que se encuentra escalado ${isVelocityHub ? 'en <strong>Velocity Hub (VF)</strong>' : 'para aprobación de <strong>AM Cisco</strong>'}:
    </p>

    <!-- Ficha Resumen del Deal -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
      <tr style="background-color: #005073; color: #ffffff;">
        <th colspan="2" style="padding: 10px 14px; font-size: 13px; text-align: left; font-weight: bold; letter-spacing: 0.5px;">
          FICHA DE SEGUIMIENTO DE DEAL CISCO
        </th>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; width: 38%; font-size: 12px;">Deal ID / OIP-TIP:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #0284c7; font-size: 13px;">
          ${deal.dealId}
        </td>
      </tr>
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Partner / Canal:</td>
        <td style="padding: 8px 14px; font-weight: bold; color: #0f172a; font-size: 12px;">
          ${deal.partnerName}
        </td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Cliente Final:</td>
        <td style="padding: 8px 14px; font-weight: bold; color: #0f172a; font-size: 12px;">
          ${deal.endCustomerName}
        </td>
      </tr>
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Canal de Escalamiento:</td>
        <td style="padding: 8px 14px; font-size: 12px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; ${isVelocityHub ? 'background-color: #e0f2fe; color: #0369a1;' : 'background-color: #e0e7ff; color: #3730a3;'}">
            ${isVelocityHub ? '⚡ Cisco Velocity Hub (VF)' : '👤 AM Cisco (Account Manager)'}
          </span>
        </td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Fecha de Escalamiento:</td>
        <td style="padding: 8px 14px; color: #334155; font-size: 12px;">
          ${dateFormatted} <span style="color: #d97706; font-weight: bold;">(Tiempo transcurrido: ${timeElapsedText})</span>
        </td>
      </tr>
      ${deal.vfTicketNumber ? `
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Caso / Ticket VF:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #0284c7; font-size: 12px;">
          ${deal.vfTicketNumber}
        </td>
      </tr>` : ''}
      ${deal.targetDiscountPct ? `
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Descuento Solicitado:</td>
        <td style="padding: 8px 14px; font-weight: bold; color: #16a34a; font-size: 12px;">
          ${deal.targetDiscountPct}%
        </td>
      </tr>` : ''}
      ${deal.estimatedTotalUsd ? `
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Monto Solución (USD):</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #0f172a; font-size: 12px;">
          US$ ${deal.estimatedTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>` : ''}
      ${deal.notes ? `
      <tr style="background-color: #ffffff;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px; vertical-align: top;">Notas / Justificación:</td>
        <td style="padding: 8px 14px; color: #475569; font-style: italic; font-size: 12px;">
          ${deal.notes}
        </td>
      </tr>` : ''}
    </table>

    <p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">
      Agradecemos enormemente su pronta respuesta y apoyo para avanzar con el cierre y confirmación de la orden.
    </p>

    <!-- Firma -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #64748b;">
      <strong style="color: #005073;">Cisco Automated • Distribución Intcomex Chile</strong><br/>
      Portal de Gestión y Seguimiento de Cotizaciones Cisco
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    greeting,
    recipientLabel,
    htmlContent,
    plainTextContent,
  };
}

/**
 * Copia el correo enriquecido al portapapeles en formato HTML y texto plano
 */
export async function copyDealReminderToClipboard(
  deal: DealReminderRecord,
  now: Date = new Date()
): Promise<{ success: boolean; subject: string; error?: string }> {
  try {
    const payload = generateDealReminderEmail(deal, now);

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([payload.htmlContent], { type: 'text/html' });
      const blobText = new Blob([payload.plainTextContent], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return { success: true, subject: payload.subject };
    }

    // Fallback de texto plano
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(payload.plainTextContent);
      return { success: true, subject: payload.subject };
    }

    return { success: false, subject: payload.subject, error: 'Portapapeles no disponible en este entorno.' };
  } catch (err: any) {
    console.error('Error copiando correo de recordatorio de Deal:', err);
    return { success: false, subject: '', error: err?.message || 'Error al copiar al portapapeles' };
  }
}
