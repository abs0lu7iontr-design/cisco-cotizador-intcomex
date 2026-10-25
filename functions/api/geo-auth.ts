// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/geo-auth
// Edge Geolocation Detection for Adaptive Risk-Based 2FA
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestGet: PagesFunction = async (context) => {
  return handleGeoDetection(context);
};

export const onRequestPost: PagesFunction = async (context) => {
  return handleGeoDetection(context);
};

async function handleGeoDetection(context: EventContext<any, any, any>): Promise<Response> {
  try {
    const cf = (context.request as any).cf || {};
    const rawCountry = (cf.country || 'CL').toString().toUpperCase().trim();
    const city = (cf.city || 'Santiago').toString().trim();
    const region = (cf.region || 'RM').toString().trim();
    const ip = context.request.headers.get('CF-Connecting-IP') || '127.0.0.1';

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
          ...corsHeaders,
        },
      }
    );
  } catch (err: any) {
    // Safe fallback for local development or synthetic testing
    return new Response(
      JSON.stringify({
        success: true,
        country: 'CL',
        city: 'Santiago',
        region: 'RM',
        ip: '127.0.0.1',
        isChile: true,
        requires2FA: false,
        fallback: true,
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
}
