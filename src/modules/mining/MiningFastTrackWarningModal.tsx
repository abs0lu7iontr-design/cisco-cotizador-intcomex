// ============================================================================
// CISCO AUTOMATED v2.1 - MINING OBSERVER: FAST TRACK WARNING MODAL
// Pure Observer Mode: Non-intrusive warning modal recommending CCW revision
// ============================================================================

import React, { useState } from 'react';
import { MiningFastTrackAlertData } from './miningFastTrackDetector';
import { AlertTriangle, Copy, Check, X, ShieldAlert, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  data: MiningFastTrackAlertData | null;
  onClose: () => void;
}

export const MiningFastTrackWarningModal: React.FC<Props> = ({
  isOpen,
  data,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !data || !data.shouldAlert) return null;

  const { matchedItems, commonDiscountPct, accountName } = data;

  const uniqueDiscounts = Array.from(
    new Set(matchedItems.map((it) => Math.round(it.fastTrackDiscountPct * 10) / 10))
  );
  const discountLabel =
    uniqueDiscounts.length > 0
      ? uniqueDiscounts.map((d) => `${d}%`).join(' / ')
      : `${commonDiscountPct}%`;

  const handleCopySummary = async () => {
    const linesText = matchedItems
      .map(
        (it) =>
          `- P/N: ${it.partNumber} | Qty: ${it.qty} | Lista: $${it.unitListPrice.toLocaleString(
            'es-CL'
          )} | Neto: $${it.netCiscoUnit.toLocaleString(
            'es-CL'
          )} | Descuento: ${it.currentDiscountPct}% (Fast Track Catálogo: ${it.fastTrackDiscountPct}%)`
      )
      .join('\n');

    const summaryText =
      `[ALERTA MINERÍA - POSIBLE USO DE FAST TRACK]\n` +
      `Cuenta Minera: ${accountName || 'Minería Detectada'}\n` +
      `Descuento Fast Track detectado: ${discountLabel}\n` +
      `Ítems detectados (${matchedItems.length}):\n` +
      linesText +
      `\n\nSugerencia: Revisar nuevamente el Estimate en Cisco CCW (en minería aplican descuentos corporativos negociados, no Fast Track).`;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-zinc-950 border border-amber-500/50 rounded-2xl p-5 sm:p-6 shadow-2xl text-zinc-100 font-sans flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5 text-amber-400">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Gestión de Minería // Posible Uso de Fast Track Detectado</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Alerta de integridad comercial exclusiva para cuentas mineras {accountName ? `(${accountName})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensaje de Explicación y Sugerencia */}
        <div className="bg-amber-950/25 border border-amber-500/30 rounded-xl p-3.5 mb-3 text-xs leading-relaxed space-y-2">
          <div className="flex items-start gap-2 text-amber-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>Regla de Negocio Minería:</strong> En cuentas de minería <strong>no se utiliza Fast Track</strong>, sino los acuerdos y descuentos comerciales corporativos negociados para la cuenta.
            </span>
          </div>
          <p className="text-zinc-300 text-[11px] pl-6">
            Al realizar el cruce con el catálogo Fast Track, se detectaron <strong className="text-amber-300">{matchedItems.length} ítem(s)</strong> cuyo descuento en CCW coincide exactamente con el del catálogo Fast Track (<strong className="text-amber-300">{discountLabel}</strong>). Esto indica que el Estimate pudo haber sido configurado en CCW utilizando una promoción Fast Track en lugar del acuerdo minero.
          </p>
          <div className="bg-zinc-900/80 border border-amber-500/20 rounded-lg p-2 text-[11px] text-zinc-200 pl-3">
            💡 <strong className="text-amber-300">Sugerencia Preventiva:</strong> Se sugiere revisar nuevamente el Estimate en <strong>Cisco CCW</strong> antes de emitir la cotización definitiva para validar los descuentos de la cuenta minera.
          </div>
        </div>

        {/* Tabla Informativa de Ítems Detectados (Modo Observador) */}
        <div className="flex-1 overflow-y-auto border border-zinc-800 rounded-xl overflow-hidden mb-3">
          <div className="bg-zinc-900 px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Ítems con Posible Uso de Fast Track ({matchedItems.length})
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Descuento Fast Track detectado en CCW: <strong className="text-amber-400 font-bold">{discountLabel}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead className="bg-zinc-900 text-zinc-400 text-[11px] border-b border-zinc-800">
                <tr>
                  <th className="p-2 text-center w-12">Línea</th>
                  <th className="p-2 text-left">Part Number</th>
                  <th className="p-2 text-center w-14">Cant.</th>
                  <th className="p-2 text-right w-24">Precio Lista</th>
                  <th className="p-2 text-right w-24">Neto CCW</th>
                  <th className="p-2 text-center w-24">Desc. CCW</th>
                  <th className="p-2 text-center w-24">Fast Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40 text-[11px]">
                {matchedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="p-2 text-center text-zinc-500">{item.lineNumber || idx + 1}</td>
                    <td className="p-2 text-left">
                      <div className="font-bold text-zinc-200">{item.partNumber}</div>
                      {item.description && (
                        <div className="text-[10px] text-zinc-500 truncate max-w-xs">{item.description}</div>
                      )}
                    </td>
                    <td className="p-2 text-center text-zinc-300">{item.qty}</td>
                    <td className="p-2 text-right text-zinc-400">
                      ${item.unitListPrice.toLocaleString('es-CL')}
                    </td>
                    <td className="p-2 text-right font-medium text-zinc-200">
                      ${item.netCiscoUnit.toLocaleString('es-CL')}
                    </td>
                    <td className="p-2 text-center font-bold text-amber-400">
                      {item.currentDiscountPct}%
                    </td>
                    <td className="p-2 text-center text-zinc-400">
                      {item.fastTrackDiscountPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nota de Modo Observador */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-800 mb-3">
          <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>
            <strong>Modo Observador Puro:</strong> Este aviso es de auditoría preventiva y no realiza ninguna modificación en el Estimate. Al omitir, puedes continuar editando parámetros, márgenes o descargando el archivo con total normalidad.
          </span>
        </div>

        {/* Acciones Inferiores */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-xl border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copiar lista de P/N detectados al portapapeles"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">¡Copiado al Portapapeles!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Detalle</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
            title="Omitir alerta y continuar trabajando en el cotizador normalmente"
          >
            <span>Entendido / Omitir y Continuar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
