// ============================================================================
// CISCO AUTOMATED v2.1 - SHARED HISTORY & CLOUD DASHBOARD (FIREBASE FIRESTORE)
// Fetch-on-Demand (NO onSnapshot) with 100% Offline Local Failsafe
// Includes Shared Visibility, Manual Restriction Toggle & Access Request Workflow
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  CloudEstimateRecord,
  EstimateAccessRequest,
  CloudDsvRecord,
  getCloudEstimates,
  useEstimatesMirror,
  getCloudDsvs,
  deleteCloudEstimate,
  deleteCloudDsv,
  toggleEstimateRestriction,
  requestEstimateAccess,
  resolveEstimateAccessRequest,
  FirebaseConfigModal,
} from '../modules/cloud';
import { useCiscoAutomatedStore } from '../core/store';
import {
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  FileCheck,
  Cloud,
  CloudRain,
  UploadCloud,
  Eye,
  Trash2,
  User,
  Building2,
  X,
  Database,
  Lock,
  Unlock,
  KeyRound,
  Bell,
  Check,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { formatPartnerName, getUniqueFormattedPartners } from '../utils/partnerDbUtils';

const isValidEstimateId = (id?: string | null): boolean => {
  if (!id) return false;
  const clean = id.trim().toUpperCase();
  return (
    clean !== '' &&
    clean !== '—' &&
    clean !== 'NA' &&
    clean !== 'N/A' &&
    clean !== 'SIN ESTIMATE' &&
    clean !== '-'
  );
};

const formatPctNumber = (val?: number, fallback: number = 0): string => {
  if (val === undefined || val === null || isNaN(val)) val = fallback;
  const num = val > 0 && val < 1 ? val * 100 : val;
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
};

const getEstimateParams = (est: CloudEstimateRecord) => {
  const m = Number(
    est.financialSummary?.params?.margenPct ?? est.financialSummary?.margenPct ?? 5.0
  );
  const i = Number(est.financialSummary?.params?.internacionPct ?? 7.0);
  const a = Number(est.financialSummary?.params?.arancelPct ?? 6.0);
  return {
    margen: formatPctNumber(m, 5),
    internacion: formatPctNumber(i, 7),
    arancel: formatPctNumber(a, 6),
  };
};

export function EstimatesHistoryView() {
  const { loadCloudEstimateIntoStore, currentUser } = useCiscoAutomatedStore();

  // Active Tab: 'estimates' | 'dsv'
  const [activeTab, setActiveTab] = useState<'estimates' | 'dsv'>('estimates');

  // Instant 0ms Cloud Estimates Mirror via React 19 Concurrent External Store
  const estimates = useEstimatesMirror();
  const [dsvRecords, setDsvRecords] = useState<CloudDsvRecord[]>([]);

  // Existing + Enhanced Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<
    'all' | 'public' | 'restricted' | 'pending_requests'
  >('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>(
    'date_desc'
  );

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [cloudStatusNote, setCloudStatusNote] = useState<string | null>(null);

  // Detail & Permission Management Modals
  const [selectedEstimateDetail, setSelectedEstimateDetail] =
    useState<CloudEstimateRecord | null>(null);
  const [selectedDsvDetail, setSelectedDsvDetail] = useState<CloudDsvRecord | null>(null);
  const [permissionsModalEstimate, setPermissionsModalEstimate] =
    useState<CloudEstimateRecord | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Access evaluation helper for any Estimate row
  const evaluateAccess = (est: CloudEstimateRecord) => {
    const myUsername = (currentUser?.username || '').trim().toLowerCase();
    const creatorUsername = (est.creator?.username || '').trim().toLowerCase();
    const isOwner = Boolean(myUsername && creatorUsername && myUsername === creatorUsername);
    const isAdmin = currentUser?.role === 'admin';
    const isAllowed = Boolean(
      myUsername &&
        (est.allowedUsers || []).some((u) => String(u || '').trim().toLowerCase() === myUsername)
    );
    const canManagePrivacy = isOwner || isAdmin;
    const hasAccess = !est.isRestricted || isOwner || isAdmin || isAllowed;

    const myRequest: EstimateAccessRequest | undefined = (est.accessRequests || []).find(
      (r) => (r.username || '').trim().toLowerCase() === myUsername
    );
    const pendingRequests: EstimateAccessRequest[] = (est.accessRequests || []).filter(
      (r) => r.status === 'pending'
    );

    return {
      isOwner,
      isAdmin,
      isAllowed,
      canManagePrivacy,
      hasAccess,
      myRequest,
      pendingRequests,
    };
  };

  // Fetch on demand function
  const fetchAllHistory = async (isManualRefresh: boolean = false) => {
    setIsLoading(true);
    setCloudStatusNote(null);

    try {
      const [estRes, dsvRes] = await Promise.all([
        getCloudEstimates(100),
        getCloudDsvs(100),
      ]);

      if (dsvRes.success && dsvRes.data) {
        setDsvRecords(dsvRes.data);
      }

      if (estRes.error || dsvRes.error) {
        setCloudStatusNote(estRes.error || dsvRes.error || 'Modo local activo');
      }

      if (isManualRefresh) {
        showToast('Historial actualizado desde la nube.', 'success');
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

  // Distinct Months for Filter (Preserved)
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

  // Distinct Creators for Filter
  const availableCreators = useMemo(() => {
    const map = new Map<string, string>();
    estimates.forEach((e) => {
      const u = (e.creator?.username || '').trim();
      if (u) {
        map.set(u.toLowerCase(), e.creator?.fullName ? `${e.creator.fullName} (${u})` : u);
      }
    });
    dsvRecords.forEach((d) => {
      const u = (d.creator?.username || '').trim();
      if (u && !map.has(u.toLowerCase())) {
        map.set(u.toLowerCase(), d.creator?.fullName ? `${d.creator.fullName} (${u})` : u);
      }
    });
    return Array.from(map.entries()); // [usernameLower, label]
  }, [estimates, dsvRecords]);

  // Distinct Partners for Filter (Unificados con primera letra mayúscula, sin duplicar Ajj / ajj)
  const availablePartners = useMemo(() => {
    return getUniqueFormattedPartners(estimates);
  }, [estimates]);

  // Pending Access Requests directed to current user (or admin)
  const actionablePendingRequests = useMemo(() => {
    const list: Array<{ est: CloudEstimateRecord; req: EstimateAccessRequest }> = [];
    for (const est of estimates) {
      const { canManagePrivacy, pendingRequests } = evaluateAccess(est);
      if (canManagePrivacy && pendingRequests.length > 0) {
        for (const req of pendingRequests) {
          list.push({ est, req });
        }
      }
    }
    return list;
  }, [estimates, currentUser]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedMonth !== 'all' ||
    selectedCreator !== 'all' ||
    selectedPartner !== 'all' ||
    visibilityFilter !== 'all' ||
    sortBy !== 'date_desc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedMonth('all');
    setSelectedCreator('all');
    setSelectedPartner('all');
    setVisibilityFilter('all');
    setSortBy('date_desc');
  };

  // Filtered Estimates (Restricted estimates ALWAYS appear in search results as requested!)
  const filteredEstimates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const myUsername = (currentUser?.username || '').trim().toLowerCase();

    const filtered = estimates.filter((e) => {
      const partnerFmt = formatPartnerName(e.partnerName);
      const matchesSearch =
        !q ||
        (e.estimateId || '').toLowerCase().includes(q) ||
        (e.dealId || '').toLowerCase().includes(q) ||
        (e.partnerName || '').toLowerCase().includes(q) ||
        partnerFmt.toLowerCase().includes(q) ||
        (e.clientFinalName || '').toLowerCase().includes(q) ||
        (e.modelName || '').toLowerCase().includes(q) ||
        (e.creator?.fullName || '').toLowerCase().includes(q) ||
        (e.creator?.username || '').toLowerCase().includes(q) ||
        (e.originalFileName || '').toLowerCase().includes(q);

      const matchesMonth =
        selectedMonth === 'all' || (e.createdAt && e.createdAt.startsWith(selectedMonth));

      const creatorUserLower = (e.creator?.username || '').trim().toLowerCase();
      const matchesCreator =
        selectedCreator === 'all' ||
        (selectedCreator === 'mine'
          ? creatorUserLower === myUsername
          : creatorUserLower === selectedCreator);

      const matchesPartner =
        selectedPartner === 'all' ||
        partnerFmt.toLowerCase() === selectedPartner.toLowerCase() ||
        (e.partnerName || '').trim().toLowerCase() === selectedPartner.toLowerCase();

      const hasPending = (e.accessRequests || []).some((r) => r.status === 'pending');
      const matchesVisibility =
        visibilityFilter === 'all' ||
        (visibilityFilter === 'public' && !e.isRestricted) ||
        (visibilityFilter === 'restricted' && Boolean(e.isRestricted)) ||
        (visibilityFilter === 'pending_requests' && hasPending);

      return (
        matchesSearch &&
        matchesMonth &&
        matchesCreator &&
        matchesPartner &&
        matchesVisibility
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      if (sortBy === 'amount_desc') {
        return (
          (b.financialSummary?.totalCotizadoIntcomex || 0) -
          (a.financialSummary?.totalCotizadoIntcomex || 0)
        );
      }
      if (sortBy === 'amount_asc') {
        return (
          (a.financialSummary?.totalCotizadoIntcomex || 0) -
          (b.financialSummary?.totalCotizadoIntcomex || 0)
        );
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [
    estimates,
    searchTerm,
    selectedMonth,
    selectedCreator,
    selectedPartner,
    visibilityFilter,
    sortBy,
    currentUser,
  ]);

  // Filtered DSVs
  const filteredDsvs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const myUsername = (currentUser?.username || '').trim().toLowerCase();

    return dsvRecords.filter((d) => {
      const matchesSearch =
        !q ||
        (d.dealId || '').toLowerCase().includes(q) ||
        (d.soNumber || '').toLowerCase().includes(q) ||
        (d.poNumber || '').toLowerCase().includes(q) ||
        (d.resellerName || '').toLowerCase().includes(q) ||
        (d.endCustomerName || '').toLowerCase().includes(q) ||
        (d.creator?.fullName || '').toLowerCase().includes(q) ||
        (d.creator?.username || '').toLowerCase().includes(q);

      const matchesMonth =
        selectedMonth === 'all' || (d.createdAt && d.createdAt.startsWith(selectedMonth));

      const creatorUserLower = (d.creator?.username || '').trim().toLowerCase();
      const matchesCreator =
        selectedCreator === 'all' ||
        (selectedCreator === 'mine'
          ? creatorUserLower === myUsername
          : creatorUserLower === selectedCreator);

      return matchesSearch && matchesMonth && matchesCreator;
    });
  }, [dsvRecords, searchTerm, selectedMonth, selectedCreator, currentUser]);

  // Handle Load into Quoter (Requires Access)
  const handleLoadEstimate = (est: CloudEstimateRecord) => {
    const { hasAccess } = evaluateAccess(est);
    if (!hasAccess) {
      showToast(
        'Esta cotización está restringida. Solicita permiso al creador para cargarla.',
        'error'
      );
      return;
    }
    loadCloudEstimateIntoStore(est);
  };

  // Handle Manual Privacy Toggle (Restringir / Público)
  const handleToggleRestriction = async (est: CloudEstimateRecord) => {
    const { canManagePrivacy } = evaluateAccess(est);
    if (!canManagePrivacy) {
      showToast('Solo el creador o un administrador puede cambiar la privacidad.', 'error');
      return;
    }
    const nextRestricted = !est.isRestricted;
    const docId = est.id || `est_${est.estimateId}`;

    const res = await toggleEstimateRestriction(docId, est.estimateId, nextRestricted);
    if (res.success) {
      showToast(
        nextRestricted
          ? `🔒 Cotización ${est.estimateId} marcada como Restringida (otros usuarios deberán solicitar permiso).`
          : `🔓 Cotización ${est.estimateId} marcada como Pública (visible para todos los usuarios).`,
        'success'
      );
    } else {
      showToast(res.error || 'Error actualizando privacidad.', 'error');
    }
  };

  // Handle Requesting Permission
  const handleRequestAccess = async (est: CloudEstimateRecord) => {
    if (!currentUser) return;
    const docId = est.id || `est_${est.estimateId}`;
    const res = await requestEstimateAccess(docId, est.estimateId, {
      username: currentUser.username,
      fullName: currentUser.full_name || currentUser.username,
      role: currentUser.role,
    });

    if (res.success) {
      showToast(
        `🔑 Solicitud de permiso enviada a ${est.creator?.fullName || est.creator?.username}.`,
        'success'
      );
    } else {
      showToast(res.error || 'No se pudo enviar la solicitud.', 'error');
    }
  };

  // Handle Approving / Rejecting Permission Request
  const handleResolveAccess = async (
    est: CloudEstimateRecord,
    targetUsername: string,
    approve: boolean
  ) => {
    if (!currentUser) return;
    const docId = est.id || `est_${est.estimateId}`;
    const res = await resolveEstimateAccessRequest(
      docId,
      est.estimateId,
      targetUsername,
      approve,
      currentUser.username
    );

    if (res.success) {
      if (
        permissionsModalEstimate &&
        (permissionsModalEstimate.id === est.id ||
          permissionsModalEstimate.estimateId === est.estimateId)
      ) {
        setPermissionsModalEstimate({
          ...permissionsModalEstimate,
          allowedUsers: res.allowedUsers ?? permissionsModalEstimate.allowedUsers,
          accessRequests: res.accessRequests ?? permissionsModalEstimate.accessRequests,
        });
      }
      showToast(
        approve
          ? `✅ Permiso concedido a @${targetUsername} para la cotización ${est.estimateId}.`
          : `❌ Solicitud de @${targetUsername} rechazada.`,
        'success'
      );
    } else {
      showToast(res.error || 'Error al procesar solicitud.', 'error');
    }
  };

  // Handle Delete
  const handleDeleteEstimate = async (est: CloudEstimateRecord) => {
    if (!est.id) return;
    if (window.confirm('¿Está seguro de eliminar esta cotización del historial compartido?')) {
      const res = await deleteCloudEstimate(est.id, est.estimateId);
      if (res.success) {
        showToast('Cotización eliminada del historial.', 'success');
      }
    }
  };

  const handleDeleteDsv = async (docId?: string) => {
    if (!docId) return;
    if (window.confirm('¿Está seguro de eliminar este registro DSV del historial compartido?')) {
      const res = await deleteCloudDsv(docId);
      if (res.success) {
        setDsvRecords((prev) => prev.filter((x) => x.id !== docId));
        showToast('Registro DSV eliminado del historial.', 'success');
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
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                Historial Compartido & Cloud Storage
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/40">
                Firestore NoSQL
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/40">
                Auto-Guardado al Descargar
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Las cotizaciones descargadas se sincronizan automáticamente en la nube. Visibles para todos los usuarios o con restricción manual por solicitud de permiso.
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

      {/* Pending Access Requests Notification Banner (For Estimate Creator / Admin) */}
      {actionablePendingRequests.length > 0 && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>
                Tienes {actionablePendingRequests.length} solicitud(es) de permiso pendiente(s) para ver cotizaciones restringidas
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {actionablePendingRequests.map(({ est, req }, i) => (
              <div
                key={`${est.id}-${req.username}-${i}`}
                className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {req.fullName}{' '}
                    <span className="text-slate-400 font-mono text-[10px]">(@{req.username})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Solicita ver:{' '}
                    <strong className="text-indigo-300 font-mono">{est.estimateId}</strong> &bull;{' '}
                    <span className="text-emerald-300">{est.clientFinalName}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    onClick={() => handleResolveAccess(est, req.username, true)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    onClick={() => handleResolveAccess(est, req.username, false)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-700/40 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Tabs Bar & Comprehensive Filters */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 space-y-3.5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Tab Selector (Preserved) */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-2xl self-start">
            <button
              onClick={() => setActiveTab('estimates')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dsv'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Órdenes DSV ({dsvRecords.length})</span>
            </button>
          </div>

          {/* Search Input + Month Filter (Preserved & Expanded) */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Deal, Estimate, cliente, partner, usuario, archivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Existing Month Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">
                  Todos los meses
                </option>
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-900">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Second Row of Advanced Filters (Creator, Partner, Visibility/Permissions, Sort, Reset) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Filtros:</span>
            </span>

            {/* Creator Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedCreator}
                onChange={(e) => setSelectedCreator(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
              >
                <option value="all" className="bg-slate-900">
                  Todos los usuarios
                </option>
                {currentUser && (
                  <option value="mine" className="bg-slate-900 font-bold text-cyan-300">
                    📌 Mis cotizaciones ({currentUser.username})
                  </option>
                )}
                {availableCreators.map(([usernameLower, label]) => (
                  <option key={usernameLower} value={usernameLower} className="bg-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Partner Filter (For Estimates Tab) */}
            {activeTab === 'estimates' && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
                >
                  <option value="all" className="bg-slate-900">
                    Todos los partners
                  </option>
                  {availablePartners.map((p) => (
                    <option key={p} value={p} className="bg-slate-900">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visibility / Privacy Filter (For Estimates Tab) */}
            {activeTab === 'estimates' && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value as any)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
                >
                  <option value="all" className="bg-slate-900">
                    Visibilidad: Todas (Públicas y Restringidas)
                  </option>
                  <option value="public" className="bg-slate-900">
                    🔓 Solo Públicas (Acceso libre)
                  </option>
                  <option value="restricted" className="bg-slate-900">
                    🔒 Solo Restringidas (Con permiso)
                  </option>
                  <option value="pending_requests" className="bg-slate-900">
                    🔔 Con Solicitudes Pendientes
                  </option>
                </select>
              </div>
            )}

            {/* Sort Order (For Estimates Tab) */}
            {activeTab === 'estimates' && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
                >
                  <option value="date_desc" className="bg-slate-900">
                    Más recientes primero
                  </option>
                  <option value="date_asc" className="bg-slate-900">
                    Más antiguos primero
                  </option>
                  <option value="amount_desc" className="bg-slate-900">
                    Mayor monto cotizado
                  </option>
                  <option value="amount_asc" className="bg-slate-900">
                    Menor monto cotizado
                  </option>
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Mostrando{' '}
            <strong className="text-white">
              {activeTab === 'estimates' ? filteredEstimates.length : filteredDsvs.length}
            </strong>{' '}
            de{' '}
            <strong className="text-slate-300">
              {activeTab === 'estimates' ? estimates.length : dsvRecords.length}
            </strong>{' '}
            registros
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
                  <th className="px-3 py-4 text-center">Parámetros</th>
                  <th className="px-4 py-4 text-center">Ítems</th>
                  <th className="px-5 py-4 text-right">Fecha</th>
                  <th className="px-5 py-4 text-center">Acceso & Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEstimates.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-slate-500">
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Cargando cotizaciones desde la nube...</span>
                        </div>
                      ) : (
                        'No se encontraron cotizaciones con los filtros actuales en el historial compartido.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredEstimates.map((est, idx) => {
                    const {
                      isOwner,
                      isAllowed,
                      canManagePrivacy,
                      hasAccess,
                      myRequest,
                      pendingRequests,
                    } = evaluateAccess(est);

                    return (
                      <tr
                        key={est.id || idx}
                        className={`transition-colors ${
                          est.isRestricted && !hasAccess
                            ? 'bg-amber-950/10 hover:bg-amber-950/20'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-2">
                            {isValidEstimateId(est.estimateId) ? (
                              <a
                                href={`https://apps.cisco.com/ccw/cpc/estimate/items/${encodeURIComponent(est.estimateId!.trim())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1.5 font-mono font-bold text-indigo-300 hover:text-cyan-300 transition-colors"
                                title={`Abrir Estimate ${est.estimateId} directamente en Cisco CCW (apps.cisco.com)`}
                              >
                                <span className="group-hover:underline underline-offset-2">{est.estimateId}</span>
                                <ExternalLink className="w-3 h-3 text-indigo-400/80 group-hover:text-cyan-300 shrink-0 transition-colors" />
                              </a>
                            ) : (
                              <span className="font-mono font-bold text-slate-500">
                                {est.estimateId || '—'}
                              </span>
                            )}
                            {est.isRestricted ? (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/90 text-amber-300 border border-amber-700/50"
                                title="Cotización con restricción manual de vista"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Restringido</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/40"
                                title="Visible para todos los usuarios"
                              >
                                <Unlock className="w-2.5 h-2.5" />
                                <span>Público</span>
                              </span>
                            )}
                          </div>
                          {est.dealId && est.dealId !== 'NA' && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Deal: {est.dealId}
                            </div>
                          )}
                          {est.isRestricted && isAllowed && !isOwner && (
                            <div className="text-[9px] text-emerald-400 font-semibold mt-0.5">
                              ✓ Permiso aprobado
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
                          {formatPartnerName(est.partnerName) || 'Intcomex Chile'}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {est.clientFinalName || '—'}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-slate-400">
                          {hasAccess ? (
                            fmtCurrency(est.financialSummary?.totalNetCisco)
                          ) : (
                            <span className="text-[10px] text-amber-400/80 font-sans italic">
                              🔒 Protegido
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                          {hasAccess ? (
                            fmtCurrency(est.financialSummary?.totalCotizadoIntcomex)
                          ) : (
                            <span className="text-[10px] text-amber-400/80 font-sans italic">
                              🔒 Solicitar permiso
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold text-amber-400">
                          {hasAccess ? (
                            fmtCurrency(est.financialSummary?.gananciaIntcomexUsd)
                          ) : (
                            <span className="text-[10px] text-slate-500 font-sans">—</span>
                          )}
                        </td>

                        {/* Columna PARÁMETROS: Margen, Internación y Arancel en una sola celda compacta */}
                        <td className="px-3 py-4 text-center">
                          {hasAccess ? (
                            (() => {
                              const p = getEstimateParams(est);
                              return (
                                <div
                                  className="inline-flex items-center gap-1 font-mono text-[10px] bg-slate-950/90 border border-slate-800/90 px-2 py-1 rounded-xl shadow-inner whitespace-nowrap"
                                  title={`Parámetros usados:\n• Margen Intcomex: ${p.margen}%\n• Internación: ${p.internacion}%\n• Arancel: ${p.arancel}%`}
                                >
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30"
                                    title={`Margen Intcomex: ${p.margen}%`}
                                  >
                                    M:{p.margen}%
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30"
                                    title={`Costo Internación: ${p.internacion}%`}
                                  >
                                    Int:{p.internacion}%
                                  </span>
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30"
                                    title={`Arancel: ${p.arancel}%`}
                                  >
                                    Ar:{p.arancel}%
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-[10px] text-slate-500 font-sans italic">🔒 Protegido</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-center font-mono text-slate-300">
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
                          <div className="flex items-center justify-center flex-wrap gap-1.5">
                            {/* Main Action: Load/View if authorized, or Request Permission if restricted */}
                            {hasAccess ? (
                              <>
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
                              </>
                            ) : myRequest?.status === 'pending' ? (
                              <button
                                onClick={() => handleRequestAccess(est)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-950/70 text-amber-300 border border-amber-700/50 text-[10px] font-bold cursor-pointer"
                                title="Ya solicitaste permiso al creador. Haz clic para reenviar recordatorio."
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Permiso Solicitado</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRequestAccess(est)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                                title={`Solicitar permiso a ${est.creator?.fullName || est.creator?.username} para ver y cargar esta cotización`}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>
                                  {myRequest?.status === 'rejected'
                                    ? 'Re-solicitar Permiso'
                                    : 'Solicitar Permiso'}
                                </span>
                              </button>
                            )}

                            {/* Manual Privacy Lock/Unlock Button (For Creator or Admin) */}
                            {canManagePrivacy && (
                              <button
                                onClick={() => handleToggleRestriction(est)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  est.isRestricted
                                    ? 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border-amber-700/50'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                }`}
                                title={
                                  est.isRestricted
                                    ? 'Actualmente Restringido 🔒 — Haz clic para hacerlo Público a todos'
                                    : 'Actualmente Público 🔓 — Haz clic para restringir vista y requerir permiso'
                                }
                              >
                                {est.isRestricted ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {/* Manage Access Requests Button (For Creator or Admin when restricted or has requests) */}
                            {canManagePrivacy &&
                              (est.isRestricted || (est.accessRequests || []).length > 0) && (
                                <button
                                  onClick={() => setPermissionsModalEstimate(est)}
                                  className={`relative p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    pendingRequests.length > 0
                                      ? 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-500/50'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                  title="Gestionar permisos y solicitudes de acceso de usuarios"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  {pendingRequests.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                                      {pendingRequests.length}
                                    </span>
                                  )}
                                </button>
                              )}

                            {/* Delete Button (Creator or Admin) */}
                            {canManagePrivacy && (
                              <button
                                onClick={() => handleDeleteEstimate(est)}
                                className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/70 text-rose-400 border border-rose-800/30 transition-colors cursor-pointer"
                                title="Eliminar de la nube"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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

      {/* PERMISSIONS & ACCESS MANAGEMENT MODAL */}
      {permissionsModalEstimate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Permisos de Acceso: {permissionsModalEstimate.estimateId}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cliente: {permissionsModalEstimate.clientFinalName} &bull; Partner:{' '}
                    <strong className="text-slate-200">
                      {formatPartnerName(permissionsModalEstimate.partnerName) || 'Intcomex Chile'}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPermissionsModalEstimate(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Visibility Status Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {permissionsModalEstimate.isRestricted ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cotización Restringida</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cotización Pública</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {permissionsModalEstimate.isRestricted
                      ? 'Visible en búsquedas, pero requiere tu aprobación para ver montos o cargarla.'
                      : 'Cualquier usuario registrado puede ver y cargar esta cotización.'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await handleToggleRestriction(permissionsModalEstimate);
                    setPermissionsModalEstimate((prev) =>
                      prev ? { ...prev, isRestricted: !prev.isRestricted } : null
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] border cursor-pointer transition-colors ${
                    permissionsModalEstimate.isRestricted
                      ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-700/50'
                      : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-700/50'
                  }`}
                >
                  {permissionsModalEstimate.isRestricted ? 'Hacer Pública 🔓' : 'Restringir 🔒'}
                </button>
              </div>

              {/* Access Requests List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Solicitudes de Permiso ({(permissionsModalEstimate.accessRequests || []).length})
                </h4>
                {(permissionsModalEstimate.accessRequests || []).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-slate-500 text-[11px]">
                    Ningún usuario ha solicitado permiso especial todavía.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(permissionsModalEstimate.accessRequests || []).map((req, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {req.fullName}{' '}
                            <span className="font-mono text-[10px] text-slate-400">
                              (@{req.username})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Solicitado:{' '}
                            {req.requestedAt
                              ? new Date(req.requestedAt).toLocaleString('es-CL')
                              : '—'}{' '}
                            &bull; Estado:{' '}
                            <strong
                              className={
                                req.status === 'approved'
                                  ? 'text-emerald-400'
                                  : req.status === 'rejected'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }
                            >
                              {req.status === 'approved'
                                ? 'Aprobado'
                                : req.status === 'rejected'
                                ? 'Rechazado'
                                : 'Pendiente'}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {req.status !== 'approved' && (
                            <button
                              onClick={() =>
                                handleResolveAccess(permissionsModalEstimate, req.username, true)
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Aprobar
                            </button>
                          )}
                          {req.status !== 'rejected' && (
                            <button
                              onClick={() =>
                                handleResolveAccess(permissionsModalEstimate, req.username, false)
                              }
                              className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/40 text-[10px] font-bold cursor-pointer"
                            >
                              {req.status === 'approved' ? 'Revocar' : 'Rechazar'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPermissionsModalEstimate(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
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
                  <h3 className="text-base font-bold text-white flex items-center flex-wrap gap-2">
                    <span>Detalle de Cotización CCW:</span>
                    {isValidEstimateId(selectedEstimateDetail.estimateId) ? (
                      <a
                        href={`https://apps.cisco.com/ccw/cpc/estimate/items/${encodeURIComponent(selectedEstimateDetail.estimateId.trim())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-indigo-300 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                        title="Abrir este Estimate directamente en Cisco Commerce Workspace (CCW)"
                      >
                        <span>{selectedEstimateDetail.estimateId}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      </a>
                    ) : (
                      <span className="font-mono text-indigo-300">{selectedEstimateDetail.estimateId}</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliente: {selectedEstimateDetail.clientFinalName} &bull; Partner:{' '}
                    <strong className="text-slate-200">
                      {formatPartnerName(selectedEstimateDetail.partnerName) || 'Intcomex Chile'}
                    </strong> &bull; Creado por:{' '}
                    {selectedEstimateDetail.creator?.fullName} (
                    {selectedEstimateDetail.creator?.role?.toUpperCase()})
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
              {/* Financial KPI Highlights & Parámetros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Net Cisco</span>
                  <div className="text-lg font-black font-mono text-white mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.totalNetCisco)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-700/40">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold">
                    Cotizado Intcomex
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.totalCotizadoIntcomex)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-amber-700/40">
                  <span className="text-[10px] text-amber-400 uppercase font-bold">
                    Margen / Profit
                  </span>
                  <div className="text-lg font-black font-mono text-amber-400 mt-1">
                    {fmtCurrency(selectedEstimateDetail.financialSummary?.gananciaIntcomexUsd)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-cyan-400 uppercase font-bold">Parámetros Aplicados</span>
                  {(() => {
                    const p = getEstimateParams(selectedEstimateDetail);
                    return (
                      <div className="flex items-center gap-1.5 mt-2 font-mono text-[11px] flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                          title="Margen Intcomex"
                        >
                          M: {p.margen}%
                        </span>
                        <span
                          className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40"
                          title="Costo de Internación"
                        >
                          Int: {p.internacion}%
                        </span>
                        <span
                          className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40"
                          title="Arancel Aduanero"
                        >
                          Ar: {p.arancel}%
                        </span>
                      </div>
                    );
                  })()}
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
                        <td className="px-4 py-2.5 font-sans text-slate-300 max-w-[240px] truncate">
                          {it.description}
                        </td>
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
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                          {fmtCurrency(it.precioVentaExtendido)}
                        </td>
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
                    SO: {selectedDsvDetail.soNumber} &bull; PO: {selectedDsvDetail.poNumber} &bull;
                    Reseller: {selectedDsvDetail.resellerName}
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
                        <td className="px-4 py-2.5 font-bold text-amber-300">
                          {it.ciscoStandardPartNumber}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-200">
                          {it.productQuantity}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">
                          {fmtCurrency(it.reportedProductUnitPrice)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                          {fmtCurrency(it.reportedNetPrice)}
                        </td>
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
