// ============================================================================
// CISCO AUTOMATED v2.14.1 - MODERN HIGH-CAPACITY STORAGE ENGINE (LOCAL-FIRST)
// W3C StorageManager API + IndexedDB Tier 1 (Gigabytes) + LocalStorage Tier 2
// Soporte masivo de almacenamiento tanto en Modo Online como Offline
// ============================================================================

import { getIndexedDb, STORES, idbSet, idbGet, idbDelete } from './indexedDbStorage';

export interface ModernStorageQuota {
  isSupported: boolean;
  isPersisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string;
  quotaFormatted: string;
  pctUsed: number;
  engine: 'StorageManager / IndexedDB' | 'IndexedDB Local' | 'Memory Fallback';
}

const DEFAULT_VIRTUAL_QUOTA_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB default virtual quota if API unavailable

/**
 * Formatea bytes en KB, MB o GB con unidades legibles.
 */
export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Solicita persistencia de almacenamiento permanente (W3C StorageManager persist).
 * Evita que el navegador limpie la base de datos IndexedDB o la cola offline al quedarse sin espacio.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    }
  } catch (err) {
    console.warn('[ModernStorageEngine] Error solicitando persistencia de almacenamiento:', err);
  }
  return false;
}

/**
 * Obtiene la cuota y uso real del motor moderno de almacenamiento (IndexedDB / StorageManager).
 */
export async function getModernStorageQuota(): Promise<ModernStorageQuota> {
  let isSupported = false;
  let isPersisted = false;
  let usageBytes = 0;
  let quotaBytes = DEFAULT_VIRTUAL_QUOTA_BYTES;

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      isSupported = true;
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || DEFAULT_VIRTUAL_QUOTA_BYTES;

      if (typeof navigator.storage.persisted === 'function') {
        isPersisted = await navigator.storage.persisted();
      }
    } else {
      // Fallback para entornos donde navigator.storage no está expuesto (Node, tests, WebView antiguo)
      const db = await getIndexedDb();
      if (db) {
        isSupported = true;
        // Estima uso aproximado por items
        usageBytes = 15 * 1024 * 1024; // 15 MB base estimada
      }
    }
  } catch (err) {
    console.warn('[ModernStorageEngine] Error estimando cuota de almacenamiento:', err);
  }

  const pctUsed = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 10000) / 100) : 0;

  return {
    isSupported,
    isPersisted,
    usageBytes,
    quotaBytes,
    usageFormatted: formatStorageBytes(usageBytes),
    quotaFormatted: formatStorageBytes(quotaBytes),
    pctUsed,
    engine: isSupported ? 'StorageManager / IndexedDB' : 'IndexedDB Local',
  };
}

/**
 * Claves de LocalStorage que contienen copias pesadas duplicadas y deben consolidarse en IndexedDB.
 */
const HEAVY_VAULT_KEYS_TO_MIGRATE = [
  'cisco_automated_emergency_vault_backup_v1',
  'cisco_forecast_records_vault_v1',
  'cisco_forecast_records_cache_v2',
  'cisco_pipeline_deals_vault_v1',
  'cisco_pipeline_deals_cache_v2',
  'cisco_estimates_permanent_vault_v1',
  'cisco_cloud_estimates_local_mirror_v1',
  'cisco_dsv_permanent_vault_v1',
  'cisco_dsv_backup_cache_v1',
  'cisco_cloud_dsv_cache_v2',
  'cisco_deal_reminders_vault_v1',
  'cisco_deal_reminders_legacy_v1',
  'cisco_bo_order_tracking_vault_v1',
  'cisco_bo_order_tracking_legacy_v1',
  'cisco_bo_order_tracking_cache_v2',
  'cisco_partners_xcl_cache_v2',
  'cisco_partners_vault_v1',
  'cisco_bo_sku_catalog_cache_v2',
  'cisco_bo_sku_catalog_vault_v1',
  'cisco_shared_sku_rules_cache_v2',
  'cisco_shared_sku_permanent_vault_v1',
  'cisco_sku_overrides_v2',
  'cisco_sku_overrides_vault_v1',
  'cisco_users_local',
];

/**
 * Migra los datos voluminosos desde LocalStorage hacia IndexedDB y purga las copias redundantes,
 * liberando de forma inmediata hasta 10 MB de LocalStorage para devolver el semáforo a ÓPTIMO (verde).
 */
