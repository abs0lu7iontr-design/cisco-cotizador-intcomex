// ============================================================================
// CISCO AUTOMATED - CISCO ORDERS API & SHIPMENT TRACKING SERVICE
// Conexión oficial de SOLO LECTURA a Cisco Modern Commerce Orders API
// Exclusivamente para seguimiento logístico (Status, Carrier, Waybill, Serial Numbers)
// NUNCA realiza compras, órdenes de compra ni mutaciones comerciales en Cisco CCW
// ============================================================================

import { getCiscoConfig, getCiscoAccessTokenWithMeta } from './ciscoAuthService';
import { getEdgeSessionHeaders } from '../security/edgeSessionService';
import { COMMERCE_ENDPOINTS } from './ciscoCommerceService';
import {
  BoStage,
  CourierProvider,
  getCourierTrackingUrl,
} from '../bo/boTrackingTypes';

export interface CiscoOrderLineItem {
  lineNumber: string;
  sku: string;
  description: string;
  quantity: number;
  shipmentStatus?: string;
  carrier?: string;
  courierProvider?: CourierProvider;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedShipDate?: string;
  actualShipDate?: string;
  serialNumbers?: string[];
}

export interface CiscoOrderTrackingDetails {
  orderNumber: string;
  customerPoNumber?: string;
  orderStatus: string;
  orderDate?: string;
  mappedStage: BoStage;
  carrier?: string;
  courierProvider: CourierProvider;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedShipDate?: string;
  actualShipDate?: string;
  estimatedArrivalDate?: string;
  lines: CiscoOrderLineItem[];
  rawResponse?: any;
}

export interface FetchOrderTrackingOptions {
  environment?: 'POE' | 'PROD';
  customerPoNumber?: string;
}

export interface FetchOrderTrackingResult {
  success: boolean;
  data?: CiscoOrderTrackingDetails;
  error?: string;
  httpStatus?: number;
  rawResponse?: any;
}

/**
 * Normaliza los estados devueltos por Cisco ERP/CCW hacia las 8 etapas oficiales de Back Order (BO)
 */
export function mapCiscoStatusToBoStage(ciscoStatus: string): BoStage {
  const norm = (ciscoStatus || '').trim().toUpperCase();

  // 1. Entregado / Completado
  if (
    norm.includes('DELIVERED') ||
    norm.includes('CLOSED') ||
    norm.includes('COMPLETED')
  ) {
    return 'DELIVERED';
  }

  // 2. Despachado por fábrica / en tránsito Courier
  if (
    norm.includes('SHIPPED') ||
    norm.includes('IN TRANSIT') ||
    norm.includes('DISPATCHED') ||
    norm.includes('WAYBILL')
  ) {
    return 'SHIPPED_COURIER';
  }

  // 3. En producción / manufactura / ensamble
  if (
    norm.includes('PRODUCTION') ||
    norm.includes('ASSEMBLY') ||
    norm.includes('MANUFACTURING') ||
    norm.includes('SCHEDULED') ||
    norm.includes('IN PROGRESS')
  ) {
    return 'IN_PRODUCTION';
  }

  // 4. Registrado formalmente en CCW con SO
  if (
    norm.includes('BOOKED') ||
    norm.includes('SUBMITTED') ||
    norm.includes('CONFIRMED') ||
    norm.includes('VALIDATED')
  ) {
    return 'CISCO_SO_BOOKED';
  }

  // Fallback por defecto si se tiene número de SO confirmado
  return 'CISCO_SO_BOOKED';
}

/**
 * Mapea la empresa transportista de Cisco al CourierProvider reconocido en la plataforma
 */
export function mapCiscoCarrierToCourierProvider(carrier: string = ''): CourierProvider {
  const norm = (carrier || '').trim().toLowerCase();
  if (norm.includes('fedex') || norm.includes('federal express')) return 'FedEx';
  if (norm.includes('ups') || norm.includes('united parcel service')) return 'UPS';
  if (norm.includes('dhl')) return 'DHL';
  return 'Otro';
}

/**
 * Consulta el estado y tracking de una orden en Cisco Orders API (Solo Lectura)
 */
