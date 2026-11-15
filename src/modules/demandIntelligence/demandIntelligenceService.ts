// ============================================================================
// CISCO AUTOMATED v2.13.0 - DEMAND & STOCK INTELLIGENCE SERVICE
// Cross-modular demand aggregation: BO Tracking, Forecast, Pipeline, Estimates & CCW-R
// ============================================================================

import {
  SkuDemandItem,
  SkuCategory,
  StockRecommendation,
  DemandIntelligenceSummary,
  CategoryDemandSummary,
} from './demandTypes';
import { getBoTrackings } from '../bo/boTrackingService';
import { getForecastRecords } from '../forecast/forecastStorage';
import { getPipelineDeals } from '../pipeline/pipelineStorage';
import { getEstimatesMirrorSnapshot } from '../cloud/firestoreService';
import { getCcwrQuoteHistory } from '../ccwrQuote/ccwrStorage';
import ExcelJS from 'exceljs';

/**
 * Detects the commercial family and broad category of a Cisco Part Number and description.
 */
export function detectSkuFamily(
  partNumber: string,
  description: string = '',
  isIntangibleFlag: boolean = false
): { family: string; category: SkuCategory } {
  const pn = (partNumber || '').toUpperCase().trim();
  const desc = (description || '').toUpperCase().trim();

  // 1. Accesorios, Ópticas, Transceivers y Cables
  if (
    pn.startsWith('GLC-') ||
    pn.startsWith('SFP-') ||
    pn.startsWith('QSFP-') ||
    pn.startsWith('CAB-') ||
    pn.startsWith('PWR-') ||
    pn.startsWith('STACK-') ||
    pn.includes('-NM-') ||
    pn.includes('-BLANK') ||
    pn.startsWith('C9300-NM') ||
    pn.startsWith('C9200-NM') ||
    desc.includes('TRANSCEIVER') ||
    desc.includes('POWER SUPPLY') ||
    desc.includes('STACK CABLE')
  ) {
    return { family: 'Transceivers, Óptica & Accesorios', category: 'accessory' };
  }

  // 2. Servicios SmartNet y Contratos de Soporte
  if (
    pn.startsWith('CON-SNT') ||
    pn.startsWith('CON-') ||
    desc.includes('SMARTNET') ||
    desc.includes('SNTC') ||
    desc.includes('TECHNICAL SUPPORT')
  ) {
    return { family: 'Servicios SmartNet / CX', category: 'service' };
  }

  // 3. Licencias DNA, Meraki Cloud y Suscripciones SaaS
  if (
    pn.startsWith('C1-') ||
    pn.startsWith('C1F') ||
    pn.startsWith('C1A') ||
    pn.includes('DNA') ||
    pn.startsWith('LIC-') ||
    pn.includes('-LIC') ||
    pn.includes('-SUB') ||
    pn.includes('-SEC-') ||
    pn.includes('-ENT-') ||
    desc.includes('DNA ADVANTAGE') ||
    desc.includes('DNA ESSENTIALS') ||
    desc.includes('ENTERPRISE LICENSE') ||
    isIntangibleFlag
  ) {
    return { family: 'Suscripciones DNA & Cloud SaaS', category: 'license' };
  }

  // 4. Switching Campus & Branch
  if (pn.startsWith('C9200') || desc.includes('CATALYST 9200')) {
    return { family: 'Catalyst 9200 / 9200L', category: 'hardware' };
  }
  if (pn.startsWith('C9300') || desc.includes('CATALYST 9300')) {
    return { family: 'Catalyst 9300 / 9300X', category: 'hardware' };
  }
  if (
    pn.startsWith('C1000') ||
    pn.startsWith('C1200') ||
    pn.startsWith('C1300') ||
    pn.startsWith('CBS') ||
    desc.includes('CATALYST 1000') ||
    desc.includes('CATALYST 1200') ||
    desc.includes('CATALYST 1300')
  ) {
    return { family: 'Catalyst 1000 / 1200 / 1300', category: 'hardware' };
  }

  // 5. Meraki Cloud Managed Hardware
  if (pn.startsWith('MS') || desc.includes('MERAKI MS')) {
    return { family: 'Meraki Cloud Switching', category: 'hardware' };
  }
  if (pn.startsWith('MR') || desc.includes('MERAKI MR') || desc.includes('ACCESS POINT MR')) {
    return { family: 'Meraki Cloud Wireless', category: 'hardware' };
  }
  if (pn.startsWith('MX') || desc.includes('MERAKI MX') || desc.includes('SECURITY APPLIANCE')) {
    return { family: 'Meraki Security & SD-WAN', category: 'hardware' };
  }
  if (pn.startsWith('MV') || pn.startsWith('MT') || desc.includes('MERAKI CAMERA')) {
    return { family: 'Meraki Smart Cameras & Sensores', category: 'hardware' };
  }

  // 6. Data Center & Nexus
  if (pn.startsWith('N9K') || pn.startsWith('N3K') || pn.startsWith('N2K') || desc.includes('NEXUS')) {
    return { family: 'Nexus Data Center', category: 'hardware' };
  }

  // 7. Routing & WAN
  if (
    pn.startsWith('C8200') ||
    pn.startsWith('C8300') ||
    pn.startsWith('ISR') ||
    pn.startsWith('ASR') ||
    desc.includes('CATALYST 8200') ||
    desc.includes('ROUTER')
  ) {
    return { family: 'Cisco Routing & SD-WAN', category: 'hardware' };
  }

  // 8. Wireless Wi-Fi 6 & 6E
  if (
    pn.startsWith('CW91') ||
    pn.startsWith('C91') ||
    pn.startsWith('AIR-') ||
    desc.includes('CATALYST 9100') ||
    desc.includes('WI-FI 6')
  ) {
    return { family: 'Wireless Wi-Fi 6 / 6E', category: 'hardware' };
  }

  // 9. Firewalls y Ciberseguridad
  if (
    pn.startsWith('FPR') ||
    pn.startsWith('ASA') ||
    pn.startsWith('SEC-') ||
    desc.includes('FIREPOWER') ||
    desc.includes('SECURE FIREWALL')
  ) {
    return { family: 'Cisco Secure Firewalls', category: 'hardware' };
  }

  // 10. Colaboración y Telefonía IP
  if (
    pn.startsWith('CP-') ||
    pn.startsWith('DP-') ||
    pn.startsWith('CS-') ||
    desc.includes('IP PHONE') ||
    desc.includes('ROOM BAR') ||
    desc.includes('WEBEX')
  ) {
    return { family: 'Colaboración & Teléfonos IP', category: 'hardware' };
  }

  // Fallback genérico
  return {
    family: isIntangibleFlag ? 'Software & Licencias Varias' : 'Otros Equipos Cisco',
    category: isIntangibleFlag ? 'license' : 'hardware',
  };
}

