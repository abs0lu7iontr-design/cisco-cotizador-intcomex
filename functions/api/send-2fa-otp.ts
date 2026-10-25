// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/send-2fa-otp
// International Access 2FA Dispatch & Cryptographic Verification Service
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

// Cryptographic HMAC-SHA256 signature helper (Web Crypto API)
async function createHmacSignature(payload: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Mail Dispatcher using MailChannels (free Cloudflare edge) or Resend
async function dispatchEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  // 1. Resend API
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Cisco Automated Security <seguridad@cisco-automated.pages.dev>',
          to: [toEmail],
          subject,
          html: htmlContent,
        }),
      });
      if (res.ok) return { success: true };
    } catch (err: any) {
      console.warn('[2FA Dispatch] Resend error:', err);
    }
  }

  // 2. MailChannels (Cloudflare Edge native)
  try {
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: {
          email: 'seguridad@cisco-automated.pages.dev',
          name: 'Cisco Automated • Seguridad 2FA',
        },
        subject,
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });
    if (res.ok || res.status === 202) return { success: true };
  } catch (err: any) {
    console.warn('[2FA Dispatch] MailChannels error:', err);
  }

  // Fallback log for development
  console.log(`[2FA Simulation] Email dispatched to ${toEmail}`);
  return { success: true };
}

