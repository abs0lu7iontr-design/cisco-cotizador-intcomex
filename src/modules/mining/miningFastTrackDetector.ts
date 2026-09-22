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

  if (candidates.length < 2) {
    // Si hay menos de 2 ítems válidos en total, es imposible tener al menos 2 con descuento igual
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

  // Filtrar solo los ítems que efectivamente están en el catálogo Fast Track
  const ftMatchedItems = crossResults.filter((r): r is MiningFastTrackMatchedItem => r !== null);

  // 4. Si no encuentra nada en Fast Track o hay menos de 2 ítems, no se muestra ningún pop-up
  if (ftMatchedItems.length < 2) {
    return {
      isMining: true,
      shouldAlert: false,
      matchedItems: [],
      accountName,
    };
  }

  // 5. Agrupar ítems coincidentes por su descuento observado en el Estimate
  const discountGroups: Record<string, MiningFastTrackMatchedItem[]> = {};

  for (const item of ftMatchedItems) {
    const key = item.currentDiscountPct.toFixed(1);
    if (!discountGroups[key]) {
      discountGroups[key] = [];
    }
    discountGroups[key].push(item);
  }

  // 6. Verificar si existe al menos un grupo con 2 o más ítems con descuento igual
  let alertGroup: MiningFastTrackMatchedItem[] | null = null;
  let commonPct = 0;

  for (const [discStr, group] of Object.entries(discountGroups)) {
    if (group.length >= 2) {
      alertGroup = group;
      commonPct = parseFloat(discStr);
      break;
    }
  }

  if (!alertGroup || alertGroup.length < 2) {
    return {
      isMining: true,
      shouldAlert: false,
      matchedItems: [],
      accountName,
    };
  }

  return {
    isMining: true,
    shouldAlert: true,
    matchedItems: alertGroup,
    commonDiscountPct: commonPct,
    accountName,
    explanation: `Se detectaron ${alertGroup.length} ítems en el catálogo Fast Track con descuento idéntico (${commonPct}%). En cuentas de minería no se utiliza Fast Track; se sugiere revisar nuevamente el Estimate en CCW.`,
  };
}
