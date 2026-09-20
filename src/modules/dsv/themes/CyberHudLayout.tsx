// ============================================================================
// CISCO AUTOMATED v2.1 - CYBER HUD RECONCILIATION LAYOUT (GOOGLE STITCH EDITION)
// ============================================================================

import React from 'react';
import { ReconciliationItem, resolveCategoryBadge } from '../types';

interface LayoutProps {
  items: ReconciliationItem[];
  totals: { theo: number; off: number; diff: number; diffPercent: number };
  hasHighVariance: boolean;
  onResolve: (decision: 'BOM' | 'MATH') => void;
  onCancel: () => void;
}

const formatUSD = (val: number): string => {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}$${intPart},${parts[1]}`;
};

export const CyberHudLayout: React.FC<LayoutProps> = ({
  items,
  totals,
  hasHighVariance,
  onResolve,
  onCancel,
}) => {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="relative w-full max-w-5xl bg-[#060c1d]/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_-10px_rgba(0,240,255,0.2)] flex flex-col overflow-hidden text-slate-200 font-sans animate-in fade-in duration-200"
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-80" />

      {/* Header HUD */}
      <header className="px-6 py-5 border-b border-cyan-950/80 bg-gradient-to-r from-[#071129] via-[#091533] to-[#071129] flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-950/80 to-purple-950/70 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_-3px_rgba(0,240,255,0.35)] shrink-0 mt-0.5">
            <svg className="w-6 h-6 text-[#00f0ff]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 2l7 4v6c0 5.25-3.5 10.05-7 11-3.5-.95-7-5.75-7-11V6l7-4z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 12h6m-3-3v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="modal-title" className="text-base sm:text-lg md:text-xl font-mono font-extrabold tracking-wider text-white flex items-center gap-2">
                CONCILIACIÓN FINANCIERA <span className="text-cyan-400">//</span> CISCO CCW v2.1
              </h2>
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-950/50 text-[#ff3366] border border-[#ff3366]/40 shadow-[0_0_15px_rgba(255,51,102,0.3)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff3366] animate-ping" />
                SYSTEM STATUS: ANOMALY DETECTED • BOM VARIANCE
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <p className="text-xs sm:text-sm text-slate-300 tracking-wide">
                Discrepancias detectadas entre el cálculo teórico del cotizador y la lista de materiales (BOM) oficial exportada de Cisco CCW.
              </p>
              <span className="text-[10px] font-mono text-cyan-400/70 px-2 py-0.5 bg-cyan-950/40 rounded border border-cyan-800/40 hidden md:inline-block">
                SECURITY_LEVEL: INTCOMEX_FIN_AUTH
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-[#00f0ff] rounded-lg bg-slate-900/60 hover:bg-cyan-950/50 border border-slate-700/60 hover:border-cyan-400/60 transition-colors cursor-pointer"
          title="Cerrar modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </header>

      {/* Body: KPIs + Matriz */}
      <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(88vh-180px)] custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: Teórico */}
          <div className="p-4 rounded-xl bg-[#091329]/90 border border-cyan-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-cyan-300/80">
              <span>TOTAL TEÓRICO INTCOMEX</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 text-cyan-400 rounded border border-cyan-800/50">THEO_SYS</span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold tracking-tight text-white">{formatUSD(totals.theo)}</span>
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">USD</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-cyan-950 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Algoritmo estándar v2.1
              </span>
              <span className="text-[10px] text-cyan-500/60 font-mono">CCW_CALC</span>
            </div>
          </div>

          {/* KPI 2: Oficial Cisco */}
          <div className="p-4 rounded-xl bg-[#071927]/90 border border-[#00ff9d]/40 shadow-[0_0_20px_-4px_rgba(0,255,157,0.3)] relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-[#00ff9d]">
              <span>TOTAL OFICIAL CISCO BOM</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-[#00ff9d]/20 text-[#00ff9d] rounded border border-[#00ff9d]/40 font-bold">VERIFIED</span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold tracking-tight text-[#00ff9d] drop-shadow-[0_0_12px_rgba(0,255,157,0.4)]">
                {formatUSD(totals.off)}
              </span>
              <span className="text-xs font-mono text-[#00ff9d] font-bold tracking-wider">USD</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-emerald-950 flex items-center justify-between text-[11px] font-mono text-[#00ff9d]/80">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]" />
                Exportación CCW validada
              </span>
              <span className="text-[10px] text-[#00ff9d]/70">CISCO_LIVE</span>
            </div>
          </div>

          {/* KPI 3: Diferencia Neta */}
          <div className="p-4 rounded-xl bg-[#1d0b17]/90 border border-[#ff3366]/40 shadow-[0_0_20px_-3px_rgba(255,51,102,0.3)] relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-rose-300">
              <span>DIFERENCIA NETA TOTAL</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/50">
                {totals.diffPercent >= 0 ? '+' : ''}{totals.diffPercent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold tracking-tight text-[#ff3366] drop-shadow-[0_0_10px_rgba(255,51,102,0.4)]">
                {formatUSD(totals.diff)}
              </span>
              <span className="text-xs font-mono text-[#ff3366] font-semibold tracking-wider">USD</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-rose-950 flex items-center justify-between text-[11px] font-mono text-[#ff6b8b]">
              <span className="flex items-center gap-1.5 font-semibold">
                <svg className="w-3.5 h-3.5 text-[#ff3366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                </svg>
                Desvío detectado
              </span>
              <span className="text-[10px] text-rose-400/70">ERR_DELTA</span>
            </div>
          </div>

          {/* KPI 4: Estado de Validación */}
          <div className="p-4 rounded-xl bg-[#1c1304]/90 border border-amber-500/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-amber-300/90">
              <span>ESTADO DE VALIDACIÓN</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <div className="mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/40">
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                ACTION REQUIRED // OVERRIDE
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-amber-950 flex items-center justify-between text-[11px] font-mono text-amber-200/80">
              <span>{hasHighVariance ? 'Discrepancia > $1.000 USD' : 'Tolerancia superada'}</span>
              <span className="text-[10px] text-amber-400/60 font-mono">PRIORITY_HIGH</span>
            </div>
          </div>
        </div>

        {/* Data Matrix Table */}
        <div className="rounded-xl border border-cyan-500/30 bg-[#060c1d]/90 overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-[#081329] border-b border-cyan-900/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
              <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
                CYBER DATA MATRIX // DESGLOSE COMPARATIVO CISCO CCW
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400">
                LINE_ITEMS: {items.length.toString().padStart(2, '0')} DETECTED
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                MODE: BOM_AUDIT
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cyan-950/90 bg-[#050c1f] text-[11px] font-mono tracking-wider text-cyan-400/90 font-bold uppercase">
                  <th className="py-3 px-4">SKU // LINE ITEM</th>
                  <th className="py-3 px-4 text-right">CÁLCULO TEÓRICO</th>
                  <th className="py-3 px-4 text-right text-[#00ff9d]">BOM OFICIAL CCW</th>
                  <th className="py-3 px-4 text-right text-rose-400">DIFERENCIA (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-950/40 text-xs font-sans">
                {items.map((row, idx) => {
                  const rowDiff = row.officialPrice - row.theoreticalPrice;
                  const tag = row.categoryTag || resolveCategoryBadge(row.sku);
                  return (
                    <tr key={idx} className="hover:bg-cyan-950/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-100 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                            {tag}
                          </span>
                          <span className="text-cyan-100 tracking-wide">{row.sku}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 pl-1 font-medium truncate max-w-md">
                          {row.description}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatUSD(row.theoreticalPrice)} <span className="text-[10px] text-slate-500">USD</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#00ff9d]">
                        {formatUSD(row.officialPrice)} <span className="text-[10px] text-emerald-400">USD</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {Math.abs(rowDiff) > 0.02 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-[#ff3366] bg-[#ff3366]/10 px-2.5 py-1 rounded border border-[#ff3366]/30">
                            {formatUSD(rowDiff)} USD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-cyan-300/80 bg-cyan-950/40 px-2.5 py-1 rounded border border-cyan-800/50">
                            $0,00 USD
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-[#071329] via-[#091b3d] to-[#071329] border-t-2 border-cyan-400/50 font-bold text-xs">
                  <td className="py-4 px-4 font-mono text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-400 rotate-45" />
                    TOTAL CONSOLIDADO CONCILIADO
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-slate-200 text-sm font-semibold">
                    {formatUSD(totals.theo)} <span className="text-[10px] text-slate-400">USD</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-extrabold text-[#00ff9d] text-base drop-shadow-[0_0_10px_rgba(0,255,157,0.5)]">
                    {formatUSD(totals.off)} <span className="text-xs text-emerald-400">USD</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-extrabold text-[#ff3366] text-base drop-shadow-[0_0_10px_rgba(255,51,102,0.5)]">
                    {formatUSD(totals.diff)} <span className="text-xs text-rose-400">USD</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audit Telemetry Callout */}
        <aside className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-cyan-950/30 border border-cyan-500/30 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-[#00f0ff] shrink-0 mt-0.5 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
          <div className="text-xs text-cyan-200/90 leading-relaxed">
            <span className="font-mono font-bold text-white tracking-wider mr-1">[AUDIT_TELEMETRY]:</span>
            La selección del valor oficial actualizará los márgenes netos y el reporte DSV final para Intcomex en la matriz operativa.
          </div>
        </aside>
      </div>

      {/* Footer Actions */}
      <footer className="px-6 py-4 border-t border-cyan-950/80 bg-gradient-to-r from-[#060c1c] via-[#081329] to-[#060c1c] flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={onCancel}
          type="button"
          className="w-full sm:w-auto px-4 py-2 text-xs font-mono tracking-wider text-slate-400 hover:text-cyan-300 transition-colors uppercase cursor-pointer"
        >
          // Cancelar y revisar más tarde
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => onResolve('MATH')}
            type="button"
            className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-[#0c162e] hover:bg-[#112042] text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_15px_-3px_rgba(0,240,255,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Forzar Cálculo</span>
          </button>

          <button
            onClick={() => onResolve('BOM')}
            type="button"
            className="px-6 py-2.5 rounded-xl text-xs font-mono font-extrabold uppercase tracking-widest text-[#030a14] bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#00df8f] hover:brightness-110 shadow-[0_0_25px_rgba(0,255,157,0.5)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-[#030a14] stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Usar Valor Oficial Cisco</span>
          </button>
        </div>
      </footer>
    </section>
  );
};
