// ============================================================================
// CISCO AUTOMATED v2.1 - MASTER DATABASE BACKUP & DISASTER RECOVERY MANAGER
// Blindaje y Protección Integral contra Pérdida de Datos en Todas las Bases de Datos
// Soporta restauración completa (incluidos users y fastTrackMetadata), reporte
// verificable por colección (restoredLocally, synced, pending, failed) y reintentos
// ============================================================================

import { getEstimatesMirrorSnapshot, saveEstimatesMirrorSnapshot } from '../../hooks/useEstimatesMirror';
import {
  saveLocalSharedSkuCache,
  saveCloudUser,
  getLocalUsersCache,
  saveLocalUsersCache,
  sanitizeForFirestore,
} from './firestoreService';
import { getLocalBoTrackingCache, saveLocalBoTrackingCache, saveBoTracking } from '../bo/boTrackingService';
import { getLocalDealRemindersCache, saveLocalDealRemindersCache, saveDealReminder } from '../bo/dealReminderService';
import { getLocalProfilesCache, saveLocalProfilesCache, saveParamProfile } from './partnerParamsService';
import { getLocalBoSkuCache, saveLocalBoSkuCache, batchSaveBoSkuMappings } from '../bo/boSkuCatalogService';
import { LOCAL_STORAGE_PARTNERS_KEY, LOCAL_STORAGE_PARTNERS_VAULT_KEY } from '../../hooks/usePartnerDatabase';
import { getFirestoreInstance } from './firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { downloadBlobSafe } from '../../utils/downloadHelper';

export type BackupCollectionName =
  | 'estimates'
  | 'boOrders'
  | 'dealReminders'
  | 'dsvRecords'
  | 'sharedSkuRules'
  | 'partnerProfiles'
  | 'partnersXcl'
  | 'boSkuCatalog'
  | 'users'
  | 'fastTrackMetadata';

export interface CollectionRestoreSummary {
  collection: BackupCollectionName;
  restoredLocally: number;
  synced: number;
  pending: number;
  failed: number;
  scopeNote?: string;
  errors?: string[];
}

export interface FastTrackMetadataSnapshot {
  enabled?: string | null;
  filename?: string | null;
  lastUpdated?: string | null;
  validUntil?: string | null;
  validFrom?: string | null;
  promoCode?: string | null;
  promoTitle?: string | null;
}

export interface CiscoDatabaseMasterBackup {
  version: string;
  timestamp: string;
  generatedBy: string;
  fastTrackScope?: 'metadata_only';
  stats: {
    estimatesCount: number;
    boOrdersCount: number;
    dealRemindersCount: number;
    dsvCount: number;
    sharedSkuRulesCount: number;
    partnerProfilesCount: number;
    partnersXclCount: number;
    boSkuCatalogCount: number;
    usersCount: number;
    fastTrackMetadataKeysCount?: number;
  };
  data: {
    estimates?: any[];
    boOrders?: any[];
    dealReminders?: any[];
    dsvRecords?: any[];
    sharedSkuRules?: any[];
    partnerProfiles?: Record<string, any>;
    partnersXcl?: any[];
    boSkuCatalog?: Record<string, string>;
    users?: any[];
    fastTrackMetadata?: FastTrackMetadataSnapshot;
  };
}

export type CloudSyncItemStatus = 'synced' | 'pending' | 'failed';

export interface CloudSyncCollectionAdapter {
  syncItem: (
    collectionName: BackupCollectionName,
    itemKey: string,
    payload: unknown
  ) => Promise<{ status: CloudSyncItemStatus; error?: string }>;
}

export interface RestoreBackupOptions {
  syncToCloud?: boolean;
  /** 'merge' (default) preserves existing records; 'replace' replaces local collections with the snapshot */
  mode?: 'merge' | 'replace';
  /** Optional custom adapter for cloud sync (used by tests or custom transports) */
  cloudSyncAdapter?: CloudSyncCollectionAdapter;
}

