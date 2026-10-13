// ============================================================================
// CISCO AUTOMATED - INDEXEDDB COLLECTION REPOSITORY & IDEMPOTENT EVENT STORE
// Implements Item 11 (Large Collections Outside localStorage)
// and Item 12 (Idempotent Event Logs for BO Tracking & Deal Reminders)
// ============================================================================

import {
  getActiveProjectScopeKey,
  isDefaultFirebaseProject,
  readProjectScopedStorage,
  writeProjectScopedStorage,
} from '../cloud/firebaseConfig';

export type ManagedCollectionName = 'estimates' | 'bo_trackings' | 'deal_reminders';

export interface StorageWriteResult {
  success: boolean;
  persistedCount: number;
  quotaExceeded?: boolean;
  backend: 'indexeddb' | 'memory_fallback';
  error?: string;
}

export interface EntityHistoryEvent {
  id: string;
  idempotencyKey: string;
  projectId: string;
  entityType: 'BO_TRACKING' | 'DEAL_REMINDER';
  entityId: string;
  actionOrStage: string;
  author: string;
  comment: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface EventQueryOptions {
  limit?: number;
  afterCreatedAt?: string;
  direction?: 'asc' | 'desc';
}

const COLLECTIONS_DB_NAME = 'CiscoAppCollectionsDB';
const COLLECTIONS_DB_VERSION = 1;
const STORE_ESTIMATES = 'estimates';
const STORE_BO_TRACKINGS = 'bo_trackings';
const STORE_DEAL_REMINDERS = 'deal_reminders';
const STORE_ENTITY_EVENTS = 'entity_events';
const STORE_MIGRATION_META = 'migration_meta';

const ALL_STORES = [
  STORE_ESTIMATES,
  STORE_BO_TRACKINGS,
  STORE_DEAL_REMINDERS,
  STORE_ENTITY_EVENTS,
  STORE_MIGRATION_META,
] as const;

// In-memory per-record mirror indexed by `${projectScope}::${collection} -> Map<recordId, record>`
const memoryCollections = new Map<string, Map<string, any>>();
// In-memory event log indexed by `${projectScope}::${entityType}::${entityId} -> Map<idempotencyKey, EntityHistoryEvent>`
const memoryEntityEvents = new Map<string, Map<string, EntityHistoryEvent>>();
const migrationCompletedFlags = new Set<string>();

let sharedDbPromise: Promise<IDBDatabase> | null = null;
let simulatedFailureMode: 'NONE' | 'QUOTA_EXCEEDED' | 'TRANSACTION_ABORTED' = 'NONE';
let lastStorageError: string | null = null;

let broadcastChannelInstance: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannelInstance) {
    try {
      broadcastChannelInstance = new BroadcastChannel('cisco_collections_sync_v1');
    } catch {
      broadcastChannelInstance = null;
    }
  }
  return broadcastChannelInstance;
}

/**
 * Allows QA tests to simulate IndexedDB/localStorage quota or transaction failures deterministically.
 */
export function setSimulatedCollectionStorageFailure(
  mode: 'NONE' | 'QUOTA_EXCEEDED' | 'TRANSACTION_ABORTED'
): void {
  simulatedFailureMode = mode;
}

export function getLastCollectionStorageError(): string | null {
  return lastStorageError;
}

function getCollectionScopeMap<T = any>(
  collectionName: ManagedCollectionName,
  projectScope?: string
): Map<string, T> {
  const scope = projectScope || getActiveProjectScopeKey();
  const key = `${scope}::${collectionName}`;
  let map = memoryCollections.get(key);
  if (!map) {
    map = new Map<string, T>();
    memoryCollections.set(key, map);
  }
  return map as Map<string, T>;
}

function getEventScopeMap(
  entityType: 'BO_TRACKING' | 'DEAL_REMINDER',
  entityId: string,
  projectScope?: string
): Map<string, EntityHistoryEvent> {
  const scope = projectScope || getActiveProjectScopeKey();
  const key = `${scope}::${entityType}::${entityId}`;
  let map = memoryEntityEvents.get(key);
  if (!map) {
    map = new Map<string, EntityHistoryEvent>();
    memoryEntityEvents.set(key, map);
  }
  return map;
}

