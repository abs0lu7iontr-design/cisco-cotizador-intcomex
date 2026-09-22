// ============================================================================
// CISCO AUTOMATED - DSV SUBSCRIPTION & MULTI-TERM RESOLVER ENGINE
// ============================================================================

/**
 * Patrones de P/N que componen el catálogo oficial de suscripciones periódicas Meraki
 * (Incluye Wireless, Switching, Security, SD-WAN, IoT, Smart Cameras, Systems Manager, etc.)
 */
export const MERAKI_SUB_PATTERNS: RegExp[] = [
  /^LIC-MR/i,
  /^LIC-MS/i,
  /^LIC-MX/i,
  /^LIC-CSR/i,
  /^LIC--CSR/i,
  /^LIC-Z/i,
  /^LIC-MG/i,
  /^LIC-ACCSMGR/i,
  /^LIC-MT/i,
  /^LIC-MV/i,
  /^LIC-D2C/i,
  /^LIC-CW/i,
  /^LIC-SM/i,
  /^LIC-ENT/i,
  /^LIC-SEC/i,
  /^LIC-SDW/i,
  /^LIC-VMX/i,
  /^LIC-CT/i,
  /^LIC-/i,
];

export interface DsvBomRowRaw {
  lineNumber: string;
  magicKey?: string;
  ciscoSku: string;
  quantity: number;
  durationMonthsColK: number;     // Columna K del BOM: DURATION(Months)
  unitListPriceColO: number;       // Columna O del BOM: LIST_PRICE
  extendedListPriceColP?: number;  // Columna P del BOM: EXTENDED LIST PRICE
  unitNetPriceColQ?: number;       // Columna Q del BOM: UNIT NET PRICE
  extendedNetPriceColR?: number;   // Columna R del BOM: EXTENDED NET PRICE
  skuIdentifierColY?: string;      // Columna Y del BOM: SKU IDENTIFIER (ej: 'XAAS')
  durationListPriceColAD?: number; // Columna AD del BOM: DURATION LIST PRICE
  durationNetPriceColAE?: number;  // Columna AE del BOM: DURATION NET PRICE
  pricingTermColAF?: number;       // Columna AF del BOM: PRICING TERM
  manualCategory?: string;         // 'Hardware' | 'Suscripción' | 'Servicio' | 'hardware' | 'subscription' | 'service'
  partnerDiscountRate?: number;    // Ej: 0.42 para 42%
  dealDiscountRate?: number;       // Ej: 0.55 para 55%
  description?: string;
}

export interface DsvResolvedRowValues {
  unitListPriceFullTerm: number; // Para Col O en vista previa y metadata
  colJRepUnitPrice: number;       // Para Col J en DSV
  colKNetPrice: number;           // Para Col K en DSV
  durationDisplay: string;        // Ej: '36m' o '-'
  isPeriodicSubscription: boolean;
}

/**
 * Detecta equipos SMB (Catalyst 1000/1200/1300 y CBS) para cotizador DSV
 */
function getDsvDiscountRate(sku: string, defaultRate: number = 42): number {
  const cleanSku = (sku || '').trim().toUpperCase();
  const isSmbFamily = /^C1000-|^C1200-|^C1300-|^CBS\d{3}-/i.test(cleanSku);
  return isSmbFamily ? 20 : defaultRate;
}

/**
 * Clasificador universal de contratos de servicio Cisco (SmartNet, Solution Support, etc.)
 */
function isCiscoServiceSku(sku: string, description: string = ''): boolean {
  const normSku = String(sku || '').trim().toUpperCase();
  const normDesc = String(description || '').trim().toUpperCase();

  const servicePrefixRegex = /^(CON|CX|CXE|CXS|SVS|AS|ASF|HT|HTS|SP|SPA|SOL|TRN|EDU)-/i;
  if (servicePrefixRegex.test(normSku)) return true;

  const serviceKeywords = ['SMARTNET', 'SOLUTION SUPPORT', 'SUCCESS TRACK', 'SUPPORT SERVICE', 'TECH SUPPORT'];
  return serviceKeywords.some((kw) => normDesc.includes(kw));
}

/**
 * Determina si una línea es una suscripción periódica mensualizada
 * Incluye barreras de seguridad estrictas para no alterar Hardware ni Servicios.
 */
