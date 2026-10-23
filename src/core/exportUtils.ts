// ============================================================================
// CISCO AUTOMATED v2.1 - EXPORT UTILITIES & DYNAMIC NOMENCLATURE
// ============================================================================

import { QuoteParameters } from './types';

export interface QuotationFileNameParams {
  partner?: string;
  customerName?: string;
  technologyOrFamily?: string;
  dealId?: string;
  estimateId: string;
  internacionPct: number;
  marginPct: number;
  arancelPct?: number;
  isRecalculated: boolean; // Backwards compatible fallback
  isOnlyLicensing?: boolean; // TRUE = Solo licencias/intangibles (omite internación)
  versionNumber?: number; // 0 = v0_RAW, 1 = v1, 2+ = v2, v3...
  params?: Partial<QuoteParameters>;
  items?: Array<any>;
}

export interface EffectiveRates {
  internacionPct: number;
  marginPct: number;
  arancelPct: number;
}

/**
 * Universal Classifier: Checks if a quote consists exclusively of software licenses,
 * SaaS subscriptions, or services with zero tangible hardware/customs duties.
 */
export function isPureLicensingQuote(
  items?: Array<{
    isInfoRow?: boolean;
    isIntangible?: boolean;
    costoInternacion?: number;
    llevaArancel?: boolean;
  }>
): boolean {
  if (!items || items.length === 0) return false;
  const billable = items.filter((it) => !it.isInfoRow);
  if (billable.length === 0) return false;
  return billable.every(
    (it) => it.isIntangible && (!it.costoInternacion || it.costoInternacion === 0) && !it.llevaArancel
  );
}

/**
 * Resuelve las tasas económicas comerciales efectivas (internación %, margen %, arancel %)
 * para la cotización completa.
 * Si se utilizan parámetros estándar CCW, retorna los valores base globales.
 * Si se utilizan parámetros custom por línea madre (parameterMode === 'custom_lines'):
 *  1. Calcula la internación ponderada real sobre el hardware tangible cotizado.
 *  2. Calcula el margen comercial consolidado global ((Total Venta - Total Costo) / Total Venta * 100).
 *  3. Si no hay ítems en memoria, resuelve desde las definiciones configuradas en lineCustomParams.
 */
export function resolveEffectiveQuoteRates(
  params?: Partial<QuoteParameters>,
  items?: Array<any>
): EffectiveRates {
  const baseInt = params?.internacionPct ?? 7.0;
  const baseMargin = params?.margenPct ?? 5.0;
  const baseArancel = params?.arancelPct ?? 6.0;

  const isCustomMode = params?.parameterMode === 'custom_lines';
  const customLines = params?.lineCustomParams;
  const hasCustomEntries = Boolean(customLines && Object.keys(customLines).length > 0);
  const hasCustomAppliedItems = Boolean(items && items.some((it) => it.isCustomParamApplied));

  if (!isCustomMode && !hasCustomEntries && !hasCustomAppliedItems) {
    return {
      internacionPct: baseInt,
      marginPct: baseMargin,
      arancelPct: baseArancel,
    };
  }

  // 1. Si tenemos ítems calculados disponibles, derivar las tasas efectivas reales de la cotización
  if (items && items.length > 0) {
    const billable = items.filter((it) => !it.isInfoRow);
    if (billable.length > 0) {
      // 1.1 Margen comercial global efectivo
      let totalVenta = 0;
      let totalCosto = 0;
      let billableCount = 0;
      let sumItemMargins = 0;

      for (const it of billable) {
        const qty = Number(it.qty) || 1;
        const ventaUnit = Number(it.precioVentaUnitario) || 0;
        const ventaExt = Number(it.precioVentaExtendido) || (ventaUnit * qty);
        const costoUnit = Number(it.costoTotalUnitario) || 0;
        const costoExt = costoUnit * qty;

        totalVenta += ventaExt;
        totalCosto += costoExt;

        if (it.effectiveMargenPct !== undefined && !isNaN(it.effectiveMargenPct)) {
          sumItemMargins += Number(it.effectiveMargenPct);
          billableCount++;
        }
      }

      let effMargin = baseMargin;
      if (totalVenta > 0 && totalVenta >= totalCosto) {
        effMargin = ((totalVenta - totalCosto) / totalVenta) * 100;
      } else if (billableCount > 0) {
        effMargin = sumItemMargins / billableCount;
      } else if (hasCustomEntries) {
        const marginVals = Object.values(customLines!)
          .map((c) => c.margenPct)
          .filter((v): v is number => v !== undefined && !isNaN(v));
        if (marginVals.length > 0) {
          effMargin = marginVals.reduce((a, b) => a + b, 0) / marginVals.length;
        }
      }

      // 1.2 Internación efectiva sobre hardware/ítems tangibles
      let totalNetHw = 0;
      let totalIntHw = 0;
      let tangibleCount = 0;
      let sumItemIntWeighted = 0;
      let weightIntSum = 0;

      for (const it of billable) {
        if (!it.isIntangible) {
          const qty = Number(it.qty) || 1;
          const netUnit = Number(it.netCiscoUnit) || 0;
          const netExt = netUnit * qty;
          const intCostUnit = Number(it.costoInternacion) || 0;
          const intCostExt = intCostUnit * qty;

          totalNetHw += netExt;
          totalIntHw += intCostExt;

          if (it.effectiveInternacionPct !== undefined && !isNaN(it.effectiveInternacionPct)) {
            const weight = netExt > 0 ? netExt : qty;
            sumItemIntWeighted += Number(it.effectiveInternacionPct) * weight;
            weightIntSum += weight;
            tangibleCount++;
          }
        }
      }

      let effInt = baseInt;
      if (totalNetHw > 0 && totalIntHw > 0) {
        effInt = (totalIntHw / totalNetHw) * 100;
      } else if (tangibleCount > 0 && weightIntSum > 0) {
        effInt = sumItemIntWeighted / weightIntSum;
      } else if (hasCustomEntries) {
        const intVals = Object.values(customLines!)
          .map((c) => c.internacionPct)
          .filter((v): v is number => v !== undefined && !isNaN(v));
        if (intVals.length > 0) {
          effInt = intVals.reduce((a, b) => a + b, 0) / intVals.length;
        }
      }

      // 1.3 Arancel
      let effArancel = baseArancel;
      if (hasCustomEntries) {
        const arancelVals = Object.values(customLines!)
          .map((c) => c.arancelPct)
          .filter((v): v is number => v !== undefined && !isNaN(v));
        if (arancelVals.length > 0) {
          effArancel = arancelVals.reduce((a, b) => a + b, 0) / arancelVals.length;
        }
      }

      return {
        internacionPct: effInt,
        marginPct: effMargin,
        arancelPct: effArancel,
      };
    }
  }

  // 2. Si no hay ítems en memoria, derivar de las definiciones de lineCustomParams
  if (hasCustomEntries) {
    const customList = Object.values(customLines!);

    const intVals = customList
      .map((c) => c.internacionPct)
      .filter((v): v is number => v !== undefined && !isNaN(v));
    const effInt =
      intVals.length > 0 ? intVals.reduce((a, b) => a + b, 0) / intVals.length : baseInt;

    const marginVals = customList
      .map((c) => c.margenPct)
      .filter((v): v is number => v !== undefined && !isNaN(v));
    const effMargin =
      marginVals.length > 0 ? marginVals.reduce((a, b) => a + b, 0) / marginVals.length : baseMargin;

    const arancelVals = customList
      .map((c) => c.arancelPct)
      .filter((v): v is number => v !== undefined && !isNaN(v));
    const effArancel =
      arancelVals.length > 0
        ? arancelVals.reduce((a, b) => a + b, 0) / arancelVals.length
        : baseArancel;

    return {
      internacionPct: effInt,
      marginPct: effMargin,
      arancelPct: effArancel,
    };
  }

  return {
    internacionPct: baseInt,
    marginPct: baseMargin,
    arancelPct: baseArancel,
  };
}

