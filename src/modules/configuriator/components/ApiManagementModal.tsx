// ============================================================================
// CISCO AUTOMATED v2.1 - API MANAGEMENT & TOKEN ROTATION MODAL COMPONENT
// ============================================================================

import React from 'react';
import { KeyRound, X, Globe, Trash2 } from 'lucide-react';
import {
  AiConfigSettings,
  AiProviderId,
  PROVIDER_META,
} from '../aiProviderManager';

export interface ApiManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiSettings: AiConfigSettings;
  onToggleWebGrounding: () => void;
  newProvider: Exclude<AiProviderId, 'local_deterministic'>;
  setNewProvider: (provider: Exclude<AiProviderId, 'local_deterministic'>) => void;
  newKeyModel: string;
  setNewKeyModel: (model: string) => void;
  newKeyLabel: string;
  setNewKeyLabel: (label: string) => void;
  newKeyValue: string;
  setNewKeyValue: (value: string) => void;
  onAddKey: () => void;
  onToggleKey: (keyId: string) => void;
  onDeleteKey: (keyId: string) => void;
}

export const ApiManagementModal: React.FC<ApiManagementModalProps> = ({
  isOpen,
  onClose,
  aiSettings,
  onToggleWebGrounding,
  newProvider,
  setNewProvider,
  newKeyModel,
  setNewKeyModel,
  newKeyLabel,
  setNewKeyLabel,
  newKeyValue,
  setNewKeyValue,
  onAddKey,
  onToggleKey,
  onDeleteKey,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Pool de API Keys & Rotación Automática Multi-Proveedor
              </h3>
              <p className="text-xs text-slate-400">
                Prioridad #1: Google Gemini (3.7 Flash Texto &rarr; 3.6/3.8 Flash Visión) &rarr; Respaldo #2: OpenRouter (Auto Vision / DeepSeek).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opción de Grounding en Cisco.com */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Verificación EOL 2026 en páginas oficiales de Cisco (cisco.com)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Evalúa boletines End-of-Sale 2026 en cisco.com. Si el equipo sigue vigente, mantiene el SKU original.
            </p>
          </div>
          <input
            type="checkbox"
            checked={aiSettings.useCiscoOfficialGrounding}
            onChange={onToggleWebGrounding}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
          />
        </div>

        {/* Formulario para Añadir Nueva API Key */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-3">
          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            Añadir Nueva API Key al Pool de Respaldo
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Proveedor IA
              </label>
              <select
                value={newProvider}
                onChange={(e) => {
                  const p = e.target.value as Exclude<AiProviderId, 'local_deterministic'>;
                  setNewProvider(p);
                  setNewKeyModel(PROVIDER_META[p].defaultModel);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="gemini">Google Gemini (Principal)</option>
                <option value="openrouter">OpenRouter (Auto / DeepSeek / Qwen)</option>
                <option value="groq">Groq Cloud (Llama 4 / 3.3 Gratis)</option>
                <option value="deepseek">DeepSeek Oficial API</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Modelo
              </label>
              <select
                value={newKeyModel}
                onChange={(e) => setNewKeyModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {PROVIDER_META[newProvider].models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Etiqueta Identificadora
              </label>
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Ej. Gemini Respaldo #2"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder={PROVIDER_META[newProvider].placeholder}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
            />
            <button
              type="button"
              onClick={onAddKey}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              Guardar en el Pool
            </button>
          </div>
        </div>

        {/* Lista de API Keys Configuradas */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Orden de Prioridad y Estado de Tokens ({aiSettings.keys.length} registradas)
          </div>

          {aiSettings.keys.map((k, idx) => (
            <div
              key={k.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-[11px] text-slate-400">
                  #{idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{k.label}</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/40 text-[10px] font-mono uppercase">
                      {k.provider} &bull; {k.model}
                    </span>
                    {k.lastStatus === 'ok' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                        Operativa (200 OK)
                      </span>
                    )}
                    {k.lastStatus === 'quota_exceeded' && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold">
                        Tokens Agotados (429)
                      </span>
                    )}
                    {k.lastStatus === 'invalid' && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold">
                        Revisar Key
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Key: {k.apiKey.slice(0, 6)}••••••••{k.apiKey.slice(-4)}
                    {k.lastError ? ` • Último aviso: ${k.lastError}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleKey(k.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                    k.enabled
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {k.enabled ? 'Habilitada' : 'Pausada'}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteKey(k.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                  title="Eliminar Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
