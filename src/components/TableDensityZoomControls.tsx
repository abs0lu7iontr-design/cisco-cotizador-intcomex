import React from 'react';
import { ZoomIn, ZoomOut, Sliders } from 'lucide-react';
import { TableDensityMode } from '../hooks/useTableDensityAndZoom';

export interface TableDensityZoomControlsProps {
  density: TableDensityMode;
  onDensityChange: (density: TableDensityMode) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  colorTheme?: 'cyan' | 'emerald' | 'indigo' | 'amber' | 'sky' | 'teal';
  label?: string;
  className?: string;
}

const THEME_ACTIVE_CLASSES: Record<
  NonNullable<TableDensityZoomControlsProps['colorTheme']>,
  { densityActive: string; zoomText: string }
> = {
  cyan: {
    densityActive: 'bg-cyan-500 text-slate-950 shadow-sm font-bold',
    zoomText: 'text-cyan-300 hover:text-cyan-200',
  },
  emerald: {
    densityActive: 'bg-emerald-500 text-slate-950 shadow-sm font-bold',
    zoomText: 'text-emerald-300 hover:text-emerald-200',
  },
  indigo: {
    densityActive: 'bg-indigo-600 text-white shadow-sm font-bold',
    zoomText: 'text-indigo-300 hover:text-indigo-200',
  },
  amber: {
    densityActive: 'bg-amber-500 text-slate-950 shadow-sm font-bold',
    zoomText: 'text-amber-300 hover:text-amber-200',
  },
  sky: {
    densityActive: 'bg-sky-500 text-slate-950 shadow-sm font-bold',
    zoomText: 'text-sky-300 hover:text-sky-200',
  },
  teal: {
    densityActive: 'bg-teal-500 text-slate-950 shadow-sm font-bold',
    zoomText: 'text-teal-300 hover:text-teal-200',
  },
};

export const TableDensityZoomControls: React.FC<TableDensityZoomControlsProps> = ({
  density,
  onDensityChange,
  zoom,
  onZoomChange,
  colorTheme = 'indigo',
  label = 'Vista:',
  className = '',
}) => {
  const theme = THEME_ACTIVE_CLASSES[colorTheme] || THEME_ACTIVE_CLASSES.indigo;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${className}`}>
      {/* Selector de Densidad Adaptativa */}
      <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-xl px-2 py-1 text-xs shadow-sm">
        <Sliders className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">{label}</span>
        <button
          type="button"
          onClick={() => onDensityChange('auto')}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
            density === 'auto' ? theme.densityActive : 'text-slate-400 hover:text-white'
          }`}
          title="Auto-Fit: adapta la densidad automáticamente según el tamaño del monitor o laptop"
        >
          Auto-Fit
        </button>
        <button
          type="button"
          onClick={() => onDensityChange('compact')}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
            density === 'compact' ? theme.densityActive : 'text-slate-400 hover:text-white'
          }`}
          title="Modo Compacto: ideal para pantallas de laptops (1366x768 o 1080p escalada)"
        >
          Compacto
        </button>
        <button
          type="button"
          onClick={() => onDensityChange('normal')}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
            density === 'normal' ? theme.densityActive : 'text-slate-400 hover:text-white'
          }`}
          title="Modo Estándar: espaciado amplio para monitores 1080p/2K/4K"
        >
          Estándar
        </button>
      </div>

      {/* Control de Escala / Zoom Local de la Tabla */}
      <div className="flex items-center gap-0.5 bg-slate-950/90 border border-slate-800 rounded-xl px-1.5 py-1 text-xs shadow-sm">
        <button
          type="button"
          onClick={() => onZoomChange(zoom - 5)}
          disabled={zoom <= 75}
          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
          title="Reducir escala de tabla (-5%)"
        >
          <ZoomOut className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(100)}
          className={`font-mono text-[9.5px] font-bold ${theme.zoomText} hover:underline px-1 cursor-pointer`}
          title="Restablecer zoom al 100%"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(zoom + 5)}
          disabled={zoom >= 115}
          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
          title="Aumentar escala de tabla (+5%)"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
