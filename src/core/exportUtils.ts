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
  isRecalculated: boolean; // Backwards compatible fallback
  isOnlyLicensing?: boolean; // TRUE = Solo licencias/intangibles (omite internación)
  versionNumber?: number; // 0 = v0_RAW, 1 = v1, 2+ = v2, v3...
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
