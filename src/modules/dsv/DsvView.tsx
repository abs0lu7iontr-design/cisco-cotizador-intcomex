// ============================================================================
// CISCO AUTOMATED - DEDICATED DSV GENERATOR VIEW WITH RIGHT-CLICK OVERRIDE
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  FileCheck,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
  Info,
  Server,
  Layers,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import { parseRawDealBom, RawBomParsedResult } from './dsvBomParser';
import { DsvModal } from './DsvModal';
import { isZeroValueBomItem, calculateDsvPrices, transformRawBomToDsv } from './dsvEngine';
import { SkuCategoryType } from './types';
import { saveDsvToCloud } from '../cloud';
import { useCiscoAutomatedStore } from '../../core/store';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  lineNumber: string;
  sku: string;
}

export const DsvView: React.FC = () => {
  const { currentUser } = useCiscoAutomatedStore();
  const [rawBom, setRawBom] = useState<RawBomParsedResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Manual Overrides Map: lineNumber -> SkuCategoryType
  const [overrides, setOverrides] = useState<Record<string, SkuCategoryType>>({});

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    lineNumber: '',
    sku: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('scroll', handleOutsideClick, true);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleOutsideClick, true);
    };
  }, [contextMenu.visible]);

  const handleSelectBom = async () => {
    setErrorMessage(null);
    setExportNotification(null);

    // Desktop PyWebView bridge check
    if ((window as any).pywebview?.api?.open_file_dialog) {
      setIsProcessing(true);
      try {
        const res = await (window as any).pywebview.api.open_file_dialog();
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
            setErrorMessage('No se pudieron leer los bytes del archivo seleccionado.');
            setIsProcessing(false);
            return;
          }

          const parsed = await parseRawDealBom(buffer, res.filename);
          setRawBom(parsed);
          setOverrides({});
        }
      } catch (err: any) {
        console.error('Error cargando BOM para DSV:', err);
        setErrorMessage(err?.message || 'Error cargando archivo Deal BOM.');
      } finally {
        setIsProcessing(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setExportNotification(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseRawDealBom(buffer, file.name);
      setRawBom(parsed);
      setOverrides({});
    } catch (err: any) {
      console.error('Error cargando BOM:', err);
      setErrorMessage(
        err?.message?.includes('central directory')
          ? 'El archivo seleccionado no es un libro Excel (.xlsx o .xls) válido.'
          : err?.message || 'Error al procesar el archivo Deal BOM.'
      );
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClearBom = () => {
    setRawBom(null);
    setOverrides({});
    setErrorMessage(null);
    setExportNotification(null);
  };

  const handleRowContextMenu = (e: React.MouseEvent, lineNumber: string, sku: string) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 160;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      visible: true,
      x,
      y,
      lineNumber,
      sku,
    });
  };

  const handleApplyOverride = (newCategory: SkuCategoryType) => {
    if (!contextMenu.lineNumber) return;
    setOverrides((prev) => ({
      ...prev,
      [contextMenu.lineNumber]: newCategory,
    }));
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleResetOverride = () => {
    if (!contextMenu.lineNumber) return;
    setOverrides((prev) => {
      const copy = { ...prev };
      delete copy[contextMenu.lineNumber];
      return copy;
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSaveDsvToCloud = async () => {
    if (!rawBom) return;
    setIsSavingCloud(true);
    setErrorMessage(null);
    try {
      const dealVal = rawBom.dealIdFromBom || rawBom.authorizationNumber || 'NA';
      const partnerVal = rawBom.resellerName || rawBom.items[0]?.resellerName || 'Intcomex Partner';
      const customerVal = rawBom.endUserName || rawBom.items[0]?.endUserName || 'Cliente Final';

      const summary = transformRawBomToDsv(
        rawBom,
        {
          so: dealVal || 'SO-PENDING',
          po: 'PO-PENDING',
          dealId: dealVal,
          partnerId: partnerVal,
          endCustomerAddress: 'Chile',
          partnerName: partnerVal,
          endCustomerName: customerVal,
        },
        overrides,
        false
      );

      const totalReportedNet = summary.rows.reduce((acc, r) => acc + (r.reportedNetPrice || 0), 0);

      const res = await saveDsvToCloud({
        dealId: dealVal,
        soNumber: dealVal,
        poNumber: 'PO-PENDING',
        partnerId: partnerVal,
        resellerName: partnerVal,
        endCustomerName: customerVal,
        endCustomerAddress: 'Chile',
        originalFileName: rawBom.fileName,
        createdAt: new Date().toISOString(),
        creator: {
          username: currentUser?.username || 'anonymous',
          fullName: currentUser?.full_name || 'Usuario Intcomex',
          role: currentUser?.role || 'pm',
          email: currentUser?.email || '',
        },
        financialSummary: {
          totalReportedNetPrice: totalReportedNet,
          totalItems: summary.validDsvItems,
          discardedZeroItems: summary.discardedZeroItems,
        },
        items: summary.rows,
        overrides,
      });

      if (res.success) {
        setExportNotification(res.error || '¡Registro DSV guardado exitosamente en Firebase Firestore (Nube)!');
      } else {
        setErrorMessage(`Error guardando en la nube: ${res.error}`);
      }
    } catch (err: any) {
      setErrorMessage(`Error guardando DSV en la nube: ${err?.message || 'Sin conexión'}`);
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Compute stats
  const validItems = rawBom ? rawBom.items.filter((i) => !isZeroValueBomItem(i)) : [];
  const discardedItems = rawBom ? rawBom.items.filter((i) => isZeroValueBomItem(i)) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* Hidden Web File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xls, .xlsx, .xlsm, .csv"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Standalone DSV Modal */}
      <DsvModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rawBom={rawBom}
        overrides={overrides}
        onSuccess={(filename) => {
          setExportNotification(`Plantilla DSV de 48 columnas exportada con éxito: ${filename}`);
        }}
      />

      {/* Floating Context Menu for SKU Override */}
      {contextMenu.visible && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Línea {contextMenu.lineNumber}</span>
            <span className="font-bold text-white truncate max-w-[100px]">{contextMenu.sku}</span>
          </div>

          <div className="py-1 space-y-0.5">
            <button
              onClick={() => handleApplyOverride('hardware')}
              className="w-full px-3 py-2 rounded-xl text-left hover:bg-emerald-950/70 hover:text-emerald-300 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cambiar a Hardware</span>
            </button>

            <button
              onClick={() => handleApplyOverride('subscription')}
              className="w-full px-3 py-2 rounded-xl text-left hover:bg-blue-950/70 hover:text-blue-300 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Cambiar a Suscripción</span>
            </button>

            <button
              onClick={() => handleApplyOverride('service')}
              className="w-full px-3 py-2 rounded-xl text-left hover:bg-purple-950/70 hover:text-purple-300 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span>Cambiar a Servicio</span>
            </button>

            {overrides[contextMenu.lineNumber] && (
              <>
                <div className="h-px bg-slate-800 my-1" />
                <button
                  onClick={handleResetOverride}
                  className="w-full px-3 py-1.5 rounded-xl text-left hover:bg-rose-950/60 hover:text-rose-300 text-rose-400 flex items-center space-x-2 transition-colors cursor-pointer text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Detección Auto</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Generador Oficial DSV Cisco POS</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-700/40">
                48 Columnas (A - AV)
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Transformación de Cisco Deal BOM (.xls / .xlsx) a la matriz oficial con estilos Calibri 11 y columnas Bill-To ocultas.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectBom}
            disabled={isProcessing}
            className="inline-flex items-center space-x-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{rawBom ? 'Cambiar Deal BOM' : '1. Cargar Deal BOM (.xls/.xlsx)'}</span>
          </button>

          {rawBom && (
            <>
              <button
                onClick={handleSaveDsvToCloud}
                disabled={isSavingCloud || isProcessing}
                className="inline-flex items-center space-x-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                title="Guardar orden DSV en Firebase Firestore (Nube)"
              >
                <UploadCloud className="w-4 h-4 text-cyan-100" />
                <span>{isSavingCloud ? 'Guardando...' : 'Guardar en la Nube'}</span>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span>2. Generar DSV (48 Cols)</span>
              </button>

              <button
                onClick={handleClearBom}
                className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
                title="Limpiar archivo cargado"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center space-x-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {exportNotification && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center space-x-3 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Main Content */}
      {!rawBom ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <FileSpreadsheet className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Carga un Cisco Deal BOM (.xls o .xlsx) para comenzar</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Selecciona el archivo descargado de Cisco CCW (ej: <code>85890781_Cisco-Deal-BOM-Pricing-Details.xls</code>). Solo se exportarán los productos con precio de lista (Columna O &gt; $0).
            </p>
          </div>
          <button
            onClick={handleSelectBom}
            disabled={isProcessing}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isProcessing ? 'Procesando BOM...' : 'Seleccionar Archivo Deal BOM (.xls / .xlsx)'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Archivo BOM</span>
              <span className="text-xs font-bold text-white mt-1 truncate" title={rawBom.fileName}>
                {rawBom.fileName}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deal ID</span>
              <span className="text-xs font-mono font-bold text-blue-400 mt-1 truncate">
                {rawBom.dealIdFromBom || rawBom.authorizationNumber || 'No detectado'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partner (Canal)</span>
              <span className="text-xs font-bold text-cyan-300 mt-1 truncate" title={rawBom.resellerName || rawBom.items[0]?.resellerName || 'No detectado'}>
                {rawBom.resellerName || rawBom.items[0]?.resellerName || 'No detectado'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente Final</span>
              <span className="text-xs font-bold text-purple-300 mt-1 truncate" title={rawBom.endUserName || rawBom.items[0]?.endUserName || 'No detectado'}>
                {rawBom.endUserName || rawBom.items[0]?.endUserName || 'No detectado'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Válidos DSV</span>
              <span className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{validItems.length} (List &gt; $0)</span>
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descartados</span>
              <span className="text-xs font-bold text-rose-400 mt-1 truncate">
                {discardedItems.length} ($0.00)
              </span>
            </div>
          </div>

          {/* Rules Explanation Badge */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>Tip:</strong> Haz <strong>clic derecho</strong> en cualquier fila para cambiar su categoría (Hardware, Suscripción o Servicio) y recalcular Col J y K al instante.
              </span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
            >
              Generar DSV Excel (48 Cols)
            </button>
          </div>

          {/* Line Items Table with Right-Click */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Vista Previa de Productos a Exportar ({validItems.length} filas continuas sin renumerar)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Matriz 48 Columnas (A - AV) | Clic derecho para cambiar regla
              </span>
            </div>

            <div className="overflow-x-auto max-h-[520px] custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3 text-center w-14">Line # (D)</th>
                    <th className="p-3">Cisco SKU (E)</th>
                    <th className="p-3">Magic Key (M)</th>
                    <th className="p-3 text-center">Categoría (Clic Derecho)</th>
                    <th className="p-3 text-center">Duración</th>
                    <th className="p-3 text-center">Cant. (I)</th>
                    <th className="p-3 text-right">List Price (O)</th>
                    <th className="p-3 text-right text-amber-300">Col J (Rep. Unit)</th>
                    <th className="p-3 text-right text-indigo-300">Col K (Net Price)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {validItems.map((item, idx) => {
                    const lineKey = item.lineNumber;
                    const itemOverride = overrides[lineKey];
                    const { reportedProductUnitPrice, reportedNetPrice, effectiveCategory, discrepancy } =
                      calculateDsvPrices(
                        item.ciscoSku,
                        item.listPrice,
                        item.distiDiscountPct,
                        item.durationMonths,
                        itemOverride,
                        {
                          durationNetPrice: item.durationNetPrice,
                          durationListPrice: item.durationListPrice,
                          distiDiscount: item.distiDiscount ?? item.distiDiscountPct,
                          description: item.description,
                          lineNumber: item.lineNumber,
                          partNumber: item.partNumber || item.ciscoSku,
                        }
                      );

                    const isManual = Boolean(itemOverride);

                    return (
                      <tr
                        key={idx}
                        onContextMenu={(e) => handleRowContextMenu(e, item.lineNumber, item.ciscoSku)}
                        className="hover:bg-slate-800/50 transition-colors cursor-context-menu select-none"
                        title="Haz clic derecho para cambiar entre Hardware, Suscripción o Servicio"
                      >
                        <td className="p-3 text-center text-slate-400 font-semibold">{item.lineNumber}</td>
                        <td className="p-3 font-bold text-white">{item.ciscoSku}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{item.magicKey || '-'}</td>
                        <td className="p-3 text-center font-sans">
                          {effectiveCategory === 'service' ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isManual
                                  ? 'bg-purple-900 text-purple-200 border border-purple-500'
                                  : 'bg-purple-950 text-purple-300 border border-purple-700/40'
                              }`}
                            >
                              <Wrench className="w-2.5 h-2.5" />
                              <span>Servicio {isManual ? '✎' : ''}</span>
                            </span>
                          ) : effectiveCategory === 'subscription' ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isManual
                                  ? 'bg-blue-900 text-blue-200 border border-blue-500'
                                  : 'bg-blue-950 text-blue-300 border border-blue-700/40'
                              }`}
                            >
                              <Layers className="w-2.5 h-2.5" />
                              <span>Suscripción (-42%) {isManual ? '✎' : ''}</span>
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isManual
                                  ? 'bg-emerald-900 text-emerald-200 border border-emerald-500'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700/40'
                              }`}
                            >
                              <Server className="w-2.5 h-2.5" />
                              <span>Hardware (-42%) {isManual ? '✎' : ''}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          {item.durationMonths > 0 ? `${item.durationMonths}m` : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-white">{item.qty}</td>
                        <td className="p-3 text-right text-slate-400">${item.listPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-amber-300">
                          ${reportedProductUnitPrice.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-indigo-300">
                          ${reportedNetPrice.toFixed(2)}
                          {discrepancy && (
                            <span
                              className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-950/80 text-amber-300 border border-amber-500/40 inline-block font-sans font-bold"
                              title={`Discrepancia detectada: Diferencia de $${discrepancy.difference.toFixed(2)} USD entre cálculo teórico ($${discrepancy.calculatedPrice.toFixed(2)}) y BOM Cisco ($${discrepancy.bomReportedPrice.toFixed(2)})`}
                            >
                              ⚠️ ±${discrepancy.difference.toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
