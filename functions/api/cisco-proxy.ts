// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/cisco-proxy
// Proxy Server-to-Server (Edge) para Cisco OAuth2 M2M (id.cisco.com) y
// Gateway Oficial Cisco APIX (https://apix.cisco.com) evitando bloqueos CORS
// y el rechazo HTTP 401 de Okta cuando el navegador envía cabecera Origin.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';

const DEFAULT_AUTH_URL = 'https://id.cisco.com/oauth2/default/v1/token';
const DEFAULT_CLIENT_ID = '3400130c-8528-49a1-9c71-f40e68e0f9bc';
const DEFAULT_CLIENT_SECRET = '801e3a4f-950f-4951-ba4f-3c63d3684bb6';

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

function isAllowedCiscoUrl(rawUrl: string, allowedHosts: Set<string>): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction = async (context) => {
  const start = Date.now();
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const body: any = await context.request.json();
    const action = body?.action || 'token';

    const env = (context.env || {}) as Record<string, string | undefined>;
    // Prefer server-side secrets configured in Cloudflare Pages when client uses default or omits them
    const bodyClientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
    const bodyClientSecret = typeof body?.clientSecret === 'string' ? body.clientSecret.trim() : '';
    const clientId = (env.CISCO_CLIENT_ID || bodyClientId || DEFAULT_CLIENT_ID).trim();
    const clientSecret = (env.CISCO_CLIENT_SECRET || bodyClientSecret || DEFAULT_CLIENT_SECRET).trim();
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

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciales Cisco M2M no configuradas.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (action === 'token') {
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

      return new Response(
        JSON.stringify({
          success: tokenRes.ok,
          httpStatus: tokenRes.status,
          latencyMs: Date.now() - start,
          data: parsed,
        }),
        {
          status: tokenRes.ok ? 200 : tokenRes.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
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
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      let token = String(body?.token || '').trim();
      if (!token) {
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
        if (!tokenRes.ok) {
          const errTxt = await tokenRes.text();
          return new Response(
            JSON.stringify({
              success: false,
              httpStatus: tokenRes.status,
              error: `Error autenticando con Cisco ID: ${errTxt}`,
            }),
            {
              status: tokenRes.status,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
        const tokenData: any = await tokenRes.json();
        token = tokenData.access_token;
      }

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      const reqMethod = (body?.method || 'GET').toUpperCase();
      let reqBody: string | undefined = undefined;

      if (reqMethod === 'POST' || reqMethod === 'PUT' || reqMethod === 'PATCH') {
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
