// ============================================================================
// CISCO AUTOMATED - FAST TRACK MODULE TYPES
// ============================================================================

export interface FastTrackProduct {
  partNumber: string;         // Primary Key: Sanitized SKU (e.g., "C1121-4P")
  distributorDiscount: number;// Discount percentage (e.g., 68.5)
  description?: string;
  listPrice?: number;
  promoNetPrice?: number;
  category?: string;
  updatedAt: number;          // Timestamp
}

export interface FastTrackAuditMatch {
  rowIdx: number;
  lineNumber: string;
  partNumber: string;
  description: string;
  qty: number;
  unitListPrice: number;
  currentUnitNetPrice: number;
  currentDiscountPct: number;
  fastTrackDiscountPct: number;
  promoUnitNetPrice: number;
  unitSavings: number;
  totalSavings: number;
}

export interface FastTrackAuditResult {
  hasOpportunity: boolean;
  totalMatchedSkus: number;
  totalSavings: number;
  matches: FastTrackAuditMatch[];
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  validUntil?: number | null;
  validUntilFormatted?: string;
  validFrom?: number | null;
  validFromFormatted?: string;
  promotionCode?: string;
  promotionTitle?: string;
}

export interface FastTrackDbStats {
  isEnabled: boolean;
  totalSkus: number;
  lastUpdated: number | null;
  validUntil: number | null;
  validFrom: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  validUntilFormatted?: string;
  validFromFormatted?: string;
  fileName?: string;
  promotionCode?: string;
  promotionTitle?: string;
}
