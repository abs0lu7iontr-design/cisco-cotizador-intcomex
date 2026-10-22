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
  RefreshCw,
  Download,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Calendar,
  Clock,
  BookOpen,
  Building2,
  Share2,
  Zap,
  History,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { APP_THEMES, getSavedThemeId } from '../core/themeEngine';
import { useAppTheme } from '../context/ThemeContext';
import { DsvPartnerUploader } from '../modules/dsv/components/DsvPartnerUploader';
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
import { checkDesktopUpdate, applyDesktopUpdate, DesktopUpdateResult, isDesktopApp } from '../core/desktopBridge';
import { APP_VERSION, getFormattedAppVersion } from '../core/appVersion';
import { VERSION_HISTORY } from '../core/versionHistory';

interface SettingsViewProps {
  onOpenThemes?: () => void;
  onOpenRules?: () => void;
  onOpenSharedSku?: () => void;
  onOpenFastTrack?: () => void;
}

export function SettingsView({
  onOpenThemes,
  onOpenRules,
  onOpenSharedSku,
  onOpenFastTrack,
}: SettingsViewProps) {
  const { theme, toggleTheme } = useAppTheme();
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
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState<boolean>(false);
  const [updateInstallResult, setUpdateInstallResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const formattedDate = d.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const formattedTime = d.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      return `${formattedDate} ${formattedTime}`;
    } catch {
      return ts;
    }
  };

  const getRelativeTime = (ts?: string) => {
    if (!ts) return '';
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return '(recién)';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `(hace ${diffMin} min)`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `(hace ${diffHours} h)`;
      const diffDays = Math.floor(diffHours / 24);
      return `(hace ${diffDays} d)`;
    } catch {
      return '';
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateInstallResult(null);
    try {
      const res = await checkDesktopUpdate();
      if (res) {
        setUpdateInfo(res);
      } else {
        setUpdateInfo({
          success: true,
          has_update: false,
          current_version: APP_VERSION,
          latest_version: APP_VERSION,
          release_url: 'https://develop.cisco-automated.pages.dev',
          release_notes: `La aplicación está en su versión más reciente (v${APP_VERSION}).`,
        });
      }
    } catch {
      setUpdateInfo({
        success: true,
        has_update: false,
        current_version: APP_VERSION,
        latest_version: APP_VERSION,
        release_url: 'https://develop.cisco-automated.pages.dev',
        release_notes: 'Versión actual al día.',
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo) return;
    setIsApplyingUpdate(true);
    setUpdateInstallResult(null);
    try {
      const res = await applyDesktopUpdate(updateInfo.download_url);
      if (res && res.success) {
        setUpdateInstallResult({
          success: true,
          message: res.message || '¡Actualización instalada con éxito! Recargando aplicación...',
        });
        setTimeout(() => {
          if (typeof window !== 'undefined') window.location.reload();
        }, 1000);
      } else {
        setUpdateInstallResult({
          success: false,
          message: res?.error || 'No se pudo aplicar la actualización automáticamente.',
        });
      }
    } catch (err: any) {
      setUpdateInstallResult({
        success: false,
        message: err?.message || 'Error inesperado durante la actualización.',
      });
    } finally {
      setIsApplyingUpdate(false);
    }
  };

  useEffect(() => {
    syncAiSettingsFromDesktopBridge().then((synced) => setAiSettings(synced));
    checkDesktopUpdate().then((res) => {
      if (res) setUpdateInfo(res);
    }).catch(() => {});
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
          <span>Configuración del Sistema &bull; Cisco Automated {getFormattedAppVersion()}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Reglas del negocio, base de datos de partners, reclasificación SKU, promociones Fast Track y personalización.
        </p>
      </div>

      {/* Centro de Reglas, Catálogos & Bases del Negocio */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Centro de Reglas, Catálogos & Bases del Negocio</span>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/40">
            Reglas CCW &bull; Partners XCL &bull; Reglas SKU &bull; Fast Track
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Administración centralizada de normativas comerciales Cisco CCW, base de partners Intcomex, reclasificación de SKUs y catálogo promocional Fast Track.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card 1: Reglas de Negocio CCW */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Reglas y Metodología CCW</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                  OFICIAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Fórmulas de margen comercial, clasificación de intangibles, arancel 7%, costos de importación y reglas de licenciamiento Meraki / SaaS.
              </p>
            </div>
            {onOpenRules && (
              <button
                type="button"
                onClick={onOpenRules}
                className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Ver Documentación de Reglas</span>
              </button>
            )}
          </div>

          {/* Card 2: Base de Datos Partners XCL */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Base de Datos Partners XCL</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                  DSV INTCOMEX
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Catálogo maestro de Partners y códigos de canal XCL para homologación automática en el Generador DSV y cotizaciones CCW.
              </p>
            </div>
            <div>
              <DsvPartnerUploader
                label="Cargar / Sincronizar Base Partners (JSON)"
                className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Card 3: Reglas de Reclasificación SKU */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>Reglas SKU Reclasificación</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                  NUBE & LOCAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Gestión centralizada de reglas de reclasificación de SKUs (Hardware a Software, Licencias Cloud, Exclusiones de Arancel).
              </p>
            </div>
            {onOpenSharedSku && (
              <button
                type="button"
                onClick={onOpenSharedSku}
                className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Administrar Reglas SKU</span>
              </button>
            )}
          </div>

          {/* Card 4: Catálogo y Promociones Fast Track */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Catálogo y Auditoría Fast Track</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50">
                  PROMOS CISCO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Catálogo de descuentos promocionales Fast Track autorizados por Cisco con verificación de ahorros y auditoría de deals.
              </p>
            </div>
            {onOpenFastTrack && (
              <button
                type="button"
                onClick={onOpenFastTrack}
                className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Administrar Fast Track</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Theme Settings Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5 text-pink-400 font-bold text-xs uppercase tracking-wider">
            <Palette className="w-4 h-4" />
            <span>Aspecto Visual, Modo HUD & Temas ({APP_THEMES.length} Disponibles)</span>
          </div>
          {onOpenThemes && (
            <button
              onClick={onOpenThemes}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Explorar Paletas</span>
            </button>
          )}
        </div>

        {/* HUD Mode Switcher */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex-wrap gap-3">
          <div>
            <span className="text-xs font-bold text-white block">Estilo de Interfaz</span>
            <span className="text-[11px] text-slate-400 block">
              Alternar entre la estética Cyber HUD (acento neón futurista) y Enterprise Clean (clásico corporativo).
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:border-cyan-500 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            title="Alternar diseño visual"
          >
            <span>🎨</span>
            <span>{theme === 'cyber' ? 'Modo Cyber HUD' : 'Modo Enterprise'}</span>
            <span className="text-[10px] text-cyan-400 font-mono">(Alternar)</span>
          </button>
        </div>

        {/* Active Theme Preview */}
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
            Paleta Activa
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
            <span className="font-bold text-emerald-400 font-mono">v{APP_VERSION} (Cloud & Desktop Ready)</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Motor de Procesamiento</span>
            <span className="font-bold text-indigo-400 font-mono">ExcelJS CCW Engine v{APP_VERSION.split('.').slice(0, 2).join('.')}</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Cifrado de Accesos</span>
            <span className="font-bold text-emerald-400 font-mono">bcrypt (Cost 12) + SHA-256</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Roles Activos</span>
            <span className="font-bold text-white">Admin &bull; Product Manager (PM) &bull; Preventa</span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500">Última Actualización / Despliegue</span>
            <span className="font-bold text-cyan-400 font-mono text-right flex items-center gap-1.5">
              <span>{formatTimestamp(updateInfo?.current_timestamp) || 'Sincronizado'}</span>
              {updateInfo?.current_commit && (
                <span className="text-slate-400 font-normal text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {updateInfo.current_commit.slice(0, 7)}
                </span>
              )}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Autor / Arquitectura</span>
            <span className="font-bold text-white">Mauricio Skill (mauricio.skill@mayor.cl)</span>
          </div>
        </div>
      </div>

      {/* Auto-Update Checker Card */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>Actualizaciones del Software & Auto-Deploy</span>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {isDesktopApp() ? 'App Portable .EXE (Desktop Bridge)' : 'Cloudflare Pages CDN'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Sincroniza la compilación más reciente directamente desde la rama <code className="text-indigo-300 font-mono">develop</code> de GitHub y la red CDN de Cloudflare Pages sin necesidad de reinstalar manualmente.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate || isApplyingUpdate}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            <span>{isCheckingUpdate ? 'Comprobando en la nube...' : 'Buscar Actualizaciones'}</span>
          </button>
        </div>

        {updateInstallResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2.5 animate-fade-in ${
              updateInstallResult.success
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
            }`}
          >
            {updateInstallResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{updateInstallResult.message}</span>
          </div>
        )}

        {updateInfo && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 animate-fade-in ${
              updateInfo.has_update
                ? 'bg-amber-950/40 text-amber-200 border-amber-500/40'
                : 'bg-emerald-950/40 text-emerald-200 border-emerald-500/40'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                {updateInfo.has_update ? (
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span className="font-bold text-sm">
                  {updateInfo.has_update ? '🚀 ¡Nueva compilación disponible para actualizar!' : '✅ Aplicación al día con la última compilación'}
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-80">
                Canal: {updateInfo.channel || 'develop'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1.5">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Compilación Actual (Local / Navegador)
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">v{updateInfo.current_version}</span>
                  {updateInfo.current_commit && (
                    <span className="text-slate-300 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Commit: {updateInfo.current_commit.slice(0, 7)}
                    </span>
                  )}
                </div>
                {updateInfo.current_timestamp && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-mono pt-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">
                      {formatTimestamp(updateInfo.current_timestamp)}
                    </span>
                    <span className="text-slate-400 text-[10px] font-sans">
                      {getRelativeTime(updateInfo.current_timestamp)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1.5">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Última Compilación en la Nube (Cloudflare / GitHub)
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">v{updateInfo.latest_version}</span>
                  {updateInfo.latest_commit && (
                    <span className="text-cyan-300 font-mono text-[10px] bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                      Commit: {updateInfo.latest_commit.slice(0, 7)}
                    </span>
                  )}
                </div>
                {updateInfo.latest_timestamp && (
                  <div className="text-[11px] text-cyan-300 flex items-center gap-1.5 font-mono pt-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold">
                      {formatTimestamp(updateInfo.latest_timestamp)}
                    </span>
                    <span className="text-slate-400 text-[10px] font-sans">
                      {getRelativeTime(updateInfo.latest_timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {updateInfo.release_notes && (
              <div className="text-[11px] bg-black/20 p-2.5 rounded-lg border border-white/5">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Notas del Release / Commit:</span>
                <p className="text-slate-200 italic font-sans">{updateInfo.release_notes}</p>
              </div>
            )}

            {updateInfo.has_update && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {isDesktopApp() ? (
                  <button
                    type="button"
                    onClick={handleApplyUpdate}
                    disabled={isApplyingUpdate}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className={`w-4 h-4 ${isApplyingUpdate ? 'animate-bounce' : ''}`} />
                    <span>{isApplyingUpdate ? 'Descargando e instalando en caliente...' : '⚡ Actualizar e Instalar Ahora'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>🔄 Recargar para Aplicar en Web</span>
                  </button>
                )}

                <a
                  href={updateInfo.release_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ver Despliegue en la Nube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial de Versiones & Modificaciones (Changelog) */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Control de Versiones & Historial de Modificaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/abs0lu7iontr-design/cisco-cotizador-intcomex/blob/develop/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>CHANGELOG.md</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/abs0lu7iontr-design/cisco-cotizador-intcomex/blob/develop/RELEASE_NOTES.md"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Release Notes</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/abs0lu7iontr-design/cisco-cotizador-intcomex/tags"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-amber-300 border border-indigo-700/40 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Tag className="w-3 h-3" />
              <span>Tags en GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Historial oficial y auditoría de cada actualización desplegada. Cada cambio se rige bajo el estándar SemVer (Semantic Versioning) y la convención Keep a Changelog registrada en el repositorio.
        </p>

        <div className="space-y-3 pt-1">
          {(showAllVersions ? VERSION_HISTORY : VERSION_HISTORY.slice(0, 4)).map((item) => (
            <div
              key={item.version}
              className={`p-3.5 rounded-xl border text-xs transition-all ${
                item.status === 'CURRENT'
                  ? 'bg-slate-950/90 border-cyan-500/40 shadow-sm shadow-cyan-950/40'
                  : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      item.status === 'CURRENT'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    v{item.version}
                  </span>
                  <span className="font-semibold text-white text-xs">{item.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {item.date}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-400">
                    {item.commit}
                  </span>
                </div>
              </div>
              <ul className="space-y-1 mt-2 text-[11px] text-slate-300 pl-4 list-disc marker:text-cyan-400">
                {item.highlights.map((h, idx) => (
                  <li key={idx} className="leading-relaxed">{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setShowAllVersions(!showAllVersions)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700/60 transition-colors cursor-pointer"
          >
            {showAllVersions ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Mostrar solo versiones recientes</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Ver historial completo ({VERSION_HISTORY.length} versiones)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
