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
}

/**
 * Genera el nombre de archivo estandarizado corporativo:
 * partner_cliente_modeloequipos_Estimate_N°Estimate_Ix_Mx_CALC/RECALC_hh-mm_dd-mm-aa.xlsx
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

  // Abreviación solicitada: "Ix" para internación y "Mx" para margen (ej. I7_M5)
  const internacionTag = `I${intVal}`;
  const margenTag = `M${maVal}`;
  const actionTag = params.isRecalculated ? 'RECALC' : 'CALC';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const fecha = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;

  return `${partner}_${cliente}_${modeloEquipos}_Estimate_${cleanEst}_${internacionTag}_${margenTag}_${actionTag}_${hora}_${fecha}.xlsx`;
}
