// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR VIEW (AI BOM GENERATOR FOR CISCO CCW)
// Prioridad #1: IA Multimodal (Lenguaje Natural + Capturas Ctrl+V).
// Soporta 100% del portafolio Cisco & Meraki 2026 (Enterprise, Meraki, Industrial IE,
// Servidores UCS M7, Nexus DC, Seguridad FPR/MX, Colaboración DP-9800 & Room Bar).
// Incluye:
// - Cable de poder por defecto Norma Chile / Italia (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT)
// - Selector contextual Meraki (Suscripción CCW vs Co-Term) solo en equipos Meraki
// - Calculadora y Alerta Inteligente de Presupuesto PoE en Vivo
// - Asistente 1-Clic de Transceivers SFP / Fibra / DAC vigentes 2026 (Cero EOL)
// - Soporte 1-Clic Cisco SmartNet / SNTC (CON-SNT 8x5xNBD / 24x7x4)
// - Pre-Cotización Preliminar en USD (Precio Lista Ref. vs Estimado Fast Track)
// ============================================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  DollarSign,
  Plug,
  Cable,
  Wrench,
  Award,
  Copy,
  Check,
  ArrowUpDown,
  Calculator,
  Crown,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  extractBOMRequirementsFromInput,
  ExtractedRequirementResult,
  ExtractedRequirementItem,
} from './aiBomExtractor';
import { auditCustomerIntentDiscrepancies } from './aiDiscrepancyAuditor';
import {
  buildAssembledCcwRows,
  generateCcwUploadWorkbook,
  generateProposalsComparisonWorkbook,
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
  sanitizeAndValidateCcwSku,
  COMPATIBLE_TRANSCEIVERS_2026,
  PowerCordStandard,
  HomologatedProposal,
  ProposalPrioritySortMode,
  generateHomologatedProposalsForItem,
  checkSkuInFastTrackDb,
} from './catalogRules';
import {
  CiscoApiStatusModal,
  resolvePoeBudgetFromSku,
  checkPsirtForProduct,
  PsirtAdvisory,
} from '../ciscoApi';
import { useCiscoAutomatedStore } from '../../core/store';
import { CloudEstimateRecord } from '../cloud';
import {
  PoeBudgetCard,
  AiDiscrepancyCard,
  CcwPreviewTable,
  ApiManagementModal,
} from './components';

export interface ConfiguriatorViewProps {
  isNavSidebarOpen?: boolean;
  onToggleNavSidebar?: () => void;
  onCollapseNavSidebar?: () => void;
}

