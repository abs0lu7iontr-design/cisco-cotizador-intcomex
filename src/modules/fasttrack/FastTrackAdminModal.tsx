// ============================================================================
// CISCO AUTOMATED - FAST TRACK ADMINISTRATION MODAL & KILL SWITCH
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap,
  X,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Power,
  ShieldCheck,
  TrendingUp,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  getFastTrackStats,
  saveFastTrackCatalog,
  purgeFastTrackDb,
  setFastTrackAuditEnabled,
  getAllFastTrackItems,
  setFastTrackValidUntil,
} from './fastTrackDb';
import { parseFastTrackExcel } from './fastTrackParser';
import { FastTrackProduct, FastTrackDbStats } from './types';

interface FastTrackAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsChange?: (stats: FastTrackDbStats) => void;
}

export function FastTrackAdminModal({
  isOpen,
  onClose,
  onStatsChange,
}: FastTrackAdminModalProps) {
  const [stats, setStats] = useState<FastTrackDbStats>({
    isEnabled: true,
    totalSkus: 0,
    lastUpdated: null,
    validUntil: null,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItems, setPreviewItems] = useState<FastTrackProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Warning modal when toggling OFF
  const [showDisableWarning, setShowDisableWarning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(async () => {
    try {
      const s = await getFastTrackStats();
      setStats(s);
      if (onStatsChange) onStatsChange(s);

      if (s.totalSkus > 0) {
        const items = await getAllFastTrackItems(100);
        setPreviewItems(items);
      } else {
        setPreviewItems([]);
      }
    } catch (e) {
      console.warn('Error refreshing Fast Track stats:', e);
    }
  }, [onStatsChange]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      getFastTrackStats().then(async (s) => {
        if (!isMounted) return;
        setStats(s);
        if (onStatsChange) onStatsChange(s);

        if (s.totalSkus > 0) {
          const items = await getAllFastTrackItems(100);
          if (isMounted) setPreviewItems(items);
        } else {
          if (isMounted) setPreviewItems([]);
        }
      });
      setFeedbackMessage(null);
      setShowDisableWarning(false);
      setSearchQuery('');
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, onStatsChange]);

  if (!isOpen) return null;

  const handleToggleClick = () => {
    if (stats.isEnabled) {
      // If turning OFF while data exists, show persuasive warning modal
      if (stats.totalSkus > 0) {
        setShowDisableWarning(true);
      } else {
        setFastTrackAuditEnabled(false);
        setStats((prev) => ({ ...prev, isEnabled: false }));
        if (onStatsChange) onStatsChange({ ...stats, isEnabled: false });
      }
    } else {
      // Turning ON
      setFastTrackAuditEnabled(true);
      setStats((prev) => ({ ...prev, isEnabled: true }));
      if (onStatsChange) onStatsChange({ ...stats, isEnabled: true });
      setFeedbackMessage({ type: 'success', text: '✅ Auditoría Fast Track activada correctamente.' });
    }
  };

  const handleConfirmDisable = () => {
    setFastTrackAuditEnabled(false);
    setStats((prev) => ({ ...prev, isEnabled: false }));
    if (onStatsChange) onStatsChange({ ...stats, isEnabled: false });
    setShowDisableWarning(false);
    setFeedbackMessage({
      type: 'warning',
      text: '⚠️ Auditoría Fast Track desactivada. Las cotizaciones usarán solo los descuentos del BOM original.',
    });
  };

  const handleUploadClick = () => {
    setFeedbackMessage(null);
    if ((window as any).pywebview?.api?.open_file_dialog) {
      // Desktop bridge
      (window as any).pywebview.api
        .open_file_dialog()
        .then(async (res: any) => {
          if (res && res.success) {
            let buffer: ArrayBuffer;
            if (res.file_base64) {
              const binaryStr = atob(res.file_base64);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              buffer = bytes.buffer;
            } else if (res.file_bytes && Array.isArray(res.file_bytes)) {
              buffer = new Uint8Array(res.file_bytes).buffer;
            } else {
              return;
            }
            await processUploadedCatalog(buffer, res.filename);
          }
        })
        .catch((err: any) => {
          console.error(err);
          setFeedbackMessage({ type: 'error', text: `Error al abrir archivo: ${err?.message || err}` });
        });
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await processUploadedCatalog(buffer, file.name);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Error al procesar archivo.' });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const processUploadedCatalog = async (buffer: ArrayBuffer, fileName: string) => {
    setIsProcessing(true);
    setFeedbackMessage(null);

    try {
      // 1. Parsear archivo Excel y detectar vigencia y metadatos de cabecera A1-A3
      const {
        items,
        detectedValidUntil,
        detectedValidFrom,
        promotionCode,
        promotionTitle,
      } = await parseFastTrackExcel(buffer, fileName);

      // 2. Purgar base previa y guardar en IndexedDB con fecha de vigencia y metadatos
      const { count } = await saveFastTrackCatalog(
        items,
        fileName,
        detectedValidUntil,
        detectedValidFrom,
        promotionCode,
        promotionTitle
      );

      // 3. Activar automáticamente la auditoría
      setFastTrackAuditEnabled(true);

      await refreshData();
      const fromStr = detectedValidFrom
        ? `${new Date(detectedValidFrom).toLocaleDateString('es-CL')} al `
        : '';
      const expNote = detectedValidUntil
        ? ` (Vigencia oficial: ${fromStr}${new Date(detectedValidUntil).toLocaleDateString('es-CL')})`
        : '';
      const promoNote = promotionCode ? ` • Promo: ${promotionCode}` : '';

      setFeedbackMessage({
        type: 'success',
        text: `Catálogo Fast Track importado exitosamente (${count} SKUs)${expNote}${promoNote}.`,
      });
    } catch (err: any) {
      console.error('Error importando Fast Track:', err);
      setFeedbackMessage({
        type: 'error',
        text: `Error al importar catálogo: ${err?.message || err}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurgeDb = async () => {
    if (!window.confirm('¿Estás seguro de que deseas vaciar completamente la base de datos Fast Track?')) {
      return;
    }
    setIsProcessing(true);
    try {
      await purgeFastTrackDb();
      await refreshData();
      setFeedbackMessage({ type: 'success', text: '🗑️ Base de datos Fast Track vaciada correctamente.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Error al vaciar base de datos.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidUntilChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const timestamp = val ? new Date(val + 'T23:59:59').getTime() : null;
    setFastTrackValidUntil(timestamp);
    await refreshData();
  };

  const filteredPreview = previewItems.filter(
    (item) =>
      item.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-amber-950/40 overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Base de Datos & Auditoría Fast Track
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  v3.3 Microservice
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Almacenamiento en IndexedDB cliente y optimización automática de márgenes comerciales.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Expiration Alerts */}
          {stats.totalSkus > 0 && stats.isExpired && (
            <div className="p-4 bg-rose-950/80 border border-rose-600/60 rounded-2xl text-xs text-rose-200 flex items-start space-x-3 shadow-lg animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-100 font-bold block text-sm">⚠️ Catálogo Fast Track OBSOLETO</strong>
                <span className="leading-relaxed">
                  Este catálogo venció el <strong>{stats.validUntilFormatted}</strong>. Debe cargarse un catálogo actualizado de Fast Track para garantizar precios vigentes de Cisco.
                </span>
              </div>
            </div>
          )}

          {stats.totalSkus > 0 && stats.isExpiringSoon && !stats.isExpired && (
            <div className="p-4 bg-amber-950/80 border border-amber-600/60 rounded-2xl text-xs text-amber-200 flex items-start space-x-3 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-100 font-bold block text-sm">⚠️ Alerta: El Catálogo Vence en Menos de 24 Horas</strong>
                <span className="leading-relaxed">
                  El catálogo actual vence el <strong>{stats.validUntilFormatted}</strong>. Por favor solicita y carga la nueva versión antes del vencimiento.
                </span>
              </div>
            </div>
          )}

          {/* Feedback Banner */}
          {feedbackMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center space-x-3 shadow-md ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-200'
                  : feedbackMessage.type === 'warning'
                  ? 'bg-amber-950/80 border border-amber-600/50 text-amber-200'
                  : 'bg-rose-950/80 border border-rose-600/50 text-rose-200'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Promotion Header Banner (Cisco Official Cell A1-A3) */}
          {(stats.promotionTitle || stats.promotionCode || stats.validFromFormatted) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-amber-950/50 border border-blue-500/30 text-xs space-y-1.5 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-blue-300 tracking-wide text-xs">
                  {stats.promotionTitle || 'Cisco Fast Track Promotion Program'}
                </span>
                {stats.promotionCode && (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/40">
                    Promo: {stats.promotionCode}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Vigencia Oficial:{' '}
                  <strong className="text-white">
                    {stats.validFromFormatted ? `${stats.validFromFormatted} - ` : ''}
                    {stats.validUntilFormatted || 'Indefinida'}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Controls & Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kill Switch Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Interruptor Maestro
                </div>
                <Power
                  className={`w-4 h-4 ${
                    stats.isEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-600'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`text-sm font-black ${
                      stats.isEnabled ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {stats.isEnabled ? 'AUDITORÍA ACTIVA' : 'DESACTIVADO'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {stats.isEnabled
                      ? 'Cruzando SKUs al cotizar'
                      : 'Cotizando con BOM original'}
                  </p>
                </div>
                <button
                  onClick={handleToggleClick}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    stats.isEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      stats.isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Catalog Info Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Catálogo Almacenado
              </div>
              <div>
                <div className="text-2xl font-black text-white font-mono">
                  {stats.totalSkus.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {stats.fileName || 'Sin catálogo cargado'}
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                {stats.lastUpdated
                  ? `Actualizado: ${new Date(stats.lastUpdated).toLocaleDateString('es-CL')} ${new Date(stats.lastUpdated).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Requiere archivo oficial (.xlsx)'}
              </div>
            </div>

            {/* Validity Date & Expiration Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Vigencia del Catálogo
                </div>
                <Calendar className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={
                      stats.validUntil
                        ? new Date(stats.validUntil).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={handleValidUntilChange}
                    className="bg-slate-900 border border-slate-700 text-xs px-2.5 py-1 rounded-xl text-slate-200 font-mono focus:border-indigo-500 outline-none"
                    title="Modificar fecha de expiración del catálogo"
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {stats.isExpired ? (
                    <span className="text-rose-400 font-bold">● Catálogo Expirado</span>
                  ) : stats.isExpiringSoon ? (
                    <span className="text-amber-400 font-bold">● Vence hoy o mañana</span>
                  ) : stats.validUntil ? (
                    <span className="text-emerald-400">● Vigente ({stats.daysRemaining}d restantes)</span>
                  ) : (
                    <span className="text-slate-500">● Sin fecha configurada</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleUploadClick}
              disabled={isProcessing}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Procesando Catálogo...' : 'Cargar / Actualizar Excel Fast Track'}</span>
            </button>

            {stats.totalSkus > 0 && (
              <button
                onClick={handlePurgeDb}
                disabled={isProcessing}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Vaciar Base de Datos</span>
              </button>
            )}

            <button
              onClick={refreshData}
              disabled={isProcessing}
              className="inline-flex items-center space-x-2 px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {/* SKUs Explorer */}
          {stats.totalSkus > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-300 flex items-center space-x-2">
                  <span>Muestra de Catálogo ({stats.totalSkus.toLocaleString()} SKUs en IndexedDB)</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar SKU o descripción..."
                    className="w-64 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                      <th className="p-2.5">Part Number</th>
                      <th className="p-2.5">Descripción</th>
                      <th className="p-2.5 text-right">Dcto Fast Track</th>
                      <th className="p-2.5 text-right">Precio Lista</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {filteredPreview.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-500 font-sans">
                          No se encontraron SKUs que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredPreview.map((item) => (
                        <tr key={item.partNumber} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-amber-300 whitespace-nowrap">
                            {item.partNumber}
                          </td>
                          <td className="p-2.5 text-slate-300 font-sans truncate max-w-xs" title={item.description}>
                            {item.description || '-'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">
                            {item.distributorDiscount.toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-right text-slate-400">
                            {item.listPrice ? `$${item.listPrice.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Failsafe activo: El cotizador CCW opera normalmente si Fast Track está vacío o desactivado.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Persuasive Warning Modal when turning OFF */}
      {showDisableWarning && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-950 rounded-2xl border border-rose-600/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">
                ¿Desactivar Auditoría Fast Track?
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ⚠️ <strong>Advertencia de Rentabilidad Comercial:</strong> Al desactivar la auditoría Fast Track, el sistema dejará de buscar mejores precios promocionales automáticamente. Podrías perder oportunidades de maximizar el margen de ganancia en tus cotizaciones.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              Tienes <strong>{stats.totalSkus.toLocaleString()} SKUs</strong> registrados en la base local listos para auditar.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowDisableWarning(false)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Mantener Activado (Recomendado)
              </button>
              <button
                onClick={handleConfirmDisable}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Sí, Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
