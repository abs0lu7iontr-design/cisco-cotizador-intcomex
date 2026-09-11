// ============================================================================
// CISCO AUTOMATED v2.1 - CISCO TAXONOMY & CLASSIFIER UTILITY
// ============================================================================

// Exclusión inmediata de servicios de soporte para evitar falsos positivos
const CISCO_SERVICE_REGEX = /^(CON|CX|CXE|CXS|SVS|AS|ASF|HT|HTS|SP|SPA|SOL|TRN|EDU)-/i;

// 1. Prefijos oficiales de familias SaaS, Cloud y suscripción Cisco
// Cubre: Meraki (LIC-), Webex/Flex (A-FLEX-, A-SPK-, A-WX-), Duo, Umbrella (UMB-),
// ThousandEyes (TE-), Intersight (IS-), CDO, AppDynamics (APPD-), FSO, DCN, ACI,
// AnyConnect (AC-), ISE, AMP, ESA, SMA, e-Delivery (L-) y Software Subscription (S-)
const CISCO_LICENSE_PREFIX_REGEX = /^(LIC|A-FLEX|A-SPK|A-WX|DUO|UMB|TE|IS|CDO|APPD|FSO|DCN|ACI|SF|SEC|AC|ISE|AMP|ESA|SMA)-|^L-(LIC|ISE|AC|FPR|ASA)|^S-(SW|SUB)/i;

// 2. Infijos y sufijos de licenciamiento por término
// Cubre: -DNA-, -CAT- (Catalyst Center), -SUB-, -TERM-, -LIC, -SAAS y vigencias multianuales (1Y, 3Y, 5Y, 7Y)
const CISCO_LICENSE_INFIX_SUFFIX_REGEX = /(-DNA-|-CAT-|-SUB-|-TERM-|-SUB$|-LIC$|-TERM$|-SAAS$|-(1|2|3|4|5|7)Y(R)?(-[A-Z0-9]+)?$)/i;

/**
 * Identifica de forma universal si un Part Number o descripción corresponde a
 * una Licencia, Suscripción SaaS o Term License de Cisco.
 */
export function isCiscoLicenseSku(sku: string, description: string = '', durationMonths: number = 0): boolean {
  const normSku = String(sku || '').trim().toUpperCase();
  const normDesc = String(description || '').trim().toUpperCase();

  // Si es un contrato de soporte técnico/servicios, se excluye
  if (CISCO_SERVICE_REGEX.test(normSku)) {
    return false;
  }

  // Coincidencia por prefijo oficial de familia SaaS
  if (CISCO_LICENSE_PREFIX_REGEX.test(normSku)) {
    return true;
  }

  // Coincidencia por infijo Catalyst/DNA o sufijo temporal
  if (CISCO_LICENSE_INFIX_SUFFIX_REGEX.test(normSku)) {
    return true;
  }

  // Respaldo por duración activa y descriptores de licenciamiento
  if (durationMonths > 0) {
    const licKeywords = ['SUBSCRIPTION', 'TERM LICENSE', 'DNA ESSENTIALS', 'DNA ADVANTAGE', 'CLOUD LICENSE', 'SAAS'];
    if (licKeywords.some(kw => normDesc.includes(kw))) {
      return true;
    }
  }

  return false;
}
