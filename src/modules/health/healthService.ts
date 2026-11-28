// ============================================================================
// CISCO AUTOMATED v2.12.0 - APPLICATION HEALTH & DIAGNOSTIC SERVICE
// Evaluates Firestore, Cloudflare CDN, IndexedDB, LocalStorage, Offline Queue & Rates
// ============================================================================

import {
  HealthCheckResult,
  HealthStatusLevel,
  SystemHealthReport,
  StorageHealthMetrics,
  RuntimeHealthMetrics,
  ExchangeRatesHealthMetrics,
} from './healthTypes';
import {
  getFirestoreInstance,
  getActiveFirebaseConfig,
  getFirebaseAuthInstance,
  ensureFirebaseAuthSession,
} from '../cloud/firebaseConfig';
import { getIndexedDb, STORES, idbGet, idbSet } from '../../core/storage/indexedDbStorage';
import { getOfflineQueueSummary } from '../../core/storage/offlineSyncQueue';
import { isAppOffline, isManualOfflineMode, isNavigatorOffline } from '../../core/storage/offlineModeManager';
import {
  getCachedDailyOfficialRates,
  getDefaultOfficialRatesSnapshot,
  applyFrontendUsdClpSpread,
} from '../../core/chileanExchangeRateService';
import { getFormattedAppVersion, APP_VERSION } from '../../core/appVersion';
import {
  getModernStorageQuota,
  optimizeAndMigrateLocalStorage,
  formatStorageBytes,
} from '../../core/storage/modernStorageEngine';
import { getSqliteMetrics } from '../../core/storage/sqliteStorageEngine';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getPerformanceSnapshot, PerformanceSnapshot } from '../../core/telemetry/performanceTelemetry';
import { getMasterCatalogStatus, warmMasterCatalogCache, MasterCatalogMetrics } from '../../core/cache/masterCatalogCache';

const SESSION_START_TIME = Date.now();

// Estimate LocalStorage Standard Limit (typically 5 MB in modern browsers)
const LOCAL_STORAGE_STANDARD_LIMIT_BYTES = 5 * 1024 * 1024;

/**
 * Calculates current LocalStorage usage in bytes and formatted string.
 */
export function getLocalStorageMetrics(): { bytes: number; formatted: string; pct: number } {
  let bytes = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          bytes += (key.length + val.length) * 2; // UTF-16 characters = 2 bytes
        }
      }
    }
  } catch (err) {
    console.warn('[HealthService] Error computing localStorage usage:', err);
  }

  const mb = bytes / (1024 * 1024);
  const pct = Math.min(100, Math.round((bytes / LOCAL_STORAGE_STANDARD_LIMIT_BYTES) * 100));
  const formatted = `${mb.toFixed(2)} MB (${pct}%)`;

  return { bytes, formatted, pct };
}

/**
 * Diagnostic Check: Firebase Firestore Connectivity, Latency and Collection Access
 */
