// ============================================================================
// CISCO AUTOMATED v2.1 - BO ORDER TRACKING VIEW (KANBAN & TABLE LIFECYCLE)
// Tablero interactivo para el ciclo de vida logístico de Back Orders Cisco
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Package,
  Calendar,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  FileSpreadsheet,
  Building2,
  ChevronRight,
  X,
  Layers,
  MapPin,
  ShieldCheck,
  Send,
  Edit2,
  Trash2,
  Bell,
} from 'lucide-react';
import {
  BoOrderTrackingRecord,
  BoStage,
  CourierProvider,
  BO_STAGES_METADATA,
  ORDERED_BO_STAGES,
  getOrderHealthStatus,
  getCourierTrackingUrl,
} from './boTrackingTypes';
import {
  getBoTrackings,
  saveBoTracking,
  updateBoTrackingStage,
  updateBoTrackingCourier,
  addBoDailyNote,
  deleteBoTracking,
  createBoTrackingRecordFromEstimate,
} from './boTrackingService';
import { DealReminderView } from './DealReminderView';
import { DealReminderRecord } from './dealReminderTypes';
import { useCiscoAutomatedStore } from '../../core/store';

export function BoTrackingView() {
  const { currentUser, processedResult, detectedPartner } = useCiscoAutomatedStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'deal_reminders'>('orders');
  const [orders, setOrders] = useState<BoOrderTrackingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);

  // Modales
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<BoOrderTrackingRecord | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<BoOrderTrackingRecord | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // Formulario nueva orden
  const [newOrderForm, setNewOrderForm] = useState({
    estimateId: '',
    versionTag: 'v1',
    dealId: '',
    partnerName: '',
    endCustomerName: '',
    clientPoNumber: '',
    ciscoSoNumber: '',
    courier: 'FedEx' as CourierProvider,
    courierTrackingNumber: '',
    estimatedShipDate: '',
    estimatedArrivalDate: '',
    totalSaleUsd: 0,
    grossProfitUsd: 0,
    bodegaDestino: 'E1' as 'E1' | 'ED',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const records = await getBoTrackings();
      setOrders(records);
    } catch (err) {
      console.error('Error cargando órdenes BO:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Prellenar formulario de nueva orden si hay estimate cargado
  useEffect(() => {
    if (processedResult && isNewOrderModalOpen) {
      const header = processedResult.headerInfo || ({} as any);
      setNewOrderForm({
        estimateId: header.estimateId || header.quoteName || '',
        versionTag: processedResult.versionTag || 'v1',
        dealId: header.dealId || '',
        partnerName: detectedPartner || header.customerName || '',
        endCustomerName: header.companyName || header.endUser || '',
        clientPoNumber: '',
        ciscoSoNumber: '',
        courier: 'FedEx',
        courierTrackingNumber: '',
        estimatedShipDate: '',
        estimatedArrivalDate: '',
        totalSaleUsd: processedResult.calculatedProductTotal || 0,
        grossProfitUsd: Math.max(0, (processedResult.calculatedProductTotal || 0) - (processedResult.originalProductTotal || 0)),
        bodegaDestino: 'E1',
      });
    }
  }, [processedResult, isNewOrderModalOpen, detectedPartner]);

  // Filtrado de órdenes
  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return orders.filter((o) => {
      // Filtro de texto
      const matchesSearch =
        !q ||
        o.estimateId.toLowerCase().includes(q) ||
        o.dealId.toLowerCase().includes(q) ||
        o.partnerName.toLowerCase().includes(q) ||
        o.endCustomerName.toLowerCase().includes(q) ||
        o.clientPoNumber.toLowerCase().includes(q) ||
        (o.ciscoSoNumber && o.ciscoSoNumber.toLowerCase().includes(q)) ||
        (o.courierTrackingNumber && o.courierTrackingNumber.toLowerCase().includes(q));

      // Filtro de etapa
      const matchesStage = stageFilter === 'ALL' || o.currentStage === stageFilter;

      // Filtro de atención
      if (onlyNeedsAttention) {
        const health = getOrderHealthStatus(o);
        if (health.status === 'up_to_date') return false;
      }

      return matchesSearch && matchesStage;
    });
  }, [orders, searchTerm, stageFilter, onlyNeedsAttention]);

  // Estadísticas KPI
  const stats = useMemo(() => {
    const active = orders.filter((o) => o.currentStage !== 'DELIVERED');
    const inCourier = orders.filter((o) => o.currentStage === 'SHIPPED_COURIER');
    const inMiami = orders.filter((o) => o.currentStage === 'MIAMI_FORWARDER');
    const inCustoms = orders.filter((o) => o.currentStage === 'CUSTOMS_CLEARANCE');
    const inWarehouse = orders.filter((o) => o.currentStage === 'INTCOMEX_WAREHOUSE');
    const totalPipelineUsd = active.reduce((acc, o) => acc + (o.totalSaleUsd || 0), 0);
    const delayedCount = active.filter((o) => getOrderHealthStatus(o).status === 'delayed').length;
    const needsReviewCount = active.filter((o) => getOrderHealthStatus(o).status === 'needs_review').length;

    return {
      activeCount: active.length,
      inCourierCount: inCourier.length,
      inMiamiCount: inMiami.length,
      inCustomsCount: inCustoms.length,
      inWarehouseCount: inWarehouse.length,
      totalPipelineUsd,
      delayedCount,
      needsReviewCount,
    };
  }, [orders]);

  // Handlers para avanzar / retroceder etapa
  const handleMoveStage = async (order: BoOrderTrackingRecord, direction: 'next' | 'prev') => {
    const currentIdx = ORDERED_BO_STAGES.indexOf(order.currentStage);
    if (currentIdx < 0) return;

    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= ORDERED_BO_STAGES.length) return;

    const nextStage = ORDERED_BO_STAGES[nextIdx];
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    const noteText = `Etapa cambiada a: ${BO_STAGES_METADATA[nextStage].title}`;

    await updateBoTrackingStage(order.id, nextStage, author, noteText);
    await loadData();
  };

  // Handler para agregar nota a bitácora
  const handleAddNote = async () => {
    if (!selectedOrderForNotes || !newNoteText.trim()) return;
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';
    await addBoDailyNote(selectedOrderForNotes.id, author, newNoteText.trim());
    setNewNoteText('');
    await loadData();
    // Actualizar referencia seleccionada
    const refreshed = (await getBoTrackings()).find((o) => o.id === selectedOrderForNotes.id);
    if (refreshed) setSelectedOrderForNotes(refreshed);
  };

  // Handler para guardar edición logística
  const handleSaveEdit = async () => {
    if (!selectedOrderForEdit) return;
    await saveBoTracking(selectedOrderForEdit);
    setSelectedOrderForEdit(null);
    await loadData();
  };

  // Handler para eliminar orden
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este seguimiento de orden BO?')) return;
    await deleteBoTracking(orderId);
    await loadData();
  };

  // Handler para crear nueva orden desde formulario
  const handleCreateNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.clientPoNumber.trim()) {
      alert('Debes ingresar el número de Orden de Compra (OC) del cliente');
      return;
    }

    const cleanPo = newOrderForm.clientPoNumber.trim();
    const estId = (newOrderForm.estimateId || 'OE-MANUAL').trim();
    const trackingId = `BO-${cleanPo.replace(/[^A-Za-z0-9_-]/g, '')}-${estId}`;
    const nowIso = new Date().toISOString();
    const author = currentUser?.full_name || currentUser?.username || 'Usuario';

    const newRecord: BoOrderTrackingRecord = {
      id: trackingId,
      estimateId: estId,
      estimateVersionTag: newOrderForm.versionTag || 'v1',
      dealId: (newOrderForm.dealId || 'DEAL-MANUAL').trim(),
      partnerName: newOrderForm.partnerName.trim() || 'Partner Intcomex',
      endCustomerName: newOrderForm.endCustomerName.trim() || 'Cliente Final',
      clientPoNumber: cleanPo,
      ciscoSoNumber: newOrderForm.ciscoSoNumber.trim() || undefined,
      courier: newOrderForm.courier,
      courierTrackingNumber: newOrderForm.courierTrackingNumber.trim() || undefined,
      courierTrackingUrl: getCourierTrackingUrl(newOrderForm.courier, newOrderForm.courierTrackingNumber.trim()),
      currentStage: 'OC_RECEIVED',
      estimatedShipDate: newOrderForm.estimatedShipDate || undefined,
      estimatedArrivalDate: newOrderForm.estimatedArrivalDate || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastDailyReviewAt: nowIso,
      totalSaleUsd: Number(newOrderForm.totalSaleUsd) || 0,
      grossProfitUsd: Number(newOrderForm.grossProfitUsd) || 0,
      marginPct:
        Number(newOrderForm.totalSaleUsd) > 0
          ? Number(((Number(newOrderForm.grossProfitUsd) / Number(newOrderForm.totalSaleUsd)) * 100).toFixed(1))
          : 0,
      itemsCount: 1,
      bodegaDestino: newOrderForm.bodegaDestino,
      notes: [
        {
          id: `note-${Date.now()}`,
          date: nowIso,
          author,
          stage: 'OC_RECEIVED',
          comment: `Orden registrada manualmente en el portal con OC ${cleanPo}.`,
        },
      ],
    };

    await saveBoTracking(newRecord);
    setIsNewOrderModalOpen(false);
    await loadData();
  };

  // Exportar a CSV con BOM UTF-8
  const handleExportCsv = () => {
    if (orders.length === 0) return;

    const headers = [
      'ID Seguimiento',
      'Estimate ID',
      'Versión',
      'Deal ID',
      'Partner / Reseller',
      'Cliente Final',
      'OC Cliente',
      'SO Cisco',
      'Etapa Actual',
      'Courier',
      'Guía Tracking',
      'Link Tracking',
      'Total Venta USD',
      'Margen USD',
      'Bodega Destino',
      'ESD Cisco',
      'ETA Chile',
      'Última Actualización',
    ];

    const rows = orders.map((o) => [
      `"${o.id}"`,
      `"${o.estimateId}"`,
      `"${o.estimateVersionTag}"`,
      `"${o.dealId}"`,
      `"${o.partnerName.replace(/"/g, '""')}"`,
      `"${o.endCustomerName.replace(/"/g, '""')}"`,
      `"${o.clientPoNumber}"`,
      `"${o.ciscoSoNumber || ''}"`,
      `"${BO_STAGES_METADATA[o.currentStage].title}"`,
      `"${o.courier}"`,
      `"${o.courierTrackingNumber || ''}"`,
      `"${o.courierTrackingUrl || ''}"`,
      o.totalSaleUsd.toFixed(2),
      o.grossProfitUsd.toFixed(2),
      `"${o.bodegaDestino || 'E1'}"`,
      `"${o.estimatedShipDate || ''}"`,
      `"${o.estimatedArrivalDate || ''}"`,
      `"${o.updatedAt.slice(0, 10)}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Tracking_BO_Intcomex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Module Subnav Tabs: Logística BO vs Recordador de Deals */}
      <div className="bg-slate-950/95 border-b border-slate-800 px-6 pt-3 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 rounded-t-xl'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Seguimiento Logístico de Órdenes BO</span>
            {stats.activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/50">
                {stats.activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('deal_reminders')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'deal_reminders'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 rounded-t-xl'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Recordador & Notificador de DEALS (AM / VF)</span>
          </button>
        </div>
      </div>

      {activeTab === 'deal_reminders' ? (
        <DealReminderView
          onConvertToBo={(deal: DealReminderRecord) => {
            setNewOrderForm((prev) => ({
              ...prev,
              dealId: deal.dealId,
              partnerName: deal.partnerName,
              endCustomerName: deal.endCustomerName,
              estimateId: deal.estimateId || prev.estimateId,
              totalSaleUsd: deal.estimatedTotalUsd || prev.totalSaleUsd,
            }));
            setActiveTab('orders');
            setIsNewOrderModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Header Section */}
          <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-5 sticky top-[45px] z-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h1 className="text-xl font-black tracking-tight text-white">
                        Tracking & Ciclo de Vida de Órdenes BO
                      </h1>
                  <span className="bg-amber-950/80 text-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-700/50">
                    Fulfillment Pipeline
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitoreo logístico diario desde la OC de cliente hasta la entrega física en Bodega Intcomex ENEA
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Orden BO</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={orders.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Descargar informe completo en Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar Reporte</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all cursor-pointer"
              title="Sincronizar y recargar órdenes"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Toggle View Mode (Kanban vs Table) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tabla
              </button>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
              Órdenes Activas
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-white">{stats.activeCount}</span>
              <span className="text-[11px] text-slate-400">pedidos</span>
            </div>
          </div>

          <div className="bg-purple-950/20 border border-purple-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-purple-400/80 tracking-wider block">
              En Courier / FedEx
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-purple-300">{stats.inCourierCount}</span>
              <span className="text-[11px] text-purple-400/70">con guía</span>
            </div>
          </div>

          <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-cyan-400/80 tracking-wider block">
              Hub Miami
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-cyan-300">{stats.inMiamiCount}</span>
              <span className="text-[11px] text-cyan-400/70">consolidando</span>
            </div>
          </div>

          <div className="bg-orange-950/20 border border-orange-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-orange-400/80 tracking-wider block">
              Aduana Chile
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-orange-300">{stats.inCustomsCount}</span>
              <span className="text-[11px] text-orange-400/70">internando</span>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider block">
              Bodega ENEA
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-black text-emerald-300">{stats.inWarehouseCount}</span>
              <span className="text-[11px] text-emerald-400/70">por despachar</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-amber-400/80 tracking-wider block">
              Pipeline Total
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-lg font-black text-amber-300">
                ${stats.totalPipelineUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-slate-400">USD</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center flex-1 space-x-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Estimate, Deal ID, Partner, OC o Guía FedEx..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todas las Etapas</option>
              {ORDERED_BO_STAGES.map((st) => (
                <option key={st} value={st}>
                  {BO_STAGES_METADATA[st].stepNumber}. {BO_STAGES_METADATA[st].shortLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setOnlyNeedsAttention(!onlyNeedsAttention)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                onlyNeedsAttention
                  ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-md shadow-amber-950/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Requiere Atención</span>
              {(stats.delayedCount > 0 || stats.needsReviewCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 max-w-md mx-auto">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No se encontraron órdenes BO</h3>
            <p className="text-xs text-slate-400 mb-4">
              {searchTerm || stageFilter !== 'ALL' || onlyNeedsAttention
                ? 'Prueba modificando tus filtros o término de búsqueda.'
                : 'Registra tu primera orden para monitorear el flujo hacia bodega.'}
            </p>
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Orden BO</span>
            </button>
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board View */
          <div className="flex gap-4 overflow-x-auto pb-6">
            {ORDERED_BO_STAGES.map((stageKey) => {
              const meta = BO_STAGES_METADATA[stageKey];
              const columnOrders = filteredOrders.filter((o) => o.currentStage === stageKey);

              return (
                <div
                  key={stageKey}
                  className="w-80 shrink-0 flex flex-col bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3 shadow-md"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center border border-slate-700">
                        {meta.stepNumber}
                      </span>
                      <h3 className="text-xs font-black text-white tracking-wide uppercase">
                        {meta.shortLabel}
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {columnOrders.length}
                    </span>
                  </div>

                  {/* Cards in Column */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                    {columnOrders.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-center text-[11px] text-slate-600">
                        Sin órdenes en esta etapa
                      </div>
                    ) : (
                      columnOrders.map((order) => {
                        const health = getOrderHealthStatus(order);
                        const isDelivered = order.currentStage === 'DELIVERED';
                        const currentStageIdx = ORDERED_BO_STAGES.indexOf(order.currentStage);

                        return (
                          <div
                            key={order.id}
                            className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-xl p-3.5 shadow-sm transition-all group relative"
                          >
                            {/* Card Top: Health Badge & Version */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${health.badgeClass}`}
                              >
                                {health.label}
                              </span>
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/40">
                                {order.estimateVersionTag || 'v1'}
                              </span>
                            </div>

                            {/* Estimate & Deal IDs */}
                            <div className="mb-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-black text-amber-400">
                                  {order.estimateId}
                                </span>
                                <span className="font-mono text-[11px] text-indigo-300">
                                  {order.dealId}
                                </span>
                              </div>
                              <div className="text-[11px] text-white font-bold truncate mt-0.5">
                                {order.endCustomerName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {order.partnerName}
                              </div>
                            </div>

                            {/* OC / SO Numbers */}
                            <div className="bg-slate-900/80 rounded-lg p-2 text-[10px] space-y-1 mb-2.5 border border-slate-800/60">
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">OC Cliente:</span>
                                <span className="font-mono font-bold text-slate-200">{order.clientPoNumber}</span>
                              </div>
                              {order.ciscoSoNumber && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500 font-semibold">SO Cisco:</span>
                                  <span className="font-mono font-bold text-blue-400">{order.ciscoSoNumber}</span>
                                </div>
                              )}
                            </div>

                            {/* Courier / FedEx Tracking Direct Button */}
                            {order.courierTrackingNumber ? (
                              <div className="mb-2.5">
                                <a
                                  href={order.courierTrackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full inline-flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 border border-purple-700/50 rounded-lg text-[10px] font-bold transition-colors"
                                  title="Ver seguimiento en tiempo real en la web del courier"
                                >
                                  <Truck className="w-3 h-3 text-purple-400" />
                                  <span>{order.courier}: {order.courierTrackingNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-purple-400 ml-0.5" />
                                </a>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedOrderForEdit(order)}
                                className="w-full mb-2.5 text-center py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 border border-dashed border-slate-800 rounded-lg hover:border-slate-700 transition-colors cursor-pointer"
                              >
                                + Asignar Guía FedEx
                              </button>
                            )}

                            {/* Financial Summary & Bodega */}
                            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80 mb-3">
                              <div>
                                <span className="text-[9px] text-slate-500 block uppercase font-bold">Venta Total</span>
                                <span className="font-mono font-black text-emerald-400">
                                  ${order.totalSaleUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-slate-500 block uppercase font-bold">Bodega</span>
                                <span className="font-bold text-slate-300">
                                  {order.bodegaDestino === 'ED' ? 'ED (Intangible)' : 'E1 (Físico)'}
                                </span>
                              </div>
                            </div>

                            {/* Actions Toolbar */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => setSelectedOrderForNotes(order)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer relative"
                                  title="Ver bitácora y notas diarias"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  {order.notes && order.notes.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                                      {order.notes.length}
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={() => setSelectedOrderForEdit(order)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                                  title="Editar datos logísticos"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg text-xs transition-colors cursor-pointer"
                                  title="Eliminar orden"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Stage Navigator (Prev / Next) */}
                              <div className="flex items-center space-x-1">
                                {currentStageIdx > 0 && (
                                  <button
                                    onClick={() => handleMoveStage(order, 'prev')}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                    title="Retroceder etapa"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!isDelivered && (
                                  <button
                                    onClick={() => handleMoveStage(order, 'next')}
                                    className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-md shadow-amber-950/20"
                                    title="Avanzar a siguiente etapa"
                                  >
                                    <span>Avanzar</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Salud</th>
                    <th className="py-3.5 px-4">Estimate / Deal</th>
                    <th className="py-3.5 px-4">Partner & Cliente</th>
                    <th className="py-3.5 px-4">OC / SO Cisco</th>
                    <th className="py-3.5 px-4">Etapa Actual</th>
                    <th className="py-3.5 px-4">Courier / Tracking</th>
                    <th className="py-3.5 px-4 text-right">Venta Total</th>
                    <th className="py-3.5 px-4">Bodega</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredOrders.map((order) => {
                    const health = getOrderHealthStatus(order);
                    const meta = BO_STAGES_METADATA[order.currentStage];

                    return (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${health.badgeClass}`}>
                            {health.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-amber-400">{order.estimateId}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                              {order.estimateVersionTag || 'v1'}
                            </span>
                          </div>
                          <span className="text-[11px] text-indigo-300 font-mono block">{order.dealId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{order.endCustomerName}</span>
                          <span className="text-slate-400 text-[11px] block">{order.partnerName}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div>
                            <span className="text-slate-500 text-[10px]">OC: </span>
                            <span className="font-bold text-slate-200">{order.clientPoNumber}</span>
                          </div>
                          {order.ciscoSoNumber && (
                            <div>
                              <span className="text-slate-500 text-[10px]">SO: </span>
                              <span className="font-bold text-blue-400">{order.ciscoSoNumber}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.badgeBg} ${meta.badgeText}`}>
                            {meta.stepNumber}. {meta.shortLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {order.courierTrackingNumber ? (
                            <a
                              href={order.courierTrackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-purple-300 hover:text-purple-200 font-mono font-bold"
                            >
                              <span>{order.courier}: {order.courierTrackingNumber}</span>
                              <ExternalLink className="w-3 h-3 text-purple-400" />
                            </a>
                          ) : (
                            <button
                              onClick={() => setSelectedOrderForEdit(order)}
                              className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
                            >
                              Asignar FedEx
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          ${order.totalSaleUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-300">
                          {order.bodegaDestino === 'ED' ? 'ED' : 'E1'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setSelectedOrderForNotes(order)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer relative"
                              title="Bitácora"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {order.notes && order.notes.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                                  {order.notes.length}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => setSelectedOrderForEdit(order)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg text-xs cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )}

      {/* MODAL 1: Bitácora y Notas Diarias */}
      {selectedOrderForNotes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-scale">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2.5">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Bitácora Diaria: {selectedOrderForNotes.estimateId} ({selectedOrderForNotes.estimateVersionTag})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    OC {selectedOrderForNotes.clientPoNumber} &bull; {selectedOrderForNotes.endCustomerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Notes */}
            <div className="p-5 max-h-80 overflow-y-auto space-y-3">
              {(!selectedOrderForNotes.notes || selectedOrderForNotes.notes.length === 0) ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No hay notas registradas aún. Agrega la primera actualización a continuación.
                </div>
              ) : (
                selectedOrderForNotes.notes.map((note) => {
                  const meta = BO_STAGES_METADATA[note.stage] || BO_STAGES_METADATA.OC_RECEIVED;
                  const dateFormatted = new Date(note.date).toLocaleString('es-CL', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <div key={note.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{note.author}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${meta.badgeBg} ${meta.badgeText}`}>
                            {meta.shortLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">{dateFormatted}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{note.comment}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Note Form */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote();
                }}
                placeholder="Escribe una actualización diaria (ej. Cisco confirmó despacho para el jueves)..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edición de Datos Logísticos */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2.5">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Editar Datos Logísticos</h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedOrderForEdit.estimateId} &bull; OC {selectedOrderForEdit.clientPoNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForEdit(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Cisco Sales Order (SO)</label>
                  <input
                    type="text"
                    value={selectedOrderForEdit.ciscoSoNumber || ''}
                    onChange={(e) =>
                      setSelectedOrderForEdit({ ...selectedOrderForEdit, ciscoSoNumber: e.target.value })
                    }
                    placeholder="ej. SO-10928371"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Bodega Asignada</label>
                  <select
                    value={selectedOrderForEdit.bodegaDestino || 'E1'}
                    onChange={(e) =>
                      setSelectedOrderForEdit({
                        ...selectedOrderForEdit,
                        bodegaDestino: e.target.value as 'E1' | 'ED',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="E1">E1 (Físico / Hardware)</option>
                    <option value="ED">ED (Intangible / Servicios)</option>
                  </select>
                </div>
              </div>

              {/* Courier y Tracking */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Courier</label>
                  <select
                    value={selectedOrderForEdit.courier}
                    onChange={(e) =>
                      setSelectedOrderForEdit({
                        ...selectedOrderForEdit,
                        courier: e.target.value as CourierProvider,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="FedEx">FedEx Express</option>
                    <option value="UPS">UPS</option>
                    <option value="DHL">DHL Express</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Número de Guía (Tracking)
                  </label>
                  <input
                    type="text"
                    value={selectedOrderForEdit.courierTrackingNumber || ''}
                    onChange={(e) =>
                      setSelectedOrderForEdit({
                        ...selectedOrderForEdit,
                        courierTrackingNumber: e.target.value,
                        courierTrackingUrl: getCourierTrackingUrl(selectedOrderForEdit.courier, e.target.value),
                      })
                    }
                    placeholder="ej. 771234567890"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Fecha Embarque Cisco (ESD)
                  </label>
                  <input
                    type="date"
                    value={selectedOrderForEdit.estimatedShipDate || ''}
                    onChange={(e) =>
                      setSelectedOrderForEdit({
                        ...selectedOrderForEdit,
                        estimatedShipDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Fecha Estimada en Chile (ETA)
                  </label>
                  <input
                    type="date"
                    value={selectedOrderForEdit.estimatedArrivalDate || ''}
                    onChange={(e) =>
                      setSelectedOrderForEdit({
                        ...selectedOrderForEdit,
                        estimatedArrivalDate: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedOrderForEdit(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Nueva Orden BO */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-2.5">
                <Truck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Registrar Nueva Orden en Tracking BO</h3>
                  <p className="text-[11px] text-slate-400">
                    Inicia el seguimiento de una cotización cuando el cliente emite la OC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewOrder} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Número de Estimate Cisco *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.estimateId}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, estimateId: e.target.value })}
                    placeholder="ej. OE169047114NP"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Versión del Estimate</label>
                  <input
                    type="text"
                    value={newOrderForm.versionTag}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, versionTag: e.target.value })}
                    placeholder="v1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    OC Cliente (Orden de Compra) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.clientPoNumber}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, clientPoNumber: e.target.value })}
                    placeholder="ej. OC-99120"
                    className="w-full bg-slate-950 border border-amber-600/60 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Deal ID Cisco</label>
                  <input
                    type="text"
                    value={newOrderForm.dealId}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, dealId: e.target.value })}
                    placeholder="ej. DEAL-88992"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Partner / Reseller</label>
                  <input
                    type="text"
                    value={newOrderForm.partnerName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, partnerName: e.target.value })}
                    placeholder="ej. Sonda Chile"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Cliente Final</label>
                  <input
                    type="text"
                    value={newOrderForm.endCustomerName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, endCustomerName: e.target.value })}
                    placeholder="ej. Banco Santander"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Courier</label>
                  <select
                    value={newOrderForm.courier}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, courier: e.target.value as CourierProvider })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="DHL">DHL</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Tracking Courier (Opcional)</label>
                  <input
                    type="text"
                    value={newOrderForm.courierTrackingNumber}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, courierTrackingNumber: e.target.value })
                    }
                    placeholder="ej. 771234567890"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Total Venta USD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOrderForm.totalSaleUsd || ''}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, totalSaleUsd: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Bodega Destino</label>
                  <select
                    value={newOrderForm.bodegaDestino}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, bodegaDestino: e.target.value as 'E1' | 'ED' })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="E1">E1 (Físico / Hardware)</option>
                    <option value="ED">ED (Intangible / Servicios)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 -mx-5 -mb-5 mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  Iniciar Seguimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
