// ============================================================================
// CISCO AUTOMATED - FAST TRACK EXCEL PARSER (.XLSX & .XLS)
// ============================================================================

import * as XLSX from 'xlsx';
import { FastTrackProduct } from './types';
import { sanitizePartNumberKey } from './fastTrackDb';

const MONTH_MAP: Record<string, number> = {
  jan: 0, ene: 0, january: 0, enero: 0,
  feb: 1, february: 1, febrero: 1,
  mar: 2, march: 2, marzo: 2,
  apr: 3, abr: 3, april: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, june: 5, junio: 5,
  jul: 6, july: 6, julio: 6,
  aug: 7, ago: 7, august: 7, agosto: 7,
  sep: 8, set: 8, september: 8, septiembre: 8,
  oct: 9, october: 9, octubre: 9,
  nov: 10, november: 10, noviembre: 10,
  dec: 11, dic: 11, december: 11, diciembre: 11,
};

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseDiscountNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (val > 0 && val <= 1) return Number((val * 100).toFixed(2));
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }
  let str = String(val).trim().replace(/[$%USD\s]/gi, '');
  if (!str) return 0;

  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf(',') > str.indexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (num > 0 && num <= 1) return Number((num * 100).toFixed(2));
  return Number(num.toFixed(2));
}

function parsePriceNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Number(val.toFixed(2));
  let str = String(val).trim().replace(/[$€£USD\s]/gi, '');
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf(',') > str.indexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Number(num.toFixed(2));
}

function parseDateSegment(dateText: string, fallbackYear?: number): number | null {
  if (!dateText) return null;
  const clean = dateText.replace(/(?<=\d)(?:st|nd|rd|th)/gi, '').trim();
  const parts = clean.split(/[\s,/-]+/).filter(Boolean);
  if (parts.length < 2) return null;

  let day = 1;
  let month = 0;
  let year = fallbackYear || new Date().getFullYear();

  // Si el formato es DD/MM/YYYY o DD-MM-YYYY puramente numérico
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    const y = p2 < 100 ? 2000 + p2 : p2;
    if (p1 <= 12 && p0 <= 31) {
      const d = new Date(y, p1 - 1, p0, 23, 59, 59);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MONTH_MAP[lower] !== undefined) {
      month = MONTH_MAP[lower];
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        if (num > 1900 && num < 2100) {
          year = num;
        } else if (num >= 1 && num <= 31) {
          day = num;
        }
      }
    }
  }

  const d = new Date(year, month, day, 23, 59, 59);
  return isNaN(d.getTime()) ? null : d.getTime();
}

const MONTH_NAMES =
  'jan(?:uary)?|ene(?:ro)?|feb(?:ruary|rero)?|mar(?:ch|zo)?|apr(?:il)?|abr(?:il)?|may(?:o)?|jun(?:e|io)?|jul(?:y|io)?|aug(?:ust)?|ago(?:sto)?|sep(?:tember)?|set(?:iembre)?|oct(?:ober|ubre)?|nov(?:ember|iembre)?|dec(?:ember)?|dic(?:iembre)?';

/**
 * Parsea rangos de fechas de Cisco Fast Track como:
 * "Eligible from Oct 25th 2026- Jan 23rd 2027"
 * "Eligible from Aug 23rd 2026- Oct 24th 2026"
 * "Eligible from Oct 25th - Jan 23rd 2027"
 */
export function parseFastTrackDateRange(text: string): {
  validFrom: number | null;
  validUntil: number | null;
} | null {
  if (!text) return null;

    const dateRegex = new RegExp(
    '(?:(' +
      MONTH_NAMES +
      ')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[\\s,]+(\\d{4}))?|(\\d{1,2})(?:st|nd|rd|th)?[\\s/-]+(' +
      MONTH_NAMES +
      ')(?:[\\s/-]+(\\d{4}))?|(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4}))',
    'gi'
  );

  const matches = [...text.matchAll(dateRegex)].map((m) => m[0].trim());
  if (matches.length >= 2) {
    const rawStart = matches[0];
    const rawEnd = matches[matches.length - 1];

    const endYearMatch = rawEnd.match(/\b(20\d{2})\b/);
    const startYearMatch = rawStart.match(/\b(20\d{2})\b/);

    const endYear = endYearMatch ? parseInt(endYearMatch[1], 10) : new Date().getFullYear();
    let startYear = startYearMatch ? parseInt(startYearMatch[1], 10) : endYear;

    // Si la fecha inicial no especifica año pero la final sí, y el mes inicial > mes final, pertenece al año anterior
    if (!startYearMatch && endYearMatch) {
      const startMonthMatch = rawStart.match(new RegExp('(' + MONTH_NAMES + ')', 'i'));
      const endMonthMatch = rawEnd.match(new RegExp('(' + MONTH_NAMES + ')', 'i'));
      if (startMonthMatch && endMonthMatch) {
        const sm = MONTH_MAP[startMonthMatch[1].toLowerCase()];
        const em = MONTH_MAP[endMonthMatch[1].toLowerCase()];
        if (sm !== undefined && em !== undefined && sm > em) {
          startYear = endYear - 1;
        }
      }
    }

    const validUntil = parseDateSegment(rawEnd, endYear);
    const validFrom = parseDateSegment(rawStart, startYear);
    return { validFrom, validUntil };
  } else if (matches.length === 1) {
    const raw = matches[0];
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const d = parseDateSegment(raw, year);
    return { validFrom: null, validUntil: d };
  }

  return null;
}

