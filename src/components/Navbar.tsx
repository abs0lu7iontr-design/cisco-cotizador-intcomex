// ============================================================================
// CISCO AUTOMATED v2.1 - QUOTER NAVBAR (WITH SIDEBAR TOGGLES & ROUNDED BRANDING)
// Soporta conmutación en caliente: Vista Clásica vs Vista Aesthetic + Custom Studio
// ============================================================================

import React from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Download,
  UploadCloud,
  RefreshCw,
  Upload,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  FileCheck,
  Pickaxe,
  Mail,
  Check,
  Sparkles,
  Palette,
  ClipboardPaste,
} from 'lucide-react';
import { CISCO_AUTOMATED_SEAL_DATA_URI } from '../core/brandingLogos';
import { getFormattedAppVersion } from '../core/appVersion';
import { useUiExperience } from '../core/themeEngine';

interface NavbarProps {
  onUploadClick: () => void;
  onShowRulesClick?: () => void;
  onSharedSkuClick?: () => void;
  onDownloadClick: () => void;
  onSaveCloudClick?: () => void;
  isSavingCloud?: boolean;
  onDsvClick?: () => void;
  onBoClick?: () => void;
  onFastTrackClick?: () => void;
  onMiningAuditClick?: () => void;
  miningAuditReport?: any;
  onThemeClick?: () => void;
  onFeedbackClick?: () => void;
  onClearClick: () => void;
  onCopyEmailClick?: () => void;
  isCopiedEmail?: boolean;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onToggleParamSidebar?: () => void;
  isParamSidebarOpen?: boolean;
  isProcessing: boolean;
  hasData: boolean;
  fileName?: string;
  onOpenLiveStudio?: () => void;
  onOpenQuickIngest?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onUploadClick,
  onShowRulesClick: _onShowRulesClick,
  onSharedSkuClick: _onSharedSkuClick,
  onDownloadClick,
  onSaveCloudClick,
  isSavingCloud = false,
  onDsvClick,
  onBoClick,
  onFastTrackClick: _onFastTrackClick,
  onMiningAuditClick,
  miningAuditReport,
  onThemeClick: _onThemeClick,
  onFeedbackClick: _onFeedbackClick,
  onClearClick,
  onCopyEmailClick,
  isCopiedEmail = false,
  onToggleSidebar,
  isSidebarOpen = true,
  onToggleParamSidebar,
  isParamSidebarOpen = true,
  isProcessing,
  hasData,
  fileName,
  onOpenLiveStudio,
  onOpenQuickIngest,
}) => {
  const { mode, changeMode, isAesthetic } = useUiExperience();

  return (
    <header
      id="app-navbar"
      className={
        isAesthetic
          ? 'bg-slate-900/90 text-slate-100 border border-indigo-500/30 backdrop-blur-xl shadow-2xl sticky top-2 z-30 max-w-[1720px] mx-auto rounded-2xl transition-all duration-300 floating-island-navbar my-2'
          : 'bg-slate-900/95 text-slate-100 border-b border-slate-800 shadow-md sticky top-0 z-30'
      }
    >
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left Section: Brand, Toggles & Primary Actions */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
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

          {/* Cisco Automated Brand Seal */}
          <div className="w-9 h-9 rounded-xl bg-slate-950 p-0.5 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-md overflow-hidden hover:border-slate-500 transition-colors">
            <img
              src={CISCO_AUTOMATED_SEAL_DATA_URI}
              alt="Cisco Automated Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                Cisco Automated
              </h1>
              <span className="bg-indigo-950 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-700/40">
                {getFormattedAppVersion()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Motor de Cotizaciones Cisco CCW &bull; Reglas Intcomex
            </p>
          </div>

          {/* Elegant Divider between Brand and Actions */}
          <div className="h-6 w-px bg-slate-800 hidden md:block shrink-0 mx-1" />

          {/* Primary Quick Actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="btn-upload-file"
              onClick={onUploadClick}
              disabled={isProcessing}
              className="inline-flex items-center space-x-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Subir Excel</span>
            </button>

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

            {onOpenQuickIngest && (
              <button
                id="btn-quick-ingest"
                type="button"
                onClick={onOpenQuickIngest}
                className="inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
                title="Ingreso rápido desde texto, correos o portapapeles"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Quick Ingest</span>
              </button>
            )}
          </div>
        </div>

        {/* Center / Right Section: Dual View Switcher (Clásica vs Aesthetic) & Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Dual-View Mode Switcher: Clásica vs Aesthetic */}
          <div className="flex items-center p-0.5 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
            <button
              id="btn-view-classic"
              type="button"
              onClick={() => changeMode('classic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                !isAesthetic
                  ? 'bg-slate-800 text-white shadow-md border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Clásica: Estilo corporativo tradicional probado"
            >
              <span>🏛️</span>
              <span className="hidden sm:inline">Vista Clásica</span>
              <span className="sm:hidden">Clásica</span>
            </button>

            <button
              id="btn-view-aesthetic"
              type="button"
              onClick={() => changeMode('aesthetic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                isAesthetic
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-1 ring-indigo-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Ultra-Moderna & Aesthetic con mejoras visuales avanzadas"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">Vista Aesthetic</span>
              <span className="sm:hidden">Aesthetic</span>
            </button>
          </div>

          {/* Botón Custom en Caliente (Activo en modo Aesthetic) */}
          {isAesthetic && onOpenLiveStudio && (
            <button
              id="btn-open-live-studio"
              type="button"
              onClick={onOpenLiveStudio}
              className="inline-flex items-center space-x-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border border-purple-500/50 text-purple-300 hover:text-white hover:border-purple-400 shadow-md shadow-purple-950/40 transition-all cursor-pointer"
              title="Personalizar en Caliente (colores, blur, densidad y esquinas a tu gusto)"
            >
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              <span>Custom en Caliente</span>
            </button>
          )}

          {/* Contextual Quote Tools & Badges (Visible only when hasData) */}
          {hasData && (
            <>
              {fileName && (
                <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-700/40 px-3 py-1.5 rounded-xl text-xs text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-emerald-200 max-w-[180px] truncate">{fileName}</span>
                </div>
              )}

              {onToggleParamSidebar && (
                <button
                  onClick={onToggleParamSidebar}
                  className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                    isParamSidebarOpen
                      ? 'bg-indigo-950/70 text-indigo-300 border-indigo-700/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={isParamSidebarOpen ? 'Ocultar panel de parámetros' : 'Mostrar panel de parámetros'}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Parámetros</span>
                </button>
              )}

              {miningAuditReport && miningAuditReport.overallStatus !== 'NO_RULES' && onMiningAuditClick && (
                <button
                  id="btn-mining-audit"
                  onClick={onMiningAuditClick}
                  className={`inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all cursor-pointer shadow-md ${
                    miningAuditReport.overallStatus === 'COMPLIANT'
                      ? 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60'
                      : miningAuditReport.overallStatus === 'REQUIRES_REVIEW'
                      ? 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border-rose-700/60'
                      : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border-amber-700/60'
                  }`}
                  title={`Auditoría Minería: ${miningAuditReport.matchedAccount?.groupName || 'Cuenta Detectada'}`}
                >
                  <Pickaxe className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Auditoría Minera</span>
                  {miningAuditReport.sntOpportunityCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              )}

              {onBoClick && (
                <button
                  id="btn-solicitar-bo"
                  onClick={onBoClick}
                  disabled={isProcessing}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-950/20 cursor-pointer"
                  title="Generar correo de solicitud de Back Order hacia Ventas Core"
                >
                  <span>📑</span>
                  <span>Solicitar BO</span>
                </button>
              )}

              {onSaveCloudClick && (
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

              {onCopyEmailClick && (
                <button
                  id="btn-copy-email-summary"
                  onClick={onCopyEmailClick}
                  disabled={isProcessing}
                  className={`inline-flex items-center space-x-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer shadow-md ${
                    isCopiedEmail
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                      : 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border-indigo-700/50 hover:text-white shadow-indigo-950/20'
                  }`}
                  title="Copiar resumen comercial estilizado para Outlook/Gmail con saludo dinámico según la hora"
                >
                  {isCopiedEmail ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Mail className="w-4 h-4 text-indigo-400" />
                  )}
                  <span>{isCopiedEmail ? '¡Copiado!' : 'Copiar para Correo'}</span>
                </button>
              )}

              <button
                id="btn-clear-state"
                onClick={onClearClick}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/40 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                title="Vaciar archivo y comenzar limpia"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Limpiar</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
