// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL AUDIT MODULE: TYPES
// ============================================================================

export type LineCategory = 
  | 'PRODUCT' 
  | 'SUBSCRIPTION' 
  | 'SMARTNET_SNT' 
  | 'SOLUTION_SUPPORT' 
  | 'SUCCESS_TRACK' 
  | 'OTHER_SERVICE' 
  | 'UNKNOWN';

export type IotStatus = 'YES' | 'NO' | 'UNKNOWN';

export type AuditFindingLevel = 'INFO' | 'WARNING' | 'OPPORTUNITY' | 'UNRESOLVED';

export interface CommercialTier {
  minUsd: number;
  maxUsd: number;
  discountPct: number;
  tag?: string;
}

export interface AccountConditionRule {
  groupId: number;
  groupName: string;
  verifiedAliases: string[];
  productTiers: CommercialTier[];
  subscriptionDiscountPct?: number;
  iotSubscriptionDiscountPct?: number;
  iotProductTiers?: CommercialTier[];
  solutionSupportDiscountPct?: number; // 55% solo si está explícitamente informado
  sntContractualRequired: boolean;
}

export interface AuditedLineItem {
  lineNumber: string;
  partNumber: string;
  description: string;
  category: LineCategory;
  iotStatus: IotStatus;
  unitListPrice: number;
  unitNetPrice: number;
  observedDiscountPct: number;
  calculatedDiscountPct: number | null;
  expectedDiscountPct: number | null;
  differencePct: number | null;
  status: 'MATCH' | 'MISMATCH' | 'CONTRACT_CHECK_REQUIRED' | 'UNCONFIGURED' | 'MANUAL_REVIEW';
  notes: string;
}

export interface AuditReport {
  timestamp: string;
  bomFingerprint: string;
  customerNameRaw: string;
  matchedAccount: AccountConditionRule | null;
  identificationSource: 'HEADER_CUSTOMER' | 'HEADER_COMPANY' | 'FILE_NAME' | 'MANUAL_SELECTION' | 'DEAL_NAME' | 'NONE';
  lines: AuditedLineItem[];
  sntOpportunityCount: number;
  hasUnconfiguredTiers: boolean;
  overallStatus: 'COMPLIANT' | 'REQUIRES_REVIEW' | 'NOT_EVALUABLE' | 'NO_RULES';
  summaryObservations: string[];
}
