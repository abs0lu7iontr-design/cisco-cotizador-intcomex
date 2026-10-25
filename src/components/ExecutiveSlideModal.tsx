// ============================================================================
// CISCO AUTOMATED - EXECUTIVE SUMMARY SLIDE DECK MODAL
// Lámina ejecutiva de alta resolución para presentaciones con clientes y comités
// ============================================================================

import React, { useRef } from 'react';
import {
  Presentation,
  Download,
  Printer,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { ProcessedEstimateResult, QuoteParameters } from '../core/types';
import { categorizeEstimateItems, formatUSD } from '../modules/estimate';
import { CISCO_AUTOMATED_SEAL_DATA_URI } from '../core/brandingLogos';

interface ExecutiveSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ProcessedEstimateResult;
  params: QuoteParameters;
  partnerName?: string;
  clientName?: string;
}

export const ExecutiveSlideModal: React.FC<ExecutiveSlideModalProps> = ({
  isOpen,
  onClose,
  result,
  params,
  partnerName = 'Intcomex Partner',
  clientName = 'Cliente Final',
}) => {
  const slideRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !result) return null;

  const categories = categorizeEstimateItems(result.items);
  const total = result.calculatedProductTotal || 1;

  const hwPct = ((categories.hardwareTotal / total) * 100).toFixed(1);
  const swPct = ((categories.softwareTotal / total) * 100).toFixed(1);
  const svcPct = ((categories.servicesTotal / total) * 100).toFixed(1);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Control Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <Presentation className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">
              Lámina Resumen Comercial Ejecutivo &bull; Propuesta Cisco Intcomex
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-rose-400" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Canvas */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-950">
          <div
            ref={slideRef}
            className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden"
          >
            {/* Ambient Back Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Slide Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shadow-md">
                  <img
                    src={CISCO_AUTOMATED_SEAL_DATA_URI}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 block">
                    Propuesta Tecnológica & Financiera
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Arquitectura de Solución Cisco CCW
                  </h2>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Distribuidor Oficial
                </span>
                <span className="text-sm font-black text-emerald-400 block font-mono">
                  INTCOMEX CHILE S.A.
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  Deal ID: {result.headerInfo?.dealId || 'General'}
                </span>
              </div>
            </div>

            {/* Account Details Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">Partner / Canal</span>
                <strong className="text-slate-200 truncate block">{partnerName}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Cliente Final</span>
                <strong className="text-emerald-400 truncate block">{clientName}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Fecha Emisión</span>
                <strong className="text-slate-300 block">
                  {new Date().toLocaleDateString('es-CL')}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Vigencia</span>
                <strong className="text-amber-400 block">14 Días Corridos</strong>
              </div>
            </div>

            {/* 3 Core Pillar Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Hardware */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>1. Infraestructura</span>
                  <span className="text-indigo-400 font-mono">{hwPct}%</span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-white tracking-tight block">
                    {formatUSD(categories.hardwareTotal)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {categories.hardwareQty} equipos físicos cotizados
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                  Switches, Routers, Access Points y fuentes de poder redundantes.
                </p>
              </div>

              {/* Card 2: Software & Cloud */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>2. Software Cloud</span>
                  <span className="text-amber-400 font-mono">{swPct}%</span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-amber-400 tracking-tight block">
                    {formatUSD(categories.softwareTotal)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {categories.softwareQty} licencias y suscripciones
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                  Cisco DNA, Meraki Cloud Dashboard, Umbrella y seguridad SaaS.
                </p>
              </div>

              {/* Card 3: Support */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <span>3. Soporte SmartNet</span>
                  <span className="text-cyan-400 font-mono">{svcPct}%</span>
                </div>
                <div>
                  <span className="text-2xl font-black font-mono text-cyan-400 tracking-tight block">
                    {formatUSD(categories.servicesTotal)}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {categories.servicesQty} contratos de soporte
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                  Soporte TAC oficial 24x7 y reemplazo anticipado de partes (NBD).
                </p>
              </div>
            </div>

            {/* Total Investment Hero Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950/60 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                  Valor Total de la Propuesta (USD Neto)
                </span>
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {formatUSD(result.calculatedProductTotal)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Precios unitarios en dólares americanos &bull; No incluye IVA
                </span>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center space-x-1.5 justify-end text-xs text-indigo-300 font-bold">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Plazo de Entrega: A pedido (según CCW)</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Sujeto a validación técnica de números de parte (BOM)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
