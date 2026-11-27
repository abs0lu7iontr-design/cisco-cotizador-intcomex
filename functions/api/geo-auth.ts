// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/geo-auth
// Edge Geolocation Detection for Adaptive Risk-Based 2FA
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'GET, POST, OPTIONS'),
  });
};

export const onRequestGet: PagesFunction = async (context) => {
  return handleGeoDetection(context);
};

export const onRequestPost: PagesFunction = async (context) => {
  return handleGeoDetection(context);
};

function isLocalHostname(request: Request): boolean {
  try {
    const host = (new URL(request.url).hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

async function handleGeoDetection(context: EventContext<any, any, any>): Promise<Response> {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'GET, POST, OPTIONS');
  try {
    const cf = (context.request as any).cf || {};
    const hasCfCountry = Boolean(cf && cf.country && String(cf.country).trim().length > 0);
    const localDev = !hasCfCountry && isLocalHostname(context.request);

    // Fail-closed in edge production if cf.country is unexpectedly missing
    const rawCountry = hasCfCountry
      ? String(cf.country).toUpperCase().trim()
      : localDev
      ? 'CL'
      : 'UNKNOWN';
    const city = String(cf.city || (localDev ? 'Santiago' : 'Desconocida')).trim();
    const region = String(cf.region || (localDev ? 'RM' : 'N/A')).trim();
    const ip = context.request.headers.get('CF-Connecting-IP') || (localDev ? '127.0.0.1' : '0.0.0.0');

    // Chile (CL) is the home domestic territory
    const isChile = rawCountry === 'CL';
    const requires2FA = !isChile;

    return new Response(
      JSON.stringify({
        success: true,
        country: rawCountry,
        city,
        region,
        ip,
        isChile,
        requires2FA,
        detectedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      }
    );
  } catch {
    const localDev = isLocalHostname(context.request);
    return new Response(
      JSON.stringify({
        success: localDev,
        country: localDev ? 'CL' : 'UNKNOWN',
        city: localDev ? 'Santiago' : 'Desconocida',
        region: localDev ? 'RM' : 'N/A',
        ip: localDev ? '127.0.0.1' : '0.0.0.0',
        isChile: localDev,
        requires2FA: !localDev,
        fallback: true,
      }),
      {
        status: localDev ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      }
    );
  }
}
