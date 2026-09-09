// ============================================================================
// CISCO AUTOMATED - SKU OVERRIDE AUTHORIZATION & REVIEW MODAL
// Displays prior authorization requests when shared/imported SKU rules are detected
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  User,
  Sparkles,
  DownloadCloud,
} from 'lucide-react';
import { SharedSkuOverrideRecord } from '../cloud/types';
import { OverrideRuleType } from '../../core/types';

interface SkuOverrideAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposedOverrides: SharedSkuOverrideRecord[];
  authorName?: string;
  sourceType?: 'cloud' | 'file';
  onAccept: (selectedOverrides: SharedSkuOverrideRecord[], persistPermanently: boolean) => void;
}

export function normalizeRule(rule: any): OverrideRuleType {
  const s = String(rule || '').trim().toLowerCase();
  if (s === 'intangible') return 'intangible';
  if (s === 'arancel') return 'arancel';
  return 'equipo';
}

export function SkuOverrideAuthorizationModal({
  isOpen,
  onClose,
  proposedOverrides,
  authorName,
  sourceType = 'cloud',
  onAccept,
}: SkuOverrideAuthorizationModalProps) {
  const [selectedSkus, setSelectedSkus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    proposedOverrides.forEach((r) => {
      initial[r.sku] = true;
    });
    return initial;
  });

  const [persistPermanently, setPersistPermanently] = useState(true);

  // Sync selected state on new proposed overrides
  useEffect(() => {
    if (proposedOverrides.length > 0) {
      const initial: Record<string, boolean> = {};
      proposedOverrides.forEach((r) => {
        initial[r.sku] = true;
      });
      setSelectedSkus(initial);
    }
  }, [proposedOverrides]);

  if (!isOpen || proposedOverrides.length === 0) return null;

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    proposedOverrides.forEach((r) => {
      next[r.sku] = checked;
    });
    setSelectedSkus(next);
  };

  const toggleSku = (sku: string) => {
    setSelectedSkus((prev) => ({
      ...prev,
      [sku]: !prev[sku],
    }));
  };

  const selectedCount = Object.values(selectedSkus).filter(Boolean).length;
  const primaryAuthor = authorName || proposedOverrides[0]?.author?.fullName || 'Product Manager';

  // Group summary of changes with normalized rules
  const ruleCounts: Record<string, number> = {};
  proposedOverrides.forEach((r) => {
    const normalized = normalizeRule(r.rule);
    const key = normalized === 'intangible' ? 'Intangible' : normalized === 'arancel' ? 'Arancel Especial' : 'Hardware';
    ruleCounts[key] = (ruleCounts[key] || 0) + 1;
  });
  const summaryText = Object.entries(ruleCounts)
    .map(([k, count]) => `${count} equipo(s) a ${k}`)
    .join(', ');

  const handleConfirm = () => {
    const acceptedList = proposedOverrides
      .filter((r) => selectedSkus[r.sku])
      .map((r) => ({
        ...r,
        rule: normalizeRule(r.rule),
      }));

    if (acceptedList.length === 0) {
      onClose();
      return;
    }
    onAccept(acceptedList, persistPermanently);
    onClose();
  };

  const getRuleBadge = (rule: any) => {
    const norm = normalizeRule(rule);
    switch (norm) {
      case 'intangible':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-950/50">
            Intangible
          </span>
        );
      case 'arancel':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-950 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950/50">
            Arancel Especial
          </span>
        );
      case 'equipo':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-950 text-blue-300 border border-blue-500/50 shadow-sm shadow-blue-950/50">
            Hardware
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/50 flex flex-col max-h-[90vh] overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Sugerencia de Reclasificación de SKUs
              </h2>
              <p className="text-xs text-slate-400">
                {sourceType === 'cloud' ? 'Reglas compartidas en la Nube' : 'Archivo local importado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Author Notification Banner */}
          <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Autor: {primaryAuthor}</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              El colega <strong className="text-white">{primaryAuthor}</strong> modificó{' '}
              <span className="text-cyan-300 font-bold">{proposedOverrides.length} equipo(s)</span> ({summaryText}).
              <br />
              <span className="text-slate-300">
                ¿Desea incorporar estas reglas a su cotización actual y agregarlas a su configuración?
              </span>
            </p>
          </div>

          {/* Quick Select Controls */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all-sku-overrides"
                checked={selectedCount === proposedOverrides.length}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="select-all-sku-overrides" className="cursor-pointer font-medium text-slate-300">
                Seleccionar todos ({selectedCount} de {proposedOverrides.length})
              </label>
            </div>
            <span className="text-[11px] font-mono text-indigo-400">
              {selectedCount} seleccionados para aplicar
            </span>
          </div>

          {/* Overrides Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Código SKU</th>
                  <th className="py-2.5 px-3">Clasificación Propuesta</th>
                  <th className="py-2.5 px-3">Autor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {proposedOverrides.map((item) => {
                  const isChecked = !!selectedSkus[item.sku];
                  const normRule = normalizeRule(item.rule);
                  return (
                    <tr
                      key={item.sku}
                      onClick={() => toggleSku(item.sku)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-950/20 hover:bg-indigo-950/40' : 'hover:bg-slate-800/30 opacity-60'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSku(item.sku)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-100">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 line-through text-[10px]">
                            {item.previousType || 'Hardware'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          {getRuleBadge(normRule)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                        {item.author?.fullName || primaryAuthor}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Persist checkbox */}
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={persistPermanently}
                onChange={(e) => setPersistPermanently(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Guardar permanentemente en mi base de reglas predeterminadas</span>
            </label>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Descartar / Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Autorizar y Aplicar ({selectedCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
