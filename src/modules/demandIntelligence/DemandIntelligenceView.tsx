// ============================================================================
// CISCO AUTOMATED v2.13.0 - DEMAND INTELLIGENCE & STOCK PLANNER VIEW
// Cross-modular demand aggregation & predictive inventory procurement
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Boxes,
  TrendingUp,
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  Check,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import {
  SkuDemandItem,
  DemandIntelligenceSummary,
  StockPriority,
} from './demandTypes';
import {
  generateDemandIntelligenceReport,
  exportStockProposalToExcel,
} from './demandIntelligenceService';
import { getFormattedAppVersion } from '../../core/appVersion';
import { useTableDensityAndZoom } from '../../hooks/useTableDensityAndZoom';
import { TableDensityZoomControls } from '../../components/TableDensityZoomControls';

export const DemandIntelligenceView: React.FC = () => {
  const [summary, setSummary] = useState<DemandIntelligenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'hardware' | 'licenses' | 'comparison' | 'stockPlan'>('stockPlan');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');

  // Table Density & Visual Zoom States (Auto-Fit across resolutions without changing browser zoom)
  const {
    tableDensity,
    tableZoom,
    headPaddingClass,
    cellPaddingClass,
    zoomStyle,
    handleSetTableDensity,
    handleSetTableZoom,
  } = useTableDensityAndZoom({
    storageKeyPrefix: 'cisco_demand',
  });

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await generateDemandIntelligenceReport();
      setSummary(data);
    } catch (err) {
      console.error('[DemandIntelligence] Error generating report:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyDirectLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const directUrl = `${origin}${pathname}?view=stock_intelligence`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleExportExcel = async () => {
    if (!summary || summary.stockPlanItems.length === 0) return;
    setIsExportingExcel(true);
    try {
      const buffer = await exportStockProposalToExcel(summary.stockPlanItems);
      const blob = new Blob([buffer as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Propuesta_Stock_Cisco_BodegaE1_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[DemandIntelligence] Error exporting Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Distinct families for filtering
  const availableFamilies = useMemo(() => {
    if (!summary) return [];
    const set = new Set<string>();
    const pool = activeTab === 'licenses' ? summary.topLicenseItems : summary.topHardwareItems;
    pool.forEach((i) => {
      if (i.family) set.add(i.family);
    });
    return Array.from(set).sort();
  }, [summary, activeTab]);

  // Filtered Items based on active tab, search, and family
  const filteredItems = useMemo(() => {
    if (!summary) return [];
    let list: SkuDemandItem[] = [];

    if (activeTab === 'hardware') list = summary.topHardwareItems;
    else if (activeTab === 'licenses') list = summary.topLicenseItems;
    else if (activeTab === 'stockPlan') list = summary.stockPlanItems;
    else list = [...summary.topHardwareItems, ...summary.topLicenseItems];

    return list.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.family.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFamily = selectedFamily === 'all' || item.family === selectedFamily;

      return matchesSearch && matchesFamily;
    });
  }, [summary, activeTab, searchQuery, selectedFamily]);

  const fmtCurrency = (n: number) =>
    `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;

  const getPriorityBadge = (priority: StockPriority, isMegadeal?: boolean) => {
    switch (priority) {
      case 'CRITICAL_STOCK':
        return {
          label: 'Alta Prioridad (Stock Crítico)',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
        };
      case 'GROWTH_OPPORTUNITY':
        return {
          label: 'Oportunidad de Stock',
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/40',
        };
      case 'MADE_TO_ORDER':
        return {
          label: isMegadeal ? 'Proyecto Especial (Bajo Pedido)' : 'Bajo Pedido (Back-to-Back)',
          bg: isMegadeal
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : 'bg-slate-800 text-slate-400 border-slate-700',
        };
      default:
        return {
          label: 'No Aplica Bodega',
          bg: 'bg-slate-800 text-slate-500 border-slate-800',
        };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex items-center space-x-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Boxes className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-black text-white tracking-tight">
                Inteligencia de Demanda & Planificador de Stock
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {getFormattedAppVersion()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cruce multimodular de Ventas Reales (BO, Forecast) vs Demanda Cotizada (Pipeline, Estimates, CCW-R) &bull; Solo Equipos Principales (sin accesorios ni componentes internos)
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            type="button"
            disabled={isLoading}
            onClick={loadData}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center space-x-2 cursor-pointer"
            title="Recalcular análisis consolidando los 5 módulos en tiempo real"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Analizando...' : 'Recalcular'}</span>
          </button>

          <button
            type="button"
            disabled={isExportingExcel || !summary}
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black transition-all shadow-lg shadow-emerald-600/25 flex items-center space-x-2 cursor-pointer"
            title="Descargar propuesta de reposición de stock en formato Excel oficial para procurement"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingExcel ? 'Generando...' : 'Exportar Propuesta Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyDirectLink}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center space-x-2 cursor-pointer"
            title="Copiar enlace directo: ?view=stock_intelligence"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4" />}
            <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Link'}</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* KPI 1: Ventas Reales Hardware */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ventas Reales Hardware</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white">
            {fmtCurrency(summary?.totalHardwareSoldUsd || 0)}
          </div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmado con SO Cisco & BO</span>
          </div>
        </div>

        {/* KPI 2: Demanda Cotizada Hardware */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Demanda Cotizada (Pipeline)</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white">
            {fmtCurrency(summary?.totalHardwareQuotedUsd || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            En negociación y cotizaciones CCW
          </div>
        </div>

        {/* KPI 3: Tasa de Conversión (Hit Rate) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Hit Rate (Conversión)</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400">
            {summary?.overallConversionPct || 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Ratio de cotizado que se convirtió en SO
          </div>
        </div>

        {/* KPI 4: Stock Sugerido Bodega E1 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock Sugerido Bodega E1</span>
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">
            {summary?.totalSuggestedUnitsToStock || 0} Unidades
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Inversión: {fmtCurrency(summary?.totalSuggestedInvestmentUsd || 0)}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('stockPlan');
                setSelectedFamily('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'stockPlan'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Sugerencias de Stock (Bodega E1)</span>
              {summary && summary.stockPlanItems.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                  {summary.stockPlanItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('hardware');
                setSelectedFamily('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'hardware'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>Top Hardware (Equipos Principales)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('licenses');
                setSelectedFamily('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'licenses'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Top Licencias & Suscripciones</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'comparison'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Comparativa Real vs Cotizado</span>
            </button>
          </div>

          {/* Search Bar & Auto-Fit Density Zoom Controls */}
          {activeTab !== 'comparison' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar Part Number, modelo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <TableDensityZoomControls
                density={tableDensity}
                onDensityChange={handleSetTableDensity}
                zoom={tableZoom}
                onZoomChange={handleSetTableZoom}
                colorTheme="indigo"
              />
            </div>
          )}
        </div>

        {/* Family Filter Pills */}
        {activeTab !== 'comparison' && availableFamilies.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSelectedFamily('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                selectedFamily === 'all'
                  ? 'bg-white text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todas las Familias ({filteredItems.length})
            </button>
            {availableFamilies.map((fam) => (
              <button
                key={fam}
                type="button"
                onClick={() => setSelectedFamily(fam)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  selectedFamily === fam
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>
        )}

        {/* Tab 1, 2, 4 Table View */}
        {activeTab !== 'comparison' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 custom-scrollbar transition-all duration-200" style={zoomStyle}>
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className={headPaddingClass}>{activeTab === 'licenses' ? 'Part Number / SKU' : 'Part Number (Equipo Principal)'}</th>
                  <th className={headPaddingClass}>Descripción</th>
                  <th className={headPaddingClass}>Familia</th>
                  <th className={`${headPaddingClass} text-center`}>Ventas Reales</th>
                  <th className={`${headPaddingClass} text-center`}>Demanda Cotizada</th>
                  <th className={`${headPaddingClass} text-center`}>Hit Rate %</th>
                  {activeTab === 'stockPlan' ? (
                    <>
                      <th className={`${headPaddingClass} text-center`}>Prioridad</th>
                      <th className={`${headPaddingClass} text-center`}>Stock Sugerido</th>
                      <th className={`${headPaddingClass} text-right`}>Inversión Estimada</th>
                    </>
                  ) : (
                    <>
                      <th className={`${headPaddingClass} text-right`}>Total USD Demanda</th>
                      <th className={`${headPaddingClass} text-center`}>Deals/Órdenes</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No se encontraron productos coincidentes con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const badge = getPriorityBadge(item.stockRecommendation.priority, item.isMegadealOutlier);
                    return (
                      <tr
                        key={`${item.partNumber}-${idx}`}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className={`${cellPaddingClass} font-mono font-bold text-white`}>
                          <div className="flex items-center space-x-1.5">
                            <span>{item.partNumber}</span>
                            {item.isMegadealOutlier && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap"
                                title="Cotización masiva o licitación amortiguada para proteger inventario E1"
                              >
                                ⚡ Mega-deal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`${cellPaddingClass} max-w-xs truncate text-slate-300`} title={item.description}>
                          {item.description}
                        </td>
                        <td className={`${cellPaddingClass} text-slate-400 whitespace-nowrap`}>
                          {item.family}
                        </td>
                        <td className={`${cellPaddingClass} text-center`}>
                          <span className="font-bold text-emerald-400">
                            {item.realSoldUnits} und
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {fmtCurrency(item.realSoldUsd)}
                          </span>
                        </td>
                        <td className={`${cellPaddingClass} text-center`}>
                          <span className="font-bold text-slate-300">
                            {item.quotedUnits} und
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {fmtCurrency(item.quotedUsd)}
                          </span>
                          {item.effectiveQuotedUnits !== undefined &&
                            item.effectiveQuotedUnits !== item.quotedUnits && (
                              <span
                                className="block text-[9px] text-indigo-400 font-mono"
                                title="Demanda ponderada tras amortiguar megadisparos"
                              >
                                Pond: {item.effectiveQuotedUnits} und
                              </span>
                            )}
                        </td>
                        <td className={`${cellPaddingClass} text-center`}>
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                              item.conversionRatePct >= 50
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : item.conversionRatePct >= 20
                                ? 'bg-indigo-500/10 text-indigo-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.conversionRatePct}%
                          </span>
                        </td>

                        {activeTab === 'stockPlan' ? (
                          <>
                            <td className={`${cellPaddingClass} text-center whitespace-nowrap`}>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className={`${cellPaddingClass} text-center font-black text-amber-400 text-sm`}>
                              {item.stockRecommendation.suggestedUnits > 0
                                ? `${item.stockRecommendation.suggestedUnits} und (E1)`
                                : '—'}
                            </td>
                            <td className={`${cellPaddingClass} text-right font-mono font-bold text-white`}>
                              {item.stockRecommendation.estimatedTotalInvestmentUsd > 0
                                ? fmtCurrency(item.stockRecommendation.estimatedTotalInvestmentUsd)
                                : '—'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={`${cellPaddingClass} text-right font-mono font-bold text-white`}>
                              {fmtCurrency(item.totalDemandUsd)}
                            </td>
                            <td className={`${cellPaddingClass} text-center text-slate-400`}>
                              {item.ordersCount}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Comparativa Real vs Cotizado (Breakdown Visual) */}
        {activeTab === 'comparison' && summary && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {summary.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-white">{cat.categoryLabel}</h4>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      Hit Rate: {cat.conversionRatePct}%
                    </span>
                  </div>

                  {/* Progress Bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-400 font-bold">Venta Real Confirmada:</span>
                        <span className="font-mono text-white">
                          {cat.realSoldUnits} und &bull; {fmtCurrency(cat.realSoldUsd)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (cat.realSoldUnits / Math.max(1, cat.totalDemandUnits)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-indigo-400 font-bold">Demanda Cotizada (Sin Cerrar):</span>
                        <span className="font-mono text-slate-300">
                          {cat.quotedUnits} und &bull; {fmtCurrency(cat.quotedUsd)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (cat.quotedUnits / Math.max(1, cat.totalDemandUnits)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 flex justify-between">
                    <span>Total Demanda: {cat.totalDemandUnits} unidades</span>
                    <span>Volumen: {fmtCurrency(cat.totalDemandUsd)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Procurement Advice Box */}
            <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200 space-y-2">
              <div className="flex items-center space-x-2 text-amber-300 font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Recomendación Estratégica para Bodega E1 (Santiago):</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                El Lead Time promedio desde Miami/Fábrica es de 20 a 175 días. Stockear localmente en Santiago los modelos con **Hit Rate superior al 30%** y **más de 10 unidades cotizadas** te permite capturar los negocios urgentes en 24-48 horas que los competidores pierden por tiempos de espera.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
