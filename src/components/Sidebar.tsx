// ============================================================================
// CISCO AUTOMATED v2.1 - APPLICATION SIDEBAR (COLLAPSIBLE & ROUNDED BRANDING)
// ============================================================================

import React from 'react';
import { UserSession, Role } from '../core/types';
import {
  LayoutDashboard,
  Calculator,
  UploadCloud,
  FileCheck,
  History,
  Users,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { CISCO_AUTOMATED_SEAL_DATA_URI } from '../core/brandingLogos';
import { NavViewId } from '../core/store';

interface SidebarProps {
  currentView: NavViewId;
  onSelectView: (view: NavViewId) => void;
  currentUser: UserSession;
  onLogout: () => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export function Sidebar({
  currentView,
  onSelectView,
  currentUser,
  onLogout,
  isOpen = true,
  onToggleOpen,
}: SidebarProps) {
  const isAdmin = currentUser.role === 'admin';

  const navItems = [
    {
      id: 'dashboard' as NavViewId,
      label: 'Dashboard Analítico',
      icon: LayoutDashboard,
      section: 'main',
    },
    {
      id: 'quoter' as NavViewId,
      label: 'Cotizador Cisco CCW',
      icon: Calculator,
      highlight: true,
      section: 'main',
    },
    {
      id: 'upload' as NavViewId,
      label: 'Subir Estimate',
      icon: UploadCloud,
      section: 'main',
    },
    {
      id: 'dsv' as NavViewId,
      label: 'Generador DSV Cisco',
      icon: FileCheck,
      section: 'main',
    },
    {
      id: 'estimates' as NavViewId,
      label: 'Historial Estimates',
      icon: History,
      section: 'main',
    },
    ...(isAdmin
      ? [
          {
            id: 'users' as NavViewId,
            label: 'Gestión Usuarios (RBAC)',
            icon: Users,
            section: 'admin',
          },
          {
            id: 'audit' as NavViewId,
            label: 'Auditoría & Logs',
            icon: ShieldAlert,
            section: 'admin',
          },
        ]
      : []),
    {
      id: 'settings' as NavViewId,
      label: 'Configuración',
      icon: Settings,
      section: 'system',
    },
  ];

  const getRoleBadge = (role: Role) => {
    if (role === 'admin') {
      return { label: 'ADMIN', bg: 'bg-rose-950/70 text-rose-300 border-rose-700/40' };
    }
    if (role === 'pm') {
      return { label: 'PM', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/40' };
    }
    return { label: 'PREVENTA', bg: 'bg-indigo-950/70 text-indigo-300 border-indigo-700/40' };
  };

  const roleInfo = getRoleBadge(currentUser.role);

  // If collapsed: show compact icon navigation bar
  if (!isOpen) {
    return (
      <aside className="w-16 bg-slate-950/95 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 items-center py-3 transition-all duration-300">
        {/* Expand Toggle */}
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 mb-4 cursor-pointer transition-colors"
          title="Expandir barra lateral"
        >
          <Menu className="w-4 h-4 text-indigo-400" />
        </button>

        {/* Brand Icon */}
        <div className="w-10 h-10 rounded-full bg-slate-900 p-1 border border-slate-700 flex items-center justify-center mb-5 overflow-hidden shadow-md">
          <img
            src={CISCO_AUTOMATED_SEAL_DATA_URI}
            alt="Cisco Automated"
            className="w-full h-full object-contain rounded-full"
          />
        </div>

        {/* Icon Nav */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`p-2.5 rounded-xl transition-all cursor-pointer block ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2.5 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
          title="Cerrar Sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-slate-950/95 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 transition-all duration-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-slate-900 p-1 border-2 border-indigo-500/30 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
            <img
              src={CISCO_AUTOMATED_SEAL_DATA_URI}
              alt="Cisco Automated Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm font-black text-white tracking-tight leading-none truncate">
              Cisco Automated
            </h2>
            <span className="text-[10px] font-extrabold text-indigo-400 tracking-wider uppercase mt-1 block">
              v2.1 &bull; Intcomex
            </span>
          </div>
        </div>

        {onToggleOpen && (
          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Ocultar barra lateral"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User Profile Card */}
      <div className="p-3 mx-3 my-3 bg-slate-900/90 border border-slate-800 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser.username.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-bold text-slate-200 truncate">
              {currentUser.full_name || currentUser.username}
            </div>
            <div className="mt-0.5">
              <span
                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border inline-block ${roleInfo.bg}`}
              >
                {roleInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-3 py-2">
          Módulos Principales
        </div>

        {navItems
          .filter((item) => item.section === 'main')
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? item.highlight
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                      : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : item.highlight
                    ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/80 border border-emerald-800/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : item.highlight
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
              </button>
            );
          })}

        {isAdmin && (
          <>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-3 pt-4 pb-1">
              Administración
            </div>
            {navItems
              .filter((item) => item.section === 'admin')
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                  </button>
                );
              })}
          </>
        )}

        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-3 pt-4 pb-1">
          Sistema
        </div>
        {navItems
          .filter((item) => item.section === 'system')
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
              </button>
            );
          })}
      </nav>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-950/20 hover:bg-rose-950/60 border border-rose-900/30 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