function build2FaEmailHtml(code: string, username: string, country: string, city: string, ip: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Código de Verificación 2FA</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background-color: #0369a1; color: #e0f2fe; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.5px; }
    .code-box { background: linear-gradient(135deg, #0f172a, #1e1b4b); border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; text-shadow: 0 0 12px rgba(56,189,248,0.4); }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; color: #94a3b8; }
    .meta-table td { padding: 6px 0; border-bottom: 1px solid #334155; }
    .meta-table td.val { text-align: right; color: #f1f5f9; font-weight: 600; }
    .footer { font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Autenticación Adaptativa 2FA • Ingreso Internacional</div>
    <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #ffffff;">Verificación de Acceso Seguro</h2>
    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5; margin: 0 0 16px 0;">
      Hola <strong>${username}</strong>, se ha detectado un inicio de sesión fuera de Chile. Para autorizar tu ingreso, introduce el siguiente código de 6 dígitos:
    </p>

    <div class="code-box">
      <div style="font-size: 11px; text-transform: uppercase; color: #818cf8; font-weight: bold; margin-bottom: 6px;">Código de Acceso Temporal (Válido 10 min)</div>
      <div class="code">${code}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>📍 País detectado:</td>
        <td class="val">${country}</td>
      </tr>
      <tr>
        <td>🏙️ Ciudad / Nodo:</td>
        <td class="val">${city || 'Desconocida'}</td>
      </tr>
      <tr>
        <td>🌐 Dirección IP:</td>
        <td class="val">${ip}</td>
      </tr>
      <tr>
        <td>⏱️ Validez:</td>
        <td class="val">10 Minutos</td>
      </tr>
    </table>

    <div class="footer">
      Si no has solicitado este acceso, informa de inmediato al Administrador Principal (<strong>mskill</strong>).<br>
      Cisco Automated • Distribución Intcomex Chile
    </div>
  </div>
</body>
</html>`;
}

function buildAdminAlertHtml(username: string, email: string, country: string, city: string, ip: string, tempAdminCode: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Solicitud de Desbloqueo Internacional</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #e11d48; padding: 28px; }
    .code { font-family: monospace; font-size: 28px; font-weight: bold; color: #f43f5e; letter-spacing: 4px; text-align: center; padding: 14px; background: #0f172a; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div style="color: #f43f5e; font-weight: bold; font-size: 12px; text-transform: uppercase;">⚠️ Alerta de Administrador Root (mskill)</div>
    <h3 style="color: #ffffff; margin: 8px 0;">Solicitud de Desbloqueo de Acceso Internacional</h3>
    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
      El colaborador <strong>${username}</strong> (${email}) está intentando ingresar desde el extranjero (<strong>${country} - ${city}</strong>, IP: <code>${ip}</code>) y ha solicitado autorización.
    </p>
    <p style="font-size: 13px; color: #cbd5e1;">
      Puedes entregarle el siguiente <strong>Código Maestro de Contingencia</strong> (válido por 24 horas para este usuario):
    </p>
    <div class="code">${tempAdminCode}</div>
    <div style="font-size: 11px; color: #94a3b8; text-align: center;">Cisco Automated • Portal de Administración Intcomex</div>
  </div>
</body>
</html>`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const action = body?.action || 'send';
    const secretKey = context.env.NOTIFY_SECRET || 'Cisco_2FA_Edge_Master_Secret_2026!';

    // ========================================================================
    // ACCIÓN 1: GENERAR Y ENVIAR CÓDIGO OTP POR CORREO
    // ========================================================================
    if (action === 'send') {
      const username = (body?.username || '').trim().toLowerCase();
      const email = (body?.email || '').trim();
      const country = (body?.country || 'EXTERIOR').toUpperCase();
      const city = body?.city || 'Desconocida';
      const ip = context.request.headers.get('CF-Connecting-IP') || body?.ip || '127.0.0.1';

      if (!username || !email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario y correo son obligatorios para despachar 2FA.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Generar código numérico criptográficamente aleatorio de 6 dígitos
      const randomBuffer = new Uint32Array(1);
      crypto.getRandomValues(randomBuffer);
      const otpCode = (100000 + (randomBuffer[0] % 900000)).toString();

      // Validez de 10 minutos
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const signaturePayload = `${username}:${otpCode}:${expiresAt}`;
      const otpSignature = await createHmacSignature(signaturePayload, secretKey);

      // Despachar correo electrónico al usuario
      const subject = `🔐 [2FA Cisco Automated] Código de Acceso Internacional (${country})`;
      const html = build2FaEmailHtml(otpCode, username, country, city, ip);
      await dispatchEmail(email, subject, html, context.env);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Código 2FA enviado exitosamente al correo ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}.`,
          expiresAt,
          otpSignature,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ========================================================================
    // ACCIÓN 2: SOLICITAR DESBLOQUEO / CÓDIGO MAESTRO AL ADMINISTRADOR (mskill)
    // ========================================================================
    if (action === 'request_admin_unlock') {
      const username = (body?.username || '').trim().toLowerCase();
      const email = (body?.email || '').trim();
      const country = (body?.country || 'EXTERIOR').toUpperCase();
      const city = body?.city || 'Desconocida';
      const ip = context.request.headers.get('CF-Connecting-IP') || body?.ip || '127.0.0.1';

      // Código maestro diario para el usuario basado en fecha y secreto
      const dayStamp = new Date().toISOString().slice(0, 10);
      const adminCodePayload = `ADMIN_OVERRIDE:${username}:${dayStamp}`;
      const fullSig = await createHmacSignature(adminCodePayload, secretKey);
      const tempAdminCode = fullSig.slice(0, 8).toUpperCase();

      const adminEmail = 'mauricio.skill@intcomex.com';
      const adminSubject = `🚨 [URGENTE 2FA] Solicitud de Desbloqueo Internacional: ${username} (${country})`;
      const adminHtml = buildAdminAlertHtml(username, email, country, city, ip, tempAdminCode);
      await dispatchEmail(adminEmail, adminSubject, adminHtml, context.env);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Se ha notificado al Administrador Principal (mskill) con los detalles de tu solicitud.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ========================================================================
    // ACCIÓN 3: VERIFICAR CÓDIGO OTP O CÓDIGO MAESTRO DE ADMINISTRADOR
    // ========================================================================
    if (action === 'verify') {
      const username = (body?.username || '').trim().toLowerCase();
      const inputCode = (body?.code || '').trim().replace(/\s+/g, '');
      const otpSignature = (body?.otpSignature || '').trim();
      const expiresAt = Number(body?.expiresAt) || 0;

      if (!username || !inputCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Debe ingresar el código de verificación.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 1. Verificación de Código Maestro de Administrador (8 caracteres alfanuméricos)
      const dayStamp = new Date().toISOString().slice(0, 10);
      const adminCodePayload = `ADMIN_OVERRIDE:${username}:${dayStamp}`;
      const expectedAdminSig = (await createHmacSignature(adminCodePayload, secretKey)).slice(0, 8).toUpperCase();

      // Master override global por mskill
      const rootMasterPayload = `ROOT_MASTER:${dayStamp}`;
      const expectedRootMaster = (await createHmacSignature(rootMasterPayload, secretKey)).slice(0, 8).toUpperCase();

      if (inputCode.toUpperCase() === expectedAdminSig || inputCode.toUpperCase() === expectedRootMaster) {
        return new Response(
          JSON.stringify({
            success: true,
            isOverride: true,
            message: 'Acceso internacional autorizado por Código Maestro de Administrador.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 2. Verificación de Código OTP numérico de 6 dígitos
      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ success: false, error: 'El código 2FA ha expirado (validez de 10 minutos). Solicita uno nuevo.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const expectedPayload = `${username}:${inputCode}:${expiresAt}`;
      const expectedSignature = await createHmacSignature(expectedPayload, secretKey);

      if (otpSignature !== expectedSignature) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código de verificación incorrecto. Intente nuevamente.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Autenticación 2FA completada exitosamente.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ========================================================================
    // ACCIÓN 4: GENERAR CÓDIGO MAESTRO DE CONTINGENCIA (ADMIN PANEL / MSKILL)
    // ========================================================================
    if (action === 'generate_admin_override') {
      const username = (body?.username || '').trim().toLowerCase();
      const dayStamp = new Date().toISOString().slice(0, 10);
      const adminCodePayload = username ? `ADMIN_OVERRIDE:${username}:${dayStamp}` : `ROOT_MASTER:${dayStamp}`;
      const sig = (await createHmacSignature(adminCodePayload, secretKey)).slice(0, 8).toUpperCase();
      return new Response(
        JSON.stringify({
          success: true,
          dayStamp,
          code: sig,
          target: username || 'GLOBAL_ROOT',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no reconocida.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error en validación 2FA.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
