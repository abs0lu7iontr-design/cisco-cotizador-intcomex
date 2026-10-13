// ============================================================================
// CISCO AUTOMATED - FAST TRACK PERSISTENCE ENGINE (INDEXEDDB + FIRESTORE CLOUD)
// ============================================================================
// Implements:
// - Item 3: Generational Cloud Publication (complete generations + manifest before pointer switch)
// - Item 4: Download Integrity Validation (canonical checksum, chunk completeness, SKU uniqueness)
// - Item 9: Single-Transaction Local Catalog + Metadata Persistence in IndexedDB
// - Item 10: Pooled Reusable IndexedDB Connection + Single-Transaction Batch SKU Lookup
// ============================================================================

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { getFirestoreInstance } from '../cloud/firebaseConfig';
import { sanitizeForFirestore, withTimeout } from '../cloud/firestoreService';
import {
  FAST_TRACK_MASTER_METADATA,
  FAST_TRACK_MASTER_SEEDS,
} from './fastTrackMasterSeeds';
import { FastTrackProduct, FastTrackDbStats } from './types';

export const DB_NAME = 'CiscoFastTrackDB';
export const DB_VERSION = 2;
export const STORE_NAME = 'fast_track_catalog';
export const METADATA_STORE_NAME = 'fast_track_metadata';
export const ACTIVE_LOCAL_META_KEY = 'active_catalog_meta';

const FAST_TRACK_COLLECTION = 'cisco_fast_track_catalog';
const FAST_TRACK_METADATA_DOC = '_metadata';
const CHUNK_SIZE = 200;
export const FAST_TRACK_SCHEMA_VERSION = 2;

const STORAGE_KEY_ENABLED = 'cisco_fast_track_enabled';
const STORAGE_KEY_FILENAME = 'cisco_fast_track_filename';
const STORAGE_KEY_UPDATED = 'cisco_fast_track_last_updated';
const STORAGE_KEY_VALID_UNTIL = 'cisco_fast_track_valid_until';
const STORAGE_KEY_VALID_FROM = 'cisco_fast_track_valid_from';
const STORAGE_KEY_PROMO_CODE = 'cisco_fast_track_promo_code';
const STORAGE_KEY_PROMO_TITLE = 'cisco_fast_track_promo_title';
const STORAGE_KEY_GENERATION_ID = 'cisco_fast_track_generation_id';
const STORAGE_KEY_CHECKSUM = 'cisco_fast_track_checksum';

export interface FastTrackLocalCatalogMetadata {
  key: string;
  generationId: string;
  schemaVersion: number;
  fileName: string;
  updatedAt: number;
  validUntil: number | null;
  validFrom: number | null;
  promotionCode: string;
  promotionTitle: string;
  totalSkus: number;
  canonicalChecksum: string;
}

export interface FastTrackGenerationManifest {
  generationId: string;
  schemaVersion: number;
  chunkCount: number;
  expectedChunkIds: string[];
  totalSkus: number;
  uniqueSkusCount: number;
  canonicalChecksum: string;
  createdAt: string;
  updatedAt: number;
  fileName: string;
  validUntil: number | null;
  validFrom: number | null;
  promotionCode: string;
  promotionTitle: string;
}

export interface FastTrackChunkDocument {
  generationId?: string;
  schemaVersion?: number;
  chunkIndex: number;
  totalChunks: number;
  items: FastTrackProduct[];
  chunkChecksum?: string;
  updatedAt: number;
}

export interface FastTrackCloudAdapter {
  getDocData: (docId: string) => Promise<Record<string, any> | null>;
  setDocData: (docId: string, data: Record<string, any>) => Promise<void>;
}

export interface FastTrackValidationResult {
  valid: boolean;
  generationId: string;
  isLegacyFormat: boolean;
  items: FastTrackProduct[];
  computedChecksum: string;
  reason?: string;
}

let hydrationPromise: Promise<{ count: number; source: string }> | null = null;
let dbConnectionPromise: Promise<IDBDatabase> | null = null;
let dbOpenCounter = 0;

// In-memory transactional mirror for environments without window.indexedDB or when testing atomic rollbacks
let memoryCatalogMap = new Map<string, FastTrackProduct>();
let memoryCatalogMeta: FastTrackLocalCatalogMetadata | null = null;

/**
 * Sanitiza un Part Number para usar como clave primaria uniforme en IndexedDB.
 */
export function sanitizePartNumberKey(sku: string): string {
  if (!sku) return '';
  return String(sku).trim().toUpperCase();
}

/**
 * Calcula un checksum determinista (FNV-1a 64-bit dual hex) sobre una serialización canónica
 * ordenada por `partNumber` para garantizar reproducibilidad independientemente del orden de entrada.
 */
export function computeCanonicalFastTrackChecksum(items: FastTrackProduct[]): string {
  const normalized = items
    .map((item) => {
      const partNumber = sanitizePartNumberKey(item?.partNumber || '');
      const discount = Number(item?.distributorDiscount || 0).toFixed(4);
      const listPrice = Number(item?.listPrice || 0).toFixed(2);
      const promoNet = Number(item?.promoNetPrice || 0).toFixed(2);
      const category = String(item?.category || '').trim().toUpperCase();
      return {
        partNumber,
        line: `${partNumber}|${discount}|${listPrice}|${promoNet}|${category}`,
      };
    })
    .filter((x) => x.partNumber.length > 0)
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalized.length; i++) {
    const str = normalized[i].line;
    for (let j = 0; j < str.length; j++) {
      const ch = str.charCodeAt(j);
      h1 ^= ch;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= ch + (i & 0xff);
      h2 = Math.imul(h2, 0x811c9dc5);
    }
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `ftchk_${normalized.length}_${hex1}${hex2}`;
}

/**
 * Genera un identificador único y determinista de generación para publicación de Fast Track.
 */
export function buildFastTrackGenerationId(timestampMs: number, checksum: string): string {
  const shortHash = checksum.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || '00000000';
  return `gen_${timestampMs}_${shortHash}`;
}

/**
 * Retorna el contador de aperturas reales de conexión IndexedDB (para diagnóstico QA de Item 10).
 */
export function getFastTrackDbOpenCount(): number {
  return dbOpenCounter;
}

