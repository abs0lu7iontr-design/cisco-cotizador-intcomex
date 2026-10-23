// ============================================================================
// CISCO AUTOMATED v2.1 - PURE CALCULATION & CLASSIFICATION ENGINE
// ============================================================================

import { QuoteParameters, OverrideRuleType, ProcessedEstimateResult } from './types';
import { generateQuotationFileName, isPureLicensingQuote, resolveEffectiveQuoteRates } from './exportUtils';
import { isCiscoIntangibleSku } from './ciscoTaxonomy';
import {
  isCiscoAccessorySku,
  isMotherLineFormat,
  normalizeCcwLineNumber,
  isEolAccessoryOrProductSku,
  isMainHardwareChassisSku,
  NON_EOL_CISCO_ACCESSORIES_CATALOG,
  NON_EOL_CISCO_ACCESSORIES_SET,
} from './ciscoAccessoriesCatalog';

export {
  isPureLicensingQuote,
  isCiscoAccessorySku,
  isMotherLineFormat,
  normalizeCcwLineNumber,
  isEolAccessoryOrProductSku,
  isMainHardwareChassisSku,
  NON_EOL_CISCO_ACCESSORIES_CATALOG,
  NON_EOL_CISCO_ACCESSORIES_SET,
};

/**
 * Redondeo financiero estricto. Previene el error IEEE 754 de Javascript.
 */
export function roundFinancial(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Utilidad de parseo numérico puro para formatos numéricos europeos, latinos y US.
 * Soporta:
 * - Decimales con coma sin miles: "12,50" -> 12.5, "0,25" -> 0.25, "950,5" -> 950.5, "0,125" -> 0.125
 * - Formato Latino/Europeo con miles y decimales: "1.250,50" -> 1250.5, "1.250.000,75" -> 1250000.75
 * - Formato US con miles y decimales: "1,250.50" -> 1250.5, "1,250" -> 1250, "12,500" -> 12500
 * - Símbolos de moneda y porcentaje: "$1,250.50", "$1.250,50", "$12,50", "58,40%"
 */
export function safeParseFloat(value: any): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (value === null || value === undefined || value === '') return 0;

  let str = String(value).trim();
  if (!str) return 0;

  // Detectar negativos contables entre paréntesis: "(12,50)" -> "-12,50"
  let isNegative = false;
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Limpiar símbolos de moneda ($, USD, CLP, UF), porcentaje (%) y espacios
  str = str.replace(/[$\s%]/g, '').replace(/^(USD|CLP|UF)/i, '').replace(/(USD|CLP|UF)$/i, '').trim();
  if (!str) return 0;

  if (str.startsWith('-')) {
    isNegative = !isNegative;
    str = str.slice(1).trim();
  } else if (str.startsWith('+')) {
    str = str.slice(1).trim();
  }

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    // Ambos separadores presentes: el último determina cuál es el separador decimal
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato Latino/Europeo: "1.250,50" o "12.345.678,9"
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Formato US: "1,250.50" o "12,345,678.9"
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // Solo comas presentes
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Múltiples comas -> separador de miles US ("1,250,000")
      str = str.replace(/,/g, '');
    } else {
      // Una sola coma: verificar si es coma decimal ("12,50", "0,25", "950,5", "0,125")
      // vs separador de miles entero US ("1,250", "12,500" -> 1 a 3 dígitos no-cero antes y exactamente 3 dígitos después)
      const [intPart, fracPart] = str.split(',');
      const isUsThousandsInteger =
        /^[1-9]\d{0,2}$/.test(intPart) && /^\d{3}$/.test(fracPart);
      if (isUsThousandsInteger) {
        str = str.replace(',', '');
      } else {
        str = str.replace(',', '.');
      }
    }
  } else if (hasDot && !hasComma) {
    // Solo puntos presentes: si hay múltiples puntos de miles ("1.250.000"), quitarlos
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1 && /^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return 0;
  return isNegative && parsed !== 0 ? -parsed : parsed;
}

/**
 * Intelligent Multi-Tier Classification for Cisco CCW Line Items:
 * Protects hardware while accurately identifying software licenses,
 * subscriptions, smartnet services, and duty-applicable accessories.
 */