function makeScopedRecordKey(id: string, projectScope?: string): string {
  const scope = projectScope || getActiveProjectScopeKey();
  if (isDefaultFirebaseProject(scope)) {
    return id;
  }
  return `${scope}::${id}`;
}

function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/**
 * Opens or reuses a single pooled IndexedDB connection for `CiscoAppCollectionsDB`,
 * handling `onversionchange` and `onblocked` cleanly.
 */
export function openCollectionsDb(): Promise<IDBDatabase> {
  if (!isIndexedDbSupported()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  if (sharedDbPromise) {
    return sharedDbPromise;
  }

  sharedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(COLLECTIONS_DB_NAME, COLLECTIONS_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of ALL_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'storageKey' });
            if (storeName === STORE_ENTITY_EVENTS) {
              store.createIndex('by_entity', ['projectScope', 'entityType', 'entityId'], {
                unique: false,
              });
              store.createIndex('by_idempotency', 'idempotencyKey', { unique: true });
            } else {
              store.createIndex('by_project', 'projectScope', { unique: false });
            }
          }
        }
      };

      request.onblocked = () => {
        console.warn('[CiscoAppCollectionsDB] Open request blocked by an older connection.');
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.onversionchange = () => {
          db.close();
          sharedDbPromise = null;
        };
        db.onclose = () => {
          sharedDbPromise = null;
        };
        resolve(db);
      };

      request.onerror = (event) => {
        sharedDbPromise = null;
        reject((event.target as IDBOpenDBRequest).error || new Error('IndexedDB open error'));
      };
    } catch (err) {
      sharedDbPromise = null;
      reject(err);
    }
  });

  return sharedDbPromise;
}

export async function closeCollectionsDb(): Promise<void> {
  if (!sharedDbPromise) return;
  try {
    const db = await sharedDbPromise;
    db.close();
  } catch {}
  sharedDbPromise = null;
}

/**
 * Computes a deterministic idempotency key for an entity event so duplicate submissions,
 * double-clicks, or retry loops never duplicate the same history entry.
 */
export function computeEventIdempotencyKey(params: {
  entityType: 'BO_TRACKING' | 'DEAL_REMINDER';
  entityId: string;
  actionOrStage: string;
  author: string;
  comment: string;
  createdAt?: string;
  explicitKey?: string;
}): string {
  if (params.explicitKey && params.explicitKey.trim()) {
    return params.explicitKey.trim();
  }
  // Bucket timestamp to the second (first 19 chars of ISO) so retries of the exact same transition/note match
  const tsBucket = String(params.createdAt || '').trim().slice(0, 19);
  const raw = [
    params.entityType,
    String(params.entityId || '').trim(),
    String(params.actionOrStage || '').trim(),
    String(params.author || '').trim().toLowerCase(),
    String(params.comment || '').trim(),
    tsBucket,
  ].join('|');

  let h1 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h1 ^= raw.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, '0');
  return `evt_${params.entityType.toLowerCase()}_${String(params.entityId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}_${hex}`;
}

/**
 * Synchronously reads all cached records for a collection in the current project scope.
 */
export function getCollectionRecordsSync<T>(
  collectionName: ManagedCollectionName,
  projectScope?: string
): T[] {
  const map = getCollectionScopeMap<T>(collectionName, projectScope);
  return Array.from(map.values());
}

/**
 * Synchronously upserts a single record into the in-memory collection mirror and schedules
 * per-record persistence to IndexedDB.
 */
export async function putCollectionRecord<T extends Record<string, any>>(
  collectionName: ManagedCollectionName,
  recordId: string,
  record: T,
  options?: { projectScope?: string; compactLocalStorageKey?: string }
): Promise<StorageWriteResult> {
  return putCollectionRecordsBatch(
    collectionName,
    [{ id: recordId, record }],
    options
  );
}

/**
 * Persists one or more records individually (by key) in a single IndexedDB transaction,
 * avoiding full-collection JSON serialization in localStorage when datasets grow large.
 */
