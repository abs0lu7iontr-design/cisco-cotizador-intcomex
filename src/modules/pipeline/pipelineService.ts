// ============================================================================
// CISCO AUTOMATED v2.8 - PIPELINE COMERCIAL SERVICE & CROSS-MODULE INTEGRATION
// ============================================================================

import * as XLSX from 'xlsx';
import {
  PipelineDealRecord,
  PipelineFilterOptions,
  PipelineStats,
  PipelineReminderItem,
  MESES_ANO,
} from './pipelineTypes';
import { ProcessedEstimateResult, UserSession } from '../../core/types';
import { savePipelineDeal, getPipelineDeals } from './pipelineStorage';
import { parseFlexibleNumber, parseFlexibleDate, normalizeMatchKey } from '../forecast/forecastService';

// ----------------------------------------------------------------------------
// 1. Estadísticas y Agregaciones de Negocio
// ----------------------------------------------------------------------------

export function calculatePipelineStats(deals: PipelineDealRecord[]): PipelineStats {
  let totalUsd = 0;
  let forecastPonderadoUsd = 0;
  let totalProductosSuscripciones = 0;
  let totalServicios = 0;
  let totalMeraki = 0;
  let dealsGanadosCount = 0;
  let dealsGanadosUsd = 0;
  let dealsEnNegociacionCount = 0;
  let dealsEnNegociacionUsd = 0;
  let dealsPriceProtectionAlertsCount = 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const deal of deals) {
    const rawUsd = parseFlexibleNumber(deal.usd);
    const avance = parseFlexibleNumber(deal.porcentajeAvance);
    const prodSub = parseFlexibleNumber(deal.productosSuscripciones);
    const serv = parseFlexibleNumber(deal.servicios);
    const meraki = parseFlexibleNumber(deal.meraki);

    // Fallback de suma consistente: si usd está vacío/cero pero hay desglose tecnológico
    const breakdownSum = Number((prodSub + serv + meraki).toFixed(2));
    const usd = rawUsd > 0 ? rawUsd : breakdownSum;

    totalUsd += usd;
    forecastPonderadoUsd += usd * (avance / 100);
    totalProductosSuscripciones += prodSub;
    totalServicios += serv;
    totalMeraki += meraki;

    if (avance === 100) {
      dealsGanadosCount++;
      dealsGanadosUsd += usd;
    } else if (avance >= 20 && avance <= 70) {
      dealsEnNegociacionCount++;
      dealsEnNegociacionUsd += usd;
    }

    // Comprobar alertas de Price Protection
    if (deal.priceProtectionExpiryDate) {
      const expDate = parseFlexibleDate(deal.priceProtectionExpiryDate);
      if (expDate) {
        const expTimestamp = expDate.getTime();
        if (expTimestamp - now <= thirtyDaysMs) {
          dealsPriceProtectionAlertsCount++;
        }
      }
    }
  }

  return {
    totalDeals: deals.length,
    totalUsd: Number(totalUsd.toFixed(2)),
    forecastPonderadoUsd: Number(forecastPonderadoUsd.toFixed(2)),
    totalProductosSuscripciones: Number(totalProductosSuscripciones.toFixed(2)),
    totalServicios: Number(totalServicios.toFixed(2)),
    totalMeraki: Number(totalMeraki.toFixed(2)),
    dealsGanadosCount,
    dealsGanadosUsd: Number(dealsGanadosUsd.toFixed(2)),
    dealsEnNegociacionCount,
    dealsEnNegociacionUsd: Number(dealsEnNegociacionUsd.toFixed(2)),
    dealsPriceProtectionAlertsCount,
  };
}

// ----------------------------------------------------------------------------
// 2. Filtrado y Búsqueda Multicriterio
// ----------------------------------------------------------------------------