export interface RestoreMasterBackupResult {
  success: boolean;
  hasPartialFailures: boolean;
  hasPendingSync: boolean;
  message: string;
  fastTrackScope: 'metadata_only';
  fastTrackCatalogNotice: string;
  restoredStats: Record<string, number>;
  collectionResults: Record<BackupCollectionName, CollectionRestoreSummary>;
}

interface PendingSyncQueueItem {
  collection: BackupCollectionName;
  key: string;
  payload: unknown;
  queuedAt: string;
  lastError?: string;
}

const EMERGENCY_BACKUP_KEY = 'cisco_automated_emergency_vault_backup_v1';
const PENDING_BACKUP_SYNC_QUEUE_KEY = 'cisco_automated_backup_pending_sync_v1';

const FAST_TRACK_STORAGE_KEY_MAP: Record<keyof FastTrackMetadataSnapshot, string> = {
  enabled: 'cisco_fast_track_enabled',
  filename: 'cisco_fast_track_filename',
  lastUpdated: 'cisco_fast_track_last_updated',
  validUntil: 'cisco_fast_track_valid_until',
  validFrom: 'cisco_fast_track_valid_from',
  promoCode: 'cisco_fast_track_promo_code',
  promoTitle: 'cisco_fast_track_promo_title',
};

let inMemoryPendingQueue: PendingSyncQueueItem[] = [];

function getDsvLocalSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw =
      localStorage.getItem('cisco_cloud_dsv_cache_v2') ||
      localStorage.getItem('cisco_dsv_permanent_vault_v1');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPartnersXclSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw =
      localStorage.getItem(LOCAL_STORAGE_PARTNERS_KEY) ||
      localStorage.getItem(LOCAL_STORAGE_PARTNERS_VAULT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSharedSkuRulesSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw =
      localStorage.getItem('cisco_shared_sku_rules_cache_v2') ||
      localStorage.getItem('cisco_shared_sku_permanent_vault_v1');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getFastTrackMetadataSnapshot(): FastTrackMetadataSnapshot {
  try {
    if (typeof localStorage === 'undefined') return {};
    return {
      enabled: localStorage.getItem('cisco_fast_track_enabled'),
      filename: localStorage.getItem('cisco_fast_track_filename'),
      lastUpdated: localStorage.getItem('cisco_fast_track_last_updated'),
      validUntil: localStorage.getItem('cisco_fast_track_valid_until'),
      validFrom: localStorage.getItem('cisco_fast_track_valid_from'),
      promoCode: localStorage.getItem('cisco_fast_track_promo_code'),
      promoTitle: localStorage.getItem('cisco_fast_track_promo_title'),
    };
  } catch {
    return {};
  }
}

function countPopulatedFastTrackKeys(meta?: FastTrackMetadataSnapshot | null): number {
  if (!meta || typeof meta !== 'object') return 0;
  return Object.values(meta).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
}

export function getPendingBackupSyncQueue(): PendingSyncQueueItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PENDING_BACKUP_SYNC_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          inMemoryPendingQueue = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // Fallback to in-memory queue
  }
  return [...inMemoryPendingQueue];
}

function savePendingBackupSyncQueue(items: PendingSyncQueueItem[]): void {
  // Deduplicate by collection + key
  const dedupMap = new Map<string, PendingSyncQueueItem>();
  for (const item of items) {
    dedupMap.set(`${item.collection}::${item.key}`, item);
  }
  const clean = Array.from(dedupMap.values());
  inMemoryPendingQueue = clean;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_BACKUP_SYNC_QUEUE_KEY, JSON.stringify(clean));
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Default Firestore sync adapter for each collection.
 */