/**
 * Cierra explícitamente la conexión reutilizable a IndexedDB y limpia el singleton.
 */
export async function closeFastTrackDbConnection(): Promise<void> {
  if (!dbConnectionPromise) return;
  const currentPromise = dbConnectionPromise;
  dbConnectionPromise = null;
  try {
    const db = await currentPromise;
    db.close();
  } catch {}
}

/**
 * Abre o reutiliza la conexión única (pooled) a la base de datos IndexedDB en el cliente (Item 10).
 * Maneja `onupgradeneeded` (creando `fast_track_catalog` y `fast_track_metadata`),
 * `onversionchange`, `onblocked` y `onclose`.
 */
export function openFastTrackDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB no está soportado en este entorno.'));
  }

  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  dbConnectionPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      dbOpenCounter += 1;
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'partNumber' });
        }
        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onblocked = () => {
        console.warn('[CiscoFastTrackDB] Conexión bloqueada por otra pestaña o versión anterior.');
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbConnectionPromise = null;
        };
        db.onclose = () => {
          dbConnectionPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbConnectionPromise = null;
        reject(request.error || new Error('Error al abrir base de datos Fast Track.'));
      };
    } catch (err) {
      dbConnectionPromise = null;
      reject(err);
    }
  });

  return dbConnectionPromise;
}

/**
 * Espeja metadatos en localStorage para lectores síncronos heredados tras confirmar la transacción.
 */
function mirrorMetadataToLocalStorage(meta: FastTrackLocalCatalogMetadata): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_FILENAME, meta.fileName);
    localStorage.setItem(STORAGE_KEY_UPDATED, String(meta.updatedAt));
    localStorage.setItem(STORAGE_KEY_GENERATION_ID, meta.generationId);
    localStorage.setItem(STORAGE_KEY_CHECKSUM, meta.canonicalChecksum);
    if (meta.validUntil) {
      localStorage.setItem(STORAGE_KEY_VALID_UNTIL, String(meta.validUntil));
    } else {
      localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
    }
    if (meta.validFrom) {
      localStorage.setItem(STORAGE_KEY_VALID_FROM, String(meta.validFrom));
    } else {
      localStorage.removeItem(STORAGE_KEY_VALID_FROM);
    }
    if (meta.promotionCode) {
      localStorage.setItem(STORAGE_KEY_PROMO_CODE, meta.promotionCode);
    } else {
      localStorage.removeItem(STORAGE_KEY_PROMO_CODE);
    }
    if (meta.promotionTitle) {
      localStorage.setItem(STORAGE_KEY_PROMO_TITLE, meta.promotionTitle);
    } else {
      localStorage.removeItem(STORAGE_KEY_PROMO_TITLE);
    }
    if (localStorage.getItem(STORAGE_KEY_ENABLED) === null) {
      localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
    }
  } catch (_) {}
}

/**
 * Calcula el estado de vencimiento del catálogo actual.
 */
export function getFastTrackExpirationStatus(validUntilTimestamp?: number | null) {
  let validUntil: number | null = null;
  let validFrom: number | null = null;

  if (validUntilTimestamp !== undefined) {
    validUntil = validUntilTimestamp;
  } else if (memoryCatalogMeta) {
    validUntil = memoryCatalogMeta.validUntil;
    validFrom = memoryCatalogMeta.validFrom;
  } else {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VALID_UNTIL);
      if (stored) validUntil = Number(stored);
      const storedFrom = localStorage.getItem(STORAGE_KEY_VALID_FROM);
      if (storedFrom) validFrom = Number(storedFrom);
    } catch (_) {}
  }

  const now = Date.now();
  const isExpired = validUntil !== null && !isNaN(validUntil) && now > validUntil;
  const isExpiringSoon =
    validUntil !== null &&
    !isNaN(validUntil) &&
    !isExpired &&
    validUntil - now <= 24 * 60 * 60 * 1000; // <= 1 día (24 horas)

  const daysRemaining =
    validUntil !== null && !isNaN(validUntil)
      ? Math.max(0, Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24)))
      : null;

  const validUntilFormatted =
    validUntil && !isNaN(validUntil)
      ? new Intl.DateTimeFormat('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(validUntil))
      : undefined;

  const validFromFormatted =
    validFrom && !isNaN(validFrom)
      ? new Intl.DateTimeFormat('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(validFrom))
      : undefined;

  return {
    validUntil,
    validFrom,
    isExpired,
    isExpiringSoon,
    daysRemaining,
    validUntilFormatted,
    validFromFormatted,
  };
}

/**
 * Guarda o actualiza la fecha de vigencia del catálogo.
 */
export function setFastTrackValidUntil(timestamp: number | null): void {
  if (memoryCatalogMeta) {
    memoryCatalogMeta = { ...memoryCatalogMeta, validUntil: timestamp };
  }
  try {
    if (timestamp === null) {
      localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
    } else {
      localStorage.setItem(STORAGE_KEY_VALID_UNTIL, String(timestamp));
    }
  } catch (_) {}
}

/**
 * Restaura los metadatos de respaldo en localStorage si se hubieran perdido.
 */
function repairLocalMetadataFallback() {
  try {
    if (!localStorage.getItem(STORAGE_KEY_FILENAME)) {
      localStorage.setItem(STORAGE_KEY_FILENAME, FAST_TRACK_MASTER_METADATA.fileName);
    }
    if (!localStorage.getItem(STORAGE_KEY_UPDATED)) {
      localStorage.setItem(STORAGE_KEY_UPDATED, String(FAST_TRACK_MASTER_METADATA.updatedAt));
    }
    if (!localStorage.getItem(STORAGE_KEY_VALID_UNTIL)) {
      localStorage.setItem(STORAGE_KEY_VALID_UNTIL, String(FAST_TRACK_MASTER_METADATA.validUntil));
    }
    if (!localStorage.getItem(STORAGE_KEY_VALID_FROM)) {
      localStorage.setItem(STORAGE_KEY_VALID_FROM, String(FAST_TRACK_MASTER_METADATA.validFrom));
    }
    if (!localStorage.getItem(STORAGE_KEY_PROMO_CODE)) {
      localStorage.setItem(STORAGE_KEY_PROMO_CODE, FAST_TRACK_MASTER_METADATA.promotionCode);
    }
    if (!localStorage.getItem(STORAGE_KEY_PROMO_TITLE)) {
      localStorage.setItem(STORAGE_KEY_PROMO_TITLE, FAST_TRACK_MASTER_METADATA.promotionTitle);
    }
    if (localStorage.getItem(STORAGE_KEY_ENABLED) === null) {
      localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
    }
  } catch (_) {}
}

/**
 * Obtiene el registro unificado de metadatos del catálogo local desde IndexedDB (o espejo en memoria/localStorage).
 */
export async function getFastTrackUnifiedMetadata(): Promise<FastTrackLocalCatalogMetadata | null> {
  try {
    const db = await openFastTrackDb();
    const idbMeta = await new Promise<FastTrackLocalCatalogMetadata | null>((resolve) => {
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        return resolve(null);
      }
      const tx = db.transaction([METADATA_STORE_NAME], 'readonly');
      const store = tx.objectStore(METADATA_STORE_NAME);
      const req = store.get(ACTIVE_LOCAL_META_KEY);
      req.onsuccess = () => resolve((req.result as FastTrackLocalCatalogMetadata) || null);
      req.onerror = () => resolve(null);
    });
    if (idbMeta) {
      memoryCatalogMeta = idbMeta;
      return idbMeta;
    }
  } catch {
    // Use memoryCatalogMeta or localStorage fallback
  }

  if (memoryCatalogMeta) {
    return memoryCatalogMeta;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const fileName = localStorage.getItem(STORAGE_KEY_FILENAME);
      const updatedStr = localStorage.getItem(STORAGE_KEY_UPDATED);
      if (fileName && updatedStr) {
        const migrated: FastTrackLocalCatalogMetadata = {
          key: ACTIVE_LOCAL_META_KEY,
          generationId: localStorage.getItem(STORAGE_KEY_GENERATION_ID) || 'gen_legacy_migrated',
          schemaVersion: FAST_TRACK_SCHEMA_VERSION,
          fileName,
          updatedAt: Number(updatedStr) || Date.now(),
          validUntil: localStorage.getItem(STORAGE_KEY_VALID_UNTIL)
            ? Number(localStorage.getItem(STORAGE_KEY_VALID_UNTIL))
            : null,
          validFrom: localStorage.getItem(STORAGE_KEY_VALID_FROM)
            ? Number(localStorage.getItem(STORAGE_KEY_VALID_FROM))
            : null,
          promotionCode: localStorage.getItem(STORAGE_KEY_PROMO_CODE) || '',
          promotionTitle: localStorage.getItem(STORAGE_KEY_PROMO_TITLE) || '',
          totalSkus: memoryCatalogMap.size,
          canonicalChecksum: localStorage.getItem(STORAGE_KEY_CHECKSUM) || '',
        };
        return migrated;
      }
    }
  } catch {}

  return null;
}

