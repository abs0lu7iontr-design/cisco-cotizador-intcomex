// ============================================================================
// CISCO AUTOMATED v2.1 - EML EMAIL & METADATA PARSER
// ============================================================================

import { ExtractedAddress } from './types';

// Regex estrictos para Deal ID (8 dígitos exactos sin colindancia numérica)
const DEAL_ID_GLOBAL_REGEX = /(?:^|\D)(\d{8})(?!\d)/g;
const PO_STRICT_REGEX = /(?:p\.?o\.?|orden\s*de\s*compra|purchase\s*order)[\s:#_-]*(\d{6})(?!\d)/i;
const SO_STRICT_REGEX = /(?:s\.?o\.?|sales\s*order|pedido|orden\s*de\s*venta)[\s:#_-]*(\d{9})(?!\d)/i;

const ADDRESS_REGEX = /(?:install\s*site\s*address|end\s*customer\s*address|site\s*address|direcci[oó]n)[\s:#]+([^\r\n]+)/i;
const CITY_REGEX = /(?:city|ciudad)[\s:#]+([^\r\n,]+)/i;
const COUNTRY_REGEX = /(?:country|pa[ií]s)[\s:#]+([^\r\n,]+)/i;

/**
 * Resuelve el Deal ID más alto de 8 dígitos presente en un texto o nombre de archivo.
 */
export function extractHighestDealId(text: string): string | null {
  if (!text) return null;
  const matches = [...text.matchAll(DEAL_ID_GLOBAL_REGEX)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => !isNaN(n) && String(n).length === 8);

  if (matches.length === 0) return null;
  return Math.max(...matches).toString();
}

/**
 * Parsea el contenido en texto de un archivo .eml
 */
export function parseEmlContent(
  rawEml: string,
  fileName: string
): {
  dealId: string | null;
  poNumber: string | null;
  soNumber: string | null;
  address?: ExtractedAddress;
  dateHeaderTimestamp?: number;
} {
  // 1. Resolver Deal ID priorizando Nombre -> Asunto -> Cuerpo (siempre el mayor)
  const dealFromName = extractHighestDealId(fileName);
  const dealFromBody = extractHighestDealId(rawEml);

  const dealCandidates = [dealFromName, dealFromBody]
    .filter((d): d is string => d !== null)
    .map((d) => parseInt(d, 10));

  const finalDealId = dealCandidates.length > 0 ? Math.max(...dealCandidates).toString() : null;

  // 2. Extracción de PO (6 dígitos exactos)
  const poMatch = rawEml.match(PO_STRICT_REGEX);
  const poNumber = poMatch ? poMatch[1] : null;

  // 3. Extracción de SO (9 dígitos exactos)
  const soMatch = rawEml.match(SO_STRICT_REGEX);
  const soNumber = soMatch ? soMatch[1] : null;

  // 4. Extracción de Dirección
  let address: ExtractedAddress | undefined;
  const addrMatch = rawEml.match(ADDRESS_REGEX);
  const cityMatch = rawEml.match(CITY_REGEX);
  const countryMatch = rawEml.match(COUNTRY_REGEX);

  if (addrMatch) {
    address = {
      street: addrMatch[1].trim(),
      city: cityMatch ? cityMatch[1].trim() : 'Santiago',
      country: countryMatch ? countryMatch[1].trim() : 'Chile',
    };
  }

  // 5. Extracción opcional de la cabecera Date del correo
  let dateHeaderTimestamp: number | undefined;
  const dateMatch = rawEml.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    const parsedDate = Date.parse(dateMatch[1]);
    if (!isNaN(parsedDate)) dateHeaderTimestamp = parsedDate;
  }

  return { dealId: finalDealId, poNumber, soNumber, address, dateHeaderTimestamp };
}
