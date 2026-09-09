// ============================================================================
// CISCO AUTOMATED v2.1 - ULTRA-FAST & ACCURATE EXCEL ENGINE
// ============================================================================

import ExcelJS from 'exceljs';
import {
  EstimateHeaderInfo,
  EstimateLineItem,
  ProcessedEstimateResult,
  QuoteParameters,
  OverrideRuleType,
} from './types';
import {
  calculateLineItemCosts,
  calculateMerakiLicenseCosts,
  extractInitialTermMonths,
  isInformationalRow,
  formatLeadTime,
  suggestFileName,
  isMainLineItem,
  isCloudSubscriptionSku,
  safeParseFloat,
} from './calculations';
import { INTCOMEX_LOGO_RAW_BASE64 } from '../lib/intcomexLogoBase64';

function getCellString(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
      return (cell.value as any).richText.map((t: any) => t.text).join('');
    }
    if ('text' in cell.value) {
      return String((cell.value as any).text);
    }
    if ('result' in cell.value) {
      return String((cell.value as any).result);
    }
  }
  return String(cell.value).trim();
}

function parseNumericValue(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object' && 'result' in val) {
    return parseNumericValue(val.result);
  }
  return safeParseFloat(val);
}

function safeUnmerge(worksheet: ExcelJS.Worksheet, range: string): void {
  try {
    worksheet.unMergeCells(range);
  } catch (e) {
    // Suppress if not merged
  }
}

export function sanitizeWorkbookForExport(workbook: ExcelJS.Workbook): void {
  try {
    if (typeof (workbook as any).clearThemes === 'function') {
      (workbook as any).clearThemes();
    }
    delete (workbook as any).themes;
    delete (workbook as any)._themes;
    if ((workbook as any).model) {
      delete (workbook as any).model.themes;
      delete (workbook as any).model.theme;
    }
  } catch (e) {
    console.warn('Theme cleanup notice:', e);
  }
}

interface ColumnMapping {
  colLine: number;
  colPart: number;
  colSmart: number;
  colDesc: number;
  colDur: number;
  colLead: number;
  colList: number;
  colTerm: number;
  colQty: number;
  colNet: number;
  colDisc: number;
  colExt: number;
}

function detectColumnMapping(worksheet: ExcelJS.Worksheet, headerRowIndex: number): ColumnMapping {
  const row = worksheet.getRow(headerRowIndex);
  const map: ColumnMapping = {
    colLine: 1,
    colPart: 2,
    colSmart: 3,
    colDesc: 4,
    colDur: 5,
    colLead: 6,
    colList: 7,
    colTerm: 8,
    colQty: 9,
    colNet: 10,
    colDisc: 11,
    colExt: 12,
  };

  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = getCellString(cell).toLowerCase().trim();
    if (text.includes('line') || text.includes('línea') || text.includes('item')) {
      map.colLine = colNumber;
    } else if (text.includes('part') || text.includes('sku') || text.includes('product #')) {
      map.colPart = colNumber;
    } else if (text.includes('smart account')) {
      map.colSmart = colNumber;
    } else if (text.includes('desc') || text.includes('product desc')) {
      map.colDesc = colNumber;
    } else if (text.includes('duration') || text.includes('duración')) {
      map.colDur = colNumber;
    } else if (text.includes('lead') || text.includes('entrega') || text.includes('tiempo')) {
      map.colLead = colNumber;
    } else if (text.includes('list') || text.includes('lista')) {
      map.colList = colNumber;
    } else if (text.includes('term') || text.includes('término')) {
      map.colTerm = colNumber;
    } else if (text.includes('qty') || text.includes('cant') || text.includes('quantity')) {
      map.colQty = colNumber;
    } else if (text.includes('disc') || text.includes('descuento') || text.includes('%')) {
      map.colDisc = colNumber;
    } else if (
      text.includes('ext') ||
      text.includes('extend') ||
      text.includes('total price') ||
      text.includes('precio ext') ||
      text.includes('net total')
    ) {
      map.colExt = colNumber;
    } else if (
      (text.includes('unit net') ||
        text.includes('net price') ||
        text.includes('unit price') ||
        text.includes('precio neto') ||
        text.includes('net')) &&
      !text.includes('ext') &&
      !text.includes('extend') &&
      !text.includes('total')
    ) {
      map.colNet = colNumber;
    }
  });

  return map;
}

/**
 * Detects if a row is a footer, disclaimer note, or total row (e.g. 'Validez de la Oferta', 'Product Total', etc.)
 */
