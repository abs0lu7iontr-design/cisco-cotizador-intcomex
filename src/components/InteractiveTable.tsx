import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProcessedEstimateResult, EstimateLineItem, QuoteParameters, OverrideRuleType } from '../core/types';
import {
  isMainLineItem,
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
} from 'lucide-react';

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
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  onSetRowRule,
  onToggleRowRule,
}) => {
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

  const ensureFilterIndexVisible = useCallback(
    (indexInFiltered: number) => {
      if (!virtualWindow.isVirtualized || !scrollContainerRef.current) return;
      const rowTop = indexInFiltered * VIRTUAL_ROW_HEIGHT_PX;
      const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT_PX;
      const container = scrollContainerRef.current;
      if (rowTop < container.scrollTop) {
        container.scrollTop = rowTop;
        setScrollTop(rowTop);
      } else if (rowBottom > container.scrollTop + container.clientHeight) {
        const nextScroll = Math.max(0, rowBottom - container.clientHeight);
        container.scrollTop = nextScroll;
        setScrollTop(nextScroll);
      }
    },
    [virtualWindow.isVirtualized]
  );

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (filteredItems.length === 0) return;

      const currentIdx = filteredItems.findIndex((it) => it.rowIdx === selectedRowIdx);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx < 0 ? 0 : Math.min(filteredItems.length - 1, currentIdx + 1);
        const nextItem = filteredItems[nextIdx];
        if (nextItem) {
          setSelectedRowIdx(nextItem.rowIdx);
          ensureFilterIndexVisible(nextIdx);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
        const prevItem = filteredItems[prevIdx];
        if (prevItem) {
          setSelectedRowIdx(prevItem.rowIdx);
          ensureFilterIndexVisible(prevIdx);
        }
      } else if (e.key === 'ContextMenu' || (e.key === 'Enter' && currentIdx >= 0)) {
        const activeItem = filteredItems[currentIdx];
        if (activeItem && !activeItem.isInfoRow) {
          e.preventDefault();
          const rect = scrollContainerRef.current?.getBoundingClientRect();
          const x = rect ? rect.left + rect.width / 2 : 240;
          const y = rect ? rect.top + 120 : 200;
          openContextMenuAtPosition(x, y, activeItem);
        }
      }
    },
    [filteredItems, selectedRowIdx, ensureFilterIndexVisible, openContextMenuAtPosition]
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
      className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 relative focus:outline-none"
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
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
        </div>
      </div>

      {/* Helper Banner */}
      <div className="px-4 py-2 bg-indigo-950/30 border-y border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            <strong>Tip:</strong> Haz <strong>clic derecho</strong> sobre cualquier fila para cambiar su clasificación (Hardware / Intangible / Arancel). La regla se recordará automáticamente para ese SKU.
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          Mostrando {filteredItems.length} de {items.length} ítems
          {virtualWindow.isVirtualized ? ` (Ventana activa: ${virtualWindow.startIndex + 1}-${virtualWindow.endIndex})` : ''}
        </span>
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
        className="overflow-x-auto"
      >
        <table className="w-full text-left border-collapse text-xs">
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
                        {item.lineNumber}
                      </td>
                      <td
                        className={`p-3 font-mono whitespace-nowrap ${
                          isMain ? 'font-bold text-white' : 'font-normal text-slate-300 pl-6'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span>{item.partNumber}</span>
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
                          formatCurrency(item.costoInternacion)
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">
                        {item.llevaArancel ? (
                          <span className="text-purple-400 font-bold">{formatCurrency(item.costoArancel)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200 font-semibold">
                        {formatCurrency(item.costoTotalUnitario)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-300 bg-indigo-950/20">
                        {formatCurrency(item.precioVentaUnitario)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400 bg-emerald-950/20">
                        {formatCurrency(item.precioVentaExtendido)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => handleRowContextMenu(e, item)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-transform hover:scale-105 ${
                            item.isIntangible
                              ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                              : item.llevaArancel
                              ? 'bg-purple-950 text-purple-300 border-purple-600/40'
                              : 'bg-indigo-950 text-indigo-300 border-indigo-600/40'
                          }`}
                        >
                          {item.isIntangible ? 'INTANGIBLE' : item.llevaArancel ? 'ARANCEL (=)' : 'HARDWARE'}
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
    </div>
  );
};

