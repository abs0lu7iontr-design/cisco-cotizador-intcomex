// ============================================================================
// CISCO AUTOMATED v2.1 - EXPORT UTILITIES & DYNAMIC NOMENCLATURE
// ============================================================================

export interface QuotationFileNameParams {
  partner?: string;
  customerName?: string;
  technologyOrFamily?: string;
  dealId?: string;
  estimateId: string;
  internacionPct: number;
  marginPct: number;
  arancelPct?: number;
  isRecalculated: boolean; // TRUE = RECALC, FALSE = CALC
  isOnlyLicensing?: boolean; // TRUE = Solo licencias/intangibles (omite internación)
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
 * Genera el nombre de archivo estandarizado corporativo:
 * - Con hardware o mixto: partner_cliente_modeloequipos_Estimate_N°Estimate_I{int}M{margen}_CALC/RECALC_hh-mm_dd-mm-aa.xlsx
 * - Solo licencias: partner_cliente_modeloequipos_Estimate_N°Estimate_M{margen}_CALC/RECALC_hh-mm_dd-mm-aa.xlsx
 */
export function generateQuotationFileName(params: QuotationFileNameParams): string {
  const sanitize = (str: string) => (str || '').replace(/[^a-zA-Z0-9_-]/g, '').trim();

  const partner = sanitize(params.partner || 'Intcomex');
  const cliente = sanitize(params.customerName || 'Cliente');
  const modeloEquipos = sanitize(params.technologyOrFamily || 'Cisco');

  // Limpiar y asegurar prefijo 'Estimate_' seguido del número/identificador
  const rawEst = sanitize(params.estimateId || 'ESTIMATE');
  const cleanEst = rawEst.replace(/^Estimate[_-]?/i, '') || 'ESTIMATE';

  // Soporta tanto formato decimal (0.07) como entero/porcentual (7.0)
  const intVal =
    params.internacionPct > 0 && params.internacionPct <= 1
      ? Math.round(params.internacionPct * 100)
      : Math.round(params.internacionPct);
  const maVal =
    params.marginPct > 0 && params.marginPct <= 1
      ? Math.round(params.marginPct * 100)
      : Math.round(params.marginPct);

  // Formato compacto y disimulado (stealth):
  // - Si es solo licencias: "M5" (omite internación por no requerir aduana/flete)
  // - Si tiene hardware o mixto: "I7M5" (o "I7M7"), fusionados sin guión intermedio
  const tagComercial = params.isOnlyLicensing ? `M${maVal}` : `I${intVal}M${maVal}`;
  const actionTag = params.isRecalculated ? 'RECALC' : 'CALC';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const fecha = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;

  return `${partner}_${cliente}_${modeloEquipos}_Estimate_${cleanEst}_${tagComercial}_${actionTag}_${hora}_${fecha}.xlsx`;
}
