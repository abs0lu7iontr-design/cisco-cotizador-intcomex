// ============================================================================
// SHARED EDGE CORS ALLOWLIST HELPER FOR CLOUDFLARE PAGES FUNCTIONS
// Restricts browser CORS access to official deployment origins & local dev.
// ============================================================================

const STATIC_ALLOWED_HOSTS = new Set<string>([
  'cisco-automated.pages.dev',
  'localhost',
  '127.0.0.1',
]);

export function isAllowedEdgeOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (STATIC_ALLOWED_HOSTS.has(host)) {
      // Require HTTPS for production domain
      return host === 'localhost' || host === '127.0.0.1' || parsed.protocol === 'https:';
    }
    // Allow official preview branches (*.cisco-automated.pages.dev) over HTTPS
    if (parsed.protocol === 'https:' && host.endsWith('.cisco-automated.pages.dev')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function buildEdgeCorsHeaders(
  request: Request | undefined | null,
  methods: string = 'GET, POST, OPTIONS',
  allowHeaders: string = 'Content-Type, Authorization'
): Record<string, string> {
  const origin = request?.headers?.get('Origin');
  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowHeaders,
    Vary: 'Origin',
  };

  if (isAllowedEdgeOrigin(origin)) {
    baseHeaders['Access-Control-Allow-Origin'] = origin!;
  }

  return baseHeaders;
}
