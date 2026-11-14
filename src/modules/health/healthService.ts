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
import { getFirestoreInstance, getActiveFirebaseConfig } from '../cloud/firebaseConfig';
import { getIndexedDb, STORES, idbGet } from '../../core/storage/indexedDbStorage';
import { getOfflineQueueSummary } from '../../core/storage/offlineSyncQueue';
import { isAppOffline, isManualOfflineMode, isNavigatorOffline } from '../../core/storage/offlineModeManager';
import {
  getCachedDailyOfficialRates,
  getDefaultOfficialRatesSnapshot,
  applyFrontendUsdClpSpread,
} from '../../core/chileanExchangeRateService';
import { getFormattedAppVersion, APP_VERSION } from '../../core/appVersion';
import { collection, getDocs, limit, query } from 'firebase/firestore';

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
        const q = query(colRef, limit(1));
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
      return {
        id: 'firestore',
        name: 'Cloud Firestore (Base de Datos)',
        category: 'cloud',
        status: 'degraded',
        latencyMs,
        message: 'Conectado a Firestore pero una o más colecciones reportan permisos restringidos.',
        details: { projectId: config.projectId, collections: collectionResults },
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
  const ls = getLocalStorageMetrics();
  let idbSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  let idbReady = false;

  try {
    const db = await getIndexedDb();
    idbReady = !!db;
  } catch {
    idbReady = false;
  }

  let queueSummary = { items: [], byModule: {}, total: 0 };
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

  const metrics: StorageHealthMetrics = {
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
  let message = `Almacenamiento en PC óptimo. IndexedDB listo y LocalStorage al ${ls.pct}%.`;

  if (!idbReady) {
    status = 'critical';
    message = 'IndexedDB no está disponible en este navegador. Se opera en modo degradado.';
  } else if (ls.pct > 80) {
    status = 'degraded';
    message = `LocalStorage cercano al límite estándar (${ls.pct}% usado). Se recomienda limpiar caché.`;
  } else if (queueSummary.total > 15) {
    status = 'degraded';
    message = `Hay ${queueSummary.total} operaciones en cola local esperando sincronización con la nube.`;
  }

  const result: HealthCheckResult = {
    id: 'storage',
    name: 'Almacenamiento Local del PC (IndexedDB & Bóveda)',
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
  const effectiveUsd = snapshot.dolarAplicadoClp || (snapshot.dolarObservadoOficial + snapshot.spreadClp);

  const hasValidUsd = snapshot.dolarObservadoOficial > 0;
  const hasValidUf = snapshot.ufOficialClp > 0;

  let status: HealthStatusLevel = 'healthy';
  let message = `Indicadores BCCh activos: USD $${effectiveUsd.toFixed(2)} CLP (Spread +$${snapshot.spreadClp}), UF $${snapshot.ufOficialClp.toLocaleString('es-CL')}.`;

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

  for (const check of checks) {
    let weight = 25;
    if (check.id === 'firestore') weight = 35;
    if (check.id === 'storage') weight = 30;
    if (check.id === 'rates') weight = 15;
    if (check.id === 'cdn') weight = 20;

    totalWeight += weight;

    if (check.status === 'healthy') {
      earnedScore += weight;
    } else if (check.status === 'degraded') {
      earnedScore += weight * 0.65;
    } else if (check.status === 'critical') {
      earnedScore += 0;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round((earnedScore / totalWeight) * 100)));

  let status: HealthStatusLevel = 'healthy';
  if (score < 60) status = 'critical';
  else if (score < 85) status = 'degraded';

  return { score, status };
}

/**
 * Runs all diagnostics concurrently and aggregates into a complete report.
 */
export async function runAllHealthChecks(): Promise<SystemHealthReport> {
  const [firestoreRes, cdnRes, storageData] = await Promise.all([
    checkFirestoreHealth(),
    checkCloudflareCdnHealth(),
    checkStorageHealth(),
  ]);

  const ratesData = checkExchangeRatesHealth();
  const runtimeData = checkRuntimeEnvironment();

  const checks: Record<string, HealthCheckResult> = {
    firestore: firestoreRes,
    cdn: cdnRes,
    storage: storageData.result,
    rates: ratesData.result,
    runtime: runtimeData.result,
  };

  const checkList = Object.values(checks);
  const overall = calculateOverallHealth(checkList);

  return {
    overallStatus: overall.status,
    score: overall.score,
    timestamp: new Date().toISOString(),
    appVersion: getFormattedAppVersion(),
    checks,
    storage: storageData.metrics,
    runtime: runtimeData.metrics,
    rates: ratesData.metrics,
  };
}

/**
 * Utility: Safely frees residual localStorage cache keys (e.g. old temporary exports, stale query logs)
 */
export function repairStorageCache(): { clearedKeys: number; freedBytes: number } {
  let clearedKeys = 0;
  let freedBytes = 0;

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('temp_') || key.startsWith('cache_log_') || key.includes('_debug_'))) {
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

## 💾 2. Almacenamiento Local en PC
* **LocalStorage:** ${report.storage.localStorageFormatted} de uso
* **IndexedDB:** ${report.storage.indexedDbReady ? 'Operativo ✅' : 'No disponible ❌'}
* **Cola Offline:** ${report.storage.offlineQueueCount} cambios pendientes
* **Tombstones:** ${report.storage.tombstonesCount} registros eliminados pendientes

## 💵 3. Indicadores Financieros Oficiales (BCCh)
* **Dólar Observado:** $${report.rates.usdObs.toFixed(2)} CLP
* **Dólar con Spread (+${report.rates.spreadClp} CLP):** $${report.rates.effectiveUsd.toFixed(2)} CLP
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
