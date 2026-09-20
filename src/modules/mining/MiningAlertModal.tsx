// ============================================================================
// CISCO AUTOMATED v2.1 - MINING OBSERVER ALERT MODAL (DANIEL PEÑA ASSISTED EMAIL)
// ============================================================================

import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  totalListPrice: number;
  initialDealId?: string | null;
  mailtoUrlTemplate: string;
  onClose: () => void;
}

export const MiningAlertModal: React.FC<Props> = ({
  isOpen,
  totalListPrice,
  initialDealId,
  mailtoUrlTemplate,
  onClose,
}) => {
  const [dealId, setDealId] = useState(initialDealId || '');

  useEffect(() => {
    if (initialDealId) {
      setDealId(initialDealId);
    }
  }, [initialDealId]);

  if (!isOpen) return null;

  const handleSendEmail = () => {
    const finalDeal = dealId.trim() || 'POR_ASIGNAR';
    let finalUrl = mailtoUrlTemplate;

    if (finalUrl.includes('[NUMERO_DEAL]')) {
      finalUrl = finalUrl.replace(/\[NUMERO_DEAL\]/g, finalDeal);
    } else if (initialDealId && initialDealId.trim() !== finalDeal) {
      finalUrl = finalUrl.split(encodeURIComponent(initialDealId)).join(encodeURIComponent(finalDeal));
      finalUrl = finalUrl.split(initialDealId).join(finalDeal);
    }

    window.location.href = finalUrl;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500/40 rounded-xl p-6 shadow-2xl text-slate-200 font-sans">
        <div className="flex items-center gap-2.5 text-amber-400 mb-3">
          <span className="text-xl">⚠️</span>
          <h3 className="font-bold text-sm uppercase tracking-wide">
            Gestión de Minería // Umbral Especial
          </h3>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          El valor de lista total de los productos (sin descuentos) es de{' '}
          <strong className="text-white font-mono">
            ${totalListPrice.toLocaleString('es-CL', { minimumFractionDigits: 2 })} USD
          </strong>
          , superando el umbral de $150.000 USD.
        </p>

        <p className="text-xs text-slate-400 mb-4">
          ¿Deseas enviar un correo a <strong>Daniel Peña (danpena@cisco.com)</strong> solicitando apoyo con descuentos para este Deal?
        </p>

        <div className="mb-5">
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            Número de Deal (8 dígitos):
          </label>
          <input
            type="text"
            maxLength={8}
            value={dealId}
            onChange={(e) => setDealId(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej: 86146758"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Omitir
          </button>
          <button
            onClick={handleSendEmail}
            type="button"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
          >
            <span>✉️</span>
            <span>Sí, redactar correo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
