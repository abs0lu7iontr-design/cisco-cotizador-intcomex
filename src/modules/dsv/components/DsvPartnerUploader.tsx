// ============================================================================
// CISCO AUTOMATED - DSV PARTNER UPLOADER COMPONENT (ZERO-REGRESSION)
// Seeds initial_partners.json into Cloud Firestore & LocalStorage
// ============================================================================

import React, { useRef, useState } from 'react';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { getFirestoreInstance } from '../../cloud/firebaseConfig';

interface PartnerItem {
  resellerName: string;
  xclCode: string;
}

const LOCAL_STORAGE_PARTNERS_KEY = 'cisco_partners_xcl_cache_v1';

export interface DsvPartnerUploaderProps {
  onUploadSuccess?: (count: number) => void;
}

export const DsvPartnerUploader: React.FC<DsvPartnerUploaderProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setIsError(false);
    setFeedback('Leyendo base...');

    try {
      const text = await file.text();
      const parsedData = JSON.parse(text);

      if (!Array.isArray(parsedData)) {
        throw new Error('El archivo debe ser un arreglo JSON válido.');
      }

      // 1. Filtrar registros válidos
      const validItems: PartnerItem[] = [];
      parsedData.forEach((item) => {
        if (item && item.resellerName && item.xclCode) {
          validItems.push({
            resellerName: String(item.resellerName).trim(),
            xclCode: String(item.xclCode).trim().toUpperCase(),
          });
        }
      });

      if (validItems.length === 0) {
        throw new Error('No se encontraron registros con resellerName y xclCode válidos.');
      }

      // 2. Persistencia Inmediata Local-First en LocalStorage
      try {
        let existing: PartnerItem[] = [];
        const cached = localStorage.getItem(LOCAL_STORAGE_PARTNERS_KEY);
        if (cached) {
          existing = JSON.parse(cached);
        }
        const map = new Map<string, PartnerItem>();
        existing.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
        validItems.forEach((p) => map.set(p.resellerName.toUpperCase(), p));
        const merged = Array.from(map.values());
        localStorage.setItem(LOCAL_STORAGE_PARTNERS_KEY, JSON.stringify(merged));

        // Disparar evento para que usePartnerDatabase se actualice si escucha
        window.dispatchEvent(new Event('cisco_partners_updated'));
      } catch (localErr) {
        console.warn('[DsvPartnerUploader Note]: LocalStorage cache error:', localErr);
      }

      // 3. Sincronización asíncrona por bloques con Cloud Firestore
      let syncedCount = 0;
      let dbInstance = null;
      try {
        const { db, isReady } = getFirestoreInstance();
        dbInstance = isReady && db ? db : getFirestore();
      } catch (_) {
        try {
          dbInstance = getFirestore();
        } catch (_) {}
      }

      if (dbInstance) {
        const CHUNK_SIZE = 400; // Límite seguro para batch commit de Firestore (< 500 ops)
        for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
          const chunk = validItems.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(dbInstance);

          chunk.forEach((item) => {
            const docId = item.resellerName
              .trim()
              .toUpperCase()
              .replace(/[\/\\.#$\[\]]/g, '-');

            const docRef = doc(dbInstance, 'partners_xcl', docId);

            batch.set(
              docRef,
              {
                resellerName: item.resellerName.trim(),
                xclCode: item.xclCode.trim().toUpperCase(),
                updatedAt: Date.now(),
              },
              { merge: true }
            );

            syncedCount++;
          });

          await batch.commit();
        }
      } else {
        syncedCount = validItems.length;
      }

      setIsError(false);
      setFeedback(`✓ ${syncedCount} Partners cargados`);
      if (onUploadSuccess) onUploadSuccess(syncedCount);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error('Error cargando partners en DSV:', err);
      setIsError(true);
      setFeedback(`Error: ${err.message || 'Fallo al procesar'}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button
        type="button"
        disabled={loading}
        onClick={() => fileInputRef.current?.click()}
        className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
        title="Actualizar o sembrar base de Partners (initial_partners.json)"
      >
        <span>📁</span>
        <span>{loading ? 'Sincronizando...' : 'Base Partners (JSON)'}</span>
      </button>

      {feedback && (
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
            isError
              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
          }`}
        >
          {feedback}
        </span>
      )}
    </div>
  );
};
