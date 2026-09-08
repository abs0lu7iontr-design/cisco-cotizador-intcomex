// ============================================================================
// CISCO AUTOMATED v2.1 - PARAMETER SIDEBAR (WITH EQUITABLE GOAL SEEK PRICING)
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Sliders,
  RotateCcw,
  PanelLeftClose,
  Target,
  DollarSign,
  TrendingDown,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { QuoteParameters, OverrideRuleType } from '../core/types';
import { solveGoalSeekParameters, GoalSeekResult } from '../core/calculations';

interface ParameterSidebarProps {
  params: QuoteParameters;
  onChange?: (newParams: QuoteParameters) => void;
  onChangeParams?: (newParams: QuoteParameters) => void;
  onResetDefaults?: () => void;
  onToggleCollapse?: () => void;
  items?: Array<{
    netCiscoUnit: number;
    qty: number;
    partNumber: string;
    description: string;
    rowIdx?: number;
  }>;
  overrides?: Record<number, OverrideRuleType>;
  currentTotal?: number;
}

export const ParameterSidebar: React.FC<ParameterSidebarProps> = ({
  params,
  onChange,
  onChangeParams,
  onResetDefaults,
  onToggleCollapse,
  items,
  overrides,
  currentTotal = 0,
}) => {
  const notifyChange = onChange || onChangeParams;

  // Goal Seek state
  const [goalMode, setGoalMode] = useState<'discount_amount' | 'target_price'>('discount_amount');
  const [targetInput, setTargetInput] = useState<string>('');
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  const handleInputChange = (field: keyof QuoteParameters, val: number) => {
    if (notifyChange) {
      notifyChange({
        ...params,
        [field]: Math.max(0, Math.min(100, isNaN(val) ? 0 : val)),
      });
    }
  };

  const handleReset = () => {
    setTargetInput('');
    setAppliedFeedback(null);
    if (onResetDefaults) {
      onResetDefaults();
    } else if (notifyChange) {
      notifyChange({
        internacionPct: 7.0,
        arancelPct: 6.0,
        margenPct: 5.0,
      });
    }
  };

  // Real-time Goal Seek simulation (does NOT move the main sliders until "Aplicar" is clicked)
  const goalSeekResult: GoalSeekResult | null = useMemo(() => {
    const numVal = parseFloat(targetInput);
    if (isNaN(numVal) || numVal <= 0 || !items || items.length === 0) {
      return null;
    }
    return solveGoalSeekParameters(items, numVal, goalMode, params, overrides);
  }, [items, targetInput, goalMode, params, overrides]);

  // Apply button: Only moves the parameters and sliders when clicked
  const handleApplyGoalSeek = () => {
    if (goalSeekResult && goalSeekResult.success && notifyChange) {
      notifyChange({
        internacionPct: goalSeekResult.newInternacionPct,
        arancelPct: goalSeekResult.newArancelPct,
        margenPct: goalSeekResult.newMargenPct,
      });
      setAppliedFeedback(
        `✅ ¡Descuentos aplicados! Internación: ${goalSeekResult.newInternacionPct}%, Margen: ${goalSeekResult.newMargenPct}%`
      );
      setTimeout(() => setAppliedFeedback(null), 4000);
    }
  };

  const formatUsd = (val: number) =>
    '$' +
    val.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-6 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              Parámetros CCW
            </h2>
            <span className="text-[10px] text-slate-500">Cisco Automated v2.1</span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Restablecer valores por defecto (7%, 6%, 5%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Ocultar panel de parámetros"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Manual Percentage Inputs (Sliders) */}
      <div className="space-y-4 text-xs">
        {/* Internación */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold">
            <label className="text-slate-300">Costo de Internación</label>
            <span className="font-mono text-indigo-400 font-bold">{params.internacionPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="25"
              step="0.1"
              value={params.internacionPct}
              onChange={(e) => handleInputChange('internacionPct', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={params.internacionPct}
              onChange={(e) => handleInputChange('internacionPct', parseFloat(e.target.value))}
              className="w-14 bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center font-mono text-xs text-white"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Aplica sobre hardware tangible. <em>Intangibles exentos (0%)</em>.
          </p>
        </div>

        {/* Arancel */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold">
            <div className="flex items-center gap-1.5">
              <label className="text-slate-300">Arancel Aduanero</label>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/40 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Fijo
              </span>
            </div>
            <span className="font-mono text-purple-400 font-bold">{params.arancelPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              value={params.arancelPct}
              onChange={(e) => handleInputChange('arancelPct', parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={params.arancelPct}
              onChange={(e) => handleInputChange('arancelPct', parseFloat(e.target.value))}
              className="w-14 bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center font-mono text-xs text-white"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Aplica a accesorios terminados en '=' (ej: cables, brackets).
          </p>
        </div>

        {/* Margen */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold">
            <label className="text-slate-300">Margen de Ganancia Intcomex</label>
            <span className="font-mono text-emerald-400 font-bold">{params.margenPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={params.margenPct}
              onChange={(e) => handleInputChange('margenPct', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={params.margenPct}
              onChange={(e) => handleInputChange('margenPct', parseFloat(e.target.value))}
              className="w-14 bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center font-mono text-xs text-white"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Margen comercial aplicado sobre el costo unitario total.
          </p>
        </div>
      </div>

      {/* REQUERIMIENTO 4: NUEVA HERRAMIENTA VISUAL (CÁLCULO INVERSO EQUITATIVO) */}
      <div className="pt-4 border-t border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-950/80 text-amber-400 rounded-lg border border-amber-500/30">
              <Target className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Ajuste de Precio Objetivo</h3>
              <p className="text-[10px] text-slate-400">Cálculo Inverso Equitativo</p>
            </div>
          </div>
        </div>

        {/* Total Cotizado Intcomex Actual Banner */}
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Total Cotizado Actual:</span>
          <span className="font-mono font-black text-emerald-400 text-sm">
            {formatUsd(currentTotal)}
          </span>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setGoalMode('discount_amount')}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              goalMode === 'discount_amount'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingDown className="w-3 h-3" />
            <span>Descuento ($)</span>
          </button>

          <button
            type="button"
            onClick={() => setGoalMode('target_price')}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              goalMode === 'target_price'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            <span>Precio Total</span>
          </button>
        </div>

        {/* Target Input */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-300">
            {goalMode === 'discount_amount' ? 'Monto a Descontar (USD)' : 'Precio Objetivo Solicitado (USD)'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">$</span>
            <input
              type="number"
              step="1"
              placeholder={
                goalMode === 'discount_amount'
                  ? 'ej. 40 (bajar 40 USD)'
                  : currentTotal > 0
                  ? `ej. ${(currentTotal - 40).toFixed(2)}`
                  : 'ej. 1115'
              }
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            {goalMode === 'discount_amount'
              ? 'Resta este monto al Total Cotizado reduciendo equitativamente internación y margen.'
              : 'Calcula internación y margen para alcanzar exactamente este valor total.'}
          </p>
        </div>

        {/* Feedback Alert */}
        {appliedFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px] flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedFeedback}</span>
          </div>
        )}

        {/* Live Calculation Preview Box */}
        {goalSeekResult && goalSeekResult.success && (
          <div className="p-3.5 bg-slate-950/90 border border-amber-500/40 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-medium">Nuevo Total Estimado:</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {formatUsd(goalSeekResult.achievedTotal)}
              </span>
            </div>

            {goalSeekResult.discountAmount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Descuento aplicado:</span>
                <span className="font-mono font-bold text-rose-400">
                  -{formatUsd(goalSeekResult.discountAmount)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Internación</span>
                <strong className="text-indigo-300 font-mono text-xs">
                  {goalSeekResult.newInternacionPct.toFixed(1)}%
                </strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded-lg border border-purple-900/30">
                <span className="text-slate-500 block flex items-center justify-center gap-0.5">
                  <Lock className="w-2 h-2 text-purple-400" /> Arancel
                </span>
                <strong className="text-purple-300 font-mono text-xs">
                  {goalSeekResult.newArancelPct.toFixed(1)}%
                </strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Margen</span>
                <strong className="text-emerald-300 font-mono text-xs">
                  {goalSeekResult.newMargenPct.toFixed(1)}%
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyGoalSeek}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Aplicar Descuentos Calculados</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