export async function putCollectionRecordsBatch<T extends Record<string, any>>(
  collectionName: ManagedCollectionName,
  entries: Array<{ id: string; record: T }>,
  options?: {
    projectScope?: string;
    replaceAllInScope?: boolean;
    compactLocalStorageKey?: string;
  }
): Promise<StorageWriteResult> {
  const scope = options?.projectScope || getActiveProjectScopeKey();

  if (simulatedFailureMode === 'QUOTA_EXCEEDED') {
    lastStorageError = 'QuotaExceededError: Almacenamiento local lleno (cuota excedida)';
    return {
      success: false,
      persistedCount: 0,
      quotaExceeded: true,
      backend: 'memory_fallback',
      error: lastStorageError,
    };
  }
  if (simulatedFailureMode === 'TRANSACTION_ABORTED') {
    lastStorageError = 'AbortError: Transacción IndexedDB abortada antes de confirmar';
    return {
      success: false,
      persistedCount: 0,
      quotaExceeded: false,
      backend: 'memory_fallback',
      error: lastStorageError,
    };
  }

  const memMap = getCollectionScopeMap<T>(collectionName, scope);
  if (options?.replaceAllInScope) {
    memMap.clear();
  }
  for (const entry of entries) {
    if (!entry || !entry.id) continue;
    memMap.set(entry.id, entry.record);
  }

  let backend: 'indexeddb' | 'memory_fallback' = 'memory_fallback';
  if (isIndexedDbSupported()) {
    try {
      const db = await openCollectionsDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([collectionName], 'readwrite');
        const store = tx.objectStore(collectionName);
        for (const entry of entries) {
          if (!entry || !entry.id) continue;
          store.put({
            storageKey: makeScopedRecordKey(entry.id, scope),
            projectScope: scope,
            recordId: entry.id,
            updatedAt: new Date().toISOString(),
            payload: entry.record,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        tx.onerror = () => reject(tx.error || new Error('Transaction error'));
      });
      backend = 'indexeddb';
    } catch (err: any) {
      const msg = String(err?.message || err?.name || 'Error IndexedDB');
      const isQuota =
        msg.toLowerCase().includes('quota') || err?.name === 'QuotaExceededError';
      if (isQuota) {
        lastStorageError = `QuotaExceededError: ${msg}`;
        return {
          success: false,
          persistedCount: 0,
          quotaExceeded: true,
          backend: 'indexeddb',
          error: lastStorageError,
        };
      }
      // Fall back to memory + lightweight metadata if IndexedDB is unavailable in JSDOM/test env
      backend = 'memory_fallback';
    }
  }

  // Write lightweight metadata index or safe mirror to localStorage only if within safe size budget (< 1.5MB)
  if (options?.compactLocalStorageKey && typeof localStorage !== 'undefined') {
    try {
      const allRecords = Array.from(memMap.values());
      const serialized = JSON.stringify(allRecords);
      // Avoid QuotaExceededError on huge collections (> 2MB); store compact summary pointer if oversized
      if (serialized.length <= 2_000_000) {
        writeProjectScopedStorage(options.compactLocalStorageKey, serialized, scope);
      } else {
        // Store lightweight headers (without heavy line items array) in localStorage while full items live in IndexedDB
        const compactList = allRecords.map((rec: any) => {
          if (rec && Array.isArray(rec.items) && rec.items.length > 25) {
            return {
              ...rec,
              items: [],
              _itemsStoredInIndexedDb: true,
              itemsCount: rec.itemsCount || rec.items.length,
            };
          }
          return rec;
        });
        writeProjectScopedStorage(
          options.compactLocalStorageKey,
          JSON.stringify(compactList),
          scope
        );
      }
    } catch (storageErr: any) {
      const msg = String(storageErr?.message || storageErr?.name || '');
      if (
        msg.toLowerCase().includes('quota') ||
        storageErr?.name === 'QuotaExceededError'
      ) {
        lastStorageError = `QuotaExceededError en localStorage: ${msg}`;
        if (backend !== 'indexeddb') {
          return {
            success: false,
            persistedCount: 0,
            quotaExceeded: true,
            backend,
            error: lastStorageError,
          };
        }
      }
    }
  }

  lastStorageError = null;
  notifyCrossTabCollectionUpdate(collectionName, scope);
  return {
    success: true,
    persistedCount: entries.length,
    backend,
  };
}

/**
 * Deletes a single record by key from both the in-memory mirror and IndexedDB.
 */
export async function deleteCollectionRecord(
  collectionName: ManagedCollectionName,
  recordId: string,
  projectScope?: string
): Promise<boolean> {
  const scope = projectScope || getActiveProjectScopeKey();
  const memMap = getCollectionScopeMap(collectionName, scope);
  memMap.delete(recordId);

  if (isIndexedDbSupported()) {
    try {
      const db = await openCollectionsDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([collectionName], 'readwrite');
        const store = tx.objectStore(collectionName);
        store.delete(makeScopedRecordKey(recordId, scope));
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error('Delete transaction aborted'));
        tx.onerror = () => reject(tx.error || new Error('Delete transaction error'));
      });
    } catch {
      // Ignore if IndexedDB not openable in test env
    }
  }

  notifyCrossTabCollectionUpdate(collectionName, scope);
  return true;
}

