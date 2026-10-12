// ============================================================================
// CISCO AUTOMATED v2.1 - MASTER DATABASE BACKUP & DISASTER RECOVERY MANAGER
// Blindaje y Protección Integral contra Pérdida de Datos en Todas las Bases de Datos
// ============================================================================

import { getEstimatesMirrorSnapshot, saveEstimatesMirrorSnapshot } from '../../hooks/useEstimatesMirror';
import {
  saveEstimateToCloud,
  saveDsvToCloud,
  saveLocalSharedSkuCache,
  saveCloudUser,
  sanitizeForFirestore,
  withTimeout,
} from './firestoreService';
import { getLocalBoTrackingCache, saveLocalBoTrackingCache, saveBoTracking } from '../bo/boTrackingService';
import { getLocalDealRemindersCache, saveLocalDealRemindersCache, saveDealReminder } from '../bo/dealReminderService';
import { getLocalProfilesCache, saveLocalProfilesCache, saveParamProfile } from './partnerParamsService';
import { getLocalBoSkuCache, saveLocalBoSkuCache } from '../bo/boSkuCatalogService';
import { getLocalUsersCache, saveLocalUsersCache } from './firestoreService';
import { LOCAL_STORAGE_PARTNERS_KEY, LOCAL_STORAGE_PARTNERS_VAULT_KEY } from '../../hooks/usePartnerDatabase';

export interface CiscoDatabaseMasterBackup {
  version: string;
  timestamp: string;
  generatedBy: string;
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
  };
  data: {
    estimates: any[];
    boOrders: any[];
    dealReminders: any[];
    dsvRecords: any[];
    sharedSkuRules: any[];
    partnerProfiles: Record<string, any>;
    partnersXcl: any[];
    boSkuCatalog: Record<string, string>;
    users: any[];
    fastTrackMetadata: Record<string, any>;
  };
}

const EMERGENCY_BACKUP_KEY = 'cisco_automated_emergency_vault_backup_v1';

/**
 * Obtiene los registros DSV locales
 */
function getDsvLocalSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('cisco_cloud_dsv_cache_v2') || localStorage.getItem('cisco_dsv_permanent_vault_v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Obtiene los partners XCL locales
 */
function getPartnersXclSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_PARTNERS_KEY) || localStorage.getItem(LOCAL_STORAGE_PARTNERS_VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Obtiene las reglas de SKU compartidas
 */
function getSharedSkuRulesSnapshot(): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('cisco_shared_sku_rules_cache_v2') || localStorage.getItem('cisco_shared_sku_permanent_vault_v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Obtiene los metadatos de Fast Track
 */
function getFastTrackMetadataSnapshot(): Record<string, any> {
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

/**
 * Genera una instantánea completa (snapshot) de TODAS las bases de datos de Cisco Automated.
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

    // Verificar si faltan órdenes BO pero hay en el respaldo
    const currentBo = getLocalBoTrackingCache();
    if (currentBo.length === 0 && backup.data.boOrders?.length > 0) {
      saveLocalBoTrackingCache(backup.data.boOrders);
    }

    // Verificar si faltan Deals pero hay en el respaldo
    const currentDeals = getLocalDealRemindersCache();
    if (currentDeals.length === 0 && backup.data.dealReminders?.length > 0) {
      saveLocalDealRemindersCache(backup.data.dealReminders);
    }

    // Verificar si faltan Estimates pero hay en el respaldo
    const currentEsts = getEstimatesMirrorSnapshot();
    if (currentEsts.length === 0 && backup.data.estimates?.length > 0) {
      saveEstimatesMirrorSnapshot(backup.data.estimates);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga el archivo de respaldo maestro en formato JSON para custodia del usuario.
 */
export function downloadDatabaseBackupFile(user: string = 'mskill'): void {
  const snapshot = exportAllDatabasesSnapshot(user);
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `Cisco_Automated_Master_Database_Backup_${dateStr}_${timeStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restaura e importa una instantánea completa en todas las bases de datos y sincroniza con Firestore.
 */
export async function restoreAllDatabasesFromSnapshot(
  backup: CiscoDatabaseMasterBackup,
  syncToCloud: boolean = true
): Promise<{ success: boolean; message: string; restoredStats: Record<string, number> }> {
  if (!backup || !backup.data) {
    throw new Error('El archivo de respaldo no tiene una estructura de datos válida.');
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
  };

  // 1. Restaurar Estimates
  if (Array.isArray(backup.data.estimates) && backup.data.estimates.length > 0) {
    const current = getEstimatesMirrorSnapshot();
    const map = new Map<string, any>();
    current.forEach((e) => map.set(e.id || e.estimateId, e));
    backup.data.estimates.forEach((e) => map.set(e.id || e.estimateId, e));
    const merged = Array.from(map.values());
    saveEstimatesMirrorSnapshot(merged);
    restoredStats.estimates = merged.length;
  }

  // 2. Restaurar BO Orders
  if (Array.isArray(backup.data.boOrders) && backup.data.boOrders.length > 0) {
    const current = getLocalBoTrackingCache();
    const map = new Map<string, any>();
    current.forEach((o) => map.set(o.id, o));
    backup.data.boOrders.forEach((o) => map.set(o.id, o));
    const merged = Array.from(map.values());
    saveLocalBoTrackingCache(merged);
    restoredStats.boOrders = merged.length;

    if (syncToCloud) {
      for (const order of merged) {
        saveBoTracking(order).catch(() => {});
      }
    }
  }

  // 3. Restaurar Deal Reminders
  if (Array.isArray(backup.data.dealReminders) && backup.data.dealReminders.length > 0) {
    const current = getLocalDealRemindersCache();
    const map = new Map<string, any>();
    current.forEach((d) => map.set(d.id, d));
    backup.data.dealReminders.forEach((d) => map.set(d.id, d));
    const merged = Array.from(map.values());
    saveLocalDealRemindersCache(merged);
    restoredStats.dealReminders = merged.length;

    if (syncToCloud) {
      for (const deal of merged) {
        saveDealReminder(deal).catch(() => {});
      }
    }
  }

  // 4. Restaurar DSV Records
  if (Array.isArray(backup.data.dsvRecords) && backup.data.dsvRecords.length > 0) {
    const current = getDsvLocalSnapshot();
    const map = new Map<string, any>();
    current.forEach((d) => map.set(d.id, d));
    backup.data.dsvRecords.forEach((d) => map.set(d.id, d));
    const merged = Array.from(map.values());
    try {
      const serialized = JSON.stringify(merged);
      localStorage.setItem('cisco_cloud_dsv_cache_v2', serialized);
      localStorage.setItem('cisco_dsv_permanent_vault_v1', serialized);
      localStorage.setItem('cisco_dsv_backup_cache_v1', serialized);
    } catch (_) {}
    restoredStats.dsvRecords = merged.length;
  }

  // 5. Restaurar Reglas de SKU Compartidas
  if (Array.isArray(backup.data.sharedSkuRules) && backup.data.sharedSkuRules.length > 0) {
    const current = getSharedSkuRulesSnapshot();
    const map = new Map<string, any>();
    current.forEach((r) => map.set(r.sku.toUpperCase(), r));
    backup.data.sharedSkuRules.forEach((r) => map.set(r.sku.toUpperCase(), r));
    const merged = Array.from(map.values());
    try {
      const serialized = JSON.stringify(merged);
      localStorage.setItem('cisco_shared_sku_rules_cache_v2', serialized);
      localStorage.setItem('cisco_shared_sku_permanent_vault_v1', serialized);
      localStorage.setItem('cisco_shared_sku_rules_cache_v1', serialized);
    } catch (_) {}
    restoredStats.sharedSkuRules = merged.length;
  }

  // 6. Restaurar Perfiles de Parámetros de Partners
  if (backup.data.partnerProfiles && typeof backup.data.partnerProfiles === 'object') {
    const current = getLocalProfilesCache();
    const merged = { ...current, ...backup.data.partnerProfiles };
    saveLocalProfilesCache(merged);
    restoredStats.partnerProfiles = Object.keys(merged).length;
  }

  // 7. Restaurar Partners XCL
  if (Array.isArray(backup.data.partnersXcl) && backup.data.partnersXcl.length > 0) {
    const current = getPartnersXclSnapshot();
    const map = new Map<string, any>();
    current.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
    backup.data.partnersXcl.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
    const merged = Array.from(map.values());
    try {
      const serialized = JSON.stringify(merged);
      localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, serialized);
      localStorage.setItem(LOCAL_STORAGE_PARTNERS_VAULT_KEY, serialized);
    } catch (_) {}
    restoredStats.partnersXcl = merged.length;
  }

  // 8. Restaurar Catálogo BO SKU
  if (backup.data.boSkuCatalog && typeof backup.data.boSkuCatalog === 'object') {
    const current = getLocalBoSkuCache();
    const merged = { ...current, ...backup.data.boSkuCatalog };
    saveLocalBoSkuCache(merged);
    restoredStats.boSkuCatalog = Object.keys(merged).length;
  }

  // Guardar copia rodante de seguridad actualizada
  saveRollingEmergencyBackup();

  return {
    success: true,
    message: 'Base de datos restaurada y blindada exitosamente en todos los almacenes.',
    restoredStats,
  };
}
