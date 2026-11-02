// ============================================================================
// CISCO AUTOMATED v2.8 - PIPELINE COMERCIAL SERVICE & CROSS-MODULE INTEGRATION
// ============================================================================

import * as XLSX from 'xlsx';
import {
  PipelineDealRecord,
  PipelineFilterOptions,
  PipelineStats,
  MESES_ANO,
} from './pipelineTypes';
import { ProcessedEstimateResult, UserSession } from '../../core/types';
import { savePipelineDeal, getPipelineDeals } from './pipelineStorage';

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
    const usd = Number(deal.usd) || 0;
    const avance = Number(deal.porcentajeAvance) || 0;
    const prodSub = Number(deal.productosSuscripciones) || 0;
    const serv = Number(deal.servicios) || 0;
    const meraki = Number(deal.meraki) || 0;

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
      const expTimestamp = new Date(deal.priceProtectionExpiryDate).getTime();
      if (!isNaN(expTimestamp)) {
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

    return true;
  });
}

// ----------------------------------------------------------------------------
// 3. Cruce de Datos con Cotizador Cisco CCW & Historial Estimates
// ----------------------------------------------------------------------------

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

  // Buscar coincidencia previa por dealId o sourceEstimateId
  let match = existingDeals.find(
    (d) =>
      (extracted.dealId && d.dealId && d.dealId === extracted.dealId) ||
      (d.sourceEstimateId && d.sourceEstimateId === extracted.sourceEstimateId)
  );

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
 * Parsea un archivo Excel subido por el usuario e importa las oportunidades al store.
 */
export async function importPipelineFromExcel(arrayBuffer: ArrayBuffer): Promise<{ importedCount: number; deals: PipelineDealRecord[] }> {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('El archivo Excel no contiene ninguna hoja válida.');

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rawRows || rawRows.length < 2) throw new Error('El archivo Excel está vacío o no contiene filas de datos.');

  const parseNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).replace(/[$€£,\s]/g, '').trim();
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
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

  // Encontrar fila de encabezados
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const rowStr = rawRows[r].map(cleanStr).join(' ').toLowerCase();
    if (rowStr.includes('levantamiento') || rowStr.includes('cotizacion') || rowStr.includes('partner') || rowStr.includes('usd')) {
      headerRowIdx = r;
      break;
    }
  }

  const dataRows = rawRows.slice(headerRowIdx + 1);
  const parsedDeals: PipelineDealRecord[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c: any) => !cleanStr(c))) continue;

    const fechaLev = cleanStr(row[0]);
    const fechaCot = cleanStr(row[1]);
    const marca = cleanStr(row[2]) || 'Cisco';
    const pm = cleanStr(row[3]);
    const partner = cleanStr(row[4]);
    const ejecutivoPartner = cleanStr(row[5]);
    const endUser = cleanStr(row[6]);
    const usd = parseNum(row[7]);
    const mesCierre = cleanStr(row[8]);
    const mesFact = cleanStr(row[9]);
    const avance = parsePct(row[10]);
    const dealId = cleanStr(row[11]);
    const prodSub = parseNum(row[12]);
    const servicios = parseNum(row[13]);
    const meraki = parseNum(row[14]);
    const am = cleanStr(row[15]);
    const grupoVentas = cleanStr(row[16]) || 'Enterprise';
    const notas = cleanStr(row[17]);
    const priceProt = cleanStr(row[18]);

    // Omitir filas sin datos de partner o monto
    if (!partner && !endUser && usd === 0) continue;

    const deal: PipelineDealRecord = {
      id: `deal_import_${Date.now()}_${i}`,
      fechaLevantamiento: fechaLev || fechaCot,
      fechaCotizacion: fechaCot || fechaLev,
      marca,
      pmResponsable: pm,
      partner,
      ejecutivoPartner,
      endUser,
      usd: usd > 0 ? usd : prodSub + servicios + meraki,
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

    await savePipelineDeal(deal);
    parsedDeals.push(deal);
  }

  return { importedCount: parsedDeals.length, deals: parsedDeals };
}
