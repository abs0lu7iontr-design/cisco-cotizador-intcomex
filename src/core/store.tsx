// ============================================================================
// CISCO AUTOMATED v2.1 - CENTRALIZED REACTIVE STATE STORE
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  QuoteParameters,
  ProcessedEstimateResult,
  EstimateLineItem,
  OverrideRuleType,
  UserSession,
  DetectedAuditInfo,
  PricingParameterMode,
  LineParametersMap,
} from './types';
import {
  getLocalPlatformConfig,
  saveLocalPlatformConfig,
} from './storage/localPlatformConfig';
import { parseEstimateWorkbook } from './excelEngine';
import { recalculateEstimateResult } from './calculations';
import { enqueueOfflineAction, initOfflineSyncListeners } from './storage/offlineSyncQueue';
import { resolveEffectiveQuoteRates } from './exportUtils';
import { formatShortUserFirstName } from '../utils/userNameUtils';
import {
  auditEstimateWithFastTrack,
  FastTrackAuditResult,
} from '../modules/fasttrack';
import {
  CloudEstimateRecord,
  saveEstimateToCloud,
  saveOriginalV0Estimate,
  getEstimateVersionInfo,
  SharedSkuOverrideRecord,
  getSharedSkuRules,
  publishSharedSkuRules,
  ParamProfileRecord,
  resolveActiveParams,
  extractPartnerFromFilenameOrHeader,
} from '../modules/cloud';
import {
  executeSafeMiningAudit,
  AuditReport,
  inspectEstimateForMining,
  MiningAlertData,
  detectMiningFastTrackUsage,
  MiningFastTrackAlertData,
} from '../modules/mining';
import { detectCiscoFileType } from './fileTypeDetector';
import { clearEdgeSessionToken } from '../modules/security/edgeSessionService';
import {
  getDesktopPyWebViewApi,
  readLocalSkuOverrides,
  writeLocalSkuOverrides,
  normalizeOverrideRule,
  computeNextCycledRule,
  matchItemsWithSkuOverrides,
  filterUnappliedSharedSkuRules,
  persistProcessedEstimateHistory,
  buildRawV0EstimatePayload,
  reconstructProcessedResultFromCloudRecord,
  resolveFallbackPartnerAndClient,
} from './storePersistence';
import { checkAndApplyUpdateOnLogout } from './autoUpdateManager';

export type NavViewId =
  | 'dashboard'
  | 'quoter'
  | 'ccwr_quote'
  | 'pipeline'
  | 'forecast'
  | 'upload'
  | 'dsv'
  | 'configuriator'
  | 'estimates'
  | 'bo_tracking'
  | 'feedback'
  | 'users'
  | 'audit'
  | 'settings'
  | 'health'
  | 'stock_intelligence';

export const VALID_NAV_VIEWS: NavViewId[] = [
  'dashboard',
  'quoter',
  'ccwr_quote',
  'pipeline',
  'forecast',
  'upload',
  'dsv',
  'configuriator',
  'estimates',
  'bo_tracking',
  'feedback',
  'users',
  'audit',
  'settings',
  'health',
  'stock_intelligence',
];

export function getInitialNavView(): NavViewId {
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryView = searchParams.get('view') || searchParams.get('v');
      const hashView = window.location.hash.replace(/^#\/?/, '').trim();
      const candidate = (queryView || hashView || '').toLowerCase();
      if (VALID_NAV_VIEWS.includes(candidate as NavViewId)) {
        return candidate as NavViewId;
      }
    } catch {}
  }
  return 'dashboard';
}

export const DEFAULT_PARAMS: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'standard',
  lineCustomParams: {},
};

export interface MisroutedFileAlert {
  isOpen: boolean;
  detectedType: 'ccwr_quote' | 'ccw_estimate';
  fileName: string;
  buffer: ArrayBuffer;
  quoteNumber?: string;
  estimateId?: string;
  customerName?: string;
}

export interface CiscoAutomatedState {
  // Authentication & Session
  currentUser: UserSession | null;
  currentView: NavViewId;

  // Quoter Parameters
  params: QuoteParameters;

  // Partner Parameter Profile
  detectedPartner: string;
  setDetectedPartner: (partner: string) => void;
  activePartnerProfile: ParamProfileRecord | null;
  setActivePartnerProfile: (profile: ParamProfileRecord | null) => void;

  // Active Estimate Dataset
  rawWorkbookBuffer: ArrayBuffer | null;
  currentFileName: string;
  processedResult: ProcessedEstimateResult | null;
  customOverrideMap: Record<number, OverrideRuleType>;

  // SKU Overrides & Cloud Sharing State
  skuOverridesMap: Record<string, OverrideRuleType>;
  isSharedSkuManagerOpen: boolean;
  setIsSharedSkuManagerOpen: (open: boolean) => void;
  pendingSkuAuthOverrides: SharedSkuOverrideRecord[];
  skuAuthAuthorName: string;
  setPendingSkuAuthOverrides: (rules: SharedSkuOverrideRecord[], author?: string) => void;
  applyApprovedSkuOverrides: (approved: SharedSkuOverrideRecord[], persistPermanently: boolean) => Promise<void>;
  setSkuOverridesMap: React.Dispatch<React.SetStateAction<Record<string, OverrideRuleType>>>;

  // Fast Track Promo State
  fastTrackPromoMap: Record<number, number>;
  pendingFastTrackAudit: FastTrackAuditResult | null;
  isFastTrackOpportunityModalOpen: boolean;
  isFastTrackAdminModalOpen: boolean;

  // UI Status
  isProcessing: boolean;
  errorMessage: string | null;
  activeQuoterTab: 'excel' | 'table' | 'calculator';
  isSidebarOpen: boolean;
  isClientMode: boolean;
  setIsClientMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleClientMode: () => void;

  // Action Dispatchers
  setCurrentUser: (user: UserSession | null) => void;
  setCurrentView: (view: NavViewId) => void;
  setParams: (params: QuoteParameters | ((prev: QuoteParameters) => QuoteParameters)) => void;
  setActiveQuoterTab: (tab: 'excel' | 'table' | 'calculator') => void;
  setIsSidebarOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  setErrorMessage: (msg: string | null) => void;

  setIsFastTrackAdminModalOpen: (open: boolean) => void;
  setIsFastTrackOpportunityModalOpen: (open: boolean) => void;
  applyFastTrackPromos: () => Promise<void>;
  skipFastTrackPromos: () => void;

  // Prior Audit / Recalculation State
  isRecalculated: boolean;
  setIsRecalculated: (val: boolean) => void;
  detectedAudit: DetectedAuditInfo | null;
  setDetectedAudit: (audit: DetectedAuditInfo | null) => void;
  isDetectedAuditModalOpen: boolean;
  setIsDetectedAuditModalOpen: (open: boolean) => void;
  loadPriorAuditMargins: () => Promise<void>;
  dismissDetectedAuditModal: () => void;
  restoreOriginalUneditedEstimate: () => Promise<void>;

