// ============================================================================
// CISCO AUTOMATED - FIRESTORE CLOUD PERSISTENCE SERVICE (MODULAR SDK v10+)
// Pure Fetch-on-Demand (NO onSnapshot realtime listeners) with Local Failsafe
// ============================================================================

import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebaseConfig';
import {
  CloudEstimateRecord,
  EstimateAccessRequest,
  CloudDsvRecord,
  CloudUserRecord,
  SharedSkuOverrideRecord,
  SharedSkuPackageRecord,
} from './types';

const ESTIMATES_COLLECTION = 'estimates';
const DSV_COLLECTION = 'dsv_records';

const LOCAL_ESTIMATES_BACKUP_KEY = 'cisco_cloud_estimates_cache_v2';
const LOCAL_DSV_BACKUP_KEY = 'cisco_cloud_dsv_cache_v2';

// ----------------------------------------------------------------------------
// Local Storage Cache Helpers (Failsafe for Offline & Graceful Recovery)
// ----------------------------------------------------------------------------
function getLocalEstimatesCache(): CloudEstimateRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ESTIMATES_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalEstimatesCache(list: CloudEstimateRecord[]) {
  try {
    localStorage.setItem(LOCAL_ESTIMATES_BACKUP_KEY, JSON.stringify(list));
  } catch (_) {}
}

function getLocalDsvCache(): CloudDsvRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DSV_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalDsvCache(list: CloudDsvRecord[]) {
  try {
    localStorage.setItem(LOCAL_DSV_BACKUP_KEY, JSON.stringify(list));
  } catch (_) {}
}

/**
 * Recursively removes all `undefined` fields from objects and arrays,
 * preventing Firebase Firestore's "Unsupported field value: undefined" error.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result as T;
}

/**
 * Wraps any promise with a strict timeout so that cloud operations
 * never hang or block the application UI if network is slow or credentials are demo/invalid.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 6000,
  fallbackError: string = 'Tiempo de espera de Firebase agotado (Timeout)'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(fallbackError));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 1. ESTIMATES (CCW QUOTER) CLOUD SERVICE
// ----------------------------------------------------------------------------

/**
 * Generates a deterministic Firestore Document ID for an Estimate so re-saving
 * or re-downloading the same Estimate updates it cleanly without creating duplicates.
 */