/**
 * Publica una generación completa de Fast Track hacia Firestore (o un adaptador cloud inyectable para QA).
 * Reglas (Item 3):
 * 1. Escribe todos los bloques bajo `gen_${generationId}_chunk_${c}` sin sobrescribir la generación activa.
 * 2. Escribe el manifiesto `gen_${generationId}_manifest` con versión de esquema, bloques esperados, SKUs únicos y checksum canónico.
 * 3. Activa `_metadata` (y los chunks legacy `chunk_0..N` para lectores antiguos) SOLO cuando todos los bloques y el manifiesto están confirmados.
 * 4. Si otra publicación concurrente con `updatedAt` mayor ya activó su puntero, conserva la generación más reciente sin mezclar bloques.
 */
export async function publishFastTrackGenerationToCloud(params: {
  items: FastTrackProduct[];
  fileName: string;
  validUntil: number | null;
  validFrom: number | null;
  promotionCode?: string;
  promotionTitle?: string;
  updatedAt?: number;
  generationId?: string;
  adapter?: FastTrackCloudAdapter;
  failAtChunkIndex?: number;
}): Promise<{
  success: boolean;
  generationId: string;
  manifest: FastTrackGenerationManifest;
  supersededByNewer?: boolean;
  error?: string;
}> {
  const now = params.updatedAt || Date.now();
  // Deduplicate by sanitized partNumber while preserving latest entry
  const uniqueMap = new Map<string, FastTrackProduct>();
  for (const item of params.items) {
    const cleanKey = sanitizePartNumberKey(item.partNumber);
    if (!cleanKey) continue;
    uniqueMap.set(cleanKey, {
      ...item,
      partNumber: cleanKey,
      distributorDiscount: Number(item.distributorDiscount) || 0,
      updatedAt: item.updatedAt || now,
    });
  }
  const deduplicatedItems = Array.from(uniqueMap.values());
  const canonicalChecksum = computeCanonicalFastTrackChecksum(deduplicatedItems);
  const generationId =
    params.generationId || buildFastTrackGenerationId(now, canonicalChecksum);
  const chunkCount = Math.max(1, Math.ceil(deduplicatedItems.length / CHUNK_SIZE));
  const expectedChunkIds: string[] = [];
  for (let c = 0; c < chunkCount; c++) {
    expectedChunkIds.push(`gen_${generationId}_chunk_${c}`);
  }

  const manifest: FastTrackGenerationManifest = {
    generationId,
    schemaVersion: FAST_TRACK_SCHEMA_VERSION,
    chunkCount,
    expectedChunkIds,
    totalSkus: deduplicatedItems.length,
    uniqueSkusCount: deduplicatedItems.length,
    canonicalChecksum,
    createdAt: new Date(now).toISOString(),
    updatedAt: now,
    fileName: params.fileName,
    validUntil: params.validUntil || null,
    validFrom: params.validFrom || null,
    promotionCode: params.promotionCode || '',
    promotionTitle: params.promotionTitle || '',
  };

  const cloudAdapter: FastTrackCloudAdapter | null =
    params.adapter ||
    (() => {
      const { db: firestoreDb, isReady } = getFirestoreInstance();
      if (!isReady || !firestoreDb) return null;
      return {
        getDocData: async (docId: string) => {
          const snap = await withTimeout(
            getDoc(doc(firestoreDb, FAST_TRACK_COLLECTION, docId)),
            3500
          );
          return snap.exists() ? (snap.data() as Record<string, any>) : null;
        },
        setDocData: async (docId: string, data: Record<string, any>) => {
          await withTimeout(
            setDoc(
              doc(firestoreDb, FAST_TRACK_COLLECTION, docId),
              sanitizeForFirestore(data),
              { merge: true }
            ),
            4000
          );
        },
      };
    })();

  if (!cloudAdapter) {
    return {
      success: false,
      generationId,
      manifest,
      error: 'Firestore no está disponible para publicar generación Fast Track',
    };
  }

  try {
    // 1. Subir todos los bloques aislados bajo `gen_${generationId}_chunk_${c}`
    for (let c = 0; c < chunkCount; c++) {
      if (params.failAtChunkIndex !== undefined && c === params.failAtChunkIndex) {
        throw new Error(`Fallo simulado al subir bloque ${c} de generación ${generationId}`);
      }
      const chunkItems = deduplicatedItems.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      const chunkPayload: FastTrackChunkDocument = {
        generationId,
        schemaVersion: FAST_TRACK_SCHEMA_VERSION,
        chunkIndex: c,
        totalChunks: chunkCount,
        items: chunkItems,
        chunkChecksum: computeCanonicalFastTrackChecksum(chunkItems),
        updatedAt: now,
      };
      await cloudAdapter.setDocData(expectedChunkIds[c], chunkPayload as any);
    }

    // 2. Escribir manifiesto de generación confirmado
    await cloudAdapter.setDocData(`gen_${generationId}_manifest`, manifest as any);

    // 3. Comprobar concurrencia antes de conmutar el puntero activo (`_metadata`)
    const currentActiveMeta = await cloudAdapter.getDocData(FAST_TRACK_METADATA_DOC);
    if (
      currentActiveMeta &&
      typeof currentActiveMeta.updatedAt === 'number' &&
      currentActiveMeta.updatedAt > now
    ) {
      return {
        success: true,
        generationId,
        manifest,
        supersededByNewer: true,
      };
    }

    // 4. Actualizar también `chunk_0..chunk_N` para compatibilidad hacia atrás con clientes antiguos
    for (let c = 0; c < chunkCount; c++) {
      const chunkItems = deduplicatedItems.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      await cloudAdapter.setDocData(`chunk_${c}`, {
        generationId,
        schemaVersion: FAST_TRACK_SCHEMA_VERSION,
        chunkIndex: c,
        totalChunks: chunkCount,
        items: chunkItems,
        chunkChecksum: computeCanonicalFastTrackChecksum(chunkItems),
        updatedAt: now,
      });
    }

    // 5. Activar la generación en `_metadata` SOLO al final de la operación
    await cloudAdapter.setDocData(FAST_TRACK_METADATA_DOC, {
      ...manifest,
      activeGenerationId: generationId,
    });

    return {
      success: true,
      generationId,
      manifest,
      supersededByNewer: false,
    };
  } catch (err: any) {
    return {
      success: false,
      generationId,
      manifest,
      error: err?.message || 'Error publicando generación de Fast Track',
    };
  }
}

