// ============================================================================
// CISCO AUTOMATED v2.13.0 - DEMAND & STOCK INTELLIGENCE TYPES
// Cross-modular demand aggregation: BO Tracking, Forecast, Pipeline, Estimates & CCW-R
// ============================================================================

export type SkuCategory = 'hardware' | 'license' | 'service' | 'accessory';

export type StockPriority = 'CRITICAL_STOCK' | 'GROWTH_OPPORTUNITY' | 'MADE_TO_ORDER' | 'NOT_APPLICABLE';

export interface StockRecommendation {
  priority: StockPriority;
  priorityLabel: string;
  suggestedUnits: number;
  rationale: string;
  estimatedUnitCostUsd: number;
  estimatedTotalInvestmentUsd: number;
  targetBodega: 'E1' | 'ED';
}

export interface SkuDemandItem {
  partNumber: string;
  description: string;
  category: SkuCategory;
  family: string;
  
  // Real Sales (Confirmed SO Cisco / Booked BO / Forecast Won)
  realSoldUnits: number;
  realSoldUsd: number;

  // Quoted Demand (Estimates History / Pipeline Open / CCW-R Active)
  quotedUnits: number;
  quotedUsd: number;

  // Aggregated Totals
  totalDemandUnits: number;
  totalDemandUsd: number;

  // Metrics
  conversionRatePct: number; // realSoldUnits / totalDemandUnits * 100
  ordersCount: number;       // Distinct transactions / estimates featuring this SKU
  avgUnitPriceUsd: number;

  // Procurement & Bodega E1 Advice
  stockRecommendation: StockRecommendation;
}

export interface CategoryDemandSummary {
  category: SkuCategory;
  categoryLabel: string;
  realSoldUnits: number;
  realSoldUsd: number;
  quotedUnits: number;
  quotedUsd: number;
  totalDemandUnits: number;
  totalDemandUsd: number;
  conversionRatePct: number;
}

export interface DemandIntelligenceSummary {
  totalHardwareSoldUsd: number;
  totalHardwareQuotedUsd: number;
  totalLicensesSoldUsd: number;
  totalLicensesQuotedUsd: number;
  overallConversionPct: number;
  totalSuggestedInvestmentUsd: number;
  totalSuggestedUnitsToStock: number;

  topHardwareItems: SkuDemandItem[];
  topLicenseItems: SkuDemandItem[];
  stockPlanItems: SkuDemandItem[];
  categoryBreakdown: CategoryDemandSummary[];

  sourcesStats: {
    boOrdersCount: number;
    forecastRecordsCount: number;
    pipelineDealsCount: number;
    estimatesCount: number;
    ccwrQuotesCount: number;
  };

  lastAnalyzedAt: string;
}
