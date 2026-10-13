// ============================================================================
// CISCO AUTOMATED v2.1 - STORE DOMAIN HELPERS, PERSISTENCE & TYPED BOUNDARIES
// Divide responsabilidades de store.tsx en dominios tipados sin 'any':
// 1. Puente Desktop (PyWebView) tipado
// 2. Persistencia y validación de SKU Overrides (localStorage + Cloud)
// 3. Historial local de cotizaciones
// 4. Construcción y reconstrucción de CloudEstimateRecord (v0 RAW y v1..vN)
// ============================================================================

import {
  QuoteParameters,
  ProcessedEstimateResult,
  EstimateLineItem,
  OverrideRuleType,
  UserSession,
} from './types';
import {
  CloudEstimateRecord,
  SharedSkuOverrideRecord,
} from '../modules/cloud';
import { formatPartnerName } from '../utils/partnerDbUtils';

export const SKU_OVERRIDES_STORAGE_KEY = 'cisco_sku_overrides_v2';
export const LOCAL_ESTIMATES_HISTORY_KEY = 'cisco_estimates_history_v2';

// ============================================================================
// 1. FRONTERA TIPADA DEL PUENTE DE ESCRITORIO (PYWEBVIEW)
// ============================================================================

export interface DesktopSkuOverridesResponse {
  success?: boolean;
  overrides?: Record<string, OverrideRuleType>;
}

export interface DesktopPyWebViewApi {
  get_sku_overrides?: () => Promise<DesktopSkuOverridesResponse>;
  save_sku_override?: (sku: string, rule: OverrideRuleType) => Promise<unknown>;
  get_current_user?: () => Promise<UserSession | null>;
  logout_user?: () => Promise<unknown>;
  save_processed_estimate?: (payloadJson: string) => Promise<unknown>;
}

interface WindowWithPyWebView {
  pywebview?: {
    api?: DesktopPyWebViewApi;
  };
}

export function getDesktopPyWebViewApi(): DesktopPyWebViewApi | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as WindowWithPyWebView;
  return win.pywebview?.api ?? null;
}

// ============================================================================
// 2. DOMINIO DE OVERRIDES DE CLASIFICACIÓN SKU
// ============================================================================

export function isValidOverrideRuleType(val: unknown): val is OverrideRuleType {
  return val === 'equipo' || val === 'intangible' || val === 'arancel';
}

export function normalizeOverrideRule(rule: unknown): OverrideRuleType {
  const clean = String(rule ?? '').trim().toLowerCase();
  if (clean === 'intangible') return 'intangible';
  if (clean === 'arancel') return 'arancel';
  return 'equipo';
}

export function computeNextCycledRule(currentItem: Pick<EstimateLineItem, 'isIntangible' | 'llevaArancel'>): OverrideRuleType {
  let currentRule: OverrideRuleType = 'equipo';
  if (currentItem.isIntangible) {
    currentRule = 'intangible';
  } else if (currentItem.llevaArancel) {
    currentRule = 'arancel';
  }

  if (currentRule === 'equipo') return 'intangible';
  if (currentRule === 'intangible') return 'arancel';
  return 'equipo';
}

export function readLocalSkuOverrides(): Record<string, OverrideRuleType> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SKU_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const validated: Record<string, OverrideRuleType> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const skuKey = k.trim().toUpperCase();
      if (skuKey && isValidOverrideRuleType(v)) {
        validated[skuKey] = v;
      }
    }
    return validated;
  } catch {
    return {};
  }
}

export function writeLocalSkuOverrides(overrides: Record<string, OverrideRuleType>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SKU_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.warn('writeLocalSkuOverrides warning:', err);
  }
}

export function matchItemsWithSkuOverrides(
  items: readonly EstimateLineItem[] | undefined,
  skuOverridesMap: Record<string, OverrideRuleType>
): Record<number, OverrideRuleType> {
  const matched: Record<number, OverrideRuleType> = {};
  if (!items) return matched;
  for (const item of items) {
    const skuKey = (item.partNumber || '').trim().toUpperCase();
    if (skuKey && skuOverridesMap[skuKey]) {
      matched[item.rowIdx] = skuOverridesMap[skuKey];
    }
  }
  return matched;
}

