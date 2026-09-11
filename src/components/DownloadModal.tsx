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
} from 'lucide-react';
import { generateOptimizedWorkbook } from '../core/excelEngine';
import { QuoteParameters, OverrideRuleType, EstimateHeaderInfo } from '../core/types';
import { getCcwTimestamp, suggestFileName } from '../core/calculations';
import { generateQuotationFileName } from '../core/exportUtils';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPartner?: string;
  defaultClient?: string;
  defaultFilename?: string;
  workbookBuffer: ArrayBuffer;
  rawWorkbookBuffer?: ArrayBuffer | null;
  params?: QuoteParameters;
  customOverrides?: Record<number, OverrideRuleType>;
  promoNetPrices?: Record<number, number>;
  headerInfo?: EstimateHeaderInfo;
  isRecalculated?: boolean;
}

export function DownloadModal({
  isOpen,
  onClose,
  defaultPartner,
  defaultClient,
  defaultFilename,
  workbookBuffer,
  rawWorkbookBuffer,
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  customOverrides,
  promoNetPrices,
  headerInfo,
  isRecalculated,
}: DownloadModalProps) {
  const isDesktop = Boolean((window as any).pywebview?.api);

  const computeCorporateFilename = (pName?: string, cName?: string, currentParams?: QuoteParameters) => {
    const activeParams = currentParams || params;
    const isRecalc = Boolean(
      isRecalculated ||
      (activeParams && (activeParams.internacionPct !== 7.0 || activeParams.margenPct !== 5.0)) ||
      (customOverrides && Object.keys(customOverrides).length > 0)
    );

    let tech = 'Cisco';
    if (defaultFilename) {
      const cleanBase = defaultFilename.replace(/\.[^/.]+$/, '');
      const parts = cleanBase.split(/[_.\s-]+/);
      if (parts.length >= 3 && !parts[2].startsWith('INT') && !parts[2].startsWith('DEAL') && !parts[2].startsWith('CALC') && !parts[2].startsWith('RECALC')) {
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
    });
  };

  const [partnerName, setPartnerName] = useState(defaultPartner || headerInfo?.companyName || 'Intcomex');
  const [clientName, setClientName] = useState(defaultClient || headerInfo?.customerName || 'Cliente Final');
  const [filename, setFilename] = useState(() => computeCorporateFilename(defaultPartner, defaultClient, params));

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
    setFilename(computeCorporateFilename(currentPartner, currentClient, params));
  }, [
    params?.internacionPct,
    params?.margenPct,
    defaultPartner,
    defaultClient,
    headerInfo?.estimateId,
    headerInfo?.dealId,
    isRecalculated,
  ]);

  // Reset modal state completely every time the modal opens (no cache between files)
  useEffect(() => {
    if (isOpen) {
      setSaveSuccess(null);
      setErrorMessage(null);
      setIsSaving(false);
      setShowDetails(false);
      const initialPartner = defaultPartner || headerInfo?.companyName || 'Intcomex';
      const initialClient = defaultClient || headerInfo?.customerName || 'Cliente Final';
      setPartnerName(initialPartner);
      setClientName(initialClient);
      setFilename(computeCorporateFilename(initialPartner, initialClient, params));
    }
  }, [isOpen]);

  const handlePartnerChange = (val: string) => {
    setPartnerName(val);
    setFilename(computeCorporateFilename(val, clientName, params));
  };

  const handleClientChange = (val: string) => {
    setClientName(val);
    setFilename(computeCorporateFilename(partnerName, val, params));
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
    return workbookBuffer;
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

  // Primary action: save into gravity_storage in Desktop, or standard download in Web
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const cleanPartner = sanitizeFolderName(partnerName);
    const cleanClient = sanitizeFolderName(clientName);
    const cleanFile = getCleanFilename();

    try {
      const targetBuffer = await getTargetBuffer();

      if (isDesktop && (window as any).pywebview?.api?.save_estimate_structured) {
        if (!partnerName.trim() || !clientName.trim()) {
          setErrorMessage('Por favor completa el Canal/Partner y el Cliente Final.');
          setIsSaving(false);
          return;
        }

        const bytesList = Array.from(new Uint8Array(targetBuffer));
        const res = await (window as any).pywebview.api.save_estimate_structured(
          cleanPartner,
          cleanClient,
          cleanFile,
          bytesList
        );
        if (res?.success) {
          setSaveSuccess({
            filepath: res.filepath,
            folder: res.folder,
            message: `Guardado en: gravity_storage › ${cleanPartner} › ${cleanClient} › ${res.month} › ${res.filename}`,
          });
        } else {
          setErrorMessage(res?.error || 'Error guardando el archivo.');
        }
      } else {
        // Entorno Web (index.html): Standard Browser Download to default "Descargas" folder
        await browserDownload(cleanFile, targetBuffer);
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
      if (isDesktop && (window as any).pywebview?.api?.download_excel_file) {
        const bytesList = Array.from(new Uint8Array(targetBuffer));
        const res = await (window as any).pywebview.api.download_excel_file(cleanFile, bytesList);
        if (res?.success) {
          setSaveSuccess({ filepath: res.filepath, message: `Guardado en: ${res.filepath}` });
        } else if (!res?.cancelled) {
          setErrorMessage(res?.error || 'Error al guardar.');
        }
      } else {
        await browserDownload(cleanFile, targetBuffer);
        setSaveSuccess({ message: `Archivo '${cleanFile}' descargado exitosamente.` });
      }
    } catch (err: any) {
      setErrorMessage('Error: ' + err?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFolder = async () => {
    if (saveSuccess?.folder && (window as any).pywebview?.api?.open_folder_in_explorer) {
      await (window as any).pywebview.api.open_folder_in_explorer(saveSuccess.folder);
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
              <p className="text-[10px] text-slate-400">Exportación optimizada CCW · Intcomex</p>
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
                <span>¡Archivo Exportado!</span>
              </div>
              <p className="text-slate-300 break-words font-mono text-[10px] leading-relaxed">
                {saveSuccess.message}
              </p>
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
                    Descarga Web Directa
                  </span>
                  <div className="font-mono text-[10px] text-slate-300 break-all leading-tight">
                    El archivo <strong className="text-amber-300">{getCleanFilename()}</strong> se descargará directamente en tu carpeta de <strong className="text-emerald-400">Descargas</strong>.
                  </div>
                </div>
              )}

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
                  <span>{isSaving ? 'Exportando...' : 'Descargar Archivo'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
