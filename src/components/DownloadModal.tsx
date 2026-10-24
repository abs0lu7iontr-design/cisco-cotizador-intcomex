// ============================================================================
// CISCO AUTOMATED v2.1 - DOWNLOAD MODAL (DESKTOP & CLEAN WEB SEPARATION)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Download,
  FolderOpen,
  X,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Building2,
  Users2,
  FileText,
  Globe,
  Layers,
  Lock,
  Unlock,
  Cloud,
  Mail,
  FileSpreadsheet,
  Coins,
  Check,
  Printer,
  Sparkles,
} from 'lucide-react';
import { generateOptimizedWorkbook, synthesizeOfficialEstimateWorkbook } from '../core/excelEngine';
import { QuoteParameters, OverrideRuleType, EstimateHeaderInfo } from '../core/types';
import { getMotherLineKey } from '../core/calculations';
import { generateQuotationFileName, resolveEffectiveQuoteRates } from '../core/exportUtils';
import { useCiscoAutomatedStore } from '../core/store';
import {
  isDesktopApp,
  saveDesktopExcelFile,
  saveStructuredDesktopEstimate,
  openFolderInExplorer,
  openDesktopEmailClient,
} from '../core/desktopBridge';
import { copyHtmlAndTextToClipboard } from '../core/emailClipboardHelper';
import {
  EstimateExportGroupingOptions,
  categorizeEstimateItems,
  generateCommercialPdfHtml,
  generatePartnerEmailDraft,
  triggerPrintCommercialPdf,
  formatUSD,
  formatCLP,
} from '../modules/estimate';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPartner?: string;
  defaultClient?: string;
  defaultModel?: string;
  defaultFilename?: string;
  workbookBuffer: ArrayBuffer;
  rawWorkbookBuffer?: ArrayBuffer | null;
  params?: QuoteParameters;
  customOverrides?: Record<number, OverrideRuleType>;
  promoNetPrices?: Record<number, number>;
  headerInfo?: EstimateHeaderInfo;
  isRecalculated?: boolean;
  isOnlyLicensing?: boolean;
}

