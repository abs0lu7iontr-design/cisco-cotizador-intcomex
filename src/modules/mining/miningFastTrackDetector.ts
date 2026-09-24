// ============================================================================
// CISCO AUTOMATED v2.1 - MINING OBSERVER: FAST TRACK USAGE DETECTOR
// Pure Observer Mode: Detects possible Fast Track usage in mining accounts
// ============================================================================

import { getFastTrackItem } from '../fasttrack/fastTrackDb';

export interface MiningFastTrackMatchedItem {
  rowIdx?: number;
  lineNumber: string;
  partNumber: string;
  description: string;
  qty: number;
  unitListPrice: number;
  netCiscoUnit: number;
  currentDiscountPct: number;
  fastTrackDiscountPct: number;
}

export interface MiningFastTrackAlertData {
  isMining: boolean;
  shouldAlert: boolean;
  matchedItems: MiningFastTrackMatchedItem[];
  commonDiscountPct?: number;
  accountName?: string;
  explanation?: string;
}

export interface MiningEstimateItemInput {
  rowIdx?: number;
  lineNumber?: string;
  partNumber?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  unitListPrice?: number;
  listPrice?: number;
  netCiscoUnit?: number;
  unitNetPrice?: number;
  discPct?: number;
  isInfoRow?: boolean;
  detectedDurationMonths?: number;
  months?: number;
  isPeriodicSubscription?: boolean;
}

/**
 * Inspecciona un Estimate exclusivamente si pertenece a una cuenta de Minería.
 * Realiza el cruce con el catálogo Fast Track. Si se detectan al menos 2 ítems
 * que coincidan con Fast Track y tengan descuentos idénticos, dispara la alerta preventiva.
 * Si no encuentra nada, omite silenciosamente sin mostrar ningún pop-up.
 */
export async function detectMiningFastTrackUsage(
  items: MiningEstimateItemInput[],
  isMining: boolean,
  accountName?: string,
  fastTrackLookup?: (pn: string) => Promise<{ distributorDiscount: number } | null>
): Promise<MiningFastTrackAlertData> {
  // 1. REGLA ESTRICTA: Solo para cotizaciones de minería
  if (!isMining || !Array.isArray(items) || items.length === 0) {
    return {
      isMining: false,
      shouldAlert: false,
      matchedItems: [],
    };
  }

  // 2. Filtrar candidatos con precio de lista, costo neto y Part Number válido
  const candidates = items.filter((item) => {
    if (item.isInfoRow || !item.partNumber || !item.partNumber.trim()) return false;
    const listPrice = item.unitListPrice !== undefined ? item.unitListPrice : item.listPrice;
    const netPrice = item.netCiscoUnit !== undefined ? item.netCiscoUnit : item.unitNetPrice;
    return typeof listPrice === 'number' && listPrice > 0 && typeof netPrice === 'number' && netPrice > 0;
  });

  if (candidates.length === 0) {
    return {
      isMining: true,
      shouldAlert: false,
      matchedItems: [],
      accountName,
    };
  }

  // 3. Cruce concurrente con el catálogo Fast Track en IndexedDB
  const crossResults = await Promise.all(
    candidates.map(async (item) => {
      const pn = (item.partNumber || '').trim();
      const listPrice = (item.unitListPrice !== undefined ? item.unitListPrice : item.listPrice) || 0;
      const netPrice = (item.netCiscoUnit !== undefined ? item.netCiscoUnit : item.unitNetPrice) || 0;
      const qty = (item.qty !== undefined ? item.qty : item.quantity) || 1;

      // Duración en meses para suscripciones periódicas (ej. Meraki SUB)
      const durationMonths = Math.max(
        1,
        item.detectedDurationMonths || item.months || 1
      );
      const isPeriodic = Boolean(
        item.isPeriodicSubscription || durationMonths > 1
      );

      // Normalizar precio de lista para comparar bases homogéneas
      const contractListPrice = isPeriodic ? listPrice * durationMonths : listPrice;

      const calculatedDiscountPct =
        contractListPrice > 0
          ? Number((((contractListPrice - netPrice) / contractListPrice) * 100).toFixed(1))
          : 0;

      // Descuento observado en CCW redondeado a 1 decimal
      const currentDiscountPct =
        typeof item.discPct === 'number' && item.discPct > 0
          ? Number(item.discPct.toFixed(1))
          : Math.max(0, calculatedDiscountPct);

      // Consultar en Fast Track DB
      const ftProduct = fastTrackLookup ? await fastTrackLookup(pn) : await getFastTrackItem(pn);
      if (!ftProduct) return null;

      const ftDiscountPct = Number(ftProduct.distributorDiscount) || 0;

      // REGLA CRÍTICA DE CONCORDANCIA:
      // Un ítem solo se considera configurado con Fast Track en CCW si su descuento
      // observado en CCW coincide realmente con el descuento del catálogo Fast Track (±0.5% por redondeo).
      // Si el Estimate tiene p. ej. 65% (Deal/Acuerdo Minero) y Fast Track es 55% o 63%, NO es Fast Track.
      if (ftDiscountPct <= 0 || Math.abs(currentDiscountPct - ftDiscountPct) > 0.5) {
        return null;
      }

      const matched: MiningFastTrackMatchedItem = {
        rowIdx: item.rowIdx,
        lineNumber: item.lineNumber || '',
        partNumber: pn,
        description: item.description || '',
        qty,
        unitListPrice: listPrice,
        netCiscoUnit: netPrice,
        currentDiscountPct,
        fastTrackDiscountPct: ftDiscountPct,
      };

      return matched;
    })
  );

  // Filtrar solo los ítems que están en Fast Track Y cuyo descuento CCW coincide con Fast Track
  const ftMatchedItems = crossResults.filter((r): r is MiningFastTrackMatchedItem => r !== null);

  // 4. Si ningún ítem presenta el descuento de Fast Track en CCW, no se muestra ningún pop-up
  if (ftMatchedItems.length === 0) {
    return {
      isMining: true,
      shouldAlert: false,
      matchedItems: [],
      accountName,
    };
  }

  // Determinar descuento(s) coincidente(s) para mostrar en el resumen
  const uniqueDiscounts = Array.from(
    new Set(ftMatchedItems.map((item) => Math.round(item.fastTrackDiscountPct * 10) / 10))
  );
  const commonPct = uniqueDiscounts[0] || 0;
  const discountSummaryLabel = uniqueDiscounts.map((d) => `${d}%`).join(' / ');

  return {
    isMining: true,
    shouldAlert: true,
    matchedItems: ftMatchedItems,
    commonDiscountPct: commonPct,
    accountName,
    explanation: `Se detectaron ${ftMatchedItems.length} ítem(s) cuyo descuento en CCW coincide exactamente con el catálogo Fast Track (${discountSummaryLabel}). En cuentas de minería no se utiliza Fast Track; se sugiere revisar nuevamente el Estimate en CCW.`,
  };
}
