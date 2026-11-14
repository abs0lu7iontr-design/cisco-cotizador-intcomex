// ============================================================================
// CISCO AUTOMATED v2.12.0 - APPLICATION HEALTH & DIAGNOSTIC SYSTEM TYPES
// ============================================================================

export type HealthStatusLevel = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type HealthCategory = 'cloud' | 'storage' | 'external' | 'runtime';

export interface HealthCheckResult {
  id: string;
  name: string;
  category: HealthCategory;
  status: HealthStatusLevel;
  latencyMs?: number;
  message: string;
  details?: Record<string, any>;
  lastChecked: string;
}

export interface StorageHealthMetrics {
  localStorageBytes: number;
  localStorageFormatted: string;
  localStoragePct: number;
  indexedDbSupported: boolean;
  indexedDbReady: boolean;
  offlineQueueCount: number;
  offlineQueueFailedCount: number;
  tombstonesCount: number;
}

export interface RuntimeHealthMetrics {
  isDesktop: boolean;
  isOnline: boolean;
  isManualOffline: boolean;
  userAgent: string;
  heapUsedMb?: number;
  heapTotalMb?: number;
  sessionUptimeMinutes: number;
}

export interface ExchangeRatesHealthMetrics {
  usdObs: number;
  uf: number;
  spreadClp: number;
  effectiveUsd: number;
  provider: string;
  dateKey: string;
  lastUpdated: string;
  isCached: boolean;
}

export interface SystemHealthReport {
  overallStatus: HealthStatusLevel;
  score: number; // 0 to 100
  timestamp: string;
  appVersion: string;
  checks: Record<string, HealthCheckResult>;
  storage: StorageHealthMetrics;
  runtime: RuntimeHealthMetrics;
  rates: ExchangeRatesHealthMetrics;
}
