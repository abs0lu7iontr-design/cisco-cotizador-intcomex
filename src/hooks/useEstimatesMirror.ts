// ============================================================================
// CISCO AUTOMATED v2.1 - REACT 19 CONCURRENT EXTERNAL STORE FOR ESTIMATES MIRROR
// Multi-Tier Redundant Local Vault with Self-Healing, Zero Tearing & Race Protection
// ============================================================================

import { useSyncExternalStore } from 'react';
import type { CloudEstimateRecord } from '../modules/cloud/types';
import { normalizeIsoTimestamp } from '../utils/dateUtils';

// ----------------------------------------------------------------------------
// Redundant Multi-Tier Storage Keys ("Blindaje de Persistencia Local")
// ----------------------------------------------------------------------------
export const LOCAL_ESTIMATES_PRIMARY_KEY = 'cisco_cloud_estimates_cache_v2';
export const LOCAL_ESTIMATES_VAULT_KEY = 'cisco_estimates_permanent_vault_v1';
export const LOCAL_ESTIMATES_MIRROR_KEY = 'cisco_cloud_estimates_local_mirror_v1';
export const LOCAL_ESTIMATES_LEGACY_KEY = 'cisco_estimates_history_v2';
export const LOCAL_MIRROR_SYNC_TS_KEY = 'cisco_cloud_estimates_mirror_sync_ts';

let cachedHash: string | null = null;
let cachedSnapshot: CloudEstimateRecord[] = [];

/**
 * Deduplicates and merges multiple estimate arrays by Estimate ID, Deal ID, or document ID.
 * Prefers records that have more metadata or newer update timestamps.
 */
