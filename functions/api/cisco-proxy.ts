// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/cisco-proxy
// Authenticated Server-to-Server (Edge) Proxy para Cisco OAuth2 M2M & APIX.
// Requiere token de sesión Edge firmado, elimina secretos hardcodeados en repo,
// restringe métodos HTTP y mantiene el token de servidor aislado del navegador.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import { checkEdgeRateLimit, EdgeEnv, sha256Hex, verifyEdgeSessionToken } from '../lib/edgeAuth';

const DEFAULT_AUTH_URL = 'https://id.cisco.com/oauth2/default/v1/token';
const SERVER_MANAGED_TOKEN_SENTINEL = '__EDGE_MANAGED__';

const ALLOWED_AUTH_HOSTS = new Set<string>([
  'id.cisco.com',
  'cloudsso.cisco.com',
  'cloudsso1.cisco.com',
]);

const ALLOWED_API_HOSTS = new Set<string>([
  'apix.cisco.com',
  'api.cisco.com',
  'sec.cloudapps.cisco.com',
  'capitest.cisco.com',
  'capi.cisco.com',
  'it-api.cisco.com',
]);

const ALLOWED_PROXY_METHODS = new Set<string>(['GET', 'POST']);

function isAllowedCiscoUrl(rawUrl: string, allowedHosts: Set<string>): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      allowedHosts.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function mintCiscoOAuthToken(
  authUrl: string,
  clientId: string,
  clientSecret: string,
  useCache: boolean
): Promise<
  | { ok: true; status: number; data: any; token: string }
  | { ok: false; status: number; error: string }
