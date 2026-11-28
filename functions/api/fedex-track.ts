// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/fedex-track
// Proxy Edge autenticado para FedEx Track API v1 (OAuth2 Client Credentials).
// Permite consultar hasta 30 guías FedEx por lote en segundo plano sin abrir fedex.com.
// Credenciales desde Cloudflare Secrets (FEDEX_API_KEY / FEDEX_SECRET_KEY) o
// credenciales corporativas suministradas en sesión autenticada.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import { checkEdgeRateLimit, EdgeEnv, sha256Hex, verifyEdgeSessionToken } from '../lib/edgeAuth';

const FEDEX_BASE_URLS = {
  PROD: 'https://apis.fedex.com',
  SANDBOX: 'https://apis-sandbox.fedex.com',
} as const;

interface FedExRequestPayload {
  action?: 'status' | 'test' | 'track';
  trackingNumbers?: string[];
  environment?: 'PROD' | 'SANDBOX';
  apiKey?: string;
  secretKey?: string;
}

interface FedExScanEventItem {
  timestamp: string;
  eventType: string;
  description: string;
  location: string;
}

export interface NormalizedFedExTrackResult {
  trackingNumber: string;
  found: boolean;
  statusCode: string;
  statusDescription: string;
  locationLabel: string;
  city: string;
  stateOrProvince: string;
  countryCode: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  shipDate?: string;
  lastScanTimestamp?: string;
  events: FedExScanEventItem[];
  error?: string;
}

function formatFedExLocation(loc?: any): {
  city: string;
  stateOrProvince: string;
  countryCode: string;
  label: string;
} {
  if (!loc || typeof loc !== 'object') {
    return { city: '', stateOrProvince: '', countryCode: '', label: '' };
  }
  const city = String(loc.city || '').trim();
  const stateOrProvince = String(loc.stateOrProvinceCode || '').trim();
  const countryCode = String(loc.countryCode || '').trim().toUpperCase();
  const parts = [city, stateOrProvince, countryCode].filter(Boolean);
  return {
    city,
    stateOrProvince,
    countryCode,
    label: parts.join(', '),
  };
}

function extractIsoDate(raw?: unknown): string | undefined {
  if (!raw) return undefined;
  const str = String(raw).trim();
  const match = str.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : undefined;
}

async function mintFedExOAuthToken(
  baseUrl: string,
  apiKey: string,
  secretKey: string
): Promise<
  | { ok: true; token: string }
  | { ok: false; status: number; error: string }
> {
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  const cacheUrl = `https://fedex-token-cache.internal/${await sha256Hex(`${baseUrl}:${apiKey}`)}`;

  if (cacheStorage) {
    try {
      const cached = await cacheStorage.match(cacheUrl);
      if (cached) {
        const cachedData: any = await cached.json();
        if (cachedData?.access_token) {
          return { ok: true, token: cachedData.access_token };
        }
      }
    } catch {}
  }

  const form = new URLSearchParams();
  form.append('grant_type', 'client_credentials');
  form.append('client_id', apiKey);
  form.append('client_secret', secretKey);

  const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
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
    const errMsg =
      parsed?.errors?.[0]?.message ||
      parsed?.error_description ||
      parsed?.error ||
      `Error autenticando con FedEx OAuth (${tokenRes.status})`;
    return {
      ok: false,
      status: tokenRes.status || 502,
      error: errMsg,
    };
  }

  if (cacheStorage) {
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

  return { ok: true, token: parsed.access_token };
}

