// ============================================================================
// CISCO AUTOMATED - FIREBASE FIRESTORE CLOUD CONFIGURATION MODAL
// Allows connecting the app to any Google Cloud / Firebase account (e.g. abs0lu7iontr@gmail.com)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
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
import { useAccessibleModal } from '../../utils/useAccessibleModal';

export interface FirebaseConfigFieldErrors {
  projectId?: string;
  apiKey?: string;
  rawJsonPaste?: string;
}

export interface FirebaseConfigValidationResult {
  valid: boolean;
  errors: FirebaseConfigFieldErrors;
  firstInvalidFieldId: 'firebase-project-id' | 'firebase-api-key' | null;
}

/**
 * Valida de forma determinista el formulario de configuración Firebase
 * e identifica el primer campo con error para enfocarlo.
 */
export function validateFirebaseConfigForm(
  config: Partial<FirebaseCustomConfig>
): FirebaseConfigValidationResult {
  const errors: FirebaseConfigFieldErrors = {};
  const projectId = (config.projectId || '').trim();
  const apiKey = (config.apiKey || '').trim();

  if (!projectId) {
    errors.projectId = 'El campo Project ID es obligatorio.';
  }
  if (!apiKey) {
    errors.apiKey = 'El campo API Key es obligatorio.';
  }

  const firstInvalidFieldId = errors.projectId
    ? 'firebase-project-id'
    : errors.apiKey
      ? 'firebase-api-key'
      : null;

  return {
    valid: !errors.projectId && !errors.apiKey,
    errors,
    firstInvalidFieldId,
  };
}

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
  const [fieldErrors, setFieldErrors] = useState<FirebaseConfigFieldErrors>({});

  const projectIdInputRef = useRef<HTMLInputElement | null>(null);
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const rawJsonTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { dialogProps, titleId, descriptionId } = useAccessibleModal<HTMLDivElement>({
    isOpen,
    onClose,
    titleId: 'firebase-config-modal-title',
    descriptionId: 'firebase-config-modal-description',
    initialFocusRef: projectIdInputRef,
  });

  useEffect(() => {
    if (isOpen) {
      const active = getActiveFirebaseConfig();
      setConfig(active);
      setTestStatus(null);
      setRawJsonPaste('');
      setFieldErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseJson = () => {
    try {
      let clean = rawJsonPaste.trim();
      if (!clean) {
        setFieldErrors((prev) => ({
          ...prev,
          rawJsonPaste: 'Pega un bloque JSON de configuración Firebase antes de cargar.',
        }));
        setTestStatus('⚠️ Pega un bloque JSON de configuración Firebase antes de cargar.');
        rawJsonTextareaRef.current?.focus();
        return;
      }

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
        setFieldErrors({});
        setTestStatus('✅ Configuración pegada detectada correctamente.');
      } else {
        setFieldErrors((prev) => ({
          ...prev,
          rawJsonPaste: 'El JSON no contiene "projectId" o "apiKey" válidos.',
        }));
        setTestStatus('⚠️ El JSON no contiene "projectId" o "apiKey" válidos.');
        rawJsonTextareaRef.current?.focus();
      }
    } catch {
      setFieldErrors((prev) => ({
        ...prev,
        rawJsonPaste: 'Formato inválido: asegúrate de pegar un objeto JSON válido de Firebase.',
      }));
      setTestStatus('⚠️ Error parseando el texto: Asegúrate de pegar el objeto JSON de Firebase.');
      rawJsonTextareaRef.current?.focus();
    }
  };

  const handleSave = () => {
    const validation = validateFirebaseConfigForm(config);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setTestStatus('⚠️ Project ID y API Key son obligatorios.');
      if (validation.firstInvalidFieldId === 'firebase-project-id') {
        projectIdInputRef.current?.focus();
      } else if (validation.firstInvalidFieldId === 'firebase-api-key') {
        apiKeyInputRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
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
    setFieldErrors({});
    setTestStatus('🔄 Restaurado a valores por defecto.');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        {...dialogProps}
        aria-describedby={descriptionId}
        className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden text-slate-100 font-sans focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Conexión Cloud Storage (Firebase Firestore)
              </h2>
              <p id={descriptionId} className="text-xs text-slate-400">
                Vincula tu cuenta de Google Console (<span className="text-cyan-300 font-mono">abs0lu7iontr@gmail.com</span>)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración de Firebase"
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
            <label
              htmlFor="firebase-raw-json-paste"
              className="text-xs font-semibold text-slate-300 flex items-center justify-between"
            >
              <span>Pegar bloque firebaseConfig directo (Opcional):</span>
            </label>
            <div className="flex gap-2">
              <textarea
                id="firebase-raw-json-paste"
                ref={rawJsonTextareaRef}
                value={rawJsonPaste}
                onChange={(e) => {
                  setRawJsonPaste(e.target.value);
                  if (fieldErrors.rawJsonPaste) {
                    setFieldErrors((prev) => ({ ...prev, rawJsonPaste: undefined }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.rawJsonPaste)}
                aria-describedby={
                  fieldErrors.rawJsonPaste
                    ? 'firebase-raw-json-paste-help firebase-raw-json-paste-error'
                    : 'firebase-raw-json-paste-help'
                }
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
            <p id="firebase-raw-json-paste-help" className="text-[11px] text-slate-400">
              Pega el objeto de configuración de Firebase y presiona Cargar para autocompletar los campos.
            </p>
            {fieldErrors.rawJsonPaste && (
              <p id="firebase-raw-json-paste-error" className="text-[11px] text-rose-400" role="alert">
                {fieldErrors.rawJsonPaste}
              </p>
            )}
          </div>

          {/* Status Message (Live Region) */}
          <div role="status" aria-live="polite" aria-atomic="true">
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
          </div>

          {/* Detailed Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firebase-project-id"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                Project ID <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="firebase-project-id"
                ref={projectIdInputRef}
                type="text"
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.projectId)}
                aria-describedby={
                  fieldErrors.projectId
                    ? 'firebase-project-id-help firebase-project-id-error'
                    : 'firebase-project-id-help'
                }
                value={config.projectId}
                onChange={(e) => {
                  setConfig({ ...config, projectId: e.target.value.trim() });
                  if (fieldErrors.projectId) {
                    setFieldErrors((prev) => ({ ...prev, projectId: undefined }));
                  }
                }}
                placeholder="ej: cisco-intcomex-2026"
                className={`w-full px-3 py-2 bg-slate-950 border rounded-lg text-xs font-mono text-slate-200 focus:outline-none ${
                  fieldErrors.projectId
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
              <span id="firebase-project-id-help" className="sr-only">
                Identificador único del proyecto en Google Firebase (obligatorio).
              </span>
              {fieldErrors.projectId && (
                <p id="firebase-project-id-error" className="mt-1 text-[11px] text-rose-400" role="alert">
                  {fieldErrors.projectId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="firebase-api-key"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                API Key <span className="text-rose-400" aria-hidden="true">*</span>
              </label>
              <input
                id="firebase-api-key"
                ref={apiKeyInputRef}
                type="text"
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.apiKey)}
                aria-describedby={
                  fieldErrors.apiKey
                    ? 'firebase-api-key-help firebase-api-key-error'
                    : 'firebase-api-key-help'
                }
                value={config.apiKey}
                onChange={(e) => {
                  setConfig({ ...config, apiKey: e.target.value.trim() });
                  if (fieldErrors.apiKey) {
                    setFieldErrors((prev) => ({ ...prev, apiKey: undefined }));
                  }
                }}
                placeholder="AIzaSy..."
                className={`w-full px-3 py-2 bg-slate-950 border rounded-lg text-xs font-mono text-slate-200 focus:outline-none ${
                  fieldErrors.apiKey
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
              <span id="firebase-api-key-help" className="sr-only">
                Clave pública de API Web de Firebase (obligatorio).
              </span>
              {fieldErrors.apiKey && (
                <p id="firebase-api-key-error" className="mt-1 text-[11px] text-rose-400" role="alert">
                  {fieldErrors.apiKey}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="firebase-auth-domain"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                Auth Domain
              </label>
              <input
                id="firebase-auth-domain"
                type="text"
                aria-describedby="firebase-auth-domain-help"
                value={config.authDomain || ''}
                onChange={(e) => setConfig({ ...config, authDomain: e.target.value.trim() })}
                placeholder="proyecto.firebaseapp.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
              <span id="firebase-auth-domain-help" className="sr-only">
                Dominio de autenticación de Firebase (opcional).
              </span>
            </div>

            <div>
              <label
                htmlFor="firebase-storage-bucket"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                Storage Bucket
              </label>
              <input
                id="firebase-storage-bucket"
                type="text"
                aria-describedby="firebase-storage-bucket-help"
                value={config.storageBucket || ''}
                onChange={(e) => setConfig({ ...config, storageBucket: e.target.value.trim() })}
                placeholder="proyecto.appspot.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
              <span id="firebase-storage-bucket-help" className="sr-only">
                Bucket de almacenamiento de Cloud Storage (opcional).
              </span>
            </div>

            <div>
              <label
                htmlFor="firebase-messaging-sender-id"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                Messaging Sender ID
              </label>
              <input
                id="firebase-messaging-sender-id"
                type="text"
                aria-describedby="firebase-messaging-sender-id-help"
                value={config.messagingSenderId || ''}
                onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value.trim() })}
                placeholder="104829384729"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
              <span id="firebase-messaging-sender-id-help" className="sr-only">
                Identificador de remitente de Cloud Messaging (opcional).
              </span>
            </div>

            <div>
              <label
                htmlFor="firebase-app-id"
                className="text-xs font-semibold text-slate-300 block mb-1"
              >
                App ID
              </label>
              <input
                id="firebase-app-id"
                type="text"
                aria-describedby="firebase-app-id-help"
                value={config.appId || ''}
                onChange={(e) => setConfig({ ...config, appId: e.target.value.trim() })}
                placeholder="1:104829384729:web:a8d9..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
              <span id="firebase-app-id-help" className="sr-only">
                Identificador de aplicación web de Firebase (opcional).
              </span>
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