/**
 * Planifica de forma segura (sin ejecutar borrados destructivos automáticos) qué documentos
 * de generaciones antiguas pueden limpiarse en mantenimiento posterior (Item 3).
 */
export function planOldFastTrackGenerationsCleanup(
  allDocumentIds: string[],
  activeGenerationId: string,
  retainGenerationIds: string[] = []
): {
  activeGenerationId: string;
  protectedDocIds: string[];
  removableDocIds: string[];
} {
  const keepGens = new Set<string>([activeGenerationId, ...retainGenerationIds]);
  const protectedDocIds: string[] = [];
  const removableDocIds: string[] = [];

  for (const docId of allDocumentIds) {
    if (!docId.startsWith('gen_')) {
      protectedDocIds.push(docId);
      continue;
    }
    const matchesKept = Array.from(keepGens).some(
      (g) => g && (docId === `gen_${g}_manifest` || docId.startsWith(`gen_${g}_chunk_`))
    );
    if (matchesKept) {
      protectedDocIds.push(docId);
    } else {
      removableDocIds.push(docId);
    }
  }

  return {
    activeGenerationId,
    protectedDocIds,
    removableDocIds,
  };
}

/**
 * Valida la integridad de una generación descargada de Fast Track antes de sustituir el catálogo local (Item 4).
 * Verifica presencia y unicidad de bloques, coincidencia de generación, conteo total, SKUs únicos y checksum canónico.
 * Mantiene compatibilidad explícita con el formato anterior (`chunk_0..chunk_N` sin `generationId`).
 */