  // Custom Line Parameters Mode & Operations
  parameterMode: PricingParameterMode;
  setParameterMode: (mode: PricingParameterMode) => void;
  lineCustomParams: LineParametersMap;
  setLineCustomParam: (motherLine: string, field: 'internacionPct' | 'arancelPct' | 'margenPct', value: number) => void;
  resetLineCustomParams: (motherLine?: string) => void;
  setBatchLineCustomParams: (map: LineParametersMap) => void;

  // Mining & Industrial Conditions Audit
  miningAuditData: AuditReport | null;
  setMiningAuditData: (data: AuditReport | null) => void;
  isMiningAuditModalOpen: boolean;
  setIsMiningAuditModalOpen: (open: boolean) => void;

  // Mining Observer (Daniel Peña Special Discount Alert >= $150.000 USD)
  miningAlertData: MiningAlertData | null;
  setMiningAlertData: (data: MiningAlertData | null) => void;
  isMiningAlertModalOpen: boolean;
  setIsMiningAlertModalOpen: (open: boolean) => void;

  // Mining Observer: Fast Track Usage Warning
  miningFastTrackWarningData: MiningFastTrackAlertData | null;
  setMiningFastTrackWarningData: (data: MiningFastTrackAlertData | null) => void;
  isMiningFastTrackWarningModalOpen: boolean;
  setIsMiningFastTrackWarningModalOpen: (open: boolean) => void;

  // Multi-Version State (v0 RAW vs v1..vN Calculated)
  estimateVersionNumber: number;
  setEstimateVersionNumber: (v: number) => void;
  estimateVersionTag: string;
  baselineV0Amount: number;

  // Detección de Archivos Misrouted (ej: CCW-R en módulo CCW o viceversa)
  misroutedFileAlert: MisroutedFileAlert | null;
  setMisroutedFileAlert: (alert: MisroutedFileAlert | null) => void;
  pendingCcwrFile: { buffer: ArrayBuffer; fileName: string } | null;
  setPendingCcwrFile: (file: { buffer: ArrayBuffer; fileName: string } | null) => void;

  processFileBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  setRowRule: (rowIdx: number, rule: OverrideRuleType, sku?: string) => Promise<void>;
  cycleRowRule: (rowIdx: number) => Promise<void>;
  clearEstimate: () => void;
  loadDirectEstimateIntoStore: (estimate: ProcessedEstimateResult) => void;
  loadCloudEstimateIntoStore: (record: CloudEstimateRecord) => Promise<void>;
  saveCurrentEstimateToCloud: (
    options?: SaveEstimateCloudOptions
  ) => Promise<{
    success: boolean;
    id?: string;
    versionNumber?: number;
    versionTag?: string;
    error?: string;
  }>;
  logout: () => Promise<void>;
}

export interface SaveEstimateCloudOptions {
  partnerName?: string;
  clientFinalName?: string;
  modelName?: string;
  originalFileName?: string;
  isRestricted?: boolean;
  isLocalOnly?: boolean;
  storageScope?: 'cloud' | 'local_only';
  privacyLevel?: 'public' | 'restricted' | 'local_only';
  versionNumber?: number;
  versionTag?: string;
  autoIncrementIfExisting?: boolean;
  note?: string;
}

const CiscoAutomatedContext = createContext<CiscoAutomatedState | null>(null);

