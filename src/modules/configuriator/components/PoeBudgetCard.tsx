// ============================================================================
// CISCO AUTOMATED v2.1 - POE LIVE BUDGET CARD COMPONENT
// ============================================================================

import React from 'react';
import { Zap } from 'lucide-react';

export interface PoeMetrics {
  totalPoeDemandWatts: number;
  totalPoeSupplyWatts: number;
  poeUtilizationPct: number;
  poweredEndpointsSummary: string[];
  poeSwitchesCount: number;
  firstUpgradeableSwitchIdx: number | null;
}

export interface PoeBudgetCardProps {
  bomMetrics: PoeMetrics;
  onUpgradeSwitchToFullPoe: (switchIndex: number) => void;
}

export const PoeBudgetCard: React.FC<PoeBudgetCardProps> = ({
  bomMetrics,
  onUpgradeSwitchToFullPoe,
}) => {
  return (
    <div
      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
        bomMetrics.poeUtilizationPct >= 80
          ? 'bg-amber-950/30 border-amber-500/50'
          : 'bg-slate-950 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Calculadora de Presupuesto PoE en Vivo</span>
        </span>
        <span className="font-mono text-[11px] font-bold text-white">
          Demanda: <strong className="text-amber-300">{bomMetrics.totalPoeDemandWatts}W</strong> / Capacidad:{' '}
          <strong className="text-emerald-300">{bomMetrics.totalPoeSupplyWatts}W</strong>
        </span>
      </div>

      {bomMetrics.totalPoeSupplyWatts > 0 || bomMetrics.totalPoeDemandWatts > 0 ? (
        <div className="space-y-1.5">
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                bomMetrics.poeUtilizationPct >= 85
                  ? 'bg-rose-500'
                  : bomMetrics.poeUtilizationPct >= 65
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(6, bomMetrics.poeUtilizationPct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
            <span className="text-slate-400">
              {bomMetrics.poweredEndpointsSummary.length > 0
                ? `Consumo: ${bomMetrics.poweredEndpointsSummary.join(' + ')}`
                : `${bomMetrics.poeSwitchesCount} switch(es) PoE suministrando ${bomMetrics.totalPoeSupplyWatts}W totales`}
            </span>

            {(bomMetrics.poeUtilizationPct >= 75 ||
              (bomMetrics.firstUpgradeableSwitchIdx !== null &&
                bomMetrics.totalPoeDemandWatts > 300)) &&
              bomMetrics.firstUpgradeableSwitchIdx !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onUpgradeSwitchToFullPoe(bomMetrics.firstUpgradeableSwitchIdx!)
                  }
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 font-bold cursor-pointer transition-colors"
                >
                  ⚡ Subir Switch a Full PoE+ (740W) en 1 Clic
                </button>
              )}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">
          Agrega switches PoE, Access Points o Teléfonos IP para validar el balance de potencia en Watts.
        </p>
      )}
    </div>
  );
};
