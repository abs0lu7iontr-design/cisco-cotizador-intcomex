// ============================================================================
// CISCO AUTOMATED - FAST TRACK PERSISTENCE ENGINE (INDEXEDDB + FIRESTORE CLOUD)
// ============================================================================
// Zero-State Armor & Resilience: Guarantees the Fast Track catalog is NEVER 0
// across updates, browser cache clears, private sessions, or new deployments.
// Dual storage: Ultra-fast local IndexedDB + Persistent Firestore Cloud Sync.
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

const DB_NAME = 'CiscoFastTrackDB';
const DB_VERSION = 1;
const STORE_NAME = 'fast_track_catalog';

const FAST_TRACK_COLLECTION = 'cisco_fast_track_catalog';
const FAST_TRACK_METADATA_DOC = '_metadata';
const CHUNK_SIZE = 200;

const STORAGE_KEY_ENABLED = 'cisco_fast_track_enabled';
const STORAGE_KEY_FILENAME = 'cisco_fast_track_filename';
const STORAGE_KEY_UPDATED = 'cisco_fast_track_last_updated';
const STORAGE_KEY_VALID_UNTIL = 'cisco_fast_track_valid_until';
const STORAGE_KEY_VALID_FROM = 'cisco_fast_track_valid_from';
const STORAGE_KEY_PROMO_CODE = 'cisco_fast_track_promo_code';
const STORAGE_KEY_PROMO_TITLE = 'cisco_fast_track_promo_title';

let hydrationPromise: Promise<{ count: number; source: string }> | null = null;

/**
 * Sanitiza un Part Number para usar como clave primaria uniforme en IndexedDB.
 */
export function sanitizePartNumberKey(sku: string): string {
  if (!sku) return '';
  return String(sku).trim().toUpperCase();
}

/**
 * Abre o inicializa la base de datos IndexedDB en el cliente.
 */
export function openFastTrackDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está soportado en este entorno.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'partNumber' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Error al abrir base de datos Fast Track.'));
    };
  });
}

/**
 * Calcula el estado de vencimiento del catálogo actual.
 */
export function getFastTrackExpirationStatus(validUntilTimestamp?: number | null) {
  let validUntil: number | null = null;
  let validFrom: number | null = null;

  if (validUntilTimestamp !== undefined) {
    validUntil = validUntilTimestamp;
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
 * Guarda el catálogo Fast Track en IndexedDB y opcionalmente lo sincroniza a Firestore Cloud.
 * PURGA completamente el almacén local antes de insertar los nuevos registros.
 */
export async function saveFastTrackCatalog(
  items: FastTrackProduct[],
  fileName: string = 'Catalogo_Fast_Track.xlsx',
  validUntil: number | null = null,
  validFrom: number | null = null,
  promotionCode?: string,
  promotionTitle?: string,
  syncToCloud: boolean = true
): Promise<{ count: number; cloudSynced: boolean }> {
  const db = await openFastTrackDb();

  const insertedRecords: FastTrackProduct[] = [];
  const now = Date.now();

  const count = await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 1. Purgar datos previos
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      let insertedCount = 0;

      // 2. Inyectar registros sanitizados
      for (const item of items) {
        const cleanKey = sanitizePartNumberKey(item.partNumber);
        if (!cleanKey) continue;

        const record: FastTrackProduct = {
          ...item,
          partNumber: cleanKey,
          distributorDiscount: Number(item.distributorDiscount) || 0,
          updatedAt: item.updatedAt || now,
        };

        store.put(record);
        insertedRecords.push(record);
        insertedCount++;
      }

      transaction.oncomplete = () => {
        // Actualizar metadatos en localStorage
        try {
          localStorage.setItem(STORAGE_KEY_FILENAME, fileName);
          localStorage.setItem(STORAGE_KEY_UPDATED, String(now));
          if (validUntil) {
            localStorage.setItem(STORAGE_KEY_VALID_UNTIL, String(validUntil));
          } else {
            localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
          }
          if (validFrom) {
            localStorage.setItem(STORAGE_KEY_VALID_FROM, String(validFrom));
          } else {
            localStorage.removeItem(STORAGE_KEY_VALID_FROM);
          }
          if (promotionCode) {
            localStorage.setItem(STORAGE_KEY_PROMO_CODE, promotionCode);
          } else {
            localStorage.removeItem(STORAGE_KEY_PROMO_CODE);
          }
          if (promotionTitle) {
            localStorage.setItem(STORAGE_KEY_PROMO_TITLE, promotionTitle);
          } else {
            localStorage.removeItem(STORAGE_KEY_PROMO_TITLE);
          }
          if (localStorage.getItem(STORAGE_KEY_ENABLED) === null) {
            localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
          }
        } catch (_) {}

        resolve(insertedCount);
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error('Error guardando registros en IndexedDB.'));
      };
    };

    clearRequest.onerror = () => {
      reject(clearRequest.error || new Error('Error purgando base de datos Fast Track.'));
    };
  });

  // 3. Sincronización a Firestore Cloud (en segundo plano / no bloqueante para offline)
  let cloudSynced = false;
  if (syncToCloud && count > 0) {
    try {
      const { db: firestoreDb, isReady } = getFirestoreInstance();
      if (isReady && firestoreDb) {
        const chunkCount = Math.ceil(insertedRecords.length / CHUNK_SIZE);
        const metadataPayload = {
          fileName,
          validUntil: validUntil || null,
          validFrom: validFrom || null,
          promotionCode: promotionCode || '',
          promotionTitle: promotionTitle || '',
          totalSkus: count,
          chunkCount,
          updatedAt: now,
        };

        const metaDocRef = doc(firestoreDb, FAST_TRACK_COLLECTION, FAST_TRACK_METADATA_DOC);
        await withTimeout(setDoc(metaDocRef, sanitizeForFirestore(metadataPayload), { merge: true }), 4000);

        for (let c = 0; c < chunkCount; c++) {
          const chunkItems = insertedRecords.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
          const chunkDocRef = doc(firestoreDb, FAST_TRACK_COLLECTION, `chunk_${c}`);
          await withTimeout(
            setDoc(chunkDocRef, sanitizeForFirestore({
              chunkIndex: c,
              totalChunks: chunkCount,
              items: chunkItems,
              updatedAt: now,
            }), { merge: true }),
            4000
          );
        }
        cloudSynced = true;
      }
    } catch (cloudErr) {
      console.warn('[FastTrack - Cloud Sync Warning]:', cloudErr);
    }
  }

  return { count, cloudSynced };
}