/**
 * Calculates stock recommendation for Bodega E1 Santiago based on real sales vs quoted demand.
 */
export function computeStockRecommendation(
  partNumber: string,
  category: SkuCategory,
  realSoldUnits: number,
  quotedUnits: number,
  totalDemandUnits: number,
  avgUnitPriceUsd: number
): StockRecommendation {
  const avgCostUsd = Math.round(avgUnitPriceUsd * 0.88); // Costo aproximado base

  if (category === 'license' || category === 'service') {
    return {
      priority: 'NOT_APPLICABLE',
      priorityLabel: 'No Aplica Bodega (Digital)',
      suggestedUnits: 0,
      rationale: 'Suscripción o servicio digital (Bodega ED). Se provisiona electrónicamente en Cisco CCW sin requerir espacio físico ni flete.',
      estimatedUnitCostUsd: 0,
      estimatedTotalInvestmentUsd: 0,
      targetBodega: 'ED',
    };
  }

  // Reglas para Hardware y Accesorios en Bodega E1 Santiago
  const isHighTurnover = realSoldUnits >= 6 || (realSoldUnits >= 3 && quotedUnits >= 10) || totalDemandUnits >= 20;
  const isGrowthOpportunity = realSoldUnits >= 2 || quotedUnits >= 8;

  if (isHighTurnover) {
    // Sugerencia proporcional al ritmo de venta real + fracción de demanda cotizada
    const suggested = Math.min(30, Math.max(8, Math.round(realSoldUnits * 0.75 + quotedUnits * 0.15)));
    return {
      priority: 'CRITICAL_STOCK',
      priorityLabel: 'Alta Prioridad (Stock Crítico)',
      suggestedUnits: suggested,
      rationale: 'Alta rotación confirmada con SOs reales y cotizaciones recurrentes. Mantener stock en Bodega E1 Santiago permite cerrar negocios inmediatos con entrega 24-48h.',
      estimatedUnitCostUsd: avgCostUsd,
      estimatedTotalInvestmentUsd: suggested * avgCostUsd,
      targetBodega: 'E1',
    };
  }

  if (isGrowthOpportunity) {
    const suggested = Math.min(10, Math.max(3, Math.round(totalDemandUnits * 0.25)));
    return {
      priority: 'GROWTH_OPPORTUNITY',
      priorityLabel: 'Oportunidad de Stock',
      suggestedUnits: suggested,
      rationale: 'Demanda activa en Pipeline y cotizaciones recientes. Stock preventivo recomendado para acortar el Lead Time de 175 días y asegurar adjudicaciones.',
      estimatedUnitCostUsd: avgCostUsd,
      estimatedTotalInvestmentUsd: suggested * avgCostUsd,
      targetBodega: 'E1',
    };
  }

  return {
    priority: 'MADE_TO_ORDER',
    priorityLabel: 'Bajo Pedido (Back-to-Back)',
    suggestedUnits: 0,
    rationale: 'Equipo de baja rotación o configuración a medida. Adquirir a fábrica bajo orden de compra confirmada del cliente.',
    estimatedUnitCostUsd: avgCostUsd,
    estimatedTotalInvestmentUsd: 0,
    targetBodega: 'E1',
  };
}

