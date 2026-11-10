// ============================================================================
// CISCO AUTOMATED - DETECTOR DE FORMATO DE ARCHIVOS CISCO (v2.10.0)
// Distingue entre Price Estimate (Hardware/Software CCW) y Cotizaciones CCW-R
// (Servicios, Contratos SmartNet y Licencias con números de serie y 74 columnas)
// ============================================================================

import * as XLSX from 'xlsx';

export type CiscoFileType = 'ccwr_quote' | 'ccw_estimate' | 'unknown';

export interface CiscoFileDetectionResult {
  fileType: CiscoFileType;
  quoteNumber?: string;
  estimateId?: string;
  dealId?: string;
  customerName?: string;
  summary: string;
}

/**
 * Inspecciona un ArrayBuffer o Uint8Array de Excel (.xlsx, .xls) y detecta con precisión
 * si se trata de un Price Estimate de Cisco CCW o una Cotización CCW-R de Servicios.
 */
export function detectCiscoFileType(buffer: ArrayBuffer | Uint8Array): CiscoFileDetectionResult {
  try {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', sheetRows: 50 });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { fileType: 'unknown', summary: 'Archivo vacío o sin hojas válidas.' };
    }

    const ws = wb.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let hasEstimateId = false;
    let hasPriceEstimateTitle = false;
    let hasQuoteNumber = false;
    let hasBuyMethod = false;
    let hasPakSerial = false;
    let hasServiceLevelDesc = false;
    let hasCcwLineCol = false;
    let hasQuoteNetAmount = false;

    let quoteNumVal = '';
    let estimateIdVal = '';
    let dealIdVal = '';
    let customerVal = '';

    for (let r = 0; r < Math.min(rawRows.length, 45); r++) {
      const row = rawRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();
        const nextVal = String(row[c + 1] || '').trim();

        if (val === 'quote number' || val.startsWith('quote number:') || val === 'quote #') {
          hasQuoteNumber = true;
          if (nextVal && !quoteNumVal) quoteNumVal = nextVal;
        } else if (val === 'buy method' || val.includes('buy method:')) {
          hasBuyMethod = true;
        } else if (val === 'quote net amount' || val.includes('quote net amount') || val === 'reseller net amount') {
          hasQuoteNetAmount = true;
        } else if (val === 'estimate id' || val.startsWith('estimate id:') || val === 'estimate #') {
          hasEstimateId = true;
          if (nextVal && !estimateIdVal) estimateIdVal = nextVal;
        } else if (val === 'price estimate' || val.includes('price estimate')) {
          hasPriceEstimateTitle = true;
        } else if (val === 'pak/serial number' || val === 'serial number' || val.includes('pak/serial')) {
          hasPakSerial = true;
        } else if (val === 'service level description' || val === 'service level') {
          hasServiceLevelDesc = true;
        } else if (val === 'line #' || val === 'line number' || val === 'line') {
          hasCcwLineCol = true;
        } else if (val === 'deal id' || val.startsWith('deal id:')) {
          if (nextVal && !dealIdVal) dealIdVal = nextVal;
        } else if (val === 'end customer name' || val === 'customer name' || val.startsWith('customer:')) {
          if (nextVal && !customerVal) customerVal = nextVal;
        }
      }
    }

    // 1. Verificación de Cotización Cisco CCW-R (Servicios / Licencias)
    if (
      (hasQuoteNumber && (hasBuyMethod || hasPakSerial || hasServiceLevelDesc || hasQuoteNetAmount)) ||
      (hasPakSerial && hasServiceLevelDesc) ||
      (hasQuoteNumber && !hasEstimateId && !hasPriceEstimateTitle)
    ) {
      const qNum = quoteNumVal || (/^\d{8,12}$/.test(sheetName) ? sheetName : '');
      return {
        fileType: 'ccwr_quote',
        quoteNumber: qNum,
        dealId: dealIdVal,
        customerName: customerVal,
        summary: `Cotización de Servicios y Licencias Cisco CCW-R${qNum ? ` (#${qNum})` : ''}`,
      };
    }

    // 2. Verificación de Price Estimate Cisco CCW (Hardware / Software)
    if (hasEstimateId || hasPriceEstimateTitle || hasCcwLineCol) {
      return {
        fileType: 'ccw_estimate',
        estimateId: estimateIdVal,
        dealId: dealIdVal,
        customerName: customerVal,
        summary: `Price Estimate Cisco CCW${estimateIdVal ? ` (#${estimateIdVal})` : ''}`,
      };
    }

    return {
      fileType: 'unknown',
      summary: 'Formato no clasificado como CCW Estimate ni CCW-R Quote.',
    };
  } catch (err: any) {
    return {
      fileType: 'unknown',
      summary: `Error analizando estructura: ${err?.message || 'Error desconocido'}`,
    };
  }
}
