// ============================================================================
// CISCO AUTOMATED v2.1 - REACT 19 CONCURRENT EXTERNAL STORE FOR ESTIMATES MIRROR
// Safely reads from local-first mirror snapshot with zero UI tearing & race condition protection
// ============================================================================

import { useSyncExternalStore } from 'react';
import type { CloudEstimateRecord } from '../modules/cloud/types';

const LOCAL_ESTIMATES_BACKUP_KEY = 'cisco_cloud_estimates_local_mirror_v1';
const LOCAL_MIRROR_SYNC_TS_KEY = 'cisco_cloud_estimates_mirror_last_sync_v1';

let cachedRaw: string | null = null;
let cachedSnapshot: CloudEstimateRecord[] = [];

/**
 * Returns instantaneous local snapshot. Ensures referential equality
 * when the underlying localStorage string hasn't changed.
 */
export function getEstimatesMirrorSnapshot(): CloudEstimateRecord[] {
  try {
    if (typeof localStorage === 'undefined') {
      return cachedSnapshot;
    }
    const raw = localStorage.getItem(LOCAL_ESTIMATES_BACKUP_KEY);
    if (raw === cachedRaw) {
      return cachedSnapshot;
    }
    cachedRaw = raw;
    cachedSnapshot = raw ? (JSON.parse(raw) as CloudEstimateRecord[]) : [];
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
 * Subscribes to local mirror updates dispatched within the app window
 * or across browser tabs via 'storage' events.
 */
export function subscribeEstimatesMirror(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => {
    // Invalidate cachedRaw so next snapshot reads fresh storage
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_ESTIMATES_BACKUP_KEY);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedSnapshot = raw ? (JSON.parse(raw) as CloudEstimateRecord[]) : [];
      }
    }
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
