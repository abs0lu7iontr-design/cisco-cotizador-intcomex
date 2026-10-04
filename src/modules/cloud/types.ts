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

export interface EstimateAccessRequest {
  username: string;
  fullName: string;
  role?: string;
  requestedAt: string; // ISO 8601 string
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CloudEstimateRecord {
  id?: string;
  dealId: string;
  estimateId: string;
  partnerName: string;
  clientFinalName: string;
  modelName?: string;
  originalFileName: string;
  createdAt: string; // ISO 8601 string
  updatedAt?: string; // ISO 8601 string
  creator: CloudCreatorInfo;
  financialSummary: CloudFinancialSummary;
  headerInfo: EstimateHeaderInfo;
  itemsCount: number;
  
  // Products and manual overrides preservation
  items: CloudEstimateItem[];
  customOverrideMap: Record<number, OverrideRuleType>;
  fastTrackPromoMap?: Record<number, number>;

  // Visibility & Access Control (Shared by default; manual restriction & permission request flow)
  isRestricted?: boolean;
  allowedUsers?: string[];
  accessRequests?: EstimateAccessRequest[];
  syncedToCloud?: boolean;

  // Multi-Version System (v0 Raw Original vs v1..vN Calculated Iterations)
  activeVersion?: number; // e.g. 0 for RAW, 1 for initial calc, 2+ for recalcs
  activeVersionTag?: string; // 'v0', 'v1', 'v2', etc.
  baselineV0Amount?: number; // Inmutable Net Cisco baseline cost from v0
  currentAmount?: number; // Active quoted total with margins
  versionsCount?: number;
  versionsSummary?: EstimateVersionSummary[];
}

export interface EstimateVersionSummary {
  versionNumber: number; // 0, 1, 2, ...
  versionTag: string; // 'v0', 'v1', 'v2'
  type: 'ORIGINAL_RAW' | 'EDITED';
  totalAmount: number; // Cotizado Intcomex
  netCiscoTotal: number; // Costo Neto Cisco
  marginPct: number;
  internacionPct?: number;
  arancelPct?: number;
  itemsCount: number;
  createdAt: string; // ISO 8601 string
  creatorUsername?: string;
  creatorFullName?: string;
  originalFileName?: string;
  note?: string;
}

export interface EstimateVersionDetail extends EstimateVersionSummary {
  id?: string; // e.g. 'v0', 'v1'
  estimateId: string;
  items: CloudEstimateItem[];
  customOverrideMap?: Record<number, OverrideRuleType>;
  fastTrackPromoMap?: Record<number, number>;
  headerInfo?: EstimateHeaderInfo;
}

export interface EstimateVersionInfo {
  exists: boolean;
  activeVersion: number;
  activeVersionTag: string;
  nextVersionNumber: number;
  nextVersionTag: string;
  baselineV0Amount: number;
  currentAmount: number;
  versionsCount: number;
  versionsSummary: EstimateVersionSummary[];
  docId: string;
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