export async function fetchOrderDetailsFromCiscoApi(
  orderNumber: string,
  options: FetchOrderTrackingOptions = {}
): Promise<FetchOrderTrackingResult> {
  const cleanOrder = (orderNumber || '').trim();
  if (!cleanOrder) {
    return {
      success: false,
      error: 'Debe ingresar un número de Sales Order (SO) o número de orden Cisco válido.',
    };
  }

  const cfg = getCiscoConfig();
  const envMode = options.environment || cfg.commerceEnvironment || 'POE';
  const targetUrl = COMMERCE_ENDPOINTS[envMode] || COMMERCE_ENDPOINTS.POE;

  const query = `
    query GetOrderDetails($orderNumber: String!) {
      getOrderDetails(input: { orderNumber: $orderNumber }) {
        orderNumber
        orderStatus
        orderDate
        customerPoNumber
        estimatedShipDate
        actualShipDate
        carrier
        trackingNumber
        trackingUrl
        lines {
          lineNumber
          item {
            sku
            description
          }
          quantity
          fulfillment {
            carrier
            trackingNumber
            trackingUrl
            shipmentStatus
            estimatedShipDate
            actualShipDate
            serialNumbers
          }
        }
        messages {
          code
          description
          message
          type
        }
      }
    }
  `;

  try {
    const tokenRecord = await getCiscoAccessTokenWithMeta();
    const token = tokenRecord.token;

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
            orderNumber: cleanOrder,
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
          httpStatus,
          error: `Cisco API Gateway retornó HTTP ${httpStatus}. La aplicación "Cisco-Automated-Intcomex" aún se encuentra pendiente de aprobación para el módulo de Orders en el entorno ${envMode}. Tan pronto como Cisco active el acceso, este seguimiento se actualizará automáticamente.`,
          rawResponse: payload,
        };
      }
      return {
        success: false,
        httpStatus,
        error: payload?.error || `Error HTTP ${httpStatus || 'desconocido'} al consultar Cisco API.`,
        rawResponse: payload,
      };
    }

    const orderData = payload?.data?.data?.getOrderDetails;

    if (!orderData || !orderData.orderNumber) {
      const msgs = payload?.data?.errors || payload?.data?.data?.getOrderDetails?.messages || [];
      const errorMsg = msgs.length > 0 ? msgs.map((m: any) => m.description || m.message).join(' | ') : 'No se encontraron datos para esta orden en Cisco.';
      return {
        success: false,
        error: `Cisco API respondió sin datos para la orden "${cleanOrder}": ${errorMsg}`,
        rawResponse: payload,
      };
    }

    const parsed = parseCiscoOrderResponse(orderData, payload);

    return {
      success: true,
      data: parsed,
      rawResponse: payload,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error inesperado al conectar con Cisco Orders API.',
    };
  }
}

/**
 * Transforma la respuesta de Cisco Orders en nuestro modelo unificado
 */
export function parseCiscoOrderResponse(orderData: any, rawResponse?: any): CiscoOrderTrackingDetails {
  const rawStatus = (orderData.orderStatus || 'BOOKED').trim();
  const mappedStage = mapCiscoStatusToBoStage(rawStatus);

  // Extraer carrier y tracking principal de la cabecera o de la primera línea que tenga tracking
  let primaryCarrier = orderData.carrier || '';
  let primaryTracking = orderData.trackingNumber || '';
  let primaryTrackingUrl = orderData.trackingUrl || '';
  let primaryEsd = orderData.estimatedShipDate || '';
  let primaryAsd = orderData.actualShipDate || '';

  const lines: CiscoOrderLineItem[] = [];

  const rawLines = Array.isArray(orderData.lines) ? orderData.lines : [];
  rawLines.forEach((l: any, idx: number) => {
    const f = l.fulfillment || {};
    const lineCarrier = f.carrier || primaryCarrier;
    const lineTracking = f.trackingNumber || primaryTracking;
    const lineCourier = mapCiscoCarrierToCourierProvider(lineCarrier);
    const lineTrackingUrl = f.trackingUrl || getCourierTrackingUrl(lineCourier, lineTracking);

    if (!primaryCarrier && lineCarrier) primaryCarrier = lineCarrier;
    if (!primaryTracking && lineTracking) primaryTracking = lineTracking;
    if (!primaryTrackingUrl && lineTrackingUrl) primaryTrackingUrl = lineTrackingUrl;
    if (!primaryEsd && f.estimatedShipDate) primaryEsd = f.estimatedShipDate;
    if (!primaryAsd && f.actualShipDate) primaryAsd = f.actualShipDate;

    lines.push({
      lineNumber: l.lineNumber || `${idx + 1}.0`,
      sku: l.item?.sku || l.sku || '',
      description: l.item?.description || l.description || '',
      quantity: Number(l.quantity || 1),
      shipmentStatus: f.shipmentStatus || rawStatus,
      carrier: lineCarrier,
      courierProvider: lineCourier,
      trackingNumber: lineTracking,
      trackingUrl: lineTrackingUrl,
      estimatedShipDate: f.estimatedShipDate || primaryEsd,
      actualShipDate: f.actualShipDate || primaryAsd,
      serialNumbers: Array.isArray(f.serialNumbers) ? f.serialNumbers : [],
    });
  });

  const finalCourierProvider = mapCiscoCarrierToCourierProvider(primaryCarrier);
  const finalTrackingUrl = primaryTrackingUrl || getCourierTrackingUrl(finalCourierProvider, primaryTracking);

  // Calcular ETA estimada en Chile (+2 semanas de tránsito respecto a ESD/ASD si están disponibles)
  let estimatedArrivalDate: string | undefined = undefined;
  const baseDateStr = primaryAsd || primaryEsd;
  if (baseDateStr) {
    try {
      const d = new Date(baseDateStr);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 14); // +14 días de tránsito y aduanas
        estimatedArrivalDate = d.toISOString().split('T')[0];
      }
    } catch {
      // Ignorar si el formato de fecha no es parseable
    }
  }

  return {
    orderNumber: orderData.orderNumber,
    customerPoNumber: orderData.customerPoNumber,
    orderStatus: rawStatus,
    orderDate: orderData.orderDate,
    mappedStage,
    carrier: primaryCarrier,
    courierProvider: finalCourierProvider,
    trackingNumber: primaryTracking,
    trackingUrl: finalTrackingUrl,
    estimatedShipDate: primaryEsd,
    actualShipDate: primaryAsd,
    estimatedArrivalDate,
    lines,
    rawResponse,
  };
}
