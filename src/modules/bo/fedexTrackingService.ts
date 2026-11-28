// ============================================================================
// CISCO AUTOMATED - FEDEX LIVE TRACKING & AUTO-SYNC SERVICE
// Conecta Tracking BO contra FedEx Track API v1 vía /api/fedex-track (Edge Proxy)
// Mapea hitos reales de FedEx (Tránsito, Hub Miami, Aduana Chile, Bodega ENEA)
// y registra novedades sin duplicar notas en Firestore/IndexedDB.
// ============================================================================

import { getEdgeSessionHeaders } from '../security/edgeSessionService';
import {
  BO_STAGES_METADATA,
  BoDailyNote,
  BoOrderTrackingRecord,
  BoStage,
} from './boTrackingTypes';
import { saveBoTracking } from './boTrackingService';

export type FedExEnvironment = 'PROD' | 'SANDBOX';

export interface FedExApiClientConfig {
  apiKey: string;
  secretKey: string;
  environment: FedExEnvironment;
  autoSyncEnabled: boolean;
}

export interface FedExScanEvent {
  timestamp: string;
  eventType: string;
  description: string;
  location: string;
}

export interface FedExTrackResult {
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
  events: FedExScanEvent[];
  error?: string;
}

export interface FedExCachedLiveStatus extends FedExTrackResult {
  syncedAt: string;
  lastEventKey: string;
  mappedStage: BoStage;
}

const FEDEX_PREFS_STORAGE_KEY = 'cisco_fedex_track_prefs_v1';
const FEDEX_SECRETS_SESSION_KEY = 'cisco_fedex_track_session_secrets_v1';
const FEDEX_LIVE_CACHE_STORAGE_KEY = 'cisco_fedex_live_cache_v1';

let memoryFedExLiveCache: Record<string, FedExCachedLiveStatus> = {};

function getFedExEndpointUrl(): string {
  if (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) {
    return '/api/fedex-track';
  }
  return 'https://develop.cisco-automated.pages.dev/api/fedex-track';
}

export function loadFedExConfig(): FedExApiClientConfig {
  let environment: FedExEnvironment = 'PROD';
  let autoSyncEnabled = true;
  let apiKey = '';
  let secretKey = '';

  try {
    if (typeof localStorage !== 'undefined') {
      const rawPrefs = localStorage.getItem(FEDEX_PREFS_STORAGE_KEY);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (parsed.environment === 'SANDBOX' || parsed.environment === 'PROD') {
          environment = parsed.environment;
        }
        if (typeof parsed.autoSyncEnabled === 'boolean') {
          autoSyncEnabled = parsed.autoSyncEnabled;
        }
      }
    }
  } catch {}

  try {
    if (typeof sessionStorage !== 'undefined') {
      const rawSec = sessionStorage.getItem(FEDEX_SECRETS_SESSION_KEY);
      if (rawSec) {
        const parsed = JSON.parse(rawSec);
        apiKey = String(parsed.apiKey || '').trim();
        secretKey = String(parsed.secretKey || '').trim();
      }
    }
  } catch {}

  return { apiKey, secretKey, environment, autoSyncEnabled };
}

export function saveFedExConfig(partial: Partial<FedExApiClientConfig>): FedExApiClientConfig {
  const current = loadFedExConfig();
  const next: FedExApiClientConfig = {
    ...current,
    ...partial,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        FEDEX_PREFS_STORAGE_KEY,
        JSON.stringify({
          environment: next.environment,
          autoSyncEnabled: next.autoSyncEnabled,
        })
      );
    }
  } catch {}

  try {
    if (typeof sessionStorage !== 'undefined') {
      if (next.apiKey || next.secretKey) {
        sessionStorage.setItem(
          FEDEX_SECRETS_SESSION_KEY,
          JSON.stringify({
            apiKey: next.apiKey,
            secretKey: next.secretKey,
          })
        );
      } else {
        sessionStorage.removeItem(FEDEX_SECRETS_SESSION_KEY);
      }
    }
  } catch {}

  return next;
}

