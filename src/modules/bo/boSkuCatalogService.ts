// ============================================================================
// CISCO AUTOMATED v2.1 - BO SKU CATALOG SERVICE (FIRESTORE CLOUD + LOCAL CACHE)
// Auto-fill and persistence for Cisco Part Number <-> Intcomex SKU mappings
// Item 13: Separación de variante exacta vs base/alias sin sobrescritura
// ============================================================================

import ExcelJS from 'exceljs';
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  getFirestoreInstance,
  readProjectScopedStorage,
  writeProjectScopedStorage,
  registerProjectScopedCleanup,
  captureProjectContext,
  isProjectContextCurrent,
} from '../cloud/firebaseConfig';
import { sanitizeForFirestore, withTimeout } from '../cloud/firestoreService';
import { formatBoPartNumber, normalizeBasePartNumber } from './boTypes';

export type BoSkuMappingProvenance =
  | 'MANUAL'
  | 'EXCEL_IMPORT'
  | 'CLOUD_SYNC'
  | 'DESKTOP_SQLITE'
  | 'LEGACY';

export interface BoSkuCatalogRecord {
  partNumber: string;        // Ej. "C9200L-24P-4G-E-CBN"
  basePartNumber: string;    // Ej. "C9200L-24P-4G-E"
  sku: string;               // Ej. "EN614MKC66" (SKU Intcomex)
  updatedAt: string;         // ISO 8601
  updatedBy?: string;        // Nombre o usuario
  source?: BoSkuMappingProvenance;
  isExactVariant?: boolean;  // true cuando representa una variante explícita y no un alias sintético
}

export type BoSkuResolutionStatus =
  | 'EXACT_MATCH'
  | 'ALIAS_MATCH'
  | 'AMBIGUOUS_ALIAS'
  | 'NOT_FOUND';

export interface BoSkuResolutionResult {
  status: BoSkuResolutionStatus;
  sku: string;
  matchedKey?: string;
  basePartNumber: string;
  candidates: string[];
  variantRecords: BoSkuCatalogRecord[];
}

export interface StructuredBoSkuCatalog {
  exactByPartNumber: Record<string, BoSkuCatalogRecord>;
  variantsByBase: Record<string, Record<string, BoSkuCatalogRecord>>;
}

const BO_SKU_COLLECTION = 'cisco_bo_sku_catalog';
const LOCAL_BO_SKU_CACHE_KEY = 'cisco_bo_sku_catalog_cache_v1';
const LOCAL_BO_SKU_VAULT_KEY = 'cisco_bo_sku_catalog_vault_v1';
const LOCAL_BO_SKU_STRUCTURED_KEY = 'cisco_bo_sku_catalog_structured_v2';
export const AMBIGUOUS_BASE_SENTINEL_PREFIX = '__AMBIGUOUS_SKU_CANDIDATES__:';

let memoryBoSkuCache: Record<string, string> = {};
let memoryStructuredCatalog: StructuredBoSkuCatalog = {
  exactByPartNumber: {},
  variantsByBase: {},
};

export function clearBoSkuCatalogMemoryCache(): void {
  memoryBoSkuCache = {};
  memoryStructuredCatalog = {
    exactByPartNumber: {},
    variantsByBase: {},
  };
}

registerProjectScopedCleanup(clearBoSkuCatalogMemoryCache);

/**
 * Normaliza una clave de Part Number a mayúsculas y sin espacios redundantes
 */
export function normalizePartNumberKey(pn: string): string {
  return (pn || '').trim().toUpperCase();
}

function createEmptyStructuredCatalog(): StructuredBoSkuCatalog {
  return {
    exactByPartNumber: {},
    variantsByBase: {},
  };
}

/**
 * Obtiene el catálogo estructurado (variantes exactas + índice por basePartNumber con procedencia).
 */
export function getStructuredBoSkuCatalog(): StructuredBoSkuCatalog {
  try {
    const raw = readProjectScopedStorage(LOCAL_BO_SKU_STRUCTURED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StructuredBoSkuCatalog>;
      if (parsed && typeof parsed === 'object') {
        return {
          exactByPartNumber: {
            ...memoryStructuredCatalog.exactByPartNumber,
            ...(parsed.exactByPartNumber || {}),
          },
          variantsByBase: {
            ...memoryStructuredCatalog.variantsByBase,
            ...(parsed.variantsByBase || {}),
          },
        };
      }
    }
  } catch (_) {}
  return {
    exactByPartNumber: { ...memoryStructuredCatalog.exactByPartNumber },
    variantsByBase: { ...memoryStructuredCatalog.variantsByBase },
  };
}

