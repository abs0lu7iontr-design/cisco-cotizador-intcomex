// ============================================================================
// CISCO AUTOMATED v2.8 - VISTA PRINCIPAL DEL PIPELINE COMERCIAL & OPORTUNIDADES
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Award,
  AlertTriangle,
  Calendar,
  Building,
  User,
  Kanban,
  Table as TableIcon,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Trash2,
  Edit,
  Truck,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Bell,
  Clock,
} from 'lucide-react';
import {
  PipelineDealRecord,
  PipelineFilterOptions,
  PIPELINE_PM_LIST,
  PIPELINE_VENTAS_GRUPOS,
  PIPELINE_STAGE_OPTIONS,
  MESES_ANO,
} from './pipelineTypes';
import {
  getPipelineDeals,
  savePipelineDeal,
  deletePipelineDeal,
  syncPipelineWithCloud,
  resetPipelineToInitialSeeds,
} from './pipelineStorage';
import {
  calculatePipelineStats,
  filterPipelineDeals,
  exportPipelineToExcel,
  importPipelineFromExcel,
  importEstimateIntoPipeline,
  generatePipelineReminders,
} from './pipelineService';
import { parseFlexibleNumber } from '../forecast/forecastService';
import { PipelineDealModal } from './PipelineDealModal';
import { useCiscoAutomatedStore } from '../../core/store';

interface PipelineViewProps {
  onOpenQuoter?: () => void;
  onOpenBoTracking?: (dealId?: string) => void;
}