export function getCachedFedExStatuses(): Record<string, FedExCachedLiveStatus> {
  if (Object.keys(memoryFedExLiveCache).length > 0) {
    return memoryFedExLiveCache;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FEDEX_LIVE_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          memoryFedExLiveCache = parsed;
          return memoryFedExLiveCache;
        }
      }
    }
  } catch {}
  return memoryFedExLiveCache;
}

function saveCachedFedExStatuses(map: Record<string, FedExCachedLiveStatus>): void {
  memoryFedExLiveCache = { ...map };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEDEX_LIVE_CACHE_STORAGE_KEY, JSON.stringify(memoryFedExLiveCache));
    }
  } catch {}
}

/**
 * Normaliza un número de guía FedEx para comparación uniforme y caché.
 */
export function normalizeFedExTrackingNumber(trackingNumber?: string): string {
  return String(trackingNumber || '').replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase();
}

/**
 * Mapea un resultado oficial de FedEx Track API v1 a la etapa logística
 * correspondiente en Intcomex Chile (`BoStage`).
 * Nunca cierra automáticamente a `DELIVERED` (cierre comercial al partner),
 * sino hasta `INTCOMEX_WAREHOUSE` al entregarse físicamente en Chile.
 */
export function mapFedExTrackResultToBoStage(track: FedExTrackResult): BoStage {
  const code = String(track.statusCode || '').trim().toUpperCase();
  const desc = String(track.statusDescription || '').trim().toUpperCase();
  const loc = String(track.locationLabel || '').trim().toUpperCase();
  const city = String(track.city || '').trim().toUpperCase();
  const state = String(track.stateOrProvince || '').trim().toUpperCase();
  const country = String(track.countryCode || '').trim().toUpperCase();

  const isInChile =
    country === 'CL' ||
    loc.includes('SANTIAGO') ||
    loc.includes('PUDAHUEL') ||
    loc.includes('CHILE') ||
    loc.includes('ENEA') ||
    loc.includes('SCL');

  const isInMiamiHub =
    (country === 'US' || !country) &&
    (city.includes('MIAMI') ||
      city.includes('DORAL') ||
      city.includes('MEDLEY') ||
      city.includes('HIALEAH') ||
      state === 'FL' ||
      loc.includes('MIAMI'));

  const isDelivered = code === 'DL' || desc.includes('DELIVERED') || desc.includes('ENTREGADO');
  const isCustoms =
    code === 'CD' ||
    code === 'CC' ||
    desc.includes('CUSTOMS') ||
    desc.includes('ADUANA') ||
    desc.includes('CLEARANCE') ||
    desc.includes('DESADUAN');

  if (isDelivered) {
    return isInMiamiHub && !isInChile ? 'MIAMI_FORWARDER' : 'INTCOMEX_WAREHOUSE';
  }
  if (isInChile || isCustoms) {
    return 'CUSTOMS_CLEARANCE';
  }
  if (isInMiamiHub) {
    return 'MIAMI_FORWARDER';
  }
  return 'SHIPPED_COURIER';
}

export function buildFedExEventKey(track: FedExTrackResult): string {
  const code = String(track.statusCode || 'TRK').trim().toUpperCase();
  const ts = String(track.lastScanTimestamp || '').trim();
  const desc = String(track.statusDescription || '').trim().slice(0, 60);
  const loc = String(track.locationLabel || '').trim();
  return `${code}|${ts || desc}|${loc}`;
}

/**
 * Aplica una actualización oficial de FedEx sobre una orden BO sin retroceder etapas
 * ni duplicar registros de bitácora si el evento ya fue procesado anteriormente.
 */
