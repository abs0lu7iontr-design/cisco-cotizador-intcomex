// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R PRICING ENGINE & GOAL SEEK
// Motor de Cálculo Comercial, Margen en Columna Z, Aranceles y Buscador de Objetivo
// ============================================================================

import {
  CcwrLineItem,
  CcwrQuoteParameters,
  CcwrFinancialSummary,
  CcwrProductGroupSummary,
} from './ccwrTypes';
import { roundFinancial } from '../../core/calculations';

/**
 * Aplica los parámetros comerciales (Margen, Arancel, Internación) sobre una lista de ítems CCW-R
 */
export function calculateCcwrItemPricing(
  item: CcwrLineItem,
  params: CcwrQuoteParameters
): CcwrLineItem {
  const netCiscoUnit = item.unitNetPrice;
  const qty = item.quantity || 1;

  // Determinar si aplica arancel o internación según regla de la línea o parámetros globales
  const isArancel = item.overrideRule === 'arancel' || (params.arancelPct > 0 && item.overrideRule !== 'intangible');
  const isInternacion = item.overrideRule === 'equipo' || (params.internacionPct > 0 && item.overrideRule !== 'intangible');

  const arancelRate = isArancel ? params.arancelPct / 100 : 0;
  const internacionRate = isInternacion ? params.internacionPct / 100 : 0;
  const marginRate = params.margenPct / 100;

  if (marginRate >= 1 || marginRate < 0 || Number.isNaN(marginRate)) {
    throw new RangeError(
      `Margen comercial inválido (${params.margenPct}%): debe estar en el rango [0%, 100%). Un margen de 100% genera división por cero.`
    );
  }

  const costoArancel = roundFinancial(netCiscoUnit * arancelRate);
  const costoInternacion = roundFinancial(netCiscoUnit * internacionRate);
  const costoTotalUnitario = roundFinancial(netCiscoUnit + costoArancel + costoInternacion);

  // Fórmula estándar Intcomex: Precio Venta = Costo / (1 - Margen)
  const rawSaleUnitPrice = marginRate < 1 ? costoTotalUnitario / (1 - marginRate) : costoTotalUnitario;
  const precioVentaUnitario = roundFinancial(rawSaleUnitPrice);
  const precioVentaExtendido = roundFinancial(precioVentaUnitario * qty);

  return {
    ...item,
    costoNetoUnitario: netCiscoUnit,
    costoArancel,
    costoInternacion,
    costoTotalUnitario,
    precioVentaUnitario,
    precioVentaExtendido,
  };
}

/**
 * Recalcula toda la cotización y genera las métricas y agregaciones financieras
 */
