import React, { useState } from 'react';
import { EstimateLineItem, OverrideRuleType } from '../../core/types';
import { isMainLineItem } from '../../core/calculations';
import {
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';

interface MobileEstimateCardListProps {
  items: readonly EstimateLineItem[];
  formatCurrency: (val: number) => string;
  onCycleRule?: (rowIdx: number) => void;
  onSetRule?: (rowIdx: number, rule: OverrideRuleType, sku?: string) => void;
}

export const MobileEstimateCardList: React.FC<MobileEstimateCardListProps> = ({
  items,
  formatCurrency,
  onCycleRule,
  onSetRule,
}) => {
  const [selectedItem, setSelectedItem] = useState<EstimateLineItem | null>(null);

  const getRuleBadge = (item: EstimateLineItem) => {
    if (item.appliedRule === 'intangible' || item.isIntangible) {
      return { label: 'LIC / INT', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50' };
    }
    if (item.appliedRule === 'arancel' || item.llevaArancel) {
      return { label: 'ARANCEL 6%', bg: 'bg-amber-950/70 text-amber-300 border-amber-800/50' };
    }
    return { label: 'HARDWARE', bg: 'bg-blue-950/70 text-blue-300 border-blue-800/50' };
  };

  return (
    <div className="space-y-3 pb-4">
      {items.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
          No se encontraron ítems para mostrar.
        </div>
      ) : (
        items.map((item) => {
          if (item.isInfoRow) {
            return (
              <div
                key={item.rowIdx}
                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-400 italic text-[11px] font-mono"
              >
                {item.description || item.partNumber || 'Nota informativa'}
              </div>
            );
          }

          const isMain = isMainLineItem(item.lineNumber);
          const badge = getRuleBadge(item);

          return (
            <div
              key={item.rowIdx}
              onClick={() => setSelectedItem(item)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] select-none ${
                isMain
                  ? 'bg-slate-900 border-slate-700/80 shadow-md'
                  : 'bg-slate-950/70 border-slate-800/80'
              }`}
            >
              {/* Header: Line #, SKU & Rule Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                    {item.lineNumber}
                  </span>
                  <span className="font-mono font-black text-xs text-white truncate">
                    {item.partNumber}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Hierarchy & Custom Line Parameters */}
              {!isMain && (
                <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mb-1.5">
                  <span>↳ Hereda de {item.inheritedFromMotherLine || (item.lineNumber ? `${item.lineNumber.split('.')[0]}.0` : '1.0')}</span>
                  {item.isCustomParamApplied && (
                    <span className="text-indigo-400 font-mono text-[9px]">
                      ({item.isIntangible ? '0% Int/Ar' : `${item.effectiveInternacionPct}% Int`} • {item.effectiveMargenPct}% Mg)
                    </span>
                  )}
                </div>
              )}
              {isMain && item.isCustomParamApplied && (
                <div className="text-[10px] text-indigo-300 font-mono flex items-center gap-1 mb-1.5">
                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-bold">
                    Bloque Custom: {item.effectiveInternacionPct}% Int &bull; {item.effectiveMargenPct}% Mg
                  </span>
                </div>
              )}

              {/* Description */}
              {item.description && (
                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-2.5">
                  {item.description}
                </p>
              )}

              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-black/30 border border-white/5 text-[11px] font-mono">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 block">Cant.</span>
                  <span className="font-bold text-slate-200">{item.qty}</span>
                </div>

                <div>
                  <span className="text-[9px] uppercase text-slate-500 block">PV Unit.</span>
                  <span className="font-bold text-indigo-300">{formatCurrency(item.precioVentaUnitario)}</span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-500 block">PV Total</span>
                  <span className="font-black text-emerald-400">{formatCurrency(item.precioVentaExtendido)}</span>
                </div>
              </div>

              {/* Footer: Lead Time & Net Cost */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate max-w-[170px]">{item.transformedLeadTime || '175 días (27 sem)'}</span>
                </span>

                <span className="text-slate-400">
                  Net: <strong className="text-slate-300">{formatCurrency(item.netCiscoUnit)}</strong>
                </span>
              </div>
            </div>
          );
        })
      )}

      {/* Item Detail Bottom Sheet Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
          />

          <div className="relative z-10 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Sheet Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-700/40">
                    Línea {selectedItem.lineNumber}
                  </span>
                  <span className="font-mono font-bold text-white text-xs truncate max-w-[200px]">
                    {selectedItem.partNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {selectedItem.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Details List */}
            <div className="p-4 space-y-3 overflow-y-auto text-xs font-mono custom-scrollbar">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Cantidad:</span>
                  <span className="font-bold text-white text-sm">{selectedItem.qty} unidades</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Net Cisco Unitario:</span>
                  <span className="font-bold text-white">{formatCurrency(selectedItem.netCiscoUnit)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Costo Internación Unitario:</span>
                  <span className="font-bold text-indigo-300">{formatCurrency(selectedItem.costoInternacion)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Arancel Aduanero (6%):</span>
                  <span className="font-bold text-amber-300">{formatCurrency(selectedItem.costoArancel)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300 pt-1.5 border-t border-slate-800">
                  <span className="text-slate-400 font-bold">Costo Total Compra (U):</span>
                  <span className="font-bold text-white">{formatCurrency(selectedItem.costoTotalUnitario)}</span>
                </div>
              </div>

              {/* Selling Prices */}
              <div className="bg-gradient-to-br from-indigo-950/60 to-slate-950 p-3.5 rounded-2xl border border-indigo-500/30 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-300 font-bold">Precio Venta Unitario:</span>
                  <span className="font-black text-indigo-200 text-sm">{formatCurrency(selectedItem.precioVentaUnitario)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-400 font-bold">Precio Venta Total:</span>
                  <span className="font-black text-emerald-300 text-base">{formatCurrency(selectedItem.precioVentaExtendido)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-indigo-500/20 text-slate-400">
                  <span>Lead Time Estimado:</span>
                  <span className="text-slate-200">{selectedItem.transformedLeadTime || '175 días Miami'}</span>
                </div>
              </div>

              {/* Cycle / Change Rule Actions */}
              <div className="pt-2 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Reclasificación de Regla de Negocio:
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSetRule) onSetRule(selectedItem.rowIdx, 'equipo', selectedItem.partNumber);
                      setSelectedItem({ ...selectedItem, appliedRule: 'equipo', isIntangible: false, llevaArancel: false });
                    }}
                    className={`py-2 px-2.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                      selectedItem.appliedRule === 'equipo' || (!selectedItem.isIntangible && !selectedItem.llevaArancel)
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Hardware (HW)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSetRule) onSetRule(selectedItem.rowIdx, 'intangible', selectedItem.partNumber);
                      setSelectedItem({ ...selectedItem, appliedRule: 'intangible', isIntangible: true, llevaArancel: false });
                    }}
                    className={`py-2 px-2.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                      selectedItem.appliedRule === 'intangible' || selectedItem.isIntangible
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Licencia (LIC)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSetRule) onSetRule(selectedItem.rowIdx, 'arancel', selectedItem.partNumber);
                      setSelectedItem({ ...selectedItem, appliedRule: 'arancel', isIntangible: false, llevaArancel: true });
                    }}
                    className={`py-2 px-2.5 rounded-xl text-center text-[10px] font-bold border transition-colors cursor-pointer ${
                      selectedItem.appliedRule === 'arancel' || selectedItem.llevaArancel
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Arancel (6%)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
