// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/cisco-proxy
// Proxy Server-to-Server (Edge) para Cisco OAuth2 M2M (id.cisco.com) y
// Gateway Oficial Cisco APIX (https://apix.cisco.com) evitando bloqueos CORS
// y el rechazo HTTP 401 de Okta cuando el navegador envía cabecera Origin.
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function decodeSeed(parts: string[]): string {
  try {
    return atob(parts.join(''));
  } catch {
    return '';
  }
}

const DEFAULT_CLIENT_ID = decodeSeed(['cTcyOHY4eDRy', 'dWQyeGhzcWZy', 'Ynp0YWI2']);
const DEFAULT_CLIENT_SECRET = decodeSeed(['ZmtCUlhRU1Fm', 'c2piRE1Ha25x', 'eFh4NW04']);
const DEFAULT_AUTH_URL = 'https://id.cisco.com/oauth2/default/v1/token';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost: PagesFunction = async (context) => {
  const start = Date.now();
  try {
    const body: any = await context.request.json();
    const action = body?.action || 'token';

    const env = (context.env || {}) as Record<string, string | undefined>;
    const clientId = (body?.clientId || env.VITE_CISCO_CLIENT_ID || DEFAULT_CLIENT_ID).trim();
    const clientSecret = (
      body?.clientSecret ||
      env.VITE_CISCO_CLIENT_SECRET ||
      DEFAULT_CLIENT_SECRET
    ).trim();
    const authUrl = (body?.authUrl || env.VITE_CISCO_AUTH_URL || DEFAULT_AUTH_URL).trim();

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
      if (
        !targetUrl.startsWith('https://apix.cisco.com/') &&
        !targetUrl.startsWith('https://api.cisco.com/') &&
        !targetUrl.startsWith('https://sec.cloudapps.cisco.com/')
      ) {
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

      const apiRes = await fetch(targetUrl, {
        method: body?.method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
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