/**
 * Genera el nombre de archivo estandarizado corporativo con versión (v0_RAW, v1, v2...):
 * - Con hardware o mixto: partner_cliente_modeloequipos_Estimate_N°Estimate_I{int}M{margen}_v{num}_hh-mm_dd-mm-aa.xlsx
 * - Solo licencias: partner_cliente_modeloequipos_Estimate_N°Estimate_M{margen}_v{num}_hh-mm_dd-mm-aa.xlsx
 */
export function generateQuotationFileName(params: QuotationFileNameParams): string {
  const sanitize = (str: string) =>
    (str || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/_+/g, '_');

  const partner = sanitize(params.partner || 'Intcomex');
  const cliente = sanitize(params.customerName || 'Cliente');
  const modeloEquipos = sanitize(params.technologyOrFamily || 'Cisco');

  // Limpiar y asegurar prefijo 'Estimate_' seguido del número/identificador
  const rawEst = sanitize(params.estimateId || 'ESTIMATE');
  const cleanEst = rawEst.replace(/^Estimate[_-]?/i, '') || 'ESTIMATE';

  // Si se pasaron params con custom_lines o items con parámetros custom, resolver tasas efectivas reales
  let effectiveInt = params.internacionPct;
  let effectiveMargin = params.marginPct;

  const hasCustomParams = Boolean(
    (params.params?.parameterMode === 'custom_lines') ||
    (params.params?.lineCustomParams && Object.keys(params.params.lineCustomParams).length > 0) ||
    (params.items && params.items.some((it) => it.isCustomParamApplied))
  );

  if (hasCustomParams) {
    const resolved = resolveEffectiveQuoteRates(params.params, params.items);
    effectiveInt = resolved.internacionPct;
    effectiveMargin = resolved.marginPct;
  }

  // Soporta tanto formato decimal (0.07) como entero/porcentual (7.0)
  const intVal =
    effectiveInt > 0 && effectiveInt <= 1
      ? Math.round(effectiveInt * 100)
      : Math.round(effectiveInt);
  const maVal =
    effectiveMargin > 0 && effectiveMargin <= 1
      ? Math.round(effectiveMargin * 100)
      : Math.round(effectiveMargin);

  // Formato compacto y disimulado (stealth):
  // - Si es solo licencias: "M5" (omite internación por no requerir aduana/flete)
  // - Si tiene hardware o mixto: "I7M5" (o "I23M6"), fusionados sin guión intermedio
  const tagComercial = params.isOnlyLicensing ? `M${maVal}` : `I${intVal}M${maVal}`;

  // Determinación de etiqueta de versión: v0_RAW, v1, v2...
  let versionTag = params.isRecalculated ? 'v2' : 'v1';
  if (params.versionNumber !== undefined) {
    if (params.versionNumber === 0) {
      versionTag = 'v0_RAW';
    } else {
      versionTag = `v${params.versionNumber}`;
    }
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const fecha = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;

  return `${partner}_${cliente}_${modeloEquipos}_Estimate_${cleanEst}_${tagComercial}_${versionTag}_${hora}_${fecha}.xlsx`;
}
