// ============================================================================
// CISCO AUTOMATED v2.1 - EXECUTIVE DASHBOARD
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardMetrics, EstimateRecord } from '../core/types';
import {
  ESTIMATES_UPDATED_EVENT,
  getCloudEstimates,
  subscribeToCloudEstimates,
} from '../modules/cloud';
import { CloudEstimateRecord } from '../modules/cloud/types';
import {
  TrendingUp,
  FileSpreadsheet,
  DollarSign,
  Percent,
  RefreshCw,
  Building2,
  Users2,
  Calendar,
  Calculator,
  Upload,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenQuoter: () => void;
  onOpenUpload: () => void;
}

export function DashboardView({ onOpenQuoter, onOpenUpload }: DashboardViewProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      if ((window as any).pywebview?.api?.get_dashboard_metrics) {
        const data = await (window as any).pywebview.api.get_dashboard_metrics();
        if (data) {
          setMetrics(data);
          return;
        }
      }
      const result = await getCloudEstimates(100);
      setMetrics(buildMetrics(result.data));
    } catch (e) {
      setMetrics(buildMetrics([]));
      console.error('Error fetching metrics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const isDesktop = Boolean((window as any).pywebview?.api?.get_dashboard_metrics);
    const unsubscribe = isDesktop
      ? () => undefined
      : subscribeToCloudEstimates((records) => {
      setMetrics(buildMetrics(records));
      setIsLoading(false);
        });
    const refreshAfterSave = () => fetchMetrics();
    window.addEventListener(ESTIMATES_UPDATED_EVENT, refreshAfterSave);
    const refreshTimer = window.setInterval(fetchMetrics, 5000);

    return () => {
      unsubscribe();
      window.removeEventListener(ESTIMATES_UPDATED_EVENT, refreshAfterSave);
      window.clearInterval(refreshTimer);
    };
  }, []);

  function buildMetrics(records: CloudEstimateRecord[]): DashboardMetrics {
    const partnerBreakdown: DashboardMetrics['partner_breakdown'] = {};
    const clientBreakdown: DashboardMetrics['client_breakdown'] = {};
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalRecargo = 0;

    const recentEstimates: EstimateRecord[] = records.map((record) => {
      const revenue = Number(record.financialSummary?.totalCotizadoIntcomex || 0);
      const netCisco = Number(record.financialSummary?.totalNetCisco || 0);
      const profit = Number(record.financialSummary?.gananciaIntcomexUsd || 0);
      const partner = record.partnerName || 'Sin partner';
      const client = record.clientFinalName || 'Sin cliente';

      totalRevenue += revenue;
      totalProfit += profit;
      totalRecargo += revenue - netCisco;
      partnerBreakdown[partner] = partnerBreakdown[partner] || { count: 0, revenue: 0, profit: 0 };
      partnerBreakdown[partner].count += 1;
      partnerBreakdown[partner].revenue += revenue;
      partnerBreakdown[partner].profit += profit;
      clientBreakdown[client] = clientBreakdown[client] || { count: 0, revenue: 0, profit: 0 };
      clientBreakdown[client].count += 1;
      clientBreakdown[client].revenue += revenue;
      clientBreakdown[client].profit += profit;

      return {
        id: record.id,
        estimate_id_cisco: record.estimateId || 'NA',
        deal_id: record.dealId,
        partner_name: partner,
        client_final_name: client,
        original_filename: record.originalFileName || 'Estimate',
        net_cisco_total: netCisco,
        total_cotizado_intcomex: revenue,
        recargo_reglas_usd: revenue - netCisco,
        ganancia_intcomex_usd: profit,
        items_count: record.itemsCount,
        created_at: record.createdAt,
        username: record.creator?.username,
        full_name: record.creator?.fullName,
      };
    });

    return {
      kpis: {
        total_estimates: records.length,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        total_recargo: totalRecargo,
        avg_margin_pct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      },
      partner_breakdown: partnerBreakdown,
      client_breakdown: clientBreakdown,
      recent_estimates: recentEstimates,
    };
  }

  const fmtCurrency = (v?: number) => {
    if (v === undefined || v === null || isNaN(v)) return '$0.00';
    return '$' + v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  type BreakdownData = { count: number; revenue: number; profit: number };

  const partnerEntries = (Object.entries(metrics?.partner_breakdown || {}) as [string, BreakdownData][]).sort(
    (a, b) => b[1].revenue - a[1].revenue
  );
  const maxPartnerRevenue = Math.max(...partnerEntries.map(([, v]) => v.revenue), 1);

  const clientEntries = (Object.entries(metrics?.client_breakdown || {}) as [string, BreakdownData][]).sort(
    (a, b) => b[1].revenue - a[1].revenue
  );
  const maxClientRevenue = Math.max(...clientEntries.map(([, v]) => v.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            <span>Dashboard Ejecutivo &bull; Cisco Automated v2.1</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Análisis consolidado de cotizaciones, revenue, recargos de internación/arancel y margen neto Intcomex.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold flex items-center gap-2 border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Estimate</span>
          </button>

          <button
            onClick={onOpenQuoter}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Abrir Cotizador CCW</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotes */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-400" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Estimates Procesados
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-white">
            {metrics?.kpis.total_estimates ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Cotizaciones registradas en SQLite</p>
        </div>

        {/* Gross Revenue */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Gross Revenue (Facturación)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
            {fmtCurrency(metrics?.kpis.total_revenue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Monto total cotizado a clientes en USD</p>
        </div>

        {/* Total Net Profit */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Net Profit (Utilidad Comercial)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
            {fmtCurrency(metrics?.kpis.total_profit)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Margen neto total acumulado para Intcomex</p>
        </div>

        {/* Return on Sales (ROS) / Avg Margin % */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Return on Sales (ROS %)
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-violet-300">
            {(metrics?.kpis.avg_margin_pct ?? 5.0).toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Margen operativo porcentual sobre venta</p>
        </div>
      </div>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partner Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Revenue por Partner</span>
            </h3>
            <span className="text-[11px] text-slate-500">{partnerEntries.length} Partners</span>
          </div>

          <div className="space-y-4">
            {partnerEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">Sin registros de Partners aún</div>
            ) : (
              partnerEntries.map(([partner, data]) => {
                const pct = Math.round((data.revenue / maxPartnerRevenue) * 100);
                return (
                  <div key={partner} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={partner}>
                        {partner}
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {fmtCurrency(data.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{data.count} cotizaciones</span>
                      <span>Ganancia: {fmtCurrency(data.profit)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Client Final Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-emerald-400" />
              <span>Revenue por Cliente Final</span>
            </h3>
            <span className="text-[11px] text-slate-500">{clientEntries.length} Clientes</span>
          </div>

          <div className="space-y-4">
            {clientEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">Sin registros de Clientes aún</div>
            ) : (
              clientEntries.map(([client, data]) => {
                const pct = Math.round((data.revenue / maxClientRevenue) * 100);
                return (
                  <div key={client} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[200px]" title={client}>
                        {client}
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {fmtCurrency(data.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{data.count} cotizaciones</span>
                      <span>Ganancia: {fmtCurrency(data.profit)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Estimates Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Estimates Recientes Procesados</span>
          </h3>
          <span className="text-[11px] text-slate-500">Últimos registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Partner</th>
                <th className="px-5 py-3">Cliente Final</th>
                <th className="px-5 py-3">Archivo</th>
                <th className="px-5 py-3 text-right">Net Cisco</th>
                <th className="px-5 py-3 text-right">Total Intcomex</th>
                <th className="px-5 py-3 text-right">Ganancia USD</th>
                <th className="px-5 py-3 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {(metrics?.recent_estimates || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No hay cotizaciones registradas aún. Sube tu primer Estimate.
                  </td>
                </tr>
              ) : (
                (metrics?.recent_estimates || []).map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white">{e.partner_name}</td>
                    <td className="px-5 py-3.5 text-slate-200">{e.client_final_name}</td>
                    <td
                      className="px-5 py-3.5 font-mono text-[11px] text-slate-400 max-w-[200px] truncate"
                      title={e.original_filename}
                    >
                      {e.original_filename}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-right text-slate-400">
                      {fmtCurrency(e.net_cisco_total)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-right font-bold text-emerald-400">
                      {fmtCurrency(e.total_cotizado_intcomex)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-right font-bold text-amber-400">
                      {fmtCurrency(e.ganancia_intcomex_usd)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-[11px]">
                      {e.created_at ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-slate-300 font-semibold">
                            {new Date(e.created_at).toLocaleDateString('es-CL')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(e.created_at).toLocaleTimeString('es-CL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        'Hoy'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
