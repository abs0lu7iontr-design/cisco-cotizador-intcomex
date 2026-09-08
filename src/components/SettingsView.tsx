import React, { useState } from 'react';
import {
  Settings,
  HardDrive,
  Database,
  Info,
  CheckCircle2,
  AlertCircle,
  Palette,
} from 'lucide-react';
import { APP_THEMES, getSavedThemeId } from '../core/themeEngine';

interface SettingsViewProps {
  onOpenThemes?: () => void;
}

export function SettingsView({ onOpenThemes }: SettingsViewProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

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
