// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R PARSER
// Ingesta y Extracción Inteligente de Cotizaciones Cisco CCW-R (.xlsx / .xls / .csv)
// ============================================================================

import * as XLSX from 'xlsx';
import { CcwrHeaderInfo, CcwrLineItem, CcwrQuoteParameters } from './ccwrTypes';
import { safeParseFloat, roundFinancial } from '../../core/calculations';

const SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Convierte un número de serie de fecha de Excel o string a formato legible Intcomex "DD-mmm-YYYY" (ej: "03-nov-2026")
 */
export function formatCcwrDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  if (typeof val === 'number' && val > 30000 && val < 60000) {
    // Serial de fecha Excel
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = SPANISH_MONTHS[date.getUTCMonth()];
      const year = date.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  // Si ya viene como "03-nov-2026" o similar
  if (/^\d{2}-[a-zA-Z]{3}-\d{4}$/.test(str)) {
    return str.toLowerCase();
  }

  // Parsear fecha ISO o tradicional "YYYY-MM-DD" o "DD/MM/YYYY"
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const day = String(d.getDate()).padStart(2, '0');
    const month = SPANISH_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return str;
}

/**
 * Limpieza y sanitización de cadenas
 */
function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Parser principal de archivos exportados desde Cisco CCW-R
 */
