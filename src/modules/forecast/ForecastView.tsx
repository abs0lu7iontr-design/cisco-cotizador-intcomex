// ============================================================================
// CISCO AUTOMATED v2.9 - FORECAST COMERCIAL INTCOMEX (36 COLUMNAS)
// Réplica visual fiel del Excel Oficial, Cruce con CCW, BO y DSV,
// Motor Anti-Duplicación, Recordatorios Comerciales y Sincronización Google Sheets
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Bell,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Building,
  DollarSign,
  Truck,
  ExternalLink,
} from 'lucide-react';
import {
  ForecastRecord,
  ForecastFilterOptions,
  ForecastReminderItem,
  FORECAST_36_COLUMNS,
  FORECAST_PM_LIST,
  FORECAST_BODEGA_OPTIONS,
  FORECAST_CREDIT_STATUSES,
} from './forecastTypes';
import {
  getForecastRecords,
  saveForecastRecord,
  bulkSaveForecastRecords,
  deleteForecastRecord,
  resetForecastToSeeds,
} from './forecastStorage';
import {
  computeForecastStats,
  filterForecastRecords,
  generateForecastReminders,
  crossSyncEstimateToForecast,
  crossSyncBoToForecast,
  crossSyncDsvToForecast,
  convertPipelineDealsToForecast,
  exportForecastToCsv,
  parseCsvToForecastRecords,
  importFromGoogleSheetsCsv,
} from './forecastService';
import { ForecastModal } from './ForecastModal';
import { useCiscoAutomatedStore } from '../../core/store';
import { getPipelineDeals } from '../pipeline/pipelineStorage';
import { getBoTrackings } from '../bo/boTrackingService';