export function saveStructuredBoSkuCatalog(structured: StructuredBoSkuCatalog): void {
  memoryStructuredCatalog = {
    exactByPartNumber: { ...structured.exactByPartNumber },
    variantsByBase: { ...structured.variantsByBase },
  };
  try {
    writeProjectScopedStorage(LOCAL_BO_SKU_STRUCTURED_KEY, JSON.stringify(memoryStructuredCatalog));
  } catch (_) {}
}

/**
 * Registra un mapeo exacto dentro del catálogo estructurado sin sobrescribir otras variantes
 * de la misma base.
 */
export function registerStructuredSkuRecord(
  structured: StructuredBoSkuCatalog,
  record: BoSkuCatalogRecord
): StructuredBoSkuCatalog {
  const exactKey = normalizePartNumberKey(record.partNumber);
  const cleanSku = (record.sku || '').trim().toUpperCase();
  if (!exactKey || !cleanSku) return structured;

  const baseKey = normalizePartNumberKey(
    record.basePartNumber || normalizeBasePartNumber(record.partNumber)
  );
  const normalizedRecord: BoSkuCatalogRecord = {
    partNumber: record.partNumber.trim(),
    basePartNumber: baseKey,
    sku: cleanSku,
    updatedAt: record.updatedAt || new Date().toISOString(),
    updatedBy: record.updatedBy || 'usuario',
    source: record.source || 'MANUAL',
    isExactVariant: record.isExactVariant ?? true,
  };

  structured.exactByPartNumber[exactKey] = normalizedRecord;
  if (baseKey) {
    if (!structured.variantsByBase[baseKey]) {
      structured.variantsByBase[baseKey] = {};
    }
    structured.variantsByBase[baseKey][exactKey] = normalizedRecord;
  }
  return structured;
}

/**
 * Deriva la vista plana `Record<string, string>` a partir del catálogo estructurado:
 * - Cada variante exacta conserva su `partNumber -> sku` propio sin ser sobrescrita.
 * - Una clave `basePartNumber` solo se rellena en el mapa plano si NO existe un mapeo exacto
 *   propio para esa clave y TODAS las variantes de esa base apuntan a un único SKU unívoco.
 * - Si existen >= 2 SKUs distintos bajo la misma base y la base no tiene mapeo exacto propio,
 *   se marca con `AMBIGUOUS_BASE_SENTINEL_PREFIX` para impedir resoluciones silenciosas erróneas.
 */
export function deriveFlatCatalogFromStructured(
  structured: StructuredBoSkuCatalog,
  legacyFlat?: Record<string, string>
): Record<string, string> {
  const flat: Record<string, string> = {};

  if (legacyFlat) {
    for (const [k, v] of Object.entries(legacyFlat)) {
      if (k && v && !String(v).startsWith(AMBIGUOUS_BASE_SENTINEL_PREFIX)) {
        flat[normalizePartNumberKey(k)] = String(v).trim().toUpperCase();
      }
    }
  }

  // 1. Evaluar grupos por basePartNumber primero
  for (const [baseKey, variantsMap] of Object.entries(structured.variantsByBase)) {
    const variantRecords = Object.values(variantsMap || {});
    const distinctSkus = Array.from(
      new Set(variantRecords.map((r) => (r.sku || '').trim().toUpperCase()).filter(Boolean))
    ).sort();

    if (distinctSkus.length === 1) {
      flat[baseKey] = distinctSkus[0];
    } else if (distinctSkus.length > 1) {
      // Base ambigua: no permitir que la última variante guardada pise a las demás
      flat[baseKey] = `${AMBIGUOUS_BASE_SENTINEL_PREFIX}${distinctSkus.join('|')}`;
    }
  }

  // 2. Aplicar todas las variantes exactas (siempre tienen prioridad sobre su propia clave exacta)
  for (const [exactKey, rec] of Object.entries(structured.exactByPartNumber)) {
    const baseEntry = structured.variantsByBase[exactKey];
    if (baseEntry) {
      const distinctForBase = Array.from(
        new Set(Object.values(baseEntry).map((r) => (r.sku || '').trim().toUpperCase()).filter(Boolean))
      );
      // Si exactKey es exactamente igual a la base pero fue creada como alias sintético heredado y hoy hay conflicto,
      // mantener el centinela ambiguo a menos que haya sido guardada explícitamente como variante exacta única.
      if (distinctForBase.length > 1 && rec.isExactVariant === false) {
        continue;
      }
    }
    flat[exactKey] = (rec.sku || '').trim().toUpperCase();
  }

  return flat;
}

