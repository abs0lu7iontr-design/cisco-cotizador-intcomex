// ============================================================================
// CISCO AUTOMATED - FEDEX TRACK API CONFIGURATION & LIVE SYNC MODAL
// Permite conectar FedEx Track API v1 (OAuth2 Client Credentials) mediante
// Cloudflare Secrets (`FEDEX_API_KEY` / `FEDEX_SECRET_KEY`) o credenciales de sesión.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import {
  FedExEnvironment,
  loadFedExConfig,
  saveFedExConfig,
  testFedExConnection,
  checkFedExEdgeStatus,
} from './fedexTrackingService';
import { useAccessibleModal } from '../../utils/useAccessibleModal';

interface FedExApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFedExOrdersCount: number;
  onSyncNow?: () => Promise<void>;
}

export const FedExApiConfigModal: React.FC<FedExApiConfigModalProps> = ({
  isOpen,
  onClose,
  activeFedExOrdersCount,
  onSyncNow,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [environment, setEnvironment] = useState<FedExEnvironment>('PROD');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [hasServerSecrets, setHasServerSecrets] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const { dialogProps, titleId, descriptionId } = useAccessibleModal<HTMLDivElement>({
    isOpen,
    onClose,
    titleId: 'fedex-api-modal-title',
    descriptionId: 'fedex-api-modal-desc',
    initialFocusRef: apiKeyInputRef,
  });

  useEffect(() => {
    if (!isOpen) return;
    const cfg = loadFedExConfig();
    setApiKey(cfg.apiKey);
    setSecretKey(cfg.secretKey);
    setEnvironment(cfg.environment);
    setAutoSyncEnabled(cfg.autoSyncEnabled);
    setStatusBanner(null);

    checkFedExEdgeStatus().then((st) => {
      setHasServerSecrets(Boolean(st.hasServerSecrets));
      if (st.configured && st.hasServerSecrets) {
        setStatusBanner({
          ok: true,
          text: `Secretos FEDEX_API_KEY / FEDEX_SECRET_KEY activos en el servidor Edge (${st.environment || 'PROD'}).`,
        });
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    saveFedExConfig({
      apiKey: apiKey.trim(),
      secretKey: secretKey.trim(),
      environment,
      autoSyncEnabled,
    });

    setIsTesting(true);
    setStatusBanner(null);
    try {
      const testRes = await testFedExConnection({
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        environment,
      });
      setStatusBanner({ ok: testRes.success, text: testRes.message });
      if (testRes.success && onSyncNow) {
        await onSyncNow();
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        {...dialogProps}
        aria-describedby={descriptionId}
        className="bg-slate-900 border border-purple-500/40 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 focus:outline-none"
      >
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/15 border border-purple-500/40 rounded-2xl text-purple-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-sm font-black text-white">
                Sincronización Automática FedEx Track API v1
              </h3>
              <p id={descriptionId} className="text-[11px] text-slate-400">
                Conecta directamente con FedEx sin entrar a fedex.com ({activeFedExOrdersCount} guías activas)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración FedEx"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/25 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                ¿Cómo activar la conexión oficial con FedEx?
              </span>
              <a
                href="https://developer.fedex.com"
                target="_blank"
                rel="noreferrer"
                className="text-purple-300 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                FedEx Developer Portal <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. Crea un proyecto gratuito en <strong className="text-white">developer.fedex.com</strong> y habilita{' '}
              <strong className="text-purple-200">Track API</strong>.<br />
              2. Copia tu <code className="text-purple-300">API Key (Client ID)</code> y{' '}
              <code className="text-purple-300">Secret Key</code> abajo (se guardan en tu sesión), o pídele al administrador fijarlos en Cloudflare Secrets como{' '}
              <code className="text-emerald-300">FEDEX_API_KEY</code> y{' '}
              <code className="text-emerald-300">FEDEX_SECRET_KEY</code> para todo el equipo.
            </p>
          </div>

          {statusBanner && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                statusBanner.ok
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                  : 'bg-amber-950/50 border-amber-500/50 text-amber-200'
              }`}
            >
              {statusBanner.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>{statusBanner.text}</span>
            </div>
          )}

          {!hasServerSecrets && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  FedEx API Key (Client ID)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={apiKeyInputRef}
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="l7xx..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  FedEx Secret Key (Client Secret)
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Ambiente FedEx
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as FedExEnvironment)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="PROD">Producción (apis.fedex.com)</option>
                <option value="SANDBOX">Sandbox (Pruebas FedEx)</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 w-full cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-[11px] font-semibold text-slate-200">
                  Auto-actualizar cada 15 min al abrir Tracking BO
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Conectando...' : 'Probar Conexión & Sincronizar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
