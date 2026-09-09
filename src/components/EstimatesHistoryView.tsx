// ============================================================================
// CISCO AUTOMATED v2.1 - SHARED HISTORY & CLOUD DASHBOARD (FIREBASE FIRESTORE)
// Fetch-on-Demand (NO onSnapshot) with 100% Offline Local Failsafe
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  CloudEstimateRecord,
  CloudDsvRecord,
  getCloudEstimates,
  getCloudDsvs,
  deleteCloudEstimate,
  deleteCloudDsv,
  FirebaseConfigModal,
} from '../modules/cloud';
import { useCiscoAutomatedStore } from '../core/store';
import {
  History,
  Search,
  Download,
  RefreshCw,
  Archive,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  FileCheck,
  Cloud,
  CloudRain,
  UploadCloud,
  ArrowRight,
  Eye,
  Trash2,
  DollarSign,
  TrendingUp,
  Sparkles,
  Layers,
  Tag,
  ShieldCheck,
  User,
  X,
  Settings,
  Database,
} from 'lucide-react';

export function EstimatesHistoryView() {
  const { loadCloudEstimateIntoStore, currentUser } = useCiscoAutomatedStore();

  // Active Tab: 'estimates' | 'dsv'
  const [activeTab, setActiveTab] = useState<'estimates' | 'dsv'>('estimates');

  // Cloud datasets
  const [estimates, setEstimates] = useState<CloudEstimateRecord[]>([]);
  const [dsvRecords, setDsvRecords] = useState<CloudDsvRecord[]>([]);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [cloudStatusNote, setCloudStatusNote] = useState<string | null>(null);

  // Detail Modal State
  const [selectedEstimateDetail, setSelectedEstimateDetail] = useState<CloudEstimateRecord | null>(null);
  const [selectedDsvDetail, setSelectedDsvDetail] = useState<CloudDsvRecord | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // Fetch on demand function
  const fetchAllHistory = async (isManualRefresh: boolean = false) => {
    setIsLoading(true);
    setCloudStatusNote(null);

    try {
      const [estRes, dsvRes] = await Promise.all([
        getCloudEstimates(100),
        getCloudDsvs(100),
      ]);

      if (estRes.success && estRes.data) {
        setEstimates(estRes.data);
      }
      if (dsvRes.success && dsvRes.data) {
        setDsvRecords(dsvRes.data);
      }

      if (estRes.error || dsvRes.error) {
        setCloudStatusNote(estRes.error || dsvRes.error || 'Modo local activo');
      }

      if (isManualRefresh) {
        setToastMessage({ text: 'Historial actualizado desde la nube.', type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e: any) {
      console.error('Error fetching history:', e);
      setCloudStatusNote('Conectando a almacenamiento local');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllHistory(false);
  }, []);

  // Format Currency
  const fmtCurrency = (amount?: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    return (
      '$' +
      amount.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Distinct Months for Filter
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    estimates.forEach((e) => {
      if (e.createdAt) {
        monthsSet.add(e.createdAt.substring(0, 7)); // YYYY-MM
      }
    });
    dsvRecords.forEach((d) => {
      if (d.createdAt) {
        monthsSet.add(d.createdAt.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [estimates, dsvRecords]);

  // Filtered Estimates
  const filteredEstimates = useMemo(() => {
    return estimates.filter((e) => {
      const matchesSearch =
        (e.estimateId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.dealId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.partnerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.clientFinalName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.creator?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.creator?.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.originalFileName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMonth =
        selectedMonth === 'all' ||
        (e.createdAt && e.createdAt.startsWith(selectedMonth));

      return matchesSearch && matchesMonth;
    });
  }, [estimates, searchTerm, selectedMonth]);

  // Filtered DSVs
  const filteredDsvs = useMemo(() => {
    return dsvRecords.filter((d) => {
      const matchesSearch =
        (d.dealId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.soNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.resellerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.endCustomerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.creator?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.creator?.username || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMonth =
        selectedMonth === 'all' ||
        (d.createdAt && d.createdAt.startsWith(selectedMonth));

      return matchesSearch && matchesMonth;
    });
  }, [dsvRecords, searchTerm, selectedMonth]);

  // Handle Load into Quoter
  const handleLoadEstimate = (est: CloudEstimateRecord) => {
    loadCloudEstimateIntoStore(est);
  };

  // Handle Delete
  const handleDeleteEstimate = async (docId?: string) => {
    if (!docId) return;
    if (window.confirm('¿Está seguro de eliminar esta cotización del historial compartido?')) {
      const res = await deleteCloudEstimate(docId);
      if (res.success) {
        setEstimates((prev) => prev.filter((x) => x.id !== docId));
        setToastMessage({ text: 'Cotización eliminada del historial.', type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  const handleDeleteDsv = async (docId?: string) => {
    if (!docId) return;
    if (window.confirm('¿Está seguro de eliminar este registro DSV del historial compartido?')) {
      const res = await deleteCloudDsv(docId);
      if (res.success) {
        setDsvRecords((prev) => prev.filter((x) => x.id !== docId));
        setToastMessage({ text: 'Registro DSV eliminado del historial.', type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center space-x-2.5 animate-slide-up border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400/40'
              : 'bg-rose-600 text-white border-rose-400/40'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-black text-white tracking-tight">
                Historial Compartido & Cloud Storage
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/40">
                Firestore NoSQL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registro centralizado de cotizaciones CCW y órdenes DSV generadas por todo el equipo.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setIsFirebaseModalOpen(true)}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Vincular con tu cuenta de Google Console (abs0lu7iontr@gmail.com)"
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Configurar Conexión Firebase</span>
          </button>

          <button
            onClick={() => fetchAllHistory(true)}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
            title="Refrescar historial desde Firebase Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar Historial</span>
          </button>
        </div>
      </div>

      {/* Cloud / Local Status Banner */}
      {cloudStatusNote && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-600/40 rounded-2xl text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CloudRain className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{cloudStatusNote}</span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-mono">Failsafe Offline Activo</span>
        </div>
      )}

      {/* Tabs Bar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('estimates')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'estimates'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Cotizaciones CCW ({estimates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dsv')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dsv'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Órdenes DSV ({dsvRecords.length})</span>
          </button>
        </div>

        {/* Search & Month Filter */}
        <div className="flex items-center space-x-2.5">
          <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Deal, Estimate, cliente, usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Todos los meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-slate-900">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: ESTIMATES TABLE */}
      {activeTab === 'estimates' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-4">Estimate / Deal ID</th>
                  <th className="px-5 py-4">Creado Por</th>
                  <th className="px-5 py-4">Partner / Reseller</th>
                  <th className="px-5 py-4">Cliente Final</th>
                  <th className="px-5 py-4 text-right">Net Cisco</th>
                  <th className="px-5 py-4 text-right">Cotizado Intcomex</th>
                  <th className="px-5 py-4 text-right">Margen $</th>
                  <th className="px-5 py-4 text-center">Ítems</th>
                  <th className="px-5 py-4 text-right">Fecha</th>
                  <th className="px-5 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEstimates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Cargando cotizaciones desde la nube...</span>
                        </div>
                      ) : (
                        'No se encontraron cotizaciones en el historial compartido.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredEstimates.map((est, idx) => (
                    <tr key={est.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-indigo-300">
                          {est.estimateId || '—'}
                        </div>
                        {est.dealId && est.dealId !== 'NA' && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Deal: {est.dealId}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                            {(est.creator?.username || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">
                              {est.creator?.fullName || est.creator?.username || 'mskill'}
                            </div>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {est.creator?.role || 'PM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-white">
                        {est.partnerName || 'Intcomex Chile'}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {est.clientFinalName || '—'}
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-slate-400">
                        {fmtCurrency(est.financialSummary?.totalNetCisco)}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                        {fmtCurrency(est.financialSummary?.totalCotizadoIntcomex)}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-amber-400">
                        {fmtCurrency(est.financialSummary?.gananciaIntcomexUsd)}
                      </td>

                      <td className="px-5 py-4 text-center font-mono text-slate-300">
                        {est.itemsCount || est.items?.length || 0}
                      </td>

                      <td className="px-5 py-4 text-right text-[11px]">
                        {est.createdAt ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-slate-300 font-semibold">
                              {new Date(est.createdAt).toLocaleDateString('es-CL')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(est.createdAt).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleLoadEstimate(est)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                            title="Restaurar esta cotización completa en el Cotizador CCW con todas sus reglas"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Cargar</span>
                          </button>

                          <button
                            onClick={() => setSelectedEstimateDetail(est)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Ver desglose detallado de ítems y reglas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteEstimate(est.id)}
                            className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/70 text-rose-400 border border-rose-800/30 transition-colors cursor-pointer"
                            title="Eliminar de la nube"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DSV RECORDS TABLE */}
      {activeTab === 'dsv' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-4">Deal ID / SO / PO</th>
                  <th className="px-5 py-4">Creado Por</th>
                  <th className="px-5 py-4">Partner ID / Reseller</th>
                  <th className="px-5 py-4">Cliente Final</th>
                  <th className="px-5 py-4 text-right">Reported Net Price</th>
                  <th className="px-5 py-4 text-center">Ítems Válidos</th>
                  <th className="px-5 py-4 text-center">Descartados ($0)</th>
                  <th className="px-5 py-4 text-right">Fecha</th>
                  <th className="px-5 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDsvs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Cargando órdenes DSV desde la nube...</span>
                        </div>
                      ) : (
                        'No se encontraron órdenes DSV en el historial compartido.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDsvs.map((dsv, idx) => (
                    <tr key={dsv.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-amber-300">
                          Deal: {dsv.dealId || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SO: {dsv.soNumber} | PO: {dsv.poNumber}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-amber-950 border border-amber-700/50 flex items-center justify-center text-[10px] font-bold text-amber-300">
                            {(dsv.creator?.username || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">
                              {dsv.creator?.fullName || dsv.creator?.username || 'mskill'}
                            </div>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {dsv.creator?.role || 'PM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-white">
                        {dsv.resellerName}
                        {dsv.partnerId && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            ID: {dsv.partnerId}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {dsv.endCustomerName}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                        {fmtCurrency(dsv.financialSummary?.totalReportedNetPrice)}
                      </td>

                      <td className="px-5 py-4 text-center font-mono text-emerald-300 font-bold">
                        {dsv.financialSummary?.totalItems || dsv.items?.length || 0}
                      </td>

                      <td className="px-5 py-4 text-center font-mono text-slate-500">
                        {dsv.financialSummary?.discardedZeroItems || 0}
                      </td>

                      <td className="px-5 py-4 text-right text-[11px]">
                        {dsv.createdAt ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-slate-300 font-semibold">
                              {new Date(dsv.createdAt).toLocaleDateString('es-CL')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(dsv.createdAt).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedDsvDetail(dsv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Ver desglose DSV"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteDsv(dsv.id)}
                            className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/70 text-rose-400 border border-rose-800/30 transition-colors cursor-pointer"
                            title="Eliminar registro DSV de la nube"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: ESTIMATE */}
      {selectedEstimateDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Detalle de Cotización CCW: {selectedEstimateDetail.estimateId}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliente: {selectedEstimateDetail.clientFinalName} &bull; Creado por: {selectedEstimateDetail.creator?.fullName} ({selectedEstimateDetail.creator?.role?.toUpperCase()})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEstimateDetail(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {/* Financial KPI Highlights */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Net Cisco</span>
                  <div className="text-lg font-black font-mono text-white mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.totalNetCisco)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-700/40">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold">Cotizado Intcomex</span>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.totalCotizadoIntcomex)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-amber-700/40">
                  <span className="text-[10px] text-amber-400 uppercase font-bold">Margen / Profit</span>
                  <div className="text-lg font-black font-mono text-amber-400 mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.gananciaIntcomexUsd)}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Línea</th>
                      <th className="px-4 py-3">Part Number</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-center">Clasificación</th>
                      <th className="px-4 py-3 text-right">Cant</th>
                      <th className="px-4 py-3 text-right">Venta Ext. USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {selectedEstimateDetail.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-slate-400">{it.lineNumber || idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-indigo-300">{it.partNumber}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-300 max-w-[240px] truncate">{it.description}</td>
                        <td className="px-4 py-2.5 text-center font-sans">
                          {it.isIntangible ? (
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px] font-bold">
                              Intangible
                            </span>
                          ) : it.llevaArancel ? (
                            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40 text-[10px] font-bold">
                              Arancel 6%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold">
                              Hardware
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{it.qty}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{fmtCurrency(it.precioVentaExtendido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  handleLoadEstimate(selectedEstimateDetail);
                  setSelectedEstimateDetail(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Cargar en Cotizador CCW</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: DSV */}
      {selectedDsvDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Detalle Orden DSV: Deal {selectedDsvDetail.dealId}
                  </h3>
                  <p className="text-xs text-slate-400">
                    SO: {selectedDsvDetail.soNumber} &bull; PO: {selectedDsvDetail.poNumber} &bull; Reseller: {selectedDsvDetail.resellerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDsvDetail(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Línea</th>
                      <th className="px-4 py-3">Cisco SKU</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Reported Unit Price</th>
                      <th className="px-4 py-3 text-right">Reported Net Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {selectedDsvDetail.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-slate-400">{it.soLineNum || idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-amber-300">{it.ciscoStandardPartNumber}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{it.productQuantity}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{fmtCurrency(it.reportedProductUnitPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{fmtCurrency(it.reportedNetPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Firebase Cloud Configuration Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        onConfigSaved={() => fetchAllHistory(true)}
      />
    </div>
  );
}
