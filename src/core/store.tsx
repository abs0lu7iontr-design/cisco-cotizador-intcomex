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
import {
  auditEstimateWithFastTrack,
  FastTrackAuditResult,
} from '../modules/fasttrack';
import {
  CloudEstimateRecord,
  saveEstimateToCloud,
  SharedSkuOverrideRecord,
  getSharedSkuRules,
  publishSharedSkuRules,
} from '../modules/cloud';

export type NavViewId =
  | 'dashboard'
  | 'quoter'
  | 'upload'
  | 'dsv'
  | 'estimates'
  | 'users'
  | 'audit'
  | 'settings';

export const DEFAULT_PARAMS: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
};

interface CiscoAutomatedState {
  // Authentication & Session
  currentUser: UserSession | null;
  currentView: NavViewId;

  // Quoter Parameters
  params: QuoteParameters;

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

  processFileBuffer: (buffer: ArrayBuffer, fileName: string) => Promise<void>;
  setRowRule: (rowIdx: number, rule: OverrideRuleType, sku?: string) => Promise<void>;
  cycleRowRule: (rowIdx: number) => Promise<void>;
  clearEstimate: () => void;
  loadCloudEstimateIntoStore: (record: CloudEstimateRecord) => Promise<void>;
  saveCurrentEstimateToCloud: () => Promise<{ success: boolean; id?: string; error?: string }>;
  logout: () => Promise<void>;
}

const CiscoAutomatedContext = createContext<CiscoAutomatedState | null>(null);

