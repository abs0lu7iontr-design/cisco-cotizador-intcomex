// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R QUOTE VIEW
// Vista Principal del Cotizador de Servicios y Licencias Cisco CCW-R
// Ingesta de planillas CCW-R, cálculo con Margen en Columna Z, Aranceles,
// Goal Seek, exportación oficial Intcomex de 13 columnas y cruce con Forecast/Pipeline
// ============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Download,
  Copy,
  CheckCircle2,
  TrendingUp,
  Table as TableIcon,
  Search,
  Sparkles,
  Sliders,
  DollarSign,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CcwrHeaderInfo,
  CcwrLineItem,
  CcwrQuoteParameters,
  CcwrFinancialSummary,
  ProcessedCcwrQuote,
  DEFAULT_CCWR_PARAMS,
} from './ccwrTypes';
import { parseCcwrWorkbook } from './ccwrParser';
import { recalculateCcwrQuote, calculateCcwrGoalSeekMargin } from './ccwrPricingEngine';
import { generateCcwrQuoteExcel, generateCcwrEmailHtml, calculateContractDurationMonths } from './ccwrExcelExporter';
import { saveCcwrQuoteHistory, linkCcwrToForecast, linkCcwrToPipeline } from './ccwrStorage';
import { roundFinancial } from '../../core/calculations';
import { useCiscoAutomatedStore } from '../../core/store';
import { detectCiscoFileType } from '../../core/fileTypeDetector';

