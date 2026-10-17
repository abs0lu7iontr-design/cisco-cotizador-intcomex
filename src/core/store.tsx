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
} from './types';
import { parseEstimateWorkbook } from './excelEngine';
import { recalculateEstimateResult } from './calculations';
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

export type NavViewId =
  | 'dashboard'
  | 'quoter'
  | 'upload'
  | 'dsv'
  | 'configuriator'
  | 'estimates'
  | 'bo_tracking'
  | 'feedback'
  | 'users'
  | 'audit'
  | 'settings';

export const DEFAULT_PARAMS: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
};

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

  processFileBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  setRowRule: (rowIdx: number, rule: OverrideRuleType, sku?: string) => Promise<void>;
  cycleRowRule: (rowIdx: number) => Promise<void>;
  clearEstimate: () => void;
  loadCloudEstimateIntoStore: (record: CloudEstimateRecord) => Promise<void>;
  saveCurrentEstimateToCloud: (
    options?: SaveEstimateCloudOptions
  ) => Promise<{ success: boolean; id?: string; error?: string }>;
  logout: () => Promise<void>;
}

export interface SaveEstimateCloudOptions {
  partnerName?: string;
  clientFinalName?: string;
  modelName?: string;
  originalFileName?: string;
  isRestricted?: boolean;
  versionNumber?: number;
  versionTag?: string;
  note?: string;
}

const CiscoAutomatedContext = createContext<CiscoAutomatedState | null>(null);

export const CiscoAutomatedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Dominio de Sesión y Navegación
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<NavViewId>('dashboard');

  // 2. Dominio de Parámetros Comerciales (v2.1 defaults)
  const [params, setParams] = useState<QuoteParameters>(DEFAULT_PARAMS);
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

  // 7. Controles de Interfaz
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQuoterTab, setActiveQuoterTab] = useState<'excel' | 'table' | 'calculator'>('excel');
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
          activePromoMap
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

  // Recalcular en memoria al cambiar parámetros, overrides o promociones Fast Track
  useEffect(() => {
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
      setIsProcessing(true);
      setErrorMessage(null);
      setFastTrackPromoMap({});
      setParams(DEFAULT_PARAMS);

      try {
        const safeBuffer = buffer.slice(0);
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
          activeInitialParams.internacionPct !== DEFAULT_PARAMS.internacionPct ||
          activeInitialParams.arancelPct !== DEFAULT_PARAMS.arancelPct ||
          activeInitialParams.margenPct !== DEFAULT_PARAMS.margenPct;

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
      if (record.financialSummary?.params) {
        setParams(record.financialSummary.params);
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

  const saveCurrentEstimateToCloud = useCallback(
    async (options?: SaveEstimateCloudOptions) => {
      if (!processedResult) {
        return { success: false, error: 'No hay ninguna cotización activa para guardar.' };
      }

      const totalNetCisco =
        processedResult.originalProductTotal ||
        processedResult.items.reduce(
          (sum, i) =>
            sum + (i.isInfoRow ? 0 : (i.netCiscoUnit || 0) * (i.qty || 1) * (i.months || 1)),
          0
        );
      const totalVenta =
        processedResult.finalTotalPrice || processedResult.calculatedProductTotal || 0;
      const totalCosto = processedResult.items.reduce(
        (sum, i) =>
          sum + (i.isInfoRow ? 0 : (i.costoTotalUnitario || 0) * (i.qty || 1) * (i.months || 1)),
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

      const resolvedVersionNum =
        options?.versionNumber !== undefined ? options.versionNumber : estimateVersionNumber;
      const resolvedVersionTag =
        options?.versionTag || (resolvedVersionNum === 0 ? 'v0_RAW' : `v${resolvedVersionNum}`);
      const resolvedBaseline = baselineV0Amount > 0 ? baselineV0Amount : totalNetCisco;

      const cloudPayload: Omit<CloudEstimateRecord, 'id'> = {
        dealId: processedResult.headerInfo.dealId || 'NA',
        estimateId: processedResult.headerInfo.estimateId || 'NA',
        partnerName: resolvedPartner,
        clientFinalName: resolvedClient,
        modelName: options?.modelName || undefined,
        originalFileName: resolvedFileName,
        createdAt: new Date().toISOString(),
        isRestricted: options?.isRestricted,
        activeVersion: resolvedVersionNum,
        activeVersionTag: resolvedVersionTag,
        baselineV0Amount: resolvedBaseline,
        currentAmount: totalVenta,
        creator: {
          username: currentUser?.username || 'anonymous',
          fullName: currentUser?.full_name || 'Usuario Intcomex',
          role: currentUser?.role || 'pm',
          email: currentUser?.email || '',
        },
        financialSummary: {
          totalNetCisco,
          totalCotizadoIntcomex: totalVenta,
          gananciaIntcomexUsd: profit,
          margenPct: params.margenPct,
          currency: 'USD',
          params,
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
          qty: it.qty || 1,
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

      const res = await saveEstimateToCloud(cloudPayload);
      if (res.success) {
        setEstimateVersionNumber(resolvedVersionNum);
        setEstimateVersionTag(resolvedVersionTag);
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
    const priorInt =
      detectedAudit.previousInternacionPct > 0 && detectedAudit.previousInternacionPct <= 1
        ? Math.round(detectedAudit.previousInternacionPct * 100)
        : Math.round(detectedAudit.previousInternacionPct);
    const priorMarg =
      detectedAudit.previousMarginPct > 0 && detectedAudit.previousMarginPct <= 1
        ? Math.round(detectedAudit.previousMarginPct * 100)
        : Math.round(detectedAudit.previousMarginPct);

    const newParams: QuoteParameters = {
      ...params,
      internacionPct: priorInt,
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
    setMiningAuditData(null);
    setIsMiningAuditModalOpen(false);
    setMiningAlertData(null);
    setIsMiningAlertModalOpen(false);
    setErrorMessage(null);
    setParams(DEFAULT_PARAMS);
    setDetectedPartner('');
    setActivePartnerProfile(null);
  }, []);

  const logout = useCallback(async () => {
    const desktopApi = getDesktopPyWebViewApi();
    if (desktopApi?.logout_user) {
      try {
        await desktopApi.logout_user();
      } catch (e) {
        console.warn(e);
      }
    }
    setCurrentUser(null);
    setCurrentView('dashboard');
  }, []);

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
      loadCloudEstimateIntoStore,
      saveCurrentEstimateToCloud,
      logout,
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
      loadCloudEstimateIntoStore,
      saveCurrentEstimateToCloud,
      logout,
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