/**
 * Hydrates the in-memory collection mirror from IndexedDB and/or migrates legacy localStorage keys idempotently.
 */
export async function hydrateAndMigrateCollection<T extends Record<string, any>>(
  collectionName: ManagedCollectionName,
  legacyStorageKeys: string[],
  extractRecordId: (record: T) => string,
  projectScope?: string
): Promise<{ records: T[]; migratedCount: number }> {
  const scope = projectScope || getActiveProjectScopeKey();
  const migrationFlagKey = `${scope}::${collectionName}`;
  const memMap = getCollectionScopeMap<T>(collectionName, scope);

  // 1. Load records from IndexedDB if supported
  if (isIndexedDbSupported()) {
    try {
      const db = await openCollectionsDb();
      const idbRecords = await new Promise<Array<{ recordId: string; payload: T }>>(
        (resolve, reject) => {
          const tx = db.transaction([collectionName], 'readonly');
          const store = tx.objectStore(collectionName);
          const req = store.getAll();
          req.onsuccess = () => {
            const all = Array.isArray(req.result) ? req.result : [];
            const filtered = all.filter((row: any) => row && row.projectScope === scope);
            resolve(filtered);
          };
          req.onerror = () => reject(req.error);
        }
      );
      for (const row of idbRecords) {
        if (row.recordId && row.payload) {
          memMap.set(row.recordId, row.payload);
        }
      }
    } catch {
      // Fallback to memory/localStorage
    }
  }

  // 2. Idempotent migration from legacy localStorage keys
  let migratedCount = 0;
  if (!migrationCompletedFlags.has(migrationFlagKey) && typeof localStorage !== 'undefined') {
    const batchToPersist: Array<{ id: string; record: T }> = [];
    for (const key of legacyStorageKeys) {
      try {
        const raw = readProjectScopedStorage(key, scope);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const recId = extractRecordId(item as T);
          if (!recId) continue;
          const existing = memMap.get(recId);
          // Prefer record that has full items array if compact placeholder was in localStorage
          if (
            !existing ||
            ((item as any).items?.length || 0) > ((existing as any).items?.length || 0)
          ) {
            memMap.set(recId, item as T);
            batchToPersist.push({ id: recId, record: item as T });
            migratedCount += 1;
          }
        }
      } catch {
        // Ignore malformed legacy entry
      }
    }

    if (batchToPersist.length > 0) {
      await putCollectionRecordsBatch(collectionName, batchToPersist, { projectScope: scope });
    }
    migrationCompletedFlags.add(migrationFlagKey);
  }

  return {
    records: Array.from(memMap.values()),
    migratedCount,
  };
}

// ============================================================================
// ITEM 12: IDEMPOTENT EVENT LOG FOR BO TRACKING & DEAL REMINDERS
// ============================================================================

/**
 * Appends an idempotent event to an entity's history and optionally updates the parent entity
 * in a single atomic transaction. Duplicate `idempotencyKey` or `id` values are deduplicated.
 */
