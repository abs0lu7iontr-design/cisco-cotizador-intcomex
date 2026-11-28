// ============================================================================
// CISCO AUTOMATED - PREVENTA IA: HOMOLOGATION COMPARISON CARD
// Componente interactivo que muestra la comparativa lado a lado con lo más relevante
// de cada equipo para saber si efectivamente está bien homologado,
// preservando el % de homologación.
// ============================================================================

import React, { useState } from 'react';
import {
  ArrowLeftRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Plug,
  Layers,
  Award,
  Globe,
  Sliders,
} from 'lucide-react';
import { HomologationComparisonResult } from '../competitorHomologationRules';

export interface HomologationComparisonCardProps {
  comparison: HomologationComparisonResult;
  initiallyExpanded?: boolean;
  className?: string;
  onSelectCiscoSku?: (sku: string) => void;
}

export const HomologationComparisonCard: React.FC<HomologationComparisonCardProps> = ({
  comparison,
  initiallyExpanded = true,
  className = '',
  onSelectCiscoSku,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(initiallyExpanded);
  const [copied, setCopied] = useState<boolean>(false);

  const {
    competitor,
    cisco,
    homologationPct,
    verdict,
    specRows,
    keyAdvantages,
    ciscoConfigurations = [],
    peerBrandsMatrix = [],
  } = comparison;

  const handleCopyComparison = (e: React.MouseEvent) => {
    e.stopPropagation();

    const configsText =
      ciscoConfigurations.length > 0
        ? `\n\n--------------------------------------------------------------------------------
COMPARATIVA CONTRA CONFIGURACIONES CISCO ESTABLECIDAS (${ciscoConfigurations.length}):
--------------------------------------------------------------------------------
${ciscoConfigurations
  .map(
    (c, idx) =>
      `${idx + 1}. ${c.sku} [${c.strategyTag}${c.isActiveSelected ? ' • ACTIVA' : ''}] -> ${c.homologationPct}% Homologación
   • Puertos/Uplinks: ${c.ports} | ${c.uplinks}
   • PoE/Stack: ${c.poeBudget} | ${c.stacking}${
     c.unitGplUsd ? `\n   • Valor GPL Unit: $${c.unitGplUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Mejor Dcto: ${c.discountPct ?? 0}%` : ''
   }`
  )
  .join('\n')}`
        : '';

    const peerText =
      peerBrandsMatrix.length > 2
        ? `\n\n--------------------------------------------------------------------------------
BENCHMARK MULTI-MARCA DEL SEGMENTO (${peerBrandsMatrix.length} FABRICANTES):
--------------------------------------------------------------------------------
${peerBrandsMatrix
  .map(
    (p) =>
      `• [${p.brand}] ${p.model} (${p.homologationPct}% Homologación vs ${p.equivalentCiscoSku})
  Puertos: ${p.ports} | Uplinks: ${p.uplinks} | PoE: ${p.poeBudget} | Garantía: ${p.warrantySupport}`
  )
  .join('\n')}`
        : '';

    const textReport = `================================================================================
COMPARATIVA DE HOMOLOGACIÓN TÉCNICA PREVENTA (CISCO AUTOMATED)
Porcentaje de Homologación: ${homologationPct}% Coherencia Técnica
================================================================================
EQUIPO SOLICITADO (COMPETIDOR):
- Marca: ${competitor.brand}
- Modelo: ${competitor.model}
- Categoría: ${competitor.category}

HOMOLOGACIÓN OFICIAL CISCO 2026:
- SKU Oficial: ${cisco.sku}
- Descripción: ${cisco.displayName}
- Segmento: ${cisco.category}

--------------------------------------------------------------------------------
TABLA COMPARATIVA DE ESPECIFICACIONES RELEVANTES:
--------------------------------------------------------------------------------
${specRows
  .map(
    (row, idx) =>
      `${idx + 1}. ${row.label.toUpperCase()}:
   • ${competitor.brand}: ${row.competitorValue}
   • Cisco 2026: ${row.ciscoValue}
   • Cumplimiento: ${row.statusLabel}`
  )
  .join('\n\n')}${configsText}${peerText}

--------------------------------------------------------------------------------
DICTAMEN Y VEREDICTO PREVENTA IA:
${verdict}

VENTAJAS CLAVE CISCO / INTCOMEX CHILE:
${keyAdvantages.map((adv) => `• ${adv}`).join('\n')}
================================================================================`;

    navigator.clipboard.writeText(textReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        homologationPct >= 100
          ? 'bg-slate-950/90 border-emerald-500/40 shadow-xl shadow-emerald-950/30'
          : 'bg-slate-950/90 border-indigo-500/40 shadow-xl shadow-indigo-950/30'
      } ${className}`}
    >
      {/* Cabecera Principal del Comparador */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-b border-slate-800/80 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-emerald-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-md">
            <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                Comparativa de Homologación Preventa IA
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                  homologationPct >= 100
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm'
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-600/50'
                }`}
              >
                🎯 {homologationPct}% Homologación Técnica
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-600/40">
                ✓ Certificación Lado a Lado
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-white mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-300 font-normal">Homologando:</span>
              <span className="text-rose-300 font-mono font-bold">{competitor.model}</span>
              <span className="text-slate-500">&rarr;</span>
              <span className="text-emerald-300 font-mono font-black">{cisco.sku}</span>
            </h4>
          </div>
        </div>

        {/* Acciones de la Cabecera */}
        <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCopyComparison}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
            title="Copiar informe completo de homologación para enviar al cliente o agregar a la propuesta"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copiar Comparativa</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label={isExpanded ? 'Contraer comparativa' : 'Expandir comparativa'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Contenido Expandible */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Tarjetas Visuales Lado a Lado: Competidor vs Cisco */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Tarjeta Competidor */}
            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-rose-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-950/80 text-rose-300 border border-rose-700/50">
                  🔴 Marca Rival Solicitada ({competitor.brand})
                </span>
                <span className="text-[10px] font-mono text-slate-400">Equipo a Sustituir</span>
              </div>
              <div className="font-mono text-sm font-bold text-white mb-1">{competitor.model}</div>
              <div className="text-xs text-slate-300 mb-2">{competitor.category}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Puertos:</span>
                  <span className="text-rose-200">{competitor.ports}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Uplinks:</span>
                  <span className="text-rose-200">{competitor.uplinks}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">PoE Budget:</span>
                  <span className="text-rose-200">{competitor.poeBudget}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Enrutamiento:</span>
                  <span className="text-rose-200">{competitor.layerRouting}</span>
                </div>
              </div>
            </div>

            {/* Tarjeta Cisco Homologado */}
            <div className="p-3.5 rounded-xl bg-slate-900/95 border border-emerald-500/50 relative overflow-hidden ring-1 ring-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  🟢 Homologación Oficial Cisco 2026
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  🎯 {homologationPct}% Coincidencia
                </span>
              </div>
              <div className="font-mono text-sm font-black text-emerald-200 mb-1">{cisco.sku}</div>
              <div className="text-xs text-slate-300 mb-2 font-medium">{cisco.displayName}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Puertos:</span>
                  <span className="text-emerald-300 font-bold">{cisco.ports}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Uplinks:</span>
                  <span className="text-emerald-300 font-bold">{cisco.uplinks}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">PoE Budget:</span>
                  <span className="text-emerald-300 font-bold">{cisco.poeBudget}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Enrutamiento:</span>
                  <span className="text-emerald-300 font-bold">{cisco.layerRouting}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Comparativa de Especificaciones Clave */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3.5">Criterio Técnico Relevante</th>
                  <th className="py-2.5 px-3.5 text-rose-300">Equipo Rival ({competitor.brand})</th>
                  <th className="py-2.5 px-3.5 text-emerald-300">Cisco Homologado ({cisco.sku})</th>
                  <th className="py-2.5 px-3.5 text-center">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                {specRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2 px-3.5 font-medium text-slate-300 flex items-center gap-1.5">
                      <span className="text-slate-500 font-mono text-[10px]">{idx + 1}.</span>
                      <span>{row.label}</span>
                    </td>
                    <td className="py-2 px-3.5 font-mono text-[11px] text-slate-400">{row.competitorValue}</td>
                    <td className="py-2 px-3.5 font-mono text-[11px] text-slate-200 font-semibold">
                      {row.ciscoValue}
                    </td>
                    <td className="py-2 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                          row.status === 'identical'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                            : row.status === 'superior'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla 2: Comparativa frente a Configuraciones Cisco Establecidas */}
          {ciscoConfigurations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    Comparativa vs. Configuraciones Cisco Establecidas ({ciscoConfigurations.length})
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Evaluación de {competitor.brand} frente a cada perfil homologado disponible
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-indigo-500/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/95 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Configuración Cisco</th>
                      <th className="py-2.5 px-3 text-center">% Homol.</th>
                      <th className="py-2.5 px-3">Puertos & Uplinks</th>
                      <th className="py-2.5 px-3">PoE & Apilamiento</th>
                      <th className="py-2.5 px-3">Gestión & Norma</th>
                      <th className="py-2.5 px-3 text-right">GPL / Dcto</th>
                      {onSelectCiscoSku && <th className="py-2.5 px-3 text-center">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/70">
                    <tr className="bg-rose-950/20">
                      <td className="py-2 px-3">
                        <div className="text-[10px] font-black uppercase text-rose-300">
                          Base Solicitada ({competitor.brand})
                        </div>
                        <div className="font-mono text-[11px] font-bold text-white">
                          {competitor.model}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-200 border border-rose-700/50">
                          Ref. 100%
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-rose-200">
                        <div>{competitor.ports}</div>
                        <div className="text-[10px] text-slate-400">{competitor.uplinks}</div>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-300">
                        <div>{competitor.poeBudget}</div>
                        <div className="text-[10px] text-slate-400">{competitor.stacking}</div>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-300">
                        <div>{competitor.cloudManagement}</div>
                        <div className="text-[10px] text-slate-400">{competitor.powerSupply}</div>
                      </td>
                      <td className="py-2 px-3 text-right text-[10px] text-slate-500 font-mono">
                        Equipo Rival
                      </td>
                      {onSelectCiscoSku && (
                        <td className="py-2 px-3 text-center text-[10px] text-slate-500">—</td>
                      )}
                    </tr>

                    {ciscoConfigurations.map((cfg) => (
                      <tr
                        key={cfg.sku}
                        className={`transition-colors ${
                          cfg.isActiveSelected
                            ? 'bg-emerald-950/25 hover:bg-emerald-950/35'
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-black text-emerald-300">
                              {cfg.sku}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                              {cfg.strategyTag}
                            </span>
                            {cfg.isFastTrackEligible && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-950 text-amber-300 border border-amber-600/40">
                                ⚡ Fast Track
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[230px]">
                            {cfg.title}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              cfg.homologationPct >= 100
                                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/50'
                                : 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/50'
                            }`}
                          >
                            {cfg.homologationPct}%
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-200">
                          <div>{cfg.ports}</div>
                          <div className="text-[10px] text-emerald-300/90">{cfg.uplinks}</div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-200">
                          <div>{cfg.poeBudget}</div>
                          <div className="text-[10px] text-slate-400">{cfg.stacking}</div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">
                          <div>{cfg.cloudManagement}</div>
                          <div className="text-[10px] text-slate-400">{cfg.powerSupply}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] whitespace-nowrap">
                          {cfg.unitGplUsd && cfg.unitGplUsd > 0 ? (
                            <div>
                              <div className="text-white font-bold">
                                ${cfg.unitGplUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} GPL
                              </div>
                              {typeof cfg.discountPct === 'number' && cfg.discountPct > 0 && (
                                <div className="text-[10px] text-emerald-400">
                                  -{cfg.discountPct}% Dcto
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">Catálogo 2026</span>
                          )}
                        </td>
                        {onSelectCiscoSku && (
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {cfg.isActiveSelected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-600/25 text-emerald-300 border border-emerald-500/50">
                                <Check className="w-3 h-3" /> Activa
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectCiscoSku(cfg.sku)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                              >
                                Usar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabla 3: Benchmark Multi-Marca frente a las demás marcas equivalentes */}
          {peerBrandsMatrix.length > 2 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Benchmark Multi-Marca del Segmento ({competitor.brand} vs. Cisco y demás Marcas)
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {peerBrandsMatrix.length} fabricantes comparados a nivel técnico y de homologación
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-sky-500/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/95 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Marca & Modelo</th>
                      <th className="py-2.5 px-3 text-center">Homol. Cisco</th>
                      <th className="py-2.5 px-3">Puertos & Uplinks</th>
                      <th className="py-2.5 px-3">PoE Budget</th>
                      <th className="py-2.5 px-3">Enrutamiento & Stack</th>
                      <th className="py-2.5 px-3">Gestión Cloud & Garantía</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/70">
                    {peerBrandsMatrix.map((peer, pIdx) => (
                      <tr
                        key={`${peer.brand}-${pIdx}`}
                        className={
                          peer.role === 'requested'
                            ? 'bg-rose-950/20'
                            : peer.role === 'cisco_reference'
                              ? 'bg-emerald-950/25'
                              : 'hover:bg-slate-900/40'
                        }
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                peer.role === 'requested'
                                  ? 'bg-rose-950 text-rose-300 border-rose-700/50'
                                  : peer.role === 'cisco_reference'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50'
                                    : 'bg-slate-800 text-sky-300 border-slate-700'
                              }`}
                            >
                              {peer.brand}
                            </span>
                            {peer.role === 'requested' && (
                              <span className="text-[9px] font-bold text-rose-300">Solicitada</span>
                            )}
                            {peer.role === 'cisco_reference' && (
                              <span className="text-[9px] font-bold text-emerald-300">Homologada</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] font-semibold text-slate-200 mt-0.5">
                            {peer.model}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                            {peer.homologationPct}%
                          </span>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                            &rarr; {peer.equivalentCiscoSku}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-300">
                          <div>{peer.ports}</div>
                          <div className="text-[10px] text-slate-400">{peer.uplinks}</div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">{peer.poeBudget}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">
                          <div>{peer.layerRouting}</div>
                          <div className="text-[10px] text-slate-400">{peer.stacking}</div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">
                          <div>{peer.cloudManagement}</div>
                          <div className="text-[10px] text-slate-400">{peer.warrantySupport}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Veredicto de Homologación Preventa IA */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900/70 to-indigo-950/30 border border-emerald-500/30 flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-black uppercase text-emerald-300 tracking-wide">
                Dictamen Técnico del Arquitecto Preventa IA
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{verdict}</p>
            </div>
          </div>

          {/* Ventajas Clave Cisco frente al Competidor */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Ventajas Competitivas para Propuesta Comercial & Licitación:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-300">
              {keyAdvantages.map((adv, i) => (
                <div key={i} className="flex items-start space-x-1.5 text-[11px]">
                  <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                  <span>{adv}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
