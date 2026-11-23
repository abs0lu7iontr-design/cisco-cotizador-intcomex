// ============================================================================
// CISCO AUTOMATED - CISCO DEVELOPER API SUITE (7 ACTIVE SERVICES)
// Contratos de datos para OAuth2 M2M, PSIRT openVuln v2, Datafoundation-POE,
// HelloCommerce B2B Gateway y CX Cloud V2 (Inventory, Contracts, Alerts, Customer)
// ============================================================================

export interface CiscoOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  issued_at?: number;
}

export interface CiscoApiConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  gatewayBaseUrl?: string;
  cxCustomerId?: string;
  commerceEnvironment?: 'POE' | 'PROD';
}

export interface CiscoLeadTime {
  measurement: number;
  unitOfMeasure: string;
}

export interface CiscoGraphQLItem {
  sku: string;
  description: string;
  leadTime?: CiscoLeadTime;
}

export interface CiscoGraphQLLine {
  line: {
    configurationLineReference: {
      lineId: string | number;
      parentLineId: string | number;
      magicKey?: string;
    };
    item: CiscoGraphQLItem;
    quantity: {
      measurement: number;
      unitOfMeasure?: string;
    };
    financialDetails: {
      unitListPrice: { amount: number; currency?: string };
      discounts?: Array<{ rate: { measurement: number; unitOfMeasure?: string } }>;
      unitNetPrice: { amount: number; currency?: string };
      extendedNetPrice: { amount: number; currency?: string };
    };
  };
}

export interface CiscoGraphQLEstimate {
  id: string;
  name: string;
  estimateStatus: string;
  expirationDate?: string;
  priceList?: {
    code: string;
    description?: string;
    currencies?: string[];
  };
  lines: CiscoGraphQLLine[];
}

export interface PsirtAdvisory {
  advisoryId: string;
  advisoryTitle: string;
  sir: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational' | string;
  cves: string[];
  bugIDs?: string[];
  publicationUrl: string;
  firstPublished?: string;
  lastUpdated?: string;
  summary?: string;
  productNames?: string[];
}

export interface PoeBudgetInfo {
  partNumber: string;
  poeSupported: boolean;
  maxWatts: number;
  poePortsCount?: number;
  maxWattsPerPort?: number;
  poeClass?: string;
  standard?:
    | '802.3af'
    | '802.3at'
    | '802.3bt'
    | 'Universal PoE (UPOE)'
    | 'No PoE'
    | 'SKU Inexistente';
  recommendedDefaultPsu?: string;
  secondaryPsuSku?: string;
  dualPsuMaxWatts?: number;
  notes?: string;
  isNonExistentSku?: boolean;
  recommendedValidSku?: string;
  officialAlternatives?: { recommendedSku: string; title: string; description: string }[];
}

export interface CiscoApiHealthStatus {
  service: string;
  endpoint?: string;
  status: 'ONLINE' | 'OFFLINE' | 'TESTING' | 'REQUIRES_CUSTOMER_ID';
  httpStatus?: number;
  latencyMs?: number;
  message?: string;
  rateLimit?: string;
}

export interface CiscoSuiteDiagnosticReport {
  overallStatus: 'ONLINE' | 'PARTIAL' | 'OFFLINE';
  tokenInfo: {
    valid: boolean;
    clientIdMask: string;
    tokenType: string;
    expiresInSeconds: number;
    scope: string;
    transportMode: 'desktop_bridge' | 'cloudflare_edge_proxy' | 'direct_fetch';
    latencyMs: number;
  };
  services: CiscoApiHealthStatus[];
  sampleAdvisories?: PsirtAdvisory[];
  checkedAt: string;
}
