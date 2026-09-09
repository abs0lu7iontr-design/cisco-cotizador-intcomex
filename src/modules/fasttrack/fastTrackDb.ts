// ============================================================================
// CISCO AUTOMATED - FAST TRACK INDEXEDDB PERSISTENCE ENGINE
// ============================================================================

import { FastTrackProduct, FastTrackDbStats } from './types';

const DB_NAME = 'CiscoFastTrackDB';
const DB_VERSION = 1;
const STORE_NAME = 'fast_track_catalog';

const STORAGE_KEY_ENABLED = 'cisco_fast_track_enabled';
const STORAGE_KEY_FILENAME = 'cisco_fast_track_filename';
const STORAGE_KEY_UPDATED = 'cisco_fast_track_last_updated';
const STORAGE_KEY_VALID_UNTIL = 'cisco_fast_track_valid_until';
const STORAGE_KEY_VALID_FROM = 'cisco_fast_track_valid_from';
const STORAGE_KEY_PROMO_CODE = 'cisco_fast_track_promo_code';
const STORAGE_KEY_PROMO_TITLE = 'cisco_fast_track_promo_title';

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
 * Guarda el catálogo Fast Track en IndexedDB.
 * PURGA completamente el almacén anterior antes de insertar los nuevos registros.
 */
export async function saveFastTrackCatalog(
  items: FastTrackProduct[],
  fileName: string = 'Catalogo_Fast_Track.xlsx',
  validUntil: number | null = null,
  validFrom: number | null = null,
  promotionCode?: string,
  promotionTitle?: string
): Promise<{ count: number }> {
  const db = await openFastTrackDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 1. Purgar datos previos
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      let insertedCount = 0;
      const now = Date.now();

      // 2. Inyectar registros sanitizados
      for (const item of items) {
        const cleanKey = sanitizePartNumberKey(item.partNumber);
        if (!cleanKey) continue;

        const record: FastTrackProduct = {
          ...item,
          partNumber: cleanKey,
          distributorDiscount: Number(item.distributorDiscount) || 0,
          updatedAt: now,
        };

        store.put(record);
        insertedCount++;
      }

      transaction.oncomplete = () => {
        // Actualizar metadatos en localStorage
        try {
          localStorage.setItem(STORAGE_KEY_FILENAME, fileName);
          localStorage.setItem(STORAGE_KEY_UPDATED, String(now));
          if (validUntil) {
            localStorage.setItem(STORAGE_KEY_VALID_UNTIL, String(validUntil));
          }
          if (validFrom) {
            localStorage.setItem(STORAGE_KEY_VALID_FROM, String(validFrom));
          }
          if (promotionCode) {
            localStorage.setItem(STORAGE_KEY_PROMO_CODE, promotionCode);
          }
          if (promotionTitle) {
            localStorage.setItem(STORAGE_KEY_PROMO_TITLE, promotionTitle);
          }
          if (localStorage.getItem(STORAGE_KEY_ENABLED) === null) {
            localStorage.setItem(STORAGE_KEY_ENABLED, 'true');
          }
        } catch (_) {}

        resolve({ count: insertedCount });
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error('Error guardando registros en IndexedDB.'));
      };
    };

    clearRequest.onerror = () => {
      reject(clearRequest.error || new Error('Error purgando base de datos Fast Track.'));
    };
  });
}

/**
 * Obtiene un ítem por Part Number desde IndexedDB.
 */
export async function getFastTrackItem(sku: string): Promise<FastTrackProduct | null> {
  const cleanKey = sanitizePartNumberKey(sku);
  if (!cleanKey) return null;

  try {
    const db = await openFastTrackDb();
    return new Promise((resolve) => {
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
  } catch (_) {
    return null;
  }
}

/**
 * Obtiene todos los Part Numbers disponibles en IndexedDB (para preview / administración).
 */
export async function getAllFastTrackItems(limit: number = 200): Promise<FastTrackProduct[]> {
  try {
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
 * Retorna la cantidad total de SKUs en la base de datos Fast Track.
 */
export async function getFastTrackCount(): Promise<number> {
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
 * Purga completamente la base de datos IndexedDB y limpia los metadatos.
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
 */
export async function getFastTrackStats(): Promise<FastTrackDbStats> {
  const isEnabled = isFastTrackAuditEnabled();
  const totalSkus = await getFastTrackCount();
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
