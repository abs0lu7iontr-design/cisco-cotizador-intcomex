// ============================================================================
// CISCO AUTOMATED - CISCO COMMERCE CLOUD IMPORT MODAL
// Permite sincronizar un Estimate directamente desde la API oficial de Cisco
// con obtención automática de Lead Times, Jerarquía Madre-Hijo y Precios Netos
// ============================================================================

import React, { useState } from 'react';
import {
  CloudDownload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  DollarSign,
  ShieldCheck,
  Building2,
  User,
  Sparkles,
} from 'lucide-react';
import {
  fetchEstimateFromCiscoApi,
  FetchEstimateResult,
} from './ciscoCommerceService';
import { getCiscoConfig, saveCiscoConfig } from './ciscoAuthService';
import { useCiscoAutomatedStore } from '../../core/store';
import { useToast } from '../../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CiscoCloudEstimateImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { loadDirectEstimateIntoStore } = useCiscoAutomatedStore();
  const { showToast } = useToast();

  const [estimateIdInput, setEstimateIdInput] = useState('');
  const [partnerName, setPartnerName] = useState('Intcomex Chile');
  const [clientName, setClientName] = useState('');
  const [envMode, setEnvMode] = useState<'POE' | 'PROD'>(() => {
    return getCiscoConfig().commerceEnvironment || 'POE';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FetchEstimateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetch = async () => {
    const cleanId = estimateIdInput.trim();
    if (!cleanId) {
      setErrorMsg('Por favor ingresa un ID de Estimate (ej. OI161111385UO o OE169047114NP).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setResult(null);

    // Guardar preferencia de ambiente
    saveCiscoConfig({ commerceEnvironment: envMode });

    try {
      const res = await fetchEstimateFromCiscoApi(cleanId, {
        environment: envMode,
        partnerFallback: partnerName.trim() || 'Intcomex Chile',
        clientFallback: clientName.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo obtener la estimación desde Cisco.');
      } else {
        setResult(res);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de conexión con Cisco API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToQuoter = () => {
    if (!result?.processedResult) return;
    loadDirectEstimateIntoStore(result.processedResult);
    showToast(
      `¡Cotización ${result.estimate?.id || estimateIdInput} importada exitosamente desde Cisco Cloud! Lead Time máximo: ${result.maxLeadTimeFormatted}`,
      'success'
    );
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Importar Cotización desde Cisco Cloud API
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  GraphQL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronización directa vía Cisco Modern Commerce API con Lead Times oficiales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                ID de Estimate / Cotización Cisco CCW <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. OI161111385UO o OE169047114NP"
                  value={estimateIdInput}
                  onChange={(e) => setEstimateIdInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Partner / Reseller (Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Sonda Chile"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Cliente Final (Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Banco Santander"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Environment Selector */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Ambiente Cisco API</span>
                <span className="text-[11px] text-slate-400">
                  {envMode === 'POE'
                    ? 'POE (Partner Onboarding Sandbox - capitest.cisco.com)'
                    : 'PROD (Producción Oficial - capi.cisco.com)'}
                </span>
              </div>
            </div>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setEnvMode('POE')}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  envMode === 'POE'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                POE (Test)
              </button>
              <button
                type="button"
                onClick={() => setEnvMode('PROD')}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  envMode === 'PROD'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                PROD
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Result Preview Card */}
          {result?.processedResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    {result.estimate?.name || result.estimate?.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    {result.estimate?.estimateStatus || 'VALID'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  US$ {result.processedResult.calculatedProductTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                    <Layers className="w-3 h-3" />
                    <span>Líneas</span>
                  </div>
                  <span className="text-xs font-bold text-white font-mono">
                    {result.processedResult.items.length} ítems
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-amber-400 mb-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Lead Time Máx.</span>
                  </div>
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    {result.maxLeadTimeFormatted}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400 mb-0.5">
                    <DollarSign className="w-3 h-3" />
                    <span>Neto Cisco</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-300 font-mono">
                    US$ {result.processedResult.originalProductTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Credenciales activas: M2M OAuth2 Cisco ID
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {!result ? (
              <button
                type="button"
                onClick={handleFetch}
                disabled={isLoading || !estimateIdInput.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-950/50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Consultando Cisco GraphQL...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-4 h-4" />
                    <span>Consultar Estimate</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyToQuoter}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Cargar en Cotizador Activo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
