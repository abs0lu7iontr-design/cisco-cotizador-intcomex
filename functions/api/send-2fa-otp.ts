// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/send-2fa-otp
// International Access 2FA Dispatch & Cryptographic Verification Service
// Hardened: server-side Firestore email lookup, domain-separated HMAC secret,
// attempt-throttling & single-use OTP signature revocation via caches.default.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import {
  createHmacSignature,
  deriveScopedEdgeSecret,
  EdgeEnv,
  escapeHtml,
  fetchFirestoreUserRecord,
  resolveFirebaseProjectId,
  timingSafeEqualStr,
  verifyFirestoreUserCredentials,
} from '../lib/edgeAuth';

const MAX_OTP_ATTEMPTS = 5;
const otpAttemptMemoryMap = new Map<string, { fails: number; used: boolean; exp: number }>();

async function readOtpGuardState(signature: string): Promise<{ fails: number; used: boolean }> {
  const mem = otpAttemptMemoryMap.get(signature);
  if (mem && Date.now() <= mem.exp) {
    return { fails: mem.fails, used: mem.used };
  }
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (cacheStorage) {
    try {
      const res = await cacheStorage.match(`https://otp-guard.internal/${signature}`);
      if (res) {
        const data: any = await res.json();
        return { fails: Number(data?.fails) || 0, used: Boolean(data?.used) };
      }
    } catch {}
  }
  return { fails: 0, used: false };
}

