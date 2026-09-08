import React, { useState, useEffect, useRef } from 'react';
import { ProcessedEstimateResult, EstimateLineItem, QuoteParameters, OverrideRuleType } from '../core/types';
import { isMainLineItem } from '../core/calculations';
import {
  Search,
  Check,
  ShieldAlert,
  Sparkles,
  Filter,
  Truck,
  MousePointerClick,
  Layers,
  Cpu,
  Zap,
  Tag,
  Save,
  HelpCircle,
} from 'lucide-react';

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

export const InteractiveTable: React.FC<InteractiveTableProps> = ({
  data,
  items: itemsProp,
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  onSetRowRule,
  onToggleRowRule,
  onToggleIntangible,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'intangible' | 'tangible' | 'arancel'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

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

  const items: EstimateLineItem[] = data?.items || itemsProp || [];

  const handleRowContextMenu = (e: React.MouseEvent, item: EstimateLineItem) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate clamped positions to avoid overflowing window edges
    const menuWidth = 280;
    const menuHeight = 220;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 16;
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 16;
    }

    setContextMenu({
      isOpen: true,
      x: posX,
      y: posY,
      item,
    });
  };

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

    setToastMessage(`SKU ${targetItem.partNumber} &rarr; ${ruleLabel} (Guardado en memoria)`);
    setTimeout(() => setToastMessage(null), 3000);

    setContextMenu({ isOpen: false, x: 0, y: 0, item: null });
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.partNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.lineNumber || '').includes(search);

    if (!matchesSearch) return false;

    if (filterType === 'intangible') return item.isIntangible;
    if (filterType === 'tangible') return !item.isIntangible && !item.llevaArancel;
    if (filterType === 'arancel') return item.llevaArancel;
    return true;
  });

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    return (
      '$' +
      amount.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center space-x-2.5 animate-slide-up border border-indigo-400/40">
          <Save className="w-4 h-4 text-amber-300 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: toastMessage }} />
        </div>
      )}

      {/* Floating 3-State Context Menu */}
      {contextMenu.isOpen && contextMenu.item && (
        <div
          ref={menuRef}
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
            placeholder="Buscar por SKU, descripción o línea..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills */}
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
            Todos ({items.length})
          </button>

          <button
            onClick={() => setFilterType('tangible')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'tangible'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Hardware ({items.filter((i) => !i.isIntangible && !i.llevaArancel).length})
          </button>

          <button
            onClick={() => setFilterType('intangible')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'intangible'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Intangibles ({items.filter((i) => i.isIntangible).length})
          </button>

          <button
            onClick={() => setFilterType('arancel')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
              filterType === 'arancel'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Arancel ({items.filter((i) => i.llevaArancel).length})
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
        </span>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
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
              filteredItems.map((item) => {
                const isMain = isMainLineItem(item.lineNumber);
                if (item.isInfoRow) {
                  return (
                    <tr
                      key={item.rowIdx}
                      className="bg-slate-950/40 text-slate-400 italic hover:bg-slate-900/40 transition-colors"
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
                    onContextMenu={(e) => handleRowContextMenu(e, item)}
                    title="Haz clic derecho para elegir: Hardware / Intangible / Arancel"
                    className={`transition-colors cursor-pointer select-none ${
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
