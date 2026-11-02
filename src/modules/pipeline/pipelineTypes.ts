// ============================================================================
// CISCO AUTOMATED v2.8 - PIPELINE COMERCIAL & OPORTUNIDADES CISCO TYPES
// ============================================================================

export type PipelineStage = 20 | 30 | 50 | 70 | 100 | 0;

export interface PipelineDealRecord {
  id: string;
  fechaLevantamiento: string; // e.g. "1/8/2026" o "2026-08-01"
  fechaCotizacion: string; // e.g. "1/8/2026" o "2026-08-01"
  marca: string; // "Cisco" por defecto
  pmResponsable: string; // e.g. "Raul Cuevas", "Marta Adasme", "Johana Valencia", "Mauricio Skill"
  partner: string; // Partner/Reseller
  ejecutivoPartner: string; // Ejecutivo o KAM del Partner
  endUser: string; // Cliente Final
  usd: number; // Monto total de la oportunidad
  mesCierre: string; // e.g. "Julio", "Octubre", "Noviembre"
  mesFacturacion: string; // e.g. "Noviembre" o vacío
  porcentajeAvance: number; // 20, 30, 50, 70, 100, etc.
  dealId: string; // #Registro Oportunidad Marca (Cisco CCW Deal ID o Quote ID)
  productosSuscripciones: number; // Subtotal Hardware + Licencias/SaaS
  servicios: number; // Subtotal Servicios SmartNet / CX
  meraki: number; // Subtotal Soluciones Meraki Cloud
  am: string; // Account Manager Cisco / Intcomex
  grupoVentas: string; // "Enterprise", "Top Volume", "Grupo3"
  notas: string; // Observaciones comerciales
  priceProtectionExpiryDate: string; // Fecha de vencimiento de Price Protection
  sourceEstimateId?: string; // ID de Estimate en Cisco Automated si fue vinculado
  sourceEstimateVersion?: string; // Versión vinculada (v0_RAW, v1, etc.)
  boTrackingId?: string; // ID de seguimiento Back Order si se convirtió a orden
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isSeed?: boolean;
}

export interface PipelineStats {
  totalDeals: number;
  totalUsd: number;
  forecastPonderadoUsd: number;
  totalProductosSuscripciones: number;
  totalServicios: number;
  totalMeraki: number;
  dealsGanadosCount: number;
  dealsGanadosUsd: number;
  dealsEnNegociacionCount: number;
  dealsEnNegociacionUsd: number;
  dealsPriceProtectionAlertsCount: number;
}

export interface PipelineFilterOptions {
  searchQuery?: string;
  pmResponsable?: string;
  grupoVentas?: string;
  mesCierre?: string;
  am?: string;
  porcentajeAvance?: number | 'ALL';
  partner?: string;
}

export const PIPELINE_PM_LIST = [
  'Raul Cuevas',
  'Marta Adasme',
  'Johana Valencia',
  'Mauricio Skill',
] as const;

export const PIPELINE_VENTAS_GRUPOS = [
  'Enterprise',
  'Top Volume',
  'Grupo3',
] as const;

export const PIPELINE_STAGE_OPTIONS: { value: number; label: string; color: string; bg: string; border: string }[] = [
  { value: 20, label: '20% - Levantamiento / Cualificación', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  { value: 30, label: '30% - Propuesta / Cotizado CCW', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  { value: 50, label: '50% - Negociación / Evaluación', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { value: 70, label: '70% - Adjudicado / Aprobación', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { value: 100, label: '100% - Ganado / Facturación', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { value: 0, label: '0% - Perdido / Cancelado', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
];

export const MESES_ANO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;
