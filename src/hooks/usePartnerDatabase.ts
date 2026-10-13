// ============================================================================
// CISCO AUTOMATED - LOCAL-FIRST PARTNER DATABASE SYNCHRONIZATION HOOK
// Deterministic Conflict Resolution + Pending Offline Write Queue + React Pure State
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, collection, onSnapshot, Firestore } from 'firebase/firestore';
import { getSimilarityScore } from '../utils/fuzzyMatch';
import { getPartnerDocId } from '../utils/partnerDbUtils';
import {
  getFirestoreInstance,
  readProjectScopedStorage,
  writeProjectScopedStorage,
  registerProjectListener,
  captureProjectContext,
  isProjectContextCurrent,
} from '../modules/cloud/firebaseConfig';

export interface PartnerRecord {
  resellerName: string;
  xclCode: string;
  updatedAt?: number;
  pendingSync?: boolean;
}

export const LOCAL_STORAGE_PARTNERS_KEY = 'cisco_partners_xcl_cache_v1';
export const LOCAL_STORAGE_PARTNERS_VAULT_KEY = 'cisco_partners_xcl_vault_v1';
export const LOCAL_STORAGE_PARTNERS_PENDING_KEY = 'cisco_partners_xcl_pending_writes_v1';

function normalizeTimestampMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (raw && typeof raw === 'object' && 'toMillis' in raw && typeof (raw as { toMillis: () => number }).toMillis === 'function') {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function normalizePartnerRecord(raw: PartnerRecord): PartnerRecord {
  return {
    resellerName: String(raw.resellerName || '').trim(),
    xclCode: String(raw.xclCode || '').trim().toUpperCase(),
    updatedAt: normalizeTimestampMs(raw.updatedAt),
    ...(raw.pendingSync ? { pendingSync: true } : {}),
  };
}

/**
 * Deterministic conflict resolution between two PartnerRecord entries for the same partner key.
 * Rules:
 * 1. If `existing` is a pending local write (`hasPendingLocalWrite` or `existing.pendingSync`)
 *    and `incoming` is from cache or has `updatedAt <= existing.updatedAt`, `existing` wins.
 * 2. Otherwise, the record with the strictly newer `updatedAt` timestamp wins.
 * 3. Tie-breaker when `existing.updatedAt === incoming.updatedAt`:
 *    - Pending local write wins over non-pending.
 *    - Lexicographical comparison of `xclCode` (then `resellerName`) guarantees order-independent determinism.
 */
export function resolvePartnerConflict(
  existingRaw: PartnerRecord,
  incomingRaw: PartnerRecord,
  options?: {
    hasPendingLocalWrite?: boolean;
    incomingFromCache?: boolean;
  }
): PartnerRecord {
  const existing = normalizePartnerRecord(existingRaw);
  const incoming = normalizePartnerRecord(incomingRaw);

  const existingTs = existing.updatedAt ?? 0;
  const incomingTs = incoming.updatedAt ?? 0;
  const isExistingPending = Boolean(options?.hasPendingLocalWrite || existing.pendingSync);

  // Protect pending offline local edits against stale/cached snapshots
  if (isExistingPending) {
    if (options?.incomingFromCache || incomingTs <= existingTs) {
      return { ...existing, pendingSync: true };
    }
  }

  if (incomingTs > existingTs) {
    return incoming;
  }
  if (existingTs > incomingTs) {
    return existing;
  }

  // Deterministic tie-breaker when timestamps are equal
  if (isExistingPending && !incoming.pendingSync) {
    return { ...existing, pendingSync: true };
  }
  if (incoming.pendingSync && !isExistingPending) {
    return { ...incoming, pendingSync: true };
  }

  const xclCmp = incoming.xclCode.localeCompare(existing.xclCode);
  if (xclCmp > 0) return incoming;
  if (xclCmp < 0) return existing;

  const nameCmp = incoming.resellerName.localeCompare(existing.resellerName);
  return nameCmp >= 0 ? incoming : existing;
}

/**
 * Merges an existing list of partners with an incoming snapshot deterministically.
 */
export function mergePartnerListsDeterministically(
  existingList: PartnerRecord[],
  incomingList: PartnerRecord[],
  options?: {
    pendingMap?: Record<string, PartnerRecord>;
    incomingFromCache?: boolean;
  }
): PartnerRecord[] {
  const map = new Map<string, PartnerRecord>();
  const pendingMap = options?.pendingMap || {};

  for (const item of existingList) {
    if (!item || !item.resellerName || !item.xclCode) continue;
    const norm = normalizePartnerRecord(item);
    const key = norm.resellerName.toUpperCase();
    const pendingEntry = pendingMap[key];
    const effective = pendingEntry
      ? resolvePartnerConflict(norm, pendingEntry, { hasPendingLocalWrite: true })
      : norm;
    const prev = map.get(key);
    map.set(
      key,
      prev
        ? resolvePartnerConflict(prev, effective, {
            hasPendingLocalWrite: Boolean(pendingMap[key]),
          })
        : effective
    );
  }

  for (const rawIncoming of incomingList) {
    if (!rawIncoming || !rawIncoming.resellerName || !rawIncoming.xclCode) continue;
    const incoming = normalizePartnerRecord(rawIncoming);
    const key = incoming.resellerName.toUpperCase();
    const hasPending = Boolean(pendingMap[key]);
    const current = map.get(key);

    if (!current) {
      if (hasPending) {
        map.set(
          key,
          resolvePartnerConflict(pendingMap[key], incoming, {
            hasPendingLocalWrite: true,
            incomingFromCache: options?.incomingFromCache,
          })
        );
      } else {
        map.set(key, incoming);
      }
    } else {
      map.set(
        key,
        resolvePartnerConflict(current, incoming, {
          hasPendingLocalWrite: hasPending,
          incomingFromCache: options?.incomingFromCache,
        })
      );
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.resellerName.toUpperCase().localeCompare(b.resellerName.toUpperCase())
  );
}

export function getPendingPartnerWrites(projectId?: string): Record<string, PartnerRecord> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = readProjectScopedStorage(LOCAL_STORAGE_PARTNERS_PENDING_KEY, projectId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePendingPartnerWrites(
  pending: Record<string, PartnerRecord>,
  projectId?: string
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    writeProjectScopedStorage(
      LOCAL_STORAGE_PARTNERS_PENDING_KEY,
      JSON.stringify(pending),
      projectId
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueuePendingPartnerWrite(
  record: PartnerRecord,
  projectId?: string
): Record<string, PartnerRecord> {
  const norm = { ...normalizePartnerRecord(record), pendingSync: true };
  const key = norm.resellerName.toUpperCase();
  const current = getPendingPartnerWrites(projectId);
  const existing = current[key];
  current[key] = existing
    ? resolvePartnerConflict(existing, norm, { hasPendingLocalWrite: true })
    : norm;
  savePendingPartnerWrites(current, projectId);
  return current;
}

export function markPendingPartnerWriteSynced(
  resellerName: string,
  syncedUpdatedAt: number,
  projectId?: string
): void {
  const key = resellerName.trim().toUpperCase();
  const current = getPendingPartnerWrites(projectId);
  const pending = current[key];
  if (!pending) return;
  if ((pending.updatedAt ?? 0) <= syncedUpdatedAt) {
    delete current[key];
    savePendingPartnerWrites(current, projectId);
  }
}

export function persistPartnersToStorage(list: PartnerRecord[], projectId?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const serialized = JSON.stringify(list);
    writeProjectScopedStorage(LOCAL_STORAGE_PARTNERS_KEY, serialized, projectId);
    writeProjectScopedStorage(LOCAL_STORAGE_PARTNERS_VAULT_KEY, serialized, projectId);
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPartnersFromStorage(projectId?: string): PartnerRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const cached1 = readProjectScopedStorage(LOCAL_STORAGE_PARTNERS_KEY, projectId);
    const cached2 = readProjectScopedStorage(LOCAL_STORAGE_PARTNERS_VAULT_KEY, projectId);
    const p1: PartnerRecord[] = cached1 ? JSON.parse(cached1) : [];
    const p2: PartnerRecord[] = cached2 ? JSON.parse(cached2) : [];
    const pendingMap = getPendingPartnerWrites(projectId);
    return mergePartnerListsDeterministically(p2, p1, { pendingMap });
  } catch {
    return [];
  }
}

/**
 * Synchronizes all pending local partner writes to Firestore when connectivity is available.
 */
export async function flushPendingPartnerWrites(
  customSyncFn?: (record: PartnerRecord) => Promise<void>
): Promise<{ synced: number; remaining: number }> {
  const capturedCtx = captureProjectContext();
  const pendingMap = getPendingPartnerWrites(capturedCtx.projectId);
  const entries = Object.values(pendingMap);
  if (entries.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  let synced = 0;
  for (const entry of entries) {
    if (!isProjectContextCurrent(capturedCtx)) {
      break;
    }
    const updatedAt = entry.updatedAt || Date.now();
    try {
      if (customSyncFn) {
        await customSyncFn({ ...entry, updatedAt });
      } else {
        const docId = getPartnerDocId(entry.resellerName);
        if (!docId) continue;
        const instance = getFirestoreInstance();
        if (!instance.isReady || !instance.db || !isProjectContextCurrent(capturedCtx)) {
          continue;
        }
        const docRef = doc(instance.db, 'partners_xcl', docId);
        await setDoc(
          docRef,
          {
            resellerName: entry.resellerName,
            xclCode: entry.xclCode,
            updatedAt,
          },
          { merge: true }
        );
      }
      if (isProjectContextCurrent(capturedCtx)) {
        markPendingPartnerWriteSynced(entry.resellerName, updatedAt, capturedCtx.projectId);
        synced += 1;
      }
    } catch {
      // Leave in pending queue for next retry
    }
  }

  const remaining = Object.keys(getPendingPartnerWrites(capturedCtx.projectId)).length;
  return { synced, remaining };
}

/**
 * Hook de autocompletado y sincronización Local-First para códigos XCL de Partners.
 * Proporciona respuesta en 0ms desde la caché local y sincronización reactiva con Firestore.
 */
export function usePartnerDatabase(originalBomName: string) {
  const [partners, setPartners] = useState<PartnerRecord[]>(() => loadPartnersFromStorage());
  const [suggestedXcl, setSuggestedXcl] = useState('');
  const [matchScore, setMatchScore] = useState(0);
  const [matchedNameDb, setMatchedNameDb] = useState('');
  const isInitialMount = useRef(true);

  // Persistir cambios de estado de partners fuera del actualizador de estado de React
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (partners.length > 0) {
      persistPartnersToStorage(partners);
    }
  }, [partners]);

  // 1. Suscripción a Firestore + sincronización de escrituras pendientes al recuperar red
  useEffect(() => {
    let db: Firestore | null = null;
    const capturedCtx = captureProjectContext();
    try {
      const instance = getFirestoreInstance();
      if (instance.isReady && instance.db) {
        db = instance.db;
      }
    } catch {
      db = null;
    }

    const handleOnline = () => {
      flushPendingPartnerWrites().catch(() => {});
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    // Intentar sincronizar pendientes al montar
    flushPendingPartnerWrites().catch(() => {});

    if (!db) {
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
        }
      };
    }

    try {
      const partnersRef = collection(db, 'partners_xcl');
      const rawUnsubscribe = onSnapshot(
        partnersRef,
        (snapshot) => {
          if (!isProjectContextCurrent(capturedCtx)) {
            return;
          }
          const loaded: PartnerRecord[] = [];
          const incomingFromCache = Boolean(snapshot.metadata?.fromCache);

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Partial<PartnerRecord>;
            if (data && data.resellerName && data.xclCode) {
              loaded.push({
                resellerName: String(data.resellerName).trim(),
                xclCode: String(data.xclCode).trim().toUpperCase(),
                updatedAt: normalizeTimestampMs(data.updatedAt),
              });
            }
          });

          if (loaded.length > 0 && isProjectContextCurrent(capturedCtx)) {
            const pendingMap = getPendingPartnerWrites(capturedCtx.projectId);
            setPartners((prev) =>
              mergePartnerListsDeterministically(prev, loaded, {
                pendingMap,
                incomingFromCache,
              })
            );
          }
        },
        (error) => {
          console.warn(
            '[usePartnerDatabase Note]: Firestore snapshot offline or permission fallback:',
            error?.message || error
          );
        }
      );
      const unregisterListener = registerProjectListener('partners_xcl_listener', rawUnsubscribe);
      return () => {
        unregisterListener();
        rawUnsubscribe();
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
        }
      };
    } catch (err) {
      console.warn('[usePartnerDatabase Note]: Firestore listener failed to attach:', err);
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
        }
      };
    }
  }, []);

  // Escuchar actualizaciones locales inmediatas o cambio de proyecto Firebase
  useEffect(() => {
    const handleLocalUpdate = () => {
      const loaded = loadPartnersFromStorage();
      setPartners(loaded);
    };

    window.addEventListener('cisco_partners_updated', handleLocalUpdate);
    window.addEventListener('cisco-firebase-project-switched', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    return () => {
      window.removeEventListener('cisco_partners_updated', handleLocalUpdate);
      window.removeEventListener('cisco-firebase-project-switched', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  // 2. Ejecutar búsqueda difusa matemática (Fuzzy Matching >= 90%)
  useEffect(() => {
    if (!originalBomName || originalBomName.trim().length === 0 || partners.length === 0) {
      setSuggestedXcl('');
      setMatchScore(0);
      setMatchedNameDb('');
      return;
    }

    let bestScore = 0;
    let bestMatch: PartnerRecord | null = null;

    for (const p of partners) {
      const score = getSimilarityScore(originalBomName, p.resellerName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && bestScore >= 90) {
      setSuggestedXcl(bestMatch.xclCode);
      setMatchScore(bestScore);
      setMatchedNameDb(bestMatch.resellerName);
    } else if (bestMatch && bestScore > 0) {
      setSuggestedXcl('');
      setMatchScore(bestScore);
      setMatchedNameDb(bestMatch.resellerName);
    } else {
      setSuggestedXcl('');
      setMatchScore(0);
      setMatchedNameDb('');
    }
  }, [originalBomName, partners]);

  // 3. Aprendizaje Local-First de nuevo Partner ingresado por el usuario
  const learnNewPartner = useCallback(async (bomName: string, xclCode: string) => {
    if (!bomName || !xclCode) return;
    const cleanName = bomName.trim();
    const cleanXcl = xclCode.trim().toUpperCase();
    if (cleanName.length === 0 || cleanXcl.length < 5) return;

    const nowTs = Date.now();
    const newRecord: PartnerRecord = {
      resellerName: cleanName,
      xclCode: cleanXcl,
      updatedAt: nowTs,
      pendingSync: true,
    };

    // 1. Registrar en cola de escrituras locales pendientes antes de actualizar estado
    const pendingMap = enqueuePendingPartnerWrite(newRecord);

    // 2. Actualizar estado de React de forma pura (sin efectos secundarios en el updater)
    setPartners((prev) => {
      const next = mergePartnerListsDeterministically(prev, [newRecord], {
        pendingMap,
      });
      return next;
    });

    // 3. Persistir en almacenamiento local fuera del updater
    const currentStored = loadPartnersFromStorage();
    const mergedStored = mergePartnerListsDeterministically(currentStored, [newRecord], {
      pendingMap,
    });
    persistPartnersToStorage(mergedStored);

    // 4. Sincronizar con Firestore y limpiar estado pendiente al confirmar
    const docId = getPartnerDocId(cleanName);
    if (!docId) return;

    try {
      const instance = getFirestoreInstance();
      if (instance.isReady && instance.db) {
        const docRef = doc(instance.db, 'partners_xcl', docId);
        await setDoc(
          docRef,
          {
            resellerName: cleanName,
            xclCode: cleanXcl,
            updatedAt: nowTs,
          },
          { merge: true }
        );
        markPendingPartnerWriteSynced(cleanName, nowTs);
        setPartners((prev) =>
          prev.map((p) =>
            p.resellerName.toUpperCase() === cleanName.toUpperCase() && (p.updatedAt ?? 0) <= nowTs
              ? { ...p, pendingSync: false }
              : p
          )
        );
      }
    } catch (error) {
      console.warn('[usePartnerDatabase]: Partner guardado en cola local pendiente de sincronización:', error);
    }
  }, []);

  return { suggestedXcl, matchScore, matchedNameDb, learnNewPartner };
}
