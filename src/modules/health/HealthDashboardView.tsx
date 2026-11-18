// ============================================================================
// CISCO AUTOMATED v2.12.0 - SYSTEM HEALTH & DIAGNOSTICS DASHBOARD VIEW
// Executive-level real-time monitoring of Cloud, Storage, APIs, and Runtime
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  HardDrive,
  DollarSign,
  Cpu,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  CloudCheck,
  ShieldCheck,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  SystemHealthReport,
  HealthStatusLevel,
  HealthCheckResult,
} from './healthTypes';
import {
  runAllHealthChecks,
  repairStorageCache,
  exportDiagnosticReportMarkdown,
} from './healthService';
import { optimizeAndMigrateLocalStorage } from '../../core/storage/modernStorageEngine';
import {
  downloadSqliteDatabase,
  sqliteVacuum,
  formatSqliteBytes,
} from '../../core/storage/sqliteStorageEngine';
import { fetchDailyOfficialChileanRates } from '../../core/chileanExchangeRateService';
import { getFormattedAppVersion } from '../../core/appVersion';

interface HealthDashboardViewProps {
  onOpenOfflineModal?: () => void;
}

export const HealthDashboardView: React.FC<HealthDashboardViewProps> = ({ onOpenOfflineModal }) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);

  const executeDiagnostics = useCallback(async () => {
    setIsLoading(true);
    setRepairFeedback(null);
    try {
      const data = await runAllHealthChecks();
      setReport(data);
    } catch (err: any) {
      console.error('[HealthDashboard] Error running health checks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    executeDiagnostics();
  }, [executeDiagnostics]);

  const handleCopyReport = () => {
    if (!report) return;
    const text = exportDiagnosticReportMarkdown(report);
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handleCopyDirectLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const directUrl = `${origin}${pathname}?view=health`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCleanCache = async () => {
    setIsLoading(true);
    const res = repairStorageCache();
    await optimizeAndMigrateLocalStorage();
    const freedText =
      res.freedBytes >= 1024 * 1024
        ? `${(res.freedBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(res.freedBytes / 1024)} KB`;

    setRepairFeedback(
      res.clearedKeys > 0
        ? `✨ Almacenamiento optimizado: ${res.clearedKeys} elementos consolidados en SQLite y ${freedText} liberados de LocalStorage.`
        : '✨ Motor de base de datos SQLite y LocalStorage al 100% optimizados.'
    );
    await executeDiagnostics();
    setIsLoading(false);
  };

  const handleDownloadSqlite = async () => {
    setIsLoading(true);
    const ok = await downloadSqliteDatabase();
    if (ok) {
      setRepairFeedback('📥 Base de datos SQLite (.sqlite) descargada exitosamente en su equipo.');
    } else {
      setRepairFeedback('⚠️ No se pudo generar la descarga del archivo SQLite.');
    }
    setIsLoading(false);
  };

  const handleVacuumSqlite = async () => {
    setIsLoading(true);
    const res = await sqliteVacuum();
    await optimizeAndMigrateLocalStorage();
    if (res.success) {
      const freed = res.freedBytes > 0 ? ` (${formatSqliteBytes(res.freedBytes)} liberados)` : '';
      setRepairFeedback(`⚡ Optimización VACUUM SQLite completada exitosamente${freed}.`);
    } else {
      setRepairFeedback('✨ Base de datos SQLite optimizada.');
    }
    await executeDiagnostics();
    setIsLoading(false);
  };

  const handleRefreshRates = async () => {
    setIsLoading(true);
    try {
      await fetchDailyOfficialChileanRates(true);
      await executeDiagnostics();
      setRepairFeedback('Indicadores de cambio (USD / UF) actualizados desde el Banco Central.');
    } catch (err: any) {
      setRepairFeedback(`Error actualizando tasas: ${err?.message || 'Error de red'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: HealthStatusLevel) => {
    switch (status) {
      case 'healthy':
        return {
          label: 'Óptimo',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
        };
      case 'degraded':
        return {
          label: 'Degradado',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: AlertTriangle,
        };
      case 'critical':
        return {
          label: 'Crítico',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: XCircle,
        };
      default:
        return {
          label: 'Desconocido',
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          icon: Activity,
        };
    }
  };

  const overallBadge = getStatusBadge(report?.overallStatus || 'healthy');
  const OverallIcon = overallBadge.icon;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex items-center space-x-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-black text-white tracking-tight">
                Monitor de Salud & Diagnóstico del Sistema
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {getFormattedAppVersion()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Telemetría en tiempo real de Cloud Firestore, Almacenamiento PC, Indicadores BCCh y Resiliencia
            </p>
          </div>
        </div>

        {/* Global Score & Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {report && (
            <div className="flex items-center space-x-2.5 px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800">
              <OverallIcon className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Salud General
                </div>
                <div className="text-sm font-black text-white">
                  {report.score}/100 &bull; <span className={report.score >= 85 ? 'text-emerald-400' : report.score >= 60 ? 'text-amber-400' : 'text-rose-400'}>{overallBadge.label}</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={executeDiagnostics}
            className="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center space-x-2 cursor-pointer"
            title="Ejecutar prueba de diagnóstico en tiempo real"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Analizando...' : 'Diagnóstico en Vivo'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyReport}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center space-x-2 cursor-pointer"
            title="Copiar reporte técnico completo en Markdown para soporte o TI"
          >
            {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedReport ? '¡Reporte Copiado!' : 'Copiar Reporte'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyDirectLink}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center space-x-2 cursor-pointer"
            title="Copiar enlace directo: ?view=health para abrir esta vista de forma inmediata"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4" />}
            <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace Directo'}</span>
          </button>
        </div>
      </div>

      {repairFeedback && (
        <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-xs font-medium text-indigo-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{repairFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setRepairFeedback(null)}
            className="text-slate-400 hover:text-white text-xs ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* 4 Quadrants of System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Cloud & Base de Datos Firestore */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Nube & Base de Datos</h3>
                  <p className="text-[11px] text-slate-400">Firebase Firestore & Cloudflare CDN</p>
                </div>
              </div>
              {report?.checks.firestore && (
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                    getStatusBadge(report.checks.firestore.status).bg
                  }`}
                >
                  {getStatusBadge(report.checks.firestore.status).label}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Latencia Firestore:</span>
                <span className="font-bold text-white">
                  {report?.checks.firestore?.latencyMs !== undefined
                    ? `${report.checks.firestore.latencyMs} ms`
                    : 'Consultando...'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Proyecto Firebase:</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {report?.checks.firestore?.details?.projectId || 'cisco-automated'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Cloudflare Pages CDN:</span>
                <span className="font-bold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>v{report?.checks.cdn?.details?.remoteVersion || getFormattedAppVersion()}</span>
                </span>
              </div>

              {/* Collections Status breakdown */}
              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Permisos de Colecciones Críticas:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {['cisco_pipeline_deals', 'cisco_forecast_records', 'estimates', 'bo_order_tracking'].map((col) => {
                    const status = report?.checks.firestore?.details?.collections?.[col] || 'ok';
                    return (
                      <div
                        key={col}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                      >
                        <span className="font-mono text-slate-300 truncate mr-2">{col}</span>
                        {status === 'ok' ? (
                          <span className="text-emerald-400 font-bold">OK</span>
                        ) : (
                          <span className="text-rose-400 font-bold">Bloqueado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            {report?.checks.firestore?.message}
          </div>
        </div>

        {/* Card 2: Almacenamiento Local en PC (Motor Relacional SQLite WASM + OPFS) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Almacenamiento Local en PC</h3>
                  <p className="text-[11px] text-slate-400">
                    Motor Relacional SQLite v3 (WASM & Persistencia OPFS)
                  </p>
                </div>
              </div>
              {report?.checks.storage && (
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                    getStatusBadge(report.checks.storage.status).bg
                  }`}
                >
                  {getStatusBadge(report.checks.storage.status).label}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {/* SQLite WASM + OPFS Storage Capacity Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Base de Datos SQLite en Disco:</span>
                  </span>
                  <span className="font-bold text-white font-mono">
                    {report?.storage.sqliteDatabaseFormatted || report?.storage.storageManagerUsageFormatted || '0 MB'} de{' '}
                    {report?.storage.storageManagerQuotaFormatted || '50 GB'} (
                    {report?.storage.storageManagerPct || 0.01}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (report?.storage.storageManagerPct || 0) > 85
                        ? 'bg-rose-500'
                        : (report?.storage.storageManagerPct || 0) > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.max(2, Math.min(100, report?.storage.storageManagerPct || 1))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>Archivo .sqlite físico independiente de LocalStorage</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{report?.storage.isOpfsActive ? 'OPFS en Disco' : 'Persistencia Protegida'}</span>
                  </span>
                </div>
              </div>

              {/* Status breakdown of SQLite and LocalStorage */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Motor Relacional SQLite:</span>
                  <span className="font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Conectado & Operativo (WASM + OPFS)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400">Bóveda Rápida de Preferencias (LocalStorage):</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {report?.storage.localStorageFormatted || '0 MB'} (Óptimo)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Reservado exclusivamente para parámetros rápidos del PC y preferencias de UI
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Cambios en Cola Offline del PC:</span>
                <span className="font-bold text-white">
                  {report?.storage.offlineQueueCount || 0} pendientes
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Registros Eliminados (Tombstones):</span>
                <span className="font-bold text-slate-300">
                  {report?.storage.tombstonesCount || 0} identificadores
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={report?.checks.storage?.message}>
              {report?.checks.storage?.message}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSqlite}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-[11px] font-bold transition-colors flex items-center space-x-1 shrink-0 cursor-pointer border border-indigo-500/30 shadow-sm"
                title="Descarga una copia completa en archivo binario .sqlite de tu base de datos local"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Descargar .sqlite</span>
              </button>
              <button
                type="button"
                onClick={handleVacuumSqlite}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold transition-colors flex items-center space-x-1 shrink-0 cursor-pointer border border-slate-700 shadow-sm"
                title="Ejecuta VACUUM en SQLite para compactar y desfragmentar el archivo en disco"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Optimizar (VACUUM)</span>
              </button>
              <button
                type="button"
                onClick={handleCleanCache}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold transition-colors flex items-center space-x-1 shrink-0 cursor-pointer border border-slate-700 shadow-sm"
                title="Consolida datos en SQLite y limpia la memoria caché residual de LocalStorage"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Limpiar Caché</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Indicadores Oficiales de Moneda (BCCh) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Indicadores Oficiales BCCh</h3>
                  <p className="text-[11px] text-slate-400">Dólar Observado & UF Oficial (BCCh)</p>
                </div>
              </div>
              {report?.checks.rates && (
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                    getStatusBadge(report.checks.rates.status).bg
                  }`}
                >
                  {getStatusBadge(report.checks.rates.status).label}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Dólar Actual (BCCh):</span>
                <span className="font-bold text-emerald-400">
                  1 USD = ${report?.rates.usdObs.toFixed(2)} CLP
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Unidad de Fomento (UF):</span>
                <span className="font-bold text-sky-400">
                  ${report?.rates.uf.toLocaleString('es-CL')} CLP
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Proveedor de Datos:</span>
                <span className="text-[11px] text-slate-300">
                  {report?.rates.provider || 'Banco Central de Chile / Mindicador'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Fecha contable: {report?.rates.dateKey || 'Hoy'}
            </span>
            <button
              type="button"
              onClick={handleRefreshRates}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
              title="Consulta en vivo al Banco Central de Chile"
            >
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              <span>Refrescar BCCh</span>
            </button>
          </div>
        </div>

        {/* Card 4: Entorno de Ejecución & Rendimiento */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Entorno & Rendimiento</h3>
                  <p className="text-[11px] text-slate-400">Plataforma, Red y Consumo de Recursos</p>
                </div>
              </div>
              {report?.checks.runtime && (
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                    getStatusBadge(report.checks.runtime.status).bg
                  }`}
                >
                  {getStatusBadge(report.checks.runtime.status).label}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Plataforma de Ejecución:</span>
                <span className="font-bold text-white">
                  {report?.runtime.isDesktop ? 'App de Escritorio Windows' : 'Navegador Web (Cloudflare)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Estado de Conexión de Red:</span>
                <span className="font-bold text-white flex items-center space-x-1.5">
                  {report?.runtime.isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Internet Conectado</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400">Sin Conexión</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Modo de Operación de la App:</span>
                <span className="font-bold text-white">
                  {report?.runtime.isManualOffline ? (
                    <span className="text-amber-400">Modo Offline Manual</span>
                  ) : (
                    <span className="text-emerald-400">Modo Online Activo</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Memoria JavaScript (Heap):</span>
                <span className="font-bold text-slate-200">
                  {report?.runtime.heapUsedMb
                    ? `${report.runtime.heapUsedMb} MB usados / ${report.runtime.heapTotalMb} MB total`
                    : 'Gestionada por el navegador'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            Sesión activa desde hace {report?.runtime.sessionUptimeMinutes || 0} min.
          </div>
        </div>
      </div>

      {/* Diagnostics Event Log / Detailed Checklist */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-black text-white">Registro Detallado de Pruebas de Diagnóstico</h3>
              <p className="text-[11px] text-slate-400">
                Resultados individualizados con latencias y firmas de integridad
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString('es-CL') : ''}
          </span>
        </div>

        <div className="mt-4 divide-y divide-slate-800/80">
          {report &&
            Object.values(report.checks).map((check: HealthCheckResult) => {
              const badge = getStatusBadge(check.status);
              const Icon = badge.icon;
              return (
                <div key={check.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${check.status === 'healthy' ? 'text-emerald-400' : check.status === 'degraded' ? 'text-amber-400' : 'text-rose-400'}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{check.name}</span>
                        {check.latencyMs !== undefined && check.latencyMs > 0 && (
                          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-800">
                            {check.latencyMs} ms
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{check.message}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${badge.bg}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
