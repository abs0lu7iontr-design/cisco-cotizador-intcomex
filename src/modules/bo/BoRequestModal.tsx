// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODAL (ACTIVE & DISCARDED P/N)
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BoLineItem,
  partitionBoLinesByCost,
  detectBodegaFromActiveLines,
  isBoServiceOrLicense,
} from './boTypes';
import {
  DEFAULT_BO_EMAIL_TO,
  DEFAULT_BO_EMAIL_CC,
  formatCLP,
  copyBoTableToClipboard,
  copyBoTableWithDetail,
  getBoTimeBasedGreeting,
  BoTableExportOptions,
} from './boEmailHelper';
import { getMotherLineKey } from '../../core/calculations';
import {
  fetchBoSkuCatalog,
  saveBoSkuMapping,
  batchSaveBoSkuMappings,
  findSkuInCatalog,
  importBoSkuMappingsFromExcel,
  getLocalBoSkuCache,
} from './boSkuCatalogService';
import { syncBoOrderFromEstimateModal } from './boTrackingService';
import { BoOrderTrackingRecord } from './boTrackingTypes';
import { ProcessedEstimateResult } from '../../core/types';
import { openDesktopEmailClient } from '../../core/desktopBridge';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Trash2,
  Check,
  Mail,
  Copy,
  Cloud,
  RefreshCw,
  Upload,
  Truck,
  Layers,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialClientName: string;
  initialLines: BoLineItem[];
  assignedBodega?: 'E1' | 'ED';
  estimateResult?: ProcessedEstimateResult | null;
  detectedPartner?: string;
  currentUser?: any;
  onClose: () => void;
  onRegisterTracking?: () => void;
  onOrderSynced?: (record: BoOrderTrackingRecord) => void;
}