/**
 * Main Aggregator: Cross-examines all 5 modules and produces the complete Demand Intelligence summary.
 */
export async function generateDemandIntelligenceReport(): Promise<DemandIntelligenceSummary> {
  const [boOrders, forecastRecords, pipelineDeals, ccwrQuotes] = await Promise.all([
    getBoTrackings().catch(() => []),
    getForecastRecords().catch(() => []),
    getPipelineDeals().catch(() => []),
    getCcwrQuoteHistory().catch(() => []),
  ]);

  const estimatesList = getEstimatesMirrorSnapshot();

  // Keyed map for SKU demand aggregation
  const skuMap = new Map<
    string,
    {
      partNumber: string;
      description: string;
      category: SkuCategory;
      family: string;
      realSoldUnits: number;
      realSoldUsd: number;
      quotedUnits: number;
      quotedUsd: number;
      ordersSet: Set<string>;
      unitPrices: number[];
    }
  >();

  const getOrCreateEntry = (
    pnRaw: string,
    descRaw: string = '',
    isIntangible: boolean = false
  ) => {
    const pn = pnRaw.trim().toUpperCase();
    if (!pn || pn === 'N/A' || pn === '-' || pn === 'PENDIENTE') return null;

    let entry = skuMap.get(pn);
    if (!entry) {
      const { family, category } = detectSkuFamily(pn, descRaw, isIntangible);
      entry = {
        partNumber: pn,
        description: descRaw || pn,
        category,
        family,
        realSoldUnits: 0,
        realSoldUsd: 0,
        quotedUnits: 0,
        quotedUsd: 0,
        ordersSet: new Set<string>(),
        unitPrices: [],
      };
      skuMap.set(pn, entry);
    } else if (descRaw && (!entry.description || entry.description === entry.partNumber)) {
      entry.description = descRaw;
    }
    return entry;
  };

  // 1. Process Estimates History (Detailed BOM Line Items)
  const boEstimateIds = new Set(
    boOrders.map((b) => (b.estimateId || '').trim().toUpperCase()).filter(Boolean)
  );

  for (const est of estimatesList) {
    const estId = (est.estimateId || est.id || '').toUpperCase();
    const isConvertedToBo = boEstimateIds.has(estId);

    if (Array.isArray(est.items)) {
      for (const item of est.items) {
        if (!item.partNumber) continue;
        const entry = getOrCreateEntry(item.partNumber, item.description, item.isIntangible);
        if (!entry) continue;

        const qty = Math.max(1, Number(item.qty) || 1);
        const unitPrice = Number(item.precioVentaUnitario || item.netCiscoUnit) || 0;
        const extPrice = Number(item.precioVentaExtendido) || unitPrice * qty;

        entry.ordersSet.add(`EST:${estId}`);
        if (unitPrice > 0) entry.unitPrices.push(unitPrice);

        if (isConvertedToBo) {
          entry.realSoldUnits += qty;
          entry.realSoldUsd += extPrice;
        } else {
          entry.quotedUnits += qty;
          entry.quotedUsd += extPrice;
        }
      }
    }
  }

  // 2. Process Tracking BO Orders (Real confirmed hardware & software)
  for (const bo of boOrders) {
    const boId = bo.id || bo.clientPoNumber || 'BO';
    const isConfirmedSo = Boolean(bo.ciscoSoNumber && bo.ciscoSoNumber !== 'PENDIENTE' && !bo.ciscoSoNumber.includes('PEND'));

    // Check if BO notes contain specific part numbers
    const boText = `${bo.estimateId} ${bo.partnerName} ${bo.endCustomerName} ${(bo.notes || []).map((n) => n.text).join(' ')}`.toUpperCase();

    // Look for common Cisco switches or APs mentioned in BO
    const knownPns = [
      'C9200L-24P-4G-E',
      'C9200L-48P-4G-E',
      'C9300-24P-A',
      'C9300-48P-A',
      'C1000-24T-4G-L',
      'C1200-24P-4G',
      'MS130-24P',
      'MR36-HW',
      'CW9164I-A',
      'C9115AXI-A',
      'GLC-TE',
      'SFP-10G-SR',
    ];

    for (const pn of knownPns) {
      if (boText.includes(pn)) {
        const entry = getOrCreateEntry(pn, '', false);
        if (entry) {
          entry.ordersSet.add(`BO:${boId}`);
          if (isConfirmedSo) {
            entry.realSoldUnits += 1;
            entry.realSoldUsd += bo.totalSaleUsd ? Math.round(bo.totalSaleUsd / Math.max(1, bo.itemsCount || 1)) : 0;
          } else {
            entry.quotedUnits += 1;
            entry.quotedUsd += bo.totalSaleUsd ? Math.round(bo.totalSaleUsd / Math.max(1, bo.itemsCount || 1)) : 0;
          }
        }
      }
    }
  }

  // 3. Process Forecast Records (158+ records with SO, PO, DetalleProductos)
  for (const fc of forecastRecords) {
    const fcId = fc.id || fc.deal || 'FC';
    const hasSo = Boolean(fc.so && fc.so.trim() !== '' && fc.so !== '-' && fc.so !== 'N/A');
    const isWon = hasSo || ['ADJUDICADO', 'FACTURADO', 'CERRADO', 'OK'].includes((fc.observacion || '').toUpperCase().trim());

    const detalle = (fc.detalleProductos || '').toUpperCase();
    if (!detalle) continue;

    // Detect hardware families mentioned in Forecast
    const checkProductMention = (token: string, pnFallback: string, descFallback: string, isIntangible = false) => {
      if (detalle.includes(token)) {
        const entry = getOrCreateEntry(pnFallback, descFallback, isIntangible);
        if (entry) {
          entry.ordersSet.add(`FC:${fcId}`);
          const units = 2; // Estimación promedio por deal
          const usdShare = fc.usdIntcomex ? Math.round(fc.usdIntcomex / 2) : 0;
          if (isWon) {
            entry.realSoldUnits += units;
            entry.realSoldUsd += usdShare;
          } else {
            entry.quotedUnits += units;
            entry.quotedUsd += usdShare;
          }
        }
      }
    };

    checkProductMention('9200', 'C9200L-24P-4G-E', 'Cisco Catalyst 9200L 24-port PoE+');
    checkProductMention('9300', 'C9300-48P-A', 'Cisco Catalyst 9300 48-port PoE+ Network Advantage');
    checkProductMention('1000', 'C1000-24T-4G-L', 'Cisco Catalyst 1000 24-port Data');
    checkProductMention('MERAKI', 'MS130-24P', 'Cisco Meraki MS130-24P Cloud Switch');
    checkProductMention('WI-FI', 'CW9164I-A', 'Cisco Catalyst CW9164I Wi-Fi 6E AP');
    checkProductMention('SMARTNET', 'CON-SNT-C9200L24', 'Cisco SmartNet 8x5xNBD Service', true);
    checkProductMention('DNA', 'C1-C9200L-DNA-E-3Y', 'Cisco DNA Essentials 3 Year Term', true);
  }

  // 4. Process CCW-R Quotes (SmartNet & Subscription lines)
  for (const q of ccwrQuotes) {
    const qId = q.headerInfo?.quoteNumber || 'CCWR';
    if (Array.isArray(q.items)) {
      for (const item of q.items) {
        if (!item.serviceSku) continue;
        const entry = getOrCreateEntry(item.serviceSku, item.serviceLevelDescription || item.productDescription, true);
        if (!entry) continue;

        const qty = item.quantity || 1;
        const price = item.precioVentaExtendido || item.extendedNetPrice || 0;
        entry.ordersSet.add(`CCWR:${qId}`);
        entry.quotedUnits += qty;
        entry.quotedUsd += price;
        if (price > 0) entry.unitPrices.push(Math.round(price / qty));
      }
    }
  }

  // Compile final array of SkuDemandItem
  const allItems: SkuDemandItem[] = [];

  for (const entry of Array.from(skuMap.values())) {
    const totalDemandUnits = entry.realSoldUnits + entry.quotedUnits;
    if (totalDemandUnits === 0) continue;

    const totalDemandUsd = entry.realSoldUsd + entry.quotedUsd;
    const conversionRatePct =
      totalDemandUnits > 0
        ? Math.min(100, Math.round((entry.realSoldUnits / totalDemandUnits) * 100))
        : 0;

    const avgPrice =
      entry.unitPrices.length > 0
        ? Math.round(entry.unitPrices.reduce((a, b) => a + b, 0) / entry.unitPrices.length)
        : totalDemandUnits > 0
        ? Math.round(totalDemandUsd / totalDemandUnits)
        : 500;

    const stockRec = computeStockRecommendation(
      entry.partNumber,
      entry.category,
      entry.realSoldUnits,
      entry.quotedUnits,
      totalDemandUnits,
      avgPrice
    );

    allItems.push({
      partNumber: entry.partNumber,
      description: entry.description,
      category: entry.category,
      family: entry.family,
      realSoldUnits: entry.realSoldUnits,
      realSoldUsd: entry.realSoldUsd,
      quotedUnits: entry.quotedUnits,
      quotedUsd: entry.quotedUsd,
      totalDemandUnits,
      totalDemandUsd,
      conversionRatePct,
      ordersCount: entry.ordersSet.size,
      avgUnitPriceUsd: avgPrice,
      stockRecommendation: stockRec,
    });
  }

  // Sort and Partition
  const topHardwareItems = allItems
    .filter((x) => x.category === 'hardware' || x.category === 'accessory')
    .sort((a, b) => b.realSoldUnits - a.realSoldUnits || b.totalDemandUnits - a.totalDemandUnits);

  const topLicenseItems = allItems
    .filter((x) => x.category === 'license' || x.category === 'service')
    .sort((a, b) => b.totalDemandUnits - a.totalDemandUnits || b.totalDemandUsd - a.totalDemandUsd);

  const stockPlanItems = topHardwareItems
    .filter((x) => x.stockRecommendation.suggestedUnits > 0)
    .sort((a, b) => b.stockRecommendation.suggestedUnits - a.stockRecommendation.suggestedUnits);

  // Category Breakdown
  const categories: SkuCategory[] = ['hardware', 'accessory', 'license', 'service'];
  const categoryLabels: Record<SkuCategory, string> = {
    hardware: 'Equipos Hardware',
    accessory: 'Transceivers & Accesorios',
    license: 'Licencias & Suscripciones',
    service: 'Servicios SmartNet / CX',
  };

  const categoryBreakdown: CategoryDemandSummary[] = categories.map((cat) => {
    const catItems = allItems.filter((i) => i.category === cat);
    const realSoldUnits = catItems.reduce((acc, cur) => acc + cur.realSoldUnits, 0);
    const realSoldUsd = catItems.reduce((acc, cur) => acc + cur.realSoldUsd, 0);
    const quotedUnits = catItems.reduce((acc, cur) => acc + cur.quotedUnits, 0);
    const quotedUsd = catItems.reduce((acc, cur) => acc + cur.quotedUsd, 0);
    const totalUnits = realSoldUnits + quotedUnits;
    const totalUsd = realSoldUsd + quotedUsd;

    return {
      category: cat,
      categoryLabel: categoryLabels[cat],
      realSoldUnits,
      realSoldUsd,
      quotedUnits,
      quotedUsd,
      totalDemandUnits: totalUnits,
      totalDemandUsd: totalUsd,
      conversionRatePct: totalUnits > 0 ? Math.round((realSoldUnits / totalUnits) * 100) : 0,
    };
  });

  const totalHardwareSoldUsd = topHardwareItems.reduce((acc, cur) => acc + cur.realSoldUsd, 0);
  const totalHardwareQuotedUsd = topHardwareItems.reduce((acc, cur) => acc + cur.quotedUsd, 0);
  const totalLicensesSoldUsd = topLicenseItems.reduce((acc, cur) => acc + cur.realSoldUsd, 0);
  const totalLicensesQuotedUsd = topLicenseItems.reduce((acc, cur) => acc + cur.quotedUsd, 0);

  const totalAllSoldUnits = allItems.reduce((acc, cur) => acc + cur.realSoldUnits, 0);
  const totalAllUnits = allItems.reduce((acc, cur) => acc + cur.totalDemandUnits, 0);
  const overallConversionPct = totalAllUnits > 0 ? Math.round((totalAllSoldUnits / totalAllUnits) * 100) : 0;

  const totalSuggestedUnitsToStock = stockPlanItems.reduce(
    (acc, cur) => acc + cur.stockRecommendation.suggestedUnits,
    0
  );
  const totalSuggestedInvestmentUsd = stockPlanItems.reduce(
    (acc, cur) => acc + cur.stockRecommendation.estimatedTotalInvestmentUsd,
    0
  );

  return {
    totalHardwareSoldUsd,
    totalHardwareQuotedUsd,
    totalLicensesSoldUsd,
    totalLicensesQuotedUsd,
    overallConversionPct,
    totalSuggestedInvestmentUsd,
    totalSuggestedUnitsToStock,
    topHardwareItems,
    topLicenseItems,
    stockPlanItems,
    categoryBreakdown,
    sourcesStats: {
      boOrdersCount: boOrders.length,
      forecastRecordsCount: forecastRecords.length,
      pipelineDealsCount: pipelineDeals.length,
      estimatesCount: estimatesList.length,
      ccwrQuotesCount: ccwrQuotes.length,
    },
    lastAnalyzedAt: new Date().toISOString(),
  };
}

