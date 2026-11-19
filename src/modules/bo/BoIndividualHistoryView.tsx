// ============================================================================
// CISCO AUTOMATED - BO INDIVIDUAL HISTORY VIEW (AUDIT TRAIL & LOGISTICS ARCHIVE)
// Historial Maestro Individual de Órdenes BO con Filtrado Mensual Automático,
// Métricas en Tiempo Real, Respaldo Anti-Pérdida y Auto-Ajuste de Resolución
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
  Calendar,
  Building,
  User,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  X,
  MessageSquare,
} from 'lucide-react';
import {
  BoOrderTrackingRecord,
  BoStage,
  BO_STAGES_METADATA,
} from './boTrackingTypes';
import {
  extractYearMonth,
  getCurrentYearMonth,
  getCurrentMonthName,
  formatChileDateOnly,
  formatChileTimeOnly,
  SPANISH_MONTH_NAMES,
} from '../../utils/dateUtils';
import { TableDensityMode } from '../../hooks/useTableDensityAndZoom';
import { TableDensityZoomControls } from '../../components/TableDensityZoomControls';
import { downloadContentSafe } from '../../utils/downloadHelper';

interface Props {
  orders: BoOrderTrackingRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenNewOrderModal: () => void;
  onOpenNotesModal: (order: BoOrderTrackingRecord) => void;
  onOpenEditModal: (order: BoOrderTrackingRecord) => void;
  onDeleteOrder: (orderId: string) => void;
  tableDensity: TableDensityMode;
  tableZoom: number;
  headPaddingClass: string;
  cellPaddingClass: string;
  zoomStyle: React.CSSProperties;
  onDensityChange: (density: TableDensityMode) => void;
  onZoomChange: (zoom: number) => void;
}