export function isFooterOrNoteRow(lineStr: string, partStr: string, descStr: string): boolean {
  const lineLower = (lineStr || '').toLowerCase().trim();
  const partLower = (partStr || '').toLowerCase().trim();
  const descLower = (descStr || '').toLowerCase().trim();
  const combined = `${lineLower} ${partLower} ${descLower}`;

  const stopKeywords = [
    'validez de la oferta',
    'validez de oferta',
    'validez',
    'esta cotización',
    'esta cotizacion',
    'valid through',
    'validity',
    'fob point',
    'fob',
    'notes',
    'nota:',
    'notas',
    'observaciones',
    'aclaraciones',
    'terminos y condiciones',
    'términos y condiciones',
    'terms and conditions',
    'terms & conditions',
    'product total',
    'total price',
    'price total',
    'grand total',
    'subtotal',
    'total general',
    'total cotización',
    'total cotizacion',
    'total neto',
    'días corridos',
    'dias corridos',
    'fecha de emisión',
    'fecha de emision',
  ];

  if (stopKeywords.some((kw) => combined.includes(kw))) {
    return true;
  }

  if (
    partLower.startsWith('validez') ||
    partLower.startsWith('esta ') ||
    partLower.includes('cotización') ||
    partLower.includes('cotizacion') ||
    partLower.startsWith('total') ||
    partLower.includes('días corridos') ||
    partLower.includes('dias corridos')
  ) {
    return true;
  }

  if (
    partStr.trim().split(/\s+/).length > 3 &&
    (partLower.includes(' de ') || partLower.includes(' la ') || partLower.includes(' el '))
  ) {
    return true;
  }

  return false;
}

/**
 * ULTRA-FAST PARSER: Reads Excel buffer in milliseconds without heavy writeBuffer operations.
 */