export const ConfiguriatorView: React.FC<ConfiguriatorViewProps> = ({
  isNavSidebarOpen,
  onToggleNavSidebar,
  onCollapseNavSidebar,
}) => {
  const { loadCloudEstimateIntoStore, params: quoterParams, currentUser } = useCiscoAutomatedStore();

  // Control de visibilidad del panel de Solicitud en Lenguaje Natural (Barra 1)
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState<boolean>(true);

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

  // Por defecto en Chile usamos Norma Italiana / Chilena (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT)
  const [defaultPowerCord, setDefaultPowerCord] = useState<PowerCordStandard>('italy_chile');
  const [merakiLicenseMode, setMerakiLicenseMode] = useState<'subscription' | 'coterm'>('subscription');
  // Analizador interactivo de Descuento CCW (%) sobre Valores de Lista (GPL)
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number | ''>(43);
  // Modo Vista Valor GPL Puro (0% Descuento): muestra todos los valores al 100% GPL sin descuentos
  const [isPureGplMode, setIsPureGplMode] = useState<boolean>(false);

  // Orden de prioridad para las 3+ propuestas homologadas (Mejor Descuento + Mayor % Compatibilidad)
  const [proposalSortMode, setProposalSortMode] = useState<ProposalPrioritySortMode>('priority_optimal');
  const [expandedProposalsByIdx, setExpandedProposalsByIdx] = useState<Record<number, boolean>>({});
  const [showComplianceDetails, setShowComplianceDetails] = useState<boolean>(false);
  const [fastTrackDiscountMap, setFastTrackDiscountMap] = useState<
    Record<string, { discountPct: number; listPrice?: number }>
  >({});
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Configuración Multi-API y Rotación de Tokens
  const [aiSettings, setAiSettings] = useState<AiConfigSettings>(() => loadAiSettings());
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isCiscoSuiteModalOpen, setIsCiscoSuiteModalOpen] = useState<boolean>(false);
  const [psirtByIndex, setPsirtByIndex] = useState<Record<number, PsirtAdvisory[]>>({});
  const [loadingPsirtIndex, setLoadingPsirtIndex] = useState<number | null>(null);
  const [isAuditingAllApis, setIsAuditingAllApis] = useState<boolean>(false);
  const [newProvider, setNewProvider] = useState<Exclude<AiProviderId, 'local_deterministic'>>('gemini');
  const [newKeyLabel, setNewKeyLabel] = useState<string>('');
  const [newKeyValue, setNewKeyValue] = useState<string>('');
  const [newKeyModel, setNewKeyModel] = useState<string>('gemini-3.7-flash');

  // Creación de BOM Manual DESACTIVADA por defecto (Prioridad #1 IA)
  const [isManualModeEnabled, setIsManualModeEnabled] = useState<boolean>(false);
  const [manualSkuInput, setManualSkuInput] = useState<string>('');
  const [manualQtyInput, setManualQtyInput] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerActionToast = useCallback((msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 4200);
  }, []);

  const handleAuditPsirtForItem = async (idx: number, sku: string) => {
    setLoadingPsirtIndex(idx);
    try {
      const advisories = await checkPsirtForProduct(sku, 3);
      setPsirtByIndex((prev) => ({ ...prev, [idx]: advisories }));
    } finally {
      setLoadingPsirtIndex(null);
    }
  };

  const handleAuditAllCiscoApis = async () => {
    if (!extractionResult || extractionResult.items.length === 0) return;
    setIsAuditingAllApis(true);
    try {
      const nextMap: Record<number, PsirtAdvisory[]> = {};
      for (let i = 0; i < extractionResult.items.length; i++) {
        const parentRow = assembledRows.find((r) => r.parentIndex === i && r.isParent);
        const skuToAudit =
          parentRow?.resolvedChildModel ||
          parentRow?.partNumber ||
          extractionResult.items[i].suggestedActiveSku ||
          '';
        if (skuToAudit) {
          const adv = await checkPsirtForProduct(skuToAudit, 3);
          nextMap[i] = adv;
        }
      }
      setPsirtByIndex(nextMap);
    } finally {
      setIsAuditingAllApis(false);
    }
  };

  // Sincronizar configuración de IA con el puente Desktop (.exe) al montar
  useEffect(() => {
    let isMounted = true;
    syncAiSettingsFromDesktopBridge().then((synced) => {
      if (isMounted) {
        setAiSettings(synced);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Recalcular filas ensambladas Madre-Hijo cuando cambian los ítems extraídos, modo Meraki o norma de cable
  const refreshAssembledRows = useCallback(
    async (
      currentReq: ExtractedRequirementResult | null,
      mode: 'subscription' | 'coterm',
      cordStd: PowerCordStandard
    ) => {
      if (!currentReq || !currentReq.items.length) {
        setAssembledRows([]);
        return;
      }
      const rows = await buildAssembledCcwRows(currentReq, mode, cordStd);
      setAssembledRows(rows);
    },
    []
  );

  useEffect(() => {
    refreshAssembledRows(extractionResult, merakiLicenseMode, defaultPowerCord);
  }, [extractionResult, merakiLicenseMode, defaultPowerCord, refreshAssembledRows]);

  // Cruzar los SKUs de las propuestas homologadas con la base de datos Fast Track para enriquecer descuentos y precios GPL reales
  useEffect(() => {
    if (!extractionResult || extractionResult.items.length === 0) return;
    let cancelled = false;
    (async () => {
      const candidateSkus = new Set<string>();
      extractionResult.items.forEach((it) => {
        const baseProposals = generateHomologatedProposalsForItem({
          rawMentionedSku: it.rawMentionedSku,
          suggestedActiveSku: it.suggestedActiveSku,
          deviceType: it.deviceType,
          ports: it.ports,
          isPoe: it.isPoe,
          poeBudget: it.poeBudget,
          uplinkType: it.uplinkType,
          licenseTier: it.licenseTier || 'Essentials',
          termYears: it.termYears || 3,
          quantity: it.quantity || 1,
        });
        baseProposals.forEach((p) => {
          const clean = p.recommendedSku.includes(':')
            ? p.recommendedSku.split(':')[1]
            : p.recommendedSku;
          candidateSkus.add(clean.toUpperCase());
          candidateSkus.add(p.recommendedSku.toUpperCase());
        });
      });

      const nextFtMap: Record<string, { discountPct: number; listPrice?: number }> = {};
      for (const sku of Array.from(candidateSkus)) {
        const match = await checkSkuInFastTrackDb(sku);
        if (match) {
          nextFtMap[sku] = {
            discountPct: match.distributorDiscount || 48,
            listPrice: match.listPrice > 0 ? match.listPrice : undefined,
          };
        }
      }
      if (!cancelled && Object.keys(nextFtMap).length > 0) {
        setFastTrackDiscountMap((prev) => ({ ...prev, ...nextFtMap }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extractionResult]);

  // Cambiar globalmente la norma del cable de poder (Norma Chile/Italia CAB-IT vs Rack PDU vs Schuko)
  const handleGlobalPowerCordChange = (newCordStd: PowerCordStandard) => {
    setDefaultPowerCord(newCordStd);
    if (extractionResult && extractionResult.items.length > 0) {
      setExtractionResult({
        ...extractionResult,
        items: extractionResult.items.map((it) => ({
          ...it,
          powerCordStandard: newCordStd,
        })),
      });
    }
  };

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
        reader.onerror = () => {
          setErrorMsg('Error al procesar la imagen del portapapeles. Intenta subir el archivo directamente.');
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
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo de imagen seleccionado.');
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
    setPsirtByIndex({});
    setIsPromptPanelOpen(true);
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

      // Prioridad #1 al cable solicitado por el cliente (en texto o foto/captura);
      // si el cliente no especificó otro cable, usar el selector por defecto (Norma Chile/Italia CAB-IT)
      result.items = result.items.map((it) => ({
        ...it,
        powerCordStandard: it.clientRequestedPowerCord
          ? it.powerCordStandard || 'italy_chile'
          : defaultPowerCord || 'italy_chile',
      }));

      setExtractionResult(result);
      setAiSettings(loadAiSettings());

      // Una vez entregada la cotización: auto-ocultar la barra de solicitud IA y colapsar la barra de módulos principales
      if (result.items && result.items.length > 0) {
        setIsPromptPanelOpen(false);
        onCollapseNavSidebar?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la solicitud con IA.');
      setAiSettings(loadAiSettings());
    } finally {
      setIsGenerating(false);
    }
  };

  // Modificar parámetros de un equipo Madre en vivo
  const updateParentItem = (index: number, patch: Partial<ExtractedRequirementItem>) => {
    if (!extractionResult) return;
    const nextItems = extractionResult.items.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, ...patch };
      if (patch.licenseTier && updated.suggestedActiveSku) {
        if (/^(C9200L?|C9300L?|IE-3[134]00)-.*-(E|A)$/i.test(updated.suggestedActiveSku)) {
          updated.suggestedActiveSku = updated.suggestedActiveSku.replace(
            /-(E|A)$/i,
            `-${patch.licenseTier === 'Advantage' ? 'A' : 'E'}`
          );
        }
      }
      if (patch.licenseTier && updated.selectedEolAlternativeSku) {
        if (/^(C9200L?|C9300L?|IE-3[134]00)-.*-(E|A)$/i.test(updated.selectedEolAlternativeSku)) {
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

  // Auditoría paralela de discrepancias IA: Compara el lenguaje natural original vs ensamble Golden Template
  const discrepancyReport = useMemo(() => {
    return auditCustomerIntentDiscrepancies(inputText, extractionResult, assembledRows);
  }, [inputText, extractionResult, assembledRows]);

  const handleApplyDiscrepancyFix = (
    itemIndex: number,
    patch?: Partial<ExtractedRequirementItem>
  ) => {
    if (!patch) return;
    updateParentItem(itemIndex, patch);
  };

  // Agregar o incrementar un transceiver SFP/Fibra/DAC en un equipo Madre
  const handleAddTransceiverToItem = (
    index: number,
    trSku: string,
    defaultQty: number,
    description: string
  ) => {
    if (!extractionResult) return;
    const currentItem = extractionResult.items[index];
    if (!currentItem) return;
    const existing = Array.isArray(currentItem.extraTransceivers)
      ? [...currentItem.extraTransceivers]
      : [];
    const foundIdx = existing.findIndex((t) => t.sku === trSku);
    if (foundIdx >= 0) {
      existing[foundIdx] = {
        ...existing[foundIdx],
        qty: existing[foundIdx].qty + defaultQty,
      };
    } else {
      existing.push({ sku: trSku, qty: defaultQty, description });
    }
    updateParentItem(index, { extraTransceivers: existing });
  };

  const handleRemoveTransceiverFromItem = (index: number, trSku: string) => {
    if (!extractionResult) return;
    const currentItem = extractionResult.items[index];
    if (!currentItem || !Array.isArray(currentItem.extraTransceivers)) return;
    updateParentItem(index, {
      extraTransceivers: currentItem.extraTransceivers.filter((t) => t.sku !== trSku),
    });
  };

  // Activar/Desactivar SmartNet (CON-SNT) en todo el BOM con 1 clic
  const handleToggleSmartNetAll = () => {
    if (!extractionResult || extractionResult.items.length === 0) return;
    const allHaveSmartNet = extractionResult.items.every((it) => it.includeSmartNet);
    setExtractionResult({
      ...extractionResult,
      items: extractionResult.items.map((it) => ({
        ...it,
        includeSmartNet: !allHaveSmartNet,
        smartNetLevel: it.smartNetLevel || '8x5xNBD',
      })),
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
    const resolvedSku = eolEntry ? eolEntry.replacementSku : sanitized.sanitizedSku;
    const newItem: ExtractedRequirementItem = {
      id: `manual-${Date.now()}`,
      rawMentionedSku: effectiveRaw,
      suggestedActiveSku: resolvedSku,
      isEol2026: eolEntry ? eolEntry.status === 'eos_eol_active' : Boolean(sanitized.inferredLegacyEolSku),
      isNonExistentSku: Boolean(sanitized.isNonExistentSku),
      eolReason: sanitized.correctionReason || eolEntry?.eolNote,
      officialCiscoUrl: eolEntry?.officialCiscoDocUrl,
      deviceType:
        resolvedSku.startsWith('IE-')
          ? 'industrial_switch'
          : resolvedSku.startsWith('UCSC-')
            ? 'server_ucs'
            : resolvedSku.startsWith('N9K-')
              ? 'nexus_dc'
              : resolvedSku.startsWith('DP-') || resolvedSku.startsWith('CS-')
                ? 'collaboration'
                : resolvedSku.startsWith('MR') || resolvedSku.startsWith('CW')
                  ? 'access_point'
                  : resolvedSku.startsWith('C8') || resolvedSku.startsWith('ISR')
                    ? 'router'
                    : resolvedSku.startsWith('FPR') || resolvedSku.startsWith('MX')
                      ? 'firewall'
                      : 'switch',
      licenseTier: 'Essentials',
      termYears: 3,
      quantity: manualQtyInput > 0 ? manualQtyInput : 1,
      powerCordStandard: defaultPowerCord,
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

  // ============================================================================
  // GENERACIÓN Y ORDENAMIENTO DE LAS 3+ PROPUESTAS HOMOLOGADAS CON VALOR GPL (SIN DESCUENTO)
  // ============================================================================
  const proposalsByItemIdx = useMemo(() => {
    const map: Record<number, HomologatedProposal[]> = {};
    if (!extractionResult || !Array.isArray(extractionResult.items)) return map;

    extractionResult.items.forEach((it, idx) => {
      const qty = it.quantity > 0 ? it.quantity : 1;
      map[idx] = generateHomologatedProposalsForItem({
        rawMentionedSku: it.rawMentionedSku,
        suggestedActiveSku: it.suggestedActiveSku,
        deviceType: it.deviceType,
        ports: it.ports,
        isPoe: it.isPoe,
        poeBudget: it.poeBudget,
        uplinkType: it.uplinkType,
        licenseTier: it.licenseTier || 'Essentials',
        termYears: it.termYears || 3,
        quantity: qty,
        includeStacking: it.includeStacking,
        includeRedundantPsu: it.includeRedundantPsu,
        includeSmartNet: it.includeSmartNet,
        smartNetLevel: it.smartNetLevel || '8x5xNBD',
        powerCordStandard: it.powerCordStandard || defaultPowerCord || 'italy_chile',
        merakiLicenseMode: it.merakiLicenseMode || merakiLicenseMode || 'subscription',
        sortMode: proposalSortMode,
        fastTrackDiscountMap,
      });
    });

    return map;
  }, [
    extractionResult,
    defaultPowerCord,
    merakiLicenseMode,
    proposalSortMode,
    fastTrackDiscountMap,
  ]);

  // Descargar Excel Comparativo de las 3+ Propuestas con Valor GPL (Sin Descuentos) y Prioridad
  const handleDownloadProposalsComparisonExcel = async () => {
    if (!extractionResult || assembledRows.length === 0) return;
    try {
      const updatedReq: ExtractedRequirementResult = {
        ...extractionResult,
        clientName: clientName || extractionResult.clientName || 'Cliente',
      };
      const { buffer, filename } = await generateProposalsComparisonWorkbook({
        req: updatedReq,
        proposalsByItemIdx,
        sortMode: proposalSortMode,
        assembledRows,
        pureGplMode: isPureGplMode,
      });

      const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
      if (pyApi && typeof pyApi.download_excel_file === 'function') {
        const byteArray = Array.from(new Uint8Array(buffer));
        await pyApi.download_excel_file(filename, byteArray);
        triggerActionToast(`✅ Comparativo 3 Propuestas GPL exportado: ${filename}`);
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
      triggerActionToast(`✅ Excel Comparativo de 3 Propuestas GPL descargado: ${filename}`);
    } catch (err: any) {
      setErrorMsg(`Error generando Comparativo 3 Propuestas GPL: ${err?.message || err}`);
    }
  };

  // Copiar resumen ejecutivo de las 3+ propuestas homologadas con Valor GPL (Sin Descuento) al portapapeles
  const handleCopyProposalsSummary = async (itemIdx: number) => {
    if (!extractionResult || !extractionResult.items[itemIdx]) return;
    const item = extractionResult.items[itemIdx];
    const proposals = proposalsByItemIdx[itemIdx] || [];
    if (proposals.length === 0) return;

    const qty = item.quantity > 0 ? item.quantity : 1;
    const requestedLabel = item.rawMentionedSku || item.suggestedActiveSku || 'Equipo Solicitado';
    const lines: string[] = [
      `📊 COMPARATIVO DE ${proposals.length} PROPUESTAS HOMOLOGADAS CISCO CCW 2026`,
      `Cliente / Proyecto: ${clientName || 'Cliente'} | Equipo Solicitado: ${qty}x ${requestedLabel}`,
      `Criterio de Prioridad: Mejor Descuento + Mayor % de Compatibilidad / Homologación Técnica`,
      `--------------------------------------------------------------------------------`,
    ];

    proposals.forEach((p) => {
      const rawDisc = Number(p.bestDiscountPct ?? p.estimatedDiscountPct) || 0;
      const effectiveDisc = isPureGplMode ? 0 : rawDisc;
      const gplChassis = Number(p.unitChassisGplUsd) || 0;
      const gplSolutionUnit = Number(p.unitSolutionGplUsd) || 0;
      const gplSolutionTotal = Number(p.totalSolutionGplUsd) || 0;
      const estNetTotal = Number(p.totalEstimatedNetUsd ?? p.estimatedTotalNetUsd) || 0;
      const effectiveNet = isPureGplMode ? gplSolutionTotal : estNetTotal;
      const subList = p.subItemsSummary || p.subItemsBreakdown || [];
      const subsText = subList
        .map(
          (s) =>
            `${s.qty}x ${s.partNumber} (GPL: US$${(Number(s.totalGplUsd) || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })})`
        )
        .join(' + ');

      lines.push(
        `🏆 PROPUESTA #${p.priorityRank} [${p.strategyTag || 'Propuesta Homologada'}] — ${p.recommendedSku.replace(':', ' -> ')} (${p.title})`,
        `   • % Compatibilidad / Homologación: ${p.compatibilityPct}% (${p.compatibilityLabel || p.homologationLabel || 'Homologado'})`,
        `   • Valor GPL Chasis Unitario (Sin Descuento): US$ ${gplChassis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `   • Valor GPL Solución Madre-Hijo Unitario (Sin Descuento): US$ ${gplSolutionUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `   • Valor GPL Solución Total (${qty}x, Sin Descuento): US$ ${gplSolutionTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `   • Mejor Descuento Aplicable: ${effectiveDisc.toFixed(1)}% (${isPureGplMode ? 'Modo GPL Puro 0% Dcto' : p.discountSourceLabel || p.promoBadge || 'Deal Reg'})`,
        `   • Valor Neto Estimado Total: US$ ${effectiveNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `   • Sub-SKUs Hijos Incluidos: ${subsText}`,
        `   • Detalle Técnico: ${p.description}`,
        ``
      );
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      triggerActionToast(
        `📋 Resumen de las ${proposals.length} propuestas con Valor GPL copiado al portapapeles`
      );
    } catch (_) {
      triggerActionToast('⚠️ No se pudo copiar automáticamente al portapapeles');
    }
  };

  // Expandir las 3 propuestas en el BOM CCW al mismo tiempo para compararlas dentro de Cisco CCW
  const handleLoadAllThreeProposalsIntoBom = (itemIdx: number) => {
    if (!extractionResult || !extractionResult.items[itemIdx]) return;
    const baseItem = extractionResult.items[itemIdx];
    const proposals = (proposalsByItemIdx[itemIdx] || []).slice(0, 3);
    if (proposals.length === 0) return;

    const expandedItems: ExtractedRequirementItem[] = [];
    extractionResult.items.forEach((it, idx) => {
      if (idx !== itemIdx) {
        expandedItems.push(it);
        return;
      }
      proposals.forEach((prop, pIdx) => {
        const rawDisc = Number(prop.bestDiscountPct ?? prop.estimatedDiscountPct) || 0;
        const gplTotal = Number(prop.totalSolutionGplUsd) || 0;
        expandedItems.push({
          ...baseItem,
          id: `${baseItem.id || 'item'}-prop-${pIdx + 1}-${Date.now()}`,
          selectedEolAlternativeSku: prop.recommendedSku,
          suggestedActiveSku: prop.recommendedSku,
          keepOriginalSku: false,
          discountPct: isPureGplMode ? 0 : rawDisc,
          notes: `[Propuesta #${prop.priorityRank} • ${prop.compatibilityPct}% Homologación • GPL Solución US$${gplTotal.toLocaleString('en-US')}] ${prop.title}`,
        });
      });
    });

    setExtractionResult({
      ...extractionResult,
      items: expandedItems,
    });
    triggerActionToast(
      `➕ Se cargaron las ${proposals.length} propuestas homologadas como bloques Madre-Hijo en el BOM CCW`
    );
  };

  // Enviar el BOM ensamblado (con sus Valores GPL y Descuentos) directamente al Cotizador Intcomex principal
  const handleSendBomToIntcomexQuoter = async () => {
    if (!extractionResult || assembledRows.length === 0) return;
    const effectiveGlobalDisc = isPureGplMode
      ? 0
      : typeof globalDiscountPct === 'number'
        ? globalDiscountPct
        : 38;

    const internacionRate = (quoterParams?.internacionPct ?? 7.0) / 100;
    const arancelRate = (quoterParams?.arancelPct ?? 6.0) / 100;
    const marginRate = (quoterParams?.margenPct ?? 5.0) / 100;

    let parentCounter = 0;
    let childCounter = 0;

    const quoterItems = assembledRows.map((row, idx) => {
      if (row.isParent) {
        parentCounter += 1;
        childCounter = 0;
      } else {
        childCounter += 1;
      }
      const lineNumber = row.isParent
        ? `${parentCounter}.0`
        : `${parentCounter}.0.${childCounter}`;

      const pNum = (row.partNumber || '').toUpperCase();
      const isIntangible =
        Boolean(row.durationMonths) ||
        pNum.includes('-DNA-') ||
        pNum.startsWith('DNA-') ||
        pNum.startsWith('LIC-') ||
        pNum.startsWith('CON-') ||
        pNum.startsWith('L-') ||
        pNum.startsWith('SVS-');
      const llevaArancel = !isIntangible;

      const unitListGpl = row.estimatedUnitListUsd || 0;
      const rowDiscPct = isPureGplMode
        ? 0
        : typeof row.clientDiscountPct === 'number' && row.clientDiscountPct > 0
          ? row.clientDiscountPct
          : row.isParent && row.fastTrackInfo
            ? row.fastTrackInfo.distributorDiscount || effectiveGlobalDisc
            : pNum.startsWith('CON-')
              ? Math.min(effectiveGlobalDisc, 22.65)
              : effectiveGlobalDisc;

      const netCiscoUnit = Number((unitListGpl * (1 - rowDiscPct / 100)).toFixed(2));
      const costoInternacion = isIntangible ? 0 : Number((netCiscoUnit * internacionRate).toFixed(2));
      const costoArancel = llevaArancel ? Number((netCiscoUnit * arancelRate).toFixed(2)) : 0;
      const costoTotalUnitario = Number(
        (netCiscoUnit + costoInternacion + costoArancel).toFixed(2)
      );
      const precioVentaUnitario =
        marginRate < 1
          ? Number((costoTotalUnitario / (1 - marginRate)).toFixed(2))
          : costoTotalUnitario;
      const qty = row.quantity > 0 ? row.quantity : 1;
      const precioVentaExtendido = Number((precioVentaUnitario * qty).toFixed(2));

      return {
        rowIdx: idx + 19,
        lineNumber,
        partNumber: row.partNumber,
        description: row.notes || row.partNumber,
        qty,
        unitListPrice: unitListGpl,
        netCiscoUnit,
        discPct: rowDiscPct,
        isIntangible,
        llevaArancel,
        costoInternacion,
        costoArancel,
        costoTotalUnitario,
        precioVentaUnitario,
        precioVentaExtendido,
        transformedLeadTime: isIntangible ? 'Entrega Digital (ED)' : '14-21 días',
        isFastTrackPromo: Boolean(row.fastTrackInfo),
      };
    });

    const totalListPrice = quoterItems.reduce((acc, i) => acc + i.unitListPrice * i.qty, 0);
    const totalNetCisco = quoterItems.reduce((acc, i) => acc + i.netCiscoUnit * i.qty, 0);
    const totalInternacion = quoterItems.reduce((acc, i) => acc + i.costoInternacion * i.qty, 0);
    const totalArancel = quoterItems.reduce((acc, i) => acc + i.costoArancel * i.qty, 0);
    const totalCostoIntcomex = quoterItems.reduce(
      (acc, i) => acc + i.costoTotalUnitario * i.qty,
      0
    );
    const totalCotizadoIntcomex = quoterItems.reduce((acc, i) => acc + i.precioVentaExtendido, 0);
    const totalMargenUsd = totalCotizadoIntcomex - totalCostoIntcomex;

    const cleanClient = (clientName || extractionResult.clientName || 'Cliente').trim();
    const estimateId = `CFG-${Date.now().toString().slice(-6)}`;
    const record: CloudEstimateRecord = {
      dealId: `BOM-${cleanClient.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CCW'}`,
      estimateId,
      partnerName: 'ConfigurIAtor Pre-Costeo GPL',
      clientFinalName: cleanClient,
      originalFileName: `ConfigurIAtor_${cleanClient.replace(/\s+/g, '_')}_GPL.xlsx`,
      createdAt: new Date().toISOString(),
      creator: {
        username: currentUser?.username || 'preventa',
        fullName: currentUser?.full_name || 'Arquitecto Cisco',
        email: currentUser?.email || '',
        role: currentUser?.role || 'admin',
      },
      financialSummary: {
        totalNetCisco,
        totalCotizadoIntcomex,
        gananciaIntcomexUsd: totalMargenUsd,
        margenPct:
          totalCotizadoIntcomex > 0 ? (totalMargenUsd / totalCotizadoIntcomex) * 100 : 5,
        currency: 'USD',
        params: quoterParams || { internacionPct: 7, arancelPct: 6, margenPct: 5 },
      },
      headerInfo: {
        customerName: 'ConfigurIAtor Pre-Costeo GPL',
        companyName: cleanClient,
        address: '',
        city: 'Santiago',
        country: 'Chile',
        phone: '',
        estimateId,
        dealId: 'PRE-COSTEO-GPL',
        priceList: 'Global Price List (GPL US$)',
        date: new Date().toISOString().slice(0, 10),
      },
      itemsCount: quoterItems.length,
      items: quoterItems,
      customOverrideMap: {},
    };

    await loadCloudEstimateIntoStore(record);
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

  // ============================================================================
  // IDEA 2 & IDEA 6: CÁLCULO EN VIVO DE BALANCE PoE (WATTS), VALORES DE LISTA (GPL) Y DESCUENTOS CCW (%)
  // ============================================================================
  const bomMetrics = useMemo(() => {
    let totalListUsd = 0;
    let totalEstimatedNetUsd = 0;
    let fastTrackCount = 0;
    let eolMigratedCount = 0;
    let coherentCorrectedCount = 0;

    const numericGlobalDisc = isPureGplMode
      ? 0
      : typeof globalDiscountPct === 'number'
        ? globalDiscountPct
        : 38;

    (extractionResult?.items || []).forEach((it) => {
      if (it.isNonExistentSku) coherentCorrectedCount += 1;
      else if (it.isEol2026) eolMigratedCount += 1;
    });

    for (const row of assembledRows) {
      const rowList = row.estimatedTotalListUsd || 0;
      totalListUsd += rowList;
      if (isPureGplMode) {
        totalEstimatedNetUsd += rowList;
        if (row.isParent && row.fastTrackInfo) fastTrackCount += 1;
      } else if (typeof row.clientDiscountPct === 'number' && row.clientDiscountPct > 0) {
        totalEstimatedNetUsd += rowList * (1 - row.clientDiscountPct / 100);
        if (row.isParent && row.fastTrackInfo) fastTrackCount += 1;
      } else if (row.isParent && row.fastTrackInfo) {
        fastTrackCount += 1;
        const disc = (row.fastTrackInfo.distributorDiscount || numericGlobalDisc || 45) / 100;
        totalEstimatedNetUsd += rowList * (1 - disc);
      } else {
        // Usar el descuento del analizador interactivo CCW (en CON-SNT SmartNet el descuento típico en CCW es ~22.65%)
        const isSupport = row.partNumber.startsWith('CON-');
        const effectivePct = isSupport
          ? Math.min(numericGlobalDisc, 22.65)
          : numericGlobalDisc;
        totalEstimatedNetUsd += rowList * (1 - effectivePct / 100);
      }
    }

    const totalSavingsUsd = Math.max(0, totalListUsd - totalEstimatedNetUsd);
    const effectiveAvgDiscountPct =
      totalListUsd > 0 ? Number(((totalSavingsUsd / totalListUsd) * 100).toFixed(2)) : 0;

    // Cálculo de Presupuesto PoE Entregado por Switches vs Demandado por APs / Teléfonos IP / Cámaras
    let totalPoeSupplyWatts = 0;
    let totalPoeDemandWatts = 0;
    let poeSwitchesCount = 0;
    let firstUpgradeableSwitchIdx: number | null = null;
    let poweredEndpointsSummary: string[] = [];

    (extractionResult?.items || []).forEach((it, idx) => {
      const qty = it.quantity > 0 ? it.quantity : 1;
      const parentRow = assembledRows.find((r) => r.parentIndex === idx && r.isParent);
      const activeSku = parentRow?.partNumber || it.suggestedActiveSku || '';
      const effectiveHwSku = parentRow?.resolvedChildModel
        ? `${activeSku}:${parentRow.resolvedChildModel}`
        : activeSku;
      const poeInfo = resolvePoeBudgetFromSku(effectiveHwSku);

      const isPoweredEndpointAp =
        it.deviceType === 'access_point' ||
        effectiveHwSku.startsWith('MR') ||
        effectiveHwSku.startsWith('CW91') ||
        effectiveHwSku.startsWith('C91');

      if (poeInfo.poeSupported && poeInfo.maxWatts > 0 && !isPoweredEndpointAp) {
        poeSwitchesCount += qty;
        const redundantBonus =
          it.includeRedundantPsu && (activeSku.startsWith('C9200') || activeSku.startsWith('C9300'))
            ? poeInfo.maxWatts * 0.8
            : 0;
        totalPoeSupplyWatts += (poeInfo.maxWatts + redundantBonus) * qty;

        if (
          firstUpgradeableSwitchIdx === null &&
          poeInfo.maxWatts <= 370 &&
          (effectiveHwSku.includes('48P') || effectiveHwSku.includes('24P'))
        ) {
          firstUpgradeableSwitchIdx = idx;
        }
      }

      // Consumo PoE estimado de equipos alimentados en el BOM
      if (isPoweredEndpointAp) {
        const wattsPerAp = effectiveHwSku.includes('9166') || effectiveHwSku.includes('MR56') ? 30 : 25;
        totalPoeDemandWatts += wattsPerAp * qty;
        poweredEndpointsSummary.push(`${qty}x AP (${wattsPerAp * qty}W)`);
      } else if (
        it.deviceType === 'collaboration' &&
        (effectiveHwSku.startsWith('DP-98') || effectiveHwSku.startsWith('CP-'))
      ) {
        const wattsPerPhone = 12;
        totalPoeDemandWatts += wattsPerPhone * qty;
        poweredEndpointsSummary.push(`${qty}x Teléfono IP (${wattsPerPhone * qty}W)`);
      }
    });

    const poeUtilizationPct =
      totalPoeSupplyWatts > 0
        ? Math.round((totalPoeDemandWatts / totalPoeSupplyWatts) * 100)
        : totalPoeDemandWatts > 0
          ? 100
          : 0;

    return {
      totalListUsd,
      totalEstimatedNetUsd,
      totalSavingsUsd,
      effectiveAvgDiscountPct,
      fastTrackCount,
      eolMigratedCount,
      coherentCorrectedCount,
      totalPoeSupplyWatts: Math.round(totalPoeSupplyWatts),
      totalPoeDemandWatts: Math.round(totalPoeDemandWatts),
      poeSwitchesCount,
      poeUtilizationPct,
      firstUpgradeableSwitchIdx,
      poweredEndpointsSummary,
    };
  }, [assembledRows, extractionResult, globalDiscountPct, isPureGplMode]);

  // Acción 1-Clic para subir un switch de 370W a Full PoE 740W cuando la alerta PoE lo sugiere
  const handleUpgradeSwitchToFullPoe = (idx: number) => {
    if (!extractionResult) return;
    const item = extractionResult.items[idx];
    if (!item) return;
    const currentSku = (item.selectedEolAlternativeSku || item.suggestedActiveSku || '').toUpperCase();
    let upgradedSku = currentSku;
    if (currentSku.startsWith('MS130-SWITCHES:MS130-48')) {
      upgradedSku = 'MS225-48FP-HW';
    } else if (currentSku.includes('C9200L-48P-')) {
      upgradedSku = currentSku.replace('C9200L-48P-', 'C9200L-48FP-');
    } else if (currentSku.includes('C9200-48P-')) {
      upgradedSku = currentSku.replace('C9200-48P-', 'C9200-48FP-');
    } else {
      updateParentItem(idx, { includeRedundantPsu: true });
      return;
    }
    updateParentItem(idx, {
      suggestedActiveSku: upgradedSku,
      selectedEolAlternativeSku: upgradedSku,
      poeBudget: 'full_poe',
    });
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
                Regla Crítica de Ensamblado Madre-Hijo Cisco CCW &bull; Norma Chile (CAB-IT)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                100% Vigente 2026 &bull; Estado VALID (Verde)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
              En la ventana <strong>'BOM Upload'</strong> de Cisco CCW mantén marcada la opción:{' '}
              <span className="px-2 py-0.5 rounded bg-emerald-900/80 border border-emerald-400/50 text-emerald-200 font-mono font-bold">
                ☑ Import Lines as assembled configurations
              </span>
              . Por defecto se incluye el cable de poder <strong>Norma Chile / Italia (CAB-IT: CAB-ACA / CAB-TA-IT)</strong>.
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
                ConfigurIAtor &bull; Full Cisco &amp; Meraki AI Architect (Madre-Hijo CCW)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                Gemini 3.7 Flash (Texto) &bull; 3.6/3.8 Flash (Visión)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950/80 text-cyan-300 border border-cyan-700/40 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Catálogo Vigente 2026 ({learnedSkusCount} SKUs &bull; Cero EOL)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cotiza Switching Catalyst, Meraki Cloud, Switches Industriales IE, Servidores UCS M7, Data Center Nexus, Seguridad FPR/MX y Colaboración DP-9800/Room Bar con cable <strong>CAB-IT (Norma Chile)</strong> por defecto.
            </p>
          </div>
        </div>

        {/* Controles ejecutivos: Ocultar/Mostrar barras, Limpiar BOM y Badge Portafolio */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Toggle Barra 1: Solicitud en Lenguaje Natural */}
          <button
            type="button"
            onClick={() => setIsPromptPanelOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPromptPanelOpen
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-600/50 shadow-md shadow-indigo-950/40'
            }`}
            title={
              isPromptPanelOpen
                ? 'Ocultar barra de Solicitud en Lenguaje Natural (Más espacio para la cotización)'
                : 'Mostrar barra de Solicitud en Lenguaje Natural'
            }
          >
            {isPromptPanelOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Ocultar Solicitud IA</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mostrar Solicitud IA</span>
              </>
            )}
          </button>

          {/* Toggle Barra 2: Módulos Principales (Sidebar de la aplicación) */}
          {onToggleNavSidebar && (
            <button
              type="button"
              onClick={onToggleNavSidebar}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isNavSidebarOpen
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600/50 shadow-md shadow-emerald-950/40'
              }`}
              title={
                isNavSidebarOpen
                  ? 'Ocultar barra lateral de Módulos Principales (Visión ultra limpia a pantalla completa)'
                  : 'Mostrar barra lateral de Módulos Principales'
              }
            >
              {isNavSidebarOpen ? (
                <>
                  <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ocultar Módulos</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mostrar Módulos</span>
                </>
              )}
            </button>
          )}

          {(inputText || pastedImage || assembledRows.length > 0) && (
            <button
              type="button"
              onClick={handleClearAllBom}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700/50 font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Limpiar solicitud y BOM actual para comenzar uno nuevo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar / Nuevo BOM (Clear)</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Portafolio: <strong className="text-emerald-300">Catalyst &bull; Meraki &bull; IE &bull; UCS M7 &bull; Nexus &bull; FPR &bull; Colab</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Barra Resumida cuando el Panel 1 de Solicitud IA está Oculto */}
      {!isPromptPanelOpen && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-700/40 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-indigo-300">1. Solicitud en Lenguaje Natural</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-700">
                  Cliente: {clientName || 'Cliente'}
                </span>
                {assembledRows.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-[10px] text-emerald-300 font-bold border border-emerald-700/40">
                    {totalParents} Chasis Madre &bull; {assembledRows.length} Líneas CCW
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-2xl mt-0.5">
                {inputText.trim() || (pastedImage ? '📸 Captura de pantalla analizada' : 'Sin texto escrito')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPromptPanelOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              title="Volver a mostrar y editar la solicitud en lenguaje natural o imagen"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mostrar / Editar Solicitud IA</span>
            </button>

            {onToggleNavSidebar && (
              <button
                type="button"
                onClick={onToggleNavSidebar}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title={isNavSidebarOpen ? 'Ocultar barra de módulos principales' : 'Mostrar barra de módulos principales'}
              >
                {isNavSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ocultar Módulos</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mostrar Módulos</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grilla Principal: Panel de Entrada IA (Izquierda) + Vista Previa Madre-Hijo CCW (Derecha) */}
      <div className={isPromptPanelOpen ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-6'}>
        {/* COLUMNA IZQUIERDA: Entrada Multimodal IA */}
        {isPromptPanelOpen && (
          <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>1. Solicitud en Lenguaje Natural o Screenshot (IA)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPromptPanelOpen(false)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-slate-200 border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                  title="Ocultar barra de solicitud para darle máxima visibilidad a la cotización"
                >
                  <ChevronUp className="w-3 h-3" />
                  <span>Ocultar</span>
                </button>
              </div>

            {/* Ejemplos rápidos para todo el portafolio */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Cotizar 1 switch Catalyst WS-C2960X-24PS-L con licencia por 3 años'
                  )
                }
                className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-[10px] font-bold text-emerald-300 border border-emerald-600/50 cursor-pointer transition-colors"
                title="Probar solicitud de 1 equipo EOL (WS-C2960X-24PS-L) con entrega de 3+ propuestas al 100% de homologación, Valor GPL (Sin Descuentos) y orden de prioridad"
              >
                Ej. 1 Equipo EOL (3 Propuestas GPL 100%)
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Cotizar 1 switch Meraki MS210-48FP con licencia por 3 años'
                  )
                }
                className="px-2 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 text-[10px] font-bold text-amber-300 border border-amber-700/50 cursor-pointer transition-colors"
                title="Cargar caso Meraki MS210-48FP (EOL -> 3 Propuestas Homologadas con Valor GPL)"
              >
                Ej. MS210-48FP (3 Propuestas)
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Mauricio, cotízame 2 switches de 24 bocas PoE Catalyst con 12 APs Wi-Fi 6 y licencia por 3 años'
                  )
                }
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-indigo-300 border border-slate-700 cursor-pointer transition-colors"
                title="Cargar caso Switching + Wi-Fi con cálculo PoE en vivo"
              >
                Ej. 24P + 12 APs
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputText(
                    'Necesito 1 servidor UCS C220-M6S, 2 switches industriales IE-2000-8TC-B PoE para faena minera, 1 firewall ASA5508-X y 10 teléfonos IP CP-7841-K9 por 3 años con SmartNet'
                  )
                }
                className="px-2 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-[10px] font-bold text-indigo-300 border border-indigo-700/50 cursor-pointer transition-colors"
                title="Probar Servidores UCS M7, Switches Industriales IE, Firewall FPR, Colaboración DP-9800 y SmartNet"
              >
                Ej. UCS + IE + FW + Colab
              </button>
            </div>
          </div>

          {/* Nombre del cliente y Selector de Cable de Poder Norma Chile (CAB-IT por defecto) */}
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                <Plug className="w-3 h-3" />
                <span>Cable de Poder (Por defecto Chile CAB-IT)</span>
              </label>
              <select
                value={defaultPowerCord}
                onChange={(e) => handleGlobalPowerCordChange(e.target.value as PowerCordStandard)}
                className="w-full bg-slate-950 border border-emerald-700/50 rounded-xl px-3 py-2 text-xs text-emerald-200 font-semibold focus:outline-none focus:border-emerald-500"
                title="En Chile se utiliza por defecto el cable Norma Italiana/Chilena CEI 23-16 (CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT). Si el cliente pide otro en texto o foto, se prioriza el del cliente."
              >
                <option value="italy_chile">
                  🇨🇱/🇮🇹 Italia / Norma Chile (CAB-IT: CAB-ACA / CAB-TA-IT) [Defecto]
                </option>
                <option value="rack_pdu">
                  🔌 Rack PDU Data Center (CAB-C13-C14-2M / CAB-C15-CBN)
                </option>
                <option value="schuko_eu">
                  🇪🇺 Schuko Europeo (CAB-ACE / CAB-TA-EU)
                </option>
                <option value="nema_us">
                  🇺🇸 NEMA 5-15P USA / Americano (CAB-AC / CAB-TA-NA)
                </option>
                <option value="argentina_iram">
                  🇦🇷 Argentina IRAM (CAB-ACR / CAB-TA-AR)
                </option>
              </select>
            </div>
          </div>

          {/* Textarea de correo / requerimiento en lenguaje natural */}
          <div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe o pega aquí el requerimiento del cliente en lenguaje natural (ej: 'Cotizar 1 switch Meraki MS210-48FP a 3 años', '2 switches industriales IE PoE, 1 servidor UCS M7 y 15 teléfonos IP') o pega un pantallazo con Ctrl + V..."
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
                  placeholder="Ej. IE-3300-8P2S-E, UCSC-C220-M7S, DP-9851-K9 o C9200L-48P-4X-E"
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
        )}

        {/* COLUMNA DERECHA: Estructura Madre-Hijo, Calculadora PoE, Pre-Cotización USD y Tabla 10 Columnas CCW */}
        <div className={isPromptPanelOpen ? 'lg:col-span-7 space-y-5' : 'w-full space-y-5'}>
          {/* Toast de confirmación de acciones ejecutivas */}
          {actionToast && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{actionToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionToast(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAuditAllCiscoApis}
                    disabled={isAuditingAllApis}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-600/50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    title="Auditar todos los equipos Madre en 1 clic contra las APIs de Cisco (EOL Cisco/Meraki, PSIRT y Datafoundation-POE)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {isAuditingAllApis ? 'Auditando APIs Cisco...' : 'Auditar Todo (Cisco APIs)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSmartNetAll}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-indigo-950 text-cyan-300 border border-cyan-700/40 text-xs font-bold transition-all cursor-pointer"
                    title="Agregar o quitar Soporte Oficial Cisco SmartNet (CON-SNT) en todos los equipos Madre"
                  >
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>+ SmartNet (CON-SNT) Todo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadProposalsComparisonExcel}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-600/50 text-xs font-bold transition-all cursor-pointer"
                    title="Descargar Excel Comparativo de las 3+ Propuestas Homologadas con Valor GPL (Sin Descuentos), % Homologación, Mejor Descuento y Sheet1 CCW"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Excel 3 Propuestas GPL</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendBomToIntcomexQuoter}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                    title="Enviar el BOM ensamblado con sus Valores GPL al Cotizador Intcomex principal para pre-costear Internación, Arancel (6% HW / 0% Licencias) y Margen"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Pre-Costear en Cotizador</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCcwExcel}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel CCW ({assembledRows.length} líneas)</span>
                  </button>
                </div>
              )}
            </div>

            {/* IDEA 6 MEJORADA: ANALIZADOR DE VALORES DE LISTA (GPL SIN DESCUENTOS), DESCUENTOS CCW (%) Y PRESUPUESTO PoE */}
            {assembledRows.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Resumen Financiero Preliminar USD + Simulador de Descuento CCW / Modo GPL Puro */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950 to-indigo-950/40 border border-indigo-500/30 flex flex-col justify-between gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Valor GPL (Sin Descuentos) &amp; Analizador de Descuentos CCW</span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-3 pt-1">
                        <div>
                          <span className="text-[10px] text-amber-300 font-bold block">
                            Valor GPL Total (Sin Descuento)
                          </span>
                          <span className="font-mono text-sm font-black text-white">
                            US${' '}
                            {bomMetrics.totalListUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="pl-3 border-l border-slate-800">
                          <span className="text-[10px] text-emerald-400 font-semibold block">
                            {isPureGplMode
                              ? 'Neto Modo GPL Puro (0% Dcto)'
                              : `Neto Est. (${bomMetrics.effectiveAvgDiscountPct.toFixed(1)}% Dcto Prom.)`}
                          </span>
                          <span className="font-mono text-sm font-black text-emerald-300">
                            US${' '}
                            {bomMetrics.totalEstimatedNetUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="pl-3 border-l border-slate-800">
                          <span className="text-[10px] text-cyan-300 font-semibold block">
                            Ahorro Total Dcto.
                          </span>
                          <span className="font-mono text-xs font-black text-cyan-200">
                            -US${' '}
                            {bomMetrics.totalSavingsUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => setIsPureGplMode((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all cursor-pointer block ${
                          isPureGplMode
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-200'
                        }`}
                        title="Alternar entre Vista Valor GPL Puro (0% Descuento) y Vista con Descuento Estimado CCW"
                      >
                        {isPureGplMode
                          ? '💵 Modo GPL Puro Activo (0% Dcto)'
                          : 'Ver solo Valor GPL (0% Dcto)'}
                      </button>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-950/90 border border-emerald-700/50 text-[10px] font-bold text-emerald-300 block">
                        {bomMetrics.fastTrackCount > 0
                          ? `⚡ ${bomMetrics.fastTrackCount} SKU Fast Track`
                          : 'Precios GPL CCW 2026'}
                      </span>
                    </div>
                  </div>

                  {/* Barra inferior: Simulador de % Descuento Global Partner/Deal Reg + Norma Cable */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-semibold">
                        Simular Dcto. Global Deal/Partner:
                      </span>
                      <div className="inline-flex items-center bg-slate-900 border border-indigo-500/40 rounded-lg px-2 py-0.5">
                        <input
                          type="number"
                          min={0}
                          max={95}
                          step={0.5}
                          disabled={isPureGplMode}
                          placeholder="Auto (38%)"
                          value={isPureGplMode ? 0 : globalDiscountPct === '' ? '' : globalDiscountPct}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setGlobalDiscountPct('');
                            } else {
                              setGlobalDiscountPct(Math.min(95, Math.max(0, Number(val))));
                            }
                          }}
                          className="w-16 bg-transparent text-emerald-300 font-mono font-bold text-xs focus:outline-none text-right disabled:opacity-50"
                        />
                        <span className="text-slate-400 font-mono ml-1">%</span>
                      </div>
                      {globalDiscountPct !== '' && !isPureGplMode && (
                        <button
                          type="button"
                          onClick={() => setGlobalDiscountPct('')}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Restaurar Auto
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Cable:{' '}
                      {defaultPowerCord === 'italy_chile'
                        ? '🇨🇱/🇮🇹 CAB-IT'
                        : defaultPowerCord === 'rack_pdu'
                          ? '🔌 PDU C13-C14/C15'
                          : defaultPowerCord === 'schuko_eu'
                            ? '🇪🇺 Schuko'
                            : defaultPowerCord === 'nema_us'
                              ? '🇺🇸 NEMA USA'
                              : '🇦🇷 IRAM AR'}
                    </span>
                  </div>
                </div>

                {/* Calculadora y Alerta Inteligente de Presupuesto PoE en Vivo */}
                <PoeBudgetCard
                  bomMetrics={bomMetrics}
                  onUpgradeSwitchToFullPoe={handleUpgradeSwitchToFullPoe}
                />
              </div>
            )}

            {!extractionResult || extractionResult.items.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">
                  Esperando instrucciones en lenguaje natural o captura de pantalla (Ctrl + V).
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  La IA analizará tu solicitud y armará automáticamente cada equipo <strong>MADRE (Chasis/Contenedor)</strong> junto con sus líneas <strong>HIJO (Hardware, Licencia DNA/Meraki, Fuente, Cable Norma Chile CAB-IT, Stack, SmartNet)</strong> y entregará <strong>al menos 3 propuestas homologadas con su Valor GPL (Sin Descuentos)</strong> ordenadas por prioridad.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* CO-PILOTO PREVENTA IA: AUDITORÍA PARALELA DE CONCORDANCIA LENGUAJE NATURAL vs BOM CCW */}
                <AiDiscrepancyCard
                  discrepancyReport={discrepancyReport}
                  showComplianceDetails={showComplianceDetails}
                  onToggleComplianceDetails={() => setShowComplianceDetails((prev) => !prev)}
                  onApplyDiscrepancyFix={handleApplyDiscrepancyFix}
                />

                {extractionResult.items.map((item, idx) => {
                  const parentRow = assembledRows.find((r) => r.parentIndex === idx && r.isParent);
                  const childRows = assembledRows.filter((r) => r.parentIndex === idx && !r.isParent);
                  const activeSku = parentRow?.partNumber || item.suggestedActiveSku || '';
                  const effectiveHardwareSku = parentRow?.resolvedChildModel
                    ? `${activeSku}:${parentRow.resolvedChildModel}`
                    : activeSku;
                  const poeInfo = resolvePoeBudgetFromSku(effectiveHardwareSku);
                  const itemAdvisories = psirtByIndex[idx] || [];
                  const itemProposals = proposalsByItemIdx[idx] || [];
                  const isSingleProductRequest = extractionResult.items.length === 1;
                  const showProposalsPanel =
                    isSingleProductRequest ||
                    Boolean(item.isEol2026) ||
                    Boolean(item.isNonExistentSku) ||
                    Boolean(parentRow?.wasReplacedFromEol) ||
                    Boolean(expandedProposalsByIdx[idx]);

                  const hasEolAlternative = Boolean(
                    !item.isNonExistentSku &&
                      item.rawMentionedSku &&
                      effectiveHardwareSku &&
                      item.rawMentionedSku.toUpperCase() !== effectiveHardwareSku.toUpperCase()
                  );

                  // Detectar si este equipo Madre es Meraki para mostrar el selector contextual Suscripción vs Co-Term
                  const isMerakiItem =
                    activeSku.startsWith('MR') ||
                    activeSku.startsWith('MS') ||
                    activeSku.startsWith('MX') ||
                    activeSku.startsWith('MV') ||
                    activeSku.endsWith('-MR');

                  // Detectar si el equipo soporta módulos SFP / Fibra / DAC
                  const supportsTransceivers =
                    item.deviceType === 'switch' ||
                    item.deviceType === 'industrial_switch' ||
                    item.deviceType === 'nexus_dc' ||
                    item.deviceType === 'router' ||
                    item.deviceType === 'firewall' ||
                    item.deviceType === 'server_ucs';

                  // Detectar si el equipo lleva cable de poder AC seleccionable (CAB-IT / PDU / Schuko / NEMA / IRAM)
                  const usesPowerCord =
                    !activeSku.startsWith('MR') &&
                    !activeSku.startsWith('CW91') &&
                    !activeSku.startsWith('DP-98');

                  return (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-xl bg-slate-950/90 border space-y-3 transition-all ${
                        item.isNonExistentSku
                          ? 'border-rose-600/70 hover:border-rose-500'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
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

                            {/* Badge Anti-Alucinación (SKU Inexistente) vs Reconciliación Coherente vs EOL vs Vigente 2026 */}
                            {item.isNonExistentSku ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-200 border border-rose-500/80 flex items-center gap-1">
                                <span>
                                  🚫 SKU INEXISTENTE EN CCW ({item.rawMentionedSku}) &bull; Alucinación Bloqueada
                                </span>
                              </span>
                            ) : parentRow?.wasReplacedFromEol ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 flex items-center gap-1">
                                <span>Reemplazo EOL 2026 (de {item.rawMentionedSku})</span>
                              </span>
                            ) : item.wasCorrectedFromClientTypo ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 flex items-center gap-1"
                                title={
                                  item.coherentCorrectionNote ||
                                  `Reconciliado coherentemente desde ${item.rawMentionedSku}`
                                }
                              >
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span>
                                  P/N Coherente Validado CCW (de {item.rawMentionedSku})
                                </span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-600/40">
                                Vigente 2026
                              </span>
                            )}

                            {/* Badge Prioridad #1 cuando el cliente pidió un cable específico en texto o foto */}
                            {item.clientRequestedPowerCord && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 flex items-center gap-1"
                                title={
                                  item.clientPowerCordLabel ||
                                  'Cable de poder solicitado explícitamente por el cliente en lenguaje natural o imagen'
                                }
                              >
                                <Plug className="w-3 h-3 text-emerald-400" />
                                <span>Cable Solicitado por Cliente (Prioridad #1)</span>
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

                            {/* Insignia Golden Template CCW Verificado (Cero Alucinaciones) */}
                            {parentRow?.isGoldenTemplate && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/25 text-amber-300 border border-amber-500/60 flex items-center gap-1 shadow-sm"
                                title={`${parentRow.goldenTemplateName || 'Plantilla Madre-Hijo'} • Verificada 100% en ${parentRow.goldenTemplateSource || 'Cisco CCW'}. Cero alucinaciones.`}
                              >
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>GOLDEN TEMPLATE CCW</span>
                              </span>
                            )}

                            {/* Valor GPL Unitario Chasis (Sin Descuento) y Valor GPL Solución Madre-Hijo (Sin Descuento) */}
                            {typeof parentRow?.unitChassisGplUsd === 'number' &&
                              parentRow.unitChassisGplUsd > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 text-amber-300 border border-amber-700/40"
                                  title="Valor GPL Unitario del Chasis físico sin descuentos"
                                >
                                  GPL Chasis (Sin Dcto): US${' '}
                                  {parentRow.unitChassisGplUsd.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              )}
                            {typeof parentRow?.totalSolutionGplUsd === 'number' &&
                              parentRow.totalSolutionGplUsd > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/50"
                                  title="Valor GPL Total de la Solución Madre-Hijo completa (Chasis + Licencia + Fuente/Cable) sin descuentos"
                                >
                                  GPL Solución Total (Sin Dcto): US${' '}
                                  {parentRow.totalSolutionGplUsd.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
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
                            <p
                              className={`text-[11px] font-medium ${
                                item.isNonExistentSku ? 'text-rose-300' : 'text-amber-300/90'
                              }`}
                            >
                              ↳ {parentRow.eolReason}
                            </p>
                          )}
                        </div>

                        {/* Botón Ver 3 Propuestas Homologadas, PSIRT, alternar SKU original vs Reemplazo EOL y botón eliminar */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {!isSingleProductRequest &&
                            !item.isEol2026 &&
                            !item.isNonExistentSku &&
                            !parentRow?.wasReplacedFromEol && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProposalsByIdx((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="px-2.5 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-[11px] font-bold text-indigo-200 border border-indigo-500/50 flex items-center gap-1 cursor-pointer"
                                title="Ver al menos 3 propuestas homologadas con su Valor GPL (Sin Descuentos) y ranking de prioridad"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  {expandedProposalsByIdx[idx]
                                    ? 'Ocultar 3 Propuestas GPL'
                                    : `Ver ${itemProposals.length} Propuestas Homologadas & GPL`}
                                </span>
                              </button>
                            )}

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

                      {/* ============================================================================
                          PANEL DE 3+ PROPUESTAS HOMOLOGADAS CON VALOR GPL (SIN DESCUENTOS) Y ORDEN DE PRIORIDAD
                          Se muestra automáticamente cuando piden 1 solo producto o cuando el equipo es EOL / Inexistente
                         ============================================================================ */}
                      {showProposalsPanel && itemProposals.length > 0 && (
                        <div
                          className={`p-3.5 rounded-xl border space-y-3 ${
                            item.isNonExistentSku
                              ? 'bg-rose-950/25 border-rose-500/50'
                              : item.isEol2026 || parentRow?.wasReplacedFromEol
                                ? 'bg-gradient-to-br from-amber-950/25 via-slate-950 to-indigo-950/30 border-amber-500/40'
                                : 'bg-gradient-to-br from-indigo-950/30 via-slate-950 to-emerald-950/20 border-indigo-500/40'
                          }`}
                        >
                          {/* Cabecera del Comparador de Propuestas + Selector de Prioridad + Acciones Ejecutivas */}
                          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
                            <div className="space-y-0.5">
                              <div className="flex items-center flex-wrap gap-2">
                                <span
                                  className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                    item.isNonExistentSku
                                      ? 'text-rose-300'
                                      : item.isEol2026 || parentRow?.wasReplacedFromEol
                                        ? 'text-amber-300'
                                        : 'text-emerald-300'
                                  }`}
                                >
                                  <Award className="w-4 h-4 text-amber-400" />
                                  <span>
                                    {item.isNonExistentSku
                                      ? `SKU Inexistente Bloqueado (${item.rawMentionedSku}) • ${itemProposals.length} Propuestas Oficiales con Valor GPL (Sin Descuento):`
                                      : item.isEol2026 || parentRow?.wasReplacedFromEol
                                        ? `Reemplazo EOL (${item.rawMentionedSku}) • ${itemProposals.length} Propuestas Homologadas al 100% con Valor GPL (Sin Descuento):`
                                        : `Comparativo de ${itemProposals.length} Propuestas Homologadas con Valor GPL (Sin Descuento) y Prioridad:`}
                                  </span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                                  100% Homologación Técnica &bull; Precios GPL Oficiales
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Ordenadas automáticamente por prioridad combinando <strong>Mejor % de Descuento (Fast Track / Promo)</strong> + <strong>Mayor % de Compatibilidad / Homologación (100%)</strong>. Haz clic en cualquier propuesta para cargarla en el ensamblado Madre-Hijo.
                              </p>
                            </div>

                            {/* Botones de Acción Rápida sobre las 3 Propuestas */}
                            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyProposalsSummary(idx)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Copiar resumen ejecutivo de las 3 propuestas con Valor GPL (Sin Descuento), % Homologación y Mejor Descuento para Correo / Teams / WhatsApp"
                              >
                                <Copy className="w-3 h-3 text-cyan-400" />
                                <span>Copiar 3 Propuestas GPL</span>
                              </button>

                              {extractionResult.items.length === 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleLoadAllThreeProposalsIntoBom(idx)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Cargar las 3 propuestas al mismo tiempo como bloques Madre-Hijo en el BOM para subirlas juntas a Cisco CCW"
                                >
                                  <Plus className="w-3 h-3 text-indigo-400" />
                                  <span>Cargar las 3 al BOM CCW</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Barra de Criterio de Ordenamiento de Prioridad (1-Clic) */}
                          <div className="flex items-center justify-between flex-wrap gap-2 text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-bold flex items-center gap-1 mr-1">
                                <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                                <span>Ordenar Prioridad por:</span>
                              </span>
                              {(
                                [
                                  {
                                    id: 'priority_optimal' as ProposalPrioritySortMode,
                                    label: '🏆 Prioridad: Mejor Dcto + % Homologación',
                                  },
                                  {
                                    id: 'highest_compatibility' as ProposalPrioritySortMode,
                                    label: '🎯 Mayor % Homologación (100%)',
                                  },
                                  {
                                    id: 'best_discount' as ProposalPrioritySortMode,
                                    label: '⚡ Mejor % Descuento (Fast Track)',
                                  },
                                  {
                                    id: 'lowest_gpl' as ProposalPrioritySortMode,
                                    label: '💵 Menor Valor GPL (Sin Descuento)',
                                  },
                                ] as const
                              ).map((modeOpt) => (
                                <button
                                  key={modeOpt.id}
                                  type="button"
                                  onClick={() => setProposalSortMode(modeOpt.id)}
                                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                                    proposalSortMode === modeOpt.id
                                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-indigo-500/50'
                                  }`}
                                >
                                  {modeOpt.label}
                                </button>
                              ))}
                            </div>

                            <span className="text-slate-400 font-mono">
                              Cant. Evaluada: <strong className="text-white">{item.quantity || 1}x</strong> &bull; Licencia:{' '}
                              <strong className="text-indigo-300">
                                {item.licenseTier || 'Essentials'} ({item.termYears || 3}Y)
                              </strong>
                            </span>
                          </div>

                          {/* Grilla de las 3+ Tarjetas de Propuestas Homologadas con Valor GPL (Sin Descuento) */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {itemProposals.map((prop) => {
                              const isSelected =
                                !item.keepOriginalSku &&
                                (effectiveHardwareSku.toUpperCase() ===
                                  prop.recommendedSku.toUpperCase() ||
                                  activeSku.toUpperCase() === prop.recommendedSku.toUpperCase());
                              const propPoe = resolvePoeBudgetFromSku(prop.recommendedSku);
                              const rawDisc = Number(prop.bestDiscountPct ?? prop.estimatedDiscountPct) || 0;
                              const effectiveDisc = isPureGplMode ? 0 : rawDisc;
                              const gplChassis = Number(prop.unitChassisGplUsd) || 0;
                              const gplSolutionUnit = Number(prop.unitSolutionGplUsd) || 0;
                              const gplSolutionTotal = Number(prop.totalSolutionGplUsd) || 0;
                              const estNetTotal =
                                Number(prop.totalEstimatedNetUsd ?? prop.estimatedTotalNetUsd) || 0;
                              const effectiveNetTotal = isPureGplMode ? gplSolutionTotal : estNetTotal;
                              const estSavings =
                                Number(prop.totalSavingsUsd ?? prop.estimatedSavingsUsd) || 0;
                              const effectiveSavings = isPureGplMode ? 0 : estSavings;
                              const subList = prop.subItemsSummary || prop.subItemsBreakdown || [];
                              const specsList = Array.isArray(prop.matchedSpecs)
                                ? prop.matchedSpecs
                                : [];

                              return (
                                <div
                                  key={prop.recommendedSku}
                                  onClick={() =>
                                    updateParentItem(idx, {
                                      selectedEolAlternativeSku: prop.recommendedSku,
                                      suggestedActiveSku: prop.recommendedSku,
                                      keepOriginalSku: false,
                                      discountPct: isPureGplMode ? 0 : rawDisc,
                                    })
                                  }
                                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                    isSelected
                                      ? 'bg-emerald-950/45 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                                      : prop.priorityRank === 1
                                        ? 'bg-slate-900/95 border-amber-500/50 hover:border-amber-400'
                                        : 'bg-slate-900/85 border-slate-800 hover:border-indigo-500/60'
                                  }`}
                                >
                                  <div className="space-y-2">
                                    {/* Fila superior: Prioridad #1/#2/#3 + % Homologación + % Mejor Descuento */}
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                            prop.priorityRank === 1
                                              ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                                              : 'bg-indigo-950 text-indigo-300 border border-indigo-700/40'
                                          }`}
                                        >
                                          {prop.priorityRank === 1
                                            ? '🏆 #1 PRIORIDAD ÓPTIMA'
                                            : `#${prop.priorityRank} PROPUESTA`}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                            (Number(prop.compatibilityPct) || 0) >= 100
                                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                                              : 'bg-cyan-950 text-cyan-300 border border-cyan-700/50'
                                          }`}
                                          title={prop.compatibilityLabel || prop.homologationLabel}
                                        >
                                          🎯 {Number(prop.compatibilityPct) || 100}% Homologación
                                        </span>
                                      </div>

                                      {isSelected && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 text-[9px] font-black uppercase">
                                          ✓ En BOM
                                        </span>
                                      )}
                                    </div>

                                    {/* SKU Madre + Estrategia + Descripción */}
                                    <div>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-mono text-xs font-black text-white">
                                          {prop.recommendedSku.includes(':')
                                            ? prop.recommendedSku.replace(':', ' → ')
                                            : prop.recommendedSku}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/40 font-mono text-[9px] font-bold">
                                          {isPureGplMode
                                            ? '0% Dcto (GPL)'
                                            : `⚡ ${effectiveDisc.toFixed(0)}% Dcto`}
                                        </span>
                                      </div>
                                      <div className="text-[11px] font-bold text-indigo-300 mt-0.5">
                                        {prop.title}
                                      </div>
                                      <div className="text-[9px] font-semibold text-amber-300/90 mt-0.5">
                                        {prop.strategyTag || 'Propuesta Homologada'} &bull;{' '}
                                        {prop.compatibilityLabel || prop.homologationLabel}
                                      </div>
                                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                        {prop.description}
                                      </p>
                                      {specsList.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {specsList.map((spec, spIdx) => (
                                            <span
                                              key={`${prop.recommendedSku}-spec-${spIdx}`}
                                              className="px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/40 text-[9px] font-semibold text-indigo-200"
                                            >
                                              ✓ {spec}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* CAJA FINANCIERA EXPLÍCITA: VALOR GPL (SIN DESCUENTOS) VS NETO ESTIMADO */}
                                    <div className="p-2.5 rounded-lg bg-slate-950/95 border border-slate-800/90 space-y-1.5 font-mono text-[10px]">
                                      <div className="flex items-center justify-between text-slate-300">
                                        <span className="font-sans text-[10px] text-slate-400">
                                          Valor GPL Chasis Unit. (Sin Dcto):
                                        </span>
                                        <span className="font-bold text-white">
                                          US${' '}
                                          {gplChassis.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-amber-200">
                                        <span className="font-sans text-[10px] text-amber-300/90 font-semibold">
                                          Valor GPL Solución Unit. (Sin Dcto):
                                        </span>
                                        <span className="font-bold text-amber-300">
                                          US${' '}
                                          {gplSolutionUnit.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                                        <span className="font-sans text-[10px] font-bold text-white">
                                          Valor GPL Total ({item.quantity || 1}x, Sin Dcto):
                                        </span>
                                        <span className="text-xs font-black text-amber-300">
                                          US${' '}
                                          {gplSolutionTotal.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                                        <span className="font-sans text-[10px] text-emerald-400 font-semibold">
                                          {isPureGplMode
                                            ? 'Total en Modo GPL Puro (0%):'
                                            : `Neto Est. (${effectiveDisc.toFixed(0)}% Dcto):`}
                                        </span>
                                        <span className="text-xs font-black text-emerald-300">
                                          US${' '}
                                          {effectiveNetTotal.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>

                                      {!isPureGplMode && effectiveSavings > 0 && (
                                        <div className="flex items-center justify-between text-[9px] text-cyan-300">
                                          <span className="font-sans">
                                            {prop.discountSourceLabel || prop.promoBadge}
                                          </span>
                                          <span>
                                            Ahorro: -US${' '}
                                            {effectiveSavings.toLocaleString('en-US', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Mini-desglose de Sub-SKUs Hijos incluidos en el Valor GPL de esta propuesta */}
                                    {subList.length > 0 && (
                                      <div className="space-y-1 pt-0.5">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                          Incluye en Solución Madre-Hijo ({subList.length} Hijos):
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {subList.map((subItem, sIdx) => (
                                            <span
                                              key={`${prop.recommendedSku}-sub-${sIdx}`}
                                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-300"
                                              title={`${subItem.description} • Valor GPL Sin Descuento: US$ ${(Number(subItem.totalGplUsd) || 0).toLocaleString('en-US')}`}
                                            >
                                              {subItem.qty}x {subItem.partNumber}
                                              {(Number(subItem.unitGplUsd) || 0) > 0
                                                ? ` (GPL $${(Number(subItem.unitGplUsd) || 0).toLocaleString('en-US')})`
                                                : ' (Inc.)'}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Footer de la tarjeta de propuesta: PoE + Botón Seleccionar */}
                                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px]">
                                    {propPoe.poeSupported ? (
                                      <span className="flex items-center gap-1 font-mono text-amber-300">
                                        <Zap className="w-3 h-3 text-amber-400" />
                                        <span>
                                          {propPoe.maxWatts}W ({propPoe.standard})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">
                                        Score Prioridad: {Number(prop.priorityScore) || 0} pts
                                      </span>
                                    )}

                                    <span
                                      className={`font-bold ${
                                        isSelected ? 'text-emerald-300' : 'text-indigo-300'
                                      }`}
                                    >
                                      {isSelected ? '✓ Propuesta Activa' : 'Elegir Propuesta →'}
                                    </span>
                                  </div>
                                </div>
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

                      {/* Controles rápidos de configuración de preventa (Cant, Licencia, Plazo, Enchufe CAB-IT/PDU, Meraki Mode, SmartNet) */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-900 text-xs">
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
                            className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                          />
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Tier:</span>
                          <select
                            value={item.licenseTier || 'Essentials'}
                            onChange={(e) =>
                              updateParentItem(idx, {
                                licenseTier: e.target.value as 'Essentials' | 'Advantage',
                              })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="Essentials">Essentials</option>
                            <option value="Advantage">Advantage</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Plazo:</span>
                          <select
                            value={item.termYears || 3}
                            onChange={(e) =>
                              updateParentItem(idx, { termYears: Number(e.target.value) || 3 })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value={1}>1 Año (12M)</option>
                            <option value={3}>3 Años (36M)</option>
                            <option value={5}>5 Años (60M)</option>
                            <option value={7}>7 Años (84M)</option>
                          </select>
                        </div>

                        {/* IDEA 3 MODIFICADA: Selector de Enchufe por equipo (CAB-IT Norma Chile por defecto o Prioridad #1 al Cliente) */}
                        {usesPowerCord && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] text-emerald-400 font-semibold">Cable:</span>
                            <select
                              value={item.powerCordStandard || defaultPowerCord}
                              onChange={(e) =>
                                updateParentItem(idx, {
                                  powerCordStandard: e.target.value as PowerCordStandard,
                                  clientRequestedPowerCord: true,
                                })
                              }
                              className="bg-slate-900 border border-emerald-700/50 rounded-lg px-2 py-1 text-[11px] text-emerald-200 font-semibold"
                              title="Cambiar cable de poder Hijo entre Norma Chile/Italia (CAB-IT), Rack PDU (C13-C14), Schuko, NEMA USA o Argentina"
                            >
                              <option value="italy_chile">🇨🇱/🇮🇹 CAB-IT (Chile/Italia)</option>
                              <option value="rack_pdu">🔌 PDU (C13-C14 / C15)</option>
                              <option value="schuko_eu">🇪🇺 Schuko (CAB-ACE)</option>
                              <option value="nema_us">🇺🇸 NEMA USA (CAB-AC / CAB-TA-NA)</option>
                              <option value="argentina_iram">🇦🇷 IRAM AR (CAB-ACR / CAB-TA-AR)</option>
                            </select>
                          </div>
                        )}

                        {/* IDEA 1: Selector contextual Meraki (Suscripción CCW vs Co-Term) SOLO cuando el ítem es Meraki */}
                        {isMerakiItem && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] text-indigo-300 font-semibold">Meraki Lic:</span>
                            <select
                              value={item.merakiLicenseMode || merakiLicenseMode}
                              onChange={(e) => {
                                const m = e.target.value as 'subscription' | 'coterm';
                                setMerakiLicenseMode(m);
                                updateParentItem(idx, { merakiLicenseMode: m });
                              }}
                              className="bg-indigo-950/70 border border-indigo-600/50 rounded-lg px-2 py-1 text-[11px] text-indigo-200 font-semibold"
                              title="Alternar entre Suscripción CCW (LIC-...-3Y con Duration) y Co-Termination Clásico (-3YR)"
                            >
                              <option value="subscription">Suscripción CCW (-3Y)</option>
                              <option value="coterm">Co-Term Clásico (-3YR)</option>
                            </select>
                          </div>
                        )}

                        {item.deviceType === 'switch' && !isMerakiItem && (
                          <>
                            <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.includeStacking)}
                                onChange={(e) =>
                                  updateParentItem(idx, { includeStacking: e.target.checked })
                                }
                                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <span>+ Stack</span>
                            </label>

                            <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.includeRedundantPsu)}
                                onChange={(e) =>
                                  updateParentItem(idx, { includeRedundantPsu: e.target.checked })
                                }
                                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                              />
                              <span>+ 2da PSU</span>
                            </label>
                          </>
                        )}

                        {/* IDEA 5: 1-Clic Soporte Oficial Cisco SmartNet (CON-SNT) */}
                        {!isMerakiItem && (
                          <div className="inline-flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-cyan-800/40">
                            <label className="inline-flex items-center space-x-1 cursor-pointer select-none text-[11px] text-cyan-300 font-semibold">
                              <input
                                type="checkbox"
                                checked={Boolean(item.includeSmartNet)}
                                onChange={(e) =>
                                  updateParentItem(idx, { includeSmartNet: e.target.checked })
                                }
                                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                              />
                              <span>+ SmartNet</span>
                            </label>
                            {item.includeSmartNet && (
                              <select
                                value={item.smartNetLevel || '8x5xNBD'}
                                onChange={(e) =>
                                  updateParentItem(idx, {
                                    smartNetLevel: e.target.value as '8x5xNBD' | '24x7x4',
                                  })
                                }
                                className="bg-slate-950 border border-cyan-700/50 rounded px-1.5 py-0.5 text-[10px] text-cyan-200 font-mono"
                              >
                                <option value="8x5xNBD">8x5xNBD (CON-SNT)</option>
                                <option value="24x7x4">24x7x4 (CON-SNTP)</option>
                              </select>
                            )}
                          </div>
                        )}

                        {/* Analizador por Línea: Valor de Lista Unitario USD y % Descuento */}
                        <div className="inline-flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-indigo-700/40">
                          <span className="text-[10px] text-indigo-300 font-bold">Lista USD:</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder={String(parentRow?.estimatedUnitListUsd || 0)}
                            value={
                              typeof item.unitListPriceUsd === 'number' && item.unitListPriceUsd > 0
                                ? item.unitListPriceUsd
                                : ''
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              updateParentItem(idx, {
                                unitListPriceUsd: val === '' ? undefined : Math.max(0, Number(val)),
                              });
                            }}
                            className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white font-mono text-right"
                            title="Ingresar o ajustar el Valor de Lista Unitario (GPL USD) si viene en la cotización del cliente"
                          />
                          <span className="text-[10px] text-emerald-300 font-bold ml-1">Dcto %:</span>
                          <input
                            type="number"
                            min={0}
                            max={95}
                            step={0.5}
                            placeholder={String(parentRow?.clientDiscountPct ?? 38)}
                            value={
                              typeof item.discountPct === 'number' && item.discountPct >= 0
                                ? item.discountPct
                                : ''
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              updateParentItem(idx, {
                                discountPct:
                                  val === '' ? undefined : Math.min(95, Math.max(0, Number(val))),
                              });
                            }}
                            className="w-14 bg-slate-950 border border-emerald-700/50 rounded px-1.5 py-0.5 text-[11px] text-emerald-300 font-mono text-right"
                            title="Porcentaje de descuento CCW o del cliente para analizar el Neto Estimado"
                          />
                        </div>
                      </div>

                      {/* IDEA 4: Asistente 1-Clic de Transceivers SFP / Fibra / DAC Vigentes 2026 */}
                      {supportsTransceivers && (
                        <div className="pt-1.5 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                              <Cable className="w-3 h-3 text-cyan-400" />
                              <span>+ Transceivers SFP Vigentes 2026:</span>
                            </span>
                            {COMPATIBLE_TRANSCEIVERS_2026.slice(0, 6).map((tr) => (
                              <button
                                key={tr.sku}
                                type="button"
                                onClick={() =>
                                  handleAddTransceiverToItem(
                                    idx,
                                    tr.sku,
                                    tr.defaultQty,
                                    tr.description
                                  )
                                }
                                className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-indigo-950 text-[10px] font-mono font-bold text-cyan-300 border border-slate-800 hover:border-cyan-600/50 cursor-pointer transition-colors"
                                title={`Agregar ${tr.defaultQty}x ${tr.sku} (${tr.description}) por equipo`}
                              >
                                {tr.label} ({tr.sku})
                              </button>
                            ))}
                          </div>

                          {/* Badges de transceivers activos en este equipo */}
                          {Array.isArray(item.extraTransceivers) && item.extraTransceivers.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.extraTransceivers.map((tr) => (
                                <span
                                  key={tr.sku}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-200"
                                >
                                  <span>
                                    {tr.qty}x {tr.sku}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTransceiverFromItem(idx, tr.sku)}
                                    className="text-cyan-400 hover:text-rose-300 cursor-pointer ml-0.5"
                                    title="Quitar transceiver"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-líneas HIJAS ensambladas */}
                      {childRows.length > 0 && (
                        <div className="pl-3 border-l-2 border-indigo-500/50 space-y-1.5 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                              ↳ Componentes HIJOS ensamblados automáticamente ({childRows.length}):
                            </div>
                            {parentRow?.isGoldenTemplate && (
                              <span className="text-[9px] font-bold text-amber-300/90 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-600/40 flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5 text-amber-400" />
                                <span>Árbol CCW Oficial Verificado</span>
                              </span>
                            )}
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
                                <span className="text-slate-400 truncate max-w-[280px]">
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
                                {typeof sub.estimatedTotalListUsd === 'number' &&
                                  sub.estimatedTotalListUsd > 0 && (
                                    <span className="text-slate-300 text-[10px]">
                                      Lista: US${' '}
                                      {sub.estimatedTotalListUsd.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  )}
                                {typeof sub.estimatedTotalNetUsd === 'number' &&
                                  sub.estimatedTotalNetUsd > 0 && (
                                    <span className="text-emerald-300 text-[10px] font-bold">
                                      Neto ({sub.clientDiscountPct ?? 38}%): US${' '}
                                      {sub.estimatedTotalNetUsd.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
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
          <CcwPreviewTable
            assembledRows={assembledRows}
            clientName={clientName}
          />
        </div>
      </div>

      {/* MODAL DE GESTIÓN MULTI-API Y ROTACIÓN DE TOKENS */}
      <ApiManagementModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        aiSettings={aiSettings}
        onToggleWebGrounding={handleToggleWebGrounding}
        newProvider={newProvider}
        setNewProvider={setNewProvider}
        newKeyModel={newKeyModel}
        setNewKeyModel={setNewKeyModel}
        newKeyLabel={newKeyLabel}
        setNewKeyLabel={setNewKeyLabel}
        newKeyValue={newKeyValue}
        setNewKeyValue={setNewKeyValue}
        onAddKey={handleAddKey}
        onToggleKey={handleToggleKey}
        onDeleteKey={handleDeleteKey}
      />

      {/* Modal de Estado y Pruebas de las 7 APIs Oficiales de Cisco */}
      <CiscoApiStatusModal
        isOpen={isCiscoSuiteModalOpen}
        onClose={() => setIsCiscoSuiteModalOpen(false)}
      />
    </div>
  );
};
