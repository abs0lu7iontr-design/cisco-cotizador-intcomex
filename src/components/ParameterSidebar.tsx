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
  CloudUpload,
  Clock,
  Globe,
  UserCheck,
  Calendar,
  Trash2,
  Edit2,
} from 'lucide-react';
import { QuoteParameters, OverrideRuleType } from '../core/types';
import { solveGoalSeekParameters, GoalSeekResult } from '../core/calculations';
import {
  saveParamProfile,
  deleteParamProfile,
  ParamProfileScope,
  ParamDurationType,
  ParamProfileRecord,
  formatExpirationLabel,
  isProfileActive,
} from '../modules/cloud';

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
  detectedPartner?: string;
  activeProfile?: ParamProfileRecord | null;
  onProfileUpdated?: (profile: ParamProfileRecord | null) => void;
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
  detectedPartner = 'Partner General',
  activeProfile,
  onProfileUpdated,
}) => {
  const notifyChange = onChange || onChangeParams;

  // Goal Seek state
  const [goalMode, setGoalMode] = useState<'discount_amount' | 'target_price'>('discount_amount');
  const [targetInput, setTargetInput] = useState<string>('');
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  // Partner Parameters Cloud Profile State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [scope, setScope] = useState<ParamProfileScope>('partner');
  const [customPartnerInput, setCustomPartnerInput] = useState<string>('');
  const [durationType, setDurationType] = useState<ParamDurationType>('permanent');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);
  const [currentActiveProfile, setCurrentActiveProfile] = useState<ParamProfileRecord | null>(activeProfile || null);

  React.useEffect(() => {
    setCurrentActiveProfile(activeProfile || null);
  }, [activeProfile]);

  const effectivePartner = (customPartnerInput.trim() || detectedPartner || 'Partner General').trim();

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await saveParamProfile({
        scope,
        partnerName: scope === 'partner' ? effectivePartner : undefined,
        params,
        durationType,
      });

      if (res.success) {
        setCurrentActiveProfile(res.record);
        if (onProfileUpdated) onProfileUpdated(res.record);

        const targetLabel = scope === 'partner' ? effectivePartner : 'Todos los Partners (Global)';
        const durLabel =
          durationType === 'permanent'
            ? 'de forma permanente'
            : durationType === '15_days'
            ? 'por 15 días'
            : durationType === '30_days'
            ? 'por 30 días'
            : 'hasta fin de mes';

        setToastFeedback(`¡Guardado para ${targetLabel} (${durLabel})!`);
        setShowConfigModal(false);
        setTimeout(() => setToastFeedback(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    setIsDeleting(true);
    try {
      await deleteParamProfile({
        scope: currentActiveProfile?.scope || scope,
        partnerName: (currentActiveProfile?.scope || scope) === 'partner' ? (currentActiveProfile?.partnerName || effectivePartner) : undefined,
      });
      setCurrentActiveProfile(null);
      if (onProfileUpdated) onProfileUpdated(null);
      setToastFeedback('Regla personalizada eliminada. Vuelve a parámetros estándar.');
      setShowConfigModal(false);
      setTimeout(() => setToastFeedback(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

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

      {/* SECCIÓN: PERFIL DE PARÁMETROS PARTNER / GLOBAL EN LA NUBE */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        {/* Active Profile Status Badge */}
        {isProfileActive(currentActiveProfile) ? (
          <div
            className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
              currentActiveProfile!.scope === 'partner'
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                {currentActiveProfile!.scope === 'partner' ? (
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>
                  {currentActiveProfile!.scope === 'partner'
                    ? `Regla: ${currentActiveProfile!.partnerName}`
                    : 'Regla Global Activa'}
                </span>
              </span>
              <span className="text-[10px] flex items-center gap-1 opacity-80 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatExpirationLabel(currentActiveProfile!.expiresAt)}</span>
              </span>
            </div>

            <div className="font-mono text-[11px] opacity-90 flex gap-2">
              <span>Int: {currentActiveProfile!.params.internacionPct}%</span>
              <span>•</span>
              <span>Ar: {currentActiveProfile!.params.arancelPct}%</span>
              <span>•</span>
              <span>Mg: {currentActiveProfile!.params.margenPct}%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Partner BOM</span>
            </span>
            <span
              className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-800/40 truncate max-w-[130px]"
              title={effectivePartner}
            >
              {effectivePartner}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setCustomPartnerInput(detectedPartner || '');
            setShowConfigModal(true);
          }}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-900/40 to-indigo-900/40 hover:from-cyan-800/60 hover:to-indigo-800/60 text-cyan-200 border border-cyan-700/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:border-cyan-400"
        >
          <CloudUpload className="w-4 h-4 text-cyan-400" />
          <span>Fijar Parámetros en la Nube</span>
        </button>

        {toastFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px] flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastFeedback}</span>
          </div>
        )}
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

      {/* MODAL DE CONFIGURACIÓN DE PARÁMETROS EN LA NUBE */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-xs text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-cyan-400" />
                <span>Guardar Parámetros Comerciales</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Resumen de los valores a guardar */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px]">Internación</span>
                <strong className="text-indigo-400">{params.internacionPct.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Arancel</span>
                <strong className="text-purple-400">{params.arancelPct.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Margen</span>
                <strong className="text-emerald-400">{params.margenPct.toFixed(1)}%</strong>
              </div>
            </div>

            {/* 1. Selector de Alcance (Scope) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ¿A quién se aplica esta regla?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('partner')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    scope === 'partner'
                      ? 'bg-cyan-950/80 text-cyan-200 border-cyan-500 font-bold shadow-md shadow-cyan-950/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
                  <span className="truncate block">Solo este Partner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('global')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    scope === 'global'
                      ? 'bg-indigo-950/80 text-indigo-200 border-indigo-500 font-bold shadow-md shadow-indigo-950/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-4 h-4 mx-auto mb-1 text-indigo-400" />
                  <span>Global (Todos)</span>
                </button>
              </div>

              {scope === 'partner' && (
                <div className="mt-2 space-y-1">
                  <label className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Nombre del Partner:</span>
                    <span className="text-slate-500 text-[9px]">Editable</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customPartnerInput || detectedPartner}
                      onChange={(e) => setCustomPartnerInput(e.target.value)}
                      placeholder="Nombre del Partner (ej. Supplyline)"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Selector de Duración / Vigencia */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Vigencia del Perfil
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {[
                  { id: 'permanent', label: 'Permanente', icon: CheckCircle2 },
                  { id: '15_days', label: '15 Días', icon: Clock },
                  { id: '30_days', label: '30 Días', icon: Calendar },
                  { id: 'end_of_month', label: 'Fin de Mes', icon: Clock },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = durationType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDurationType(item.id as ParamDurationType)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 text-white border-cyan-400 font-bold shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center gap-2">
                {isProfileActive(currentActiveProfile) ? (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteProfile}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60 transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Eliminar regla personalizada y volver a parámetros de fábrica"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>{isDeleting ? 'Quitando...' : 'Quitar regla'}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveProfile}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-md shadow-cyan-900/40 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : 'Confirmar'}
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