export function buildEstimateDocId(
  estimateId?: string,
  dealId?: string,
  fileName?: string
): string {
  const cleanEst = String(estimateId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleanEst && cleanEst.toUpperCase() !== 'NA' && cleanEst.toUpperCase() !== 'ESTIMATE') {
    return `est_${cleanEst}`;
  }
  const cleanDeal = String(dealId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanFile = String(fileName || '')
    .trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
  if (cleanDeal && cleanDeal.toUpperCase() !== 'NA') {
    return `est_${cleanDeal}_${cleanFile || 'doc'}`;
  }
  if (cleanFile) {
    return `est_file_${cleanFile}`;
  }
  return 'est_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

/**
 * Saves or updates a completed CCW Estimate record in Firestore 'estimates' collection.
 * Preserves financial summary, items array, customOverrideMap, and privacy/access permissions.
 */
export async function saveEstimateToCloud(
  record: Omit<CloudEstimateRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const docId = buildEstimateDocId(record.estimateId, record.dealId, record.originalFileName);
  const nowIso = new Date().toISOString();

  // 1. Check existing local record to preserve permissions/requests if updating
  const localList = getLocalEstimatesCache();
  const existingLocal = localList.find(
    (x) =>
      x.id === docId ||
      (record.estimateId &&
        record.estimateId !== 'NA' &&
        x.estimateId === record.estimateId)
  );

  const mergedRecord: CloudEstimateRecord = {
    ...record,
    id: docId,
    createdAt: record.createdAt || existingLocal?.createdAt || nowIso,
    updatedAt: nowIso,
    isRestricted:
      record.isRestricted !== undefined
        ? Boolean(record.isRestricted)
        : Boolean(existingLocal?.isRestricted ?? false),
    allowedUsers: record.allowedUsers ?? existingLocal?.allowedUsers ?? [],
    accessRequests: record.accessRequests ?? existingLocal?.accessRequests ?? [],
    syncedToCloud: false,
  };

  // Save immediately to local cache as failsafe
  const filteredLocal = localList.filter(
    (x) =>
      x.id !== docId &&
      !(record.estimateId && record.estimateId !== 'NA' && x.estimateId === record.estimateId)
  );
  saveLocalEstimatesCache([mergedRecord, ...filteredLocal].slice(0, 150));

  try {
    const { db, isReady, error } = getFirestoreInstance();

    if (!isReady || !db) {
      return {
        success: true,
        id: docId,
        error: error ? `Guardado localmente (Aviso Cloud: ${error})` : undefined,
      };
    }

    const docRef = doc(db, ESTIMATES_COLLECTION, docId);

    // If not in local cache, check remote doc briefly to preserve remote accessRequests / allowedUsers
    if (!existingLocal) {
      try {
        const existingSnap = await withTimeout(getDoc(docRef), 3500);
        if (existingSnap.exists()) {
          const remoteData = existingSnap.data() as Partial<CloudEstimateRecord>;
          if (record.isRestricted === undefined && remoteData.isRestricted !== undefined) {
            mergedRecord.isRestricted = Boolean(remoteData.isRestricted);
          }
          if (remoteData.allowedUsers && (!mergedRecord.allowedUsers || mergedRecord.allowedUsers.length === 0)) {
            mergedRecord.allowedUsers = remoteData.allowedUsers;
          }
          if (remoteData.accessRequests && (!mergedRecord.accessRequests || mergedRecord.accessRequests.length === 0)) {
            mergedRecord.accessRequests = remoteData.accessRequests;
          }
        }
      } catch (_) {}
    }

    const { id: _omitId, ...payloadWithoutId } = {
      ...mergedRecord,
      syncedToCloud: true,
    };
    const sanitizedRecord = sanitizeForFirestore(payloadWithoutId);

    await withTimeout(setDoc(docRef, sanitizedRecord, { merge: true }), 8000);

    // Mark as synced in local cache
    const syncedRecord: CloudEstimateRecord = { ...mergedRecord, syncedToCloud: true };
    saveLocalEstimatesCache([syncedRecord, ...filteredLocal].slice(0, 150));

    return { success: true, id: docId };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveEstimate]:', err);
    return {
      success: true,
      id: docId,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Fetches CCW Estimates from Firestore on-demand using getDocs().
 * Orders by createdAt descending, deduplicates by Estimate ID, and auto-syncs any pending local estimates to Cloud.
 */
export async function getCloudEstimates(
  limitCount: number = 100
): Promise<{ success: boolean; data: CloudEstimateRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalEstimatesCache();

    if (!isReady || !db) {
      return {
        success: true,
        data: localCache,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }

    const colRef = collection(db, ESTIMATES_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withTimeout(getDocs(q), 8000);

    const remoteList: CloudEstimateRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<CloudEstimateRecord, 'id'>;
      remoteList.push({
        ...data,
        id: docSnap.id,
        isRestricted: Boolean(data.isRestricted),
        allowedUsers: Array.isArray(data.allowedUsers) ? data.allowedUsers : [],
        accessRequests: Array.isArray(data.accessRequests) ? data.accessRequests : [],
        syncedToCloud: true,
      });
    });

    // Deduplicate remote list by estimateId (keep newest / deterministic docId first)
    const dedupMap = new Map<string, CloudEstimateRecord>();
    for (const r of remoteList) {
      const key =
        r.estimateId && r.estimateId !== 'NA'
          ? `EST:${r.estimateId.trim().toUpperCase()}`
          : `ID:${r.id}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, r);
      } else {
        // Prefer deterministic docId `est_...` or newer updatedAt/createdAt, while merging accessRequests/allowedUsers
        const existingTime = existing.updatedAt || existing.createdAt || '';
        const candidateTime = r.updatedAt || r.createdAt || '';
        const mergedAllowed = Array.from(
          new Set([...(existing.allowedUsers || []), ...(r.allowedUsers || [])])
        );
        const mergedReqsMap = new Map<string, EstimateAccessRequest>();
        for (const req of [...(r.accessRequests || []), ...(existing.accessRequests || [])]) {
          if (req?.username && !mergedReqsMap.has(req.username.toLowerCase())) {
            mergedReqsMap.set(req.username.toLowerCase(), req);
          }
        }
        const winner = candidateTime > existingTime ? r : existing;
        dedupMap.set(key, {
          ...winner,
          id: existing.id?.startsWith('est_') ? existing.id : r.id?.startsWith('est_') ? r.id : winner.id,
          isRestricted: Boolean(existing.isRestricted || r.isRestricted),
          allowedUsers: mergedAllowed,
          accessRequests: Array.from(mergedReqsMap.values()),
        });
      }
    }

    // Check local cache for any unsynced records and push them to Firestore in background
    for (const l of localCache) {
      const key =
        l.estimateId && l.estimateId !== 'NA'
          ? `EST:${l.estimateId.trim().toUpperCase()}`
          : `ID:${l.id}`;
      if (!dedupMap.has(key)) {
        const targetId = buildEstimateDocId(l.estimateId, l.dealId, l.originalFileName);
        const promoted: CloudEstimateRecord = {
          ...l,
          id: targetId,
          isRestricted: Boolean(l.isRestricted),
          allowedUsers: Array.isArray(l.allowedUsers) ? l.allowedUsers : [],
          accessRequests: Array.isArray(l.accessRequests) ? l.accessRequests : [],
          syncedToCloud: true,
        };
        dedupMap.set(key, promoted);

        // Background push to Firestore so all other users can see it too
        const { id: _omit, ...payload } = promoted;
        setDoc(doc(db, ESTIMATES_COLLECTION, targetId), sanitizeForFirestore(payload), {
          merge: true,
        }).catch(() => {});
      }
    }

    const merged = Array.from(dedupMap.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    // Update local cache
    saveLocalEstimatesCache(merged.slice(0, 150));

    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getEstimates]:', err);
    return {
      success: true,
      data: getLocalEstimatesCache(),
      error: `Mostrando registros locales (Aviso Cloud: ${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Toggles manual privacy/restriction on an Estimate (`isRestricted: true | false`).
 * Even when restricted, the Estimate remains visible in search/history table, requiring permission to open.
 */
export async function toggleEstimateRestriction(
  docId: string,
  estimateId: string,
  isRestricted: boolean
): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  try {
    // 1. Update local cache immediately
    const localList = getLocalEstimatesCache().map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return { ...item, isRestricted, updatedAt: nowIso };
      }
      return item;
    });
    saveLocalEstimatesCache(localList);

    // 2. Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            isRestricted,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - toggleEstimateRestriction]:', err);
    return { success: false, error: err?.message || 'Error actualizando visibilidad' };
  }
}

/**
 * Submits a permission request from a user to view/load a restricted Estimate.
 */
export async function requestEstimateAccess(
  docId: string,
  estimateId: string,
  requester: { username: string; fullName: string; role?: string }
): Promise<{ success: boolean; updatedRequests?: EstimateAccessRequest[]; error?: string }> {
  const nowIso = new Date().toISOString();
  const normUsername = (requester.username || '').trim().toLowerCase();
  if (!normUsername) {
    return { success: false, error: 'Usuario inválido para solicitar permiso.' };
  }

  try {
    const localList = getLocalEstimatesCache();
    const targetRecord = localList.find(
      (x) => x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );

    const existingRequests: EstimateAccessRequest[] = Array.isArray(targetRecord?.accessRequests)
      ? [...targetRecord!.accessRequests!]
      : [];

    const newReq: EstimateAccessRequest = {
      username: requester.username,
      fullName: requester.fullName || requester.username,
      role: requester.role || 'pm',
      requestedAt: nowIso,
      status: 'pending',
    };

    const existingIdx = existingRequests.findIndex(
      (r) => r.username.trim().toLowerCase() === normUsername
    );
    if (existingIdx >= 0) {
      existingRequests[existingIdx] = newReq;
    } else {
      existingRequests.push(newReq);
    }

    // Update local cache
    const updatedLocal = localList.map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return { ...item, accessRequests: existingRequests, updatedAt: nowIso };
      }
      return item;
    });
    saveLocalEstimatesCache(updatedLocal);

    // Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            accessRequests: existingRequests,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return { success: true, updatedRequests: existingRequests };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - requestEstimateAccess]:', err);
    return { success: false, error: err?.message || 'Error enviando solicitud de permiso' };
  }
}

/**
 * Approves or rejects a user's permission request on a restricted Estimate.
 */
export async function resolveEstimateAccessRequest(
  docId: string,
  estimateId: string,
  targetUsername: string,
  approve: boolean,
  resolverUsername: string
): Promise<{
  success: boolean;
  allowedUsers?: string[];
  accessRequests?: EstimateAccessRequest[];
  error?: string;
}> {
  const nowIso = new Date().toISOString();
  const normTarget = (targetUsername || '').trim().toLowerCase();

  try {
    const localList = getLocalEstimatesCache();
    const targetRecord = localList.find(
      (x) => x.id === docId || (estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );

    const currentAllowed = new Set<string>(
      (targetRecord?.allowedUsers || []).map((u) => u.trim().toLowerCase())
    );
    if (approve) {
      currentAllowed.add(normTarget);
    } else {
      currentAllowed.delete(normTarget);
    }
    const updatedAllowed = Array.from(currentAllowed);

    const updatedRequests: EstimateAccessRequest[] = (targetRecord?.accessRequests || []).map((req) => {
      if (req.username.trim().toLowerCase() === normTarget) {
        return {
          ...req,
          status: approve ? 'approved' : 'rejected',
          resolvedAt: nowIso,
          resolvedBy: resolverUsername,
        };
      }
      return req;
    });

    // Update local cache
    const updatedLocal = localList.map((item) => {
      if (item.id === docId || (estimateId && estimateId !== 'NA' && item.estimateId === estimateId)) {
        return {
          ...item,
          allowedUsers: updatedAllowed,
          accessRequests: updatedRequests,
          updatedAt: nowIso,
        };
      }
      return item;
    });
    saveLocalEstimatesCache(updatedLocal);

    // Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const targetDocId = docId.startsWith('cloud-est-')
        ? buildEstimateDocId(estimateId)
        : docId;
      const docRef = doc(db, ESTIMATES_COLLECTION, targetDocId);
      await withTimeout(
        setDoc(
          docRef,
          sanitizeForFirestore({
            estimateId: estimateId || 'NA',
            allowedUsers: updatedAllowed,
            accessRequests: updatedRequests,
            updatedAt: nowIso,
          }),
          { merge: true }
        ),
        6000
      );
    }

    return {
      success: true,
      allowedUsers: updatedAllowed,
      accessRequests: updatedRequests,
    };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - resolveEstimateAccessRequest]:', err);
    return { success: false, error: err?.message || 'Error resolviendo solicitud de permiso' };
  }
}

