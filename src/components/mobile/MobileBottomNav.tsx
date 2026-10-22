import React, { useState } from 'react';
import {
  Calculator,
  Bot,
  Truck,
  LayoutDashboard,
  Menu,
} from 'lucide-react';
import { NavViewId } from '../../core/store';
import { UserSession } from '../../core/types';
import { MobileMenuDrawer } from './MobileMenuDrawer';

interface MobileBottomNavProps {
  currentView: NavViewId;
  onSelectView: (view: NavViewId) => void;
  currentUser: UserSession;
  onLogout: () => void;
  activeBoCount?: number;
  unreadFeedbackCount?: number;
  hasActiveEstimate?: boolean;
  onUploadClick?: () => void;
  onDsvClick?: () => void;
  onOpenRules?: () => void;
  onOpenSharedSku?: () => void;
  onOpenFastTrack?: () => void;
  isDrawerOpen?: boolean;
  onToggleDrawer?: (open: boolean) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  currentUser,
  onLogout,
  activeBoCount = 0,
  unreadFeedbackCount = 0,
  hasActiveEstimate = false,
  onUploadClick,
  onDsvClick,
  onOpenRules,
  onOpenSharedSku,
  onOpenFastTrack,
  isDrawerOpen,
  onToggleDrawer,
}) => {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuVisible = isDrawerOpen !== undefined ? isDrawerOpen : internalMenuOpen;
  const setMenuVisible = (open: boolean) => {
    if (onToggleDrawer) onToggleDrawer(open);
    setInternalMenuOpen(open);
  };

  const tabs = [
    {
      id: 'quoter' as NavViewId,
      label: 'Cotizar',
      icon: Calculator,
      hasDot: hasActiveEstimate,
    },
    {
      id: 'configuriator' as NavViewId,
      label: 'ConfigurIAtor',
      icon: Bot,
      pill: 'IA',
    },
    {
      id: 'bo_tracking' as NavViewId,
      label: 'Tracking BO',
      icon: Truck,
      badge: activeBoCount > 0 ? activeBoCount : undefined,
    },
    {
      id: 'dashboard' as NavViewId,
      label: 'Métricas',
      icon: LayoutDashboard,
    },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar (Visible only on screens < md) */}
      <nav
        aria-label="Navegación Móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_20px_rgba(0,0,0,0.5)]"
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                className={`flex flex-col items-center justify-center h-full relative transition-all cursor-pointer select-none ${
                  isActive
                    ? 'text-indigo-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
                  
                  {/* Indicator Dot for Active Quote */}
                  {tab.hasDot && !isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
                  )}

                  {/* IA Pill */}
                  {tab.pill && (
                    <span className="absolute -top-1 -right-2 text-[8px] font-black px-1 rounded bg-indigo-500 text-white leading-none py-0.5">
                      {tab.pill}
                    </span>
                  )}

                  {/* Numeric Badge */}
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 leading-none">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span className={`text-[10px] mt-1 tracking-tight truncate max-w-[64px] ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                  {tab.label}
                </span>

                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}

          {/* Tab 5: Menú / Más */}
          <button
            type="button"
            onClick={() => setMenuVisible(true)}
            className={`flex flex-col items-center justify-center h-full relative transition-all cursor-pointer select-none ${
              menuVisible ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Menu className="w-5 h-5" />
              {unreadFeedbackCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950" />
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium tracking-tight">
              Menú
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-Up Full Drawer for Additional Views */}
      <MobileMenuDrawer
        isOpen={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentView={currentView}
        onSelectView={onSelectView}
        currentUser={currentUser}
        onLogout={onLogout}
        unreadFeedbackCount={unreadFeedbackCount}
        onUploadClick={onUploadClick}
        onDsvClick={onDsvClick}
        onOpenRules={onOpenRules}
        onOpenSharedSku={onOpenSharedSku}
        onOpenFastTrack={onOpenFastTrack}
      />
    </>
  );
};
