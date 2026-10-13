// ============================================================================
// CISCO AUTOMATED v2.1 - REACT 19 CONCURRENT EXTERNAL STORE FOR ESTIMATES MIRROR
// Multi-Tier Redundant Local Vault with Self-Healing, Zero Tearing & Race Protection
// ============================================================================

import { useSyncExternalStore } from 'react';
import type { CloudEstimateRecord } from '../modules/cloud/types';
import { normalizeIsoTimestamp, compareDatesUnknownLast } from '../utils/dateUtils';
import {
  getActiveProjectScopeKey,
  readProjectScopedStorage,
  writeProjectScopedStorage,
} from '../modules/cloud/firebaseConfig';
import {
  getCollectionRecordsSync,
  putCollectionRecordsBatch,
} from '../modules/storage/indexedDbCollectionStore';

// ----------------------------------------------------------------------------
// Redundant Multi-Tier Storage Keys ("Blindaje de Persistencia Local")
// ----------------------------------------------------------------------------
export const LOCAL_ESTIMATES_PRIMARY_KEY = 'cisco_cloud_estimates_cache_v2';
export const LOCAL_ESTIMATES_VAULT_KEY = 'cisco_estimates_permanent_vault_v1';
export const LOCAL_ESTIMATES_MIRROR_KEY = 'cisco_cloud_estimates_local_mirror_v1';
export const LOCAL_ESTIMATES_LEGACY_KEY = 'cisco_estimates_history_v2';
export const LOCAL_ESTIMATES_DELETED_KEY = 'cisco_estimates_deleted_ids_v1';
export const LOCAL_MIRROR_SYNC_TS_KEY = 'cisco_cloud_estimates_mirror_sync_ts';

