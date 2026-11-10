// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R QUOTE PARA SERVICIOS & LICENCIAS
// Tipos y Modelos de Datos para Cisco Commerce Workspace - Renewals (CCW-R)
// ============================================================================

export interface CcwrHeaderInfo {
  quoteNumber: string;
  quoteName?: string;
  quoteDate?: string;
  priceProtectionExpiryDate?: string;
  buyMethod?: string;
  quoteNetAmount?: number;
  resellerNetAmount?: number;
  quoteExtendedListPrice?: number;
  dealId?: string;
  endCustomerGuId?: string;
  endCustomerGuName?: string;
  endCustomerId?: string;
  endCustomerName?: string;
  endCustomerAddressLine1?: string;
  endCustomerAddressLine2?: string;
  endCustomerCity?: string;
  endCustomerState?: string;
  endCustomerCountry?: string;
  shipToName?: string;
  servicePriceList?: string;
  contractNumber?: string;
}

export type CcwrLineOverrideType = 'intangible' | 'arancel' | 'equipo';

export interface CcwrLineItem {
  id: string;
  lineNumber: number;
  productNumber: string;
  productDescription: string;
  serialNumber: string;
  instanceNumber?: string;
  majorMinor?: string;
  serviceLevel: string;
  serviceLevelDescription: string;
  serviceSku: string;
  serviceType?: string;
  startDate: string;
  endDate: string;
  durationMonths?: number;
  quantity: number;
  unitListPrice: number;
  proratedListPrice: number;
  totalDiscounts: number;
  extendedNetPrice: number; // Columna Z de CCW-R (Costo Neto Intcomex)
  unitNetPrice: number;     // Extended Net Price / Quantity
  endCustomerId: string;
  endCustomerName: string;
  endCustomerAddress: string;

  // Clasificación y Cálculo Financiero
  isServiceOrLicense: boolean;
  overrideRule?: CcwrLineOverrideType;
  costoNetoUnitario: number;
  costoArancel: number;
  costoInternacion: number;
  costoTotalUnitario: number;
  precioVentaUnitario: number;
  precioVentaExtendido: number;
}

export interface CcwrQuoteParameters {
  margenPct: number;       // Margen comercial en porcentaje (ej: 8.8% o 5.0%)
  arancelPct: number;      // Arancel aduanero en porcentaje (por defecto 0% en servicios)
  internacionPct: number;  // Internación en porcentaje (por defecto 0% en intangibles)
  sellerName: string;      // Vendedor / PM responsable (ej: "Mauricio Skill")
  companyName: string;     // Empresa (ej: "INTCOMEX SA")
  companyAddress: string;  // Dirección (ej: "Rosario Norte 615, SANTIAGO")
  sellerPhone: string;     // Teléfono (ej: "Movil :+56 9 88226530")
}

export interface CcwrProductGroupSummary {
  productNumber: string;
  description: string;
  serviceSku: string;
  serviceLevel: string;
  itemCount: number;
  totalQty: number;
  unitNetCost: number;
  totalExtendedNetCost: number;
  unitSalePrice: number;
  totalSalePrice: number;
}

export interface CcwrFinancialSummary {
  totalItems: number;
  totalQuantity: number;
  uniqueSerialsCount: number;
  totalExtendedNetCost: number; // Suma de Col Z
  totalCostoArancel: number;
  totalCostoInternacion: number;
  totalCostoGeneral: number;
  totalPrecioVenta: number;
  margenBrutoUsd: number;
  margenBrutoPct: number;
  byProduct: CcwrProductGroupSummary[];
}

export interface ProcessedCcwrQuote {
  fileName: string;
  headerInfo: CcwrHeaderInfo;
  items: CcwrLineItem[];
  params: CcwrQuoteParameters;
  summary: CcwrFinancialSummary;
  processedAt: string;
}

export const DEFAULT_CCWR_PARAMS: CcwrQuoteParameters = {
  margenPct: 5.0,
  arancelPct: 0.0,
  internacionPct: 0.0,
  sellerName: 'Mauricio Skill',
  companyName: 'INTCOMEX SA',
  companyAddress: 'Rosario Norte 615, SANTIAGO',
  sellerPhone: 'Movil :+56 9 88226530',
};