export function validateDownloadedFastTrackGeneration(params: {
  metadata: Record<string, any>;
  manifest?: Partial<FastTrackGenerationManifest> | null;
  chunks: Array<Partial<FastTrackChunkDocument> | null | undefined>;
}): FastTrackValidationResult {
  const meta = params.manifest || params.metadata || {};
  const isLegacyFormat = !meta.generationId && !params.metadata?.activeGenerationId;
  const expectedGenerationId = String(
    meta.generationId || params.metadata?.activeGenerationId || 'legacy_v1'
  );
  const expectedChunkCount = Number(meta.chunkCount ?? params.metadata?.chunkCount ?? 0);
  const expectedTotalSkus = Number(meta.totalSkus ?? params.metadata?.totalSkus ?? 0);
  const expectedUniqueSkus = Number(
    meta.uniqueSkusCount ?? expectedTotalSkus
  );
  const expectedChecksum = String(meta.canonicalChecksum || '');

  if (expectedChunkCount <= 0 || expectedTotalSkus <= 0) {
    return {
      valid: false,
      generationId: expectedGenerationId,
      isLegacyFormat,
      items: [],
      computedChecksum: '',
      reason: 'Metadatos inválidos: chunkCount o totalSkus es 0.',
    };
  }

  if (!Array.isArray(params.chunks) || params.chunks.length !== expectedChunkCount) {
    return {
      valid: false,
      generationId: expectedGenerationId,
      isLegacyFormat,
      items: [],
      computedChecksum: '',
      reason: `Cantidad de bloques recibidos (${params.chunks?.length || 0}) no coincide con los esperados (${expectedChunkCount}).`,
    };
  }

  const seenChunkIndices = new Set<number>();
  const seenSkus = new Set<string>();
  const allProducts: FastTrackProduct[] = [];

  for (let i = 0; i < expectedChunkCount; i++) {
    const chunk = params.chunks[i];
    if (!chunk || !Array.isArray(chunk.items)) {
      return {
        valid: false,
        generationId: expectedGenerationId,
        isLegacyFormat,
        items: [],
        computedChecksum: '',
        reason: `Bloque ausente o corrupto en posición ${i}.`,
      };
    }

    const chunkIdx = chunk.chunkIndex !== undefined ? Number(chunk.chunkIndex) : i;
    if (chunkIdx < 0 || chunkIdx >= expectedChunkCount) {
      return {
        valid: false,
        generationId: expectedGenerationId,
        isLegacyFormat,
        items: [],
        computedChecksum: '',
        reason: `Índice de bloque fuera de rango (${chunkIdx}).`,
      };
    }

    if (seenChunkIndices.has(chunkIdx)) {
      return {
        valid: false,
        generationId: expectedGenerationId,
        isLegacyFormat,
        items: [],
        computedChecksum: '',
        reason: `Bloque repetido detectado para chunkIndex=${chunkIdx}.`,
      };
    }
    seenChunkIndices.add(chunkIdx);

    if (!isLegacyFormat && chunk.generationId && chunk.generationId !== expectedGenerationId) {
      return {
        valid: false,
        generationId: expectedGenerationId,
        isLegacyFormat,
        items: [],
        computedChecksum: '',
        reason: `El bloque ${chunkIdx} pertenece a otra generación (${chunk.generationId} !== ${expectedGenerationId}).`,
      };
    }

    if (chunk.chunkChecksum) {
      const actualChunkChecksum = computeCanonicalFastTrackChecksum(chunk.items);
      if (actualChunkChecksum !== chunk.chunkChecksum) {
        return {
          valid: false,
          generationId: expectedGenerationId,
          isLegacyFormat,
          items: [],
          computedChecksum: '',
          reason: `Checksum inválido en el bloque ${chunkIdx} (datos alterados).`,
        };
      }
    }

    for (const item of chunk.items) {
      const cleanKey = sanitizePartNumberKey(item?.partNumber || '');
      if (!cleanKey) {
        return {
          valid: false,
          generationId: expectedGenerationId,
          isLegacyFormat,
          items: [],
          computedChecksum: '',
          reason: `Producto sin partNumber válido en el bloque ${chunkIdx}.`,
        };
      }
      if (seenSkus.has(cleanKey)) {
        return {
          valid: false,
          generationId: expectedGenerationId,
          isLegacyFormat,
          items: [],
          computedChecksum: '',
          reason: `SKU duplicado detectado en la generación descargada: ${cleanKey}.`,
        };
      }
      seenSkus.add(cleanKey);
      allProducts.push({
        ...item,
        partNumber: cleanKey,
        distributorDiscount: Number(item.distributorDiscount) || 0,
        updatedAt: Number(item.updatedAt) || Date.now(),
      });
    }
  }

  if (seenChunkIndices.size !== expectedChunkCount) {
    return {
      valid: false,
      generationId: expectedGenerationId,
      isLegacyFormat,
      items: [],
      computedChecksum: '',
      reason: 'No se recibieron todos los índices de bloque esperados (0..chunkCount-1).',
    };
  }

  if (allProducts.length !== expectedTotalSkus || seenSkus.size !== expectedUniqueSkus) {
    return {
      valid: false,
      generationId: expectedGenerationId,
      isLegacyFormat,
      items: [],
      computedChecksum: '',
      reason: `Conteo de SKUs descargados (${allProducts.length}) no coincide con el declarado (${expectedTotalSkus}).`,
    };
  }

  const computedChecksum = computeCanonicalFastTrackChecksum(allProducts);
  if (!isLegacyFormat && expectedChecksum && computedChecksum !== expectedChecksum) {
    return {
      valid: false,
      generationId: expectedGenerationId,
      isLegacyFormat,
      items: [],
      computedChecksum,
      reason: `Checksum global de generación no coincide (${computedChecksum} !== ${expectedChecksum}).`,
    };
  }

  return {
    valid: true,
    generationId: expectedGenerationId,
    isLegacyFormat,
    items: allProducts,
    computedChecksum,
  };
}

/**
 * Guarda el catálogo Fast Track y sus metadatos en IndexedDB dentro de UNA SOLA transacción atómica (Item 9),
 * y opcionalmente publica una generación completa en Firestore Cloud (Item 3).
 */
