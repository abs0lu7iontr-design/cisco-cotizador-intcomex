// ============================================================================
// CISCO AUTOMATED v2.1 - QUOTER NAVBAR (WITH SIDEBAR TOGGLES & ROUNDED BRANDING)
// ============================================================================

import React from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  HelpCircle,
  Download,
  UploadCloud,
  RefreshCw,
  Upload,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  FileCheck,
  Zap,
  Palette,
  Share2,
} from 'lucide-react';
import { CISCO_AUTOMATED_SEAL_DATA_URI } from '../core/brandingLogos';

interface NavbarProps {
  onUploadClick: () => void;
  onShowRulesClick: () => void;
  onSharedSkuClick?: () => void;
  onDownloadClick: () => void;
  onSaveCloudClick?: () => void;
  isSavingCloud?: boolean;
  onDsvClick?: () => void;
  onFastTrackClick?: () => void;
  onThemeClick?: () => void;
  onClearClick: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onToggleParamSidebar?: () => void;
  isParamSidebarOpen?: boolean;
  isProcessing: boolean;
  hasData: boolean;
  fileName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onUploadClick,
  onShowRulesClick,
  onSharedSkuClick,
  onDownloadClick,
  onSaveCloudClick,
  isSavingCloud = false,
  onDsvClick,
  onFastTrackClick,
  onThemeClick,
  onClearClick,
  onToggleSidebar,
  isSidebarOpen = true,
  onToggleParamSidebar,
  isParamSidebarOpen = true,
  isProcessing,
  hasData,
  fileName,
}) => {
  return (
    <header id="app-navbar" className="bg-slate-900/95 text-slate-100 border-b border-slate-800 shadow-md sticky top-0 z-30">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Toggles */}
        <div className="flex items-center space-x-2.5">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title={isSidebarOpen ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-indigo-400" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          )}

          {/* Circular Branding Logo */}
          <div className="w-9 h-9 rounded-full bg-slate-950 p-0.5 border border-indigo-500/40 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
            <img
              src={CISCO_AUTOMATED_SEAL_DATA_URI}
              alt="Seal"
              className="w-full h-full object-contain rounded-full"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                Cisco Automated
              </h1>
              <span className="bg-indigo-950 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-700/40">
                v2.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Motor de Cotizaciones Cisco CCW &bull; Reglas Intcomex
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Parameter Sidebar Toggle when Quoter has data */}
          {hasData && onToggleParamSidebar && (
            <button
              onClick={onToggleParamSidebar}
              className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                isParamSidebarOpen
                  ? 'bg-indigo-950/70 text-indigo-300 border-indigo-700/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={isParamSidebarOpen ? 'Ocultar panel de parámetros (más espacio)' : 'Mostrar panel de parámetros'}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Parámetros</span>
            </button>
          )}

          {hasData && fileName && (
            <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-700/40 px-3 py-1.5 rounded-xl text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-emerald-200 max-w-[180px] truncate">{fileName}</span>
            </div>
          )}

          <button
            id="btn-show-rules"
            onClick={onShowRulesClick}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
            title="Ver Documentación Técnica v2.1"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Reglas</span>
          </button>

          {/* Theme Selector Button */}
          {onThemeClick && (
            <button
              id="btn-theme-selector"
              onClick={onThemeClick}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Cambiar tema y colores visuales"
            >
              <Palette className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">Temas</span>
            </button>
          )}

          {/* Fast Track Admin Button */}
          {onFastTrackClick && (
            <button
              id="btn-fast-track-admin"
              onClick={onFastTrackClick}
              className="inline-flex items-center space-x-1.5 text-xs font-bold bg-amber-950/50 hover:bg-amber-950/80 text-amber-300 border border-amber-700/50 px-3 py-2 rounded-xl transition-colors cursor-pointer shadow-md shadow-amber-950/20"
              title="Administrar Base de Datos y Auditoría Fast Track"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Fast Track</span>
            </button>
          )}

          {/* Shared SKU Rules Button */}
          {onSharedSkuClick && (
            <button
              id="btn-shared-sku-rules"
              onClick={onSharedSkuClick}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Administrar y sincronizar reglas de reclasificación de SKU (Nube & Local)"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Reglas SKU</span>
            </button>
          )}

          <button
            id="btn-upload-file"
            onClick={onUploadClick}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Subir Excel</span>
          </button>

          {/* Clear Button */}
          {hasData && (
            <button
              id="btn-clear-state"
              onClick={onClearClick}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/40 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Vaciar archivo y comenzar limpia"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Limpiar</span>
            </button>
          )}

          {/* Generar DSV Button */}
          {onDsvClick && (
            <button
              id="btn-generate-dsv"
              onClick={onDsvClick}
              disabled={isProcessing}
              className="inline-flex items-center space-x-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
              title="Transformar BOM actual y exportar plantilla oficial DSV para el portal Cisco"
            >
              <FileCheck className="w-4 h-4 text-amber-100" />
              <span>Generar DSV</span>
            </button>
          )}

          {/* Save to Cloud Button (Firestore Shared History) */}
          {hasData && onSaveCloudClick && (
            <button
              id="btn-save-cloud"
              onClick={onSaveCloudClick}
              disabled={isSavingCloud || isProcessing}
              className="inline-flex items-center space-x-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Guardar cotización en Firebase Firestore (Nube Compartida)"
            >
              {isSavingCloud ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-4 h-4 text-cyan-100" />
              )}
              <span>{isSavingCloud ? 'Guardando...' : 'Guardar en la Nube'}</span>
            </button>
          )}

          {/* Download Button (Opens Structured / Prompt Modal) */}
          <button
            id="btn-download-excel"
            onClick={onDownloadClick}
            disabled={!hasData || isProcessing}
            className={`inline-flex items-center space-x-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
              hasData && !isProcessing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
            title={
              hasData
                ? 'Guardar y descargar archivo Excel modificado (.xlsx)'
                : 'Sube una cotización Excel para habilitar la descarga'
            }
          >
            <Download className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>
        </div>
      </div>
    </header>
  );
};
