// ============================================================================
// CISCO AUTOMATED v2.1 - QUOTER EXECUTIVE FINANCIAL SUMMARY CARDS
// ============================================================================

import React, { useState } from 'react';
import { ProcessedEstimateResult, QuoteParameters } from '../core/types';
import {
  CurrencyCode,
  CurrencyConversionRates,
  DEFAULT_CURRENCY_RATES,
  convertUsdToCurrency,
  formatCurrencyAmount,
} from '../core/calculations';
import { DollarSign, TrendingUp, ShieldCheck, Truck, Sparkles, Layers, Percent, Pickaxe, Coins } from 'lucide-react';
import { AuditReport } from '../modules/mining';

interface SummaryCardsProps {
  data: ProcessedEstimateResult;
  params: QuoteParameters;
  miningAudit?: AuditReport | null;
  onOpenMiningAudit?: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  data,
  params,
  miningAudit,
  onOpenMiningAudit,
}) => {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem('cisco_selected_currency');
      if (saved === 'USD' || saved === 'CLP' || saved === 'UF') return saved;
    } catch {}
    return 'USD';
  });

  const [rates, setRates] = useState<CurrencyConversionRates>(() => {
    try {
      const saved = localStorage.getItem('cisco_custom_currency_rates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Number(parsed.CLP) > 0 && Number(parsed.UF) > 0) {
          return { ...DEFAULT_CURRENCY_RATES, ...parsed };
        }
      }
    } catch {}
    return DEFAULT_CURRENCY_RATES;
  });

  const [showRateSettings, setShowRateSettings] = useState<boolean>(false);

  const handleSelectCurrency = (c: CurrencyCode) => {
    setCurrency(c);
    try {
      localStorage.setItem('cisco_selected_currency', c);
    } catch {}
  };

  const handleUpdateRates = (newRates: CurrencyConversionRates) => {
    setRates(newRates);
    try {
      localStorage.setItem('cisco_custom_currency_rates', JSON.stringify(newRates));
    } catch {}
  };

  const formatCurrency = (amountUsd?: number) => {
    if (amountUsd === undefined || amountUsd === null || isNaN(amountUsd)) return '$0.00';
    if (currency === 'USD') {
      return (
        '$' +
        amountUsd.toLocaleString('es-CL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
    const converted = convertUsdToCurrency(amountUsd, currency, rates);
    return formatCurrencyAmount(converted, currency);
  };

  const totalDelta = data.calculatedProductTotal - data.originalProductTotal;
  const totalCostSum = data.items.reduce(
    (acc, item) => acc + item.costoTotalUnitario * item.qty,
    0
  );
  const netProfit = data.calculatedProductTotal - totalCostSum;
  const profitMarginReal = data.calculatedProductTotal > 0
    ? (netProfit / data.calculatedProductTotal) * 100
    : 0;

  const totalItemsCount = data.items.reduce((acc, i) => acc + (i.isInfoRow ? 0 : i.qty), 0);
  const intangiblesCount = data.items.filter((i) => !i.isInfoRow && i.isIntangible).length;
  const arancelCount = data.items.filter((i) => !i.isInfoRow && i.llevaArancel).length;
  const ftCount = data.items.filter((i) => !i.isInfoRow && i.isFastTrackPromo).length;

  return (
    <div className="space-y-3">
      {/* Selector de Divisa y Tipo de Cambio */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <Coins className="w-3 h-3 text-amber-400" />
            <span>Moneda:</span>
          </span>
          {(['USD', 'CLP', 'UF'] as CurrencyCode[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSelectCurrency(c)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currency === c
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {currency !== 'USD' && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-800">
            <span>TC Ref: 1 USD = ${rates.CLP.toLocaleString('es-CL')} CLP</span>
            <span>•</span>
            <span>1 UF = ${rates.UF.toLocaleString('es-CL')} CLP</span>
            <button
              type="button"
              onClick={() => setShowRateSettings((prev) => !prev)}
              className="text-indigo-400 hover:text-indigo-300 underline text-[10px] ml-1 cursor-pointer"
            >
              {showRateSettings ? 'Ocultar' : 'Ajustar TC'}
            </button>
          </div>
        )}
      </div>

      {showRateSettings && currency !== 'USD' && (
        <div className="bg-slate-900 border border-indigo-500/30 p-3 rounded-xl flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-400">Tipo Cambio CLP:</label>
            <input
              type="number"
              value={rates.CLP || ''}
              onChange={(e) => handleUpdateRates({ ...rates, CLP: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-emerald-400 font-bold focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-400">Valor UF (CLP):</label>
            <input
              type="number"
              value={rates.UF || ''}
              onChange={(e) => handleUpdateRates({ ...rates, UF: parseFloat(e.target.value) || 0 })}
              className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-cyan-400 font-bold focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleUpdateRates(DEFAULT_CURRENCY_RATES)}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Restablecer Valores por Defecto
          </button>
        </div>
      )}

      <div id="summary-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Base Cisco Net Cost / COGS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Net Cost (COGS) Cisco</span>
            <div className="p-1.5 bg-slate-800 text-slate-400 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-xl font-black font-mono text-white">
            {formatCurrency(data.originalProductTotal)}
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          Costo base de compra Cisco (sin internación ni margen)
        </p>
      </div>

      {/* KPI 2: Total Revenue / Cotizado Intcomex */}
      <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-md space-y-2 relative overflow-hidden">
        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
          <span>Total Revenue / Facturación</span>
          <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <span className="text-xl font-black font-mono text-emerald-400">
            {formatCurrency(data.calculatedProductTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-indigo-500/20">
          <span>
            Spread: <strong className="text-indigo-300">+{formatCurrency(totalDelta)}</strong>
          </span>
          <span className="text-emerald-400 font-bold">
            Target Margen {params.margenPct}%
          </span>
        </div>
      </div>

      {/* KPI 3: Net Profit / Utilidad Comercial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2">
        <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold uppercase tracking-wider">
          <span>Net Profit (Ganancia Neta)</span>
          <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-black font-mono text-amber-400">
            {formatCurrency(netProfit)}
          </span>
          <span className="text-[11px] font-bold text-emerald-400 font-mono">
            ({profitMarginReal.toFixed(1)}% ROS)
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          Utilidad líquida estimada para Intcomex Chile
        </p>
      </div>

      {/* KPI 4: Reglas & Clasificación */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2">
        <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
          <span>Clasificación de SKUs</span>
          <div className="p-1.5 bg-slate-800 text-slate-400 rounded-lg">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs font-bold">
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
            {data.items.length - intangiblesCount - arancelCount} Hardware
          </span>
          {intangiblesCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-400 border border-amber-800/40">
              {intangiblesCount} Intang.
            </span>
          )}
          {arancelCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-400 border border-purple-800/40">
              {arancelCount} Arancel
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500">
          {totalItemsCount} unidades totales {ftCount > 0 ? `(${ftCount} con promo Fast Track)` : ''}
        </p>
      </div>

      {/* Mining Audit Executive Banner */}
      {miningAudit && miningAudit.overallStatus !== 'NO_RULES' && onOpenMiningAudit && (
        <div className="sm:col-span-2 lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Pickaxe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">
                  Auditoría Comercial Minera: {miningAudit.matchedAccount?.groupName || 'Cuenta Detectada'}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    miningAudit.overallStatus === 'COMPLIANT'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                      : miningAudit.overallStatus === 'REQUIRES_REVIEW'
                      ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                      : 'bg-amber-950 text-amber-300 border-amber-700/60'
                  }`}
                >
                  {miningAudit.overallStatus === 'COMPLIANT'
                    ? '100% Conforme'
                    : miningAudit.overallStatus === 'REQUIRES_REVIEW'
                    ? 'Diferencias Detectadas'
                    : 'Revisión Manual'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {miningAudit.lines.length} líneas auditadas &bull;{' '}
                {miningAudit.sntOpportunityCount > 0
                  ? `${miningAudit.sntOpportunityCount} contratos SNT detectados para migración`
                  : 'Condiciones de suscripción y producto validadas'}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenMiningAudit}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer"
          >
            Ver Informe Detallado &rarr;
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