/**
 * Obtiene el catálogo de SKUs en memoria desde LocalStorage multi-capa (o fallback en memoria)
 */
export function getLocalBoSkuCache(): Record<string, string> {
  try {
    const raw1 = readProjectScopedStorage(LOCAL_BO_SKU_CACHE_KEY);
    const raw2 = readProjectScopedStorage(LOCAL_BO_SKU_VAULT_KEY);
    const p1 = raw1 ? JSON.parse(raw1) : {};
    const p2 = raw2 ? JSON.parse(raw2) : {};
    const mergedLegacy = { ...memoryBoSkuCache, ...p2, ...p1 };
    const structured = getStructuredBoSkuCatalog();
    if (Object.keys(structured.exactByPartNumber).length > 0) {
      return deriveFlatCatalogFromStructured(structured, mergedLegacy);
    }
    if (Object.keys(mergedLegacy).length > 0) return mergedLegacy;
    return memoryBoSkuCache;
  } catch (_) {
    return memoryBoSkuCache;
  }
}

/**
 * Guarda el mapa en LocalStorage redundante (y en memoria fallback)
 */
export function saveLocalBoSkuCache(map: Record<string, string>) {
  memoryBoSkuCache = { ...map };
  try {
    const serialized = JSON.stringify(map);
    writeProjectScopedStorage(LOCAL_BO_SKU_CACHE_KEY, serialized);
    writeProjectScopedStorage(LOCAL_BO_SKU_VAULT_KEY, serialized);
  } catch (_) {}
}

/**
 * Item 13: Resuelve un Part Number contra el catálogo distinguiendo explícitamente:
 * 1. `EXACT_MATCH`: coincidencia exacta de la variante consultada.
 * 2. `ALIAS_MATCH`: coincidencia unívoca por `basePartNumber` o variante equivalente sin conflicto.
 * 3. `AMBIGUOUS_ALIAS`: existen múltiples variantes de la misma base con SKUs distintos y la variante
 *    consultada no tiene mapeo exacto propio; devuelve `sku: ''` y `candidates` para evitar errores silenciosos.
 * 4. `NOT_FOUND`: sin coincidencias.
 */
