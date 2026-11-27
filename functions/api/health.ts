// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/health
// High-performance Edge Health Check & Heartbeat API
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import { APP_VERSION } from '../../src/core/appVersion';

export const onRequestOptions: PagesFunction = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'GET, OPTIONS', 'Content-Type'),
  });
};

export const onRequestGet: PagesFunction = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'GET, OPTIONS', 'Content-Type');
  const cf = (context.request as any).cf || {};
  const colo = cf.colo || 'SCL';
  const country = cf.country || 'CL';

  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'cisco-automated',
      version: APP_VERSION,
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