/**
 * Generates an executive Excel workbook (.xlsx) with stock procurement suggestions for Bodega E1 Santiago.
 */
export async function exportStockProposalToExcel(items: SkuDemandItem[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cisco Automated Intcomex';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Propuesta Stock Bodega E1', {
    views: [{ showGridLines: true }],
  });

  // Header Title
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'INTCOMEX CHILE - PROPUESTA DE COMPRA Y REPOSICIÓN DE STOCK CISCO (BODEGA E1)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  // Metadata
  worksheet.mergeCells('A2:I2');
  const subCell = worksheet.getCell('A2');
  subCell.value = `Generado el ${new Date().toLocaleDateString('es-CL')} | Basado en análisis de ventas reales y pipeline consolidado`;
  subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 18;

  // Table Columns
  const headers = [
    'Part Number (BOM)',
    'Descripción del Equipo',
    'Familia Comercial',
    'Ventas Reales (Und)',
    'Demanda Cotizada (Und)',
    'Hit Rate (%)',
    'Prioridad de Stock',
    'Stock Sugerido (Und)',
    'Inversión Total (USD)',
  ];

  const headerRow = worksheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let c = 1; c <= headers.length; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
    };
  }

  // Populate Rows
  let rIndex = 5;
  for (const item of items) {
    const row = worksheet.getRow(rIndex);
    row.values = [
      item.partNumber,
      item.description,
      item.family,
      item.realSoldUnits,
      item.quotedUnits,
      `${item.conversionRatePct}%`,
      item.stockRecommendation.priorityLabel,
      item.stockRecommendation.suggestedUnits,
      item.stockRecommendation.estimatedTotalInvestmentUsd,
    ];

    row.height = 20;
    row.font = { name: 'Calibri', size: 9 };

    // Alignments
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

    // Format currency
    row.getCell(9).numFmt = '"$"#,##0.00';

    // Zebra striping
    const isEven = rIndex % 2 === 0;
    const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
    for (let c = 1; c <= headers.length; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    // Highlight critical stock
    if (item.stockRecommendation.priority === 'CRITICAL_STOCK') {
      row.getCell(7).font = { bold: true, color: { argb: 'FF059669' } };
      row.getCell(8).font = { bold: true, color: { argb: 'FF059669' } };
    }

    rIndex++;
  }

  // Auto-fit column widths
  worksheet.columns = [
    { width: 24 }, // Part Number
    { width: 38 }, // Descripción
    { width: 28 }, // Familia
    { width: 18 }, // Ventas Reales
    { width: 22 }, // Demanda Cotizada
    { width: 14 }, // Hit Rate
    { width: 28 }, // Prioridad
    { width: 20 }, // Stock Sugerido
    { width: 22 }, // Inversión Total
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
