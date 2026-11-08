// ============================================================================
// CISCO AUTOMATED v2.9 - FORECAST SERVICE ENGINE
// Reconciliación cruzada con CCW Estimates, BO Tracking y DSV Records,
// Motor anti-duplicación estricto, Recordatorios y Sincronización Google Sheets
// ============================================================================

import * as XLSX from 'xlsx';
import {
  ForecastRecord,
  ForecastStats,
  ForecastFilterOptions,
  ForecastReminderItem,
  FORECAST_36_COLUMNS,
} from './forecastTypes';
import { ProcessedEstimateResult } from '../../core/types';
import { BoOrderTrackingRecord } from '../bo/boTrackingTypes';
import { DsvModalFormData } from '../dsv/types';
import { PipelineDealRecord } from '../pipeline/pipelineTypes';

// ----------------------------------------------------------------------------
// Deduplication & Normalization Match Engine
// ----------------------------------------------------------------------------

/**
 * Parsea de manera tolerante números y divisas soportando formatos mixtos:
 * - Formato chileno / europeo: "1.085.000,50" o "$1.085.000"
 * - Formato anglosajón / US: "1,085,000.50" o "$107,849.40"
 * - Formato simple: "107849.40", "107849,40" o "$45.0"
 */
export function parseFlexibleNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  let str = String(val).trim().replace(/[$£€\sUSD]/gi, '');
  if (!str) return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const firstComma = str.indexOf(',');
    const firstDot = str.indexOf('.');
    if (firstDot < firstComma) {
      // 1.085.000,50 -> punto miles, coma decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,085,000.50 -> coma miles, punto decimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // Múltiples comas son separadores de miles
      str = str.replace(/,/g, '');
    } else if (parts.length === 2) {
      if (parts[1].length === 3 && parts[0].length <= 3) {
        str = str.replace(',', '');
      } else {
        str = parts[0] + '.' + parts[1];
      }
    }
  } else if (hasDot && !hasComma) {
    const parts = str.split('.');
    if (parts.length > 2) {
      // Múltiples puntos son separadores de miles (formato CLP / Intcomex)
      str = str.replace(/\./g, '');
    } else if (parts.length === 2) {
      // Si la parte derecha tiene 3 dígitos exactos y la izquierda <= 3, ej: 1.085 -> 1085
      if (parts[1].length === 3 && parts[0].length <= 3) {
        str = str.replace('.', '');
      }
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Number(num.toFixed(2));
}

export function normalizeMatchKey(val?: string | null): string {
  if (!val) return '';
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface MatchCandidate {
  dealId?: string;
  so?: string;
  numeroVenta?: string;
  po?: string;
  oc?: string;
  partner?: string;
  endUser?: string;
  usd?: number;
  mesFacturacion?: string;
  fechaCotizacion?: string;
  sourceEstimateId?: string;
}

/**
 * Motor Anti-Duplicación Multi-Vectorial para Forecast Comercial:
 * 1. Coincidencia exacta por Deal ID / Promotion Authorization Number (Cisco CCW)
 * 2. Coincidencia exacta por Cisco SO (Sales Order) o Intcomex Número de Venta (NV)
 * 3. Coincidencia por PO / OC cuando el Partner coincide
 * 4. Coincidencia por sourceEstimateId
 * 5. Coincidencia por Partner + End User + Monto USD (dentro de tolerancia de $10 o ±2%) o Mes de Facturación
 */
export function findMatchingForecastRecord(
  records: ForecastRecord[],
  candidate: MatchCandidate
): ForecastRecord | undefined {
  if (!candidate) return undefined;

  // Vector 1: Deal ID / Promotion Authorization Number oficial
  const cleanDeal = candidate.dealId?.trim().replace(/^[#\s]+/, '');
  if (cleanDeal && cleanDeal !== 'NA' && cleanDeal !== 'N/A' && cleanDeal !== '-' && cleanDeal.length >= 4) {
    const match = records.find((r) => {
      const rDeal = r.deal?.trim().replace(/^[#\s]+/, '');
      const rPromo = r.promotionAuthorizationNumber?.trim().replace(/^[#\s]+/, '');
      return (
        (rDeal && rDeal.toLowerCase() === cleanDeal.toLowerCase()) ||
        (rPromo && rPromo.toLowerCase() === cleanDeal.toLowerCase())
      );
    });
    if (match) return match;
  }

  // Vector 2: Cisco SO (Sales Order) o Intcomex Número de Venta (NV)
  const cleanSo = candidate.so?.trim().replace(/^[#\s]+/, '');
  if (cleanSo && cleanSo !== 'NA' && cleanSo !== 'N/A' && cleanSo !== '-' && cleanSo.length >= 5) {
    const match = records.find((r) => r.so?.trim().replace(/^[#\s]+/, '') === cleanSo);
    if (match) return match;
  }

  const cleanNv = candidate.numeroVenta?.trim();
  if (cleanNv && cleanNv.length >= 5) {
    const match = records.find((r) => r.numeroVenta?.trim() === cleanNv);
    if (match) return match;
  }

  // Vector 3: PO (Purchase Order) u OC (Orden de Compra) con Partner coincidente
  const cleanPo = candidate.po?.trim();
  const cleanOc = candidate.oc?.trim();
  const normPartner = normalizeMatchKey(candidate.partner);
  if ((cleanPo && cleanPo.length >= 4) || (cleanOc && cleanOc.length >= 4)) {
    const match = records.find((r) => {
      const rPartner = normalizeMatchKey(r.partner);
      const partnerMatches = !normPartner || !rPartner || rPartner.includes(normPartner) || normPartner.includes(rPartner);
      if (!partnerMatches) return false;
      return (cleanPo && r.po?.trim() === cleanPo) || (cleanOc && r.oc?.trim() === cleanOc);
    });
    if (match) return match;
  }

  // Vector 4: Estimate ID
  if (candidate.sourceEstimateId && candidate.sourceEstimateId.trim().length >= 4) {
    const cleanEst = candidate.sourceEstimateId.trim().toLowerCase();
    const match = records.find(
      (r) => r.sourceEstimateId && r.sourceEstimateId.trim().toLowerCase() === cleanEst
    );
    if (match) return match;
  }

  // Vector 5: Composite Partner + End User + Monto / Mes
  const normEndUser = normalizeMatchKey(candidate.endUser);
  if (normPartner && normEndUser && normEndUser !== 'na' && normEndUser !== '-') {
    const candidateUsd = typeof candidate.usd === 'number' ? candidate.usd : 0;
    const candidateMes = (candidate.mesFacturacion || '').trim().toLowerCase();
    const candidateFecha = (candidate.fechaCotizacion || '').trim();

    for (const r of records) {
      const rPartner = normalizeMatchKey(r.partner);
      const rEndUser = normalizeMatchKey(r.endUser || r.endCustomerName);
      if (!rPartner || !rEndUser) continue;

      const partnerMatches = rPartner.includes(normPartner) || normPartner.includes(rPartner);
      const endUserMatches = rEndUser.includes(normEndUser) || normEndUser.includes(rEndUser);

      if (partnerMatches && endUserMatches) {
        // Sub-criterio A: Monto coincidente (±2% o 10 USD)
        if (candidateUsd > 0 && r.usdIntcomex > 0) {
          const diff = Math.abs(r.usdIntcomex - candidateUsd);
          const pctDiff = diff / Math.max(r.usdIntcomex, candidateUsd);
          if (diff <= 10 || pctDiff <= 0.02) {
            return r;
          }
        }

        // Sub-criterio B: Mes de Facturación coincidente
        if (candidateMes && r.mesFacturacion && r.mesFacturacion.trim().toLowerCase() === candidateMes) {
          if (candidateUsd === 0 || r.usdIntcomex === 0 || Math.abs(r.usdIntcomex - candidateUsd) / Math.max(r.usdIntcomex, candidateUsd) <= 0.15) {
            return r;
          }
        }

        // Sub-criterio C: Fecha de Cotización idéntica
        if (candidateFecha && r.fechaCotizacion && r.fechaCotizacion.trim() === candidateFecha) {
          return r;
        }

        // Sub-criterio D: Fallback cuando no se suministraron montos ni fechas discriminatorias
        if (candidateUsd === 0 && !candidateMes && !candidateFecha) {
          return r;
        }
      }
    }
  }

  return undefined;
}

// ----------------------------------------------------------------------------
// Statistics & Filter Engine
// ----------------------------------------------------------------------------

export function computeForecastStats(records: ForecastRecord[]): ForecastStats {
  let totalUsdIntcomex = 0;
  let totalProductos = 0;
  let totalSuscripciones = 0;
  let totalServicios = 0;
  let totalMeraki = 0;
  let recordsConSoCount = 0;
  let recordsBodegaE1Count = 0;
  let recordsBodegaEdCount = 0;
  let creditPendingCount = 0;

  records.forEach((r) => {
    totalUsdIntcomex += r.usdIntcomex || 0;
    totalProductos += r.productos || 0;
    totalSuscripciones += r.suscripciones || 0;
    totalServicios += r.servicios || 0;
    totalMeraki += r.meraki || 0;

    if (r.so && r.so.trim().length > 3) recordsConSoCount++;
    if (r.bodega?.includes('E1')) recordsBodegaE1Count++;
    if (r.bodega?.includes('ED')) recordsBodegaEdCount++;
    if (
      r.credit?.toLowerCase().includes('pdte') ||
      r.credit?.toLowerCase().includes('revis')
    ) {
      creditPendingCount++;
    }
  });

  const reminders = generateForecastReminders(records);
  const criticalCount = reminders.filter((item) => item.severity === 'CRITICAL').length;

  return {
    totalRecords: records.length,
    totalUsdIntcomex,
    totalProductos,
    totalSuscripciones,
    totalServicios,
    totalMeraki,
    recordsConSoCount,
    recordsBodegaE1Count,
    recordsBodegaEdCount,
    activeRemindersCount: reminders.length,
    criticalRemindersCount: criticalCount,
    creditPendingCount,
  };
}

export function filterForecastRecords(
  records: ForecastRecord[],
  filters: ForecastFilterOptions
): ForecastRecord[] {
  const query = filters.searchQuery?.trim().toLowerCase();

  return records.filter((r) => {
    if (query) {
      const match =
        r.id.toLowerCase().includes(query) ||
        r.partner.toLowerCase().includes(query) ||
        r.endUser.toLowerCase().includes(query) ||
        r.deal.toLowerCase().includes(query) ||
        r.so.toLowerCase().includes(query) ||
        r.po.toLowerCase().includes(query) ||
        r.numeroVenta.toLowerCase().includes(query) ||
        r.pmResponsable.toLowerCase().includes(query) ||
        r.detalleProductos.toLowerCase().includes(query) ||
        r.clienteCisco.toLowerCase().includes(query) ||
        r.am.toLowerCase().includes(query) ||
        r.caso.toLowerCase().includes(query) ||
        r.nuevoCaso.toLowerCase().includes(query);
      if (!match) return false;
    }

    if (filters.pmResponsable && filters.pmResponsable !== 'ALL') {
      if (r.pmResponsable.toLowerCase() !== filters.pmResponsable.toLowerCase()) {
        return false;
      }
    }

    if (filters.bodega && filters.bodega !== 'ALL') {
      if (!r.bodega?.toLowerCase().includes(filters.bodega.toLowerCase())) {
        return false;
      }
    }

    if (filters.grupoVentas && filters.grupoVentas !== 'ALL') {
      if (r.grupoVentas.toLowerCase() !== filters.grupoVentas.toLowerCase()) {
        return false;
      }
    }

    if (filters.credit && filters.credit !== 'ALL') {
      if (r.credit.toLowerCase() !== filters.credit.toLowerCase()) {
        return false;
      }
    }

    if (filters.am && filters.am !== 'ALL') {
      if (r.am.toLowerCase() !== filters.am.toLowerCase()) {
        return false;
      }
    }

    if (filters.onlyWithReminders) {
      const recReminders = generateForecastReminders([r]);
      if (recReminders.length === 0) return false;
    }

    return true;
  });
}

// ----------------------------------------------------------------------------
// Cross-Module Population Engine (No Duplication)
// ----------------------------------------------------------------------------

/**
 * Cruza un Estimate procesado de CCW hacia el Forecast.
 * Si el deal ya existe, actualiza los campos faltantes (montos, detalle BOM, partner, cliente).
 * Si no existe, crea un nuevo registro sin duplicar.
 */
export function crossSyncEstimateToForecast(
  estimate: ProcessedEstimateResult,
  records: ForecastRecord[]
): { updatedList: ForecastRecord[]; affectedRecord: ForecastRecord; isNew: boolean } {
  const h = estimate.headerInfo;
  const match = findMatchingForecastRecord(records, {
    dealId: h.dealId,
    partner: h.companyName || h.customerName,
    endUser: h.endUser,
  });

  const nowIso = new Date().toISOString();
  const todayStr = new Date().toLocaleDateString('es-CL');

  // Resumen de BOM
  const topProducts = estimate.items
    .slice(0, 4)
    .map((it) => it.partNumber)
    .join(', ');

  if (match) {
    // Fusión conservadora: No sobrescribe valores ya confirmados
    const updated: ForecastRecord = {
      ...match,
      usdIntcomex: match.usdIntcomex > 0 ? match.usdIntcomex : estimate.finalTotalPrice || 0,
      productos: match.productos > 0 ? match.productos : estimate.calculatedProductTotal || 0,
      servicios: match.servicios > 0 ? match.servicios : estimate.serviceTotal || 0,
      suscripciones: match.suscripciones > 0 ? match.suscripciones : estimate.subscriptionTotal || 0,
      detalleProductos: match.detalleProductos || topProducts,
      deal: match.deal || h.dealId || '',
      partner: match.partner || h.companyName || h.customerName || '',
      endUser: match.endUser || h.endUser || '',
      endCustomerName: match.endCustomerName || h.endUser || '',
      sourceEstimateId: h.estimateId || match.sourceEstimateId,
      updatedAt: nowIso,
    };

    const list = records.map((r) => (r.id === match.id ? updated : r));
    return { updatedList: list, affectedRecord: updated, isNew: false };
  }

  // Nuevo registro generado desde Estimate
  const newId = `FC-${String(records.length + 1).padStart(4, '0')}`;
  const newRec: ForecastRecord = {
    id: newId,
    fechaLevantamiento: todayStr,
    fechaCotizacion: h.date || todayStr,
    marca: 'CISCO',
    pmResponsable: 'Raul Cuevas',
    partner: h.companyName || h.customerName || '',
    ejecutivoPartner: '',
    endUser: h.endUser || '',
    usdIntcomex: estimate.finalTotalPrice || 0,
    emailEjecutivoPartner: '',
    mesFacturacion: '',
    emailClienteFinal: '',
    detalleProductos: topProducts,
    oc: '',
    deal: h.dealId || '',
    productos: estimate.calculatedProductTotal || 0,
    suscripciones: estimate.subscriptionTotal || 0,
    servicios: estimate.serviceTotal || 0,
    meraki: 0,
    am: '',
    grupoVentas: 'Top Volume',
    observacion: 'Generado desde CCW Estimate',
    dsvSubmission: '',
    po: '',
    so: '',
    submittedDate: '',
    clienteCisco: '',
    promotionAuthorizationNumber: '',
    endCustomerName: h.endUser || '',
    endCustomerAddress1: h.address || '',
    numeroVenta: '',
    bodega: 'E1',
    caso: '',
    priceProtectionExpiryDate: '',
    credit: 'Aprobado',
    nuevoCaso: '',
    confirmacionCredito: '',
    sourceEstimateId: h.estimateId || '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return { updatedList: [newRec, ...records], affectedRecord: newRec, isNew: true };
}

/**
 * Cruza órdenes de Back Order Tracking (BO) hacia el Forecast.
 * Enlaza por Deal ID, SO o Partner+EndUser, inyectando SO, OC, Bodega (E1/ED) y Facturación.
 */
export function crossSyncBoToForecast(
  boRecords: BoOrderTrackingRecord[],
  records: ForecastRecord[]
): { updatedList: ForecastRecord[]; updatedCount: number } {
  let updatedCount = 0;
  const list = [...records];
  const nowIso = new Date().toISOString();

  boRecords.forEach((bo) => {
    const match = findMatchingForecastRecord(list, {
      dealId: bo.dealId,
      so: bo.ciscoSoNumber,
      po: bo.clientPoNumber,
      partner: bo.partnerName,
      endUser: bo.endCustomerName,
    });

    if (match) {
      const idx = list.findIndex((r) => r.id === match.id);
      if (idx >= 0) {
        let changed = false;
        const cur = list[idx];

        const updated: ForecastRecord = { ...cur };

        if (!cur.so && bo.ciscoSoNumber) {
          updated.so = bo.ciscoSoNumber;
          changed = true;
        }
        if (!cur.oc && bo.clientPoNumber) {
          updated.oc = bo.clientPoNumber;
          changed = true;
        }
        if (bo.bodegaDestino && cur.bodega !== bo.bodegaDestino) {
          updated.bodega = bo.bodegaDestino;
          changed = true;
        }
        if (!cur.deal && bo.dealId) {
          updated.deal = bo.dealId;
          changed = true;
        }
        if (!cur.sourceBoTrackingId) {
          updated.sourceBoTrackingId = bo.id;
          changed = true;
        }

        if (changed) {
          updated.updatedAt = nowIso;
          list[idx] = updated;
          updatedCount++;
        }
      }
    }
  });

  return { updatedList: list, updatedCount };
}

/**
 * Cruza datos de trámites Direct Ship Vendor (DSV) hacia el Forecast.
 * Inyecta PO, SO, # Cliente XCL/XCLN, DSV Submission, Dirección y Promo Auth.
 */
export function crossSyncDsvToForecast(
  dsvForms: DsvModalFormData[],
  records: ForecastRecord[]
): { updatedList: ForecastRecord[]; updatedCount: number } {
  let updatedCount = 0;
  const list = [...records];
  const nowIso = new Date().toISOString();

  dsvForms.forEach((dsv) => {
    const match = findMatchingForecastRecord(list, {
      dealId: dsv.dealId,
      so: dsv.so,
      po: dsv.po,
      partner: dsv.partnerName,
      endUser: dsv.endCustomerName,
    });

    if (match) {
      const idx = list.findIndex((r) => r.id === match.id);
      if (idx >= 0) {
        let changed = false;
        const cur = list[idx];
        const updated: ForecastRecord = { ...cur };

        if (!cur.so && dsv.so) {
          updated.so = dsv.so;
          changed = true;
        }
        if (!cur.po && dsv.po) {
          updated.po = dsv.po;
          changed = true;
        }
        if (!cur.clienteCisco && dsv.partnerId) {
          updated.clienteCisco = dsv.partnerId;
          changed = true;
        }
        if (!cur.endCustomerAddress1 && dsv.endCustomerAddress) {
          updated.endCustomerAddress1 = dsv.endCustomerAddress;
          changed = true;
        }
        if (!cur.dsvSubmission) {
          updated.dsvSubmission = 'Web';
          changed = true;
        }

        if (changed) {
          updated.updatedAt = nowIso;
          list[idx] = updated;
          updatedCount++;
        }
      }
    }
  });

  return { updatedList: list, updatedCount };
}

/**
 * Convierte oportunidades del Pipeline Comercial al Forecast (Transformar Pipeline en Forecast)
 * sin duplicar las oportunidades que ya se encuentren en el forecast.
 */
export function convertPipelineDealsToForecast(
  pipelineDeals: PipelineDealRecord[],
  records: ForecastRecord[]
): { updatedList: ForecastRecord[]; addedCount: number; mergedCount: number } {
  let addedCount = 0;
  let mergedCount = 0;
  const list = [...records];
  const nowIso = new Date().toISOString();

  pipelineDeals.forEach((pDeal) => {
    const match = findMatchingForecastRecord(list, {
      dealId: pDeal.dealId,
      partner: pDeal.partner,
      endUser: pDeal.endUser,
    });

    if (match) {
      // Fusión de campos
      const idx = list.findIndex((r) => r.id === match.id);
      if (idx >= 0) {
        const cur = list[idx];
        list[idx] = {
          ...cur,
          usdIntcomex: cur.usdIntcomex || pDeal.usd,
          pmResponsable: cur.pmResponsable || pDeal.pmResponsable,
          ejecutivoPartner: cur.ejecutivoPartner || pDeal.ejecutivoPartner,
          productos: cur.productos || pDeal.productosSuscripciones,
          servicios: cur.servicios || pDeal.servicios,
          meraki: cur.meraki || pDeal.meraki,
          am: cur.am || pDeal.am,
          grupoVentas: cur.grupoVentas || pDeal.grupoVentas,
          mesFacturacion: cur.mesFacturacion || pDeal.mesFacturacion || pDeal.mesCierre,
          priceProtectionExpiryDate: cur.priceProtectionExpiryDate || pDeal.priceProtectionExpiryDate,
          sourcePipelineId: pDeal.id,
          updatedAt: nowIso,
        };
        mergedCount++;
      }
    } else {
      // Agregar nuevo registro
      const newId = `FC-${String(list.length + 1).padStart(4, '0')}`;
      const newRec: ForecastRecord = {
        id: newId,
        fechaLevantamiento: pDeal.fechaLevantamiento,
        fechaCotizacion: pDeal.fechaCotizacion,
        marca: pDeal.marca || 'CISCO',
        pmResponsable: pDeal.pmResponsable,
        partner: pDeal.partner,
        ejecutivoPartner: pDeal.ejecutivoPartner,
        endUser: pDeal.endUser,
        usdIntcomex: pDeal.usd,
        emailEjecutivoPartner: '',
        mesFacturacion: pDeal.mesFacturacion || pDeal.mesCierre,
        emailClienteFinal: '',
        detalleProductos: '',
        oc: '',
        deal: pDeal.dealId,
        productos: pDeal.productosSuscripciones,
        suscripciones: 0,
        servicios: pDeal.servicios,
        meraki: pDeal.meraki,
        am: pDeal.am,
        grupoVentas: pDeal.grupoVentas,
        observacion: pDeal.notas,
        dsvSubmission: '',
        po: '',
        so: '',
        submittedDate: '',
        clienteCisco: '',
        promotionAuthorizationNumber: '',
        endCustomerName: pDeal.endUser,
        endCustomerAddress1: '',
        numeroVenta: '',
        bodega: 'E1',
        caso: '',
        priceProtectionExpiryDate: pDeal.priceProtectionExpiryDate,
        credit: 'Aprobado',
        nuevoCaso: '',
        confirmacionCredito: '',
        sourcePipelineId: pDeal.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      list.unshift(newRec);
      addedCount++;
    }
  });

  return { updatedList: list, addedCount, mergedCount };
}

// ----------------------------------------------------------------------------
// Reminders & Expiration Engine
// ----------------------------------------------------------------------------

export function parseFlexibleDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  // Formato DD-MM-YYYY o DD/MM/YYYY
  const dmYMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1;
    const year = parseInt(dmYMatch[3], 10);
    return new Date(year, month, day);
  }
  // Formato YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Genera recordatorios comerciales y de vencimiento para el Forecast:
 * - Vencimiento de Price Protection (Alerta roja si expiró, amarilla si vence en 7 días)
 * - Estado de Crédito pendiente o en revisión
 * - Casos u operaciones abiertas
 * - Mes de facturación vencido sin número de orden/venta
 */
export function generateForecastReminders(records: ForecastRecord[]): ForecastReminderItem[] {
  const reminders: ForecastReminderItem[] = [];
  const now = new Date();
  const todayMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  records.forEach((r) => {
    // 1. Recordatorio Price Protection Expiry
    if (r.priceProtectionExpiryDate) {
      const expDate = parseFlexibleDate(r.priceProtectionExpiryDate);
      if (expDate) {
        const diffMs = expDate.getTime() - todayMs;
        if (diffMs < 0) {
          // Ya expiró
          reminders.push({
            id: `REM-EXP-${r.id}`,
            forecastId: r.id,
            dealId: r.deal || r.id,
            partner: r.partner,
            endUser: r.endUser,
            type: 'EXPIRY',
            severity: 'CRITICAL',
            title: 'Price Protection Vencida',
            message: `La protección de precio del Deal ${r.deal || r.id} (${r.partner}) venció el ${r.priceProtectionExpiryDate}. Solicitar extensión a Cisco.`,
            dueDate: r.priceProtectionExpiryDate,
            actionLabel: 'Ver Deal',
          });
        } else if (diffMs <= sevenDaysMs) {
          // Vence en <= 7 días
          const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
          reminders.push({
            id: `REM-EXP-SOON-${r.id}`,
            forecastId: r.id,
            dealId: r.deal || r.id,
            partner: r.partner,
            endUser: r.endUser,
            type: 'EXPIRY',
            severity: 'WARNING',
            title: `Price Protection por Vencer (${daysLeft}d)`,
            message: `El Deal ${r.deal || r.id} vence en ${daysLeft} días (${r.priceProtectionExpiryDate}). Cerrar orden o gestionar extensión.`,
            dueDate: r.priceProtectionExpiryDate,
            actionLabel: 'Gestionar',
          });
        }
      }
    }

    // 2. Recordatorio Crédito Pendiente
    if (r.credit) {
      const credLower = r.credit.toLowerCase();
      if (credLower.includes('pdte') || credLower.includes('revis') || credLower.includes('pendiente')) {
        reminders.push({
          id: `REM-CRED-${r.id}`,
          forecastId: r.id,
          dealId: r.deal || r.id,
          partner: r.partner,
          endUser: r.endUser,
          type: 'CREDIT',
          severity: 'WARNING',
          title: 'Crédito Pendiente de Aprobación',
          message: `El negocio ${r.partner} - ${r.endUser} ($${(r.usdIntcomex || 0).toLocaleString('en-US')}) tiene crédito en estado "${r.credit}".`,
          actionLabel: 'Validar Crédito',
        });
      }
    }

    // 3. Casos y Tickets Abiertos
    if (r.caso && r.caso.trim().length > 1) {
      reminders.push({
        id: `REM-CASO-${r.id}`,
        forecastId: r.id,
        dealId: r.deal || r.id,
        partner: r.partner,
        endUser: r.endUser,
        type: 'CASE',
        severity: 'INFO',
        title: `Caso Operacional Activo: ${r.caso}`,
        message: `Caso ${r.caso} asociado al Partner ${r.partner}. Observación: ${r.observacion || 'Sin detalles'}.`,
        actionLabel: 'Revisar Caso',
      });
    }

    if (r.nuevoCaso && r.nuevoCaso.trim().length > 1) {
      reminders.push({
        id: `REM-NEWCASO-${r.id}`,
        forecastId: r.id,
        dealId: r.deal || r.id,
        partner: r.partner,
        endUser: r.endUser,
        type: 'CASE',
        severity: 'INFO',
        title: `Nuevo Caso: ${r.nuevoCaso}`,
        message: `Seguimiento de Nuevo Caso ${r.nuevoCaso} para ${r.partner}.`,
        actionLabel: 'Revisar',
      });
    }
  });

  return reminders;
}

// ----------------------------------------------------------------------------
// Excel (36 Columns) & Google Sheet Import/Export Engine
// ----------------------------------------------------------------------------

export function exportForecastToCsv(records: ForecastRecord[]): string {
  const headerRow = FORECAST_36_COLUMNS.map((col) => `"${col.label}"`).join(',');

  const rows = records.map((r) => {
    return FORECAST_36_COLUMNS.map((col) => {
      const val = r[col.key];
      if (val === undefined || val === null) return '""';
      if (typeof val === 'number') return `"${val}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

export function parseCsvToForecastRecords(
  csvText: string,
  existingRecords: ForecastRecord[]
): { imported: ForecastRecord[]; duplicateCount: number; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { imported: [], duplicateCount: 0, errors: ['El archivo no contiene suficientes filas.'] };
  }

  // Parse header line to determine column positions
  const headerLine = lines[0];
  const headerTokens = headerLine.split(/[,;\t]/).map((t) => t.replace(/^["']|["']$/g, '').trim().toLowerCase());

  // Mapping from our 36 keys to index
  const keyToIndex: Record<string, number> = {};
  FORECAST_36_COLUMNS.forEach((col) => {
    const idx = headerTokens.findIndex((tok) => tok.includes(col.label.toLowerCase()) || col.label.toLowerCase().includes(tok));
    if (idx >= 0) keyToIndex[col.key] = idx;
  });

  const imported: ForecastRecord[] = [];
  let duplicateCount = 0;
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV token splitter supporting quotes
    const tokens = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((t) => t.replace(/^["']|["']$/g, '').trim());

    const getVal = (key: keyof ForecastRecord, def = ''): string => {
      const idx = keyToIndex[key];
      if (idx !== undefined && idx < tokens.length) return tokens[idx];
      return def;
    };

    const getNum = (key: keyof ForecastRecord): number => {
      const str = getVal(key);
      return parseFlexibleNumber(str);
    };

    const partner = getVal('partner');
    const endUser = getVal('endUser');
    const deal = getVal('deal');
    const so = getVal('so');
    const nv = getVal('numeroVenta');
    const po = getVal('po');
    const oc = getVal('oc');
    const usd = getNum('usdIntcomex');
    const mesFact = getVal('mesFacturacion');
    const fechaCot = getVal('fechaCotizacion');

    if (!partner && !deal && !so && usd === 0) continue;

    // Deduplication check against existing pool
    const existingMatch = findMatchingForecastRecord([...existingRecords, ...imported], {
      dealId: deal,
      so,
      numeroVenta: nv,
      po,
      oc,
      partner,
      endUser,
      usd,
      mesFacturacion: mesFact,
      fechaCotizacion: fechaCot,
    });

    if (existingMatch) {
      // Reconciliación Inteligente: enriquecer registro existente
      existingMatch.deal = deal || existingMatch.deal;
      existingMatch.so = so || existingMatch.so;
      existingMatch.po = po || existingMatch.po;
      existingMatch.oc = oc || existingMatch.oc;
      existingMatch.numeroVenta = nv || existingMatch.numeroVenta;
      existingMatch.usdIntcomex = usd > 0 ? usd : existingMatch.usdIntcomex;
      existingMatch.mesFacturacion = mesFact || existingMatch.mesFacturacion;
      existingMatch.updatedAt = nowIso;
      duplicateCount++;
      continue;
    }

    const recId = `FC-${String(existingRecords.length + imported.length + 1).padStart(4, '0')}`;
    const newRec: ForecastRecord = {
      id: recId,
      fechaLevantamiento: getVal('fechaLevantamiento'),
      fechaCotizacion: getVal('fechaCotizacion'),
      marca: getVal('marca', 'CISCO'),
      pmResponsable: getVal('pmResponsable', 'Raul Cuevas'),
      partner,
      ejecutivoPartner: getVal('ejecutivoPartner'),
      endUser,
      usdIntcomex: usd,
      emailEjecutivoPartner: getVal('emailEjecutivoPartner'),
      mesFacturacion: mesFact,
      emailClienteFinal: getVal('emailClienteFinal'),
      detalleProductos: getVal('detalleProductos'),
      oc,
      deal,
      productos: getNum('productos'),
      suscripciones: getNum('suscripciones'),
      servicios: getNum('servicios'),
      meraki: getNum('meraki'),
      am: getVal('am'),
      grupoVentas: getVal('grupoVentas', 'Top Volume'),
      observacion: getVal('observacion'),
      dsvSubmission: getVal('dsvSubmission'),
      po,
      so,
      submittedDate: getVal('submittedDate'),
      clienteCisco: getVal('clienteCisco'),
      promotionAuthorizationNumber: getVal('promotionAuthorizationNumber'),
      endCustomerName: getVal('endCustomerName', endUser),
      endCustomerAddress1: getVal('endCustomerAddress1'),
      numeroVenta: nv,
      bodega: getVal('bodega', 'E1'),
      caso: getVal('caso'),
      priceProtectionExpiryDate: getVal('priceProtectionExpiryDate'),
      credit: getVal('credit', 'Aprobado'),
      nuevoCaso: getVal('nuevoCaso'),
      confirmacionCredito: getVal('confirmacionCredito'),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    imported.push(newRec);
  }

  return { imported, duplicateCount, errors };
}

/**
 * Parsea un archivo Excel (.xlsx / .xls) o CSV en formato Forecast Intcomex (36 columnas)
 * e importa/reconcilia los registros aplicando el Motor Anti-Duplicación Multi-Vectorial.
 */
export async function importForecastFromExcel(
  arrayBuffer: ArrayBuffer,
  existingRecords: ForecastRecord[]
): Promise<{
  imported: ForecastRecord[];
  addedCount: number;
  updatedCount: number;
  duplicatesSkipped: number;
}> {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('El archivo Excel no contiene ninguna hoja válida.');

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawRows || rawRows.length < 2) throw new Error('El archivo no contiene filas de datos.');

  const cleanStr = (val: any): string => (val === null || val === undefined ? '' : String(val).trim());
  const parseNum = (val: any): number => parseFlexibleNumber(val);

  // 1. Identificar fila de encabezados y mapear columnas
  let headerRowIdx = 0;
  const colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
    const row = rawRows[r].map((c) => cleanStr(c).toLowerCase());
    const matchCount = FORECAST_36_COLUMNS.filter((col) =>
      row.some((tok) => tok.includes(col.label.toLowerCase()) || col.label.toLowerCase().includes(tok))
    ).length;

    if (matchCount >= 3) {
      headerRowIdx = r;
      FORECAST_36_COLUMNS.forEach((col) => {
        const idx = row.findIndex((tok) => tok.includes(col.label.toLowerCase()) || col.label.toLowerCase().includes(tok));
        if (idx >= 0) colMap[col.key] = idx;
      });
      break;
    }
  }

  const getCol = (row: any[], key: keyof ForecastRecord, fallbackIdx: number): string => {
    const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
    return cleanStr(row[idx]);
  };

  const getNumCol = (row: any[], key: keyof ForecastRecord, fallbackIdx: number): number => {
    const str = getCol(row, key, fallbackIdx);
    return parseNum(str);
  };

  const pool = [...existingRecords];
  let addedCount = 0;
  let updatedCount = 0;
  const nowIso = new Date().toISOString();
  const dataRows = rawRows.slice(headerRowIdx + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c: any) => !cleanStr(c))) continue;

    const partner = getCol(row, 'partner', 4);
    const endUser = getCol(row, 'endUser', 6);
    const deal = getCol(row, 'deal', 13);
    const so = getCol(row, 'so', 23);
    const po = getCol(row, 'po', 22);
    const oc = getCol(row, 'oc', 12);
    const nv = getCol(row, 'numeroVenta', 29);
    const usd = getNumCol(row, 'usdIntcomex', 7);
    const mesFact = getCol(row, 'mesFacturacion', 9);
    const fechaCot = getCol(row, 'fechaCotizacion', 1);

    if (!partner && !deal && !so && usd === 0) continue;

    // Motor Anti-Duplicación Multi-Vectorial
    const match = findMatchingForecastRecord(pool, {
      dealId: deal,
      so,
      numeroVenta: nv,
      po,
      oc,
      partner,
      endUser,
      usd,
      mesFacturacion: mesFact,
      fechaCotizacion: fechaCot,
    });

    if (match) {
      const idx = pool.findIndex((r) => r.id === match.id);
      if (idx >= 0) {
        const cur = pool[idx];
        pool[idx] = {
          ...cur,
          deal: deal || cur.deal,
          so: so || cur.so,
          po: po || cur.po,
          oc: oc || cur.oc,
          numeroVenta: nv || cur.numeroVenta,
          usdIntcomex: usd > 0 ? usd : cur.usdIntcomex,
          mesFacturacion: mesFact || cur.mesFacturacion,
          pmResponsable: getCol(row, 'pmResponsable', 3) || cur.pmResponsable,
          ejecutivoPartner: getCol(row, 'ejecutivoPartner', 5) || cur.ejecutivoPartner,
          productos: getNumCol(row, 'productos', 14) || cur.productos,
          suscripciones: getNumCol(row, 'suscripciones', 15) || cur.suscripciones,
          servicios: getNumCol(row, 'servicios', 16) || cur.servicios,
          meraki: getNumCol(row, 'meraki', 17) || cur.meraki,
          am: getCol(row, 'am', 18) || cur.am,
          grupoVentas: getCol(row, 'grupoVentas', 19) || cur.grupoVentas,
          bodega: getCol(row, 'bodega', 30) || cur.bodega,
          credit: getCol(row, 'credit', 33) || cur.credit,
          observacion: getCol(row, 'observacion', 20) || cur.observacion,
          updatedAt: nowIso,
        };
        updatedCount++;
      }
    } else {
      const newId = `FC-${String(pool.length + 1).padStart(4, '0')}`;
      const newRec: ForecastRecord = {
        id: newId,
        fechaLevantamiento: getCol(row, 'fechaLevantamiento', 0) || fechaCot,
        fechaCotizacion: fechaCot || getCol(row, 'fechaLevantamiento', 0),
        marca: getCol(row, 'marca', 2) || 'CISCO',
        pmResponsable: getCol(row, 'pmResponsable', 3) || 'Raul Cuevas',
        partner,
        ejecutivoPartner: getCol(row, 'ejecutivoPartner', 5),
        endUser,
        usdIntcomex: usd,
        emailEjecutivoPartner: getCol(row, 'emailEjecutivoPartner', 8),
        mesFacturacion: mesFact,
        emailClienteFinal: getCol(row, 'emailClienteFinal', 10),
        detalleProductos: getCol(row, 'detalleProductos', 11),
        oc,
        deal,
        productos: getNumCol(row, 'productos', 14),
        suscripciones: getNumCol(row, 'suscripciones', 15),
        servicios: getNumCol(row, 'servicios', 16),
        meraki: getNumCol(row, 'meraki', 17),
        am: getCol(row, 'am', 18),
        grupoVentas: getCol(row, 'grupoVentas', 19) || 'Top Volume',
        observacion: getCol(row, 'observacion', 20),
        dsvSubmission: getCol(row, 'dsvSubmission', 21),
        po,
        so,
        submittedDate: getCol(row, 'submittedDate', 24),
        clienteCisco: getCol(row, 'clienteCisco', 25),
        promotionAuthorizationNumber: getCol(row, 'promotionAuthorizationNumber', 26),
        endCustomerName: getCol(row, 'endCustomerName', 27) || endUser,
        endCustomerAddress1: getCol(row, 'endCustomerAddress1', 28),
        numeroVenta: nv,
        bodega: getCol(row, 'bodega', 30) || 'E1',
        caso: getCol(row, 'caso', 31),
        priceProtectionExpiryDate: getCol(row, 'priceProtectionExpiryDate', 32),
        credit: getCol(row, 'credit', 33) || 'Aprobado',
        nuevoCaso: getCol(row, 'nuevoCaso', 34),
        confirmacionCredito: getCol(row, 'confirmacionCredito', 35),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      pool.push(newRec);
      addedCount++;
    }
  }

  return {
    imported: pool,
    addedCount,
    updatedCount,
    duplicatesSkipped: updatedCount,
  };
}

/**
 * Importa datos desde una URL pública de Google Sheets exportada como CSV
 * o desde texto CSV/TSV copiado y pegado directamente de Google Sheets.
 */
export async function importFromGoogleSheetsCsv(
  csvTextOrUrl: string,
  existingRecords: ForecastRecord[]
): Promise<{ imported: ForecastRecord[]; count: number; duplicatesSkipped: number }> {
  let content = csvTextOrUrl.trim();

  // Si es URL
  if (content.startsWith('http://') || content.startsWith('https://')) {
    // Auto-formatear enlace de Google Sheet a export CSV si es link de edición
    if (content.includes('docs.google.com/spreadsheets')) {
      const match = content.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        content = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      }
    }
    const res = await fetch(content);
    if (!res.ok) {
      throw new Error(`Error descargando Google Sheet (HTTP ${res.status}): ${res.statusText}`);
    }
    content = await res.text();
  }

  const { imported, duplicateCount } = parseCsvToForecastRecords(content, existingRecords);
  return { imported, count: imported.length, duplicatesSkipped: duplicateCount };
}
