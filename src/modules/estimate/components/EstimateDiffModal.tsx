// ============================================================================
// CISCO AUTOMATED v2.1 - ESTIMATE VERSION HISTORY & SNAPSHOT DIFF MODAL
// ============================================================================

import React, { useState, useMemo } from 'react';
import { ProcessedEstimateResult, EstimateLineItem, OverrideRuleType } from '../../../core/types';
import { roundFinancial } from '../../../core/calculations';
import {
  X,
  GitCompare,
  ArrowRight,
  Filter,
  Download,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface EstimateDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResult: ProcessedEstimateResult;
  shadowSnapshot?: ProcessedEstimateResult | null;
  overrides?: Record<string, OverrideRuleType>;
}

interface DiffRow {
  rowId: string;
  partNumber: string;
  description: string;
  qty: number;
  baseUnit: number;
  currentUnit: number;
  baseExt: number;
  currentExt: number;
  deltaExt: number;
  deltaPct: number;
  baseRule: string;
  currentRule: string;
  hasChanged: boolean;
  isFastTrack: boolean;
}

export const EstimateDiffModal: React.FC<EstimateDiffModalProps> = ({
  isOpen,
  onClose,
  currentResult,
  shadowSnapshot,
  overrides = {},
}) => {
  const [onlyChanges, setOnlyChanges] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Computar filas de comparación
  const diffRows: DiffRow[] = useMemo(() => {
    if (!currentResult || !currentResult.items) return [];

    const snapshotMap = new Map<string, EstimateLineItem>();
    if (shadowSnapshot && shadowSnapshot.items) {
      shadowSnapshot.items.forEach((it, idx) => {
        const key = `${it.partNumber}_${it.lineNumber || it.itemNo || idx}`;
        snapshotMap.set(key, it);
      });
    }

    return currentResult.items
      .filter((it) => !it.isInfoRow && it.qty > 0)
      .map((it, idx) => {
        const key = `${it.partNumber}_${it.lineNumber || it.itemNo || idx}`;
        const snap = snapshotMap.get(key);

        const baseUnit = snap
          ? snap.precioVentaUnitario
          : it.originalNetCiscoUnit || it.netCiscoUnit;
        const currentUnit = it.precioVentaUnitario;

        const baseExt = roundFinancial(baseUnit * it.qty);
        const currentExt = roundFinancial(currentUnit * it.qty);
        const deltaExt = roundFinancial(currentExt - baseExt);
        const deltaPct = baseExt > 0 ? roundFinancial(((currentExt - baseExt) / baseExt) * 100) : 0;

        const baseRule = snap
          ? snap.appliedRule || (snap.isIntangible ? 'INTANGIBLE' : 'EQUIPO')
          : it.isIntangible ? 'INTANGIBLE' : 'EQUIPO';
        const currentRule = it.appliedRule || overrides[it.partNumber] || (it.isIntangible ? 'INTANGIBLE' : 'EQUIPO');

        const hasChanged = Math.abs(deltaExt) > 0.01 || baseRule !== currentRule;

        return {
          rowId: key,
          partNumber: it.partNumber,
          description: it.description,
          qty: it.qty,
          baseUnit,
          currentUnit,
          baseExt,
          currentExt,
          deltaExt,
          deltaPct,
          baseRule,
          currentRule,
          hasChanged,
          isFastTrack: Boolean(it.isFastTrackPromo),
        };
      });
  }, [currentResult, shadowSnapshot, overrides]);

  const filteredRows = useMemo(() => {
    return onlyChanges ? diffRows.filter((r) => r.hasChanged) : diffRows;
  }, [diffRows, onlyChanges]);

  // Totales generales
  const totals = useMemo(() => {
    const baseTotal = diffRows.reduce((acc, r) => acc + r.baseExt, 0);
    const currentTotal = diffRows.reduce((acc, r) => acc + r.currentExt, 0);
    const deltaTotal = roundFinancial(currentTotal - baseTotal);
    const deltaPctTotal = baseTotal > 0 ? roundFinancial((deltaTotal / baseTotal) * 100) : 0;
    const changedCount = diffRows.filter((r) => r.hasChanged).length;
    return {
      baseTotal: roundFinancial(baseTotal),
      currentTotal: roundFinancial(currentTotal),
      deltaTotal,
      deltaPctTotal,
      changedCount,
    };
  }, [diffRows]);

  if (!isOpen) return null;

  const handleCopyDiff = () => {
    const headers = ['Part Number', 'Qty', 'Base Unit', 'Actual Unit', 'Base Ext', 'Actual Ext', 'Delta ($)', 'Delta (%)', 'Regla Base', 'Regla Actual'];
    const lines = filteredRows.map((r) => [
      r.partNumber,
      r.qty,
      r.baseUnit.toFixed(2),
      r.currentUnit.toFixed(2),
      r.baseExt.toFixed(2),
      r.currentExt.toFixed(2),
      r.deltaExt.toFixed(2),
      `${r.deltaPct}%`,
      r.baseRule,
      r.currentRule,
    ].join('\t'));

    const tsv = [headers.join('\t'), ...lines].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleExportCsv = () => {
    const headers = 'Part Number,Description,Qty,Base Unit,Actual Unit,Base Ext,Actual Ext,Delta Ext,Delta Pct,Base Rule,Current Rule\n';
    const rows = filteredRows
      .map((r) =>
        `"${r.partNumber}","${r.description.replace(/"/g, '""')}",${r.qty},${r.baseUnit},${r.currentUnit},${r.baseExt},${r.currentExt},${r.deltaExt},${r.deltaPct}%,"${r.baseRule}","${r.currentRule}"`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diff_Cotizacion_${currentResult.fileName || 'Estimate'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Comparador de Versiones (Snapshot Diff)
              </h2>
              <p className="text-xs text-slate-400">
                Comparación entre la línea base original (o snapshot guardado) y la versión recalculada actual.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Superior */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-5 bg-slate-900/40 border-b border-slate-800/80">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              {shadowSnapshot ? 'Total Snapshot Guardado' : 'Total Costo Base Cisco'}
            </span>
            <span className="text-lg font-mono font-black text-slate-300">
              ${totals.baseTotal.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">
              Total Versión Actual
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">
              ${totals.currentTotal.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Diferencia Neta (&Delta;)
            </span>
            <div className="flex items-center space-x-1.5">
              {totals.deltaTotal >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
              <span
                className={`text-lg font-mono font-black ${
                  totals.deltaTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totals.deltaTotal >= 0 ? '+' : ''}$
                {totals.deltaTotal.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({totals.deltaPctTotal >= 0 ? '+' : ''}{totals.deltaPctTotal}%)
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Filas con Cambios
            </span>
            <span className="text-lg font-mono font-black text-amber-400">
              {totals.changedCount} / {diffRows.length}
            </span>
          </div>
        </div>

        {/* Toolbar de Filtro y Exportación */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-900/30 border-b border-slate-800/80 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setOnlyChanges(!onlyChanges)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                onlyChanges
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyChanges ? 'Mostrando solo cambios' : 'Mostrar solo cambios'}</span>
            </button>
            <span className="text-slate-500 text-[11px]">
              {filteredRows.length} filas listadas
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyDiff}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar TSV'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Tabla Diff */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2 px-3">Part Number</th>
                <th className="py-2 px-2 text-center w-14">Qty</th>
                <th className="py-2 px-3 text-right">Unit Base</th>
                <th className="py-2 px-3 text-right">Unit Actual</th>
                <th className="py-2 px-3 text-right">Ext Base</th>
                <th className="py-2 px-3 text-right">Ext Actual</th>
                <th className="py-2 px-3 text-right">&Delta; Ext</th>
                <th className="py-2 px-3 text-center">Regla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredRows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-900/60 transition-colors ${
                    r.hasChanged ? 'bg-amber-950/10' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-semibold text-slate-200">
                    <div className="flex items-center space-x-1.5">
                      <span>{r.partNumber}</span>
                      {r.isFastTrack && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          FT
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-sans truncate max-w-xs">
                      {r.description}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400">{r.qty}</td>
                  <td className="py-2 px-3 text-right text-slate-400">
                    ${r.baseUnit.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                    ${r.currentUnit.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400">
                    ${r.baseExt.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                    ${r.currentExt.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`font-bold ${
                        r.deltaExt > 0
                          ? 'text-emerald-400'
                          : r.deltaExt < 0
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {r.deltaExt > 0 ? '+' : ''}${r.deltaExt.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      ({r.deltaPct > 0 ? '+' : ''}{r.deltaPct}%)
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {r.baseRule !== r.currentRule ? (
                      <div className="inline-flex items-center space-x-1 text-[10px]">
                        <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                          {r.baseRule}
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                          {r.currentRule}
                        </span>
                      </div>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-400">
                        {r.currentRule}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