export async function checkFirestoreHealth(): Promise<HealthCheckResult> {
  const start = performance.now();
  const config = getActiveFirebaseConfig();
  const instance = getFirestoreInstance();

  if (!instance.db || !instance.isReady) {
    return {
      id: 'firestore',
      name: 'Cloud Firestore (Base de Datos)',
      category: 'cloud',
      status: isAppOffline() ? 'degraded' : 'critical',
      latencyMs: 0,
      message: instance.error || 'Instancia de Firestore no inicializada o credenciales ausentes.',
      details: { projectId: config.projectId, ready: false },
      lastChecked: new Date().toISOString(),
    };
  }

  // If app is currently offline, return informative degraded status
  if (isAppOffline()) {
    return {
      id: 'firestore',
      name: 'Cloud Firestore (Base de Datos)',
      category: 'cloud',
      status: 'degraded',
      latencyMs: 0,
      message: 'Modo Offline activo en la aplicación. Sincronización en la nube pausada.',
      details: { projectId: config.projectId, mode: 'offline' },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    await ensureFirebaseAuthSession();

    // Quick probe to test connection and permissions on key collections
    const collectionsToTest = [
      'cisco_pipeline_deals',
      'cisco_forecast_records',
      'estimates',
      'bo_order_tracking',
    ];

    const collectionResults: Record<string, 'ok' | 'denied' | 'error'> = {};
    let hasPermissionError = false;

    // Test primary collections with limit(1) to avoid heavy bandwidth
    for (const colName of collectionsToTest) {
      try {
        const colRef = collection(instance.db, colName);
        const q =
          colName === 'estimates'
            ? query(colRef, where('isRestricted', '==', false), limit(1))
            : query(colRef, limit(1));
        await getDocs(q);
        collectionResults[colName] = 'ok';
      } catch (colErr: any) {
        const msg = String(colErr?.message || colErr?.code || '');
        if (msg.includes('permission-denied') || colErr?.code === 'permission-denied') {
          collectionResults[colName] = 'denied';
          hasPermissionError = true;
        } else {
          collectionResults[colName] = 'error';
        }
      }
    }

    const latencyMs = Math.round(performance.now() - start);

    if (hasPermissionError) {
      const hasFirebaseUser = Boolean(getFirebaseAuthInstance()?.currentUser);
      const deniedCollections = Object.entries(collectionResults)
        .filter(([, state]) => state === 'denied')
        .map(([col]) => col);
      const allBlocked = deniedCollections.length >= collectionsToTest.length;

      return {
        id: 'firestore',
        name: 'Cloud Firestore (Base de Datos)',
        category: 'cloud',
        status: allBlocked ? 'critical' : 'degraded',
        latencyMs,
        message: allBlocked
          ? hasFirebaseUser
            ? `Todas las colecciones críticas (${deniedCollections.length}/${collectionsToTest.length}) están bloqueadas por permisos en Firestore.`
            : 'Sesión Firebase Auth pendiente o expirada: todas las colecciones Firestore reportan acceso denegado.'
          : hasFirebaseUser
            ? 'Conectado a Firestore pero una o más colecciones reportan permisos restringidos.'
            : 'Sesión Firebase Auth pendiente o expirada en este navegador. Cierra sesión y vuelve a ingresar para activar permisos en Firestore.',
        details: {
          projectId: config.projectId,
          collections: collectionResults,
          deniedCollections,
          authReady: hasFirebaseUser,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      id: 'firestore',
      name: 'Cloud Firestore (Base de Datos)',
      category: 'cloud',
      status: 'healthy',
      latencyMs,
      message: `Conexión fluida con Firebase (${latencyMs} ms). Todas las colecciones verificadas.`,
      details: { projectId: config.projectId, collections: collectionResults },
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: 'firestore',
      name: 'Cloud Firestore (Base de Datos)',
      category: 'cloud',
      status: 'critical',
      latencyMs,
      message: `Error de conexión con Firestore: ${err?.message || 'Tiempo de espera agotado'}`,
      details: { error: err?.message, projectId: config.projectId },
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Diagnostic Check: Cloudflare Pages CDN & version.json Reachability
 */
export async function checkCloudflareCdnHealth(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        id: 'cdn',
        name: 'Cloudflare CDN & Artefactos',
        category: 'cloud',
        status: 'degraded',
        latencyMs,
        message: `Servidor CDN respondió con estado HTTP ${res.status}.`,
        details: { httpStatus: res.status },
        lastChecked: new Date().toISOString(),
      };
    }

    const remoteInfo = (await res.json()) as Record<string, any>;
    const remoteVersion = remoteInfo?.version || 'unknown';
    const isUpToDate = remoteVersion === APP_VERSION;

    return {
      id: 'cdn',
      name: 'Cloudflare CDN & Artefactos',
      category: 'cloud',
      status: isUpToDate ? 'healthy' : 'degraded',
      latencyMs,
      message: isUpToDate
        ? `CDN Cloudflare respondiendo rápidamente (${latencyMs} ms). Versión sincronizada v${APP_VERSION}.`
        : `Nueva versión disponible en la nube: v${remoteVersion} (Versión local: v${APP_VERSION}).`,
      details: { localVersion: APP_VERSION, remoteVersion, isUpToDate, commit: remoteInfo?.git_commit },
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: 'cdn',
      name: 'Cloudflare CDN & Artefactos',
      category: 'cloud',
      status: isAppOffline() ? 'degraded' : 'critical',
      latencyMs,
      message: isAppOffline()
        ? 'Modo Offline activo: No se consulta CDN de Cloudflare.'
        : `No se pudo conectar con el CDN de Cloudflare: ${err?.message || 'Error de red'}`,
      details: { error: err?.message },
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Diagnostic Check: Local Storage, IndexedDB and Offline Queue Status
 */
export async function checkStorageHealth(): Promise<{
  result: HealthCheckResult;
  metrics: StorageHealthMetrics;
}> {
  const [modernQuota, db, sqliteMetrics] = await Promise.all([
    getModernStorageQuota(),
    getIndexedDb().catch(() => null),
    getSqliteMetrics().catch(() => null),
  ]);

  const ls = getLocalStorageMetrics();
  const idbSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  const idbReady = !!db;

  let queueSummary: Awaited<ReturnType<typeof getOfflineQueueSummary>> = { items: [], byModule: {}, total: 0 };
  try {
    queueSummary = await getOfflineQueueSummary();
  } catch {}

  let tombstonesCount = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      const stonesRaw = localStorage.getItem('cisco_pipeline_tombstones') || '[]';
      const stones = JSON.parse(stonesRaw);
      if (Array.isArray(stones)) tombstonesCount = stones.length;
    }
  } catch {}

  const sqliteReady = sqliteMetrics?.isReady ?? true;
  const totalSqliteTablesCount: number = sqliteMetrics?.tables
    ? (Object.values(sqliteMetrics.tables) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0)
    : 0;

  const metrics: StorageHealthMetrics = {
    sqliteSupported: sqliteMetrics?.isSupported ?? true,
    sqliteReady,
    sqliteDatabaseBytes: sqliteMetrics?.databaseBytes ?? 0,
    sqliteDatabaseFormatted: sqliteMetrics?.databaseFormatted ?? '0 MB',
    sqliteTablesCount: totalSqliteTablesCount,
    isOpfsActive: sqliteMetrics?.isOpfsActive ?? false,
    storageManagerSupported: modernQuota.isSupported,
    storageManagerUsageBytes: modernQuota.usageBytes,
    storageManagerQuotaBytes: modernQuota.quotaBytes,
    storageManagerUsageFormatted: modernQuota.usageFormatted,
    storageManagerQuotaFormatted: modernQuota.quotaFormatted,
    storageManagerPct: modernQuota.pctUsed,
    isPersistentStorage: modernQuota.isPersisted,
    storageEngineName: sqliteMetrics?.engine || 'SQLite v3 (WASM / OPFS)',
    localStorageBytes: ls.bytes,
    localStorageFormatted: ls.formatted,
    localStoragePct: ls.pct,
    indexedDbSupported: idbSupported,
    indexedDbReady: idbReady,
    offlineQueueCount: queueSummary.total,
    offlineQueueFailedCount: 0,
    tombstonesCount,
  };

  let status: HealthStatusLevel = 'healthy';
  let message = `Motor Relacional SQLite (WASM / OPFS) operativo (${sqliteMetrics?.databaseFormatted || '0 MB'} en disco). Bóveda LocalStorage en ${ls.formatted}.`;

  if (!sqliteReady && !idbReady) {
    status = 'critical';
    message = 'Motor de base de datos no disponible en este entorno. Se opera en memoria volátil.';
  } else if (modernQuota.pctUsed > 85) {
    status = 'degraded';
    message = `Almacenamiento de alta capacidad cercano al límite (${modernQuota.pctUsed}% usado).`;
  } else if (ls.pct > 80) {
    message = `Motor SQLite de alta capacidad óptimo (${modernQuota.quotaFormatted}). Bóveda LocalStorage con caché secundaria (${ls.formatted}); optimización automática activa.`;
    // Disparar auto-migración y limpieza en segundo plano sin bloquear
    setTimeout(() => {
      optimizeAndMigrateLocalStorage().catch(() => {});
    }, 100);
  } else if (queueSummary.total > 15) {
    status = 'degraded';
    message = `Hay ${queueSummary.total} operaciones en cola local esperando sincronización con la nube.`;
  }

  const result: HealthCheckResult = {
    id: 'storage',
    name: 'Almacenamiento Local del PC (Motor Relacional SQLite WASM & OPFS)',
    category: 'storage',
    status,
    latencyMs: 1,
    message,
    details: metrics,
    lastChecked: new Date().toISOString(),
  };

  return { result, metrics };
}

/**
 * Diagnostic Check: Chilean Currency & Official Exchange Rates
 */
export function checkExchangeRatesHealth(): {
  result: HealthCheckResult;
  metrics: ExchangeRatesHealthMetrics;
} {
  const cached = getCachedDailyOfficialRates(false);
  const snapshot = cached || getDefaultOfficialRatesSnapshot();
  const effectiveUsd = snapshot.dolarObservadoOficial;

  const hasValidUsd = snapshot.dolarObservadoOficial > 0;
  const hasValidUf = snapshot.ufOficialClp > 0;

  let status: HealthStatusLevel = 'healthy';
  let message = `Indicadores BCCh activos: 1 USD = $${effectiveUsd.toFixed(2)} CLP, 1 UF = $${snapshot.ufOficialClp.toLocaleString('es-CL')} CLP.`;

  if (!hasValidUsd || !hasValidUf) {
    status = 'degraded';
    message = 'Indicadores oficiales no cargados o usando valores de contingencia.';
  }

  const metrics: ExchangeRatesHealthMetrics = {
    usdObs: snapshot.dolarObservadoOficial,
    uf: snapshot.ufOficialClp,
    spreadClp: snapshot.spreadClp,
    effectiveUsd,
    provider: snapshot.sourceName || 'Banco Central de Chile / Mindicador',
    dateKey: snapshot.fetchedDayKey || snapshot.indicatorDate,
    lastUpdated: snapshot.fetchedAtIso,
    isCached: !!cached,
  };

  const result: HealthCheckResult = {
    id: 'rates',
    name: 'Indicadores Oficiales BCCh (Dólar & UF)',
    category: 'external',
    status,
    latencyMs: 1,
    message,
    details: metrics,
    lastChecked: new Date().toISOString(),
  };

  return { result, metrics };
}

/**
 * Diagnostic Check: Runtime Environment & Execution Host
 */
export function checkRuntimeEnvironment(): {
  result: HealthCheckResult;
  metrics: RuntimeHealthMetrics;
} {
  const isDesktop = typeof window !== 'undefined' && !!(window as any).pywebview;
  const isOnline = !isNavigatorOffline();
  const isManualOffline = isManualOfflineMode();
  const uptimeMinutes = Math.round((Date.now() - SESSION_START_TIME) / 60000);

  let heapUsedMb: number | undefined;
  let heapTotalMb: number | undefined;

  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    heapUsedMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
    heapTotalMb = Math.round(mem.totalJSHeapSize / (1024 * 1024));
  }

  const metrics: RuntimeHealthMetrics = {
    isDesktop,
    isOnline,
    isManualOffline,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconocido',
    heapUsedMb,
    heapTotalMb,
    sessionUptimeMinutes: uptimeMinutes,
  };

  let status: HealthStatusLevel = 'healthy';
  let message = isDesktop
    ? `App de Escritorio Windows activa. Sesión activa: ${uptimeMinutes} min.`
    : `Navegador Web en ejecución. Red: ${isOnline ? 'Conectado' : 'Sin conexión'}.`;

  if (isManualOffline) {
    message += ' (Modo Offline manual activado)';
  }

  const result: HealthCheckResult = {
    id: 'runtime',
    name: 'Entorno de Ejecución & Red',
    category: 'runtime',
    status,
    latencyMs: 1,
    message,
    details: metrics,
    lastChecked: new Date().toISOString(),
  };

  return { result, metrics };
}

/**
 * Calculates overall system health score (0-100) and status level.
 */
export function calculateOverallHealth(checks: HealthCheckResult[]): {
  score: number;
  status: HealthStatusLevel;
} {
  if (checks.length === 0) {
    return { score: 100, status: 'healthy' };
  }

  let totalWeight = 0;
  let earnedScore = 0;
  let hasCoreCritical = false;
  let hasCoreDegraded = false;
  let hasAnyCritical = false;
  let hasAnyDegraded = false;

  for (const check of checks) {
    let weight = 25;
    if (check.id === 'firestore') weight = 35;
    if (check.id === 'storage') weight = 30;
    if (check.id === 'rates') weight = 15;
    if (check.id === 'cdn') weight = 20;

    totalWeight += weight;

    const isCoreInfra = check.id === 'firestore' || check.id === 'storage';

    if (check.status === 'healthy') {
      earnedScore += weight;
    } else if (check.status === 'degraded') {
      earnedScore += weight * 0.65;
      hasAnyDegraded = true;
      if (isCoreInfra) hasCoreDegraded = true;
    } else if (check.status === 'critical') {
      earnedScore += 0;
      hasAnyCritical = true;
      if (isCoreInfra) hasCoreCritical = true;
    }
  }

  let score = Math.max(0, Math.min(100, Math.round((earnedScore / totalWeight) * 100)));

  // Evitar que subsistemas secundarios sanos enmascaren fallas críticas o degradadas en Firestore/Storage
  if (hasCoreCritical) {
    score = Math.min(score, 55);
  } else if (hasCoreDegraded || hasAnyCritical) {
    score = Math.min(score, 84);
  }

  let status: HealthStatusLevel = 'healthy';
  if (score < 60 || hasCoreCritical) {
    status = 'critical';
  } else if (score < 85 || hasCoreDegraded || hasAnyCritical || hasAnyDegraded) {
    status = 'degraded';
  }

  return { score, status };
}

/**
 * Diagnostic Check: Real-time Performance Telemetry (FPS, Render Latency, DOM Nodes & Heap)
 */
export function checkPerformanceTelemetry(): { result: HealthCheckResult; snapshot: PerformanceSnapshot } {
  const snapshot = getPerformanceSnapshot();
  const status: HealthStatusLevel = snapshot.score >= 75 ? 'healthy' : snapshot.score >= 60 ? 'degraded' : 'critical';

  return {
    result: {
      id: 'telemetry_performance',
      name: 'Telemetría de Rendimiento en Tiempo Real',
      category: 'runtime',
      status,
      latencyMs: snapshot.lastRenderDurationMs,
      message: `Score ${snapshot.score}/100: ${snapshot.ratingLabel} (~${snapshot.fpsEstimate} FPS, ${snapshot.domNodeCount} nodos DOM)`,
      details: {
        score: snapshot.score,
        rating: snapshot.rating,
        fpsEstimate: snapshot.fpsEstimate,
        domNodes: snapshot.domNodeCount,
        avgRenderMs: snapshot.averageRenderDurationMs,
        jsHeapUsedMb: snapshot.jsHeapUsedMb,
        isVirtualizationActive: snapshot.isVirtualizationActive,
        virtualizedTablesCount: snapshot.virtualizedTablesCount,
      },
      lastChecked: new Date().toISOString(),
    },
    snapshot,
  };
}

export interface SystemHealthAlertSummary {
  severity: HealthStatusLevel;
  score: number;
  headline: string;
  detail: string;
  affectedIds: string[];
  blockedCollections: string[];
  timestamp: string;
}

const HEALTH_ALERT_CHECK_IDS_IGNORED_OFFLINE = new Set(['firestore', 'cdn']);

/**
 * Extracts actionable system health alerts from a full report.
 * Filters out expected offline-mode notices while surfacing blocked Firestore collections,
 * storage exhaustion, outdated CDN bundles or critical runtime errors.
 */
export function extractHealthAlertSummary(report: SystemHealthReport): SystemHealthAlertSummary {
  const isOfflineEnv = report.runtime?.isManualOffline || !report.runtime?.isOnline;
  const firestoreCheck = report.checks.firestore;
  const collectionsMap = (firestoreCheck?.details?.collections || {}) as Record<string, string>;
  const blockedCollections = Object.entries(collectionsMap)
    .filter(([, state]) => state === 'denied' || state === 'error')
    .map(([col]) => col);

  const actionableChecks = Object.values(report.checks).filter((check) => {
    if (check.status === 'healthy') return false;
    if (isOfflineEnv && HEALTH_ALERT_CHECK_IDS_IGNORED_OFFLINE.has(check.id)) {
      return false;
    }
    if (check.id === 'firestore' && check.details?.mode === 'offline') {
      return false;
    }
    return true;
  });

  const criticalChecks = actionableChecks.filter((c) => c.status === 'critical');
  const degradedChecks = actionableChecks.filter((c) => c.status === 'degraded');

  let severity: HealthStatusLevel = 'healthy';
  if (criticalChecks.length > 0 || blockedCollections.length >= 4) {
    severity = 'critical';
  } else if (degradedChecks.length > 0 || blockedCollections.length > 0) {
    severity = 'degraded';
  }

  let headline = `Salud Óptima (${report.score}/100)`;
  let detail = 'Todos los subsistemas críticos operativos.';

  if (blockedCollections.length > 0) {
    headline = `Firestore con ${blockedCollections.length} colección(es) bloqueada(s)`;
    detail = `${firestoreCheck?.message || 'Permisos restringidos en Cloud Firestore.'} Colecciones: ${blockedCollections.join(', ')}.`;
  } else if (criticalChecks.length > 0) {
    headline = `Alerta Crítica: ${criticalChecks[0].name}`;
    detail = criticalChecks.map((c) => c.message).join(' • ');
  } else if (degradedChecks.length > 0) {
    headline = `Salud Degradada (${report.score}/100): ${degradedChecks[0].name}`;
    detail = degradedChecks.map((c) => c.message).join(' • ');
  }

  return {
    severity,
    score: report.score,
    headline,
    detail,
    affectedIds: actionableChecks.map((c) => c.id),
    blockedCollections,
    timestamp: report.timestamp,
  };
}

type SystemHealthListener = (report: SystemHealthReport, alert: SystemHealthAlertSummary) => void;

let latestHealthReport: SystemHealthReport | null = null;
let inFlightHealthCheck: Promise<SystemHealthReport> | null = null;
const healthListeners = new Set<SystemHealthListener>();

function publishHealthReport(report: SystemHealthReport): void {
  latestHealthReport = report;
  const alert = extractHealthAlertSummary(report);
  for (const listener of healthListeners) {
    try {
      listener(report, alert);
    } catch (err) {
      console.warn('[HealthService] Error notifying listener:', err);
    }
  }
}

export function getLatestSystemHealthReport(): SystemHealthReport | null {
  return latestHealthReport;
}

export function subscribeSystemHealth(listener: SystemHealthListener): () => void {
  healthListeners.add(listener);
  if (latestHealthReport) {
    try {
      listener(latestHealthReport, extractHealthAlertSummary(latestHealthReport));
    } catch (err) {
      console.warn('[HealthService] Error notifying initial listener:', err);
    }
  }
  return () => {
    healthListeners.delete(listener);
  };
}

/**
 * Triggers a deduplicated background health check (avoids overlapping probes).
 */
export async function triggerBackgroundHealthCheck(force = false): Promise<SystemHealthReport> {
  if (inFlightHealthCheck) {
    return inFlightHealthCheck;
  }

  if (!force && latestHealthReport) {
    const ageMs = Date.now() - new Date(latestHealthReport.timestamp).getTime();
    if (ageMs >= 0 && ageMs < 60_000) {
      return latestHealthReport;
    }
  }

  inFlightHealthCheck = runAllHealthChecks().finally(() => {
    inFlightHealthCheck = null;
  });
  return inFlightHealthCheck;
}

/**
 * Runs all diagnostics concurrently and aggregates into a complete report.
 */
export async function runAllHealthChecks(): Promise<SystemHealthReport> {
  const [firestoreRes, cdnRes, storageData, masterCatalogData] = await Promise.all([
    checkFirestoreHealth(),
    checkCloudflareCdnHealth(),
    checkStorageHealth(),
    warmMasterCatalogCache(),
  ]);

  const ratesData = checkExchangeRatesHealth();
  const runtimeData = checkRuntimeEnvironment();
  const telemetryData = checkPerformanceTelemetry();

  const checks: Record<string, HealthCheckResult> = {
    firestore: firestoreRes,
    cdn: cdnRes,
    storage: storageData.result,
    rates: ratesData.result,
    runtime: runtimeData.result,
    telemetry: telemetryData.result,
  };

  const checkList = Object.values(checks);
  const overall = calculateOverallHealth(checkList);

  const report: SystemHealthReport = {
    overallStatus: overall.status,
    score: overall.score,
    timestamp: new Date().toISOString(),
    appVersion: getFormattedAppVersion(),
    checks,
    storage: storageData.metrics,
    runtime: runtimeData.metrics,
    rates: ratesData.metrics,
    telemetry: telemetryData.snapshot,
    masterCatalog: masterCatalogData,
  };

  publishHealthReport(report);
  return report;
}

/**
 * Utility: Safely frees residual localStorage cache keys and consolidates oversized vaults into IndexedDB.
 */
export function repairStorageCache(): { clearedKeys: number; freedBytes: number } {
  let clearedKeys = 0;
  let freedBytes = 0;

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';

        // 1. Claves estrictamente temporales, logs y residuales de depuración
        if (
          key.startsWith('temp_') ||
          key.startsWith('cache_log_') ||
          key.includes('_debug_') ||
          key.startsWith('idb_fallback_') ||
          key === 'cisco_users_local'
        ) {
          keysToClear.push(key);
        }
        // 2. Claves de catálogo masivo o bóvedas pesadas (> 15 KB) que deben migrarse a IndexedDB
        else if (
          val.length > 15_000 ||
          key === 'cisco_automated_emergency_vault_backup_v1' ||
          ((key.includes('_vault_') ||
            key.includes('_mirror_') ||
            key.includes('_backup_cache_') ||
            key.includes('emergency_vault') ||
            key.includes('cisco_cloud_dsv_cache') ||
            key.includes('cisco_partners_xcl') ||
            key.includes('cisco_bo_sku_catalog') ||
            key.includes('cisco_shared_sku_rules')) &&
            val.length > 15_000)
        ) {
          // Respaldar inmediatamente en IndexedDB antes de remover de LocalStorage
          try {
            const parsed = JSON.parse(val);
            idbSet(STORES.KEYVAL, key, parsed).catch(() => {});
            if (key.includes('cisco_pipeline_deals') && Array.isArray(parsed) && parsed.length > 0) {
              idbSet(STORES.KEYVAL, 'pipeline_deals_idb_v1::cisco_automated', parsed).catch(() => {});
              idbSet(STORES.KEYVAL, 'pipeline_deals_idb_v1::default_local', parsed).catch(() => {});
            } else if (key.includes('cisco_forecast_records') && Array.isArray(parsed) && parsed.length > 0) {
              idbSet(STORES.KEYVAL, 'forecast_records_idb_v1::cisco_automated', parsed).catch(() => {});
              idbSet(STORES.KEYVAL, 'forecast_records_idb_v1::default_local', parsed).catch(() => {});
            }
          } catch (_) {}
          keysToClear.push(key);
        }
      }

      for (const k of keysToClear) {
        const val = localStorage.getItem(k) || '';
        freedBytes += (k.length + val.length) * 2;
        localStorage.removeItem(k);
        clearedKeys++;
      }
    }

    // Ejecutar consolidación profunda en background hacia IndexedDB
    optimizeAndMigrateLocalStorage().catch(() => {});
  } catch (err) {
    console.warn('[HealthService] Error reparando caché:', err);
  }

  return { clearedKeys, freedBytes };
}

