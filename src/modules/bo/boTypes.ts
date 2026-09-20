// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: TYPES & WAREHOUSE LOGIC
// ============================================================================

export interface BoLineItem {
  sku: string;               // Código Intcomex (ej. EN614MKC66, editable)
  partNumber: string;        // P/N oficial Cisco
  bodega: 'E1' | 'ED2';      // E1 o ED2
  qty: number;               // Cantidad
  unitNetPrice: number;      // Costo neto unitario
  extendedNetPrice: number;  // Math.round(unitNetPrice * qty)
  isHardware: boolean;
  isServiceOrLicense: boolean;
}

export interface BoEstimateData {
  clientName: string;
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
 * la coincidencia con el catálogo de SKUs de Intcomex.
 */
export function normalizeBasePartNumber(pn: string): string {
  const trimmed = (pn || '').trim();
  return trimmed.replace(/[-_\s]+CBN$/i, '').trim();
}

/**
 * Determina la bodega para cada línea según la presencia de Hardware
 */
export function resolveWarehouseForLines(
  rawLines: Array<{
    sku?: string;
    partNumber: string;
    qty: number;
    unitNetPrice: number;
    initialTermMonths?: number;
  }>,
  skuCatalogLookup?: (pn: string) => string
): BoLineItem[] {
  // 1. Detectar si una línea es servicio o licencia
  const classified = rawLines.map((line) => {
    const rawPn = line.partNumber.trim();
    const boPn = formatBoPartNumber(rawPn);
    const upperPn = rawPn.toUpperCase();
    const isService = upperPn.startsWith('CON-') || upperPn.startsWith('CX-');
    const isLicense = upperPn.startsWith('LIC-') || upperPn.includes('-DNA-') || upperPn.includes('-SUB');
    const isServiceOrLicense = isService || isLicense;
    const isHardware = !isServiceOrLicense;

    // Normalizar precio unitario de servicio si viniera en base mensual
    let finalUnitPrice = line.unitNetPrice;
    if (isService && line.initialTermMonths && line.initialTermMonths > 1 && finalUnitPrice < 50) {
      // Ajuste si la columna del estimate viene por mes individual
      finalUnitPrice = line.unitNetPrice * line.initialTermMonths;
    }

    const extended = Math.round(finalUnitPrice * line.qty);
    const resolvedSku =
      line.sku ||
      (skuCatalogLookup
        ? skuCatalogLookup(boPn) ||
          skuCatalogLookup(rawPn) ||
          skuCatalogLookup(normalizeBasePartNumber(rawPn))
        : '');

    return {
      sku: resolvedSku,
      partNumber: boPn,
      bodega: 'E1' as 'E1' | 'ED2',
      qty: line.qty,
      unitNetPrice: finalUnitPrice,
      extendedNetPrice: extended,
      isHardware,
      isServiceOrLicense,
    };
  });

  // 2. Regla global de bodega: Si hay al menos un hardware, todo va a E1; si es solo licencias/servicios, va a ED2
  const hasHardware = classified.some((line) => line.isHardware);
  const globalBodega: 'E1' | 'ED2' = hasHardware ? 'E1' : 'ED2';

  return classified.map((line) => ({
    ...line,
    bodega: globalBodega,
  }));
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