export async function saveFastTrackCatalog(
  items: FastTrackProduct[],
  fileName: string = 'Catalogo_Fast_Track.xlsx',
  validUntil: number | null = null,
  validFrom: number | null = null,
  promotionCode?: string,
  promotionTitle?: string,
  syncToCloud: boolean = true,
  options?: {
    generationId?: string;
    simulateAbortBeforeCommit?: boolean;
    cloudAdapter?: FastTrackCloudAdapter;
  }
): Promise<{ count: number; cloudSynced: boolean; generationId: string; checksum: string }> {
  const now = Date.now();
  const deduplicatedMap = new Map<string, FastTrackProduct>();

  for (const item of items) {
    const cleanKey = sanitizePartNumberKey(item?.partNumber || '');
    if (!cleanKey) continue;
    deduplicatedMap.set(cleanKey, {
      ...item,
      partNumber: cleanKey,
      distributorDiscount: Number(item.distributorDiscount) || 0,
      updatedAt: item.updatedAt || now,
    });
  }

  const insertedRecords = Array.from(deduplicatedMap.values());
  const canonicalChecksum = computeCanonicalFastTrackChecksum(insertedRecords);
  const generationId =
    options?.generationId || buildFastTrackGenerationId(now, canonicalChecksum);

  const newMeta: FastTrackLocalCatalogMetadata = {
    key: ACTIVE_LOCAL_META_KEY,
    generationId,
    schemaVersion: FAST_TRACK_SCHEMA_VERSION,
    fileName,
    updatedAt: now,
    validUntil: validUntil || null,
    validFrom: validFrom || null,
    promotionCode: promotionCode || '',
    promotionTitle: promotionTitle || '',
    totalSkus: insertedRecords.length,
    canonicalChecksum,
  };

  // Snapshot previous in-memory state in case transaction aborts (Item 9 rollback guarantee)
  const prevMemoryMap = new Map(memoryCatalogMap);
  const prevMemoryMeta = memoryCatalogMeta ? { ...memoryCatalogMeta } : null;

  try {
    let idbAvailable = false;
    let db: IDBDatabase | null = null;
    try {
      db = await openFastTrackDb();
      idbAvailable = true;
    } catch {
      idbAvailable = false;
    }

    if (idbAvailable && db) {
      await new Promise<void>((resolve, reject) => {
        const storeNames = db!.objectStoreNames.contains(METADATA_STORE_NAME)
          ? [STORE_NAME, METADATA_STORE_NAME]
          : [STORE_NAME];
        const transaction = db!.transaction(storeNames, 'readwrite');
        const catalogStore = transaction.objectStore(STORE_NAME);
        const metaStore = storeNames.includes(METADATA_STORE_NAME)
          ? transaction.objectStore(METADATA_STORE_NAME)
          : null;

        const clearRequest = catalogStore.clear();
        clearRequest.onsuccess = () => {
          for (const record of insertedRecords) {
            catalogStore.put(record);
          }
          if (metaStore) {
            metaStore.put(newMeta);
          }
          if (options?.simulateAbortBeforeCommit) {
            transaction.abort();
            return;
          }
        };

        clearRequest.onerror = () => {
          reject(clearRequest.error || new Error('Error purgando base de datos Fast Track.'));
        };

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onabort = () => {
          reject(
            transaction.error ||
              new Error('Transacción de catálogo y metadatos Fast Track abortada; estado anterior conservado.')
          );
        };

        transaction.onerror = () => {
          reject(transaction.error || new Error('Error guardando registros en IndexedDB.'));
        };
      });
    } else if (options?.simulateAbortBeforeCommit) {
      throw new Error(
        'Transacción de catálogo y metadatos Fast Track abortada; estado anterior conservado.'
      );
    }

    // Commit to in-memory mirror and localStorage ONLY after transaction completes
    memoryCatalogMap = new Map(insertedRecords.map((r) => [r.partNumber, r]));
    memoryCatalogMeta = newMeta;
    mirrorMetadataToLocalStorage(newMeta);
  } catch (err) {
    // Restore previous in-memory state on abort/failure
    memoryCatalogMap = prevMemoryMap;
    memoryCatalogMeta = prevMemoryMeta;
    throw err;
  }

  // 3. Sincronización por generaciones completas a Firestore Cloud (Item 3)
  let cloudSynced = false;
  if (syncToCloud && insertedRecords.length > 0) {
    try {
      const pubRes = await publishFastTrackGenerationToCloud({
        items: insertedRecords,
        fileName,
        validUntil,
        validFrom,
        promotionCode,
        promotionTitle,
        updatedAt: now,
        generationId,
        adapter: options?.cloudAdapter,
      });
      cloudSynced = pubRes.success;
    } catch (cloudErr) {
      console.warn('[FastTrack - Cloud Sync Warning]:', cloudErr);
    }
  }

  return {
    count: insertedRecords.length,
    cloudSynced,
    generationId,
    checksum: canonicalChecksum,
  };
}

/**
 * Descarga, valida integridad (Item 4) y sincroniza una generación completa del catálogo desde
 * Firestore Cloud hacia IndexedDB. Si la validación falla, conserva intacto el catálogo local.
 */
