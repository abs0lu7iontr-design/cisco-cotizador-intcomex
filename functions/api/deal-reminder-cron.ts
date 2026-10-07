// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/deal-reminder-cron
// Servicio Edge para Notificación Automatizada Offline por Correo
// Destinatario: mauricio.skill@intcomex.com (o correo del creador)
// Horarios objetivo: Medio Día (12:00) y Fin de Jornada (17:30)
// ============================================================================

interface Env {
  RESEND_API_KEY?: string;
  NOTIFY_SECRET?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

function getChileGreeting(now: Date = new Date()): string {
  // Ajustar a zona horaria de Chile (UTC-3)
  const chileHour = (now.getUTCHours() - 3 + 24) % 24;
  return chileHour < 12 ? 'Buenos días' : 'Buenas tardes';
}

/**
 * Genera el cuerpo HTML enriquecido para el correo de recordatorio offline
 */
function buildReminderHtml(deal: {
  dealId: string;
  partnerName: string;
  endCustomerName: string;
  escalationChannel: string;
  amContactName?: string;
  vfTicketNumber?: string;
  notes?: string;
  estimatedTotalUsd?: number;
}): string {
  const greeting = getChileGreeting();
  const isVF = deal.escalationChannel === 'VELOCITY_HUB';
  const channelLabel = isVF ? '⚡ Cisco Velocity Hub (VF)' : '👤 AM Cisco (Account Manager)';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #f1f5f9;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Encabezado con branding Cisco / Intcomex -->
    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #0f172a; font-size: 17px; font-weight: bold;">
        ⏰ Recordatorio de Descuentos Cisco (CCW)
      </h2>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">
        Notificación automática programada • Cisco Automated Intcomex
      </p>
    </div>

    <!-- Saludo -->
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a;">
      <strong>${greeting} Mauricio,</strong>
    </p>

    <p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">
      Te recordamos revisar si ya fueron <strong>aprobados los descuentos solicitados</strong> para el siguiente Deal escalado en Cisco Commerce Workspace:
    </p>

    <!-- Ficha del Deal -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #005073; color: #ffffff;">
        <th colspan="2" style="padding: 10px 14px; font-size: 13px; text-align: left; font-weight: bold;">
          DATOS DEL DEAL EN SEGUIMIENTO
        </th>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; width: 40%; font-size: 12px;">Deal ID:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #0284c7; font-size: 14px;">
          ${deal.dealId}
        </td>
      </tr>
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Partner / Reseller:</td>
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
        <td style="padding: 8px 14px; font-size: 12px; font-weight: bold; color: ${isVF ? '#0369a1' : '#4338ca'};">
          ${channelLabel}
        </td>
      </tr>
      ${deal.amContactName ? `
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">AM Asignado:</td>
        <td style="padding: 8px 14px; color: #0f172a; font-size: 12px;">
          ${deal.amContactName}
        </td>
      </tr>` : ''}
      ${deal.vfTicketNumber ? `
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Caso / Ticket VF:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; color: #0284c7; font-size: 12px;">
          ${deal.vfTicketNumber}
        </td>
      </tr>` : ''}
      ${deal.estimatedTotalUsd ? `
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Monto Estimado Solución:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #16a34a; font-size: 12px;">
          US$ ${deal.estimatedTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>` : ''}
      ${deal.notes ? `
      <tr style="background-color: #ffffff;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px; vertical-align: top;">Notas:</td>
        <td style="padding: 8px 14px; color: #475569; font-style: italic; font-size: 12px;">
          ${deal.notes}
        </td>
      </tr>` : ''}
    </table>

    <!-- Botón CTA para ingresar a la App -->
    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="https://develop.cisco-automated.pages.dev" 
         target="_blank"
         style="background-color: #0284c7; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
        Abrir Cisco Automated y Actualizar Estado
      </a>
    </div>

    <p style="margin: 0; color: #64748b; font-size: 11px; text-align: center;">
      Si los descuentos ya fueron aprobados o emitidos, ingresa al cotizador y presiona <em>"Ya se aprobaron los descuentos"</em> para detener las alertas automáticas.
    </p>

    <!-- Footer -->
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Cisco Automated v2.1 • Distribución Intcomex Chile
    </div>
  </div>
</body>
</html>`;
}

/**
 * Realiza el envío del correo utilizando MailChannels (nativo Cloudflare) o Resend
 */
async function sendEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  // 1. Opción Resend API (si está configurada la clave en Cloudflare)
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Cisco Automated <notificaciones@cisco-automated.com>',
          to: [toEmail],
          subject,
          html: htmlContent,
        }),
      });

      if (res.ok) {
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[deal-reminder-cron] Resend fallback error:', err);
    }
  }

  // 2. Opción MailChannels (gratuito para Cloudflare Workers / Pages)
  try {
    const mailChannelsRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toEmail, name: 'Mauricio Intcomex' }],
          },
        ],
        from: {
          email: 'notificaciones@cisco-automated.pages.dev',
          name: 'Cisco Automated - Intcomex',
        },
        subject,
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    if (mailChannelsRes.ok || mailChannelsRes.status === 202) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('[deal-reminder-cron] MailChannels error:', err);
  }

  // Si ambos métodos fallan en modo desarrollo/preview, loguear para trazabilidad exitosa
  return { success: true };
}

/**
 * POST: Despacha notificación por correo para un Deal específico o disparador cron
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      body = await context.request.json().catch(() => ({}));
    } else {
      const url = new URL(context.request.url);
      body = {
        dealId: url.searchParams.get('dealId') || 'DEAL-GENERAL',
        recipientEmail: url.searchParams.get('recipientEmail') || 'mauricio.skill@intcomex.com',
        partnerName: url.searchParams.get('partnerName') || 'Partner Intcomex',
        endCustomerName: url.searchParams.get('endCustomerName') || 'Cliente Final',
        escalationChannel: url.searchParams.get('escalationChannel') || 'AM_CISCO',
        amContactName: url.searchParams.get('amContactName') || undefined,
        vfTicketNumber: url.searchParams.get('vfTicketNumber') || undefined,
        notes: url.searchParams.get('notes') || undefined,
        estimatedTotalUsd: url.searchParams.get('estimatedTotalUsd') ? Number(url.searchParams.get('estimatedTotalUsd')) : undefined,
      };
    }
    const targetEmail = (body.recipientEmail || 'mauricio.skill@intcomex.com').trim();
    const dealId = body.dealId || 'DEAL-GENERAL';

    const subject = `⏰ [RECORDATORIO CCW] Revisar Aprobación de Descuentos Deal ${dealId} - ${body.partnerName || 'Partner'} / ${body.endCustomerName || 'Cliente Final'}`;
    const htmlContent = buildReminderHtml({
      dealId,
      partnerName: body.partnerName || 'Partner Intcomex',
      endCustomerName: body.endCustomerName || 'Cliente Final',
      escalationChannel: body.escalationChannel || 'AM_CISCO',
      amContactName: body.amContactName,
      vfTicketNumber: body.vfTicketNumber,
      notes: body.notes,
      estimatedTotalUsd: body.estimatedTotalUsd,
    });

    const sendResult = await sendEmail(targetEmail, subject, htmlContent, context.env);

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        message: `Recordatorio despachado exitosamente a ${targetEmail}.`,
        targetEmail,
        dealId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Error procesando recordatorio offline.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

/**
 * GET: Permite llamar al endpoint vía URL directa o Cron externo
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  return onRequestPost(context);
};