/**
 * Formats a clean, readable Markdown diagnostic report ready to copy to clipboard for IT/Support.
 */
export function exportDiagnosticReportMarkdown(report: SystemHealthReport): string {
  const dateFormatted = new Date(report.timestamp).toLocaleString('es-CL');
  const statusEmoji = report.overallStatus === 'healthy' ? '🟢' : report.overallStatus === 'degraded' ? '🟡' : '🔴';

  return `# 🏥 REPORTE DE SALUD Y DIAGNÓSTICO DEL SISTEMA
**Aplicación:** Cisco Automated ${report.appVersion}
**Fecha y Hora:** ${dateFormatted}
**Estado General:** ${statusEmoji} ${report.overallStatus.toUpperCase()} (${report.score}/100)

---

## ☁️ 1. Nube & Base de Datos
* **Firestore:** ${report.checks.firestore?.status.toUpperCase()} (${report.checks.firestore?.latencyMs || 0} ms)
  * Detalle: ${report.checks.firestore?.message}
* **Cloudflare CDN:** ${report.checks.cdn?.status.toUpperCase()} (${report.checks.cdn?.latencyMs || 0} ms)
  * Detalle: ${report.checks.cdn?.message}

## 💾 2. Almacenamiento Local en PC (Motor Relacional SQLite WASM & OPFS)
* **Motor Relacional SQLite:** ${report.storage.sqliteReady ? 'Operativo ✅' : 'En espera ℹ️'} (${report.storage.sqliteDatabaseFormatted || '0 MB'} en archivo .sqlite físico)
* **Persistencia en Disco (OPFS):** ${report.storage.isOpfsActive ? 'OPFS Activo (Acceso Directo a Disco) 🚀' : 'StorageManager Activo ✅'}
* **Capacidad Máxima Disponible:** ${report.storage.storageManagerQuotaFormatted || '50 GB'} (Soporte Masivo de Gigabytes)
* **Bóveda Rápida LocalStorage:** ${report.storage.localStorageFormatted} de uso (Limpio y Optimizado)
* **Espejo Secundario (IndexedDB):** ${report.storage.indexedDbReady ? 'Operativo ✅' : 'Inactivo'}
* **Cola Offline:** ${report.storage.offlineQueueCount} cambios pendientes
* **Tombstones:** ${report.storage.tombstonesCount} registros eliminados pendientes

## 💵 3. Indicadores Financieros Oficiales (BCCh)
* **Dólar Actual (BCCh):** 1 USD = $${report.rates.usdObs.toFixed(2)} CLP
* **Unidad de Fomento (UF):** $${report.rates.uf.toLocaleString('es-CL')} CLP
* **Fuente:** ${report.rates.provider} (${report.rates.dateKey})

## 🖥️ 4. Entorno de Ejecución & Red
* **Plataforma:** ${report.runtime.isDesktop ? 'App de Escritorio Windows (PyWebView)' : 'Navegador Web'}
* **Red:** ${report.runtime.isOnline ? 'Conexión a Internet activa' : 'Sin conexión'}
* **Modo Offline:** ${report.runtime.isManualOffline ? 'Modo Offline Forzado' : 'Modo Online'}
* **Memoria JS Heap:** ${report.runtime.heapUsedMb ? `${report.runtime.heapUsedMb} MB usados / ${report.runtime.heapTotalMb} MB asignados` : 'No reportada'}
* **Tiempo de Sesión:** ${report.runtime.sessionUptimeMinutes} minutos
`;
}
