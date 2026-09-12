// ============================================================================
// CISCO AUTOMATED v2.1 - MIME EML PARSER & ATTACHMENT EXTRACTOR
// ============================================================================

import { ExtractedAddress } from './types';

// Decodificador de Quoted-Printable (=XX y soft line breaks) compatible con UTF-8
export function decodeQuotedPrintable(input: string): string {
  if (!input) return '';
  // Remover soft line breaks
  const normalized = input.replace(/=(?:\r\n|\r|\n)/g, '');

  try {
    // Decodificar secuencias continuas de bytes escapados (=XX) como UTF-8
    return normalized.replace(/(?:=[0-9A-Fa-f]{2})+/g, (match) => {
      const hexPairs = match.split('=').filter(Boolean);
      const bytes = new Uint8Array(hexPairs.map((hex) => parseInt(hex, 16)));
      return new TextDecoder('utf-8').decode(bytes);
    });
  } catch {
    // Fallback seguro a decodificación ASCII / ISO-8859-1
    return normalized.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  }
}

// Limpiador de HTML a texto plano normalizado
export function stripHtmlAndNormalize(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Convertidor de Base64 MIME a ArrayBuffer para el Excel .xls
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanBase64 = base64.replace(/[\r\n\s]/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface ParsedCiscoEml {
  dealId: string | null;
  bomAttachment?: {
    fileName: string;
    buffer: ArrayBuffer;
  };
  address?: ExtractedAddress;
  dateHeaderTimestamp?: number;
}

export interface ParsedJorgeEml {
  dealId: string | null;
  poNumber: string | null;
  soNumber: string | null;
  dateHeaderTimestamp?: number;
}

/**
 * Resuelve el Deal ID más alto de 8 dígitos presente en un texto o nombre de archivo.
 */
export function extractHighestDealId(text: string): string | null {
  if (!text) return null;
  const matches = [...text.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => !isNaN(n) && String(n).length === 8);

  if (matches.length === 0) return null;
  return Math.max(...matches).toString();
}

/**
 * Procesa un archivo .eml proveniente de la carpeta "cisco"
 */
export function parseCiscoEml(rawEml: string, fileName: string = ''): ParsedCiscoEml {
  let dealId: string | null = null;
  let bomAttachment: { fileName: string; buffer: ArrayBuffer } | undefined;

  // 1. Extraer el archivo adjunto [Deal]_Cisco-Deal-BOM-Pricing-Details.xls
  // Busca bloques MIME con el nombre de archivo específico y captura el Base64
  let bomMatch = rawEml.match(
    /(?:name|filename)="?([^"\r\n]*_Cisco-Deal-BOM-Pricing-Details\.xlsx?)"?[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|\r?\n\r?\n[A-Z][a-zA-Z-]+:|$)/i
  );

  if (!bomMatch) {
    bomMatch = rawEml.match(
      /Content-Transfer-Encoding:\s*base64[\s\S]*?(?:name|filename)="?([^"\r\n]*_Cisco-Deal-BOM-Pricing-Details\.xlsx?)"?[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|\r?\n\r?\n[A-Z][a-zA-Z-]+:|$)/i
    );
  }

  if (!bomMatch) {
    // Fallback general para cualquier Excel adjunto con nombre relevante
    bomMatch = rawEml.match(
      /(?:name|filename)="?([^"\r\n]*\.(?:xls|xlsx|xlsm))"?[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|$)/i
    );
  }

  if (bomMatch) {
    const attachmentFileName = bomMatch[1].trim();
    const base64Data = bomMatch[2];

    // Extrae el Deal ID (8 dígitos) desde el nombre del adjunto: x_Cisco-Deal-BOM...
    const dealMatch = attachmentFileName.match(/(?:^|\D)(\d{8})(?!\d)/);
    if (dealMatch) {
      dealId = dealMatch[1];
    }

    try {
      bomAttachment = {
        fileName: attachmentFileName,
        buffer: base64ToArrayBuffer(base64Data),
      };
    } catch (e) {
      console.error('Error al decodificar Base64 del BOM adjunto:', e);
    }
  }

  // 2. Extraer Dirección y Deal ID desde el texto decodificado
  const decodedText = stripHtmlAndNormalize(decodeQuotedPrintable(rawEml));

  // Respaldo de Deal ID en el nombre del archivo o en el texto si no vino en el adjunto
  if (!dealId && fileName) {
    dealId = extractHighestDealId(fileName);
  }

  if (!dealId) {
    const textDeals = [...decodedText.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => !isNaN(n) && String(n).length === 8);
    if (textDeals.length > 0) dealId = Math.max(...textDeals).toString();
  }

  // 3. Extracción de Dirección de Despacho
  let address: ExtractedAddress | undefined;
  const addressBlockRegex =
    /(?:End\s*Customer\s*Address|Install\s*Site\s*Address|Site\s*Address|Direcci[oó]n(?:\s*de\s*despacho|\s*de\s*entrega)?)\s*:?\s*([^\n\r]+(?:\n[^\n\r]+){0,2})/i;
  const addrMatch = decodedText.match(addressBlockRegex);

  if (addrMatch) {
    const fullAddr = addrMatch[1].replace(/\s+/g, ' ').trim();
    address = {
      street: fullAddr,
      city: 'Santiago',
      country: 'Chile',
    };
  }

  // 4. Extracción de cabecera Date
  let dateHeaderTimestamp: number | undefined;
  const dateMatch = rawEml.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    const parsedDate = Date.parse(dateMatch[1]);
    if (!isNaN(parsedDate)) dateHeaderTimestamp = parsedDate;
  }

  return { dealId, bomAttachment, address, dateHeaderTimestamp };
}