/**
 * Escanea la cabecera exacta de Cisco Fast Track (Filas 1 a 4 / Celda A3)
 * Ejemplo exacto: "Eligible from Oct 25th 2026- Jan 23rd 2027"
 * Código de promoción: "Promotion Code: PP-Fast-170729-01820"
 */
export function scanFastTrackMetadata(rawRows: any[][]): {
  promotionTitle?: string;
  promotionCode?: string;
  validFrom?: number | null;
  validUntil?: number | null;
} {
  let promotionTitle: string | undefined = undefined;
  let promotionCode: string | undefined = undefined;
  let validFrom: number | null = null;
  let validUntil: number | null = null;

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < Math.min(row.length, 5); c++) {
      const text = cleanStr(row[c]);
      if (!text) continue;

      // 1. Título del programa Fast Track (Celda A1 o similar)
      if (
        !promotionTitle &&
        (text.toUpperCase().includes('FAST TRACK') || text.toUpperCase().includes('FY2'))
      ) {
        promotionTitle = text;
      }

      // 2. Código de Promoción (Celda A2: "Promotion Code: PP-Fast-170729-01820")
      if (!promotionCode && text.toUpperCase().includes('PROMOTION CODE')) {
        const parts = text.split(/[:=]/);
        if (parts.length > 1) {
          promotionCode = parts[1].trim();
        }
      }

      // 3. Rango de Vigencia Exacto (Celda A3: "Eligible from Oct 25th 2026- Jan 23rd 2027")
      if (text.toUpperCase().includes('ELIGIBLE')) {
        const rangeRes = parseFastTrackDateRange(text);
        if (rangeRes) {
          if (rangeRes.validFrom !== null) validFrom = rangeRes.validFrom;
          if (rangeRes.validUntil !== null) validUntil = rangeRes.validUntil;
        }
      }

      // 4. Fallback de fechas explícitas en texto ("Valid through...", "Vence...")
      if (!validUntil) {
        const dateRegex =
          /(?:valid\s*(?:through|until|thru)|expires|expiry\s*date|vigencia\s*(?:hasta)?|fecha\s*de\s*vencimiento|vence|end\s*date)\s*[:=]?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[A-Za-z]{3,10}\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:[,\s]+[0-9]{4})?)/i;
        const fallbackMatch = text.match(dateRegex);
        if (fallbackMatch && fallbackMatch[1]) {
          validUntil = parseDateSegment(fallbackMatch[1]);
        }
      }
    }
  }

  return {
    promotionTitle,
    promotionCode,
    validFrom,
    validUntil,
  };
}

/**
 * Parsea un archivo Excel de Fast Track (.xlsx o .xls) y extrae el catálogo normalizado con metadatos oficiales.
 */
