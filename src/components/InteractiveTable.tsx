import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProcessedEstimateResult, EstimateLineItem, QuoteParameters, OverrideRuleType } from '../core/types';
import {
  isMainLineItem,
  getMotherLineKey,
  CurrencyCode,
  CurrencyConversionRates,
  convertUsdToCurrency,
  formatCurrencyAmount,
} from '../core/calculations';
import {
  getSavedFrontendCurrency,
  getCachedDailyOfficialRates,
  getDefaultOfficialRatesSnapshot,
  snapshotToConversionRates,
  subscribeFrontendCurrencyChange,
} from '../core/chileanExchangeRateService';
import {
  Search,
  Check,
  Filter,
  MousePointerClick,
  Cpu,
  Zap,
  Tag,
  Save,
  Layers,
  MessageSquare,
  ShieldAlert,
  X,
  FileEdit,
} from 'lucide-react';

import { MobileEstimateCardList } from './mobile/MobileEstimateCardList';
import { useUiExperience } from '../core/themeEngine';
import { validateCiscoBom } from '../core/bomValidator';
import { BomValidatorModal } from './BomValidatorModal';

export type InteractiveTableFilterType = 'all' | 'intangible' | 'tangible' | 'arancel';

export interface InteractiveTableCategoryCounts {
  all: number;
  tangible: number;
  intangible: number;
  arancel: number;
}

export interface VirtualWindowSpec {
  isVirtualized: boolean;
  startIndex: number;
  endIndex: number;
  topPaddingPx: number;
  bottomPaddingPx: number;
  visibleCount: number;
}

/**
 * Calcula todos los contadores de categorías en una sola pasada O(N)
 * sin crear arreglos intermedios por cada botón de filtro.
 */
export function computeInteractiveTableCategoryCounts(
  items: readonly EstimateLineItem[]
): InteractiveTableCategoryCounts {
  let tangible = 0;
  let intangible = 0;
  let arancel = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.isIntangible) {
      intangible += 1;
    } else if (item.llevaArancel) {
      arancel += 1;
    } else {
      tangible += 1;
    }
  }

  return {
    all: items.length,
    tangible,
    intangible,
    arancel,
  };
}

/**
 * Filtra los ítems de la tabla en una sola pasada.
 */
export function filterInteractiveTableItems(
  items: readonly EstimateLineItem[],
  search: string,
  filterType: InteractiveTableFilterType
): EstimateLineItem[] {
  const normalizedSearch = search.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  if (!hasSearch && filterType === 'all') {
    return items as EstimateLineItem[];
  }

  const result: EstimateLineItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (filterType === 'intangible' && !item.isIntangible) continue;
    if (filterType === 'tangible' && (item.isIntangible || item.llevaArancel)) continue;
    if (filterType === 'arancel' && !item.llevaArancel) continue;

    if (hasSearch) {
      const partMatch = (item.partNumber || '').toLowerCase().includes(normalizedSearch);
      const descMatch = !partMatch && (item.description || '').toLowerCase().includes(normalizedSearch);
      const lineMatch = !partMatch && !descMatch && (item.lineNumber || '').toLowerCase().includes(normalizedSearch);
      if (!partMatch && !descMatch && !lineMatch) continue;
    }

    result.push(item);
  }

  return result;
}

/**
 * Calcula la ventana virtualizada de filas para cotizaciones grandes.
 */
export function computeVirtualWindow(
  totalRows: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number = 42,
  overscan: number = 12,
  virtualizationThreshold: number = 80
): VirtualWindowSpec {
  if (totalRows <= virtualizationThreshold) {
    return {
      isVirtualized: false,
      startIndex: 0,
      endIndex: totalRows,
      topPaddingPx: 0,
      bottomPaddingPx: 0,
      visibleCount: totalRows,
    };
  }

  const safeRowHeight = Math.max(24, rowHeight);
  const safeViewport = Math.max(safeRowHeight * 6, viewportHeight || 640);
  const safeScrollTop = Math.max(0, scrollTop || 0);

  const firstVisible = Math.floor(safeScrollTop / safeRowHeight);
  const visibleRowsCount = Math.ceil(safeViewport / safeRowHeight);

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(totalRows, firstVisible + visibleRowsCount + overscan);

  const topPaddingPx = startIndex * safeRowHeight;
  const bottomPaddingPx = Math.max(0, (totalRows - endIndex) * safeRowHeight);

  return {
    isVirtualized: true,
    startIndex,
    endIndex,
    topPaddingPx,
    bottomPaddingPx,
    visibleCount: Math.max(0, endIndex - startIndex),
  };
}

