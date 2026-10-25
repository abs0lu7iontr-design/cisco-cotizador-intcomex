// ============================================================================
// CISCO AUTOMATED v2.1 - LIVE STUDIO MODAL (CUSTOMIZADOR EN CALIENTE)
// Permite modificar en caliente: colores, glassmorphism, esquinas y densidad.
// ============================================================================

import React from 'react';
import {
  Palette,
  X,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  Maximize2,
  Grid,
  Droplet,
  Layers,
  Check,
} from 'lucide-react';
import {
  useUiExperience,
  LiveStudioConfig,
  DEFAULT_LIVE_STUDIO_CONFIG,
} from '../core/themeEngine';

interface LiveStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS: Array<{
  name: string;
  category: string;
  colors: [string, string, string]; // [Primary, Secondary, Bg]
  config: Partial<LiveStudioConfig>;
}> = [
  {
    name: 'Cisco Executive',
    category: 'Oficial',
    colors: ['#4f46e5', '#06b6d4', '#020617'],
    config: {
      accentPrimary: '#4f46e5',
      accentSecondary: '#6366f1',
      accentGlow: 'rgba(99, 102, 241, 0.35)',
      bgApp: '#020617',
      bgPanel: '#0b132b',
      bgCard: '#0f172a',
      borderCard: 'rgba(79, 70, 229, 0.35)',
      textHighlight: '#818cf8',
      borderRadius: 'modern',
      glassBlur: 16,
    },
  },
  {
    name: 'Cyberpunk Neon',
    category: 'Vibrante',
    colors: ['#ec4899', '#06b6d4', '#080512'],
    config: {
      accentPrimary: '#db2777',
      accentSecondary: '#ec4899',
      accentGlow: 'rgba(236, 72, 153, 0.45)',
      bgApp: '#080512',
      bgPanel: '#150926',
      bgCard: '#210d3d',
      borderCard: 'rgba(236, 72, 153, 0.45)',
      textHighlight: '#f472b6',
      borderRadius: 'curved',
      glassBlur: 18,
    },
  },
  {
    name: 'Emerald FinTech',
    category: 'Rentabilidad',
    colors: ['#10b981', '#34d399', '#02130e'],
    config: {
      accentPrimary: '#059669',
      accentSecondary: '#10b981',
      accentGlow: 'rgba(16, 185, 129, 0.4)',
      bgApp: '#02130e',
      bgPanel: '#052219',
      bgCard: '#0a3225',
      borderCard: 'rgba(16, 185, 129, 0.4)',
      textHighlight: '#6ee7b7',
      borderRadius: 'modern',
      glassBlur: 14,
    },
  },
  {
    name: 'Sunset Amber Gold',
    category: 'Ejecutivo',
    colors: ['#f59e0b', '#fbbf24', '#0e0a04'],
    config: {
      accentPrimary: '#d97706',
      accentSecondary: '#f59e0b',
      accentGlow: 'rgba(245, 158, 11, 0.35)',
      bgApp: '#0e0a04',
      bgPanel: '#1a1306',
      bgCard: '#2b1f09',
      borderCard: 'rgba(245, 158, 11, 0.4)',
      textHighlight: '#fde68a',
      borderRadius: 'curved',
      glassBlur: 16,
    },
  },
  {
    name: 'Nordic Frost',
    category: 'Minimalista',
    colors: ['#0ea5e9', '#67e8f9', '#02131c'],
    config: {
      accentPrimary: '#0284c7',
      accentSecondary: '#0ea5e9',
      accentGlow: 'rgba(14, 165, 233, 0.35)',
      bgApp: '#02131c',
      bgPanel: '#062333',
      bgCard: '#0a354c',
      borderCard: 'rgba(14, 165, 233, 0.4)',
      textHighlight: '#7dd3fc',
      borderRadius: 'modern',
      glassBlur: 20,
    },
  },
  {
    name: 'Stealth Titanium',
    category: 'Monocromo',
    colors: ['#71717a', '#e4e4e7', '#09090b'],
    config: {
      accentPrimary: '#52525b',
      accentSecondary: '#71717a',
      accentGlow: 'rgba(228, 228, 231, 0.15)',
      bgApp: '#09090b',
      bgPanel: '#18181b',
      bgCard: '#27272a',
      borderCard: 'rgba(161, 161, 170, 0.35)',
      textHighlight: '#f4f4f5',
      borderRadius: 'sharp',
      glassBlur: 8,
    },
  },
];

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig, resetConfig, changeMode } = useUiExperience();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Estudio de Diseño en Caliente
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    En Vivo
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Ajusta colores, transparencias, esquinas y densidad visual a tu antojo en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={resetConfig}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-semibold"
              title="Restablecer a valores por defecto"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-slate-200">
          {/* Quick Presets */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              <span>Presets Rápidos de Estilo</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    changeMode('aesthetic');
                    updateConfig(p.config);
                  }}
                  className="p-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-indigo-500/40 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-slate-500">{p.category}</p>
                  </div>
                  <div className="flex items-center -space-x-1">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: p.colors[0] }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: p.colors[1] }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: p.colors[2] }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Custom Colors */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-indigo-400" />
              <span>Colores Principales (Selector Hexadecimal en Vivo)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Accent */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div>
                  <p className="text-xs font-bold text-white">Color de Acento Primario</p>
                  <p className="text-[11px] text-slate-400">Botones de acción, bordes activos y títulos</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.accentPrimary}
                    onChange={(e) =>
                      updateConfig({
                        accentPrimary: e.target.value,
                        accentGlow: `${e.target.value}40`,
                        borderCard: `${e.target.value}4d`,
                      })
                    }
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs text-indigo-300 font-bold uppercase">
                    {config.accentPrimary}
                  </span>
                </div>
              </div>

              {/* Secondary Accent */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div>
                  <p className="text-xs font-bold text-white">Acento Secundario & Hover</p>
                  <p className="text-[11px] text-slate-400">Degradados y micro-interacciones</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.accentSecondary}
                    onChange={(e) => updateConfig({ accentSecondary: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs text-purple-300 font-bold uppercase">
                    {config.accentSecondary}
                  </span>
                </div>
              </div>

              {/* App Background */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div>
                  <p className="text-xs font-bold text-white">Fondo de la Aplicación</p>
                  <p className="text-[11px] text-slate-400">Lienzo maestro de la pantalla</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.bgApp}
                    onChange={(e) => updateConfig({ bgApp: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs text-slate-300 font-bold uppercase">
                    {config.bgApp}
                  </span>
                </div>
              </div>

              {/* Panel & Card Background */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div>
                  <p className="text-xs font-bold text-white">Fondo de Tarjetas y Paneles</p>
                  <p className="text-[11px] text-slate-400">Cajas de contenido y tablas</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={config.bgPanel}
                    onChange={(e) =>
                      updateConfig({
                        bgPanel: e.target.value,
                        bgCard: e.target.value,
                      })
                    }
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs text-slate-300 font-bold uppercase">
                    {config.bgPanel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Glassmorphism & Transparencia */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Glassmorphism & Desenfoque Acrílico</span>
              </label>
              <span className="text-xs font-mono font-bold text-indigo-300">
                {config.glassBlur}px de desenfoque
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400 w-16">Nítido (0)</span>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="2"
                  value={config.glassBlur}
                  onChange={(e) => updateConfig({ glassBlur: Number(e.target.value) })}
                  className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <span className="text-xs text-slate-400 w-24 text-right">Acrílico (24px)</span>
              </div>
            </div>
          </div>

          {/* Section: Curvatura de Bordes (Border Radius) */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Curvatura de Esquinas (*Border Radius*)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { id: 'sharp', label: 'Sharp (4px)', desc: 'Empresarial rígido' },
                  { id: 'modern', label: 'Modern (14px)', desc: 'Equilibrado actual' },
                  { id: 'curved', label: 'Curved (22px)', desc: 'Ultra-Aesthetic' },
                  { id: 'pill', label: 'Pill (Píldora)', desc: 'Extremos redondeados' },
                ] as const
              ).map((r) => {
                const isSelected = config.borderRadius === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => updateConfig({ borderRadius: r.id })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold">{r.label}</p>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500">{r.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Densidad de Interfaz */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-indigo-400" />
              <span>Densidad Visual de Tabla y Espaciado</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'compact', label: 'Compacto', desc: 'Máximo número de filas sin scroll' },
                  { id: 'comfortable', label: 'Confortable', desc: 'Espaciado óptimo para lectura diaria' },
                  { id: 'spacious', label: 'Aesthetic Espacioso', desc: 'Filas aireadas estilo revista ejecutiva' },
                ] as const
              ).map((d) => {
                const isSelected = config.density === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => updateConfig({ density: d.id })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold">{d.label}</p>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500">{d.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Interruptores de Efectos */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Efectos Ambientales & Concentración</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Mesh Gradient */}
              <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Malla Mesh Fondo</p>
                  <p className="text-[10px] text-slate-400">Esferas de luz ambiental</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.meshGradient}
                  onChange={(e) => updateConfig({ meshGradient: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Ambient Glow */}
              <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Resplandor Neón</p>
                  <p className="text-[10px] text-slate-400">Halos luminosos en botones</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.ambientGlow}
                  onChange={(e) => updateConfig({ ambientGlow: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Zen Mode */}
              <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Modo Zen (Focus)</p>
                  <p className="text-[10px] text-slate-400">Ocultar barras secundarias</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.zenFocusMode}
                  onChange={(e) => updateConfig({ zenFocusMode: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Los cambios se guardan y aplican automáticamente en vivo.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Listo, Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