export async function syncFastTrackFromCloud(
  forceSeedFallback: boolean = false,
  options?: { cloudAdapter?: FastTrackCloudAdapter }
): Promise<{
  success: boolean;
  count: number;
  source: 'firestore' | 'master_seed' | 'local' | 'error';
  generationId?: string;
  validationError?: string;
}> {
  if (!forceSeedFallback) {
    try {
      const cloudAdapter: FastTrackCloudAdapter | null =
        options?.cloudAdapter ||
        (() => {
          const { db: firestoreDb, isReady } = getFirestoreInstance();
          if (!isReady || !firestoreDb) return null;
          return {
            getDocData: async (docId: string) => {
              const snap = await withTimeout(
                getDoc(doc(firestoreDb, FAST_TRACK_COLLECTION, docId)),
                3500
              );
              return snap.exists() ? (snap.data() as Record<string, any>) : null;
            },
            setDocData: async () => {},
          };
        })();

      if (cloudAdapter) {
        const metaData = await cloudAdapter.getDocData(FAST_TRACK_METADATA_DOC);
        if (metaData) {
          const activeGenId = String(
            metaData.activeGenerationId || metaData.generationId || ''
          ).trim();

          let manifest: Partial<FastTrackGenerationManifest> | null = null;
          if (activeGenId) {
            manifest = (await cloudAdapter.getDocData(
              `gen_${activeGenId}_manifest`
            )) as Partial<FastTrackGenerationManifest> | null;
          }

          const effectiveMeta = manifest || metaData;
          const chunkCount = Number(effectiveMeta.chunkCount) || 0;
          const totalSkus = Number(effectiveMeta.totalSkus) || 0;

          if (chunkCount > 0 && totalSkus > 0) {
            const chunkPromises: Promise<Record<string, any> | null>[] = [];
            for (let c = 0; c < chunkCount; c++) {
              const genChunkId = activeGenId
                ? `gen_${activeGenId}_chunk_${c}`
                : `chunk_${c}`;
              chunkPromises.push(
                cloudAdapter.getDocData(genChunkId).then(async (genChunk) => {
                  if (genChunk) return genChunk;
                  // Fallback to legacy chunk_${c} only if legacy format
                  if (!activeGenId) {
                    return cloudAdapter.getDocData(`chunk_${c}`);
                  }
                  return null;
                })
              );
            }

            const rawChunks = await Promise.all(chunkPromises);
            const validation = validateDownloadedFastTrackGeneration({
              metadata: metaData,
              manifest,
              chunks: rawChunks as Array<Partial<FastTrackChunkDocument> | null>,
            });

            if (!validation.valid) {
              console.warn(
                '[FastTrack - Integrity Validation Rejected Download]:',
                validation.reason
              );
              const existingCount = await getFastTrackRawCount();
              if (existingCount > 0) {
                return {
                  success: false,
                  count: existingCount,
                  source: 'local',
                  generationId: validation.generationId,
                  validationError: validation.reason,
                };
              }
              return {
                success: false,
                count: 0,
                source: 'error',
                generationId: validation.generationId,
                validationError: validation.reason,
              };
            }

            await saveFastTrackCatalog(
              validation.items,
              effectiveMeta.fileName || 'Catalogo_FastTrack_Cloud.xlsx',
              effectiveMeta.validUntil || null,
              effectiveMeta.validFrom || null,
              effectiveMeta.promotionCode || '',
              effectiveMeta.promotionTitle || '',
              false, // syncToCloud = false porque ya proviene de la nube
              { generationId: validation.generationId }
            );
            return {
              success: true,
              count: validation.items.length,
              source: 'firestore',
              generationId: validation.generationId,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[FastTrack - syncFastTrackFromCloud error]:', err);
    }
  }

  // 2. Si no hay catálogo en Firestore y el almacenamiento local ya tiene registros
  const localCount = await getFastTrackRawCount();
  if (localCount > 0 && !forceSeedFallback) {
    return { success: true, count: localCount, source: 'local' };
  }

  // 3. BLINDAJE CERO-ESTADO: Hidratar con el Catálogo Maestro Oficial Integrado
  const masterResult = await saveFastTrackCatalog(
    FAST_TRACK_MASTER_SEEDS,
    FAST_TRACK_MASTER_METADATA.fileName,
    FAST_TRACK_MASTER_METADATA.validUntil,
    FAST_TRACK_MASTER_METADATA.validFrom,
    FAST_TRACK_MASTER_METADATA.promotionCode,
    FAST_TRACK_MASTER_METADATA.promotionTitle,
    true
  );

  return {
    success: true,
    count: masterResult.count,
    source: 'master_seed',
    generationId: masterResult.generationId,
  };
}

/**
 * Garantiza que la base de datos Fast Track tenga un catálogo cargado.
 * Si el conteo local es 0, sincroniza concurrentemente desde Firestore Cloud o Master Seeds.
 */
export async function ensureFastTrackHydrated(
  forceSync: boolean = false
): Promise<{ count: number; source: string }> {
  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    try {
      if (!forceSync) {
        const localCount = await getFastTrackRawCount();
        if (localCount > 0) {
          const updated =
            typeof localStorage !== 'undefined'
              ? localStorage.getItem(STORAGE_KEY_UPDATED)
              : null;
          if (!updated && !memoryCatalogMeta) {
            repairLocalMetadataFallback();
          }
          return { count: localCount, source: 'local' };
        }
      }
      const syncResult = await syncFastTrackFromCloud(false);
      return { count: syncResult.count, source: syncResult.source };
    } finally {
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
}

/**
 * Restablece el catálogo al catálogo maestro oficial blindado.
 */
export async function resetToMasterSeed(): Promise<{ count: number }> {
  const result = await saveFastTrackCatalog(
    FAST_TRACK_MASTER_SEEDS,
    FAST_TRACK_MASTER_METADATA.fileName,
    FAST_TRACK_MASTER_METADATA.validUntil,
    FAST_TRACK_MASTER_METADATA.validFrom,
    FAST_TRACK_MASTER_METADATA.promotionCode,
    FAST_TRACK_MASTER_METADATA.promotionTitle,
    true
  );
  return { count: result.count };
}

/**
 * Consulta en lote múltiples SKUs sobre una ÚNICA transacción readonly de IndexedDB (Item 10).
 * Distingue explícitamente entre SKU inexistente (`items[sku] = null`) y error de base de datos (`dbError`).
 */
export async function getFastTrackItemsBatch(
  skus: string[],
  options?: { simulateDbError?: boolean }
): Promise<{
  items: Record<string, FastTrackProduct | null>;
  dbError?: string;
  transactionCount: number;
}> {
  const result: Record<string, FastTrackProduct | null> = {};
  const cleanKeys = Array.from(
    new Set(skus.map((s) => sanitizePartNumberKey(s)).filter(Boolean))
  );

  if (cleanKeys.length === 0) {
    return { items: result, transactionCount: 0 };
  }

  if (options?.simulateDbError) {
    return {
      items: result,
      dbError: 'Error simulado de lectura en transacción IndexedDB',
      transactionCount: 1,
    };
  }

  try {
    let rawCount = await getFastTrackRawCount();
    if (rawCount === 0) {
      await ensureFastTrackHydrated();
    }

    try {
      const db = await openFastTrackDb();
      const batchItems = await new Promise<Record<string, FastTrackProduct | null>>(
        (resolve, reject) => {
          const tx = db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const map: Record<string, FastTrackProduct | null> = {};
          let remaining = cleanKeys.length;

          for (const key of cleanKeys) {
            const req = store.get(key);
            req.onsuccess = () => {
              map[key] = (req.result as FastTrackProduct) || null;
              remaining -= 1;
              if (remaining === 0) {
                resolve(map);
              }
            };
            req.onerror = () => {
              reject(req.error || new Error(`Error consultando SKU ${key} en IndexedDB`));
            };
          }

          tx.onerror = () => {
            reject(tx.error || new Error('Error en transacción por lote de Fast Track'));
          };
        }
      );

      return {
        items: batchItems,
        transactionCount: 1,
      };
    } catch (idbErr: any) {
      // Fallback to in-memory mirror if IndexedDB is unavailable in Node/Vitest environment
      if (memoryCatalogMap.size > 0) {
        for (const key of cleanKeys) {
          result[key] = memoryCatalogMap.get(key) || null;
        }
        return {
          items: result,
          transactionCount: 1,
        };
      }
      return {
        items: result,
        dbError: idbErr?.message || 'Error accediendo a base de datos Fast Track',
        transactionCount: 1,
      };
    }
  } catch (err: any) {
    return {
      items: result,
      dbError: err?.message || 'Error inesperado en consulta por lote Fast Track',
      transactionCount: 0,
    };
  }
}

/**
 * Obtiene un ítem por Part Number desde IndexedDB reutilizando la conexión única.
 * Si la base está en 0, auto-hidrata antes de responder.
 */
export async function getFastTrackItem(sku: string): Promise<FastTrackProduct | null> {
  const cleanKey = sanitizePartNumberKey(sku);
  if (!cleanKey) return null;

  const batchRes = await getFastTrackItemsBatch([cleanKey]);
  if (batchRes.dbError) {
    return memoryCatalogMap.get(cleanKey) || null;
  }
  return batchRes.items[cleanKey] ?? null;
}

/**
 * Obtiene todos los Part Numbers disponibles en IndexedDB (para preview / administración).
 */
export async function getAllFastTrackItems(limit: number = 200): Promise<FastTrackProduct[]> {
  try {
    const rawCount = await getFastTrackRawCount();
    if (rawCount === 0) {
      await ensureFastTrackHydrated();
    }

    try {
      const db = await openFastTrackDb();
      return await new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const results: FastTrackProduct[] = [];

        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => {
          resolve(Array.from(memoryCatalogMap.values()).slice(0, limit));
        };
      });
    } catch {
      return Array.from(memoryCatalogMap.values()).slice(0, limit);
    }
  } catch (_) {
    return Array.from(memoryCatalogMap.values()).slice(0, limit);
  }
}

/**
 * Retorna la cantidad bruta de SKUs en IndexedDB (o espejo en memoria) sin activar auto-hidratación.
 */
export async function getFastTrackRawCount(): Promise<number> {
  try {
    const db = await openFastTrackDb();
    return await new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve(countRequest.result || 0);
      };

      countRequest.onerror = () => {
        resolve(memoryCatalogMap.size);
      };
    });
  } catch (_) {
    return memoryCatalogMap.size;
  }
}

