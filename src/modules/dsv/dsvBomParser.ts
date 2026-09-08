// ============================================================================
// CISCO AUTOMATED - UNIVERSAL CISCO DEAL BOM PARSER (.XLS & .XLSX)
// ============================================================================

import * as XLSX from 'xlsx';
import { safeParseFloat } from '../../core/calculations';

export interface RawBomItem {
  rowIdx: number;
  authorizationNumber: string; // Col A (0) - AUTHORIZATION NUMBER / Deal ID
  resellerName: string;        // Col C (2) - RESELLER NAME
  endUserName: string;         // Col E (4) - ENDUSER NAME
  lineNumber: string;          // Col F (5) - LINE# (e.g. 1.0, 1.0.1)
  magicKey: string;            // Col G (6) - MAGIC KEY
  ciscoSku: string;            // Col H (7) - CISCO SKU
  qty: number;                 // Col J (9) - QUANTITY
  durationMonths: number;      // Col K (10) - DURATION(Months)
  listPrice: number;           // Col O (14) - LIST_PRICE (Strictly unit list price)
  distiDiscountPct: number;    // Col S (18) - DISTI DISCOUNT (%)
  description?: string;
}

export interface RawBomParsedResult {
  fileName: string;
  dealIdFromBom: string;
  authorizationNumber: string;
  resellerName: string;
  endUserName: string;
  items: RawBomItem[];
}

export function sanitizeTrim(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function parseUniversalNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  return safeParseFloat(val);
}

/**
 * Universal Deal BOM Parser: Supports legacy .xls (BIFF8/HTML/XML) and modern .xlsx
 */
