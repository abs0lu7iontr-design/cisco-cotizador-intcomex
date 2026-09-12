// ============================================================================
// CISCO AUTOMATED v2.1 - MIME EML MULTIPART DECODER & ATTACHMENT EXTRACTOR
// ==========================================

import { ExtractedAddress } from './types';

// ==========================================
// 1. UTILITARIOS DECODIFICADORES MIME UTF-8
// ==========================================

export function decodeBase64ToUtf8(base64Str: string): string {
  try {
    const cleanB64 = base64Str.replace(/[\r\n\s]/g, '');
    const binary = atob(cleanB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return atob(base64Str.replace(/[\r\n\s]/g, ''));
    } catch {
      return '';
    }
  }
}

export function decodeQuotedPrintable(input: string): string {
  const raw = input.replace(/=(?:\r\n|\r|\n)/g, '');
  const bytes: number[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '=' && i + 2 < raw.length && /^[0-9A-Fa-f]{2}$/.test(raw.substring(i + 1, i + 3))) {
      bytes.push(parseInt(raw.substring(i + 1, i + 3), 16));
      i += 3;
    } else {
      bytes.push(raw.charCodeAt(i));
      i++;
    }
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return raw;
  }
}

export function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|td|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Recorre todas las partes de un correo .eml (multipart)
 * decodificando el texto en Base64 o Quoted-Printable.
 */
export function extractDecodedEmailBody(rawEml: string): string {
  const boundaryMatch = rawEml.match(/boundary=["']?([^"';\r\n]+)["']?/i);
  const textParts: string[] = [];

  const decodeBodyPart = (headerBlock: string, bodyBlock: string): string => {
    const cteMatch = headerBlock.match(/Content-Transfer-Encoding:\s*([^\s;\r\n]+)/i);
    const encoding = cteMatch ? cteMatch[1].toLowerCase() : '7bit';

    const ctMatch = headerBlock.match(/Content-Type:\s*([^;\r\n]+)/i);
    const contentType = ctMatch ? ctMatch[1].toLowerCase() : 'text/plain';

    if (!contentType.includes('text/') && !contentType.includes('html')) {
      return '';
    }

    if (encoding === 'base64') {
      return decodeBase64ToUtf8(bodyBlock);
    } else if (encoding === 'quoted-printable') {
      return decodeQuotedPrintable(bodyBlock);
    }
    return bodyBlock;
  };

  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = rawEml.split('--' + boundary);

    for (const part of parts) {
      if (!part.trim() || part.trim() === '--') continue;

      const sepIndex = part.indexOf('\n\n') !== -1 ? part.indexOf('\n\n') : part.indexOf('\r\n\r\n');
      const sepLen = part.indexOf('\r\n\r\n') !== -1 ? 4 : 2;

      if (sepIndex !== -1) {
        const header = part.substring(0, sepIndex);
        const body = part.substring(sepIndex + sepLen);

        // Soporte para multipart anidado (ej. alternative dentro de mixed)
        const nestedBoundaryMatch = header.match(/boundary=["']?([^"';\r\n]+)["']?/i);
        if (nestedBoundaryMatch) {
          const nestedBoundary = nestedBoundaryMatch[1].trim();
          const nestedParts = body.split('--' + nestedBoundary);
          for (const np of nestedParts) {
            const nSep = np.indexOf('\n\n') !== -1 ? np.indexOf('\n\n') : np.indexOf('\r\n\r\n');
            const nLen = np.indexOf('\r\n\r\n') !== -1 ? 4 : 2;
            if (nSep !== -1) {
              textParts.push(decodeBodyPart(np.substring(0, nSep), np.substring(nSep + nLen)));
            }
          }
        } else {
          textParts.push(decodeBodyPart(header, body));
        }
      }
    }
  } else {
    // Correo de una sola parte
    const sepIndex = rawEml.indexOf('\n\n') !== -1 ? rawEml.indexOf('\n\n') : rawEml.indexOf('\r\n\r\n');
    const sepLen = rawEml.indexOf('\r\n\r\n') !== -1 ? 4 : 2;
    if (sepIndex !== -1) {
      textParts.push(decodeBodyPart(rawEml.substring(0, sepIndex), rawEml.substring(sepIndex + sepLen)));
    } else {
      textParts.push(rawEml);
    }
  }

  const combined = textParts.join('\n');
  return stripHtmlToPlainText(combined);
}

