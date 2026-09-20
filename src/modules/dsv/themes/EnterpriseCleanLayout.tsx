// ============================================================================
// CISCO AUTOMATED v2.1 - ENTERPRISE CLEAN RECONCILIATION LAYOUT
// ============================================================================

import React from 'react';
import { ReconciliationItem } from '../types';

interface LayoutProps {
  items: ReconciliationItem[];
  totals: { theo: number; off: number; diff: number; diffPercent: number };
  onResolve: (decision: 'BOM' | 'MATH') => void;
  onCancel: () => void;
}

export const EnterpriseCleanLayout: React.FC<LayoutProps> = ({
  items,
  totals,
  onResolve,
  onCancel,
}) => {
  return (
    <section
      role="dialog"
      aria-modal="true"
      className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-xl p-6 text-zinc-100 shadow-2xl font-sans animate-in fade-in duration-150"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Conciliación de Cotización CCW</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Auditoría de variaciones en líneas de servicio y hardware.</p>
        </div>
        <div className="flex gap-4 text-xs font-mono bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
          <span>Teórico: <strong>${totals.theo.toLocaleString('es-CL', { minimumFractionDigits: 2 })} USD</strong></span>
          <span className="text-zinc-600">|</span>
          <span>BOM Oficial: <strong className="text-emerald-400">${totals.off.toLocaleString('es-CL', { minimumFractionDigits: 2 })} USD</strong></span>
          <span className="text-zinc-600">|</span>
          <span className="text-rose-400">Δ: <strong>${totals.diff.toLocaleString('es-CL', { minimumFractionDigits: 2 })} USD</strong></span>
        </div>
      </div>

      <div className="my-6 border border-zinc-800 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-zinc-900/80 text-zinc-400 font-medium border-b border-zinc-800 sticky top-0">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3 text-right">Teórico</th>
              <th className="p-3 text-right">BOM Oficial</th>
              <th className="p-3 text-right">Variación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {items.map((it, i) => (
              <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                <td className="p-3 font-medium text-white">
                  {it.sku}
                  <div className="text-[11px] text-zinc-400 font-sans">{it.description}</div>
                </td>
                <td className="p-3 text-right font-mono text-zinc-300">${it.theoreticalPrice.toFixed(2)}</td>
                <td className="p-3 text-right font-mono font-medium text-emerald-400">${it.officialPrice.toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-rose-400">
                  ${(it.officialPrice - it.theoreticalPrice).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={() => onResolve('MATH')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg border border-zinc-700 transition-colors cursor-pointer"
        >
          Forzar Teórico
        </button>
        <button
          onClick={() => onResolve('BOM')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
        >
          Aceptar BOM Oficial
        </button>
      </div>
    </section>
  );
};
