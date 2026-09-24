// ============================================================================
// CISCO AUTOMATED v2.1 - PARTNER & GLOBAL PARAMETER PROFILES SERVICE
// Manages commercial parameters (Internación, Arancel, Margen) with temporal
// validity and dual persistence (Firestore Cloud + LocalStorage Offline Backup)
// ============================================================================

import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { QuoteParameters } from '../../core/types';
import { getPartnerDocId } from '../../utils/partnerDbUtils';
import { getFirestoreInstance } from './firebaseConfig';

export type ParamProfileScope = 'partner' | 'global';
export type ParamDurationType = 'permanent' | '15_days' | '30_days' | 'end_of_month';

export interface ParamProfileRecord {
  id: string;                      // docId determinista o '__GLOBAL_PARAMS__'
  scope: ParamProfileScope;
  partnerName: string;            // Nombre limpio del partner o 'GLOBAL'
  params: QuoteParameters;
  durationType: ParamDurationType;
  expiresAt: number | null;        // Timestamp en ms (null si es permanente)
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

const LOCAL_STORAGE_PROFILES_KEY = 'cisco_partner_param_profiles_v2';
export const GLOBAL_DOC_ID = '__GLOBAL_PARAMS__';

export const DEFAULT_FACTORY_PARAMS: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
};

/**
 * Obtiene la caché local de perfiles
 */
export function getLocalProfilesCache(): Record<string, ParamProfileRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda la caché local de perfiles
 */
export function saveLocalProfilesCache(cache: Record<string, ParamProfileRecord>) {
  try {
    const raw = JSON.stringify(cache);
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, raw);
    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.save_partner_profiles === 'function') {
      Promise.resolve(pyApi.save_partner_profiles(raw)).catch(() => {});
    }
  } catch (err) {
    console.warn('[PartnerParamsService] Error en localStorage de perfiles:', err);
  }
}

/**
 * Wrapper de timeout para operaciones de Firestore para evitar cuelgues si la red es lenta
 */
async function withFailsafeTimeout<T>(promise: Promise<T>, ms = 1500): Promise<T | null> {
  let timer: any;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Calcula el timestamp de expiración según la opción seleccionada
 */
export function calculateExpirationTimestamp(durationType: ParamDurationType): number | null {
  const now = new Date();
  if (durationType === 'permanent') return null;

  if (durationType === '15_days') {
    return now.getTime() + 15 * 24 * 60 * 60 * 1000;
  }

  if (durationType === '30_days') {
    return now.getTime() + 30 * 24 * 60 * 60 * 1000;
  }

  if (durationType === 'end_of_month') {
    // Último milisegundo del mes corriente
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return endOfMonth.getTime();
  }

  return null;
}

/**
 * Formatea una fecha de expiración en texto legible para la UI
 */
export function formatExpirationLabel(expiresAt: number | null): string {
  if (expiresAt === null) return 'Permanente';
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 'Expirado';

  const d = new Date(expiresAt);
  const dateStr = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (daysLeft === 1) return `Vence hoy (${dateStr})`;
  return `Vence en ${daysLeft} días (${dateStr})`;
}

/**
 * Verifica si un perfil es válido y no ha expirado
 */
export function isProfileActive(p?: ParamProfileRecord | null): boolean {
  if (!p) return false;
  if (p.expiresAt === null) return true; // Permanente
  return p.expiresAt > Date.now();       // Aún vigente
}

/**
 * Guarda o actualiza un perfil de parámetros en Firestore y caché local
 */
export async function saveParamProfile(options: {
  scope: ParamProfileScope;
  partnerName?: string;
  params: QuoteParameters;
  durationType: ParamDurationType;
  username?: string;
}): Promise<{ success: boolean; record: ParamProfileRecord; error?: string }> {
  const { scope, partnerName, params, durationType, username } = options;

  let docId = GLOBAL_DOC_ID;
  let targetPartnerName = 'GLOBAL';

  if (scope === 'partner') {
    if (!partnerName || !partnerName.trim()) {
      throw new Error('Se requiere un nombre de partner válido.');
    }
    targetPartnerName = partnerName.trim();
    docId = getPartnerDocId(targetPartnerName);
  }

  const expiresAt = calculateExpirationTimestamp(durationType);
  const nowIso = new Date().toISOString();

  const record: ParamProfileRecord = {
    id: docId,
    scope,
    partnerName: targetPartnerName,
    params: {
      internacionPct: Number(params.internacionPct) || 0,
      arancelPct: Number(params.arancelPct) || 0,
      margenPct: Number(params.margenPct) || 0,
    },
    durationType,
    expiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: username || 'mskill',
  };

  // 1. Guardar inmediatamente en memoria local
  const cache = getLocalProfilesCache();
  cache[docId] = record;
  saveLocalProfilesCache(cache);

  // 2. Persistir en Firestore de forma segura
  try {
    const { db, isReady, error } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, 'partner_custom_params', docId);
      await withFailsafeTimeout(setDoc(docRef, record, { merge: true }), 2500);
      return { success: true, record };
    } else {
      return { success: true, record, error: error ? `Guardado local (${error})` : undefined };
    }
  } catch (err: any) {
    console.warn('[PartnerParamsService] Advertencia al sincronizar con Firestore:', err);
    return { success: true, record, error: 'Guardado localmente (sin conexión nube)' };
  }
}