/**
 * Procesa un archivo .eml proveniente de la carpeta "jorge"
 */
export function parseJorgeEml(rawEml: string, fileName: string = ''): ParsedJorgeEml {
  const cleanText = stripHtmlAndNormalize(decodeQuotedPrintable(rawEml));

  // 1. DEAL X o DEAL ID X (exactamente 8 dígitos, toma el mayor si hay varios)
  const dealRegex = /\bDEAL(?:\s*ID)?[\s:#=_]+(\d{8})\b/gi;
  const dealMatches = [...cleanText.matchAll(dealRegex)].map((m) => parseInt(m[1], 10));
  let dealId = dealMatches.length > 0 ? Math.max(...dealMatches).toString() : null;

  // Respaldo de Deal ID por nombre de archivo o cualquier número de 8 dígitos en el texto
  if (!dealId && fileName) {
    dealId = extractHighestDealId(fileName);
  }

  if (!dealId) {
    const textDeals = [...cleanText.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => !isNaN(n) && String(n).length === 8);
    if (textDeals.length > 0) dealId = Math.max(...textDeals).toString();
  }

  // 2. PO X (exactamente 6 dígitos numéricos)
  const poRegex = /(?:\bPO|\bP\.O\.|\bPurchase\s*Order|\bOrden\s*de\s*Compra)[\s:#=_]+(\d{6})(?!\d)/i;
  const poMatch = cleanText.match(poRegex);
  const poNumber = poMatch ? poMatch[1] : null;

  // 3. SO X (exactamente 9 dígitos numéricos)
  const soRegex = /(?:\bSO|\bS\.O\.|\bSales\s*Order|\bPedido|\bOrden\s*de\s*Venta)[\s:#=_]+(\d{9})(?!\d)/i;
  const soMatch = cleanText.match(soRegex);
  const soNumber = soMatch ? soMatch[1] : null;

  // 4. Extracción de cabecera Date
  let dateHeaderTimestamp: number | undefined;
  const dateMatch = rawEml.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    const parsedDate = Date.parse(dateMatch[1]);
    if (!isNaN(parsedDate)) dateHeaderTimestamp = parsedDate;
  }

  return { dealId, poNumber, soNumber, dateHeaderTimestamp };
}

/**
 * Función unificada para retrocompatibilidad
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
  const cisco = parseCiscoEml(rawEml, fileName);
  const jorge = parseJorgeEml(rawEml, fileName);
  return {
    dealId: cisco.dealId || jorge.dealId,
    poNumber: jorge.poNumber,
    soNumber: jorge.soNumber,
    address: cisco.address,
    dateHeaderTimestamp: cisco.dateHeaderTimestamp || jorge.dateHeaderTimestamp,
  };
}
