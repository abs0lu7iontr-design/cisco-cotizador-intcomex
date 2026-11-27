// ============================================================================
// CISCO AUTOMATED - CISCO ORDER TRACKING SYNC MODAL
// Interfaz de SOLO LECTURA para consultar Cisco Orders API en tiempo real
// Permite sincronizar Courier, Waybill (guía), fechas ESD/ETA y números de serie
// NUNCA realiza compras ni órdenes comerciales en Cisco CCW
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Calendar,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Layers,
  ShieldCheck,
  Building2,
  RefreshCw,
  Loader2,
  Hash,
  Barcode,
  Info,
} from 'lucide-react';
import {
  fetchOrderDetailsFromCiscoApi,
  CiscoOrderTrackingDetails,
} from '../ciscoApi/ciscoOrdersService';
import { getCiscoConfig, saveCiscoConfig } from '../ciscoApi/ciscoAuthService';
import {
  BoOrderTrackingRecord,
  BO_STAGES_METADATA,
} from './boTrackingTypes';
import { useToast } from '../../context/ToastContext';
import { sanitizeSafeHttpUrl } from '../../utils/exportSanitizers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRecord?: BoOrderTrackingRecord | null;
  onApplyTracking?: (updatedRecord: BoOrderTrackingRecord) => Promise<void>;
}

