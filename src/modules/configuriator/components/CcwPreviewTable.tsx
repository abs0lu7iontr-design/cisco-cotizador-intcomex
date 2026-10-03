// ============================================================================
// CISCO AUTOMATED v2.1 - CCW 10-COLUMN PREVIEW TABLE COMPONENT
// ============================================================================

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { CcwAssembledRow } from '../ccwExcelGenerator';

export interface CcwPreviewTableProps {
  assembledRows: CcwAssembledRow[];
  clientName: string;
}

export const CcwPreviewTable: React.FC<CcwPreviewTableProps> = ({
  assembledRows,
  clientName,
}) => {
  if (!assembledRows || assembledRows.length === 0) {
    return null;
  }

  const sanitizedClient = (clientName || 'Cliente').replace(/\s+/g, '_');

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          <span>
            3. Vista Previa Hoja "Sheet1" &bull; Orden Secuencial Madre-Hijo (UploadExcelTemplate)
          </span>
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          CCW_BOM_Upload_{sanitizedClient}.xlsx
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
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
    </div>
  );
};