export async function parseEstimateWorkbook(
  arrayBuffer: ArrayBuffer,
  params: QuoteParameters,
  fileName: string,
  overrides?: Record<number, OverrideRuleType>,
  promoNetPrices?: Record<number, number>
): Promise<{ result: ProcessedEstimateResult }> {
  // Always clone arrayBuffer to prevent memory detachment / buffer consumption issues
  const bufferCopy = arrayBuffer.slice(0);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bufferCopy);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja de cálculo válida.');
  }

  // 1. Dynamic Header Row Detection
  let headerRowIndex = -1;
  for (let r = 1; r <= Math.min(worksheet.rowCount, 40); r++) {
    for (let c = 1; c <= 6; c++) {
      const cellVal = getCellString(worksheet.getCell(r, c)).toLowerCase();
      if (
        cellVal.includes('line number') ||
        cellVal.includes('line #') ||
        (cellVal.includes('part number') && c <= 2) ||
        (cellVal.includes('description') && c <= 4)
      ) {
        headerRowIndex = r;
        break;
      }
    }
    if (headerRowIndex !== -1) break;
  }
  if (headerRowIndex === -1) headerRowIndex = 18;

  // 2. Detect Columns
  const colMap = detectColumnMapping(worksheet, headerRowIndex);

  // 3. Extract Metadata from Top Rows
  const headerInfo: EstimateHeaderInfo = {
    customerName: getCellString(worksheet.getCell(3, 1)) || 'Mauricio Skill',
    companyName: getCellString(worksheet.getCell(4, 1)) || 'INTCOMEX CHILE SA',
    address: getCellString(worksheet.getCell(5, 1)) || 'ROSARIO NORTE 615, PISO 6',
    city: getCellString(worksheet.getCell(6, 1)) || 'SANTIAGO, 0-0',
    country: getCellString(worksheet.getCell(7, 1)) || 'CHILE',
    phone: getCellString(worksheet.getCell(8, 1)) || 'Ph no:+56 223637100',
    estimateId:
      getCellString(worksheet.getCell(13, 12)) ||
      getCellString(worksheet.getCell(13, 7)) ||
      getCellString(worksheet.getCell(13, colMap.colExt)) ||
      '011682708571Z',
    dealId:
      getCellString(worksheet.getCell(14, 12)) ||
      getCellString(worksheet.getCell(14, 7)) ||
      getCellString(worksheet.getCell(14, colMap.colExt)) ||
      'NA',
    priceList:
      getCellString(worksheet.getCell(15, 12)) ||
      getCellString(worksheet.getCell(15, 7)) ||
      'Global Price List Latin America Availability (USD)',
    date: getCellString(worksheet.getCell(13, 1)) || '09-Aug-2026',
  };

  const items: EstimateLineItem[] = [];
  let calculatedProductTotal = 0;
  let originalProductTotal = 0;

  // 4. Extract and calculate line items
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const lineNumStr = getCellString(worksheet.getCell(r, colMap.colLine));
    const partNumStr = getCellString(worksheet.getCell(r, colMap.colPart));
    const description = getCellString(worksheet.getCell(r, colMap.colDesc)) || '';

    // Check stop conditions (footer rows / disclaimer notes)
    if (isFooterOrNoteRow(lineNumStr, partNumStr, description)) {
      break;
    }

    // Skip empty separator rows without content
    if (!lineNumStr && !partNumStr && !description) {
      continue;
    }

    // 1. Aislamiento de Filas Informativas y Deduplicación de Términos Redundantes
    if (isInformationalRow(partNumStr, description)) {
      const cleanDesc = description.trim();
      const isCurrentInitialTerm = cleanDesc.toLowerCase().includes('initial term');

      // Deduplication check with previous info row
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        if (lastItem.isInfoRow) {
          const lastDesc = (lastItem.description || '').trim();
          const isLastInitialTerm = lastDesc.toLowerCase().includes('initial term');

          // If both consecutive info rows are "Initial Term" descriptions
          if (isCurrentInitialTerm && isLastInitialTerm) {
            // Keep the more complete/detailed description
            if (cleanDesc.length > lastDesc.length) {
              lastItem.description = cleanDesc;
              if (lineNumStr && !lastItem.lineNumber) {
                lastItem.lineNumber = lineNumStr;
              }
            }
            continue; // Skip creating a duplicate row!
          }

          // If exact duplicate description
          if (cleanDesc.toLowerCase() === lastDesc.toLowerCase()) {
            continue; // Skip exact duplicate
          }
        }
      }

      items.push({
        rowIdx: r,
        lineNumber: lineNumStr || '',
        partNumber: partNumStr || '',
        smartAccountMandatory: '-',
        description: cleanDesc,
        serviceDurationMonths: '---',
        originalLeadTimeDays: 0,
        transformedLeadTime: '',
        unitListPrice: 0,
        pricingTerm: '',
        qty: 0,
        netCiscoUnit: 0,
        discPct: 0,
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
        isInfoRow: true,
      });
      continue; // Strictly prohibited from calculating margins, totals or goal seek
    }

    const sku = partNumStr.toUpperCase();
    const smartAccount = getCellString(worksheet.getCell(r, colMap.colSmart)) || '-';
    const serviceDuration = getCellString(worksheet.getCell(r, colMap.colDur)) || '---';

    // NUEVO: Rescate de duración y conversión a estándar "Y"
    let finalDescription = description.trim();
    const durMatch = String(serviceDuration).match(/(\d+)/);
    
    if (durMatch) {
      const parsedMonths = parseInt(durMatch[1], 10);
      if (parsedMonths > 0) {
        const formattedDur = parsedMonths % 12 === 0 ? `${parsedMonths / 12}Y` : `${parsedMonths} Meses`;
        finalDescription += ` (${formattedDur})`;
      }
    }

    const rawLeadTime = worksheet.getCell(r, colMap.colLead).value;
    const leadTimeNum = parseNumericValue(rawLeadTime);
    const transformedLeadTime = formatLeadTime(leadTimeNum);

    const unitListPrice = parseNumericValue(worksheet.getCell(r, colMap.colList).value);
    const pricingTerm = getCellString(worksheet.getCell(r, colMap.colTerm)) || '';
    const rawQtyCell = worksheet.getCell(r, colMap.colQty).value;
    const qtyStr = getCellString(worksheet.getCell(r, colMap.colQty));
    let qty = typeof rawQtyCell === 'number' ? Math.round(rawQtyCell) : parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 0) qty = 1;
    const rawNetCiscoUnit = parseNumericValue(worksheet.getCell(r, colMap.colNet).value);
    const hasPromo = Boolean(promoNetPrices && promoNetPrices[r] !== undefined);
    const netCiscoUnit = hasPromo ? promoNetPrices![r] : rawNetCiscoUnit;

    const discPct = unitListPrice > 0
      ? Number((((unitListPrice - netCiscoUnit) / unitListPrice) * 100).toFixed(2))
      : parseNumericValue(worksheet.getCell(r, colMap.colDisc).value);

    // 2. Excepción de Cálculo Universal SaaS (Look-ahead Failsafe Anti-Contaminación)
    let isMerakiHandled = false;
    let merakiResult: ReturnType<typeof calculateMerakiLicenseCosts> | null = null;

    // Look-ahead estrictamente local (solo fila siguiente) para no mezclar licencias
    const nextDesc1 = getCellString(worksheet.getCell(r + 1, colMap.colDesc));

    if (isCloudSubscriptionSku(sku, nextDesc1)) {
      try {
        const nextPart1 = getCellString(worksheet.getCell(r + 1, colMap.colPart));
        const nextDesc2 = getCellString(worksheet.getCell(r + 2, colMap.colDesc));
        const nextPart2 = getCellString(worksheet.getCell(r + 2, colMap.colPart));

        // Extrae el número entero de meses truncando el ".00"
        const months = extractInitialTermMonths(nextDesc1, nextPart1, nextDesc2, nextPart2, description, serviceDuration);

        // Multiplicación secuencial estricta de Precio Mensual * Meses * Qty
        merakiResult = calculateMerakiLicenseCosts(unitListPrice, discPct, qty, months, params);
        isMerakiHandled = true;
      } catch (err) {
        console.warn('[SaaS Look-Ahead Failsafe]: Falling back to standard calculation:', err);
        isMerakiHandled = false;
      }
    }

    if (isMerakiHandled && merakiResult) {
      originalProductTotal += merakiResult.costoTotalUnitario * qty;
      calculatedProductTotal += merakiResult.precioVentaExtendido;

      items.push({
        rowIdx: r,
        lineNumber: lineNumStr || `${items.length + 1}.0`,
        partNumber: partNumStr,
        smartAccountMandatory: smartAccount,
        description: finalDescription,
        serviceDurationMonths: `${merakiResult.months} Months`,
        originalLeadTimeDays: leadTimeNum,
        transformedLeadTime,
        unitListPrice,
        pricingTerm,
        qty,
        netCiscoUnit: merakiResult.costoTotalUnitario,
        discPct,
        isFastTrackPromo: hasPromo,
        originalNetCiscoUnit: hasPromo ? rawNetCiscoUnit : undefined,
        fastTrackDiscountPct: hasPromo ? discPct : undefined,
        fastTrackSavings: hasPromo ? Number(((rawNetCiscoUnit - merakiResult.costoTotalUnitario) * qty).toFixed(2)) : undefined,
        ...merakiResult,
      });
    } else {
      const standardDiscount = parseNumericValue(worksheet.getCell(r, colMap.colDisc).value);
      const baseNetCost = rawNetCiscoUnit > 0
        ? rawNetCiscoUnit
        : (unitListPrice > 0 ? unitListPrice * (1 - (standardDiscount / 100)) : 0);
      originalProductTotal += baseNetCost * qty;

      const rowOverride = overrides ? overrides[r] : undefined;
      const calculated = calculateLineItemCosts(netCiscoUnit, qty, sku, description, params, rowOverride);

      calculatedProductTotal += calculated.precioVentaExtendido;

      items.push({
        rowIdx: r,
        lineNumber: lineNumStr || `${items.length + 1}.0`,
        partNumber: partNumStr,
        smartAccountMandatory: smartAccount,
        description: finalDescription,
        serviceDurationMonths: serviceDuration,
        originalLeadTimeDays: leadTimeNum,
        transformedLeadTime,
        unitListPrice,
        pricingTerm,
        qty,
        netCiscoUnit,
        discPct,
        isFastTrackPromo: hasPromo,
        originalNetCiscoUnit: hasPromo ? rawNetCiscoUnit : undefined,
        fastTrackDiscountPct: hasPromo ? discPct : undefined,
        fastTrackSavings: hasPromo ? Number(((rawNetCiscoUnit - netCiscoUnit) * qty).toFixed(2)) : undefined,
        ...calculated,
      });
    }
  }

  const roundedProductTotal = Math.round(calculatedProductTotal * 100) / 100;
  const outputFileName = suggestFileName(fileName);

  const result: ProcessedEstimateResult = {
    fileName: outputFileName,
    headerInfo,
    items,
    originalProductTotal: Math.round(originalProductTotal * 100) / 100,
    calculatedProductTotal: roundedProductTotal,
    serviceTotal: 0.0,
    subscriptionTotal: 0.0,
    finalTotalPrice: roundedProductTotal,
    headerRowIndex,
    workbookBuffer: arrayBuffer,
  };

  return { result };
}

