// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODAL (ACTIVE & DISCARDED P/N)
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BoLineItem, partitionBoLinesByCost } from './boTypes';
import { BO_EMAIL_TO, BO_EMAIL_CC, copyBoTableToClipboard } from './boEmailHelper';
import {
  fetchBoSkuCatalog,
  saveBoSkuMapping,
  batchSaveBoSkuMappings,
  findSkuInCatalog,
} from './boSkuCatalogService';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Trash2,
  Check,
  Mail,
  Copy,
  AlertCircle,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialClientName: string;
  initialLines: BoLineItem[];
  onClose: () => void;
}

export const BoRequestModal: React.FC<Props> = ({
  isOpen,
  initialClientName,
  initialLines,
  onClose,
}) => {
  const [clientName, setClientName] = useState(initialClientName || 'Cliente');
  const [lines, setLines] = useState<BoLineItem[]>([]);
  const [discardedLines, setDiscardedLines] = useState<BoLineItem[]>([]);
  const [isDiscardedExpanded, setIsDiscardedExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Estados de persistencia y catálogo en la nube
  const [skuCatalog, setSkuCatalog] = useState<Record<string, string>>({});
  const [isCloudReady, setIsCloudReady] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [memorizedSkuCount, setMemorizedSkuCount] = useState<number>(0);
  const statusTimerRef = useRef<any>(null);

  // Inicializar, particionar líneas y auto-completar SKUs desde la nube al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    setClientName(initialClientName || 'Cliente');
    setCopied(false);

    const { activeLines, zeroCostLines } = partitionBoLinesByCost(initialLines);

    // Cargar catálogo de SKUs desde Firestore Cloud + Local Cache
    fetchBoSkuCatalog().then(({ catalog, isCloudConnected }) => {
      setSkuCatalog(catalog);
      setIsCloudReady(isCloudConnected);
      const count = Object.keys(catalog).length;
      setMemorizedSkuCount(count);

      // Auto-rellenar SKU si no viene definido
      const filledActive = activeLines.map((line) => {
        if (!line.sku) {
          const matched = findSkuInCatalog(line.partNumber, catalog);
          return matched ? { ...line, sku: matched } : line;
        }
        return line;
      });

      const filledDiscarded = zeroCostLines.map((line) => {
        if (!line.sku) {
          const matched = findSkuInCatalog(line.partNumber, catalog);
          return matched ? { ...line, sku: matched } : line;
        }
        return line;
      });

      setLines(filledActive);
      setDiscardedLines(filledDiscarded);
    });
  }, [isOpen, initialClientName, initialLines]);

  // Totales de la tabla activa
  const totals = useMemo(() => {
    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalExtended = lines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);
    return { totalQty, totalExtended };
  }, [lines]);

  if (!isOpen) return null;

  // Actualización de Part Number editable en tabla activa
  const handlePartNumberChange = (index: number, newPn: string) => {
    const updated = [...lines];
    const item = { ...updated[index], partNumber: newPn };

    // Si no tiene SKU, intentar auto-rellenarlo con el nuevo P/N
    if (!item.sku) {
      const matched = findSkuInCatalog(newPn, skuCatalog);
      if (matched) {
        item.sku = matched;
      }
    }
    updated[index] = item;
    setLines(updated);
  };

  // Actualización de Part Number editable en tabla de descartados
  const handleDiscardedPartNumberChange = (index: number, newPn: string) => {
    const updated = [...discardedLines];
    const item = { ...updated[index], partNumber: newPn };
    if (!item.sku) {
      const matched = findSkuInCatalog(newPn, skuCatalog);
      if (matched) {
        item.sku = matched;
      }
    }
    updated[index] = item;
    setDiscardedLines(updated);
  };

  // Edición de SKU en tabla activa
  const handleSkuChange = (index: number, newSku: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], sku: newSku.toUpperCase() };
    setLines(updated);
  };

  // Guardado persistente en la nube al salir del campo SKU activo
  const handleSkuBlur = async (index: number) => {
    const item = lines[index];
    if (!item || !item.partNumber || !item.sku) return;

    setCloudStatus('saving');
    const res = await saveBoSkuMapping(item.partNumber, item.sku);

    if (res.success) {
      setSkuCatalog((prev) => ({
        ...prev,
        [item.partNumber.trim().toUpperCase()]: item.sku.trim().toUpperCase(),
      }));
      setMemorizedSkuCount((prev) => prev + 1);
      setCloudStatus('saved');
    } else {
      setCloudStatus('error');
    }

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setCloudStatus('idle'), 3500);
  };

  // Edición de SKU en tabla de descartados
  const handleDiscardedSkuChange = (index: number, newSku: string) => {
    const updated = [...discardedLines];
    updated[index] = { ...updated[index], sku: newSku.toUpperCase() };
    setDiscardedLines(updated);
  };

  // Guardado persistente en la nube al salir del campo SKU descartado
  const handleDiscardedSkuBlur = async (index: number) => {
    const item = discardedLines[index];
    if (!item || !item.partNumber || !item.sku) return;

    setCloudStatus('saving');
    const res = await saveBoSkuMapping(item.partNumber, item.sku);

    if (res.success) {
      setSkuCatalog((prev) => ({
        ...prev,
        [item.partNumber.trim().toUpperCase()]: item.sku.trim().toUpperCase(),
      }));
      setMemorizedSkuCount((prev) => prev + 1);
      setCloudStatus('saved');
    } else {
      setCloudStatus('error');
    }

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setCloudStatus('idle'), 3500);
  };

  // Mover una línea de descartadas a la tabla activa
  const handleAddDiscardedLine = (index: number) => {
    const item = discardedLines[index];
    setDiscardedLines((prev) => prev.filter((_, i) => i !== index));
    setLines((prev) => [...prev, item]);
  };

  // Mover todas las líneas descartadas a la tabla activa
  const handleAddAllDiscarded = () => {
    setLines((prev) => [...prev, ...discardedLines]);
    setDiscardedLines([]);
  };

  // Descartar una línea de la tabla activa hacia la sección de descartados
  const handleRemoveActiveLine = (index: number) => {
    const item = lines[index];
    setLines((prev) => prev.filter((_, i) => i !== index));
    setDiscardedLines((prev) => [...prev, item]);
  };

  // Copiar tabla HTML al portapapeles y sincronizar SKUs a la nube
  const handleCopy = async () => {
    // Sincronizar todos los SKUs cargados a la base de datos antes de copiar
    const validItemsToSync = lines
      .filter((l) => l.partNumber && l.sku)
      .map((l) => ({ partNumber: l.partNumber, sku: l.sku }));

    if (validItemsToSync.length > 0) {
      batchSaveBoSkuMappings(validItemsToSync);
    }

    const ok = await copyBoTableToClipboard(lines);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    }
  };

  // Abrir cliente de correo
  const handleOpenOutlook = () => {
    const subject = encodeURIComponent(`RV: Cotización ${clientName}`);
    const body = encodeURIComponent(
      'Estimado,\n\nBuenos días, por favor crear BO.\n\n(Pega aquí la tabla copiada usando CTRL+V)\n\nSaludos,'
    );
    window.location.href = `mailto:${BO_EMAIL_TO}?cc=${BO_EMAIL_CC}&subject=${subject}&body=${body}`;
  };

  // Descargar CSV con los P/N descartados de costo 0
  const handleDownloadDiscardedCsv = () => {
    if (discardedLines.length === 0) return;
    const headers = 'SKU,Part Number,Bodega,Qty,Unit Net Price,Extended Net Price\n';
    const rows = discardedLines
      .map(
        (l) =>
          `"${l.sku || ''}","${l.partNumber}","${l.bodega}",${l.qty},${l.unitNetPrice},${l.extendedNetPrice}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PN_Descartados_Costo0_${clientName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-zinc-100 font-sans flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 mb-3 gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📋</span> Solicitud de Creación de BO (Ventas Core)
              </h2>

              {/* Indicador de Estado Cloud Database */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border transition-all ${
                  cloudStatus === 'saving'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                    : cloudStatus === 'saved'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : isCloudReady
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
                title="Sincronización en la nube con Firestore y almacenamiento local para memoria de SKUs"
              >
                {cloudStatus === 'saving' ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                ) : cloudStatus === 'saved' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Cloud className="w-3 h-3 text-indigo-400" />
                )}
                <span>
                  {cloudStatus === 'saving'
                    ? 'Guardando en la nube...'
                    : cloudStatus === 'saved'
                    ? 'SKU guardado en la nube'
                    : isCloudReady
                    ? `Nube Activa (${memorizedSkuCount} SKUs)`
                    : `Caché Local (${memorizedSkuCount} SKUs)`}
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Valores netos de costo puro. Part Numbers con sufijo <strong className="text-zinc-200">-CBN</strong> editable y auto-rellenado inteligente de SKUs Intcomex desde la base de datos en la nube.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Resumen Superior y Cabecera Correo */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 text-xs mb-3">
          <div>
            <span className="text-zinc-500 font-mono text-[11px] block">Para:</span>
            <div className="text-white font-medium truncate font-mono text-xs">{BO_EMAIL_TO}</div>
          </div>
          <div>
            <span className="text-zinc-500 font-mono text-[11px] block">CC:</span>
            <div className="text-white font-medium truncate font-mono text-xs">{BO_EMAIL_CC}</div>
          </div>
          <div>
            <span className="text-zinc-500 font-mono text-[11px] block">Asunto: RV: Cotización</span>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
              placeholder="Nombre del Cliente"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:border-l sm:border-zinc-800 sm:pl-3">
            <div className="text-right">
              <span className="text-zinc-500 font-mono text-[11px] block">Total Neto BO:</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                ${totals.totalExtended.toLocaleString('es-CL')} USD
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 font-mono text-[11px] block">Líneas Activas:</span>
              <span className="text-white font-mono font-bold text-sm">{lines.length}</span>
            </div>
          </div>
        </div>

        {/* Contenedor con Scroll para Tablas */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* TABLA PRINCIPAL (LÍNEAS CON VALOR ECONÓMICO) */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-zinc-900 px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Tabla Principal para BO ({lines.length} {lines.length === 1 ? 'ítem con costo' : 'ítems con costo'})
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                Bodega Asignada: <strong className="text-amber-400 font-bold">{lines[0]?.bodega || 'E1'}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#808080] text-black font-bold border-b border-zinc-800 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 text-center w-36">SKU</th>
                    <th className="p-2.5 text-center">Part Number</th>
                    <th className="p-2.5 text-center w-20">Bodega</th>
                    <th className="p-2.5 text-center w-16">Qty</th>
                    <th className="p-2.5 text-right w-32">Unit Net Price</th>
                    <th className="p-2.5 text-right w-36">Extended Net Price</th>
                    <th className="p-2.5 text-center w-14">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 bg-zinc-900/30 font-mono">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-zinc-500 font-sans">
                        No hay líneas con costo en la tabla activa. Puedes agregar líneas desde la sección de descartados abajo.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={line.sku}
                            placeholder="SKU Intcomex"
                            onChange={(e) => handleSkuChange(idx, e.target.value)}
                            onBlur={() => handleSkuBlur(idx)}
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-white text-xs w-32 focus:border-amber-400 focus:outline-none uppercase"
                            title="Código SKU Intcomex (se guarda automáticamente en la nube al salir del campo)"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={line.partNumber}
                            onChange={(e) => handlePartNumberChange(idx, e.target.value)}
                            className="bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-center font-mono font-bold text-zinc-100 text-xs w-full max-w-[240px] focus:border-amber-400 focus:outline-none"
                            title="Part Number Cisco (editable, por defecto incluye sufijo -CBN o puedes usar espacio CBN)"
                          />
                        </td>
                        <td className="p-2 text-center font-bold text-amber-400">{line.bodega}</td>
                        <td className="p-2 text-center">{line.qty}</td>
                        <td className="p-2 text-right text-zinc-300">
                          {line.unitNetPrice.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-bold text-emerald-400">
                          {line.extendedNetPrice.toLocaleString('es-CL')}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveActiveLine(idx)}
                            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                            title="Descartar de la solicitud BO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lines.length > 0 && (
                  <tfoot className="bg-zinc-900 font-mono font-bold text-xs border-t border-zinc-800 text-zinc-200">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right font-sans">Totales:</td>
                      <td className="p-2.5 text-center text-white">{totals.totalQty}</td>
                      <td className="p-2.5 text-right text-zinc-400">—</td>
                      <td className="p-2.5 text-right text-emerald-400 text-sm">
                        ${totals.totalExtended.toLocaleString('es-CL')}
                      </td>
                      <td className="p-2.5 text-center"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* SECCIÓN DE P/N DESCARTADOS ($0 USD) */}
          <div className="border border-zinc-800/80 rounded-xl bg-zinc-950/70 overflow-hidden">
            <div className="bg-zinc-900/70 px-3.5 py-2.5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiscardedExpanded(!isDiscardedExpanded)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                >
                  {isDiscardedExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                  <span>P/N Descartados con Costo $0 USD</span>
                </button>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded-full border border-zinc-700/60">
                  {discardedLines.length} {discardedLines.length === 1 ? 'línea excluida' : 'líneas excluidas'}
                </span>
              </div>

              {discardedLines.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDiscardedCsv}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-colors cursor-pointer"
                    title="Descargar listado de ítems descartados en archivo CSV"
                  >
                    <Download className="w-3 h-3 text-zinc-400" />
                    <span>Descargar CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddAllDiscarded}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                    title="Agregar todos los P/N descartados a la tabla principal del BO"
                  >
                    <Plus className="w-3 h-3 text-amber-400" />
                    <span>Agregar Todos al BO</span>
                  </button>
                </div>
              )}
            </div>

            {isDiscardedExpanded && (
              <div className="p-3">
                <p className="text-[11px] text-zinc-400 mb-2.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>
                    Estos P/N no tienen costo neto ($0 USD, e.g. cables, kits de montaje, licencias base o inclusiones) y fueron excluidos automáticamente para mantener limpia la solicitud a Ventas Core. Si necesitas incluir alguno, pulsa <strong>"Agregar"</strong>.
                  </span>
                </p>

                {discardedLines.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 text-xs font-mono border border-dashed border-zinc-800 rounded-lg">
                    No hay líneas descartadas (todos los P/N del Estimate están en la tabla principal de BO).
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-zinc-800/70 rounded-lg">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-zinc-900 text-zinc-400 font-semibold text-[11px] border-b border-zinc-800">
                        <tr>
                          <th className="p-2 text-center w-36">SKU</th>
                          <th className="p-2 text-center">Part Number</th>
                          <th className="p-2 text-center w-20">Bodega</th>
                          <th className="p-2 text-center w-16">Qty</th>
                          <th className="p-2 text-right w-28">Unit Net</th>
                          <th className="p-2 text-right w-28">Ext. Net</th>
                          <th className="p-2 text-center w-24">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 bg-zinc-950/40 font-mono text-[11px]">
                        {discardedLines.map((dLine, dIdx) => (
                          <tr key={dIdx} className="hover:bg-zinc-900/60 transition-colors text-zinc-400">
                            <td className="p-1.5 text-center">
                              <input
                                type="text"
                                value={dLine.sku}
                                placeholder="Opcional"
                                onChange={(e) => handleDiscardedSkuChange(dIdx, e.target.value)}
                                onBlur={() => handleDiscardedSkuBlur(dIdx)}
                                className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center font-mono text-zinc-400 text-[11px] w-28 focus:border-amber-400 focus:outline-none uppercase"
                                title="Código SKU Intcomex (se guarda automáticamente en la nube al salir del campo)"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                type="text"
                                value={dLine.partNumber}
                                onChange={(e) => handleDiscardedPartNumberChange(dIdx, e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center font-mono text-zinc-300 text-[11px] w-full max-w-[200px] focus:border-amber-400 focus:outline-none"
                                title="Part Number Cisco (editable)"
                              />
                            </td>
                            <td className="p-1.5 text-center text-zinc-500">{dLine.bodega}</td>
                            <td className="p-1.5 text-center">{dLine.qty}</td>
                            <td className="p-1.5 text-right text-zinc-500">$0,00</td>
                            <td className="p-1.5 text-right text-zinc-500">$0</td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleAddDiscardedLine(dIdx)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-zinc-800 hover:bg-amber-600/30 text-amber-300 border border-zinc-700 hover:border-amber-500/40 rounded transition-colors cursor-pointer"
                                title="Mover este P/N a la tabla activa de BO"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Agregar</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botones de Acción Inferiores */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleOpenOutlook}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-white rounded-xl border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Abrir plantilla en Microsoft Outlook o cliente de correo predeterminado"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>Abrir en Outlook</span>
            </button>

            <button
              onClick={handleCopy}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40'
              }`}
              title="Copiar tabla HTML con cabecera gris para pegar directamente en Outlook"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Copiado con Formato Outlook!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Tabla HTML para Outlook</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
