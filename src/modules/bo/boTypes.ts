// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: TYPES & WAREHOUSE LOGIC
// ============================================================================

import { checkIsIntangible } from '../../core/calculations';

export interface BoLineItem {
  id?: string;
  sku: string;               // Código Intcomex (ej. EN614MKC66, editable)
  partNumber: string;        // P/N oficial Cisco con sufijo -CBN (editable)
  bodega: 'E1' | 'ED';       // E1 (Hardware / Mixto) | ED (Solo Servicios o Licencias)
  qty: number;               // Cantidad
  unitNetPrice: number;      // Precio de venta unitario final (con margen e internación)
  extendedNetPrice: number;  // Precio de venta extendido final (con margen e internación)
  isHardware: boolean;
  isServiceOrLicense?: boolean;
  isExcludedZeroCost?: boolean;
}

export interface BoEstimateData {
  clientName: string;
  recipientEmail?: string;
  ccEmail?: string;
  lines: BoLineItem[];
}

/**
 * Formatea el Part Number exclusivamente para el módulo BO agregando '-CBN' al final
 * si no contiene ya una variante de sufijo CBN (ej. '-CBN', ' CBN', etc.)
 */
export function formatBoPartNumber(pn: string): string {
  const trimmed = (pn || '').trim();
  if (!trimmed) return '';
  if (/[-_\s]+CBN$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}-CBN`;
}

/**
 * Obtiene el Part Number base removiendo cualquier sufijo CBN para maximizar
 * la coincidencia con el catálogo de SKUs de Intcomex y reglas de clasificación.
 */
export function normalizeBasePartNumber(pn: string): string {
  const trimmed = (pn || '').trim();
  return trimmed.replace(/[-_\s]+CBN$/i, '').trim();
}

/**
 * Determina con precisión si un Part Number (con o sin sufijo -CBN) corresponde
 * a un Servicio (SmartNet / CX) o Licencia / Suscripción (DNA, Meraki, SaaS, Intangible).
 */
export function isBoServiceOrLicense(
  partNumber: string,
  isIntangible?: boolean,
  isHardware?: boolean,
  description: string = ''
): boolean {
  const basePn = normalizeBasePartNumber(partNumber).toUpperCase();
  if (!basePn) return false;

  // 1. Reglas explícitas por familia de P/N Cisco & Meraki (Servicio / Licencia / Suscripción)
  const isExplicitServiceOrLicense =
    basePn.startsWith('CON-') ||
    basePn.startsWith('CX-') ||
    basePn.startsWith('LIC-') ||
    basePn.startsWith('L-') ||
    basePn.startsWith('S-') ||
    basePn.startsWith('SVS-') ||
    basePn.startsWith('DNA-') ||
    basePn.startsWith('DNX-') ||
    basePn.startsWith('E2N-') ||
    basePn.startsWith('E3N-') ||
    basePn.startsWith('FC-') ||
    basePn.startsWith('A-FLEX') ||
    basePn.includes('-DNA-') ||
    basePn.includes('DNA-') ||
    basePn.includes('-DNX-') ||
    basePn.includes('-NW-E') ||
    basePn.includes('-NW-A') ||
    basePn.includes('-SUB') ||
    basePn.includes('-LIC') ||
    basePn.includes('SMARTNET') ||
    basePn.includes('-SNT-') ||
    basePn.includes('-TRK') ||
    checkIsIntangible(basePn, description);

  if (isExplicitServiceOrLicense) {
    return true;
  }

  // 2. Si el motor de cálculo ya clasificó la línea como intangible
  if (typeof isIntangible === 'boolean') {
    return isIntangible;
  }
  if (typeof isHardware === 'boolean') {
    return !isHardware;
  }

  return false;
}

/**
 * Evalúa las líneas activas de un BO y determina automáticamente la bodega:
 * - Si TODAS las líneas activas son servicios o licencias -> 'ED'
 * - Si existe al menos 1 equipo físico (hardware) activo -> 'E1'
 */
export function detectBodegaFromActiveLines(
  activeLines: Array<{
    partNumber: string;
    isIntangible?: boolean;
    isHardware?: boolean;
    isServiceOrLicense?: boolean;
  }>
): 'E1' | 'ED' {
  if (!activeLines || activeLines.length === 0) {
    return 'E1';
  }

  const hasActiveHardware = activeLines.some((line) => {
    const isSvcOrLic = isBoServiceOrLicense(
      line.partNumber,
      line.isIntangible,
      line.isHardware
    );
    return !isSvcOrLic;
  });

  return hasActiveHardware ? 'E1' : 'ED';
}

/**
 * Determina la bodega para cada línea según la presencia de Hardware ACTIVO (con costo > $0),
 * consumiendo directamente los valores de venta calculados por el cotizador (Cero Recálculos).
 * Si las líneas con costo contienen únicamente licencias o servicios (aunque existan accesorios
 * a costo $0 descartados), asigna inmediatamente 'ED'.
 */
export function resolveWarehouseForLines(
  rawLines: Array<{
    sku?: string;
    partNumber: string;
    qty: number;
    unitNetPrice?: number;
    extendedNetPrice?: number;
    unitSalePrice?: number;
    extendedSalePrice?: number;
    isIntangible?: boolean;
    isHardware?: boolean;
    initialTermMonths?: number;
  }>,
  skuCatalogLookup?: (pn: string) => string
): BoLineItem[] {
  // 1. Pre-mapear cada línea con su clasificación individual y precios finales
  const prelimLines = rawLines.map((line) => {
    const rawPn = (line.partNumber || '').trim();
    const boPn = formatBoPartNumber(rawPn);
    const isServiceOrLicense = isBoServiceOrLicense(rawPn, line.isIntangible, line.isHardware);
    const isLineHw = !isServiceOrLicense;

    // Priorizar precios de venta calculados finales
    const finalUnitPrice = line.unitSalePrice !== undefined ? line.unitSalePrice : (line.unitNetPrice || 0);
    const finalExtendedPrice =
      line.extendedSalePrice !== undefined
        ? line.extendedSalePrice
        : line.extendedNetPrice || finalUnitPrice * line.qty;

    const resolvedSku =
      line.sku ||
      (skuCatalogLookup
        ? skuCatalogLookup(boPn) ||
          skuCatalogLookup(rawPn) ||
          skuCatalogLookup(normalizeBasePartNumber(rawPn))
        : '');

    const isExcludedZeroCost = finalUnitPrice === 0 && finalExtendedPrice === 0;

    return {
      sku: resolvedSku,
      partNumber: boPn,
      qty: line.qty,
      unitNetPrice: finalUnitPrice,
      extendedNetPrice: finalExtendedPrice,
      isHardware: isLineHw,
      isServiceOrLicense,
      isExcludedZeroCost,
    };
  });

  // 2. Determinar la bodega evaluando EXCLUSIVAMENTE las líneas activas con costo (> $0).
  // Si todas las líneas son $0, evaluar sobre el total de líneas.
  const pricedLines = prelimLines.filter((l) => !l.isExcludedZeroCost);
  const linesToEvaluate = pricedLines.length > 0 ? pricedLines : prelimLines;
  const assignedBodega: 'E1' | 'ED' = detectBodegaFromActiveLines(linesToEvaluate);

  return prelimLines.map((item) => ({
    ...item,
    bodega: assignedBodega,
  }));
}

/**
 * Función puente compatible: Prepara las líneas consumiendo directamente los valores calculados
 * y retornando tanto el arreglo como la bodega global ('E1' o 'ED').
 */
export function prepareBoLinesFromCalculated(
  calculatedLines: Array<{
    sku?: string;
    partNumber: string;
    qty: number;
    unitSalePrice?: number;
    extendedSalePrice?: number;
    unitNetPrice?: number;
    extendedNetPrice?: number;
    isIntangible?: boolean;
    isHardware?: boolean;
  }>,
  skuCatalogLookup?: (pn: string) => string
): { lines: BoLineItem[]; assignedBodega: 'E1' | 'ED' } {
  const lines = resolveWarehouseForLines(calculatedLines, skuCatalogLookup);
  const { activeLines } = partitionBoLinesByCost(lines);
  const assignedBodega = detectBodegaFromActiveLines(activeLines.length > 0 ? activeLines : lines);
  return { lines, assignedBodega };
}

/**
 * Separa las líneas entre aquellas con valor financiero activo y las de costo cero ($0 USD)
 */
export function partitionBoLinesByCost(lines: BoLineItem[]): {
  activeLines: BoLineItem[];
  zeroCostLines: BoLineItem[];
} {
  const activeLines: BoLineItem[] = [];
  const zeroCostLines: BoLineItem[] = [];

  for (const line of lines) {
    if (line.unitNetPrice > 0 && line.extendedNetPrice > 0) {
      activeLines.push(line);
    } else {
      zeroCostLines.push(line);
    }
  }

  return { activeLines, zeroCostLines };
}

