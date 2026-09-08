// ============================================================================
// CISCO AUTOMATED - THEME SELECTOR MODAL (12 THEMES)
// ============================================================================

import React, { useState } from 'react';
import { Palette, X, Check, Sparkles } from 'lucide-react';
import { APP_THEMES, AppTheme, applyTheme, getSavedThemeId } from '../core/themeEngine';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChanged?: (theme: AppTheme) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  onThemeChanged,
}) => {
  const [activeThemeId, setActiveThemeId] = useState<string>(() => getSavedThemeId());

  if (!isOpen) return null;

  const handleSelectTheme = (theme: AppTheme) => {
    setActiveThemeId(theme.id);
    applyTheme(theme.id);
    if (onThemeChanged) onThemeChanged(theme);
  };

  const categories = Array.from(new Set(APP_THEMES.map((t) => t.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Selector de Temas & Aspecto Visual
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {APP_THEMES.length} Estilos
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personaliza la paleta de colores, contrastes y acentos visuales de toda la plataforma.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Themes Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{category}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {APP_THEMES.filter((t) => t.category === category).map((theme) => {
                  const isSelected = activeThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-slate-800/90 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/40'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                      }`}
                    >
                      {/* Swatch & Check */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                            style={{ backgroundColor: theme.swatchColors[0] }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                            style={{ backgroundColor: theme.swatchColors[1] }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                            style={{ backgroundColor: theme.swatchColors[2] }}
                          />
                        </div>

                        {isSelected && (
                          <span className="p-1 rounded-full bg-indigo-600 text-white shadow-md">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{theme.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {theme.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>El tema seleccionado se guarda automáticamente en tu navegador.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