export async function appendEntityEventAtomic<TEntity extends Record<string, any>>(params: {
  entityType: 'BO_TRACKING' | 'DEAL_REMINDER';
  entityId: string;
  actionOrStage: string;
  author: string;
  comment: string;
  createdAt?: string;
  eventId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  collectionName?: ManagedCollectionName;
  updatedEntity?: TEntity;
  projectScope?: string;
}): Promise<{
  success: boolean;
  event: EntityHistoryEvent;
  wasDuplicate: boolean;
  error?: string;
}> {
  const scope = params.projectScope || getActiveProjectScopeKey();
  const createdAt = params.createdAt || new Date().toISOString();
  const idempotencyKey = computeEventIdempotencyKey({
    entityType: params.entityType,
    entityId: params.entityId,
    actionOrStage: params.actionOrStage,
    author: params.author,
    comment: params.comment,
    createdAt,
    explicitKey: params.idempotencyKey || params.eventId,
  });

  const eventMap = getEventScopeMap(params.entityType, params.entityId, scope);
  const existing = eventMap.get(idempotencyKey);
  if (existing) {
    return {
      success: true,
      event: existing,
      wasDuplicate: true,
    };
  }

  // Also check if an event with the exact same eventId already exists
  if (params.eventId) {
    for (const evt of eventMap.values()) {
      if (evt.id === params.eventId) {
        return {
          success: true,
          event: evt,
          wasDuplicate: true,
        };
      }
    }
  }

  const eventRecord: EntityHistoryEvent = {
    id: params.eventId || idempotencyKey,
    idempotencyKey,
    projectId: scope,
    entityType: params.entityType,
    entityId: params.entityId,
    actionOrStage: params.actionOrStage,
    author: params.author || 'Usuario',
    comment: params.comment,
    createdAt,
    metadata: params.metadata,
  };

  if (simulatedFailureMode !== 'NONE') {
    return {
      success: false,
      event: eventRecord,
      wasDuplicate: false,
      error:
        simulatedFailureMode === 'QUOTA_EXCEEDED'
          ? 'QuotaExceededError: Almacenamiento sin espacio para registrar evento'
          : 'AbortError: Transacción abortada al guardar evento y estado',
    };
  }

  // Update in-memory state + event log together
  eventMap.set(idempotencyKey, eventRecord);
  if (params.collectionName && params.updatedEntity) {
    const colMap = getCollectionScopeMap<TEntity>(params.collectionName, scope);
    colMap.set(params.entityId, params.updatedEntity);
  }

  // Persist both entity state and event in a single IndexedDB transaction when available
  if (isIndexedDbSupported()) {
    try {
      const db = await openCollectionsDb();
      const storeNames =
        params.collectionName && params.updatedEntity
          ? [STORE_ENTITY_EVENTS, params.collectionName]
          : [STORE_ENTITY_EVENTS];

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeNames, 'readwrite');
        const evtStore = tx.objectStore(STORE_ENTITY_EVENTS);
        evtStore.put({
          storageKey: makeScopedRecordKey(idempotencyKey, scope),
          projectScope: scope,
          entityType: params.entityType,
          entityId: params.entityId,
          idempotencyKey,
          createdAt,
          payload: eventRecord,
        });

        if (params.collectionName && params.updatedEntity) {
          const entityStore = tx.objectStore(params.collectionName);
          entityStore.put({
            storageKey: makeScopedRecordKey(params.entityId, scope),
            projectScope: scope,
            recordId: params.entityId,
            updatedAt: createdAt,
            payload: params.updatedEntity,
          });
        }

        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error || new Error('Atomic event transaction aborted'));
        tx.onerror = () => reject(tx.error || new Error('Atomic event transaction error'));
      });
    } catch {
      // Fallback to in-memory event map in non-IDB test environments
    }
  }

  return {
    success: true,
    event: eventRecord,
    wasDuplicate: false,
  };
}

/**
 * Ingests legacy inline array notes/history into the idempotent event store without creating duplicates,
 * and returns the chronologically ordered, deduplicated list of events.
 */