/**
 * Elimina o revoca un perfil de parámetros activo
 */
export async function deleteParamProfile(options: {
  scope: ParamProfileScope;
  partnerName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { scope, partnerName } = options;
  const docId = scope === 'partner' && partnerName ? getPartnerDocId(partnerName) : GLOBAL_DOC_ID;

  // 1. Borrar de caché local
  const cache = getLocalProfilesCache();
  delete cache[docId];
  saveLocalProfilesCache(cache);

  // 2. Borrar de Firestore si está disponible
  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const docRef = doc(db, 'partner_custom_params', docId);
      await withFailsafeTimeout(deleteDoc(docRef), 2000);
    }
    return { success: true };
  } catch (err: any) {
    console.warn('[PartnerParamsService] Error eliminando perfil en Firestore:', err);
    return { success: true, error: 'Eliminado localmente' };
  }
}

/**
 * Resuelve los parámetros comerciales activos evaluando vigencia y jerarquía:
 * 1. Perfil específico del Partner (Local -> Firestore).
 * 2. Perfil Global personalizado (Local -> Firestore).
 * 3. Parámetros de Fábrica estándar (7/6/5).
 */
export async function resolveActiveParams(partnerName?: string): Promise<{
  params: QuoteParameters;
  appliedProfile: ParamProfileRecord | null;
  source: 'partner_custom' | 'global_custom' | 'factory_default';
}> {
  const cache = getLocalProfilesCache();

  // Si estamos en Desktop App, sincronizar perfiles desde disco nativo
  try {
    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.get_partner_profiles === 'function') {
      const diskRes = await pyApi.get_partner_profiles();
      if (diskRes && diskRes.success && diskRes.profiles && typeof diskRes.profiles === 'object') {
        Object.assign(cache, diskRes.profiles);
      }
    }
  } catch (_) {}

  // 1. Buscar perfil del Partner específico
  const cleanPartner = (partnerName || '').trim();
  const partnerDocId = cleanPartner ? getPartnerDocId(cleanPartner) : '';

  if (partnerDocId && isProfileActive(cache[partnerDocId])) {
    return {
      params: cache[partnerDocId].params,
      appliedProfile: cache[partnerDocId],
      source: 'partner_custom',
    };
  }

  // Si no está en caché local, intentar lectura rápida a Firestore
  if (partnerDocId) {
    try {
      const { db, isReady } = getFirestoreInstance();
      if (isReady && db) {
        const docRef = doc(db, 'partner_custom_params', partnerDocId);
        const snap = await withFailsafeTimeout(getDoc(docRef), 1200);

        if (snap && snap.exists()) {
          const cloudData = snap.data() as ParamProfileRecord;
          if (isProfileActive(cloudData)) {
            cache[partnerDocId] = cloudData;
            saveLocalProfilesCache(cache);
            return {
              params: cloudData.params,
              appliedProfile: cloudData,
              source: 'partner_custom',
            };
          }
        }
      }
    } catch (_) {}
  }

  // 2. Buscar perfil Global en local
  if (isProfileActive(cache[GLOBAL_DOC_ID])) {
    return {
      params: cache[GLOBAL_DOC_ID].params,
      appliedProfile: cache[GLOBAL_DOC_ID],
      source: 'global_custom',
    };
  }

  // Si no está en local, intentar buscar perfil Global en Firestore
  try {
    const { db, isReady } = getFirestoreInstance();
    if (isReady && db) {
      const globalDocRef = doc(db, 'partner_custom_params', GLOBAL_DOC_ID);
      const globalSnap = await withFailsafeTimeout(getDoc(globalDocRef), 1200);

      if (globalSnap && globalSnap.exists()) {
        const globalCloudData = globalSnap.data() as ParamProfileRecord;
        if (isProfileActive(globalCloudData)) {
          cache[GLOBAL_DOC_ID] = globalCloudData;
          saveLocalProfilesCache(cache);
          return {
            params: globalCloudData.params,
            appliedProfile: globalCloudData,
            source: 'global_custom',
          };
        }
      }
    }
  } catch (_) {}

  // 3. Fallback a parámetros por defecto de fábrica (7% Internación, 6% Arancel, 5% Margen)
  return {
    params: DEFAULT_FACTORY_PARAMS,
    appliedProfile: null,
    source: 'factory_default',
  };
}

/**
 * Extrae el nombre del partner a partir del nombre del archivo o del header
 */
export function extractPartnerFromFilenameOrHeader(
  filename?: string,
  companyName?: string
): string {
  if (filename) {
    const clean = filename.replace(/\.[^/.]+$/, '').trim();
    const parts = clean.split(/[_.\s-]+/);
    if (
      parts.length >= 1 &&
      parts[0] &&
      !parts[0].match(/^(estimate|cotizacion|cisco|deal|bom|\d+)$/i)
    ) {
      return parts[0].trim();
    }
  }

  if (
    companyName &&
    !companyName.toUpperCase().includes('INTCOMEX') &&
    !companyName.toUpperCase().includes('CISCO')
  ) {
    return companyName.trim();
  }

  return 'Partner General';
}