export const CiscoOrderTrackingSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentRecord,
  onApplyTracking,
}) => {
  const { showToast } = useToast();

  const [orderInput, setOrderInput] = useState('');
  const [envMode, setEnvMode] = useState<'POE' | 'PROD'>(() => {
    return getCiscoConfig().commerceEnvironment || 'POE';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CiscoOrderTrackingDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const defaultSo = currentRecord?.ciscoSoNumber || currentRecord?.clientPoNumber || '';
      setOrderInput(defaultSo);
      setResult(null);
      setErrorMsg(null);
    }
  }, [isOpen, currentRecord]);

  if (!isOpen) return null;

  const handleFetch = async () => {
    const cleanOrder = orderInput.trim();
    if (!cleanOrder) {
      setErrorMsg('Por favor ingresa un número de Sales Order (SO) o número de orden Cisco.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setResult(null);

    // Guardar preferencia de ambiente
    saveCiscoConfig({ commerceEnvironment: envMode });

    try {
      const res = await fetchOrderDetailsFromCiscoApi(cleanOrder, {
        environment: envMode,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo obtener el tracking de la orden desde Cisco.');
      } else if (res.data) {
        setResult(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de conexión con Cisco Orders API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToRecord = async () => {
    if (!currentRecord || !result || !onApplyTracking) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const updated: BoOrderTrackingRecord = {
      ...currentRecord,
      ciscoSoNumber: result.orderNumber || currentRecord.ciscoSoNumber,
      ciscoSoAddedAt: currentRecord.ciscoSoAddedAt || todayStr,
      currentStage: result.mappedStage,
      courier: result.courierProvider || currentRecord.courier,
      courierTrackingNumber: result.trackingNumber || currentRecord.courierTrackingNumber,
      courierTrackingUrl: result.trackingUrl || currentRecord.courierTrackingUrl,
      estimatedShipDate: result.estimatedShipDate || currentRecord.estimatedShipDate,
      estimatedArrivalDate: result.estimatedArrivalDate || currentRecord.estimatedArrivalDate,
      updatedAt: new Date().toISOString(),
      notes: [
        {
          id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: new Date().toISOString(),
          author: 'Cisco API',
          stage: result.mappedStage,
          comment: `Sincronizado vía Cisco Orders API: Estado ${result.orderStatus}, Courier ${result.courierProvider}, Guía ${result.trackingNumber || 'N/A'}${result.estimatedShipDate ? `, ESD ${result.estimatedShipDate}` : ''}`,
        },
        ...currentRecord.notes,
      ],
    };

    try {
      await onApplyTracking(updated);
      showToast(
        `¡Orden ${result.orderNumber} sincronizada exitosamente con Cisco Tracking!`,
        'success'
      );
      onClose();
    } catch (err: any) {
      showToast(`Error al guardar sincronización: ${err?.message || 'Error desconocido'}`, 'error');
    }
  };

  const stageMeta = result ? BO_STAGES_METADATA[result.mappedStage] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950/40 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Consultar Seguimiento y Tracking Cisco API
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-semibold">
                  Solo Lectura
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Consulta en tiempo real estado de fábrica, Courier, Waybill y Fechas ESD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Governance Notice */}
        <div className="px-6 py-2.5 bg-blue-950/20 border-b border-blue-900/30 flex items-center space-x-2 text-[11px] text-blue-300">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Modo Seguro de Consulta:</strong> Esta herramienta visualiza el estado de las órdenes ya emitidas. No ejecuta compras en Cisco CCW.
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Formulario de Consulta */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Número de Sales Order (SO) Cisco o Referencia de Pedido *
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                  placeholder="ej. SO-1298457 o 1298457"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Toggle POE / PROD */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setEnvMode('POE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    envMode === 'POE'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ambiente Sandbox de Pruebas Cisco (capitest.cisco.com)"
                >
                  POE (Test)
                </button>
                <button
                  type="button"
                  onClick={() => setEnvMode('PROD')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    envMode === 'PROD'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ambiente de Producción Real Cisco (capi.cisco.com)"
                >
                  PROD
                </button>
              </div>

              <button
                type="button"
                onClick={handleFetch}
                disabled={isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center space-x-2 transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Consultando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Consultar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl flex items-start space-x-3 text-xs text-rose-300 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Aviso de Cisco API Gateway</p>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Orden Cisco:</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {result.orderNumber}
                    </span>
                    {result.customerPoNumber && (
                      <span className="text-xs text-slate-500 font-mono">
                        (OC: {result.customerPoNumber})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      Cisco: {result.orderStatus}
                    </span>
                    {stageMeta && (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${stageMeta.bgClass} ${stageMeta.colorClass} ${stageMeta.borderClass}`}>
                        Etapa BO: {stageMeta.shortLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logistics Badges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Courier</span>
                    <span className="text-white font-bold">{result.courierProvider}</span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Guía / Waybill</span>
                    {result.trackingNumber ? (
                      <span className="text-purple-400 font-mono font-bold truncate block">
                        {result.trackingNumber}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Por asignar</span>
                    )}
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Despacho (ESD)</span>
                    <span className="text-white font-mono font-semibold">
                      {result.estimatedShipDate || result.actualShipDate || 'Pendiente'}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Arribo Estimado</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      {result.estimatedArrivalDate || 'Por calcular'}
                    </span>
                  </div>
                </div>

                {/* Direct Courier Tracking Link */}
                {sanitizeSafeHttpUrl(result.trackingUrl) && (
                  <div className="pt-2 flex justify-end">
                    <a
                      href={sanitizeSafeHttpUrl(result.trackingUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                    >
                      <span>Rastrear en vivo en {result.courierProvider}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Line Items & Serial Numbers */}
              {result.lines.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                    <span>Líneas de la Orden ({result.lines.length})</span>
                    <span>Equipos y Números de Serie</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-850">
                    {result.lines.map((l, idx) => (
                      <div key={idx} className="p-2.5 flex items-start justify-between text-xs hover:bg-slate-900/50">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[11px] text-slate-500">{l.lineNumber}</span>
                            <span className="font-mono font-bold text-white">{l.sku}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              Cant: {l.quantity}
                            </span>
                          </div>
                          {l.description && (
                            <p className="text-[11px] text-slate-400 truncate max-w-md">{l.description}</p>
                          )}
                          {l.serialNumbers && l.serialNumbers.length > 0 && (
                            <div className="flex items-center space-x-1 text-[10px] text-cyan-400 font-mono pt-1">
                              <Barcode className="w-3 h-3 text-cyan-500 shrink-0" />
                              <span>S/N: {l.serialNumbers.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right text-[11px]">
                          <span className="text-slate-400 font-medium block">
                            {l.shipmentStatus || result.orderStatus}
                          </span>
                          {l.trackingNumber && (
                            <span className="font-mono text-[10px] text-purple-400 block">
                              {l.trackingNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>M2M OAuth2 Cisco ID</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Cerrar
            </button>

            {result && currentRecord && onApplyTracking && (
              <button
                type="button"
                onClick={handleApplyToRecord}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sincronizar Datos en Orden BO</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
