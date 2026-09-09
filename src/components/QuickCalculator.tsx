// ============================================================================
// CISCO AUTOMATED v2.1 - QUICK CALCULATOR SIMULATOR
// ============================================================================

import React, { useState } from 'react';
import { QuoteParameters } from '../core/types';
import { calculateLineItemCosts, formatLeadTime } from '../core/calculations';
import { Calculator, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

interface QuickCalculatorProps {
  params: QuoteParameters;
}

export const QuickCalculator: React.FC<QuickCalculatorProps> = ({ params }) => {
  const [partNumber, setPartNumber] = useState('MR46-HW');
  const [description, setDescription] = useState('Cisco Meraki MR46 Cloud Managed AP');
  const [netPrice, setNetPrice] = useState<number>(1250.0);
  const [qty, setQty] = useState<number>(2);
  const [leadDays, setLeadDays] = useState<number>(35);

  const calculated = calculateLineItemCosts(netPrice, qty, partNumber, description, params);
  const leadTimeFormatted = formatLeadTime(leadDays) || 'Stock / En Blanco (≤ 2 días)';

  const formatCurrency = (val: number) => {
    return (
      '$' +
      val.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-200">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-500/30">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Calculadora Rápida Unitaria &bull; Simulador CCW
          </h3>
          <p className="text-xs text-slate-400">
            Prueba al instante las reglas de internación, aranceles y semanas a pedido
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Parameters */}
        <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            1. Datos de Entrada del Ítem
          </h4>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Part Number (SKU)</label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              placeholder="ej. C9200L-24P-4G-E, DNA-E, PWR-C1-1100WAC="
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="ej. Catalyst 9200L 24-port PoE+"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Net Cisco ($)</label>
              <input
                type="number"
                step="0.01"
                value={netPrice}
                onChange={(e) => setNetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Días Lead Time</label>
              <input
                type="number"
                min="0"
                value={leadDays}
                onChange={(e) => setLeadDays(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Live Calculation Output */}
        <div className="space-y-4 bg-slate-950/80 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>2. Desglose Financiero Intcomex</span>
              <span className="text-[10px] font-bold text-emerald-400">En Tiempo Real</span>
            </h4>

            {/* Clasificación */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">Clasificación Automática:</span>
              {calculated.isIntangible ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-600/40 text-[10px] font-bold">
                  INTANGIBLE (0% Internación)
                </span>
              ) : calculated.llevaArancel ? (
                <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-600/40 text-[10px] font-bold">
                  ARANCEL '=' (+{params.arancelPct}%)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-600/40 text-[10px] font-bold">
                  EQUIPO ESTÁNDAR (+{params.internacionPct}% Intern.)
                </span>
              )}
            </div>

            {/* Lead Time */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">Lead Time Resultante:</span>
              <span className="font-mono font-bold text-indigo-300">{leadTimeFormatted}</span>
            </div>

            {/* Cost Breakdown Lines */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Costo Base Cisco:</span>
                <span className="font-mono text-slate-200">{formatCurrency(netPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Internación ({params.internacionPct}%):</span>
                <span className="font-mono text-amber-400">+{formatCurrency(calculated.costoInternacion)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Arancel ({params.arancelPct}%):</span>
                <span className="font-mono text-purple-400">+{formatCurrency(calculated.costoArancel)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-800/80">
                <span className="text-slate-300">Costo Total Unitario:</span>
                <span className="font-mono text-white">{formatCurrency(calculated.costoTotalUnitario)}</span>
              </div>
            </div>
          </div>

          {/* Final Price Block */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Precio Venta Unitario ({params.margenPct}% Margen)
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {formatCurrency(calculated.precioVentaUnitario)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Extendido ({qty} uds)
              </span>
              <span className="text-xl font-black font-mono text-white">
                {formatCurrency(calculated.precioVentaExtendido)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
