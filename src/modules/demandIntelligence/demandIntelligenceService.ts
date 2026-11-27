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
import { isMainLineItem } from '../../core/calculations';
import { isCiscoAccessorySku, isMainHardwareChassisSku } from '../../core/ciscoAccessoriesCatalog';
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

  // 1. Accesorios, Ópticas, Transceivers, Fuentes, Cables y Componentes Internos
  // (Detectar antes de hardware para que accesorios que compartan prefijo no se clasifiquen como chasis)
  const isAccessory =
    isCiscoAccessorySku(pn, desc) ||
    pn.startsWith('GLC-') ||
    pn.startsWith('SFP-') ||
    pn.startsWith('QSFP-') ||
    pn.startsWith('CAB-') ||
    pn.startsWith('PWR-') ||
    pn.startsWith('STACK-') ||
    pn.includes('-STACK-KIT') ||
    pn.includes('-STACK=') ||
    pn.includes('-NM-') ||
    pn.includes('-BLANK') ||
    pn.includes('-RMK') ||
    pn.includes('-RM-') ||
    pn.includes('-RCKMNT') ||
    pn.includes('-ACC-KIT') ||
    pn.includes('-4PT-KIT') ||
    pn.startsWith('C9300-NM') ||
    pn.startsWith('C9200-NM') ||
    pn.startsWith('MA-') ||
    pn.startsWith('ANT-') ||
    pn.startsWith('FAN-') ||
    desc.includes('TRANSCEIVER') ||
    desc.includes('POWER SUPPLY') ||
    desc.includes('POWER CORD') ||
    desc.includes('STACK CABLE') ||
    desc.includes('STACK KIT') ||
    desc.includes('RACK MOUNT') ||
    desc.includes('MOUNTING BRACKET');

  if (isAccessory && !isMainHardwareChassisSku(pn)) {
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
    pn.includes('-NW-') ||
    pn.includes('-NW=') ||
    desc.includes('DNA ADVANTAGE') ||
    desc.includes('DNA ESSENTIALS') ||
    desc.includes('ENTERPRISE LICENSE') ||
    desc.includes('NETWORK ESSENTIALS') ||
    desc.includes('NETWORK ADVANTAGE') ||
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
 * Amortigua cantidades masivas o desproporcionadas en cotizaciones individuales (Estimates, Licitaciones, Mega-deals)
 * para evitar que distorsionen las oportunidades de inventario o las sugerencias de Stock Crítico en Bodega E1 Santiago.
 * 
 * - Para pedidos y cotizaciones normales (<= maxLinearThreshold, por defecto 8 unidades): comportamiento 100% lineal.
 * - Para cantidades excedentes (> 8 unidades, ej. 20, 50, 100, 300 unidades): compresión sublineal cóncava
 *   que reconoce la presencia del negocio sin inflar artificialmente el inventario físico ni castigar el Hit Rate.
 */
export function dampQuotationQuantity(rawQty: number, maxLinearThreshold: number = 8): number {
  if (rawQty <= 0) return 0;
  if (rawQty <= maxLinearThreshold) return Math.round(rawQty);
  const excess = rawQty - maxLinearThreshold;
  return maxLinearThreshold + Math.round(Math.sqrt(excess * 2));
}

/**
 * Calculates stock recommendation for Bodega E1 Santiago based on real sales vs quoted demand.
 * Incorporates outlier protection and multi-deal recurrence checks to ensure speculative mega-deals
 * do not falsely trigger Critical Stock or Growth Opportunity recommendations.
 */
export function computeStockRecommendation(
  partNumber: string,
  category: SkuCategory,
  realSoldUnits: number,
  quotedUnits: number,
  totalDemandUnits: number,
  avgUnitPriceUsd: number,
  ordersCount: number = 1,
  effectiveQuotedUnits?: number,
  isMegadealOutlier?: boolean
): StockRecommendation {
  const avgCostUsd = Math.round(avgUnitPriceUsd * 0.88); // Costo aproximado base

  // Exclusión estricta: Licencias, Servicios e Ítems clasificados como Accesorios
  // Las sugerencias para Bodega E1 Santiago se concentran exclusivamente en Equipos Principales (Switches, APs, Routers, Firewalls)
  if (category === 'license' || category === 'service' || category === 'accessory') {
    const isDigital = category === 'license' || category === 'service';
    return {
      priority: 'NOT_APPLICABLE',
      priorityLabel: isDigital ? 'No Aplica Bodega (Digital)' : 'No Aplica Stock Principal (Accesorio)',
      suggestedUnits: 0,
      rationale: isDigital
        ? 'Suscripción o servicio digital (Bodega ED). Se provisiona electrónicamente en Cisco CCW sin requerir espacio físico ni flete.'
        : 'Accesorio o componente. El plan de inventario para Bodega E1 Santiago se focaliza exclusivamente en Equipos Principales (Switches, Routers, APs y Firewalls).',
      estimatedUnitCostUsd: 0,
      estimatedTotalInvestmentUsd: 0,
      targetBodega: isDigital ? 'ED' : 'E1',
    };
  }

  const effectiveQuoted = typeof effectiveQuotedUnits === 'number'
    ? effectiveQuotedUnits
    : dampQuotationQuantity(quotedUnits, 8);

  const isOutlier = typeof isMegadealOutlier === 'boolean'
    ? isMegadealOutlier
    : (ordersCount <= 2 && quotedUnits >= 20 && realSoldUnits === 0);

  // 1. REGLA DE PROTECCIÓN DE MEGADISPAROS / LICITACIONES SIN CONFIRMACIÓN:
  // Si un Estimate solicita cantidades masivas (ej. 20, 50, 100, 300 unidades) pero NO tiene órdenes reales confirmadas (realSoldUnits === 0)
  // o proviene de 1 o 2 solicitudes aisladas, NUNCA debe marcarse como Stock Crítico ni Oportunidad de Stock para Bodega E1 Santiago.
  // En Cisco Intcomex, estos proyectos se atienden estrictamente Back-to-Back directo desde fábrica (Miami) con DSA (Special Pricing).
  if (isOutlier) {
    return {
      priority: 'MADE_TO_ORDER',
      priorityLabel: 'Proyecto Especial (Bajo Pedido)',
      suggestedUnits: 0,
      rationale: `Demanda cotizada de gran volumen (${quotedUnits} unds solicitadas en ${ordersCount} transacción${ordersCount > 1 ? 'es' : ''}) sin confirmación de venta real. Gestionar estrictamente Back-to-Back directo de fábrica (DSA) para no inmovilizar capital en Bodega E1 Santiago.`,
      estimatedUnitCostUsd: avgCostUsd,
      estimatedTotalInvestmentUsd: 0,
      targetBodega: 'E1',
    };
  }

  // 2. STOCK CRÍTICO (ALTA ROTACIÓN):
  // Requiere venta real confirmada sostenida (>= 6 unidades vendidas o >= 3 vendidas en múltiples órdenes con demanda continua).
  // Nunca se otorga si no hay venta real (realSoldUnits < 2).
  const isHighTurnover =
    realSoldUnits >= 6 ||
    (realSoldUnits >= 3 && ordersCount >= 2 && effectiveQuoted >= 6);

  if (isHighTurnover) {
    // Sugerencia anclada en venta real + ponderación amortiguada de demanda cotizada
    const suggested = Math.min(
      20,
      Math.max(4, Math.round(realSoldUnits * 0.70 + Math.min(effectiveQuoted, 12) * 0.15))
    );
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

  // 3. OPORTUNIDAD DE STOCK (DEMANDA MODERADA / RECURRENTE):
  // Requiere:
  // - Venta real moderada (>= 2 unidades), O
  // - Al menos 1 unidad vendida con recurrencia en cotizaciones (ordersCount >= 2 y effectiveQuoted >= 5), O
  // - Recurrencia comprobada entre múltiples partners/deals (ordersCount >= 3 y effectiveQuoted >= 8) aún sin venta cerrada.
  const isGrowthOpportunity =
    realSoldUnits >= 2 ||
    (realSoldUnits >= 1 && ordersCount >= 2 && effectiveQuoted >= 5) ||
    (realSoldUnits === 0 && ordersCount >= 3 && effectiveQuoted >= 8);

  if (isGrowthOpportunity) {
    const suggested = Math.min(
      8,
      Math.max(2, Math.round(realSoldUnits * 0.40 + Math.min(effectiveQuoted, 8) * 0.20))
    );
    return {
      priority: 'GROWTH_OPPORTUNITY',
      priorityLabel: 'Oportunidad de Stock',
      suggestedUnits: suggested,
      rationale: 'Demanda activa y recurrente en Pipeline/cotizaciones. Stock preventivo recomendado para acortar el Lead Time de 175 días y asegurar adjudicaciones.',
      estimatedUnitCostUsd: avgCostUsd,
      estimatedTotalInvestmentUsd: suggested * avgCostUsd,
      targetBodega: 'E1',
    };
  }

  // 4. BAJO PEDIDO (BACK-TO-BACK):
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
      dampedQuotedUnits: number;
      hasOutlierQuantities: boolean;
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
        dampedQuotedUnits: 0,
        hasOutlierQuantities: false,
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

        // FILTRO ESTRICTO DE LÍNEAS HIJAS ("HIJOS") Y ACCESORIOS QUE YA VIENEN DENTRO DEL EQUIPO:
        // En Cisco CCW, los accesorios que ya vienen incluidos dentro del chasis del equipo
        // (fuentes de poder, cables de alimentación, tapas ciegas, kits de rack/apilamiento)
        // se desglosan como sub-líneas hijas (1.1, 1.2, 1.3, 2.1...).
        // Únicamente las líneas madre (1.0, 2.0, 3.0...) representan equipos principales.
        const isMain = isMainLineItem(item.lineNumber);
        if (!isMain && !item.isIntangible) {
          // Descartar accesorio o componente hijo que ya viene dentro del equipo
          continue;
        }

        const entry = getOrCreateEntry(item.partNumber, item.description, item.isIntangible);
        if (!entry) continue;

        // Excluir cualquier SKU clasificado como accesorio: solo queremos equipos principales en el ranking
        if (entry.category === 'accessory') {
          continue;
        }

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
          entry.dampedQuotedUnits += dampQuotationQuantity(qty, 8);
          if (qty >= 15) {
            entry.hasOutlierQuantities = true;
          }
        }
      }
    }
  }

  // 2. Process Tracking BO Orders (Real confirmed hardware & software)
  for (const bo of boOrders) {
    const boId = bo.id || bo.clientPoNumber || 'BO';
    const isConfirmedSo = Boolean(bo.ciscoSoNumber && bo.ciscoSoNumber !== 'PENDIENTE' && !bo.ciscoSoNumber.includes('PEND'));

    // Check if BO notes contain specific part numbers
    const boText = `${bo.estimateId} ${bo.partnerName} ${bo.endCustomerName} ${(bo.notes || []).map((n) => n.comment).join(' ')}`.toUpperCase();

    // Look for common Cisco switches or APs mentioned in BO (Solo equipos principales, sin accesorios)
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
            entry.dampedQuotedUnits += 1;
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
            entry.dampedQuotedUnits += dampQuotationQuantity(units, 8);
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
        entry.dampedQuotedUnits += dampQuotationQuantity(qty, 8);
        if (qty >= 15) entry.hasOutlierQuantities = true;
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
    const ordersCount = entry.ordersSet.size;

    // Demanda cotizada efectiva amortiguada (outlier damping)
    const effectiveQuotedUnits = Math.round(entry.dampedQuotedUnits) || entry.quotedUnits;
    const effectiveTotalUnits = entry.realSoldUnits + effectiveQuotedUnits;

    // Detección de megadisparos aislados sin confirmación
    const isMegadealOutlier =
      (ordersCount <= 2 && entry.quotedUnits >= 20 && entry.realSoldUnits === 0) ||
      (entry.hasOutlierQuantities && entry.realSoldUnits === 0);

    // Hit Rate (Tasa de Conversión): calculado con base en demanda efectiva para que
    // licitaciones especulativas masivas no pulvericen el porcentaje de conversión de equipos de alta rotación
    const conversionRatePct =
      effectiveTotalUnits > 0
        ? Math.min(100, Math.round((entry.realSoldUnits / effectiveTotalUnits) * 100))
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
      avgPrice,
      ordersCount,
      effectiveQuotedUnits,
      isMegadealOutlier
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
      effectiveQuotedUnits,
      totalDemandUnits,
      totalDemandUsd,
      effectiveTotalUnits,
      conversionRatePct,
      ordersCount,
      avgUnitPriceUsd: avgPrice,
      isMegadealOutlier,
      stockRecommendation: stockRec,
    });
  }

  // Sort and Partition: Solo equipos de hardware reales (Switches, APs, Routers, Firewalls) - SIN accesorios ni componentes hijos
  const topHardwareItems = allItems
    .filter((x) => x.category === 'hardware')
    .sort(
      (a, b) =>
        b.realSoldUnits - a.realSoldUnits ||
        (b.effectiveTotalUnits || b.totalDemandUnits) - (a.effectiveTotalUnits || a.totalDemandUnits) ||
        b.totalDemandUsd - a.totalDemandUsd
    );

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
