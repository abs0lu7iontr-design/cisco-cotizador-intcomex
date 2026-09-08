// ============================================================================
// CISCO AUTOMATED - FIREBASE FIRESTORE CLOUD CONFIGURATION MODAL
// Allows connecting the app to any Google Cloud / Firebase account (e.g. abs0lu7iontr@gmail.com)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveActiveFirebaseConfig,
  resetToDefaultFirebaseConfig,
} from './firebaseConfig';
import { FirebaseCustomConfig } from './types';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export function FirebaseConfigModal({ isOpen, onClose, onConfigSaved }: FirebaseConfigModalProps) {
  const [config, setConfig] = useState<FirebaseCustomConfig>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });

  const [rawJsonPaste, setRawJsonPaste] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = getActiveFirebaseConfig();
      setConfig(active);
      setTestStatus(null);
      setRawJsonPaste('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseJson = () => {
    try {
      let clean = rawJsonPaste.trim();
      if (clean.startsWith('const firebaseConfig =')) {
        clean = clean.replace('const firebaseConfig =', '').replace(/;$/, '').trim();
      }
      clean = clean.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
      const parsed = JSON.parse(clean);

      if (parsed.projectId && parsed.apiKey) {
        setConfig({
          apiKey: parsed.apiKey || '',
          authDomain: parsed.authDomain || '',
          projectId: parsed.projectId || '',
          storageBucket: parsed.storageBucket || '',
          messagingSenderId: parsed.messagingSenderId || '',
          appId: parsed.appId || '',
        });
        setTestStatus('✅ Configuración pegada detectada correctamente.');
      } else {
        setTestStatus('⚠️ El JSON no contiene "projectId" o "apiKey" válidos.');
      }
    } catch (e: any) {
      setTestStatus('⚠️ Error parseando el texto: Asegúrate de pegar el objeto JSON de Firebase.');
    }
  };

  const handleSave = () => {
    if (!config.projectId || !config.apiKey) {
      setTestStatus('⚠️ Project ID y API Key son obligatorios.');
      return;
    }

    saveActiveFirebaseConfig(config);
    setTestStatus('✅ ¡Credenciales de Firebase actualizadas! Recargando para conectar...');

    setTimeout(() => {
      window.location.reload();
    }, 600);

    if (onConfigSaved) onConfigSaved();
  };

  const handleReset = () => {
    resetToDefaultFirebaseConfig();
    const def = getActiveFirebaseConfig();
    setConfig(def);
    setTestStatus('🔄 Restaurado a valores por defecto.');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Conexión Cloud Storage (Firebase Firestore)
              </h2>
              <p className="text-xs text-slate-400">
                Vincula tu cuenta de Google Console (<span className="text-cyan-300 font-mono">abs0lu7iontr@gmail.com</span>)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Instructions Banner */}
          <div className="p-4 bg-slate-950/60 border border-cyan-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> ¿Cómo ver tus datos en tu consola de Firebase?
              </span>
              <a
                href="https://console.firebase.google.com/u/0/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:underline text-cyan-300"
              >
                Abrir Firebase Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              1. En <strong className="text-white">console.firebase.google.com</strong>, crea un proyecto (ej: <em className="text-cyan-200">cisco-automated</em>).<br />
              2. Ve a <strong className="text-white">Build &gt; Firestore Database</strong> y pulsa <strong className="text-emerald-400">Create Database</strong> (Modo Producción o Prueba).<br />
              3. En <strong className="text-white">Project Settings &gt; General &gt; Your apps</strong>, agrega una App Web (<code>&lt;/&gt;</code>) y copia el bloque <code>firebaseConfig</code> aquí:
            </p>
          </div>

          {/* Quick JSON Paste */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Pegar bloque firebaseConfig directo (Opcional):</span>
            </label>
            <div className="flex gap-2">
              <textarea
                value={rawJsonPaste}
                onChange={(e) => setRawJsonPaste(e.target.value)}
                placeholder={'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "tu-proyecto-firebase",\n  ...\n};'}
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={handleParseJson}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-xs border border-slate-700 hover:border-cyan-500/40 rounded-lg transition-colors flex items-center justify-center shrink-0"
              >
                Cargar
              </button>
            </div>
          </div>

          {/* Status Message */}
          {testStatus && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                testStatus.startsWith('✅')
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              {testStatus}
            </div>
          )}

          {/* Detailed Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Project ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value.trim() })}
                placeholder="ej: cisco-intcomex-2026"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                API Key <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value.trim() })}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                value={config.authDomain || ''}
                onChange={(e) => setConfig({ ...config, authDomain: e.target.value.trim() })}
                placeholder="proyecto.firebaseapp.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Storage Bucket
              </label>
              <input
                type="text"
                value={config.storageBucket || ''}
                onChange={(e) => setConfig({ ...config, storageBucket: e.target.value.trim() })}
                placeholder="proyecto.appspot.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Messaging Sender ID
              </label>
              <input
                type="text"
                value={config.messagingSenderId || ''}
                onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value.trim() })}
                placeholder="104829384729"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                App ID
              </label>
              <input
                type="text"
                value={config.appId || ''}
                onChange={(e) => setConfig({ ...config, appId: e.target.value.trim() })}
                placeholder="1:104829384729:web:a8d9..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Predeterminados
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-95 rounded-lg shadow-lg shadow-cyan-500/20 transition-all"
            >
              <ShieldCheck className="w-4 h-4" /> Guardar y Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
