// ============================================================================
// CISCO AUTOMATED v2.1 - EXECUTIVE ANALYTICAL DASHBOARD (FIREBASE + MIRROR SNAPSHOT)
// Instant 0ms Mirror Snapshot with Default Daily View & Dynamic Time-Window Filters
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CloudEstimateRecord,
  getCloudEstimates,
  getMirrorLastSyncTimestamp,
  requestEstimateAccess,
  useEstimatesMirror,
} from '../modules/cloud';
import { useCiscoAutomatedStore } from '../core/store';
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
  Filter,
  Search,
  User,
  Zap,
  Cloud,
  UploadCloud,
  Lock,
  Unlock,
  KeyRound,
  Clock,
  RotateCcw,
  X,
  CheckCircle2,
  BarChart3,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { formatPartnerName, getUniqueFormattedPartners } from '../utils/partnerDbUtils';
import { normalizeIsoTimestamp, extractYearMonth, extractYear } from '../utils/dateUtils';

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

interface DashboardViewProps {
  onOpenQuoter: () => void;
  onOpenUpload: () => void;
}

export type DashboardPeriodFilter = 'today' | '7d' | 'month' | 'quarter' | 'year' | 'all';
export type QuarterMode = 'rolling_3m' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export function DashboardView({ onOpenQuoter, onOpenUpload }: DashboardViewProps) {
  const { currentUser, loadCloudEstimateIntoStore, setCurrentView } = useCiscoAutomatedStore();

  // 1. Instant Mirror Snapshot State (Loads in 0ms via React 19 Concurrent External Store)
  const mirrorEstimates = useEstimatesMirror();
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(() =>
    getMirrorLastSyncTimestamp()
  );
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 2. Analytical Filter States — Default is 'month' (Mensual) so estimates are always visible upon opening
  const [periodFilter, setPeriodFilter] = useState<DashboardPeriodFilter>('month');
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [quarterMode, setQuarterMode] = useState<QuarterMode>('rolling_3m');
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync Mirror Snapshot with Firebase Firestore & Desktop SQLite (Loads up to 300 recent estimates)
  const syncMirrorWithFirebase = useCallback(
    async (isManual: boolean = false) => {
      setIsSyncingCloud(true);
      setSyncNote(null);
      try {
        const res = await getCloudEstimates(300);
        if (res.success && res.data) {
          setLastSyncIso(getMirrorLastSyncTimestamp() || new Date().toISOString());
        }
        if (res.error) {
          setSyncNote(res.error);
        } else if (isManual) {
          showToast('Espejo analítico sincronizado con Firebase Firestore.', 'success');
        }
      } catch (e: any) {
        console.warn('Dashboard sync warning:', e);
        setSyncNote('Modo espejo local activo');
      } finally {
        setIsSyncingCloud(false);
      }
    },
    []
  );

  // Initial background sync with Firebase Firestore
  useEffect(() => {
    syncMirrorWithFirebase(false);
  }, [syncMirrorWithFirebase]);

  // Access check for restricted estimates
  const evaluateAccess = useCallback(
    (est: CloudEstimateRecord) => {
      const myUsername = (currentUser?.username || '').trim().toLowerCase();
      const creatorUsername = (est.creator?.username || '').trim().toLowerCase();
      const isOwner = Boolean(myUsername && creatorUsername && myUsername === creatorUsername);
      const isAdmin = currentUser?.role === 'admin';
      const isAllowed = Boolean(
        myUsername &&
          (est.allowedUsers || []).some((u) => String(u || '').trim().toLowerCase() === myUsername)
      );
      const hasAccess = !est.isRestricted || isOwner || isAdmin || isAllowed;
      const myRequest = (est.accessRequests || []).find(
        (r) => (r.username || '').trim().toLowerCase() === myUsername
      );
      return { hasAccess, isOwner, isAdmin, isAllowed, myRequest };
    },
    [currentUser]
  );

  // Distinct available months, years, creators, and partners from the Mirror Snapshot
  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonthStr]);
    mirrorEstimates.forEach((e) => {
      const ym = extractYearMonth(e.createdAt);
      if (ym && ym.length === 7) {
        set.add(ym);
      }
    });
    return Array.from(set).sort().reverse();
  }, [mirrorEstimates, currentMonthStr]);

  const availableYears = useMemo(() => {
    const set = new Set<string>([currentYearStr]);
    mirrorEstimates.forEach((e) => {
      const y = extractYear(e.createdAt);
      if (y && y.length === 4) {
        set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [mirrorEstimates, currentYearStr]);

  const availableCreators = useMemo(() => {
    const map = new Map<string, string>();
    mirrorEstimates.forEach((e) => {
      const u = (e.creator?.username || '').trim();
      if (u) {
        map.set(u.toLowerCase(), e.creator?.fullName ? `${e.creator.fullName} (${u})` : u);
      }
    });
    return Array.from(map.entries());
  }, [mirrorEstimates]);

  const availablePartners = useMemo(() => {
    return getUniqueFormattedPartners(mirrorEstimates);
  }, [mirrorEstimates]);

  // Helper to check if an estimate's createdAt falls within a given period
  const matchesTimePeriod = useCallback(
    (createdAtRaw: string | undefined, period: DashboardPeriodFilter): boolean => {
      if (period === 'all') return true;
      if (!createdAtRaw) return false;

      const createdAtIso = normalizeIsoTimestamp(createdAtRaw);
      const recordDate = new Date(createdAtIso);
      if (isNaN(recordDate.getTime())) return false;

      const now = new Date();

      if (period === 'today') {
        return (
          recordDate.getFullYear() === now.getFullYear() &&
          recordDate.getMonth() === now.getMonth() &&
          recordDate.getDate() === now.getDate()
        );
      }

      if (period === '7d') {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
        return recordDate >= sevenDaysAgo;
      }

      if (period === 'month') {
        const ym = extractYearMonth(createdAtIso);
        return ym === selectedMonth;
      }

      if (period === 'quarter') {
        if (quarterMode === 'rolling_3m') {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
          return recordDate >= threeMonthsAgo;
        }
        const recYear = extractYear(createdAtIso);
        if (recYear !== selectedYear) return false;
        const m = recordDate.getMonth() + 1; // 1..12
        if (quarterMode === 'Q1') return m >= 1 && m <= 3;
        if (quarterMode === 'Q2') return m >= 4 && m <= 6;
        if (quarterMode === 'Q3') return m >= 7 && m <= 9;
        if (quarterMode === 'Q4') return m >= 10 && m <= 12;
        return true;
      }

      if (period === 'year') {
        return extractYear(createdAtIso) === selectedYear;
      }

      return true;
    },
    [selectedMonth, quarterMode, selectedYear]
  );

  // Count how many records exist in current month vs today (for helpful hint when today = 0)
  const currentMonthCount = useMemo(() => {
    return mirrorEstimates.filter((e) => matchesTimePeriod(e.createdAt, 'month')).length;
  }, [mirrorEstimates, matchesTimePeriod]);

  // 3. Filtered Dataset in Memory (<1ms from Mirror Snapshot)
  const filteredEstimates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const myUsername = (currentUser?.username || '').trim().toLowerCase();

    return mirrorEstimates.filter((e) => {
      if (!matchesTimePeriod(e.createdAt, periodFilter)) return false;

      const creatorLower = (e.creator?.username || '').trim().toLowerCase();
      if (selectedCreator !== 'all') {
        if (selectedCreator === 'mine' && creatorLower !== myUsername) return false;
        if (selectedCreator !== 'mine' && creatorLower !== selectedCreator) return false;
      }

      if (selectedPartner !== 'all') {
        const partnerFmt = formatPartnerName(e.partnerName);
        if (
          partnerFmt.toLowerCase() !== selectedPartner.toLowerCase() &&
          (e.partnerName || '').trim().toLowerCase() !== selectedPartner.toLowerCase()
        ) {
          return false;
        }
      }

      if (q) {
        const partnerFmt = formatPartnerName(e.partnerName);
        const hit =
          (e.estimateId || '').toLowerCase().includes(q) ||
          (e.dealId || '').toLowerCase().includes(q) ||
          (e.partnerName || '').toLowerCase().includes(q) ||
          partnerFmt.toLowerCase().includes(q) ||
          (e.clientFinalName || '').toLowerCase().includes(q) ||
          (e.creator?.fullName || '').toLowerCase().includes(q) ||
          (e.creator?.username || '').toLowerCase().includes(q) ||
          (e.originalFileName || '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [
    mirrorEstimates,
    matchesTimePeriod,
    periodFilter,
    selectedCreator,
    selectedPartner,
    searchQuery,
    currentUser,
  ]);

  // 4. Dynamic Aggregated Metrics & Breakdowns from Filtered Mirror Data
  const computedAnalytics = useMemo(() => {
    let totalRevenue = 0;
    let totalNetCisco = 0;
    let totalProfit = 0;
    let totalItems = 0;
    let marginSum = 0;
    let marginCount = 0;

    const partnerMap: Record<string, { count: number; revenue: number; profit: number }> = {};
    const clientMap: Record<string, { count: number; revenue: number; profit: number }> = {};
    const creatorMap: Record<
      string,
      { fullName: string; role: string; count: number; revenue: number; profit: number }
    > = {};

    for (const est of filteredEstimates) {
      const rev =
        Number(est.currentAmount ?? est.financialSummary?.totalCotizadoIntcomex) || 0;
      const net =
        Number(est.baselineV0Amount ?? est.financialSummary?.totalNetCisco) || 0;
      const prof =
        Number(est.financialSummary?.gananciaIntcomexUsd) ||
        Math.max(0, rev - net);
      const items = Number(est.itemsCount || est.items?.length) || 0;
      const mPct = Number(est.financialSummary?.margenPct) || 5.0;

      totalRevenue += rev;
      totalNetCisco += net;
      totalProfit += prof;
      totalItems += items;
      marginSum += mPct;
      marginCount += 1;

      const pName = formatPartnerName(est.partnerName) || 'Intcomex Partner';
      if (!partnerMap[pName]) partnerMap[pName] = { count: 0, revenue: 0, profit: 0 };
      partnerMap[pName].count += 1;
      partnerMap[pName].revenue += rev;
      partnerMap[pName].profit += prof;

      const cName = (est.clientFinalName || 'Cliente Final').trim();
      if (!clientMap[cName]) clientMap[cName] = { count: 0, revenue: 0, profit: 0 };
      clientMap[cName].count += 1;
      clientMap[cName].revenue += rev;
      clientMap[cName].profit += prof;

      const uKey = (est.creator?.username || 'pm').trim().toLowerCase();
      if (!creatorMap[uKey]) {
        creatorMap[uKey] = {
          fullName: est.creator?.fullName || est.creator?.username || 'Product Manager',
          role: est.creator?.role || 'pm',
          count: 0,
          revenue: 0,
          profit: 0,
        };
      }
      creatorMap[uKey].count += 1;
      creatorMap[uKey].revenue += rev;
      creatorMap[uKey].profit += prof;
    }

    const avgMarginPct =
      totalRevenue > 0
        ? (totalProfit / totalRevenue) * 100
        : marginCount > 0
        ? marginSum / marginCount
        : 0;

    const partnerEntries = Object.entries(partnerMap).sort((a, b) => b[1].revenue - a[1].revenue);
    const clientEntries = Object.entries(clientMap).sort((a, b) => b[1].revenue - a[1].revenue);
    const creatorEntries = Object.entries(creatorMap).sort((a, b) => b[1].revenue - a[1].revenue);

    return {
      totalEstimates: filteredEstimates.length,
      totalRevenue,
      totalNetCisco,
      totalProfit,
      totalRecargo: Math.max(0, totalRevenue - totalNetCisco),
      totalItems,
      avgMarginPct,
      partnerEntries,
      clientEntries,
      creatorEntries,
    };
  }, [filteredEstimates]);

  const maxPartnerRevenue = Math.max(
    ...computedAnalytics.partnerEntries.map(([, v]) => v.revenue),
    1
  );
  const maxClientRevenue = Math.max(
    ...computedAnalytics.clientEntries.map(([, v]) => v.revenue),
    1
  );
  const maxCreatorRevenue = Math.max(
    ...computedAnalytics.creatorEntries.map(([, v]) => v.revenue),
    1
  );

  const fmtCurrency = (v?: number) => {
    if (v === undefined || v === null || isNaN(v)) return '$0,00';
    return '$' + v.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const hasCustomFilters =
    periodFilter !== 'today' ||
    selectedCreator !== 'all' ||
    selectedPartner !== 'all' ||
    searchQuery.trim() !== '';

  const resetFiltersToDefaultDaily = () => {
    setPeriodFilter('today');
    setSelectedCreator('all');
    setSelectedPartner('all');
    setSearchQuery('');
  };

  const handleRequestAccessFromDashboard = async (est: CloudEstimateRecord) => {
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

  const periodLabel = useMemo(() => {
    if (periodFilter === 'today') return 'Hoy (Vista Diaria Predeterminada)';
    if (periodFilter === '7d') return 'Últimos 7 Días';
    if (periodFilter === 'month') return `Mes: ${selectedMonth}`;
    if (periodFilter === 'quarter') {
      return quarterMode === 'rolling_3m'
        ? 'Últimos 3 Meses (Rolling Quarter)'
        : `Trimestre ${quarterMode} • ${selectedYear}`;
    }
    if (periodFilter === 'year') return `Año ${selectedYear}`;
    return 'Histórico Completo';
  }, [periodFilter, selectedMonth, quarterMode, selectedYear]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center space-x-2.5 border ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400/40'
              : 'bg-rose-600 text-white border-rose-400/40'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              <span>Dashboard Ejecutivo &bull; Cisco Automated v2.1</span>
            </h1>
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/40">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Modo Espejo Firebase ({mirrorEstimates.length} en caché)</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Análisis en tiempo real conectado a Firebase Firestore con Snapshot Espejo de carga instantánea &bull;{' '}
            <strong className="text-indigo-300">{periodLabel}</strong>
            {lastSyncIso && (
              <span className="text-slate-500 ml-2 font-mono text-[10px]">
                (Sincronizado:{' '}
                {new Date(lastSyncIso).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
                )
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => syncMirrorWithFirebase(true, 'all')}
            disabled={isSyncingCloud}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-2 border border-slate-700 hover:border-cyan-500/40 transition-all cursor-pointer disabled:opacity-50"
            title="Sincronizar Snapshot Espejo con Firebase Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Sincronizando...' : 'Sincronizar Espejo'}</span>
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

      {/* Time-Window & Analytical Filters Bar (Lightweight Mirror Snapshot Controls) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 space-y-3.5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Period Selector Pills */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                periodFilter === 'today'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Vista predeterminada ligera: cotizaciones del día de hoy"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Diario (Hoy)</span>
            </button>

            <button
              onClick={() => setPeriodFilter('7d')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodFilter === '7d'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              7 Días
            </button>

            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'month'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Mensual
            </button>

            <button
              onClick={() => setPeriodFilter('quarter')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'quarter'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Filtrar por Trimestre (Q1-Q4) o Últimos 3 Meses"
            >
              Trimestral (Q / 3M)
            </button>

            <button
              onClick={() => setPeriodFilter('year')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'year'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Anual
            </button>

            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todo ({mirrorEstimates.length})
            </button>
          </div>

          {/* Contextual Sub-Selectors (Month / Quarter / Year) + Search */}
          <div className="flex items-center flex-wrap gap-2">
            {periodFilter === 'month' && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] text-slate-400 font-semibold">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m} className="bg-slate-900">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodFilter === 'quarter' && (
              <div className="flex items-center flex-wrap gap-2">
                <div className="flex items-center space-x-1.5 bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={quarterMode}
                    onChange={(e) => setQuarterMode(e.target.value as QuarterMode)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="rolling_3m" className="bg-slate-900">
                      Últimos 3 Meses (Rolling)
                    </option>
                    <option value="Q1" className="bg-slate-900">
                      Q1 (Ene - Mar)
                    </option>
                    <option value="Q2" className="bg-slate-900">
                      Q2 (Abr - Jun)
                    </option>
                    <option value="Q3" className="bg-slate-900">
                      Q3 (Jul - Sep)
                    </option>
                    <option value="Q4" className="bg-slate-900">
                      Q4 (Oct - Dic)
                    </option>
                  </select>
                </div>

                {quarterMode !== 'rolling_3m' && (
                  <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-[11px] text-slate-400">Año:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y} className="bg-slate-900">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {periodFilter === 'year' && (
              <div className="flex items-center space-x-1.5 bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] text-slate-400 font-semibold">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-slate-900">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Search in Dashboard */}
            <div className="relative min-w-[210px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar cliente, partner, Deal, Estimate..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Second Filter Row: Creator, Partner, and Status Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Segmentar muestra:</span>
            </span>

            {/* Creator / PM Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedCreator}
                onChange={(e) => setSelectedCreator(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
              >
                <option value="all" className="bg-slate-900">
                  Todos los usuarios / PMs
                </option>
                {currentUser && (
                  <option value="mine" className="bg-slate-900 font-bold text-cyan-300">
                    📌 Mis cotizaciones ({currentUser.username})
                  </option>
                )}
                {availableCreators.map(([uLower, label]) => (
                  <option key={uLower} value={uLower} className="bg-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Partner Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-[11px]"
              >
                <option value="all" className="bg-slate-900">
                  Todos los Partners ({availablePartners.length})
                </option>
                {availablePartners.map((p) => (
                  <option key={p} value={p} className="bg-slate-900">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {hasCustomFilters && (
              <button
                onClick={resetFiltersToDefaultDaily}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Volver a Diario (Hoy)</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
            {syncNote && <span className="text-amber-400">{syncNote}</span>}
            <span>
              Muestra activa:{' '}
              <strong className="text-white">{filteredEstimates.length}</strong> de{' '}
              <strong className="text-cyan-300">{mirrorEstimates.length}</strong> cotizaciones en espejo
            </span>
          </div>
        </div>
      </div>

      {/* Smart Fallback Hint when current filter yields 0 quotes but Mirror has historical data */}
      {filteredEstimates.length === 0 && mirrorEstimates.length > 0 && (
        <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5 text-indigo-200">
            <Cloud className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>
              El filtro seleccionado (<strong>{periodLabel}</strong>) no registra cotizaciones. Tienes{' '}
              <strong className="text-white">{mirrorEstimates.length} cotizaciones</strong> resguardadas en el Espejo Cloud / Local.
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {periodFilter !== 'month' && currentMonthCount > 0 && (
              <button
                onClick={() => setPeriodFilter('month')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer transition-colors"
              >
                Ver Mes Actual ({currentMonthCount})
              </button>
            )}
            <button
              onClick={() => {
                setQuarterMode('rolling_3m');
                setPeriodFilter('quarter');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-[11px] cursor-pointer transition-colors"
            >
              Ver Últimos 3 Meses (Q)
            </button>
            {periodFilter !== 'all' && (
              <button
                onClick={() => setPeriodFilter('all')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer transition-colors shadow-md shadow-emerald-900/30"
              >
                Ver Todo el Historial ({mirrorEstimates.length})
              </button>
            )}
          </div>
        </div>
      )}

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
            {computedAnalytics.totalEstimates}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Sincronizado con Firebase</span>
            <span className="font-mono text-indigo-300">{computedAnalytics.totalItems} ítems</span>
          </p>
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
            {fmtCurrency(computedAnalytics.totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Net Cisco Base:</span>
            <span className="font-mono text-slate-300">
              {fmtCurrency(computedAnalytics.totalNetCisco)}
            </span>
          </p>
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
            {fmtCurrency(computedAnalytics.totalProfit)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Dif. Bruta vs Net Cisco:</span>
            <span className="font-mono text-amber-300/80">
              {fmtCurrency(computedAnalytics.totalRecargo)}
            </span>
          </p>
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
            {computedAnalytics.avgMarginPct.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Margen operativo porcentual sobre venta
          </p>
        </div>
      </div>

      {/* Breakdown Charts (Partner, Client Final, and PM / Creator) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Revenue por Partner</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              {computedAnalytics.partnerEntries.length} Partners
            </span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {computedAnalytics.partnerEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sin registros de Partners en este período
              </div>
            ) : (
              computedAnalytics.partnerEntries.map(([partner, data]) => {
                const pct = Math.round((data.revenue / maxPartnerRevenue) * 100);
                const isSelected = selectedPartner.toLowerCase() === partner.toLowerCase();
                return (
                  <div
                    key={partner}
                    onClick={() =>
                      setSelectedPartner((prev) =>
                        prev.toLowerCase() === partner.toLowerCase() ? 'all' : partner
                      )
                    }
                    className={`space-y-1.5 p-2 rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-950/50 border border-indigo-500/40' : 'hover:bg-slate-800/40'
                    }`}
                    title="Haz clic para filtrar el Dashboard por este Partner"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[180px]">
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
            <span className="text-[11px] text-slate-500">
              {computedAnalytics.clientEntries.length} Clientes
            </span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {computedAnalytics.clientEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sin registros de Clientes en este período
              </div>
            ) : (
              computedAnalytics.clientEntries.map(([client, data]) => {
                const pct = Math.round((data.revenue / maxClientRevenue) * 100);
                return (
                  <div
                    key={client}
                    onClick={() =>
                      setSearchQuery((prev) =>
                        prev.toLowerCase() === client.toLowerCase() ? '' : client
                      )
                    }
                    className="space-y-1.5 p-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer"
                    title="Haz clic para filtrar por este Cliente Final"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[180px]">
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

        {/* Product Manager / Creator Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Actividad por Usuario / PM</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              {computedAnalytics.creatorEntries.length} Usuarios
            </span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {computedAnalytics.creatorEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sin actividad de usuarios en este período
              </div>
            ) : (
              computedAnalytics.creatorEntries.map(([uKey, data]) => {
                const pct = Math.round((data.revenue / maxCreatorRevenue) * 100);
                const isSelected = selectedCreator === uKey;
                return (
                  <div
                    key={uKey}
                    onClick={() => setSelectedCreator((prev) => (prev === uKey ? 'all' : uKey))}
                    className={`space-y-1.5 p-2 rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-950/50 border border-cyan-500/40' : 'hover:bg-slate-800/40'
                    }`}
                    title="Haz clic para filtrar por este Usuario / PM"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[180px]">
                        {data.fullName}{' '}
                        <span className="text-[10px] text-slate-500 font-mono">(@{uKey})</span>
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {fmtCurrency(data.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-600 to-blue-400 h-full rounded-full transition-all duration-500"
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

      {/* Filtered Estimates Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Estimates Procesados en la Muestra ({filteredEstimates.length})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-mono">{periodLabel}</span>
            <button
              onClick={() => setCurrentView('estimates')}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Ir a Historial Completo & Permisos →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Estimate / Visibilidad</th>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Partner</th>
                <th className="px-5 py-3">Cliente Final</th>
                <th className="px-5 py-3">Archivo</th>
                <th className="px-5 py-3 text-right">Net Cisco</th>
                <th className="px-5 py-3 text-right">Total Intcomex</th>
                <th className="px-5 py-3 text-right">Ganancia USD</th>
                <th className="px-5 py-3 text-right">Fecha</th>
                <th className="px-5 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredEstimates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-500">
                    No hay cotizaciones registradas para el filtro seleccionado ({periodLabel}).
                  </td>
                </tr>
              ) : (
                filteredEstimates.slice(0, 50).map((e, idx) => {
                  const { hasAccess, myRequest } = evaluateAccess(e);
                  return (
                    <tr key={e.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          {isValidEstimateId(e.estimateId) ? (
                            <a
                              href={`https://apps.cisco.com/ccw/cpc/estimate/items/${encodeURIComponent(e.estimateId!.trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 font-mono font-bold text-indigo-300 hover:text-cyan-300 transition-colors"
                              title={`Abrir Estimate ${e.estimateId} directamente en Cisco CCW (apps.cisco.com)`}
                            >
                              <span className="group-hover:underline underline-offset-2">{e.estimateId}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-indigo-400/80 group-hover:text-cyan-300 shrink-0 transition-colors" />
                            </a>
                          ) : (
                            <span className="font-mono font-bold text-indigo-300">
                              {e.estimateId || '—'}
                            </span>
                          )}
                          {e.isRestricted ? (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-700/50">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Restringido</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/40">
                              <Unlock className="w-2.5 h-2.5" />
                              <span>Público</span>
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                              e.activeVersion === 0
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : e.activeVersion === 1
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-700/50'
                                : 'bg-purple-950/80 text-purple-300 border border-purple-700/50'
                            }`}
                            title={`Versión activa: ${e.activeVersionTag || (e.activeVersion === 0 ? 'v0_RAW' : `v${e.activeVersion ?? 1}`)}`}
                          >
                            {e.activeVersionTag || (e.activeVersion === 0 ? 'v0' : `v${e.activeVersion ?? 1}`)}
                          </span>
                        </div>
                        {e.dealId && e.dealId !== 'NA' && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Deal: {e.dealId}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white text-xs">
                          {e.creator?.fullName || e.creator?.username || 'mskill'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          @{e.creator?.username || 'pm'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-bold text-white">
                        {formatPartnerName(e.partnerName) || 'Intcomex Partner'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-200">{e.clientFinalName}</td>
                      <td
                        className="px-5 py-3.5 font-mono text-[11px] text-slate-400 max-w-[180px] truncate"
                        title={e.originalFileName}
                      >
                        {e.originalFileName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-right text-slate-400">
                        {hasAccess ? (
                          fmtCurrency(e.financialSummary?.totalNetCisco)
                        ) : (
                          <span className="text-[10px] text-amber-400/80 font-sans italic">
                            🔒 Protegido
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-right font-bold text-emerald-400">
                        {hasAccess ? (
                          fmtCurrency(e.financialSummary?.totalCotizadoIntcomex)
                        ) : (
                          <span className="text-[10px] text-amber-400/80 font-sans italic">
                            🔒 Requiere permiso
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-right font-bold text-amber-400">
                        {hasAccess ? (
                          fmtCurrency(e.financialSummary?.gananciaIntcomexUsd)
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[11px]">
                        {e.createdAt ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-slate-300 font-semibold">
                              {new Date(e.createdAt).toLocaleDateString('es-CL')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(e.createdAt).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          'Hoy'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {hasAccess ? (
                          <button
                            onClick={() => loadCloudEstimateIntoStore(e)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            title="Abrir esta cotización en el Cotizador CCW"
                          >
                            <UploadCloud className="w-3 h-3" />
                            <span>Cargar</span>
                          </button>
                        ) : myRequest?.status === 'pending' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-950/70 text-amber-300 border border-amber-700/50 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Solicitado</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRequestAccessFromDashboard(e)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            title="Solicitar permiso al creador para ver los valores y cargarla"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Pedir Permiso</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