export function mergeAndQueryEntityEvents(
  entityType: 'BO_TRACKING' | 'DEAL_REMINDER',
  entityId: string,
  legacyInlineItems: Array<{
    id?: string;
    date?: string;
    author?: string;
    stage?: string;
    action?: string;
    comment?: string;
  }> = [],
  options: EventQueryOptions & { projectScope?: string } = {}
): EntityHistoryEvent[] {
  const scope = options.projectScope || getActiveProjectScopeKey();
  const eventMap = getEventScopeMap(entityType, entityId, scope);

  // Build lookup sets of existing event IDs and content hashes to prevent re-ingesting events stored under explicit idempotencyKeys
  const existingIds = new Set<string>();
  const existingContentHashes = new Set<string>();
  for (const [k, evt] of eventMap.entries()) {
    existingIds.add(k);
    if (evt.id) existingIds.add(evt.id);
    if (evt.idempotencyKey) existingIds.add(evt.idempotencyKey);
    existingContentHashes.add(
      computeEventIdempotencyKey({
        entityType,
        entityId,
        actionOrStage: evt.actionOrStage,
        author: evt.author,
        comment: evt.comment,
        createdAt: evt.createdAt,
      })
    );
  }

  for (const item of legacyInlineItems) {
    if (!item || typeof item !== 'object') continue;
    const itemId = item.id ? String(item.id).trim() : '';
    const actionOrStage = String(item.stage || item.action || 'NOTE').trim();
    const author = String(item.author || 'Usuario').trim();
    const comment = String(item.comment || '').trim();
    const createdAt = String(item.date || '').trim() || new Date(0).toISOString();

    const contentHashKey = computeEventIdempotencyKey({
      entityType,
      entityId,
      actionOrStage,
      author,
      comment,
      createdAt,
    });

    if (
      (itemId && existingIds.has(itemId)) ||
      existingIds.has(contentHashKey) ||
      existingContentHashes.has(contentHashKey)
    ) {
      continue;
    }

    const effectiveKey = itemId || contentHashKey;
    eventMap.set(effectiveKey, {
      id: effectiveKey,
      idempotencyKey: effectiveKey,
      projectId: scope,
      entityType,
      entityId,
      actionOrStage,
      author,
      comment,
      createdAt,
    });
    existingIds.add(effectiveKey);
    existingContentHashes.add(contentHashKey);
  }

  const direction = options.direction || 'asc';
  let all = Array.from(eventMap.values()).sort((a, b) => {
    const cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    return direction === 'asc'
      ? a.idempotencyKey.localeCompare(b.idempotencyKey)
      : b.idempotencyKey.localeCompare(a.idempotencyKey);
  });

  if (options.afterCreatedAt) {
    all = all.filter((e) =>
      direction === 'asc'
        ? e.createdAt > options.afterCreatedAt!
        : e.createdAt < options.afterCreatedAt!
    );
  }

  if (options.limit && options.limit > 0) {
    all = all.slice(0, options.limit);
  }

  return all;
}

function notifyCrossTabCollectionUpdate(
  collectionName: ManagedCollectionName,
  projectScope: string
): void {
  const bc = getBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({
        type: 'COLLECTION_UPDATED',
        collectionName,
        projectScope,
        timestamp: Date.now(),
      });
    } catch {}
  }
}

/**
 * Clears in-memory collection & event state for a specific project or all projects (used in QA tests).
 */
export function clearCollectionMemoryState(projectScope?: string): void {
  if (!projectScope) {
    memoryCollections.clear();
    memoryEntityEvents.clear();
    migrationCompletedFlags.clear();
    lastStorageError = null;
    return;
  }
  const prefix = `${projectScope}::`;
  for (const key of Array.from(memoryCollections.keys())) {
    if (key.startsWith(prefix)) memoryCollections.delete(key);
  }
  for (const key of Array.from(memoryEntityEvents.keys())) {
    if (key.startsWith(prefix)) memoryEntityEvents.delete(key);
  }
  for (const key of Array.from(migrationCompletedFlags)) {
    if (key.startsWith(prefix)) migrationCompletedFlags.delete(key);
  }
}