export const processEstimateWorkbook = parseEstimateWorkbook;

/**
 * EXPORT GENERATOR: Called only when user clicks "Descargar Archivo".
 * Formats the 7 clean columns, styles, and creates the downloadable buffer.
 */
export async function generateOptimizedWorkbook(
  arrayBuffer: ArrayBuffer,
  params: QuoteParameters,
  fileName: string,
  overrides?: Record<number, OverrideRuleType>,
  promoNetPrices?: Record<number, number>
): Promise<{ result: ProcessedEstimateResult; modifiedBuffer: ArrayBuffer }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja de cálculo válida.');
  }

  // 1. Parse Line Items using the unified parser
  const { result: parsedResult } = await parseEstimateWorkbook(
    arrayBuffer,
    params,
    fileName,
    overrides,
    promoNetPrices
  );

  // Fijar la nueva arquitectura compacta ignorando el headerRowIndex original del CCW
  const EXPORT_HEADER_ROW = 13;
  const items = parsedResult.items;
  const headerInfo = parsedResult.headerInfo;
  const calculatedProductTotal = parsedResult.calculatedProductTotal;
  const originalProductTotal = parsedResult.originalProductTotal;

  const lastItemRow = EXPORT_HEADER_ROW + items.length;
  const totalRowIndex = lastItemRow + 1;
  const noticeRowIdx = totalRowIndex + 2;

  // 2. Comprehensive Cleanup: Unmerge ALL existing merges in the entire worksheet first
  try {
    const merges = [...(worksheet.model.merges || [])];
    for (const range of merges) {
      try {
        worksheet.unMergeCells(range);
      } catch (_) {}
    }
  } catch (_) {}

  const maxScanRow = Math.max(worksheet.rowCount, EXPORT_HEADER_ROW + items.length + 50);
  const maxScanCol = Math.max(worksheet.columnCount, 40);

  // WIPE ALL COLUMNS 8+ across the entire worksheet (rows 1 to maxScanRow) to remove duplicate headers/metadata (CHILE, Deal ID, Pricing Term, etc.)
  for (let r = 1; r <= maxScanRow; r++) {
    const row = worksheet.getRow(r);
    for (let c = 8; c <= maxScanCol; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = {};
      cell.border = undefined;
      cell.fill = { type: 'pattern', pattern: 'none' };
      if (cell.model) {
        delete (cell.model as any).formula;
        delete (cell.model as any).sharedFormula;
        delete (cell.model as any).formulaRange;
        delete (cell.model as any).richText;
        delete (cell.model as any).value;
      }
    }
  }

  // WIPE TOTAL: Elimina cualquier rastro del CCW original desde la fila 6 hacia abajo
  for (let r = 6; r <= maxScanRow; r++) {
    const row = worksheet.getRow(r);
    row.height = 20;
    for (let c = 1; c <= maxScanCol; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = {};
      cell.border = undefined;
      cell.fill = { type: 'pattern', pattern: 'none' };
      if (cell.model) {
        delete (cell.model as any).formula;
        delete (cell.model as any).sharedFormula;
        delete (cell.model as any).formulaRange;
        delete (cell.model as any).richText;
        delete (cell.model as any).value;
      }
    }
  }

  // Set explicit column widths for the 7 core columns and hide/zero out columns 8+
  const colWidths = [14, 26, 48, 24, 12, 18, 20];
  for (let c = 1; c <= 7; c++) {
    worksheet.getColumn(c).width = colWidths[c - 1];
    worksheet.getColumn(c).hidden = false;
  }
  for (let c = 8; c <= maxScanCol; c++) {
    worksheet.getColumn(c).hidden = true;
    worksheet.getColumn(c).width = 0;
  }

  // 3. Write Table Headers (Row EXPORT_HEADER_ROW)
  const headers7 = [
    'Line Number',
    'Part Number',
    'Description',
    'Estimated Lead Time (Days)',
    'Qty',
    'Unit Net Price',
    'Extended Net Price',
  ];

  const headerRow = worksheet.getRow(EXPORT_HEADER_ROW);
  headerRow.height = 26;
  for (let c = 1; c <= 7; c++) {
    const cell = headerRow.getCell(c);
    cell.value = headers7[c - 1];
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1F1F1F' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // 4. Write Item Rows strictly sequentially directly beneath header
  const completeBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const r = EXPORT_HEADER_ROW + 1 + idx;
    const row = worksheet.getRow(r);
    const isAlternate = idx % 2 === 1;
    const isMain = isMainLineItem(item ? item.lineNumber : '1.0');

    if (item.isInfoRow) {
      // 1. Desplazamiento de Filas Informativas: Descripción exclusivamente en Columna B (Part Number), vacíos en Cols A, C, D, E, F, G
      row.getCell(1).value = '';
      row.getCell(2).value = String(item.description || '').trim();
      row.getCell(3).value = '';
      row.getCell(4).value = '';
      row.getCell(5).value = '';
      row.getCell(6).value = '';
      row.getCell(7).value = '';
      row.height = 20;

      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.border = completeBorder;
        if (isAlternate) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      }

      // Estilo de Columna 1 (vacía)
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 2. Fusión de Celdas (MergeCells): Comienza en Columna 2 (B) y termina en Columna 7 (G)
      try {
        worksheet.mergeCells(r, 2, r, 7);
      } catch (_) {}

      // 3. Estilizado Dinámico (UI Blanca): Celda combinada en Columna 2 (B)
      const mergedCell = row.getCell(2);
      mergedCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false, indent: 1 };
      mergedCell.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF595959' } };

      continue;
    }

    row.getCell(1).value = String(item.lineNumber || '').trim();
    row.getCell(2).value = String(item.partNumber || '').trim();
    row.getCell(3).value = String(item.description || '').trim();
    row.getCell(4).value = String(item.transformedLeadTime || '').trim();
    row.getCell(5).value = typeof item.qty === 'number' && !isNaN(item.qty) ? item.qty : 1;
    row.getCell(6).value = Number(item.precioVentaUnitario) || 0;
    row.getCell(7).value = Number(item.precioVentaExtendido) || 0;

    const descStr = String(row.getCell(3).value || '');
    const lines = Math.max(1, Math.ceil(descStr.length / 36));
    row.height = lines > 1 ? Math.max(22, lines * 16) : 22;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.border = completeBorder;

      if (isAlternate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      if (c === 1) {
        // Line Number: Main item in Bold black font, Sub-item in regular font
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: isMain,
          color: { argb: isMain ? 'FF000000' : 'FF475569' },
        };
      } else if (c === 2) {
        // Part Number: Main item in Bold black font, Sub-item in non-bold with visual indent
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          indent: isMain ? 0 : 1,
        };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: isMain,
          color: { argb: isMain ? 'FF000000' : 'FF334155' },
        };
      } else if (c === 3) {
        // Description: 100% Identical Arial 9 across all rows
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true,
          indent: isMain ? 0 : 1,
        };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: false,
          color: { argb: 'FF1E293B' },
        };
      } else if (c === 4) {
        // Estimated Lead Time
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          name: 'Arial',
          size: 8.5,
          bold: false,
          color: { argb: 'FF64748B' },
        };
      } else if (c === 5) {
        // Qty: Pure Integer Number (NO currency sign, NO decimals)
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: false,
          color: { argb: 'FF0F172A' },
        };
        cell.numFmt = '0';
      } else if (c === 6 || c === 7) {
        // Unit Net Price & Extended Net Price: Clean uniform price (regular font, NOT bold)
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: false,
          color: { argb: 'FF0F172A' },
        };
        cell.numFmt = '"$"#,##0.00';
      }
    }
  }

  // 5. Total Row: Modified label to "Price Total:"
  const totalRow = worksheet.getRow(totalRowIndex);
  totalRow.height = 26;
  for (let c = 1; c <= 7; c++) {
    const cell = totalRow.getCell(c);
    cell.style = {};
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    if (c === 5) {
      cell.value = 'Price Total:';
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c === 7) {
      cell.value = Number(calculatedProductTotal);
      cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '"$"#,##0.00';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
    } else {
      cell.value = null;
    }
  }

  // 6. Clean footer cells
  for (let r = totalRowIndex + 1; r <= maxScanRow; r++) {
    for (let c = 1; c <= 7; c++) {
      const cell = worksheet.getCell(r, c);
      cell.value = null;
      cell.border = undefined;
      cell.fill = undefined;
    }
  }

  // 7. Restore Clean Top Metadata
  try {
    safeUnmerge(worksheet, 'A2:L2');
    safeUnmerge(worksheet, 'A2:G2');
    const titleCell = worksheet.getCell('A2');
    titleCell.value = 'Price Estimate';
    titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = undefined;
    worksheet.mergeCells('A2:G2');

    // Fila 3: Creador y Empresa (Dinámico y Fusión Horizontal)
    safeUnmerge(worksheet, 'A3:D3');
    const creatorName = (headerInfo.customerName || '').trim();
    const companyName = (headerInfo.companyName || '').trim();
    worksheet.getCell('A3').value = [creatorName, companyName].filter(Boolean).join(' | ');
    worksheet.getCell('A3').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('A3').border = undefined;
    worksheet.mergeCells('A3:D3');

    // Fila 4: Dirección Completa Concatenada (Limpieza de "0-0")
    safeUnmerge(worksheet, 'A4:D4');
    const cleanCity = (headerInfo.city || '').replace(/,?\s*0-0/g, '').trim();
    const fullAddress = [headerInfo.address, cleanCity, headerInfo.country]
      .filter(Boolean)
      .join(', ');
      
    worksheet.getCell('A4').value = fullAddress;
    worksheet.getCell('A4').font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
    worksheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('A4').border = undefined;
    worksheet.mergeCells('A4:D4');

    // Fila 5: Teléfono de Contacto
    safeUnmerge(worksheet, 'A5:D5');
    worksheet.getCell('A5').value = headerInfo.phone || '';
    worksheet.getCell('A5').font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
    worksheet.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('A5').border = undefined;
    worksheet.mergeCells('A5:D5');

    // Single Horizontal Red Disclaimer Banner on Row 7 (Merged A7:G7)
    safeUnmerge(worksheet, 'A7:G7');
    safeUnmerge(worksheet, 'A7:L7');
    const noticeCell = worksheet.getCell('A7');
    noticeCell.value =
      'Price Estimate for planning and information purposes only and is not a binding offer from Cisco.';
    noticeCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFBE123C' } };
    noticeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    noticeCell.border = undefined;
    worksheet.mergeCells('A7:G7');

    // Rows 8-10: Clean Date & Metadata (Columns A and E-G)
    const cleanDate = (headerInfo.date || '').replace(/^date:\s*/i, '').trim();
    worksheet.getCell('A8').value = 'Date: ' + (cleanDate || '18-Aug-2026');
    worksheet.getCell('A8').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
    worksheet.getCell('A8').border = undefined;

    worksheet.getCell('E8').value = 'Estimate ID:';
    worksheet.getCell('E8').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
    worksheet.getCell('E8').alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getCell('E8').border = undefined;
    safeUnmerge(worksheet, 'F8:G8');
    worksheet.getCell('F8').value = headerInfo.estimateId;
    worksheet.getCell('F8').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    worksheet.getCell('F8').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('F8').border = undefined;
    worksheet.mergeCells('F8:G8');

    worksheet.getCell('E9').value = 'Deal ID:';
    worksheet.getCell('E9').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
    worksheet.getCell('E9').alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getCell('E9').border = undefined;
    safeUnmerge(worksheet, 'F9:G9');
    worksheet.getCell('F9').value = headerInfo.dealId;
    worksheet.getCell('F9').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    worksheet.getCell('F9').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('F9').border = undefined;
    worksheet.mergeCells('F9:G9');

    worksheet.getCell('E10').value = 'Price List:';
    worksheet.getCell('E10').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
    worksheet.getCell('E10').alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getCell('E10').border = undefined;
    safeUnmerge(worksheet, 'F10:G10');
    worksheet.getCell('F10').value = headerInfo.priceList;
    worksheet.getCell('F10').font = { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } };
    worksheet.getCell('F10').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('F10').border = undefined;
    worksheet.mergeCells('F10:G10');

    // Ensure G11 is clean
    const cellG11 = worksheet.getCell('G11');
    cellG11.value = null;
    cellG11.style = {};

    // Row 12: Notice aligned to right immediately above "Extended Net Price"
    worksheet.getCell('G12').value = 'All prices are shown in USD';
    worksheet.getCell('G12').font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF475569' } };
    worksheet.getCell('G12').alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getCell('G12').border = undefined;

    // Row lastItemRow + 3: 14-day validity single notice
    const noticeRowIdx = totalRowIndex + 2;
    safeUnmerge(worksheet, `A${noticeRowIdx}:G${noticeRowIdx}`);
    const validityCell = worksheet.getCell(`A${noticeRowIdx}`);
    validityCell.value = {
      richText: [
        { text: 'Validez de la Oferta: ', font: { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } } },
        { text: 'Esta cotización tiene una validez de ', font: { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } } },
        { text: '14 días corridos', font: { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFCC0000' } } },
        { text: ' a contar de su fecha de emisión.', font: { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } } },
      ],
    };
    validityCell.alignment = { horizontal: 'left', vertical: 'middle' };
    validityCell.border = undefined;
    worksheet.mergeCells(`A${noticeRowIdx}:G${noticeRowIdx}`);
  } catch (err) {
    console.warn('Metadata restoration note:', err);
  }

  // 8. Inject Intcomex Logo (Single instance, in A1 up to A3, non-duplicated)
  try {
    (worksheet as any)._media = [];
    if ((worksheet as any).model && (worksheet as any).model.media) {
      (worksheet as any).model.media = [];
    }

    const logoImageId = workbook.addImage({
      base64: INTCOMEX_LOGO_RAW_BASE64,
      extension: 'png',
    });

    worksheet.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 140, height: 28 },
      editAs: 'oneCell',
    });
  } catch (e) {
    console.warn('Logo injection note:', e);
  }

  worksheet.views = [{ showGridLines: false }];

  worksheet.columns = [
    { width: 12 }, // Line Number
    { width: 20 }, // Part Number
    { width: 32 }, // Description
    { width: 24 }, // Lead Time
    { width: 8  }, // Qty
    { width: 15 }, // Unit Net Price
    { width: 18 }, // Extended Net Price
  ];

  const validityRow = totalRowIndex + 2;
  const validityCell = worksheet.getCell(`A${validityRow}`);
  validityCell.value = {
    richText: [
      {
        text: 'Validez de la Oferta: Esta cotización tiene una validez de ',
        font: { name: 'Arial', size: 8, color: { argb: 'FF333333' } },
      },
      {
        text: '14 días',
        font: { name: 'Arial', size: 8, bold: true, color: { argb: 'FFCC0000' } },
      },
      {
        text: ' corridos a contar de su fecha de emisión.',
        font: { name: 'Arial', size: 8, color: { argb: 'FF333333' } },
      },
    ],
  };
  validityCell.font = { name: 'Arial', size: 8, color: { argb: 'FF333333' } };
  validityCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
  validityCell.border = undefined;
  validityCell.fill = undefined;

  sanitizeWorkbookForExport(workbook);

  const buf = await workbook.xlsx.writeBuffer();
  const modifiedBuffer =
    buf instanceof ArrayBuffer ? buf : (new Uint8Array(buf).buffer as ArrayBuffer);

  const outputFileName = suggestFileName(fileName);

  const result: ProcessedEstimateResult = {
    fileName: outputFileName,
    headerInfo,
    items,
    originalProductTotal: Math.round(originalProductTotal * 100) / 100,
    calculatedProductTotal,
    serviceTotal: 0.0,
    subscriptionTotal: 0.0,
    finalTotalPrice: calculatedProductTotal,
    headerRowIndex: EXPORT_HEADER_ROW,
    workbookBuffer: modifiedBuffer,
  };

  return { result, modifiedBuffer };
}