export function parseCcwrWorkbook(
  fileBuffer: ArrayBuffer | Uint8Array,
  fileName: string = 'Cotizacion_CCWR.xlsx'
): { headerInfo: CcwrHeaderInfo; items: CcwrLineItem[] } {
  const wb = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('El archivo Excel no contiene ninguna hoja válida.');
  }

  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 5) {
    throw new Error('El archivo no contiene suficientes filas para ser una cotización CCW-R válida.');
  }

  // 1. Extracción de Metadatos de Cabecera (Fila 0 a 29)
  const headerInfo: CcwrHeaderInfo = {
    quoteNumber: cleanStr(sheetName), // Fallback: nombre de la pestaña (ej: 452055115)
  };

  for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    for (let c = 0; c < row.length; c++) {
      const cellText = cleanStr(row[c]).toLowerCase();
      const nextCell = cleanStr(row[c + 1]);

      if (cellText === 'quote number' && nextCell) {
        headerInfo.quoteNumber = nextCell;
      } else if (cellText === 'quote name' && nextCell) {
        headerInfo.quoteName = nextCell;
      } else if (cellText === 'date' && nextCell) {
        headerInfo.quoteDate = formatCcwrDate(row[c + 1]);
      } else if (cellText === 'price protection expiry date' && nextCell) {
        headerInfo.priceProtectionExpiryDate = formatCcwrDate(row[c + 1]);
      } else if (cellText === 'buy method' && nextCell) {
        headerInfo.buyMethod = nextCell;
      } else if (cellText === 'quote net amount' && nextCell) {
        headerInfo.quoteNetAmount = safeParseFloat(nextCell);
      } else if (cellText === 'reseller net amount' && nextCell) {
        headerInfo.resellerNetAmount = safeParseFloat(nextCell);
      } else if (cellText === 'quote extended list price' && nextCell) {
        headerInfo.quoteExtendedListPrice = safeParseFloat(nextCell);
      } else if (cellText === 'deal id' && nextCell) {
        headerInfo.dealId = nextCell;
      }
    }
  }

  // 2. Localizar Fila de Encabezados de Tabla (Típicamente fila 30)
  let tableHeaderRowIndex = -1;
  const colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rawRows.length, 60); r++) {
    const row = rawRows[r].map((cell) => cleanStr(cell).toLowerCase());

    const hasProductNumber = row.some((h) => h === 'product number' || h.includes('product number'));
    const hasSerial = row.some((h) => h.includes('serial') || h.includes('pak'));
    const hasNetPrice = row.some((h) => h.includes('extended net price') || h.includes('net price'));

    if (hasProductNumber && (hasSerial || hasNetPrice)) {
      tableHeaderRowIndex = r;

      // Mapear columnas dinámicamente con selectores exactos
      row.forEach((colName, idx) => {
        if (colName === 'product number') colMap['productNumber'] = idx;
        else if (colName === 'product description') colMap['productDescription'] = idx;
        else if (colName.includes('last date of support')) colMap['lastDateOfSupport'] = idx;
        else if (colName === 'pak/serial number' || (colName.includes('serial') && !colName.includes('reference'))) colMap['serialNumber'] = idx;
        else if (colName === 'instance number') colMap['instanceNumber'] = idx;
        else if (colName.includes('major/minor') || colName === 'major minor') colMap['majorMinor'] = idx;
        else if (colName === 'service level') colMap['serviceLevel'] = idx;
        else if (colName === 'service level description') colMap['serviceLevelDescription'] = idx;
        else if (colName === 'sku' || colName === 'service sku') colMap['serviceSku'] = idx;
        else if (colName === 'service type') colMap['serviceType'] = idx;
        else if (colName === 'start date') colMap['startDate'] = idx;
        else if (colName === 'end date') colMap['endDate'] = idx;
        else if (colName === 'quantity') colMap['quantity'] = idx;
        else if (colName === 'unit list price') colMap['unitListPrice'] = idx;
        else if (colName === 'prorated list price') colMap['proratedListPrice'] = idx;
        else if (colName === 'total discounts') colMap['totalDiscounts'] = idx;
        else if (colName === 'extended net price') colMap['extendedNetPrice'] = idx; // Columna Z
        else if (colName === 'end customer gu id') colMap['endCustomerGuId'] = idx;
        else if (colName === 'end customer gu name') colMap['endCustomerGuName'] = idx;
        else if (colName === 'end customer id') colMap['endCustomerId'] = idx;
        else if (colName === 'end customer name') colMap['endCustomerName'] = idx;
        else if (colName.includes('end customer address line 1')) colMap['addressLine1'] = idx;
        else if (colName.includes('end customer address line 2')) colMap['addressLine2'] = idx;
        else if (colName.includes('end customer city')) colMap['city'] = idx;
        else if (colName.includes('end customer state')) colMap['state'] = idx;
        else if (colName.includes('end customer country')) colMap['country'] = idx;
        else if (colName.includes('price protection expiry date')) colMap['linePriceProtection'] = idx;
      });

      break;
    }
  }

  if (tableHeaderRowIndex === -1) {
    throw new Error('No se encontró la cabecera de la tabla de detalles en el archivo CCW-R.');
  }

  // Fallbacks estándar según especificación CCW-R de 74 columnas si alguna fallara
  const getColIdx = (key: string, fallback: number): number => {
    return colMap[key] !== undefined ? colMap[key] : fallback;
  };

  const idxPn = getColIdx('productNumber', 0);
  const idxDesc = getColIdx('productDescription', 1);
  const idxSerial = getColIdx('serialNumber', 3);
  const idxInstance = getColIdx('instanceNumber', 4);
  const idxMajorMinor = getColIdx('majorMinor', 5);
  const idxServiceLevel = getColIdx('serviceLevel', 9);
  const idxServiceDesc = getColIdx('serviceLevelDescription', 10);
  const idxSku = getColIdx('serviceSku', 11);
  const idxServiceType = getColIdx('serviceType', 12);
  const idxStartDate = getColIdx('startDate', 16);
  const idxEndDate = getColIdx('endDate', 17);
  const idxQty = getColIdx('quantity', 18);
  const idxUnitList = getColIdx('unitListPrice', 22);
  const idxProrated = getColIdx('proratedListPrice', 23);
  const idxDiscounts = getColIdx('totalDiscounts', 24);
  const idxExtendedNet = getColIdx('extendedNetPrice', 25); // Col Z
  const idxCustId = getColIdx('endCustomerId', 29);
  const idxCustName = getColIdx('endCustomerName', 30);
  const idxAddr1 = getColIdx('addressLine1', 31);
  const idxAddr2 = getColIdx('addressLine2', 32);

  const items: CcwrLineItem[] = [];
  const dataRows = rawRows.slice(tableHeaderRowIndex + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const pn = cleanStr(row[idxPn]);
    const desc = cleanStr(row[idxDesc]);
    const serial = cleanStr(row[idxSerial]);
    const sku = cleanStr(row[idxSku]);
    const extNet = safeParseFloat(row[idxExtendedNet]);

    // Omitir filas en blanco al final de la hoja
    if (!pn && !serial && !sku && extNet === 0) continue;

    const qty = safeParseFloat(row[idxQty]) || 1;
    const unitNet = qty > 0 ? extNet / qty : extNet;
    const custId = cleanStr(row[idxCustId]);
    const custName = cleanStr(row[idxCustName]);
    const addr1 = cleanStr(row[idxAddr1]);
    const addr2 = cleanStr(row[idxAddr2]);
    const fullAddr = [addr1, addr2].filter(Boolean).join(', ');

    // Capturar cliente en header si aún no estaba presente
    if (!headerInfo.endCustomerName && custName) {
      headerInfo.endCustomerName = custName;
    }
    if (!headerInfo.endCustomerId && custId) {
      headerInfo.endCustomerId = custId;
    }
    if (!headerInfo.endCustomerAddressLine1 && addr1) {
      headerInfo.endCustomerAddressLine1 = addr1;
      headerInfo.endCustomerAddressLine2 = addr2;
    }

    const isServiceOrLicense = Boolean(sku) || extNet > 0;

    const item: CcwrLineItem = {
      id: `ccwr_line_${i + 1}_${Date.now()}`,
      lineNumber: i + 1,
      productNumber: pn,
      productDescription: desc,
      serialNumber: serial,
      instanceNumber: cleanStr(row[idxInstance]),
      majorMinor: cleanStr(row[idxMajorMinor]),
      serviceLevel: cleanStr(row[idxServiceLevel]) || 'SNT',
      serviceLevelDescription: cleanStr(row[idxServiceDesc]) || 'BAS 8X5XNBD',
      serviceSku: sku,
      serviceType: cleanStr(row[idxServiceType]),
      startDate: formatCcwrDate(row[idxStartDate]),
      endDate: formatCcwrDate(row[idxEndDate]),
      quantity: qty,
      unitListPrice: safeParseFloat(row[idxUnitList]),
      proratedListPrice: safeParseFloat(row[idxProrated]),
      totalDiscounts: safeParseFloat(row[idxDiscounts]),
      extendedNetPrice: roundFinancial(extNet), // Col Z directa
      unitNetPrice: roundFinancial(unitNet),
      endCustomerId: custId,
      endCustomerName: custName,
      endCustomerAddress: fullAddr,
      isServiceOrLicense,
      costoNetoUnitario: roundFinancial(unitNet),
      costoArancel: 0,
      costoInternacion: 0,
      costoTotalUnitario: roundFinancial(unitNet),
      precioVentaUnitario: 0,
      precioVentaExtendido: 0,
    };

    items.push(item);
  }

  return { headerInfo, items };
}