export function CcwrQuoteView() {
  const { pendingCcwrFile, setPendingCcwrFile, processFileBuffer, setCurrentView } = useCiscoAutomatedStore();

  const [items, setItems] = useState<CcwrLineItem[]>([]);
  const [headerInfo, setHeaderInfo] = useState<CcwrHeaderInfo>({
    quoteNumber: 'S/N',
    endCustomerName: 'EMPRESA DE TRANSPORTE DE PASAJEROS METRO SA',
  });
  const [params, setParams] = useState<CcwrQuoteParameters>(DEFAULT_CCWR_PARAMS);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyServicesWithCost, setOnlyServicesWithCost] = useState<boolean>(true);
  const [goalSeekTarget, setGoalSeekTarget] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isCopiedEmail, setIsCopiedEmail] = useState<boolean>(false);
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);
  const [isGroupsSummaryOpen, setIsGroupsSummaryOpen] = useState<boolean>(false);
  const [misroutedEstimate, setMisroutedEstimate] = useState<{
    isOpen: boolean;
    fileName: string;
    buffer: ArrayBuffer;
    estimateId?: string;
    customerName?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ingesta automática si el archivo fue redirigido desde el módulo CCW Estimate
  useEffect(() => {
    if (pendingCcwrFile) {
      try {
        setIsLoading(true);
        const parsed = parseCcwrWorkbook(pendingCcwrFile.buffer, pendingCcwrFile.fileName);
        setHeaderInfo(parsed.headerInfo);
        setItems(parsed.items);
        setFileName(pendingCcwrFile.fileName);
        setFeedbackMessage({
          type: 'success',
          text: `✅ Cotización CCW-R #${parsed.headerInfo.quoteNumber || ''} abierta y procesada con margen inicial del 5%.`,
        });
      } catch (err: any) {
        setFeedbackMessage({
          type: 'error',
          text: `Error al abrir cotización CCW-R: ${err?.message || 'Error desconocido'}`,
        });
      } finally {
        setIsLoading(false);
        setPendingCcwrFile(null);
      }
    }
  }, [pendingCcwrFile, setPendingCcwrFile]);

  // Recalcular finanzas en vivo
  const { calculatedItems, summary } = useMemo(() => {
    return recalculateCcwrQuote(items, params, onlyServicesWithCost);
  }, [items, params, onlyServicesWithCost]);

  // Vigencia del contrato calculada en meses
  const durationMonths = useMemo(() => {
    return calculateContractDurationMonths(items);
  }, [items]);

  // Ítems filtrados por búsqueda
  const filteredItems = useMemo(() => {
    const list = onlyServicesWithCost
      ? calculatedItems.filter((it) => it.isServiceOrLicense && it.extendedNetPrice > 0)
      : calculatedItems;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();

    return list.filter(
      (it) =>
        it.productNumber.toLowerCase().includes(q) ||
        it.serviceSku.toLowerCase().includes(q) ||
        it.serialNumber.toLowerCase().includes(q) ||
        it.productDescription.toLowerCase().includes(q) ||
        it.serviceLevel.toLowerCase().includes(q) ||
        it.endCustomerName.toLowerCase().includes(q)
    );
  }, [calculatedItems, searchQuery, onlyServicesWithCost]);

  // Manejo de carga de archivo CCW-R
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const buffer = await file.arrayBuffer();

      // Verificación de formato: Si el usuario subió por error un Price Estimate en el módulo CCW-R
      const detection = detectCiscoFileType(buffer);
      if (detection.fileType === 'ccw_estimate') {
        setMisroutedEstimate({
          isOpen: true,
          fileName: file.name,
          buffer,
          estimateId: detection.estimateId,
          customerName: detection.customerName,
        });
        setIsLoading(false);
        return;
      }

      const parsed = parseCcwrWorkbook(buffer, file.name);

      setHeaderInfo(parsed.headerInfo);
      setItems(parsed.items);
      setFileName(file.name);

      // Guardar en historial
      const processed: ProcessedCcwrQuote = {
        fileName: file.name,
        headerInfo: parsed.headerInfo,
        items: parsed.items,
        params,
        summary: recalculateCcwrQuote(parsed.items, params, onlyServicesWithCost).summary,
        processedAt: new Date().toISOString(),
      };
      await saveCcwrQuoteHistory(processed);

      setFeedbackMessage({
        type: 'success',
        text: `¡Cotización CCW-R #${parsed.headerInfo.quoteNumber} cargada con éxito! ${parsed.items.length} ítems procesados.`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: `Error al procesar archivo CCW-R: ${err?.message || err}`,
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  // Exportar Excel oficial Intcomex
  const handleExportExcel = async () => {
    if (items.length === 0) return;
    try {
      setIsLoading(true);
      const buffer = await generateCcwrQuoteExcel(calculatedItems, headerInfo, params, summary, onlyServicesWithCost);

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanCustomer = (headerInfo.endCustomerName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
      a.href = url;
      a.download = `Cotizacion_CCWR_Servicios_${headerInfo.quoteNumber || 'S-N'}_${cleanCustomer}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedbackMessage({
        type: 'success',
        text: 'Planilla Excel oficial generada y descargada exitosamente.',
      });
    } catch (err: any) {
      alert(`Error exportando Excel: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // Copiar resumen de correo Outlook
  const handleCopyEmail = async () => {
    if (items.length === 0) return;
    try {
      const html = generateCcwrEmailHtml(headerInfo, summary, params);
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);

      setIsCopiedEmail(true);
      setFeedbackMessage({
        type: 'success',
        text: '¡Resumen de cotización copiado al portapapeles con formato listo para Outlook!',
      });
      setTimeout(() => {
        setIsCopiedEmail(false);
        setFeedbackMessage(null);
      }, 4000);
    } catch (err) {
      alert('No se pudo copiar al portapapeles automáticamente.');
    }
  };

  // Ejecutar Buscador de Objetivo (Goal Seek)
  const handleGoalSeek = () => {
    const target = parseFloat(goalSeekTarget.replace(/[^0-9.]/g, ''));
    if (isNaN(target) || target <= 0) {
      alert('Ingresa un monto objetivo válido mayor a cero.');
      return;
    }

    const res = calculateCcwrGoalSeekMargin(items, target, params, onlyServicesWithCost);
    if (res.success) {
      setParams((prev) => ({ ...prev, margenPct: res.targetMarginPct }));
      setFeedbackMessage({
        type: 'success',
        text: `¡Objetivo alcanzado! Margen ajustado a ${res.targetMarginPct}% para totalizar $${res.achievedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`,
      });
    } else {
      setFeedbackMessage({
        type: 'info',
        text: `Monto ajustado al piso mínimo posible ($${res.achievedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD a 0% de margen).`,
      });
    }
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Vincular con Forecast
  const handleLinkToForecast = async () => {
    if (items.length === 0) return;
    try {
      const processed: ProcessedCcwrQuote = {
        fileName: fileName || 'Cotizacion_CCWR.xlsx',
        headerInfo,
        items: calculatedItems,
        params,
        summary,
        processedAt: new Date().toISOString(),
      };
      const res = await linkCcwrToForecast(processed, 'Intcomex');
      setFeedbackMessage({
        type: 'success',
        text: res.isNew
          ? `¡Oportunidad #${headerInfo.quoteNumber} registrada exitosamente en Forecast Comercial!`
          : `¡Oportunidad #${headerInfo.quoteNumber} actualizada en Forecast Comercial sin duplicaciones!`,
      });
    } catch (err: any) {
      alert(`Error vinculando con Forecast: ${err?.message || err}`);
    } finally {
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  // Vincular con Pipeline
  const handleLinkToPipeline = async () => {
    if (items.length === 0) return;
    try {
      const processed: ProcessedCcwrQuote = {
        fileName: fileName || 'Cotizacion_CCWR.xlsx',
        headerInfo,
        items: calculatedItems,
        params,
        summary,
        processedAt: new Date().toISOString(),
      };
      const res = await linkCcwrToPipeline(processed, 'Intcomex');
      setFeedbackMessage({
        type: 'success',
        text: res.isNew
          ? `¡Negocio #${headerInfo.quoteNumber} incorporado al Pipeline Comercial!`
          : `¡Negocio #${headerInfo.quoteNumber} enriquecido en el Pipeline Comercial sin duplicar!`,
      });
    } catch (err: any) {
      alert(`Error vinculando con Pipeline: ${err?.message || err}`);
    } finally {
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Banner / Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 shrink-0 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Cotizador CCW-R (Servicios & Licencias)
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Cisco CCW-R
                </span>
                {headerInfo.quoteNumber && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                    Quote #{headerInfo.quoteNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingesta de cotizaciones CCW-R, margen aplicado sobre Columna Z (Extended Net Price), arancel y formato oficial Intcomex
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload File */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Cargando...' : 'Cargar Quote CCW-R'}</span>
            </button>

            {/* Export Official Excel */}
            <button
              onClick={handleExportExcel}
              disabled={items.length === 0 || isLoading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              title="Descargar planilla oficial de cotización Intcomex (13 columnas)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Descargar Excel Oficial</span>
            </button>

            {/* Copy Email Summary */}
            <button
              onClick={handleCopyEmail}
              disabled={items.length === 0}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              title="Copiar tabla en HTML lista para pegar en Outlook"
            >
              {isCopiedEmail ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{isCopiedEmail ? '¡Copiado!' : 'Copiar Correo'}</span>
            </button>

            {/* Link to Forecast */}
            <button
              onClick={handleLinkToForecast}
              disabled={items.length === 0}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-indigo-300 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              title="Vincular con Forecast Comercial sin duplicar"
            >
              <TableIcon className="w-4 h-4 text-indigo-400" />
              <span>A Forecast</span>
            </button>

            {/* Link to Pipeline */}
            <button
              onClick={handleLinkToPipeline}
              disabled={items.length === 0}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-sky-300 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              title="Vincular con Pipeline Comercial sin duplicar"
            >
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>A Pipeline</span>
            </button>

            {/* Parameters Drawer Toggle */}
            <button
              onClick={() => setIsParamDrawerOpen(!isParamDrawerOpen)}
              className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                isParamDrawerOpen
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Configurar Parámetros Comerciales (Margen, Arancel, Internación, Goal Seek)"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 transition-all animate-fadeIn ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                : feedbackMessage.type === 'error'
                ? 'bg-rose-950/60 border-rose-600/40 text-rose-300'
                : 'bg-sky-950/60 border-sky-600/40 text-sky-300'
            }`}
          >
            <Info className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center: Dashboard Cards + Table */}
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-2.5 overflow-hidden">
          {/* KPI Summary Cards (Compact Executive Ribbon) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
            {/* Total Sale Price */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm relative overflow-hidden">
              <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                Total Venta Cotización
              </div>
              <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                ${summary.totalPrecioVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Con margen del {params.margenPct}% aplicado
              </div>
            </div>

            {/* Cost Cisco Col Z */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
              <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                Costo Neto Cisco (Col Z)
              </div>
              <div className="text-lg font-bold font-mono text-sky-300 mt-0.5">
                ${summary.totalExtendedNetCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Extended Net Price CCW-R
              </div>
            </div>

            {/* Gross Margin */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
              <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                Margen Bruto Intcomex
              </div>
              <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                ${summary.margenBrutoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5">
                {summary.margenBrutoPct}% sobre venta
              </div>
            </div>

            {/* Total Serials / Items */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
              <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                Dispositivos / Seriales
              </div>
              <div className="text-lg font-bold font-mono text-purple-300 mt-0.5">
                {summary.totalQuantity} <span className="text-xs text-slate-400 font-normal">unidades</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {summary.uniqueSerialsCount} seriales únicos
              </div>
            </div>

            {/* End Customer / Validity */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                Vigencia / Cliente Final
              </div>
              <div className="text-sm font-bold text-white mt-0.5 truncate">
                {durationMonths} Meses de Cobertura
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={headerInfo.endCustomerName}>
                {headerInfo.endCustomerName || 'Cliente Final'}
              </div>
            </div>
          </div>

          {/* Aesthetic Margin Bar (100% Intangibles) */}
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl px-3.5 py-2 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
            {/* Left: Margin slider + presets */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Margen Comercial:
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {params.margenPct.toFixed(1)}%
                </span>
              </div>

              {/* Glowing Slider */}
              <div className="w-32 sm:w-44 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.1"
                  value={params.margenPct}
                  onChange={(e) => setParams({ ...params, margenPct: parseFloat(e.target.value) || 0 })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:accent-emerald-300"
                  title={`Margen: ${params.margenPct}%`}
                />
              </div>

              {/* Quick Preset Pills */}
              <div className="flex items-center gap-1">
                {[3, 5, 8, 10, 12, 15].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setParams({ ...params, margenPct: preset })}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      Math.abs(params.margenPct - preset) < 0.05
                        ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 font-bold'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Inline Goal Seek + Group Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Inline Goal Seek */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] text-slate-400 font-medium">Objetivo USD:</span>
                <input
                  type="text"
                  value={goalSeekTarget}
                  onChange={(e) => setGoalSeekTarget(e.target.value)}
                  placeholder={`$ ${summary.totalPrecioVenta.toFixed(0)}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGoalSeek(); }}
                  className="w-24 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleGoalSeek}
                  disabled={items.length === 0}
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-all disabled:opacity-40 cursor-pointer"
                  title="Calcular margen exacto para la cifra objetivo"
                >
                  Calcular
                </button>
              </div>

              {/* Resumen Grupos Toggle */}
              {summary.byProduct.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsGroupsSummaryOpen(!isGroupsSummaryOpen)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isGroupsSummaryOpen
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title="Mostrar u ocultar desglose de grupos por modelo"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Grupos ({summary.byProduct.length})</span>
                  {isGroupsSummaryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

          {/* Product Groups Summary Banner (Collapsible to save vertical space) */}
          {isGroupsSummaryOpen && summary.byProduct.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-sm shrink-0 max-h-44 overflow-y-auto custom-scrollbar animate-fadeIn">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Resumen Agrupado por Modelo y Servicio ({summary.byProduct.length} grupos)</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Precios unitarios calculados listos para la cotización final
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {summary.byProduct.map((group, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-400 font-mono">{group.productNumber}</div>
                        <div className="text-[11px] text-slate-300 line-clamp-1">{group.description}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          SKU: <span className="font-mono text-slate-200">{group.serviceSku}</span> ({group.serviceLevel})
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                        {group.totalQty} unid.
                      </span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Unit Venta:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        ${group.unitSalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span className="text-slate-400 text-[11px]">Subtotal Grupo:</span>
                      <span className="font-mono font-bold text-white">
                        ${group.totalSalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Bar & View Toggles */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por SKU, serial, modelo o cliente..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setOnlyServicesWithCost(!onlyServicesWithCost)}
                className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  onlyServicesWithCost
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Alternar entre ver solo servicios cotizables o todas las líneas de CCW-R"
              >
                {onlyServicesWithCost ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{onlyServicesWithCost ? 'Solo Servicios con Costo' : 'Mostrar Todas las Líneas'}</span>
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {filteredItems.length} {filteredItems.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>
          </div>

          {/* Detailed Line Items Table (Expanded High-Vision Viewport) */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20 text-center">
              <FileText className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300">
                Ninguna cotización CCW-R cargada todavía
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Haz clic en el botón superior o arrastra un archivo Excel exportado desde Cisco CCW-R (.xlsx o .xls) para comenzar a cotizar con formato Intcomex.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Upload className="w-4 h-4" />
                <span>Seleccionar Archivo CCW-R</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-[380px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#92D050] text-slate-950 sticky top-0 z-20 font-bold border-b border-emerald-700 shadow-sm">
                    <tr>
                      <th className="py-2 px-3 text-center w-12 border-r border-emerald-600">#</th>
                      <th className="py-2 px-3 border-r border-emerald-600">Product Number</th>
                      <th className="py-2 px-3 border-r border-emerald-600">Descripción del Producto</th>
                      <th className="py-2 px-3 border-r border-emerald-600">PAK / Serial Number</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-center">Nivel</th>
                      <th className="py-2 px-3 border-r border-emerald-600">SKU de Servicio</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-center">Inicio</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-center">Término</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-center w-14">Cant</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-right">Costo Neto (Z)</th>
                      <th className="py-2 px-3 border-r border-emerald-600 text-right">Unit Venta</th>
                      <th className="py-2 px-3 text-right">Total Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredItems.map((it, idx) => (
                      <tr
                        key={it.id || idx}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          idx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {it.lineNumber}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-medium text-slate-200">
                          {it.productNumber}
                        </td>
                        <td className="py-1.5 px-3 text-slate-300 max-w-xs truncate" title={it.productDescription}>
                          {it.productDescription}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-emerald-400 font-semibold select-all">
                          {it.serialNumber || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                            {it.serviceLevel || 'SNT'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-mono text-slate-200">
                          {it.serviceSku || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-400 text-[11px]">
                          {it.startDate || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-400 text-[11px]">
                          {it.endDate || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-200">
                          {it.quantity}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-sky-300">
                          ${it.unitNetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-400">
                          ${it.precioVentaUnitario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-white">
                          ${it.precioVentaExtendido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Foot Totals (Sticky Bottom) */}
                  <tfoot className="bg-slate-900 border-t-2 border-slate-700 font-bold sticky bottom-0 z-20 text-xs shadow-md">
                    <tr>
                      <td colSpan={8} className="py-2.5 px-4 text-right text-slate-300 uppercase tracking-wider">
                        Totales ({filteredItems.length} ítems):
                      </td>
                      <td className="py-2.5 px-3 text-center text-white font-mono font-bold">
                        {filteredItems.reduce((acc, it) => acc + it.quantity, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-400 font-mono font-bold">
                        ${filteredItems.reduce((acc, it) => acc + it.extendedNetPrice, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                        Margen {params.margenPct}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-mono text-sm font-bold">
                        ${filteredItems.reduce((acc, it) => acc + it.precioVentaExtendido, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Drawer: Commercial Parameters & Goal Seek */}
        {isParamDrawerOpen && (
          <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 p-5 space-y-6 overflow-y-auto custom-scrollbar animate-slide-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Parámetros Comerciales</h3>
              </div>
              <button
                onClick={() => setIsParamDrawerOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Margen Comercial Intcomex (%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Margen Comercial Intcomex:</label>
                <span className="text-xs font-mono font-bold text-emerald-400">{params.margenPct.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.1"
                value={params.margenPct}
                onChange={(e) => setParams({ ...params, margenPct: parseFloat(e.target.value) || 0 })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="0.1"
                  value={params.margenPct}
                  onChange={(e) => setParams({ ...params, margenPct: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">% sobre precio venta</span>
              </div>
            </div>

            {/* Arancel Aduanero (%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Arancel Aduanero (%):</label>
                <span className="text-xs font-mono font-bold text-purple-400">{params.arancelPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={params.arancelPct}
                  onChange={(e) => setParams({ ...params, arancelPct: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                />
                <span className="text-[11px] text-slate-400">Por defecto 0% en servicios</span>
              </div>
            </div>

            {/* Internación (%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Internación (%):</label>
                <span className="text-xs font-mono font-bold text-sky-400">{params.internacionPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={params.internacionPct}
                  onChange={(e) => setParams({ ...params, internacionPct: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right font-mono text-sky-300 focus:outline-none focus:border-sky-500"
                />
                <span className="text-[11px] text-slate-400">Por defecto 0% en intangibles</span>
              </div>
            </div>

            {/* Goal Seek (Buscador de Objetivo) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Buscador de Objetivo (Goal Seek)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Calcula automáticamente el porcentaje de margen exacto para alcanzar una cifra final específica.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-300">Monto Venta Deseado (USD):</label>
                <input
                  type="text"
                  value={goalSeekTarget}
                  onChange={(e) => setGoalSeekTarget(e.target.value)}
                  placeholder="Ej: 12329.81"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-right font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleGoalSeek}
                disabled={items.length === 0}
                className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Calcular Margen Automático</span>
              </button>
            </div>

            {/* Datos de Encabezado de la Cotización */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-200">Datos de Cabecera para Excel</h4>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Vendedor / PM:</label>
                <input
                  type="text"
                  value={params.sellerName}
                  onChange={(e) => setParams({ ...params, sellerName: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Empresa:</label>
                <input
                  type="text"
                  value={params.companyName}
                  onChange={(e) => setParams({ ...params, companyName: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Dirección:</label>
                <input
                  type="text"
                  value={params.companyAddress}
                  onChange={(e) => setParams({ ...params, companyAddress: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Teléfono / Móvil:</label>
                <input
                  type="text"
                  value={params.sellerPhone}
                  onChange={(e) => setParams({ ...params, sellerPhone: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Modal de Advertencia cuando se sube un Price Estimate en CCW-R */}
      {misroutedEstimate?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  Price Estimate Detectado
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  ¿Deseas abrir en Cotizador Cisco CCW?
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-6">
              <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{misroutedEstimate.fileName}</p>
                  <p className="text-[11px] text-slate-400">
                    Cisco CCW Price Estimate{misroutedEstimate.estimateId ? ` #${misroutedEstimate.estimateId}` : ''}
                  </p>
                </div>
              </div>
              <p>
                El archivo subido corresponde a un <strong className="text-white">Price Estimate de Cisco CCW</strong> (Hardware / Software estándar), no a una cotización de contratos de servicios CCW-R.
              </p>
              <p className="text-slate-400">
                ¿Deseas cargarlo en el módulo principal <strong>Cotizador Cisco CCW</strong> para procesar la lista de materiales, reglas de madre-hijo y descuentos?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setMisroutedEstimate(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const safeBuf = misroutedEstimate.buffer;
                  const fName = misroutedEstimate.fileName;
                  setMisroutedEstimate(null);
                  setCurrentView('quoter');
                  await processFileBuffer(safeBuf, fName);
                }}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <span>Abrir en Cotizador Cisco CCW</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