export async function parseFastTrackExcel(
  arrayBuffer: ArrayBuffer,
  fileName: string = 'FastTrack.xlsx'
): Promise<{
  items: FastTrackProduct[];
  totalParsed: number;
  detectedValidUntil: number | null;
  detectedValidFrom: number | null;
  promotionTitle?: string;
  promotionCode?: string;
}> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    raw: false,
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Fast Track no contiene ninguna hoja de cálculo válida.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('La hoja de cálculo está vacía.');
  }

  // 1. Escaneo de Metadatos de Cabecera (Celda A1, A2, A3)
  const meta = scanFastTrackMetadata(rawRows);

  // 2. Detectar Fila de Cabecera por Puntuación (ej: Fila 4: Part Number | Description | Distributor Discount % | Technology Group)
  let bestHeaderRowIndex = -1;
  let maxScore = 0;

  for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;
    let score = 0;
    const rowStr = row.map((c) => cleanStr(c).toUpperCase()).join(' ');

    if (
      rowStr.includes('PART NUMBER') ||
      rowStr.includes('SKU') ||
      rowStr.includes('PRODUCT ID') ||
      rowStr.includes('MATERIAL')
    )
      score += 3;
    if (
      rowStr.includes('DISTRIBUTOR DISCOUNT') ||
      rowStr.includes('DISCOUNT %') ||
      rowStr.includes('DESCUENTO') ||
      rowStr.includes('DCTO')
    )
      score += 3;
    if (rowStr.includes('DESCRIPTION') || rowStr.includes('DESCRIPCION')) score += 1;
    if (rowStr.includes('LIST PRICE') || rowStr.includes('TECHNOLOGY GROUP')) score += 1;

    if (score > maxScore) {
      maxScore = score;
      bestHeaderRowIndex = r;
    }
  }

  if (bestHeaderRowIndex === -1 || maxScore < 2) {
    bestHeaderRowIndex = 0;
  }

  // 3. Mapear Columnas
  const headerRow = rawRows[bestHeaderRowIndex] || [];
  let colSku = -1;
  let colDiscount = -1;
  let colDesc = -1;
  let colListPrice = -1;
  let colPromoPrice = -1;
  let colCategory = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const val = cleanStr(headerRow[c]).toUpperCase();
    if (!val) continue;

    if (
      colSku === -1 &&
      (val.includes('PART NUMBER') ||
        val === 'SKU' ||
        val.includes('PRODUCT ID') ||
        val.includes('MATERIAL') ||
        val === 'PART#' ||
        val === 'PART NO')
    ) {
      colSku = c;
    } else if (
      colDiscount === -1 &&
      (val.includes('DISTRIBUTOR DISCOUNT') ||
        val.includes('DISCOUNT') ||
        val.includes('DESCUENTO') ||
        val.includes('DCTO') ||
        val.includes('% DISC'))
    ) {
      colDiscount = c;
    } else if (
      colDesc === -1 &&
      (val.includes('DESCRIPTION') || val.includes('DESCRIPCION') || val.includes('PRODUCT DESC'))
    ) {
      colDesc = c;
    } else if (
      colListPrice === -1 &&
      (val.includes('LIST PRICE') ||
        val.includes('PRECIO LISTA') ||
        val.includes('GPL') ||
        val === 'LIST' ||
        val === 'PRICE')
    ) {
      colListPrice = c;
    } else if (
      colPromoPrice === -1 &&
      (val.includes('PROMO') || val.includes('NET PRICE') || val.includes('PRECIO PROMO'))
    ) {
      colPromoPrice = c;
    } else if (
      colCategory === -1 &&
      (val.includes('TECHNOLOGY GROUP') ||
        val.includes('CATEGORY') ||
        val.includes('CATEGORIA') ||
        val.includes('FAMILY') ||
        val.includes('TECNOLOGIA'))
    ) {
      colCategory = c;
    }
  }

  // Fallback si no hubo coincidencia por cabecera
  if (colSku === -1) colSku = 0;
  if (colDiscount === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c !== colSku && c !== colDesc) {
        colDiscount = c;
        break;
      }
    }
  }

  // 4. Extraer Filas de Productos
  const parsedItems: FastTrackProduct[] = [];
  const now = Date.now();

  for (let r = bestHeaderRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;

    const rawSku = colSku >= 0 ? cleanStr(row[colSku]) : '';
    const cleanSku = sanitizePartNumberKey(rawSku);

    // Descartar filas vacías o subtotales
    if (!cleanSku || cleanSku === 'TOTAL' || cleanSku.length < 2 || cleanSku.includes('PART NUMBER')) {
      continue;
    }

    const discountVal = colDiscount >= 0 ? parseDiscountNumber(row[colDiscount]) : 0;
    const desc = colDesc >= 0 ? cleanStr(row[colDesc]) : '';
    const listPrice = colListPrice >= 0 ? parsePriceNumber(row[colListPrice]) : 0;
    const promoPrice = colPromoPrice >= 0 ? parsePriceNumber(row[colPromoPrice]) : 0;
    const category = colCategory >= 0 ? cleanStr(row[colCategory]) : undefined;

    if (discountVal > 0) {
      parsedItems.push({
        partNumber: cleanSku,
        distributorDiscount: discountVal,
        description: desc || undefined,
        listPrice: listPrice > 0 ? listPrice : undefined,
        promoNetPrice: promoPrice > 0 ? promoPrice : undefined,
        category: category || undefined,
        updatedAt: now,
      });
    }
  }

  if (parsedItems.length === 0) {
    throw new Error(
      'No se encontraron registros con Part Number y Descuento % válidos en el archivo Fast Track subido.'
    );
  }

  return {
    items: parsedItems,
    totalParsed: parsedItems.length,
    detectedValidUntil: meta.validUntil || null,
    detectedValidFrom: meta.validFrom || null,
    promotionTitle: meta.promotionTitle,
    promotionCode: meta.promotionCode,
  };
}
