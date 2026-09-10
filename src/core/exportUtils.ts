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
  isRecalculated: boolean; // TRUE = RECALC, FALSE = CALC
}

/**
 * Genera el nombre de archivo estandarizado corporativo:
 * partner_cliente_equipo_dealid(si corresponde)_estimate_margenes_CALC/RECALC_hora_fecha.xlsx
 */
export function generateQuotationFileName(params: QuotationFileNameParams): string {
  const sanitize = (str: string) => (str || '').replace(/[^a-zA-Z0-9_-]/g, '').trim();

  const partner = sanitize(params.partner || 'Intcomex');
  const cliente = sanitize(params.customerName || 'Cliente');
  const equipo = sanitize(params.technologyOrFamily || 'Cisco');

  const dealStr =
    params.dealId && params.dealId !== 'NA' && params.dealId.trim() !== ''
      ? `_DEAL-${sanitize(params.dealId)}`
      : '';

  const estimate = sanitize(params.estimateId || 'ESTIMATE');

  // Soporta tanto formato decimal (0.07) como entero/porcentual (7.0)
  const intVal =
    params.internacionPct > 0 && params.internacionPct <= 1
      ? Math.round(params.internacionPct * 100)
      : Math.round(params.internacionPct);
  const maVal =
    params.marginPct > 0 && params.marginPct <= 1
      ? Math.round(params.marginPct * 100)
      : Math.round(params.marginPct);

  const margenes = `INT${intVal}_MA${maVal}`;
  const actionTag = params.isRecalculated ? 'RECALC' : 'CALC';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const fecha = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;

  return `${partner}_${cliente}_${equipo}${dealStr}_${estimate}_${margenes}_${actionTag}_${hora}_${fecha}.xlsx`;
}
