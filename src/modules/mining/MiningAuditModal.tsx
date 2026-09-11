// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL AUDIT MODAL
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Flame,
  Search,
  Filter
} from 'lucide-react';
import { AuditReport, AuditedLineItem } from './types';

interface MiningAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AuditReport | null;
}

export const MiningAuditModal: React.FC<MiningAuditModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen || !report) return null;

  const {
    matchedAccount,
    customerNameRaw,
    overallStatus,
    sntOpportunityCount,
    lines,
    summaryObservations,
  } = report;

  const filteredLines = lines.filter((l) => {
    if (filterCategory !== 'ALL' && l.category !== filterCategory) return false;
    if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const sku = l.partNumber.toLowerCase();
      const desc = l.description.toLowerCase();
      return sku.includes(q) || desc.includes(q);
    }
    return true;
  });

  const matchCount = lines.filter((l) => l.status === 'MATCH').length;
  const mismatchCount = lines.filter((l) => l.status === 'MISMATCH').length;
  const contractCount = lines.filter((l) => l.status === 'CONTRACT_CHECK_REQUIRED').length;
  const unconfiguredCount = lines.filter((l) => l.status === 'UNCONFIGURED').length;

  const getStatusBadge = (status: AuditedLineItem['status']) => {
    switch (status) {
      case 'MATCH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conforme
          </span>
        );
      case 'MISMATCH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Diferencia
          </span>
        );
      case 'CONTRACT_CHECK_REQUIRED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/50">
            <Flame className="w-3 h-3 mr-1" />
            SNT Contractual
          </span>
        );
      case 'UNCONFIGURED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-3 h-3 mr-1" />
            Sin Regla
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            Revisar
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Auditoría de Condiciones Minería & Servicios Cisco
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase bg-amber-950 text-amber-300 border border-amber-800/60">
                  Solo Lectura
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Verificación de tramos de descuento, suscripciones y condiciones contractuales de minería
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Info Banner */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Cliente Detectado</span>
              <span className="text-sm font-bold text-white font-mono">{customerNameRaw || 'Sin Nombre en Cabecera'}</span>
            </div>
            <div className="h-7 w-[1px] bg-slate-800 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Grupo Comercial Asociado</span>
              <span className="text-sm font-bold text-indigo-300">
                {matchedAccount ? matchedAccount.groupName : 'No asociado a minería/industrial'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Dictamen Global:</span>
            {overallStatus === 'COMPLIANT' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                ✓ 100% Conforme con Norma
              </span>
            )}
            {overallStatus === 'REQUIRES_REVIEW' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950 text-rose-300 border border-rose-700/60 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Diferencias Detectadas
              </span>
            )}
            {overallStatus === 'NOT_EVALUABLE' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                Regla no informada / Fuera de rango
              </span>
            )}
            {overallStatus === 'NO_RULES' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                Sin Reglas Asociadas
              </span>
            )}
          </div>
        </div>

        {/* Observations & Opportunities Banners */}
        {summaryObservations.length > 0 && (
          <div className="px-6 py-2.5 bg-amber-950/30 border-b border-amber-900/40 flex items-center space-x-3 text-xs text-amber-200">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              {summaryObservations.map((obs, idx) => (
                <span key={idx} className="block font-medium">
                  {obs}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* KPI Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-900/90 border-b border-slate-800 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Líneas Conformes</span>
            <span className="text-base font-black text-emerald-400">{matchCount}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Diferencias</span>
            <span className={`text-base font-black ${mismatchCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {mismatchCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Oportunidad SNT</span>
            <span className={`text-base font-black ${sntOpportunityCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {sntOpportunityCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Sin Regla Específica</span>
            <span className="text-base font-black text-slate-300">{unconfiguredCount}</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar SKU o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 w-full focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="MATCH">Conforme</option>
              <option value="MISMATCH">Diferencia</option>
              <option value="CONTRACT_CHECK_REQUIRED">SNT Contractual</option>
              <option value="UNCONFIGURED">Sin Regla</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todas las Categorías</option>
              <option value="PRODUCT">Producto Hardware</option>
              <option value="SUBSCRIPTION">Suscripción SaaS</option>
              <option value="SMARTNET_SNT">SmartNet SNT</option>
              <option value="SOLUTION_SUPPORT">Solution Support</option>
              <option value="SUCCESS_TRACK">Success Track</option>
              <option value="OTHER_SERVICE">Otro Servicio</option>
            </select>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider bg-slate-950/40">
                <th className="py-2.5 px-3">Línea</th>
                <th className="py-2.5 px-3">Part Number</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-center">IoT</th>
                <th className="py-2.5 px-3 text-right">Precio Lista</th>
                <th className="py-2.5 px-3 text-right">Precio Neto</th>
                <th className="py-2.5 px-3 text-center">Desc. Obs.</th>
                <th className="py-2.5 px-3 text-center">Desc. Norma</th>
                <th className="py-2.5 px-3 text-center">Dif.</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Evidencia / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                    No se encontraron líneas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLines.map((line, idx) => {
                  const isDiff = line.status === 'MISMATCH';
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isDiff ? 'bg-rose-950/15' : line.status === 'CONTRACT_CHECK_REQUIRED' ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-sans">{line.lineNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-white max-w-[160px] truncate" title={line.partNumber}>
                        {line.partNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans text-[11px]">
                        {line.category === 'PRODUCT'
                          ? 'Producto'
                          : line.category === 'SUBSCRIPTION'
                          ? 'Suscripción'
                          : line.category === 'SMARTNET_SNT'
                          ? 'SmartNet (SNT)'
                          : line.category === 'SOLUTION_SUPPORT'
                          ? 'Solution Support'
                          : line.category === 'SUCCESS_TRACK'
                          ? 'Success Track'
                          : line.category}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {line.iotStatus === 'YES' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                            IoT
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        ${line.unitListPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        ${line.unitNetPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-white">
                        {line.observedDiscountPct > 0 ? `${line.observedDiscountPct.toFixed(1)}%` : '0%'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-indigo-300 font-semibold">
                        {line.expectedDiscountPct !== null ? `${line.expectedDiscountPct}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {line.differencePct !== null ? (
                          <span
                            className={`font-bold ${
                              Math.abs(line.differencePct) <= 0.5
                                ? 'text-emerald-400'
                                : line.differencePct > 0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {line.differencePct > 0 ? `+${line.differencePct.toFixed(1)}%` : `${line.differencePct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">{getStatusBadge(line.status)}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans max-w-[220px] truncate" title={line.notes}>
                        {line.notes}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            * Módulo informativo de solo lectura. No altera precios de venta, costos ni márgenes comerciales.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