/**
 * Retorna la cantidad total de SKUs en la base de datos Fast Track.
 * BLINDAJE: Si la base está en 0, activa auto-hidratación desde Firestore Cloud o Master Seeds.
 */
export async function getFastTrackCount(): Promise<number> {
  const rawCount = await getFastTrackRawCount();
  if (rawCount > 0) return rawCount;

  const hydration = await ensureFastTrackHydrated();
  return hydration.count;
}

/**
 * Purga completamente la base de datos IndexedDB y limpia los metadatos locales en una sola transacción.
 */
export async function purgeFastTrackDb(): Promise<void> {
  memoryCatalogMap.clear();
  memoryCatalogMeta = null;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_FILENAME);
      localStorage.removeItem(STORAGE_KEY_UPDATED);
      localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
      localStorage.removeItem(STORAGE_KEY_VALID_FROM);
      localStorage.removeItem(STORAGE_KEY_PROMO_CODE);
      localStorage.removeItem(STORAGE_KEY_PROMO_TITLE);
      localStorage.removeItem(STORAGE_KEY_GENERATION_ID);
      localStorage.removeItem(STORAGE_KEY_CHECKSUM);
    }
  } catch (_) {}

  try {
    const db = await openFastTrackDb();
    await new Promise<void>((resolve, reject) => {
      const storeNames = db.objectStoreNames.contains(METADATA_STORE_NAME)
        ? [STORE_NAME, METADATA_STORE_NAME]
        : [STORE_NAME];
      const transaction = db.transaction(storeNames, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      if (storeNames.includes(METADATA_STORE_NAME)) {
        transaction.objectStore(METADATA_STORE_NAME).clear();
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error('Error al vaciar base de datos.'));
    });
  } catch (err) {
    console.warn('Error purgando Fast Track DB:', err);
  }
}

/**
 * Obtiene el estado del Interruptor Global (Kill Switch).
 */
export function isFastTrackAuditEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_ENABLED);
    return val === null ? true : val === 'true';
  } catch (_) {
    return true;
  }
}

/**
 * Modifica el estado del Interruptor Global (Kill Switch).
 */
export function setFastTrackAuditEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch (_) {}
}

/**
 * Obtiene estadísticas generales del módulo Fast Track incluyendo metadatos unificados y estado de expiración.
 * BLINDAJE: Si totalSkus === 0, ejecuta auto-hidratación para nunca mostrar un catálogo en 0.
 */
export async function getFastTrackStats(): Promise<FastTrackDbStats> {
  const isEnabled = isFastTrackAuditEnabled();
  let totalSkus = await getFastTrackRawCount();

  if (totalSkus === 0) {
    const hydration = await ensureFastTrackHydrated();
    totalSkus = hydration.count;
  }

  const unifiedMeta = await getFastTrackUnifiedMetadata();
  let lastUpdated: number | null = unifiedMeta?.updatedAt || null;
  let fileName: string | undefined = unifiedMeta?.fileName || undefined;
  let promotionCode: string | undefined = unifiedMeta?.promotionCode || undefined;
  let promotionTitle: string | undefined = unifiedMeta?.promotionTitle || undefined;

  if (!lastUpdated) {
    try {
      const updatedStr = localStorage.getItem(STORAGE_KEY_UPDATED);
      if (updatedStr) lastUpdated = Number(updatedStr);
      fileName = localStorage.getItem(STORAGE_KEY_FILENAME) || undefined;
      promotionCode = localStorage.getItem(STORAGE_KEY_PROMO_CODE) || undefined;
      promotionTitle = localStorage.getItem(STORAGE_KEY_PROMO_TITLE) || undefined;
    } catch (_) {}
  }

  // Si los metadatos se perdieron pero existen SKUs, reparar desde fallback
  if (!lastUpdated && totalSkus > 0) {
    repairLocalMetadataFallback();
    try {
      const updatedStr = localStorage.getItem(STORAGE_KEY_UPDATED);
      if (updatedStr) lastUpdated = Number(updatedStr);
      fileName = localStorage.getItem(STORAGE_KEY_FILENAME) || undefined;
      promotionCode = localStorage.getItem(STORAGE_KEY_PROMO_CODE) || undefined;
      promotionTitle = localStorage.getItem(STORAGE_KEY_PROMO_TITLE) || undefined;
    } catch (_) {}
  }

  const expStatus = getFastTrackExpirationStatus(unifiedMeta?.validUntil);

  return {
    isEnabled,
    totalSkus,
    lastUpdated,
    fileName,
    promotionCode,
    promotionTitle,
    validUntil: expStatus.validUntil,
    validFrom: expStatus.validFrom,
    isExpired: expStatus.isExpired,
    isExpiringSoon: expStatus.isExpiringSoon,
    daysRemaining: expStatus.daysRemaining,
    validUntilFormatted: expStatus.validUntilFormatted,
    validFromFormatted: expStatus.validFromFormatted,
  };
}
