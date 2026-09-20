// ============================================================================
// CISCO AUTOMATED v2.1 - BO SKU CATALOG SERVICE (FIRESTORE CLOUD + LOCAL CACHE)
// Auto-fill and persistence for Cisco Part Number <-> Intcomex SKU mappings
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getFirestoreInstance } from '../cloud/firebaseConfig';
import { sanitizeForFirestore, withTimeout } from '../cloud/firestoreService';
import { formatBoPartNumber, normalizeBasePartNumber } from './boTypes';

export interface BoSkuCatalogRecord {
  partNumber: string;        // Ej. "C9200L-24P-4G-E-CBN"
  basePartNumber: string;    // Ej. "C9200L-24P-4G-E"
  sku: string;               // Ej. "EN614MKC66" (SKU Intcomex)
  updatedAt: string;         // ISO 8601
  updatedBy?: string;        // Nombre o usuario
}

const BO_SKU_COLLECTION = 'cisco_bo_sku_catalog';
const LOCAL_BO_SKU_CACHE_KEY = 'cisco_bo_sku_catalog_cache_v1';

/**
 * Normaliza una clave de Part Number a mayúsculas y sin espacios redundantes
 */
export function normalizePartNumberKey(pn: string): string {
  return (pn || '').trim().toUpperCase();
}

/**
 * Obtiene el catálogo de SKUs en memoria desde LocalStorage
 */
export function getLocalBoSkuCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_BO_SKU_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * Guarda el mapa en LocalStorage
 */
export function saveLocalBoSkuCache(map: Record<string, string>) {
  try {
    localStorage.setItem(LOCAL_BO_SKU_CACHE_KEY, JSON.stringify(map));
  } catch (_) {}
}

/**
 * Busca el SKU de Intcomex para un Part Number en el catálogo disponible
 * Probando en cascada: exacto, base (sin -CBN /  CBN), con -CBN y con  CBN
 */
export function findSkuInCatalog(partNumber: string, catalog: Record<string, string>): string {
  if (!partNumber || !catalog) return '';
  const key = normalizePartNumberKey(partNumber);
  if (catalog[key]) return catalog[key];

  const baseKey = normalizePartNumberKey(normalizeBasePartNumber(partNumber));
  if (catalog[baseKey]) return catalog[baseKey];

  const cbnHyphenKey = normalizePartNumberKey(formatBoPartNumber(baseKey));
  if (catalog[cbnHyphenKey]) return catalog[cbnHyphenKey];

  const cbnSpaceKey = normalizePartNumberKey(`${baseKey} CBN`);
  if (catalog[cbnSpaceKey]) return catalog[cbnSpaceKey];

  return '';
}

/**
 * Obtiene el catálogo completo de SKUs consultando Firestore Cloud y fusionándolo
 * con la caché local de alta velocidad.
 */
export async function fetchBoSkuCatalog(): Promise<{
  catalog: Record<string, string>;
  isCloudConnected: boolean;
  error?: string;
}> {
  const localCache = getLocalBoSkuCache();
  let merged: Record<string, string> = { ...localCache };
  let isCloudConnected = false;

  // 1. Integración opcional con aplicación de escritorio nativa (SQLite pywebview)
  try {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi && typeof pyApi.get_bo_skus === 'function') {
      const desktopSkus = await pyApi.get_bo_skus();
      if (desktopSkus && typeof desktopSkus === 'object') {
        merged = { ...merged, ...desktopSkus };
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

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<BoSkuCatalogRecord>;
        const sku = (data.sku || '').trim().toUpperCase();
        if (sku) {
          if (data.partNumber) {
            merged[normalizePartNumberKey(data.partNumber)] = sku;
          }
          if (data.basePartNumber) {
            merged[normalizePartNumberKey(data.basePartNumber)] = sku;
          }
        }
      });

      saveLocalBoSkuCache(merged);
      return { catalog: merged, isCloudConnected: true };
    } else {
      return {
        catalog: merged,
        isCloudConnected: false,
        error: error ? `Modo local activo (${error})` : undefined,
      };
    }
  } catch (err: any) {
    console.warn('[BoSkuCatalog - fetchBoSkuCatalog error]:', err);
    return {
      catalog: merged,
      isCloudConnected: false,
      error: `Mostrando catálogo local (${err?.message || 'Sin conexión'})`,
    };
  }
}

/**
 * Guarda o actualiza un mapeo de Part Number a SKU Intcomex en la nube y localmente
 */
export async function saveBoSkuMapping(
  partNumber: string,
  sku: string,
  user?: string
): Promise<{ success: boolean; isCloud: boolean; error?: string }> {
  const cleanPn = (partNumber || '').trim();
  const cleanSku = (sku || '').trim().toUpperCase();
  if (!cleanPn) return { success: false, isCloud: false, error: 'Part Number requerido' };

  const basePn = normalizeBasePartNumber(cleanPn);
  const now = new Date().toISOString();

  // 1. Actualizar caché local
  const currentLocal = getLocalBoSkuCache();
  currentLocal[normalizePartNumberKey(cleanPn)] = cleanSku;
  if (basePn) {
    currentLocal[normalizePartNumberKey(basePn)] = cleanSku;
  }
  saveLocalBoSkuCache(currentLocal);

  // 2. Notificar a app de escritorio SQLite si está presente
  try {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi && typeof pyApi.save_bo_sku === 'function') {
      pyApi.save_bo_sku(cleanPn, cleanSku, basePn);
    }
  } catch (_) {}

  // 3. Persistir en Firestore Cloud
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db) {
      const safeDocId = encodeURIComponent(cleanPn.toUpperCase()).replace(/\./g, '%2E');
      const docRef = doc(db, BO_SKU_COLLECTION, safeDocId);

      const record: BoSkuCatalogRecord = {
        partNumber: cleanPn,
        basePartNumber: basePn,
        sku: cleanSku,
        updatedAt: now,
        updatedBy: user || 'usuario',
      };

      await withTimeout(setDoc(docRef, sanitizeForFirestore(record), { merge: true }), 2500);

      // Si el basePn es diferente, guardamos también el registro base para búsquedas directas
      if (basePn && basePn.toUpperCase() !== cleanPn.toUpperCase()) {
        const safeBaseDocId = encodeURIComponent(basePn.toUpperCase()).replace(/\./g, '%2E');
        const baseDocRef = doc(db, BO_SKU_COLLECTION, safeBaseDocId);
        const baseRecord: BoSkuCatalogRecord = {
          partNumber: basePn,
          basePartNumber: basePn,
          sku: cleanSku,
          updatedAt: now,
          updatedBy: user || 'usuario',
        };
        await withTimeout(setDoc(baseDocRef, sanitizeForFirestore(baseRecord), { merge: true }), 2500);
      }

      return { success: true, isCloud: true };
    }

    return {
      success: true,
      isCloud: false,
      error: error ? `Guardado localmente (${error})` : undefined,
    };
  } catch (err: any) {
    console.warn('[BoSkuCatalog - saveBoSkuMapping error]:', err);
    return {
      success: true,
      isCloud: false,
      error: `Guardado en almacenamiento local (${err?.message || 'Offline'})`,
    };
  }
}

/**
 * Guarda un lote de Part Numbers y SKUs en una sola operación
 */
export async function batchSaveBoSkuMappings(
  items: Array<{ partNumber: string; sku: string }>,
  user?: string
): Promise<{ success: boolean; count: number }> {
  let count = 0;
  for (const item of items) {
    if (item.partNumber && item.sku) {
      await saveBoSkuMapping(item.partNumber, item.sku, user);
      count++;
    }
  }
  return { success: true, count };
}