interface InteractiveTableProps {
  data?: ProcessedEstimateResult | null;
  items?: EstimateLineItem[];
  params?: QuoteParameters;
  onSetRowRule?: (rowIdx: number, rule: OverrideRuleType, sku?: string) => void;
  onToggleRowRule?: (rowIdx: number) => void;
  onToggleIntangible?: (rowIdx: number) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  item: EstimateLineItem | null;
}

const VIRTUAL_ROW_HEIGHT_PX = 42;
const VIRTUAL_VIEWPORT_MAX_HEIGHT_PX = 680;
const VIRTUALIZATION_ROW_THRESHOLD = 80;

export const InteractiveTable: React.FC<InteractiveTableProps> = ({
  data,
  items: itemsProp,
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0, parameterMode: 'standard', lineCustomParams: {} },
  onSetRowRule,
  onToggleRowRule,
}) => {
  const { isAesthetic, config: studioConfig } = useUiExperience();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<InteractiveTableFilterType>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(VIRTUAL_VIEWPORT_MAX_HEIGHT_PX);

  const [currency, setCurrency] = useState<CurrencyCode>(() => getSavedFrontendCurrency());
  const [rates, setRates] = useState<CurrencyConversionRates>(() =>
    snapshotToConversionRates(getCachedDailyOfficialRates(false) || getDefaultOfficialRatesSnapshot())
  );

  useEffect(() => {
    return subscribeFrontendCurrencyChange(() => {
      setCurrency(getSavedFrontendCurrency());
      const snap = getCachedDailyOfficialRates(false) || getDefaultOfficialRatesSnapshot();
      setRates(snapshotToConversionRates(snap));
    });
  }, []);

  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [editingNoteItem, setEditingNoteItem] = useState<EstimateLineItem | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [rowNotes, setRowNotes] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(`cisco_pm_row_notes_${data?.fileName || 'current'}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const bomReport = useMemo(() => {
    return validateCiscoBom(data?.items || []);
  }, [data?.items]);

  const saveRowNote = (rowIdx: number, note: string) => {
    const updated = { ...rowNotes };
    if (note.trim()) {
      updated[rowIdx] = note.trim();
    } else {
      delete updated[rowIdx];
    }
    setRowNotes(updated);
    try {
      localStorage.setItem(`cisco_pm_row_notes_${data?.fileName || 'current'}`, JSON.stringify(updated));
    } catch {}
    setEditingNoteItem(null);
    setToastMessage('Nota guardada correctamente.');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ isOpen: false, x: 0, y: 0, item: null });
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu({ isOpen: false, x: 0, y: 0, item: null });
      }
    };

    if (contextMenu.isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen]);

  const items: EstimateLineItem[] = useMemo(() => data?.items || itemsProp || [], [data?.items, itemsProp]);

  // Una sola pasada O(N) para todos los contadores de categorías
  const categoryCounts = useMemo(
    () => computeInteractiveTableCategoryCounts(items),
    [items]
  );

  // Filtrado memoizado
  const filteredItems = useMemo(
    () => filterInteractiveTableItems(items, search, filterType),
    [items, search, filterType]
  );

  // Resetear scroll al cambiar búsqueda o filtro
  useEffect(() => {
    setScrollTop(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [search, filterType]);

  const virtualWindow = useMemo(
    () =>
      computeVirtualWindow(
        filteredItems.length,
        scrollTop,
        viewportHeight,
        VIRTUAL_ROW_HEIGHT_PX,
        12,
        VIRTUALIZATION_ROW_THRESHOLD
      ),
    [filteredItems.length, scrollTop, viewportHeight]
  );

  const visibleItems = useMemo(
    () =>
      virtualWindow.isVirtualized
        ? filteredItems.slice(virtualWindow.startIndex, virtualWindow.endIndex)
        : filteredItems,
    [filteredItems, virtualWindow.isVirtualized, virtualWindow.startIndex, virtualWindow.endIndex]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    if (target.clientHeight > 0 && target.clientHeight !== viewportHeight) {
      setViewportHeight(target.clientHeight);
    }
  }, [viewportHeight]);

  const openContextMenuAtPosition = useCallback((clientX: number, clientY: number, item: EstimateLineItem) => {
    const menuWidth = 280;
    const menuHeight = 220;
    let posX = clientX;
    let posY = clientY;

    if (typeof window !== 'undefined') {
      if (posX + menuWidth > window.innerWidth) {
        posX = Math.max(8, window.innerWidth - menuWidth - 16);
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = Math.max(8, window.innerHeight - menuHeight - 16);
      }
    }

    setSelectedRowIdx(item.rowIdx);
    setContextMenu({
      isOpen: true,
      x: posX,
      y: posY,
      item,
    });
  }, []);

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, item: EstimateLineItem) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenuAtPosition(e.clientX, e.clientY, item);
    },
    [openContextMenuAtPosition]
  );

  const handleSelectRule = (rule: OverrideRuleType) => {
    if (!contextMenu.item) return;

    const targetItem = contextMenu.item;
    if (onSetRowRule) {
      onSetRowRule(targetItem.rowIdx, rule, targetItem.partNumber);
    } else if (onToggleRowRule) {
      onToggleRowRule(targetItem.rowIdx);
    }

    const ruleLabel =
      rule === 'equipo'
        ? `Hardware (+${params.internacionPct}% Internación)`
        : rule === 'intangible'
        ? 'Intangible (0% Internación / 0% Arancel)'
        : `Arancel (+${params.internacionPct}% Internación + ${params.arancelPct}% Arancel)`;

    setToastMessage(`SKU ${targetItem.partNumber} → ${ruleLabel} (Guardado en memoria)`);
    setTimeout(() => setToastMessage(null), 3000);

    setContextMenu({ isOpen: false, x: 0, y: 0, item: null });
  };

  const formatCurrency = useCallback(
    (amount?: number) => {
      if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
      if (currency === 'USD') {
        return (
          '$' +
          amount.toLocaleString('es-CL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
      const converted = convertUsdToCurrency(amount, currency, rates);
      return formatCurrencyAmount(converted, currency);
    },
    [currency, rates]
  );

  return (
    <div
      className={
        isAesthetic
          ? 'aesthetic-card rounded-2xl shadow-2xl overflow-hidden space-y-4 relative focus:outline-none border backdrop-blur-md transition-all duration-300'
          : 'bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 relative focus:outline-none'
      }
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center space-x-2.5 animate-slide-up border border-indigo-400/40"
        >
          <Save className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating 3-State Context Menu */}
      {contextMenu.isOpen && contextMenu.item && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Clasificación de SKU ${contextMenu.item.partNumber}`}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-72 bg-slate-950/95 border border-indigo-500/50 rounded-2xl p-2 shadow-2xl backdrop-blur-xl space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Clasificación de SKU
            </div>
            <div className="font-mono text-xs font-black text-indigo-300 truncate">
              {contextMenu.item.partNumber}
            </div>
            <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
              Bloque {contextMenu.item.inheritedFromMotherLine || getMotherLineKey(contextMenu.item.lineNumber)} &bull; Int:{' '}
              {contextMenu.item.effectiveInternacionPct ?? params.internacionPct}% &bull; Mg:{' '}
              {contextMenu.item.effectiveMargenPct ?? params.margenPct}%
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <Save className="w-3 h-3" />
              <span>Se guarda en memoria automáticamente</span>
            </div>
          </div>

          {/* Option 1: Hardware / Equipo */}
          <button
            role="menuitem"
            onClick={() => handleSelectRule('equipo')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              !contextMenu.item.isIntangible && !contextMenu.item.llevaArancel
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="font-bold">Hardware / Equipo</div>
                <div className="text-[10px] text-slate-400">+{params.internacionPct}% Internación</div>
              </div>
            </div>
            {!contextMenu.item.isIntangible && !contextMenu.item.llevaArancel && (
              <Check className="w-4 h-4 text-white" />
            )}
          </button>

          {/* Option 2: Intangible */}
          <button
            role="menuitem"
            onClick={() => handleSelectRule('intangible')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              contextMenu.item.isIntangible
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-bold">Intangible (Licencia / Soporte)</div>
                <div className="text-[10px] text-slate-400">0% Internación &bull; 0% Arancel</div>
              </div>
            </div>
            {contextMenu.item.isIntangible && <Check className="w-4 h-4 text-white" />}
          </button>

          {/* Option 3: Arancel */}
          <button
            role="menuitem"
            onClick={() => handleSelectRule('arancel')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              contextMenu.item.llevaArancel
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <div>
                <div className="font-bold">Arancel Aduanero (=)</div>
                <div className="text-[10px] text-slate-400">
                  +{params.internacionPct}% Int. + {params.arancelPct}% Arancel
                </div>
              </div>
            </div>
            {contextMenu.item.llevaArancel && <Check className="w-4 h-4 text-white" />}
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoComplete="off"
            aria-label="Buscar por SKU, descripción o línea"
            placeholder="Buscar por SKU, descripción o línea..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills (calculados en una sola pasada O(N)) */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-slate-500 text-xs flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filtrar:</span>
          </span>

          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todos ({categoryCounts.all})
          </button>

          <button
            onClick={() => setFilterType('tangible')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'tangible'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Hardware ({categoryCounts.tangible})
          </button>

          <button
            onClick={() => setFilterType('intangible')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'intangible'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Intangibles ({categoryCounts.intangible})
          </button>

          <button
            onClick={() => setFilterType('arancel')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'arancel'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Arancel ({categoryCounts.arancel})
          </button>

          {/* Predictive BOM Validator Pill */}
          {bomReport.hasIssues && (
            <button
              type="button"
              onClick={() => setIsBomModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm animate-pulse"
              title="Auditoría de preventa de compatibilidad y licencias Cisco"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Auditoría BOM ({bomReport.totalIssuesCount})</span>
            </button>
          )}

        </div>
      </div>

      {/* Helper Banner */}
      <div className="px-4 py-2 bg-indigo-950/30 border-y border-indigo-500/20 text-[11px] text-indigo-300 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            <strong>Tip:</strong> Haz <strong>clic derecho</strong> sobre cualquier fila para cambiar su clasificación (Hardware / Intangible / Arancel). La regla se recordará automáticamente para ese SKU.
          </span>
        </div>
        <div className="flex items-center gap-3">
          {params.parameterMode === 'custom_lines' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[10px] font-bold">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Modo: Parámetros Custom por Línea</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              Estándar CCW ({params.internacionPct}% Int &bull; {params.margenPct}% Mg)
            </span>
          )}

          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          Mostrando {filteredItems.length} de {items.length} ítems
            {virtualWindow.isVirtualized ? ` (Ventana activa: ${virtualWindow.startIndex + 1}-${virtualWindow.endIndex})` : ''}
          </span>
        </div>
      </div>

      {/* Mobile Touch Cards View (Only rendered on screens < md) */}
      <div className="block md:hidden p-3">
        <MobileEstimateCardList
          items={filteredItems}
          formatCurrency={formatCurrency}
          onCycleRule={onToggleRowRule}
          onSetRule={onSetRowRule}
        />
      </div>

      {/* Table Data (con soporte de virtualización automática para cotizaciones grandes) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={
          virtualWindow.isVirtualized
            ? { maxHeight: `${VIRTUAL_VIEWPORT_MAX_HEIGHT_PX}px`, overflowY: 'auto' }
            : undefined
        }
        className="hidden md:block overflow-x-auto"
      >
        <table className={`w-full text-left border-collapse text-xs ${isAesthetic ? `density-${studioConfig.density}` : ''}`}>
          <thead className={virtualWindow.isVirtualized ? 'sticky top-0 z-10' : undefined}>
            <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <th className="p-3 text-center w-14">Línea</th>
              <th className="p-3">Part Number</th>
              <th className="p-3">Descripción</th>
              <th className="p-3 text-center w-14">Cant.</th>
              <th className="p-3 text-right">Net Cisco (U)</th>
              <th className="p-3 text-right">Internación</th>
              <th className="p-3 text-right">Arancel</th>
              <th className="p-3 text-right">Costo Total (U)</th>
              <th className="p-3 text-right font-bold text-indigo-300 bg-indigo-950/20">PV Unitario</th>
              <th className="p-3 text-right font-bold text-emerald-400 bg-emerald-950/20">PV Extendido</th>
              <th className="p-3 text-center">Tipo / Regla</th>
              <th className="p-3 text-center">Lead Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500 text-xs">
                  No se encontraron ítems que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              <>
                {virtualWindow.topPaddingPx > 0 && (
                  <tr aria-hidden="true" style={{ height: `${virtualWindow.topPaddingPx}px` }}>
                    <td colSpan={12} className="p-0 border-0" />
                  </tr>
                )}
                {visibleItems.map((item) => {
                  const isMain = isMainLineItem(item.lineNumber);
                  const isSelected = selectedRowIdx === item.rowIdx;
                  if (item.isInfoRow) {
                    return (
                      <tr
                        key={item.rowIdx}
                        onClick={() => setSelectedRowIdx(item.rowIdx)}
                        className={`bg-slate-950/40 text-slate-400 italic hover:bg-slate-900/40 transition-colors ${
                          isSelected ? 'ring-1 ring-inset ring-indigo-500/60' : ''
                        }`}
                      >
                        <td className="p-3 text-center font-mono text-[11px] text-slate-600"></td>
                        <td colSpan={11} className="p-3 font-mono text-xs text-slate-400 pl-4">
                          {item.description}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={item.rowIdx}
                      onClick={() => setSelectedRowIdx(item.rowIdx)}
                      onContextMenu={(e) => handleRowContextMenu(e, item)}
                      title="Haz clic derecho para elegir: Hardware / Intangible / Arancel"
                      aria-selected={isSelected}
                      className={`transition-colors cursor-pointer select-none ${
                        isAesthetic ? 'table-row-spotlight ' : ''
                      }${
                        isSelected ? 'ring-1 ring-inset ring-indigo-500/70 bg-indigo-950/25 ' : ''
                      }${
                        item.isIntangible
                          ? 'bg-amber-950/10 hover:bg-amber-950/20'
                          : item.llevaArancel
                          ? 'bg-purple-950/10 hover:bg-purple-950/20'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td
                        className={`p-3 text-center font-mono ${
                          isMain ? 'font-bold text-white' : 'font-normal text-slate-400'
                        }`}
                      >
                        <div>{item.lineNumber}</div>
                        {isMain && item.isCustomParamApplied && (
                          <span
                            className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mt-0.5"
                            title={`Bloque custom: ${item.effectiveInternacionPct}% Int / ${item.effectiveArancelPct}% Ar / ${item.effectiveMargenPct}% Mg`}
                          >
                            Custom
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-3 font-mono whitespace-nowrap ${
                          isMain ? 'font-bold text-white' : 'font-normal text-slate-300 pl-6'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span>{item.partNumber}</span>
                          {/* PM Sticky Note Trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteItem(item);
                              setEditingNoteText(rowNotes[item.rowIdx] || '');
                            }}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              rowNotes[item.rowIdx]
                                ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
                                : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                            title={rowNotes[item.rowIdx] ? `Nota PM: ${rowNotes[item.rowIdx]}` : 'Agregar nota interna para este ítem'}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          {item.isFastTrackPromo && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-600/50"
                              title={`Promo Fast Track aplicada: ${item.fastTrackDiscountPct?.toFixed(1)}% dcto`}
                            >
                              <Zap className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                              FT
                            </span>
                          )}
                        </div>
                        {rowNotes[item.rowIdx] && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteItem(item);
                              setEditingNoteText(rowNotes[item.rowIdx] || '');
                            }}
                            className="text-[10px] text-amber-300 bg-amber-950/50 border border-amber-600/30 rounded px-1.5 py-0.5 mt-1 font-sans flex items-center gap-1 max-w-xs cursor-pointer hover:bg-amber-950/80 transition-colors"
                            title="Haz clic para editar la nota"
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span className="truncate">{rowNotes[item.rowIdx]}</span>
                          </div>
                        )}
                        {!isMain && (
                          <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mt-0.5">
                            <span>↳ Hereda de {item.inheritedFromMotherLine || getMotherLineKey(item.lineNumber)}</span>
                            {item.isCustomParamApplied && (
                              <span className="text-indigo-400 font-mono text-[9px]">
                                ({item.isIntangible ? "0% Int/Ar" : `${item.effectiveInternacionPct}% Int`} • {item.effectiveMargenPct}% Mg)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className={`p-3 text-slate-300 max-w-xs truncate ${isMain ? '' : 'pl-6'}`}
                        title={item.description}
                      >
                        {item.description}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-200">
                        {item.qty}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        {formatCurrency(item.netCiscoUnit)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">
                        {item.isIntangible ? (
                          <span className="text-slate-600">-</span>
                        ) : (
                          <span
                            className={item.isCustomParamApplied ? "text-indigo-300 font-semibold" : ""}
                            title={item.isCustomParamApplied ? `Internación custom del bloque: ${item.effectiveInternacionPct}%` : undefined}
                          >
                            {formatCurrency(item.costoInternacion)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">
                        {item.llevaArancel ? (
                          <span
                            className="text-purple-400 font-bold"
                            title={item.isCustomParamApplied ? `Arancel del bloque: ${item.effectiveArancelPct}%` : undefined}
                          >
                            {formatCurrency(item.costoArancel)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200 font-semibold">
                        {formatCurrency(item.costoTotalUnitario)}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold text-indigo-300 bg-indigo-950/20 ${
                          item.isCustomParamApplied ? "ring-1 ring-inset ring-indigo-500/40" : ""
                        }`}
                        title={item.isCustomParamApplied ? `Margen de bloque: ${item.effectiveMargenPct}%` : undefined}
                      >
                        {formatCurrency(item.precioVentaUnitario)}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold text-emerald-400 bg-emerald-950/20 ${
                          item.isCustomParamApplied ? "ring-1 ring-inset ring-emerald-500/40" : ""
                        }`}
                        title={item.isCustomParamApplied ? `Margen de bloque: ${item.effectiveMargenPct}%` : undefined}
                      >
                        {formatCurrency(item.precioVentaExtendido)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => handleRowContextMenu(e, item)}
                          className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border cursor-pointer transition-transform hover:scale-105 inline-flex items-center gap-1.5 ${
                            item.isIntangible
                              ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                              : item.llevaArancel
                              ? 'bg-purple-950 text-purple-300 border-purple-600/40'
                              : 'bg-indigo-950 text-indigo-300 border-indigo-600/40'
                          }`}
                        >
                          {isAesthetic && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                item.isIntangible
                                  ? 'bg-amber-400'
                                  : item.llevaArancel
                                  ? 'bg-purple-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                          )}
                          <span>{item.isIntangible ? 'INTANGIBLE' : item.llevaArancel ? 'ARANCEL (=)' : 'HARDWARE'}</span>
                        </button>
                      </td>
                      <td className="p-3 text-center text-[11px] text-slate-400 whitespace-nowrap">
                        {item.transformedLeadTime || '-'}
                      </td>
                    </tr>
                  );
                })}
                {virtualWindow.bottomPaddingPx > 0 && (
                  <tr aria-hidden="true" style={{ height: `${virtualWindow.bottomPaddingPx}px` }}>
                    <td colSpan={12} className="p-0 border-0" />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* PM Row Sticky Note Modal */}
      {editingNoteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Nota Interna de Preventa</h4>
                  <span className="font-mono text-[10px] text-indigo-300">
                    Línea {editingNoteItem.lineNumber} &bull; {editingNoteItem.partNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={3}
              value={editingNoteText}
              onChange={(e) => setEditingNoteText(e.target.value)}
              placeholder="Escribe una observación, acuerdo comercial con Cisco o recordatorio de entrega..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => saveRowNote(editingNoteItem.rowIdx, '')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Eliminar Nota
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNoteItem(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveRowNote(editingNoteItem.rowIdx, editingNoteText)}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                >
                  Guardar Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bom Validator Modal */}
      <BomValidatorModal
        isOpen={isBomModalOpen}
        onClose={() => setIsBomModalOpen(false)}
        report={bomReport}
      />

    </div>
  );
};

