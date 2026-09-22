// ============================================================================
// CISCO AUTOMATED - FAST TRACK CROSS-CHECK AUDIT ENGINE
// ============================================================================

import { EstimateLineItem } from '../../core/types';
import { FastTrackAuditResult, FastTrackAuditMatch, FastTrackProduct } from './types';
import {
  isFastTrackAuditEnabled,
  getFastTrackItem,
  getFastTrackCount,
  getFastTrackExpirationStatus,
  getFastTrackStats,
} from './fastTrackDb';

/**
 * Cruza los ítems de una cotización CCW con la base de datos Fast Track en IndexedDB.
 * Failsafe: Si está desactivado o la base de datos está vacía, omite silenciosamente el proceso.
 */
export async function auditEstimateWithFastTrack(
  items: EstimateLineItem[],
  fastTrackLookup?: (pn: string) => Promise<FastTrackProduct | null>
): Promise<FastTrackAuditResult | null> {
  const stats = fastTrackLookup ? { validUntil: null, promotionCode: undefined, promotionTitle: undefined } : await getFastTrackStats();
  const expStatus = getFastTrackExpirationStatus(stats.validUntil);

  if (stats.validUntil) {
    const isExpired = new Date(stats.validUntil).getTime() < Date.now();
    if (isExpired) return null; // Fallback al costo estándar, promoción vencida.
  }

  // 1. Verificación de Interruptor Global (Kill Switch)
  if (!fastTrackLookup && !isFastTrackAuditEnabled()) {
    return {
      hasOpportunity: false,
      totalMatchedSkus: 0,
      totalSavings: 0,
      matches: [],
      isExpired: expStatus.isExpired,
      isExpiringSoon: expStatus.isExpiringSoon,
      validUntil: expStatus.validUntil,
      validUntilFormatted: expStatus.validUntilFormatted,
    };
  }

  // 2. Verificación de existencia de datos en IndexedDB
  const count = fastTrackLookup ? 1 : await getFastTrackCount();
  if (count === 0) {
    return {
      hasOpportunity: false,
      totalMatchedSkus: 0,
      totalSavings: 0,
      matches: [],
      isExpired: expStatus.isExpired,
      isExpiringSoon: expStatus.isExpiringSoon,
      validUntil: expStatus.validUntil,
      validUntilFormatted: expStatus.validUntilFormatted,
    };
  }

  // 3. Filtrar candidatos con precio de lista y SKU válido
  const candidates = items.filter(
    (item) => Boolean(item.partNumber) && item.unitListPrice > 0 && item.netCiscoUnit > 0
  );

  if (candidates.length === 0) {
    return {
      hasOpportunity: false,
      totalMatchedSkus: 0,
      totalSavings: 0,
      matches: [],
      isExpired: expStatus.isExpired,
      isExpiringSoon: expStatus.isExpiringSoon,
      validUntil: expStatus.validUntil,
      validUntilFormatted: expStatus.validUntilFormatted,
      validFrom: expStatus.validFrom,
      validFromFormatted: expStatus.validFromFormatted,
      promotionCode: stats.promotionCode,
      promotionTitle: stats.promotionTitle,
    };
  }

  // 4. Consultar concurrentemente en IndexedDB todos los SKUs candidatos
  const ftProducts = await Promise.all(
    candidates.map((item) =>
      fastTrackLookup ? fastTrackLookup(item.partNumber) : getFastTrackItem(item.partNumber)
    )
  );

  const matches: FastTrackAuditMatch[] = [];
  let accumulatedSavings = 0;

  // 5. Comparar descuentos
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const ftProduct = ftProducts[i];
    if (!ftProduct) continue;

    // Duración en meses para suscripciones periódicas (ej. Meraki SUB, licencias multi-anuales)
    const durationMonths = Math.max(
      1,
      item.detectedDurationMonths || item.months || 1
    );
    const isPeriodic = Boolean(
      item.isPeriodicSubscription || durationMonths > 1
    );

    // Precio de lista total correspondiente al plazo completo del ítem
    const contractListPrice = isPeriodic
      ? item.unitListPrice * durationMonths
      : item.unitListPrice;

    // Calcular descuento observado en CCW de manera robusta
    const calculatedDiscountPct =
      contractListPrice > 0
        ? Number((((contractListPrice - item.netCiscoUnit) / contractListPrice) * 100).toFixed(2))
        : 0;

    const currentDiscountPct =
      typeof item.discPct === 'number' && item.discPct > 0
        ? Number(item.discPct.toFixed(2))
        : Math.max(0, calculatedDiscountPct);

    const ftDiscountPct = Number(ftProduct.distributorDiscount) || 0;

    // Regla de Oportunidad: Descuento Fast Track MAYOR al del archivo
    if (ftDiscountPct > currentDiscountPct + 0.1) {
      // Precio neto unitario mensual o base para inyectar en promoNetPrices
      const promoUnitNetPrice = Number((item.unitListPrice * (1 - ftDiscountPct / 100)).toFixed(2));

      // Costo neto total del contrato bajo la promoción Fast Track
      const promoContractNetCost = isPeriodic
        ? promoUnitNetPrice * durationMonths
        : promoUnitNetPrice;

      // Ahorro unitario real comparando costos totales de contrato (o unitarios si es HW)
      const unitSavings = Number((item.netCiscoUnit - promoContractNetCost).toFixed(2));
      const totalSavings = Number((unitSavings * item.qty).toFixed(2));

      if (unitSavings > 0) {
        matches.push({
          rowIdx: item.rowIdx,
          lineNumber: item.lineNumber,
          partNumber: item.partNumber,
          description: item.description,
          qty: item.qty,
          unitListPrice: item.unitListPrice,
          currentUnitNetPrice: item.netCiscoUnit,
          currentDiscountPct,
          fastTrackDiscountPct: ftDiscountPct,
          promoUnitNetPrice,
          unitSavings,
          totalSavings,
        });

        accumulatedSavings += totalSavings;
      }
    }
  }

  return {
    hasOpportunity: matches.length > 0,
    totalMatchedSkus: matches.length,
    totalSavings: Number(accumulatedSavings.toFixed(2)),
    matches,
    isExpired: expStatus.isExpired,
    isExpiringSoon: expStatus.isExpiringSoon,
    validUntil: expStatus.validUntil,
    validUntilFormatted: expStatus.validUntilFormatted,
    validFrom: expStatus.validFrom,
    validFromFormatted: expStatus.validFromFormatted,
    promotionCode: stats.promotionCode,
    promotionTitle: stats.promotionTitle,
  };
}