export const CiscoAutomatedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Dominio de Sesión y Navegación
  const [currentUser, setCurrentUserState] = useState<UserSession | null>(null);

  const setCurrentUser = useCallback((user: UserSession | null) => {
    setCurrentUserState(user);
    if (user?.username) {
      try {
        const localCfg = getLocalPlatformConfig();
        if (localCfg.rememberLastUser) {
          saveLocalPlatformConfig({ lastUsername: user.username });
        }
      } catch {}
    }
  }, []);

  const [currentView, setCurrentViewState] = useState<NavViewId>(getInitialNavView);

  const setCurrentView = useCallback((view: NavViewId) => {
    setCurrentViewState(view);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const url = new URL(window.location.href);
        if (view === 'dashboard') {
          url.searchParams.delete('view');
          url.searchParams.delete('v');
        } else {
          url.searchParams.set('view', view);
        }
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  }, []);

  // Sincronizar navegación al usar botones atrás/adelante del navegador
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const initial = getInitialNavView();
      setCurrentViewState(initial);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isClientMode, setIsClientModeState] = useState<boolean>(() => {
    try {
      return getLocalPlatformConfig().isClientMode;
    } catch {
      return false;
    }
  });

  const setIsClientMode = useCallback((valOrUpdater: React.SetStateAction<boolean>) => {
    setIsClientModeState((prev) => {
      const next = typeof valOrUpdater === 'function' ? valOrUpdater(prev) : valOrUpdater;
      try {
        saveLocalPlatformConfig({ isClientMode: next });
        localStorage.setItem('cisco_client_presentation_mode', String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleClientMode = useCallback(() => {
    setIsClientMode((prev) => !prev);
  }, [setIsClientMode]);

  useEffect(() => {
    const unsub = initOfflineSyncListeners();
    return unsub;
  }, []);

  // 2. Dominio de Parámetros Comerciales (cargados desde configuración local del equipo)
  const [params, setParamsState] = useState<QuoteParameters>(() => {
    try {
      const cfg = getLocalPlatformConfig();
      if (cfg?.defaultParams) {
        return {
          internacionPct: cfg.defaultParams.internacionPct ?? DEFAULT_PARAMS.internacionPct,
          arancelPct: cfg.defaultParams.arancelPct ?? DEFAULT_PARAMS.arancelPct,
          margenPct: cfg.defaultParams.margenPct ?? DEFAULT_PARAMS.margenPct,
          parameterMode: cfg.defaultParams.parameterMode || DEFAULT_PARAMS.parameterMode,
          lineCustomParams: {},
        };
      }
    } catch {}
    return DEFAULT_PARAMS;
  });

  const setParams = useCallback(
    (newParams: QuoteParameters | ((prev: QuoteParameters) => QuoteParameters)) => {
      setParamsState((prev) => {
        const resolved = typeof newParams === 'function' ? newParams(prev) : newParams;
        try {
          saveLocalPlatformConfig({
            defaultParams: {
              internacionPct: resolved.internacionPct,
              arancelPct: resolved.arancelPct,
              margenPct: resolved.margenPct,
              parameterMode: resolved.parameterMode || 'standard',
            },
          });
        } catch {}
        return resolved;
      });
    },
    []
  );

  const [detectedPartner, setDetectedPartner] = useState<string>('');
  const [activePartnerProfile, setActivePartnerProfile] = useState<ParamProfileRecord | null>(null);

  // 3. Dominio de Cotización Activa y Overrides
  const [rawWorkbookBuffer, setRawWorkbookBuffer] = useState<ArrayBuffer | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [processedResult, setProcessedResult] = useState<ProcessedEstimateResult | null>(null);
  const [customOverrideMap, setCustomOverrideMap] = useState<Record<number, OverrideRuleType>>({});
  const [skuOverridesMap, setSkuOverridesMap] = useState<Record<string, OverrideRuleType>>(() =>
    readLocalSkuOverrides()
  );
  const [isSharedSkuManagerOpen, setIsSharedSkuManagerOpen] = useState<boolean>(false);
  const [pendingSkuAuthOverrides, setPendingSkuAuthOverridesState] = useState<SharedSkuOverrideRecord[]>([]);
  const [skuAuthAuthorName, setSkuAuthAuthorName] = useState<string>('');

  const setPendingSkuAuthOverrides = useCallback((rules: SharedSkuOverrideRecord[], author?: string) => {
    setPendingSkuAuthOverridesState(rules);
    if (author) setSkuAuthAuthorName(author);
  }, []);

  // 4. Dominio de Promociones Fast Track
  const [fastTrackPromoMap, setFastTrackPromoMap] = useState<Record<number, number>>({});
  const [pendingFastTrackAudit, setPendingFastTrackAudit] = useState<FastTrackAuditResult | null>(null);
  const [isFastTrackOpportunityModalOpen, setIsFastTrackOpportunityModalOpen] = useState<boolean>(false);
  const [isFastTrackAdminModalOpen, setIsFastTrackAdminModalOpen] = useState<boolean>(false);

  // 5. Dominio de Versiones y Auditoría Previa
  const [isRecalculated, setIsRecalculated] = useState<boolean>(false);
  const [detectedAudit, setDetectedAudit] = useState<DetectedAuditInfo | null>(null);
  const [isDetectedAuditModalOpen, setIsDetectedAuditModalOpen] = useState<boolean>(false);
  const [estimateVersionNumber, setEstimateVersionNumber] = useState<number>(1);
  const [estimateVersionTag, setEstimateVersionTag] = useState<string>('v1');
  const [baselineV0Amount, setBaselineV0Amount] = useState<number>(0);

  // 6. Dominio de Auditoría y Observador de Minería
  const [miningAuditData, setMiningAuditData] = useState<AuditReport | null>(null);
  const [isMiningAuditModalOpen, setIsMiningAuditModalOpen] = useState<boolean>(false);
  const [miningAlertData, setMiningAlertData] = useState<MiningAlertData | null>(null);
  const [isMiningAlertModalOpen, setIsMiningAlertModalOpen] = useState<boolean>(false);
  const [miningFastTrackWarningData, setMiningFastTrackWarningData] = useState<MiningFastTrackAlertData | null>(null);
  const [isMiningFastTrackWarningModalOpen, setIsMiningFastTrackWarningModalOpen] = useState<boolean>(false);

  // 7. Alerta de Detección de Archivos Misrouted
  const [misroutedFileAlert, setMisroutedFileAlert] = useState<MisroutedFileAlert | null>(null);
  const [pendingCcwrFile, setPendingCcwrFile] = useState<{ buffer: ArrayBuffer; fileName: string } | null>(null);

  // 8. Controles de Interfaz
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQuoterTab, setActiveQuoterTabState] = useState<'excel' | 'table' | 'calculator'>(() => {
    try {
      return getLocalPlatformConfig().activeQuoterTab || 'excel';
    } catch {
      return 'excel';
    }
  });

  const setActiveQuoterTab = useCallback((tab: 'excel' | 'table' | 'calculator') => {
    setActiveQuoterTabState(tab);
    try {
      saveLocalPlatformConfig({ activeQuoterTab: tab });
    } catch {}
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Sincronización inicial con el puente Desktop (PyWebView) y almacenamiento local fuera de setState
  useEffect(() => {
    let isMounted = true;

    const syncWithNativeBridge = async () => {
      const desktopApi = getDesktopPyWebViewApi();
      if (!desktopApi || !isMounted) return;
      try {
        if (desktopApi.get_sku_overrides) {
          const res = await desktopApi.get_sku_overrides();
          if (res?.success && res.overrides && isMounted) {
            const merged = { ...readLocalSkuOverrides(), ...res.overrides };
            writeLocalSkuOverrides(merged);
            setSkuOverridesMap(merged);
          }
        }
        if (desktopApi.get_current_user && isMounted) {
          const user = await desktopApi.get_current_user();
          if (user && isMounted) {
            setCurrentUser(user);
          }
        }
      } catch (err) {
        console.warn('Bridge sync error:', err);
      }
    };

    const localOverrides = readLocalSkuOverrides();
    if (Object.keys(localOverrides).length > 0 && isMounted) {
      setSkuOverridesMap(localOverrides);
    }

    if (getDesktopPyWebViewApi()) {
      syncWithNativeBridge();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('pywebviewready', syncWithNativeBridge);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pywebviewready', syncWithNativeBridge);
      }
    };
  }, []);

  // Recálculo centralizado con cola protegida ante ejecuciones concurrentes
  const isComputingRef = useRef(false);
  const pendingRecomputeRef = useRef<{
    buffer: ArrayBuffer;
    params: QuoteParameters;
    fileName: string;
    overrides: Record<number, OverrideRuleType>;
    promoPrices?: Record<number, number>;
  } | null>(null);

  const recompute = useCallback(
    async (
      buffer: ArrayBuffer,
      currentParams: QuoteParameters,
      fileName: string,
      overrides: Record<number, OverrideRuleType>,
      promoPrices?: Record<number, number>
    ) => {
      if (isComputingRef.current) {
        pendingRecomputeRef.current = {
          buffer,
          params: currentParams,
          fileName,
          overrides,
          promoPrices,
        };
        return;
      }
      isComputingRef.current = true;
      try {
        const safeBuffer = buffer.slice(0);
        const activePromoMap = promoPrices !== undefined ? promoPrices : fastTrackPromoMap;
        const { result } = await parseEstimateWorkbook(
          safeBuffer,
          currentParams,
          fileName,
          overrides,
          activePromoMap,
          { forceParams: true }
        );
        setProcessedResult(result);
        persistProcessedEstimateHistory(result, fileName, currentUser);
      } catch (err: unknown) {
        console.error('Error recalculating estimate:', err);
        const msg = err instanceof Error ? err.message : String(err ?? '');
        setErrorMessage(
          msg.includes('central directory')
            ? 'El archivo seleccionado no es un libro Excel (.xlsx) válido o está dañado. Por favor asegúrate de seleccionar un archivo de cotización Excel (.xlsx) de Cisco CCW.'
            : msg || 'Error al procesar el archivo Excel. Asegúrate de subir un archivo .xlsx válido de Cisco CCW.'
        );
      } finally {
        isComputingRef.current = false;
        if (pendingRecomputeRef.current) {
          const next = pendingRecomputeRef.current;
          pendingRecomputeRef.current = null;
          recompute(next.buffer, next.params, next.fileName, next.overrides, next.promoPrices);
        }
      }
    },
    [currentUser, fastTrackPromoMap]
  );

  const isLoadingBufferRef = useRef<boolean>(false);

  // Recalcular en memoria al cambiar parámetros, overrides o promociones Fast Track
  useEffect(() => {
    if (isLoadingBufferRef.current) return;
    if (processedResult && processedResult.items && processedResult.items.length > 0) {
      setProcessedResult((prev) =>
        prev ? recalculateEstimateResult(prev, params, customOverrideMap, fastTrackPromoMap) : prev
      );
    } else if (rawWorkbookBuffer && currentFileName) {
      recompute(rawWorkbookBuffer.slice(0), params, currentFileName, customOverrideMap, fastTrackPromoMap);
    }
  }, [params, customOverrideMap, fastTrackPromoMap]);

  const processFileBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      isLoadingBufferRef.current = true;
      setIsProcessing(true);
      setErrorMessage(null);

      try {
        const safeBuffer = buffer.slice(0);

        // Verificación de formato: Detección proactiva de cotizaciones CCW-R en el módulo de Estimate
        const detection = detectCiscoFileType(safeBuffer);
        if (detection.fileType === 'ccwr_quote') {
          setMisroutedFileAlert({
            isOpen: true,
            detectedType: 'ccwr_quote',
            fileName,
            buffer: safeBuffer,
            quoteNumber: detection.quoteNumber,
            customerName: detection.customerName,
          });
          setIsProcessing(false);
          return;
        }

        setFastTrackPromoMap({});
        setRawWorkbookBuffer(safeBuffer);
        setCurrentFileName(fileName);

        const currentMap: Record<string, OverrideRuleType> = {
          ...readLocalSkuOverrides(),
          ...skuOverridesMap,
        };

        const { result: rawResult } = await parseEstimateWorkbook(
          safeBuffer.slice(0),
          DEFAULT_PARAMS,
          fileName,
          {}
        );

        const partner = extractPartnerFromFilenameOrHeader(
          fileName,
          rawResult?.headerInfo?.companyName
        );
        setDetectedPartner(partner);

        const { params: resolvedParams, appliedProfile } = await resolveActiveParams(partner);
        setActivePartnerProfile(appliedProfile);
        const activeInitialParams = resolvedParams;

        const rawEstId = (rawResult?.headerInfo?.estimateId || '').trim();
        let currentVerNum = 1;
        let currentVerTag = 'v1';
        let baseV0Cost = rawResult?.originalProductTotal || 0;

        if (rawEstId && rawEstId.toUpperCase() !== 'NA' && rawEstId.toUpperCase() !== 'ESTIMATE') {
          try {
            const verInfo = await getEstimateVersionInfo(
              rawEstId,
              rawResult?.headerInfo?.dealId,
              fileName
            );
            if (!verInfo.exists && rawResult) {
              const rawV0Payload = buildRawV0EstimatePayload(
                rawResult,
                rawEstId,
                partner,
                fileName,
                baseV0Cost,
                currentUser,
                DEFAULT_PARAMS
              );
              saveOriginalV0Estimate(rawV0Payload).catch((e) =>
                console.warn('Background v0 auto-save warning:', e)
              );
              currentVerNum = 1;
              currentVerTag = 'v1';
            } else if (verInfo.exists) {
              currentVerNum = verInfo.nextVersionNumber;
              currentVerTag = verInfo.nextVersionTag;
              if (verInfo.baselineV0Amount > 0) {
                baseV0Cost = verInfo.baselineV0Amount;
              }
              setIsRecalculated(true);
            }
          } catch (verErr) {
            console.warn('Error verificando versión de estimate:', verErr);
          }
        }

        setEstimateVersionNumber(currentVerNum);
        setEstimateVersionTag(currentVerTag);
        setBaselineV0Amount(baseV0Cost);

        if (rawResult?.detectedAudit?.isRecalculated) {
          const priorInt = rawResult.detectedAudit.previousInternacionPct;
          const priorAr = rawResult.detectedAudit.previousArancelPct ?? 6.0;
          const priorMarg = rawResult.detectedAudit.previousMarginPct;
          const priorMode =
            rawResult.detectedAudit.parameterMode ||
            (rawResult.detectedAudit.hasCustomLineParams ? 'custom_lines' : 'standard');
          const priorCustomLines = rawResult.detectedAudit.lineCustomParams || {};

          const restoredParams: QuoteParameters = {
            internacionPct: priorInt,
            arancelPct: priorAr,
            margenPct: priorMarg,
            parameterMode: priorMode,
            lineCustomParams: priorCustomLines,
          };

          setParams(restoredParams);
          setIsRecalculated(true);
          setDetectedAudit(rawResult.detectedAudit);
          setIsDetectedAuditModalOpen(true);
        } else {
          setIsRecalculated(currentVerNum > 1);
          setDetectedAudit(null);
          setIsDetectedAuditModalOpen(false);
          setParams(resolvedParams);
        }

        const matchedOverrides = matchItemsWithSkuOverrides(rawResult?.items, currentMap);
        setCustomOverrideMap(matchedOverrides);

        const hasCustomParams =
          !rawResult?.detectedAudit?.isRecalculated &&
          (activeInitialParams.internacionPct !== DEFAULT_PARAMS.internacionPct ||
            activeInitialParams.arancelPct !== DEFAULT_PARAMS.arancelPct ||
            activeInitialParams.margenPct !== DEFAULT_PARAMS.margenPct);

        if (Object.keys(matchedOverrides).length > 0 || hasCustomParams) {
          await recompute(
            safeBuffer.slice(0),
            activeInitialParams,
            fileName,
            matchedOverrides,
            {}
          );
        } else {
          setProcessedResult(rawResult);
        }

        try {
          const sharedRes = await getSharedSkuRules();
          if (sharedRes.success && sharedRes.data && sharedRes.data.length > 0) {
            const unappliedShared = filterUnappliedSharedSkuRules(
              sharedRes.data,
              rawResult?.items,
              currentMap,
              currentUser
            );
            if (unappliedShared.length > 0) {
              setPendingSkuAuthOverridesState(unappliedShared);
              setSkuAuthAuthorName(unappliedShared[0]?.author?.fullName || 'Product Manager');
            }
          }
        } catch {
          // Ignore shared rules fetch warnings in offline mode
        }

        const auditReport = executeSafeMiningAudit({
          ...rawResult,
          fileName: fileName || currentFileName,
        });
        if (auditReport && auditReport.overallStatus !== 'NO_RULES') {
          setMiningAuditData(auditReport);
        } else {
          setMiningAuditData(null);
        }

        const miningInspection: MiningAlertData = inspectEstimateForMining(
          fileName || currentFileName,
          rawResult?.items || [],
          rawResult?.headerInfo?.dealId || null
        );
        if (miningInspection.shouldAlert) {
          setMiningAlertData(miningInspection);
          setIsMiningAlertModalOpen(true);
        } else {
          setMiningAlertData(null);
          setIsMiningAlertModalOpen(false);
        }

        const isMiningAccount =
          Boolean(miningInspection?.isMining) ||
          Boolean(
            auditReport && auditReport.overallStatus !== 'NO_RULES' && auditReport.matchedAccount
          );

        const matchedMiningName =
          auditReport?.matchedAccount?.groupName ||
          miningInspection?.matchedKeyword?.toUpperCase() ||
          rawResult?.headerInfo?.companyName ||
          'Cuenta Minera';

        if (isMiningAccount) {
          setPendingFastTrackAudit(null);
          setIsFastTrackOpportunityModalOpen(false);

          const ftMiningAlert = await detectMiningFastTrackUsage(
            rawResult.items,
            true,
            matchedMiningName
          );
          if (ftMiningAlert.shouldAlert) {
            setMiningFastTrackWarningData(ftMiningAlert);
            setIsMiningFastTrackWarningModalOpen(true);
          } else {
            setMiningFastTrackWarningData(null);
            setIsMiningFastTrackWarningModalOpen(false);
          }
        } else {
          setMiningFastTrackWarningData(null);
          setIsMiningFastTrackWarningModalOpen(false);

          const auditRes = await auditEstimateWithFastTrack(rawResult.items);
          if (auditRes && auditRes.hasOpportunity) {
            setPendingFastTrackAudit(auditRes);
            setIsFastTrackOpportunityModalOpen(true);
          } else {
            setPendingFastTrackAudit(null);
            setIsFastTrackOpportunityModalOpen(false);
          }
        }
      } catch (err: unknown) {
        console.error('Error processing workbook:', err);
        const msg = err instanceof Error ? err.message : String(err ?? '');
        setErrorMessage(
          msg.includes('central directory')
            ? 'El archivo seleccionado no es un libro Excel (.xlsx) válido o está dañado. Por favor asegúrate de seleccionar un archivo de cotización Excel (.xlsx) de Cisco CCW.'
            : msg || 'Error procesando archivo.'
        );
      } finally {
        isLoadingBufferRef.current = false;
        setIsProcessing(false);
      }
    },
    [recompute, skuOverridesMap, currentUser, currentFileName]
  );

  const applyApprovedSkuOverrides = useCallback(
    async (approved: SharedSkuOverrideRecord[], persistPermanently: boolean) => {
      const updatedSkuMap: Record<string, OverrideRuleType> = { ...skuOverridesMap };
      approved.forEach((r) => {
        updatedSkuMap[r.sku.toUpperCase()] = normalizeOverrideRule(r.rule);
      });

      if (persistPermanently) {
        writeLocalSkuOverrides(updatedSkuMap);
      }

      setSkuOverridesMap(updatedSkuMap);
      setPendingSkuAuthOverridesState([]);

      if (processedResult && rawWorkbookBuffer && currentFileName) {
        const updatedCustomMap: Record<number, OverrideRuleType> = {
          ...customOverrideMap,
          ...matchItemsWithSkuOverrides(processedResult.items, updatedSkuMap),
        };
        setCustomOverrideMap(updatedCustomMap);
        await recompute(
          rawWorkbookBuffer.slice(0),
          params,
          currentFileName,
          updatedCustomMap,
          fastTrackPromoMap
        );
      }
    },
    [
      skuOverridesMap,
      processedResult,
      rawWorkbookBuffer,
      currentFileName,
      customOverrideMap,
      params,
      fastTrackPromoMap,
      recompute,
    ]
  );

  const applyFastTrackPromos = useCallback(async () => {
    if (!pendingFastTrackAudit || !rawWorkbookBuffer || !currentFileName) {
      setIsFastTrackOpportunityModalOpen(false);
      return;
    }

    const newPromoMap: Record<number, number> = {};
    pendingFastTrackAudit.matches.forEach((m) => {
      newPromoMap[m.rowIdx] = m.promoUnitNetPrice;
    });

    setFastTrackPromoMap(newPromoMap);
    setPendingFastTrackAudit(null);
    setIsFastTrackOpportunityModalOpen(false);

    await recompute(
      rawWorkbookBuffer.slice(0),
      params,
      currentFileName,
      customOverrideMap,
      newPromoMap
    );
  }, [pendingFastTrackAudit, rawWorkbookBuffer, currentFileName, params, customOverrideMap, recompute]);

  const skipFastTrackPromos = useCallback(() => {
    setPendingFastTrackAudit(null);
    setIsFastTrackOpportunityModalOpen(false);
  }, []);

  const setRowRule = useCallback(
    async (rowIdx: number, rule: OverrideRuleType, sku?: string) => {
      const normRule = normalizeOverrideRule(rule);
      const targetItem = processedResult?.items.find((i) => i.rowIdx === rowIdx);
      const itemSku = sku || targetItem?.partNumber;
      const cleanSku = itemSku ? itemSku.trim().toUpperCase() : undefined;

      const updatedMap: Record<number, OverrideRuleType> = {
        ...customOverrideMap,
        [rowIdx]: normRule,
      };

      if (cleanSku && processedResult?.items) {
        processedResult.items.forEach((it) => {
          if ((it.partNumber || '').trim().toUpperCase() === cleanSku) {
            updatedMap[it.rowIdx] = normRule;
          }
        });
      }

      setCustomOverrideMap(updatedMap);

      if (processedResult) {
        setProcessedResult((prev) =>
          prev ? recalculateEstimateResult(prev, params, updatedMap, fastTrackPromoMap) : prev
        );
      }

      if (cleanSku) {
        const updated: Record<string, OverrideRuleType> = {
          ...skuOverridesMap,
          [cleanSku]: normRule,
        };
        writeLocalSkuOverrides(updated);
        setSkuOverridesMap(updated);

        const prevTypeName = targetItem?.isIntangible
          ? 'Intangible'
          : targetItem?.llevaArancel
            ? 'Arancel Especial'
            : 'Hardware';

        const authorInfo = {
          username: currentUser?.username || 'pm_user',
          fullName: currentUser?.full_name || 'Product Manager',
          role: String(currentUser?.role || 'pm'),
        };
        const record: SharedSkuOverrideRecord = {
          sku: cleanSku,
          rule: normRule,
          previousType: prevTypeName,
          author: authorInfo,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        publishSharedSkuRules([record], authorInfo).catch(() => {});

        const desktopApi = getDesktopPyWebViewApi();
        if (desktopApi?.save_sku_override) {
          try {
            await desktopApi.save_sku_override(cleanSku, normRule);
          } catch (e) {
            console.warn('Desktop override save error:', e);
          }
        }
      }
    },
    [processedResult, skuOverridesMap, currentUser, customOverrideMap, params, fastTrackPromoMap]
  );

  const cycleRowRule = useCallback(
    async (rowIdx: number) => {
      const currentItem = processedResult?.items.find((i) => i.rowIdx === rowIdx);
      if (!currentItem) return;
      const nextRule = computeNextCycledRule(currentItem);
      await setRowRule(rowIdx, nextRule, currentItem.partNumber);
    },
    [processedResult, setRowRule]
  );

  const loadCloudEstimateIntoStore = useCallback(async (record: CloudEstimateRecord) => {
    try {
      setIsProcessing(true);
      setRawWorkbookBuffer(null);
      setDetectedAudit(null);
      setIsDetectedAuditModalOpen(false);
      setPendingFastTrackAudit(null);
      setIsFastTrackOpportunityModalOpen(false);
      setActivePartnerProfile(null);
      setDetectedPartner(record.partnerName || record.headerInfo?.companyName || '');

      if (record.financialSummary?.params) {
        setParams(record.financialSummary.params);
      } else {
        setParams(DEFAULT_PARAMS);
      }

      setCustomOverrideMap(record.customOverrideMap || {});
      setFastTrackPromoMap(record.fastTrackPromoMap || {});

      const {
        processedResult: nextResult,
        reconstructedItems,
        totalNetCisco,
        totalVenta,
        activeVersion,
        activeVersionTag,
        baselineV0Amount: baseV0,
      } = reconstructProcessedResultFromCloudRecord(record);

      setProcessedResult(nextResult);
      setCurrentFileName(nextResult.fileName || '');
      setCurrentView('quoter');
      setActiveQuoterTab('table');

      setEstimateVersionNumber(activeVersion);
      setEstimateVersionTag(activeVersionTag);
      setBaselineV0Amount(baseV0);
      setIsRecalculated(activeVersion > 1);

      const auditReport = executeSafeMiningAudit({
        headerInfo: nextResult.headerInfo,
        items: reconstructedItems,
        originalProductTotal: totalNetCisco,
        calculatedProductTotal: totalVenta,
        fileName: record.originalFileName || '',
      });
      if (auditReport && auditReport.overallStatus !== 'NO_RULES') {
        setMiningAuditData(auditReport);
      } else {
        setMiningAuditData(null);
      }

      const miningInspection: MiningAlertData = inspectEstimateForMining(
        record.originalFileName || '',
        reconstructedItems,
        record.headerInfo?.dealId || null
      );
      if (miningInspection.shouldAlert) {
        setMiningAlertData(miningInspection);
        setIsMiningAlertModalOpen(true);
      } else {
        setMiningAlertData(null);
        setIsMiningAlertModalOpen(false);
      }

      const isMiningAccount =
        Boolean(miningInspection?.isMining) ||
        Boolean(
          auditReport && auditReport.overallStatus !== 'NO_RULES' && auditReport.matchedAccount
        );

      if (isMiningAccount) {
        const ftMiningAlert = await detectMiningFastTrackUsage(
          reconstructedItems,
          true,
          auditReport?.matchedAccount?.groupName || miningInspection?.matchedKeyword?.toUpperCase()
        );
        if (ftMiningAlert.shouldAlert) {
          setMiningFastTrackWarningData(ftMiningAlert);
          setIsMiningFastTrackWarningModalOpen(true);
        } else {
          setMiningFastTrackWarningData(null);
          setIsMiningFastTrackWarningModalOpen(false);
        }
      } else {
        setMiningFastTrackWarningData(null);
        setIsMiningFastTrackWarningModalOpen(false);
      }
    } catch (err: unknown) {
      console.error('Error cargando cotización desde la nube:', err);
      const msg = err instanceof Error ? err.message : String(err ?? '');
      setErrorMessage(`Error restaurando cotización: ${msg || 'Datos corruptos'}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadDirectEstimateIntoStore = useCallback((estimate: ProcessedEstimateResult) => {
    setRawWorkbookBuffer(null);
    setCustomOverrideMap({});
    setFastTrackPromoMap({});
    setDetectedAudit(null);
    setIsDetectedAuditModalOpen(false);
    setPendingFastTrackAudit(null);
    setIsFastTrackOpportunityModalOpen(false);
    setMiningAuditData(null);
    setMiningAlertData(null);
    setIsMiningAlertModalOpen(false);
    setMiningFastTrackWarningData(null);
    setIsMiningFastTrackWarningModalOpen(false);
    setActivePartnerProfile(null);
    setErrorMessage(null);
    setEstimateVersionNumber(1);
    setEstimateVersionTag('v1');
    setBaselineV0Amount(0);
    setProcessedResult(estimate);
    setCurrentFileName(estimate.fileName || `Cisco_API_${estimate.headerInfo?.estimateId || 'Estimate'}.xlsx`);
    setDetectedPartner(estimate.headerInfo?.companyName || estimate.headerInfo?.customerName || '');
    setCurrentView('quoter');
    setActiveQuoterTab('table');
    setIsRecalculated(false);
  }, []);

  const saveCurrentEstimateToCloud = useCallback(
    async (options?: SaveEstimateCloudOptions) => {
      if (!processedResult) {
        return { success: false, error: 'No hay ninguna cotización activa para guardar.' };
      }

      // netCiscoUnit y costoTotalUnitario en EstimateLineItem YA contemplan la duración contractual (safeMonths);
      // volver a multiplicar por months subestimaba ganancia a $0 en licencias periódicas Meraki.
      const totalNetCisco =
        processedResult.originalProductTotal ||
        processedResult.items.reduce(
          (sum, i) =>
            sum + (i.isInfoRow ? 0 : (i.netCiscoUnit || 0) * (i.qty ?? 0)),
          0
        );
      const totalVenta =
        processedResult.finalTotalPrice || processedResult.calculatedProductTotal || 0;
      const totalCosto = processedResult.items.reduce(
        (sum, i) =>
          sum + (i.isInfoRow ? 0 : (i.costoTotalUnitario || 0) * (i.qty ?? 0)),
        0
      );
      const profit = Math.max(0, totalVenta - (totalCosto > 0 ? totalCosto : totalNetCisco));

      const { resolvedPartner, resolvedClient } = resolveFallbackPartnerAndClient(
        processedResult,
        detectedPartner,
        currentFileName,
        options?.partnerName,
        options?.clientFinalName
      );

      const resolvedFileName = (
        options?.originalFileName ||
        currentFileName ||
        `${processedResult.headerInfo.estimateId || 'Estimate'}.xlsx`
      ).trim();

      const isLocalOnly = Boolean(
        options?.isLocalOnly ||
        options?.storageScope === 'local_only' ||
        options?.privacyLevel === 'local_only'
      );

      const resolvedVersionNum =
        options?.versionNumber !== undefined ? options.versionNumber : undefined;
      const resolvedVersionTag =
        options?.versionTag ||
        (resolvedVersionNum !== undefined
          ? resolvedVersionNum === 0
            ? 'v0_RAW'
            : `v${resolvedVersionNum}`
          : undefined);
      const resolvedBaseline = baselineV0Amount > 0 ? baselineV0Amount : totalNetCisco;

      const effectiveRates = resolveEffectiveQuoteRates(params, processedResult.items);

      const cloudPayload: Omit<CloudEstimateRecord, 'id'> = {
        dealId: processedResult.headerInfo.dealId || 'NA',
        estimateId: processedResult.headerInfo.estimateId || 'NA',
        partnerName: resolvedPartner,
        clientFinalName: resolvedClient,
        modelName: options?.modelName || undefined,
        originalFileName: resolvedFileName,
        createdAt: new Date().toISOString(),
        isRestricted: options?.isRestricted,
        isLocalOnly,
        storageScope: isLocalOnly ? 'local_only' : 'cloud',
        privacyLevel: isLocalOnly ? 'local_only' : options?.isRestricted ? 'restricted' : 'public',
        activeVersion: resolvedVersionNum,
        activeVersionTag: resolvedVersionTag,
        baselineV0Amount: resolvedBaseline,
        currentAmount: totalVenta,
        creator: {
          username: currentUser?.username || 'anonymous',
          fullName: formatShortUserFirstName(currentUser?.full_name || 'Mauricio'),
          role: currentUser?.role || 'pm',
          email: currentUser?.email || '',
        },
        financialSummary: {
          totalNetCisco,
          totalCotizadoIntcomex: totalVenta,
          gananciaIntcomexUsd: profit,
          margenPct: effectiveRates.marginPct,
          currency: 'USD',
          params: {
            ...params,
            internacionPct: effectiveRates.internacionPct,
            margenPct: effectiveRates.marginPct,
            arancelPct: effectiveRates.arancelPct,
          },
        },
        headerInfo: {
          ...processedResult.headerInfo,
          companyName: resolvedPartner,
          customerName: resolvedClient,
        },
        itemsCount:
          processedResult.items.filter((i) => !i.isInfoRow).length ||
          processedResult.items.length,
        customOverrideMap,
        fastTrackPromoMap,
        items: processedResult.items.map((it) => ({
          rowIdx: it.rowIdx,
          lineNumber: it.lineNumber || '',
          partNumber: it.partNumber || '',
          description: it.description || '',
          qty: it.isInfoRow ? 0 : (it.qty ?? 0),
          unitListPrice: it.unitListPrice || 0,
          netCiscoUnit: it.netCiscoUnit || 0,
          discPct: it.discPct || 0,
          originalLeadTimeDays: it.originalLeadTimeDays ?? '',
          transformedLeadTime: it.transformedLeadTime || '',
          overrideType:
            customOverrideMap[it.rowIdx] ||
            (it.isIntangible ? 'intangible' : it.llevaArancel ? 'arancel' : 'equipo'),
          isIntangible: Boolean(it.isIntangible),
          llevaArancel: Boolean(it.llevaArancel),
          isInfoRow: Boolean(it.isInfoRow),
          months: it.months,
          detectedDurationMonths: it.detectedDurationMonths,
          isPeriodicSubscription: it.isPeriodicSubscription,
          realUnitCost: it.realUnitCost,
          serviceDurationMonths: it.serviceDurationMonths || '',
          costoInternacion: it.costoInternacion || 0,
          costoArancel: it.costoArancel || 0,
          costoTotalUnitario: it.costoTotalUnitario || 0,
          precioVentaUnitario: it.precioVentaUnitario || 0,
          precioVentaExtendido: it.precioVentaExtendido || 0,
          isFastTrackPromo: Boolean(it.isFastTrackPromo),
          originalNetCiscoUnit: it.originalNetCiscoUnit || it.netCiscoUnit || 0,
          fastTrackDiscountPct: it.fastTrackDiscountPct || 0,
          fastTrackSavings: it.fastTrackSavings || 0,
        })),
      };

      const res = await saveEstimateToCloud(cloudPayload, {
        isLocalOnly,
        storageScope: isLocalOnly ? 'local_only' : 'cloud',
        autoIncrementIfExisting: options?.autoIncrementIfExisting,
        note: options?.note,
      });

      if (
        !res.success &&
        !isLocalOnly &&
        typeof navigator !== 'undefined' &&
        (!navigator.onLine ||
          res.error?.includes('network') ||
          res.error?.includes('offline') ||
          res.error?.includes('unavailable'))
      ) {
        await enqueueOfflineAction('save_estimate', cloudPayload);
        return {
          success: true,
          error:
            '📡 Modo Offline: Sin conexión a internet. La cotización se encoló localmente y se sincronizará automáticamente al reconectar.',
        };
      }
      if (res.success) {
        if (res.versionNumber !== undefined) {
          setEstimateVersionNumber(res.versionNumber);
        }
        if (res.versionTag) {
          setEstimateVersionTag(res.versionTag);
        }
        setBaselineV0Amount(resolvedBaseline);
      }
      return res;
    },
    [
      processedResult,
      detectedPartner,
      currentFileName,
      currentUser,
      params,
      customOverrideMap,
      fastTrackPromoMap,
      estimateVersionNumber,
      baselineV0Amount,
    ]
  );

  const loadPriorAuditMargins = useCallback(async () => {
    if (!detectedAudit) return;
    const normalizePct = (val: number) => Math.round(val * 100) / 100;
    const priorInt = normalizePct(detectedAudit.previousInternacionPct);
    const priorMarg = normalizePct(detectedAudit.previousMarginPct);
    const rawAr = detectedAudit.previousArancelPct !== undefined ? detectedAudit.previousArancelPct : 6.0;
    const priorAr = normalizePct(rawAr);

    const hasCustom = Boolean(detectedAudit.hasCustomLineParams && detectedAudit.lineCustomParams);
    const mode = detectedAudit.parameterMode || (hasCustom ? 'custom_lines' : 'standard');

    const newParams: QuoteParameters = {
      ...params,
      parameterMode: mode,
      lineCustomParams: detectedAudit.lineCustomParams || {},
      internacionPct: priorInt,
      arancelPct: priorAr,
      margenPct: priorMarg,
    };
    setParams(newParams);
    setIsDetectedAuditModalOpen(false);

    if (rawWorkbookBuffer) {
      await recompute(rawWorkbookBuffer, newParams, currentFileName, customOverrideMap, fastTrackPromoMap);
    }
  }, [detectedAudit, params, rawWorkbookBuffer, currentFileName, customOverrideMap, fastTrackPromoMap, recompute]);

  const dismissDetectedAuditModal = useCallback(() => {
    setIsDetectedAuditModalOpen(false);
  }, []);

  const restoreOriginalUneditedEstimate = useCallback(async () => {
    const cleanParams: QuoteParameters = {
      ...DEFAULT_PARAMS,
      parameterMode: "standard",
      lineCustomParams: {},
    };
    setParams(cleanParams);
    setCustomOverrideMap({});
    setIsRecalculated(false);
    setIsDetectedAuditModalOpen(false);

    if (rawWorkbookBuffer) {
      await recompute(rawWorkbookBuffer, cleanParams, currentFileName, {}, fastTrackPromoMap);
    }
  }, [rawWorkbookBuffer, currentFileName, fastTrackPromoMap, recompute]);

  const setParameterMode = useCallback((mode: PricingParameterMode) => {
    setParams((prev) => ({
      ...prev,
      parameterMode: mode,
    }));
  }, []);

  const setLineCustomParam = useCallback(
    (motherLine: string, field: "internacionPct" | "arancelPct" | "margenPct", value: number) => {
      setParams((prev) => ({
        ...prev,
        parameterMode: "custom_lines",
        lineCustomParams: {
          ...(prev.lineCustomParams || {}),
          [motherLine]: {
            ...(prev.lineCustomParams?.[motherLine] || {}),
            [field]: value,
          },
        },
      }));
    },
    []
  );

  const resetLineCustomParams = useCallback((motherLine?: string) => {
    setParams((prev) => {
      if (motherLine) {
        const nextMap = { ...(prev.lineCustomParams || {}) };
        delete nextMap[motherLine];
        return {
          ...prev,
          lineCustomParams: nextMap,
        };
      }
      return {
        ...prev,
        parameterMode: "standard",
        lineCustomParams: {},
      };
    });
  }, []);

  const setBatchLineCustomParams = useCallback((map: LineParametersMap) => {
    setParams((prev) => ({
      ...prev,
      parameterMode: "custom_lines",
      lineCustomParams: { ...map },
    }));
  }, []);

  const clearEstimate = useCallback(() => {
    setRawWorkbookBuffer(null);
    setCurrentFileName('');
    setProcessedResult(null);
    setCustomOverrideMap({});
    setFastTrackPromoMap({});
    setPendingFastTrackAudit(null);
    setIsFastTrackOpportunityModalOpen(false);
    setIsRecalculated(false);
    setDetectedAudit(null);
    setIsDetectedAuditModalOpen(false);
    setEstimateVersionNumber(1);
    setEstimateVersionTag('v1');
    setBaselineV0Amount(0);
    setMiningAuditData(null);
    setIsMiningAuditModalOpen(false);
    setMiningAlertData(null);
    setIsMiningAlertModalOpen(false);
    setMiningFastTrackWarningData(null);
    setIsMiningFastTrackWarningModalOpen(false);
    setMisroutedFileAlert(null);
    setPendingCcwrFile(null);
    setPendingSkuAuthOverridesState([]);
    setSkuAuthAuthorName('');
    setErrorMessage(null);
    setParams(DEFAULT_PARAMS);
    setDetectedPartner('');
    setActivePartnerProfile(null);
  }, []);

  const logout = useCallback(async () => {
    clearEdgeSessionToken();
    clearEstimate();
    const desktopApi = getDesktopPyWebViewApi();
    if (desktopApi?.logout_user) {
      try {
        await desktopApi.logout_user();
      } catch (e) {
        console.warn(e);
      }
    }
    // Si hay una actualización de versión pendiente, aplicarla de inmediato al cerrar sesión
    checkAndApplyUpdateOnLogout().catch(() => {});
    setCurrentUser(null);
    setCurrentView('dashboard');
  }, [clearEstimate]);

  const value = useMemo<CiscoAutomatedState>(
    () => ({
      currentUser,
      currentView,
      params,
      detectedPartner,
      setDetectedPartner,
      activePartnerProfile,
      setActivePartnerProfile,
      rawWorkbookBuffer,
      currentFileName,
      processedResult,
      customOverrideMap,
      skuOverridesMap,
      isSharedSkuManagerOpen,
      setIsSharedSkuManagerOpen,
      pendingSkuAuthOverrides,
      skuAuthAuthorName,
      setPendingSkuAuthOverrides,
      applyApprovedSkuOverrides,
      setSkuOverridesMap,
      fastTrackPromoMap,
      pendingFastTrackAudit,
      isFastTrackOpportunityModalOpen,
      isFastTrackAdminModalOpen,
      isRecalculated,
      setIsRecalculated,
      detectedAudit,
      setDetectedAudit,
      isDetectedAuditModalOpen,
      setIsDetectedAuditModalOpen,
      loadPriorAuditMargins,
      dismissDetectedAuditModal,
      restoreOriginalUneditedEstimate,
      parameterMode: params.parameterMode || "standard",
      setParameterMode,
      lineCustomParams: params.lineCustomParams || {},
      setLineCustomParam,
      resetLineCustomParams,
      setBatchLineCustomParams,
      miningAuditData,
      setMiningAuditData,
      isMiningAuditModalOpen,
      setIsMiningAuditModalOpen,
      miningAlertData,
      setMiningAlertData,
      isMiningAlertModalOpen,
      setIsMiningAlertModalOpen,
      miningFastTrackWarningData,
      setMiningFastTrackWarningData,
      isMiningFastTrackWarningModalOpen,
      setIsMiningFastTrackWarningModalOpen,
      estimateVersionNumber,
      setEstimateVersionNumber,
      estimateVersionTag,
      baselineV0Amount,
      misroutedFileAlert,
      setMisroutedFileAlert,
      pendingCcwrFile,
      setPendingCcwrFile,
      isProcessing,
      errorMessage,
      activeQuoterTab,
      isSidebarOpen,
      setCurrentUser,
      setCurrentView,
      setParams,
      setActiveQuoterTab,
      setIsSidebarOpen,
      setErrorMessage,
      setIsFastTrackAdminModalOpen,
      setIsFastTrackOpportunityModalOpen,
      applyFastTrackPromos,
      skipFastTrackPromos,
      processFileBuffer,
      cycleRowRule,
      setRowRule,
      clearEstimate,
      loadDirectEstimateIntoStore,
      loadCloudEstimateIntoStore,
      saveCurrentEstimateToCloud,
      logout,
      isClientMode,
      setIsClientMode,
      toggleClientMode,
    }),
    [
      currentUser,
      currentView,
      params,
      rawWorkbookBuffer,
      currentFileName,
      processedResult,
      customOverrideMap,
      skuOverridesMap,
      isSharedSkuManagerOpen,
      pendingSkuAuthOverrides,
      skuAuthAuthorName,
      setPendingSkuAuthOverrides,
      applyApprovedSkuOverrides,
      fastTrackPromoMap,
      pendingFastTrackAudit,
      isFastTrackOpportunityModalOpen,
      isFastTrackAdminModalOpen,
      isRecalculated,
      detectedAudit,
      isDetectedAuditModalOpen,
      loadPriorAuditMargins,
      dismissDetectedAuditModal,
      miningAuditData,
      setMiningAuditData,
      isMiningAuditModalOpen,
      setIsMiningAuditModalOpen,
      miningAlertData,
      setMiningAlertData,
      isMiningAlertModalOpen,
      setIsMiningAlertModalOpen,
      miningFastTrackWarningData,
      isMiningFastTrackWarningModalOpen,
      estimateVersionNumber,
      estimateVersionTag,
      baselineV0Amount,
      misroutedFileAlert,
      setMisroutedFileAlert,
      pendingCcwrFile,
      setPendingCcwrFile,
      isProcessing,
      errorMessage,
      activeQuoterTab,
      isSidebarOpen,
      processFileBuffer,
      applyFastTrackPromos,
      skipFastTrackPromos,
      cycleRowRule,
      setRowRule,
      clearEstimate,
      loadDirectEstimateIntoStore,
      loadCloudEstimateIntoStore,
      saveCurrentEstimateToCloud,
      logout,
      isClientMode,
      setIsClientMode,
      toggleClientMode,
    ]
  );

  return <CiscoAutomatedContext.Provider value={value}>{children}</CiscoAutomatedContext.Provider>;
};

export const useCiscoAutomatedStore = (): CiscoAutomatedState => {
  const context = useContext(CiscoAutomatedContext);
  if (!context) {
    throw new Error('useCiscoAutomatedStore must be used within a CiscoAutomatedProvider');
  }
  return context;
};
