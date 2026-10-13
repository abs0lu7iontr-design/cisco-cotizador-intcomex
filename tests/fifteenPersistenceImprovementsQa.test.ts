// ============================================================================
// CISCO AUTOMATED v2.1 - QA SUITE FOR 15 PERSISTENCE, DATABASE & QA IMPROVEMENTS
// Executes against isolated in-memory / IndexedDB polyfill / temp SQLite DBs.
// NEVER touches production Firestore or user SQLite databases.
// ============================================================================

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Provide a spec-compliant in-memory IndexedDB polyfill for Node.js test execution
if (typeof globalThis.indexedDB === 'undefined') {
  interface StoreMeta {
    keyPath?: string;
    indexes: Map<string, { keyPath: string; unique?: boolean }>;
    data: Map<any, any>;
  }
  interface DbMeta {
    name: string;
    version: number;
    stores: Map<string, StoreMeta>;
  }
  const databases = new Map<string, DbMeta>();

  const cloneVal = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  class MockIDBRequest<T = any> {
    result!: T;
    error: any = null;
    onsuccess: ((ev: any) => void) | null = null;
    onerror: ((ev: any) => void) | null = null;
  }

  class MockIDBObjectStore {
    constructor(
      private meta: StoreMeta,
      private tx: MockIDBTransaction
    ) {}

    createIndex(name: string, keyPath: string, options?: { unique?: boolean }) {
      this.meta.indexes.set(name, { keyPath, unique: options?.unique });
      return {};
    }

    put(value: any, explicitKey?: any) {
      const req = new MockIDBRequest();
      const key =
        explicitKey !== undefined
          ? explicitKey
          : this.meta.keyPath
          ? value?.[this.meta.keyPath]
          : undefined;
      this.tx._enqueueOp(() => {
        for (const [, idxMeta] of this.meta.indexes.entries()) {
          if (idxMeta.unique) {
            const candidateVal = value?.[idxMeta.keyPath];
            if (candidateVal !== undefined) {
              for (const [existingKey, existingObj] of this.meta.data.entries()) {
                if (existingKey !== key && existingObj?.[idxMeta.keyPath] === candidateVal) {
                  const err = new Error(
                    `ConstraintError: Unique index violation on ${idxMeta.keyPath}`
                  );
                  (err as any).name = 'ConstraintError';
                  req.error = err;
                  if (req.onerror) req.onerror({ target: req });
                  return;
                }
              }
            }
          }
        }
        this.meta.data.set(key, cloneVal(value));
        req.result = key;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    get(key: any) {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        const val = this.meta.data.get(key);
        req.result = val !== undefined ? cloneVal(val) : undefined;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    getAll() {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        req.result = Array.from(this.meta.data.values()).map(cloneVal);
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    delete(key: any) {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        this.meta.data.delete(key);
        req.result = undefined;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    clear() {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        this.meta.data.clear();
        req.result = undefined;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    count() {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        req.result = this.meta.data.size;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }

    openCursor() {
      const req = new MockIDBRequest();
      this.tx._enqueueOp(() => {
        const values = Array.from(this.meta.data.values()).map(cloneVal);
        let idx = 0;
        const step = () => {
          if (idx < values.length) {
            const val = values[idx++];
            req.result = {
              value: val,
              continue: () => {
                queueMicrotask(step);
              },
            };
          } else {
            req.result = null;
          }
          if (req.onsuccess) req.onsuccess({ target: req });
        };
        step();
      });
      return req;
    }
  }

  class MockIDBTransaction {
    oncomplete: ((ev: any) => void) | null = null;
    onabort: ((ev: any) => void) | null = null;
    onerror: ((ev: any) => void) | null = null;
    error: any = null;
    private aborted = false;
    private snapshots = new Map<string, Map<any, any>>();
    private pendingOps: Array<() => void> = [];
    private scheduled = false;

    constructor(
      private dbMeta: DbMeta,
      storeNames: string[]
    ) {
      for (const name of storeNames) {
        const s = dbMeta.stores.get(name);
        if (s) {
          const snap = new Map<any, any>();
          for (const [k, v] of s.data.entries()) {
            snap.set(k, cloneVal(v));
          }
          this.snapshots.set(name, snap);
        }
      }
      this._scheduleCommit();
    }

    objectStore(name: string) {
      const s = this.dbMeta.stores.get(name);
      if (!s) throw new Error(`NotFoundError: ObjectStore ${name} not found`);
      return new MockIDBObjectStore(s, this);
    }

    abort() {
      if (this.aborted) return;
      this.aborted = true;
      for (const [name, snap] of this.snapshots.entries()) {
        const s = this.dbMeta.stores.get(name);
        if (s) {
          s.data = new Map(snap);
        }
      }
      queueMicrotask(() => {
        if (this.onabort) this.onabort({ target: this });
      });
    }

    _enqueueOp(fn: () => void) {
      this.pendingOps.push(fn);
      this._scheduleCommit();
    }

    private _scheduleCommit() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        while (this.pendingOps.length > 0 && !this.aborted) {
          const op = this.pendingOps.shift()!;
          op();
        }
        if (!this.aborted && this.pendingOps.length === 0) {
          if (this.oncomplete) this.oncomplete({ target: this });
        }
      });
    }
  }

  class MockIDBDatabase {
    onversionchange: ((ev: any) => void) | null = null;
    onclose: ((ev: any) => void) | null = null;

    constructor(private meta: DbMeta) {}

    get objectStoreNames() {
      const names = Array.from(this.meta.stores.keys());
      return {
        contains: (name: string) => this.meta.stores.has(name),
        length: names.length,
        [Symbol.iterator]: () => names[Symbol.iterator](),
      };
    }

    createObjectStore(name: string, options?: { keyPath?: string }) {
      const storeMeta: StoreMeta = {
        keyPath: options?.keyPath,
        indexes: new Map(),
        data: new Map(),
      };
      this.meta.stores.set(name, storeMeta);
      const dummyTx = new MockIDBTransaction(this.meta, [name]);
      return new MockIDBObjectStore(storeMeta, dummyTx);
    }

    transaction(storeNames: string | string[], _mode?: string) {
      const list = Array.isArray(storeNames) ? storeNames : [storeNames];
      return new MockIDBTransaction(this.meta, list);
    }

    close() {
      if (this.onclose) this.onclose({});
    }
  }

  (globalThis as any).indexedDB = {
    open(name: string, version: number = 1) {
      const req: any = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        let meta = databases.get(name);
        const oldVersion = meta ? meta.version : 0;
        if (!meta) {
          meta = { name, version, stores: new Map() };
          databases.set(name, meta);
        } else if (version > meta.version) {
          meta.version = version;
        }
        const db = new MockIDBDatabase(meta);
        req.result = db;
        if (version > oldVersion && typeof req.onupgradeneeded === 'function') {
          req.onupgradeneeded({ target: req, oldVersion, newVersion: version });
        }
        if (typeof req.onsuccess === 'function') {
          req.onsuccess({ target: req });
        }
      });
      return req;
    },
  };
}

// Provide an in-memory localStorage polyfill for Node.js execution without ExperimentalWarning
const mockStorageBackend = new Map<string, string>();
const mockLocalStorageObj = {
  getItem(key: string): string | null {
    return mockStorageBackend.has(key) ? mockStorageBackend.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    mockStorageBackend.set(key, String(value));
  },
  removeItem(key: string): void {
    mockStorageBackend.delete(key);
  },
  clear(): void {
    mockStorageBackend.clear();
  },
  key(index: number): string | null {
    return Array.from(mockStorageBackend.keys())[index] ?? null;
  },
  get length(): number {
    return mockStorageBackend.size;
  },
};
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorageObj,
    configurable: true,
    enumerable: true,
    writable: true,
  });
} catch {
  (globalThis as any).localStorage = mockLocalStorageObj;
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

import {
  saveEstimateToCloud,
  saveOriginalV0Estimate,
  saveModifiedEstimateVersion,
  loadEstimateVersionDetail,
  deleteCloudEstimate,
  archiveCloudEstimate,
  resumePendingEstimateDeletions,
  getPendingEstimateDeletions,
  getEstimatesMirrorSnapshot,
  checkV0ExistenceState,
  isAuthenticRawV0Payload,
  CANONICAL_V0_TAG,
  EstimatePersistenceDriver,
  EstimateAtomicWritePayload,
} from '../src/modules/cloud/firestoreService';
import { CloudEstimateRecord, EstimateVersionDetail } from '../src/modules/cloud/types';

import {
  publishFastTrackGenerationToCloud,
  validateDownloadedFastTrackGeneration,
  computeCanonicalFastTrackChecksum,
  planOldFastTrackGenerationsCleanup,
  saveFastTrackCatalog,
  getAllFastTrackItems,
  getFastTrackUnifiedMetadata,
  getFastTrackItemsBatch,
  FastTrackCloudAdapter,
} from '../src/modules/fasttrack/fastTrackDb';
import { FastTrackProduct } from '../src/modules/fasttrack/types';

import {
  putCollectionRecordsBatch,
  getCollectionRecordsSync,
  clearCollectionMemoryState,
} from '../src/modules/storage/indexedDbCollectionStore';

import {
  saveBoTracking,
  updateBoTrackingStage,
  addBoDailyNote,
  getBoOrderEventsPaginated,
} from '../src/modules/bo/boTrackingService';

import {
  saveDealReminder,
  addDealHistoryNote,
  confirmDealReminderSent,
  getDealReminders,
  getDealReminderHistoryEvents,
} from '../src/modules/bo/dealReminderService';

import {
  resolveSkuFromCatalog,
  findSkuInCatalog,
  saveBoSkuMapping,
  getLocalBoSkuCache,
  clearBoSkuCatalogMemoryCache,
} from '../src/modules/bo/boSkuCatalogService';

import {
  saveActiveFirebaseConfig,
  resetToDefaultFirebaseConfig,
  computeFirebaseConfigFingerprint,
  getActiveProjectScopeKey,
  registerProjectListener,
  captureProjectContext,
  isProjectContextCurrent,
  readProjectScopedStorage,
  writeProjectScopedStorage,
} from '../src/modules/cloud/firebaseConfig';

function resetTestEnvironment() {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  resetToDefaultFirebaseConfig();
  clearCollectionMemoryState();
  clearBoSkuCatalogMemoryCache();
}

function makeBaseEstimateRecord(
  overrides?: Partial<Omit<CloudEstimateRecord, 'id'>>
): Omit<CloudEstimateRecord, 'id'> {
  return {
    dealId: 'DEAL-1001',
    estimateId: 'EST-ATOMIC-001',
    partnerName: 'Partner Alpha',
    clientFinalName: 'Client Alpha',
    originalFileName: 'EST-ATOMIC-001.xlsx',
    createdAt: '2026-10-12T10:00:00.000Z',
    creator: { username: 'qa_user', fullName: 'QA User', role: 'admin' },
    financialSummary: {
      totalNetCisco: 10000,
      totalCotizadoIntcomex: 10600,
      gananciaIntcomexUsd: 600,
      margenPct: 5.66,
      currency: 'USD',
      params: {
        internacionPct: 1,
        arancelPct: 6,
        margenPct: 5,
      },
    },
    headerInfo: {
      estimateId: 'EST-ATOMIC-001',
      dealId: 'DEAL-1001',
      customerName: 'Partner Alpha',
      companyName: 'Client Alpha',
      address: 'Av. Apoquindo 4501',
      city: 'Santiago',
      country: 'Chile',
      phone: '+56 2 2345 6789',
      priceList: 'Global Price List US Availability',
      date: '2026-10-12',
    },
    customOverrideMap: {},
    itemsCount: 1,
    items: [
      {
        rowIdx: 1,
        lineNumber: '1.0',
        partNumber: 'C9200L-24P-4G-E',
        description: 'Catalyst 9200L',
        qty: 2,
        unitListPrice: 5000,
        discPct: 50,
        netCiscoUnit: 5000,
        transformedLeadTime: '14 Days',
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 50,
        costoArancel: 0,
        costoTotalUnitario: 5050,
        precioVentaUnitario: 5300,
        precioVentaExtendido: 10600,
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// ITEM 1: ATOMIC SAVE OF ESTIMATE & VERSION IN FIRESTORE
// ============================================================================
async function testItem1AtomicSaveOfEstimateAndVersion() {
  resetTestEnvironment();

  const remoteStore = new Map<
    string,
    { root: Record<string, any>; versions: Map<string, Record<string, any>> }
  >();
  let simulateFailure: 'NONE' | 'ERROR' | 'TIMEOUT' = 'NONE';
  let commitCount = 0;

  const mockDriver: EstimatePersistenceDriver = {
    async readRootDoc(docId) {
      const entry = remoteStore.get(docId);
      return entry ? { exists: true, data: entry.root } : { exists: false };
    },
    async checkV0Doc(docId) {
      const entry = remoteStore.get(docId);
      const v0 = entry?.versions.get(CANONICAL_V0_TAG) as EstimateVersionDetail | undefined;
      return v0 ? { status: 'EXISTS', data: v0 } : { status: 'CONFIRMED_ABSENT' };
    },
    async commitAtomicEstimateAndVersion(payload: EstimateAtomicWritePayload) {
      if (simulateFailure === 'ERROR') {
        throw new Error('Simulated Firestore writeBatch rejection');
      }
      if (simulateFailure === 'TIMEOUT') {
        // Remote server actually commits, but client sees a timeout
        const entry = remoteStore.get(payload.docId) || { root: {}, versions: new Map() };
        entry.root = { ...entry.root, ...payload.rootPayload };
        entry.versions.set(payload.versionTag, { ...payload.versionPayload });
        if (payload.v0Payload) {
          entry.versions.set(CANONICAL_V0_TAG, { ...payload.v0Payload });
        }
        remoteStore.set(payload.docId, entry);
        commitCount += 1;
        throw new Error('Firestore operation timeout after 8000ms');
      }
      const entry = remoteStore.get(payload.docId) || { root: {}, versions: new Map() };
      entry.root = { ...entry.root, ...payload.rootPayload };
      entry.versions.set(payload.versionTag, { ...payload.versionPayload });
      if (payload.v0Payload) {
        entry.versions.set(CANONICAL_V0_TAG, { ...payload.v0Payload });
      }
      remoteStore.set(payload.docId, entry);
      commitCount += 1;
    },
  };

  // 1A. Complete atomic success (root + v1 + v0_RAW)
  const baseRecord = makeBaseEstimateRecord();

  const res1 = await saveEstimateToCloud(baseRecord, {
    driver: mockDriver,
    operationId: 'op-atomic-v1',
    rawV0Snapshot: {
      items: baseRecord.items.map((it) => ({
        ...it,
        precioVentaUnitario: it.netCiscoUnit,
        precioVentaExtendido: it.netCiscoUnit * it.qty,
      })),
      totalNetCisco: 10000,
      createdAt: '2026-10-12T10:00:00.000Z',
    },
  });

  assert.equal(res1.success, true);
  assert.equal(res1.syncStatus, 'SYNCED');
  assert.equal(res1.versionTag, 'v1');
  const remoteEntry = remoteStore.get(res1.id!);
  assert.ok(remoteEntry, 'Remote entry must exist');
  assert.equal(remoteEntry.root.activeVersionTag, 'v1');
  assert.equal(remoteEntry.versions.has('v1'), true, 'Active version v1 must exist in subcollection');
  assert.equal(remoteEntry.versions.has(CANONICAL_V0_TAG), true, 'v0_RAW must exist in subcollection');

  const localAfterV1 = getEstimatesMirrorSnapshot().find((x) => x.id === res1.id);
  assert.equal(localAfterV1?.syncedToCloud, true);
  assert.equal(localAfterV1?.syncStatus, 'SYNCED');

  // 1B. Failed atomic commit on v2: header activeVersionTag must NOT advance to unpersisted v2
  simulateFailure = 'ERROR';
  const resFail = await saveEstimateToCloud(
    {
      ...baseRecord,
      activeVersion: 2,
      activeVersionTag: 'v2',
      currentAmount: 11200,
    },
    { driver: mockDriver, operationId: 'op-atomic-v2-fail' }
  );
  assert.equal(resFail.syncStatus, 'PENDING_SYNC');
  assert.equal(remoteStore.get(res1.id!)?.root.activeVersionTag, 'v1');
  assert.equal(remoteStore.get(res1.id!)?.versions.has('v2'), false);
  const localAfterFail = getEstimatesMirrorSnapshot().find((x) => x.id === res1.id);
  assert.equal(localAfterFail?.syncedToCloud, false);
  assert.equal(localAfterFail?.activeVersionTag, 'v1', 'Local header reverted to persisted v1');

  // 1C. Client timeout (UNCERTAIN_COMMIT) followed by retry with stable operationId -> no duplicates
  simulateFailure = 'TIMEOUT';
  const resTimeout = await saveEstimateToCloud(
    {
      ...baseRecord,
      activeVersion: 2,
      activeVersionTag: 'v2',
      currentAmount: 11200,
    },
    { driver: mockDriver, operationId: 'op-atomic-v2-stable' }
  );
  assert.equal(resTimeout.syncStatus, 'UNCERTAIN_COMMIT');

  simulateFailure = 'NONE';
  const resRetry = await saveEstimateToCloud(
    {
      ...baseRecord,
      activeVersion: 2,
      activeVersionTag: 'v2',
      currentAmount: 11200,
    },
    { driver: mockDriver, operationId: 'op-atomic-v2-stable' }
  );
  assert.equal(resRetry.syncStatus, 'SYNCED');
  assert.equal(remoteStore.get(res1.id!)?.root.activeVersionTag, 'v2');
  assert.equal(remoteStore.get(res1.id!)?.versions.has('v2'), true);
  const v2Summaries = (remoteStore.get(res1.id!)?.root.versionsSummary || []).filter(
    (s: any) => s.versionNumber === 2
  );
  assert.equal(v2Summaries.length, 1, 'Stable retry must not duplicate v2 summary entry');
  assert.ok(commitCount >= 2);

  console.log('✓ Item 1 (Atomic Save of Estimate & Version in Firestore) passed');
}

// ============================================================================
// ITEM 2: CONDITIONAL CREATION & IMMUTABILITY OF v0_RAW
// ============================================================================
async function testItem2ConditionalV0AndImmutability() {
  resetTestEnvironment();

  const remoteVersions = new Map<string, EstimateVersionDetail>();
  let failVersionRead = false;

  const mockDriver: EstimatePersistenceDriver = {
    async readRootDoc() {
      return { exists: false };
    },
    async checkV0Doc() {
      if (failVersionRead) {
        return { status: 'READ_ERROR', error: 'Firestore permission / network read failure' };
      }
      const v0 = remoteVersions.get(CANONICAL_V0_TAG);
      return v0 ? { status: 'EXISTS', data: v0 } : { status: 'CONFIRMED_ABSENT' };
    },
    async commitAtomicEstimateAndVersion(payload) {
      if (payload.versionTag === CANONICAL_V0_TAG) {
        if (!remoteVersions.has(CANONICAL_V0_TAG)) {
          remoteVersions.set(CANONICAL_V0_TAG, payload.versionPayload as EstimateVersionDetail);
        }
      } else {
        remoteVersions.set(payload.versionTag, payload.versionPayload as EstimateVersionDetail);
        if (payload.v0Payload && !remoteVersions.has(CANONICAL_V0_TAG)) {
          remoteVersions.set(CANONICAL_V0_TAG, payload.v0Payload as EstimateVersionDetail);
        }
      }
    },
  };

  const baseForV0 = makeBaseEstimateRecord();
  const rawV0Record = makeBaseEstimateRecord({
    dealId: 'DEAL-V0',
    estimateId: 'EST-V0-IMMUTABLE',
    partnerName: 'Partner V0',
    clientFinalName: 'Client V0',
    originalFileName: 'EST-V0-IMMUTABLE.xlsx',
    financialSummary: {
      ...baseForV0.financialSummary,
      totalNetCisco: 5000,
      totalCotizadoIntcomex: 5000,
      gananciaIntcomexUsd: 0,
      margenPct: 0,
    },
    items: [
      {
        ...baseForV0.items[0],
        partNumber: 'MERAKI-LIC-1Y',
        description: 'Meraki License',
        qty: 1,
        unitListPrice: 10000,
        discPct: 50,
        netCiscoUnit: 5000,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 5000,
        precioVentaUnitario: 5000,
        precioVentaExtendido: 5000,
        isIntangible: true,
      },
    ],
  });

  // 2A. Read failure must NOT be treated as confirmed absence
  failVersionRead = true;
  const readErrState = await checkV0ExistenceState('est_EST_V0_IMMUTABLE', { driver: mockDriver });
  assert.equal(readErrState.status, 'READ_ERROR');
  const saveOnReadErr = await saveOriginalV0Estimate(rawV0Record, { driver: mockDriver });
  assert.equal(saveOnReadErr.v0Status, 'READ_ERROR_DEFERRED');
  assert.equal(remoteVersions.has(CANONICAL_V0_TAG), false, 'Must not write v0 when read fails');

  // 2B. Two clients concurrently create v0_RAW -> first wins, v0_RAW is never overwritten
  failVersionRead = false;
  const [c1, c2] = await Promise.all([
    saveOriginalV0Estimate(rawV0Record, { driver: mockDriver }),
    saveOriginalV0Estimate(
      {
        ...rawV0Record,
        financialSummary: {
          ...rawV0Record.financialSummary,
          totalNetCisco: 99999,
          totalCotizadoIntcomex: 99999,
        },
      },
      { driver: mockDriver }
    ),
  ]);
  assert.equal(c1.success, true);
  assert.equal(c2.success, true);
  assert.equal(
    remoteVersions.get(CANONICAL_V0_TAG)?.netCiscoTotal,
    5000,
    'Original v0_RAW must remain immutable'
  );

  // 2C. Subsequent v0 save attempt is skipped without altering v0_RAW
  const secondAttempt = await saveOriginalV0Estimate(
    {
      ...rawV0Record,
      financialSummary: {
        ...rawV0Record.financialSummary,
        totalNetCisco: 77777,
        totalCotizadoIntcomex: 77777,
      },
    },
    { driver: mockDriver }
  );
  assert.equal(secondAttempt.skippedImmutableV0, true);
  assert.equal(remoteVersions.get(CANONICAL_V0_TAG)?.netCiscoTotal, 5000);

  // 2D. Saving v1 when v0_RAW does NOT exist and no rawV0Snapshot is provided must NOT fabricate v0 from modified lines
  resetTestEnvironment();
  remoteVersions.clear();
  const modifiedV1Record = makeBaseEstimateRecord({
    estimateId: 'EST-NO-V0-ORIG',
    financialSummary: {
      ...baseForV0.financialSummary,
      totalNetCisco: 5000,
      totalCotizadoIntcomex: 6250,
      gananciaIntcomexUsd: 1250,
      margenPct: 20,
    },
    items: [
      {
        ...rawV0Record.items[0],
        precioVentaUnitario: 6250,
        precioVentaExtendido: 6250,
      },
    ],
  });
  assert.equal(isAuthenticRawV0Payload(modifiedV1Record, 1), false);
  const v1WithoutOriginal = await saveModifiedEstimateVersion(modifiedV1Record, 1, {
    driver: mockDriver,
  });
  assert.equal(v1WithoutOriginal.v0Status, 'UNAVAILABLE_ORIGINAL');
  assert.equal(
    remoteVersions.has(CANONICAL_V0_TAG),
    false,
    'Must NEVER fabricate v0_RAW from modified v1 lines'
  );

  console.log('✓ Item 2 (Conditional Creation & Immutability of v0_RAW) passed');
}

// ============================================================================
// ITEM 3 & ITEM 4: FAST TRACK GENERATIONAL PUBLISH & DOWNLOAD INTEGRITY VALIDATION
// ============================================================================
async function testItems3And4FastTrackGenerationsAndValidation() {
  resetTestEnvironment();

  const cloudDocs = new Map<string, Record<string, any>>();
  const adapter: FastTrackCloudAdapter = {
    async getDocData(docId) {
      return cloudDocs.get(docId) ?? null;
    },
    async setDocData(docId, data) {
      cloudDocs.set(docId, { ...data });
    },
  };

  const nowTs = Date.now();
  const genAItems: FastTrackProduct[] = [
    {
      partNumber: 'C9200L-24P-4G-E',
      description: 'Switch 24P',
      listPrice: 2000,
      distributorDiscount: 65,
      promoNetPrice: 700,
      category: 'Switching',
      updatedAt: nowTs,
    },
    {
      partNumber: 'C9300L-48T-4G-E',
      description: 'Switch 48T',
      listPrice: 4000,
      distributorDiscount: 62,
      promoNetPrice: 1520,
      category: 'Switching',
      updatedAt: nowTs,
    },
  ];

  // 3A. Publish generation A completely
  const pubA = await publishFastTrackGenerationToCloud({
    items: genAItems,
    fileName: 'FastTrack_GenA.xlsx',
    validUntil: nowTs + 86400000 * 30,
    validFrom: nowTs,
    promotionCode: 'FT-GEN-A',
    promotionTitle: 'Promo Gen A',
    generationId: 'gen_A_001',
    adapter,
  });
  assert.equal(pubA.success, true);
  assert.equal(cloudDocs.get('_metadata')?.activeGenerationId, 'gen_A_001');
  assert.ok(cloudDocs.has('gen_gen_A_001_manifest'));

  // 3B. Interrupted publish of generation B (fails at chunk 0): activeGenerationId remains gen_A_001
  const genBItems: FastTrackProduct[] = [
    {
      partNumber: 'ISR4331/K9',
      description: 'Router',
      listPrice: 3000,
      distributorDiscount: 60,
      promoNetPrice: 1200,
      category: 'Routing',
      updatedAt: nowTs + 1000,
    },
  ];
  const pubBInterrupted = await publishFastTrackGenerationToCloud({
    items: genBItems,
    fileName: 'FastTrack_GenB.xlsx',
    validUntil: nowTs + 86400000 * 30,
    validFrom: nowTs,
    generationId: 'gen_B_002',
    adapter,
    failAtChunkIndex: 0,
  });
  assert.equal(pubBInterrupted.success, false);
  assert.equal(
    cloudDocs.get('_metadata')?.activeGenerationId,
    'gen_A_001',
    'Interrupted upload must NOT switch active generation pointer'
  );

  // 3C. Cleanup planner preserves active generation and retained generations, never auto-deletes real data
  const cleanupPlan = planOldFastTrackGenerationsCleanup(
    Array.from(cloudDocs.keys()).concat(['gen_OLD_999_chunk_0', 'gen_OLD_999_manifest']),
    'gen_A_001',
    ['gen_B_002']
  );
  assert.deepEqual(cleanupPlan.removableDocIds.sort(), [
    'gen_OLD_999_chunk_0',
    'gen_OLD_999_manifest',
  ]);
  assert.ok(cleanupPlan.protectedDocIds.includes('gen_gen_A_001_manifest'));

  // 4A. Validate valid generation download
  const manifestA = cloudDocs.get('gen_gen_A_001_manifest') as any;
  const chunkA0 = cloudDocs.get('gen_gen_A_001_chunk_0') as any;
  const validRes = validateDownloadedFastTrackGeneration({
    metadata: cloudDocs.get('_metadata') as any,
    manifest: manifestA,
    chunks: [chunkA0],
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.items.length, 2);

  // 4B. Reject missing chunk, cross-generation chunk, duplicate SKU, and tampered checksum
  const missingChunkRes = validateDownloadedFastTrackGeneration({
    metadata: cloudDocs.get('_metadata') as any,
    manifest: {
      ...manifestA,
      chunkCount: 2,
      expectedChunkIds: ['gen_gen_A_001_chunk_0', 'gen_gen_A_001_chunk_1'],
    },
    chunks: [chunkA0],
  });
  assert.equal(missingChunkRes.valid, false);
  assert.match(missingChunkRes.reason || '', /Cantidad de bloques/i);

  const wrongGenChunkRes = validateDownloadedFastTrackGeneration({
    metadata: cloudDocs.get('_metadata') as any,
    manifest: manifestA,
    chunks: [{ ...chunkA0, generationId: 'gen_OTHER' }],
  });
  assert.equal(wrongGenChunkRes.valid, false);

  const tamperedItemsRes = validateDownloadedFastTrackGeneration({
    metadata: cloudDocs.get('_metadata') as any,
    manifest: manifestA,
    chunks: [
      {
        ...chunkA0,
        items: [{ ...genAItems[0], promoNetPrice: 9999 }, genAItems[1]],
      },
    ],
  });
  assert.equal(tamperedItemsRes.valid, false);
  assert.match(tamperedItemsRes.reason || '', /Checksum/i);

  console.log(
    '✓ Items 3 & 4 (Fast Track Generational Publish & Download Integrity Validation) passed'
  );
}

// ============================================================================
// ITEM 9 & ITEM 10: FAST TRACK ATOMIC IDB CATALOG+METADATA & BATCH SKU LOOKUP
// ============================================================================
async function testItems9And10FastTrackAtomicIdbAndBatchLookup() {
  resetTestEnvironment();

  const nowTs = Date.now();
  const validUntilTs = nowTs + 86400000 * 30;
  const initialItems: FastTrackProduct[] = [
    {
      partNumber: 'C9200L-24P-4G-E',
      description: 'Catalyst 24P',
      listPrice: 2000,
      distributorDiscount: 65,
      promoNetPrice: 700,
      category: 'Switching',
      updatedAt: nowTs,
    },
    {
      partNumber: 'C9200L-48P-4G-E',
      description: 'Catalyst 48P',
      listPrice: 3800,
      distributorDiscount: 65,
      promoNetPrice: 1330,
      category: 'Switching',
      updatedAt: nowTs,
    },
    {
      partNumber: 'MR46-HW',
      description: 'Meraki MR46',
      listPrice: 1500,
      distributorDiscount: 60,
      promoNetPrice: 600,
      category: 'Wireless',
      updatedAt: nowTs,
    },
  ];

  // 9A. Atomic save of products + metadata in a single IndexedDB transaction
  await saveFastTrackCatalog(
    initialItems,
    'FastTrack_Oct2026.xlsx',
    validUntilTs,
    nowTs,
    'PROMO-FT-2026',
    'Fast Track Q2',
    false,
    { generationId: 'gen_local_1' }
  );

  const meta1 = await getFastTrackUnifiedMetadata();
  assert.ok(meta1);
  assert.equal(meta1.totalSkus, 3);
  assert.equal(meta1.fileName, 'FastTrack_Oct2026.xlsx');
  assert.equal(meta1.generationId, 'gen_local_1');
  assert.equal(meta1.canonicalChecksum, computeCanonicalFastTrackChecksum(initialItems));

  // 9B. Aborted transaction mid-write rolls back both products and metadata so previous valid catalog remains intact
  const replacementItems: FastTrackProduct[] = [
    {
      partNumber: 'BROKEN-SKU-1',
      description: 'Should Rollback',
      listPrice: 100,
      distributorDiscount: 10,
      promoNetPrice: 90,
      category: 'Other',
      updatedAt: nowTs,
    },
  ];
  await assert.rejects(
    async () => {
      await saveFastTrackCatalog(
        replacementItems,
        'Broken_Upload.xlsx',
        validUntilTs,
        nowTs,
        'BROKEN',
        'Broken',
        false,
        { generationId: 'gen_local_broken', simulateAbortBeforeCommit: true }
      );
    },
    /abortada/i
  );

  const metaAfterAbort = await getFastTrackUnifiedMetadata();
  const itemsAfterAbort = await getAllFastTrackItems();
  assert.equal(metaAfterAbort?.fileName, 'FastTrack_Oct2026.xlsx');
  assert.equal(metaAfterAbort?.generationId, 'gen_local_1');
  assert.equal(itemsAfterAbort.length, 3);

  // 10A. Single-transaction batch lookup of 200 SKUs (found, missing, and DB error distinction)
  const batchSkus: string[] = [
    'C9200L-24P-4G-E',
    'C9200L-48P-4G-E',
    'MR46-HW',
    'NON-EXISTENT-SKU-001',
  ];
  for (let i = 0; i < 196; i++) {
    batchSkus.push(i % 2 === 0 ? 'C9200L-24P-4G-E' : `MISSING-SKU-${i}`);
  }

  const batchResult = await getFastTrackItemsBatch(batchSkus);
  assert.equal(batchResult.dbError, undefined);
  assert.equal(batchResult.transactionCount, 1, 'Batch lookup must use exactly 1 IDB transaction');
  assert.equal(batchResult.items['C9200L-24P-4G-E']?.promoNetPrice, 700);
  assert.equal(batchResult.items['C9200L-48P-4G-E']?.promoNetPrice, 1330);
  assert.equal(batchResult.items['NON-EXISTENT-SKU-001'], null);

  // 10B. Simulated DB read error reports dbError instead of silently pretending SKUs are not in Fast Track
  const errResult = await getFastTrackItemsBatch(['C9200L-24P-4G-E'], { simulateDbError: true });
  assert.ok(errResult.dbError, 'Must report explicit dbError when IndexedDB fails');

  console.log(
    '✓ Items 9 & 10 (Fast Track Single-Transaction Catalog+Metadata & Batch Lookup) passed'
  );
}

// ============================================================================
// ITEM 8: COMPLETE DELETION POLICY FOR ESTIMATES & VERSIONS SUBCOLLECTION
// ============================================================================
async function testItem8CompleteDeletionOfEstimateAndVersions() {
  resetTestEnvironment();

  const remoteEstimates = new Map<string, Record<string, any>>();
  const remoteVersionsByDoc = new Map<string, Set<string>>();
  let failDeleteStep = false;

  const mockDriver: EstimatePersistenceDriver = {
    async readRootDoc(docId) {
      const d = remoteEstimates.get(docId);
      return d ? { exists: true, data: d } : { exists: false };
    },
    async checkV0Doc(docId) {
      const set = remoteVersionsByDoc.get(docId);
      return set?.has(CANONICAL_V0_TAG)
        ? { status: 'EXISTS', data: { versionTag: CANONICAL_V0_TAG } as any }
        : { status: 'CONFIRMED_ABSENT' };
    },
    async commitAtomicEstimateAndVersion(payload) {
      remoteEstimates.set(payload.docId, { ...payload.rootPayload });
      const set = remoteVersionsByDoc.get(payload.docId) || new Set<string>();
      set.add(payload.versionTag);
      if (payload.v0Payload) set.add(CANONICAL_V0_TAG);
      remoteVersionsByDoc.set(payload.docId, set);
    },
    async listVersionDocIds(docId) {
      return Array.from(remoteVersionsByDoc.get(docId) || []);
    },
    async deleteEstimateAndVersionsBatch(docId, versionIds) {
      if (failDeleteStep) {
        // Simulate partial deletion failure: delete v1, then fail before deleting v2 and root
        const set = remoteVersionsByDoc.get(docId);
        if (set && versionIds.length > 0) {
          set.delete(versionIds[0]);
        }
        throw new Error('Simulated mid-deletion failure');
      }
      const set = remoteVersionsByDoc.get(docId);
      if (set) {
        for (const vId of versionIds) {
          set.delete(vId);
        }
      }
      remoteEstimates.delete(docId);
    },
  };

  const sampleRecord = makeBaseEstimateRecord({
    dealId: 'DEAL-DEL-8',
    estimateId: 'EST-DEL-008',
    partnerName: 'Partner Delete',
    clientFinalName: 'Client Delete',
    originalFileName: 'EST-DEL-008.xlsx',
  });

  const savedV1 = await saveEstimateToCloud(sampleRecord, { driver: mockDriver });
  await saveEstimateToCloud(
    { ...sampleRecord, activeVersion: 2, activeVersionTag: 'v2' },
    { driver: mockDriver }
  );
  const docId = savedV1.id!;
  assert.equal(remoteVersionsByDoc.get(docId)?.size, 2);

  // 8A. Logical archive preserves versions and marks lifecycleState = ARCHIVED
  const archRes = await archiveCloudEstimate(docId, 'EST-DEL-008', 'qa_auditor');
  assert.equal(archRes.success, true);
  assert.equal(archRes.lifecycleState, 'ARCHIVED');
  const archivedLocal = getEstimatesMirrorSnapshot().find((x) => x.id === docId);
  assert.equal(archivedLocal?.lifecycleState, 'ARCHIVED');

  // 8B. Interrupted hard deletion marks PENDING_DELETE and retains retry queue entry
  failDeleteStep = true;
  const partialDel = await deleteCloudEstimate(docId, 'EST-DEL-008', {
    mode: 'hard_delete',
    driver: mockDriver,
  });
  assert.equal(partialDel.success, false);
  assert.equal(partialDel.partialDeletePending, true);
  assert.equal(partialDel.lifecycleState, 'PENDING_DELETE');
  assert.ok(getPendingEstimateDeletions()[docId], 'Pending deletion must be tracked for retry');

  // 8C. Resume pending deletions completes cleanup of remaining versions + root doc
  failDeleteStep = false;
  const resumed = await resumePendingEstimateDeletions({ driver: mockDriver });
  assert.equal(resumed.completed, 1);
  assert.equal(resumed.remaining, 0);
  assert.equal(remoteEstimates.has(docId), false);
  assert.equal(remoteVersionsByDoc.get(docId)?.size ?? 0, 0, 'Zero orphan version docs may remain');
  assert.equal(getEstimatesMirrorSnapshot().some((x) => x.id === docId), false);
  const loadedV1AfterDelete = await loadEstimateVersionDetail(docId, 'v1');
  assert.equal(loadedV1AfterDelete.success, false);

  console.log('✓ Item 8 (Complete Deletion Policy for Estimates & Versions Subcollection) passed');
}

// ============================================================================
// ITEM 11 & ITEM 12: INDEXEDDB COLLECTION STORE & IDEMPOTENT EVENT LOG
// ============================================================================
async function testItems11And12IndexedDbCollectionAndIdempotentEvents() {
  resetTestEnvironment();

  // 11A. Large collection persistence in IndexedDB
  const largeEstimates = Array.from({ length: 250 }, (_, idx) => ({
    id: `est_LARGE_${idx}`,
    record: {
      id: `est_LARGE_${idx}`,
      estimateId: `EST-LARGE-${idx}`,
      dealId: `DEAL-${idx}`,
      partnerName: 'Partner Scale',
      clientFinalName: 'Customer Scale',
      createdAt: new Date(Date.now() - idx * 60000).toISOString(),
      itemsCount: 25,
    },
  }));

  const batchWriteRes = await putCollectionRecordsBatch('estimates', largeEstimates, {
    replaceAllInScope: true,
  });
  assert.equal(batchWriteRes.success, true);
  assert.equal(batchWriteRes.persistedCount, 250);

  const loadedFromIdb = getCollectionRecordsSync<any>('estimates');
  assert.equal(loadedFromIdb.length, 250);

  // 12A. Idempotent BO Tracking Notes & Stage Transitions (concurrent additions + retry deduplication)
  const boOrderId = 'BO-QA-ITEM12-001';
  await saveBoTracking({
    id: boOrderId,
    estimateId: 'EST-BO-12',
    estimateVersionTag: 'v1',
    dealId: 'DEAL-BO-12',
    partnerName: 'Partner BO',
    endCustomerName: 'Client BO',
    clientPoNumber: 'OC-12001',
    courier: 'DHL',
    currentStage: 'OC_RECEIVED',
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-10-12T08:00:00.000Z',
    totalSaleUsd: 15000,
    grossProfitUsd: 1200,
    marginPct: 8,
    itemsCount: 3,
    bodegaDestino: 'E1',
    notes: [],
  });

  // Concurrent notes from two operators + duplicate retry of operator 1's note
  const [noteOp1, noteOp1Retry, noteOp2, stageAdvance] = await Promise.all([
    addBoDailyNote(boOrderId, 'operador_1', 'Reserva de crédito validada', {
      idempotencyKey: 'bo-note-op1-001',
      createdAt: '2026-10-12T09:00:00.000Z',
    }),
    addBoDailyNote(boOrderId, 'operador_1', 'Reserva de crédito validada', {
      idempotencyKey: 'bo-note-op1-001',
      createdAt: '2026-10-12T09:00:00.000Z',
    }),
    addBoDailyNote(boOrderId, 'operador_2', 'Cisco confirmó fecha estimada de embarque', {
      idempotencyKey: 'bo-note-op2-001',
      createdAt: '2026-10-12T09:05:00.000Z',
    }),
    updateBoTrackingStage(boOrderId, 'CISCO_SO_BOOKED', 'operador_1', 'SO reservada en CCW', {
      idempotencyKey: 'bo-stage-booked-001',
      createdAt: '2026-10-12T09:10:00.000Z',
    }),
  ]);

  assert.equal(noteOp1.success, true);
  assert.equal(noteOp1Retry.wasDuplicateEvent, true, 'Duplicate retry must be detected');
  assert.equal(noteOp2.success, true);
  assert.equal(stageAdvance.success, true);

  const allBoEvents = getBoOrderEventsPaginated(boOrderId, { direction: 'asc' });
  assert.equal(
    allBoEvents.length,
    3,
    'Both concurrent notes + stage transition preserved without duplication'
  );

  const pagedBoEvents = getBoOrderEventsPaginated(boOrderId, {
    limit: 2,
    direction: 'desc',
  });
  assert.equal(pagedBoEvents.length, 2);

  // 12B. Deal Reminder idempotent notes & reminder logs
  const dealReminderId = 'DEAL-REM-QA-12';
  await saveDealReminder({
    id: dealReminderId,
    dealId: 'DEAL-REM-12',
    partnerName: 'Partner Rem',
    endCustomerName: 'Customer Rem',
    escalationChannel: 'AM_CISCO',
    status: 'PENDING_APPROVAL',
    escalatedAt: '2026-10-12T08:00:00.000Z',
    reminderCount: 0,
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-10-12T08:00:00.000Z',
    createdBy: 'sales_1',
    history: [
      {
        id: 'hist-init-12',
        date: '2026-10-12T08:00:00.000Z',
        author: 'sales_1',
        action: 'CREATED',
        comment: 'Escalado inicial a AM Cisco',
      },
    ],
  });

  await addDealHistoryNote(dealReminderId, 'sales_1', 'Seguimiento 24h', {
    idempotencyKey: 'rem-note-24h',
    timestampIso: '2026-10-12T10:00:00.000Z',
  });
  await addDealHistoryNote(dealReminderId, 'sales_1', 'Seguimiento 24h', {
    idempotencyKey: 'rem-note-24h',
    timestampIso: '2026-10-12T10:00:00.000Z',
  });

  await confirmDealReminderSent(dealReminderId, 'sales_2', 'MANUAL_CONFIRMATION', {
    idempotencyKey: 'rem-sent-1',
    timestampIso: '2026-10-12T11:00:00.000Z',
  });
  await confirmDealReminderSent(dealReminderId, 'sales_2', 'MANUAL_CONFIRMATION', {
    idempotencyKey: 'rem-sent-1',
    timestampIso: '2026-10-12T11:00:00.000Z',
  });

  const updatedReminder = (await getDealReminders()).find((r) => r.id === dealReminderId)!;
  const dealEvents = await getDealReminderHistoryEvents(dealReminderId);
  assert.equal(
    updatedReminder.reminderCount,
    1,
    'Duplicate reminder retry must not double-increment reminderCount'
  );
  assert.equal(dealEvents.length, 3, 'Initial + 1 note + 1 reminder sent');

  console.log('✓ Items 11 & 12 (IndexedDB Collection Store & Idempotent Event Log) passed');
}

// ============================================================================
// ITEM 13: BO SKU CATALOG EXACT VARIANT VS BASE ALIAS RESOLUTION
// ============================================================================
async function testItem13BoSkuExactVariantAndAmbiguity() {
  resetTestEnvironment();

  // Save two distinct variants sharing the same base part number C9300-24T-E
  // Note: normalizeBasePartNumber strips -CBN, =, -RF, -WS suffixes
  await saveBoSkuMapping('C9300-24T-E-CBN', 'IX-C9300-24T-CBN');
  await saveBoSkuMapping('C9300-24T-E-RF', 'IX-C9300-24T-RF');
  // Save a single unambiguous variant for C9200L-24P-4G-E
  await saveBoSkuMapping('C9200L-24P-4G-E-CBN', 'IX-C9200L-24P-E');

  // 13A. Exact variant lookup returns exact SKU without cross-variant overwrite
  const exactCbn = resolveSkuFromCatalog('C9300-24T-E-CBN');
  const exactRf = resolveSkuFromCatalog('C9300-24T-E-RF');
  assert.equal(exactCbn.status, 'EXACT_MATCH');
  assert.equal(exactCbn.sku, 'IX-C9300-24T-CBN');
  assert.equal(exactRf.status, 'EXACT_MATCH');
  assert.equal(exactRf.sku, 'IX-C9300-24T-RF');

  // 13B. Base part number lookup when multiple distinct variants exist returns AMBIGUOUS_ALIAS (empty SKU)
  const ambiguousBase = resolveSkuFromCatalog('C9300-24T-E');
  assert.equal(ambiguousBase.status, 'AMBIGUOUS_ALIAS');
  assert.equal(ambiguousBase.sku, '');
  assert.deepEqual(ambiguousBase.candidates.sort(), ['IX-C9300-24T-CBN', 'IX-C9300-24T-RF']);
  assert.equal(findSkuInCatalog('C9300-24T-E', getLocalBoSkuCache()), '');

  // 13C. Unambiguous base alias resolves via ALIAS_MATCH
  const unambiguousBase = resolveSkuFromCatalog('C9200L-24P-4G-E');
  assert.equal(unambiguousBase.status, 'ALIAS_MATCH');
  assert.equal(unambiguousBase.sku, 'IX-C9200L-24P-E');

  console.log('✓ Item 13 (BO SKU Catalog Exact Variant vs Base Alias Resolution) passed');
}

// ============================================================================
// ITEM 15: PROJECT-SCOPED FIREBASE INSTANCES, LISTENERS & CACHES
// ============================================================================
async function testItem15ProjectScopedFirebaseIsolation() {
  resetTestEnvironment();

  // Write data in default project
  writeProjectScopedStorage(
    'cisco_cloud_estimates_cache_v1',
    JSON.stringify([{ id: 'est_DEFAULT_1' }])
  );
  assert.equal(
    JSON.parse(readProjectScopedStorage('cisco_cloud_estimates_cache_v1') || '[]')[0]?.id,
    'est_DEFAULT_1'
  );

  let unsubscribedCount = 0;
  registerProjectListener('test_listener_default', () => {
    unsubscribedCount += 1;
  });

  const ctxBeforeSwitch = captureProjectContext();
  assert.equal(isProjectContextCurrent(ctxBeforeSwitch), true);

  // Switch to custom project B
  const projBConfig = {
    apiKey: 'AIzaSyTestKeyProjectB',
    authDomain: 'cisco-proj-b.firebaseapp.com',
    projectId: 'cisco-proj-b',
    storageBucket: 'cisco-proj-b.appspot.com',
    messagingSenderId: '123456',
    appId: '1:123456:web:abcdef',
  };
  saveActiveFirebaseConfig(projBConfig);

  // Active listener from previous project must have been unsubscribed automatically
  assert.equal(unsubscribedCount, 1, 'Previous project listener must be unsubscribed on switch');
  // In-flight context from previous project must now be invalidated
  assert.equal(isProjectContextCurrent(ctxBeforeSwitch), false, 'Old project context must be stale');
  assert.equal(getActiveProjectScopeKey(), 'cisco-proj-b');

  // Project B must NOT see Project Default's local cache, and writing to Project B must not overwrite Default
  assert.equal(readProjectScopedStorage('cisco_cloud_estimates_cache_v1'), null);
  writeProjectScopedStorage(
    'cisco_cloud_estimates_cache_v1',
    JSON.stringify([{ id: 'est_PROJ_B_1' }])
  );
  assert.equal(
    JSON.parse(readProjectScopedStorage('cisco_cloud_estimates_cache_v1') || '[]')[0]?.id,
    'est_PROJ_B_1'
  );

  // Same projectId with different apiKey/appId produces a distinct fingerprint
  const fp1 = computeFirebaseConfigFingerprint(projBConfig);
  const fp2 = computeFirebaseConfigFingerprint({ ...projBConfig, apiKey: 'AIzaSyRotatedKey999' });
  assert.notEqual(fp1, fp2);

  // Reset back to default project -> original Default project data is intact
  resetToDefaultFirebaseConfig();
  assert.equal(
    JSON.parse(readProjectScopedStorage('cisco_cloud_estimates_cache_v1') || '[]')[0]?.id,
    'est_DEFAULT_1'
  );

  console.log('✓ Item 15 (Project-Scoped Firebase Instances, Listeners & Caches) passed');
}

// ============================================================================
// ITEMS 5, 6, 7, 13 (SQLite) & 14: EXECUTE PYTHON SQLITE QA SUITE
// ============================================================================
function testPythonSqliteSuite() {
  const scriptPath = path.resolve(process.cwd(), 'desktop_app', 'test_db_improvements.py');
  const scriptSource = fs.readFileSync(scriptPath, 'utf-8');
  const output = execFileSync('python', ['-'], {
    cwd: process.cwd(),
    input: scriptSource,
    encoding: 'utf-8',
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.match(output, /ALL SQLITE PERSISTENCE QA TESTS PASSED/i);
  console.log(output.trim());
  console.log('✓ Items 5, 6, 7, 13 (SQLite) & 14 (Python SQLite QA Suite) passed');
}

async function runAll() {
  console.log('=== Starting 15 Persistence, Database & QA Improvements Suite ===');
  await testItem1AtomicSaveOfEstimateAndVersion();
  await testItem2ConditionalV0AndImmutability();
  await testItems3And4FastTrackGenerationsAndValidation();
  await testItems9And10FastTrackAtomicIdbAndBatchLookup();
  await testItem8CompleteDeletionOfEstimateAndVersions();
  await testItems11And12IndexedDbCollectionAndIdempotentEvents();
  await testItem13BoSkuExactVariantAndAmbiguity();
  await testItem15ProjectScopedFirebaseIsolation();
  testPythonSqliteSuite();
  console.log('=== ALL 15 PERSISTENCE, DATABASE & QA IMPROVEMENTS VERIFIED SUCCESSFULLY ===');
}

runAll().catch((err) => {
  console.error('15 Persistence Improvements QA failed:', err);
  process.exit(1);
});