export function checkIsIntangible(sku: string, description: string): boolean {
  const upperSku = (sku || '').trim().toUpperCase();
  const lowerDesc = (description || '').trim().toLowerCase();

  // Differentiate Cisco ONE software licenses (C1-, C1A, C1F, C1P) from C1 physical hardware switches & routers (C1000, C1100, C1200, C1300)
  const isC1Hardware = /^C1\d{3}/.test(upperSku);
  const isCiscoOneLicenseSku =
    (upperSku.startsWith('C1-') || /^C1[AFP][A-Z0-9]/.test(upperSku)) && !isC1Hardware;

  // Cables, antennas, power cords (CAB-ACI, CAB-C13, CAB-C14, CAB-C15, etc.), power supplies, transceivers, brackets, modules and blanks are strictly physical hardware
  const isPhysicalAccessoryOrCable =
    upperSku.startsWith('CAB-') ||
    upperSku.includes('-CAB-') ||
    upperSku.startsWith('PWR-') ||
    upperSku.startsWith('MA-PWR-') ||
    upperSku.startsWith('STACK-') ||
    upperSku.startsWith('FAN-') ||
    upperSku.startsWith('SFP-') ||
    upperSku.startsWith('QSFP-') ||
    upperSku.startsWith('GLC-') ||
    upperSku.endsWith('-BLANK') ||
    isCiscoAccessorySku(upperSku, lowerDesc);

  // Pure standalone license & subscription SKU patterns
  const isPureStandaloneLicenseSku =
    !isPhysicalAccessoryOrCable &&
    (upperSku.startsWith('CON-') ||
      upperSku.startsWith('CON') ||
      upperSku.startsWith('L-') ||
      upperSku.startsWith('LIC-') ||
      isCiscoOneLicenseSku ||
      upperSku.startsWith('SVS-') ||
      upperSku.startsWith('CX-') ||
      upperSku.startsWith('CXE-') ||
      upperSku.startsWith('CXS-') ||
      upperSku.startsWith('DCN-') ||
      upperSku.startsWith('NETWORK-') ||
      upperSku.includes('-DNA-') ||
      upperSku.includes('DNA-') ||
      upperSku.includes('-NW-') ||
      upperSku.includes('-SUB') ||
      upperSku.includes('A-FLEX'));

  const hardwareKeywords = [
    'catalyst',
    'switch',
    'router',
    'port poe',
    'port data',
    'blank',
    'module',
    'cable',
    'cord',
    'jumper',
    'rack',
    'power supply',
    'hardware',
    'chassis',
    'access point',
    'transceiver',
    'fan',
    'power cord',
    'stack',
    'antenna',
    'antena',
    'bracket',
    'injector',
  ];

  // Tier 1: Hardware Pre-Filter (Highest Priority: Force Tangible/Equipo)
  // Cables, accessories, C1 switches/routers, and physical hardware are strictly tangible
  if (isPhysicalAccessoryOrCable || isC1Hardware || !isPureStandaloneLicenseSku) {
    if (
      isPhysicalAccessoryOrCable ||
      isC1Hardware ||
      hardwareKeywords.some((keyword) => lowerDesc.includes(keyword))
    ) {
      // If SKU is physical accessory or C1 hardware and not an explicit term license, force tangible
      const isExplicitLicenseDesc =
        lowerDesc.includes('term license') ||
        lowerDesc.includes('dna essentials') ||
        lowerDesc.includes('dna advantage') ||
        lowerDesc.includes('subscription');
      if (!isExplicitLicenseDesc) {
        return false; // Physical hardware -> Tangible
      }
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

  if (isCiscoIntangibleSku(upperSku, lowerDesc)) {
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
    'networking essentials',
    'networking advantage',
    'essentials term',
    'advantage term',
    'premier term',
    'cisco one',
    'data center networking',
    'dcn',
  ];

  if (intangibleKeywords.some((keyword) => lowerDesc.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Checks if a line item applies customs duty (Arancel 6% + Internación 7%):
 * 1. When a SKU ends with '=' (spare/repuesto), the probability that it comes in Mother Line format
 *    ("1.0", "2.0", "3.0", "4.0", "5.0", "6.0", etc.) is 100%, and it ALWAYS carries Arancel.
 * 2. Any non-EOL Cisco/Meraki Accessory (Antennas, Cables, SFPs/Transceivers, Power Supplies,
 *    PoE Injectors, Brackets/Mounts, Stacking Kits, Expansion Modules, Fans, Blanks) that appears
 *    in MOTHER LINE format ("1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0", "11.0"... to infinity)
 *    ALWAYS carries Arancel even if it does NOT end with '='.
 * 3. Accessories in CHILD LINE format ("1.1", "1.2", "2.1", "1.0.1", etc.) without '=' do NOT
 *    carry Arancel (they are bundled inside a parent hardware chassis -> EQUIPO / TANGIBLE).
 * 4. Main Equipment (Switches, Routers, APs, Firewalls, Controllers, Cameras, Phones, Servers)
 *    in Mother Line format ("1.0", "2.0", "3.0", "4.0", "5.0", "6.0"...) without '=' do NOT carry Arancel (EQUIPO).
 */
export function checkLlevaArancel(
  sku: string,
  description: string = '',
  lineNumber?: string
): boolean {
  const trimmedSku = (sku || '').trim();
  if (!trimmedSku) return false;

  // Licencias y servicios intangibles nunca llevan arancel por defecto
  if (checkIsIntangible(trimmedSku, description)) {
    return false;
  }

  // Regla 1: Si termina en '=', el 100% de las veces es formato línea madre (1.0, 2.0, 3.0...) y lleva arancel
  if (trimmedSku.endsWith('=')) {
    return true;
  }

  // Regla 2: Si está en formato Línea Madre (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0... al infinito)
  // y pertenece a la lista/clasificador infinito de Accesorios Cisco/Meraki No-EOL, lleva arancel
  if (isMotherLineFormat(lineNumber) && isCiscoAccessorySku(trimmedSku, description)) {
    return true;
  }

  return false;
}

/**
 * Formats lead time in days to business weeks (Intcomex CCW Golden Rule):
 * - If already a formatted string containing 'semana', 'pedido', 'stock', 'digital', returns as-is (Idempotent protection).
 * - If days <= 2: returns empty string "" (Stock inmediato)
 * - If days > 2: Math.ceil(days / 7) + 2 transit weeks:
 *   - Si el total calculado da 3 semanas: agrega 1 semana más -> "4 semanas a pedido"
 *   - Si el total calculado da 4 semanas: formatear como "4 a 5 semanas a pedido"
 *   - En los demás casos (5, 6, 7... 27...): "X semanas a pedido"
 */
export function formatLeadTime(leadTimeDays: number | string): string {
  if (typeof leadTimeDays === 'string') {
    const trimmed = leadTimeDays.trim();
    if (
      /semana/i.test(trimmed) ||
      /pedido/i.test(trimmed) ||
      /stock/i.test(trimmed) ||
      /digital/i.test(trimmed) ||
      /inmediato/i.test(trimmed)
    ) {
      return trimmed;
    }
  }

  const days = typeof leadTimeDays === 'number' ? leadTimeDays : safeParseFloat(leadTimeDays);
  if (isNaN(days) || days <= 2) {
    return '';
  }
  const semanas = Math.ceil(days / 7) + 2;
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
  override?: OverrideRuleType | string,
  lineNumber?: string
) {
  let isIntangible = checkIsIntangible(sku, description);
  let llevaArancel = checkLlevaArancel(sku, description, lineNumber);

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

  if (marginRate >= 1 || marginRate < 0 || Number.isNaN(marginRate)) {
    throw new RangeError(
      `Margen comercial inválido (${params.margenPct}%): debe estar en el rango [0%, 100%). Un margen de 100% genera división por cero.`
    );
  }

  const costoInternacion = roundFinancial(netCiscoUnit * internacionRate);
  const costoArancel = roundFinancial(netCiscoUnit * arancelRate);
  const costoTotalUnitario = roundFinancial(netCiscoUnit + costoInternacion + costoArancel);

  // Standard Commercial Margin on Sales Price: PV = Costo / (1 - Margen)
  const rawUnitPrice = costoTotalUnitario / (1 - marginRate);
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
      text.match(/Initial\s*Term\s*[-:]\s*(\d+(?:\.\d+)?)\s*Month/i) ||
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
  params: QuoteParameters,
  override?: OverrideRuleType | string
) {
  const safeMonths = Math.max(1, months);
  const safeQty = Math.max(1, qty);

  // a) Costo Neto Mensual
  const costoNetoMensual = unitListPrice * (1 - discPct / 100);

  // Costo Total Unitario Base (Net Cisco Unit Total for Contract)
  const netCiscoUnitTotal = roundFinancial(costoNetoMensual * safeMonths);

  // Aplicación estricta de regla manual (3-state override)
  const normOverride = normalizeOverrideRule(override);
  let isIntangible = true;
  let llevaArancel = false;
  let costoInternacion = 0;
  let costoArancel = 0;

  if (normOverride === 'equipo') {
    isIntangible = false;
    llevaArancel = false;
    costoInternacion = roundFinancial(netCiscoUnitTotal * (params.internacionPct / 100));
  } else if (normOverride === 'arancel') {
    isIntangible = false;
    llevaArancel = true;
    costoInternacion = roundFinancial(netCiscoUnitTotal * (params.internacionPct / 100));
    costoArancel = roundFinancial(netCiscoUnitTotal * (params.arancelPct / 100));
  } else {
    // Defecto: Intangible puro (0% Internación, 0% Arancel)
    isIntangible = true;
    llevaArancel = false;
    costoInternacion = 0;
    costoArancel = 0;
  }

  const costoTotalUnitario = roundFinancial(netCiscoUnitTotal + costoInternacion + costoArancel);

  // b) Precio Venta Total y Mensual (Margen Comercial: PV = Costo / (1 - Margen))
  const marginRate = params.margenPct / 100;
  if (marginRate >= 1 || marginRate < 0 || Number.isNaN(marginRate)) {
    throw new RangeError(
      `Margen comercial inválido (${params.margenPct}%): debe estar en el rango [0%, 100%). Un margen de 100% genera división por cero.`
    );
  }
  const rawPrecioVentaUnitario = costoTotalUnitario / (1 - marginRate);
  const precioVentaUnitario = roundFinancial(rawPrecioVentaUnitario);
  const precioVentaExtendido = roundFinancial(precioVentaUnitario * safeQty);
  const precioVentaMensual = roundFinancial(precioVentaUnitario / safeMonths);

  return {
    isIntangible,
    llevaArancel,
    costoInternacion,
    costoArancel,
    costoTotalUnitario,
    precioVentaUnitario,
    precioVentaExtendido,
    netCiscoUnitCalculated: netCiscoUnitTotal,
    months: safeMonths,
    precioVentaMensual,
  };
}

/**
 * Determines if a line item is a Main / Mother Item ("1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "10.0"... to infinity)
 * vs Sub-item ("1.0.1", "1.1", "2.1").
 */
export function isMainLineItem(lineNumber: string): boolean {
  if (!lineNumber) return true;
  const normalized = normalizeCcwLineNumber(lineNumber);
  return /^\d+\.0$/.test(normalized);
}

/**
 * Extrae la clave de la Línea Madre asociada a cualquier número de línea de CCW.
 * Ejemplos: "1.0" -> "1.0", "1.1" -> "1.0", "1.0.1" -> "1.0", "2.0" -> "2.0", "2.3" -> "2.0", "10.4" -> "10.0"
 */
export function getMotherLineKey(lineNumber?: string | number): string {
  if (lineNumber === undefined || lineNumber === null) return '1.0';
  const clean = normalizeCcwLineNumber(lineNumber);
  if (!clean) return '1.0';
  const match = clean.match(/^(\d+)/);
  if (match) {
    return `${match[1]}.0`;
  }
  return clean;
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
  minPossibleTotal?: number;
  isBelowMinimumCost?: boolean;
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
    lineNumber?: string;
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
        const rowOverride = overrides && item.rowIdx ? overrides[item.rowIdx] : undefined;
        const res = calculateMerakiLicenseCosts(
          item.unitListPrice,
          item.discPct,
          item.qty,
          item.months,
          p,
          rowOverride
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
          rowOverride,
          item.lineNumber
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
    targetTotal = Math.max(0, roundFinancial(currentTotal - requestedDiscount));
  } else {
    targetTotal = Math.max(0, roundFinancial(targetPriceOrDiscount));
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
  const fixedArancel = currentParams.arancelPct ?? 6.0;
  const isInternacionStrictlyZero = currentParams.internacionPct === 0;
  const baseInternacion = isInternacionStrictlyZero
    ? 0
    : (currentParams.internacionPct > 0 ? currentParams.internacionPct : 7.0);
  const baseMargen = currentParams.margenPct > 0 ? currentParams.margenPct : 5.0;

  // Floor validation: minimum possible total at 0% Internación and 0% Margen (preserving fixed Arancel)
  const minPossibleTotal = computeTotal({
    internacionPct: 0,
    arancelPct: fixedArancel,
    margenPct: 0,
  });

  if (targetTotal < minPossibleTotal - 0.01) {
    return {
      success: false,
      isBelowMinimumCost: true,
      minPossibleTotal,
      currentTotal,
      targetTotal,
      achievedTotal: minPossibleTotal,
      difference: roundFinancial(Math.abs(minPossibleTotal - targetTotal)),
      discountAmount: roundFinancial(currentTotal - minPossibleTotal),
      newInternacionPct: 0,
      newArancelPct: fixedArancel,
      newMargenPct: 0,
      error: `Objetivo inalcanzable: $${targetTotal.toFixed(2)} USD está por debajo del costo piso mínimo de $${minPossibleTotal.toFixed(2)} USD (0% Internación y 0% Margen).`,
    };
  }

  // Binary search for equitable scaling factor k in [0.0, 1.5]
  let low = 0.0;
  let high = 1.5;
  let bestK = 1.0;
  let bestDiff = Infinity;

  for (let iter = 0; iter < 45; iter++) {
    const mid = (low + high) / 2;
    const testParams: QuoteParameters = {
      internacionPct: isInternacionStrictlyZero ? 0 : Math.max(0, mid * baseInternacion),
      arancelPct: fixedArancel,
      margenPct: Math.min(99, Math.max(0, mid * baseMargen)),
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
  let bestInt = isInternacionStrictlyZero ? 0 : Math.max(0, Math.round(bestK * baseInternacion * 10) / 10);
  let bestMar = Math.min(99, Math.max(0, Math.round(bestK * baseMargen * 10) / 10));
  let bestAchieved = computeTotal({
    internacionPct: bestInt,
    arancelPct: fixedArancel,
    margenPct: bestMar,
  });
  let minDistance = Math.abs(bestAchieved - targetTotal);

  // Micro fine-tuning pass over +/- 0.3% in steps of 0.1% to find the exact closest discrete match
  const dIntRange = isInternacionStrictlyZero ? [0] : [-3, -2, -1, 0, 1, 2, 3];
  for (const dInt of dIntRange) {
    for (let dMar = -3; dMar <= 3; dMar++) {
      const candInt = isInternacionStrictlyZero ? 0 : Math.max(0, Math.round((bestInt + dInt * 0.1) * 10) / 10);
      const candMar = Math.min(99, Math.max(0, Math.round((bestMar + dMar * 0.1) * 10) / 10));
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
    minPossibleTotal,
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
  const cleanBase = withoutExt.replace(/_(CALC|ORIGINAL|RECALC|v[0-9]+(_RAW)?|V[0-9]+)(_[0-9\-_]+)?$/i, '');
  return cleanBase || 'Cotizacion_Cisco';
}

/**
 * Generates output filename with dynamic timestamp:
 * Formato requerido: [NombreOriginalArchivo]_[suffix]_[HH-MM_DD-MM-YY].xlsx
 */
export function suggestFileName(fileName: string, suffix: string = 'v1'): string {
  const base = getBaseFileNameWithoutExt(fileName);
  const timestamp = getCcwTimestamp();
  return `${base}_${suffix}_${timestamp}.xlsx`;
}

/**
 * Universal SaaS/Cloud Subscription Classifier
 * Detecta si un SKU corresponde a una suscripción en la nube SaaS (como Meraki LIC-*)
 * cuyo precio unitario en CCW representa un valor mensual que requiere multiplicarse por el plazo.
 *
 * REGLAS DE SEGURIDAD ESTRICTAS:
 * 1. Suscripciones Prepago (Prepaid Term / Lump-Sum): Si la fila adyacente o descripción indica "Prepaid Term",
 *    el Unit Net Price de CCW YA ES el costo total por todo el período. JAMÁS debe multiplicarse por meses.
 * 2. Licencias Cisco ONE (C1*), Data Center (DCN*), DNA, Servicios (CON*, SVS*, CX*) y software perpetuo (L-*, =):
 *    NUNCA deben multiplicarse por meses.
 * 3. Solo familias Meraki Cloud (LIC-*) con modalidad periódica mensual aplican para multiplicación.
 */
export function isCloudSubscriptionSku(sku: string, descriptionRowAhead?: string): boolean {
  const cleanSku = (sku || '').trim().toUpperCase();
  if (!cleanSku) return false;

  // 1. REGLA PREPAGO EXPLICITA: Si la descripción indica "Prepaid Term" o "Prepaid",
  // el precio en CCW YA ES POR EL PLAZO COMPLETO.
  if (descriptionRowAhead) {
    if (
      /Billing\s*Model\s*[-:]\s*Prepaid/i.test(descriptionRowAhead) ||
      /Prepaid\s*Term/i.test(descriptionRowAhead) ||
      /\bPrepaid\b/i.test(descriptionRowAhead)
    ) {
      return false;
    }
  }

  // 2. BLACKLIST ESTRICTA: Ignorar servicios, Cisco ONE, DNA, DCN, perpetuos y repuestos
  if (
    cleanSku.startsWith('CON-') || 
    cleanSku.startsWith('SVS-') || 
    cleanSku.startsWith('CX-') || 
    cleanSku.startsWith('CXE-') || 
    cleanSku.startsWith('CXS-') || 
    cleanSku.startsWith('L-') || 
    ((cleanSku.startsWith('C1-') || /^C1[AFP]/.test(cleanSku)) && !/^C1\d{3}/.test(cleanSku)) || 
    cleanSku.startsWith('DCN-') || 
    cleanSku.includes('-DNA') || 
    cleanSku.startsWith('DNA-') ||
    cleanSku.endsWith('=')
  ) {
    return false; 
  }

  // 3. WHITELIST: Familias de suscripción en la nube conocidas (Meraki LIC-*)
  const isMerakiFamily = /^LIC-(MS|MR|CW|MX|MV|MT|MG|Z|SM|CS|SPACES|CSR|VMX|ENT|SEC|SDW|D2C|ACCSMGR|CT)-/i.test(cleanSku);

  return isMerakiFamily;
}

/**
 * Ultra-fast In-Memory Recalculation Engine:
 * Recomputes all line items, subtotals, margins, and dynamic filename
 * in < 0.1ms without touching disk or reparsing ExcelJS DOM.
 * Eliminates dropped slider events and race conditions.
 */
export function recalculateEstimateResult(
  currentResult: ProcessedEstimateResult,
  params: QuoteParameters,
  overrides?: Record<number, OverrideRuleType>,
  promoPrices?: Record<number, number>
): ProcessedEstimateResult {
  let originalProductTotal = 0;
  let calculatedProductTotal = 0;

  const newItems = currentResult.items.map((item) => {
    if (item.isInfoRow) {
      return { ...item };
    }

    const rowIdx = item.rowIdx;
    const normalizedLineNumber = normalizeCcwLineNumber(item.lineNumber) || item.lineNumber;
    const cleanSkuKey = (item.partNumber || '').trim().toUpperCase();
    const hasPromo = Boolean(promoPrices && promoPrices[rowIdx] !== undefined);
    const baseNetCiscoUnit = item.originalNetCiscoUnit ?? item.netCiscoUnit;
    const netCiscoUnit = hasPromo ? promoPrices![rowIdx] : baseNetCiscoUnit;
    const override = overrides ? (overrides[rowIdx] ?? (cleanSkuKey ? (overrides as any)[cleanSkuKey] : undefined)) : undefined;

    // SaaS / Meraki Cloud Subscription with multi-month duration
    const isExplicitPrepaid =
      /Billing\s*Model\s*[-:]\s*Prepaid/i.test(item.description || '') ||
      /Prepaid\s*Term/i.test(item.description || '') ||
      /\bPrepaid\b/i.test(item.description || '') ||
      /smartnet/i.test(item.description || '') ||
      /\bsntc\b/i.test(item.description || '') ||
      ((cleanSkuKey.startsWith('C1-') || /^C1[AFP]/.test(cleanSkuKey)) && !/^C1\d{3}/.test(cleanSkuKey)) ||
      cleanSkuKey.startsWith('SVS-') ||
      cleanSkuKey.startsWith('CON-') ||
      cleanSkuKey.startsWith('CON') ||
      cleanSkuKey.startsWith('CX-') ||
      cleanSkuKey.startsWith('CXE-') ||
      cleanSkuKey.startsWith('CXS-') ||
      cleanSkuKey.startsWith('DCN-');

    const isPeriodic =
      !isExplicitPrepaid &&
      (item.isPeriodicSubscription !== undefined
        ? Boolean(item.isPeriodicSubscription)
        : Boolean(item.months && item.months > 1 && isCloudSubscriptionSku(cleanSkuKey)));
    const durationMonths = isPeriodic ? (item.detectedDurationMonths ?? item.months ?? 1) : 1;

    // Resolución de Parámetros Jerárquicos / Custom por Línea Madre (Bloque N.0)
    const motherKey = getMotherLineKey(normalizedLineNumber);
    const hasCustomLineParams = Boolean(
      params.parameterMode === 'custom_lines' &&
      params.lineCustomParams &&
      params.lineCustomParams[motherKey]
    );

    const lineCustom = hasCustomLineParams ? params.lineCustomParams![motherKey] : undefined;

    const effectiveInternacionPct = lineCustom?.internacionPct !== undefined
      ? lineCustom.internacionPct
      : params.internacionPct;

    const effectiveArancelPct = lineCustom?.arancelPct !== undefined
      ? lineCustom.arancelPct
      : params.arancelPct;

    const effectiveMargenPct = lineCustom?.margenPct !== undefined
      ? lineCustom.margenPct
      : params.margenPct;

    const effectiveParams: QuoteParameters = {
      ...params,
      internacionPct: effectiveInternacionPct,
      arancelPct: effectiveArancelPct,
      margenPct: effectiveMargenPct,
    };

    if (item.realUnitCost === 0 && (item.unitListPrice === 0 || item.netCiscoUnit === 0)) {
      // Sub-línea a costo $0.00 (ej. cables incluidos CAB-ACI, fuentes PWR-*, o sub-licencias LIC-MT-E-INCL)
      const normRule = normalizeOverrideRule(override);
      const defaultIsIntangible = checkIsIntangible(item.partNumber, item.description);
      const defaultLlevaArancel = checkLlevaArancel(item.partNumber, item.description, normalizedLineNumber);
      const isIntangible =
        normRule === 'intangible'
          ? true
          : normRule === 'arancel' || normRule === 'equipo'
          ? false
          : defaultIsIntangible;
      const llevaArancel =
        normRule === 'arancel'
          ? true
          : normRule === 'intangible' || normRule === 'equipo'
          ? false
          : defaultLlevaArancel;
      return {
        ...item,
        lineNumber: normalizedLineNumber,
        isIntangible,
        llevaArancel,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
        effectiveInternacionPct,
        effectiveArancelPct,
        effectiveMargenPct,
        isCustomParamApplied: hasCustomLineParams,
        inheritedFromMotherLine: motherKey,
      };
    } else if (isPeriodic && durationMonths > 1 && item.unitListPrice > 0) {
      const effectiveDisc = hasPromo && item.unitListPrice > 0
        ? Number((((item.unitListPrice - netCiscoUnit) / item.unitListPrice) * 100).toFixed(2))
        : item.discPct;

      const meraki = calculateMerakiLicenseCosts(
        item.unitListPrice,
        effectiveDisc,
        item.qty,
        durationMonths,
        effectiveParams,
        override
      );

      originalProductTotal += meraki.netCiscoUnitCalculated * item.qty;
      calculatedProductTotal += meraki.precioVentaExtendido;

      return {
        ...item,
        lineNumber: normalizedLineNumber,
        netCiscoUnit: meraki.netCiscoUnitCalculated,
        realUnitCost: meraki.costoTotalUnitario,
        discPct: effectiveDisc,
        ...meraki,
        isFastTrackPromo: hasPromo || item.isFastTrackPromo,
        originalNetCiscoUnit: item.originalNetCiscoUnit ?? meraki.netCiscoUnitCalculated,
        fastTrackDiscountPct: hasPromo ? effectiveDisc : item.fastTrackDiscountPct,
        fastTrackSavings: hasPromo
          ? Number(((baseNetCiscoUnit - meraki.costoTotalUnitario) * item.qty).toFixed(2))
          : item.fastTrackSavings,
        effectiveInternacionPct,
        effectiveArancelPct,
        effectiveMargenPct,
        isCustomParamApplied: hasCustomLineParams,
        inheritedFromMotherLine: motherKey,
      };
    } else {
      const calculated = calculateLineItemCosts(
        netCiscoUnit,
        item.qty,
        item.partNumber,
        item.description,
        effectiveParams,
        override,
        normalizedLineNumber
      );

      originalProductTotal += baseNetCiscoUnit * item.qty;
      calculatedProductTotal += calculated.precioVentaExtendido;

      return {
        ...item,
        lineNumber: normalizedLineNumber,
        netCiscoUnit,
        isFastTrackPromo: hasPromo,
        ...calculated,
        effectiveInternacionPct,
        effectiveArancelPct,
        effectiveMargenPct,
        isCustomParamApplied: hasCustomLineParams,
        inheritedFromMotherLine: motherKey,
      };
    }
  });

  const roundedCalculatedTotal = roundFinancial(calculatedProductTotal);
  const roundedOriginalTotal = roundFinancial(originalProductTotal);

  // Unified rounding policy: total must strictly match the sum of rounded line items (precioVentaExtendido)
  const finalCalculatedTotal = roundedCalculatedTotal;

  const isOnlyLicensing = isPureLicensingQuote(newItems);

  const hasActiveCustomLines = Boolean(
    params.parameterMode === 'custom_lines' &&
    params.lineCustomParams &&
    Object.keys(params.lineCustomParams).length > 0
  );

  const isRecalc = Boolean(
    hasActiveCustomLines ||
    (params && ((!isOnlyLicensing && params.internacionPct !== 7.0) || params.margenPct !== 5.0)) ||
    (overrides && Object.keys(overrides).length > 0)
  );

  const cleanBase = currentResult.fileName.replace(/\.[^/.]+$/, '');
  const parts = cleanBase.split(/[_.\s-]+/);
  const partnerFromName = parts[0] && !parts[0].match(/^(estimate|\d+)$/i) ? parts[0] : 'Intcomex';
  const clientFromName = parts[1] && !parts[1].match(/^(estimate|\d+)$/i) ? parts[1] : 'Cliente';
  const techFromName = parts.length >= 3 && !parts[2].match(/^(estimate|calc|recalc|int\d+|ma\d+|i\d+|m\d+|i\d+m\d+|\d+)$/i) ? parts[2] : 'Cisco';

  const effectiveRates = resolveEffectiveQuoteRates(params, newItems);

  const newFileName = generateQuotationFileName({
    partner: currentResult.headerInfo?.companyName || partnerFromName,
    customerName: currentResult.headerInfo?.customerName || clientFromName,
    technologyOrFamily: techFromName,
    dealId: currentResult.headerInfo?.dealId,
    estimateId: currentResult.headerInfo?.estimateId || 'ESTIMATE',
    internacionPct: effectiveRates.internacionPct,
    marginPct: effectiveRates.marginPct,
    arancelPct: effectiveRates.arancelPct,
    isRecalculated: isRecalc,
    isOnlyLicensing,
    params,
    items: newItems,
  });

  return {
    ...currentResult,
    fileName: newFileName,
    items: newItems,
    originalProductTotal: roundedOriginalTotal,
    calculatedProductTotal: finalCalculatedTotal,
    finalTotalPrice: finalCalculatedTotal,
  };
}

// ============================================================================
// MULTI-CURRENCY CONVERSION UTILITIES (USD / CLP / UF)
// ============================================================================

export type CurrencyCode = 'USD' | 'CLP' | 'UF';

export interface CurrencyConversionRates {
  USD: number;
  CLP: number;
  UF: number;
}

export const DEFAULT_CURRENCY_RATES: CurrencyConversionRates = {
  USD: 1,
  CLP: 950,
  UF: 38500,
};

/**
 * Convierte un monto en USD a la divisa seleccionada (USD, CLP o UF).
 * Nota: Para CLP y UF en el Front-End, rates.CLP ya incluye el recargo de +$10 CLP
 * sobre el Dólar Observado oficial del Banco Central de Chile (ej: 970 -> 980 CLP).
 */
export function convertUsdToCurrency(
  amountUsd: number,
  currency: CurrencyCode,
  rates: CurrencyConversionRates = DEFAULT_CURRENCY_RATES
): number {
  if (!amountUsd || isNaN(amountUsd)) return 0;
  if (currency === 'USD') return roundFinancial(amountUsd);
  if (currency === 'CLP') {
    const clpRate = rates.CLP || DEFAULT_CURRENCY_RATES.CLP;
    return Math.round(amountUsd * clpRate);
  }
  if (currency === 'UF') {
    const clpRate = rates.CLP || DEFAULT_CURRENCY_RATES.CLP;
    const ufRate = rates.UF || DEFAULT_CURRENCY_RATES.UF;
    const totalClp = amountUsd * clpRate;
    return roundFinancial(totalClp / ufRate);
  }
  return roundFinancial(amountUsd);
}

/**
 * Da formato con símbolo según la divisa seleccionada.
 */
export function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return currency === 'UF' ? '0.00 UF' : '$0';
  }
  if (currency === 'USD') {
    return `$${amount.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USD`;
  }
  if (currency === 'CLP') {
    return `$${Math.round(amount).toLocaleString('es-CL')} CLP`;
  }
  if (currency === 'UF') {
    return `${amount.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} UF`;
  }
  return String(amount);
}