function mergeAndDeduplicateEstimates(records: CloudEstimateRecord[]): CloudEstimateRecord[] {
  const map = new Map<string, CloudEstimateRecord>();

  for (const r of records) {
    if (!r || typeof r !== 'object') continue;

    const estId = String(r.estimateId || '').trim();
    const dealId = String(r.dealId || '').trim();
    const fName = String(r.originalFileName || '').trim();
    const docId = String(r.id || '').trim();

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

  return Array.from(map.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

/**
 * Returns instantaneous local snapshot. Reads across all redundant vaults,
 * self-heals any missing keys, and ensures referential equality when data is unchanged.
 */
export function getEstimatesMirrorSnapshot(): CloudEstimateRecord[] {
  try {
    if (typeof localStorage === 'undefined') {
      return cachedSnapshot;
    }

    // Read from all tiers of redundant local storage
    const rawPrimary = localStorage.getItem(LOCAL_ESTIMATES_PRIMARY_KEY) || '';
    const rawVault = localStorage.getItem(LOCAL_ESTIMATES_VAULT_KEY) || '';
    const rawMirror = localStorage.getItem(LOCAL_ESTIMATES_MIRROR_KEY) || '';
    const rawLegacy = localStorage.getItem(LOCAL_ESTIMATES_LEGACY_KEY) || '';

    // Fast path: if storage strings haven't changed, preserve referential equality
    const currentHash = `${rawPrimary}:::${rawVault}:::${rawMirror}:::${rawLegacy}`;
    if (currentHash === cachedHash && cachedSnapshot.length > 0) {
      return cachedSnapshot;
    }

    const primaryList: CloudEstimateRecord[] = rawPrimary ? JSON.parse(rawPrimary) : [];
    const vaultList: CloudEstimateRecord[] = rawVault ? JSON.parse(rawVault) : [];
    const mirrorList: CloudEstimateRecord[] = rawMirror ? JSON.parse(rawMirror) : [];

    // Also inspect legacy quoter history
    let legacyList: any[] = [];
    try {
      const rawLegacy = localStorage.getItem(LOCAL_ESTIMATES_LEGACY_KEY);
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

    // Merge all available tiers into one comprehensive collection
    const merged = mergeAndDeduplicateEstimates([
      ...primaryList,
      ...vaultList,
      ...mirrorList,
      ...legacyMapped,
    ]);

    // Self-healing: if any redundant key is missing data, restore it immediately
    const serializedMerged = JSON.stringify(merged.slice(0, 300));
    let needsHeal = false;

    if (!rawVault || rawVault.length < serializedMerged.length) {
      try {
        localStorage.setItem(LOCAL_ESTIMATES_VAULT_KEY, serializedMerged);
        needsHeal = true;
      } catch (_) {}
    }
    if (!rawPrimary || rawPrimary.length < serializedMerged.length) {
      try {
        localStorage.setItem(LOCAL_ESTIMATES_PRIMARY_KEY, serializedMerged);
        needsHeal = true;
      } catch (_) {}
    }
    if (!rawMirror || rawMirror.length < serializedMerged.length) {
      try {
        localStorage.setItem(LOCAL_ESTIMATES_MIRROR_KEY, serializedMerged);
        needsHeal = true;
      } catch (_) {}
    }

    // Read final state after self-healing so cachedHash matches subsequent calls perfectly
    const postPrimary = localStorage.getItem(LOCAL_ESTIMATES_PRIMARY_KEY) || '';
    const postVault = localStorage.getItem(LOCAL_ESTIMATES_VAULT_KEY) || '';
    const postMirror = localStorage.getItem(LOCAL_ESTIMATES_MIRROR_KEY) || '';
    const postLegacy = localStorage.getItem(LOCAL_ESTIMATES_LEGACY_KEY) || '';

    cachedHash = `${postPrimary}:::${postVault}:::${postMirror}:::${postLegacy}`;
    cachedSnapshot = merged;
    return cachedSnapshot;
  } catch (_) {
    return cachedSnapshot;
  }
}

const SERVER_SNAPSHOT: CloudEstimateRecord[] = [];
function getServerSnapshot(): CloudEstimateRecord[] {
  return SERVER_SNAPSHOT;
}

/**
 * Saves a list of CloudEstimateRecords across all redundant local storage tiers
 * and notifies active components with zero UI tearing.
 */
export function saveEstimatesMirrorSnapshot(
  list: CloudEstimateRecord[],
  markSyncedNow: boolean = false
): void {
  try {
    if (typeof localStorage === 'undefined') return;

    // Deduplicate and normalize timestamps
    const cleanList = mergeAndDeduplicateEstimates(list).slice(0, 300);
    const serialized = JSON.stringify(cleanList);

    // Save redundantly to all 3 vault keys
    localStorage.setItem(LOCAL_ESTIMATES_PRIMARY_KEY, serialized);
    localStorage.setItem(LOCAL_ESTIMATES_VAULT_KEY, serialized);
    localStorage.setItem(LOCAL_ESTIMATES_MIRROR_KEY, serialized);

    if (markSyncedNow) {
      const nowIso = new Date().toISOString();
      localStorage.setItem(LOCAL_MIRROR_SYNC_TS_KEY, nowIso);
    }

    cachedSnapshot = cleanList;
    const postLegacy = localStorage.getItem(LOCAL_ESTIMATES_LEGACY_KEY) || '';
    cachedHash = `${serialized}:::${serialized}:::${serialized}:::${postLegacy}`;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cisco-estimates-mirror-updated'));
    }
  } catch (_) {}
}

/**
 * Subscribes to local mirror updates dispatched within the app window
 * or across browser tabs via 'storage' events.
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
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('cisco-estimates-mirror-updated', handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * React 19 Concurrent Hook to read Cloud Estimates Mirror instantly (0ms)
 * with automatic reactive synchronization upon changes.
 */
export function useEstimatesMirror(): CloudEstimateRecord[] {
  return useSyncExternalStore(subscribeEstimatesMirror, getEstimatesMirrorSnapshot, getServerSnapshot);
}

/**
 * Returns ISO timestamp of the last successful mirror sync with Firebase.
 */
export function getMirrorLastSyncTimestamp(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LOCAL_MIRROR_SYNC_TS_KEY);
  } catch (_) {
    return null;
  }
}
