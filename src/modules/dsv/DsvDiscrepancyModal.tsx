import React from 'react';
import { DsvDiscrepancy } from './dsvEngine';

interface Props {
  isOpen: boolean;
  discrepancies: DsvDiscrepancy[];
  onResolve: (decision: 'BOM' | 'MATH') => void;
  onCancel: () => void;
}

export const DsvDiscrepancyModal: React.FC<Props> = ({
  isOpen,
  discrepancies,
  onResolve,
  onCancel,
}) => {
  if (!isOpen || discrepancies.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-2xl w-full border border-amber-500/40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Discrepancia Financiera en Servicios DSV
            </h3>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2.5 py-1 rounded-full border border-amber-500/30">
            {discrepancies.length} {discrepancies.length === 1 ? 'Línea' : 'Líneas'}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300">
            Se detectaron diferencias superiores a <strong className="text-amber-300">$0.02 USD</strong> entre el cálculo dinámico y el valor registrado en el BOM original de Cisco (Columna AE).
          </p>

          <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 custom-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-2.5">Línea / SKU</th>
                  <th className="p-2.5 text-center">Duración</th>
                  <th className="p-2.5 text-right">Cálculo Matemático</th>
                  <th className="p-2.5 text-right">BOM Cisco (Col. AE)</th>
                  <th className="p-2.5 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {discrepancies.map((d) => (
                  <tr key={d.lineNumber} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 font-medium text-white truncate max-w-[200px]" title={d.sku}>
                      {d.lineNumber} - {d.sku}
                    </td>
                    <td className="p-2.5 text-center text-slate-400">{d.durationMonths}m</td>
                    <td className="p-2.5 text-right text-slate-300">
                      ${d.calculatedPrice.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">
                      ${d.bomReportedPrice.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-amber-400">
                      ${d.difference.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-[11px] text-slate-400 space-y-1">
            <p>
              <strong className="text-emerald-300">• Valor Oficial Cisco (Columna AE):</strong> Garantiza coincidencia exacta con el sistema de validación de Cisco.
            </p>
            <p>
              <strong className="text-slate-300">• Cálculo Matemático:</strong> Aplica la fórmula estricta <code>Duration List * (1 - Discount)</code>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-950/60 px-6 py-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar Descarga
          </button>
          <button
            onClick={() => onResolve('MATH')}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-700"
          >
            Forzar Cálculo Matemático
          </button>
          <button
            onClick={() => onResolve('BOM')}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            Usar Valor Oficial Cisco (Recomendado)
          </button>
        </div>
      </div>
    </div>
  );
};