export function filterUnappliedSharedSkuRules(
  remoteRules: readonly SharedSkuOverrideRecord[],
  items: readonly EstimateLineItem[] | undefined,
  localSkuOverrides: Record<string, OverrideRuleType>,
  currentUser: UserSession | null
): SharedSkuOverrideRecord[] {
  if (!items || items.length === 0) return [];
  const unappliedShared: SharedSkuOverrideRecord[] = [];

  for (const r of remoteRules) {
    const skuUpper = (r.sku || '').trim().toUpperCase();
    if (!skuUpper) continue;

    const matchingItem = items.find(
      (it) => (it.partNumber || '').trim().toUpperCase() === skuUpper
    );
    if (!matchingItem) continue;

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

    const normalizedRemoteRule = normalizeOverrideRule(r.rule);
    const isRealDifference = currentItemRule !== normalizedRemoteRule;
    const isAlreadyInLocalMap = localSkuOverrides[skuUpper] === normalizedRemoteRule;
    const isOtherAuthor = !currentUser || r.author?.username !== currentUser.username;

    if (isRealDifference && !isAlreadyInLocalMap && isOtherAuthor) {
      unappliedShared.push({
        ...r,
        rule: normalizedRemoteRule,
        previousType: currentTypeName,
      });
    }
  }

  return unappliedShared;
}

// ============================================================================
// 3. DOMINIO DE HISTORIAL LOCAL Y PUENTE DE BASE DE DATOS SQLITE
// ============================================================================

export interface LocalHistoryEstimateEntry {
  id: string;
  estimate_id_cisco: string;
  deal_id: string;
  partner_name: string;
  client_final_name: string;
  original_filename: string;
  stored_filepath: string;
  net_cisco_total: number;
  total_cotizado_intcomex: number;
  ganancia_intcomex_usd: number;
  items_count: number;
  created_at: string;
  username: string;
}

export function isLocalHistoryEstimateEntry(val: unknown): val is LocalHistoryEstimateEntry {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.original_filename === 'string' && typeof obj.id === 'string';
}

export function persistProcessedEstimateHistory(
  result: ProcessedEstimateResult,
  fileName: string,
  currentUser: UserSession | null
): void {
  const parts = fileName.split('_');
  const partnerName = (parts[0] || 'Intcomex').replace(/\.[^/.]+$/, '').trim();
  const clientName = (parts[1] || 'Cliente').replace(/\.[^/.]+$/, '').trim();
  const gananciaUsd =
    result.calculatedProductTotal -
    result.items.reduce((a, b) => a + (b.isInfoRow ? 0 : b.costoTotalUnitario * b.qty), 0);

  const desktopApi = getDesktopPyWebViewApi();
  if (desktopApi?.save_processed_estimate) {
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
        ganancia_intcomex_usd: gananciaUsd,
        items: result.items,
      };
      desktopApi.save_processed_estimate(JSON.stringify(payload));
    } catch (e) {
      console.warn('DB record save note:', e);
    }
  }

  if (typeof localStorage === 'undefined') return;
  try {
    const localHistRaw = localStorage.getItem(LOCAL_ESTIMATES_HISTORY_KEY);
    const parsedList: unknown = localHistRaw ? JSON.parse(localHistRaw) : [];
    const historyList: LocalHistoryEstimateEntry[] = Array.isArray(parsedList)
      ? parsedList.filter(isLocalHistoryEstimateEntry)
      : [];

    const record: LocalHistoryEstimateEntry = {
      id: 'est-' + Date.now(),
      estimate_id_cisco: result.headerInfo.estimateId || '011682708571Z',
      deal_id: result.headerInfo.dealId || 'NA',
      partner_name: partnerName,
      client_final_name: clientName,
      original_filename: fileName,
      stored_filepath: fileName,
      net_cisco_total: result.originalProductTotal,
      total_cotizado_intcomex: result.calculatedProductTotal,
      ganancia_intcomex_usd: gananciaUsd,
      items_count: result.items.length,
      created_at: new Date().toISOString(),
      username: currentUser?.username || 'mskill',
    };

    const updatedHist = [
      record,
      ...historyList.filter((h) => h.original_filename !== fileName),
    ];
    localStorage.setItem(
      LOCAL_ESTIMATES_HISTORY_KEY,
      JSON.stringify(updatedHist.slice(0, 100))
    );
  } catch (e) {
    console.warn('Local history storage note:', e);
  }
}

// ============================================================================
// 4. DOMINIO DE CONSTRUCCIÓN Y RECONSTRUCCIÓN CLOUD ESTIMATE (v0..vN)
// ============================================================================

