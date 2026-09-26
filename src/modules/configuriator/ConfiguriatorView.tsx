// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR VIEW (AI BOM GENERATOR FOR CISCO CCW)
// Prioridad #1: IA Multimodal (Lenguaje Natural + Capturas Ctrl+V).
// Estructura estricta MADRE-HIJO para Cisco CCW, botón Clear BOM y modo manual
// desactivado por defecto.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Download,
  Image as ImageIcon,
  Trash2,
  Plus,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  ExternalLink,
  Layers,
  Zap,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  X,
  Globe,
  Cpu,
  RotateCcw,
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
import {
  getLearnedCiscoSkus,
  EOL_CATALOG_2026,
  getEolAlternatives,
  sanitizeAndValidateCcwSku,
} from './catalogRules';
import {
  CiscoApiStatusModal,
  resolvePoeBudgetFromSku,
  checkPsirtForProduct,
  PsirtAdvisory,
} from '../ciscoApi';

export const ConfiguriatorView: React.FC = () => {
  // Entrada de lenguaje natural e imagen (Ctrl+V o Drag & Drop)
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
  const [isCiscoSuiteModalOpen, setIsCiscoSuiteModalOpen] = useState<boolean>(false);
  const [psirtByIndex, setPsirtByIndex] = useState<Record<number, PsirtAdvisory[]>>({});
  const [loadingPsirtIndex, setLoadingPsirtIndex] = useState<number | null>(null);
  const [newProvider, setNewProvider] = useState<Exclude<AiProviderId, 'local_deterministic'>>('gemini');
  const [newKeyLabel, setNewKeyLabel] = useState<string>('');
  const [newKeyValue, setNewKeyValue] = useState<string>('');
  const [newKeyModel, setNewKeyModel] = useState<string>('gemini-3.7-flash');

  // Creación de BOM Manual DESACTIVADA por defecto (Prioridad #1 IA)
  const [isManualModeEnabled, setIsManualModeEnabled] = useState<boolean>(false);
  const [manualSkuInput, setManualSkuInput] = useState<string>('');
  const [manualQtyInput, setManualQtyInput] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAuditPsirtForItem = async (idx: number, sku: string) => {
    setLoadingPsirtIndex(idx);
    try {
      const advisories = await checkPsirtForProduct(sku, 3);
      setPsirtByIndex((prev) => ({ ...prev, [idx]: advisories }));
    } finally {
      setLoadingPsirtIndex(null);
    }
  };

  // Sincronizar configuración de IA con el puente Desktop (.exe) al montar
  useEffect(() => {
    syncAiSettingsFromDesktopBridge().then((synced) => {
      setAiSettings(synced);
    });
  }, []);

  // Recalcular filas ensambladas Madre-Hijo cuando cambian los ítems extraídos o el modo Meraki
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

  // Pegado de capturas de pantalla con Ctrl + V
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
          setErrorMsg(null);
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
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Botón CLEAR: limpia todo el BOM IA, el texto, la imagen y los errores para hacer otro
  const handleClearAllBom = () => {
    setInputText('');
    setPastedImage(null);
    setExtractionResult(null);
    setAssembledRows([]);
    setErrorMsg(null);
    setManualSkuInput('');
    setManualQtyInput(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Ejecutar extracción con IA (Lenguaje Natural + Imagen) y armado Madre-Hijo
  const handleGenerateConfig = async () => {
    if (!inputText.trim() && !pastedImage) {
      setErrorMsg(
        'Escribe tu solicitud en lenguaje natural o pega una captura de pantalla (Ctrl + V) para que la IA arme la configuración Madre-Hijo.'
      );
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
      setErrorMsg(err?.message || 'Error al procesar la solicitud con IA.');
      setAiSettings(loadAiSettings());
    } finally {
      setIsGenerating(false);
    }
  };

  // Modificar parámetros de un equipo Madre en vivo (Cantidad, Tier, Plazo, Stacking, PSU Redundante, Alternativa EOL)
  const updateParentItem = (index: number, patch: Partial<ExtractedRequirementItem>) => {
    if (!extractionResult) return;
    const nextItems = extractionResult.items.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, ...patch };
      if (patch.licenseTier && updated.suggestedActiveSku) {
        if (/^(C9200L?|C9300L?)-.*-(E|A)$/i.test(updated.suggestedActiveSku)) {
          updated.suggestedActiveSku = updated.suggestedActiveSku.replace(
            /-(E|A)$/i,
            `-${patch.licenseTier === 'Advantage' ? 'A' : 'E'}`
          );
        }
      }
      if (patch.licenseTier && updated.selectedEolAlternativeSku) {
        if (/^(C9200L?|C9300L?)-.*-(E|A)$/i.test(updated.selectedEolAlternativeSku)) {
          updated.selectedEolAlternativeSku = updated.selectedEolAlternativeSku.replace(
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

    const sanitized = sanitizeAndValidateCcwSku(cleanSku);
    const effectiveRaw = sanitized.inferredLegacyEolSku || cleanSku;
    const eolEntry = EOL_CATALOG_2026[effectiveRaw] || EOL_CATALOG_2026[effectiveRaw.replace(/-HW$/i, '')];
    const newItem: ExtractedRequirementItem = {
      id: `manual-${Date.now()}`,
      rawMentionedSku: effectiveRaw,
      suggestedActiveSku: eolEntry ? eolEntry.replacementSku : sanitized.sanitizedSku,
      isEol2026: eolEntry ? eolEntry.status === 'eos_eol_active' : Boolean(sanitized.inferredLegacyEolSku),
      eolReason: sanitized.correctionReason || eolEntry?.eolNote,
      officialCiscoUrl: eolEntry?.officialCiscoDocUrl,
      deviceType:
        cleanSku.startsWith('MR') || cleanSku.startsWith('CW')
          ? 'access_point'
          : cleanSku.startsWith('C8') || cleanSku.startsWith('ISR')
            ? 'router'
            : cleanSku.startsWith('FPR') || cleanSku.startsWith('MX')
              ? 'firewall'
              : 'switch',
      licenseTier: 'Essentials',
      termYears: 3,
      quantity: manualQtyInput > 0 ? manualQtyInput : 1,
      notes: `Agregado manualmente (${cleanSku})`,
    };

    setExtractionResult((prev) => ({
      clientName: prev?.clientName || clientName,
      items: [...(prev?.items || []), newItem],
      providerUsed: prev?.providerUsed || 'Edición Manual + Motor Madre-Hijo Cisco',
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
  const learnedSkusCount =
    Object.keys(getLearnedCiscoSkus()).length + Object.keys(EOL_CATALOG_2026).length;
  const totalParents = assembledRows.filter((r) => r.isParent).length;
  const totalChildren = assembledRows.filter((r) => !r.isParent).length;

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
                Regla Crítica de Ensamblado Madre-Hijo Cisco CCW
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
              para que los equipos Madre e Hijos queden ensamblados en estado <strong>VALID (Verde)</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setIsCiscoSuiteModalOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Ver las 7 APIs Oficiales de Cisco (OAuth2 M2M, PSIRT, Datafoundation-POE, CX Cloud)"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Cisco APIs (7 Activas)</span>
          </button>

          <button
            onClick={() => setIsApiModalOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>APIs & Rotación ({activeKeysCount} IA activas)</span>
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
                ConfigurIAtor &bull; AI BOM Generator (Madre-Hijo CCW)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                Prioridad #1: Gemini 3.7 Flash (Texto) &bull; 3.6/3.8 Flash (Visión)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950/80 text-cyan-300 border border-cyan-700/40 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Cisco.com EOL 2026 ({learnedSkusCount} SKUs)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analiza solicitudes en lenguaje natural o capturas de pantalla (Ctrl + V) con IA y estructura automáticamente las filas Madre (Chasis/Contenedor) e Hijos (Hardware, DNA/Meraki Lic, Fuente, Cable, Stack) sin P/N obsoletos.
            </p>
          </div>
        </div>

        {/* Botón rápido Limpiar / Nuevo BOM si hay datos */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(inputText || pastedImage || assembledRows.length > 0) && (
            <button
              type="button"
              onClick={handleClearAllBom}
              className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700/50 font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Limpiar solicitud y BOM actual para comenzar uno nuevo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar / Nuevo BOM (Clear)</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Motores IA: <strong className="text-emerald-300">Gemini 3.7 &rarr; 3.6 &rarr; 3.8 + OpenRouter</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Grilla Principal: Panel de Entrada IA (Izquierda) + Vista Previa Madre-Hijo CCW (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Entrada Multimodal IA */}
        <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>1. Solicitud en Lenguaje Natural o Screenshot (IA)</span>
            </h3>

            {/* Ejemplos rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Cotizar 1 switch Meraki MS210-48FP con licencia por 3 años'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 text-[11px] text-amber-300 border border-amber-700/50 cursor-pointer transition-colors"
                title="Cargar caso Meraki MS210-48FP (EOL -> MS225-48FP-HW / MS130-SWITCHES)"
              >
                Ejemplo MS210-48FP
              </button>
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

          {/* Textarea de correo / requerimiento en lenguaje natural */}
          <div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe o pega aquí el correo del cliente en lenguaje natural (ej: 'Cotizar 1 switch Meraki MS210-48FP con licencia por 3 años' o '2 switches de 24 bocas PoE Catalyst con licencia por 3 años') o presiona Ctrl + V para analizar un pantallazo..."
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
                      Captura lista para análisis por Visión IA (Gemini 3.6/3.8 Flash)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {pastedImage.mimeType} &bull; Puedes enviarla sola o acompañada de texto
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

          {/* Botones de Acción: Generar con IA + Botón Clear */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateConfig}
              disabled={isGenerating}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analizando con IA y Estructurando Madre-Hijo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Configuración con IA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearAllBom}
              disabled={isGenerating}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50 font-bold text-xs sm:text-sm flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
              title="Limpiar texto, imagen y BOM generado (Clear)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>

          {/* Toggle de Creación Manual (Desactivado por defecto) */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-semibold">
                Adición Manual de SKUs (Opcional)
              </span>
              <button
                type="button"
                onClick={() => setIsManualModeEnabled((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  isManualModeEnabled
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                {isManualModeEnabled ? 'Activado' : 'Desactivado por defecto (Prioridad IA)'}
              </button>
            </div>

            {isManualModeEnabled && (
              <div className="flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  value={manualSkuInput}
                  onChange={(e) => setManualSkuInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddManualItem();
                  }}
                  placeholder="Ej. MS210-48FP, MS130-48P o C9200L-48P-4X-E"
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
            )}
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

        {/* COLUMNA DERECHA: Estructura Madre-Hijo y Tabla 10 Columnas CCW */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tarjeta de Equipos Madre e Hijos */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>
                    2. Estructura Ensamblada Madre-Hijo ({totalParents} Equipos Madre &bull; {totalChildren} Sub-SKUs Hijos)
                  </span>
                </h3>
                {extractionResult?.providerUsed && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Analizado por IA: <strong className="text-indigo-300">{extractionResult.providerUsed}</strong>
                    {extractionResult.keyLabelUsed ? ` (${extractionResult.keyLabelUsed})` : ''}
                  </p>
                )}
              </div>

              {assembledRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearAllBom}
                    className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                    title="Limpiar BOM actual"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar BOM</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCcwExcel}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel CCW ({assembledRows.length} líneas)</span>
                  </button>
                </div>
              )}
            </div>

            {!extractionResult || extractionResult.items.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">
                  Esperando instrucciones en lenguaje natural o captura de pantalla (Ctrl + V).
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  La IA analizará tu solicitud y armará automáticamente cada equipo <strong>MADRE (Chasis/Contenedor)</strong> junto con sus líneas <strong>HIJO (Hardware, Licencia DNA/Meraki, Fuente, Cable de Poder, Network Stack)</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {extractionResult.items.map((item, idx) => {
                  const parentRow = assembledRows.find((r) => r.parentIndex === idx && r.isParent);
                  const childRows = assembledRows.filter((r) => r.parentIndex === idx && !r.isParent);
                  const activeSku = parentRow?.partNumber || item.suggestedActiveSku || '';
                  const effectiveHardwareSku = parentRow?.resolvedChildModel
                    ? `${activeSku}:${parentRow.resolvedChildModel}`
                    : activeSku;
                  const poeInfo = resolvePoeBudgetFromSku(effectiveHardwareSku);
                  const itemAdvisories = psirtByIndex[idx] || [];
                  const eolAlternatives = getEolAlternatives(item.rawMentionedSku || '');
                  const hasEolAlternative = Boolean(
                    item.rawMentionedSku &&
                      effectiveHardwareSku &&
                      item.rawMentionedSku.toUpperCase() !== effectiveHardwareSku.toUpperCase()
                  );

                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 space-y-3 transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-black uppercase">
                              MADRE #{idx + 1} ({parentRow?.resolvedChildModel ? 'Contenedor CCW' : 'Chasis'})
                            </span>
                            <span className="font-mono text-sm font-black text-white">
                              {activeSku}
                            </span>
                            {parentRow?.resolvedChildModel && (
                              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-200 border border-indigo-600/40 font-mono text-xs font-bold">
                                &rarr; Hijo 1.1: {parentRow.resolvedChildModel}
                              </span>
                            )}

                            {/* Badge EOL vs Vigente 2026 */}
                            {parentRow?.wasReplacedFromEol ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                                <span>Reemplazo EOL 2026 (de {item.rawMentionedSku})</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-600/40">
                                Vigente 2026
                              </span>
                            )}

                            {/* Badge Datafoundation-POE Oficial */}
                            {poeInfo.poeSupported && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-700/50 flex items-center gap-1"
                                title={poeInfo.notes || poeInfo.poeClass}
                              >
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>
                                  PoE: {poeInfo.maxWatts}W ({poeInfo.standard})
                                </span>
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
                            <p className="text-[11px] text-amber-300/90">↳ {parentRow.eolReason}</p>
                          )}
                        </div>

                        {/* Botón PSIRT, alternar SKU original vs Reemplazo EOL y botón eliminar */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleAuditPsirtForItem(idx, parentRow?.resolvedChildModel || activeSku)
                            }
                            disabled={loadingPsirtIndex === idx}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-cyan-300 border border-cyan-700/50 flex items-center gap-1 cursor-pointer"
                            title="Consultar vulnerabilidades y CVEs en vivo en Cisco PSIRT openVuln API v2"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {loadingPsirtIndex === idx ? 'Consultando PSIRT...' : 'Auditar PSIRT'}
                            </span>
                          </button>

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
                                ? `Usar Reemplazo Vigente CCW`
                                : `Mantener Original (${item.rawMentionedSku})`}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => removeParentItem(idx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Eliminar este bloque Madre-Hijo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Tarjetas Interactivas de Alternativas Oficiales CCW cuando se detecta EOL */}
                      {eolAlternatives.length > 0 && (
                        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                EOL Detectado ({item.rawMentionedSku}) &bull; Selecciona Alternativa Oficial Vigente en CCW:
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Clic en cualquier opción para re-ensamblar Madre-Hijo en vivo
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {eolAlternatives.map((alt) => {
                              const isSelected =
                                !item.keepOriginalSku &&
                                (effectiveHardwareSku.toUpperCase() === alt.recommendedSku.toUpperCase() ||
                                  activeSku.toUpperCase() === alt.recommendedSku.toUpperCase());
                              const altPoe = resolvePoeBudgetFromSku(alt.recommendedSku);
                              return (
                                <button
                                  key={alt.recommendedSku}
                                  type="button"
                                  onClick={() =>
                                    updateParentItem(idx, {
                                      selectedEolAlternativeSku: alt.recommendedSku,
                                      suggestedActiveSku: alt.recommendedSku,
                                      keepOriginalSku: false,
                                    })
                                  }
                                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                    isSelected
                                      ? 'bg-emerald-950/50 border-emerald-500/70 shadow-md shadow-emerald-950/40'
                                      : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-mono text-xs font-black text-white">
                                        {alt.recommendedSku.includes(':')
                                          ? alt.recommendedSku.replace(':', ' → ')
                                          : alt.recommendedSku}
                                      </span>
                                      {isSelected && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase">
                                          Activo
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-bold text-indigo-300 mt-0.5">
                                      {alt.title}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                      {alt.description}
                                    </p>
                                  </div>
                                  {altPoe.poeSupported && (
                                    <div className="flex items-center gap-1 text-[10px] font-mono text-amber-300 pt-1 border-t border-slate-800/80">
                                      <Zap className="w-3 h-3 text-amber-400" />
                                      <span>
                                        Budget: {altPoe.maxWatts}W ({altPoe.standard})
                                      </span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Resultados de Auditoría Cisco PSIRT openVuln API v2 */}
                      {itemAdvisories.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-800/50 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 uppercase">
                            <span>
                              🛡️ Cisco PSIRT openVuln API v2 ({itemAdvisories.length} boletines oficiales)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPsirtByIndex((prev) => {
                                  const next = { ...prev };
                                  delete next[idx];
                                  return next;
                                })
                              }
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              Ocultar
                            </button>
                          </div>
                          {itemAdvisories.map((adv) => (
                            <div
                              key={adv.advisoryId}
                              className="flex items-center justify-between gap-2 text-[11px] bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800"
                            >
                              <div className="truncate">
                                <span
                                  className={`mr-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    adv.sir === 'Critical'
                                      ? 'bg-rose-950 text-rose-300'
                                      : adv.sir === 'High'
                                        ? 'bg-amber-950 text-amber-300'
                                        : 'bg-indigo-950 text-indigo-300'
                                  }`}
                                >
                                  {adv.sir}
                                </span>
                                <span className="text-slate-200 font-medium">{adv.advisoryTitle}</span>
                                {adv.cves.length > 0 && (
                                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                                    ({adv.cves.slice(0, 2).join(', ')})
                                  </span>
                                )}
                              </div>
                              {adv.publicationUrl && (
                                <a
                                  href={adv.publicationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-cyan-300 hover:underline shrink-0 flex items-center gap-1"
                                >
                                  <span>Ver</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Controles rápidos de configuración de preventa */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-900 text-xs">
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

                      {/* Sub-líneas HIJAS ensambladas */}
                      {childRows.length > 0 && (
                        <div className="pl-3 border-l-2 border-indigo-500/50 space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                            ↳ Componentes HIJOS ensamblados automáticamente ({childRows.length}):
                          </div>
                          {childRows.map((sub, cIdx) => (
                            <div
                              key={sub.rowId}
                              className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-slate-800/80"
                            >
                              <div className="flex items-center space-x-2 overflow-hidden">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-700/40 text-[9px] font-bold uppercase shrink-0">
                                  HIJO #{cIdx + 1}
                                </span>
                                <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span className="font-mono font-bold text-indigo-200 shrink-0">
                                  {sub.partNumber}
                                </span>
                                <span className="text-slate-400 truncate max-w-[260px]">
                                  {sub.notes}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 font-mono text-[11px] shrink-0">
                                <span className="text-emerald-300">Qty: {sub.quantity}</span>
                                {sub.durationMonths && (
                                  <span className="text-cyan-300">
                                    {sub.durationMonths}M ({sub.billingModel})
                                  </span>
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
                    3. Vista Previa Hoja "Sheet1" &bull; Orden Secuencial Madre-Hijo (UploadExcelTemplate)
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
                      <th className="py-2.5 px-3">Jerarquía</th>
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
                            ? 'bg-emerald-950/25 font-semibold text-white'
                            : 'bg-slate-950/40 text-slate-300'
                        }
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {rIdx + 1}
                        </td>
                        <td className="py-2 px-3">
                          {row.isParent ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/40 text-[10px] font-black uppercase">
                              MADRE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/30 text-[10px] font-bold uppercase ml-2">
                              ↳ HIJO
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <span
                            className={
                              row.isParent ? 'text-emerald-300 font-bold' : 'text-slate-200 pl-2'
                            }
                          >
                            {row.partNumber}
                          </span>
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
                    Prioridad #1: Google Gemini (3.7 Flash Texto &rarr; 3.6/3.8 Flash Visión) &rarr; Respaldo #2: OpenRouter (Auto Vision / DeepSeek).
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
                  Evalúa boletines End-of-Sale 2026 en cisco.com. Si el equipo sigue vigente, mantiene el SKU original.
                </p>
              </div>
              <input
                type="checkbox"
                checked={aiSettings.useCiscoOfficialGrounding}
                onChange={handleToggleWebGrounding}
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
                  onClick={handleAddKey}
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
              ))}
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

      {/* Modal de Estado y Pruebas de las 7 APIs Oficiales de Cisco */}
      <CiscoApiStatusModal
        isOpen={isCiscoSuiteModalOpen}
        onClose={() => setIsCiscoSuiteModalOpen(false)}
      />
    </div>
  );
};