export function resolveSkuFromCatalog(
  partNumber: string,
  catalogOverride?: Record<string, string>
): BoSkuResolutionResult {
  const key = normalizePartNumberKey(partNumber);
  const baseKey = normalizePartNumberKey(normalizeBasePartNumber(partNumber));
  if (!key) {
    return {
      status: 'NOT_FOUND',
      sku: '',
      basePartNumber: '',
      candidates: [],
      variantRecords: [],
    };
  }

  const structured = getStructuredBoSkuCatalog();
  const flatCatalog = catalogOverride || getLocalBoSkuCache();
  const baseVariantsMap = structured.variantsByBase[baseKey] || {};
  const variantRecords = Object.values(baseVariantsMap);

  // 1. Verificar coincidencia exacta en el catálogo estructurado (siempre que no sea un alias base sintético ambiguo)
  const exactStructured = structured.exactByPartNumber[key];
  const rawFlatExact = flatCatalog[key];

  if (exactStructured && exactStructured.isExactVariant !== false) {
    // Si el usuario consulta exactamente la clave base desnuda (key === baseKey) y existen múltiples variantes
    // distintas registradas bajo esa misma base, verificamos si hay ambigüedad.
    const distinctBaseSkus = Array.from(
      new Set(variantRecords.map((r) => (r.sku || '').trim().toUpperCase()).filter(Boolean))
    ).sort();
    if (key === baseKey && distinctBaseSkus.length > 1) {
      return {
        status: 'AMBIGUOUS_ALIAS',
        sku: '',
        matchedKey: baseKey,
        basePartNumber: baseKey,
        candidates: distinctBaseSkus,
        variantRecords,
      };
    }
    return {
      status: 'EXACT_MATCH',
      sku: exactStructured.sku,
      matchedKey: key,
      basePartNumber: baseKey,
      candidates: [exactStructured.sku],
      variantRecords: variantRecords.length > 0 ? variantRecords : [exactStructured],
    };
  }

  if (
    rawFlatExact &&
    !rawFlatExact.startsWith(AMBIGUOUS_BASE_SENTINEL_PREFIX) &&
    variantRecords.length === 0
  ) {
    // Verificar si en el mapa plano pasado por parámetro existen variantes hermanas con distinto SKU
    const siblingKeys = [
      baseKey,
      normalizePartNumberKey(formatBoPartNumber(baseKey)),
      normalizePartNumberKey(`${baseKey} CBN`),
      normalizePartNumberKey(`${baseKey}=`),
      normalizePartNumberKey(`${baseKey}-RF`),
      normalizePartNumberKey(`${baseKey}-WS`),
    ];
    if (key === baseKey) {
      const siblingSkus = new Set<string>();
      for (const [k, v] of Object.entries(flatCatalog)) {
        if (!v || v.startsWith(AMBIGUOUS_BASE_SENTINEL_PREFIX)) continue;
        if (normalizePartNumberKey(normalizeBasePartNumber(k)) === baseKey && k !== baseKey) {
          siblingSkus.add(v.trim().toUpperCase());
        }
      }
      if (siblingSkus.size > 1) {
        const candidates = Array.from(siblingSkus).sort();
        return {
          status: 'AMBIGUOUS_ALIAS',
          sku: '',
          matchedKey: baseKey,
          basePartNumber: baseKey,
          candidates,
          variantRecords,
        };
      }
    }

    return {
      status: 'EXACT_MATCH',
      sku: rawFlatExact,
      matchedKey: key,
      basePartNumber: baseKey,
      candidates: [rawFlatExact],
      variantRecords,
    };
  }

  // 2. Evaluar resolución por base / alias
  const candidateSkuSet = new Set<string>();
  for (const rec of variantRecords) {
    if (rec.sku) candidateSkuSet.add(rec.sku.trim().toUpperCase());
  }

  // También inspeccionar el catálogo plano en caso de que provenga de un test o caché plana
  for (const [flatKey, flatVal] of Object.entries(flatCatalog)) {
    if (!flatVal) continue;
    if (flatVal.startsWith(AMBIGUOUS_BASE_SENTINEL_PREFIX)) {
      if (normalizePartNumberKey(flatKey) === baseKey) {
        const embedded = flatVal
          .slice(AMBIGUOUS_BASE_SENTINEL_PREFIX.length)
          .split('|')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        for (const s of embedded) candidateSkuSet.add(s);
      }
      continue;
    }
    const flatKeyBase = normalizePartNumberKey(normalizeBasePartNumber(flatKey));
    if (flatKeyBase === baseKey) {
      candidateSkuSet.add(flatVal.trim().toUpperCase());
    }
  }

  const candidates = Array.from(candidateSkuSet).sort();
  if (candidates.length === 1) {
    return {
      status: 'ALIAS_MATCH',
      sku: candidates[0],
      matchedKey: baseKey,
      basePartNumber: baseKey,
      candidates,
      variantRecords,
    };
  }

  if (candidates.length > 1) {
    return {
      status: 'AMBIGUOUS_ALIAS',
      sku: '',
      matchedKey: baseKey,
      basePartNumber: baseKey,
      candidates,
      variantRecords,
    };
  }

  return {
    status: 'NOT_FOUND',
    sku: '',
    basePartNumber: baseKey,
    candidates: [],
    variantRecords: [],
  };
}

/**
 * Busca el SKU de Intcomex para un Part Number en el catálogo disponible.
 * Respeta la prioridad de Item 13:
 * - Coincidencia exacta primero.
 * - Alias unívoco por base cuando hay un único SKU candidato.
 * - Devuelve `''` si el alias base es ambiguo (>= 2 SKUs distintos para la misma base).
 */
export function findSkuInCatalog(partNumber: string, catalog: Record<string, string>): string {
  if (!partNumber || !catalog) return '';
  const resolution = resolveSkuFromCatalog(partNumber, catalog);
  if (resolution.status === 'EXACT_MATCH' || resolution.status === 'ALIAS_MATCH') {
    return resolution.sku;
  }
  return '';
}