export function filterPipelineDeals(
  deals: PipelineDealRecord[],
  options: PipelineFilterOptions
): PipelineDealRecord[] {
  return deals.filter((deal) => {
    // 1. Búsqueda por texto libre
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      const matchSearch =
        (deal.partner && deal.partner.toLowerCase().includes(q)) ||
        (deal.endUser && deal.endUser.toLowerCase().includes(q)) ||
        (deal.dealId && deal.dealId.toLowerCase().includes(q)) ||
        (deal.pmResponsable && deal.pmResponsable.toLowerCase().includes(q)) ||
        (deal.am && deal.am.toLowerCase().includes(q)) ||
        (deal.ejecutivoPartner && deal.ejecutivoPartner.toLowerCase().includes(q)) ||
        (deal.notas && deal.notas.toLowerCase().includes(q));
      if (!matchSearch) return false;
    }

    // 2. Filtro por PM
    if (options.pmResponsable && options.pmResponsable !== 'ALL') {
      if (deal.pmResponsable !== options.pmResponsable) return false;
    }

    // 3. Filtro por Grupo de Ventas
    if (options.grupoVentas && options.grupoVentas !== 'ALL') {
      if (deal.grupoVentas !== options.grupoVentas) return false;
    }

    // 4. Filtro por Mes de Cierre
    if (options.mesCierre && options.mesCierre !== 'ALL') {
      if ((deal.mesCierre || '').toLowerCase() !== options.mesCierre.toLowerCase()) return false;
    }

    // 5. Filtro por AM
    if (options.am && options.am !== 'ALL') {
      if (deal.am !== options.am) return false;
    }

    // 6. Filtro por % de Avance
    if (options.porcentajeAvance !== undefined && options.porcentajeAvance !== 'ALL') {
      if (deal.porcentajeAvance !== options.porcentajeAvance) return false;
    }

    // 7. Filtro por Partner
    if (options.partner && options.partner !== 'ALL') {
      if (deal.partner !== options.partner) return false;
    }

    // 8. Filtro solo con Recordatorios
    if (options.onlyWithReminders) {
      const reminders = generatePipelineReminders([deal]);
      if (reminders.length === 0) return false;
    }

    return true;
  });
}

/**
 * Genera recordatorios comerciales y de vencimiento para el Pipeline
 */
export function generatePipelineReminders(deals: PipelineDealRecord[]): PipelineReminderItem[] {
  const reminders: PipelineReminderItem[] = [];
  const now = new Date();
  const todayMs = now.getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  deals.forEach((deal) => {
    // 1. Price Protection Expiration
    if (deal.priceProtectionExpiryDate) {
      const expDate = parseFlexibleDate(deal.priceProtectionExpiryDate);
      if (expDate) {
        const diffMs = expDate.getTime() - todayMs;
        if (diffMs < 0) {
          reminders.push({
            id: `REM-PIPE-EXP-${deal.id}`,
            dealId: deal.dealId || deal.id,
            partner: deal.partner,
            endUser: deal.endUser,
            usd: deal.usd,
            porcentajeAvance: deal.porcentajeAvance,
            type: 'PRICE_PROTECTION_EXPIRED',
            severity: 'CRITICAL',
            title: 'Price Protection Expirada',
            message: `La protección de precios del Deal ${deal.dealId || deal.id} (${deal.partner}) expiró el ${deal.priceProtectionExpiryDate}.`,
            dueDate: deal.priceProtectionExpiryDate,
          });
        } else if (diffMs <= fourteenDaysMs) {
          const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
          reminders.push({
            id: `REM-PIPE-SOON-${deal.id}`,
            dealId: deal.dealId || deal.id,
            partner: deal.partner,
            endUser: deal.endUser,
            usd: deal.usd,
            porcentajeAvance: deal.porcentajeAvance,
            type: 'PRICE_PROTECTION_SOON',
            severity: 'WARNING',
            title: `Price Protection por Expirar (${days}d)`,
            message: `El Deal ${deal.dealId || deal.id} vence en ${days} días (${deal.priceProtectionExpiryDate}).`,
            dueDate: deal.priceProtectionExpiryDate,
          });
        }
      }
    }

    // 2. Urgent Deals in negotiation for current month
    if ((deal.porcentajeAvance === 50 || deal.porcentajeAvance === 70) && deal.mesCierre) {
      const currentMonthName = MESES_ANO[now.getMonth()];
      if (deal.mesCierre.toLowerCase() === currentMonthName.toLowerCase()) {
        reminders.push({
          id: `REM-PIPE-CLOSE-${deal.id}`,
          dealId: deal.dealId || deal.id,
          partner: deal.partner,
          endUser: deal.endUser,
          usd: deal.usd,
          porcentajeAvance: deal.porcentajeAvance,
          type: 'CLOSING_MONTH_URGENT',
          severity: 'INFO',
          title: `Cierre Programado para ${deal.mesCierre}`,
          message: `Oportunidad ${deal.partner} - ${deal.endUser} ($${deal.usd.toLocaleString('en-US')}) al ${deal.porcentajeAvance}% de avance programada para cerrar este mes.`,
        });
      }
    }
  });

  return reminders;
}