export const CiscoAutomatedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<NavViewId>('dashboard');

  // Business Parameters (v2.1 defaults)
  const [params, setParams] = useState<QuoteParameters>(DEFAULT_PARAMS);

  // Dataset State
  const [rawWorkbookBuffer, setRawWorkbookBuffer] = useState<ArrayBuffer | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [processedResult, setProcessedResult] = useState<ProcessedEstimateResult | null>(null);
  const [customOverrideMap, setCustomOverrideMap] = useState<Record<number, OverrideRuleType>>({});
  const [skuOverridesMap, setSkuOverridesMap] = useState<Record<string, OverrideRuleType>>({});
  const [isSharedSkuManagerOpen, setIsSharedSkuManagerOpen] = useState<boolean>(false);
  const [pendingSkuAuthOverrides, setPendingSkuAuthOverridesState] = useState<SharedSkuOverrideRecord[]>([]);
  const [skuAuthAuthorName, setSkuAuthAuthorName] = useState<string>('');

  const setPendingSkuAuthOverrides = useCallback((rules: SharedSkuOverrideRecord[], author?: string) => {
    setPendingSkuAuthOverridesState(rules);
    if (author) setSkuAuthAuthorName(author);
  }, []);

  // Fast Track Promo State
  const [fastTrackPromoMap, setFastTrackPromoMap] = useState<Record<number, number>>({});
  const [pendingFastTrackAudit, setPendingFastTrackAudit] = useState<FastTrackAuditResult | null>(null);
  const [isFastTrackOpportunityModalOpen, setIsFastTrackOpportunityModalOpen] = useState<boolean>(false);
  const [isFastTrackAdminModalOpen, setIsFastTrackAdminModalOpen] = useState<boolean>(false);

  // Prior Audit / Recalculation State
  const [isRecalculated, setIsRecalculated] = useState<boolean>(false);
  const [detectedAudit, setDetectedAudit] = useState<DetectedAuditInfo | null>(null);
  const [isDetectedAuditModalOpen, setIsDetectedAuditModalOpen] = useState<boolean>(false);

  // UI Controls
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQuoterTab, setActiveQuoterTab] = useState<'excel' | 'table' | 'calculator'>('excel');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // 1. Load SKU Overrides from Multi-Tier Storage (localStorage + SQLite + overrides.json)
  useEffect(() => {
    let isMounted = true;

    const syncWithNativeBridge = async () => {
      if ((window as any).pywebview?.api && isMounted) {
        try {
          if ((window as any).pywebview.api.get_sku_overrides) {
            const res = await (window as any).pywebview.api.get_sku_overrides();
            if (res && res.success && res.overrides && isMounted) {
              setSkuOverridesMap((prev) => ({ ...prev, ...res.overrides }));
              try {
                const local = localStorage.getItem('cisco_sku_overrides_v2');
                const existing = local ? JSON.parse(local) : {};
                localStorage.setItem('cisco_sku_overrides_v2', JSON.stringify({ ...existing, ...res.overrides }));
              } catch (_) {}
            }
          }
          if ((window as any).pywebview.api.get_current_user && isMounted) {
            const user = await (window as any).pywebview.api.get_current_user();
            if (user && isMounted) {
              setCurrentUser(user);
            }
          }
        } catch (err) {
          console.warn('Bridge sync error:', err);
        }
      }
    };

    // A. Load from localStorage
    try {
      const local = localStorage.getItem('cisco_sku_overrides_v2');
      if (local && isMounted) {
        setSkuOverridesMap(JSON.parse(local));
      }
    } catch (e) {
      console.warn('Local storage overrides read error:', e);
    }

    // B. Load from Desktop Bridge
    if ((window as any).pywebview?.api) {
      syncWithNativeBridge();
    } else {
      window.addEventListener('pywebviewready', syncWithNativeBridge);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('pywebviewready', syncWithNativeBridge);
    };
  }, []);

  // Centralized re-calculation routine with in-flight guard
  const isComputingRef = useRef(false);

  const recompute = useCallback(
    async (
      buffer: ArrayBuffer,
      currentParams: QuoteParameters,
      fileName: string,
      overrides: Record<number, OverrideRuleType>,
      promoPrices?: Record<number, number>
    ) => {
      if (isComputingRef.current) return;
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

        const parts = fileName.split('_');
        const partnerName = (parts[0] || 'Intcomex').replace(/\.[^/.]+$/, '').trim();
        const clientName = (parts[1] || 'Cliente').replace(/\.[^/.]+$/, '').trim();

        // 1. Sync with SQLite Database bridge
        if ((window as any).pywebview?.api?.save_processed_estimate) {
          try {
            const payload = {
              estimate_id_cisco: result.headerInfo.estimateId || '011682708571Z',
              deal_id: result.headerInfo.dealId || 'NA',
              partner_name: partnerName,
              client_final_name: clientName,
              original_filename: fileName,
              stored_filepath: fileName,
              net_cisco_total: result.originalProductTotal,
              total_cotizado_intcomex: result.calculatedProductTotal,
              recargo_reglas_usd: result.calculatedProductTotal - result.originalProductTotal,
              ganancia_intcomex_usd:
                result.calculatedProductTotal -
                result.items.reduce((a, b) => a + b.costoTotalUnitario * b.qty, 0),
              items: result.items,
            };
            (window as any).pywebview.api.save_processed_estimate(JSON.stringify(payload));
          } catch (e) {
            console.warn('DB record save note:', e);
          }
        }

        // 2. Sync with localStorage History
        try {
          const localHist = localStorage.getItem('cisco_estimates_history_v2');
          const historyList = localHist ? JSON.parse(localHist) : [];
          const record = {
            id: 'est-' + Date.now(),
            estimate_id_cisco: result.headerInfo.estimateId || '011682708571Z',
            deal_id: result.headerInfo.dealId || 'NA',
            partner_name: partnerName,
            client_final_name: clientName,
            original_filename: fileName,
            stored_filepath: fileName,
            net_cisco_total: result.originalProductTotal,
            total_cotizado_intcomex: result.calculatedProductTotal,
            ganancia_intcomex_usd:
              result.calculatedProductTotal -
              result.items.reduce((a, b) => a + b.costoTotalUnitario * b.qty, 0),
            items_count: result.items.length,
            created_at: new Date().toISOString(),
            username: currentUser?.username || 'mskill',
          };
          const updatedHist = [record, ...historyList.filter((h: any) => h.original_filename !== fileName)];
          localStorage.setItem('cisco_estimates_history_v2', JSON.stringify(updatedHist.slice(0, 100)));
        } catch (e) {
          console.warn('Local history storage note:', e);
        }
      } catch (err: any) {
        console.error('Error recalculating estimate:', err);
        setErrorMessage(
          err?.message?.includes('central directory')
            ? 'El archivo seleccionado no es un libro Excel (.xlsx) válido o está dañado. Por favor asegúrate de seleccionar un archivo de cotización Excel (.xlsx) de Cisco CCW.'
            : err?.message || 'Error al procesar el archivo Excel. Asegúrate de subir un archivo .xlsx válido de Cisco CCW.'
        );
      } finally {
        isComputingRef.current = false;
      }
    },
    [currentUser, fastTrackPromoMap]
  );

  // Recalculate when params, override map or fastTrackPromoMap changes
  useEffect(() => {
    if (rawWorkbookBuffer && currentFileName) {
      recompute(rawWorkbookBuffer.slice(0), params, currentFileName, customOverrideMap, fastTrackPromoMap);
    }
  }, [params, customOverrideMap, fastTrackPromoMap, rawWorkbookBuffer, currentFileName, recompute]);

  // Actions
  const processFileBuffer = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      setIsProcessing(true);
      setErrorMessage(null);
      setFastTrackPromoMap({});

      // 1. Auto-restore default parameters on new file upload as requested
      setParams(DEFAULT_PARAMS);

      try {
        const safeBuffer = buffer.slice(0);
        setRawWorkbookBuffer(safeBuffer);
        setCurrentFileName(fileName);

        // 2. Fetch fresh overrides map from storage
        let currentMap = { ...skuOverridesMap };
        try {
          const local = localStorage.getItem('cisco_sku_overrides_v2');
          if (local) {
            currentMap = { ...JSON.parse(local), ...currentMap };
          }
        } catch (_) {}

        // 3. Parse initial structure to match existing persistent SKU overrides
        const { result: rawResult } = await parseEstimateWorkbook(safeBuffer.slice(0), DEFAULT_PARAMS, fileName, {});

        if (rawResult?.detectedAudit?.isRecalculated) {
          setIsRecalculated(true);
          setDetectedAudit(rawResult.detectedAudit);
          setIsDetectedAuditModalOpen(true);
        } else {
          setIsRecalculated(false);
          setDetectedAudit(null);
          setIsDetectedAuditModalOpen(false);
        }

        const matchedOverrides: Record<number, OverrideRuleType> = {};
        if (rawResult && rawResult.items) {
          rawResult.items.forEach((item) => {
            const skuKey = (item.partNumber || '').trim().toUpperCase();
            if (currentMap[skuKey]) {
              matchedOverrides[item.rowIdx] = currentMap[skuKey];
            }
          });
        }

        setCustomOverrideMap(matchedOverrides);

        if (Object.keys(matchedOverrides).length > 0) {
          await recompute(safeBuffer.slice(0), DEFAULT_PARAMS, fileName, matchedOverrides, {});
        } else {
          setProcessedResult(rawResult);
        }

        // 4. Check for shared community / colleague SKU rules from the Cloud or local shared cache
        try {
          const sharedRes = await getSharedSkuRules();
          if (sharedRes.success && sharedRes.data && sharedRes.data.length > 0) {
            const unappliedShared: SharedSkuOverrideRecord[] = [];

            for (const r of sharedRes.data) {
              const skuUpper = r.sku.toUpperCase();
              const matchingItem = rawResult?.items?.find(
                (it) => (it.partNumber || '').trim().toUpperCase() === skuUpper
              );

              if (!matchingItem) continue;

              // Current calculation classification of this item in this estimate
              const currentItemRule: OverrideRuleType = matchingItem.isIntangible
                ? 'intangible'
                : matchingItem.llevaArancel
                ? 'arancel'
                : 'equipo';

              const currentTypeName = matchingItem.isIntangible
                ? 'Intangible'
                : matchingItem.llevaArancel
                ? 'Arancel Especial'
                : 'Hardware';

              const normalizedRemoteRule = (String(r.rule).toLowerCase() === 'intangible'
                ? 'intangible'
                : String(r.rule).toLowerCase() === 'arancel'
                ? 'arancel'
                : 'equipo') as OverrideRuleType;

              // Suggest ONLY if it represents a genuine change from current state
              const isRealDifference = currentItemRule !== normalizedRemoteRule;
              const isAlreadyInLocalMap = currentMap[skuUpper] === normalizedRemoteRule;
              const isOtherAuthor = !currentUser || r.author?.username !== currentUser.username;

              if (isRealDifference && !isAlreadyInLocalMap && isOtherAuthor) {
                unappliedShared.push({
                  ...r,
                  rule: normalizedRemoteRule,
                  previousType: currentTypeName,
                });
              }
            }

            if (unappliedShared.length > 0) {
              setPendingSkuAuthOverridesState(unappliedShared);
              setSkuAuthAuthorName(unappliedShared[0]?.author?.fullName || 'Product Manager');
            }
          }
        } catch (_) {}

        // 5. MÓDULO 3: Cross-Check Fast Track Audit
        const auditRes = await auditEstimateWithFastTrack(rawResult.items);
        if (auditRes && auditRes.hasOpportunity) {
          setPendingFastTrackAudit(auditRes);
          setIsFastTrackOpportunityModalOpen(true);
        } else {
          setPendingFastTrackAudit(null);
          setIsFastTrackOpportunityModalOpen(false);
        }
      } catch (err: any) {
        console.error('Error processing workbook:', err);
        setErrorMessage(
          err?.message?.includes('central directory')
            ? 'El archivo seleccionado no es un libro Excel (.xlsx) válido o está dañado. Por favor asegúrate de seleccionar un archivo de cotización Excel (.xlsx) de Cisco CCW.'
            : err?.message || 'Error procesando archivo.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [recompute, skuOverridesMap, currentUser]
  );

  const applyApprovedSkuOverrides = useCallback(
    async (approved: SharedSkuOverrideRecord[], persistPermanently: boolean) => {
      const updatedSkuMap = { ...skuOverridesMap };
      approved.forEach((r) => {
        updatedSkuMap[r.sku.toUpperCase()] = r.rule;
      });

      setSkuOverridesMap(updatedSkuMap);

      if (persistPermanently) {
        try {
          localStorage.setItem('cisco_sku_overrides_v2', JSON.stringify(updatedSkuMap));
        } catch (_) {}
      }

      setPendingSkuAuthOverridesState([]);

      if (processedResult && rawWorkbookBuffer && currentFileName) {
        const updatedCustomMap = { ...customOverrideMap };
        processedResult.items.forEach((item) => {
          const skuKey = (item.partNumber || '').trim().toUpperCase();
          if (updatedSkuMap[skuKey]) {
            updatedCustomMap[item.rowIdx] = updatedSkuMap[skuKey];
          }
        });
        setCustomOverrideMap(updatedCustomMap);
        await recompute(rawWorkbookBuffer.slice(0), params, currentFileName, updatedCustomMap, fastTrackPromoMap);
      }
    },
    [skuOverridesMap, processedResult, rawWorkbookBuffer, currentFileName, customOverrideMap, params, fastTrackPromoMap, recompute]
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

    await recompute(rawWorkbookBuffer.slice(0), params, currentFileName, customOverrideMap, newPromoMap);
  }, [pendingFastTrackAudit, rawWorkbookBuffer, currentFileName, params, customOverrideMap, recompute]);

  const skipFastTrackPromos = useCallback(() => {
    setPendingFastTrackAudit(null);
    setIsFastTrackOpportunityModalOpen(false);
  }, []);

  const setRowRule = useCallback(
    async (rowIdx: number, rule: OverrideRuleType, sku?: string) => {
      const normRule = (String(rule).toLowerCase() === 'intangible'
        ? 'intangible'
        : String(rule).toLowerCase() === 'arancel'
        ? 'arancel'
        : 'equipo') as OverrideRuleType;

      setCustomOverrideMap((prev) => ({
        ...prev,
        [rowIdx]: normRule,
      }));

      const targetItem = processedResult?.items.find((i) => i.rowIdx === rowIdx);
      const itemSku = sku || targetItem?.partNumber;

      if (itemSku) {
        const cleanSku = itemSku.trim().toUpperCase();
        const updated = { ...skuOverridesMap, [cleanSku]: normRule };
        setSkuOverridesMap(updated);

        try {
          localStorage.setItem('cisco_sku_overrides_v2', JSON.stringify(updated));
        } catch (e) {
          console.warn('localStorage error:', e);
        }

        const prevTypeName = targetItem?.isIntangible
          ? 'Intangible'
          : targetItem?.llevaArancel
          ? 'Arancel Especial'
          : 'Hardware';

        // Auto publish shared rule for colleagues to discover & authorize
        const authorInfo = {
          username: currentUser?.username || 'pm_user',
          fullName: currentUser?.full_name || 'Product Manager',
          role: (currentUser?.role as string) || 'pm',
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

        if ((window as any).pywebview?.api?.save_sku_override) {
          try {
            await (window as any).pywebview.api.save_sku_override(cleanSku, rule);
          } catch (e) {
            console.warn('Desktop override save error:', e);
          }
        }
      }
    },
    [processedResult, skuOverridesMap, currentUser]
  );

  const cycleRowRule = useCallback(
    async (rowIdx: number) => {
      const currentItem = processedResult?.items.find((i) => i.rowIdx === rowIdx);
      if (!currentItem) return;

      let currentRule: OverrideRuleType = 'equipo';
      if (currentItem.isIntangible) {
        currentRule = 'intangible';
      } else if (currentItem.llevaArancel) {
        currentRule = 'arancel';
      }

      // 3-Rule Cycle: Equipo -> Intangible -> Arancel -> Equipo
      let nextRule: OverrideRuleType = 'intangible';
      if (currentRule === 'equipo') {
        nextRule = 'intangible';
      } else if (currentRule === 'intangible') {
        nextRule = 'arancel';
      } else if (currentRule === 'arancel') {
        nextRule = 'equipo';
      }

      await setRowRule(rowIdx, nextRule, currentItem.partNumber);
    },
    [processedResult, setRowRule]
  );

  const loadCloudEstimateIntoStore = useCallback(
    async (record: CloudEstimateRecord) => {
      try {
        setIsProcessing(true);
        if (record.financialSummary?.params) {
          setParams(record.financialSummary.params);
        }

        const restoredOverrideMap = record.customOverrideMap || {};
        setCustomOverrideMap(restoredOverrideMap);

        const restoredPromoMap = record.fastTrackPromoMap || {};
        setFastTrackPromoMap(restoredPromoMap);

        const reconstructedItems: EstimateLineItem[] = (record.items || []).map((it, idx) => ({
          rowIdx: it.rowIdx ?? idx + 19,
          lineNumber: it.lineNumber || String(idx + 1),
          partNumber: it.partNumber,
          smartAccountMandatory: '',
          description: it.description || '',
          serviceDurationMonths: '',
          originalLeadTimeDays: '',
          transformedLeadTime: it.transformedLeadTime || '',
          unitListPrice: it.unitListPrice || 0,
          pricingTerm: '',
          qty: it.qty || 1,
          netCiscoUnit: it.netCiscoUnit || 0,
          discPct: it.discPct || 0,
          isIntangible: it.isIntangible,
          llevaArancel: it.llevaArancel,
          costoInternacion: it.costoInternacion || 0,
          costoArancel: it.costoArancel || 0,
          costoTotalUnitario: it.costoTotalUnitario || 0,
          precioVentaUnitario: it.precioVentaUnitario || 0,
          precioVentaExtendido: it.precioVentaExtendido || 0,
          isFastTrackPromo: it.isFastTrackPromo,
          originalNetCiscoUnit: it.originalNetCiscoUnit,
          fastTrackDiscountPct: it.fastTrackDiscountPct,
          fastTrackSavings: it.fastTrackSavings,
        }));

        const totalNetCisco =
          record.financialSummary?.totalNetCisco ||
          reconstructedItems.reduce((sum, i) => sum + i.netCiscoUnit * i.qty, 0);
        const totalVenta =
          record.financialSummary?.totalCotizadoIntcomex ||
          reconstructedItems.reduce((sum, i) => sum + i.precioVentaExtendido, 0);

        setProcessedResult({
          fileName: record.originalFileName || `${record.estimateId}_${record.dealId}.xlsx`,
          headerInfo: record.headerInfo || {
            customerName: record.partnerName || 'Intcomex Partner',
            companyName: record.clientFinalName || 'Cliente Final',
            address: '',
            city: 'Santiago',
            country: 'Chile',
            phone: '',
            estimateId: record.estimateId,
            dealId: record.dealId,
            priceList: 'Global Price List',
            date: record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          },
          items: reconstructedItems,
          originalProductTotal: totalNetCisco,
          calculatedProductTotal: totalVenta,
          serviceTotal: 0,
          subscriptionTotal: 0,
          finalTotalPrice: totalVenta,
          headerRowIndex: 18,
        });

        setCurrentFileName(record.originalFileName || `${record.estimateId}_${record.dealId}.xlsx`);
        setCurrentView('quoter');
        setActiveQuoterTab('table');
      } catch (err: any) {
        console.error('Error cargando cotización desde la nube:', err);
        setErrorMessage(`Error restaurando cotización: ${err?.message || 'Datos corruptos'}`);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const saveCurrentEstimateToCloud = useCallback(async () => {
    if (!processedResult) {
      return { success: false, error: 'No hay ninguna cotización activa para guardar.' };
    }

    const totalNetCisco = processedResult.items.reduce(
      (sum, i) => sum + (i.netCiscoUnit || 0) * (i.qty || 1),
      0
    );
    const totalVenta = processedResult.finalTotalPrice || processedResult.calculatedProductTotal || 0;
    const profit = Math.max(0, totalVenta - totalNetCisco);

    const cloudPayload = {
      dealId: processedResult.headerInfo.dealId || 'NA',
      estimateId: processedResult.headerInfo.estimateId || 'NA',
      partnerName: processedResult.headerInfo.customerName || 'Intcomex Partner',
      clientFinalName: processedResult.headerInfo.companyName || 'Cliente Final',
      originalFileName: currentFileName || `${processedResult.headerInfo.estimateId || 'Estimate'}.xlsx`,
      createdAt: new Date().toISOString(),
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
      headerInfo: processedResult.headerInfo,
      itemsCount: processedResult.items.length,
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
        transformedLeadTime: it.transformedLeadTime || '',
        overrideType: customOverrideMap[it.rowIdx] || (it.isIntangible ? 'intangible' : it.llevaArancel ? 'arancel' : 'equipo'),
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

    return await saveEstimateToCloud(cloudPayload);
  }, [processedResult, currentFileName, currentUser, params, customOverrideMap, fastTrackPromoMap]);

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
    setErrorMessage(null);
    setParams(DEFAULT_PARAMS);
  }, []);

  const logout = useCallback(async () => {
    if ((window as any).pywebview?.api?.logout_user) {
      try {
        await (window as any).pywebview.api.logout_user();
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
