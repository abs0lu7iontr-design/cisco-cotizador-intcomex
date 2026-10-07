// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL REMINDER VIEW (MONITOR & RECORDADOR DE DEALS)
// Seguimiento de Deals Cisco escalados a AM Cisco o Velocity Hub (VF)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  UserCheck,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  MessageSquare,
  Building2,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronRight,
  FileSpreadsheet,
  Check,
  Send,
  HelpCircle,
  Package,
} from 'lucide-react';
import {
  DealReminderRecord,
  DealEscalationChannel,
  DealReminderStatus,
  DEAL_ESCALATION_METADATA,
  DEAL_STATUS_METADATA,
  calculateDealAging,
} from './dealReminderTypes';
import {
  getDealReminders,
  saveDealReminder,
  updateDealReminderStatus,
  recordDealReminderSent,
  addDealHistoryNote,
  deleteDealReminder,
  createDealReminderFromEstimate,
} from './dealReminderService';
import { copyDealReminderToClipboard, getDealTimeGreeting } from './dealEmailHelper';
import { useCiscoAutomatedStore } from '../../core/store';

interface DealReminderViewProps {
  onConvertToBo?: (deal: DealReminderRecord) => void;
}

export function DealReminderView({ onConvertToBo }: DealReminderViewProps) {
  const { currentUser, processedResult, detectedPartner } = useCiscoAutomatedStore();

  const [deals, setDeals] = useState<DealReminderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('ALL'); // 'ALL' | 'AM_CISCO' | 'VELOCITY_HUB'
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 'ALL' | 'PENDING' | 'OVERDUE' | 'APPROVED'
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);

  // Modales
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [selectedDealForNotes, setSelectedDealForNotes] = useState<DealReminderRecord | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedDealForEdit, setSelectedDealForEdit] = useState<DealReminderRecord | null>(null);

  // Formulario Nuevo Deal (4 Campos Principales Requeridos)
  const [formDealId, setFormDealId] = useState('');
  const [formPartnerName, setFormPartnerName] = useState('');
  const [formEndCustomerName, setFormEndCustomerName] = useState('');
  const [formEscalationChannel, setFormEscalationChannel] = useState<DealEscalationChannel>('AM_CISCO');

  // Campos Opcionales Secundarios
  const [formAmContactName, setFormAmContactName] = useState('');
  const [formAmContactEmail, setFormAmContactEmail] = useState('');
  const [formVfTicketNumber, setFormVfTicketNumber] = useState('');
  const [formTargetDiscountPct, setFormTargetDiscountPct] = useState<string>('');
  const [formEstimatedTotalUsd, setFormEstimatedTotalUsd] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const records = await getDealReminders();
      setDeals(records);
    } catch (err) {
      console.error('Error cargando Deals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Prellenar formulario con Estimate actual si está abierto
  const handlePreloadFromCurrentEstimate = () => {
    if (!processedResult) return;
    const header = processedResult.headerInfo || ({} as any);
    setFormDealId(header.dealId || '');
    setFormPartnerName(detectedPartner || header.customerName || '');
    setFormEndCustomerName(header.companyName || header.endUser || '');
    if (processedResult.calculatedProductTotal) {
      setFormEstimatedTotalUsd(String(processedResult.calculatedProductTotal));
    }
  };

  // Abrir modal de nuevo deal
  const handleOpenNewDealModal = () => {
    // Si hay datos en el estimate actual, prellenar
    if (processedResult) {
      handlePreloadFromCurrentEstimate();
    } else {
      setFormDealId('');
      setFormPartnerName('');
      setFormEndCustomerName('');
      setFormEstimatedTotalUsd('');
    }
    setFormEscalationChannel('AM_CISCO');
    setFormAmContactName('');
    setFormAmContactEmail('');
    setFormVfTicketNumber('');
    setFormTargetDiscountPct('');
    setFormNotes('');
    setShowOptionalFields(false);
    setIsNewDealModalOpen(true);
  };

  // Guardar nuevo Deal
  const handleSaveNewDeal = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDealId = formDealId.trim();
    const cleanPartner = formPartnerName.trim();
    const cleanCustomer = formEndCustomerName.trim();

    if (!cleanDealId) {
      alert('Por favor ingresa el número o ID del Deal Cisco.');
      return;
    }
    if (!cleanPartner) {
      alert('Por favor ingresa el nombre del Partner / Canal.');
      return;
    }
    if (!cleanCustomer) {
      alert('Por favor ingresa el nombre del Cliente Final.');
      return;
    }

    const nowIso = new Date().toISOString();
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    const id = `DEAL-REM-${cleanDealId.replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now().toString().slice(-4)}`;

    const newDeal: DealReminderRecord = {
      id,
      dealId: cleanDealId,
      partnerName: cleanPartner,
      endCustomerName: cleanCustomer,
      escalationChannel: formEscalationChannel,
      amContactName: formAmContactName.trim() || undefined,
      amContactEmail: formAmContactEmail.trim() || undefined,
      vfTicketNumber: formVfTicketNumber.trim() || undefined,
      targetDiscountPct: formTargetDiscountPct ? Number(formTargetDiscountPct) : undefined,
      estimatedTotalUsd: formEstimatedTotalUsd ? Number(formEstimatedTotalUsd) : undefined,
      estimateId: processedResult?.headerInfo?.estimateId || undefined,
      notes: formNotes.trim() || undefined,
      status: 'PENDING_APPROVAL',
      escalatedAt: nowIso,
      reminderCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: author,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: nowIso,
          author,
          action: 'CREATED',
          comment: `Deal registrado y escalado a ${
            formEscalationChannel === 'VELOCITY_HUB' ? 'Cisco Velocity Hub (VF)' : 'AM Cisco'
          }.`,
        },
      ],
    };

    await saveDealReminder(newDeal);
    setIsNewDealModalOpen(false);
    await loadData();
  };

  // Copiar recordatorio para Outlook
  const handleCopyEmailReminder = async (deal: DealReminderRecord) => {
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    const result = await copyDealReminderToClipboard(deal);

    if (result.success) {
      setCopiedDealId(deal.id);
      setTimeout(() => setCopiedDealId(null), 4000);
      await recordDealReminderSent(deal.id, author);
      await loadData();
    } else {
      alert(`No se pudo copiar al portapapeles: ${result.error}`);
    }
  };

  // Cambiar estado rápido
  const handleStatusChange = async (deal: DealReminderRecord, newStatus: DealReminderStatus) => {
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    await updateDealReminderStatus(deal.id, newStatus, author);
    await loadData();
  };

  // Agregar nota
  const handleAddNote = async () => {
    if (!selectedDealForNotes || !newNoteText.trim()) return;
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    await addDealHistoryNote(selectedDealForNotes.id, author, newNoteText.trim());
    setNewNoteText('');
    await loadData();
    const refreshed = (await getDealReminders()).find((d) => d.id === selectedDealForNotes.id);
    if (refreshed) setSelectedDealForNotes(refreshed);
  };

  // Eliminar deal
  const handleDeleteDeal = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este recordatorio de Deal?')) return;
    await deleteDealReminder(id);
    await loadData();
  };

  // Filtrado de Deals
  const filteredDeals = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return deals.filter((deal) => {
      // Búsqueda por texto
      const matchesSearch =
        !q ||
        deal.dealId.toLowerCase().includes(q) ||
        deal.partnerName.toLowerCase().includes(q) ||
        deal.endCustomerName.toLowerCase().includes(q) ||
        (deal.amContactName && deal.amContactName.toLowerCase().includes(q)) ||
        (deal.vfTicketNumber && deal.vfTicketNumber.toLowerCase().includes(q)) ||
        (deal.notes && deal.notes.toLowerCase().includes(q));

      // Filtro de canal
      const matchesChannel = channelFilter === 'ALL' || deal.escalationChannel === channelFilter;

      // Filtro de estado / envejecimiento
      let matchesStatus = true;
      if (statusFilter === 'PENDING') {
        matchesStatus = deal.status === 'PENDING_APPROVAL' || deal.status === 'INFO_REQUIRED';
      } else if (statusFilter === 'APPROVED') {
        matchesStatus = deal.status === 'APPROVED' || deal.status === 'CONVERTED_TO_BO';
      } else if (statusFilter === 'OVERDUE') {
        const aging = calculateDealAging(deal);
        matchesStatus = aging.isOverdue;
      }

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [deals, searchTerm, channelFilter, statusFilter]);

  // Estadísticas KPI
  const stats = useMemo(() => {
    const pending = deals.filter((d) => d.status === 'PENDING_APPROVAL' || d.status === 'INFO_REQUIRED');
    const amPending = pending.filter((d) => d.escalationChannel === 'AM_CISCO');
    const vfPending = pending.filter((d) => d.escalationChannel === 'VELOCITY_HUB');
    const overdue = pending.filter((d) => calculateDealAging(d).isOverdue);
    const critical = pending.filter((d) => calculateDealAging(d).health === 'CRITICAL_OVERDUE');
    const approved = deals.filter((d) => d.status === 'APPROVED' || d.status === 'CONVERTED_TO_BO');

    return {
      total: deals.length,
      pendingCount: pending.length,
      amCount: amPending.length,
      vfCount: vfPending.length,
      overdueCount: overdue.length,
      criticalCount: critical.length,
      approvedCount: approved.length,
    };
  }, [deals]);

  // Exportar a CSV con BOM UTF-8
  const handleExportCsv = () => {
    if (deals.length === 0) return;

    const headers = [
      'Deal ID',
      'Partner / Canal',
      'Cliente Final',
      'Canal Escalamiento',
      'Estado',
      'Contacto AM / VF Ticket',
      'Descuento Solicitado %',
      'Monto Estimado USD',
      'Fecha Escalamiento',
      'Horas en Espera',
      'Recordatorios Enviados',
      'Último Recordatorio',
      'Notas',
    ];

    const rows = deals.map((d) => {
      const aging = calculateDealAging(d);
      return [
        `"${d.dealId}"`,
        `"${d.partnerName}"`,
        `"${d.endCustomerName}"`,
        `"${d.escalationChannel === 'VELOCITY_HUB' ? 'Velocity Hub (VF)' : 'AM Cisco'}"`,
        `"${DEAL_STATUS_METADATA[d.status]?.label || d.status}"`,
        `"${d.amContactName || d.vfTicketNumber || ''}"`,
        `"${d.targetDiscountPct ? d.targetDiscountPct + '%' : ''}"`,
        `"${d.estimatedTotalUsd || ''}"`,
        `"${d.escalatedAt?.slice(0, 10) || ''}"`,
        `"${aging.elapsedHours}"`,
        `"${d.reminderCount || 0}"`,
        `"${d.lastReminderSentAt?.slice(0, 16) || ''}"`,
        `"${(d.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Deals_Seguimiento_Intcomex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-5 sticky top-0 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400 shadow-inner">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white">
                  Recordador & Notificador de DEALS Cisco
                </h1>
                <span className="bg-indigo-950/80 text-indigo-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                  AM & Velocity Hub (VF)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitorea deals escalados, tiempos de respuesta y genera recordatorios por correo en 1 clic
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleOpenNewDealModal}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Recordatorio de Deal</span>
            </button>

            {processedResult && (
              <button
                onClick={handlePreloadFromCurrentEstimate}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-medium rounded-xl transition-all cursor-pointer"
                title="Cargar Deal, Partner y Cliente desde el Estimate activo"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Usar Estimate Activo</span>
              </button>
            )}

            <button
              onClick={handleExportCsv}
              disabled={deals.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Descargar reporte en CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all cursor-pointer"
              title="Recargar Deals"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Total Deals
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-white">{stats.total}</span>
              <span className="text-[11px] text-slate-500">registrados</span>
            </div>
          </div>

          <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-amber-400/80 tracking-wider block">
              En Espera Total
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-amber-300">{stats.pendingCount}</span>
              <span className="text-[11px] text-amber-400/70">pendientes</span>
            </div>
          </div>

          <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-indigo-400/80 tracking-wider block">
              Escalados AM Cisco
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-indigo-300">{stats.amCount}</span>
              <span className="text-[11px] text-indigo-400/70">en revisión AM</span>
            </div>
          </div>

          <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-cyan-400/80 tracking-wider block">
              Velocity Hub (VF)
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-cyan-300">{stats.vfCount}</span>
              <span className="text-[11px] text-cyan-400/70">en cola VF</span>
            </div>
          </div>

          <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-rose-400/80 tracking-wider block">
              Requieren Seguimiento
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-rose-300">{stats.overdueCount}</span>
              <span className="text-[11px] text-rose-400/70">&gt; 24h sin resp.</span>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider block">
              Aprobados / Con OC
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-emerald-300">{stats.approvedCount}</span>
              <span className="text-[11px] text-emerald-400/70">cerrados</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Deal ID, Partner, Cliente Final, AM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Filter by Escalation Channel */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setChannelFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  channelFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setChannelFilter('AM_CISCO')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center space-x-1 ${
                  channelFilter === 'AM_CISCO' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3 h-3" />
                <span>AM Cisco</span>
              </button>
              <button
                onClick={() => setChannelFilter('VELOCITY_HUB')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center space-x-1 ${
                  channelFilter === 'VELOCITY_HUB' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Velocity Hub (VF)</span>
              </button>
            </div>

            {/* Filter by Status / Aging */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING">Solo Pendientes</option>
              <option value="OVERDUE">⚠️ Requieren Seguimiento (&gt; 24h)</option>
              <option value="APPROVED">Solo Aprobados / Con OC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Deals List */}
      <div className="p-6 space-y-3.5">
        {filteredDeals.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
            <div className="w-14 h-14 bg-indigo-950/40 border border-indigo-700/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 mb-4">
              <Bell className="w-7 h-7 opacity-80" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No se encontraron Deals con estos filtros</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              Registra un nuevo Deal escalado a AM Cisco o Velocity Hub para comenzar su seguimiento y recordatorios.
            </p>
            <button
              onClick={handleOpenNewDealModal}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Primer Deal</span>
            </button>
          </div>
        ) : (
          filteredDeals.map((deal) => {
            const aging = calculateDealAging(deal);
            const isVF = deal.escalationChannel === 'VELOCITY_HUB';
            const channelMeta = DEAL_ESCALATION_METADATA[deal.escalationChannel];
            const statusMeta = DEAL_STATUS_METADATA[deal.status];
            const isCopied = copiedDealId === deal.id;

            return (
              <div
                key={deal.id}
                className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 transition-all hover:border-slate-700 shadow-md ${
                  aging.health === 'CRITICAL_OVERDUE'
                    ? 'border-rose-900/60 bg-gradient-to-r from-rose-950/20 to-slate-900/90'
                    : aging.health === 'NEEDS_FOLLOW_UP'
                      ? 'border-amber-900/60 bg-gradient-to-r from-amber-950/15 to-slate-900/90'
                      : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Deal Identity & Partner */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      {/* Channel Badge */}
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${channelMeta.badgeBg} ${channelMeta.badgeText} ${channelMeta.borderClass}`}
                      >
                        {isVF ? <Zap className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        <span>{channelMeta.shortLabel}</span>
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>

                      {/* Aging Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${aging.badgeClass}`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {aging.label}
                      </span>

                      {deal.reminderCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {deal.reminderCount} recordatorio(s)
                        </span>
                      )}
                    </div>

                    {/* Deal ID and Customer info */}
                    <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
                      <span className="font-mono text-base font-extrabold text-cyan-400">
                        {deal.dealId}
                      </span>
                      <span className="text-sm font-bold text-white flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 inline" />
                        <span>{deal.partnerName}</span>
                      </span>
                      <span className="text-xs text-slate-400">
                        → Cliente: <strong className="text-slate-200">{deal.endCustomerName}</strong>
                      </span>
                    </div>

                    {/* Secondary details */}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {deal.amContactName && (
                        <span>
                          AM Asignado: <strong className="text-indigo-300">{deal.amContactName}</strong>
                        </span>
                      )}
                      {deal.vfTicketNumber && (
                        <span>
                          Caso VF: <strong className="text-cyan-300 font-mono">{deal.vfTicketNumber}</strong>
                        </span>
                      )}
                      {deal.targetDiscountPct && (
                        <span>
                          Desc. Solicitado: <strong className="text-emerald-400">{deal.targetDiscountPct}%</strong>
                        </span>
                      )}
                      {deal.estimatedTotalUsd && deal.estimatedTotalUsd > 0 && (
                        <span>
                          Monto: <strong className="text-slate-200 font-mono">${deal.estimatedTotalUsd.toLocaleString('en-US')} USD</strong>
                        </span>
                      )}
                      {deal.lastReminderSentAt && (
                        <span className="text-slate-500">
                          Último recordatorio: {new Date(deal.lastReminderSentAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}{' '}
                          ({new Date(deal.lastReminderSentAt).toLocaleDateString('es-CL')})
                        </span>
                      )}
                    </div>

                    {deal.notes && (
                      <p className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-1.5 italic max-w-3xl">
                        "{deal.notes}"
                      </p>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center flex-wrap gap-2 shrink-0 self-start lg:self-center">
                    {/* Botón Principal: Copiar Recordatorio Correo Outlook */}
                    <button
                      onClick={() => handleCopyEmailReminder(deal)}
                      className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-emerald-600/40 scale-105'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                      }`}
                      title="Copiar correo formal con saludo según hora para Outlook"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      <span>{isCopied ? '¡Copiado para Outlook!' : 'Copiar Correo Recordatorio'}</span>
                    </button>

                    {/* Botón Convertir a Seguimiento BO */}
                    {onConvertToBo && (
                      <button
                        onClick={() => onConvertToBo(deal)}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-700/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Crear seguimiento en Tracking BO con estos datos"
                      >
                        <Package className="w-3.5 h-3.5 text-purple-400" />
                        <span>Pasar a BO</span>
                      </button>
                    )}

                    {/* Selector de Estado Rápido */}
                    <select
                      value={deal.status}
                      onChange={(e) => handleStatusChange(deal, e.target.value as DealReminderStatus)}
                      className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="PENDING_APPROVAL">🟡 En Espera</option>
                      <option value="APPROVED">🟢 Aprobado por Cisco</option>
                      <option value="INFO_REQUIRED">🔵 Requiere Info</option>
                      <option value="REJECTED">🔴 Rechazado</option>
                      <option value="CONVERTED_TO_BO">🟣 Con OC (BO)</option>
                    </select>

                    {/* Bitácora / Notas */}
                    <button
                      onClick={() => setSelectedDealForNotes(deal)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all cursor-pointer relative"
                      title="Ver bitácora y agregar notas"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {(deal.history?.length || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                          {deal.history.length}
                        </span>
                      )}
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => handleDeleteDeal(deal.id)}
                      className="p-2 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/50 rounded-xl transition-all cursor-pointer"
                      title="Eliminar este recordatorio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Registrar Nuevo Recordatorio de Deal */}
      {isNewDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Nuevo Recordatorio de Deal</h3>
                  <p className="text-xs text-slate-400">Ingresa los 4 datos clave para iniciar el seguimiento</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewDealModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewDeal} className="space-y-4">
              {/* Canal de Escalamiento (1 de las 4 cosas pedidas) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  1. Canal de Escalamiento <span className="text-indigo-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormEscalationChannel('AM_CISCO')}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                      formEscalationChannel === 'AM_CISCO'
                        ? 'bg-indigo-950/70 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">AM Cisco</div>
                      <div className="text-[10px] text-slate-400">Account Manager</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormEscalationChannel('VELOCITY_HUB')}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                      formEscalationChannel === 'VELOCITY_HUB'
                        ? 'bg-cyan-950/70 border-cyan-500 text-white ring-2 ring-cyan-500/40 shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="p-2 bg-cyan-600/20 rounded-xl text-cyan-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Velocity Hub (VF)</div>
                      <div className="text-[10px] text-slate-400">Cisco Express Portal</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Deal ID (2 de 4) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Número o ID del Deal <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. DEAL-9988221 o 981245"
                  value={formDealId}
                  onChange={(e) => setFormDealId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Partner Name (3 de 4) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Nombre del Partner / Reseller <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sonda Chile, Telefónica Tech, Adexus..."
                  value={formPartnerName}
                  onChange={(e) => setFormPartnerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Cliente Final (4 de 4) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  4. Nombre del Cliente Final <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Banco Santander, Codelco, Entel..."
                  value={formEndCustomerName}
                  onChange={(e) => setFormEndCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Toggle Campos Opcionales */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <span>{showOptionalFields ? '− Ocultar detalles adicionales' : '+ Agregar detalles opcionales (Contacto, % descuento, notas)'}</span>
                </button>
              </div>

              {/* Campos Opcionales Expandibles */}
              {showOptionalFields && (
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3 animate-fade-in">
                  {formEscalationChannel === 'AM_CISCO' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Nombre del AM Cisco
                        </label>
                        <input
                          type="text"
                          placeholder="ej. Rodrigo Alarcón"
                          value={formAmContactName}
                          onChange={(e) => setFormAmContactName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Email del AM Cisco
                        </label>
                        <input
                          type="email"
                          placeholder="ej. am@cisco.com"
                          value={formAmContactEmail}
                          onChange={(e) => setFormAmContactEmail(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Número de Caso / Ticket VF (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="ej. VF-782910"
                        value={formVfTicketNumber}
                        onChange={(e) => setFormVfTicketNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Descuento Solicitado (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="ej. 68.5"
                        value={formTargetDiscountPct}
                        onChange={(e) => setFormTargetDiscountPct(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Monto Estimado Solución (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="ej. 45000"
                        value={formEstimatedTotalUsd}
                        onChange={(e) => setFormEstimatedTotalUsd(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Notas / Justificación Comercial
                    </label>
                    <textarea
                      rows={2}
                      placeholder="ej. Licitación pública, competencia con Fortinet, solicitud de aprobación DART..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              {/* Botones Guardar / Cancelar */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewDealModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Guardar y Activar Recordatorio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bitácora de Historial y Notas del Deal */}
      {selectedDealForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span>Bitácora de Seguimiento</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Deal: <strong className="text-cyan-400">{selectedDealForNotes.dealId}</strong> • {selectedDealForNotes.partnerName}
                </p>
              </div>
              <button
                onClick={() => setSelectedDealForNotes(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Lista de notas anteriores */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mb-4 custom-scrollbar">
              {(selectedDealForNotes.history || []).length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">
                  No hay notas registradas para este Deal aún.
                </p>
              ) : (
                selectedDealForNotes.history.map((hist) => (
                  <div key={hist.id} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-indigo-300">{hist.author}</span>
                      <span>{new Date(hist.date).toLocaleString('es-CL')}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{hist.comment}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input para agregar nueva nota */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                Agregar Nota / Comentario de Seguimiento:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="ej. AM comentó que revisará el Deal hoy a las 16:00..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Nota</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