export function recalculateCcwrQuote(
  items: CcwrLineItem[],
  params: CcwrQuoteParameters,
  onlyServicesWithCost: boolean = true
): { calculatedItems: CcwrLineItem[]; summary: CcwrFinancialSummary } {
  const calculatedItems = items.map((it) => calculateCcwrItemPricing(it, params));

  // Filtrar para el resumen solo las líneas activas de servicio/costo
  const activeItems = onlyServicesWithCost
    ? calculatedItems.filter((it) => it.isServiceOrLicense && it.extendedNetPrice > 0)
    : calculatedItems;

  let totalItems = 0;
  let totalQuantity = 0;
  let totalExtendedNetCost = 0;
  let totalCostoArancel = 0;
  let totalCostoInternacion = 0;
  let totalCostoGeneral = 0;
  let totalPrecioVenta = 0;

  const serialsSet = new Set<string>();
  const productGroupMap: Record<string, CcwrProductGroupSummary> = {};

  for (const it of activeItems) {
    totalItems++;
    totalQuantity += it.quantity;
    totalExtendedNetCost += it.extendedNetPrice;
    totalCostoArancel += it.costoArancel * it.quantity;
    totalCostoInternacion += it.costoInternacion * it.quantity;
    totalCostoGeneral += it.costoTotalUnitario * it.quantity;
    totalPrecioVenta += it.precioVentaExtendido;

    if (it.serialNumber) {
      serialsSet.add(it.serialNumber);
    }

    // Agrupación por modelo de producto
    const groupKey = `${it.productNumber}__${it.serviceSku}`;
    if (!productGroupMap[groupKey]) {
      productGroupMap[groupKey] = {
        productNumber: it.productNumber,
        description: it.productDescription,
        serviceSku: it.serviceSku,
        serviceLevel: it.serviceLevel,
        itemCount: 0,
        totalQty: 0,
        unitNetCost: it.unitNetPrice,
        totalExtendedNetCost: 0,
        unitSalePrice: it.precioVentaUnitario,
        totalSalePrice: 0,
      };
    }

    productGroupMap[groupKey].itemCount++;
    productGroupMap[groupKey].totalQty += it.quantity;
    productGroupMap[groupKey].totalExtendedNetCost += it.extendedNetPrice;
    productGroupMap[groupKey].totalSalePrice += it.precioVentaExtendido;
  }

  const margenBrutoUsd = roundFinancial(totalPrecioVenta - totalCostoGeneral);
  const margenBrutoPct = totalPrecioVenta > 0 ? roundFinancial((margenBrutoUsd / totalPrecioVenta) * 100) : 0;

  const summary: CcwrFinancialSummary = {
    totalItems,
    totalQuantity,
    uniqueSerialsCount: serialsSet.size,
    totalExtendedNetCost: roundFinancial(totalExtendedNetCost),
    totalCostoArancel: roundFinancial(totalCostoArancel),
    totalCostoInternacion: roundFinancial(totalCostoInternacion),
    totalCostoGeneral: roundFinancial(totalCostoGeneral),
    totalPrecioVenta: roundFinancial(totalPrecioVenta),
    margenBrutoUsd,
    margenBrutoPct,
    byProduct: Object.values(productGroupMap),
  };

  return { calculatedItems, summary };
}

/**
 * Goal Seek (Buscador de Objetivo) para CCW-R:
 * Calcula mediante búsqueda binaria de alta precisión el porcentaje de margen exacto
 * necesario para alcanzar un monto total deseado (ej: $12,329.81 USD).
 */
export function calculateCcwrGoalSeekMargin(
  items: CcwrLineItem[],
  targetTotalSalePrice: number,
  baseParams: CcwrQuoteParameters,
  onlyServicesWithCost: boolean = true
): { targetMarginPct: number; achievedTotal: number; difference: number; success: boolean } {
  if (targetTotalSalePrice <= 0) {
    return { targetMarginPct: baseParams.margenPct, achievedTotal: 0, difference: 0, success: false };
  }

  // 1. Validar piso mínimo (Margen 0%)
  const minResult = recalculateCcwrQuote(items, { ...baseParams, margenPct: 0.0 }, onlyServicesWithCost);
  const floorCost = minResult.summary.totalCostoGeneral;

  if (targetTotalSalePrice < floorCost) {
    return {
      targetMarginPct: 0.0,
      achievedTotal: floorCost,
      difference: roundFinancial(targetTotalSalePrice - floorCost),
      success: false,
    };
  }

  // 2. Búsqueda binaria entre 0% y 95%
  let low = 0.0;
  let high = 95.0;
  let bestMargin = 0.0;
  let bestTotal = 0.0;
  let minDiff = Infinity;

  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const res = recalculateCcwrQuote(items, { ...baseParams, margenPct: mid }, onlyServicesWithCost);
    const currentTotal = res.summary.totalPrecioVenta;
    const diff = Math.abs(currentTotal - targetTotalSalePrice);

    if (diff < minDiff) {
      minDiff = diff;
      bestMargin = mid;
      bestTotal = currentTotal;
    }

    if (diff <= 0.01) {
      break;
    }

    if (currentTotal < targetTotalSalePrice) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const roundedMargin = roundFinancial(bestMargin);
  return {
    targetMarginPct: roundedMargin,
    achievedTotal: bestTotal,
    difference: roundFinancial(bestTotal - targetTotalSalePrice),
    success: minDiff <= 0.5,
  };
}
