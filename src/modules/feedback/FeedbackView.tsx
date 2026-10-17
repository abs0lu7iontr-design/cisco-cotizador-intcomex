// ============================================================================
// CISCO AUTOMATED v2.1 - FEEDBACK, BUG REPORTING & SLA TICKETING VIEW
// Unified workspace for user bug reporting, feature suggestions & support triaging
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Sparkles,
  Bug,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  User,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Inbox,
  Send,
  HelpCircle,
  LayoutGrid,
  BarChart3,
  Calendar,
  FileCheck,
  Activity,
} from 'lucide-react';
import { useCiscoAutomatedStore } from '../../core/store';
import {
  FeedbackTicket,
  TicketStatus,
  TicketPriority,
  FeedbackType,
  ModuleContext,
  SlaStatus,
} from './types';
import {
  getFeedbackTickets,
  computeSlaInfo,
  createFeedbackTicket,
  SLA_TARGET_HOURS,
} from './feedbackService';
import { CreateTicketModal } from './CreateTicketModal';
import { TicketDetailModal } from './TicketDetailModal';

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Abierto', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  IN_PROGRESS: { label: 'En Proceso', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  RESOLVED: { label: 'Resuelto', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  CLOSED: { label: 'Cerrado', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400' },
  REJECTED: { label: 'Rechazado', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítica (4h)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  HIGH: { label: 'Alta (24h)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  MEDIUM: { label: 'Media (72h)', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  LOW: { label: 'Baja (120h)', color: 'bg-slate-800 text-slate-300 border-slate-700' },
};

export function FeedbackView() {
  const { currentUser, currentFileName, processedResult } = useCiscoAutomatedStore();

  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'metrics'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);

  const fetchTickets = async (force = false) => {
    setIsLoading(true);
    try {
      const data = await getFeedbackTickets(force);
      setTickets(data);
    } catch (err) {
      console.error('[FeedbackView] Error loading tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Tab filter
      if (activeTab === 'mine') {
        if (!currentUser || t.author.username !== currentUser.username) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesAuthor = t.author.fullName.toLowerCase().includes(q);
        const matchesModule = t.module.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesDesc && !matchesAuthor && !matchesModule) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL') {
        if (priorityFilter === 'BREACHED') {
          const sla = computeSlaInfo(t);
          if (sla.status !== 'BREACHED') return false;
        } else if (t.priority !== priorityFilter) {
          return false;
        }
      }

      // Type Filter
      if (typeFilter !== 'ALL' && t.type !== typeFilter) {
        return false;
      }

      // Module Filter
      if (moduleFilter !== 'ALL' && t.module !== moduleFilter) {
        return false;
      }

      return true;
    });
  }, [tickets, activeTab, searchQuery, statusFilter, priorityFilter, typeFilter, moduleFilter, currentUser]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const mine = currentUser
      ? tickets.filter((t) => t.author.username === currentUser.username).length
      : 0;

    let totalResolvedWithSla = 0;
    let onTimeResolved = 0;
    let activeBreached = 0;

    tickets.forEach((t) => {
      const sla = computeSlaInfo(t);
      if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
        totalResolvedWithSla++;
        if (!sla.isBreached) onTimeResolved++;
      } else {
        if (sla.isBreached) activeBreached++;
      }
    });

    const slaComplianceRate =
      totalResolvedWithSla > 0
        ? Math.round((onTimeResolved / totalResolvedWithSla) * 100)
        : 100;

    return { total, open, resolved, mine, slaComplianceRate, activeBreached };
  }, [tickets, currentUser]);

  const handleTicketCreated = () => {
    fetchTickets(true);
  };

  const handleTicketUpdated = async () => {
    await fetchTickets(true);
    if (selectedTicket) {
      const all = await getFeedbackTickets();
      const ref = all.find((x) => x.id === selectedTicket.id);
      if (ref) setSelectedTicket(ref);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Modals */}
      {currentUser && (
        <CreateTicketModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUser={currentUser}
          onTicketCreated={handleTicketCreated}
          currentEstimateFileName={currentFileName}
          dealId={processedResult?.headerInfo?.dealId}
        />
      )}

      {currentUser && selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          currentUser={currentUser}
          onTicketUpdated={handleTicketUpdated}
        />
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/10">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                Módulo de Mejoras, Feedback & Soporte
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                SLA & Ticketing
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Reporta incidencias, sugiere optimizaciones o solicita nuevas funciones. Nuestro equipo revisa y responde con trazabilidad completa.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={() => fetchTickets(true)}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Recargar tickets"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Reporte / Sugerencia</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Reportes
          </span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-white">{metrics.total}</span>
            <span className="text-xs text-slate-500">tickets</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            En Atención Activa
          </span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-amber-300">{metrics.open}</span>
            <span className="text-xs text-slate-500">pendientes</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Resueltos
          </span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-emerald-300">{metrics.resolved}</span>
            <span className="text-xs text-slate-500">completados</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            Cumplimiento SLA
          </span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-cyan-300">
              {metrics.slaComplianceRate}%
            </span>
            <span className="text-xs text-slate-500">a tiempo</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Mis Solicitudes
          </span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-black text-indigo-300">{metrics.mine}</span>
            <span className="text-xs text-slate-500">creadas por ti</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4 shadow-xl">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Todos los Reportes ({tickets.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mine')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'mine'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Mis Solicitudes ({metrics.mine})</span>
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'metrics'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Métricas & Análisis SLA</span>
            </button>
          </div>

          <div className="text-xs text-slate-400">
            Mostrando <strong className="text-white">{filteredTickets.length}</strong> de{' '}
            <strong className="text-white">{tickets.length}</strong> tickets
          </div>
        </div>

        {/* Search & Multidimensional Filters */}
        {activeTab !== 'metrics' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por ID, título, autor..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="OPEN">Abierto</option>
                <option value="IN_PROGRESS">En Proceso</option>
                <option value="RESOLVED">Resuelto</option>
                <option value="CLOSED">Cerrado</option>
                <option value="REJECTED">Rechazado</option>
              </select>
            </div>

            {/* Priority & SLA Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todas las Prioridades / SLA</option>
                <option value="CRITICAL">Crítica (SLA 4h)</option>
                <option value="HIGH">Alta (SLA 24h)</option>
                <option value="MEDIUM">Media (SLA 72h)</option>
                <option value="LOW">Baja (SLA 120h)</option>
                <option value="BREACHED">⚠️ SLA Vencido</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Tipos</option>
                <option value="BUG">Error o Falla Técnica</option>
                <option value="IMPROVEMENT">Mejora de Función</option>
                <option value="FEATURE_REQUEST">Nueva Característica</option>
                <option value="UX_UI">Diseño & Usabilidad</option>
                <option value="DATA_CATALOG">Catálogo & SKUs</option>
                <option value="OTHER">Consulta u Otro</option>
              </select>
            </div>

            {/* Module Filter */}
            <div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Todos los Módulos</option>
                <option value="QUOTER">Cotizador Cisco CCW</option>
                <option value="CONFIGURIATOR">ConfigurIAtor (AI BOM)</option>
                <option value="DSV">Generador DSV Cisco</option>
                <option value="BO_TRACKING">Back Order & Tracking</option>
                <option value="ESTIMATES">Historial Cotizaciones</option>
                <option value="MINING">Condiciones de Minería</option>
                <option value="SETTINGS">Configuración & Deploy</option>
                <option value="DESKTOP_APP">App Desktop</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'metrics' ? (
        /* Analytics View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Desglose por Tipo de Solicitud</span>
            </h3>
            <div className="space-y-3">
              {(['BUG', 'IMPROVEMENT', 'FEATURE_REQUEST', 'UX_UI', 'DATA_CATALOG', 'OTHER'] as FeedbackType[]).map(
                (typ) => {
                  const count = tickets.filter((t) => t.type === typ).length;
                  const pct = tickets.length > 0 ? Math.round((count / tickets.length) * 100) : 0;
                  return (
                    <div key={typ} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">{typ}</span>
                        <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Cumplimiento de Compromiso SLA</span>
            </h3>
            <div className="space-y-3">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((pr) => {
                const prTickets = tickets.filter((t) => t.priority === pr);
                const breached = prTickets.filter((t) => computeSlaInfo(t).isBreached).length;
                const onTime = prTickets.length - breached;
                const rate = prTickets.length > 0 ? Math.round((onTime / prTickets.length) * 100) : 100;
                return (
                  <div key={pr} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-bold">{pr} ({SLA_TARGET_HOURS[pr]}h)</span>
                      <span className="text-slate-400 font-mono">
                        {rate}% a tiempo ({prTickets.length} tickets)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Tickets List / Table */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Cargando reportes y estado de tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto border border-slate-700/60">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-white">No se encontraron reportes</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No hay tickets que coincidan con los filtros seleccionados. Puedes crear un nuevo reporte o limpiar la búsqueda.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                + Crear Nuevo Reporte
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Ticket</th>
                    <th className="py-3.5 px-4">Tipo & Módulo</th>
                    <th className="py-3.5 px-4">Título / Resumen</th>
                    <th className="py-3.5 px-4">Reportado Por</th>
                    <th className="py-3.5 px-4">Compromiso SLA</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4 text-right">Respuestas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTickets.map((t) => {
                    const slaInfo = computeSlaInfo(t);
                    const statusConfig = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
                    const priorityConfig = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;
                    const isUnreadForMe =
                      currentUser &&
                      ((t.author.username === currentUser.username && !t.readByAuthor) ||
                        ((currentUser.role === 'admin' || currentUser.role === 'pm') &&
                          !t.readBySupport));

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className="hover:bg-slate-850/60 transition-colors cursor-pointer group"
                      >
                        {/* ID & Priority */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-indigo-400">
                              {t.id}
                            </span>
                            {isUnreadForMe && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Feedback nuevo sin leer" />
                            )}
                          </div>
                          <span
                            className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded border ${priorityConfig.color}`}
                          >
                            {priorityConfig.label}
                          </span>
                        </td>

                        {/* Type & Module */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-200 block">{t.type}</span>
                          <span className="text-[10px] text-slate-500">{t.module}</span>
                        </td>

                        {/* Title & Preview */}
                        <td className="py-3.5 px-4 max-w-md">
                          <span className="font-bold text-white group-hover:text-indigo-300 transition-colors block truncate">
                            {t.title}
                          </span>
                          <span className="text-[11px] text-slate-400 line-clamp-1">
                            {t.description}
                          </span>
                        </td>

                        {/* Author */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-300 block">
                            {t.author.fullName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(t.createdAt).toLocaleDateString('es-CL')}
                          </span>
                        </td>

                        {/* SLA Info */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                              slaInfo.status === 'BREACHED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : slaInfo.status === 'NEAR_BREACH'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{slaInfo.formattedRemaining}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-xl font-bold border ${statusConfig.bg} ${statusConfig.text}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* Responses */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-1.5 text-slate-400 group-hover:text-indigo-400">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="font-bold font-mono">
                              {t.responses?.length || 0}
                            </span>
                            <ChevronRight className="w-4 h-4 ml-1 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
