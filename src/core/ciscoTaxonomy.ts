// ============================================================================
// CISCO AUTOMATED v2.1 - CISCO TAXONOMY & CLASSIFIER UTILITY
// ============================================================================

// Exclusión y detección de servicios y contratos de soporte técnico Cisco
// Cubre: SmartNet (CON-SNT, CON-SNTP, SNT-), Cisco CX (CX-, CXE-, CXS-), Software Support (SVS-),
// Advanced Services (AS-, ASF-), High Touch (HT-, HTS-), Service Provider (SP-, SPA-) y educación/training.
const CISCO_SERVICE_REGEX = /^(CON|CX|CXE|CXS|SVS|AS|ASF|HT|HTS|SP|SPA|SOL|TRN|EDU)-|^SNT-/i;

// 1. Prefijos oficiales de familias SaaS, Cloud, suscripción y licenciamiento Cisco
// Cubre: Meraki (LIC-), Webex/Flex (A-FLEX-, A-SPK-, A-WX-), Duo, Umbrella (UMB-),
// ThousandEyes (TE-), Intersight (IS-), CDO, AppDynamics (APPD-), FSO, DCN, ACI,
// Cisco ONE (C1- y prefijos C1), Spaces (SPACES-), Network Term (NETWORK-), Subscriptions (SUB-),
// AnyConnect (AC-), ISE, AMP, ESA, SMA, e-Delivery (L-) y Software Subscription (S-)
const CISCO_LICENSE_PREFIX_REGEX =
  /^(LIC|A-FLEX|A-SPK|A-WX|DUO|UMB|TE|IS|CDO|APPD|FSO|DCN|ACI|SF|SEC|AC|ISE|AMP|ESA|SMA|NETWORK|SPACES|SUB)-|^C1(-|[A-Z0-9])|^L-(LIC|ISE|AC|FPR|ASA)|^S-(SW|SUB)/i;

// 2. Infijos y sufijos de licenciamiento por término
// Cubre: -DNA-, -CAT- (Catalyst Center), -SUB-, -TERM-, -LIC, -SAAS y vigencias multianuales (1Y, 3Y, 5Y, 7Y)
const CISCO_LICENSE_INFIX_SUFFIX_REGEX =
  /(-DNA-|-CAT-|-SUB-|-TERM-|-SUB$|-LIC$|-TERM$|-SAAS$|-(1|2|3|4|5|7)Y(R)?(-[A-Z0-9]+)?$)/i;

/**
 * Identifica si un Part Number o descripción corresponde a un Servicio de Soporte Cisco (SmartNet / CX / SVS).
 */
export function isCiscoServiceSku(sku: string, description: string = ''): boolean {
  const normSku = String(sku || '').trim().toUpperCase();
  const normDesc = String(description || '').trim().toUpperCase();

  if (CISCO_SERVICE_REGEX.test(normSku) || normSku.includes('-SNT') || normSku.startsWith('SNT-')) {
    return true;
  }

  const serviceKeywords = [
    'SMARTNET',
    'SNTC',
    'SOFTWARE SUPPORT SERVICE',
    'SOLUTION SUPPORT',
    'SUPPORT SERVICE',
    'PARTNER SUPPORT',
  ];
  if (serviceKeywords.some((kw) => normDesc.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Identifica de forma universal si un Part Number o descripción corresponde a
 * una Licencia, Suscripción SaaS o Term License de Cisco.
 */
export function isCiscoLicenseSku(sku: string, description: string = '', durationMonths: number = 0): boolean {
  const normSku = String(sku || '').trim().toUpperCase();
  const normDesc = String(description || '').trim().toUpperCase();

  // Si es un contrato de soporte técnico/servicios, se clasifica como servicio, no como licencia de software
  if (isCiscoServiceSku(normSku, normDesc)) {
    return false;
  }

  // Coincidencia por prefijo oficial de familia SaaS / Cloud / Cisco ONE
  if (CISCO_LICENSE_PREFIX_REGEX.test(normSku)) {
    return true;
  }

  // Coincidencia por infijo Catalyst/DNA o sufijo temporal
  if (CISCO_LICENSE_INFIX_SUFFIX_REGEX.test(normSku)) {
    return true;
  }

  // Respaldo por descriptores de licenciamiento
  const licKeywords = [
    'SUBSCRIPTION',
    'TERM LICENSE',
    'DNA ESSENTIALS',
    'DNA ADVANTAGE',
    'CLOUD LICENSE',
    'SAAS',
    'CISCO ONE',
    'DATA CENTER NETWORKING',
    'DCN',
    'NETWORKING ESSENTIALS',
    'NETWORKING ADVANTAGE',
    'ESSENTIALS TERM',
    'ADVANTAGE TERM',
    'PREMIER TERM',
  ];
  if (licKeywords.some((kw) => normDesc.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Determina si el SKU es un Intangible (Servicio o Licencia/Suscripción) exento de costos aduaneros de internación.
 */
export function isCiscoIntangibleSku(sku: string, description: string = '', durationMonths: number = 0): boolean {
  return isCiscoServiceSku(sku, description) || isCiscoLicenseSku(sku, description, durationMonths);
}