/**
 * Deletes an estimate document from Firestore and local cache.
 */
export async function deleteCloudEstimate(
  docId: string,
  estimateId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Remove from local cache
    const localList = getLocalEstimatesCache().filter(
      (x) => x.id !== docId && !(estimateId && estimateId !== 'NA' && x.estimateId === estimateId)
    );
    saveLocalEstimatesCache(localList);

    // 2. Remove from Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      if (!docId.startsWith('cloud-est-')) {
        await withTimeout(deleteDoc(doc(db, ESTIMATES_COLLECTION, docId)), 4000);
      }
      if (estimateId && estimateId !== 'NA') {
        const detId = buildEstimateDocId(estimateId);
        if (detId !== docId) {
          deleteDoc(doc(db, ESTIMATES_COLLECTION, detId)).catch(() => {});
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteEstimate]:', err);
    return { success: false, error: err?.message || 'Error eliminando registro' };
  }
}

// ----------------------------------------------------------------------------
// 2. DSV (DIRECT SHIP VENDOR) CLOUD SERVICE
// ----------------------------------------------------------------------------

/**
 * Saves a generated DSV record to Firestore 'dsv_records' collection.
 */
export async function saveDsvToCloud(
  record: Omit<CloudDsvRecord, 'id'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();

    // 1. Local Cache Persistence
    const localList = getLocalDsvCache();
    const localId = 'cloud-dsv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const newRecordWithId: CloudDsvRecord = { ...record, id: localId };
    
    const updatedLocal = [newRecordWithId, ...localList.filter((x) => x.soNumber !== record.soNumber || x.dealId !== record.dealId)];
    saveLocalDsvCache(updatedLocal.slice(0, 100));

    // 2. Firestore Cloud Persistence
    if (!isReady || !db) {
      return {
        success: true,
        id: localId,
        error: error ? `Guardado localmente (Aviso Cloud: ${error})` : undefined,
      };
    }

    const colRef = collection(db, DSV_COLLECTION);
    const sanitizedRecord = sanitizeForFirestore({
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
    });
    const docRef = await withTimeout(addDoc(colRef, sanitizedRecord), 3000);

    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveDsv]:', err);
    return {
      success: true,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Fetches DSV Records from Firestore on-demand using getDocs().
 */
export async function getCloudDsvs(
  limitCount: number = 50
): Promise<{ success: boolean; data: CloudDsvRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localCache = getLocalDsvCache();

    if (!isReady || !db) {
      return {
        success: true,
        data: localCache,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }

    const colRef = collection(db, DSV_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withTimeout(getDocs(q), 2500);

    const remoteList: CloudDsvRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<CloudDsvRecord, 'id'>;
      remoteList.push({
        ...data,
        id: docSnap.id,
      });
    });

    const remoteKeys = new Set(remoteList.map((r) => `${r.soNumber}__${r.createdAt}`));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteKeys.has(`${l.soNumber}__${l.createdAt}`));
    const merged = [...remoteList, ...nonDuplicatedLocal];

    saveLocalDsvCache(merged.slice(0, 100));

    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getDsvs]:', err);
    return {
      success: true,
      data: getLocalDsvCache(),
      error: `Mostrando registros locales (Aviso Cloud: ${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Deletes a DSV document from Firestore and local cache.
 */
export async function deleteCloudDsv(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const localList = getLocalDsvCache().filter((x) => x.id !== docId);
    saveLocalDsvCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db && !docId.startsWith('cloud-dsv-')) {
      const docRef = doc(db, DSV_COLLECTION, docId);
      await withTimeout(deleteDoc(docRef), 2000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteDsv]:', err);
    return { success: false, error: err?.message || 'Error eliminando registro DSV' };
  }
}

// ----------------------------------------------------------------------------
// 3. RBAC USERS & AUTHENTICATION CLOUD SERVICE (WITH OFFLINE FALLBACK)
// ----------------------------------------------------------------------------
const USERS_COLLECTION = 'users';
const LOCAL_USERS_BACKUP_KEY = 'cisco_users_cloud_cache_v2';

export async function sha256Salted(password: string): Promise<string> {
  const salt = 'Cisco_Automated_Intcomex_Salt_2026!';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_BASE_USERS: CloudUserRecord[] = [
  {
    username: 'mskill',
    full_name: 'Mauricio Skill (Administrador)',
    email: 'mauricio.skill@mayor.cl',
    role: 'admin',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8', // Intcomex2026!
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'madasme',
    full_name: 'M. Adasme (Product Manager)',
    email: 'madasme@intcomex.com',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'rcuevas',
    full_name: 'R. Cuevas (Product Manager)',
    email: 'rcuevas@intcomex.com',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    username: 'jvalancia',
    full_name: 'J. Valancia (Product Manager)',
    email: 'jvalancia@intcomex.com',
    role: 'pm',
    password_hash: '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
    is_active: 1,
    created_at: '2026-08-01T10:00:00.000Z',
  },
];

export function getLocalUsersCache(): CloudUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_BACKUP_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem('cisco_users_local');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: any) => ({
          ...u,
          password_hash: u.password_hash || '96b9554ea346ec7b66df877239ef74911d3311681fa940e70ca2b73bc2a3a5f8',
        }));
      }
    }
  } catch (_) {}
  return DEFAULT_BASE_USERS;
}

export function saveLocalUsersCache(list: CloudUserRecord[]) {
  try {
    localStorage.setItem(LOCAL_USERS_BACKUP_KEY, JSON.stringify(list));
    localStorage.setItem('cisco_users_local', JSON.stringify(list));
  } catch (_) {}
}

export async function getCloudUsers(): Promise<{ success: boolean; data: CloudUserRecord[]; error?: string }> {
  try {
    const { db, isReady, error } = getFirestoreInstance();
    const localUsers = getLocalUsersCache();

    if (!isReady || !db) {
      return { success: true, data: localUsers, error: error ? `Modo local (${error})` : undefined };
    }

    const colRef = collection(db, USERS_COLLECTION);
    const snapshot = await withTimeout(getDocs(colRef), 2000);

    if (snapshot.empty) {
      // Auto-seed default users in Firestore on first cloud load
      const defaultHash = await sha256Salted('Intcomex2026!');
      const seededList: CloudUserRecord[] = DEFAULT_BASE_USERS.map((u) => ({
        ...u,
        password_hash: defaultHash,
      }));

      for (const u of seededList) {
        try {
          const userDocRef = doc(db, USERS_COLLECTION, u.username.toLowerCase());
          await withTimeout(setDoc(userDocRef, sanitizeForFirestore(u)), 1500);
        } catch (seedErr) {
          console.warn('Error auto-seeding user:', u.username, seedErr);
        }
      }

      saveLocalUsersCache(seededList);
      return { success: true, data: seededList };
    }

    const remoteUsers: CloudUserRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CloudUserRecord;
      remoteUsers.push({
        ...data,
        id: docSnap.id,
        username: (data.username || docSnap.id).toLowerCase(),
      });
    });

    saveLocalUsersCache(remoteUsers);
    return { success: true, data: remoteUsers };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getCloudUsers]:', err);
    return {
      success: true,
      data: getLocalUsersCache(),
      error: `Modo local activo (${err?.message || 'Sin conexión'})`,
    };
  }
}

export async function saveCloudUser(
  user: CloudUserRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUser: CloudUserRecord = {
      ...user,
      username: user.username.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    // 1. Update local cache
    const localList = getLocalUsersCache();
    const filtered = localList.filter((u) => u.username.toLowerCase() !== cleanUser.username);
    const updatedLocal = [cleanUser, ...filtered];
    saveLocalUsersCache(updatedLocal);

    // 2. Update Firestore
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const userDocRef = doc(db, USERS_COLLECTION, cleanUser.username);
      await withTimeout(setDoc(userDocRef, sanitizeForFirestore(cleanUser), { merge: true }), 2500);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - saveCloudUser]:', err);
    return { success: false, error: err?.message || 'Error guardando usuario' };
  }
}

export async function deleteCloudUser(
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const clean = username.trim().toLowerCase();
    const localList = getLocalUsersCache().filter((u) => u.username.toLowerCase() !== clean);
    saveLocalUsersCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const userDocRef = doc(db, USERS_COLLECTION, clean);
      await withTimeout(deleteDoc(userDocRef), 2000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteCloudUser]:', err);
    return { success: false, error: err?.message || 'Error eliminando usuario' };
  }
}

// ----------------------------------------------------------------------------
// 4. SHARED SKU OVERRIDES & COMMUNITY RULES (CLOUD & LOCAL SYNC)
// ----------------------------------------------------------------------------
const SHARED_SKU_COLLECTION = 'shared_sku_rules';
const LOCAL_SHARED_SKU_BACKUP_KEY = 'cisco_shared_sku_rules_cache_v2';

export function getLocalSharedSkuCache(): SharedSkuOverrideRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SHARED_SKU_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalSharedSkuCache(rules: SharedSkuOverrideRecord[]) {
  try {
    localStorage.setItem(LOCAL_SHARED_SKU_BACKUP_KEY, JSON.stringify(rules));
  } catch (_) {}
}

function normalizeRuleValue(rule: any): 'equipo' | 'intangible' | 'arancel' {
  const s = String(rule || '').trim().toLowerCase();
  if (s === 'intangible') return 'intangible';
  if (s === 'arancel') return 'arancel';
  return 'equipo';
}

/**
 * Publishes/Shares SKU rules to Firestore and local backup
 */
export async function publishSharedSkuRules(
  rules: SharedSkuOverrideRecord[],
  author: { username: string; fullName: string; role: string },
  _title?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanRules: SharedSkuOverrideRecord[] = rules.map((r) => ({
      ...r,
      sku: r.sku.trim().toUpperCase(),
      rule: normalizeRuleValue(r.rule),
      previousType: r.previousType || 'Hardware',
      author: {
        username: author.username,
        fullName: author.fullName,
        role: author.role,
      },
      updatedAt: new Date().toISOString(),
      createdAt: r.createdAt || new Date().toISOString(),
    }));

    // 1. Update local cache
    const existingLocal = getLocalSharedSkuCache();
    const cleanSkus = new Set(cleanRules.map((r) => r.sku));
    const mergedLocal = [
      ...cleanRules,
      ...existingLocal.filter((e) => !cleanSkus.has(e.sku)),
    ];
    saveLocalSharedSkuCache(mergedLocal);

    // 2. Persist to Firestore
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db) {
      for (const rule of cleanRules) {
        const safeDocId = encodeURIComponent(rule.sku).replace(/\./g, '%2E');
        const ruleDocRef = doc(db, SHARED_SKU_COLLECTION, safeDocId);
        await withTimeout(setDoc(ruleDocRef, sanitizeForFirestore(rule), { merge: true }), 2500);
      }
    }

    return {
      success: true,
      error: !isReady && error ? `Guardado localmente (${error})` : undefined,
    };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - publishSharedSkuRules]:', err);
    return {
      success: true,
      error: `Guardado en almacenamiento local (Aviso Cloud: ${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Retrieves all shared SKU overrides from Firestore & local backup
 */
export async function getSharedSkuRules(): Promise<{
  success: boolean;
  data: SharedSkuOverrideRecord[];
  error?: string;
}> {
  try {
    const localCache = getLocalSharedSkuCache();
    const { db, isReady, error } = getFirestoreInstance();

    if (!isReady || !db) {
      return { success: true, data: localCache, error: error ? `Modo local activo (${error})` : undefined };
    }

    const colRef = collection(db, SHARED_SKU_COLLECTION);
    const snapshot = await withTimeout(getDocs(colRef), 3000);

    const remoteList: SharedSkuOverrideRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SharedSkuOverrideRecord;
      let rawSku = data.sku;
      try {
        if (!rawSku || rawSku.includes('%')) {
          rawSku = decodeURIComponent(docSnap.id);
        }
      } catch (_) {
        rawSku = docSnap.id;
      }

      remoteList.push({
        ...data,
        id: docSnap.id,
        sku: (rawSku || docSnap.id).toUpperCase(),
        rule: normalizeRuleValue(data.rule),
        previousType: data.previousType || 'Hardware',
      });
    });

    const remoteSkus = new Set(remoteList.map((r) => r.sku));
    const nonDuplicatedLocal = localCache.filter((l) => !remoteSkus.has(l.sku));
    const merged = [...remoteList, ...nonDuplicatedLocal];

    saveLocalSharedSkuCache(merged);
    return { success: true, data: merged };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - getSharedSkuRules]:', err);
    return {
      success: true,
      data: getLocalSharedSkuCache(),
      error: `Mostrando reglas locales (${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Deletes a shared SKU rule from Firestore & local cache
 */
export async function deleteSharedSkuRule(
  sku: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSku = sku.trim().toUpperCase();
    const localList = getLocalSharedSkuCache().filter((r) => r.sku !== cleanSku);
    saveLocalSharedSkuCache(localList);

    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, SHARED_SKU_COLLECTION, cleanSku);
      await withTimeout(deleteDoc(docRef), 2000);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Firestore Cloud Warning - deleteSharedSkuRule]:', err);
    return { success: false, error: err?.message || 'Error eliminando regla' };
  }
}