export function getDeletedEstimateIds(projectId?: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = readProjectScopedStorage(LOCAL_ESTIMATES_DELETED_KEY, projectId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addDeletedEstimateId(idOrEstimateId: string, projectId?: string): void {
  try {
    if (typeof localStorage === 'undefined' || !idOrEstimateId) return;
    const current = getDeletedEstimateIds(projectId);
    const clean = idOrEstimateId.trim();
    current.add(clean);
    current.add(clean.toUpperCase());
    writeProjectScopedStorage(
      LOCAL_ESTIMATES_DELETED_KEY,
      JSON.stringify(Array.from(current)),
      projectId
    );
  } catch {}
}

let cachedHash: string | null = null;
let cachedSnapshot: CloudEstimateRecord[] = [];
let lastMirrorStorageWarning: string | null = null;

export function getLastEstimatesMirrorWarning(): string | null {
  return lastMirrorStorageWarning;
}

/**
 * Deduplicates and merges multiple estimate arrays by Estimate ID, Deal ID, or document ID.
 * Prefers records that have more metadata or newer update timestamps.
 */
function mergeAndDeduplicateEstimates(records: CloudEstimateRecord[]): CloudEstimateRecord[] {
  const map = new Map<string, CloudEstimateRecord>();
  const deletedIds = getDeletedEstimateIds();

  for (const r of records) {
    if (!r || typeof r !== 'object') continue;

    const estId = String(r.estimateId || '').trim();
    const dealId = String(r.dealId || '').trim();
    const fName = String(r.originalFileName || '').trim();
    const docId = String(r.id || '').trim();

    // Skip tombstoned (deleted) records to prevent unwanted resurrection
    if (
      (docId && (deletedIds.has(docId) || deletedIds.has(docId.toUpperCase()))) ||
      (estId && estId.toUpperCase() !== 'NA' && (deletedIds.has(estId) || deletedIds.has(estId.toUpperCase())))
    ) {
      continue;
    }

    // Skip sample / demo placeholders
    if (
      estId === '011682708571Z' ||
      estId === '011682994012A' ||
      fName === 'Intcomex_BancoDeChile_Estimate_2026.xlsx' ||
      fName === 'Logicalis_Cencosud_Switching_CCW.xlsx'
    ) {
      continue;
    }

    const key =
      estId && estId.toUpperCase() !== 'NA'
        ? `EST:${estId.toUpperCase()}`
        : docId.startsWith('est_')
        ? `DOC:${docId}`
        : dealId && dealId.toUpperCase() !== 'NA'
        ? `DEAL:${dealId.toUpperCase()}_${fName.toLowerCase()}`
        : `FILE:${fName.toLowerCase()}`;

    const existing = map.get(key);
    const normalizedCreatedAt = normalizeIsoTimestamp(r.createdAt);
    const normalizedUpdatedAt = normalizeIsoTimestamp(r.updatedAt || r.createdAt);

    const cleanRecord: CloudEstimateRecord = {
      ...r,
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
      isRestricted: Boolean(r.isRestricted),
      allowedUsers: Array.isArray(r.allowedUsers) ? r.allowedUsers : [],
      accessRequests: Array.isArray(r.accessRequests) ? r.accessRequests : [],
    };

    if (!existing) {
      map.set(key, cleanRecord);
    } else {
      // Merge: prefer one with items array or newer update time
      const existingTime = existing.updatedAt || existing.createdAt || '';
      const candidateTime = cleanRecord.updatedAt || cleanRecord.createdAt || '';
      const candidateHasItems = (cleanRecord.items?.length || 0) > 0;
      const existingHasItems = (existing.items?.length || 0) > 0;

      const mergedAllowed = Array.from(
        new Set([...(existing.allowedUsers || []), ...(cleanRecord.allowedUsers || [])])
      );

      const mergedRequests = [
        ...(existing.accessRequests || []),
        ...(cleanRecord.accessRequests || []),
      ];

      const winner =
        candidateHasItems && !existingHasItems
          ? cleanRecord
          : !candidateHasItems && existingHasItems
          ? existing
          : candidateTime >= existingTime
          ? cleanRecord
          : existing;

      map.set(key, {
        ...winner,
        id: existing.id?.startsWith('est_') ? existing.id : winner.id,
        isRestricted: Boolean(existing.isRestricted || cleanRecord.isRestricted),
        allowedUsers: mergedAllowed,
        accessRequests: mergedRequests,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const dateCmp = compareDatesUnknownLast(a.createdAt, b.createdAt, 'desc');
    if (dateCmp !== 0) return dateCmp;
    const idA = String(a.id || a.estimateId || '');
    const idB = String(b.id || b.estimateId || '');
    return idB.localeCompare(idA);
  });
}

/**
 * Returns instantaneous local snapshot. Reads across IndexedDB collection store and redundant vaults,
 * self-heals any missing keys, and ensures referential equality when data is unchanged.
 */
export function getEstimatesMirrorSnapshot(): CloudEstimateRecord[] {
  try {
    const scopeKey = getActiveProjectScopeKey();
    const idbRecords = getCollectionRecordsSync<CloudEstimateRecord>('estimates', scopeKey);

    if (typeof localStorage === 'undefined') {
      if (idbRecords.length > 0) {
        cachedSnapshot = mergeAndDeduplicateEstimates(idbRecords);
      }
      return cachedSnapshot;
    }

    // Read from all tiers of project-scoped redundant local storage
    const rawPrimary = readProjectScopedStorage(LOCAL_ESTIMATES_PRIMARY_KEY, scopeKey) || '';
    const rawVault = readProjectScopedStorage(LOCAL_ESTIMATES_VAULT_KEY, scopeKey) || '';
    const rawMirror = readProjectScopedStorage(LOCAL_ESTIMATES_MIRROR_KEY, scopeKey) || '';
    const rawLegacy = readProjectScopedStorage(LOCAL_ESTIMATES_LEGACY_KEY, scopeKey) || '';

    // Fast path: if storage strings and IDB count haven't changed, preserve referential equality strictly
    const currentHash = `${scopeKey}:::${idbRecords.length}:::${rawPrimary}:::${rawVault}:::${rawMirror}:::${rawLegacy}`;
    if (cachedHash !== null && currentHash === cachedHash) {
      return cachedSnapshot;
    }

    const primaryList: CloudEstimateRecord[] = rawPrimary ? JSON.parse(rawPrimary) : [];
    const vaultList: CloudEstimateRecord[] = rawVault ? JSON.parse(rawVault) : [];
    const mirrorList: CloudEstimateRecord[] = rawMirror ? JSON.parse(rawMirror) : [];

    // Also inspect legacy quoter history
    let legacyList: any[] = [];
    try {
      if (rawLegacy) {
        legacyList = JSON.parse(rawLegacy);
      }
    } catch (_) {}

    const legacyMapped: CloudEstimateRecord[] = legacyList
      .filter((leg) => leg && typeof leg === 'object')
      .map((leg) => {
        const estId = String(leg.estimate_id_cisco || '').trim();
        const fName = String(leg.original_filename || '').trim();
        const createdAt = normalizeIsoTimestamp(leg.created_at);
        return {
          id: `est_${(estId || fName || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`,
          dealId: String(leg.deal_id || 'NA'),
          estimateId: estId || 'NA',
          partnerName: String(leg.partner_name || 'Intcomex Partner'),
          clientFinalName: String(leg.client_final_name || 'Cliente Final'),
          originalFileName: fName || `${estId || 'Estimate'}.xlsx`,
          createdAt,
          creator: {
            username: String(leg.username || 'mskill'),
            fullName: String(leg.username || 'Usuario Intcomex'),
            role: 'pm',
          },
          financialSummary: {
            totalNetCisco: Number(leg.net_cisco_total) || 0,
            totalCotizadoIntcomex: Number(leg.total_cotizado_intcomex) || 0,
            gananciaIntcomexUsd: Number(leg.ganancia_intcomex_usd) || 0,
            margenPct: 5.0,
            currency: 'USD',
            params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
          },
          headerInfo: {
            customerName: String(leg.client_final_name || 'Cliente Final'),
            companyName: String(leg.partner_name || 'Intcomex Partner'),
            address: '',
            city: 'Santiago',
            country: 'Chile',
            phone: '',
            estimateId: estId || 'NA',
            dealId: String(leg.deal_id || 'NA'),
            priceList: 'Global Price List',
            date: createdAt.slice(0, 10),
          },
          itemsCount: Number(leg.items_count) || 0,
          items: [],
          customOverrideMap: {},
          isRestricted: false,
          syncedToCloud: false,
        };
      });

    // Merge all available tiers (including full-item records from IndexedDB collection store)
    const merged = mergeAndDeduplicateEstimates([
      ...idbRecords,
      ...primaryList,
      ...vaultList,
      ...mirrorList,
      ...legacyMapped,
    ]);

    cachedHash = currentHash;
    cachedSnapshot = merged;
    return cachedSnapshot;
  } catch (_) {
    return cachedSnapshot;
  }
}

/**
 * Self-healing routine for redundant local storage tiers.
 * Safely invoked outside React render lifecycle to prevent infinite render loops.
 */
export function healEstimatesMirrorVaults(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const scopeKey = getActiveProjectScopeKey();
    const rawPrimary = readProjectScopedStorage(LOCAL_ESTIMATES_PRIMARY_KEY, scopeKey) || '';
    const rawVault = readProjectScopedStorage(LOCAL_ESTIMATES_VAULT_KEY, scopeKey) || '';
    const rawMirror = readProjectScopedStorage(LOCAL_ESTIMATES_MIRROR_KEY, scopeKey) || '';

    const best = [rawPrimary, rawVault, rawMirror].reduce(
      (max, cur) => (cur.length > max.length ? cur : max),
      ''
    );
    if (!best || best.length <= 2) return;

    if (!rawPrimary || rawPrimary.length < best.length) {
      try {
        writeProjectScopedStorage(LOCAL_ESTIMATES_PRIMARY_KEY, best, scopeKey);
      } catch (_) {}
    }
    if (!rawVault || rawVault.length < best.length) {
      try {
        writeProjectScopedStorage(LOCAL_ESTIMATES_VAULT_KEY, best, scopeKey);
      } catch (_) {}
    }
    if (!rawMirror || rawMirror.length < best.length) {
      try {
        writeProjectScopedStorage(LOCAL_ESTIMATES_MIRROR_KEY, best, scopeKey);
      } catch (_) {}
    }
  } catch (_) {}
}

const SERVER_SNAPSHOT: CloudEstimateRecord[] = [];
function getServerSnapshot(): CloudEstimateRecord[] {
  return SERVER_SNAPSHOT;
}

/**
 * Saves a list of CloudEstimateRecords to the IndexedDB per-record collection store (Item 11)
 * and project-scoped local storage tiers (Item 15), notifying active components with zero UI tearing.
 */
export function saveEstimatesMirrorSnapshot(
  list: CloudEstimateRecord[],
  markSyncedNow: boolean = false
): void {
  try {
    const scopeKey = getActiveProjectScopeKey();
    const cleanList = mergeAndDeduplicateEstimates(list);

    // 1. Persist individual records into IndexedDB collection store (handles large line item payloads)
    const idbEntries = cleanList.map((rec, idx) => ({
      id: String(rec.id || rec.estimateId || `est_${idx}`),
      record: rec,
    }));
    putCollectionRecordsBatch('estimates', idbEntries, {
      projectScope: scopeKey,
      replaceAllInScope: true,
    }).catch(() => {});

    if (typeof localStorage === 'undefined') {
      cachedSnapshot = cleanList;
      return;
    }

    const serialized = JSON.stringify(cleanList);
    // Avoid QuotaExceededError on huge collections by falling back to compact headers in localStorage
    let payloadForLocalStorage = serialized;
    if (serialized.length > 1_800_000) {
      const compactList = cleanList.map((rec) => ({
        ...rec,
        items: Array.isArray(rec.items) && rec.items.length > 20 ? [] : rec.items,
      }));
      payloadForLocalStorage = JSON.stringify(compactList);
      lastMirrorStorageWarning =
        'Colección grande detectada: líneas completas almacenadas en IndexedDB y cabeceras compactas en localStorage.';
    } else {
      lastMirrorStorageWarning = null;
    }

    try {
      writeProjectScopedStorage(LOCAL_ESTIMATES_PRIMARY_KEY, payloadForLocalStorage, scopeKey);
      writeProjectScopedStorage(LOCAL_ESTIMATES_VAULT_KEY, payloadForLocalStorage, scopeKey);
      writeProjectScopedStorage(LOCAL_ESTIMATES_MIRROR_KEY, payloadForLocalStorage, scopeKey);
    } catch (quotaErr: any) {
      lastMirrorStorageWarning = `QuotaExceededError en localStorage (${quotaErr?.message || 'cuota llena'}): respaldado en IndexedDB.`;
    }

    if (markSyncedNow) {
      const nowIso = new Date().toISOString();
      writeProjectScopedStorage(LOCAL_MIRROR_SYNC_TS_KEY, nowIso, scopeKey);
    }

    cachedSnapshot = cleanList;
    const postLegacy = readProjectScopedStorage(LOCAL_ESTIMATES_LEGACY_KEY, scopeKey) || '';
    cachedHash = `${scopeKey}:::${idbEntries.length}:::${payloadForLocalStorage}:::${payloadForLocalStorage}:::${payloadForLocalStorage}:::${postLegacy}`;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cisco-estimates-mirror-updated'));
    }
  } catch (err: any) {
    lastMirrorStorageWarning = err?.message || 'Error guardando espejo de cotizaciones';
  }
}

/**
 * Subscribes to local mirror updates dispatched within the app window,
 * project switches, or across browser tabs via 'storage' events.
 */
export function subscribeEstimatesMirror(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => {
    cachedHash = null; // force re-evaluation on next getSnapshot call
    onStoreChange();
  };

  window.addEventListener('cisco-estimates-mirror-updated', handler);
  window.addEventListener('cisco-firebase-project-switched', handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('cisco-estimates-mirror-updated', handler);
    window.removeEventListener('cisco-firebase-project-switched', handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * React 19 Concurrent Hook to read Cloud Estimates Mirror instantly (0ms)
 * with automatic reactive synchronization upon changes.
 */
export function useEstimatesMirror(): CloudEstimateRecord[] {
  return useSyncExternalStore(
    subscribeEstimatesMirror,
    getEstimatesMirrorSnapshot,
    getServerSnapshot
  );
}

/**
 * Returns ISO timestamp of the last successful mirror sync with Firebase.
 */
export function getMirrorLastSyncTimestamp(projectId?: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return readProjectScopedStorage(LOCAL_MIRROR_SYNC_TS_KEY, projectId);
  } catch (_) {
    return null;
  }
}

