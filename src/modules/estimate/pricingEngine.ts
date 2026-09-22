// ============================================================================
// CISCO AUTOMATED v2.1 - MOTOR DE PRECIOS DINÁMICO CON MÁRGENES REACTIVOS
// ============================================================================

import { ProcessedEstimateLine } from './estimateHierarchyParser';

export interface CalculatedSaleLine extends ProcessedEstimateLine {
  unitSalePrice: number;
  extendedSalePrice: number;
  marginAmountTotal: number;
}

export function calculateEstimateSalesPricing(
  lines: ProcessedEstimateLine[],
  marginPercent: number,          // Margen editable desde la UI (ej. 5 para 5%)
  hardwareInternacionPercent: number // Arancel/internación solo para hardware (ej. 6 o 7%)
): CalculatedSaleLine[] {
  const marginDecimal = marginPercent / 100;
  const hwInternacionDecimal = hardwareInternacionPercent / 100;

  return lines.map((line) => {
    // Las licencias y suscripciones no pagan internación de aduana
    const isHardware = !line.isPeriodicSubscription && !line.partNumber.startsWith('LIC-') && !line.partNumber.startsWith('CON-');
    const applicableInternacion = isHardware ? hwInternacionDecimal : 0;

    const landedCost = line.realUnitCost * (1 + applicableInternacion);
    const unitSalePrice = marginDecimal < 1 ? landedCost / (1 - marginDecimal) : landedCost;
    const extendedSalePrice = unitSalePrice * line.qty;
    const marginAmountTotal = (unitSalePrice - landedCost) * line.qty;

    return {
      ...line,
      unitSalePrice,
      extendedSalePrice,
      marginAmountTotal
    };
  });
}
