// ============================================================================
// TESTS: ESTIMATE GROUPED EXPORT, PDF, PARTNER EMAIL & CLP REFERENCE
// ============================================================================

import ExcelJS from 'exceljs';
import {
  categorizeEstimateItems,
  generatePartnerEmailDraft,
  generateCommercialPdfHtml,
  EstimateExportGroupingOptions,
} from '../src/modules/estimate/estimateExportHelper';
import { synthesizeOfficialEstimateWorkbook, isFooterOrNoteRow } from '../src/core/excelEngine';
import { EstimateLineItem, ProcessedEstimateResult, QuoteParameters } from '../src/core/types';

// Mock items: Línea 1.0 (Hardware switch + power cord) & Línea 2.0 (DNA Cloud License + Info Row)
const mockItems: EstimateLineItem[] = [
  {
    lineNumber: '1.0',
    partNumber: 'C9200L-24P-4G-E',
    description: 'Catalyst 9200L 24-port PoE+ 4x1G uplink',
    serviceDurationMonths: '0',
    unitListPrice: 3200,
    unitNetPriceCcw: 1280,
    discPct: 60,
    qty: 2,
    precioVentaUnitario: 1450.50,
    precioVentaExtendido: 2901.00,
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 days',
    isInfoRow: false,
  },
  {
    lineNumber: '1.1',
    partNumber: 'PWR-C5-1KWAC',
    description: '1KW AC Config 5 Power Supply',
    serviceDurationMonths: '0',
    unitListPrice: 450,
    unitNetPriceCcw: 180,
    discPct: 60,
    qty: 2,
    precioVentaUnitario: 204.00,
    precioVentaExtendido: 408.00,
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 days',
    isInfoRow: false,
  },
  {
    lineNumber: '2.0',
    partNumber: 'C9200L-DNA-E-24-3Y',
    description: 'C9200L Cisco DNA Essentials 24-port, 3 Year Term',
    serviceDurationMonths: '36',
    unitListPrice: 900,
    unitNetPriceCcw: 450,
    discPct: 50,
    qty: 2,
    precioVentaUnitario: 510.00,
    precioVentaExtendido: 1020.00,
    originalLeadTimeDays: 1,
    transformedLeadTime: '1 day',
    isInfoRow: false,
    isPeriodicSubscription: true,
  },
  {
    lineNumber: '',
    partNumber: '',
    description: 'Initial Term: 36.00 Months | Auto Renewal Term: 0 Months | Billing Model: Prepaid',
    serviceDurationMonths: '0',
    unitListPrice: 0,
    unitNetPriceCcw: 0,
    discPct: 0,
    qty: 0,
    precioVentaUnitario: 0,
    precioVentaExtendido: 0,
    originalLeadTimeDays: 0,
    transformedLeadTime: '',
    isInfoRow: true,
  },
];

const mockResult: ProcessedEstimateResult = {
  fileName: 'Test_Partner_Cliente_Cisco_EST123.xlsx',
  headerInfo: {
    companyName: 'Intcomex Chile',
    customerName: 'Banco Santander',
    estimateId: 'EST-998877',
    dealId: 'DEAL-554433',
    date: '24-Oct-2026',
    priceList: 'GLOBAL PRICE LIST',
    address: 'Av. Andrés Bello 2777',
    city: 'Las Condes',
    country: 'Chile',
    phone: '+56 2 2555 1234',
  },
  items: mockItems,
  originalProductTotal: 1910.00,
  calculatedProductTotal: 4329.00, // 2901 + 408 + 1020
  serviceTotal: 0,
  subscriptionTotal: 1020.00,
  finalTotalPrice: 4329.00,
  headerRowIndex: 13,
  workbookBuffer: new ArrayBuffer(0),
};

const mockParams: QuoteParameters = {
  internacionPct: 7.0,
  arancelPct: 6.0,
  margenPct: 5.0,
  parameterMode: 'standard',
};

