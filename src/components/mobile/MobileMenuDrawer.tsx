import React from 'react';
import {
  UploadCloud,
  FileCheck,
  History,
  LayoutDashboard,
  Zap,
  BookOpen,
  Share2,
  MessageSquare,
  Users,
  ShieldAlert,
  Settings,
  LogOut,
  X,
  User,
  Sparkles,
} from 'lucide-react';
import { NavViewId } from '../../core/store';
import { UserSession } from '../../core/types';
import { getFormattedAppVersion } from '../../core/appVersion';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: NavViewId;
  onSelectView: (view: NavViewId) => void;
  currentUser: UserSession;
  onLogout: () => void;
  unreadFeedbackCount?: number;
  onUploadClick?: () => void;
  onDsvClick?: () => void;
  onOpenRules?: () => void;
  onOpenSharedSku?: () => void;
  onOpenFastTrack?: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  onSelectView,
  currentUser,
  onLogout,
  unreadFeedbackCount = 0,
  onUploadClick,
  onDsvClick,
  onOpenRules,
  onOpenSharedSku,
  onOpenFastTrack,
}) => {
  if (!isOpen) return null;

  const handleNav = (view: NavViewId) => {
    onSelectView(view);
    onClose();
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-Up Drawer */}
      <div className="relative z-10 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Drawer Handle & Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">{currentUser.full_name || currentUser.username}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                  {currentUser.role}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Cisco Automated {getFormattedAppVersion()}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Menu Items */}
        <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Quick Actions (Subir Excel & DSV) */}
          <div className="grid grid-cols-2 gap-2.5">
            {onUploadClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUploadClick();
                }}
                className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Subir Excel</span>
              </button>
            )}

            {onDsvClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDsvClick();
                }}
                className="p-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Generar DSV</span>
              </button>
            )}
          </div>

          {/* Navigation Section */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 block mb-1">
              Módulos del Sistema
            </span>

            <button
              onClick={() => handleNav('dashboard')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                <span>Dashboard Analítico</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('estimates')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                currentView === 'estimates'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Historial de Cotizaciones</span>
              </div>
            </button>

            <button
              onClick={() => handleNav('feedback')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                currentView === 'feedback'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-violet-400" />
                <span>Soporte & Ticketing IA</span>
              </div>
              {unreadFeedbackCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500 text-white">
                  {unreadFeedbackCount}
                </span>
              )}
            </button>
          </div>

          {/* Reglas & Catálogos */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 block mb-1">
              Reglas & Catálogos
            </span>

            {onOpenFastTrack && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFastTrack();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Catálogo Fast Track (IndexedDB)</span>
              </button>
            )}

            {onOpenRules && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRules();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Reglas y Metodología CCW</span>
              </button>
            )}

            {onOpenSharedSku && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSharedSku();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-indigo-400" />
                <span>Reglas de Reclasificación SKU</span>
              </button>
            )}
          </div>

          {/* Administración & Ajustes */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 block mb-1">
              Sistema
            </span>

            {isAdmin && (
              <>
                <button
                  onClick={() => handleNav('users')}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    currentView === 'users'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>Gestión de Usuarios RBAC</span>
                </button>

                <button
                  onClick={() => handleNav('audit')}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    currentView === 'audit'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Auditoría & Logs de Seguridad</span>
                </button>
              </>
            )}

            <button
              onClick={() => handleNav('settings')}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                currentView === 'settings'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Configuración del Sistema</span>
            </button>
          </div>

          {/* Logout */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