/**
 * Obtiene el catálogo completo de SKUs consultando Firestore Cloud y fusionándolo
 * con la caché local de alta velocidad sin sobrescribir variantes entre sí.
 */
export async function fetchBoSkuCatalog(): Promise<{
  catalog: Record<string, string>;
  isCloudConnected: boolean;
  error?: string;
}> {
  const projectCtx = captureProjectContext();
  const localCache = getLocalBoSkuCache();
  const structured = getStructuredBoSkuCatalog();
  let isCloudConnected = false;

  // 1. Integración opcional con aplicación de escritorio nativa (SQLite pywebview)
  try {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi && typeof pyApi.get_bo_skus === 'function') {
      const desktopSkus = await pyApi.get_bo_skus();
      if (desktopSkus && typeof desktopSkus === 'object') {
        for (const [pnKey, skuVal] of Object.entries(desktopSkus)) {
          if (pnKey && typeof skuVal === 'string' && skuVal.trim()) {
            registerStructuredSkuRecord(structured, {
              partNumber: pnKey,
              basePartNumber: normalizeBasePartNumber(pnKey),
              sku: skuVal.trim().toUpperCase(),
              updatedAt: new Date().toISOString(),
              updatedBy: 'desktop_sqlite',
              source: 'DESKTOP_SQLITE',
              isExactVariant: true,
            });
          }
        }
      }
    }
  } catch (_) {}

  // 2. Consulta a Firebase Firestore
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db) {
      isCloudConnected = true;
      const colRef = collection(db, BO_SKU_COLLECTION);
      const snapshot = await withTimeout(getDocs(colRef), 2500);

      if (!isProjectContextCurrent(projectCtx)) {
        return { catalog: getLocalBoSkuCache(), isCloudConnected: false };
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<BoSkuCatalogRecord>;
        const sku = (data.sku || '').trim().toUpperCase();
        if (sku && data.partNumber) {
          registerStructuredSkuRecord(structured, {
            partNumber: data.partNumber,
            basePartNumber: data.basePartNumber || normalizeBasePartNumber(data.partNumber),
            sku,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'cloud',
            source: data.source || 'CLOUD_SYNC',
            isExactVariant: data.isExactVariant ?? true,
          });
        }
      });

      saveStructuredBoSkuCatalog(structured);
      const derived = deriveFlatCatalogFromStructured(structured, localCache);
      saveLocalBoSkuCache(derived);
      return { catalog: derived, isCloudConnected: true };
    } else {
      const derived = deriveFlatCatalogFromStructured(structured, localCache);
      return {
        catalog: derived,
        isCloudConnected: false,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }
  } catch (err: any) {
    console.warn('[BoSkuCatalog - fetchBoSkuCatalog error]:', err);
    const derived = deriveFlatCatalogFromStructured(structured, localCache);
    return {
      catalog: derived,
      isCloudConnected: false,
      error: `Mostrando catálogo local (${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Guarda o actualiza un mapeo de Part Number a SKU Intcomex en la nube y localmente.
 * Item 13: Nunca sobrescribe el SKU de otra variante que comparta el mismo `basePartNumber`.
 */
export async function saveBoSkuMapping(
  partNumber: string,
  sku: string,
  user?: string,
  source: BoSkuMappingProvenance = 'MANUAL'
): Promise<{
  success: boolean;
  isCloud: boolean;
  error?: string;
  resolution?: BoSkuResolutionResult;
}> {
  const projectCtx = captureProjectContext();
  const cleanPn = (partNumber || '').trim();
  const cleanSku = (sku || '').trim().toUpperCase();
  if (!cleanPn) return { success: false, isCloud: false, error: 'Part Number requerido' };

  const basePn = normalizeBasePartNumber(cleanPn);
  const now = new Date().toISOString();

  // 1. Actualizar catálogo estructurado + vista plana local sin pisar variantes hermanas
  const structured = getStructuredBoSkuCatalog();
  const record: BoSkuCatalogRecord = {
    partNumber: cleanPn,
    basePartNumber: basePn,
    sku: cleanSku,
    updatedAt: now,
    updatedBy: user || 'usuario',
    source,
    isExactVariant: true,
  };
  registerStructuredSkuRecord(structured, record);
  saveStructuredBoSkuCatalog(structured);

  const currentLocal = deriveFlatCatalogFromStructured(structured, getLocalBoSkuCache());
  saveLocalBoSkuCache(currentLocal);

  // 2. Notificar a app de escritorio SQLite si está presente
  try {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi && typeof pyApi.save_bo_sku === 'function') {
      pyApi.save_bo_sku(cleanPn, cleanSku, basePn);
    }
  } catch (_) {}

  // 3. Persistir en Firestore Cloud (SOLO bajo el documento exacto de la variante `cleanPn`,
  //    evitando sobrescribir un documento `basePn` compartido por múltiples variantes)
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db && isProjectContextCurrent(projectCtx)) {
      const safeDocId = encodeURIComponent(cleanPn.toUpperCase()).replace(/\./g, '%2E');
      const docRef = doc(db, BO_SKU_COLLECTION, safeDocId);

      await withTimeout(setDoc(docRef, sanitizeForFirestore(record), { merge: true }), 2500);

      return {
        success: true,
        isCloud: true,
        resolution: resolveSkuFromCatalog(cleanPn, currentLocal),
      };
    }

    return {
      success: true,
      isCloud: false,
      error: error ? `Guardado localmente (${error})` : undefined,
      resolution: resolveSkuFromCatalog(cleanPn, currentLocal),
    };
  } catch (err: any) {
    console.warn('[BoSkuCatalog - saveBoSkuMapping error]:', err);
    return {
      success: true,
      isCloud: false,
      error: `Guardado en almacenamiento local (${err?.message || 'Offline'})`,
      resolution: resolveSkuFromCatalog(cleanPn, currentLocal),
    };
  }
}

/**
 * Guarda un lote de Part Numbers y SKUs en una sola operación
 */
export async function batchSaveBoSkuMappings(
  items: Array<{ partNumber: string; sku: string }>,
  user?: string,
  source: BoSkuMappingProvenance = 'MANUAL'
): Promise<{ success: boolean; count: number }> {
  let count = 0;
  for (const item of items) {
    if (item.partNumber && item.sku) {
      await saveBoSkuMapping(item.partNumber, item.sku, user, source);
      count++;
    }
  }
  return { success: true, count };
}

/**
 * Importación masiva de relaciones Part Number -> SKU Intcomex desde archivo Excel (.xlsx / .xls)
 */
export async function importBoSkuMappingsFromExcel(
  buffer: ArrayBuffer,
  user?: string
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  try {
    const workbook = new ExcelJS.Workbook();
    const loadPayload = typeof Buffer !== 'undefined' && !(buffer instanceof Buffer)
      ? Buffer.from(buffer)
      : buffer;
    await workbook.xlsx.load(loadPayload as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { success: false, importedCount: 0, error: 'Planilla vacía o sin hojas válidas' };
    }

    let pnCol = -1;
    let skuCol = -1;
    let headerRow = 1;

    for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').toLowerCase().trim();
        if (pnCol === -1 && (val.includes('part number') || val.includes('partnumber') || val === 'pn' || val === 'p/n' || val === 'part #')) {
          pnCol = colNumber;
        }
        if (skuCol === -1 && (val.includes('sku') || val.includes('intcomex') || val === 'código' || val === 'codigo')) {
          skuCol = colNumber;
        }
      });
      if (pnCol !== -1 && skuCol !== -1) {
        headerRow = r;
        break;
      }
    }

    // Fallback si no hay cabeceras explícitas: Col 1 = PN, Col 2 = SKU
    if (pnCol === -1) pnCol = 1;
    if (skuCol === -1) skuCol = 2;

    const itemsToSave: Array<{ partNumber: string; sku: string }> = [];
    for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
      const pn = String(worksheet.getCell(r, pnCol).value || '').trim();
      const sku = String(worksheet.getCell(r, skuCol).value || '').trim();
      if (pn && sku && pn.length <= 50 && sku.length <= 35) {
        itemsToSave.push({ partNumber: pn, sku });
      }
    }

    if (itemsToSave.length === 0) {
      return { success: false, importedCount: 0, error: 'No se encontraron filas con Part Number y SKU válidos' };
    }

    const res = await batchSaveBoSkuMappings(itemsToSave, user, 'EXCEL_IMPORT');
    return { success: true, importedCount: res.count };
  } catch (err: any) {
    return { success: false, importedCount: 0, error: err?.message || 'Error importando archivo' };
  }
}
