// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/session-auth
// Verifies user credentials against Firestore and mints an HMAC-signed Edge
// session token (plus an optional Firebase Custom Token when SA JSON exists).
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import {
  buildEdgeSessionCookie,
  checkEdgeRateLimit,
  EdgeEnv,
  mintEdgeSessionToken,
  mintFirebaseCustomToken,
  mintTwoFactorChallengeToken,
  resolveFirebaseProjectId,
  revokeEdgeSessionJti,
  verifyEdgeSessionToken,
  verifyFirestoreUserCredentials,
  verifyTwoFactorProofToken,
} from '../lib/edgeAuth';

function isLocalOrigin(request: Request): boolean {
  try {
    const host = (new URL(request.url).hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function isStrictTurnstileHost(request: Request): boolean {
  try {
    const host = (new URL(request.url).hostname || '').toLowerCase();
    return host === 'cisco-automated.pages.dev' || host === 'develop.cisco-automated.pages.dev';
  } catch {
    return false;
  }
}

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const action = String(body?.action || 'login').trim().toLowerCase();

    if (action === 'logout') {
      const current = await verifyEdgeSessionToken(context.request, context.env);
      if (current.valid && current.jti && current.exp) {
        await revokeEdgeSessionJti(current.jti, current.exp);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': buildEdgeSessionCookie('', 0, context.request),
          ...corsHeaders,
        },
      });
    }

    const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const ipRate = await checkEdgeRateLimit(`session-auth:ip:${ip}`, 25, 300);
    if (!ipRate.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Demasiados intentos desde esta IP. Intenta nuevamente en unos minutos.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const turnstileToken = String(body?.turnstileToken || '').trim();
    const twoFactorProof = String(body?.twoFactorProof || '').trim();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario y contraseña requeridos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userRate = await checkEdgeRateLimit(`session-auth:user:${username}:${ip}`, 10, 900);
    if (!userRate.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const secretKey = context.env.TURNSTILE_SECRET_KEY
      ? String(context.env.TURNSTILE_SECRET_KEY).trim().replace(/^["']|["']$/g, '').trim()
      : '';
    const hasTwoFactorProof = Boolean(twoFactorProof);

    // Verificar Turnstile cuando el cliente aporta token o en dominios productivos oficiales
    const mustVerifyTurnstile = Boolean(
      secretKey && !hasTwoFactorProof && (turnstileToken || isStrictTurnstileHost(context.request))
    );
    if (mustVerifyTurnstile) {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'Verificación Cloudflare Turnstile requerida.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      const fd = new FormData();
      fd.append('secret', secretKey);
      fd.append('response', turnstileToken);
      if (ip && ip !== '0.0.0.0') fd.append('remoteip', ip);
      const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: fd,
      });
      const tsData: any = await tsRes.json().catch(() => ({}));
      if (!tsData?.success) {
        return new Response(
          JSON.stringify({ success: false, error: 'Desafío de seguridad Turnstile inválido o expirado.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const projectId = resolveFirebaseProjectId(context.env);
    const verifiedUser = await verifyFirestoreUserCredentials(projectId, username, password);
    if (!verifiedUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciales inválidas o usuario inactivo.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Control geográfico en servidor: fuera de Chile (o país ausente fuera de localhost) exigir 2FA antes de emitir tokens
    const cf = (context.request as any).cf || {};
    const hasCfCountry = Boolean(cf && cf.country && String(cf.country).trim().length > 0);
    const localDev = !hasCfCountry && isLocalOrigin(context.request);
    const country = hasCfCountry ? String(cf.country).toUpperCase().trim() : localDev ? 'CL' : 'UNKNOWN';
    const requires2FA = country !== 'CL';

    if (requires2FA) {
      const proofValid = await verifyTwoFactorProofToken(twoFactorProof, verifiedUser.username, ip, context.env);
      if (!proofValid) {
        const twoFactorChallenge = await mintTwoFactorChallengeToken(verifiedUser.username, ip, context.env);
        return new Response(
          JSON.stringify({
            success: false,
            requires2FA: true,
            twoFactorChallenge,
            geo: {
              country,
              city: String(cf.city || (localDev ? 'Santiago' : 'Desconocida')).trim(),
              region: String(cf.region || (localDev ? 'RM' : 'N/A')).trim(),
              ip,
              isChile: false,
              requires2FA: true,
            },
            user: {
              username: verifiedUser.username,
              role: verifiedUser.role,
              full_name: verifiedUser.full_name,
              email: verifiedUser.email,
            },
            error: 'Se requiere verificación 2FA adicional antes de emitir sesión.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const ttlSeconds = 43200;
    const session = await mintEdgeSessionToken(verifiedUser.username, verifiedUser.role, context.env, ttlSeconds);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Servicio de sesión Edge no configurado.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const firebaseCustomToken = await mintFirebaseCustomToken(
      verifiedUser.username,
      {
        role: verifiedUser.role,
        admin: verifiedUser.role === 'admin',
        username: verifiedUser.username,
        email: verifiedUser.email || undefined,
        email_verified: Boolean(verifiedUser.email),
      },
      context.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        ...(firebaseCustomToken ? { firebaseCustomToken } : {}),
        user: {
          username: verifiedUser.username,
          role: verifiedUser.role,
          full_name: verifiedUser.full_name,
          email: verifiedUser.email,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': buildEdgeSessionCookie(session.token, ttlSeconds, context.request),
          ...corsHeaders,
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error interno en autenticación Edge.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