export function buildRawV0EstimatePayload(
  rawResult: ProcessedEstimateResult,
  rawEstId: string,
  partner: string,
  fileName: string,
  baseV0Cost: number,
  currentUser: UserSession | null,
  defaultParams: QuoteParameters
): Omit<CloudEstimateRecord, 'id'> {
  return {
    dealId: rawResult.headerInfo?.dealId || 'NA',
    estimateId: rawEstId,
    partnerName: partner,
    clientFinalName: rawResult.headerInfo?.customerName || 'Cliente Final',
    originalFileName: fileName,
    createdAt: new Date().toISOString(),
    activeVersion: 0,
    activeVersionTag: 'v0_RAW',
    baselineV0Amount: baseV0Cost,
    currentAmount: baseV0Cost,
    creator: {
      username: currentUser?.username || 'system',
      fullName: currentUser?.full_name || 'Cisco CCW Import',
      role: currentUser?.role || 'pm',
      email: currentUser?.email || '',
    },
    financialSummary: {
      totalNetCisco: baseV0Cost,
      totalCotizadoIntcomex: baseV0Cost,
      gananciaIntcomexUsd: 0,
      margenPct: 0,
      currency: 'USD',
      params: defaultParams,
    },
    headerInfo: rawResult.headerInfo,
    itemsCount: rawResult.items.length,
    customOverrideMap: {},
    items: rawResult.items.map((it) => ({
      rowIdx: it.rowIdx,
      lineNumber: it.lineNumber || '',
      partNumber: it.partNumber || '',
      description: it.description || '',
      qty: it.qty || 1,
      unitListPrice: it.unitListPrice || 0,
      netCiscoUnit: it.netCiscoUnit || 0,
      discPct: it.discPct || 0,
      transformedLeadTime: it.transformedLeadTime || '',
      overrideType: it.isIntangible ? 'intangible' : it.llevaArancel ? 'arancel' : 'equipo',
      isIntangible: Boolean(it.isIntangible),
      llevaArancel: Boolean(it.llevaArancel),
      costoInternacion: 0,
      costoArancel: 0,
      costoTotalUnitario: it.netCiscoUnit || 0,
      precioVentaUnitario: it.netCiscoUnit || 0,
      precioVentaExtendido: (it.netCiscoUnit || 0) * (it.qty || 1),
    })),
  };
}

export function reconstructProcessedResultFromCloudRecord(record: CloudEstimateRecord): {
  processedResult: ProcessedEstimateResult;
  reconstructedItems: EstimateLineItem[];
  totalNetCisco: number;
  totalVenta: number;
  activeVersion: number;
  activeVersionTag: string;
  baselineV0Amount: number;
} {
  const reconstructedItems: EstimateLineItem[] = (record.items || []).map((it, idx) => ({
    rowIdx: it.rowIdx ?? idx + 19,
    lineNumber: it.lineNumber || String(idx + 1),
    partNumber: it.partNumber,
    smartAccountMandatory: '',
    description: it.description || '',
    serviceDurationMonths: '',
    originalLeadTimeDays:
      it.originalLeadTimeDays !== undefined && it.originalLeadTimeDays !== ''
        ? it.originalLeadTimeDays
        : it.transformedLeadTime
        ? (() => {
            const m = String(it.transformedLeadTime).match(/(\d+)\s*(?:a\s*\d+\s*)?semana/i);
            return m ? Math.max(0, (parseInt(m[1], 10) - 2) * 7) : '';
          })()
        : '',
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

  const fileName = record.originalFileName || `${record.estimateId}_${record.dealId}.xlsx`;
  const processedResult: ProcessedEstimateResult = {
    fileName,
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
      date: record.createdAt ? record.createdAt.slice(0, 10) : '',
    },
    items: reconstructedItems,
    originalProductTotal: totalNetCisco,
    calculatedProductTotal: totalVenta,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: totalVenta,
    headerRowIndex: 18,
  };

  const activeVersion = record.activeVersion ?? 1;
  const activeVersionTag =
    record.activeVersionTag || (activeVersion === 0 ? 'v0_RAW' : `v${activeVersion}`);
  const baselineV0Amount = Number(
    record.baselineV0Amount ?? record.financialSummary?.totalNetCisco ?? totalNetCisco
  );

  return {
    processedResult,
    reconstructedItems,
    totalNetCisco,
    totalVenta,
    activeVersion,
    activeVersionTag,
    baselineV0Amount,
  };
}

export function resolveFallbackPartnerAndClient(
  processedResult: ProcessedEstimateResult,
  detectedPartner: string,
  currentFileName: string,
  partnerOverride?: string,
  clientOverride?: string
): { resolvedPartner: string; resolvedClient: string } {
  let fallbackPartner =
    detectedPartner || processedResult.headerInfo.companyName || 'Intcomex Partner';
  let fallbackClient = processedResult.headerInfo.customerName || 'Cliente Final';

  if (currentFileName) {
    const clean = currentFileName.replace(/\.[^/.]+$/, '');
    const parts = clean.split(/[_.\s-]+/);
    if (parts.length >= 1 && parts[0] && !parts[0].match(/^(estimate|\d+)$/i)) {
      fallbackPartner = parts[0].trim();
    }
    if (parts.length >= 2 && parts[1] && !parts[1].match(/^(estimate|\d+)$/i)) {
      fallbackClient = parts[1].trim();
    }
  }

  const rawPartner = partnerOverride || fallbackPartner;
  const resolvedPartner = formatPartnerName(rawPartner) || rawPartner.trim();
  const resolvedClient = (clientOverride || fallbackClient).trim();

  return { resolvedPartner, resolvedClient };
}
