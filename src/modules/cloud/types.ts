// ============================================================================
// CISCO AUTOMATED - CLOUD STORAGE & SHARED HISTORY TYPES (FIRESTORE NoSQL)
// ============================================================================

import {
  EstimateHeaderInfo,
  EstimateLineItem,
  QuoteParameters,
  OverrideRuleType,
  UserSession,
  Role,
} from '../../core/types';
import { Dsv48LineItem, SkuCategoryType } from '../dsv/types';

export interface CloudCreatorInfo {
  username: string;
  fullName: string;
  role: string;
  email?: string;
}

export interface CloudFinancialSummary {
  totalNetCisco: number;
  totalCotizadoIntcomex: number;
  gananciaIntcomexUsd: number;
  margenPct: number;
  currency: string;
  params: QuoteParameters;
}

export interface CloudEstimateItem {
  rowIdx: number;
  lineNumber: string;
  partNumber: string;
  description: string;
  qty: number;
  unitListPrice: number;
  netCiscoUnit: number;
  discPct: number;
  transformedLeadTime: string;
  
  // Classification & Override State (Critical for restoration)
  overrideType?: OverrideRuleType;
  isIntangible: boolean;
  llevaArancel: boolean;
  costoInternacion: number;
  costoArancel: number;
  costoTotalUnitario: number;
  precioVentaUnitario: number;
  precioVentaExtendido: number;

  // Fast Track fields
  isFastTrackPromo?: boolean;
  originalNetCiscoUnit?: number;
  fastTrackDiscountPct?: number;
  fastTrackSavings?: number;
}

export interface CloudEstimateRecord {
  id?: string;
  dealId: string;
  estimateId: string;
  partnerName: string;
  clientFinalName: string;
  originalFileName: string;
  createdAt: string; // ISO 8601 string
  creator: CloudCreatorInfo;
  financialSummary: CloudFinancialSummary;
  headerInfo: EstimateHeaderInfo;
  itemsCount: number;
  
  // Products and manual overrides preservation
  items: CloudEstimateItem[];
  customOverrideMap: Record<number, OverrideRuleType>;
  fastTrackPromoMap?: Record<number, number>;
}

export interface CloudDsvRecord {
  id?: string;
  dealId: string;
  soNumber: string;
  poNumber: string;
  partnerId: string;
  resellerName: string;
  endCustomerName: string;
  endCustomerAddress: string;
  originalFileName: string;
  createdAt: string; // ISO 8601 string
  creator: CloudCreatorInfo;
  
  financialSummary: {
    totalReportedNetPrice: number;
    totalItems: number;
    discardedZeroItems: number;
  };
  
  items: Dsv48LineItem[];
  overrides: Record<string, SkuCategoryType>;
}

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface CloudUserRecord {
  id?: string;
  username: string;
  full_name: string;
  email: string;
  role: Role | string;
  password_hash: string;
  is_active: number; // 1 = active, 0 = disabled/expired
  created_at: string;
  last_login?: string;
  updated_at?: string;
}

export interface SharedSkuOverrideRecord {
  id?: string;
  sku: string;
  rule: OverrideRuleType; // 'HW' | 'INTANGIBLE' | 'ARANCEL'
  previousType?: string;
  note?: string;
  author: {
    username: string;
    fullName: string;
    role: string;
  };
  updatedAt: string;
  createdAt: string;
}

export interface SharedSkuPackageRecord {
  id?: string;
  title: string;
  description?: string;
  author: {
    username: string;
    fullName: string;
    role: string;
  };
  rules: SharedSkuOverrideRecord[];
  totalRules: number;
  createdAt: string;
  updatedAt: string;
}