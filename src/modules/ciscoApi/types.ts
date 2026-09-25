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
  standard?: '802.3af' | '802.3at' | '802.3bt' | 'Universal PoE (UPOE)' | 'No PoE';
  recommendedDefaultPsu?: string;
  secondaryPsuSku?: string;
  dualPsuMaxWatts?: number;
  notes?: string;
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