// ==========================================
// 2. PARSER CARPETA CISCO
// ==========================================

export interface ParsedCiscoEml {
  dealId: string | null;
  bomAttachment?: {
    fileName: string;
    buffer: ArrayBuffer;
  };
  address?: ExtractedAddress;
  dateHeaderTimestamp?: number;
}

export function parseCiscoEml(rawEml: string, fileName?: string): ParsedCiscoEml {
  let dealId: string | null = null;
  let bomAttachment: { fileName: string; buffer: ArrayBuffer } | undefined;

  // 1. Extraer adjunto x_Cisco-Deal-BOM-Pricing-Details.xls
  const bomMimeRegex = /Content-(?:Type|Disposition):[\s\S]*?(?:name|filename)=["']?([^"';\r\n]*_Cisco-Deal-BOM-Pricing-Details\.xlsx?)["']?[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|\r?\n\r?\n[A-Z][a-zA-Z-]+:|$)/i;
  let bomMatch = rawEml.match(bomMimeRegex);

  // Fallback si Content-Transfer-Encoding va antes de name/filename
  if (!bomMatch) {
    bomMatch = rawEml.match(
      /Content-Transfer-Encoding:\s*base64[\s\S]*?(?:name|filename)=["']?([^"';\r\n]*_Cisco-Deal-BOM-Pricing-Details\.xlsx?)["']?[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|\r?\n\r?\n[A-Z][a-zA-Z-]+:|$)/i
    );
  }

  // Fallback para cualquier archivo Excel adjunto
  if (!bomMatch) {
    bomMatch = rawEml.match(
      /(?:name|filename)=["']?([^"';\r\n]*\.(?:xls|xlsx|xlsm))["']?[\s\S]*?Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=--|$)/i
    );
  }

  if (bomMatch) {
    const attachmentName = bomMatch[1].trim();
    const base64Data = bomMatch[2].replace(/[\r\n\s]/g, '');

    // Extraer Deal ID directo del nombre del BOM
    const dealMatch = attachmentName.match(/\b(\d{8})\b/);
    if (dealMatch && !dealMatch[1].startsWith('202')) {
      dealId = dealMatch[1];
    }

    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      bomAttachment = {
        fileName: attachmentName,
        buffer: bytes.buffer,
      };
    } catch (e) {
      console.error('Error al decodificar Base64 del BOM adjunto:', e);
    }
  }

  // 2. Decodificar el cuerpo completo del correo
  const decodedBody = extractDecodedEmailBody(rawEml);

  // Respaldo de Deal ID en el cuerpo
  if (!dealId) {
    const dealInBody = decodedBody.match(/\b(?:DEAL(?:\s*ID)?|ACUERDO)[\s:#=]+(\d{8})\b/i);
    if (dealInBody && !dealInBody[1].startsWith('202')) {
      dealId = dealInBody[1];
    }
  }

  // Respaldo de Deal ID por nombre de archivo si no vino en el BOM ni cuerpo
  if (!dealId && fileName) {
    dealId = extractHighestDealId(fileName);
  }

  // Fallback si hay números de 8 dígitos en el texto decodificado que no sean fechas
  if (!dealId) {
    const textDeals = [...decodedBody.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
      .map((m) => m[1])
      .filter((id) => !id.startsWith('202'));
    if (textDeals.length > 0) {
      dealId = Math.max(...textDeals.map((n) => parseInt(n, 10))).toString();
    }
  }

  // 3. Extraer Dirección desde "End Customer Address:"
  let address: ExtractedAddress | undefined;
  const addrRegex = /End\s*Customer\s*Address\s*:?\s*([\s\S]*?)(?=(?:End\s*Customer|Shipping|Billing|Reseller|Order|Line|Item|\n\s*\n|$))/i;
  const addrMatch = decodedBody.match(addrRegex);

  if (addrMatch) {
    const rawAddr = addrMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(', ');

    if (rawAddr.length > 3) {
      address = {
        street: rawAddr,
        city: 'Santiago',
        country: 'Chile',
      };
    }
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

// ==========================================
// 3. PARSER CARPETA JORGE
// ==========================================

export interface ParsedJorgeEml {
  dealId: string | null;
  poNumber: string | null;
  soNumber: string | null;
  dateHeaderTimestamp?: number;
}

export function parseJorgeEml(rawEml: string, fileName?: string): ParsedJorgeEml {
  // 1. Obtener cuerpo decodificado de Base64/Quoted-Printable/HTML
  const cleanBody = extractDecodedEmailBody(rawEml);

  // 2. Extraer DEAL ID (8 dígitos, no debe empezar con '202' para no confundir con fechas)
  // Soporta: "comprado según deal 86146758", "DEAL: 86146758", "DEAL ID: 86146758"
  let dealId: string | null = null;
  const dealRegex = /\b(?:DEAL(?:\s*ID)?|ACUERDO)[\s:#=]+(\d{8})\b/gi;
  const dealMatches = [...cleanBody.matchAll(dealRegex)]
    .map((m) => m[1])
    .filter((id) => !id.startsWith('202')); // Descartar fechas como 20260911

  if (dealMatches.length > 0) {
    dealId = Math.max(...dealMatches.map((n) => parseInt(n, 10))).toString();
  }

  // Respaldo de Deal ID por nombre de archivo
  if (!dealId && fileName) {
    dealId = extractHighestDealId(fileName);
  }

  // Fallback si hay números de 8 dígitos en el texto decodificado que no sean fechas
  if (!dealId) {
    const textDeals = [...cleanBody.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
      .map((m) => m[1])
      .filter((id) => !id.startsWith('202'));
    if (textDeals.length > 0) {
      dealId = Math.max(...textDeals.map((n) => parseInt(n, 10))).toString();
    }
  }

  // 3. Extraer PO (Exactamente 6 dígitos)
  // Soporta: "PO 329099", "PO: 329099", "P.O. 329099", "Purchase Order 329099"
  let poNumber: string | null = null;
  const poMatch = cleanBody.match(/(?:\bPO|\bP\.O\.|\bPurchase\s*Order|\bOrden\s*de\s*Compra)[\s:#=]+(\d{6})\b/i);
  if (poMatch) {
    poNumber = poMatch[1];
  }

  // 4. Extraer SO (Exactamente 9 dígitos)
  // Soporta: "SO 120608263", "SO: 120608263", "S.O. 120608263", "Sales Order 120608263"
  let soNumber: string | null = null;
  const soMatch = cleanBody.match(/(?:\bSO|\bS\.O\.|\bSales\s*Order|\bPedido|\bOrden\s*de\s*Venta)[\s:#=]+(\d{9})\b/i);
  if (soMatch) {
    soNumber = soMatch[1];
  }

  // 5. Extracción de cabecera Date
  let dateHeaderTimestamp: number | undefined;
  const dateMatch = rawEml.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    const parsedDate = Date.parse(dateMatch[1]);
    if (!isNaN(parsedDate)) dateHeaderTimestamp = parsedDate;
  }

  return { dealId, poNumber, soNumber, dateHeaderTimestamp };
}

/**
 * Resuelve el Deal ID más alto de 8 dígitos presente en un texto o nombre de archivo,
 * descartando secuencias que comiencen con '202' (fechas como 20260911).
 */
export function extractHighestDealId(text: string): string | null {
  if (!text) return null;
  const matches = [...text.matchAll(/(?:^|\D)(\d{8})(?!\d)/g)]
    .map((m) => m[1])
    .filter((id) => !id.startsWith('202'))
    .map((id) => parseInt(id, 10))
    .filter((n) => !isNaN(n) && String(n).length === 8);

  if (matches.length === 0) return null;
  return Math.max(...matches).toString();
}

/**
 * Función unificada para retrocompatibilidad
 */
export function parseEmlContent(
  rawEml: string,
  fileName: string = ''
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