export const BoIndividualHistoryView: React.FC<Props> = ({
  orders,
  isLoading,
  onRefresh,
  onOpenNewOrderModal,
  onOpenNotesModal,
  onOpenEditModal,
  onDeleteOrder,
  tableDensity,
  tableZoom,
  headPaddingClass,
  cellPaddingClass,
  zoomStyle,
  onDensityChange,
  onZoomChange,
}) => {
  // Filtros
  const currentYm = getCurrentYearMonth();
  const currentMonthLabel = `Mes Actual (${getCurrentMonthName()} ${currentYm.slice(0, 4)})`;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYm);
  const [selectedPartner, setSelectedPartner] = useState<string>('ALL');
  const [selectedBodega, setSelectedBodega] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  // Modal de Detalle Completo de Orden
  const [viewingDetailOrder, setViewingDetailOrder] = useState<BoOrderTrackingRecord | null>(null);

  // Formato de moneda
  const fmtCurrency = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00';
    return (
      '$' +
      val.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Meses disponibles extraídos de las órdenes registradas
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.createdAt) {
        const ym = extractYearMonth(o.createdAt);
        if (ym && ym.length === 7) set.add(ym);
      }
    });
    // Asegurar que el mes actual siempre esté presente
    set.add(currentYm);
    return Array.from(set).sort().reverse();
  }, [orders, currentYm]);

  // Partners únicos
  const availablePartners = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.partnerName && o.partnerName.trim()) {
        set.add(o.partnerName.trim());
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtrado reactivo de órdenes
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Filtro de búsqueda libre
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchDeal = (order.dealId || '').toLowerCase().includes(q);
        const matchEst = (order.estimateId || '').toLowerCase().includes(q);
        const matchPartner = (order.partnerName || '').toLowerCase().includes(q);
        const matchClient = (order.endCustomerName || '').toLowerCase().includes(q);
        const matchPo = (order.clientPoNumber || '').toLowerCase().includes(q);
        const matchSo = (order.ciscoSoNumber || '').toLowerCase().includes(q);
        const matchCourier = (order.courierTrackingNumber || '').toLowerCase().includes(q);
        const matchNotes = (order.notes || []).some(
          (n) => n.comment.toLowerCase().includes(q) || n.author.toLowerCase().includes(q)
        );

        if (
          !matchDeal &&
          !matchEst &&
          !matchPartner &&
          !matchClient &&
          !matchPo &&
          !matchSo &&
          !matchCourier &&
          !matchNotes
        ) {
          return false;
        }
      }

      // 2. Filtro mensual
      if (selectedMonth !== 'ALL') {
        const orderYm = extractYearMonth(order.createdAt);
        if (orderYm !== selectedMonth) {
          return false;
        }
      }

      // 3. Filtro Partner
      if (selectedPartner !== 'ALL' && order.partnerName !== selectedPartner) {
        return false;
      }

      // 4. Filtro Bodega
      if (selectedBodega !== 'ALL') {
        const effBodega = order.bodegaDestino || 'E1';
        if (effBodega !== selectedBodega) {
          return false;
        }
      }

      // 5. Filtro Etapa
      if (selectedStage !== 'ALL' && order.currentStage !== selectedStage) {
        return false;
      }

      return true;
    });
  }, [orders, searchTerm, selectedMonth, selectedPartner, selectedBodega, selectedStage]);

  // Métricas financieras y de volumen del subconjunto filtrado
  const kpis = useMemo(() => {
    let totalSale = 0;
    let totalProfit = 0;
    let hardwareE1 = 0;
    let digitalEd = 0;

    filteredOrders.forEach((o) => {
      totalSale += o.totalSaleUsd || 0;
      totalProfit += o.grossProfitUsd || 0;
      if (o.bodegaDestino === 'ED') {
        digitalEd++;
      } else {
        hardwareE1++;
      }
    });

    const avgMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

    return {
      totalOrders: filteredOrders.length,
      totalSale,
      totalProfit,
      avgMargin,
      hardwareE1,
      digitalEd,
    };
  }, [filteredOrders]);

  // Exportar historial individual a CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'ID Orden BO',
      'Deal ID',
      'Estimate ID',
      'Versión',
      'Partner / Reseller',
      'Cliente Final',
      'OC Cliente',
      'SO Cisco',
      'Bodega Destino',
      'Courier',
      'Guía Tracking',
      'Etapa Actual',
      'Total Venta USD',
      'Margen Bruto USD',
      'Margen %',
      'Costo Internación USD',
      'Costo Arancel USD',
      'Cant. Ítems',
      'Fecha Creación',
      'Última Modificación',
      'Total Notas / Bitácora',
    ];

    const rows = filteredOrders.map((o) => {
      const stageMeta = BO_STAGES_METADATA[o.currentStage];
      return [
        `"${o.id}"`,
        `"${o.dealId || ''}"`,
        `"${o.estimateId || ''}"`,
        `"${o.estimateVersionTag || ''}"`,
        `"${(o.partnerName || '').replace(/"/g, '""')}"`,
        `"${(o.endCustomerName || '').replace(/"/g, '""')}"`,
        `"${o.clientPoNumber || ''}"`,
        `"${o.ciscoSoNumber || ''}"`,
        `"${o.bodegaDestino || 'E1'}"`,
        `"${o.courier || ''}"`,
        `"${o.courierTrackingNumber || ''}"`,
        `"${stageMeta ? stageMeta.title : o.currentStage}"`,
        o.totalSaleUsd || 0,
        o.grossProfitUsd || 0,
        o.marginPct || 0,
        o.internacionUsd || 0,
        o.arancelUsd || 0,
        o.itemsCount || 0,
        `"${formatChileDateOnly(o.createdAt)} ${formatChileTimeOnly(o.createdAt)}"`,
        `"${formatChileDateOnly(o.updatedAt)} ${formatChileTimeOnly(o.updatedAt)}"`,
        o.notes ? o.notes.length : 0,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const filename = `Historial_Ordenes_BO_Cisco_${selectedMonth === 'ALL' ? 'Historico' : selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadContentSafe(csvContent, filename, 'text/csv;charset=utf-8;');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedMonth('ALL');
    setSelectedPartner('ALL');
    setSelectedBodega('ALL');
    setSelectedStage('ALL');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 lg:p-5 shadow-xl space-y-4">
        {/* Row 1: Search & Period Filter */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por Deal, Estimate, OC, SO, Partner, Cliente, Guía..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Month / Period Filter */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-8 pr-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                title="Filtro de período (por defecto se abre en el mes actual)"
              >
                <option value={currentYm}>{currentMonthLabel}</option>
                <option value="ALL">Todos los meses (Histórico)</option>
                {availableMonths
                  .filter((m) => m !== currentYm)
                  .map((m) => {
                    const [y, mm] = m.split('-');
                    const mName = SPANISH_MONTH_NAMES[parseInt(mm, 10) - 1] || mm;
                    return (
                      <option key={m} value={m}>
                        {mName} {y}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Density & Local Zoom Controls */}
            <TableDensityZoomControls
              density={tableDensity}
              onDensityChange={onDensityChange}
              zoom={tableZoom}
              onZoomChange={onZoomChange}
            />
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filter by Partner */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="bg-transparent text-slate-300 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  Todos los Partners
                </option>
                {availablePartners.map((p) => (
                  <option key={p} value={p} className="bg-slate-900 text-white">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Bodega */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedBodega}
                onChange={(e) => setSelectedBodega(e.target.value)}
                className="bg-transparent text-slate-300 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  Todas las Bodegas (E1 y ED)
                </option>
                <option value="E1" className="bg-slate-900 text-white">
                  Bodega Física ENEA (E1)
                </option>
                <option value="ED" className="bg-slate-900 text-white">
                  Bodega Digital / Licencias (ED)
                </option>
              </select>
            </div>

            {/* Filter by Stage */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="bg-transparent text-slate-300 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  Todas las Etapas Logísticas
                </option>
                {Object.values(BO_STAGES_METADATA).map((st) => (
                  <option key={st.id} value={st.id} className="bg-slate-900 text-white">
                    {st.shortLabel} ({st.stepNumber}/8)
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {(searchTerm ||
              selectedMonth !== 'ALL' ||
              selectedPartner !== 'ALL' ||
              selectedBodega !== 'ALL' ||
              selectedStage !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-xs font-medium cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Action Buttons: Export & New Order */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
              title="Exportar órdenes BO filtradas a archivo CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel / CSV</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Recargar órdenes desde la nube y almacenamiento local"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={onOpenNewOrderModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Orden BO</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-semibold block">Órdenes en Historial</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-xl font-black text-white">{kpis.totalOrders}</span>
            <span className="text-[10px] text-slate-500">de {orders.length} total</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold block">Total Facturado USD</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-xl font-black text-emerald-300">{fmtCurrency(kpis.totalSale)}</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold block">Margen Bruto USD (%)</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-xl font-black text-amber-300">{fmtCurrency(kpis.totalProfit)}</span>
            <span className="text-[10px] font-bold text-amber-400/90">({kpis.avgMargin.toFixed(1)}%)</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] text-indigo-400 font-semibold block">Despacho Físico vs Digital</span>
          <div className="flex items-center space-x-3 mt-1 text-xs font-bold">
            <span className="text-amber-300" title="Bodega E1 (Física ENEA)">
              E1: {kpis.hardwareE1}
            </span>
            <span className="text-cyan-300" title="Bodega ED (Digital / Licencias)">
              ED: {kpis.digitalEd}
            </span>
          </div>
        </div>
      </div>

      {/* Master History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div
          className="overflow-x-auto custom-scrollbar transition-all duration-200"
          style={zoomStyle}
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className={`${headPaddingClass} min-w-[130px]`}>Deal / Estimate</th>
                <th className={`${headPaddingClass} min-w-[100px]`}>Origen</th>
                <th className={`${headPaddingClass} min-w-[130px]`}>Partner / Reseller</th>
                <th className={`${headPaddingClass} min-w-[120px]`}>Cliente Final</th>
                <th className={`${headPaddingClass} min-w-[125px]`}>OC Cliente / SO Cisco</th>
                <th className={`${headPaddingClass} text-right min-w-[110px]`}>Venta Total US$</th>
                <th className={`${headPaddingClass} text-right min-w-[100px]`}>Margen $ (%)</th>
                <th className={`${headPaddingClass} text-center min-w-[70px]`}>Bodega</th>
                <th className={`${headPaddingClass} min-w-[120px]`}>Courier / Tracking</th>
                <th className={`${headPaddingClass} min-w-[130px]`}>Etapa Actual</th>
                <th className={`${headPaddingClass} text-right min-w-[90px]`}>Fecha</th>
                <th className={`${headPaddingClass} text-center min-w-[85px]`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-500">
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Cargando historial individual de órdenes BO...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-slate-400 font-semibold">
                          No se encontraron órdenes BO para los filtros seleccionados.
                        </p>
                        <button
                          onClick={handleClearFilters}
                          className="text-xs text-emerald-400 hover:underline cursor-pointer"
                        >
                          Ver todas las órdenes históricas
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const stageMeta = BO_STAGES_METADATA[order.currentStage] || BO_STAGES_METADATA.OC_RECEIVED;
                  const isDsv = order.estimateVersionTag === 'DSV' || order.id.startsWith('BO-DSV-');
                  const hasCcwLink = order.estimateId && order.estimateId.trim().length >= 4 && !order.estimateId.includes(' ');

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Deal & Estimate */}
                      <td className={cellPaddingClass}>
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-mono font-bold text-amber-300 text-xs">
                            {order.dealId || 'DEAL-N/A'}
                          </span>
                          {hasCcwLink ? (
                            <a
                              href={`https://apps.cisco.com/ccw/cpc/estimate/items/${encodeURIComponent(
                                order.estimateId!.trim()
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 font-mono text-[10px] text-indigo-300 hover:text-cyan-300 transition-colors"
                              title={`Abrir Estimate ${order.estimateId} en CCW`}
                            >
                              <span className="group-hover:underline">{order.estimateId}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-indigo-400/80 group-hover:text-cyan-300 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-400">
                              {order.estimateId || '—'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Origen / Tag */}
                      <td className={cellPaddingClass}>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                            isDsv
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                              : order.estimateVersionTag === 'v2'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50'
                              : 'bg-blue-950/80 text-blue-300 border border-blue-600/50'
                          }`}
                        >
                          {isDsv ? 'DSV' : order.estimateVersionTag || 'v1'}
                        </span>
                        {order.itemsCount ? (
                          <span className="text-[9.5px] text-slate-500 font-mono ml-1">
                            ({order.itemsCount} ítems)
                          </span>
                        ) : null}
                      </td>

                      {/* Partner */}
                      <td className={`${cellPaddingClass} font-semibold text-white`}>
                        <span className="block truncate max-w-[125px] 2xl:max-w-[160px]" title={order.partnerName}>
                          {order.partnerName}
                        </span>
                      </td>

                      {/* Cliente Final */}
                      <td className={`${cellPaddingClass} text-slate-300`}>
                        <span className="block truncate max-w-[120px] 2xl:max-w-[150px]" title={order.endCustomerName}>
                          {order.endCustomerName}
                        </span>
                      </td>

                      {/* OC / SO */}
                      <td className={cellPaddingClass}>
                        <div className="flex flex-col space-y-0.5 text-[10px] font-mono">
                          <span className="text-slate-300 font-bold" title="Orden de Compra de Cliente">
                            {order.clientPoNumber || 'OC-PENDIENTE'}
                          </span>
                          <span className="text-emerald-400" title="Cisco Sales Order (SO)">
                            {order.ciscoSoNumber || 'SO: Pendiente'}
                          </span>
                        </div>
                      </td>

                      {/* Venta Total */}
                      <td className={`${cellPaddingClass} text-right font-mono font-bold text-emerald-400 whitespace-nowrap`}>
                        {fmtCurrency(order.totalSaleUsd)}
                      </td>

                      {/* Margen $ (%) */}
                      <td className={`${cellPaddingClass} text-right font-mono text-[10.5px] whitespace-nowrap`}>
                        <span className="text-amber-300 font-bold block">{fmtCurrency(order.grossProfitUsd)}</span>
                        <span className="text-[9.5px] text-slate-400 font-normal">
                          {order.marginPct !== undefined ? `${order.marginPct.toFixed(1)}%` : '—'}
                        </span>
                      </td>

                      {/* Bodega */}
                      <td className={`${cellPaddingClass} text-center`}>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono ${
                            order.bodegaDestino === 'ED'
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                          }`}
                          title={
                            order.bodegaDestino === 'ED'
                              ? 'Bodega Digital / Entrega Electrónica (ED)'
                              : 'Bodega Física ENEA Pudahuel (E1)'
                          }
                        >
                          {order.bodegaDestino || 'E1'}
                        </span>
                      </td>

                      {/* Courier / Tracking */}
                      <td className={cellPaddingClass}>
                        {order.courierTrackingNumber ? (
                          <div className="flex flex-col text-[10px]">
                            <span className="text-slate-400 font-semibold">{order.courier || 'Courier'}</span>
                            {order.courierTrackingUrl ? (
                              <a
                                href={order.courierTrackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-cyan-400 hover:underline font-mono"
                                title="Rastrear en web del Courier"
                              >
                                <span>{order.courierTrackingNumber}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="font-mono text-slate-300">{order.courierTrackingNumber}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Etapa Actual */}
                      <td className={cellPaddingClass}>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${stageMeta.badgeBg} ${stageMeta.badgeText}`}
                          title={stageMeta.description}
                        >
                          {stageMeta.shortLabel}
                        </span>
                      </td>

                      {/* Fecha Creación */}
                      <td className={`${cellPaddingClass} text-right text-[10px] whitespace-nowrap`}>
                        <div className="flex flex-col items-end leading-tight font-mono">
                          <span className="text-slate-300 font-semibold">
                            {formatChileDateOnly(order.createdAt)}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {formatChileTimeOnly(order.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className={`${cellPaddingClass} text-center`}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setViewingDetailOrder(order)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Ver Ficha y Bitácora Completa"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenNotesModal(order)}
                            className="p-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 transition-colors cursor-pointer"
                            title="Agregar Nota / Bitácora Diaria"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenEditModal(order)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Editar Orden y Etapa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteOrder(order.id)}
                            className="p-1 rounded-lg bg-rose-950/30 hover:bg-rose-950/70 text-rose-400 border border-rose-800/30 transition-colors cursor-pointer"
                            title="Eliminar Orden del Historial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Completa de la Orden BO */}
      {viewingDetailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Ficha Histórica de Orden BO
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {viewingDetailOrder.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingDetailOrder(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-200 custom-scrollbar">
              {/* Resumen General */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Deal ID</span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {viewingDetailOrder.dealId || 'DEAL-N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Estimate ID</span>
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    {viewingDetailOrder.estimateId || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Bodega Destino</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {viewingDetailOrder.bodegaDestino === 'ED'
                      ? 'ED (Digital / Licencias)'
                      : 'E1 (Física ENEA)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Partner / Reseller</span>
                  <span className="text-xs font-semibold text-white">
                    {viewingDetailOrder.partnerName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Cliente Final</span>
                  <span className="text-xs font-semibold text-white">
                    {viewingDetailOrder.endCustomerName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Etapa Actual</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {BO_STAGES_METADATA[viewingDetailOrder.currentStage]?.title || viewingDetailOrder.currentStage}
                  </span>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <div className="p-2 rounded-xl bg-slate-900/60">
                  <span className="text-[10px] text-slate-400 block">Venta Total</span>
                  <strong className="text-sm font-bold text-emerald-400">
                    {fmtCurrency(viewingDetailOrder.totalSaleUsd)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60">
                  <span className="text-[10px] text-slate-400 block">Margen Bruto</span>
                  <strong className="text-sm font-bold text-amber-400">
                    {fmtCurrency(viewingDetailOrder.grossProfitUsd)}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60">
                  <span className="text-[10px] text-slate-400 block">Margen %</span>
                  <strong className="text-sm font-bold text-white">
                    {viewingDetailOrder.marginPct ? `${viewingDetailOrder.marginPct.toFixed(1)}%` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60">
                  <span className="text-[10px] text-slate-400 block">Ítems / Equipos</span>
                  <strong className="text-sm font-bold text-white">
                    {viewingDetailOrder.itemsCount || 0}
                  </strong>
                </div>
              </div>

              {/* Fechas & Tracking */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Orden de Compra (OC)</span>
                  <span className="text-xs font-mono text-slate-200">
                    {viewingDetailOrder.clientPoNumber || 'Pendiente'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Cisco Sales Order (SO)</span>
                  <span className="text-xs font-mono text-slate-200">
                    {viewingDetailOrder.ciscoSoNumber || 'Pendiente'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Courier / Guía</span>
                  {viewingDetailOrder.courierTrackingUrl ? (
                    <a
                      href={viewingDetailOrder.courierTrackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{viewingDetailOrder.courier}: {viewingDetailOrder.courierTrackingNumber}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-slate-400">
                      {viewingDetailOrder.courierTrackingNumber
                        ? `${viewingDetailOrder.courier}: ${viewingDetailOrder.courierTrackingNumber}`
                        : 'Sin guía registrada'}
                    </span>
                  )}
                </div>
              </div>

              {/* Bitácora de Notas y Eventos */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bitácora de Notas y Transiciones ({viewingDetailOrder.notes?.length || 0})</span>
                </h4>
                {viewingDetailOrder.notes && viewingDetailOrder.notes.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {viewingDetailOrder.notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-indigo-300">
                            {note.author} ({note.stage})
                          </span>
                          <span className="font-mono">
                            {formatChileDateOnly(note.date)} {formatChileTimeOnly(note.date)}
                          </span>
                        </div>
                        <p className="text-slate-300">{note.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                    No se han registrado notas adicionales en la bitácora.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <button
                onClick={() => {
                  setViewingDetailOrder(null);
                  onOpenNotesModal(viewingDetailOrder);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Agregar Nota a la Bitácora</span>
              </button>

              <button
                onClick={() => setViewingDetailOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
