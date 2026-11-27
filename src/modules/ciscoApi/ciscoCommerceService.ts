// ============================================================================
// CISCO AUTOMATED - CISCO MODERN COMMERCE GRAPHQL API SERVICE
// Conecta con Cisco Commerce Modern APIs (it-developer.cisco.com)
// Obtiene Estimates oficiales, Jerarquías Madre-Hijo y Tiempos de Entrega (Lead Time)
// ============================================================================

import { getCiscoConfig, getCiscoAccessTokenWithMeta } from './ciscoAuthService';
import { getEdgeSessionHeaders } from '../security/edgeSessionService';
import { CiscoGraphQLEstimate, CiscoGraphQLLine } from './types';
import { ProcessedEstimateResult, EstimateLineItem } from '../../core/types';
import {
  calculateLineItemCosts,
  checkIsIntangible,
  formatLeadTime,
} from '../../core/calculations';

export const COMMERCE_ENDPOINTS = {
  POE: 'https://capitest.cisco.com/commerce/graphql',
  PROD: 'https://capi.cisco.com/commerce/graphql',
};

export interface FetchEstimateOptions {
  environment?: 'POE' | 'PROD';
  priceListCode?: string;
  partnerFallback?: string;
  clientFallback?: string;
}

export interface FetchEstimateResult {
  success: boolean;
  estimate?: CiscoGraphQLEstimate;
  processedResult?: ProcessedEstimateResult;
  maxLeadTimeDays?: number;
  maxLeadTimeFormatted?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Consulta un Estimate oficial en Cisco Modern Commerce GraphQL API
 */
export async function fetchEstimateFromCiscoApi(
  estimateId: string,
  options: FetchEstimateOptions = {}
): Promise<FetchEstimateResult> {
  const cleanId = estimateId.trim();
  if (!cleanId) {
    return { success: false, error: 'Debe ingresar un ID de Estimate válido (ej. OI161111385UO).' };
  }

  const cfg = getCiscoConfig();
  const envMode = options.environment || cfg.commerceEnvironment || 'POE';
  const targetUrl = COMMERCE_ENDPOINTS[envMode] || COMMERCE_ENDPOINTS.POE;
  const priceListCode = options.priceListCode || 'GLUS';

  const query = `
    query GetEstimate($estimateId: String!, $priceListCode: String) {
      getEstimate(
        input: {
          uuid: ""
          createdDateTime: ""
          estimateReference: {
            id: $estimateId
            priceList: { code: $priceListCode }
          }
        }
      ) {
        messages {
          code
          description
        }
        uuid
        id
        name
        estimateStatus
        metaData {
          createdOn
          lastUpdatedAt
        }
        expirationDate
        priceList {
          id
          code
          description
          currencies
        }
        lines {
          line {
            configurationLineReference {
              lineId
              parentLineId
              magicKey
            }
            item {
              sku
              description
              leadTime {
                measurement
                unitOfMeasure
              }
            }
            quantity {
              measurement
              unitOfMeasure
            }
            financialDetails {
              unitListPrice {
                amount
                currency
              }
              discounts {
                rate {
                  measurement
                  unitOfMeasure
                }
              }
              unitNetPrice {
                amount
                currency
              }
              extendedNetPrice {
                amount
                currency
              }
            }
          }
        }
      }
    }
  `;

  try {
    const tokenRecord = await getCiscoAccessTokenWithMeta();
    const token = tokenRecord.token;

    // Ejecución a través del proxy Edge Cloudflare (/api/cisco-proxy)
    const proxyRes = await fetch('/api/cisco-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getEdgeSessionHeaders() },
      body: JSON.stringify({
        action: 'request',
        url: targetUrl,
        method: 'POST',
        token,
        ...(cfg.clientId ? { clientId: cfg.clientId } : {}),
        ...(cfg.clientSecret ? { clientSecret: cfg.clientSecret } : {}),
        body: {
          query,
          variables: {
            estimateId: cleanId,
            priceListCode,
          },
        },
      }),
    });

    if (!proxyRes.ok) {
      const errPayload: any = await proxyRes.json().catch(() => ({}));
      return {
        success: false,
        error: errPayload?.error || `Error HTTP ${proxyRes.status} al consultar Cisco API.`,
      };
    }

    const payload: any = await proxyRes.json();

    if (!payload?.success) {
      const httpStatus = payload?.httpStatus;
      if (httpStatus === 403 || httpStatus === 404 || httpStatus === 503) {
        return {
          success: false,
          error: `Cisco API Gateway retornó HTTP ${httpStatus}. La aplicación "Cisco-Automated-Intcomex" aún se encuentra pendiente de aprobación en el portal Cisco Developer para el entorno ${envMode} (o el servicio se encuentra en aprovisionamiento). Tan pronto como Cisco apruebe el acceso, este endpoint quedará habilitado automáticamente.`,
          rawResponse: payload,
        };
      }
      return {
        success: false,
        error: payload?.error || `Error HTTP ${httpStatus || 'desconocido'} al consultar Cisco API.`,
        rawResponse: payload,
      };
    }

    const gqlData = payload?.data?.data?.getEstimate;

    if (!gqlData || !gqlData.lines || gqlData.lines.length === 0) {
      const msgs = payload?.data?.errors || payload?.data?.data?.getEstimate?.messages || [];
      const errorMsg = msgs.length > 0 ? msgs.map((m: any) => m.description || m.message).join(' | ') : 'No se encontraron líneas para este Estimate.';
      return {
        success: false,
        error: `Cisco API respondió sin datos para Estimate "${cleanId}": ${errorMsg}`,
        rawResponse: payload,
      };
    }

    const processed = convertCiscoEstimateToProcessedResult(gqlData, options);

    return {
      success: true,
      estimate: gqlData,
      processedResult: processed.result,
      maxLeadTimeDays: processed.maxLeadTimeDays,
      maxLeadTimeFormatted: processed.maxLeadTimeFormatted,
      rawResponse: payload,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error inesperado al conectar con Cisco Commerce GraphQL API.',
    };
  }
}

