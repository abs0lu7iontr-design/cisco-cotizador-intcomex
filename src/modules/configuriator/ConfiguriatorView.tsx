// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR VIEW (AI BOM GENERATOR FOR CISCO CCW)
// Interfaz interactiva multimodal (Texto + Ctrl+V Imágenes), gestor de rotación
// multi-API (Gemini, OpenRouter Free, Groq Free, DeepSeek), cruce con Fast Track,
// validación EOL 2026 en cisco.com y exportación oficial UploadExcelTemplate.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Download,
  Image as ImageIcon,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Layers,
  Zap,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  Sliders,
  Info,
  X,
  Globe,
  Cpu,
} from 'lucide-react';
import {
  extractBOMRequirementsFromInput,
  ExtractedRequirementResult,
  ExtractedRequirementItem,
} from './aiBomExtractor';
import {
  buildAssembledCcwRows,
  generateCcwUploadWorkbook,
  CcwAssembledRow,
} from './ccwExcelGenerator';
import {
  AiConfigSettings,
  AiProviderId,
  PROVIDER_META,
  loadAiSettings,
  saveAiSettings,
  addApiKeyToPool,
  syncAiSettingsFromDesktopBridge,
} from './aiProviderManager';
import { getLearnedCiscoSkus, EOL_CATALOG_2026 } from './catalogRules';

