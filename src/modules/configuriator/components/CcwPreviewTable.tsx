// ============================================================================
// CISCO AUTOMATED v2.1 - CCW 10-COLUMN PREVIEW TABLE COMPONENT
// Incluye control de colapsar / ocultar tabla interactiva sin perder datos
// ============================================================================

import React, { useState } from 'react';
import { FileSpreadsheet, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import type { CcwAssembledRow } from '../ccwExcelGenerator';

export interface CcwPreviewTableProps {
  assembledRows: CcwAssembledRow[];
  clientName: string;
  isTableCollapsed?: boolean;
  onToggleTableCollapse?: () => void;
}

export const CcwPreviewTable: React.FC<CcwPreviewTableProps> = ({
  assembledRows,
  clientName,
  isTableCollapsed,
  onToggleTableCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);
  const isCollapsed = isTableCollapsed !== undefined ? isTableCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleTableCollapse) {
      onToggleTableCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  if (!assembledRows || assembledRows.length === 0) {
    return null;
  }

  const sanitizedClient = (clientName || 'Cliente').replace(/\s+/g, '_');
  const parentCount = assembledRows.filter((r) => r.isParent).length;
  const childCount = assembledRows.filter((r) => !r.isParent).length;
  const totalGpl = assembledRows.reduce((acc, r) => acc + (Number(r.estimatedTotalListUsd) || 0), 0);
  const totalNet = assembledRows.reduce((acc, r) => acc + (Number(r.estimatedTotalNetUsd) || 0), 0);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 transition-all">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-700/40 flex items-center justify-center text-cyan-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                3. Hoja "Sheet1" CCW (10 Columnas)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 text-[10px] font-bold font-mono">
                {assembledRows.length} Líneas ({parentCount} Madre &bull; {childCount} Hijos)
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              CCW_BOM_Upload_{sanitizedClient}.xlsx
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isCollapsed
                ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border-cyan-600/50 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={
              isCollapsed
                ? 'Mostrar tabla completa de 10 columnas'
                : 'Ocultar / Colapsar tabla para ahorrar espacio en pantalla'
            }
          >
            {isCollapsed ? (
              <>
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mostrar Tabla ({assembledRows.length} Líneas)</span>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Ocultar Tabla</span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Franja Resumen cuando la tabla está colapsada/oculta */}
      {isCollapsed ? (
        <div
          onClick={handleToggle}
          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-700/50 flex items-center justify-between flex-wrap gap-2 text-xs cursor-pointer transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[11px]">
              Tabla colapsada &bull; Haz clic para ver el detalle de las 10 columnas oficiales de CCW.
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-amber-300">
              GPL Total: US$ {totalGpl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-emerald-300 font-bold">
              Neto Est: US$ {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-800 rounded-xl custom-scrollbar animate-fade-in">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] font-bold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Jerarquía</th>
                <th className="py-2.5 px-3">Part Number</th>
                <th className="py-2.5 px-3 text-center">Quantity</th>
                <th className="py-2.5 px-3 text-center">Duration (Mnths)</th>
                <th className="py-2.5 px-3 text-center">Initial Term</th>
                <th className="py-2.5 px-3">Billing Model</th>
                <th className="py-2.5 px-3 text-right">Ref. Lista USD</th>
                <th className="py-2.5 px-3 text-center">% Dcto</th>
                <th className="py-2.5 px-3 text-right">Neto Est. USD</th>
                <th className="py-2.5 px-3">Descripción / Reconciliación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {assembledRows.map((row, rIdx) => (
                <tr
                  key={row.rowId}
                  className={
                    row.isParent
                      ? 'bg-emerald-950/25 font-semibold text-white'
                      : 'bg-slate-950/40 text-slate-300'
                  }
                >
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                    {rIdx + 1}
                  </td>
                  <td className="py-2 px-3">
                    {row.isParent ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/40 text-[10px] font-black uppercase">
                        MADRE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/30 text-[10px] font-bold uppercase ml-2">
                        ↳ HIJO
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono">
                    <span
                      className={
                        row.isParent ? 'text-emerald-300 font-bold' : 'text-slate-200 pl-2'
                      }
                    >
                      {row.partNumber}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono">{row.quantity}</td>
                  <td className="py-2 px-3 text-center font-mono text-cyan-300">
                    {row.durationMonths || '-'}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-cyan-300">
                    {row.initialTerm || '-'}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-300">
                    {row.billingModel || '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-200">
                    {typeof row.estimatedTotalListUsd === 'number' &&
                    row.estimatedTotalListUsd > 0
                      ? `$${row.estimatedTotalListUsd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : '$0.00'}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-[11px] text-amber-300">
                    {typeof row.estimatedTotalListUsd === 'number' &&
                    row.estimatedTotalListUsd > 0
                      ? `${(row.clientDiscountPct ?? 38).toFixed(1)}%`
                      : '0%'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[11px] text-emerald-300 font-bold">
                    {typeof row.estimatedTotalNetUsd === 'number' &&
                    row.estimatedTotalNetUsd > 0
                      ? `$${row.estimatedTotalNetUsd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : '$0.00'}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-400 max-w-[240px] truncate">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
