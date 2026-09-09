// ============================================================================
// CISCO AUTOMATED v2.1 - CORE DOMAIN TYPES
// ============================================================================

export type Role = 'admin' | 'pm' | 'preventa' | 'standard';

export type OverrideRuleType = 'equipo' | 'intangible' | 'arancel';

export interface QuoteParameters {
  internacionPct: number; // e.g. 7.0 -> 0.07
  arancelPct: number;      // e.g. 6.0 -> 0.06
  margenPct: number;       // e.g. 5.0 -> 0.05
}

export interface EstimateHeaderInfo {
  customerName: string;
  companyName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  estimateId: string;
  dealId: string;
  priceList: string;
  date: string;
}

export interface EstimateLineItem {
  rowIdx: number;
  lineNumber: string;
  partNumber: string;
  smartAccountMandatory: string;
  description: string;
  serviceDurationMonths: string;
  originalLeadTimeDays: string | number;
  transformedLeadTime: string;
  unitListPrice: number;
  pricingTerm: string;
  qty: number;
  netCiscoUnit: number;
  discPct: number;

  // Intcomex Calculated Fields
  isIntangible: boolean;
  llevaArancel: boolean;
  costoInternacion: number;
  costoArancel: number;
  costoTotalUnitario: number;
  precioVentaUnitario: number;
  precioVentaExtendido: number;

  // Descriptive / Informational Row Flag (e.g. Initial Term)
  isInfoRow?: boolean;

  // Fast Track Audit Promo Fields
  isFastTrackPromo?: boolean;
  originalNetCiscoUnit?: number;
  fastTrackDiscountPct?: number;
  fastTrackSavings?: number;
}

export interface ProcessedEstimateResult {
  fileName: string;
  headerInfo: EstimateHeaderInfo;
  items: EstimateLineItem[];
  originalProductTotal: number;
  calculatedProductTotal: number;
  serviceTotal: number;
  subscriptionTotal: number;
  finalTotalPrice: number;
  headerRowIndex: number;
  workbookBuffer?: ArrayBuffer;
}

export interface UserSession {
  username: string;
  full_name: string;
  role: Role;
  email?: string;
}

export interface UserRecord {
  id?: string;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: number | boolean;
  created_at?: string;
  last_login?: string;
}

export interface DashboardMetrics {
  kpis: {
    total_estimates: number;
    total_revenue: number;
    total_profit: number;
    total_recargo: number;
    avg_margin_pct: number;
  };
  partner_breakdown: Record<string, { count: number; revenue: number; profit: number }>;
  client_breakdown: Record<string, { count: number; revenue: number; profit: number }>;
  recent_estimates: EstimateRecord[];
}

export interface EstimateRecord {
  id?: string;
  user_id?: string;
  username?: string;
  full_name?: string;
  estimate_id_cisco: string;
  deal_id?: string;
  partner_name: string;
  client_final_name: string;
  original_filename: string;
  stored_filepath?: string;
  net_cisco_total: number;
  total_cotizado_intcomex: number;
  recargo_reglas_usd?: number;
  ganancia_intcomex_usd: number;
  items_count?: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  details: string;
  created_at: string;
}
