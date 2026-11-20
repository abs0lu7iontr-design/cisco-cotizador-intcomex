// ============================================================================
// CISCO AUTOMATED v2.23.0 - FILTER PRESETS BAR COMPONENT
// Barra de Vistas Guardadas y Filtros Rápidos (Presets)
// Permite alternar entre "Mi Vista Individual", "Vista General" y vistas personalizadas
// ============================================================================

import React, { useState } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Trash2,
  Check,
  X,
  Sparkles,
  Globe,
  User,
  Flame,
  Calendar,
  Package,
} from 'lucide-react';
import {
  FilterPreset,
  PresetModuleType,
  saveCustomFilterPreset,
  deleteCustomFilterPreset,
} from '../core/presets/filterPresetsManager';
import { useToast } from '../context/ToastContext';

interface FilterPresetsBarProps<T = Record<string, any>> {
  module: PresetModuleType;
  presets: FilterPreset<T>[];
  activePresetId?: string;
  currentFilters: T;
  onSelectPreset: (preset: FilterPreset<T>) => void;
  onPresetsChanged: () => void;
  userPmName?: string | null;
}

export function FilterPresetsBar<T extends Record<string, any>>({
  module,
  presets,
  activePresetId,
  currentFilters,
  onSelectPreset,
  onPresetsChanged,
  userPmName,
}: FilterPresetsBarProps<T>) {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'User':
        return <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'Globe':
        return <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'Flame':
        return <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'Calendar':
        return <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'Package':
        return <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      default:
        return <Bookmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    try {
      saveCustomFilterPreset(module, newPresetName.trim(), currentFilters);
      showToast(`Vista guardada: "${newPresetName.trim()}"`, 'success');
      setNewPresetName('');
      setIsSaving(false);
      onPresetsChanged();
    } catch (err) {
      showToast('Error al guardar la vista personalizada.', 'error');
    }
  };

  const handleDeletePreset = (e: React.MouseEvent, presetId: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la vista guardada "${name}"?`)) return;

    deleteCustomFilterPreset(module, presetId);
    showToast(`Vista "${name}" eliminada.`, 'info');
    onPresetsChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 px-1 text-xs">
      <div className="flex items-center space-x-1 text-slate-400 font-semibold mr-1 shrink-0 select-none">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] uppercase tracking-wider text-slate-400">Vistas:</span>
      </div>

      {presets.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`group inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isActive
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-400/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title={preset.description || preset.name}
          >
            {renderIcon(preset.iconName)}
            <span className="truncate max-w-[190px]">{preset.name}</span>

            {!preset.isFactory && (
              <span
                onClick={(e) => handleDeletePreset(e, preset.id, preset.name)}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-1 p-0.5"
                title="Eliminar preset"
              >
                <Trash2 className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}

      {/* Botón para guardar vista actual */}
      {isSaving ? (
        <form onSubmit={handleSavePreset} className="inline-flex items-center space-x-1 bg-slate-900 border border-indigo-500 rounded-xl px-2 py-0.5">
          <input
            type="text"
            autoFocus
            placeholder="Nombre de la vista..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-32 py-0.5"
          />
          <button
            type="submit"
            className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
            title="Guardar"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsSaving(false)}
            className="text-slate-400 hover:text-slate-300 p-0.5 cursor-pointer"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsSaving(true)}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-400 hover:text-indigo-300 bg-slate-900/50 hover:bg-slate-800/80 border border-dashed border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer"
          title="Guardar la configuración de filtros actual como una vista personalizada"
        >
          <BookmarkPlus className="w-3 h-3 text-indigo-400" />
          <span>+ Guardar Vista</span>
        </button>
      )}
    </div>
  );
}
