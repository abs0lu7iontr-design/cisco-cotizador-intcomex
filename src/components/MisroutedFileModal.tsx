// ============================================================================
// CISCO AUTOMATED - MODAL DE DETECCIÓN INTELIGENTE DE FORMATOS CISCO (v2.10.0)
// Guía al usuario cuando se sube una Cotización CCW-R en el módulo de Estimate
// o viceversa, previniendo datos corruptos o líneas desalineadas.
// ============================================================================

import React from 'react';
import { ShieldCheck, ArrowRight, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { MisroutedFileAlert } from '../core/store';

interface MisroutedFileModalProps {
  alert: MisroutedFileAlert | null;
  onConfirmRedirect: () => void;
  onCancel: () => void;
}

export function MisroutedFileModal({
  alert,
  onConfirmRedirect,
  onCancel,
}: MisroutedFileModalProps) {
  if (!alert || !alert.isOpen) return null;

  const isCcwr = alert.detectedType === 'ccwr_quote';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-100">
        {/* Glow Accent */}
        <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none ${isCcwr ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

        {/* Modal Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl ${isCcwr ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isCcwr ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                {isCcwr ? 'Formato CCW-R de Servicios Detectado' : 'Price Estimate Detectado'}
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {isCcwr ? '¿Deseas abrir en Cotizador CCW-R?' : '¿Deseas abrir en Cotizador Cisco CCW?'}
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Message */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-6">
          <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex items-center space-x-3">
            <FileSpreadsheet className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{alert.fileName}</p>
              <p className="text-[11px] text-slate-400">
                {isCcwr
                  ? `Cisco CCW-R Quote #${alert.quoteNumber || 'S/N'}${alert.customerName ? ` • ${alert.customerName}` : ''}`
                  : `Cisco CCW Price Estimate${alert.estimateId ? ` #${alert.estimateId}` : ''}`}
              </p>
            </div>
          </div>

          <p>
            {isCcwr ? (
              <>
                El archivo que intentas procesar corresponde a una <strong className="text-white">Cotización de Servicios y Licencias Cisco CCW-R</strong> (con contratos SmartNet, números de serie y vigencias).
              </>
            ) : (
              <>
                El archivo que intentas procesar corresponde a un <strong className="text-white">Price Estimate de Cisco CCW</strong> (Hardware / Software estándar).
              </>
            )}
          </p>

          <p className="text-slate-400">
            {isCcwr
              ? 'El Cotizador CCW estándar está optimizado para Price Estimates. Para calcular el margen sobre la Columna Z (Extended Net Price) y exportar las 13 columnas oficiales, te recomendamos abrirlo directamente en el módulo Cotizador CCW-R.'
              : 'El módulo CCW-R está optimizado para contratos de servicios. Te recomendamos abrir este Estimate en el módulo principal Cotizador Cisco CCW.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmRedirect}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer ${
              isCcwr
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            <span>{isCcwr ? 'Abrir en Cotizador CCW-R' : 'Abrir en Cotizador Cisco CCW'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