function normalizeFedExTrackResponse(rawData: any): NormalizedFedExTrackResult[] {
  const completeResults = Array.isArray(rawData?.output?.completeTrackResults)
    ? rawData.output.completeTrackResults
    : [];

  return completeResults.map((entry: any) => {
    const tn = String(entry?.trackingNumber || '').trim();
    const firstResult = Array.isArray(entry?.trackResults) ? entry.trackResults[0] : null;
    if (!firstResult) {
      return {
        trackingNumber: tn,
        found: false,
        statusCode: '',
        statusDescription: 'Sin resultados en FedEx',
        locationLabel: '',
        city: '',
        stateOrProvince: '',
        countryCode: '',
        events: [],
        error: 'Número de guía no encontrado en FedEx.',
      };
    }

    if (firstResult.error?.message) {
      return {
        trackingNumber: tn,
        found: false,
        statusCode: String(firstResult.error.code || 'ERROR'),
        statusDescription: firstResult.error.message,
        locationLabel: '',
        city: '',
        stateOrProvince: '',
        countryCode: '',
        events: [],
        error: firstResult.error.message,
      };
    }

    const latest = firstResult.latestStatusDetail || {};
    const statusCode = String(latest.code || latest.derivedCode || '').trim().toUpperCase();
    const statusDescription = String(
      latest.description || latest.statusByLocale || 'En tránsito FedEx'
    ).trim();
    const latestLoc = formatFedExLocation(latest.scanLocation);

    const dateAndTimes: any[] = Array.isArray(firstResult.dateAndTimes) ? firstResult.dateAndTimes : [];
    const findDateByType = (types: string[]) => {
      const hit = dateAndTimes.find((d) => types.includes(String(d?.type || '').toUpperCase()));
      return extractIsoDate(hit?.dateTime);
    };

    const estWin = firstResult.estimatedDeliveryTimeWindow?.window;
    const estimatedDeliveryDate =
      extractIsoDate(estWin?.ends || estWin?.begins) ||
      findDateByType(['ESTIMATED_DELIVERY', 'ESTIMATED_ARRIVAL', 'APPOINTMENT_DELIVERY']);
    const actualDeliveryDate = findDateByType(['ACTUAL_DELIVERY']);
    const shipDate = findDateByType(['ACTUAL_PICKUP', 'SHIP', 'ACTUAL_TENDER']);

    const rawEvents: any[] = Array.isArray(firstResult.scanEvents) ? firstResult.scanEvents : [];
    const events: FedExScanEventItem[] = rawEvents.slice(0, 10).map((ev) => {
      const evLoc = formatFedExLocation(ev?.scanLocation);
      return {
        timestamp: String(ev?.date || '').trim(),
        eventType: String(ev?.eventType || ev?.derivedStatusCode || '').trim().toUpperCase(),
        description: String(ev?.eventDescription || ev?.derivedStatus || '').trim(),
        location: evLoc.label,
      };
    });

    const latestEventLoc = events[0]?.location ? formatFedExLocation(rawEvents[0]?.scanLocation) : null;
    const finalLoc = latestLoc.label ? latestLoc : latestEventLoc || latestLoc;

    return {
      trackingNumber: tn,
      found: true,
      statusCode,
      statusDescription,
      locationLabel: finalLoc.label,
      city: finalLoc.city,
      stateOrProvince: finalLoc.stateOrProvince,
      countryCode: finalLoc.countryCode,
      estimatedDeliveryDate,
      actualDeliveryDate,
      shipDate,
      lastScanTimestamp: events[0]?.timestamp || findDateByType(['ACTUAL_DELIVERY', 'ACTUAL_PICKUP']),
      events,
    };
  });
}

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const { request, env } = context;
  const corsHeaders = buildEdgeCorsHeaders(request, 'POST, OPTIONS');
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...corsHeaders,
  };

  try {
    const session = await verifyEdgeSessionToken(request, env);
    if (!session.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Sesión Edge no válida o expirada. Inicia sesión nuevamente.',
        }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || session.username || 'unknown';
    const rl = await checkEdgeRateLimit(`fedex:${clientIp}`, 40, 60);
    if (!rl.allowed) {
      const retrySec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Límite de consultas FedEx excedido. Reintenta en ${retrySec}s.`,
        }),
        { status: 429, headers: jsonHeaders }
      );
    }

    const body = (await request.json().catch(() => ({}))) as FedExRequestPayload;
    const action = body.action || 'track';

    const envPreference =
      body.environment ||
      (String(env.FEDEX_ENV || '').toUpperCase() === 'SANDBOX' ? 'SANDBOX' : 'PROD');
    const baseUrl = FEDEX_BASE_URLS[envPreference] || FEDEX_BASE_URLS.PROD;

    const apiKey = (body.apiKey || env.FEDEX_API_KEY || '').trim();
    const secretKey = (body.secretKey || env.FEDEX_SECRET_KEY || '').trim();
    const hasServerSecrets = Boolean(env.FEDEX_API_KEY && env.FEDEX_SECRET_KEY);
    const configured = Boolean(apiKey && secretKey);

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          success: true,
          configured,
          hasServerSecrets,
          environment: envPreference,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    if (!configured) {
      return new Response(
        JSON.stringify({
          success: false,
          configured: false,
          needsCredentials: true,
          error:
            'FedEx API no está configurada aún. Agrega tus credenciales gratuitas de FedEx Developer Portal (Client ID y Secret Key) o define FEDEX_API_KEY y FEDEX_SECRET_KEY en Cloudflare.',
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const authResult = await mintFedExOAuthToken(baseUrl, apiKey, secretKey);
    if (!authResult.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          configured: true,
          error: authResult.error,
          httpStatus: authResult.status,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    if (action === 'test') {
      return new Response(
        JSON.stringify({
          success: true,
          configured: true,
          environment: envPreference,
          message: `Conexión OAuth2 FedEx (${envPreference}) verificada correctamente.`,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const cleanNumbers = Array.from(
      new Set(
        (Array.isArray(body.trackingNumbers) ? body.trackingNumbers : [])
          .map((n) => String(n || '').replace(/[^a-zA-Z0-9]/g, '').trim())
          .filter((n) => n.length >= 8 && n.length <= 34)
      )
    ).slice(0, 30);

    if (cleanNumbers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          configured: true,
          results: [],
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const trackRes = await fetch(`${baseUrl}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authResult.token}`,
        'Content-Type': 'application/json',
        'X-locale': 'es_CL',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: cleanNumbers.map((tn) => ({
          trackingNumberInfo: { trackingNumber: tn },
        })),
      }),
    });

    const trackRawText = await trackRes.text();
    let trackJson: any = null;
    try {
      trackJson = JSON.parse(trackRawText);
    } catch {
      trackJson = { raw: trackRawText };
    }

    if (!trackRes.ok) {
      const apiErr =
        trackJson?.errors?.[0]?.message ||
        `FedEx Track API respondió HTTP ${trackRes.status}`;
      return new Response(
        JSON.stringify({
          success: false,
          configured: true,
          httpStatus: trackRes.status,
          error: apiErr,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const normalized = normalizeFedExTrackResponse(trackJson);
    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        environment: envPreference,
        results: normalized,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Error interno en proxy FedEx Edge.',
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
