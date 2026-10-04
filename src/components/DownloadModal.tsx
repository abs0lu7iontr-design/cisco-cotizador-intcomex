// ============================================================================
// CISCO AUTOMATED v2.1 - DOWNLOAD MODAL (DESKTOP & CLEAN WEB SEPARATION)
// ============================================================================

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
} from 'lucide-react';
import { generateOptimizedWorkbook } from '../core/excelEngine';
import { QuoteParameters, OverrideRuleType, EstimateHeaderInfo } from '../core/types';
import { getCcwTimestamp, suggestFileName } from '../core/calculations';
import { generateQuotationFileName } from '../core/exportUtils';
import { useCiscoAutomatedStore } from '../core/store';
import {
  isDesktopApp,
  saveDesktopExcelFile,
  saveStructuredDesktopEstimate,
  openFolderInExplorer,
} from '../core/desktopBridge';

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
    const isRecalc = Boolean(
      isRecalculated ||
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

    return generateQuotationFileName({
      partner: pName || defaultPartner || headerInfo?.companyName || 'Intcomex',
      customerName: cName || defaultClient || headerInfo?.customerName || 'Cliente',
      technologyOrFamily: tech,
      dealId: headerInfo?.dealId,
      estimateId: headerInfo?.estimateId || 'ESTIMATE',
      internacionPct: activeParams?.internacionPct ?? 7.0,
      marginPct: activeParams?.margenPct ?? 5.0,
      isRecalculated: isRecalc,
      isOnlyLicensing,
      versionNumber: estimateVersionNumber,
    });
  };

  const [partnerName, setPartnerName] = useState(defaultPartner || headerInfo?.companyName || 'Intcomex');
  const [clientName, setClientName] = useState(defaultClient || headerInfo?.customerName || 'Cliente Final');
  const [modelName, setModelName] = useState(defaultModel || 'Cisco');
  const [filename, setFilename] = useState(() =>
    computeCorporateFilename(defaultPartner, defaultClient, defaultModel, params)
  );

  // Manual restriction toggle (default false = visible to all users)
  const [isRestricted, setIsRestricted] = useState(false);
  const [cloudSaveNote, setCloudSaveNote] = useState<string | null>(null);

  // Details form is collapsed by default
  const [showDetails, setShowDetails] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{
    filepath?: string;
    folder?: string;
    message?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Actualización reactiva en vivo del nombre de archivo al mover parámetros de internación o margen
  useEffect(() => {
    const currentPartner = partnerName || defaultPartner || headerInfo?.companyName || 'Intcomex';
    const currentClient = clientName || defaultClient || headerInfo?.customerName || 'Cliente Final';
    const currentModel = modelName || defaultModel || 'Cisco';
    setFilename(computeCorporateFilename(currentPartner, currentClient, currentModel, params));
  }, [
    params?.internacionPct,
    params?.margenPct,
    defaultPartner,
    defaultClient,
    defaultModel,
    headerInfo?.estimateId,
    headerInfo?.dealId,
    isRecalculated,
    isOnlyLicensing,
  ]);

  // Reset modal state completely every time the modal opens (no cache between files)
  useEffect(() => {
    if (isOpen) {
      setSaveSuccess(null);
      setErrorMessage(null);
      setIsSaving(false);
      setShowDetails(false);
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
  }, [isOpen, defaultPartner, defaultClient, defaultModel]);

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

  const getTargetBuffer = async (): Promise<ArrayBuffer> => {
    if (rawWorkbookBuffer) {
      const { modifiedBuffer } = await generateOptimizedWorkbook(
        rawWorkbookBuffer,
        params,
        getCleanFilename(),
        customOverrides,
        promoNetPrices
      );
      return modifiedBuffer;
    }
    if (workbookBuffer && workbookBuffer.byteLength > 0) {
      return workbookBuffer;
    }
    // Fallback for estimates restored from Cloud History (synthesize clean .xlsx workbook)
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [
      ['CISCO AUTOMATED v2.1 - COTIZACIÓN OFICIAL INTCOMEX'],
      ['Estimate ID:', headerInfo?.estimateId || 'NA', 'Deal ID:', headerInfo?.dealId || 'NA'],
      ['Partner / Canal:', partnerName || 'Intcomex', 'Cliente Final:', clientName || 'Cliente Final'],
      [
        'Parámetros Aplicados:',
        `Internación: ${params.internacionPct}% | Arancel: ${params.arancelPct}% | Margen: ${params.margenPct}%`,
      ],
      [],
      [
        'Line #',
        'Part Number',
        'Description',
        'Qty',
        'Unit List Price (USD)',
        'Discount %',
        'Net Cisco Unit (USD)',
        'Clasificación',
        'Venta Unitaria Intcomex (USD)',
        'Venta Extendida Intcomex (USD)',
      ],
    ];
    for (const it of processedResult?.items || []) {
      rows.push([
        it.lineNumber || '',
        it.partNumber || '',
        it.description || '',
        it.qty || 1,
        it.unitListPrice || 0,
        it.discPct || 0,
        it.netCiscoUnit || 0,
        it.isIntangible ? 'Intangible' : it.llevaArancel ? 'Arancel 6%' : 'Hardware',
        it.precioVentaUnitario || 0,
        it.precioVentaExtendido || 0,
      ]);
    }
    rows.push([]);
    rows.push([
      '',
      '',
      'TOTAL COTIZADO INTCOMEX (USD)',
      '',
      '',
      '',
      processedResult?.originalProductTotal || 0,
      '',
      '',
      processedResult?.calculatedProductTotal || 0,
    ]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Estimate');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return out as ArrayBuffer;
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

  // Automatic Cloud Persistence right after download
  const persistToCloudAfterDownload = async (cleanFile: string) => {
    try {
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
      }
    } catch (e) {
      console.warn('Auto cloud save warning:', e);
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
          await persistToCloudAfterDownload(cleanFile);
          setSaveSuccess({
            filepath: res.filePath,
            folder: res.folder,
            message: `Guardado en: gravity_storage › ${cleanPartner} › ${cleanClient} › ${res.month || ''} › ${res.filename || cleanFile}`,
          });
        } else {
          setErrorMessage(res?.error || 'Error guardando el archivo.');
        }
      } else {
        // Entorno Web (index.html): Standard Browser Download to default "Descargas" folder
        await browserDownload(cleanFile, targetBuffer);
        await persistToCloudAfterDownload(cleanFile);
        setSaveSuccess({
          message: `Archivo '${cleanFile}' descargado exitosamente en tu carpeta de Descargas.`,
        });
      }
    } catch (err: any) {
      console.error('Error exportando estimate:', err);
      setErrorMessage('Error al exportar: ' + (err?.message || 'Error desconocido'));
    } finally {
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
          await persistToCloudAfterDownload(cleanFile);
          setSaveSuccess({ filepath: res.filePath, message: `Guardado en: ${res.filePath}` });
        } else if (!res?.cancelled) {
          setErrorMessage(res?.error || 'Error al guardar.');
        }
      } else {
        await browserDownload(cleanFile, targetBuffer);
        await persistToCloudAfterDownload(cleanFile);
        setSaveSuccess({ message: `Archivo '${cleanFile}' descargado exitosamente.` });
      }
    } catch (err: any) {
      setErrorMessage('Error: ' + err?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFolder = async () => {
    if (saveSuccess?.folder) {
      await openFolderInExplorer(saveSuccess.folder);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-800 overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Descargar Archivo</h2>
              <p className="text-[10px] text-slate-400">Exportación optimizada CCW · Guardado Cloud automático</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-600/50 rounded-xl text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
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
              {/* Path / Download Preview */}
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
                    El archivo <strong className="text-amber-300">{getCleanFilename()}</strong> se descargará en <strong className="text-emerald-400">Descargas</strong> y se guardará automáticamente en el <strong className="text-cyan-400">Historial de Estimates</strong>.
                  </div>
                </div>
              )}

              {/* Manual Cloud Visibility / Privacy Toggle */}
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
                    : '🔓 Cualquier usuario registrado podrá ver y cargar esta cotización desde el Historial de Estimates. Haz clic arriba si deseas restringirla manualmente.'}
                </p>
              </div>

              {/* Collapsible Details Toggle */}
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-[10px] font-semibold"
              >
                <span>Editar nombre y detalles</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Collapsible Form Fields */}
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

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
                  <span>{isSaving ? 'Exportando y Guardando...' : 'Descargar Archivo'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