export function DownloadModal({
  isOpen,
  onClose,
  defaultPartner,
  defaultClient,
  defaultModel = 'Cisco',
  defaultFilename,
  workbookBuffer,
  rawWorkbookBuffer,
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  customOverrides,
  promoNetPrices,
  headerInfo,
  isRecalculated,
  isOnlyLicensing,
}: DownloadModalProps) {
  const {
    saveCurrentEstimateToCloud,
    processedResult,
    estimateVersionNumber,
    estimateVersionTag,
  } = useCiscoAutomatedStore();
  const isDesktop = isDesktopApp();

  const computeCorporateFilename = (
    pName?: string,
    cName?: string,
    mName?: string,
    currentParams?: QuoteParameters
  ) => {
    const activeParams = currentParams || params;
    const hasActiveCustomLines = Boolean(
      activeParams?.parameterMode === 'custom_lines' &&
      activeParams?.lineCustomParams &&
      Object.keys(activeParams.lineCustomParams).length > 0
    );
    const isRecalc = Boolean(
      isRecalculated ||
      hasActiveCustomLines ||
      (activeParams && ((!isOnlyLicensing && activeParams.internacionPct !== 7.0) || activeParams.margenPct !== 5.0)) ||
      (customOverrides && Object.keys(customOverrides).length > 0) ||
      (estimateVersionNumber > 1)
    );

    let tech = mName || defaultModel || 'Cisco';
    if (!mName && !defaultModel && defaultFilename) {
      const cleanBase = defaultFilename.replace(/\.[^/.]+$/, '');
      const parts = cleanBase.split(/[_.\s-]+/);
      if (parts.length >= 3 && !parts[2].match(/^(estimate|calc|recalc|int\d+|ma\d+|i\d+|m\d+|i\d+m\d+|\d+|v\d+)$/i)) {
        tech = parts[2];
      }
    }

    const effectiveRates = resolveEffectiveQuoteRates(activeParams, processedResult?.items);

    return generateQuotationFileName({
      partner: pName || defaultPartner || headerInfo?.companyName || 'Intcomex',
      customerName: cName || defaultClient || headerInfo?.customerName || 'Cliente',
      technologyOrFamily: tech,
      dealId: headerInfo?.dealId,
      estimateId: headerInfo?.estimateId || 'ESTIMATE',
      internacionPct: effectiveRates.internacionPct,
      marginPct: effectiveRates.marginPct,
      arancelPct: effectiveRates.arancelPct,
      isRecalculated: isRecalc,
      isOnlyLicensing,
      versionNumber: estimateVersionNumber,
      params: activeParams,
      items: processedResult?.items,
    });
  };

  const [partnerName, setPartnerName] = useState(defaultPartner || headerInfo?.companyName || 'Intcomex');
  const [clientName, setClientName] = useState(defaultClient || headerInfo?.customerName || 'Cliente Final');
  const [modelName, setModelName] = useState(defaultModel || 'Cisco');
  const [filename, setFilename] = useState(() =>
    computeCorporateFilename(defaultPartner, defaultClient, defaultModel, params)
  );

  // Export Format & Features
  const [exportFormat, setExportFormat] = useState<'unified' | 'by_line'>('unified');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(true);
  const [enableClp, setEnableClp] = useState(false);
  const [clpExchangeRate, setClpExchangeRate] = useState(950);

  // UI state
  const [showDetails, setShowDetails] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [cloudSaveNote, setCloudSaveNote] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{
    filepath?: string;
    folder?: string;
    message?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Solution summary analysis
  const activeItems = processedResult?.items || [];
  const solutionSummary = categorizeEstimateItems(
    activeItems,
    exportFormat === 'by_line' ? selectedLine : 'ALL'
  );
  const effectiveRates = resolveEffectiveQuoteRates(params, activeItems);
  const totalClp = solutionSummary.grandTotal * clpExchangeRate;

  // Actualización reactiva en vivo del nombre de archivo al mover parámetros o cambiar de modo
  useEffect(() => {
    const currentPartner = partnerName || defaultPartner || headerInfo?.companyName || 'Intcomex';
    const currentClient = clientName || defaultClient || headerInfo?.customerName || 'Cliente Final';
    const currentModel = modelName || defaultModel || 'Cisco';
    setFilename(computeCorporateFilename(currentPartner, currentClient, currentModel, params));
  }, [
    params?.internacionPct,
    params?.margenPct,
    params?.parameterMode,
    params?.lineCustomParams,
    processedResult?.items,
    defaultPartner,
    defaultClient,
    defaultModel,
    headerInfo?.estimateId,
    headerInfo?.dealId,
    isRecalculated,
    isOnlyLicensing,
    estimateVersionNumber,
  ]);

  // Reset modal state completely every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setSaveSuccess(null);
      setErrorMessage(null);
      setEmailNotice(null);
      setIsSaving(false);
      setShowDetails(false);
      setShowPreview(false);
      setIsRestricted(false);
      setCloudSaveNote(null);
      const initialPartner = defaultPartner || headerInfo?.companyName || 'Intcomex';
      const initialClient = defaultClient || headerInfo?.customerName || 'Cliente Final';
      const initialModel = defaultModel || 'Cisco';
      setPartnerName(initialPartner);
      setClientName(initialClient);
      setModelName(initialModel);
      setFilename(computeCorporateFilename(initialPartner, initialClient, initialModel, params));
    }
  }, [isOpen, defaultPartner, defaultClient, defaultModel, params, processedResult?.items]);

  const handlePartnerChange = (val: string) => {
    setPartnerName(val);
    setFilename(computeCorporateFilename(val, clientName, modelName, params));
  };

  const handleClientChange = (val: string) => {
    setClientName(val);
    setFilename(computeCorporateFilename(partnerName, val, modelName, params));
  };

  const handleModelChange = (val: string) => {
    setModelName(val);
    setFilename(computeCorporateFilename(partnerName, clientName, val, params));
  };

  if (!isOpen) return null;

  const currentMonthName = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date());
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const getCleanFilename = () => {
    let fn = filename.trim();
    if (!fn.toLowerCase().endsWith('.xlsx')) fn += '.xlsx';
    return fn;
  };

  const sanitizeFolderName = (name: string) =>
    (name || '').trim().replace(/[\\/*?:"<>|]/g, '') || 'General';

  const groupingOptions: EstimateExportGroupingOptions = {
    groupByLine: exportFormat === 'by_line',
    selectedLine,
    showExecutiveSummary,
    enableClp,
    clpExchangeRate: enableClp ? clpExchangeRate : 0,
  };

  const getTargetBuffer = async (): Promise<ArrayBuffer> => {
    if (rawWorkbookBuffer) {
      const { modifiedBuffer } = await generateOptimizedWorkbook(
        rawWorkbookBuffer,
        params,
        getCleanFilename(),
        customOverrides,
        promoNetPrices,
        processedResult || undefined,
        groupingOptions
      );
      return modifiedBuffer;
    }
    if (
      workbookBuffer &&
      workbookBuffer.byteLength > 0 &&
      exportFormat === 'unified' &&
      !enableClp &&
      showExecutiveSummary
    ) {
      return workbookBuffer;
    }
    // Síntesis oficial para cotizaciones de la nube o con opciones de agrupación/CLP
    if (processedResult) {
      return await synthesizeOfficialEstimateWorkbook(
        processedResult,
        params,
        customOverrides,
        groupingOptions
      );
    }
    throw new Error('No hay datos disponibles para generar la cotización.');
  };

  // Traditional browser download fallback (Web environment)
  const browserDownload = async (name: string, buffer: ArrayBuffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Automatic Cloud Persistence right after download (asynchronous, non-blocking)
  const persistToCloudAfterDownload = async (cleanFile: string) => {
    try {
      setCloudSaveNote('☁️ Sincronizando respaldo con Historial Cloud...');
      const cloudRes = await saveCurrentEstimateToCloud({
        partnerName: partnerName.trim() || defaultPartner || 'Intcomex',
        clientFinalName: clientName.trim() || defaultClient || 'Cliente Final',
        modelName: modelName.trim() || defaultModel || 'Cisco',
        originalFileName: cleanFile,
        isRestricted,
        versionNumber: estimateVersionNumber,
        versionTag: estimateVersionTag,
      });
      if (cloudRes.success) {
        const vBadge = estimateVersionTag || `v${estimateVersionNumber}`;
        setCloudSaveNote(
          isRestricted
            ? `🔒 Guardado en Historial Cloud (${vBadge}) con acceso restringido.`
            : `☁️ Guardado automáticamente en Historial Cloud (${vBadge} - visible para el equipo).`
        );
      } else {
        setCloudSaveNote('💾 Guardado localmente en historial.');
      }
    } catch (e) {
      console.warn('Auto cloud save warning:', e);
      setCloudSaveNote('💾 Guardado localmente en historial.');
    }
  };

  // Primary action: save into gravity_storage in Desktop, or standard download in Web
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const cleanPartner = sanitizeFolderName(partnerName);
    const cleanClient = sanitizeFolderName(clientName);
    const cleanFile = getCleanFilename();

    try {
      const targetBuffer = await getTargetBuffer();

      if (isDesktop) {
        if (!partnerName.trim() || !clientName.trim()) {
          setErrorMessage('Por favor completa el Canal/Partner y el Cliente Final.');
          setIsSaving(false);
          return;
        }

        const res = await saveStructuredDesktopEstimate(
          cleanPartner,
          cleanClient,
          cleanFile,
          targetBuffer
        );
        if (res?.success) {
          setSaveSuccess({
            filepath: res.filePath,
            folder: res.folder,
            message: `Guardado en: gravity_storage › ${cleanPartner} › ${cleanClient} › ${res.month || ''} › ${res.filename || cleanFile}`,
          });
          setIsSaving(false);
          persistToCloudAfterDownload(cleanFile);
        } else {
          setErrorMessage(res?.error || 'Error guardando el archivo.');
          setIsSaving(false);
        }
      } else {
        await browserDownload(cleanFile, targetBuffer);
        setSaveSuccess({
          message: `Archivo '${cleanFile}' descargado exitosamente en tu carpeta de Descargas.`,
        });
        setIsSaving(false);
        persistToCloudAfterDownload(cleanFile);
      }
    } catch (err: any) {
      console.error('Error exportando estimate:', err);
      setErrorMessage('Error al exportar: ' + (err?.message || 'Error desconocido'));
      setIsSaving(false);
    }
  };

  // Secondary action: choose custom location or direct download
  const handleChooseLocation = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const cleanFile = getCleanFilename();
    try {
      const targetBuffer = await getTargetBuffer();
      if (isDesktop) {
        const res = await saveDesktopExcelFile(cleanFile, targetBuffer);
        if (res?.success) {
          setSaveSuccess({ filepath: res.filePath, message: `Guardado en: ${res.filePath}` });
          setIsSaving(false);
          persistToCloudAfterDownload(cleanFile);
        } else if (!res?.cancelled) {
          setErrorMessage(res?.error || 'Error al guardar.');
          setIsSaving(false);
        } else {
          setIsSaving(false);
        }
      } else {
        await browserDownload(cleanFile, targetBuffer);
        setSaveSuccess({ message: `Archivo '${cleanFile}' descargado exitosamente.` });
        setIsSaving(false);
        persistToCloudAfterDownload(cleanFile);
      }
    } catch (err: any) {
      setErrorMessage('Error: ' + err?.message);
      setIsSaving(false);
    }
  };

  const handleOpenFolder = async () => {
    if (saveSuccess?.folder) {
      await openFolderInExplorer(saveSuccess.folder);
    }
  };

  // Idea 2: Exportación / Descarga en PDF Comercial
  const handleDownloadPdf = () => {
    try {
      const html = generateCommercialPdfHtml({
        headerInfo,
        partnerName: partnerName.trim() || 'Intcomex',
        clientName: clientName.trim() || 'Cliente Final',
        summary: solutionSummary,
        groupingOptions,
      });
      triggerPrintCommercialPdf(html);
    } catch (err: any) {
      console.error('Error generando PDF:', err);
      setErrorMessage('No se pudo generar el PDF: ' + (err?.message || 'Error desconocido'));
    }
  };

  // Idea 3: Botón 1-Clic para Redactar Correo al Partner en Outlook
  const handleEmailPartner = async () => {
    try {
      const { subject, bodyText, bodyHtml } = generatePartnerEmailDraft({
        partnerName: partnerName.trim() || 'Intcomex',
        clientName: clientName.trim() || 'Cliente Final',
        dealId: headerInfo?.dealId,
        estimateId: headerInfo?.estimateId,
        summary: solutionSummary,
        groupingOptions,
      });

      // 1. Copiar HTML enriquecido al portapapeles para pegado nativo en Outlook
      await copyHtmlAndTextToClipboard(bodyHtml, bodyText);

      // 2. Abrir Outlook nativo o enlace mailto
      const openedInDesktop = await openDesktopEmailClient('', '', subject, bodyText);
      if (!openedInDesktop) {
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
        window.location.href = mailtoUrl;
      }

      setEmailNotice('¡Borrador abierto en Outlook y formato enriquecido copiado al portapapeles!');
      setTimeout(() => setEmailNotice(null), 5000);
    } catch (err: any) {
      console.error('Error al redactar correo:', err);
      setErrorMessage('Error al preparar el correo: ' + (err?.message || 'Error desconocido'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full border border-slate-800 overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                Descargar Cotización
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  v{estimateVersionNumber}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">
                Excel Optimizado CCW · PDF Comercial · Email Partner · Respaldo Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-600/50 rounded-xl text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email Notification Alert */}
          {emailNotice && (
            <div className="p-3 bg-indigo-950/80 border border-indigo-500/50 rounded-xl text-indigo-200 flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-[11px] font-medium">{emailNotice}</span>
            </div>
          )}

          {/* Success State */}
          {saveSuccess ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>¡Archivo Exportado y Sincronizado!</span>
              </div>
              <p className="text-slate-300 break-words font-mono text-[10px] leading-relaxed">
                {saveSuccess.message}
              </p>
              {cloudSaveNote && (
                <div
                  className={`p-2.5 rounded-xl border text-[10px] font-semibold flex items-center space-x-2 ${
                    isRestricted
                      ? 'bg-amber-950/50 border-amber-600/40 text-amber-300'
                      : 'bg-cyan-950/50 border-cyan-600/40 text-cyan-300'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                  <span>{cloudSaveNote}</span>
                </div>
              )}
              <div className="flex items-center space-x-2 pt-1">
                {saveSuccess.folder && isDesktop && (
                  <button
                    onClick={handleOpenFolder}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-[10px] flex items-center space-x-1.5 border border-slate-700 cursor-pointer transition-all"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Abrir carpeta</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer shadow-lg transition-all"
                >
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Selector de Modo de Exportación (Continuo vs Agrupado) */}
              <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Estructura del Archivo Excel
                  </span>
                  {exportFormat === 'by_line' && solutionSummary.motherLines.length > 1 && (
                    <select
                      value={selectedLine}
                      onChange={(e) => setSelectedLine(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-[10px] rounded-lg px-2 py-1 font-semibold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ALL">Todas las Líneas ({solutionSummary.motherLines.length})</option>
                      {solutionSummary.motherLines.map((m) => (
                        <option key={m.motherKey} value={m.motherKey}>
                          Solo Línea {m.motherKey} ({m.items.length} ítems)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('unified')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      exportFormat === 'unified'
                        ? 'bg-indigo-950/70 border-indigo-500/80 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Continuo Estándar</span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 mt-1 leading-snug">
                      Formato clásico CCW secuencial (1.0, 1.1, 2.0...) con total general único.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('by_line')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      exportFormat === 'by_line'
                        ? 'bg-indigo-950/70 border-indigo-500/80 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Agrupado por Líneas</span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 mt-1 leading-snug">
                      Bloques por Línea Madre con subtotales nativos <code className="text-indigo-300">=SUM(...)</code> por OC.
                    </p>
                  </button>
                </div>
              </div>

              {/* Opciones Comerciales Complementarias (Idea 1 & Idea 4) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Idea 1: Resumen Ejecutivo */}
                <label className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showExecutiveSummary}
                      onChange={(e) => setShowExecutiveSummary(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-slate-300">
                      Resumen Ejecutivo (HW/SW)
                    </span>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </label>

                {/* Idea 4: Valor Referencial CLP */}
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableClp}
                        onChange={(e) => setEnableClp(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-emerald-400" />
                        Moneda Local CLP
                      </span>
                    </label>
                    {enableClp && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400">T/C: $</span>
                        <input
                          type="number"
                          value={clpExchangeRate}
                          onChange={(e) => setClpExchangeRate(Number(e.target.value) || 0)}
                          className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white font-mono text-right focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                  {enableClp && (
                    <div className="text-[9.5px] text-emerald-400 font-mono font-medium pl-5">
                      ≈ {formatCLP(totalClp)} CLP + IVA
                    </div>
                  )}
                </div>
              </div>

              {/* Idea 5: Previsualización Rápida en el Modal */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800/50 text-slate-300 transition-colors cursor-pointer text-[10px] font-bold"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Vista Previa de la Propuesta ({solutionSummary.totalQty} und. · {formatUSD(solutionSummary.grandTotal)})
                  </span>
                  {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showPreview && (
                  <div className="p-3.5 pt-0 space-y-3 border-t border-slate-800/80 animate-in fade-in duration-150">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2 pt-3">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">🔧 Hardware</div>
                        <div className="text-xs font-bold text-white mt-0.5">
                          {formatUSD(solutionSummary.hardwareTotal)}
                        </div>
                        <div className="text-[9px] text-slate-500">{solutionSummary.hardwareCount} ítems</div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">☁️ Licencias/SaaS</div>
                        <div className="text-xs font-bold text-white mt-0.5">
                          {formatUSD(solutionSummary.softwareTotal)}
                        </div>
                        <div className="text-[9px] text-slate-500">{solutionSummary.softwareCount} ítems</div>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                        <div className="text-[9px] text-emerald-400 font-bold uppercase">💰 Total Solución</div>
                        <div className="text-xs font-black text-emerald-300 mt-0.5">
                          {formatUSD(solutionSummary.grandTotal)}
                        </div>
                        {enableClp && (
                          <div className="text-[8.5px] text-emerald-400/80 font-mono">
                            {formatCLP(totalClp)} CLP
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desglose por Línea Madre si hay varias */}
                    {solutionSummary.motherLines.length > 1 && (
                      <div className="space-y-1.5">
                        <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                          Líneas Madre Detectadas (Subtotales por OC):
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {solutionSummary.motherLines.map((m) => (
                            <div
                              key={m.motherKey}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-indigo-300">Línea {m.motherKey}</span>
                                <span className="text-[9px] text-slate-400">{m.typeBadge}</span>
                                <span className="text-[9px] text-slate-500">({m.totalQty} und.)</span>
                              </div>
                              <span className="font-bold text-white">{formatUSD(m.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Commercial rates badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 pt-1">
                      <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono">
                        Internación: <strong className="text-white">{effectiveRates.internacionPct}%</strong>
                      </span>
                      <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono">
                        Margen: <strong className="text-white">{effectiveRates.marginPct}%</strong>
                      </span>
                      <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono">
                        Arancel: <strong className="text-white">{effectiveRates.arancelPct}%</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Path / Storage Info */}
              {isDesktop ? (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FolderTree className="w-3 h-3 text-indigo-400" />
                    Ruta de guardado (App Local):
                  </span>
                  <div className="font-mono text-[10px] text-emerald-300 break-all leading-tight">
                    gravity_storage /{' '}
                    <strong className="text-white">{partnerName || 'canal'}</strong> /{' '}
                    <strong className="text-white">{clientName || 'cliente'}</strong> /{' '}
                    <strong className="text-indigo-300">{capitalizedMonth}</strong> /{' '}
                    <span className="text-amber-300">{getCleanFilename()}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Descarga Web Directa + Respaldo Cloud
                  </span>
                  <div className="font-mono text-[10px] text-slate-300 break-all leading-tight">
                    El archivo <strong className="text-amber-300">{getCleanFilename()}</strong> se descargará en <strong className="text-emerald-400">Descargas</strong> y se respaldará en el <strong className="text-cyan-400">Historial Cloud</strong>.
                  </div>
                </div>
              )}

              {/* Cloud Visibility Toggle */}
              <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" />
                    Visibilidad en Historial Cloud
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRestricted((prev) => !prev)}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      isRestricted
                        ? 'bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900/80'
                        : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/70'
                    }`}
                  >
                    {isRestricted ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Restringido (Con Permiso)</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        <span>Público (Todo el equipo)</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {isRestricted
                    ? '🔒 Otros usuarios verán esta cotización en la búsqueda del historial, pero deberán solicitarte permiso para ver los montos o cargarla.'
                    : '🔓 Cualquier usuario registrado podrá ver y cargar esta cotización desde el Historial de Estimates.'}
                </p>
              </div>

              {/* Collapsible Details Form */}
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold"
              >
                <span>Editar nombre de archivo y detalles</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-400" />
                      Canal / Partner
                    </label>
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => handlePartnerChange(e.target.value)}
                      placeholder="ej. Intcomex, Logicalis, Sonda"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users2 className="w-3 h-3 text-emerald-400" />
                      Cliente Final
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => handleClientChange(e.target.value)}
                      placeholder="ej. Banco de Chile, Cencosud"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      Modelo de Equipos / Familia
                    </label>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => handleModelChange(e.target.value)}
                      placeholder="ej. 7x, C9200, Catalyst, Meraki"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-purple-400" />
                      Nombre del Archivo
                    </label>
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons Toolbar */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {/* Secondary Action Row: Email Partner + PDF */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Idea 3: Redactar Correo al Partner en Outlook */}
                  <button
                    type="button"
                    onClick={handleEmailPartner}
                    className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-indigo-300 font-bold text-[10px] border border-indigo-500/40 hover:border-indigo-500 flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-sm"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Redactar Correo (Outlook)</span>
                  </button>

                  {/* Idea 2: Descargar PDF Comercial */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-rose-300 font-bold text-[10px] border border-rose-500/40 hover:border-rose-500 flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Descargar PDF Comercial</span>
                  </button>
                </div>

                {/* Primary Action Row: Excel Export */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>

                  {isDesktop && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleChooseLocation}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      Otra ubicación...
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Exportando y Guardando...' : 'Descargar Excel (.xlsx)'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