/**
 * Convierte la estructura de respuesta GraphQL de Cisco en el modelo interno de Cisco Automated
 */
export function convertCiscoEstimateToProcessedResult(
  gqlEstimate: CiscoGraphQLEstimate,
  options: FetchEstimateOptions = {}
): {
  result: ProcessedEstimateResult;
  maxLeadTimeDays: number;
  maxLeadTimeFormatted: string;
} {
  const lines = gqlEstimate.lines || [];
  const items: EstimateLineItem[] = [];

  let parentCounter = 0;
  const childCounterMap = new Map<string | number, number>();
  let maxDays = 0;

  // Parámetros comerciales estándar de Intcomex (7% internación, 6% arancel, 5% margen)
  const defaultParams = {
    internacionPct: 7,
    arancelPct: 6,
    margenPct: 5,
  };

  lines.forEach((lineWrapper: CiscoGraphQLLine, index: number) => {
    const lineData = lineWrapper.line;
    if (!lineData || !lineData.item) return;

    const sku = (lineData.item.sku || '').trim();
    const desc = lineData.item.description || sku;
    const parentId = lineData.configurationLineReference?.parentLineId ?? 0;
    const lineId = lineData.configurationLineReference?.lineId ?? index + 1;

    // Calcular jerarquía de numeración (ej. 1.0 vs 1.0.1)
    let displayLineNumber: string;
    const isParent = parentId === 0 || parentId === '0';

    if (isParent) {
      parentCounter += 1;
      displayLineNumber = `${parentCounter}.0`;
      childCounterMap.set(lineId, 0);
    } else {
      const currentChildIdx = (childCounterMap.get(parentId) || 0) + 1;
      childCounterMap.set(parentId, currentChildIdx);
      displayLineNumber = `${parentCounter || 1}.0.${currentChildIdx}`;
    }

    // Lead Time
    const leadTimeMeasurement = Number(lineData.item.leadTime?.measurement) || 0;
    const isIntangible = checkIsIntangible(sku, desc);
    const leadTimeDays = isIntangible ? 0 : leadTimeMeasurement;

    if (!isIntangible && leadTimeDays > maxDays) {
      maxDays = leadTimeDays;
    }

    const transformedLeadTime = isIntangible
      ? 'Entrega Digital (ED)'
      : formatLeadTime(leadTimeDays);

    // Precios (preservar $0 exacto en descuentos 100% y qty = 0 cuando venga explícito)
    const rawQty = lineData.quantity?.measurement;
    const qty =
      rawQty !== undefined && rawQty !== null && !Number.isNaN(Number(rawQty))
        ? Number(rawQty)
        : 1;
    const unitListPrice = Number(lineData.financialDetails?.unitListPrice?.amount) || 0;
    const discPct = Number(lineData.financialDetails?.discounts?.[0]?.rate?.measurement) || 0;
    const rawNetPrice = lineData.financialDetails?.unitNetPrice?.amount;
    const netCiscoUnit =
      rawNetPrice !== undefined && rawNetPrice !== null && !Number.isNaN(Number(rawNetPrice))
        ? Number(rawNetPrice)
        : unitListPrice * (1 - discPct / 100);

    const calc = calculateLineItemCosts(
      netCiscoUnit,
      qty,
      sku,
      desc,
      defaultParams,
      undefined,
      displayLineNumber
    );

    items.push({
      rowIdx: index + 19,
      lineNumber: displayLineNumber,
      partNumber: sku,
      smartAccountMandatory: 'No',
      description: desc,
      serviceDurationMonths: '',
      originalLeadTimeDays: leadTimeDays,
      transformedLeadTime,
      unitListPrice,
      pricingTerm: '1',
      qty,
      netCiscoUnit,
      discPct,
      isIntangible,
      llevaArancel: calc.llevaArancel,
      costoInternacion: calc.costoInternacion,
      costoArancel: calc.costoArancel,
      costoTotalUnitario: calc.costoTotalUnitario,
      precioVentaUnitario: calc.precioVentaUnitario,
      precioVentaExtendido: calc.precioVentaExtendido,
      isInfoRow: false,
    });
  });

  const totalCalculated = items.reduce((sum, item) => sum + item.precioVentaExtendido, 0);
  const totalOriginal = items.reduce((sum, item) => sum + item.netCiscoUnit * item.qty, 0);

  const estimateId = gqlEstimate.id || 'Cisco-API';
  const partnerName = options.partnerFallback || 'Intcomex';
  const clientName = options.clientFallback || gqlEstimate.name || 'Cliente Final';

  const processedResult: ProcessedEstimateResult = {
    fileName: `Cisco_API_${estimateId}.xlsx`,
    headerInfo: {
      customerName: partnerName,
      companyName: clientName,
      address: '',
      city: 'Santiago',
      country: 'Chile',
      phone: '',
      estimateId,
      dealId: 'API-CCW',
      priceList: gqlEstimate.priceList?.description || 'Global Price List US Availability',
      date: new Date().toISOString().slice(0, 10),
      endUser: clientName,
      quoteName: gqlEstimate.name || estimateId,
    },
    versionTag: 'v1',
    calculatedProductTotal: totalCalculated,
    originalProductTotal: totalOriginal,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: totalCalculated,
    headerRowIndex: 18,
    items,
  };

  return {
    result: processedResult,
    maxLeadTimeDays: maxDays,
    maxLeadTimeFormatted: maxDays > 0 ? formatLeadTime(maxDays) : 'Inmediato (Digital)',
  };
}
