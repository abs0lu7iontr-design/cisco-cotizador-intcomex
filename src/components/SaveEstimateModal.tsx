import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  Cloud,
  Lock,
  Unlock,
  HardDrive,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Users2,
  Sparkles,
} from 'lucide-react';
import { useCiscoAutomatedStore } from '../core/store';
import { getLocalEstimatesCache } from '../modules/cloud/firestoreService';

interface SaveEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  defaultPartner?: string;
  defaultClient?: string;
  defaultModel?: string;
}

export type EstimatePrivacyChoice = 'cloud_public' | 'cloud_restricted' | 'local_only';

export const SaveEstimateModal: React.FC<SaveEstimateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPartner,
  defaultClient,
  defaultModel,
}) => {
  const {
    processedResult,
    detectedPartner,
    currentFileName,
    saveCurrentEstimateToCloud,
    estimateVersionNumber,
  } = useCiscoAutomatedStore();

  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  const [privacyChoice, setPrivacyChoice] = useState<EstimatePrivacyChoice>('cloud_public');
  const [partnerName, setPartnerName] = useState('');
  const [clientName, setClientName] = useState('');
  const [modelName, setModelName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const estimateId = processedResult?.headerInfo?.estimateId || 'NA';
  const dealId = processedResult?.headerInfo?.dealId || 'NA';

  // Detect existing estimate and calculate next version preview
  const { existingRecord, detectedNextVersion } = useMemo(() => {
    if (!estimateId || estimateId === 'NA') {
      return { existingRecord: null, detectedNextVersion: 1 };
    }
    const localCache = getLocalEstimatesCache();
    const found = localCache.find(
      (e) => e.estimateId && e.estimateId !== 'NA' && e.estimateId.trim() === estimateId.trim()
    );
    if (!found) {
      return { existingRecord: null, detectedNextVersion: 1 };
    }
    const existingVersions = (found.versionsSummary || []).map((v) => v.versionNumber);
    const maxVer = Math.max(found.activeVersion ?? 1, ...existingVersions, 1);
    return { existingRecord: found, detectedNextVersion: maxVer + 1 };
  }, [estimateId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setPartnerName(
        defaultPartner ||
          processedResult?.headerInfo?.companyName ||
          detectedPartner ||
          'Intcomex Chile'
      );
      setClientName(
        defaultClient ||
          processedResult?.headerInfo?.customerName ||
          'Cliente Final'
      );
      setModelName(defaultModel || 'Cisco');
      setVersionNote('');
      setErrorMessage(null);
      // If system is offline, default to local_only
      if (isOffline) {
        setPrivacyChoice('local_only');
      }
    }
  }, [isOpen, defaultPartner, defaultClient, defaultModel, processedResult, detectedPartner, isOffline]);

  if (!isOpen || !processedResult) return null;

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const isRestricted = privacyChoice === 'cloud_restricted';
      const isLocalOnly = privacyChoice === 'local_only';

      const res = await saveCurrentEstimateToCloud({
        partnerName: partnerName.trim() || 'Intcomex Chile',
        clientFinalName: clientName.trim() || 'Cliente Final',
        modelName: modelName.trim() || 'Cisco',
        originalFileName: currentFileName || `${estimateId}.xlsx`,
        isRestricted,
        isLocalOnly,
        storageScope: isLocalOnly ? 'local_only' : 'cloud',
        privacyLevel: isLocalOnly ? 'local_only' : isRestricted ? 'restricted' : 'public',
        note: versionNote.trim() || undefined,
        autoIncrementIfExisting: true,
      });

      if (res.success) {
        const targetVersion = res.versionTag || `v${detectedNextVersion}`;
        const msg = isLocalOnly
          ? `💻 Cotización guardada de forma privada solo en este PC (${targetVersion}).`
          : isRestricted
          ? `🔒 Cotización guardada en la Nube (${targetVersion}) con datos sensibles restringidos.`
          : `☁️ Cotización compartida en la Nube (${targetVersion}) para todo el equipo.`;

        onSuccess?.(msg);
        onClose();
      } else {
        setErrorMessage(res.error || 'Error al guardar la cotización');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al procesar guardado');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Guardar Cotización & Privacidad</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                  {estimateId !== 'NA' ? `ID: ${estimateId}` : 'Sin ID CCW'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Elige el nivel de privacidad, destino de almacenamiento y versión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Version Awareness Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>Versión a generar:</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono font-black text-xs">
                    v{detectedNextVersion}
                  </span>
                  {existingRecord && (
                    <span className="text-[10px] text-amber-300 font-normal">
                      (Incrementada desde v{existingRecord.activeVersion ?? 1})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {existingRecord
                    ? 'Se detectó una versión anterior. Cada guardado crea una versión histórica (v1, v2, v3...) sin sobreescribir el historial.'
                    : 'Primera versión de esta cotización (v1). Se creará su ID único en el sistema.'}
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Destination Selection */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300">
              Selecciona Destino y Nivel de Privacidad:
            </label>

            {/* Option 1: Cloud Public */}
            <div
              onClick={() => setPrivacyChoice('cloud_public')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3.5 ${
                privacyChoice === 'cloud_public'
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/20'
                  : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  privacyChoice === 'cloud_public'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Unlock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-xs flex items-center gap-2">
                    <span>Nube Compartida (Pública para el Equipo)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Recomendado
                    </span>
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      privacyChoice === 'cloud_public'
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-slate-600'
                    }`}
                  >
                    {privacyChoice === 'cloud_public' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Visible para todos los PMs y preventas en el Historial Cloud. Podrán cargarla,
                  ver márgenes y reutilizarla para evitar cotizar doble trabajo.
                </p>
              </div>
            </div>

            {/* Option 2: Cloud Restricted */}
            <div
              onClick={() => setPrivacyChoice('cloud_restricted')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3.5 ${
                privacyChoice === 'cloud_restricted'
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/20'
                  : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  privacyChoice === 'cloud_restricted'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-xs flex items-center gap-2">
                    <span>Nube Compartida (Restringida / Con Permiso)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Datos Protegidos
                    </span>
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      privacyChoice === 'cloud_restricted'
                        ? 'border-amber-400 bg-amber-400'
                        : 'border-slate-600'
                    }`}
                  >
                    {privacyChoice === 'cloud_restricted' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Se sube a la nube para trazabilidad, pero <strong>oculta margen, internación y precios</strong>.
                  Otros usuarios verán que existe el Estimate pero requerirán presionar &quot;Solicitar Permiso&quot;
                  y te llegará una notificación para autorizarlos.
                </p>
              </div>
            </div>

            {/* Option 3: Local Only */}
            <div
              onClick={() => setPrivacyChoice('local_only')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3.5 ${
                privacyChoice === 'local_only'
                  ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/20'
                  : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  privacyChoice === 'local_only'
                    ? 'bg-purple-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-xs flex items-center gap-2">
                    <span>Solo en este PC (Privado Local - No Compartir)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      100% Confidencial
                    </span>
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      privacyChoice === 'local_only'
                        ? 'border-purple-400 bg-purple-400'
                        : 'border-slate-600'
                    }`}
                  >
                    {privacyChoice === 'local_only' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Queda guardado exclusivamente en el almacenamiento interno de este computador.
                  <strong> NO se sube a Firestore</strong>. Aparecerá en tu historial con la etiqueta
                  &quot;Solo en este PC&quot; y podrás subirlo a la nube más adelante con 1 clic si lo deseas.
                </p>
              </div>
            </div>
          </div>

          {/* Details Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-400" />
                Canal / Partner
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="ej. Intcomex Chile"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users2 className="w-3 h-3 text-emerald-400" />
                Cliente Final
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ej. Cliente Final"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>

          {/* Optional Version Note */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Nota o Comentario de Versión (Opcional):
            </label>
            <input
              type="text"
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="ej. Ajuste de márgenes a solicitud de cliente, descuento adicional FT..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirmSave}
            disabled={isSaving}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-xl transition-all cursor-pointer disabled:opacity-50 ${
              privacyChoice === 'local_only'
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                : privacyChoice === 'cloud_restricted'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Guardando versión...</span>
              </>
            ) : (
              <>
                {privacyChoice === 'local_only' ? (
                  <HardDrive className="w-4 h-4" />
                ) : privacyChoice === 'cloud_restricted' ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                <span>
                  {privacyChoice === 'local_only'
                    ? `Guardar Solo en este PC (v${detectedNextVersion})`
                    : privacyChoice === 'cloud_restricted'
                    ? `Guardar Restringido en Nube (v${detectedNextVersion})`
                    : `Guardar y Compartir en Nube (v${detectedNextVersion})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
