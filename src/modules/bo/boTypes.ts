// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) REQUEST MODULE: TYPES & WAREHOUSE LOGIC
// ============================================================================

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
 * la coincidencia con el catálogo de SKUs de Intcomex.
 */
export function normalizeBasePartNumber(pn: string): string {
  const trimmed = (pn || '').trim();
  return trimmed.replace(/[-_\s]+CBN$/i, '').trim();
}

/**
 * Determina la bodega para cada línea según la presencia de Hardware,
 * consumiendo directamente los valores de venta calculados por el cotizador (Cero Recálculos).
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
  // 1. Detectar si existe hardware en la cotización
  const hasHardware = rawLines.some((l) => {
    if (typeof l.isHardware === 'boolean') return l.isHardware;
    if (typeof l.isIntangible === 'boolean') return !l.isIntangible;
    const upper = l.partNumber.trim().toUpperCase();
    return !upper.startsWith('CON-') && !upper.startsWith('CX-') && !upper.startsWith('LIC-') && !upper.includes('-SUB');
  });

  const assignedBodega: 'E1' | 'ED' = hasHardware ? 'E1' : 'ED';

  // 2. Mapear consumiendo directamente los precios finales del cotizador sin recalcular
  return rawLines.map((line) => {
    const rawPn = line.partNumber.trim();
    const boPn = formatBoPartNumber(rawPn);
    const upperPn = rawPn.toUpperCase();
    const isService = upperPn.startsWith('CON-') || upperPn.startsWith('CX-');
    const isLicense = upperPn.startsWith('LIC-') || upperPn.includes('-DNA-') || upperPn.includes('-SUB');
    const isServiceOrLicense = isService || isLicense;
    const isLineHw = line.isHardware ?? (line.isIntangible !== undefined ? !line.isIntangible : !isServiceOrLicense);

    // Priorizar precios de venta calculados finales
    const finalUnitPrice = line.unitSalePrice !== undefined ? line.unitSalePrice : (line.unitNetPrice || 0);
    const finalExtendedPrice = line.extendedSalePrice !== undefined ? line.extendedSalePrice : (line.extendedNetPrice || (finalUnitPrice * line.qty));

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
      bodega: assignedBodega,
      qty: line.qty,
      unitNetPrice: finalUnitPrice,
      extendedNetPrice: finalExtendedPrice,
      isHardware: isLineHw,
      isServiceOrLicense,
      isExcludedZeroCost: finalUnitPrice === 0 && finalExtendedPrice === 0,
    };
  });
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
  const assignedBodega = lines.length > 0 ? lines[0].bodega : 'E1';
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