export const ConfiguriatorView: React.FC = () => {
  // Entrada de texto e imagen (Ctrl+V o Drag & Drop)
  const [inputText, setInputText] = useState<string>('');
  const [clientName, setClientName] = useState<string>('Cliente');
  const [pastedImage, setPastedImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);

  // Estado de procesamiento y resultados
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractedRequirementResult | null>(null);
  const [assembledRows, setAssembledRows] = useState<CcwAssembledRow[]>([]);
  const [merakiLicenseMode, setMerakiLicenseMode] = useState<'subscription' | 'coterm'>('subscription');

  // Configuración Multi-API y Rotación de Tokens
  const [aiSettings, setAiSettings] = useState<AiConfigSettings>(() => loadAiSettings());
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [newProvider, setNewProvider] = useState<Exclude<AiProviderId, 'local_deterministic'>>('gemini');
  const [newKeyLabel, setNewKeyLabel] = useState<string>('');
  const [newKeyValue, setNewKeyValue] = useState<string>('');
  const [newKeyModel, setNewKeyModel] = useState<string>('gemini-2.5-flash');

  // Agregar SKU manual rápido
  const [manualSkuInput, setManualSkuInput] = useState<string>('');
  const [manualQtyInput, setManualQtyInput] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sincronizar configuración de IA con el puente Desktop (.exe) al montar
  useEffect(() => {
    syncAiSettingsFromDesktopBridge().then((synced) => {
      setAiSettings(synced);
    });
  }, []);

  // Recalcular filas ensambladas cuando cambian los ítems extraídos o el modo Meraki
  const refreshAssembledRows = useCallback(
    async (currentReq: ExtractedRequirementResult | null, mode: 'subscription' | 'coterm') => {
      if (!currentReq || !currentReq.items.length) {
        setAssembledRows([]);
        return;
      }
      const rows = await buildAssembledCcwRows(currentReq, mode);
      setAssembledRows(rows);
    },
    []
  );

  useEffect(() => {
    refreshAssembledRows(extractionResult, merakiLicenseMode);
  }, [extractionResult, merakiLicenseMode, refreshAssembledRows]);

  // Manejo de pegado de capturas de pantalla con Ctrl + V
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          setPastedImage({
            base64,
            mimeType: file.type || 'image/png',
            previewUrl: dataUrl,
          });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleImageFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      setPastedImage({
        base64,
        mimeType: file.type || 'image/png',
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  // Ejecutar extracción y armado BOM
  const handleGenerateConfig = async () => {
    if (!inputText.trim() && !pastedImage) {
      setErrorMsg('Escribe una solicitud comercial o pega una captura de pantalla (Ctrl + V) para generar el BOM.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const result = await extractBOMRequirementsFromInput({
        text: inputText,
        imageBase64: pastedImage?.base64,
        mimeType: pastedImage?.mimeType,
      });

      if (result.clientName && result.clientName !== 'Cliente' && clientName === 'Cliente') {
        setClientName(result.clientName);
      } else {
        result.clientName = clientName;
      }

      setExtractionResult(result);
      setAiSettings(loadAiSettings());
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la solicitud.');
      setAiSettings(loadAiSettings());
    } finally {
      setIsGenerating(false);
    }
  };

  // Modificar parámetros de un equipo padre en vivo (Cantidad, Tier, Plazo, Stacking, PSU Redundante, Mantener EOL)
  const updateParentItem = (index: number, patch: Partial<ExtractedRequirementItem>) => {
    if (!extractionResult) return;
    const nextItems = extractionResult.items.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, ...patch };
      // Si cambió el tier en un C9200/C9300, sincronizar el sufijo -E / -A del SKU sugerido
      if (patch.licenseTier && updated.suggestedActiveSku) {
        if (/^(C9200L?|C9300L?)-.*-(E|A)$/i.test(updated.suggestedActiveSku)) {
          updated.suggestedActiveSku = updated.suggestedActiveSku.replace(
            /-(E|A)$/i,
            `-${patch.licenseTier === 'Advantage' ? 'A' : 'E'}`
          );
        }
      }
      return updated;
    });
    setExtractionResult({
      ...extractionResult,
      items: nextItems,
    });
  };

  const removeParentItem = (index: number) => {
    if (!extractionResult) return;
    const nextItems = extractionResult.items.filter((_, idx) => idx !== index);
    setExtractionResult({
      ...extractionResult,
      items: nextItems,
    });
  };

  const handleAddManualItem = () => {
    const cleanSku = manualSkuInput.trim().toUpperCase();
    if (!cleanSku) return;

    const eolEntry = EOL_CATALOG_2026[cleanSku];
    const newItem: ExtractedRequirementItem = {
      id: `manual-${Date.now()}`,
      rawMentionedSku: cleanSku,
      suggestedActiveSku: eolEntry ? eolEntry.replacementSku : cleanSku,
      isEol2026: eolEntry ? eolEntry.status === 'eos_eol_active' : false,
      eolReason: eolEntry?.eolNote,
      officialCiscoUrl: eolEntry?.officialCiscoDocUrl,
      deviceType: cleanSku.startsWith('MR') || cleanSku.startsWith('CW')
        ? 'access_point'
        : cleanSku.startsWith('C8') || cleanSku.startsWith('ISR')
          ? 'router'
          : 'switch',
      licenseTier: 'Essentials',
      termYears: 3,
      quantity: manualQtyInput > 0 ? manualQtyInput : 1,
      notes: `Agregado manualmente (${cleanSku})`,
    };

    setExtractionResult((prev) => ({
      clientName: prev?.clientName || clientName,
      items: [...(prev?.items || []), newItem],
      providerUsed: prev?.providerUsed || 'Edición Manual + Reglas Ingeniería Cisco',
    }));
    setManualSkuInput('');
    setManualQtyInput(1);
  };

  // Descargar archivo Excel oficial para CCW (Web + Desktop App .exe)
  const handleDownloadCcwExcel = async () => {
    if (!extractionResult || assembledRows.length === 0) return;

    try {
      const updatedReq: ExtractedRequirementResult = {
        ...extractionResult,
        clientName: clientName || extractionResult.clientName || 'Cliente',
      };
      const { buffer, filename } = await generateCcwUploadWorkbook(updatedReq, assembledRows);

      const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
      if (pyApi && typeof pyApi.download_excel_file === 'function') {
        const byteArray = Array.from(new Uint8Array(buffer));
        await pyApi.download_excel_file(filename, byteArray);
        return;
      }

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(`Error generando Excel CCW: ${err?.message || err}`);
    }
  };

  // Gestión del Pool de API Keys
  const handleAddKey = () => {
    if (!newKeyValue.trim()) return;
    const updated = addApiKeyToPool({
      provider: newProvider,
      label: newKeyLabel,
      apiKey: newKeyValue,
      model: newKeyModel,
    });
    setAiSettings(updated);
    setNewKeyValue('');
    setNewKeyLabel('');
  };

  const handleToggleKey = (keyId: string) => {
    const updated: AiConfigSettings = {
      ...aiSettings,
      keys: aiSettings.keys.map((k) => (k.id === keyId ? { ...k, enabled: !k.enabled } : k)),
    };
    saveAiSettings(updated);
    setAiSettings(updated);
  };

  const handleDeleteKey = (keyId: string) => {
    const updated: AiConfigSettings = {
      ...aiSettings,
      keys: aiSettings.keys.filter((k) => k.id !== keyId),
    };
    saveAiSettings(updated);
    setAiSettings(updated);
  };

  const handleToggleWebGrounding = () => {
    const updated: AiConfigSettings = {
      ...aiSettings,
      useCiscoOfficialGrounding: !aiSettings.useCiscoOfficialGrounding,
    };
    saveAiSettings(updated);
    setAiSettings(updated);
  };

  const activeKeysCount = aiSettings.keys.filter((k) => k.enabled && k.apiKey.trim()).length;
  const learnedSkusCount = Object.keys(getLearnedCiscoSkus()).length + Object.keys(EOL_CATALOG_2026).length;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6" onPaste={handlePaste}>
      {/* Banner Oficial de Instrucción Cisco CCW */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border border-emerald-500/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0 mt-0.5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Regla Crítica de Ensamblado Cisco CCW
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                Estado VALID (Verde)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
              Recuerda que en la ventana <strong>'BOM Upload'</strong> de Cisco CCW debes mantener marcada la opción:{' '}
              <span className="px-2 py-0.5 rounded bg-emerald-900/80 border border-emerald-400/50 text-emerald-200 font-mono font-bold">
                ☑ Import Lines as assembled configurations
              </span>{' '}
              para que los equipos queden ensamblados en estado <strong>VALID (Verde)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsApiModalOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>APIs & Rotación ({activeKeysCount} activas)</span>
          </button>
        </div>
      </div>

      {/* Encabezado Principal del Módulo */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                ConfigurIAtor &bull; AI BOM Generator para Cisco CCW
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                UploadExcelTemplate 10-Col
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950/80 text-cyan-300 border border-cyan-700/40 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Cisco.com EOL 2026 + Base Dinámica ({learnedSkusCount} SKUs)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Convierte correos en lenguaje natural o capturas de pantalla (Ctrl + V) en configuraciones ensambladas Catalyst / Meraki / ISR listas para importar en Cisco CCW.
            </p>
          </div>
        </div>

        {/* Estado rápido de motores */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Failover:{' '}
              <strong className="text-emerald-300">
                {activeKeysCount > 0 ? `${activeKeysCount} API(s) + Motor Local` : 'Motor Local Determinista Activo'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Grilla Principal: Panel de Entrada (Izquierda) + Vista Previa Ensamblada CCW (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Entrada Multimodal */}
        <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>1. Solicitud del Cliente (Texto o Captura Ctrl+V)</span>
            </h3>

            {/* Ejemplos rápidos */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Mauricio, cotízame 2 switches de 24 bocas PoE Catalyst con licencia por 3 años'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-indigo-300 border border-slate-700 cursor-pointer transition-colors"
                title="Cargar caso de prueba oficial"
              >
                Ejemplo 24P PoE
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Necesito renovar 3 switches WS-C2960X-24PS-L, 1 switch WS-C3850-48P-S con licencia Advantage por 5 años y 4 APs MR42 con licencia a 3 años.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 border border-slate-700 cursor-pointer transition-colors"
                title="Cargar caso de migración EOL 2026"
              >
                Ejemplo Migración EOL
              </button>
            </div>
          </div>

          {/* Nombre del cliente para el archivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Cliente / Proyecto (Nombre de archivo)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Minera_Escondida"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Esquema Licencias Meraki
              </label>
              <select
                value={merakiLicenseMode}
                onChange={(e) => setMerakiLicenseMode(e.target.value as 'subscription' | 'coterm')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="subscription">Suscripción CCW (LIC-MR-E + Duration)</option>
                <option value="coterm">Co-Termination Clásico (LIC-ENT-3YR)</option>
              </select>
            </div>
          </div>

          {/* Textarea de correo / requerimiento */}
          <div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pega aquí el correo del partner/cliente (ej: 'Mauricio, cotízame 2 switches de 24 bocas PoE Catalyst con licencia por 3 años y 3 APs Wi-Fi 6') o presiona Ctrl + V para pegar un pantallazo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
            />
          </div>

          {/* Zona de Captura de Pantalla (Ctrl+V o Drag & Drop) */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className="border border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 rounded-xl p-3.5 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageFileSelect(e.target.files[0]);
                }
              }}
            />

            {pastedImage ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={pastedImage.previewUrl}
                    alt="Captura pegada"
                    className="w-16 h-16 object-cover rounded-lg border border-indigo-500/40 shrink-0"
                  />
                  <div className="text-xs overflow-hidden">
                    <span className="font-bold text-emerald-300 block">
                      Captura adjunta lista para análisis multimodal
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {pastedImage.mimeType} &bull; Puedes combinarla con instrucciones de texto arriba
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPastedImage(null)}
                  className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/40 cursor-pointer shrink-0"
                  title="Quitar imagen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-between cursor-pointer text-xs text-slate-400 hover:text-slate-200"
              >
                <div className="flex items-center space-x-2.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Pega un pantallazo con <strong className="text-indigo-300">Ctrl + V</strong> o haz clic para subir imagen
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  PNG / JPG
                </span>
              </div>
            )}
          </div>

          {/* Botón Principal Generar Configuración */}
          <button
            type="button"
            onClick={handleGenerateConfig}
            disabled={isGenerating}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analizando Preventa y Ensamblando BOM para CCW...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generar Configuración CCW</span>
              </>
            )}
          </button>

          {/* Agregar SKU Manualmente */}
          <div className="pt-3 border-t border-slate-800">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Agregar SKU Directo o EOL al Ensamblador
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualSkuInput}
                onChange={(e) => setManualSkuInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManualItem();
                }}
                placeholder="Ej. C9200L-48P-4X-E o WS-C2960X-24TS-L"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                min={1}
                value={manualQtyInput}
                onChange={(e) => setManualQtyInput(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddManualItem}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* Mensajes de Error o Log de Rotación de APIs */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/50 text-rose-200 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {extractionResult?.rotatedKeysLog && extractionResult.rotatedKeysLog.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-600/40 text-amber-200 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rotación Automática de Tokens Ejecutada:</span>
              </div>
              {extractionResult.rotatedKeysLog.map((log, i) => (
                <div key={i} className="font-mono text-[10px] text-amber-200/90">
                  • {log}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: Equipos Detectados, Controles de Preventa y Tabla 10 Columnas CCW */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tarjeta de Equipos Principales e Ingeniería Preventa */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>2. Equipos Padre y Reglas de Ingeniería ({extractionResult?.items.length || 0} bloques)</span>
                </h3>
                {extractionResult?.providerUsed && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Procesado por: <strong className="text-indigo-300">{extractionResult.providerUsed}</strong>
                    {extractionResult.keyLabelUsed ? ` (${extractionResult.keyLabelUsed})` : ''}
                  </p>
                )}
              </div>

              {assembledRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadCcwExcel}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel CCW ({assembledRows.length} líneas)</span>
                </button>
              )}
            </div>

            {!extractionResult || extractionResult.items.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">
                  Aún no hay equipos generados en la mesa de ensamblaje.
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Escribe la solicitud del cliente a la izquierda o usa uno de los botones de ejemplo para generar las líneas padre e hijas de Cisco CCW.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {extractionResult.items.map((item, idx) => {
                  const parentRow = assembledRows.find((r) => r.parentIndex === idx && r.isParent);
                  const childRows = assembledRows.filter((r) => r.parentIndex === idx && !r.isParent);
                  const hasEolAlternative = Boolean(
                    item.rawMentionedSku &&
                      item.suggestedActiveSku &&
                      item.rawMentionedSku.toUpperCase() !== item.suggestedActiveSku.toUpperCase()
                  );

                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 space-y-3 transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold uppercase">
                              Chasis #{idx + 1}
                            </span>
                            <span className="font-mono text-sm font-black text-white">
                              {parentRow?.partNumber || item.suggestedActiveSku}
                            </span>

                            {/* Badge EOL vs Vigente 2026 */}
                            {parentRow?.wasReplacedFromEol ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                                <span>Reemplazo EOL 2026 (de {item.rawMentionedSku})</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                                Vigente 2026
                              </span>
                            )}

                            {/* Badge Fast Track si el SKU está en Fast Track DB */}
                            {parentRow?.fastTrackInfo && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-500/50 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-cyan-400" />
                                <span>
                                  FAST TRACK ({parentRow.fastTrackInfo.distributorDiscount}% Dcto Disti)
                                </span>
                              </span>
                            )}

                            {/* Link Oficial Cisco.com */}
                            {parentRow?.officialCiscoUrl && (
                              <a
                                href={parentRow.officialCiscoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                              >
                                <span>Ficha Oficial Cisco.com</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {parentRow?.eolReason && (
                            <p className="text-[11px] text-amber-300/90">
                              ↳ {parentRow.eolReason}
                            </p>
                          )}
                        </div>

                        {/* Botón alternar SKU original vs Reemplazo EOL y botón eliminar */}
                        <div className="flex items-center gap-2">
                          {hasEolAlternative && (
                            <button
                              type="button"
                              onClick={() =>
                                updateParentItem(idx, { keepOriginalSku: !item.keepOriginalSku })
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-amber-300 border border-amber-600/40 cursor-pointer"
                              title="Alternar entre el reemplazo 2026 y el SKU mencionado originalmente"
                            >
                              {item.keepOriginalSku
                                ? `Usar Reemplazo 2026 (${item.suggestedActiveSku})`
                                : `Mantener Original (${item.rawMentionedSku})`}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => removeParentItem(idx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Eliminar este bloque"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Controles rápidos de configuración de preventa */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-900 text-xs">
                        {/* Cantidad */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Cant:</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateParentItem(idx, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                          />
                        </div>

                        {/* Nivel Licencia */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Licencia:</span>
                          <select
                            value={item.licenseTier || 'Essentials'}
                            onChange={(e) =>
                              updateParentItem(idx, {
                                licenseTier: e.target.value as 'Essentials' | 'Advantage',
                              })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          >
                            <option value="Essentials">DNA / Meraki Essentials</option>
                            <option value="Advantage">DNA / Meraki Advantage</option>
                          </select>
                        </div>

                        {/* Plazo Años */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Plazo:</span>
                          <select
                            value={item.termYears || 3}
                            onChange={(e) =>
                              updateParentItem(idx, { termYears: Number(e.target.value) || 3 })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          >
                            <option value={1}>1 Año (12 Meses)</option>
                            <option value={3}>3 Años (36 Meses)</option>
                            <option value={5}>5 Años (60 Meses)</option>
                            <option value={7}>7 Años (84 Meses)</option>
                          </select>
                        </div>

                        {/* Checkboxes opcionales para Switches Catalyst */}
                        {item.deviceType === 'switch' && (
                          <>
                            <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.includeStacking)}
                                onChange={(e) =>
                                  updateParentItem(idx, { includeStacking: e.target.checked })
                                }
                                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <span>+ Kit Stacking</span>
                            </label>

                            <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.includeRedundantPsu)}
                                onChange={(e) =>
                                  updateParentItem(idx, { includeRedundantPsu: e.target.checked })
                                }
                                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <span>+ 2da Fuente Redundante</span>
                            </label>
                          </>
                        )}
                      </div>

                      {/* Sub-líneas hijas ensambladas */}
                      {childRows.length > 0 && (
                        <div className="pl-3 border-l-2 border-indigo-500/40 space-y-1 pt-1">
                          {childRows.map((sub) => (
                            <div
                              key={sub.rowId}
                              className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/60 px-2.5 py-1 rounded-lg"
                            >
                              <div className="flex items-center space-x-2">
                                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span className="font-mono font-bold text-indigo-200">
                                  {sub.partNumber}
                                </span>
                                <span className="text-slate-400 truncate max-w-[280px]">
                                  {sub.notes}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 font-mono text-[11px] shrink-0">
                                <span className="text-emerald-300">Qty: {sub.quantity}</span>
                                {sub.durationMonths && (
                                  <span className="text-cyan-300">{sub.durationMonths}M ({sub.billingModel})</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vista Previa Exacta de las 10 Columnas de UploadExcelTemplate (Sheet1) */}
          {assembledRows.length > 0 && (
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>
                    3. Vista Previa Hoja "Sheet1" &bull; Formato Oficial UploadExcelTemplate (10 Columnas)
                  </span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  CCW_BOM_Upload_{(clientName || 'Cliente').replace(/\s+/g, '_')}.xlsx
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Part Number</th>
                      <th className="py-2.5 px-3 text-center">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Duration (Mnths)</th>
                      <th className="py-2.5 px-3 text-center">Initial Term(Months)</th>
                      <th className="py-2.5 px-3">Billing Model</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {assembledRows.map((row, rIdx) => (
                      <tr
                        key={row.rowId}
                        className={
                          row.isParent
                            ? 'bg-indigo-950/30 font-semibold text-white'
                            : 'bg-slate-950/40 text-slate-300'
                        }
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {rIdx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <div className="flex items-center space-x-1.5">
                            {!row.isParent && (
                              <span className="text-indigo-400 pl-2">↳</span>
                            )}
                            <span className={row.isParent ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                              {row.partNumber}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{row.quantity}</td>
                        <td className="py-2 px-3 text-center font-mono text-cyan-300">
                          {row.durationMonths || '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-cyan-300">
                          {row.initialTerm || '-'}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300">
                          {row.billingModel || '-'}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-400 max-w-[260px] truncate">
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE GESTIÓN MULTI-API Y ROTACIÓN DE TOKENS */}
      {isApiModalOpen && (
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
                    Si una API Key agota sus tokens (Error 429), ConfigurIAtor salta automáticamente a la siguiente Key o al motor gratuito configurado.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsApiModalOpen(false)}
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
                  Usa Google Search Grounding para consultar boletines End-of-Sale 2026 en cisco.com. Si el equipo sigue vigente, NO lo reemplaza.
                </p>
              </div>
              <input
                type="checkbox"
                checked={aiSettings.useCiscoOfficialGrounding}
                onChange={handleToggleWebGrounding}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Formulario para Añadir Nueva API Key (Gemini, OpenRouter Free, Groq Free, DeepSeek) */}
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
                    <option value="openrouter">OpenRouter (DeepSeek / Qwen GRATIS)</option>
                    <option value="groq">Groq Cloud (Llama 4 / 3.3 GRATIS)</option>
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
                  onClick={handleAddKey}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Guardar en el Pool
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  ¿Necesitas una API Key gratuita para este proveedor?
                </span>
                <a
                  href={PROVIDER_META[newProvider].getKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-1"
                >
                  <span>Obtener Key en {PROVIDER_META[newProvider].name.split(' ')[0]}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Lista de API Keys Configuradas */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Orden de Prioridad y Estado de Tokens ({aiSettings.keys.length} registradas)
              </div>

              {aiSettings.keys.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  No hay API Keys externas registradas. Actualmente el sistema opera con el <strong>Motor Determinista Local Cisco (0 Tokens)</strong>. Agrega una API Key arriba para habilitar visión multimodal e inferencia en la nube.
                </div>
              ) : (
                aiSettings.keys.map((k, idx) => (
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
                              Operativa
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
                        onClick={() => handleToggleKey(k.id)}
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
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                        title="Eliminar Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsApiModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
