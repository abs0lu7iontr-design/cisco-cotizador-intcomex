// ============================================================================
// CISCO AUTOMATED - LOCAL-FIRST PARTNER DATABASE SYNCHRONIZATION HOOK
// Instant LocalStorage Cache + Cloud Firestore Two-Way Sync
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, collection, onSnapshot, Firestore } from 'firebase/firestore';
import { getSimilarityScore } from '../utils/fuzzyMatch';
import { getFirestoreInstance } from '../modules/cloud/firebaseConfig';

export interface PartnerRecord {
  resellerName: string;
  xclCode: string;
}

const LOCAL_STORAGE_PARTNERS_KEY = 'cisco_partners_xcl_cache_v1';

/**
 * Hook de autocompletado y sincronización Local-First para códigos XCL de Partners.
 * Proporciona respuesta en 0ms desde la caché local y sincronización reactiva con Firestore.
 */
export function usePartnerDatabase(originalBomName: string) {
  // Inicialización inmediata desde LocalStorage (Local-First)
  const [partners, setPartners] = useState<PartnerRecord[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_PARTNERS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [suggestedXcl, setSuggestedXcl] = useState('');
  const [matchScore, setMatchScore] = useState(0);
  const [matchedNameDb, setMatchedNameDb] = useState('');

  // 1. Suscripción a Firestore con fallback silencioso si está offline o no configurado
  useEffect(() => {
    let db: Firestore | null = null;
    try {
      const instance = getFirestoreInstance();
      if (instance.isReady && instance.db) {
        db = instance.db;
      }
    } catch (_) {}

    if (!db) return;

    try {
      const partnersRef = collection(db, 'partners_xcl');
      const unsubscribe = onSnapshot(
        partnersRef,
        (snapshot) => {
          const loaded: PartnerRecord[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as PartnerRecord;
            if (data && data.resellerName && data.xclCode) {
              loaded.push({
                resellerName: String(data.resellerName).trim(),
                xclCode: String(data.xclCode).trim().toUpperCase(),
              });
            }
          });

          if (loaded.length > 0) {
            setPartners((prev) => {
              // Mezclar evitando duplicados
              const map = new Map<string, PartnerRecord>();
              prev.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
              loaded.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
              const merged = Array.from(map.values());
              try {
                localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, JSON.stringify(merged));
              } catch (_) {}
              return merged;
            });
          }
        },
        (error) => {
          console.warn('[usePartnerDatabase Note]: Firestore snapshot offline or permission fallback:', error?.message || error);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('[usePartnerDatabase Note]: Firestore listener failed to attach:', err);
    }
  }, []);

  // 2. Ejecutar búsqueda difusa matemática (Fuzzy Matching >90%)
  useEffect(() => {
    if (!originalBomName || originalBomName.trim().length === 0 || partners.length === 0) {
      setSuggestedXcl('');
      setMatchScore(0);
      setMatchedNameDb('');
      return;
    }

    let bestScore = 0;
    let bestMatch: PartnerRecord | null = null;

    for (const p of partners) {
      const score = getSimilarityScore(originalBomName, p.resellerName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && bestScore >= 90) {
      setSuggestedXcl(bestMatch.xclCode);
      setMatchScore(bestScore);
      setMatchedNameDb(bestMatch.resellerName);
    } else if (bestMatch && bestScore > 0) {
      setSuggestedXcl('');
      setMatchScore(bestScore);
      setMatchedNameDb(bestMatch.resellerName);
    } else {
      setSuggestedXcl('');
      setMatchScore(0);
      setMatchedNameDb('');
    }
  }, [originalBomName, partners]);

  // 3. Aprendizaje Local-First de nuevo Partner ingresado por el usuario
  const learnNewPartner = useCallback(async (bomName: string, xclCode: string) => {
    if (!bomName || !xclCode) return;
    const cleanName = bomName.trim();
    const cleanXcl = xclCode.trim().toUpperCase();
    if (cleanName.length === 0 || cleanXcl.length < 5) return;

    // Actualización local inmediata (Local-First)
    setPartners((prev) => {
      const filtered = prev.filter((p) => p.resellerName.toUpperCase() !== cleanName.toUpperCase());
      const updated = [...filtered, { resellerName: cleanName, xclCode: cleanXcl }];
      try {
        localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    // Guardado en Firestore
    try {
      const instance = getFirestoreInstance();
      if (instance.isReady && instance.db) {
        const docKey = cleanName.toUpperCase().replace(/\//g, '-');
        const docRef = doc(instance.db, 'partners_xcl', docKey);
        await setDoc(docRef, { resellerName: cleanName, xclCode: cleanXcl }, { merge: true });
      }
    } catch (error) {
      console.error('Error al guardar partner en Firestore:', error);
    }
  }, []);

  return { suggestedXcl, matchScore, matchedNameDb, learnNewPartner };
}