async function runTests() {
  console.log('--- TEST 1: categorizeEstimateItems (Hardware vs Software vs Mother Lines) ---');
  const summary = categorizeEstimateItems(mockItems);
  console.log('Hardware Total:', summary.hardwareTotal, '(Expected: 3309.00)');
  console.log('Software Total:', summary.softwareTotal, '(Expected: 1020.00)');
  console.log('Grand Total:', summary.grandTotal, '(Expected: 4329.00)');
  console.log('Total Mother Lines:', summary.motherLines.length, '(Expected: 2)');

  if (summary.hardwareTotal !== 3309.00) throw new Error('Hardware total mismatch');
  if (summary.softwareTotal !== 1020.00) throw new Error('Software total mismatch');
  if (summary.grandTotal !== 4329.00) throw new Error('Grand total mismatch');
  if (summary.motherLines.length !== 2) throw new Error('Mother lines count mismatch');

  const line1 = summary.motherLines.find((m) => m.motherKey === '1.0')!;
  const line2 = summary.motherLines.find((m) => m.motherKey === '2.0')!;
  if (line1.subtotal !== 3309.00) throw new Error('Line 1 subtotal mismatch');
  if (line2.subtotal !== 1020.00) throw new Error('Line 2 subtotal mismatch');
  console.log('✓ TEST 1 PASSED: Categorization and line mother grouping accurate.');

  console.log('\n--- TEST 2: Filter by single mother line (selectedLine: "1.0") ---');
  const summaryFiltered = categorizeEstimateItems(mockItems, '1.0');
  if (summaryFiltered.grandTotal !== 3309.00) throw new Error('Filtered total mismatch');
  if (summaryFiltered.motherLines.length !== 1) throw new Error('Filtered mother lines count mismatch');
  console.log('✓ TEST 2 PASSED: Single line mother filtering accurate.');

  console.log('\n--- TEST 3: generatePartnerEmailDraft (Outlook) ---');
  const emailDraft = generatePartnerEmailDraft({
    partnerName: 'Logicalis Chile',
    clientName: 'Banco Santander',
    dealId: 'DEAL-554433',
    estimateId: 'EST-998877',
    summary,
    groupingOptions: {
      groupByLine: true,
      enableClp: true,
      clpExchangeRate: 950,
      showExecutiveSummary: true,
    },
  });

  if (!emailDraft.subject.includes('DEAL-554433')) throw new Error('Subject missing Deal ID');
  if (!emailDraft.subject.includes('EST-998877')) throw new Error('Subject missing Estimate ID');
  if (!emailDraft.bodyText.startsWith('Estimados,')) throw new Error('Email must start with "Estimados,"');
  if (!emailDraft.bodyText.includes('14 días corridos')) throw new Error('Missing validity clause');
  if (!emailDraft.bodyText.includes('Validación Técnica y Responsabilidad')) throw new Error('Missing technical validation clause');
  if (!emailDraft.bodyText.includes('950 CLP/USD')) throw new Error('Missing CLP rate');
  if (!emailDraft.bodyHtml.includes('🔧 Equipamiento Hardware')) throw new Error('HTML missing Hardware row');
  if (!emailDraft.bodyHtml.includes('☁️ Licenciamiento / Cloud')) throw new Error('HTML missing Cloud row');
  console.log('✓ TEST 3 PASSED: Partner email draft contains professional greetings, clauses, and CLP.');

  console.log('\n--- TEST 4: generateCommercialPdfHtml ---');
  const pdfHtml = generateCommercialPdfHtml({
    headerInfo: mockResult.headerInfo,
    partnerName: 'Logicalis Chile',
    clientName: 'Banco Santander',
    summary,
    groupingOptions: {
      groupByLine: true,
      enableClp: true,
      clpExchangeRate: 950,
      showExecutiveSummary: true,
    },
  });

  if (!pdfHtml.includes('@page') || !pdfHtml.includes('size: letter portrait;')) throw new Error('PDF CSS missing page settings');
  if (!pdfHtml.includes('PROPUESTA COMERCIAL')) throw new Error('PDF missing commercial title');
  if (!pdfHtml.includes('Bloque Línea 1.0')) throw new Error('PDF missing Line 1.0 header');
  if (!pdfHtml.includes('Subtotal Línea 1.0:')) throw new Error('PDF missing Line 1.0 subtotal');
  if (!pdfHtml.includes('Subtotal Línea 2.0:')) throw new Error('PDF missing Line 2.0 subtotal');
  if (!pdfHtml.includes('PRICE TOTAL (USD):')) throw new Error('PDF missing Grand Total');
  if (!pdfHtml.includes('Validación Técnica y Responsabilidad:')) throw new Error('PDF missing technical validation clause');
  console.log('✓ TEST 4 PASSED: Commercial PDF HTML template renders perfectly.');

  console.log('\n--- TEST 5: synthesizeOfficialEstimateWorkbook with Grouping & CLP ---');
  const exportGroupingOpts: EstimateExportGroupingOptions = {
    groupByLine: true,
    showExecutiveSummary: true,
    enableClp: true,
    clpExchangeRate: 950,
  };

  const buffer = await synthesizeOfficialEstimateWorkbook(
    mockResult,
    mockParams,
    undefined,
    exportGroupingOpts
  );

  if (!buffer || buffer.byteLength === 0) throw new Error('Excel buffer is empty');

  // Verify created Excel structure with ExcelJS
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.getWorksheet('Price Estimate')!;
  if (!ws) throw new Error('Worksheet "Price Estimate" not found');

  // Check title
  if (ws.getCell('A2').value !== 'Price Estimate') throw new Error('Title A2 mismatch');

  // Search for mother line blocks and subtotals
  let foundBlock1 = false;
  let foundBlock2 = false;
  let foundSubtotal1 = false;
  let foundSubtotal2 = false;
  let foundPriceTotal = false;
  let foundClpRow = false;
  let foundExecSummary = false;
  let foundValidity = false;
  let foundTechnicalValidation = false;

  for (let r = 13; r <= ws.rowCount; r++) {
    const rawVal = ws.getCell(r, 1).value;
    const aVal =
      typeof rawVal === 'object' && rawVal !== null && 'richText' in (rawVal as any)
        ? (rawVal as any).richText.map((t: any) => t.text).join('')
        : String(rawVal || '');
    const bVal = String(ws.getCell(r, 2).value || '');
    const gVal = ws.getCell(r, 7).value;

    if (aVal.includes('Bloque Línea 1.0')) foundBlock1 = true;
    if (aVal.includes('Bloque Línea 2.0')) foundBlock2 = true;
    if (bVal.includes('Subtotal Línea 1.0:')) {
      foundSubtotal1 = true;
      if (typeof gVal === 'object' && gVal !== null && 'formula' in gVal) {
        console.log(`Subtotal 1 formula at row ${r}:`, (gVal as any).formula, 'Result:', (gVal as any).result);
      }
    }
    if (bVal.includes('Subtotal Línea 2.0:')) {
      foundSubtotal2 = true;
      if (typeof gVal === 'object' && gVal !== null && 'formula' in gVal) {
        console.log(`Subtotal 2 formula at row ${r}:`, (gVal as any).formula, 'Result:', (gVal as any).result);
      }
    }
    if (bVal === 'Price Total:') {
      foundPriceTotal = true;
      console.log(`Price Total row ${r}:`, gVal);
    }
    if (aVal.includes('Total Solución Referencial')) foundClpRow = true;
    if (aVal.includes('Resumen Ejecutivo de la Solución')) foundExecSummary = true;
    if (aVal.includes('Validez de la Oferta:')) foundValidity = true;
    if (aVal.includes('Validación Técnica y Responsabilidad:')) foundTechnicalValidation = true;
  }

  if (!foundBlock1) throw new Error('Missing Bloque Línea 1.0 header');
  if (!foundBlock2) throw new Error('Missing Bloque Línea 2.0 header');
  if (!foundSubtotal1) throw new Error('Missing Subtotal Línea 1.0 row');
  if (!foundSubtotal2) throw new Error('Missing Subtotal Línea 2.0 row');
  if (!foundPriceTotal) throw new Error('Missing Price Total row');
  if (!foundClpRow) throw new Error('Missing CLP row');
  if (!foundExecSummary) throw new Error('Missing Executive Summary card');
  if (!foundValidity) throw new Error('Missing Validity clause');
  if (!foundTechnicalValidation) throw new Error('Missing Technical Validation clause');

  // Verify hidden sheet sys_metadata
  const metaSheet = wb.getWorksheet('sys_metadata');
  if (!metaSheet) throw new Error('Missing sys_metadata worksheet');
  if (metaSheet.state !== 'veryHidden') throw new Error('sys_metadata should be veryHidden');
  console.log('✓ TEST 5 PASSED: Synthesized grouped Excel with subtotals, formulas, CLP, and sys_metadata intact.');

  console.log('\n--- TEST 6: Re-import protection (isFooterOrNoteRow) ---');
  if (!isFooterOrNoteRow('', 'Subtotal Línea 1.0:', '')) throw new Error('isFooterOrNoteRow should detect subtotal row');
  if (!isFooterOrNoteRow('', 'Price Total:', '')) throw new Error('isFooterOrNoteRow should detect total row');
  if (!isFooterOrNoteRow('Resumen Ejecutivo de la Solución', '', '')) throw new Error('isFooterOrNoteRow should detect executive summary');
  if (isFooterOrNoteRow('1.0', 'C9200L-24P-4G-E', 'Catalyst')) throw new Error('isFooterOrNoteRow should NEVER trigger on valid item');
  console.log('✓ TEST 6 PASSED: Re-import protection correctly skips subtotals and executive summaries.');

  console.log('\n🎉 ALL 6 SUITE TESTS PASSED 100% SUCCESFULLY!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