export function ForecastView() {
  const { processedResult } = useCiscoAutomatedStore();

  const [records, setRecords] = useState<ForecastRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ForecastFilterOptions>({
    searchQuery: '',
    pmResponsable: 'ALL',
    bodega: 'ALL',
    grupoVentas: 'ALL',
    credit: 'ALL',
    am: 'ALL',
    onlyWithReminders: false,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ForecastRecord | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Reminders Drawer State
  const [isRemindersDrawerOpen, setIsRemindersDrawerOpen] = useState(false);

  // Cross Sync Drawer / Modal State
  const [isCrossSyncModalOpen, setIsCrossSyncModalOpen] = useState(false);
  const [crossSyncStatus, setCrossSyncStatus] = useState<string | null>(null);

  // Google Sheet / CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importFeedback, setImportFeedback] = useState<{ count: number; duplicates: number } | null>(null);

  // Load records
  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const data = await getForecastRecords();
      setRecords(data);
    } catch (err) {
      console.error('[ForecastView] Error cargando registros:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  // Compute Stats & Reminders
  const stats = useMemo(() => computeForecastStats(records), [records]);
  const reminders = useMemo(() => generateForecastReminders(records), [records]);

  // Filtered records
  const filteredRecords = useMemo(
    () => filterForecastRecords(records, filters),
    [records, filters]
  );

  // Handlers
  const handleOpenCreate = () => {
    setSelectedRecord(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: ForecastRecord) => {
    setSelectedRecord(rec);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (saved: ForecastRecord) => {
    await saveForecastRecord(saved);
    await loadRecords();
  };

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de eliminar el registro ${id} del Forecast?`)) {
      await deleteForecastRecord(id);
      await loadRecords();
    }
  };

  const handleResetSeeds = async () => {
    if (
      window.confirm(
        '¿Restaurar los registros del Forecast al conjunto inicial oficial de Intcomex (158 registros)? Esto mantendrá la base oficial limpia.'
      )
    ) {
      setIsLoading(true);
      const seeds = await resetForecastToSeeds();
      setRecords(seeds);
      setIsLoading(false);
    }
  };

  // Cross sync with Estimate, BO and Pipeline
  const handleCrossSyncAll = async () => {
    setIsLoading(true);
    setCrossSyncStatus('Iniciando conciliación cruzada multi-módulo...');
    let currentList = [...records];
    let totalUpdated = 0;
    let totalAdded = 0;

    try {
      // 1. Cross sync with currently active Estimate in memory
      if (processedResult) {
        setCrossSyncStatus('Cruzando con CCW Estimate actual...');
        const estRes = crossSyncEstimateToForecast(processedResult, currentList);
        currentList = estRes.updatedList;
        if (estRes.isNew) totalAdded++;
        else totalUpdated++;
      }

      // 2. Cross sync with BO Tracking records
      setCrossSyncStatus('Cruzando con órdenes de Back Order Tracking (BO)...');
      const boRecords = await getBoTrackings();
      if (boRecords && boRecords.length > 0) {
        const boRes = crossSyncBoToForecast(boRecords, currentList);
        currentList = boRes.updatedList;
        totalUpdated += boRes.updatedCount;
      }

      // 3. Cross sync with Pipeline Commercial Deals
      setCrossSyncStatus('Sincronizando con Pipeline Comercial...');
      const pDeals = await getPipelineDeals();
      if (pDeals && pDeals.length > 0) {
        const pRes = convertPipelineDealsToForecast(pDeals, currentList);
        currentList = pRes.updatedList;
        totalAdded += pRes.addedCount;
        totalUpdated += pRes.mergedCount;
      }

      // Save merged records
      await bulkSaveForecastRecords(currentList);
      setRecords(currentList);
      setCrossSyncStatus(
        `¡Conciliación exitosa! ${totalUpdated} negocios actualizados y ${totalAdded} nuevos registrados sin duplicaciones.`
      );
    } catch (err: any) {
      setCrossSyncStatus(`Error durante la sincronización: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Export to CSV matching 36 columns
  const handleExportCsv = () => {
    const csv = exportForecastToCsv(filteredRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Forecast_Comercial_Cisco_Intcomex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Google Sheet or CSV import
  const handleImportSheet = async () => {
    if (!importInput.trim()) return;
    try {
      setIsLoading(true);
      const res = await importFromGoogleSheetsCsv(importInput, records);
      if (res.imported.length > 0) {
        const merged = await bulkSaveForecastRecords(res.imported);
        setRecords(merged);
      }
      setImportFeedback({ count: res.count, duplicates: res.duplicatesSkipped });
      if (res.count > 0) {
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportInput('');
          setImportFeedback(null);
        }, 1500);
      }
    } catch (err: any) {
      alert(`Error importando: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Forecast Comercial Cisco & Intcomex
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  36 Columnas Oficiales
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {records.length} Deals
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconciliación integral con CCW Estimates, Back Order Tracking y DSV con motor anti-duplicación y recordatorios
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Reminders Button */}
            <button
              onClick={() => setIsRemindersDrawerOpen(true)}
              className="relative px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all shadow-sm"
              title="Ver Recordatorios y Alertas Comerciales"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Recordatorios</span>
              {reminders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                  {reminders.length}
                </span>
              )}
            </button>

            {/* Cross-Sync Multi-Module */}
            <button
              onClick={handleCrossSyncAll}
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-medium text-indigo-300 flex items-center gap-2 transition-all shadow-sm"
              title="Cruzar y poblar datos automáticamente con CCW Estimates, BO y DSV sin duplicar"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Cruzar con Módulos</span>
            </button>

            {/* Google Sheets / CSV Import */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all shadow-sm"
              title="Importar desde Google Sheets o CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Google Sheet / CSV</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all shadow-sm"
              title="Exportar las 36 columnas a Excel/CSV"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>Exportar Excel</span>
            </button>

            {/* New Record */}
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>

        {/* Cross Sync Status Notification */}
        {crossSyncStatus && (
          <div className="mt-3 p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{crossSyncStatus}</span>
            </div>
            <button
              onClick={() => setCrossSyncStatus(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Total USD Intcomex</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5 truncate">
              ${stats.totalUsdIntcomex.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-500">{stats.totalRecords} oportunidades</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Hardware / SaaS</span>
            <div className="text-lg font-bold text-sky-400 mt-0.5 truncate">
              ${stats.totalProductos.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-500">Subtotal Productos</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Servicios & SmartNet</span>
            <div className="text-lg font-bold text-indigo-400 mt-0.5 truncate">
              ${stats.totalServicios.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-500">CX / Servicios</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Meraki Cloud</span>
            <div className="text-lg font-bold text-amber-400 mt-0.5 truncate">
              ${stats.totalMeraki.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-500">Soluciones Meraki</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-400 block">Con Sales Order (SO)</span>
            <div className="text-lg font-bold text-white mt-0.5 truncate">
              {stats.recordsConSoCount}
            </div>
            <span className="text-[10px] text-slate-500">E1: {stats.recordsBodegaE1Count} | ED: {stats.recordsBodegaEdCount}</span>
          </div>

          <div
            onClick={() => setIsRemindersDrawerOpen(true)}
            className="bg-slate-950/60 border border-amber-500/30 rounded-lg p-3 cursor-pointer hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-400">Recordatorios</span>
              <Bell className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </div>
            <div className="text-lg font-bold text-amber-400 mt-0.5 truncate">
              {stats.activeRemindersCount}
            </div>
            <span className="text-[10px] text-rose-400">
              {stats.criticalRemindersCount} críticas por vencer
            </span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-800/80">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="Buscar por Partner, Cliente, Deal ID, SO, NV, PM, SKU..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* PM Filter */}
          <select
            value={filters.pmResponsable || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, pmResponsable: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los PMs</option>
            {FORECAST_PM_LIST.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

          {/* Bodega Filter */}
          <select
            value={filters.bodega || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, bodega: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas las Bodegas</option>
            {FORECAST_BODEGA_OPTIONS.map((bod) => (
              <option key={bod} value={bod}>
                Bodega {bod}
              </option>
            ))}
          </select>

          {/* Grupo Ventas Filter */}
          <select
            value={filters.grupoVentas || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, grupoVentas: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Grupos</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Top Volume">Top Volume</option>
            <option value="Grupo3">Grupo3</option>
          </select>

          {/* Credit Status Filter */}
          <select
            value={filters.credit || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, credit: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Créditos</option>
            {FORECAST_CREDIT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Only Reminders Toggle */}
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, onlyWithReminders: !prev.onlyWithReminders }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              filters.onlyWithReminders
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Solo con Alertas</span>
          </button>

          {/* Reset Filters / Semillas */}
          <button
            type="button"
            onClick={handleResetSeeds}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 hover:bg-slate-800 transition-colors"
            title="Restaurar a las 158 semillas oficiales Intcomex"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table Container matching Excel Styles */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4">
        <div className="inline-block min-w-full align-middle border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl bg-white text-slate-900">
          <table className="w-full text-left text-[11px] border-collapse font-sans">
            {/* Table Headers matching Excel classes (.xl81, .xl87, .xl93 with #92D050) */}
            <thead className="sticky top-0 z-20 shadow-md">
              <tr className="bg-[#92D050] text-slate-900 font-bold border-b-2 border-slate-800 uppercase tracking-wider text-[10px]">
                {/* Actions Header */}
                <th className="sticky left-0 z-30 bg-[#92D050] px-3 py-2.5 text-center border-r border-slate-600/40 w-16">
                  Acción
                </th>

                {/* ID Sticky Header */}
                <th className="sticky left-16 z-30 bg-[#92D050] px-3 py-2.5 border-r border-slate-600/40 w-24">
                  ID
                </th>

                {/* 36 Official Columns */}
                {FORECAST_36_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 border-r border-slate-600/40 whitespace-nowrap text-slate-950 font-bold text-center ${col.minWidth} ${
                      col.colIndex === 25 ? 'bg-[#9BC2E6]' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] opacity-75 font-mono">Col {col.colIndex}</span>
                      <span>{col.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body with Excel Zebra Striping and Alert Cell Highlights */}
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={38} className="py-12 text-center text-slate-500 bg-slate-50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-amber-500" />
                      <p className="font-semibold text-slate-700">No se encontraron registros de Forecast</p>
                      <p className="text-xs text-slate-500">
                        Ajusta los filtros o haz clic en "Cruzar con Módulos" para auto-cargar datos desde CCW o BO.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, rowIdx) => {
                  const isEven = rowIdx % 2 === 0;

                  // Check alerts for this row
                  const hasPriceProtectionExpiry = !!r.priceProtectionExpiryDate;
                  const isCreditPending =
                    r.credit?.toLowerCase().includes('pdte') ||
                    r.credit?.toLowerCase().includes('revis');
                  const hasOpenCase = !!r.caso || !!r.nuevoCaso;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleOpenEdit(r)}
                      className={`cursor-pointer transition-colors hover:bg-emerald-50/80 ${
                        isEven ? 'bg-white' : 'bg-slate-50/60'
                      }`}
                    >
                      {/* Actions Sticky Column */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className={`sticky left-0 z-10 px-2 py-1.5 text-center border-r border-slate-300 w-16 ${
                          isEven ? 'bg-white' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-100"
                            title="Editar registro"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteRecord(r.id, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* ID Sticky Column */}
                      <td
                        className={`sticky left-16 z-10 px-3 py-1.5 font-mono font-semibold text-slate-700 border-r border-slate-300 w-24 ${
                          isEven ? 'bg-white' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{r.id}</span>
                          {(hasPriceProtectionExpiry || isCreditPending || hasOpenCase) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Tiene alertas activas" />
                          )}
                        </div>
                      </td>

                      {/* 36 Columns */}
                      {FORECAST_36_COLUMNS.map((col) => {
                        const val = r[col.key];

                        // Style modifiers based on Excel classes
                        let cellClass = 'px-3 py-1.5 border-r border-slate-200 text-slate-800 whitespace-nowrap ';

                        if (col.align === 'right') cellClass += 'text-right ';
                        else if (col.align === 'center') cellClass += 'text-center ';
                        else cellClass += 'text-left ';

                        // Highlight Col 34 (Credit) if pending (yellow / .xl85)
                        if (col.key === 'credit' && isCreditPending) {
                          cellClass += 'bg-yellow-200 font-semibold text-yellow-900 ';
                        }

                        // Highlight Col 33 (Price Protection Expiry Date)
                        if (col.key === 'priceProtectionExpiryDate' && r.priceProtectionExpiryDate) {
                          cellClass += 'bg-amber-100 font-medium text-amber-900 ';
                        }

                        // Highlight Col 25 (Submitted Date) matching .xl113 (#9BC2E6 light blue)
                        if (col.key === 'submittedDate' && r.submittedDate) {
                          cellClass += 'bg-[#9BC2E6]/40 font-medium ';
                        }

                        // Highlight Col 31 (Bodega)
                        if (col.key === 'bodega') {
                          cellClass += r.bodega === 'ED' ? 'text-purple-700 font-semibold ' : 'text-slate-800 font-medium ';
                        }

                        // Highlight Money columns
                        if (col.isMoney && typeof val === 'number') {
                          return (
                            <td key={col.key} className={cellClass}>
                              {val > 0 ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className={cellClass}>
                            {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Creation / Edit Modal */}
      <ForecastModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        initialRecord={selectedRecord}
        mode={modalMode}
      />

      {/* Reminders & Alerts Drawer */}
      {isRemindersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Recordatorios Comerciales ({reminders.length})
                </h3>
              </div>
              <button
                onClick={() => setIsRemindersDrawerOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reminders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="font-medium text-slate-300">¡Al día! No hay recordatorios activos</p>
                  <p className="text-xs text-slate-500 mt-1">
                    No hay Price Protections vencidas ni créditos pendientes urgentes.
                  </p>
                </div>
              ) : (
                reminders.map((rem) => {
                  const isCrit = rem.severity === 'CRITICAL';
                  const isWarn = rem.severity === 'WARNING';

                  return (
                    <div
                      key={rem.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                        isCrit
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          : isWarn
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold flex items-center gap-1.5 ${
                            isCrit ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-sky-400'
                          }`}
                        >
                          {isCrit ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          {rem.title}
                        </span>
                        {rem.dueDate && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                            {rem.dueDate}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 leading-relaxed">{rem.message}</p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <span>Partner: <strong className="text-slate-200">{rem.partner}</strong></span>
                        <button
                          onClick={() => {
                            const rec = records.find((r) => r.id === rem.forecastId);
                            if (rec) {
                              setIsRemindersDrawerOpen(false);
                              handleOpenEdit(rec);
                            }
                          }}
                          className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                        >
                          {rem.actionLabel || 'Ver Deal'} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 text-center">
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, onlyWithReminders: true }));
                  setIsRemindersDrawerOpen(false);
                }}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
              >
                Filtrar tabla por deals con alertas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheet / CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Importar Google Sheet o CSV</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Pega la URL pública de un Google Sheet publicado en la web (Archivo &rarr; Compartir &rarr; Publicar en la web como CSV) o pega directamente las filas copiadas de Excel/Google Sheet.
            </p>

            <textarea
              rows={5}
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/... o pega texto CSV/TSV aquí"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />

            {importFeedback && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  ¡Importación finalizada! Se agregaron {importFeedback.count} registros nuevos. ({importFeedback.duplicates} duplicados omitidos automáticamente).
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleImportSheet}
                disabled={isLoading || !importInput.trim()}
                className="px-4 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Importando...' : 'Procesar e Importar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