/**
 * Descarga y sincroniza el catálogo desde Firestore Cloud hacia IndexedDB.
 * Si Firestore Cloud no tiene catálogo o falla la conexión, activa el Catálogo Maestro Integrado (Master Seeds)
 * para garantizar inmunidad total al estado en 0.
 */
export async function syncFastTrackFromCloud(
  forceSeedFallback: boolean = false
): Promise<{ success: boolean; count: number; source: 'firestore' | 'master_seed' | 'local' | 'error' }> {
  // 1. Intentar descargar desde Firestore Cloud
  if (!forceSeedFallback) {
    try {
      const { db: firestoreDb, isReady } = getFirestoreInstance();
      if (isReady && firestoreDb) {
        const metaDocRef = doc(firestoreDb, FAST_TRACK_COLLECTION, FAST_TRACK_METADATA_DOC);
        const metaSnap = await withTimeout(getDoc(metaDocRef), 3500);

        if (metaSnap.exists()) {
          const metaData = metaSnap.data();
          const chunkCount = Number(metaData.chunkCount) || 0;
          const totalSkus = Number(metaData.totalSkus) || 0;

          if (chunkCount > 0 && totalSkus > 0) {
            const chunkPromises = [];
            for (let c = 0; c < chunkCount; c++) {
              const chunkRef = doc(firestoreDb, FAST_TRACK_COLLECTION, `chunk_${c}`);
              chunkPromises.push(withTimeout(getDoc(chunkRef), 3500));
            }

            const chunkSnaps = await Promise.all(chunkPromises);
            const allProducts: FastTrackProduct[] = [];
            for (const cSnap of chunkSnaps) {
              if (cSnap.exists()) {
                const cData = cSnap.data();
                if (Array.isArray(cData.items)) {
                  allProducts.push(...cData.items);
                }
              }
            }

            if (allProducts.length > 0) {
              await saveFastTrackCatalog(
                allProducts,
                metaData.fileName || 'Catalogo_FastTrack_Cloud.xlsx',
                metaData.validUntil || null,
                metaData.validFrom || null,
                metaData.promotionCode || '',
                metaData.promotionTitle || '',
                false // syncToCloud = false porque ya proviene de la nube
              );
              return { success: true, count: allProducts.length, source: 'firestore' };
            }
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
    true // Sincronizar también a Firestore para que quede registrado en la nube
  );

  return { success: true, count: masterResult.count, source: 'master_seed' };
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
          const updated = localStorage.getItem(STORAGE_KEY_UPDATED);
          if (!updated) {
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
 * Obtiene un ítem por Part Number desde IndexedDB.
 * Si la base está en 0, auto-hidrata antes de responder.
 */
export async function getFastTrackItem(sku: string): Promise<FastTrackProduct | null> {
  const cleanKey = sanitizePartNumberKey(sku);
  if (!cleanKey) return null;

  try {
    const db = await openFastTrackDb();
    const item = await new Promise<FastTrackProduct | null>((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cleanKey);

      request.onsuccess = () => {
        resolve((request.result as FastTrackProduct) || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });

    if (item) return item;

    // Si no encontró el ítem y la base está completamente vacía (0 registros),
    // hidratar y reintentar una sola vez
    const rawCount = await getFastTrackRawCount();
    if (rawCount === 0) {
      await ensureFastTrackHydrated();
      const reopenedDb = await openFastTrackDb();
      return new Promise<FastTrackProduct | null>((resolve) => {
        const transaction = reopenedDb.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cleanKey);
        request.onsuccess = () => resolve((request.result as FastTrackProduct) || null);
        request.onerror = () => resolve(null);
      });
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Obtiene todos los Part Numbers disponibles en IndexedDB (para preview / administración).
 */
export async function getAllFastTrackItems(limit: number = 200): Promise<FastTrackProduct[]> {
  try {
    let rawCount = await getFastTrackRawCount();
    if (rawCount === 0) {
      await ensureFastTrackHydrated();
    }

    const db = await openFastTrackDb();
    return new Promise((resolve) => {
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
        resolve([]);
      };
    });
  } catch (_) {
    return [];
  }
}

/**
 * Retorna la cantidad bruta de SKUs en IndexedDB sin activar auto-hidratación.
 */
export async function getFastTrackRawCount(): Promise<number> {
  try {
    const db = await openFastTrackDb();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve(countRequest.result || 0);
      };

      countRequest.onerror = () => {
        resolve(0);
      };
    });
  } catch (_) {
    return 0;
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
 * Purga completamente la base de datos IndexedDB y limpia los metadatos locales.
 */
export async function purgeFastTrackDb(): Promise<void> {
  try {
    const db = await openFastTrackDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        try {
          localStorage.removeItem(STORAGE_KEY_FILENAME);
          localStorage.removeItem(STORAGE_KEY_UPDATED);
          localStorage.removeItem(STORAGE_KEY_VALID_UNTIL);
          localStorage.removeItem(STORAGE_KEY_VALID_FROM);
          localStorage.removeItem(STORAGE_KEY_PROMO_CODE);
          localStorage.removeItem(STORAGE_KEY_PROMO_TITLE);
        } catch (_) {}
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Error al vaciar base de datos.'));
      };
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
 * Obtiene estadísticas generales del módulo Fast Track incluyendo metadatos y estado de expiración.
 * BLINDAJE: Si totalSkus === 0, ejecuta auto-hidratación para nunca mostrar un catálogo en 0.
 */
export async function getFastTrackStats(): Promise<FastTrackDbStats> {
  const isEnabled = isFastTrackAuditEnabled();
  let totalSkus = await getFastTrackRawCount();

  if (totalSkus === 0) {
    const hydration = await ensureFastTrackHydrated();
    totalSkus = hydration.count;
  }

  let lastUpdated: number | null = null;
  let fileName: string | undefined = undefined;
  let promotionCode: string | undefined = undefined;
  let promotionTitle: string | undefined = undefined;

  try {
    const updatedStr = localStorage.getItem(STORAGE_KEY_UPDATED);
    if (updatedStr) lastUpdated = Number(updatedStr);
    fileName = localStorage.getItem(STORAGE_KEY_FILENAME) || undefined;
    promotionCode = localStorage.getItem(STORAGE_KEY_PROMO_CODE) || undefined;
    promotionTitle = localStorage.getItem(STORAGE_KEY_PROMO_TITLE) || undefined;
  } catch (_) {}

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

  const expStatus = getFastTrackExpirationStatus();

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