// ----------------------------------------------------------------------------
// 3. Cruce de Datos con Cotizador Cisco CCW & Motor Anti-Duplicación
// ----------------------------------------------------------------------------

export interface PipelineMatchCandidate {
  dealId?: string;
  sourceEstimateId?: string;
  partner?: string;
  endUser?: string;
  usd?: number;
  mesCierre?: string;
  fechaCotizacion?: string;
}

/**
 * Motor Anti-Duplicación Multi-Vectorial para el Pipeline Comercial:
 * - Vector 1: Deal ID oficial Cisco CCW (# Registro Oportunidad Marca) limpio y normalizado.
 * - Vector 2: Estimate ID si provienen de cotizaciones del cotizador.
 * - Vector 3: Composite Partner + End User + Monto USD (dentro de tolerancia de $10 o ±2%).
 * - Vector 4: Composite Partner + End User + Mes de Cierre / Fecha de Cotización.
 */
export function findMatchingPipelineDeal(
  deals: PipelineDealRecord[],
  candidate: PipelineMatchCandidate
): PipelineDealRecord | undefined {
  if (!candidate) return undefined;

  // Vector 1: Deal ID oficial de Cisco
  const cleanDeal = candidate.dealId?.trim().replace(/^[#\s]+/, '');
  if (cleanDeal && cleanDeal !== 'NA' && cleanDeal !== 'N/A' && cleanDeal !== '-' && cleanDeal.length >= 4) {
    const match = deals.find((d) => {
      const dClean = d.dealId?.trim().replace(/^[#\s]+/, '');
      return dClean && dClean.toLowerCase() === cleanDeal.toLowerCase();
    });
    if (match) return match;
  }

  // Vector 2: Estimate ID
  if (candidate.sourceEstimateId && candidate.sourceEstimateId.trim().length >= 4) {
    const cleanEst = candidate.sourceEstimateId.trim().toLowerCase();
    const match = deals.find(
      (d) => d.sourceEstimateId && d.sourceEstimateId.trim().toLowerCase() === cleanEst
    );
    if (match) return match;
  }

  // Vector 3 & 4: Composite Fingerprint (Partner + End User + Monto / Mes)
  const normPartner = normalizeMatchKey(candidate.partner);
  const normEndUser = normalizeMatchKey(candidate.endUser);

  if (normPartner && normEndUser && normEndUser !== 'na' && normEndUser !== '-') {
    const candidateUsd = typeof candidate.usd === 'number' ? candidate.usd : 0;
    const candidateMes = (candidate.mesCierre || '').trim().toLowerCase();
    const candidateFecha = (candidate.fechaCotizacion || '').trim();

    for (const d of deals) {
      const dPartner = normalizeMatchKey(d.partner);
      const dEndUser = normalizeMatchKey(d.endUser);
      if (!dPartner || !dEndUser) continue;

      const partnerMatches = dPartner.includes(normPartner) || normPartner.includes(dPartner);
      const endUserMatches = dEndUser.includes(normEndUser) || normEndUser.includes(dEndUser);

      if (partnerMatches && endUserMatches) {
        // Sub-vector A: Monto USD coincidente (tolerancia de 2% o 10 USD)
        if (candidateUsd > 0 && d.usd > 0) {
          const diff = Math.abs(d.usd - candidateUsd);
          const pctDiff = diff / Math.max(d.usd, candidateUsd);
          if (diff <= 10 || pctDiff <= 0.02) {
            return d;
          }
        }

        // Sub-vector B: Mismo Mes de Cierre (con monto dentro del 15% o 0)
        if (candidateMes && d.mesCierre && d.mesCierre.trim().toLowerCase() === candidateMes) {
          if (candidateUsd === 0 || d.usd === 0 || Math.abs(d.usd - candidateUsd) / Math.max(d.usd, candidateUsd) <= 0.15) {
            return d;
          }
        }

        // Sub-vector C: Misma Fecha de Cotización
        if (candidateFecha && d.fechaCotizacion && d.fechaCotizacion.trim() === candidateFecha) {
          return d;
        }

        // Sub-vector D: Fallback cuando no se suministraron montos ni fechas discriminatorias
        if (candidateUsd === 0 && !candidateMes && !candidateFecha) {
          return d;
        }
      }
    }
  }

  return undefined;
}

const MERAKI_PREFIX_REGEX = /^(?:MR|MS|MX|MV|MT|MG|CW91|LIC-ENT|LIC-SEC|LIC-MR|LIC-MS|LIC-MX)/i;
const SMARTNET_PREFIX_REGEX = /^(?:CON-|SVS-|CX-|SNTC)/i;

/**
 * Cruza los datos de un Estimate procesado en el Cotizador Cisco CCW
 * clasificando automáticamente las líneas en:
 * - Meraki Cloud
 * - Servicios SmartNet
 * - Productos + Suscripciones
 */
export function extractPipelineDealFromEstimate(
  estimate: ProcessedEstimateResult,
  currentUser?: UserSession | null
): PipelineDealRecord {
  const now = new Date();
  const dateFormatted = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const currentMonthName = MESES_ANO[now.getMonth()];

  let totalMeraki = 0;
  let totalServicios = 0;
  let totalProdSub = 0;

  if (Array.isArray(estimate.items)) {
    for (const item of estimate.items) {
      const pn = (item.partNumber || '').trim().toUpperCase();
      const desc = (item.description || '').toLowerCase();
      const lineExt = Number(item.precioVentaExtendido) || 0;

      if (MERAKI_PREFIX_REGEX.test(pn) || desc.includes('meraki')) {
        totalMeraki += lineExt;
      } else if (SMARTNET_PREFIX_REGEX.test(pn) || (item.isIntangible && (desc.includes('smartnet') || desc.includes('sntc') || desc.includes('service')))) {
        totalServicios += lineExt;
      } else {
        totalProdSub += lineExt;
      }
    }
  }

  const grandTotal = Number(
    (totalMeraki + totalServicios + totalProdSub > 0
      ? totalMeraki + totalServicios + totalProdSub
      : estimate.calculatedProductTotal || estimate.finalTotalPrice || 0
    ).toFixed(2)
  );

  // PM Responsable basado en el usuario de sesión o asignación predeterminada
  let pmResponsable = 'Raul Cuevas';
  if (currentUser?.full_name) {
    pmResponsable = currentUser.full_name;
  }

  const rawDealId = estimate.headerInfo?.dealId;
  const dealId = rawDealId && rawDealId !== 'NA' ? rawDealId : '';
  const partner = estimate.headerInfo?.companyName && estimate.headerInfo.companyName !== 'Partner' ? estimate.headerInfo.companyName : '';
  const endUser = estimate.headerInfo?.endUser || estimate.headerInfo?.customerName || '';
  const estId = estimate.headerInfo?.estimateId || '';

  return {
    id: `deal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fechaLevantamiento: dateFormatted,
    fechaCotizacion: dateFormatted,
    marca: 'Cisco',
    pmResponsable,
    partner,
    ejecutivoPartner: '',
    endUser,
    usd: grandTotal,
    mesCierre: currentMonthName,
    mesFacturacion: '',
    porcentajeAvance: 30, // 30% = Propuesta / Cotizado CCW
    dealId,
    productosSuscripciones: Number(totalProdSub.toFixed(2)),
    servicios: Number(totalServicios.toFixed(2)),
    meraki: Number(totalMeraki.toFixed(2)),
    am: '',
    grupoVentas: 'Enterprise',
    notas: `Cotización vinculada desde Estimate CCW #${estId || 'N/A'}.`,
    priceProtectionExpiryDate: '',
    sourceEstimateId: estId,
    sourceEstimateVersion: 'v0',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Importa o actualiza una oportunidad en el pipeline directamente desde el Cotizador CCW.
 * Si ya existe una oportunidad con el mismo Deal ID o Estimate ID, actualiza los montos manteniendo notas.
 */
export async function importEstimateIntoPipeline(
  estimate: ProcessedEstimateResult,
  currentUser?: UserSession | null
): Promise<PipelineDealRecord> {
  const existingDeals = await getPipelineDeals();
  const extracted = extractPipelineDealFromEstimate(estimate, currentUser);

  // Buscar coincidencia previa mediante el Motor Anti-Duplicación Multi-Vectorial
  let match = findMatchingPipelineDeal(existingDeals, {
    dealId: extracted.dealId,
    sourceEstimateId: extracted.sourceEstimateId,
    partner: extracted.partner,
    endUser: extracted.endUser,
    usd: extracted.usd,
  });

  if (match) {
    const updated: PipelineDealRecord = {
      ...match,
      usd: extracted.usd,
      productosSuscripciones: extracted.productosSuscripciones,
      servicios: extracted.servicios,
      meraki: extracted.meraki,
      fechaCotizacion: extracted.fechaCotizacion,
      partner: extracted.partner || match.partner,
      endUser: extracted.endUser || match.endUser,
      sourceEstimateId: extracted.sourceEstimateId,
      updatedAt: new Date().toISOString(),
    };
    return await savePipelineDeal(updated);
  }

  return await savePipelineDeal(extracted);
}

// ----------------------------------------------------------------------------
// 4. Exportación e Importación de Planilla Excel (.xlsx)
// ----------------------------------------------------------------------------

export const PIPELINE_EXCEL_HEADERS = [
  'Fecha de Levantamiento',
  'Fecha de Cotizacion',
  'Marca',
  'PM Responsable',
  'Partner/Reseller',
  'Ejecutivo Partner',
  'End User',
  'USD',
  'Mes de Cierre',
  'Mes de Facturación',
  'Porcentaje de Avance',
  '#Registro Oportunidad Marca',
  'Productos + Suscripciones',
  'Servicios',
  'Meraki',
  'AM',
  'GRUPO DE Ventas',
  'Notas',
  'Price Protection Expiry Date',
];

/**
 * Genera y descarga un archivo Excel oficial del Pipeline con las 19 columnas exactas.
 */
export async function exportPipelineToExcel(deals: PipelineDealRecord[], filename = 'Pipeline_Comercial_Cisco_Intcomex.xlsx'): Promise<void> {
  const rows = [
    PIPELINE_EXCEL_HEADERS,
    ...deals.map((d) => [
      d.fechaLevantamiento || '',
      d.fechaCotizacion || '',
      d.marca || 'Cisco',
      d.pmResponsable || '',
      d.partner || '',
      d.ejecutivoPartner || '',
      d.endUser || '',
      d.usd || 0,
      d.mesCierre || '',
      d.mesFacturacion || '',
      `${d.porcentajeAvance}%`,
      d.dealId || '',
      d.productosSuscripciones || 0,
      d.servicios || 0,
      d.meraki || 0,
      d.am || '',
      d.grupoVentas || '',
      d.notas || '',
      d.priceProtectionExpiryDate || '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Formato de anchos de columna óptimos
  ws['!cols'] = [
    { wch: 14 }, // Fecha Lev
    { wch: 14 }, // Fecha Cot
    { wch: 10 }, // Marca
    { wch: 18 }, // PM
    { wch: 22 }, // Partner
    { wch: 20 }, // Ejecutivo Partner
    { wch: 24 }, // End User
    { wch: 14 }, // USD
    { wch: 14 }, // Mes Cierre
    { wch: 14 }, // Mes Fact
    { wch: 12 }, // % Avance
    { wch: 22 }, // Deal ID
    { wch: 18 }, // Prod + Sub
    { wch: 14 }, // Servicios
    { wch: 14 }, // Meraki
    { wch: 16 }, // AM
    { wch: 16 }, // Grupo Ventas
    { wch: 30 }, // Notas
    { wch: 18 }, // Price Protection
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline Cisco Intcomex');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Soporte nativo para pywebview Desktop Bridge y Navegador
  const pyApi = (window as any).pywebview?.api;
  if (pyApi?.save_file) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await pyApi.save_file(filename, base64);
    };
    reader.readAsDataURL(blob);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }
}

/**
 * Parsea un archivo Excel subido por el usuario e importa/reconcilia las oportunidades al store
 * aplicando el Motor Anti-Duplicación Multi-Vectorial (Deal ID, Estimate ID, Composite Partner+Cliente+Monto).
 */
export async function importPipelineFromExcel(
  arrayBuffer: ArrayBuffer
): Promise<{
  importedCount: number;
  addedCount: number;
  updatedCount: number;
  deals: PipelineDealRecord[];
}> {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('El archivo Excel no contiene ninguna hoja válida.');

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawRows || rawRows.length < 2) throw new Error('El archivo Excel está vacío o no contiene filas de datos.');

  const parseNum = (val: any): number => {
    return parseFlexibleNumber(val);
  };

  const parsePct = (val: any): number => {
    if (typeof val === 'number') {
      return val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
    }
    if (!val) return 30;
    const str = String(val).replace(/[%,\s]/g, '').trim();
    const n = parseInt(str, 10);
    return isNaN(n) ? 30 : n;
  };

  const cleanStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  };

  // 1. Detección Inteligente de Fila de Encabezados y Mapeo Dinámico de Columnas
  let headerRowIdx = 0;
  const colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
    const row = rawRows[r].map((c) => cleanStr(c).toLowerCase());
    const hasLev = row.some((c) => c.includes('levantamiento'));
    const hasPart = row.some((c) => c.includes('partner') || c.includes('reseller'));
    const hasUsd = row.some((c) => c.includes('usd') || c.includes('monto'));

    if ((hasLev && hasPart) || (hasPart && hasUsd)) {
      headerRowIdx = r;
      row.forEach((headerText, colIdx) => {
        if (headerText.includes('levantamiento')) colMap['fechaLevantamiento'] = colIdx;
        else if (headerText.includes('cotizacion') || headerText.includes('cotización')) colMap['fechaCotizacion'] = colIdx;
        else if (headerText.includes('marca')) colMap['marca'] = colIdx;
        else if (headerText.includes('pm') || headerText.includes('responsable')) colMap['pmResponsable'] = colIdx;
        else if (headerText.includes('ejecutivo') && headerText.includes('partner')) colMap['ejecutivoPartner'] = colIdx;
        else if (headerText.includes('partner') || headerText.includes('reseller')) colMap['partner'] = colIdx;
        else if (headerText.includes('end user') || headerText.includes('cliente') || headerText.includes('usuario')) colMap['endUser'] = colIdx;
        else if (headerText.includes('usd') || headerText.includes('monto')) colMap['usd'] = colIdx;
        else if (headerText.includes('cierre')) colMap['mesCierre'] = colIdx;
        else if (headerText.includes('facturacion') || headerText.includes('facturación')) colMap['mesFacturacion'] = colIdx;
        else if (headerText.includes('avance') || headerText.includes('%') || headerText.includes('porcentaje')) colMap['porcentajeAvance'] = colIdx;
        else if (headerText.includes('registro') || headerText.includes('deal') || headerText.includes('oportunidad')) colMap['dealId'] = colIdx;
        else if (headerText.includes('producto') || headerText.includes('suscrip')) colMap['productosSuscripciones'] = colIdx;
        else if (headerText.includes('servicio') || headerText.includes('smartnet')) colMap['servicios'] = colIdx;
        else if (headerText.includes('meraki')) colMap['meraki'] = colIdx;
        else if (headerText.includes('am') || headerText.includes('account')) colMap['am'] = colIdx;
        else if (headerText.includes('grupo') || headerText.includes('ventas')) colMap['grupoVentas'] = colIdx;
        else if (headerText.includes('nota') || headerText.includes('observ')) colMap['notas'] = colIdx;
        else if (headerText.includes('price') || headerText.includes('protection') || headerText.includes('expiry')) colMap['priceProtectionExpiryDate'] = colIdx;
      });
      break;
    }
  }

  const getCol = (row: any[], key: string, fallbackIdx: number): any => {
    const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx;
    return row[idx];
  };

  const existingDeals = await getPipelineDeals();
  const currentPool: PipelineDealRecord[] = [...existingDeals];
  let addedCount = 0;
  let updatedCount = 0;
  const now = new Date().toISOString();

  const dataRows = rawRows.slice(headerRowIdx + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c: any) => !cleanStr(c))) continue;

    const fechaLev = cleanStr(getCol(row, 'fechaLevantamiento', 0));
    const fechaCot = cleanStr(getCol(row, 'fechaCotizacion', 1));
    const marca = cleanStr(getCol(row, 'marca', 2)) || 'Cisco';
    const pm = cleanStr(getCol(row, 'pmResponsable', 3));
    const partner = cleanStr(getCol(row, 'partner', 4));
    const ejecutivoPartner = cleanStr(getCol(row, 'ejecutivoPartner', 5));
    const endUser = cleanStr(getCol(row, 'endUser', 6)) || '-';
    const usd = parseNum(getCol(row, 'usd', 7));
    const mesCierre = cleanStr(getCol(row, 'mesCierre', 8));
    const mesFact = cleanStr(getCol(row, 'mesFacturacion', 9));
    const avance = parsePct(getCol(row, 'porcentajeAvance', 10));
    const dealId = cleanStr(getCol(row, 'dealId', 11));
    const prodSub = parseNum(getCol(row, 'productosSuscripciones', 12));
    const servicios = parseNum(getCol(row, 'servicios', 13));
    const meraki = parseNum(getCol(row, 'meraki', 14));
    const am = cleanStr(getCol(row, 'am', 15));
    const grupoVentas = cleanStr(getCol(row, 'grupoVentas', 16)) || 'Enterprise';
    const notas = cleanStr(getCol(row, 'notas', 17));
    const priceProt = cleanStr(getCol(row, 'priceProtectionExpiryDate', 18));

    // Omitir filas sin datos de partner o monto
    if (!partner && endUser === '-' && usd === 0) continue;

    const finalUsd = usd > 0 ? usd : prodSub + servicios + meraki;

    // Motor Anti-Duplicación Multi-Vectorial
    const match = findMatchingPipelineDeal(currentPool, {
      dealId,
      partner,
      endUser,
      usd: finalUsd,
      mesCierre,
      fechaCotizacion: fechaCot,
    });

    if (match) {
      // Reconciliación Inteligente: Enriquecer registro existente sin duplicarlo
      const poolIdx = currentPool.findIndex((d) => d.id === match.id);
      if (poolIdx >= 0) {
        const existing = currentPool[poolIdx];
        const enriched: PipelineDealRecord = {
          ...existing,
          dealId: dealId || existing.dealId,
          fechaCotizacion: fechaCot || existing.fechaCotizacion,
          fechaLevantamiento: fechaLev || existing.fechaLevantamiento,
          pmResponsable: pm || existing.pmResponsable,
          ejecutivoPartner: ejecutivoPartner || existing.ejecutivoPartner,
          usd: finalUsd > 0 ? finalUsd : existing.usd,
          porcentajeAvance: avance || existing.porcentajeAvance,
          mesCierre: mesCierre || existing.mesCierre,
          mesFacturacion: mesFact || existing.mesFacturacion,
          productosSuscripciones: prodSub > 0 ? prodSub : existing.productosSuscripciones,
          servicios: servicios > 0 ? servicios : existing.servicios,
          meraki: meraki > 0 ? meraki : existing.meraki,
          am: am || existing.am,
          grupoVentas: grupoVentas || existing.grupoVentas,
          notas: notas ? (existing.notas ? `${existing.notas} | ${notas}` : notas) : existing.notas,
          priceProtectionExpiryDate: priceProt || existing.priceProtectionExpiryDate,
          updatedAt: now,
        };

        await savePipelineDeal(enriched);
        currentPool[poolIdx] = enriched;
        updatedCount++;
      }
    } else {
      // Nueva Oportunidad
      const newDeal: PipelineDealRecord = {
        id: `deal_pipe_${Date.now()}_${i}`,
        fechaLevantamiento: fechaLev || fechaCot,
        fechaCotizacion: fechaCot || fechaLev,
        marca,
        pmResponsable: pm,
        partner,
        ejecutivoPartner,
        endUser,
        usd: finalUsd,
        mesCierre,
        mesFacturacion: mesFact,
        porcentajeAvance: avance,
        dealId,
        productosSuscripciones: prodSub,
        servicios,
        meraki,
        am,
        grupoVentas,
        notas,
        priceProtectionExpiryDate: priceProt,
        createdAt: now,
        updatedAt: now,
      };

      await savePipelineDeal(newDeal);
      currentPool.push(newDeal);
      addedCount++;
    }
  }

  return {
    importedCount: addedCount + updatedCount,
    addedCount,
    updatedCount,
    deals: currentPool,
  };
}
