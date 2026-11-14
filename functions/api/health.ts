// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/health
// High-performance Edge Health Check & Heartbeat API
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestGet: PagesFunction = async (context) => {
  const cf = (context.request as any).cf || {};
  const colo = cf.colo || 'SCL';
  const country = cf.country || 'CL';

  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'cisco-automated',
      version: '2.12.0',
      timestamp: new Date().toISOString(),
      edge: {
        colo,
        country,
      },
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
};
