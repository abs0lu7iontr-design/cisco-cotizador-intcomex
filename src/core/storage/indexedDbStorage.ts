// ============================================================================
// CISCO AUTOMATED v2.17.0 - UNIFIED STORAGE ADAPTER (SQLITE WASM + OPFS TIER 1)
// Motor Relacional SQLite WASM + OPFS en disco con espejo secundario IndexedDB
// Alta capacidad de almacenamiento en Gigabytes, libre de límites de LocalStorage (5 MB)
// ============================================================================

import {
  sqliteSet,
  sqliteGet,
  sqliteDelete,
  sqliteGetAll,
  sqliteClear,
  getSqliteDb,
} from './sqliteStorageEngine';

const DB_NAME = 'CiscoAutomatedDB';
const DB_VERSION = 1;

export const STORES = {
  KEYVAL: 'keyval',
  ESTIMATES: 'estimates',
  ROW_NOTES: 'row_notes',
  OFFLINE_QUEUE: 'offline_queue',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const inMemoryFallback = new Map<string, any>();

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Abre o inicializa la base de datos IndexedDB local como respaldo secundario.
 */
export function getIndexedDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORES.KEYVAL)) {
          db.createObjectStore(STORES.KEYVAL);
        }
        if (!db.objectStoreNames.contains(STORES.ESTIMATES)) {
          db.createObjectStore(STORES.ESTIMATES);
        }
        if (!db.objectStoreNames.contains(STORES.ROW_NOTES)) {
          db.createObjectStore(STORES.ROW_NOTES);
        }
        if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
          db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (e) => {
        console.warn('[IndexedDB] Error al abrir base de datos, usando fallback:', e);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Base de datos bloqueada por otra pestaña.');
        resolve(null);
      };
    } catch (err) {
      console.warn('[IndexedDB] Excepción abriendo IndexedDB:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Guarda un valor en el store especificado.
 * Tier 1: SQLite Relacional WASM + OPFS en disco.
 * Tier 2: Respaldo secundario en IndexedDB / Memoria.
 */
export async function idbSet<T>(storeName: StoreName, key: string, value: T): Promise<boolean> {
  // 1. Guardar primero en el motor relacional SQLite WASM
  try {
    const sqliteOk = await sqliteSet(storeName, key, value);
    if (sqliteOk) {
      // Opcionalmente reflejar en IDB como copia secundaria pasiva si está disponible
      saveToSecondaryIdb(storeName, key, value).catch(() => {});
      return true;
    }
  } catch (err) {
    console.warn(`[StorageAdapter] Fallback desde SQLite en set(${storeName}, ${key}):`, err);
  }

  // 2. Fallback a IndexedDB
  const db = await getIndexedDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value, store.keyPath ? undefined : key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          fallbackLocalStorageSet(storeName, key, value);
          resolve(true);
        };
      } catch (err) {
        fallbackLocalStorageSet(storeName, key, value);
        resolve(true);
      }
    });
  }

  fallbackLocalStorageSet(storeName, key, value);
  return true;
}

async function saveToSecondaryIdb<T>(storeName: StoreName, key: string, value: T): Promise<void> {
  const db = await getIndexedDb();
  if (!db) return;
  try {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(value, store.keyPath ? undefined : key);
  } catch {}
}

/**
 * Recupera un valor del store especificado.
 * Tier 1: Consulta de microsegundos en SQLite WASM.
 * Tier 2: Consulta en IndexedDB con auto-migración a SQLite si existe.
 */
export async function idbGet<T>(storeName: StoreName, key: string): Promise<T | null> {
  // 1. Intentar primero en SQLite
  try {
    const sqliteVal = await sqliteGet<T>(storeName, key);
    if (sqliteVal !== null && sqliteVal !== undefined) {
      return sqliteVal;
    }
  } catch {}

  // 2. Si no está en SQLite, buscar en IndexedDB heredado
  const db = await getIndexedDb();
  if (db) {
    const legacyVal = await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result !== undefined) {
            resolve(req.result as T);
          } else {
            resolve(fallbackLocalStorageGet<T>(storeName, key));
          }
        };

        req.onerror = () => {
          resolve(fallbackLocalStorageGet<T>(storeName, key));
        };
      } catch {
        resolve(fallbackLocalStorageGet<T>(storeName, key));
      }
    });

    if (legacyVal !== null && legacyVal !== undefined) {
      // Auto-migrar silenciosamente a SQLite para futuras consultas
      sqliteSet(storeName, key, legacyVal).catch(() => {});
      return legacyVal;
    }
  }

  return fallbackLocalStorageGet<T>(storeName, key);
}

