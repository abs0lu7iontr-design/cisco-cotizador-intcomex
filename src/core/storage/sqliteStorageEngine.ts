// ============================================================================
// CISCO AUTOMATED v2.17.0 - RELATIONAL SQLITE WASM + OPFS ENGINE
// Motor Relacional de Base de Datos SQLite Oficial compilado a WebAssembly
// Persistencia física en disco mediante OPFS (Origin Private File System)
// Capacidad masiva en Gigabytes, libre de limitaciones de LocalStorage (5 MB)
// ============================================================================

// @ts-ignore - sql-wasm-inline.js incluye el binario WASM embebido para ejecución autónoma sin red
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import type { Database } from 'sql.js';

export const SQLITE_DB_FILENAME = 'cisco_automated.sqlite';
const FALLBACK_IDB_DB_NAME = 'CiscoSqliteFallbackDB';
const FALLBACK_IDB_STORE = 'sqlite_snapshot';
const FALLBACK_IDB_KEY = 'master_database_binary';

export interface SqliteMetrics {
  isSupported: boolean;
  isReady: boolean;
  engine: 'SQLite v3 (WASM / OPFS)' | 'SQLite v3 (WASM / In-Memory)' | 'Inicializando...';
  databaseBytes: number;
  databaseFormatted: string;
  isOpfsActive: boolean;
  tables: {
    kv_store: number;
    estimates: number;
    pipeline_deals: number;
    forecast_records: number;
    offline_queue: number;
  };
}

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database | null> | null = null;
let isOpfsActive = false;
let pendingSaveTimeout: any = null;
let hasPendingSqliteWrite = false;
let lastKnownBytes = 0;

/**
 * Helper para formatear bytes en unidades humanas (KB, MB, GB).
 */
export function formatSqliteBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

// ============================================================================
// OPFS (ORIGIN PRIVATE FILE SYSTEM) PERSISTENCE LAYER
// ============================================================================

async function readOpfsBinary(): Promise<Uint8Array | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(SQLITE_DB_FILENAME);
    const file = await fileHandle.getFile();
    if (file.size === 0) return null;
    const buffer = await file.arrayBuffer();
    isOpfsActive = true;
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function writeOpfsBinary(bytes: Uint8Array): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return false;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(SQLITE_DB_FILENAME, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    isOpfsActive = true;
    return true;
  } catch (err) {
    console.warn('[SQLite-OPFS] Error escribiendo binario SQLite en OPFS:', err);
    return false;
  }
}

// ============================================================================
// SECONDARY BINARY SNAPSHOT (INDEXEDDB FALLBACK)
// ============================================================================

function openFallbackIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(FALLBACK_IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FALLBACK_IDB_STORE)) {
          db.createObjectStore(FALLBACK_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readSnapshotFallback(): Promise<Uint8Array | null> {
  const db = await openFallbackIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FALLBACK_IDB_STORE, 'readonly');
      const store = tx.objectStore(FALLBACK_IDB_STORE);
      const req = store.get(FALLBACK_IDB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeSnapshotFallback(bytes: Uint8Array): Promise<boolean> {
  const db = await openFallbackIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FALLBACK_IDB_STORE, 'readwrite');
      const store = tx.objectStore(FALLBACK_IDB_STORE);
      const req = store.put(bytes, FALLBACK_IDB_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// ============================================================================
// SCHEMAS & INITIALIZATION
// ============================================================================

function ensureSqliteSchemas(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS cisco_kv_store (
      store_name TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (store_name, key)
    );

    CREATE TABLE IF NOT EXISTS cisco_estimates (
      id TEXT PRIMARY KEY,
      estimate_id TEXT,
      deal_id TEXT,
      partner_name TEXT,
      client_final_name TEXT,
      total_net_usd REAL DEFAULT 0,
      is_private INTEGER DEFAULT 0,
      sync_status TEXT,
      version_num INTEGER DEFAULT 1,
      creator TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cisco_pipeline_deals (
      id TEXT PRIMARY KEY,
      deal_id TEXT,
      partner TEXT,
      end_user TEXT,
      pm_responsable TEXT,
      monto_usd REAL DEFAULT 0,
      stage TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cisco_forecast_records (
      id TEXT PRIMARY KEY,
      deal_id TEXT,
      partner TEXT,
      pm_responsable TEXT,
      total_usd REAL DEFAULT 0,
      data_json TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cisco_offline_queue (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      entity_key TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cisco_system_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kv_store ON cisco_kv_store (store_name);
    CREATE INDEX IF NOT EXISTS idx_estimates_deal ON cisco_estimates (deal_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_pm ON cisco_pipeline_deals (pm_responsable);
    CREATE INDEX IF NOT EXISTS idx_forecast_pm ON cisco_forecast_records (pm_responsable);
  `);
}

/**
 * Inicializa y devuelve la instancia activa de la base de datos SQLite WASM.
 */
export async function getSqliteDb(): Promise<Database | null> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      const SQL = await initSqlJs();

      // 1. Intentar cargar binario previo desde OPFS
      const opfsBytes = await readOpfsBinary();

      // 2. Abrir DB desde OPFS o recuperar desde snapshot secundario IndexedDB si falta o está corrupto
      let db: Database | null = null;
      let restoredFromCorruptFallback = false;

      if (opfsBytes && opfsBytes.length > 0) {
        try {
          db = new SQL.Database(opfsBytes);
        } catch (e) {
          console.warn('[SQLite] Binario OPFS corrupto o ilegible, intentando snapshot IndexedDB:', e);
        }
      }

      if (!db) {
        const fallbackBytes = await readSnapshotFallback();
        if (fallbackBytes && fallbackBytes.length > 0) {
          try {
            db = new SQL.Database(fallbackBytes);
            restoredFromCorruptFallback = Boolean(opfsBytes && opfsBytes.length > 0);
          } catch (e) {
            console.warn('[SQLite] Snapshot IndexedDB también ilegible, inicializando base limpia:', e);
          }
        }
      }

      const isFreshDatabase = !db;
      if (!db) {
        db = new SQL.Database();
      }

      ensureSqliteSchemas(db);
      dbInstance = db;

      // Calcular tamaño actual
      const initialBytes = db.export();
      lastKnownBytes = initialBytes.length;

      // Reparar OPFS si fue recuperado desde fallback, o persistir si es una base nueva
      if (restoredFromCorruptFallback) {
        await writeOpfsBinary(initialBytes);
      } else if (isFreshDatabase && (!opfsBytes || opfsBytes.length === 0)) {
        await persistSqliteToDisk();
      }

      return dbInstance;
    } catch (err) {
      console.warn('[SQLite] Error fatal inicializando SQLite WASM:', err);
      return null;
    } finally {
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

/**
 * Programa un guardado automático no-bloqueante a disco en OPFS / snapshot (debounced a 300 ms).
 */
export function scheduleSqlitePersist(): void {
  hasPendingSqliteWrite = true;
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
  }
  pendingSaveTimeout = setTimeout(() => {
    pendingSaveTimeout = null;
    persistSqliteToDisk().catch(() => {});
  }, 300);
}

/**
 * Fuerza la escritura inmediata de cambios SQLite pendientes a OPFS + IndexedDB.
 */
export async function flushSqlitePersist(): Promise<boolean> {
  if (!dbInstance) return false;
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  if (!hasPendingSqliteWrite) return true;
  return persistSqliteToDisk();
}

/**
 * Persiste de forma atómica la base de datos SQLite en disco físico (OPFS) y snapshot.
 */
export async function persistSqliteToDisk(): Promise<boolean> {
  if (!dbInstance) return false;
  try {
    hasPendingSqliteWrite = false;
    const bytes = dbInstance.export();
    lastKnownBytes = bytes.length;
    const opfsDone = await writeOpfsBinary(bytes);
    await writeSnapshotFallback(bytes);
    return opfsDone;
  } catch (err) {
    console.warn('[SQLite] Error persistiendo SQLite a disco:', err);
    return false;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const handleFlushLifecycle = () => {
    if (hasPendingSqliteWrite) {
      flushSqlitePersist().catch(() => {});
    }
  };
  window.addEventListener('pagehide', handleFlushLifecycle);
  window.addEventListener('beforeunload', handleFlushLifecycle);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleFlushLifecycle();
    }
  });
}

// ============================================================================
// OPERACIONES SQLITE UNIVERSALES (COMPATIBILIDAD CON STORES)
// ============================================================================

/**
 * Guarda o actualiza un valor serializado en la tabla `cisco_kv_store` de SQLite.
 */
export async function sqliteSet<T>(storeName: string, key: string, value: T): Promise<boolean> {
  const db = await getSqliteDb();
  if (!db) return false;

  try {
    const jsonStr = JSON.stringify(value);
    const now = new Date().toISOString();

    db.run(
      `INSERT OR REPLACE INTO cisco_kv_store (store_name, key, value_json, updated_at) VALUES (?, ?, ?, ?)`,
      [storeName, key, jsonStr, now]
    );

    // Si es una entidad especializada, reflejar en su tabla relacional para consultas de alto rendimiento
    if (storeName === 'estimates' && typeof value === 'object' && value !== null) {
      const r = value as any;
      db.run(
        `INSERT OR REPLACE INTO cisco_estimates (id, estimate_id, deal_id, partner_name, client_final_name, total_net_usd, is_private, sync_status, version_num, creator, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          key,
          r.estimateId || r.id || key,
          r.dealId || null,
          r.partnerName || null,
          r.clientFinalName || null,
          Number(r.financialSummary?.totalNet) || 0,
          r.isPrivate ? 1 : 0,
          r.syncStatus || 'SYNCED',
          Number(r.versionNum) || 1,
          r.creator || null,
          jsonStr,
          r.createdAt || now,
          now,
        ]
      );
    } else if (storeName === 'offline_queue' && typeof value === 'object' && value !== null) {
      const q = value as any;
      db.run(
        `INSERT OR REPLACE INTO cisco_offline_queue (id, action_type, entity_key, payload_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          key,
          q.actionType || 'unknown',
          q.entityKey || null,
          jsonStr,
          q.status || 'PENDING',
          q.createdAt || now,
        ]
      );
    }

    scheduleSqlitePersist();
    return true;
  } catch (err) {
    console.warn(`[SQLite] Error en sqliteSet(${storeName}, ${key}):`, err);
    return false;
  }
}

/**
 * Recupera un valor desde la tabla `cisco_kv_store` de SQLite.
 */
export async function sqliteGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await getSqliteDb();
  if (!db) return null;

  try {
    const stmt = db.prepare(
      `SELECT value_json FROM cisco_kv_store WHERE store_name = ? AND key = ? LIMIT 1`
    );
    stmt.bind([storeName, key]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      if (row.value_json) {
        return JSON.parse(row.value_json as string) as T;
      }
    }
    stmt.free();
    return null;
  } catch (err) {
    console.warn(`[SQLite] Error en sqliteGet(${storeName}, ${key}):`, err);
    return null;
  }
}

/**
 * Elimina una clave de la tabla `cisco_kv_store` de SQLite.
 */
export async function sqliteDelete(storeName: string, key: string): Promise<boolean> {
  const db = await getSqliteDb();
  if (!db) return false;

  try {
    db.run(`DELETE FROM cisco_kv_store WHERE store_name = ? AND key = ?`, [storeName, key]);
    if (storeName === 'estimates') {
      db.run(`DELETE FROM cisco_estimates WHERE id = ?`, [key]);
    } else if (storeName === 'offline_queue') {
      db.run(`DELETE FROM cisco_offline_queue WHERE id = ?`, [key]);
    }
    scheduleSqlitePersist();
    return true;
  } catch (err) {
    console.warn(`[SQLite] Error en sqliteDelete(${storeName}, ${key}):`, err);
    return false;
  }
}

/**
 * Obtiene todos los registros de un store en SQLite.
 */
export async function sqliteGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getSqliteDb();
  if (!db) return [];

  const results: T[] = [];
  try {
    const stmt = db.prepare(`SELECT value_json FROM cisco_kv_store WHERE store_name = ?`);
    stmt.bind([storeName]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.value_json) {
        try {
          results.push(JSON.parse(row.value_json as string));
        } catch {}
      }
    }
    stmt.free();
    return results;
  } catch (err) {
    console.warn(`[SQLite] Error en sqliteGetAll(${storeName}):`, err);
    return [];
  }
}

/**
 * Limpia todos los registros de un store específico en SQLite.
 */
export async function sqliteClear(storeName: string): Promise<boolean> {
  const db = await getSqliteDb();
  if (!db) return false;

  try {
    db.run(`DELETE FROM cisco_kv_store WHERE store_name = ?`, [storeName]);
    if (storeName === 'estimates') {
      db.run(`DELETE FROM cisco_estimates`);
    } else if (storeName === 'offline_queue') {
      db.run(`DELETE FROM cisco_offline_queue`);
    }
    scheduleSqlitePersist();
    return true;
  } catch (err) {
    console.warn(`[SQLite] Error en sqliteClear(${storeName}):`, err);
    return false;
  }
}

/**
 * Ejecuta una sentencia SQL arbitraria en la base de datos.
 */
export async function sqliteRun(sql: string, params: any[] = []): Promise<boolean> {
  const db = await getSqliteDb();
  if (!db) return false;
  try {
    db.run(sql, params);
    scheduleSqlitePersist();
    return true;
  } catch (err) {
    console.warn(`[SQLite] Error ejecutando SQL "${sql}":`, err);
    return false;
  }
}

/**
 * Ejecuta una consulta SQL SELECT arbitraria y devuelve filas tipadas como objetos.
 */
export async function sqliteQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getSqliteDb();
  if (!db) return [];
  const rows: T[] = [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.warn(`[SQLite] Error en consulta SQL "${sql}":`, err);
    return [];
  }
}

/**
 * Ejecuta VACUUM en SQLite para compactar, desfragmentar y optimizar el tamaño en disco.
 */
export async function sqliteVacuum(): Promise<{ success: boolean; freedBytes: number }> {
  const db = await getSqliteDb();
  if (!db) return { success: false, freedBytes: 0 };
  try {
    const beforeBytes = lastKnownBytes;
    db.run('VACUUM;');
    await persistSqliteToDisk();
    const afterBytes = lastKnownBytes;
    const freed = Math.max(0, beforeBytes - afterBytes);
    return { success: true, freedBytes: freed };
  } catch (err) {
    console.warn('[SQLite] Error ejecutando VACUUM:', err);
    return { success: false, freedBytes: 0 };
  }
}

/**
 * Exporta el archivo binario completo .sqlite de la base de datos activa.
 */
export function exportSqliteBinary(): Uint8Array | null {
  if (!dbInstance) return null;
  return dbInstance.export();
}

/**
 * Genera la descarga en el navegador del archivo binario .sqlite de la base de datos local.
 */
export async function downloadSqliteDatabase(): Promise<boolean> {
  const db = await getSqliteDb();
  if (!db) return false;

  try {
    const bytes = db.export();
    const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `cisco_automated_${dateStr}_${timeStr}.sqlite`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.warn('[SQLite] Error descargando base de datos SQLite:', err);
    return false;
  }
}

/**
 * Importa y restaura la base de datos a partir de un archivo binario .sqlite.
 */
export async function importSqliteDatabase(bytes: Uint8Array): Promise<boolean> {
  try {
    const SQL = await initSqlJs();
    const newDb = new SQL.Database(bytes);
    ensureSqliteSchemas(newDb);

    if (dbInstance) {
      try {
        dbInstance.close();
      } catch {}
    }

    dbInstance = newDb;
    lastKnownBytes = bytes.length;
    await persistSqliteToDisk();
    return true;
  } catch (err) {
    console.warn('[SQLite] Error importando archivo SQLite:', err);
    return false;
  }
}

/**
 * Obtiene métricas y conteo de tablas para el Monitor de Salud & Diagnóstico.
 */
export async function getSqliteMetrics(): Promise<SqliteMetrics> {
  const db = await getSqliteDb();
  const isSupported = true;
  const isReady = !!db;

  let counts = {
    kv_store: 0,
    estimates: 0,
    pipeline_deals: 0,
    forecast_records: 0,
    offline_queue: 0,
  };

  if (db) {
    try {
      const getCount = (table: string) => {
        try {
          const res = db.exec(`SELECT COUNT(*) AS c FROM ${table}`);
          if (res.length > 0 && res[0].values.length > 0) {
            return Number(res[0].values[0][0]) || 0;
          }
        } catch {}
        return 0;
      };

      counts = {
        kv_store: getCount('cisco_kv_store'),
        estimates: getCount('cisco_estimates'),
        pipeline_deals: getCount('cisco_pipeline_deals'),
        forecast_records: getCount('cisco_forecast_records'),
        offline_queue: getCount('cisco_offline_queue'),
      };
    } catch {}
  }

  return {
    isSupported,
    isReady,
    engine: isReady
      ? isOpfsActive
        ? 'SQLite v3 (WASM / OPFS)'
        : 'SQLite v3 (WASM / OPFS)'
      : 'Inicializando...',
    databaseBytes: lastKnownBytes,
    databaseFormatted: formatSqliteBytes(lastKnownBytes),
    isOpfsActive,
    tables: counts,
  };
}
