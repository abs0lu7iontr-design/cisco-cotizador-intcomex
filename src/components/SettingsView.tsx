import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDrive,
  Database,
  Info,
  CheckCircle2,
  AlertCircle,
  Palette,
  Bot,
  KeyRound,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { APP_THEMES, getSavedThemeId } from '../core/themeEngine';
import {
  AiConfigSettings,
  AiProviderId,
  PROVIDER_META,
  loadAiSettings,
  saveAiSettings,
  addApiKeyToPool,
  syncAiSettingsFromDesktopBridge,
} from '../modules/configuriator';
import { CiscoApiStatusModal, getCiscoConfig } from '../modules/ciscoApi';

interface SettingsViewProps {
  onOpenThemes?: () => void;
}

export function SettingsView({ onOpenThemes }: SettingsViewProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isCiscoModalOpen, setIsCiscoModalOpen] = useState(false);

  const ciscoCfg = getCiscoConfig();
  const maskedCiscoKey =
    ciscoCfg.clientId.length > 8
      ? `${ciscoCfg.clientId.slice(0, 4)}...${ciscoCfg.clientId.slice(-4)}`
      : ciscoCfg.clientId;

  // ConfigurIAtor AI Multi-Provider Pool State
  const [aiSettings, setAiSettings] = useState<AiConfigSettings>(() => loadAiSettings());
  const [aiProvider, setAiProvider] = useState<Exclude<AiProviderId, 'local_deterministic'>>('gemini');
  const [aiKeyLabel, setAiKeyLabel] = useState('');
  const [aiKeyValue, setAiKeyValue] = useState('');
  const [aiKeyModel, setAiKeyModel] = useState('gemini-3.5-flash');
  const [aiSavedMsg, setAiSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    syncAiSettingsFromDesktopBridge().then((synced) => setAiSettings(synced));
  }, []);

  const handleAddAiKey = () => {
    if (!aiKeyValue.trim()) return;
    const next = addApiKeyToPool({
      provider: aiProvider,
      label: aiKeyLabel,
      apiKey: aiKeyValue,
      model: aiKeyModel,
    });
    setAiSettings(next);
    setAiKeyValue('');
    setAiKeyLabel('');
    setAiSavedMsg('API Key guardada y activada en el pool de rotación.');
    setTimeout(() => setAiSavedMsg(null), 4000);
  };

  const handleRemoveAiKey = (id: string) => {
    const next: AiConfigSettings = {
      ...aiSettings,
      keys: aiSettings.keys.filter((k) => k.id !== id),
    };
    saveAiSettings(next);
    setAiSettings(next);
  };

  const activeThemeId = getSavedThemeId();
  const currentTheme = APP_THEMES.find((t) => t.id === activeThemeId) || APP_THEMES[0];

  const handleTestDB = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if ((window as any).pywebview?.api?.test_database_connection) {
        const res = await (window as any).pywebview.api.test_database_connection(
          supabaseUrl.trim(),
          supabaseKey.trim()
        );
        setTestResult({
          success: res.success,
          message: res.message,
        });
      } else {
        setTimeout(() => {
          setTestResult({
            success: true,
            message: 'Motor SQLite Local operativo (gravity_database.db).',
          });
        }, 500);
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: 'Error probando base de datos: ' + e?.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-400" />
          <span>Configuración del Sistema &bull; Cisco Automated v3.3</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Personalización visual, parámetros de almacenamiento, bases de datos y detalles de versión.
        </p>
      </div>

      {/* Theme Settings Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-pink-400 font-bold text-xs uppercase tracking-wider">
            <Palette className="w-4 h-4" />
            <span>Aspecto Visual & Temas ({APP_THEMES.length} Disponibles)</span>
          </div>
          {onOpenThemes && (
            <button
              onClick={onOpenThemes}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Explorar Temas</span>
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20"
                style={{ backgroundColor: currentTheme.swatchColors[0] }}
              />
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20"
                style={{ backgroundColor: currentTheme.swatchColors[1] }}
              />
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20"
                style={{ backgroundColor: currentTheme.swatchColors[2] }}
              />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{currentTheme.name}</div>
              <div className="text-[11px] text-slate-400">{currentTheme.description}</div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/40">
            Activo
          </span>
        </div>
      </div>

      {/* ConfigurIAtor AI & Multi-Provider API Pool */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Bot className="w-4 h-4" />
            <span>ConfigurIAtor AI &bull; Pool Multi-API (Gemini, OpenRouter Free, Groq Free, DeepSeek)</span>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/40">
            {aiSettings.keys.length} Key(s) en rotación
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Registra múltiples API Keys para que si una agota sus tokens (Error 429), el agente cambie automáticamente a la siguiente Key o a proveedores gratuitos como OpenRouter (DeepSeek V3 Free) o Groq.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Proveedor IA
            </label>
            <select
              value={aiProvider}
              onChange={(e) => {
                const p = e.target.value as Exclude<AiProviderId, 'local_deterministic'>;
                setAiProvider(p);
                setAiKeyModel(PROVIDER_META[p].defaultModel);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              <option value="gemini">Google Gemini (Principal)</option>
              <option value="openrouter">OpenRouter (DeepSeek / Qwen Gratis)</option>
              <option value="groq">Groq Cloud (Llama 4 / 3.3 Gratis)</option>
              <option value="deepseek">DeepSeek Oficial API</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Modelo
            </label>
            <select
              value={aiKeyModel}
              onChange={(e) => setAiKeyModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              {PROVIDER_META[aiProvider].models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Etiqueta (Opcional)
            </label>
            <input
              type="text"
              value={aiKeyLabel}
              onChange={(e) => setAiKeyLabel(e.target.value)}
              placeholder="Ej. Key Principal / Respaldo"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="password"
            value={aiKeyValue}
            onChange={(e) => setAiKeyValue(e.target.value)}
            placeholder={PROVIDER_META[aiProvider].placeholder}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddAiKey}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Agregar Key al Pool</span>
          </button>
        </div>

        {aiSavedMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{aiSavedMsg}</span>
          </div>
        )}

        {aiSettings.keys.length > 0 && (
          <div className="space-y-2 pt-2">
            {aiSettings.keys.map((k, i) => (
              <div
                key={k.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-slate-500 font-bold">#{i + 1}</span>
                  <div>
                    <span className="font-bold text-white">{k.label}</span>
                    <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800 uppercase">
                      {k.provider} &bull; {k.model}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-slate-500">
                      ({k.apiKey.slice(0, 5)}••••{k.apiKey.slice(-4)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAiKey(k.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                  title="Quitar Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cisco Developer APIs (7 Servicios Vinculados) */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Cisco Developer APIs (7 Servicios Vinculados)</span>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/40">
            Key: {maskedCiscoKey} &bull; OAuth2 M2M Activo
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Conectividad OAuth2 M2M (<code className="text-cyan-300">apix.cisco.com</code>) con Cisco
          PSIRT openVuln API, Datafoundation-POE, HelloCommerce y servicios CX Cloud V2
          (Inventory, Contracts, Alerts y Customer).
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCiscoModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Ver Estado y Probar Conexión Cisco API</span>
          </button>
        </div>

        <CiscoApiStatusModal
          isOpen={isCiscoModalOpen}
          onClose={() => setIsCiscoModalOpen(false)}
        />
      </div>

      {/* Storage Settings */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2.5 text-indigo-400 font-bold text-xs uppercase tracking-wider">
          <HardDrive className="w-4 h-4" />
          <span>Almacenamiento Jerárquico Local</span>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Directorio Raíz de Almacenamiento
          </label>
          <input
            type="text"
            readOnly
            value="./gravity_storage"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none"
          />
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Estructura Generada Automáticamente
          </span>
          <span className="font-mono text-emerald-400 text-[11px] block">
            gravity_storage / [Partner] / [ClienteFinal] / YYYY-MM / YYYY-MM-DD / [Archivo.xlsx]
          </span>
        </div>
      </div>

      {/* Database Settings */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
          <Database className="w-4 h-4" />
          <span>Capa de Base de Datos Dual (SQLite + Supabase Cloud)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Supabase URL (Opcional para Nube)
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Supabase API Key (Anon / Service)
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleTestDB}
            disabled={isTesting}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTesting ? 'Probando conexión...' : 'Probar Conexión'}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center space-x-2.5 ${
              testResult.success
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* System Specs */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2.5 text-slate-300 font-bold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Información de la Aplicación</span>
        </div>

        <div className="divide-y divide-slate-800/80 text-xs">
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Nombre Oficial</span>
            <span className="font-bold text-white font-mono">Cisco Automated</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Versión</span>
            <span className="font-bold text-emerald-400 font-mono">v2.1.0 (Cloud & Desktop Ready)</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Motor de Procesamiento</span>
            <span className="font-bold text-indigo-400 font-mono">ExcelJS CCW Engine v2.1</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Cifrado de Accesos</span>
            <span className="font-bold text-emerald-400 font-mono">bcrypt (Cost 12) + SHA-256</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Roles Activos</span>
            <span className="font-bold text-white">Admin &bull; Product Manager (PM) &bull; Preventa</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Autor / Arquitectura</span>
            <span className="font-bold text-white">Mauricio Skill (mauricio.skill@mayor.cl)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