const defaultFirestoreSyncAdapter: CloudSyncCollectionAdapter = {
  async syncItem(collectionName, itemKey, payload): Promise<{ status: CloudSyncItemStatus; error?: string }> {
    const isBrowserOffline =
      typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false;
    if (isBrowserOffline) {
      return { status: 'pending', error: 'Dispositivo sin conexión (offline)' };
    }

    const { db, isReady } = getFirestoreInstance();
    if (!isReady || !db) {
      return { status: 'pending', error: 'Firestore no inicializado o en modo local' };
    }

    try {
      switch (collectionName) {
        case 'estimates': {
          const docRef = doc(db, 'estimates', itemKey);
          await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
          return { status: 'synced' };
        }
        case 'boOrders': {
          await saveBoTracking(payload as any);
          return { status: 'synced' };
        }
        case 'dealReminders': {
          await saveDealReminder(payload as any);
          return { status: 'synced' };
        }
        case 'dsvRecords': {
          const docRef = doc(db, 'dsv_records', itemKey);
          await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
          return { status: 'synced' };
        }
        case 'sharedSkuRules': {
          const safeId = encodeURIComponent(itemKey.toUpperCase());
          const docRef = doc(db, 'shared_sku_rules', safeId);
          await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
          return { status: 'synced' };
        }
        case 'partnerProfiles': {
          const res = await saveParamProfile(payload as any);
          return res.success
            ? { status: 'synced' }
            : { status: 'failed', error: res.error || 'Error guardando perfil de partner' };
        }
        case 'partnersXcl': {
          const safeId = itemKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
          const docRef = doc(db, 'partners_xcl', safeId);
          await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
          return { status: 'synced' };
        }
        case 'boSkuCatalog': {
          const entry = payload as { partNumber: string; sku: string };
          await batchSaveBoSkuMappings([entry]);
          return { status: 'synced' };
        }
        case 'users': {
          const res = await saveCloudUser(payload as any);
          return res.success
            ? { status: 'synced' }
            : { status: 'failed', error: res.error || 'Error sincronizando usuario' };
        }
        case 'fastTrackMetadata': {
          // Fast Track metadata is local configuration metadata; catalog chunks are managed separately
          return { status: 'synced' };
        }
        default:
          return { status: 'synced' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkOrOfflineError = /offline|unavailable|network|timeout|failed to fetch/i.test(msg);
      return {
        status: isNetworkOrOfflineError ? 'pending' : 'failed',
        error: msg,
      };
    }
  },
};

/**
 * Genera una instantánea completa (snapshot) de TODAS las bases de datos de Cisco Automated.
 * Distingue explícitamente `fastTrackMetadata` (solo metadatos de configuración) del catálogo completo.
 */
export function exportAllDatabasesSnapshot(user: string = 'mskill'): CiscoDatabaseMasterBackup {
  const estimates = getEstimatesMirrorSnapshot();
  const boOrders = getLocalBoTrackingCache();
  const dealReminders = getLocalDealRemindersCache();
  const dsvRecords = getDsvLocalSnapshot();
  const sharedSkuRules = getSharedSkuRulesSnapshot();
  const partnerProfiles = getLocalProfilesCache();
  const partnersXcl = getPartnersXclSnapshot();
  const boSkuCatalog = getLocalBoSkuCache();
  const users = getLocalUsersCache();
  const fastTrackMetadata = getFastTrackMetadataSnapshot();

  return {
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    generatedBy: user,
    fastTrackScope: 'metadata_only',
    stats: {
      estimatesCount: estimates.length,
      boOrdersCount: boOrders.length,
      dealRemindersCount: dealReminders.length,
      dsvCount: dsvRecords.length,
      sharedSkuRulesCount: sharedSkuRules.length,
      partnerProfilesCount: Object.keys(partnerProfiles).length,
      partnersXclCount: partnersXcl.length,
      boSkuCatalogCount: Object.keys(boSkuCatalog).length,
      usersCount: users.length,
      fastTrackMetadataKeysCount: countPopulatedFastTrackKeys(fastTrackMetadata),
    },
    data: {
      estimates,
      boOrders,
      dealReminders,
      dsvRecords,
      sharedSkuRules,
      partnerProfiles,
      partnersXcl,
      boSkuCatalog,
      users,
      fastTrackMetadata,
    },
  };
}

/**
 * Guarda una copia de seguridad rodante (rolling emergency backup) en LocalStorage.
 */
export function saveRollingEmergencyBackup(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const snapshot = exportAllDatabasesSnapshot('auto_scheduler');
    localStorage.setItem(EMERGENCY_BACKUP_KEY, JSON.stringify(snapshot));
  } catch (_) {}
}

/**
 * Restaura la copia de seguridad rodante si la base de datos se encuentra vacía o comprometida.
 */
export function checkAndAutoHealFromEmergencyBackup(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(EMERGENCY_BACKUP_KEY);
    if (!raw) return false;

    const backup: CiscoDatabaseMasterBackup = JSON.parse(raw);
    if (!backup || !backup.data) return false;

    const currentBo = getLocalBoTrackingCache();
    if (currentBo.length === 0 && (backup.data.boOrders?.length || 0) > 0) {
      saveLocalBoTrackingCache(backup.data.boOrders!);
    }

    const currentDeals = getLocalDealRemindersCache();
    if (currentDeals.length === 0 && (backup.data.dealReminders?.length || 0) > 0) {
      saveLocalDealRemindersCache(backup.data.dealReminders!);
    }

    const currentEsts = getEstimatesMirrorSnapshot();
    if (currentEsts.length === 0 && (backup.data.estimates?.length || 0) > 0) {
      saveEstimatesMirrorSnapshot(backup.data.estimates!);
    }

    const currentUsers = getLocalUsersCache();
    if (currentUsers.length === 0 && (backup.data.users?.length || 0) > 0) {
      saveLocalUsersCache(backup.data.users!);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga el archivo de respaldo maestro en formato JSON utilizando liberación segura de recursos.
 */
export function downloadDatabaseBackupFile(user: string = 'mskill'): void {
  const snapshot = exportAllDatabasesSnapshot(user);
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `Cisco_Automated_Master_Database_Backup_${dateStr}_${timeStr}.json`;

  downloadBlobSafe(blob, fileName);
}

/**
 * Restaura e importa una instantánea completa en todas las bases de datos, incluyendo
 * `users` y `fastTrackMetadata` (con distinción explícita respecto al catálogo Fast Track completo),
 * esperando las operaciones de sincronización y reportando por colección:
 * `restoredLocally`, `synced`, `pending` y `failed`.
 */
export async function restoreAllDatabasesFromSnapshot(
  backup: CiscoDatabaseMasterBackup,
  syncOrOptions: boolean | RestoreBackupOptions = true
): Promise<RestoreMasterBackupResult> {
  if (!backup || typeof backup !== 'object' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('El archivo de respaldo no tiene una estructura de datos válida.');
  }

  const options: RestoreBackupOptions =
    typeof syncOrOptions === 'boolean'
      ? { syncToCloud: syncOrOptions, mode: 'merge' }
      : {
          syncToCloud: syncOrOptions.syncToCloud ?? true,
          mode: syncOrOptions.mode ?? 'merge',
          cloudSyncAdapter: syncOrOptions.cloudSyncAdapter,
        };

  const syncToCloud = Boolean(options.syncToCloud);
  const isReplace = options.mode === 'replace';
  const adapter = options.cloudSyncAdapter || defaultFirestoreSyncAdapter;

  const collectionNames: BackupCollectionName[] = [
    'estimates',
    'boOrders',
    'dealReminders',
    'dsvRecords',
    'sharedSkuRules',
    'partnerProfiles',
    'partnersXcl',
    'boSkuCatalog',
    'users',
    'fastTrackMetadata',
  ];

  const collectionResults = {} as Record<BackupCollectionName, CollectionRestoreSummary>;
  for (const name of collectionNames) {
    collectionResults[name] = {
      collection: name,
      restoredLocally: 0,
      synced: 0,
      pending: 0,
      failed: 0,
    };
  }

  const restoredStats: Record<string, number> = {
    estimates: 0,
    boOrders: 0,
    dealReminders: 0,
    dsvRecords: 0,
    sharedSkuRules: 0,
    partnerProfiles: 0,
    partnersXcl: 0,
    boSkuCatalog: 0,
    users: 0,
    fastTrackMetadata: 0,
  };

  const pendingQueueMap = new Map<string, PendingSyncQueueItem>();
  for (const existingPending of getPendingBackupSyncQueue()) {
    pendingQueueMap.set(`${existingPending.collection}::${existingPending.key}`, existingPending);
  }

  async function syncCollectionItems(
    collectionName: BackupCollectionName,
    entries: Array<{ key: string; payload: unknown }>
  ): Promise<void> {
    const summary = collectionResults[collectionName];
    if (!syncToCloud) {
      summary.pending = entries.length;
      for (const entry of entries) {
        pendingQueueMap.set(`${collectionName}::${entry.key}`, {
          collection: collectionName,
          key: entry.key,
          payload: entry.payload,
          queuedAt: new Date().toISOString(),
        });
      }
      return;
    }

    const errors: string[] = [];
    for (const entry of entries) {
      const queueId = `${collectionName}::${entry.key}`;
      const res = await adapter.syncItem(collectionName, entry.key, entry.payload);
      if (res.status === 'synced') {
        summary.synced += 1;
        pendingQueueMap.delete(queueId);
      } else if (res.status === 'pending') {
        summary.pending += 1;
        pendingQueueMap.set(queueId, {
          collection: collectionName,
          key: entry.key,
          payload: entry.payload,
          queuedAt: new Date().toISOString(),
          lastError: res.error,
        });
      } else {
        summary.failed += 1;
        if (res.error) errors.push(`${entry.key}: ${res.error}`);
        pendingQueueMap.set(queueId, {
          collection: collectionName,
          key: entry.key,
          payload: entry.payload,
          queuedAt: new Date().toISOString(),
          lastError: res.error,
        });
      }
    }
    if (errors.length > 0) {
      summary.errors = errors;
    }
  }

  // 1. Restaurar Estimates
  if (Array.isArray(backup.data.estimates)) {
    const current = isReplace ? [] : getEstimatesMirrorSnapshot();
    const map = new Map<string, any>();
    current.forEach((e) => {
      const k = e?.id || e?.estimateId;
      if (k) map.set(String(k), e);
    });
    backup.data.estimates.forEach((e) => {
      const k = e?.id || e?.estimateId;
      if (k) map.set(String(k), e);
    });
    const merged = Array.from(map.values());
    if (merged.length > 0 || isReplace) {
      saveEstimatesMirrorSnapshot(merged);
    }
    restoredStats.estimates = merged.length;
    collectionResults.estimates.restoredLocally = merged.length;

    const toSync = backup.data.estimates
      .filter((e) => e && (e.id || e.estimateId))
      .map((e) => ({ key: String(e.id || e.estimateId), payload: e }));
    await syncCollectionItems('estimates', toSync);
  }

  // 2. Restaurar BO Orders
  if (Array.isArray(backup.data.boOrders)) {
    const current = isReplace ? [] : getLocalBoTrackingCache();
    const map = new Map<string, any>();
    current.forEach((o) => {
      if (o?.id) map.set(String(o.id), o);
    });
    backup.data.boOrders.forEach((o) => {
      if (o?.id) map.set(String(o.id), o);
    });
    const merged = Array.from(map.values());
    if (merged.length > 0 || isReplace) {
      saveLocalBoTrackingCache(merged);
    }
    restoredStats.boOrders = merged.length;
    collectionResults.boOrders.restoredLocally = merged.length;

    const toSync = backup.data.boOrders
      .filter((o) => o && o.id)
      .map((o) => ({ key: String(o.id), payload: o }));
    await syncCollectionItems('boOrders', toSync);
  }

  // 3. Restaurar Deal Reminders
  if (Array.isArray(backup.data.dealReminders)) {
    const current = isReplace ? [] : getLocalDealRemindersCache();
    const map = new Map<string, any>();
    current.forEach((d) => {
      if (d?.id) map.set(String(d.id), d);
    });
    backup.data.dealReminders.forEach((d) => {
      if (d?.id) map.set(String(d.id), d);
    });
    const merged = Array.from(map.values());
    if (merged.length > 0 || isReplace) {
      saveLocalDealRemindersCache(merged);
    }
    restoredStats.dealReminders = merged.length;
    collectionResults.dealReminders.restoredLocally = merged.length;

    const toSync = backup.data.dealReminders
      .filter((d) => d && d.id)
      .map((d) => ({ key: String(d.id), payload: d }));
    await syncCollectionItems('dealReminders', toSync);
  }

  // 4. Restaurar DSV Records
  if (Array.isArray(backup.data.dsvRecords)) {
    const current = isReplace ? [] : getDsvLocalSnapshot();
    const map = new Map<string, any>();
    current.forEach((d) => {
      const k = d?.id || d?.soNumber || d?.dealId;
      if (k) map.set(String(k), d);
    });
    backup.data.dsvRecords.forEach((d) => {
      const k = d?.id || d?.soNumber || d?.dealId;
      if (k) map.set(String(k), d);
    });
    const merged = Array.from(map.values());
    try {
      if (typeof localStorage !== 'undefined' && (merged.length > 0 || isReplace)) {
        const serialized = JSON.stringify(merged);
        localStorage.setItem('cisco_cloud_dsv_cache_v2', serialized);
        localStorage.setItem('cisco_dsv_permanent_vault_v1', serialized);
        localStorage.setItem('cisco_dsv_backup_cache_v1', serialized);
      }
    } catch (_) {}
    restoredStats.dsvRecords = merged.length;
    collectionResults.dsvRecords.restoredLocally = merged.length;

    const toSync = backup.data.dsvRecords
      .filter((d) => d && (d.id || d.soNumber || d.dealId))
      .map((d) => ({ key: String(d.id || d.soNumber || d.dealId), payload: d }));
    await syncCollectionItems('dsvRecords', toSync);
  }

  // 5. Restaurar Reglas de SKU Compartidas
  if (Array.isArray(backup.data.sharedSkuRules)) {
    const current = isReplace ? [] : getSharedSkuRulesSnapshot();
    const map = new Map<string, any>();
    current.forEach((r) => {
      if (r?.sku) map.set(String(r.sku).toUpperCase(), r);
    });
    backup.data.sharedSkuRules.forEach((r) => {
      if (r?.sku) map.set(String(r.sku).toUpperCase(), r);
    });
    const merged = Array.from(map.values());
    if (merged.length > 0 || isReplace) {
      saveLocalSharedSkuCache(merged);
    }
    restoredStats.sharedSkuRules = merged.length;
    collectionResults.sharedSkuRules.restoredLocally = merged.length;

    const toSync = backup.data.sharedSkuRules
      .filter((r) => r && r.sku)
      .map((r) => ({ key: String(r.sku).toUpperCase(), payload: r }));
    await syncCollectionItems('sharedSkuRules', toSync);
  }

  // 6. Restaurar Perfiles de Parámetros de Partners
  if (backup.data.partnerProfiles && typeof backup.data.partnerProfiles === 'object') {
    const current = isReplace ? {} : getLocalProfilesCache();
    const merged = { ...current, ...backup.data.partnerProfiles };
    saveLocalProfilesCache(merged);
    const totalProfiles = Object.keys(merged).length;
    restoredStats.partnerProfiles = totalProfiles;
    collectionResults.partnerProfiles.restoredLocally = totalProfiles;

    const toSync = Object.entries(backup.data.partnerProfiles)
      .filter(([k, v]) => k && v && typeof v === 'object')
      .map(([k, v]) => ({ key: k, payload: v }));
    await syncCollectionItems('partnerProfiles', toSync);
  }

  // 7. Restaurar Partners XCL
  if (Array.isArray(backup.data.partnersXcl)) {
    const current = isReplace ? [] : getPartnersXclSnapshot();
    const map = new Map<string, any>();
    current.forEach((p) => {
      if (p?.resellerName) map.set(String(p.resellerName).toUpperCase(), p);
    });
    backup.data.partnersXcl.forEach((p) => {
      if (p?.resellerName) map.set(String(p.resellerName).toUpperCase(), p);
    });
    const merged = Array.from(map.values());
    try {
      if (typeof localStorage !== 'undefined' && (merged.length > 0 || isReplace)) {
        const serialized = JSON.stringify(merged);
        localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, serialized);
        localStorage.setItem(LOCAL_STORAGE_PARTNERS_VAULT_KEY, serialized);
      }
    } catch (_) {}
    restoredStats.partnersXcl = merged.length;
    collectionResults.partnersXcl.restoredLocally = merged.length;

    const toSync = backup.data.partnersXcl
      .filter((p) => p && p.resellerName)
      .map((p) => ({ key: String(p.resellerName).toUpperCase(), payload: p }));
    await syncCollectionItems('partnersXcl', toSync);
  }

  // 8. Restaurar Catálogo BO SKU
  if (backup.data.boSkuCatalog && typeof backup.data.boSkuCatalog === 'object') {
    const current = isReplace ? {} : getLocalBoSkuCache();
    const merged = { ...current, ...backup.data.boSkuCatalog };
    saveLocalBoSkuCache(merged);
    const totalSkuCount = Object.keys(merged).length;
    restoredStats.boSkuCatalog = totalSkuCount;
    collectionResults.boSkuCatalog.restoredLocally = totalSkuCount;

    const toSync = Object.entries(backup.data.boSkuCatalog)
      .filter(([pn, sku]) => pn && sku)
      .map(([partNumber, sku]) => ({
        key: partNumber.toUpperCase(),
        payload: { partNumber, sku },
      }));
    await syncCollectionItems('boSkuCatalog', toSync);
  }

  // 9. Restaurar Usuarios (Users RBAC) - Previamente omitido
  if (Array.isArray(backup.data.users)) {
    const current = isReplace ? [] : getLocalUsersCache();
    const map = new Map<string, any>();
    current.forEach((u) => {
      if (u?.username) map.set(String(u.username).toLowerCase(), u);
    });
    backup.data.users.forEach((u) => {
      if (u?.username) {
        const key = String(u.username).toLowerCase();
        const existing = map.get(key);
        if (!existing || isReplace) {
          map.set(key, u);
        } else {
          const existingTs = existing.updated_at || existing.created_at || '';
          const incomingTs = u.updated_at || u.created_at || '';
          if (incomingTs >= existingTs) {
            map.set(key, { ...existing, ...u });
          }
        }
      }
    });
    const mergedUsers = Array.from(map.values());
    if (mergedUsers.length > 0 || isReplace) {
      saveLocalUsersCache(mergedUsers);
    }
    restoredStats.users = mergedUsers.length;
    collectionResults.users.restoredLocally = mergedUsers.length;

    const toSync = backup.data.users
      .filter((u) => u && u.username)
      .map((u) => ({ key: String(u.username).toLowerCase(), payload: u }));
    await syncCollectionItems('users', toSync);
  }

  // 10. Restaurar Metadatos Fast Track (sin anunciar recuperación del catálogo completo de SKUs)
  const ftMeta = backup.data.fastTrackMetadata;
  let restoredFtKeys = 0;
  if (ftMeta && typeof ftMeta === 'object') {
    try {
      if (typeof localStorage !== 'undefined') {
        if (isReplace) {
          for (const storageKey of Object.values(FAST_TRACK_STORAGE_KEY_MAP)) {
            localStorage.removeItem(storageKey);
          }
        }
        (Object.keys(FAST_TRACK_STORAGE_KEY_MAP) as Array<keyof FastTrackMetadataSnapshot>).forEach(
          (metaKey) => {
            const val = ftMeta[metaKey];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              localStorage.setItem(FAST_TRACK_STORAGE_KEY_MAP[metaKey], String(val));
              restoredFtKeys += 1;
            }
          }
        );
      } else {
        restoredFtKeys = countPopulatedFastTrackKeys(ftMeta);
      }
    } catch (_) {}
  }
  restoredStats.fastTrackMetadata = restoredFtKeys;
  collectionResults.fastTrackMetadata = {
    collection: 'fastTrackMetadata',
    restoredLocally: restoredFtKeys,
    synced: restoredFtKeys > 0 && syncToCloud ? restoredFtKeys : 0,
    pending: 0,
    failed: 0,
    scopeNote:
      'Solo se restauraron metadatos Fast Track (vigencia, nombre de archivo, código promocional). El catálogo completo de productos Fast Track no está incluido en este respaldo JSON.',
  };

  savePendingBackupSyncQueue(Array.from(pendingQueueMap.values()));
  saveRollingEmergencyBackup();

  const totalFailed = Object.values(collectionResults).reduce((acc, c) => acc + c.failed, 0);
  const totalPending = Object.values(collectionResults).reduce((acc, c) => acc + c.pending, 0);

  const fastTrackCatalogNotice =
    'Nota Fast Track: El respaldo contiene únicamente los metadatos de configuración Fast Track (el catálogo completo de productos se gestiona por separado en IndexedDB/Cloud).';

  const statusSuffix =
    totalFailed > 0
      ? ` Se detectaron ${totalFailed} fallo(s) de sincronización en la nube (disponibles para reintento).`
      : totalPending > 0
      ? ` ${totalPending} registro(s) quedaron pendientes de sincronización cloud.`
      : '';

  return {
    success: totalFailed === 0,
    hasPartialFailures: totalFailed > 0,
    hasPendingSync: totalPending > 0,
    message: `Base de datos restaurada localmente con éxito.${statusSuffix} ${fastTrackCatalogNotice}`,
    fastTrackScope: 'metadata_only',
    fastTrackCatalogNotice,
    restoredStats,
    collectionResults,
  };
}

/**
 * Reintenta sincronizar hacia la nube los registros que quedaron en estado `pending` o `failed`
 * sin duplicar registros locales ni remotos.
 */
export async function retryPendingBackupSync(options?: {
  cloudSyncAdapter?: CloudSyncCollectionAdapter;
}): Promise<{
  retried: number;
  synced: number;
  stillPending: number;
  failed: number;
  collectionResults: Record<BackupCollectionName, CollectionRestoreSummary>;
}> {
  const adapter = options?.cloudSyncAdapter || defaultFirestoreSyncAdapter;
  const queue = getPendingBackupSyncQueue();

  const collectionNames: BackupCollectionName[] = [
    'estimates',
    'boOrders',
    'dealReminders',
    'dsvRecords',
    'sharedSkuRules',
    'partnerProfiles',
    'partnersXcl',
    'boSkuCatalog',
    'users',
    'fastTrackMetadata',
  ];

  const collectionResults = {} as Record<BackupCollectionName, CollectionRestoreSummary>;
  for (const name of collectionNames) {
    collectionResults[name] = {
      collection: name,
      restoredLocally: 0,
      synced: 0,
      pending: 0,
      failed: 0,
    };
  }

  const remaining: PendingSyncQueueItem[] = [];
  let synced = 0;
  let stillPending = 0;
  let failed = 0;

  for (const item of queue) {
    const summary = collectionResults[item.collection];
    const res = await adapter.syncItem(item.collection, item.key, item.payload);
    if (res.status === 'synced') {
      synced += 1;
      summary.synced += 1;
    } else if (res.status === 'pending') {
      stillPending += 1;
      summary.pending += 1;
      remaining.push({ ...item, lastError: res.error });
    } else {
      failed += 1;
      summary.failed += 1;
      if (res.error) {
        summary.errors = [...(summary.errors || []), `${item.key}: ${res.error}`];
      }
      remaining.push({ ...item, lastError: res.error });
    }
  }

  savePendingBackupSyncQueue(remaining);

  return {
    retried: queue.length,
    synced,
    stillPending,
    failed,
    collectionResults,
  };
}
