// ============================================================================
// CISCO AUTOMATED v2.1 - MODERN SAAS EXCEL SHEET PREVIEW WITH 3-RULE CONTEXT MENU
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { ProcessedEstimateResult, QuoteParameters, EstimateLineItem, OverrideRuleType } from '../core/types';
import { isMainLineItem } from '../core/calculations';
import {
  Eye,
  MousePointerClick,
  FileSpreadsheet,
  CheckCircle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Cpu,
  Zap,
  Tag,
  Save,
  Check,
} from 'lucide-react';
import { INTCOMEX_LOGO_DATA_URI, CISCO_AUTOMATED_SEAL_DATA_URI } from '../core/brandingLogos';

interface ExcelSheetPreviewProps {
  data?: ProcessedEstimateResult | null;
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

export const ExcelSheetPreview: React.FC<ExcelSheetPreviewProps> = ({
  data,
  params = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  onSetRowRule,
  onToggleRowRule,
  onToggleIntangible,
}) => {
  const [showRecalculated, setShowRecalculated] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    item: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        No hay cotización cargada para previsualizar.
      </div>
    );
  }

  const handleRowContextMenu = (e: React.MouseEvent, item: EstimateLineItem) => {
    e.preventDefault();
    e.stopPropagation();

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
    } else if (onToggleIntangible) {
      onToggleIntangible(targetItem.rowIdx);
    }

    const ruleLabel =
      rule === 'equipo'
        ? `Hardware (+${params.internacionPct}% Internación)`
        : rule === 'intangible'
        ? 'Intangible (0% Internación / 0% Arancel)'
        : `Arancel (+${params.internacionPct}% Int. + ${params.arancelPct}% Arancel)`;

    setToastMessage(`SKU ${targetItem.partNumber} &rarr; ${ruleLabel} (Guardado en memoria)`);
    setTimeout(() => setToastMessage(null), 3000);

    setContextMenu({ isOpen: false, x: 0, y: 0, item: null });
  };

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
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

      {/* Header Controls Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
              <span>VISTA PREVIA - HOJA OFICIAL CISCO CCW</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Formato corporativo Intcomex con 7 columnas oficiales limpias
            </p>
          </div>
        </div>

        {/* Toggle Mode Button */}
        <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setShowRecalculated(true)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
              showRecalculated
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Versión con Margen {params.margenPct}%</span>
          </button>
          <button
            onClick={() => setShowRecalculated(false)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              !showRecalculated
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Cisco CCW Original</span>
          </button>
        </div>
      </div>

      {/* Sheet Simulation Container */}
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Intcomex Header Metadata */}
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800/80 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="h-10 px-3 py-1 bg-white rounded-xl flex items-center justify-center shadow-md">
              <img
                src={INTCOMEX_LOGO_DATA_URI}
                alt="Intcomex Logo"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Price Estimate</h2>
              <p className="text-xs text-slate-400 font-semibold">{data.headerInfo.companyName}</p>
            </div>
          </div>

          <div className="space-y-1 md:text-right font-mono text-xs">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Datos de Cotización</div>
            <div>
              <span className="text-slate-500">Estimate ID:</span>{' '}
              <strong className="text-indigo-400 text-sm">{data.headerInfo.estimateId}</strong>
            </div>
            <div>
              <span className="text-slate-500">Deal ID:</span>{' '}
              <strong className="text-slate-200">{data.headerInfo.dealId}</strong>
            </div>
            <div>
              <span className="text-slate-500">Fecha:</span>{' '}
              <span className="text-slate-300">{data.headerInfo.date}</span>
            </div>
          </div>
        </div>

        {/* Cisco Legal Header Notice */}
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-600/30 text-rose-300 text-[11px] font-semibold text-center">
          Price Estimate for planning and information purposes only and is not a binding offer from Cisco.
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/60 shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <th className="p-3.5 text-center w-16">Line</th>
                <th className="p-3.5">Part Number</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-center">Lead Time</th>
                <th className="p-3.5 text-center w-14">Qty</th>
                <th className="p-3.5 text-right">Unit Net Price</th>
                <th className="p-3.5 text-right font-bold text-emerald-400 bg-emerald-950/20">
                  Extended Net Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {data.items.map((item) => {
                const unitPrice = showRecalculated
                  ? item.precioVentaUnitario
                  : item.netCiscoUnit;
                const extPrice = showRecalculated
                  ? item.precioVentaExtendido
                  : item.netCiscoUnit * item.qty;

                const isMain = isMainLineItem(item.lineNumber);

                if (item.isInfoRow) {
                  return (
                    <tr
                      key={item.rowIdx}
                      className="bg-slate-950/40 text-slate-400 italic hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-3 text-center font-mono text-[11px] text-slate-600"></td>
                      <td colSpan={6} className="p-3 font-mono text-xs text-slate-400 pl-4">
                        {item.description}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.rowIdx}
                    onContextMenu={(e) => handleRowContextMenu(e, item)}
                    title="Haz clic derecho para elegir: Hardware / Intangible / Arancel (Se guarda en memoria)"
                    className={`transition-colors cursor-pointer select-none ${
                      item.isIntangible
                        ? 'bg-amber-950/15 hover:bg-amber-950/30'
                        : item.llevaArancel
                        ? 'bg-purple-950/15 hover:bg-purple-950/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td
                      className={`p-3.5 text-center font-mono ${
                        isMain ? 'font-bold text-white' : 'font-normal text-slate-400'
                      }`}
                    >
                      {item.lineNumber}
                    </td>
                    <td className="p-3.5 font-mono">
                      <div className={`flex items-center space-x-2 ${isMain ? 'font-bold text-white' : 'font-normal text-slate-300 pl-4'}`}>
                        <span>{item.partNumber}</span>
                        {item.isIntangible && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-600/40">
                            INTANGIBLE
                          </span>
                        )}
                        {item.llevaArancel && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-bold border border-purple-600/40">
                            ARANCEL 6%
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`p-3.5 text-slate-300 max-w-sm truncate ${isMain ? '' : 'pl-4'}`}
                      title={item.description}
                    >
                      {item.description}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {item.transformedLeadTime ? (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-medium">
                          {item.transformedLeadTime}
                        </span>
                      ) : (
                        <span className="text-slate-600">&le; 2 días</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-white">{item.qty}</td>
                    <td className="p-3.5 text-right font-mono text-slate-200">
                      {formatCurrency(unitPrice)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-400 bg-emerald-950/10">
                      {formatCurrency(extPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 font-bold border-t-2 border-slate-800 text-sm">
                <td colSpan={5} className="p-4 text-right text-slate-400 uppercase text-xs tracking-wider">
                  Price Total (USD):
                </td>
                <td colSpan={2} className="p-4 text-right font-mono text-emerald-400 text-lg font-black">
                  {formatCurrency(
                    showRecalculated ? data.calculatedProductTotal : data.originalProductTotal
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Single 14-Day Notice */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center space-x-2 text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>
              <strong>Validez de la Oferta:</strong> Esta cotización tiene una validez de <strong className="text-rose-500">14 días</strong> corridos a contar de su fecha de emisión.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Cisco Automated v2.1</span>
        </div>
      </div>
    </div>
  );
};
