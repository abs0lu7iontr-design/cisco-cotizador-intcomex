// ============================================================================
// CISCO AUTOMATED - SHARED SKU RULES MANAGER MODAL (CLOUD & LOCAL)
// Allows viewing, publishing to cloud, syncing, importing and exporting JSON rules
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  DownloadCloud,
  Cloud,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Share2,
  FileCode,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  SharedSkuOverrideRecord,
  publishSharedSkuRules,
  getSharedSkuRules,
  deleteSharedSkuRule,
} from '../cloud';
import { OverrideRuleType, UserSession } from '../../core/types';
import { SkuOverrideAuthorizationModal, normalizeRule } from './SkuOverrideAuthorizationModal';

interface SharedSkuManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession | null;
  skuOverridesMap: Record<string, OverrideRuleType>;
  onApplyOverrides: (overrides: Record<string, OverrideRuleType>) => void;
}

export function SharedSkuManagerModal({
  isOpen,
  onClose,
  currentUser,
  skuOverridesMap,
  onApplyOverrides,
}: SharedSkuManagerModalProps) {
  const [cloudRules, setCloudRules] = useState<SharedSkuOverrideRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Authorization Modal state for imported/synced rules
  const [pendingAuthRules, setPendingAuthRules] = useState<SharedSkuOverrideRecord[]>([]);
  const [authAuthorName, setAuthAuthorName] = useState<string>('');
  const [authSourceType, setAuthSourceType] = useState<'cloud' | 'file'>('cloud');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCloudRules = async () => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await getSharedSkuRules();
      if (res.success && res.data) {
        const normalized = res.data.map((r) => ({
          ...r,
          rule: normalizeRule(r.rule),
        }));
        setCloudRules(normalized);
      }
    } catch (e: any) {
      console.warn('Error fetching cloud rules:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCloudRules();
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Local active rules list
  const localRuleEntries = Object.entries(skuOverridesMap).map(([sku, rule]) => ({
    sku: sku.toUpperCase(),
    rule: normalizeRule(rule),
  }));

  // Handle Publish local rules to Cloud
  const handlePublishToCloud = async () => {
    if (localRuleEntries.length === 0) {
      setStatusMsg({ text: 'No tienes reglas personalizadas para publicar.', type: 'error' });
      return;
    }

    setIsLoading(true);
    const author = {
      username: currentUser?.username || 'pm_cisco',
      fullName: currentUser?.full_name || 'Product Manager',
      role: (currentUser?.role as string) || 'pm',
    };

    const records: SharedSkuOverrideRecord[] = localRuleEntries.map(({ sku, rule }) => ({
      sku,
      rule: normalizeRule(rule),
      previousType: 'Hardware',
      author,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));

    const res = await publishSharedSkuRules(records, author);
    setIsLoading(false);

    if (res.success) {
      setStatusMsg({
        text: `¡${records.length} regla(s) de SKU publicadas en la nube exitosamente bajo tu nombre!`,
        type: 'success',
      });
      fetchCloudRules();
    } else {
      setStatusMsg({
        text: `Error al publicar: ${res.error || 'Fallo de red'}`,
        type: 'error',
      });
    }
  };

  // Handle Cloud Sync (Find rules created by others not yet in local or differing)
  const handleSyncFromCloud = () => {
    if (cloudRules.length === 0) {
      setStatusMsg({ text: 'No hay reglas compartidas en la nube.', type: 'error' });
      return;
    }

    // Filter rules that differ or are new
    const candidateRules = cloudRules.filter((r) => {
      const currentRule = skuOverridesMap[r.sku.toUpperCase()];
      const normalizedRemote = normalizeRule(r.rule);
      return !currentRule || normalizeRule(currentRule) !== normalizedRemote;
    });

    if (candidateRules.length === 0) {
      setStatusMsg({
        text: 'Tu cotizador ya cuenta con todas las reglas de la nube al día.',
        type: 'success',
      });
      return;
    }

    setPendingAuthRules(candidateRules);
    setAuthAuthorName(candidateRules[0]?.author?.fullName || 'Equipo Cisco');
    setAuthSourceType('cloud');
    setIsAuthModalOpen(true);
  };

  // Handle Export Local JSON
  const handleExportJson = () => {
    const payload = {
      app: 'Cisco Automated v2.1',
      type: 'sku_overrides_package',
      author: {
        username: currentUser?.username || 'usuario',
        fullName: currentUser?.full_name || 'Product Manager',
        role: currentUser?.role || 'pm',
      },
      exportedAt: new Date().toISOString(),
      totalRules: localRuleEntries.length,
      rules: localRuleEntries.map(({ sku, rule }) => ({
        sku,
        rule: normalizeRule(rule),
        previousType: 'Hardware',
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    const dateTag = new Date().toISOString().slice(0, 10);
    dlAnchor.setAttribute('download', `cisco_sku_rules_${currentUser?.username || 'local'}_${dateTag}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    setStatusMsg({
      text: 'Archivo JSON de reglas descargado correctamente.',
      type: 'success',
    });
  };

  // Handle Import Local JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        let rulesToImport: SharedSkuOverrideRecord[] = [];
        let author = parsed.author?.fullName || file.name;

        if (Array.isArray(parsed.rules)) {
          rulesToImport = parsed.rules.map((r: any) => ({
            sku: String(r.sku || '').toUpperCase(),
            rule: normalizeRule(r.rule),
            previousType: r.previousType || 'Hardware',
            author: parsed.author || {
              username: 'imported_user',
              fullName: author,
              role: 'pm',
            },
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }));
        } else if (typeof parsed === 'object') {
          // Direct key-value map fallback
          rulesToImport = Object.entries(parsed).map(([sku, rule]) => ({
            sku: sku.toUpperCase(),
            rule: normalizeRule(rule),
            previousType: 'Hardware',
            author: { username: 'local_file', fullName: file.name, role: 'pm' },
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }));
        }

        if (rulesToImport.length > 0) {
          setPendingAuthRules(rulesToImport);
          setAuthAuthorName(author);
          setAuthSourceType('file');
          setIsAuthModalOpen(true);
        } else {
          setStatusMsg({ text: 'El archivo no contiene reglas de SKU válidas.', type: 'error' });
        }
      } catch (err: any) {
        setStatusMsg({ text: 'Error al leer el archivo JSON: ' + err.message, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // On Accept in Authorization Modal
  const handleAcceptAuthorization = (
    acceptedList: SharedSkuOverrideRecord[],
    persistPermanently: boolean
  ) => {
    const nextOverrides = { ...skuOverridesMap };
    acceptedList.forEach((r) => {
      nextOverrides[r.sku.toUpperCase()] = normalizeRule(r.rule);
    });

    onApplyOverrides(nextOverrides);

    if (persistPermanently) {
      try {
        localStorage.setItem('cisco_sku_overrides_v2', JSON.stringify(nextOverrides));
      } catch (_) {}
    }

    setStatusMsg({
      text: `¡${acceptedList.length} regla(s) autorizadas e implementadas con éxito en tu cotizador!`,
      type: 'success',
    });
  };

  const getBadge = (rule: any) => {
    const norm = normalizeRule(rule);
    switch (norm) {
      case 'intangible':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-500/50">
            INTANGIBLE
          </span>
        );
      case 'arancel':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-500/50">
            ARANCEL
          </span>
        );
      case 'equipo':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-500/50">
            HARDWARE
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-3xl bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/50 flex flex-col max-h-[90vh] overflow-hidden text-slate-100 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  Gestión de Reglas de SKU Compartidas
                </h2>
                <p className="text-xs text-slate-400">
                  Sincronización Cloud (Firestore) & Transferencia Local con Autorización Previa
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePublishToCloud}
                disabled={isLoading || localRuleEntries.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer"
                title="Publicar mis reclasificaciones para que mis colegas puedan autorizarlas"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Publicar a la Nube ({localRuleEntries.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSyncFromCloud}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer"
                title="Buscar y autorizar nuevas reglas publicadas por otros PMs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sincronizar de la Nube</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Cargar archivo .json exportado por otro usuario"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Importar JSON</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={localRuleEntries.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Guardar archivo .json para transferir de forma offline"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar JSON</span>
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`px-6 py-2.5 text-xs font-medium border-b flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Content: Tables Grid */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm">
            {/* Section 1: Mis Reglas Activas Locales */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Mis Reclasificaciones Activas ({localRuleEntries.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Modificadas manualmente con clic derecho en la cotización
                </span>
              </div>

              {localRuleEntries.length === 0 ? (
                <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                  No has reclasificado ningún SKU manualmente todavía.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 font-sans font-bold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Código SKU</th>
                        <th className="py-2 px-3">Regla Aplicada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {localRuleEntries.map(({ sku, rule }) => (
                        <tr key={sku} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-bold text-slate-200">{sku}</td>
                          <td className="py-2 px-3">{getBadge(rule)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 2: Reglas Publicadas en la Nube */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" /> Reglas Compartidas en la Nube ({cloudRules.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Publicadas por el equipo (disponibles para autorizar)
                </span>
              </div>

              {cloudRules.length === 0 ? (
                <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                  No hay reglas en la nube todavía. Pulsa &quot;Publicar a la Nube&quot; para compartir tus reclasificaciones.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 font-sans font-bold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Regla</th>
                        <th className="py-2 px-3">Autor</th>
                        <th className="py-2 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {cloudRules.map((r) => (
                        <tr key={r.sku} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-bold text-slate-200">{r.sku}</td>
                          <td className="py-2 px-3">{getBadge(r.rule)}</td>
                          <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">
                            {r.author?.fullName || r.author?.username || 'PM'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteSharedSkuRule(r.sku);
                                fetchCloudRules();
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              title="Eliminar de la nube"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            <div className="text-[11px] text-slate-500">
              Las modificaciones de SKU traspasan configuraciones entre usuarios previa autorización explícita.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Prior Authorization Dialog */}
      <SkuOverrideAuthorizationModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        proposedOverrides={pendingAuthRules}
        authorName={authAuthorName}
        sourceType={authSourceType}
        onAccept={handleAcceptAuthorization}
      />
    </>
  );
}