export function isPeriodicSubscriptionLine(row: DsvBomRowRaw): boolean {
  const sku = (row.ciscoSku || '').trim();

  // BARRERA DE SEGURIDAD 1: Servicios Cisco (CON-*, SmartNet) tienen su propia lógica financiera
  if (isCiscoServiceSku(sku, row.description || '')) {
    return false;
  }

  // BARRERA DE SEGURIDAD 2: Si el usuario forzó manualmente Hardware o Servicio en la UI, se respeta
  const cat = String(row.manualCategory || '').toLowerCase().trim();
  if (cat === 'hardware' || cat === 'servicio' || cat === 'service') {
    return false;
  }

  // 1. Verificación explícita por BOM Cisco
  const isXaas = String(row.skuIdentifierColY || '').toUpperCase().trim() === 'XAAS';
  const isPricingTermMonthly = row.pricingTermColAF === 1;

  // 2. Verificación por catálogo de familias Meraki
  const matchesMerakiPattern = MERAKI_SUB_PATTERNS.some((p) => p.test(sku));

  // 3. Verificación matemática (ExtNet > UnitNet * Qty)
  const qty = row.quantity > 0 ? row.quantity : 1;
  const unitNet = row.unitNetPriceColQ || 0;
  const extNet = row.extendedNetPriceColR || 0;
  const simpleNet = unitNet * qty;
  const isMathMultiplied = extNet > 0 && simpleNet > 0 && (extNet / simpleNet) > 1.05;

  const months = row.durationMonthsColK > 0 ? row.durationMonthsColK : 1;
  const isExplicitSubscription = cat === 'suscripción' || cat === 'subscription';

  // Solo se clasifica como periódica si tiene plazo multi-mes (o ratio matemático) y cumple con alguno de los criterios
  return (
    (isXaas || matchesMerakiPattern || isExplicitSubscription || (isPricingTermMonthly && months > 1)) &&
    (months > 1 || isMathMultiplied)
  );
}

/**
 * Calcula los valores consolidados para la matriz DSV (Col O, Col J, Col K)
 */
export function resolveDsvRowPrices(row: DsvBomRowRaw): DsvResolvedRowValues {
  const qty = row.quantity > 0 ? row.quantity : 1;
  const months = row.durationMonthsColK > 0 ? row.durationMonthsColK : 1;
  const isSub = isPeriodicSubscriptionLine(row);

  // Descuento partner (42% estándar o 20% SMB)
  const partnerRate =
    typeof row.partnerDiscountRate === 'number'
      ? row.partnerDiscountRate
      : getDsvDiscountRate(row.ciscoSku) / 100;

  // CASO 1: Suscripciones Periódicas (Meraki-SUB, XAAS)
  if (isSub) {
    // List Price (Col O): Priorizar DURATION LIST PRICE del BOM si viene disponible
    let fullUnitList = 0;
    if (row.durationListPriceColAD && row.durationListPriceColAD > 0) {
      fullUnitList = row.durationListPriceColAD;
    } else {
      fullUnitList = (row.unitListPriceColO || 0) * months;
    }

    // Net Price (Col K): Priorizar DURATION NET PRICE del BOM, o ExtNet / Qty, o UnitNet * months
    let fullUnitNet = 0;
    if (row.durationNetPriceColAE && row.durationNetPriceColAE > 0) {
      fullUnitNet = row.durationNetPriceColAE;
    } else if (row.extendedNetPriceColR && row.extendedNetPriceColR > 0) {
      fullUnitNet = row.extendedNetPriceColR / qty;
    } else if (row.unitNetPriceColQ && row.unitNetPriceColQ > 0) {
      fullUnitNet = row.unitNetPriceColQ * months;
    } else {
      const dealRate = typeof row.dealDiscountRate === 'number' ? row.dealDiscountRate : 0;
      fullUnitNet = fullUnitList * (1 - dealRate);
    }

    // Col J: Calculado sobre el List Price consolidado con el descuento del partner
    const colJ = fullUnitList * (1 - partnerRate);

    return {
      unitListPriceFullTerm: Number(fullUnitList.toFixed(2)),
      colJRepUnitPrice: Number(colJ.toFixed(2)),
      colKNetPrice: Number(fullUnitNet.toFixed(2)),
      durationDisplay: `${months}m`,
      isPeriodicSubscription: true,
    };
  }

  // CASO 2: Hardware, Servicios o Licencias no mensualizadas (Flujo estándar intocado)
  const standardList = row.unitListPriceColO || 0;
  let standardNet = 0;

  if (typeof row.unitNetPriceColQ === 'number' && row.unitNetPriceColQ > 0) {
    standardNet = row.unitNetPriceColQ;
  } else {
    const dealRate =
      typeof row.dealDiscountRate === 'number' && row.dealDiscountRate > 0
        ? row.dealDiscountRate
        : partnerRate;
    standardNet = Number((standardList * (1 - dealRate)).toFixed(2));
  }

  const standardColJ = Number((standardList * (1 - partnerRate)).toFixed(2));

  return {
    unitListPriceFullTerm: standardList,
    colJRepUnitPrice: standardColJ,
    colKNetPrice: standardNet,
    durationDisplay: months > 1 ? `${months}m` : '-',
    isPeriodicSubscription: false,
  };
}