export async function parseRawDealBom(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<RawBomParsedResult> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    raw: false,
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene ninguna hoja de cálculo válida.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('La hoja de cálculo está vacía.');
  }

  // 1. Extraer Deal ID del nombre del archivo (ej: 85890781_Cisco-Deal-BOM...)
  let dealIdFromBom = '';
  const filenameMatch = fileName.match(/^(\d{6,12})_/);
  if (filenameMatch && filenameMatch[1]) {
    dealIdFromBom = filenameMatch[1].trim();
  }

  let globalAuthNumber = dealIdFromBom;
  let globalResellerName = '';
  let globalEndUserName = '';

  // 2. Dynamic Header Row Detection
  let bestHeaderRowIndex = 0;
  let maxScore = 0;

  for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;
    let score = 0;
    const rowStr = row.map((c) => sanitizeTrim(c).toUpperCase()).join(' ');

    if (rowStr.includes('AUTHORIZATION')) score += 3;
    if (rowStr.includes('RESELLER')) score += 2;
    if (rowStr.includes('ENDUSER') || rowStr.includes('END USER')) score += 2;
    if (rowStr.includes('LINE#') || rowStr.includes('LINE #')) score += 3;
    if (rowStr.includes('MAGIC KEY')) score += 2;
    if (rowStr.includes('CISCO SKU') || rowStr.includes('SKU')) score += 3;
    if (rowStr.includes('QUANTITY') || rowStr.includes('QTY')) score += 2;
    if (rowStr.includes('LIST_PRICE') || rowStr.includes('LIST PRICE')) score += 3;
    if (rowStr.includes('DISTI DISCOUNT')) score += 3;

    if (score > maxScore) {
      maxScore = score;
      bestHeaderRowIndex = r;
    }
  }

  // Exact 0-based column indices according to official Cisco Deal BOM specification
  let colAuth = 0;        // Col A (0) - AUTHORIZATION NUMBER
  let colReseller = 2;    // Col C (2) - RESELLER NAME
  let colEndUser = 4;     // Col E (4) - ENDUSER NAME
  let colLine = 5;        // Col F (5) - LINE#
  let colMagicKey = 6;    // Col G (6) - MAGIC KEY
  let colSku = 7;         // Col H (7) - CISCO SKU
  let colQty = 9;         // Col J (9) - QUANTITY
  let colDuration = 10;   // Col K (10) - DURATION(Months)
  let colListPrice = 14;  // Col O (14) - LIST_PRICE
  let colDiscount = 18;   // Col S (18) - DISTI DISCOUNT
  let colDesc = -1;

  if (maxScore >= 4) {
    const headerRow = rawRows[bestHeaderRowIndex] || [];
    headerRow.forEach((cellVal, colIdx) => {
      const text = sanitizeTrim(cellVal).toUpperCase();
      if (!text) return;

      if (text === 'AUTHORIZATION NUMBER' || (text.includes('AUTHORIZATION') && !text.includes('DISTRIBUTOR'))) {
        colAuth = colIdx;
      } else if (text === 'RESELLER NAME' || (text.includes('RESELLER') && text.includes('NAME'))) {
        colReseller = colIdx;
      } else if (text === 'ENDUSER NAME' || text === 'END USER NAME' || (text.includes('ENDUSER') && text.includes('NAME'))) {
        colEndUser = colIdx;
      } else if (text === 'LINE#' || text === 'LINE #' || text === 'LINE NUMBER') {
        colLine = colIdx;
      } else if (text === 'MAGIC KEY' && !text.includes('SOFTLINK')) {
        colMagicKey = colIdx;
      } else if (text === 'CISCO SKU' || (text.includes('SKU') && !text.includes('SPARE') && !text.includes('IDENTIFIER') && !text.includes('DISTRIBUTOR'))) {
        colSku = colIdx;
      } else if (text === 'QUANTITY' || text === 'QTY') {
        colQty = colIdx;
      } else if (text === 'DURATION(MONTHS)' || text === 'DURATION (MONTHS)' || (text.includes('DURATION') && !text.includes('PRICE') && !text.includes('NET') && !text.includes('LIST'))) {
        colDuration = colIdx;
      } else if (
        text === 'LIST_PRICE' ||
        text === 'LIST PRICE' ||
        text === 'UNIT LIST PRICE' ||
        (text.includes('LIST') && text.includes('PRICE') && !text.includes('EXTENDED') && !text.includes('ORIGINAL') && !text.includes('SPARE') && !text.includes('DURATION'))
      ) {
        // Strictly Col O (LIST_PRICE)
        colListPrice = colIdx;
      } else if (
        text === 'DISTI DISCOUNT' ||
        text === 'DISTI DISCOUNT (%)' ||
        text === 'DISCOUNT (%)' ||
        (text.includes('DISCOUNT') && !text.includes('SPARE'))
      ) {
        // Strictly Col S (DISTI DISCOUNT)
        colDiscount = colIdx;
      } else if (text === 'DESCRIPTION' || text === 'DESC' || text === 'PRODUCT DESCRIPTION') {
        colDesc = colIdx;
      }
    });
  }

  // 3. Extract items from rows
  const items: RawBomItem[] = [];

  for (let r = bestHeaderRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const skuStr = sanitizeTrim(row[colSku]);
    const lineStr = sanitizeTrim(row[colLine]);

    const skuUpper = skuStr.toUpperCase();
    const lineUpper = lineStr.toUpperCase();

    // Check stop conditions (footer rows)
    if (
      lineUpper.includes('VALID THROUGH') ||
      lineUpper.includes('FOB POINT') ||
      lineUpper.includes('NOTES') ||
      lineUpper.includes('PRODUCT TOTAL') ||
      lineUpper.includes('TOTAL PRICE') ||
      skuUpper.includes('PRODUCT TOTAL') ||
      skuUpper.includes('TOTAL PRICE') ||
      skuUpper.includes('GRAND TOTAL')
    ) {
      break;
    }

    if (!skuStr || skuUpper === 'NONE' || skuUpper === '-' || skuUpper === 'CISCO SKU' || skuUpper === 'PRODUCT #' || skuUpper === 'SKU') {
      continue;
    }

    const authStr = sanitizeTrim(row[colAuth]);
    const resellerStr = sanitizeTrim(row[colReseller]);
    const endUserStr = sanitizeTrim(row[colEndUser]);
    const magicKeyStr = sanitizeTrim(row[colMagicKey]);
    const descStr = colDesc !== -1 ? sanitizeTrim(row[colDesc]) : '';

    const rawQtyCell = row[colQty];
    const qtyStr = sanitizeTrim(rawQtyCell);
    let qtyVal = typeof rawQtyCell === 'number' ? Math.round(rawQtyCell) : parseInt(qtyStr, 10);
    if (isNaN(qtyVal) || qtyVal < 0) qtyVal = 1;

    const durationVal = Math.round(safeParseFloat(row[colDuration]));
    const listVal = safeParseFloat(row[colListPrice]);
    const discountVal = safeParseFloat(row[colDiscount]);

    if (authStr && !globalAuthNumber) {
      globalAuthNumber = authStr;
      if (!dealIdFromBom) dealIdFromBom = authStr;
    }
    if (resellerStr && !globalResellerName) globalResellerName = resellerStr;
    if (endUserStr && !globalEndUserName) globalEndUserName = endUserStr;

    items.push({
      rowIdx: r + 1,
      authorizationNumber: authStr || globalAuthNumber,
      resellerName: resellerStr || globalResellerName,
      endUserName: endUserStr || globalEndUserName,
      lineNumber: lineStr || `${items.length + 1}.0`,
      magicKey: magicKeyStr,
      ciscoSku: skuStr,
      qty: qtyVal,
      durationMonths: durationVal,
      listPrice: listVal,
      distiDiscountPct: discountVal,
      description: descStr,
    });
  }

  return {
    fileName,
    dealIdFromBom: dealIdFromBom || globalAuthNumber || '',
    authorizationNumber: globalAuthNumber || dealIdFromBom || '',
    resellerName: globalResellerName || '',
    endUserName: globalEndUserName || '',
    items,
  };
}
