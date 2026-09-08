// ============================================================================
// CISCO AUTOMATED - FAST TRACK CROSS-CHECK AUDIT ENGINE
// ============================================================================

import { EstimateLineItem } from '../../core/types';
import { FastTrackAuditResult, FastTrackAuditMatch } from './types';
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
  items: EstimateLineItem[]
): Promise<FastTrackAuditResult | null> {
  const stats = await getFastTrackStats();
  const expStatus = getFastTrackExpirationStatus(stats.validUntil);

  if (stats.validUntil) {
    const isExpired = new Date(stats.validUntil).getTime() < Date.now();
    if (isExpired) return null; // Fallback al costo estándar, promoción vencida.
  }

  // 1. Verificación de Interruptor Global (Kill Switch)
  if (!isFastTrackAuditEnabled()) {
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
  const count = await getFastTrackCount();
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
    candidates.map((item) => getFastTrackItem(item.partNumber))
  );

  const matches: FastTrackAuditMatch[] = [];
  let accumulatedSavings = 0;

  // 5. Comparar descuentos
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const ftProduct = ftProducts[i];
    if (!ftProduct) continue;

    // Calcular descuento actual del archivo CCW/BOM
    const currentDiscountPct =
      item.unitListPrice > 0
        ? Number((((item.unitListPrice - item.netCiscoUnit) / item.unitListPrice) * 100).toFixed(2))
        : Number(item.discPct) || 0;

    const ftDiscountPct = Number(ftProduct.distributorDiscount) || 0;

    // Regla de Oportunidad: Descuento Fast Track MAYOR al del archivo
    if (ftDiscountPct > currentDiscountPct + 0.1) {
      const promoUnitNetPrice = Number((item.unitListPrice * (1 - ftDiscountPct / 100)).toFixed(2));
      const unitSavings = Number((item.netCiscoUnit - promoUnitNetPrice).toFixed(2));
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
