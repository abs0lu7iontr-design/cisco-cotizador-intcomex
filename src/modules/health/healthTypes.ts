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
  // Motor SQLite Relacional (WASM / OPFS - Gigabytes)
  sqliteSupported?: boolean;
  sqliteReady?: boolean;
  sqliteDatabaseBytes?: number;
  sqliteDatabaseFormatted?: string;
  sqliteTablesCount?: number;
  isOpfsActive?: boolean;

  // Motor Moderno de Alta Capacidad (IndexedDB / StorageManager - Gigabytes)
  storageManagerSupported: boolean;
  storageManagerUsageBytes: number;
  storageManagerQuotaBytes: number;
  storageManagerUsageFormatted: string;
  storageManagerQuotaFormatted: string;
  storageManagerPct: number;
  isPersistentStorage: boolean;
  storageEngineName: string;

  // Bóveda Rápida de Preferencias (LocalStorage - Límite estándar 5 MB)
  localStorageBytes: number;
  localStorageFormatted: string;
  localStoragePct: number;

  // Estado IndexedDB
  indexedDbSupported: boolean;
  indexedDbReady: boolean;

  // Cola y sincronización offline
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