async function writeOtpGuardState(
  signature: string,
  state: { fails: number; used: boolean },
  expiresAt: number
): Promise<void> {
  const expMs = Math.max(Date.now() + 60_000, expiresAt || Date.now() + 600_000);
  otpAttemptMemoryMap.set(signature, { ...state, exp: expMs });
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (cacheStorage) {
    try {
      const ttl = Math.max(60, Math.ceil((expMs - Date.now()) / 1000));
      await cacheStorage.put(
        `https://otp-guard.internal/${signature}`,
        new Response(JSON.stringify(state), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${ttl}`,
          },
        })
      );
    } catch {}
  }
}

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

async function dispatchEmail(
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

  return {
    success: false,
    error: 'No se pudo despachar el correo 2FA mediante los proveedores configurados.',
  };
}

function build2FaEmailHtml(code: string, username: string, country: string, city: string, ip: string): string {
  const safeCode = escapeHtml(code);
  const safeUser = escapeHtml(username);
  const safeCountry = escapeHtml(country);
  const safeCity = escapeHtml(city || 'Desconocida');
  const safeIp = escapeHtml(ip);
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
    .code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; }
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
      Hola <strong>${safeUser}</strong>, se ha detectado un inicio de sesión fuera de Chile. Para autorizar tu ingreso, introduce el siguiente código de 6 dígitos:
    </p>
    <div class="code-box">
      <div style="font-size: 11px; text-transform: uppercase; color: #818cf8; font-weight: bold; margin-bottom: 6px;">Código de Acceso Temporal (Válido 10 min)</div>
      <div class="code">${safeCode}</div>
    </div>
    <table class="meta-table">
      <tr><td>País detectado:</td><td class="val">${safeCountry}</td></tr>
      <tr><td>Ciudad / Nodo:</td><td class="val">${safeCity}</td></tr>
      <tr><td>Dirección IP:</td><td class="val">${safeIp}</td></tr>
      <tr><td>Validez:</td><td class="val">10 Minutos</td></tr>
    </table>
    <div class="footer">
      Si no has solicitado este acceso, informa de inmediato al Administrador Principal (<strong>mskill</strong>).<br>
      Cisco Automated • Distribución Intcomex Chile
    </div>
  </div>
</body>
</html>`;
}

function buildAdminAlertHtml(
  username: string,
  email: string,
  country: string,
  city: string,
  ip: string,
  tempAdminCode: string
): string {
  const safeUser = escapeHtml(username);
  const safeEmail = escapeHtml(email);
  const safeCountry = escapeHtml(country);
  const safeCity = escapeHtml(city || 'Desconocida');
  const safeIp = escapeHtml(ip);
  const safeCode = escapeHtml(tempAdminCode);
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
    <div style="color: #f43f5e; font-weight: bold; font-size: 12px; text-transform: uppercase;">Alerta de Administrador Root (mskill)</div>
    <h3 style="color: #ffffff; margin: 8px 0;">Solicitud de Desbloqueo de Acceso Internacional</h3>
    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
      El colaborador <strong>${safeUser}</strong> (${safeEmail}) está intentando ingresar desde el extranjero (<strong>${safeCountry} - ${safeCity}</strong>, IP: <code>${safeIp}</code>) y ha solicitado autorización.
    </p>
    <p style="font-size: 13px; color: #cbd5e1;">
      Puedes entregarle el siguiente <strong>Código Maestro de Contingencia</strong> (válido por 24 horas para este usuario):
    </p>
    <div class="code">${safeCode}</div>
    <div style="font-size: 11px; color: #94a3b8; text-align: center;">Cisco Automated • Portal de Administración Intcomex</div>
  </div>
</body>
</html>`;
}

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const action = body?.action || 'send';
    const secretKey = await deriveScopedEdgeSecret(context.env, '2fa-otp-v1');
    if (!secretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Servicio criptográfico 2FA no configurado en el servidor.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const projectId = resolveFirebaseProjectId(context.env);

    // ACCIÓN 1: GENERAR Y ENVIAR CÓDIGO OTP AL CORREO REGISTRADO EN FIRESTORE
    if (action === 'send') {
      const username = String(body?.username || '').trim().toLowerCase();
      const country = String(body?.country || 'EXTERIOR').toUpperCase();
      const city = String(body?.city || 'Desconocida');
      const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      if (!username) {
        return new Response(
          JSON.stringify({ success: false, error: 'El nombre de usuario es obligatorio para despachar 2FA.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const userRecord = await fetchFirestoreUserRecord(projectId, username);
      if (!userRecord || userRecord.is_active !== 1 || !userRecord.email) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Usuario inactivo o sin correo corporativo registrado en Firestore para recibir 2FA.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const verifiedEmail = userRecord.email.trim().toLowerCase();
      const randomBytes = new Uint32Array(3);
      crypto.getRandomValues(randomBytes);
      const otpCode = (100000 + (randomBytes[0] % 900000)).toString();
      const nonce = `${randomBytes[1].toString(16)}${randomBytes[2].toString(16)}`;
      const expiresAt = Date.now() + 10 * 60 * 1000;

      const signaturePayload = `${username}:${verifiedEmail}:${otpCode}:${expiresAt}:${nonce}`;
      const otpSignature = await createHmacSignature(signaturePayload, secretKey);

      const subject = `🔐 [2FA Cisco Automated] Código de Acceso Internacional (${country})`;
      const html = build2FaEmailHtml(otpCode, username, country, city, ip);
      const sent = await dispatchEmail(verifiedEmail, subject, html, context.env);
      if (!sent.success) {
        return new Response(
          JSON.stringify({ success: false, error: sent.error || 'Error enviando correo 2FA.' }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Código 2FA enviado exitosamente al correo ${verifiedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}.`,
          expiresAt,
          nonce,
          otpSignature,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ACCIÓN 2: SOLICITAR DESBLOQUEO AL ADMINISTRADOR (mskill)
    if (action === 'request_admin_unlock') {
      const username = String(body?.username || '').trim().toLowerCase();
      const country = String(body?.country || 'EXTERIOR').toUpperCase();
      const city = String(body?.city || 'Desconocida');
      const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      const userRecord = await fetchFirestoreUserRecord(projectId, username);
      if (!userRecord || userRecord.is_active !== 1) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario no válido o inactivo.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const dayStamp = new Date().toISOString().slice(0, 10);
      const adminCodePayload = `ADMIN_OVERRIDE:${username}:${dayStamp}`;
      const fullSig = await createHmacSignature(adminCodePayload, secretKey);
      const tempAdminCode = fullSig.slice(0, 8).toUpperCase();

      const adminEmail = 'mauricio.skill@intcomex.com';
      const adminSubject = `🚨 [URGENTE 2FA] Solicitud de Desbloqueo Internacional: ${username} (${country})`;
      const adminHtml = buildAdminAlertHtml(
        username,
        userRecord.email || 'sin-correo-registrado',
        country,
        city,
        ip,
        tempAdminCode
      );
      const sent = await dispatchEmail(adminEmail, adminSubject, adminHtml, context.env);
      if (!sent.success) {
        return new Response(
          JSON.stringify({ success: false, error: sent.error || 'No se pudo notificar al Administrador.' }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Se ha notificado al Administrador Principal (mskill) con los detalles de tu solicitud.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ACCIÓN 3: VERIFICAR CÓDIGO OTP (CON LÍMITE DE INTENTOS Y USO ÚNICO) O CÓDIGO MAESTRO
    if (action === 'verify') {
      const username = String(body?.username || '').trim().toLowerCase();
      const inputCode = String(body?.code || '').trim().replace(/\s+/g, '');
      const otpSignature = String(body?.otpSignature || '').trim().toLowerCase();
      const nonce = String(body?.nonce || '').trim();
      const expiresAt = Number(body?.expiresAt) || 0;

      if (!username || !inputCode) {
        return new Response(
          JSON.stringify({ success: false, error: 'Debe ingresar el código de verificación.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const dayStamp = new Date().toISOString().slice(0, 10);
      const adminCodePayload = `ADMIN_OVERRIDE:${username}:${dayStamp}`;
      const expectedAdminSig = (await createHmacSignature(adminCodePayload, secretKey)).slice(0, 8).toUpperCase();
      const rootMasterPayload = `ROOT_MASTER:${dayStamp}`;
      const expectedRootMaster = (await createHmacSignature(rootMasterPayload, secretKey)).slice(0, 8).toUpperCase();

      if (
        timingSafeEqualStr(inputCode.toUpperCase(), expectedAdminSig) ||
        timingSafeEqualStr(inputCode.toUpperCase(), expectedRootMaster)
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            isOverride: true,
            message: 'Acceso internacional autorizado por Código Maestro de Administrador.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!Number.isFinite(expiresAt) || expiresAt <= 0 || Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ success: false, error: 'El código 2FA ha expirado (validez de 10 minutos). Solicita uno nuevo.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (!/^[0-9a-f]{64}$/i.test(otpSignature) || !nonce) {
        return new Response(
          JSON.stringify({ success: false, error: 'Firma o nonce de sesión 2FA inválidos.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const guard = await readOtpGuardState(otpSignature);
      if (guard.used) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este código 2FA ya fue utilizado. Solicita uno nuevo.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      if (guard.fails >= MAX_OTP_ATTEMPTS) {
        return new Response(
          JSON.stringify({ success: false, error: 'Demasiados intentos fallidos. Solicita un nuevo código 2FA.' }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const userRecord = await fetchFirestoreUserRecord(projectId, username);
      if (!userRecord || userRecord.is_active !== 1 || !userRecord.email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario no válido o sin correo corporativo.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const verifiedEmail = userRecord.email.trim().toLowerCase();
      const expectedPayload = `${username}:${verifiedEmail}:${inputCode}:${expiresAt}:${nonce}`;
      const expectedSignature = await createHmacSignature(expectedPayload, secretKey);

      if (!timingSafeEqualStr(otpSignature, expectedSignature.toLowerCase())) {
        await writeOtpGuardState(otpSignature, { fails: guard.fails + 1, used: false }, expiresAt);
        return new Response(
          JSON.stringify({ success: false, error: 'Código de verificación incorrecto. Intente nuevamente.' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      await writeOtpGuardState(otpSignature, { fails: guard.fails, used: true }, expiresAt);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Autenticación 2FA completada exitosamente.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ACCIÓN 4: GENERAR CÓDIGO MAESTRO DE CONTINGENCIA (SOLO ADMIN AUTENTICADO)
    if (action === 'generate_admin_override') {
      const authHeader = context.request.headers.get('Authorization') || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const configuredAdminSecret = (context.env.ADMIN_OVERRIDE_SECRET || context.env.NOTIFY_SECRET || '').trim();
      const hasSecretAuth =
        Boolean(configuredAdminSecret) &&
        Boolean(bearerToken || body?.adminSecret) &&
        timingSafeEqualStr(bearerToken || String(body?.adminSecret || ''), configuredAdminSecret);

      let isVerifiedAdmin = hasSecretAuth;
      if (!isVerifiedAdmin) {
        const adminUsername = String(body?.adminUsername || '').trim().toLowerCase();
        const adminPassword = String(body?.adminPassword || '');
        if (adminUsername && adminPassword) {
          const adminUser = await verifyFirestoreUserCredentials(projectId, adminUsername, adminPassword, 'admin');
          isVerifiedAdmin = Boolean(adminUser);
        }
      }

      if (!isVerifiedAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Autorización requerida: ingrese credenciales válidas de Administrador.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const username = String(body?.username || '').trim().toLowerCase();
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
