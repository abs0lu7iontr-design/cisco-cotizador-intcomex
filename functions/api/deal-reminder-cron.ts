// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/deal-reminder-cron
// Servicio Edge autenticado para notificación por correo de Deals Cisco.
// Hardened: Edge CORS allowlist, verificación de sesión o Bearer NOTIFY_SECRET,
// restricción de dominio destinatario y escape HTML obligatorio.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import { EdgeEnv, escapeHtml, timingSafeEqualStr, verifyEdgeSessionToken } from '../lib/edgeAuth';

function isAllowedReminderRecipient(email: string, env: EdgeEnv): boolean {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
  const rawDomains = (env.ALLOWED_REMINDER_DOMAINS || 'intcomex.com,mayor.cl').toLowerCase();
  const allowedDomains = rawDomains
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  const domain = clean.split('@')[1] || '';
  return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

async function isAuthorizedCronOrSession(request: Request, env: EdgeEnv, allowSession: boolean): Promise<boolean> {
  const authHeader = (request.headers.get('Authorization') || '').trim();
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const notifySecret = (env.NOTIFY_SECRET || '').trim();
  if (notifySecret && bearer && timingSafeEqualStr(bearer, notifySecret)) {
    return true;
  }
  if (!allowSession) return false;
  const session = await verifyEdgeSessionToken(request, env);
  return session.valid;
}

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

function getChileGreeting(now: Date = new Date()): string {
  const chileHour = (now.getUTCHours() - 3 + 24) % 24;
  return chileHour < 12 ? 'Buenos días' : 'Buenas tardes';
}

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

  const safeDealId = escapeHtml(deal.dealId);
  const safePartner = escapeHtml(deal.partnerName);
  const safeEndCustomer = escapeHtml(deal.endCustomerName);
  const safeAm = deal.amContactName ? escapeHtml(deal.amContactName) : '';
  const safeVf = deal.vfTicketNumber ? escapeHtml(deal.vfTicketNumber) : '';
  const safeNotes = deal.notes ? escapeHtml(deal.notes) : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #f1f5f9;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #0f172a; font-size: 17px; font-weight: bold;">
        ⏰ Recordatorio de Descuentos Cisco (CCW)
      </h2>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">
        Notificación automática programada • Cisco Automated Intcomex
      </p>
    </div>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a;">
      <strong>${greeting} Mauricio,</strong>
    </p>
    <p style="margin: 0 0 16px 0; color: #334155; font-size: 13px;">
      Te recordamos revisar si ya fueron <strong>aprobados los descuentos solicitados</strong> para el siguiente Deal escalado en Cisco Commerce Workspace:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #005073; color: #ffffff;">
        <th colspan="2" style="padding: 10px 14px; font-size: 13px; text-align: left; font-weight: bold;">
          DATOS DEL DEAL EN SEGUIMIENTO
        </th>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; width: 40%; font-size: 12px;">Deal ID:</td>
        <td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #0284c7; font-size: 14px;">${safeDealId}</td>
      </tr>
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Partner / Reseller:</td>
        <td style="padding: 8px 14px; font-weight: bold; color: #0f172a; font-size: 12px;">${safePartner}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Cliente Final:</td>
        <td style="padding: 8px 14px; font-weight: bold; color: #0f172a; font-size: 12px;">${safeEndCustomer}</td>
      </tr>
      <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Canal de Escalamiento:</td>
        <td style="padding: 8px 14px; font-size: 12px; font-weight: bold; color: ${isVF ? '#0369a1' : '#4338ca'};">${channelLabel}</td>
      </tr>
      ${safeAm ? `<tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">AM Asignado:</td><td style="padding: 8px 14px; color: #0f172a; font-size: 12px;">${safeAm}</td></tr>` : ''}
      ${safeVf ? `<tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Caso / Ticket VF:</td><td style="padding: 8px 14px; font-family: Consolas, monospace; color: #0284c7; font-size: 12px;">${safeVf}</td></tr>` : ''}
      ${Number.isFinite(deal.estimatedTotalUsd) && (deal.estimatedTotalUsd || 0) > 0 ? `<tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px;">Monto Estimado Solución:</td><td style="padding: 8px 14px; font-family: Consolas, monospace; font-weight: bold; color: #16a34a; font-size: 12px;">US$ ${Number(deal.estimatedTotalUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>` : ''}
      ${safeNotes ? `<tr style="background-color: #ffffff;"><td style="padding: 8px 14px; font-weight: bold; color: #475569; font-size: 12px; vertical-align: top;">Notas:</td><td style="padding: 8px 14px; color: #475569; font-style: italic; font-size: 12px;">${safeNotes}</td></tr>` : ''}
    </table>
    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="https://develop.cisco-automated.pages.dev" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
        Abrir Cisco Automated y Actualizar Estado
      </a>
    </div>
    <p style="margin: 0; color: #64748b; font-size: 11px; text-align: center;">
      Si los descuentos ya fueron aprobados o emitidos, ingresa al cotizador y presiona <em>"Ya se aprobaron los descuentos"</em> para detener las alertas automáticas.
    </p>
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      Cisco Automated • Distribución Intcomex Chile
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  env: EdgeEnv
): Promise<{ success: boolean; error?: string }> {
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
      if (res.ok) return { success: true };
    } catch (err: any) {
      console.warn('[deal-reminder-cron] Resend fallback error:', err);
    }
  }

  try {
    const mailChannelsRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail, name: 'Mauricio Intcomex' }] }],
        from: {
          email: 'notificaciones@cisco-automated.pages.dev',
          name: 'Cisco Automated - Intcomex',
        },
        subject,
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });
    if (mailChannelsRes.ok || mailChannelsRes.status === 202) return { success: true };
  } catch (err: any) {
    console.warn('[deal-reminder-cron] MailChannels error:', err);
  }

  return {
    success: false,
    error: 'No se pudo despachar el recordatorio de correo mediante los proveedores Edge.',
  };
}

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const authorized = await isAuthorizedCronOrSession(context.request, context.env, context.request.method === 'POST');
    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Autorización requerida para despachar recordatorios.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

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
        estimatedTotalUsd: url.searchParams.get('estimatedTotalUsd')
          ? Number(url.searchParams.get('estimatedTotalUsd'))
          : undefined,
      };
    }

    const targetEmail = String(body.recipientEmail || 'mauricio.skill@intcomex.com').trim();
    if (!isAllowedReminderRecipient(targetEmail, context.env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Destinatario de recordatorio fuera de dominios corporativos autorizados.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const dealId = String(body.dealId || 'DEAL-GENERAL').trim();
    const cleanPartner = String(body.partnerName || 'Partner').replace(/[\r\n]/g, ' ');
    const cleanClient = String(body.endCustomerName || 'Cliente Final').replace(/[\r\n]/g, ' ');
    const subject = `⏰ [RECORDATORIO CCW] Revisar Aprobación de Descuentos Deal ${dealId.replace(/[\r\n]/g, '')} - ${cleanPartner} / ${cleanClient}`;
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
    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error, targetEmail, dealId }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recordatorio despachado exitosamente a ${targetEmail}.`,
        targetEmail,
        dealId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Error procesando recordatorio.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

export const onRequestGet: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  const authorizedCron = await isAuthorizedCronOrSession(context.request, context.env, false);
  if (!authorizedCron) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método GET deshabilitado sin secreto cron autorizado.',
      }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
  return onRequestPost(context);
};
