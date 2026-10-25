// ============================================================================
// CISCO AUTOMATED - GLOBAL SPOTLIGHT / COMMAND PALETTE (CTRL+K)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Upload,
  Download,
  FileCheck,
  Calculator,
  Palette,
  ShieldCheck,
  Sliders,
  History,
  Sparkles,
  Command,
  ArrowRight,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useUiExperience } from '../core/themeEngine';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadClick: () => void;
  onDownloadClick: () => void;
  onDsvClick?: () => void;
  onOpenRules?: () => void;
  onOpenLiveStudio?: () => void;
  onNavigateView: (view: string) => void;
  hasData: boolean;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onUploadClick,
  onDownloadClick,
  onDsvClick,
  onOpenRules,
  onOpenLiveStudio,
  onNavigateView,
  hasData,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mode, changeMode, isAesthetic } = useUiExperience();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const commands: CommandItem[] = [
    {
      id: 'upload',
      title: 'Subir nuevo archivo Estimate Excel (CCW)',
      category: 'Acciones Principales',
      shortcut: 'Ctrl + U',
      icon: <Upload className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onClose();
        onUploadClick();
      },
    },
    {
      id: 'download',
      title: 'Descargar Cotización Intcomex Excel / PDF',
      category: 'Acciones Principales',
      shortcut: 'Ctrl + D',
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      action: () => {
        if (hasData) {
          onClose();
          onDownloadClick();
        }
      },
    },
    ...(onDsvClick
      ? [
          {
            id: 'dsv',
            title: 'Generar y Exportar Plantilla Oficial DSV Cisco',
            category: 'Acciones Principales',
            shortcut: 'Alt + S',
            icon: <FileCheck className="w-4 h-4 text-amber-400" />,
            action: () => {
              onClose();
              onDsvClick();
            },
          },
        ]
      : []),
    {
      id: 'view_quoter',
      title: 'Ir a la Vista de Cotizador (Matriz de Ítems)',
      category: 'Navegación',
      icon: <FileSpreadsheet className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onClose();
        onNavigateView('quoter');
      },
    },
    {
      id: 'view_dashboard',
      title: 'Ir al Dashboard Analítico y Métricas',
      category: 'Navegación',
      icon: <Calculator className="w-4 h-4 text-purple-400" />,
      action: () => {
        onClose();
        onNavigateView('dashboard');
      },
    },
    {
      id: 'view_settings',
      title: 'Ir a Configuración del Sistema',
      category: 'Navegación',
      icon: <Sliders className="w-4 h-4 text-slate-400" />,
      action: () => {
        onClose();
        onNavigateView('settings');
      },
    },
    {
      id: 'toggle_aesthetic',
      title: isAesthetic ? 'Cambiar a Vista Clásica Corporativa' : 'Cambiar a Vista Aesthetic Ultra-Moderna',
      category: 'Experiencia Visual',
      icon: <Sparkles className="w-4 h-4 text-pink-400" />,
      action: () => {
        changeMode(isAesthetic ? 'classic' : 'aesthetic');
        onClose();
      },
    },
    ...(onOpenLiveStudio
      ? [
          {
            id: 'live_studio',
            title: 'Abrir Estudio de Personalización "Custom en Caliente"',
            category: 'Experiencia Visual',
            icon: <Palette className="w-4 h-4 text-purple-400" />,
            action: () => {
              onClose();
              onOpenLiveStudio();
            },
          },
        ]
      : []),
    ...(onOpenRules
      ? [
          {
            id: 'rules',
            title: 'Ver Reglas Comerciales de Internación y Aranceles',
            category: 'Ayuda y Reglas',
            icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
            action: () => {
              onClose();
              onOpenRules();
            },
          },
        ]
      : []),
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/80">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando o busca una acción..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-400 rounded-lg">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No se encontraron comandos para "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                  selectedIndex === idx
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-xl ${
                      selectedIndex === idx
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {cmd.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold block">{cmd.title}</span>
                    <span
                      className={`text-[10px] ${
                        selectedIndex === idx ? 'text-indigo-200' : 'text-slate-500'
                      }`}
                    >
                      {cmd.category}
                    </span>
                  </div>
                </div>

                {cmd.shortcut && (
                  <kbd
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-lg border ${
                      selectedIndex === idx
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer tips */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <div className="flex items-center gap-3">
            <span>↑↓ para navegar</span>
            <span>↵ para seleccionar</span>
          </div>
          <span className="font-mono text-[10px]">Cisco Automated Spotlight</span>
        </div>
      </div>
    </div>
  );
};