/**
 * Creates Sample Cisco CCW Estimate workbook.
 */
export async function createSampleEstimateWorkbook(): Promise<{
  arrayBuffer: ArrayBuffer;
  fileName: string;
}> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Price Estimate');

  try {
    const logoImageId = workbook.addImage({
      base64: INTCOMEX_LOGO_RAW_BASE64,
      extension: 'png',
    });

    worksheet.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 32 },
      editAs: 'oneCell',
    });
  } catch (e) {
    console.warn('Sample logo error:', e);
  }

  worksheet.getCell('A2').value = 'Price Estimate';
  worksheet.getCell('A2').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };
  worksheet.mergeCells('A2:L2');

  worksheet.getCell('A3').value = 'Mauricio Skill';
  worksheet.getCell('A3').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  worksheet.getCell('A4').value = 'INTCOMEX CHILE SA';
  worksheet.getCell('A4').font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
  worksheet.getCell('A5').value = 'ROSARIO NORTE 615, PISO 6';
  worksheet.getCell('A5').font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
  worksheet.getCell('A6').value = 'SANTIAGO, 0-0';
  worksheet.getCell('A6').font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
  worksheet.getCell('A7').value = 'CHILE';
  worksheet.getCell('A7').font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
  worksheet.getCell('A8').value = 'Ph no:+56 223637100';
  worksheet.getCell('A8').font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };

  worksheet.getCell('L13').value = '011682708571Z';
  worksheet.getCell('L14').value = 'NA';
  worksheet.getCell('L15').value = 'Global Price List Latin America Availability (USD)';
  worksheet.getCell('A13').value = '09-Aug-2026';

  const headers = [
    'Line Number',
    'Part Number',
    'Smart Account Mandatory',
    'Description',
    'Service Duration (Months)',
    'Lead Time (Days)',
    'Unit List Price',
    'Pricing Term',
    'Qty',
    'Unit Net Price',
    'Disc (%)',
    'Extended Net Price',
  ];

  const headerRow = worksheet.getRow(18);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  const sampleData = [
    {
      line: '1.0',
      part: 'C9200L-24P-4G-E',
      smart: 'Required',
      desc: 'Catalyst 9200L 24-port PoE+ Network Essentials, with advanced enterprise routing and switching capabilities',
      dur: '---',
      leadDays: 35,
      listPrice: 2800.0,
      term: '',
      qty: 1,
      netPrice: 1400.0,
      disc: 50.0,
      extPrice: 1400.0,
    },
    {
      line: '1.1',
      part: 'C9200-STACK-BLANK',
      smart: '-',
      desc: 'Catalyst 9200 Blank Stack Module',
      dur: '---',
      leadDays: 14,
      listPrice: 50.0,
      term: '',
      qty: 1,
      netPrice: 25.0,
      disc: 50.0,
      extPrice: 25.0,
    },
    {
      line: '1.2',
      part: 'C9200L-DNA-E-24',
      smart: 'Required',
      desc: 'C9200L Cisco DNA Essentials, 24-port Term License for Network Visibility and Automation',
      dur: '36',
      leadDays: 1,
      listPrice: 380.0,
      term: '36 Mo',
      qty: 1,
      netPrice: 190.0,
      disc: 50.0,
      extPrice: 190.0,
    },
    {
      line: '2.0',
      part: 'NETWORK-PNP-LIC',
      smart: '-',
      desc: 'Network Plug and Play License',
      dur: '---',
      leadDays: 1,
      listPrice: 0.0,
      term: '',
      qty: 1,
      netPrice: 0.0,
      disc: 0.0,
      extPrice: 0.0,
    },
    {
      line: '3.0',
      part: 'CON-SNT-C920024E',
      smart: '-',
      desc: 'SNTC-8X5XNBD Catalyst 9200 24-port Enhanced Hardware and Software Support Agreement',
      dur: '36',
      leadDays: 1,
      listPrice: 680.0,
      term: '36 Mo',
      qty: 1,
      netPrice: 340.0,
      disc: 50.0,
      extPrice: 340.0,
    },
    {
      line: '4.0',
      part: 'PWR-C1-1100WAC=',
      smart: '-',
      desc: '1100W AC Config 1 Power Supply Spare Unit =',
      dur: '---',
      leadDays: 14,
      listPrice: 1200.0,
      term: '',
      qty: 2,
      netPrice: 600.0,
      disc: 50.0,
      extPrice: 1200.0,
    },
  ];

  sampleData.forEach((item, index) => {
    const rowNum = 19 + index;
    const row = worksheet.getRow(rowNum);
    row.getCell(1).value = item.line;
    row.getCell(2).value = item.part;
    row.getCell(3).value = item.smart;
    row.getCell(4).value = item.desc;
    row.getCell(5).value = item.dur;
    row.getCell(6).value = item.leadDays;
    row.getCell(7).value = item.listPrice;
    row.getCell(8).value = item.term;
    row.getCell(9).value = item.qty;
    row.getCell(10).value = item.netPrice;
    row.getCell(11).value = item.disc;
    row.getCell(12).value = item.extPrice;
  });

  worksheet.views = [{ showGridLines: false }];
  sanitizeWorkbookForExport(workbook);

  const buf = await workbook.xlsx.writeBuffer();
  const arrayBuffer = buf instanceof ArrayBuffer ? buf : (new Uint8Array(buf).buffer as ArrayBuffer);

  return {
    arrayBuffer,
    fileName: 'Intcomex_BancoDeChile_Estimate_CiscoCCW_2026.xlsx',
  };
}