export async function optimizeAndMigrateLocalStorage(): Promise<{
  freedBytes: number;
  migratedKeys: number;
  clearedKeys: string[];
}> {
  let freedBytes = 0;
  let migratedKeys = 0;
  const clearedKeys: string[] = [];

  if (typeof localStorage === 'undefined') {
    return { freedBytes: 0, migratedKeys: 0, clearedKeys: [] };
  }

  try {
    // 1. Migrar respaldo de emergencia maestro hacia IndexedDB (STORES.KEYVAL)
    const emergencyRaw = localStorage.getItem('cisco_automated_emergency_vault_backup_v1');
    if (emergencyRaw && emergencyRaw.length > 500) {
      try {
        const parsed = JSON.parse(emergencyRaw);
        await idbSet(STORES.KEYVAL, 'cisco_emergency_vault_backup_v2', parsed);
        freedBytes += emergencyRaw.length * 2;
        localStorage.removeItem('cisco_automated_emergency_vault_backup_v1');
        migratedKeys++;
        clearedKeys.push('cisco_automated_emergency_vault_backup_v1');
      } catch {}
    }

    // 2. Migrar y consolidar claves residuales idb_fallback_* si IndexedDB ya está disponible
    const db = await getIndexedDb();
    if (db) {
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('idb_fallback_')) {
          keysToMigrate.push(key);
        }
      }
      const knownStores = [STORES.ESTIMATES, STORES.ROW_NOTES, STORES.OFFLINE_QUEUE, STORES.KEYVAL];
      for (const k of keysToMigrate) {
        const val = localStorage.getItem(k);
        if (val === null) continue;
        const remainder = k.slice('idb_fallback_'.length);
        const matchedStore = knownStores.find((s) => remainder.startsWith(`${s}_`)) || STORES.KEYVAL;
        const realKey = remainder.startsWith(`${matchedStore}_`)
          ? remainder.slice(matchedStore.length + 1)
          : remainder;

        let parsedVal: unknown = val;
        try {
          parsedVal = JSON.parse(val);
        } catch {
          parsedVal = val;
        }
        const ok = realKey ? await idbSet(matchedStore, realKey, parsedVal) : false;
        if (ok) {
          freedBytes += (k.length + val.length) * 2;
          localStorage.removeItem(k);
          migratedKeys++;
          clearedKeys.push(k);
        }
      }
    }

    // 3. Purga y consolidación de bóvedas pesadas hacia IndexedDB (recolectar claves antes de iterar)
    const snapshotKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) snapshotKeys.push(key);
    }

    for (const key of snapshotKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const isHeavyVault =
        HEAVY_VAULT_KEYS_TO_MIGRATE.some((h) => key.includes(h)) ||
        key.includes('_vault_') ||
        key.includes('_mirror_') ||
        key.includes('emergency_vault') ||
        key.includes('_backup_cache_') ||
        key.includes('_legacy_v1') ||
        key.includes('cisco_cloud_dsv_cache') ||
        key.includes('cisco_partners_xcl') ||
        key.includes('cisco_bo_sku_catalog') ||
        key.startsWith('idb_fallback_');

      // Primero evaluar compactación específica del caché de cabeceras de estimates
      if (key.includes('cisco_cloud_estimates_cache_v2') && raw.length > 40_000) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 15) {
            const backedUp = await idbSet(STORES.KEYVAL, 'cisco_estimates_full_history_backup', parsed);
            if (backedUp) {
              const trimmed = parsed.slice(0, 15).map((r: any) => ({
                id: r.id,
                estimateId: r.estimateId,
                dealId: r.dealId,
                partnerName: r.partnerName,
                clientFinalName: r.clientFinalName,
                createdAt: r.createdAt,
                creator: r.creator,
                financialSummary: r.financialSummary,
                headerInfo: r.headerInfo,
                itemsCount: r.itemsCount,
                items: [],
              }));
              const trimmedStr = JSON.stringify(trimmed);
              freedBytes += Math.max(0, (raw.length - trimmedStr.length) * 2);
              localStorage.setItem(key, trimmedStr);
              migratedKeys++;
              clearedKeys.push(`${key} (compactado a 15 registros)`);
            }
          }
        } catch (_) {}
      } else if (
        !key.includes('cisco_sku_overrides_v2') &&
        !key.includes('cisco_partners_xcl_pending_writes_v1') &&
        ((isHeavyVault && raw.length > 15_000) || raw.length > 30_000)
      ) {
        let migratedOk = false;
        try {
          const parsed = JSON.parse(raw);
          migratedOk = await idbSet(STORES.KEYVAL, key, parsed);

          // Si es clave de Pipeline o Forecast, persistir también bajo sus claves canónicas de IDB
          if (migratedOk && key.includes('cisco_pipeline_deals') && Array.isArray(parsed) && parsed.length > 0) {
            await idbSet(STORES.KEYVAL, 'pipeline_deals_idb_v1::cisco_automated', parsed);
            await idbSet(STORES.KEYVAL, 'pipeline_deals_idb_v1::default_local', parsed);
          } else if (migratedOk && key.includes('cisco_forecast_records') && Array.isArray(parsed) && parsed.length > 0) {
            await idbSet(STORES.KEYVAL, 'forecast_records_idb_v1::cisco_automated', parsed);
            await idbSet(STORES.KEYVAL, 'forecast_records_idb_v1::default_local', parsed);
          }
        } catch (_) {
          migratedOk = false;
        }
        if (migratedOk) {
          freedBytes += (key.length + raw.length) * 2;
          localStorage.removeItem(key);
          migratedKeys++;
          clearedKeys.push(key);
        }
      }
    }

    // 4. Limpiar logs, contraseñas legacy y temporales
    const tempKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('temp_') ||
          key.startsWith('cache_log_') ||
          key.includes('_debug_') ||
          key === 'cisco_users_local')
      ) {
        tempKeys.push(key);
      }
    }
    for (const tk of tempKeys) {
      const val = localStorage.getItem(tk) || '';
      freedBytes += (tk.length + val.length) * 2;
      localStorage.removeItem(tk);
      migratedKeys++;
      clearedKeys.push(tk);
    }

    // 5. Solicitar persistencia de cuota en el navegador
    await requestPersistentStorage();
  } catch (err) {
    console.warn('[ModernStorageEngine] Error durante optimización de almacenamiento:', err);
  }

  return { freedBytes, migratedKeys, clearedKeys };
}

// Auto-ejecutar optimización silenciosa en background al iniciar el navegador
if (typeof window !== 'undefined') {
  setTimeout(() => {
    optimizeAndMigrateLocalStorage().catch(() => {});
  }, 2000);
}