> {
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  const cacheUrl = useCache
    ? `https://cisco-token-cache.internal/${await sha256Hex(`${authUrl}:${clientId}`)}`
    : null;

  if (cacheStorage && cacheUrl) {
    try {
      const cached = await cacheStorage.match(cacheUrl);
      if (cached) {
        const cachedData: any = await cached.json();
        if (cachedData?.access_token) {
          return { ok: true, status: 200, data: cachedData, token: cachedData.access_token };
        }
      }
    } catch {}
  }

  const form = new URLSearchParams();
  form.append('grant_type', 'client_credentials');
  form.append('client_id', clientId);
  form.append('client_secret', clientSecret);

  const tokenRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  const rawText = await tokenRes.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { raw: rawText };
  }

  if (!tokenRes.ok || !parsed?.access_token) {
    return {
      ok: false,
      status: tokenRes.status || 502,
      error: parsed?.error_description || parsed?.error || `Error autenticando con Cisco ID (${tokenRes.status})`,
    };
  }

  if (cacheStorage && cacheUrl) {
    try {
      const ttl = Math.max(60, Math.min(3500, (Number(parsed.expires_in) || 3600) - 90));
      await cacheStorage.put(
        cacheUrl,
        new Response(JSON.stringify(parsed), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${ttl}`,
          },
        })
      );
    } catch {}
  }

  return { ok: true, status: 200, data: parsed, token: parsed.access_token };
}

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const start = Date.now();
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const env = (context.env || {}) as EdgeEnv;

    // Verificación obligatoria de sesión autenticada en servidor Edge
    const sessionCheck = await verifyEdgeSessionToken(context.request, env);
    if (!sessionCheck.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: sessionCheck.error || 'Acceso no autorizado al proxy Cisco.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (sessionCheck.role === 'viewer') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rol viewer sin permisos para operar credenciales Cisco M2M.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const proxyRate = await checkEdgeRateLimit(`cisco-proxy:${sessionCheck.username || 'anon'}`, 60, 300);
    if (!proxyRate.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Límite de solicitudes al proxy Cisco alcanzado. Reintente en unos minutos.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const body: any = await context.request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payload JSON inválido en proxy Cisco M2M.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
    const action = body?.action || 'token';

    const bodyClientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
    const bodyClientSecret = typeof body?.clientSecret === 'string' ? body.clientSecret.trim() : '';
    const hasServerCreds = Boolean(env.CISCO_CLIENT_ID && env.CISCO_CLIENT_SECRET);
    const hasCompleteClientCreds = Boolean(bodyClientId && bodyClientSecret);
    const usingServerCreds = Boolean(hasServerCreds && !hasCompleteClientCreds);

    // Aislamiento estricto: jamás mezclar clientId parcial del cliente con secretos del servidor
    const clientId = usingServerCreds ? String(env.CISCO_CLIENT_ID).trim() : bodyClientId;
    const clientSecret = usingServerCreds ? String(env.CISCO_CLIENT_SECRET).trim() : bodyClientSecret;
    const authUrl = (body?.authUrl || env.CISCO_AUTH_URL || DEFAULT_AUTH_URL).trim();

    if (!isAllowedCiscoUrl(authUrl, ALLOWED_AUTH_HOSTS)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'URL de autenticación Cisco no permitida por el proxy.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (action === 'token') {
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              'Credenciales Cisco M2M no configuradas en Cloudflare Pages (CISCO_CLIENT_ID / CISCO_CLIENT_SECRET) ni en la configuración personalizada del usuario.',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      const tokenOutcome = await mintCiscoOAuthToken(authUrl, clientId, clientSecret, usingServerCreds);
      if (tokenOutcome.ok === false) {
        return new Response(
          JSON.stringify({
            success: false,
            httpStatus: tokenOutcome.status,
            latencyMs: Date.now() - start,
            error: 'error' in tokenOutcome ? tokenOutcome.error : 'Error autenticando con Cisco ID.',
          }),
          {
            status: tokenOutcome.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Nunca filtrar access_token emitido con secretos de servidor hacia el navegador
      const responseData = usingServerCreds
        ? {
            access_token: SERVER_MANAGED_TOKEN_SENTINEL,
            token_type: tokenOutcome.data?.token_type || 'Bearer',
            expires_in: tokenOutcome.data?.expires_in || 3600,
            scope: tokenOutcome.data?.scope || 'customscope',
          }
        : tokenOutcome.data;

      return new Response(
        JSON.stringify({
          success: true,
          httpStatus: 200,
          latencyMs: Date.now() - start,
          data: responseData,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (action === 'request') {
      const targetUrl = String(body?.url || '').trim();
      if (!isAllowedCiscoUrl(targetUrl, ALLOWED_API_HOSTS)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dominio de destino no permitido por el proxy Cisco.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      const reqMethod = String(body?.method || 'GET').toUpperCase().trim();
      if (!ALLOWED_PROXY_METHODS.has(reqMethod)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Método HTTP no permitido por el proxy Cisco (${reqMethod}). Solo GET y POST.`,
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      let token = String(body?.token || '').trim();
      if (!token || token === SERVER_MANAGED_TOKEN_SENTINEL) {
        if (!clientId || !clientSecret) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Credenciales Cisco M2M no configuradas para emitir token en servidor.',
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
        const tokenOutcome = await mintCiscoOAuthToken(authUrl, clientId, clientSecret, usingServerCreds);
        if (tokenOutcome.ok === false) {
          return new Response(
            JSON.stringify({
              success: false,
              httpStatus: tokenOutcome.status,
              error: 'error' in tokenOutcome ? tokenOutcome.error : 'Error autenticando con Cisco ID.',
            }),
            {
              status: tokenOutcome.status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
        token = tokenOutcome.token;
      }

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      let reqBody: string | undefined = undefined;
      if (reqMethod === 'POST') {
        reqHeaders['Content-Type'] = 'application/json';
        const rawPayload = body?.body ?? body?.data;
        if (rawPayload !== undefined) {
          reqBody = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
        }
      }

      const apiRes = await fetch(targetUrl, {
        method: reqMethod,
        headers: reqHeaders,
        body: reqBody,
      });

      const rawText = await apiRes.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }

      return new Response(
        JSON.stringify({
          success: apiRes.ok,
          httpStatus: apiRes.status,
          latencyMs: Date.now() - start,
          data: parsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Acción desconocida: ${action}` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Error interno en proxy Cisco M2M.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};