/**
 * Elimina una clave del store en SQLite e IndexedDB.
 */
export async function idbDelete(storeName: StoreName, key: string): Promise<boolean> {
  try {
    await sqliteDelete(storeName, key);
  } catch {}

  const db = await getIndexedDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);

        req.onsuccess = () => {
          fallbackLocalStorageDelete(storeName, key);
          resolve(true);
        };
        req.onerror = () => {
          fallbackLocalStorageDelete(storeName, key);
          resolve(true);
        };
      } catch {
        fallbackLocalStorageDelete(storeName, key);
        resolve(true);
      }
    });
  }

  fallbackLocalStorageDelete(storeName, key);
  return true;
}

/**
 * Obtiene todos los registros de un store (SQLite con fallback a IndexedDB).
 */
export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  try {
    const sqliteRecords = await sqliteGetAll<T>(storeName);
    if (sqliteRecords.length > 0) {
      return sqliteRecords;
    }
  } catch {}

  const db = await getIndexedDb();
  if (db) {
    const legacyRecords = await new Promise<T[]>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(fallbackGetAll<T>(storeName));
      } catch {
        resolve(fallbackGetAll<T>(storeName));
      }
    });

    if (legacyRecords.length > 0) {
      // Migrar en bloque a SQLite
      Promise.all(
        legacyRecords.map((rec: any, idx: number) => {
          const k = rec?.id || String(idx);
          return sqliteSet(storeName, k, rec);
        })
      ).catch(() => {});
      return legacyRecords;
    }
  }

  return fallbackGetAll<T>(storeName);
}

/**
 * Limpia por completo un store en SQLite e IndexedDB.
 */
export async function idbClear(storeName: StoreName): Promise<boolean> {
  try {
    await sqliteClear(storeName);
  } catch {}

  const db = await getIndexedDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  return true;
}

// ============================================================================
// HELPERS DE FALLBACK LOCALSTORAGE & MEMORY
// ============================================================================

function getFallbackKey(storeName: string, key: string): string {
  return `idb_fallback_${storeName}_${key}`;
}

function fallbackLocalStorageSet<T>(storeName: string, key: string, value: T): void {
  const fbKey = getFallbackKey(storeName, key);
  try {
    const serialized = JSON.stringify(value);
    // Preservar LocalStorage ultra-ligero (< 25 KB) para evitar saturación del límite de 5 MB
    if (typeof localStorage !== 'undefined' && serialized.length < 25_000) {
      localStorage.setItem(fbKey, serialized);
      return;
    }
  } catch {}
  inMemoryFallback.set(fbKey, JSON.parse(JSON.stringify(value)));
}

function fallbackLocalStorageGet<T>(storeName: string, key: string): T | null {
  const fbKey = getFallbackKey(storeName, key);
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(fbKey);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
      const legacyItem = localStorage.getItem(key);
      if (legacyItem !== null) {
        try {
          return JSON.parse(legacyItem) as T;
        } catch {
          return legacyItem as unknown as T;
        }
      }
    }
  } catch {}
  return inMemoryFallback.has(fbKey) ? (inMemoryFallback.get(fbKey) as T) : null;
}

function fallbackLocalStorageDelete(storeName: string, key: string): void {
  const fbKey = getFallbackKey(storeName, key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(fbKey);
      localStorage.removeItem(key);
    }
  } catch {}
  inMemoryFallback.delete(fbKey);
}

function fallbackGetAll<T>(storeName: string): T[] {
  const prefix = `idb_fallback_${storeName}_`;
  const results: T[] = [];

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const val = localStorage.getItem(k);
          if (val) results.push(JSON.parse(val));
        }
      }
      if (results.length > 0) return results;
    }
  } catch {}

  for (const [k, v] of inMemoryFallback.entries()) {
    if (k.startsWith(prefix)) {
      results.push(v);
    }
  }
  return results;
}