export const BoRequestModal: React.FC<Props> = ({
  isOpen,
  initialClientName,
  initialLines,
  assignedBodega,
  estimateResult,
  detectedPartner,
  currentUser,
  onClose,
  onRegisterTracking,
  onOrderSynced,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(DEFAULT_BO_EMAIL_TO);
  const [ccEmail, setCcEmail] = useState(DEFAULT_BO_EMAIL_CC);
  const [clientName, setClientName] = useState(initialClientName || 'Cliente');
  const [lines, setLines] = useState<BoLineItem[]>([]);
  const [discardedLines, setDiscardedLines] = useState<BoLineItem[]>([]);
  const [manualBodega, setManualBodega] = useState<'E1' | 'ED' | null>(null);
  const [isDiscardedExpanded, setIsDiscardedExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Modo de visualización: 'unified' (tabla continua) o 'by_line' (separado por línea madre con subtotales)
  const [viewMode, setViewMode] = useState<'unified' | 'by_line'>('unified');
  // Filtro de línea para generación/copia selectiva de OC separada ('ALL' o '1.0', '2.0', etc.)
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');

  // Estados de persistencia y catálogo en la nube
  const [skuCatalog, setSkuCatalog] = useState<Record<string, string>>({});
  const [isCloudReady, setIsCloudReady] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [memorizedSkuCount, setMemorizedSkuCount] = useState<number>(0);
  const [isImportingExcel, setIsImportingExcel] = useState<boolean>(false);
  const [importNotice, setImportNotice] = useState<
    { type: 'success' | 'error' | 'info'; message: string } | string | null
  >(null);
  const statusTimerRef = useRef<any>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Inicializar, particionar líneas y auto-completar SKUs desde la nube al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    setClientName(initialClientName || 'Cliente');
    setRecipientEmail(DEFAULT_BO_EMAIL_TO);
    setCcEmail(DEFAULT_BO_EMAIL_CC);
    setCopied(false);
    setManualBodega(null);
    setViewMode('unified');
    setSelectedLineFilter('ALL');

    const { activeLines, zeroCostLines } = partitionBoLinesByCost(initialLines);
    const initialAutoBodega = detectBodegaFromActiveLines(
      activeLines.length > 0 ? activeLines : initialLines
    );

    // Cargar catálogo de SKUs desde Firestore Cloud + Local Cache
    fetchBoSkuCatalog().then(({ catalog, isCloudConnected }) => {
      setSkuCatalog(catalog);
      setIsCloudReady(isCloudConnected);
      const count = Object.keys(catalog).length;
      setMemorizedSkuCount(count);

      // Auto-rellenar SKU si no viene definido y sincronizar bodega según líneas activas
      const filledActive = activeLines.map((line, idx) => {
        const matched = !line.sku ? findSkuInCatalog(line.partNumber, catalog) : line.sku;
        const isSvcOrLic = isBoServiceOrLicense(line.partNumber, undefined, line.isHardware);
        const resolvedLineNumber = line.lineNumber || estimateResult?.items?.[idx]?.lineNumber || '1.0';
        const resolvedMotherLine = line.motherLine || (resolvedLineNumber ? getMotherLineKey(resolvedLineNumber) : '1.0');
        return {
          ...line,
          sku: matched || line.sku,
          bodega: initialAutoBodega,
          isServiceOrLicense: isSvcOrLic,
          isHardware: !isSvcOrLic,
          lineNumber: resolvedLineNumber,
          motherLine: resolvedMotherLine,
        };
      });

      const filledDiscarded = zeroCostLines.map((line) => {
        const matched = !line.sku ? findSkuInCatalog(line.partNumber, catalog) : line.sku;
        const isSvcOrLic = isBoServiceOrLicense(line.partNumber, undefined, line.isHardware);
        const resolvedLineNumber = line.lineNumber || '1.0';
        const resolvedMotherLine = line.motherLine || (resolvedLineNumber ? getMotherLineKey(resolvedLineNumber) : '1.0');
        return {
          ...line,
          sku: matched || line.sku,
          bodega: initialAutoBodega,
          isServiceOrLicense: isSvcOrLic,
          isHardware: !isSvcOrLic,
          lineNumber: resolvedLineNumber,
          motherLine: resolvedMotherLine,
        };
      });

      setLines(filledActive);
      setDiscardedLines(filledDiscarded);
    });
  }, [isOpen, initialClientName, initialLines, estimateResult]);

  // Totales de la tabla activa completa
  const totals = useMemo(() => {
    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalExtended = lines.reduce((acc, l) => acc + (Number(l.extendedNetPrice) || 0), 0);
    return { totalQty, totalExtended };
  }, [lines]);

  // Lista ordenada de todas las líneas madre disponibles en las líneas activas (ej. '1.0', '2.0')
  const availableMotherLines = useMemo(() => {
    const keys = new Set<string>();
    for (const l of lines) {
      const key = l.motherLine || (l.lineNumber ? getMotherLineKey(l.lineNumber) : '1.0');
      keys.add(key);
    }
    return Array.from(keys).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
  }, [lines]);

  // Agrupación estructurada de ítems por línea madre con subtotales e índices originales preservados
  const lineGroups = useMemo(() => {
    const map = new Map<string, Array<{ line: BoLineItem; originalIndex: number }>>();
    lines.forEach((line, originalIndex) => {
      const motherKey = line.motherLine || (line.lineNumber ? getMotherLineKey(line.lineNumber) : '1.0');
      if (!map.has(motherKey)) {
        map.set(motherKey, []);
      }
      map.get(motherKey)!.push({ line, originalIndex });
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));

    return sortedKeys.map((motherKey) => {
      const itemsWithIndex = map.get(motherKey)!;
      const subtotalQty = itemsWithIndex.reduce((acc, { line }) => acc + (Number(line.qty) || 0), 0);
      const subtotalExtended = itemsWithIndex.reduce((acc, { line }) => acc + (Number(line.extendedNetPrice) || 0), 0);
      return {
        motherKey,
        itemsWithIndex,
        subtotalQty,
        subtotalExtended,
      };
    });
  }, [lines]);

  // Líneas filtradas según selectedLineFilter con su índice original en 'lines'
  const displayLinesWithIndex = useMemo(() => {
    return lines
      .map((line, originalIndex) => ({ line, originalIndex }))
      .filter(({ line }) => {
        if (selectedLineFilter === 'ALL') return true;
        const key = line.motherLine || (line.lineNumber ? getMotherLineKey(line.lineNumber) : '1.0');
        return key === selectedLineFilter;
      });
  }, [lines, selectedLineFilter]);

  // Totales de las líneas visualizadas (considerando filtro de línea madre activo)
  const displayTotals = useMemo(() => {
    const totalQty = displayLinesWithIndex.reduce((acc, { line }) => acc + (Number(line.qty) || 0), 0);
    const totalExtended = displayLinesWithIndex.reduce((acc, { line }) => acc + (Number(line.extendedNetPrice) || 0), 0);
    return { totalQty, totalExtended };
  }, [displayLinesWithIndex]);

  // Bodega detectada automáticamente a partir de los ítems activos en la Tabla Principal para BO
  const autoDetectedBodega: 'E1' | 'ED' = useMemo(() => {
    if (lines.length > 0) {
      return detectBodegaFromActiveLines(lines);
    }
    if (discardedLines.length > 0) {
      return detectBodegaFromActiveLines(discardedLines);
    }
    return 'E1';
  }, [lines, discardedLines]);

  const currentBodega: 'E1' | 'ED' = manualBodega || autoDetectedBodega;

  // Sincroniza la bodega efectiva en todas las líneas activas y descartadas
  const syncLinesWithAutoBodega = (nextActive: BoLineItem[], nextDiscarded: BoLineItem[]) => {
    const nextAutoBodega = detectBodegaFromActiveLines(
      nextActive.length > 0 ? nextActive : nextDiscarded
    );
    setManualBodega(null);
    setLines(nextActive.map((l) => ({ ...l, bodega: nextAutoBodega })));
    setDiscardedLines(nextDiscarded.map((l) => ({ ...l, bodega: nextAutoBodega })));
  };

  // Permite al usuario cambiar manualmente la bodega entre E1 y ED en cualquier momento
  const handleManualBodegaChange = (targetBodega: 'E1' | 'ED') => {
    setManualBodega(targetBodega);
    setLines((prev) => prev.map((l) => ({ ...l, bodega: targetBodega })));
    setDiscardedLines((prev) => prev.map((l) => ({ ...l, bodega: targetBodega })));
  };

  if (!isOpen) return null;

  // Actualización de Part Number editable en tabla activa (re-evalúa bodega automáticamente)
  const handlePartNumberChange = (index: number, newPn: string) => {
    const updated = [...lines];
    const isSvcOrLic = isBoServiceOrLicense(newPn);
    const item: BoLineItem = {
      ...updated[index],
      partNumber: newPn,
      isServiceOrLicense: isSvcOrLic,
      isHardware: !isSvcOrLic,
    };

    // Si no tiene SKU, intentar auto-rellenarlo con el nuevo P/N
    if (!item.sku) {
      const matched = findSkuInCatalog(newPn, skuCatalog);
      if (matched) {
        item.sku = matched;
      }
    }
    updated[index] = item;
    syncLinesWithAutoBodega(updated, discardedLines);
  };

  // Actualización de Part Number editable en tabla de descartados
  const handleDiscardedPartNumberChange = (index: number, newPn: string) => {
    const updated = [...discardedLines];
    const isSvcOrLic = isBoServiceOrLicense(newPn);
    const item: BoLineItem = {
      ...updated[index],
      partNumber: newPn,
      isServiceOrLicense: isSvcOrLic,
      isHardware: !isSvcOrLic,
    };
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

  // Mover una línea de descartadas a la tabla activa (recalcula bodega E1/ED inmediatamente)
  const handleAddDiscardedLine = (index: number) => {
    const item = discardedLines[index];
    const nextDiscarded = discardedLines.filter((_, i) => i !== index);
    const nextActive = [...lines, item];
    syncLinesWithAutoBodega(nextActive, nextDiscarded);
  };

  // Mover todas las líneas descartadas a la tabla activa (recalcula bodega E1/ED inmediatamente)
  const handleAddAllDiscarded = () => {
    const nextActive = [...lines, ...discardedLines];
    syncLinesWithAutoBodega(nextActive, []);
  };

  // Descartar una línea de la tabla activa hacia la sección de descartados (al inicio y conservando su precio)
  // Si solo quedan servicios o licencias en la tabla activa, cambia inmediatamente a ED
  const handleRemoveActiveLine = (index: number) => {
    const item = lines[index];
    const nextActive = lines.filter((_, i) => i !== index);
    const nextDiscarded = [item, ...discardedLines];
    syncLinesWithAutoBodega(nextActive, nextDiscarded);
    setIsDiscardedExpanded(true);
  };

  // Guardar de forma robusta e inmediata todos los SKUs cargados (tabla activa y descartados)
  const syncAllCurrentSkus = async (): Promise<void> => {
    const allItems: Array<{ partNumber: string; sku: string }> = [];
    for (const l of lines) {
      if (l.partNumber && l.sku && l.sku.trim()) {
        allItems.push({ partNumber: l.partNumber.trim(), sku: l.sku.trim() });
      }
    }
    for (const d of discardedLines) {
      if (d.partNumber && d.sku && d.sku.trim()) {
        allItems.push({ partNumber: d.partNumber.trim(), sku: d.sku.trim() });
      }
    }
    if (allItems.length > 0) {
      setCloudStatus('saving');
      await batchSaveBoSkuMappings(allItems);
      const refreshed = getLocalBoSkuCache();
      setSkuCatalog(refreshed);
      setMemorizedSkuCount(Object.keys(refreshed).length);
      setCloudStatus('saved');
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setCloudStatus('idle'), 3000);
    }
  };

  // Copiar solo un bloque de línea madre al portapapeles en formato Outlook
  const handleCopyLineBlock = async (motherKey: string) => {
    await syncAllCurrentSkus();
    const linesWithCurrentBodega = lines.map((l) => ({ ...l, bodega: currentBodega }));
    const copyRes = await copyBoTableWithDetail(linesWithCurrentBodega, {
      groupByLine: false,
      selectedLine: motherKey,
    });

    const linesToSync = linesWithCurrentBodega.filter(
      (l) => (l.motherLine || getMotherLineKey(l.lineNumber)) === motherKey
    );
    const syncRes = await syncBoOrderFromEstimateModal({
      estimate: estimateResult,
      clientName: `${clientName} (Línea ${motherKey})`,
      lines: linesToSync,
      bodega: currentBodega,
      author: currentUser?.full_name || currentUser?.username || 'Usuario',
      partnerName: detectedPartner,
      actionSource: 'COPY_HTML',
    });
    if (syncRes.success && syncRes.record && onOrderSynced) {
      onOrderSynced(syncRes.record);
    }

    if (copyRes.success) {
      setCopied(true);
      const grp = lineGroups.find((g) => g.motherKey === motherKey);
      setImportNotice({
        type: 'success',
        message: `¡Tabla de Línea ${motherKey} copiada para Outlook (Subtotal: $${formatCLP(grp?.subtotalExtended || 0, 2)} USD)!`,
      });
      setTimeout(() => {
        setCopied(false);
        setImportNotice(null);
      }, 4000);
    } else {
      setImportNotice({
        type: 'error',
        message: copyRes.error || copyRes.message || 'No se pudo copiar la tabla al portapapeles.',
      });
      setTimeout(() => setImportNotice(null), 4000);
    }
  };

  // Copiar tabla HTML al portapapeles, sincronizar SKUs a la nube y registrar BO en tracking
  const handleCopy = async () => {
    // 1. Guardar y sincronizar todos los SKUs cargados a la base de datos antes de copiar
    await syncAllCurrentSkus();

    // 2. Copiar tabla enriquecida para Outlook respetando el modo (unificado vs agrupado por líneas con subtotales)
    const linesWithCurrentBodega = lines.map((l) => ({ ...l, bodega: currentBodega }));
    const exportOpts: BoTableExportOptions = {
      groupByLine: viewMode === 'by_line',
      selectedLine: selectedLineFilter !== 'ALL' ? selectedLineFilter : undefined,
    };
    const copyRes = await copyBoTableWithDetail(linesWithCurrentBodega, exportOpts);

    // 3. Registrar la transición del Estimate a Back Order (BO) en la base de datos de seguimiento logístico
    const linesToSync = selectedLineFilter !== 'ALL'
      ? linesWithCurrentBodega.filter((l) => (l.motherLine || getMotherLineKey(l.lineNumber)) === selectedLineFilter)
      : linesWithCurrentBodega;

    const syncRes = await syncBoOrderFromEstimateModal({
      estimate: estimateResult,
      clientName: selectedLineFilter !== 'ALL' ? `${clientName} (Línea ${selectedLineFilter})` : clientName,
      lines: linesToSync,
      bodega: currentBodega,
      author: currentUser?.full_name || currentUser?.username || 'Usuario',
      partnerName: detectedPartner,
      actionSource: 'COPY_HTML',
    });

    if (syncRes.success && syncRes.record && onOrderSynced) {
      onOrderSynced(syncRes.record);
    }

    if (copyRes.success) {
      setCopied(true);
      const modeDesc = selectedLineFilter !== 'ALL'
        ? `Línea ${selectedLineFilter}`
        : viewMode === 'by_line'
        ? 'agrupada con subtotales por línea'
        : 'vista unificada';
      setImportNotice({
        type: 'success',
        message: `¡Tabla BO (${modeDesc}) copiada para Outlook y registrada en Base de Datos & Tracking (Etapa: OC Recibida)!`,
      });
      setTimeout(() => {
        setCopied(false);
        setImportNotice(null);
      }, 4000);
    } else {
      setImportNotice({
        type: 'error',
        message: copyRes.error || copyRes.message || 'No se pudo copiar la tabla BO al portapapeles.',
      });
      setTimeout(() => setImportNotice(null), 4500);
    }
  };

  // Abrir cliente de correo, sincronizar SKUs y registrar transición a BO
  const handleOpenOutlook = async () => {
    // 1. Guardar y sincronizar todos los SKUs cargados
    await syncAllCurrentSkus();

    // 2. Registrar la transición del Estimate a Back Order (BO) en la base de datos de seguimiento logístico
    const linesWithCurrentBodega = lines.map((l) => ({ ...l, bodega: currentBodega }));
    const linesToSync = selectedLineFilter !== 'ALL'
      ? linesWithCurrentBodega.filter((l) => (l.motherLine || getMotherLineKey(l.lineNumber)) === selectedLineFilter)
      : linesWithCurrentBodega;

    const syncRes = await syncBoOrderFromEstimateModal({
      estimate: estimateResult,
      clientName: selectedLineFilter !== 'ALL' ? `${clientName} (Línea ${selectedLineFilter})` : clientName,
      lines: linesToSync,
      bodega: currentBodega,
      author: currentUser?.full_name || currentUser?.username || 'Usuario',
      partnerName: detectedPartner,
      actionSource: 'OPEN_OUTLOOK',
    });

    if (syncRes.success && syncRes.record && onOrderSynced) {
      onOrderSynced(syncRes.record);
    }

    const greeting = getBoTimeBasedGreeting();
    const lineSuffix = selectedLineFilter !== 'ALL' ? ` - Línea ${selectedLineFilter}` : '';
    const rawSubject = `RV: Cotización ${clientName.trim()}${lineSuffix}`;
    const rawBody = `Estimado,\n\n${greeting}, por favor crear BO${selectedLineFilter !== 'ALL' ? ` para Línea ${selectedLineFilter}` : ''}.\n\n(Pega aquí la tabla copiada usando CTRL+V)\n\nSaludos,`;

    // Intentar abrir vía API nativa de escritorio (Outlook / Windows Shell)
    const openedInDesktop = await openDesktopEmailClient(recipientEmail, ccEmail, rawSubject, rawBody);
    if (!openedInDesktop) {
      // Fallback a enlace mailto en navegador
      const subject = encodeURIComponent(rawSubject);
      const body = encodeURIComponent(rawBody);
      window.location.href = `mailto:${recipientEmail}?cc=${ccEmail}&subject=${subject}&body=${body}`;
    }

    setImportNotice({
      type: 'success',
      message: '¡Solicitud BO abierta en Outlook y registrada en Base de Datos & Tracking (Etapa: OC Recibida)!',
    });
    setTimeout(() => setImportNotice(null), 4000);
  };

  // Importación masiva de catálogo Part Number <-> SKU desde archivo Excel
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingExcel(true);
    setImportNotice(null);
    try {
      const buffer = await file.arrayBuffer();
      const res = await importBoSkuMappingsFromExcel(buffer);
      if (res.success && res.importedCount > 0) {
        setImportNotice(`¡${res.importedCount} SKUs importados exitosamente!`);
        // Recargar catálogo actualizado
        const refreshed = await fetchBoSkuCatalog();
        setSkuCatalog(refreshed.catalog);
        setMemorizedSkuCount(Object.keys(refreshed.catalog).length);

        // Actualizar líneas activas y descartadas con los nuevos SKUs
        setLines((prev) =>
          prev.map((l) => {
            if (!l.sku) {
              const matched = findSkuInCatalog(l.partNumber, refreshed.catalog);
              if (matched) return { ...l, sku: matched };
            }
            return l;
          })
        );
        setDiscardedLines((prev) =>
          prev.map((l) => {
            if (!l.sku) {
              const matched = findSkuInCatalog(l.partNumber, refreshed.catalog);
              if (matched) return { ...l, sku: matched };
            }
            return l;
          })
        );
        setTimeout(() => setImportNotice(null), 5000);
      } else {
        setImportNotice(`Error: ${res.error || 'No se importaron SKUs'}`);
        setTimeout(() => setImportNotice(null), 5000);
      }
    } catch (err: any) {
      setImportNotice(`Error procesando archivo: ${err?.message || 'Error'}`);
      setTimeout(() => setImportNotice(null), 5000);
    } finally {
      setIsImportingExcel(false);
      if (e.target) e.target.value = '';
    }
  };

  // Descargar CSV con los P/N descartados de costo 0
  const handleDownloadDiscardedCsv = () => {
    if (discardedLines.length === 0) return;
    const headers = 'SKU,Part Number,Bodega,Qty,Unit Net Price,Extended Net Price\n';
    const rows = discardedLines
      .map(
        (l) =>
          `"${l.sku || ''}","${l.partNumber}","${currentBodega}",${l.qty},${formatCLP(l.unitNetPrice, 2)},${formatCLP(l.extendedNetPrice, 2)}`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
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

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                Precios Finales de Venta
              </span>

              {/* Selector Interactivo + Auto-Detección de Bodega (E1 vs ED) */}
              <div
                className="inline-flex items-center gap-1 bg-zinc-900 border border-amber-800/70 rounded-lg px-2 py-0.5 text-[10px] font-mono"
                title="Cambia automáticamente a ED cuando solo hay licencias/servicios activos, o haz clic para cambiar manualmente entre E1 y ED"
              >
                <span className="text-zinc-400">Bodega:</span>
                <button
                  type="button"
                  onClick={() => handleManualBodegaChange('E1')}
                  className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                    currentBodega === 'E1'
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  E1
                </button>
                <button
                  type="button"
                  onClick={() => handleManualBodegaChange('ED')}
                  className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                    currentBodega === 'ED'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  ED
                </button>
                <span className="text-[9px] text-zinc-400 ml-0.5">
                  ({currentBodega === 'ED' ? 'Licencias/Servicios' : 'Con Equipos'})
                </span>
              </div>

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

              {/* Botón Importación Masiva Excel PN <-> SKU */}
              <input
                type="file"
                ref={excelInputRef}
                accept=".xlsx, .xls"
                onChange={handleImportExcelFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                disabled={isImportingExcel}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 transition-colors cursor-pointer disabled:opacity-50"
                title="Cargar archivo Excel con columnas Part Number y SKU para enriquecer el catálogo automáticamente"
              >
                {isImportingExcel ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                ) : (
                  <Upload className="w-3 h-3 text-indigo-400" />
                )}
                <span>{isImportingExcel ? 'Importando...' : 'Importar Excel (PN/SKU)'}</span>
              </button>

              {importNotice && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded animate-fade-in border ${
                    (typeof importNotice === 'object' && importNotice.type === 'error') ||
                    (typeof importNotice === 'string' && importNotice.startsWith('Error'))
                      ? 'text-rose-300 bg-rose-950/60 border-rose-800/80'
                      : 'text-cyan-300 bg-cyan-950/60 border-cyan-800/80'
                  }`}
                >
                  {typeof importNotice === 'string' ? importNotice : importNotice.message}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Valores calculados por el cotizador con margen e internación. Part Numbers con sufijo <strong className="text-zinc-200">-CBN</strong> editable y auto-rellenado de SKUs Intcomex.
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

        {/* Resumen Superior y Cabecera Correo Editable */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 text-xs mb-3">
          <div>
            <label className="text-zinc-400 font-mono text-[10px] block mb-1">Para:</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded px-2.5 py-1 text-xs font-mono text-white outline-none"
            />
          </div>
          <div>
            <label className="text-zinc-400 font-mono text-[10px] block mb-1">CC:</label>
            <input
              type="text"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded px-2.5 py-1 text-xs font-mono text-white outline-none"
            />
          </div>
          <div>
            <label className="text-zinc-400 font-mono text-[10px] block mb-1">Asunto: RV: Cotización</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-medium font-mono"
              placeholder="Nombre del Cliente"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:border-l sm:border-zinc-800 sm:pl-3">
            <div className="text-right">
              <span className="text-zinc-400 font-mono text-[10px] block">
                {selectedLineFilter === 'ALL' ? 'Total Venta BO:' : `Total Línea ${selectedLineFilter}:`}
              </span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                ${formatCLP(displayTotals.totalExtended, 2)} USD
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-400 font-mono text-[10px] block">Líneas Activas:</span>
              <span className="text-white font-mono font-bold text-sm">
                {displayLinesWithIndex.length}
                {selectedLineFilter !== 'ALL' && (
                  <span className="text-[10px] text-zinc-500 font-normal"> / {lines.length}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Contenedor con Scroll para Tablas */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* TABLA PRINCIPAL (LÍNEAS CON VALOR ECONÓMICO) */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-zinc-900 px-3.5 py-2.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Tabla Principal para BO ({displayLinesWithIndex.length}{' '}
                  {displayLinesWithIndex.length === 1 ? 'ítem activo' : 'ítems activos'})
                </span>

                {/* Segmented Control: Vista Unificada vs Separar por Líneas (Subtotales por OC) */}
                <div className="inline-flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px] font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('unified');
                      setSelectedLineFilter('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'unified'
                        ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Vista unificada estándar (todos los ítems en una sola tabla continua)"
                  >
                    <span>📋 Vista Unificada</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('by_line')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'by_line'
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Separar ítems por Línea Madre (con subtotales por OC y Total General al final)"
                  >
                    <Layers className="w-3 h-3 text-indigo-300" />
                    <span>📑 Separar por Líneas (Subtotales)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                <span>Bodega Asignada:</span>
                <div className="inline-flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => handleManualBodegaChange('E1')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      currentBodega === 'E1'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Bodega E1 (Equipos / Mixto)"
                  >
                    E1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualBodegaChange('ED')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      currentBodega === 'ED'
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Bodega ED (Solo Licencias o Servicios)"
                  >
                    ED
                  </button>
                </div>
                <span className="text-[9px] text-zinc-500">
                  ({currentBodega === 'ED' ? 'Licencias/Servicios' : 'Con Equipos'})
                </span>
              </div>
            </div>

            {/* Barra de Filtro de Líneas Madre para OCs separadas */}
            {availableMotherLines.length > 1 && (
              <div className="bg-zinc-950/90 px-3.5 py-1.5 border-b border-zinc-800/80 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider mr-1">
                  Filtrar OC:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLineFilter('ALL')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors cursor-pointer border ${
                    selectedLineFilter === 'ALL'
                      ? 'bg-zinc-800 text-white border-zinc-600 font-bold'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                  title="Ver todas las líneas del deal"
                >
                  Todas las Líneas ({lines.length})
                </button>
                {availableMotherLines.map((mKey) => {
                  const grp = lineGroups.find((g) => g.motherKey === mKey);
                  const isSelected = selectedLineFilter === mKey;
                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => {
                        setSelectedLineFilter(mKey);
                        setViewMode('by_line');
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-colors cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 font-bold'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                      title={`Filtrar para generar BO exclusivo para la OC de Línea ${mKey}`}
                    >
                      <span>Línea {mKey}</span>
                      <span className="text-[10px] opacity-75">
                        ({grp?.itemsWithIndex.length || 0} ítems &bull; ${formatCLP(grp?.subtotalExtended || 0, 2)})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

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
                  ) : viewMode === 'by_line' ? (
                    // MODO SEPARADO POR LÍNEA MADRE CON SUBTOTAES
                    (selectedLineFilter === 'ALL'
                      ? lineGroups
                      : lineGroups.filter((g) => g.motherKey === selectedLineFilter)
                    ).map((group) => (
                      <React.Fragment key={group.motherKey}>
                        {/* Fila de Encabezado de Bloque de Línea Madre */}
                        <tr className="bg-zinc-800/80 border-y border-zinc-700 font-sans">
                          <td colSpan={7} className="px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono text-xs font-bold">
                                  📦 Bloque Línea {group.motherKey}
                                </span>
                                <span className="text-zinc-300 text-xs font-medium">
                                  ({group.itemsWithIndex.length}{' '}
                                  {group.itemsWithIndex.length === 1 ? 'ítem' : 'ítems'})
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-zinc-400">
                                  Subtotal Línea {group.motherKey}:{' '}
                                  <strong className="text-emerald-400 font-bold text-xs">
                                    ${formatCLP(group.subtotalExtended, 2)} USD
                                  </strong>{' '}
                                  <span className="text-[10px] text-zinc-500">
                                    ({group.subtotalQty} uds)
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLineBlock(group.motherKey)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-700/50 hover:border-indigo-500 transition-colors cursor-pointer"
                                  title={`Copiar solo la tabla de Línea ${group.motherKey} con formato Outlook para esta OC`}
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Copiar Línea {group.motherKey}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Filas de los Ítems pertenecientes a este Bloque */}
                        {group.itemsWithIndex.map(({ line, originalIndex }) => (
                          <tr
                            key={originalIndex}
                            className="hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="p-2 text-center">
                              <input
                                type="text"
                                value={line.sku}
                                placeholder="SKU Intcomex"
                                onChange={(e) => handleSkuChange(originalIndex, e.target.value)}
                                onBlur={() => handleSkuBlur(originalIndex)}
                                className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-white text-xs w-32 focus:border-amber-400 focus:outline-none uppercase"
                                title="Código SKU Intcomex (se guarda automáticamente en la nube al salir del campo)"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {line.lineNumber && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                    {line.lineNumber}
                                  </span>
                                )}
                                <input
                                  type="text"
                                  value={line.partNumber}
                                  onChange={(e) =>
                                    handlePartNumberChange(originalIndex, e.target.value)
                                  }
                                  className="bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-center font-mono font-bold text-zinc-100 text-xs w-full max-w-[240px] focus:border-amber-400 focus:outline-none"
                                  title="Part Number Cisco (editable, por defecto incluye sufijo -CBN o puedes usar espacio CBN)"
                                />
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleManualBodegaChange(currentBodega === 'E1' ? 'ED' : 'E1')
                                }
                                className={`px-2 py-0.5 rounded font-bold text-xs border transition-colors cursor-pointer ${
                                  currentBodega === 'ED'
                                    ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60 hover:bg-cyan-900/60'
                                    : 'bg-amber-950/60 text-amber-400 border-amber-700/60 hover:bg-amber-900/60'
                                }`}
                                title="Clic para cambiar bodega entre E1 y ED"
                              >
                                {currentBodega}
                              </button>
                            </td>
                            <td className="p-2 text-center">{line.qty}</td>
                            <td className="p-2 text-right text-zinc-300">
                              {formatCLP(line.unitNetPrice, 2)}
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-400">
                              {formatCLP(line.extendedNetPrice, 2)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveActiveLine(originalIndex)}
                                className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                                title="Descartar de la solicitud BO"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Fila de Subtotal del Bloque de Línea */}
                        <tr className="bg-zinc-900/90 font-mono font-bold text-xs border-b-2 border-zinc-800 text-zinc-300">
                          <td colSpan={3} className="p-2 text-right text-zinc-400 font-sans">
                            Subtotal Línea {group.motherKey}:
                          </td>
                          <td className="p-2 text-center text-zinc-200">{group.subtotalQty}</td>
                          <td className="p-2 text-right text-zinc-500">—</td>
                          <td className="p-2 text-right text-emerald-400 font-bold">
                            ${formatCLP(group.subtotalExtended, 2)}
                          </td>
                          <td className="p-2 text-center"></td>
                        </tr>
                      </React.Fragment>
                    ))
                  ) : (
                    // MODO UNIFICADO ESTÁNDAR
                    displayLinesWithIndex.map(({ line, originalIndex }) => (
                      <tr
                        key={originalIndex}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={line.sku}
                            placeholder="SKU Intcomex"
                            onChange={(e) => handleSkuChange(originalIndex, e.target.value)}
                            onBlur={() => handleSkuBlur(originalIndex)}
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-white text-xs w-32 focus:border-amber-400 focus:outline-none uppercase"
                            title="Código SKU Intcomex (se guarda automáticamente en la nube al salir del campo)"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {line.lineNumber && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {line.lineNumber}
                              </span>
                            )}
                            <input
                              type="text"
                              value={line.partNumber}
                              onChange={(e) =>
                                handlePartNumberChange(originalIndex, e.target.value)
                              }
                              className="bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-center font-mono font-bold text-zinc-100 text-xs w-full max-w-[240px] focus:border-amber-400 focus:outline-none"
                              title="Part Number Cisco (editable, por defecto incluye sufijo -CBN o puedes usar espacio CBN)"
                            />
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleManualBodegaChange(currentBodega === 'E1' ? 'ED' : 'E1')
                            }
                            className={`px-2 py-0.5 rounded font-bold text-xs border transition-colors cursor-pointer ${
                              currentBodega === 'ED'
                                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60 hover:bg-cyan-900/60'
                                : 'bg-amber-950/60 text-amber-400 border-amber-700/60 hover:bg-amber-900/60'
                            }`}
                            title="Clic para cambiar bodega entre E1 y ED"
                          >
                            {currentBodega}
                          </button>
                        </td>
                        <td className="p-2 text-center">{line.qty}</td>
                        <td className="p-2 text-right text-zinc-300">
                          {formatCLP(line.unitNetPrice, 2)}
                        </td>
                        <td className="p-2 text-right font-bold text-emerald-400">
                          {formatCLP(line.extendedNetPrice, 2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveActiveLine(originalIndex)}
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
                {displayLinesWithIndex.length > 0 && (
                  <tfoot className="bg-zinc-900 font-mono font-bold text-xs border-t border-zinc-800 text-zinc-200">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right font-sans">
                        {selectedLineFilter === 'ALL'
                          ? viewMode === 'by_line'
                            ? 'Total General (Todas las Líneas):'
                            : 'Totales Generales:'
                          : `Total Línea ${selectedLineFilter}:`}
                      </td>
                      <td className="p-2.5 text-center text-white">{displayTotals.totalQty}</td>
                      <td className="p-2.5 text-right text-zinc-400">—</td>
                      <td className="p-2.5 text-right text-emerald-400 text-sm">
                        ${formatCLP(displayTotals.totalExtended, 2)}
                      </td>
                      <td className="p-2.5 text-center"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* SECCIÓN DE P/N DESCARTADOS ($0 USD Y EXCLUIDOS DE LA TABLA PRINCIPAL) */}
          <div className="border border-zinc-800/80 rounded-xl bg-zinc-950/70 overflow-hidden">
            <div className="bg-zinc-900/70 px-3.5 py-2.5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
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
                  <span>
                    {discardedLines.some((d) => (Number(d.unitNetPrice) || 0) > 0 || (Number(d.extendedNetPrice) || 0) > 0)
                      ? 'P/N Descartados / Excluidos del BO'
                      : 'P/N Descartados con Costo $0 USD'}
                  </span>
                </button>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded-full border border-zinc-700/60">
                  {discardedLines.length} {discardedLines.length === 1 ? 'línea excluida' : 'líneas excluidas'}
                </span>
                {(() => {
                  const pricedDiscardedCount = discardedLines.filter(
                    (d) => (Number(d.unitNetPrice) || 0) > 0 || (Number(d.extendedNetPrice) || 0) > 0
                  ).length;
                  return pricedDiscardedCount > 0 ? (
                    <span className="text-[10px] bg-amber-950/70 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-700/60">
                      {pricedDiscardedCount} {pricedDiscardedCount === 1 ? 'ítem con precio excluido' : 'ítems con precio excluidos'}
                    </span>
                  ) : null;
                })()}
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
                    <span>Agregar Todos</span>
                  </button>
                </div>
              )}
            </div>

            {isDiscardedExpanded && (
              <div className="p-3">
                {discardedLines.length === 0 ? (
                  <div className="text-xs text-zinc-500 text-center py-4 font-sans">
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
                        {discardedLines.map((dLine, dIdx) => {
                          const hasPrice =
                            (Number(dLine.unitNetPrice) || 0) > 0 ||
                            (Number(dLine.extendedNetPrice) || 0) > 0;
                          return (
                            <tr
                              key={dIdx}
                              className={`transition-colors ${
                                hasPrice
                                  ? 'bg-amber-950/20 hover:bg-amber-950/30 text-zinc-200'
                                  : 'hover:bg-zinc-900/60 text-zinc-400'
                              }`}
                            >
                              <td className="p-1.5 text-center">
                                <input
                                  type="text"
                                  value={dLine.sku}
                                  placeholder="Opcional"
                                  onChange={(e) => handleDiscardedSkuChange(dIdx, e.target.value)}
                                  onBlur={() => handleDiscardedSkuBlur(dIdx)}
                                  className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center font-mono text-zinc-300 text-[11px] w-28 focus:border-amber-400 focus:outline-none uppercase"
                                  title="Código SKU Intcomex (se guarda automáticamente en la nube al salir del campo)"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <input
                                  type="text"
                                  value={dLine.partNumber}
                                  onChange={(e) => handleDiscardedPartNumberChange(dIdx, e.target.value)}
                                  className={`bg-zinc-900 border rounded px-1.5 py-0.5 text-center font-mono text-[11px] w-full max-w-[200px] focus:border-amber-400 focus:outline-none ${
                                    hasPrice
                                      ? 'border-amber-700/60 text-amber-200 font-bold'
                                      : 'border-zinc-800 text-zinc-300'
                                  }`}
                                  title="Part Number Cisco (editable)"
                                />
                              </td>
                              <td className="p-1.5 text-center text-zinc-400">{currentBodega}</td>
                              <td className="p-1.5 text-center">{dLine.qty}</td>
                              <td
                                className={`p-1.5 text-right ${
                                  hasPrice ? 'text-amber-300 font-semibold' : 'text-zinc-500'
                                }`}
                              >
                                ${formatCLP(dLine.unitNetPrice, 2)}
                              </td>
                              <td
                                className={`p-1.5 text-right ${
                                  hasPrice ? 'text-emerald-400 font-bold' : 'text-zinc-500'
                                }`}
                              >
                                ${formatCLP(dLine.extendedNetPrice, 2)}
                              </td>
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
                          );
                        })}
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
            {onRegisterTracking && (
              <button
                type="button"
                onClick={async () => {
                  await syncAllCurrentSkus();
                  const linesWithCurrentBodega = lines.map((l) => ({ ...l, bodega: currentBodega }));
                  const syncRes = await syncBoOrderFromEstimateModal({
                    estimate: estimateResult,
                    clientName,
                    lines: linesWithCurrentBodega,
                    bodega: currentBodega,
                    author: currentUser?.full_name || currentUser?.username || 'Usuario',
                    partnerName: detectedPartner,
                    actionSource: 'MODAL_ACTION',
                  });
                  if (syncRes.success && syncRes.record && onOrderSynced) {
                    onOrderSynced(syncRes.record);
                  }
                  onRegisterTracking();
                  onClose();
                }}
                className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/20"
                title="Ir al Tablero de Seguimiento y Ciclo de Vida de Órdenes BO"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Tracking BO</span>
              </button>
            )}

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
              title={
                selectedLineFilter !== 'ALL'
                  ? `Copiar tabla HTML de Línea ${selectedLineFilter} para pegar en Outlook`
                  : viewMode === 'by_line'
                  ? 'Copiar tabla HTML agrupada por líneas con subtotales por OC para pegar en Outlook'
                  : 'Copiar tabla HTML con cabecera gris para pegar directamente en Outlook'
              }
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Copiado con Formato Outlook!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {selectedLineFilter !== 'ALL'
                      ? `Copiar Tabla Línea ${selectedLineFilter} para Outlook`
                      : viewMode === 'by_line'
                      ? 'Copiar Tabla con Subtotales para Outlook'
                      : 'Copiar Tabla HTML para Outlook'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