export function PipelineView({ onOpenQuoter, onOpenBoTracking }: PipelineViewProps) {
  const { processedResult, currentUser, setCurrentView } = useCiscoAutomatedStore();

  const [deals, setDeals] = useState<PipelineDealRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Filtros
  const [filters, setFilters] = useState<PipelineFilterOptions>({
    searchQuery: '',
    pmResponsable: 'ALL',
    grupoVentas: 'ALL',
    mesCierre: 'ALL',
    am: 'ALL',
    porcentajeAvance: 'ALL',
    partner: 'ALL',
  });

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDealRecord | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isRemindersDrawerOpen, setIsRemindersDrawerOpen] = useState(false);

  // Mensajes de Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar datos
  const loadDeals = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const data = await getPipelineDeals(forceRefresh);
      setDeals(data);
    } catch (err: any) {
      console.error('Error cargando deals del pipeline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, []);

  // Filtrado y Estadísticas
  const filteredDeals = useMemo(() => {
    return filterPipelineDeals(deals, filters);
  }, [deals, filters]);

  // Recálculo dinámico sobre filteredDeals para que cualquier filtro recalcule sumas y KPIs
  const stats = useMemo(() => {
    return calculatePipelineStats(filteredDeals);
  }, [filteredDeals]);

  const reminders = useMemo(() => {
    return generatePipelineReminders(filteredDeals);
  }, [filteredDeals]);

  // Lista única de Partners y AMs para los filtros
  const uniquePartners = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => {
      if (d.partner && d.partner.trim()) set.add(d.partner.trim());
    });
    return Array.from(set).sort();
  }, [deals]);

  const uniqueAms = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => {
      if (d.am && d.am.trim()) set.add(d.am.trim());
    });
    return Array.from(set).sort();
  }, [deals]);

  // Handlers
  const handleSaveDeal = async (deal: PipelineDealRecord) => {
    const saved = await savePipelineDeal(deal);
    await loadDeals(true);
    setFeedback({
      type: 'success',
      text: `Oportunidad "${saved.endUser} (${saved.partner})" guardada exitosamente.`,
    });
  };

  const handleDeleteDeal = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Estás seguro de eliminar esta oportunidad del pipeline?')) {
      return;
    }
    await deletePipelineDeal(id);
    await loadDeals(true);
    setFeedback({ type: 'info', text: 'Oportunidad eliminada del pipeline.' });
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPipelineWithCloud();
      await loadDeals(true);
      setFeedback({
        type: 'success',
        text: `Sincronización en la nube completada: ${res.count} oportunidades unificadas.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Error al sincronizar: ${err?.message || err}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportPipelineToExcel(filteredDeals);
      setFeedback({ type: 'success', text: `Planilla Excel exportada con ${filteredDeals.length} oportunidades.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error al exportar planilla Excel.' });
    }
  };

  const handleImportExcelClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const res = await importPipelineFromExcel(buffer);
      await loadDeals(true);
      setFeedback({
        type: 'success',
        text: `¡Importación completada sin duplicar! ${res.addedCount} oportunidades nuevas creadas, ${res.updatedCount} existentes actualizadas.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Error al importar archivo: ${err?.message || err}` });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleImportCurrentEstimate = async () => {
    if (!processedResult) {
      setFeedback({ type: 'info', text: 'No hay ninguna cotización CCW cargada actualmente en el cotizador.' });
      return;
    }
    try {
      const saved = await importEstimateIntoPipeline(processedResult, currentUser);
      await loadDeals(true);
      setFeedback({
        type: 'success',
        text: `Cotización de ${saved.partner} (${saved.endUser}) por $${saved.usd.toLocaleString('en-US')} USD importada al Pipeline!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Error importando cotización al pipeline.' });
    }
  };

  const handleResetSeeds = async () => {
    if (!window.confirm('¿Restablecer el Pipeline al conjunto oficial inicial de 70 Deals de Intcomex?')) {
      return;
    }
    await resetPipelineToInitialSeeds();
    await loadDeals(true);
    setFeedback({ type: 'success', text: 'Catálogo de 70 oportunidades oficiales restablecido exitosamente.' });
  };

  const handleAdvanceStage = async (deal: PipelineDealRecord, direction: 'forward' | 'backward', e: React.MouseEvent) => {
    e.stopPropagation();
    const stages = [20, 30, 50, 70, 100];
    const currentIndex = stages.indexOf(deal.porcentajeAvance);
    let nextIndex = currentIndex;
    if (direction === 'forward' && currentIndex < stages.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direction === 'backward' && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex && stages[nextIndex] !== undefined) {
      const nextStage = stages[nextIndex];
      const updated = { ...deal, porcentajeAvance: nextStage };
      await savePipelineDeal(updated);
      await loadDeals(true);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-black text-white tracking-tight">
                Pipeline Comercial & Oportunidades Cisco
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                {filteredDeals.length === deals.length
                  ? `${deals.length} Deals`
                  : `${filteredDeals.length} de ${deals.length} Deals`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestión ejecutiva de negocios, forecasting ponderado y trazabilidad integral preventa Cisco - Intcomex.
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Recordatorios Comerciales */}
          <button
            onClick={() => setIsRemindersDrawerOpen(true)}
            className="relative px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Ver Recordatorios de Vencimiento de Price Protection y Cierres Urgentes"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Recordatorios</span>
            {reminders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {reminders.length}
              </span>
            )}
          </button>

          {processedResult && (
            <button
              onClick={handleImportCurrentEstimate}
              title="Vincular la cotización actualmente abierta en el cotizador CCW"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Importar Cotización Actual</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedDeal(null);
              setModalMode('create');
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Oportunidad</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Descargar planilla Excel (.xlsx) con las 19 columnas oficiales"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleImportExcelClick}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Importar o actualizar oportunidades desde una planilla Excel"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={handleSyncCloud}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Sincronizar oportunidades con Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Nube'}</span>
          </button>

          <button
            onClick={handleResetSeeds}
            className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-700/50 text-xs font-bold transition-all cursor-pointer"
            title="Restablecer los 70 Deals iniciales oficiales de Intcomex"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/80 border border-rose-600/50 text-rose-200'
              : 'bg-indigo-950/80 border border-indigo-600/50 text-indigo-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Pipeline */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Pipeline</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-white font-mono">
              {formatCurrency(stats.totalUsd)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {filteredDeals.length === deals.length
                ? `${stats.totalDeals} oportunidades en seguimiento`
                : `${filteredDeals.length} de ${deals.length} oportunidades filtradas`}
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full w-full" />
          </div>
        </div>

        {/* Forecast Ponderado */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <span>Forecast Ponderado</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-indigo-300 font-mono">
              {formatCurrency(stats.forecastPonderadoUsd)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ajustado por probabilidad (% Avance)
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{
                width: `${Math.min(100, Math.round((stats.forecastPonderadoUsd / (stats.totalUsd || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Desglose HW + Suscripciones */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-400 text-xs font-bold uppercase tracking-wider">
            <span>📦 Prod. + Suscripciones</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {Math.round((stats.totalProductosSuscripciones / (stats.totalUsd || 1)) * 100)}%
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-sky-300 font-mono">
              {formatCurrency(stats.totalProductosSuscripciones)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Equipos y Software Cisco</p>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full"
              style={{
                width: `${Math.min(100, Math.round((stats.totalProductosSuscripciones / (stats.totalUsd || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Desglose Servicios & Meraki */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
            <span>🛠️ Servicios / 🌐 Meraki</span>
          </div>
          <div className="my-1 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Servicios:</span>
              <span className="text-sm font-black text-purple-300 font-mono">
                {formatCurrency(stats.totalServicios)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Meraki:</span>
              <span className="text-sm font-black text-emerald-300 font-mono">
                {formatCurrency(stats.totalMeraki)}
              </span>
            </div>
          </div>
          <div className="flex space-x-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500"
              style={{
                width: `${Math.round((stats.totalServicios / (stats.totalUsd || 1)) * 100)}%`,
              }}
            />
            <div
              className="h-full bg-emerald-500"
              style={{
                width: `${Math.round((stats.totalMeraki / (stats.totalUsd || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Deals Ganados & Alertas */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>Cerrados (100%)</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatCurrency(stats.dealsGanadosUsd)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stats.dealsGanadosCount} deals ganados / por facturar
            </p>
          </div>
          {stats.dealsPriceProtectionAlertsCount > 0 ? (
            <div className="text-[10px] font-bold text-amber-400 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{stats.dealsPriceProtectionAlertsCount} Price Protection por expirar</span>
            </div>
          ) : (
            <div className="h-1.5 w-full bg-emerald-500/30 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
          )}
        </div>
      </div>

      {/* Filter and View Toggle Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar Partner, End User, Deal ID, AM..."
              value={filters.searchQuery || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            />
          </div>

          {/* PM Filter */}
          <select
            value={filters.pmResponsable || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, pmResponsable: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
          >
            <option value="ALL">Todos los PMs</option>
            {PIPELINE_PM_LIST.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

          {/* Grupo de Ventas Filter */}
          <select
            value={filters.grupoVentas || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, grupoVentas: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
          >
            <option value="ALL">Todos los Grupos</option>
            {PIPELINE_VENTAS_GRUPOS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Mes de Cierre Filter */}
          <select
            value={filters.mesCierre || 'ALL'}
            onChange={(e) => setFilters((prev) => ({ ...prev, mesCierre: e.target.value }))}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
          >
            <option value="ALL">Todos los Meses</option>
            {MESES_ANO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* % Avance Filter */}
          <select
            value={filters.porcentajeAvance !== undefined ? String(filters.porcentajeAvance) : 'ALL'}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                porcentajeAvance: e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10),
              }))
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
          >
            <option value="ALL">Todas las Etapas</option>
            {PIPELINE_STAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Toggle Solo con Alertas */}
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, onlyWithReminders: !prev.onlyWithReminders }))}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border cursor-pointer ${
              filters.onlyWithReminders
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Solo con Alertas</span>
          </button>

          {(filters.searchQuery ||
            filters.pmResponsable !== 'ALL' ||
            filters.grupoVentas !== 'ALL' ||
            filters.mesCierre !== 'ALL' ||
            filters.porcentajeAvance !== 'ALL') && (
            <button
              onClick={() =>
                setFilters({
                  searchQuery: '',
                  pmResponsable: 'ALL',
                  grupoVentas: 'ALL',
                  mesCierre: 'ALL',
                  am: 'ALL',
                  porcentajeAvance: 'ALL',
                  partner: 'ALL',
                })
              }
              className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Right: View Toggle (Table / Kanban) */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tabla</span>
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Tablero</span>
          </button>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {[20, 30, 50, 70, 100].map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.porcentajeAvance === stage);
            const stageTotal = stageDeals.reduce((sum, d) => sum + parseFlexibleNumber(d.usd), 0);
            const stageMeta = PIPELINE_STAGE_OPTIONS.find((s) => s.value === stage);

            return (
              <div
                key={stage}
                className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-3xl overflow-hidden min-w-[260px] shadow-lg"
              >
                {/* Column Header */}
                <div className={`p-4 border-b border-slate-800/80 ${stageMeta?.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-black uppercase tracking-wider ${stageMeta?.color}`}>
                      {stageMeta?.label.split(' - ')[1] || `${stage}%`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-950/80 text-white border border-slate-700/50">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="text-sm font-black text-white font-mono">
                    {formatCurrency(stageTotal)}
                  </div>
                </div>

                {/* Cards Container */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar max-h-[70vh]">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => {
                        setSelectedDeal(deal);
                        setModalMode('edit');
                        setIsModalOpen(true);
                      }}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/10 group space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 truncate max-w-[150px]">
                          {deal.partner}
                        </span>
                        {deal.dealId && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                            #{deal.dealId}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {deal.endUser}
                      </div>

                      <div className="text-base font-black text-amber-400 font-mono">
                        {formatCurrency(deal.usd)}
                      </div>

                      {/* Desglose Chips */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400 font-mono">
                        {deal.productosSuscripciones > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                            📦 ${(deal.productosSuscripciones / 1000).toFixed(0)}k
                          </span>
                        )}
                        {deal.servicios > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300">
                            🛠️ ${(deal.servicios / 1000).toFixed(0)}k
                          </span>
                        )}
                        {deal.meraki > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                            🌐 ${(deal.meraki / 1000).toFixed(0)}k
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[120px]">PM: {deal.pmResponsable}</span>
                        <span>{deal.mesCierre}</span>
                      </div>

                      {/* Quick stage controls */}
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => handleAdvanceStage(deal, 'backward', e)}
                          title="Retroceder etapa"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        {stage === 100 && onOpenBoTracking && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenBoTracking(deal.dealId);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                          >
                            <Truck className="w-3 h-3" />
                            <span>BO</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleAdvanceStage(deal, 'forward', e)}
                          title="Avanzar etapa"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-600">
                      Sin oportunidades en esta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="p-1 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Fecha Lev.</th>
                  <th className="py-3 px-3">Fecha Cot.</th>
                  <th className="py-3 px-3">PM Resp.</th>
                  <th className="py-3 px-4">Partner / Reseller</th>
                  <th className="py-3 px-3">Ejecutivo Partner</th>
                  <th className="py-3 px-4">End User (Cliente Final)</th>
                  <th className="py-3 px-3 text-right">Monto USD</th>
                  <th className="py-3 px-3">Mes Cierre</th>
                  <th className="py-3 px-3 text-center">% Avance</th>
                  <th className="py-3 px-3"># Reg. Oportunidad</th>
                  <th className="py-3 px-3 text-right">Prod + Sub</th>
                  <th className="py-3 px-3 text-right">Servicios</th>
                  <th className="py-3 px-3 text-right">Meraki</th>
                  <th className="py-3 px-3">AM</th>
                  <th className="py-3 px-3">Grupo</th>
                  <th className="py-3 px-4">Notas</th>
                  <th className="py-3 px-3">Price Protection</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDeals.map((deal) => {
                  const stageMeta = PIPELINE_STAGE_OPTIONS.find((s) => s.value === deal.porcentajeAvance);
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => {
                        setSelectedDeal(deal);
                        setModalMode('edit');
                        setIsModalOpen(true);
                      }}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 font-mono text-slate-400">{deal.fechaLevantamiento || '-'}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{deal.fechaCotizacion || '-'}</td>
                      <td className="py-3 px-3 font-medium text-slate-300">{deal.pmResponsable}</td>
                      <td className="py-3 px-4 font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {deal.partner}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{deal.ejecutivoPartner || '-'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{deal.endUser}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400 text-sm">
                        {formatCurrency(deal.usd)}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">{deal.mesCierre}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            stageMeta?.bg || 'bg-slate-800'
                          } ${stageMeta?.color || 'text-slate-300'} border ${
                            stageMeta?.border || 'border-slate-700'
                          }`}
                        >
                          {deal.porcentajeAvance}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-indigo-300">{deal.dealId || '-'}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {deal.productosSuscripciones > 0 ? formatCurrency(deal.productosSuscripciones) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-purple-300">
                        {deal.servicios > 0 ? formatCurrency(deal.servicios) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-300">
                        {deal.meraki > 0 ? formatCurrency(deal.meraki) : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{deal.am || '-'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800">
                          {deal.grupoVentas || 'Enterprise'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={deal.notas}>
                        {deal.notas || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-300">
                        {deal.priceProtectionExpiryDate || '-'}
                      </td>
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeal(deal);
                              setModalMode('edit');
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Editar Oportunidad"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDeal(deal.id, e)}
                            className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Eliminar Oportunidad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredDeals.length > 0 && (
                <tfoot className="border-t-2 border-slate-700 bg-slate-950/95 font-bold">
                  <tr className="text-xs">
                    <td colSpan={6} className="py-3.5 px-4 text-slate-300 uppercase tracking-wider text-[11px] font-bold">
                      Totales ({filteredDeals.length === deals.length ? `${deals.length} deals` : `${filteredDeals.length} de ${deals.length} filtrados`}):
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-black text-amber-400 text-sm">
                      {formatCurrency(stats.totalUsd)}
                    </td>
                    <td colSpan={3}></td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300 font-bold">
                      {formatCurrency(stats.totalProductosSuscripciones)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-purple-300 font-bold">
                      {formatCurrency(stats.totalServicios)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-300 font-bold">
                      {formatCurrency(stats.totalMeraki)}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {filteredDeals.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-xs">
              No se encontraron oportunidades con los filtros seleccionados.
            </div>
          )}
        </div>
      )}

      {/* Drawer de Recordatorios Comerciales del Pipeline */}
      {isRemindersDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center space-x-2">
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

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reminders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="font-medium text-slate-300">¡Al día! No hay alertas activas en el Pipeline</p>
                  <p className="text-xs text-slate-500 mt-1">
                    No hay Price Protections por vencer en los próximos 14 días.
                  </p>
                </div>
              ) : (
                reminders.map((rem) => {
                  const isCrit = rem.severity === 'CRITICAL';
                  const isWarn = rem.severity === 'WARNING';
                  return (
                    <div
                      key={rem.id}
                      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all shadow-sm ${
                        isCrit
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          : isWarn
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold flex items-center space-x-1.5 ${
                            isCrit ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-sky-400'
                          }`}
                        >
                          {isCrit ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
                          <span>{rem.title}</span>
                        </span>
                        {rem.dueDate && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                            {rem.dueDate}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 leading-relaxed">{rem.message}</p>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <span>{rem.partner} &bull; <strong className="text-slate-200">${rem.usd.toLocaleString('en-US')} USD</strong></span>
                        <button
                          onClick={() => {
                            const d = deals.find((deal) => deal.id === rem.dealId || deal.dealId === rem.dealId);
                            if (d) {
                              setIsRemindersDrawerOpen(false);
                              setSelectedDeal(d);
                              setModalMode('edit');
                              setIsModalOpen(true);
                            }
                          }}
                          className="text-indigo-400 hover:underline font-bold"
                        >
                          Ver Oportunidad &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950">
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, onlyWithReminders: true }));
                  setIsRemindersDrawerOpen(false);
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-lg shadow-indigo-600/30"
              >
                Filtrar Pipeline por Deals con Alertas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación / Edición */}
      <PipelineDealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDeal}
        initialDeal={selectedDeal}
        mode={modalMode}
      />
    </div>
  );
}
