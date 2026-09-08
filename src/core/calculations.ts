// ============================================================================
// CISCO AUTOMATED v2.1 - PURE CALCULATION & CLASSIFICATION ENGINE
// ============================================================================

import { QuoteParameters, OverrideRuleType } from './types';

/**
 * Redondeo financiero estricto. Previene el error IEEE 754 de Javascript.
 */
export function roundFinancial(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Utilidad de parseo numérico puro para formatos numéricos europeos, latinos y US.
 */
export function safeParseFloat(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  let str = String(value).trim();
  if (/^(\d{1,3}\.)+\d{1,3},\d{1,2}$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.'); // Formato Latino/Europeo
  } else {
    str = str.replace(/,/g, ''); // Formato US
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Intelligent Multi-Tier Classification for Cisco CCW Line Items:
 * Protects hardware while accurately identifying software licenses,
 * subscriptions, smartnet services, and duty-applicable accessories.
 */
export function checkIsIntangible(sku: string, description: string): boolean {
  const upperSku = (sku || '').trim().toUpperCase();
  const lowerDesc = (description || '').trim().toLowerCase();

  // Pure standalone license & subscription SKU patterns
  const isPureStandaloneLicenseSku =
    upperSku.startsWith('CON-') ||
    upperSku.startsWith('CON') ||
    upperSku.startsWith('L-') ||
    upperSku.startsWith('LIC-') ||
    upperSku.includes('-DNA-') ||
    upperSku.includes('DNA-') ||
    upperSku.includes('-NW-') ||
    upperSku.includes('-SUB') ||
    upperSku.includes('A-FLEX');

  // Tier 1: Hardware Pre-Filter (Highest Priority: Force Tangible/Equipo)
  if (!isPureStandaloneLicenseSku) {
    const hardwareKeywords = [
      'catalyst',
      'switch',
      'router',
      'port poe',
      'port data',
      'blank',
      'module',
      'cable',
      'rack',
      'power supply',
      'hardware',
      'chassis',
      'access point',
      'transceiver',
      'fan',
      'power cord',
      'stack',
    ];

    if (hardwareKeywords.some((keyword) => lowerDesc.includes(keyword))) {
      return false; // Physical hardware -> Tangible
    }
  }

  // Tier 2: Customs Duty Pre-Filter (SKUs ending in '=')
  if (upperSku.endsWith('=')) {
    return false; // Tangible accessory with duty
  }

  // Tier 3: Intangibles Rules
  if (isPureStandaloneLicenseSku) {
    return true;
  }

  if (upperSku.includes('-LIC') || upperSku.includes('LIC')) {
    return true;
  }

  const intangibleKeywords = [
    'term license',
    'smartnet',
    'subscription',
    'software',
    'deployment',
    'saas',
    'cloud',
    'service',
    'contract',
    'support',
    'sntc',
    'edelivery',
    'e-delivery',
    'paper agreement',
    'license',
    'dna essentials',
    'dna advantage',
    'network essentials',
    'network advantage',
  ];

  if (intangibleKeywords.some((keyword) => lowerDesc.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Checks if a line item applies customs duty (Arancel 6%).
 * Default: SKUs ending with '='.
 */
export function checkLlevaArancel(sku: string): boolean {
  return (sku || '').trim().endsWith('=');
}

/**
 * Formats lead time in days to business weeks:
 * - If days <= 2: returns empty string "" (Stock inmediato)
 * - If days > 2: Math.ceil(days / 7) + 2 weeks
 *   - Si el total calculado da 3 semanas: agrega 1 semana más -> "4 semanas a pedido"
 *   - Si el total calculado da 4 semanas: formatear como "4 a 5 semanas a pedido"
 *   - En los demás casos (5, 6, 7...): "X semanas a pedido"
 */
export function formatLeadTime(leadTimeDays: number): string {
  if (isNaN(leadTimeDays) || leadTimeDays <= 2) {
    return '';
  }
  const semanas = Math.ceil(leadTimeDays / 7) + 2;
  if (semanas === 3) {
    return '4 semanas a pedido';
  }
  if (semanas === 4) {
    return '4 a 5 semanas a pedido';
  }
  return `${semanas} semanas a pedido`;
}

export function normalizeOverrideRule(rule?: string): OverrideRuleType | undefined {
  if (!rule) return undefined;
  const lower = String(rule).trim().toLowerCase();
  if (lower === 'intangible') return 'intangible';
  if (lower === 'arancel') return 'arancel';
  if (lower === 'equipo' || lower === 'hw' || lower === 'hardware') return 'equipo';
  return undefined;
}

/**
 * Calculates item costs and prices according to Intcomex rules and active overrides:
 */
export function calculateLineItemCosts(
  netCiscoUnit: number,
  qty: number,
  sku: string,
  description: string,
  params: QuoteParameters,
  override?: OverrideRuleType | string
) {
  let isIntangible = checkIsIntangible(sku, description);
  let llevaArancel = checkLlevaArancel(sku);

  // Apply normalized manual 3-state override if present
  const normOverride = normalizeOverrideRule(override);
  if (normOverride === 'equipo') {
    isIntangible = false;
    llevaArancel = false;
  } else if (normOverride === 'intangible') {
    isIntangible = true;
    llevaArancel = false;
  } else if (normOverride === 'arancel') {
    isIntangible = false;
    llevaArancel = true;
  }

  // Factor calculation
  const internacionRate = isIntangible ? 0.0 : params.internacionPct / 100;
  const arancelRate = llevaArancel ? params.arancelPct / 100 : 0.0;
  const marginRate = params.margenPct / 100;

  const costoInternacion = roundFinancial(netCiscoUnit * internacionRate);
  const costoArancel = roundFinancial(netCiscoUnit * arancelRate);
  const costoTotalUnitario = roundFinancial(netCiscoUnit + costoInternacion + costoArancel);

  // Standard Commercial Margin on Sales Price: PV = Costo / (1 - Margen)
  const rawUnitPrice = marginRate >= 1 ? costoTotalUnitario : costoTotalUnitario / (1 - marginRate);
  const roundedUnitPrice = roundFinancial(rawUnitPrice);
  const roundedExtPrice = roundFinancial(roundedUnitPrice * qty);

  return {
    isIntangible,
    llevaArancel,
    costoInternacion,
    costoArancel,
    costoTotalUnitario,
    precioVentaUnitario: roundedUnitPrice,
    precioVentaExtendido: roundedExtPrice,
  };
}

/**
 * Identifies informational/descriptive rows that should not have mathematical calculations
 * (e.g. empty part number, "Initial Term", descriptive notes)
 */
export function isInformationalRow(partNumber: string, description: string): boolean {
  const p = (partNumber || '').trim().toLowerCase();
  const d = (description || '').trim().toLowerCase();

  if (p.includes('initial term') || d.includes('initial term')) {
    return true;
  }

  if (!p || p === '-' || p === 'none' || p === 'n/a' || p === 'null') {
    return true;
  }

  return false;
}

/**
 * Extracts the duration in months from text like "Initial Term - 36.00 Months" using regex look-ahead.
 * Fallback is 1 if not found.
 */
export function extractInitialTermMonths(...textCandidates: Array<string | undefined | null>): number {
  for (const text of textCandidates) {
    if (!text) continue;
    const match =
      text.match(/Initial\s*Term\s*-\s*(\d+(?:\.\d+)?)\s*Month/i) ||
      text.match(/(\d+(?:\.\d+)?)\s*Months?/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 1;
}

/**
 * Strict Mathematical Calculation for Meraki Licences (e.g. LIC-CW-E):
 * a) Costo Neto Mensual = Unit List Price * (1 - (Disc / 100))
 * b) Precio Venta Mensual (Margen) = Costo Neto Mensual / (1 - (Margen / 100))
 * c) Redondear Precio Venta Mensual a 2 decimales: roundFinancial(val)
 * d) Nuevo 'Unit Net Price' final = Precio Venta Mensual * Meses
 * e) Nuevo 'Extended Net Price' = Nuevo 'Unit Net Price' * Qty
 */
export function calculateMerakiLicenseCosts(
  unitListPrice: number,
  discPct: number,
  qty: number,
  months: number,
  params: QuoteParameters
) {
  const safeMonths = Math.max(1, months);
  const safeQty = Math.max(1, qty);

  // a) Costo Neto Mensual
  const costoNetoMensual = unitListPrice * (1 - discPct / 100);

  // b) Precio Venta Mensual (Margen)
  const marginRate = params.margenPct / 100;
  const rawPrecioVentaMensual = marginRate >= 1 ? costoNetoMensual : costoNetoMensual / (1 - marginRate);

  // c) Redondear Precio Venta Mensual a 2 decimales
  const precioVentaMensual = roundFinancial(rawPrecioVentaMensual);

  // d) Nuevo 'Unit Net Price' / 'Precio Venta Unitario' final
  const precioVentaUnitario = roundFinancial(precioVentaMensual * safeMonths);

  // e) Nuevo 'Extended Net Price' / 'Precio Venta Extendido'
  const precioVentaExtendido = roundFinancial(precioVentaUnitario * safeQty);

  // Costo Total Unitario (Net Cisco Unit Total for Contract)
  const netCiscoUnitTotal = roundFinancial(costoNetoMensual * safeMonths);

  return {
    isIntangible: true,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: netCiscoUnitTotal,
    precioVentaUnitario,
    precioVentaExtendido,
    netCiscoUnitCalculated: netCiscoUnitTotal,
    months: safeMonths,
    precioVentaMensual,
  };
}

/**
 * Determines if a line item is a Main Item (e.g. 1.0, 2.0, 3.0, 1) or Sub-item (e.g. 1.0.1, 1.1)
 */
export function isMainLineItem(lineNumber: string): boolean {
  if (!lineNumber) return true;
  const clean = String(lineNumber).trim();
  // Main items: "1", "2", "1.0", "2.0", "10.0"
  if (/^\d+(\.0)?$/.test(clean)) {
    return true;
  }
  // Sub-items: "1.0.1", "1.1", "2.1.3", "1.0.1.1"
  return false;
}

export interface GoalSeekResult {
  success: boolean;
  currentTotal?: number;
  targetTotal?: number;
  achievedTotal?: number;
  difference?: number;
  discountAmount?: number;
  newInternacionPct?: number;
  newArancelPct?: number; // Strictly fixed at 6.0% (INTOCABLE)
  newMargenPct?: number;
  error?: string;
}

/**
 * REQUERIMIENTO: Lógica de Cálculo Inverso Equitativo (Goal Seek)
 * Recalcula automáticamente hacia atrás los porcentajes de Internación y Margen
 * para cuadrar el Total Cotizado Intcomex con el Descuento o Precio Objetivo solicitado por el cliente.
 * 
 * REGLA ESTRICTA: El Arancel Aduanero (6.0%) es INTOCABLE.
 * Solo se reducen proporcional y equitativamente Internación (base 7.0%) y Margen (base 5.0%).
 * FILAS INFORMATIVAS (isInfoRow) quedan estrictamente prohibidas y excluidas de este cálculo.
 */
export function solveGoalSeekParameters(
  items: Array<{ 
    netCiscoUnit: number; 
    qty: number; 
    partNumber: string; 
    description: string; 
    rowIdx?: number; 
    isInfoRow?: boolean;
    unitListPrice?: number;
    discPct?: number;
    months?: number;
    precioVentaMensual?: number;
  }>,
  targetPriceOrDiscount: number,
  mode: 'target_price' | 'discount_amount',
  currentParams: QuoteParameters = { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
  overrides?: Record<number, OverrideRuleType>
): GoalSeekResult {
  const targetMargin = currentParams.margenPct >= 1 ? currentParams.margenPct / 100 : currentParams.margenPct;
  if (targetMargin >= 0.99) {
    return { success: false, error: 'Margen inalcanzable. El límite máximo permitido es 99%.' };
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      currentTotal: 0,
      targetTotal: 0,
      achievedTotal: 0,
      difference: 0,
      discountAmount: 0,
      newInternacionPct: currentParams.internacionPct,
      newArancelPct: 6.0,
      newMargenPct: currentParams.margenPct,
    };
  }

  // Calculate quote total for any test parameter set, strictly skipping isInfoRow
  const computeTotal = (p: QuoteParameters): number => {
    let sum = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isInfoRow) continue; 

      if (item.precioVentaMensual !== undefined && item.unitListPrice !== undefined && item.discPct !== undefined && item.months !== undefined) {
        const res = calculateMerakiLicenseCosts(
          item.unitListPrice,
          item.discPct,
          item.qty,
          item.months,
          p
        );
        sum += res.precioVentaExtendido;
      } else {
        const rowOverride = overrides && item.rowIdx ? overrides[item.rowIdx] : undefined;
        const res = calculateLineItemCosts(
          item.netCiscoUnit,
          item.qty,
          item.partNumber,
          item.description,
          p,
          rowOverride
        );
        sum += res.precioVentaExtendido;
      }
    }
    return roundFinancial(sum);
  };

  const currentTotal = computeTotal(currentParams);

  let targetTotal: number;
  let requestedDiscount: number;

  if (mode === 'discount_amount') {
    requestedDiscount = Math.max(0, targetPriceOrDiscount);
    targetTotal = Math.max(1, roundFinancial(currentTotal - requestedDiscount));
  } else {
    targetTotal = Math.max(1, roundFinancial(targetPriceOrDiscount));
    requestedDiscount = Math.max(0, roundFinancial(currentTotal - targetTotal));
  }

  // If no discount or target is same/greater, return current params
  if (requestedDiscount <= 0.01 && targetTotal >= currentTotal - 0.01) {
    return {
      success: true,
      currentTotal,
      targetTotal: currentTotal,
      achievedTotal: currentTotal,
      difference: 0,
      discountAmount: 0,
      newInternacionPct: currentParams.internacionPct,
      newArancelPct: 6.0,
      newMargenPct: currentParams.margenPct,
    };
  }

  // Base parameters to scale from (7.0% Internacion, 5.0% Margen)
  const fixedArancel = 6.0;
  const baseInternacion = currentParams.internacionPct > 0 ? currentParams.internacionPct : 7.0;
  const baseMargen = currentParams.margenPct > 0 ? currentParams.margenPct : 5.0;

  // Binary search for equitable scaling factor k in [0.0, 1.5]
  let low = 0.0;
  let high = 1.5;
  let bestK = 1.0;
  let bestDiff = Infinity;

  for (let iter = 0; iter < 45; iter++) {
    const mid = (low + high) / 2;
    const testParams: QuoteParameters = {
      internacionPct: Math.max(0, mid * baseInternacion),
      arancelPct: fixedArancel,
      margenPct: Math.max(0, mid * baseMargen),
    };

    const simulatedTotal = computeTotal(testParams);
    const diff = Math.abs(simulatedTotal - targetTotal);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestK = mid;
    }

    if (simulatedTotal < targetTotal) {
      low = mid;
    } else {
      high = mid;
    }
  }

  // Candidate percentages rounded to 1 decimal place (e.g. 5.2%, 3.7%)
  let bestInt = Math.max(0, Math.round(bestK * baseInternacion * 10) / 10);
  let bestMar = Math.max(0, Math.round(bestK * baseMargen * 10) / 10);
  let bestAchieved = computeTotal({
    internacionPct: bestInt,
    arancelPct: fixedArancel,
    margenPct: bestMar,
  });
  let minDistance = Math.abs(bestAchieved - targetTotal);

  // Micro fine-tuning pass over +/- 0.3% in steps of 0.1% to find the exact closest discrete match
  for (let dInt = -3; dInt <= 3; dInt++) {
    for (let dMar = -3; dMar <= 3; dMar++) {
      const candInt = Math.max(0, Math.round((bestInt + dInt * 0.1) * 10) / 10);
      const candMar = Math.max(0, Math.round((bestMar + dMar * 0.1) * 10) / 10);
      const candTotal = computeTotal({
        internacionPct: candInt,
        arancelPct: fixedArancel,
        margenPct: candMar,
      });
      const dist = Math.abs(candTotal - targetTotal);
      if (dist < minDistance) {
        minDistance = dist;
        bestInt = candInt;
        bestMar = candMar;
        bestAchieved = candTotal;
      }
    }
  }

  return {
    success: true,
    currentTotal,
    targetTotal,
    achievedTotal: bestAchieved,
    difference: roundFinancial(Math.abs(bestAchieved - targetTotal)),
    discountAmount: roundFinancial(currentTotal - bestAchieved),
    newInternacionPct: bestInt,
    newArancelPct: fixedArancel,
    newMargenPct: bestMar,
  };
}

/**
 * Generates formatted timestamp with hour/minute first, followed by day/month/year:
 * Formato exacto requerido: HH-MM_DD-MM-YY (e.g. 14-30_01-09-26)
 */
export function getCcwTimestamp(dateObj: Date = new Date()): string {
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  return `${hours}-${mins}_${day}-${month}-${year}`;
}

/**
 * Extracts clean base file name without extension or previous calc tags:
 */
export function getBaseFileNameWithoutExt(fileName: string): string {
  const name = fileName || 'Cotizacion_Cisco';
  const baseName = name.split(/[\\/]/).pop() || name;
  const withoutExt = baseName.replace(/\.xlsx?$/i, '');
  const cleanBase = withoutExt.replace(/_(CALC|ORIGINAL|RECALC)(_[0-9\-_]+)?$/i, '');
  return cleanBase || 'Cotizacion_Cisco';
}

/**
 * Generates output filename with dynamic timestamp:
 * Formato requerido: [NombreOriginalArchivo]_[suffix]_[HH-MM_DD-MM-YY].xlsx
 */
export function suggestFileName(fileName: string, suffix: string = 'CALC'): string {
  const base = getBaseFileNameWithoutExt(fileName);
  const timestamp = getCcwTimestamp();
  return `${base}_${suffix}_${timestamp}.xlsx`;
}

/**
 * Universal SaaS/Cloud Subscription Classifier
 * Protege Hardware/DNA/SmartNet y habilita SaaS Meraki/Catalyst
 */
export function isCloudSubscriptionSku(sku: string, descriptionRowAhead?: string): boolean {
  const cleanSku = (sku || '').trim().toUpperCase();
  
  // 1. BLACKLIST ESTRICTA: Ignorar servicios, software perpetuo y hardware con arancel
  if (
    cleanSku.startsWith('CON-') || 
    cleanSku.startsWith('L-') || 
    cleanSku.includes('-DNA') || 
    cleanSku.startsWith('DNA-') ||
    cleanSku.endsWith('=')
  ) {
    return false; 
  }

  // 2. WHITELIST: Familias de suscripción en la nube conocidas
  const isMerakiFamily = /^LIC-(MS|MR|CW|MX|MV|MT|MG|Z|SM|CS|SPACES)-/i.test(cleanSku);
  
  // 3. CONFIRMACIÓN: Tiene sufijo SaaS O la fila adyacente indica "Initial Term"
  const hasInitialTerm = descriptionRowAhead ? /Initial Term/i.test(descriptionRowAhead) : false;

  return isMerakiFamily || hasInitialTerm;
}