export function applyFedExUpdateToOrder(
  order: BoOrderTrackingRecord,
  track: FedExTrackResult,
  nowIso: string = new Date().toISOString()
): {
  updatedOrder: BoOrderTrackingRecord;
  changed: boolean;
  stageAdvanced: boolean;
  noteAdded: boolean;
  mappedStage: BoStage;
  eventKey: string;
} {
  const mappedStage = mapFedExTrackResultToBoStage(track);
  const eventKey = buildFedExEventKey(track);

  const currentStep = BO_STAGES_METADATA[order.currentStage]?.stepNumber || 1;
  const nextStep = BO_STAGES_METADATA[mappedStage]?.stepNumber || 1;
  const stageAdvanced = nextStep > currentStep;
  const nextStage: BoStage = stageAdvanced ? mappedStage : order.currentStage;

  const nextShipDate = track.shipDate || order.estimatedShipDate;
  const nextEtaDate = track.estimatedDeliveryDate || order.estimatedArrivalDate;
  const nextActualDelivery =
    mappedStage === 'INTCOMEX_WAREHOUSE' && track.actualDeliveryDate
      ? track.actualDeliveryDate
      : order.actualDeliveryDate;

  const existingNotes = Array.isArray(order.notes) ? order.notes : [];
  const alreadyLogged = existingNotes.some(
    (n) => typeof n?.comment === 'string' && n.comment.includes(`[FedEx:${eventKey}]`)
  );

  let noteAdded = false;
  let nextNotes = existingNotes;
  if (!alreadyLogged && track.found && (track.statusDescription || track.locationLabel)) {
    const locTxt = track.locationLabel ? ` • Ubicación: ${track.locationLabel}` : '';
    const etaTxt = nextEtaDate ? ` • ETA: ${nextEtaDate}` : '';
    const stageTxt = stageAdvanced
      ? ` • Etapa -> ${BO_STAGES_METADATA[nextStage].shortLabel}`
      : '';
    const newNote: BoDailyNote = {
      id: `fedex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: nowIso,
      author: 'FedEx Auto-Sync',
      stage: nextStage,
      comment: `[FedEx Auto-Sync] ${track.statusDescription}${locTxt}${etaTxt}${stageTxt} [FedEx:${eventKey}]`,
    };
    nextNotes = [...existingNotes, newNote];
    noteAdded = true;
  }

  const datesChanged =
    nextShipDate !== order.estimatedShipDate ||
    nextEtaDate !== order.estimatedArrivalDate ||
    nextActualDelivery !== order.actualDeliveryDate;

  const changed = stageAdvanced || noteAdded || datesChanged;

  const updatedOrder: BoOrderTrackingRecord = changed
    ? {
        ...order,
        currentStage: nextStage,
        estimatedShipDate: nextShipDate,
        estimatedArrivalDate: nextEtaDate,
        actualDeliveryDate: nextActualDelivery,
        notes: nextNotes,
        updatedAt: nowIso,
        lastDailyReviewAt: noteAdded ? nowIso : order.lastDailyReviewAt,
      }
    : order;

  return {
    updatedOrder,
    changed,
    stageAdvanced,
    noteAdded,
    mappedStage,
    eventKey,
  };
}

export async function checkFedExEdgeStatus(): Promise<{
  success: boolean;
  configured: boolean;
  hasServerSecrets?: boolean;
  environment?: FedExEnvironment;
  error?: string;
}> {
  const cfg = loadFedExConfig();
  try {
    const res = await fetch(getFedExEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getEdgeSessionHeaders(),
      },
      body: JSON.stringify({
        action: 'status',
        environment: cfg.environment,
        ...(cfg.apiKey && cfg.secretKey ? { apiKey: cfg.apiKey, secretKey: cfg.secretKey } : {}),
      }),
    });
    if (!res.ok) {
      return { success: false, configured: false, error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      error: err?.message || 'Sin conexión con servicio Edge FedEx.',
    };
  }
}

export async function testFedExConnection(
  override?: Partial<FedExApiClientConfig>
): Promise<{ success: boolean; message: string }> {
  const cfg = { ...loadFedExConfig(), ...override };
  try {
    const res = await fetch(getFedExEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getEdgeSessionHeaders(),
      },
      body: JSON.stringify({
        action: 'test',
        environment: cfg.environment,
        ...(cfg.apiKey && cfg.secretKey ? { apiKey: cfg.apiKey, secretKey: cfg.secretKey } : {}),
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (data?.success) {
      return {
        success: true,
        message: data.message || 'Conexión con FedEx Track API verificada.',
      };
    }
    return {
      success: false,
      message: data?.error || `No se pudo validar conexión FedEx (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de red probando conexión con FedEx API.',
    };
  }
}

export async function syncFedExTrackingsForOrders(
  orders: BoOrderTrackingRecord[],
  options?: { onlyOrderId?: string }
): Promise<{
  success: boolean;
  configured: boolean;
  needsCredentials?: boolean;
  checkedCount: number;
  updatedCount: number;
  stageAdvancedCount: number;
  updatedOrders: BoOrderTrackingRecord[];
  liveStatuses: Record<string, FedExCachedLiveStatus>;
  error?: string;
}> {
  const cfg = loadFedExConfig();
  const targetOrders = orders.filter((o) => {
    if (!o || o.archived || o.currentStage === 'DELIVERED') return false;
    if (options?.onlyOrderId && o.id !== options.onlyOrderId) return false;
    return (o.courier || 'FedEx') === 'FedEx' && normalizeFedExTrackingNumber(o.courierTrackingNumber).length >= 8;
  });

  const liveCache = { ...getCachedFedExStatuses() };
  if (targetOrders.length === 0) {
    return {
      success: true,
      configured: true,
      checkedCount: 0,
      updatedCount: 0,
      stageAdvancedCount: 0,
      updatedOrders: [],
      liveStatuses: liveCache,
    };
  }

  const uniqueTrackNumbers = Array.from(
    new Set(targetOrders.map((o) => normalizeFedExTrackingNumber(o.courierTrackingNumber)))
  );

  const trackMap = new Map<string, FedExTrackResult>();
  for (let i = 0; i < uniqueTrackNumbers.length; i += 30) {
    const chunk = uniqueTrackNumbers.slice(i, i + 30);
    const res = await fetch(getFedExEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getEdgeSessionHeaders(),
      },
      body: JSON.stringify({
        action: 'track',
        trackingNumbers: chunk,
        environment: cfg.environment,
        ...(cfg.apiKey && cfg.secretKey ? { apiKey: cfg.apiKey, secretKey: cfg.secretKey } : {}),
      }),
    });

    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        configured: false,
        checkedCount: targetOrders.length,
        updatedCount: 0,
        stageAdvancedCount: 0,
        updatedOrders: [],
        liveStatuses: liveCache,
        error: payload?.error || `HTTP ${res.status} al consultar /api/fedex-track`,
      };
    }

    if (payload?.needsCredentials || payload?.configured === false) {
      return {
        success: false,
        configured: false,
        needsCredentials: true,
        checkedCount: targetOrders.length,
        updatedCount: 0,
        stageAdvancedCount: 0,
        updatedOrders: [],
        liveStatuses: liveCache,
        error: payload?.error,
      };
    }

    if (!payload?.success) {
      return {
        success: false,
        configured: true,
        checkedCount: targetOrders.length,
        updatedCount: 0,
        stageAdvancedCount: 0,
        updatedOrders: [],
        liveStatuses: liveCache,
        error: payload?.error || 'Error consultando FedEx Track API.',
      };
    }

    const results: FedExTrackResult[] = Array.isArray(payload.results) ? payload.results : [];
    for (const r of results) {
      const key = normalizeFedExTrackingNumber(r.trackingNumber);
      if (key) trackMap.set(key, r);
    }
  }

  const nowIso = new Date().toISOString();
  const updatedOrders: BoOrderTrackingRecord[] = [];
  let stageAdvancedCount = 0;

  for (const order of targetOrders) {
    const key = normalizeFedExTrackingNumber(order.courierTrackingNumber);
    const track = trackMap.get(key);
    if (!track) continue;

    const applied = applyFedExUpdateToOrder(order, track, nowIso);
    liveCache[key] = {
      ...track,
      syncedAt: nowIso,
      lastEventKey: applied.eventKey,
      mappedStage: applied.mappedStage,
    };

    if (applied.changed) {
      await saveBoTracking(applied.updatedOrder);
      updatedOrders.push(applied.updatedOrder);
      if (applied.stageAdvanced) stageAdvancedCount += 1;
    }
  }

  saveCachedFedExStatuses(liveCache);

  return {
    success: true,
    configured: true,
    checkedCount: targetOrders.length,
    updatedCount: updatedOrders.length,
    stageAdvancedCount,
    updatedOrders,
    liveStatuses: liveCache,
  };
}
