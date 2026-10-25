// ============================================================================
// CISCO AUTOMATED - KEYBOARD SHORTCUTS CHEAT SHEET MODAL
// ============================================================================

import React from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      group: 'Navegación Global y Acciones',
      shortcuts: [
        { key: 'Ctrl + K / ⌘ + K', desc: 'Abrir paleta de comandos Spotlight' },
        { key: 'Ctrl + U', desc: 'Subir nuevo archivo Estimate Excel' },
        { key: 'Ctrl + D', desc: 'Descargar cotización oficial Intcomex' },
        { key: '?', desc: 'Abrir esta guía de atajos de teclado' },
        { key: 'Esc', desc: 'Cerrar cualquier modal o menú flotante' },
      ],
    },
    {
      group: 'Tabla Interactiva (Fila Seleccionada)',
      shortcuts: [
        { key: 'H', desc: 'Clasificar fila como Hardware / Equipo estándar (+7% Int)' },
        { key: 'I', desc: 'Clasificar fila como Intangible / Licencia (0% Int / 0% Ar)' },
        { key: 'A', desc: 'Clasificar fila como Arancel Aduanero "=" (+6% Ar)' },
        { key: '↑ / ↓', desc: 'Mover selección a la fila anterior o siguiente' },
        { key: 'Clic Derecho', desc: 'Abrir menú contextual completo de la fila' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Atajos de Teclado Profesionales
              </h3>
              <p className="text-xs text-slate-400">
                Optimiza tu productividad en Cisco Automated sin levantar las manos del teclado.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {shortcutGroups.map((group, idx) => (
            <div key={idx} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {group.group}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((sc, sidx) => (
                  <div
                    key={sidx}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-300">{sc.desc}</span>
                    <kbd className="px-2.5 py-1 text-[11px] font-mono font-bold bg-slate-900 border border-slate-700 text-slate-200 rounded-lg shadow-inner">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
