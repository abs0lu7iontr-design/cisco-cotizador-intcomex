// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODAL
// ============================================================================

import React, { useState, useEffect } from 'react';
import { BoLineItem } from './boTypes';
import { BO_EMAIL_TO, BO_EMAIL_CC, copyBoTableToClipboard } from './boEmailHelper';

interface Props {
  isOpen: boolean;
  initialClientName: string;
  initialLines: BoLineItem[];
  onClose: () => void;
}

export const BoRequestModal: React.FC<Props> = ({
  isOpen,
  initialClientName,
  initialLines,
  onClose,
}) => {
  const [clientName, setClientName] = useState(initialClientName || 'Cliente');
  const [lines, setLines] = useState<BoLineItem[]>(initialLines);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientName(initialClientName || 'Cliente');
      setLines(initialLines);
      setCopied(false);
    }
  }, [isOpen, initialClientName, initialLines]);

  if (!isOpen) return null;

  const handleSkuChange = (index: number, newSku: string) => {
    const updated = [...lines];
    updated[index].sku = newSku.toUpperCase();
    setLines(updated);
  };

  const handleCopy = async () => {
    const ok = await copyBoTableToClipboard(lines);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenOutlook = () => {
    const subject = encodeURIComponent(`RV: Cotización ${clientName}`);
    const body = encodeURIComponent(
      'Estimado,\n\nBuenos días, por favor crear BO.\n\n(Pega aquí la tabla copiada usando CTRL+V)\n\nSaludos,'
    );
    window.location.href = `mailto:${BO_EMAIL_TO}?cc=${BO_EMAIL_CC}&subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100 font-sans flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span> Solicitud de Creación de BO (Ventas Core)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Valores netos de costo (sin márgenes ni internación). Revisa y copia la tabla para enviar a Outlook.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Datos Cabecera Correo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800 text-xs mb-4">
          <div>
            <span className="text-zinc-400 font-mono">Para:</span>
            <div className="text-white font-medium truncate">{BO_EMAIL_TO}</div>
          </div>
          <div>
            <span className="text-zinc-400 font-mono">CC:</span>
            <div className="text-white font-medium truncate">{BO_EMAIL_CC}</div>
          </div>
          <div>
            <span className="text-zinc-400 font-mono">Asunto: RV: Cotización</span>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 mt-0.5"
              placeholder="Nombre del Cliente"
            />
          </div>
        </div>

        {/* Tabla Editable */}
        <div className="flex-1 overflow-y-auto border border-zinc-800 rounded-xl mb-4 custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#808080] text-black font-bold border-b border-zinc-800 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2.5 text-center">SKU</th>
                <th className="p-2.5 text-center">Part Number</th>
                <th className="p-2.5 text-center">Bodega</th>
                <th className="p-2.5 text-center">Qty</th>
                <th className="p-2.5 text-right">Unit Net Price</th>
                <th className="p-2.5 text-right">Extended Net Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-900/40 font-mono">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-500 font-sans">
                    No se detectaron líneas válidas en el Estimate para generar la solicitud de BO.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="p-2 text-center">
                      <input
                        type="text"
                        value={line.sku}
                        placeholder="SKU Intcomex"
                        onChange={(e) => handleSkuChange(idx, e.target.value)}
                        className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-white text-xs w-28 focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-center text-zinc-200">{line.partNumber}</td>
                    <td className="p-2 text-center font-bold text-amber-400">{line.bodega}</td>
                    <td className="p-2 text-center">{line.qty}</td>
                    <td className="p-2 text-right text-zinc-300">
                      {line.unitNetPrice.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-bold text-emerald-400">
                      {line.extendedNetPrice.toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenOutlook}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Abrir plantilla en Microsoft Outlook o cliente de correo predeterminado"
            >
              <span>✉️</span>
              <span>Abrir en Outlook</span>
            </button>

            <button
              onClick={handleCopy}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
              }`}
              title="Copiar tabla HTML con estilos para pegar directamente en Outlook"
            >
              {copied ? (
                <>
                  <span>✓</span> ¡Copiado con Formato Outlook!
                </>
              ) : (
                <>
                  <span>📋</span> Copiar Tabla HTML
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
