// ============================================================================
// CISCO AUTOMATED v2.1 - QUOTER EXECUTIVE FINANCIAL SUMMARY CARDS
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ProcessedEstimateResult, QuoteParameters } from '../core/types';
import {
  CurrencyCode,
  CurrencyConversionRates,
  convertUsdToCurrency,
  formatCurrencyAmount,
  roundFinancial,
} from '../core/calculations';
import {
  OfficialChileanRatesSnapshot,
  USD_TO_CLP_FRONTEND_SPREAD,
  applyFrontendUsdClpSpread,
  fetchDailyOfficialChileanRates,
  getCachedDailyOfficialRates,
  getDefaultOfficialRatesSnapshot,
  saveCachedDailyOfficialRates,
  snapshotToConversionRates,
  notifyFrontendCurrencyChange,
} from '../core/chileanExchangeRateService';
import {
  DollarSign,
  TrendingUp,
  Sparkles,
  Layers,
  Pickaxe,
  Coins,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { AuditReport } from '../modules/mining';
import { useUiExperience } from '../core/themeEngine';
import { useCiscoAutomatedStore } from '../core/store';
import { categorizeEstimateItems } from '../modules/estimate';
import { Cpu, ShieldCheck } from 'lucide-react';

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
  const { isAesthetic } = useUiExperience();
  const { isClientMode } = useCiscoAutomatedStore();
  const categories = React.useMemo(() => categorizeEstimateItems(data.items || []), [data.items]);
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem('cisco_selected_currency');
      if (saved === 'USD' || saved === 'CLP' || saved === 'UF') return saved;
    } catch {}
    return 'USD';
  });

  const [officialSnapshot, setOfficialSnapshot] = useState<OfficialChileanRatesSnapshot>(() => {
    return getCachedDailyOfficialRates(true) || getDefaultOfficialRatesSnapshot();
  });

  const [rates, setRates] = useState<CurrencyConversionRates>(() => {
    const initialSnap = getCachedDailyOfficialRates(true) || getDefaultOfficialRatesSnapshot();
    return snapshotToConversionRates(initialSnap);
  });

  const [isLoadingOfficialRates, setIsLoadingOfficialRates] = useState<boolean>(false);
  const [showRateSettings, setShowRateSettings] = useState<boolean>(false);

  // Extrae diariamente el tipo de cambio oficial chileno (BCCh / mindicador.cl) y suma +$10 CLP al dólar
  useEffect(() => {
    let isMounted = true;
    setIsLoadingOfficialRates(true);

    fetchDailyOfficialChileanRates(false)
      .then((snap) => {
        if (!isMounted) return;
        setOfficialSnapshot(snap);
        setRates(snapshotToConversionRates(snap));
        notifyFrontendCurrencyChange();
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingOfficialRates(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefreshOfficialRates = async () => {
    setIsLoadingOfficialRates(true);
    try {
      const freshSnap = await fetchDailyOfficialChileanRates(true);
      setOfficialSnapshot(freshSnap);
      setRates(snapshotToConversionRates(freshSnap));
      notifyFrontendCurrencyChange();
    } finally {
      setIsLoadingOfficialRates(false);
    }
  };

  const handleSelectCurrency = (c: CurrencyCode) => {
    setCurrency(c);
    try {
      localStorage.setItem('cisco_selected_currency', c);
    } catch {}
    notifyFrontendCurrencyChange();
  };

  const handleUpdateOfficialUsdBase = (newBaseUsd: number) => {
    const cleanBase = Math.max(0, newBaseUsd);
    const appliedClp = applyFrontendUsdClpSpread(cleanBase, USD_TO_CLP_FRONTEND_SPREAD);
    const updatedSnap: OfficialChileanRatesSnapshot = {
      ...officialSnapshot,
      dolarObservadoOficial: cleanBase,
      spreadClp: USD_TO_CLP_FRONTEND_SPREAD,
      dolarAplicadoClp: appliedClp,
      isManualOverride: true,
    };
    setOfficialSnapshot(updatedSnap);
    setRates({ ...rates, CLP: appliedClp });
    saveCachedDailyOfficialRates(updatedSnap);
    notifyFrontendCurrencyChange();
  };

  const handleUpdateAppliedClpDirect = (newAppliedClp: number) => {
    const cleanApplied = Math.max(0, newAppliedClp);
    const inferredBase = roundFinancial(Math.max(0, cleanApplied - USD_TO_CLP_FRONTEND_SPREAD));
    const updatedSnap: OfficialChileanRatesSnapshot = {
      ...officialSnapshot,
      dolarObservadoOficial: inferredBase,
      spreadClp: USD_TO_CLP_FRONTEND_SPREAD,
      dolarAplicadoClp: cleanApplied,
      isManualOverride: true,
    };
    setOfficialSnapshot(updatedSnap);
    setRates({ ...rates, CLP: cleanApplied });
    saveCachedDailyOfficialRates(updatedSnap);
    notifyFrontendCurrencyChange();
  };

  const handleUpdateUfRate = (newUf: number) => {
    const cleanUf = Math.max(0, newUf);
    const updatedSnap: OfficialChileanRatesSnapshot = {
      ...officialSnapshot,
      ufOficialClp: cleanUf,
      isManualOverride: true,
    };
    setOfficialSnapshot(updatedSnap);
    setRates({ ...rates, UF: cleanUf });
    saveCachedDailyOfficialRates(updatedSnap);
    notifyFrontendCurrencyChange();
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
      {/* Selector de Divisa y Tipo de Cambio Oficial Chileno Diario (BCCh + $10 CLP) */}
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

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
          <span
            className="flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/40 px-2 py-0.5 rounded-md"
            title={`Fuente: ${officialSnapshot.sourceName} (${officialSnapshot.indicatorDate})`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>BCCh Oficial ({officialSnapshot.indicatorDate})</span>
          </span>
          <span>
            USD Obs:{' '}
            <span className="text-slate-400">
              ${officialSnapshot.dolarObservadoOficial.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
            </span>{' '}
            <span className="text-amber-400 font-bold">+ ${USD_TO_CLP_FRONTEND_SPREAD}</span> ={' '}
            <strong className="text-emerald-400">
              ${rates.CLP.toLocaleString('es-CL', { maximumFractionDigits: 2 })} CLP
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            1 UF ={' '}
            <strong className="text-cyan-400">
              ${rates.UF.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CLP
            </strong>
          </span>
          <button
            type="button"
            onClick={handleRefreshOfficialRates}
            disabled={isLoadingOfficialRates}
            title="Extraer valor oficial del día desde Banco Central de Chile (mindicador.cl)"
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px] ml-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingOfficialRates ? 'animate-spin' : ''}`} />
            <span>{isLoadingOfficialRates ? 'Sincronizando...' : 'Actualizar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRateSettings((prev) => !prev)}
            className="text-indigo-400 hover:text-indigo-300 underline text-[10px] ml-1 cursor-pointer"
          >
            {showRateSettings ? 'Ocultar' : 'Ajustar TC'}
          </button>
        </div>
      </div>

      {showRateSettings && (
        <div className="bg-slate-900 border border-indigo-500/30 p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-300 animate-fade-in">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Dólar Obs. Oficial (CLP):</label>
              <input
                type="number"
                step="0.01"
                value={officialSnapshot.dolarObservadoOficial || ''}
                onChange={(e) => handleUpdateOfficialUsdBase(parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-slate-200 font-bold focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-amber-300 font-bold">
                TC Aplicado (+${USD_TO_CLP_FRONTEND_SPREAD} CLP):
              </label>
              <input
                type="number"
                step="0.01"
                value={rates.CLP || ''}
                onChange={(e) => handleUpdateAppliedClpDirect(parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-950 border border-emerald-600/50 rounded px-2 py-0.5 text-right text-emerald-400 font-bold focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Valor UF Oficial (CLP):</label>
              <input
                type="number"
                step="0.01"
                value={rates.UF || ''}
                onChange={(e) => handleUpdateUfRate(parseFloat(e.target.value) || 0)}
                className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-cyan-400 font-bold focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400">
              Fuente: {officialSnapshot.sourceName}
            </span>
            <button
              type="button"
              onClick={handleRefreshOfficialRates}
              disabled={isLoadingOfficialRates}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingOfficialRates ? 'animate-spin' : ''}`} />
              <span>Sincronizar Oficial BCCh (+${USD_TO_CLP_FRONTEND_SPREAD} CLP)</span>
            </button>
          </div>
        </div>
      )}

      <div id="summary-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isClientMode ? (
          <>
            {/* CLIENT MODE - KPI 1: Hardware & Infrastructure */}
            <div className={isAesthetic ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border relative overflow-hidden backdrop-blur-md' : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'}>
              <div className="flex items-center justify-between text-teal-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Infraestructura &amp; Hardware</span>
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-white tracking-tight">
                  {formatCurrency(categories.hardwareTotal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {categories.hardwareCount} ítems tangibles (Switches, APs, Fuentes)
              </p>
            </div>

            {/* CLIENT MODE - KPI 2: Software & Cloud */}
            <div className={isAesthetic ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border relative overflow-hidden backdrop-blur-md' : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'}>
              <div className="flex items-center justify-between text-indigo-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Software &amp; Licencias Cloud</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-indigo-300 tracking-tight">
                  {formatCurrency(categories.softwareTotal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {categories.softwareCount} suscripciones Cisco DNA / Meraki Cloud
              </p>
            </div>

            {/* CLIENT MODE - KPI 3: Services & SmartNet */}
            <div className={isAesthetic ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border relative overflow-hidden backdrop-blur-md' : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'}>
              <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                <span>Soporte SmartNet (SNT)</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-amber-300 tracking-tight">
                  {formatCurrency(categories.servicesTotal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {categories.servicesCount} contratos de soporte técnico Cisco
              </p>
            </div>

            {/* CLIENT MODE - KPI 4: Total Sugerido Solución */}
            <div className={isAesthetic ? 'aesthetic-card bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-xl space-y-2 relative overflow-hidden backdrop-blur-md' : 'bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-md space-y-2'}>
              <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
                <span>Total Solución Sugerido</span>
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black font-mono text-emerald-400 tracking-tight">
                  {formatCurrency(data.calculatedProductTotal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Valor total neto (no incluye IVA 19%)
              </p>
            </div>
          </>
        ) : (
          <>
        {/* KPI 1: Base Cisco Net Cost / COGS */}
        <div
          className={
            isAesthetic
              ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/40 hover:-translate-y-0.5 relative overflow-hidden backdrop-blur-md'
              : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'
          }
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Net Cost (COGS) Cisco</span>
            <div className={`p-1.5 rounded-lg ${isAesthetic ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-black font-mono text-white tracking-tight">
              {formatCurrency(data.originalProductTotal)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            Costo base de compra Cisco (sin internación ni margen)
          </p>
        </div>

        {/* KPI 2: Total Revenue / Cotizado Intcomex */}
        <div
          className={
            isAesthetic
              ? 'aesthetic-card bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-xl space-y-2 relative overflow-hidden transition-all duration-300 hover:shadow-indigo-500/20 hover:border-indigo-400/60 hover:-translate-y-0.5 backdrop-blur-md'
              : 'bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-md space-y-2 relative overflow-hidden'
          }
        >
          <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
            <span>Total Revenue / Facturación</span>
            <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-black font-mono text-emerald-400 tracking-tight">
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
        <div
          className={
            isAesthetic
              ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border transition-all duration-300 hover:shadow-amber-500/10 hover:border-amber-500/40 hover:-translate-y-0.5 relative overflow-hidden backdrop-blur-md'
              : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'
          }
        >
          <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Net Profit (Ganancia Neta)</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-black font-mono text-amber-400 tracking-tight">
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
        <div
          className={
            isAesthetic
              ? 'aesthetic-card rounded-2xl p-4 shadow-xl space-y-2 border transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/40 hover:-translate-y-0.5 relative overflow-hidden backdrop-blur-md'
              : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2'
          }
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Clasificación de SKUs</span>
            <div className={`p-1.5 rounded-lg ${isAesthetic ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 inline-flex items-center">
              {isAesthetic && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />}
              {data.items.length - intangiblesCount - arancelCount} Hardware
            </span>
            {intangiblesCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-400 border border-amber-800/40 inline-flex items-center">
                {isAesthetic && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-1.5 animate-pulse" />}
                {intangiblesCount} Intang.
              </span>
            )}
            {arancelCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-400 border border-purple-800/40 inline-flex items-center">
                {isAesthetic && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block mr-1.5 animate-pulse" />}
                {arancelCount} Arancel
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            {totalItemsCount} unidades totales {ftCount > 0 ? `(${ftCount} con promo Fast Track)` : ''}
          </p>
        </div>

          </>
        )}

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
