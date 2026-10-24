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
import { synthesizeOfficialEstimateWorkbook, isFooterOrNoteRow, parseEstimateWorkbook } from '../src/core/excelEngine';
import { EstimateLineItem, ProcessedEstimateResult, QuoteParameters } from '../src/core/types';

// Mock items: Línea 1.0 (Hardware switch + power cord) & Línea 2.0 (DNA Cloud License + Info Row)
const mockItems: EstimateLineItem[] = [
  {
    rowIdx: 14,
    lineNumber: '1.0',
    partNumber: 'C9200L-24P-4G-E',
    smartAccountMandatory: 'No',
    description: 'Catalyst 9200L 24-port PoE+ 4x1G uplink',
    serviceDurationMonths: '0',
    unitListPrice: 3200,
    pricingTerm: '1',
    netCiscoUnit: 1280,
    unitNetPriceCcw: 1280,
    discPct: 60,
    qty: 2,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 1280,
    precioVentaUnitario: 1450.50,
    precioVentaExtendido: 2901.00,
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 days',
    isInfoRow: false,
  },
  {
    rowIdx: 15,
    lineNumber: '1.1',
    partNumber: 'PWR-C5-1KWAC',
    smartAccountMandatory: 'No',
    description: '1KW AC Config 5 Power Supply',
    serviceDurationMonths: '0',
    unitListPrice: 450,
    pricingTerm: '1',
    netCiscoUnit: 180,
    unitNetPriceCcw: 180,
    discPct: 60,
    qty: 2,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 180,
    precioVentaUnitario: 204.00,
    precioVentaExtendido: 408.00,
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 days',
    isInfoRow: false,
  },
  {
    rowIdx: 16,
    lineNumber: '1.2',
    partNumber: 'CAB-CONSOLE-RJ45',
    smartAccountMandatory: 'No',
    description: 'Console Cable 6ft with RJ45 and DB9F (Included $0 accessory)',
    serviceDurationMonths: '0',
    unitListPrice: 0,
    pricingTerm: '1',
    netCiscoUnit: 0,
    unitNetPriceCcw: 0,
    discPct: 0,
    qty: 5,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 0,
    precioVentaUnitario: 0,
    precioVentaExtendido: 0,
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 days',
    isInfoRow: false,
  },
  {
    rowIdx: 17,
    lineNumber: '2.0',
    partNumber: 'C9200L-DNA-E-24-3Y',
    smartAccountMandatory: 'Yes',
    description: 'C9200L Cisco DNA Essentials 24-port, 3 Year Term',
    serviceDurationMonths: '36',
    unitListPrice: 900,
    pricingTerm: '36',
    netCiscoUnit: 450,
    unitNetPriceCcw: 450,
    discPct: 50,
    qty: 2,
    isIntangible: true,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 450,
    precioVentaUnitario: 510.00,
    precioVentaExtendido: 1020.00,
    originalLeadTimeDays: 1,
    transformedLeadTime: '1 day',
    isInfoRow: false,
    isPeriodicSubscription: true,
  },
  {
    rowIdx: 17,
    lineNumber: '',
    partNumber: '',
    smartAccountMandatory: '',
    description: 'Initial Term: 36.00 Months | Auto Renewal Term: 0 Months | Billing Model: Prepaid',
    serviceDurationMonths: '0',
    unitListPrice: 0,
    pricingTerm: '',
    netCiscoUnit: 0,
    unitNetPriceCcw: 0,
    discPct: 0,
    qty: 0,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 0,
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
  console.log('Hardware Qty:', summary.hardwareQty, '(Expected: 4)');
  console.log('Software Qty:', summary.softwareQty, '(Expected: 2)');
  console.log('Total Qty (with value):', summary.totalQty, '(Expected: 6)');
  console.log('Total Mother Lines:', summary.motherLines.length, '(Expected: 2)');

  if (summary.hardwareTotal !== 3309.00) throw new Error('Hardware total mismatch');
  if (summary.softwareTotal !== 1020.00) throw new Error('Software total mismatch');
  if (summary.grandTotal !== 4329.00) throw new Error('Grand total mismatch');
  if (summary.hardwareQty !== 4) throw new Error(`Hardware Qty mismatch: got ${summary.hardwareQty}, expected 4 (excluding 5 zero-price cables)`);
  if (summary.softwareQty !== 2) throw new Error(`Software Qty mismatch: got ${summary.softwareQty}, expected 2`);
  if (summary.totalQty !== 6) throw new Error(`Total Qty mismatch: got ${summary.totalQty}, expected 6`);
  if (summary.motherLines.length !== 2) throw new Error('Mother lines count mismatch');

  const line1 = summary.motherLines.find((m) => m.motherKey === '1.0')!;
  const line2 = summary.motherLines.find((m) => m.motherKey === '2.0')!;
  if (line1.subtotal !== 3309.00) throw new Error('Line 1 subtotal mismatch');
  if (line2.subtotal !== 1020.00) throw new Error('Line 2 subtotal mismatch');
  if (line1.totalQty !== 4) throw new Error(`Line 1 totalQty mismatch: got ${line1.totalQty}, expected 4 (excluding zero-price items)`);
  if (line2.totalQty !== 2) throw new Error(`Line 2 totalQty mismatch: got ${line2.totalQty}, expected 2`);
  console.log('✓ TEST 1 PASSED: Categorization and line mother grouping accurate (Qty excludes $0 items).');

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
  if (emailDraft.bodyHtml.includes('🔧 Equipamiento Hardware') || emailDraft.bodyHtml.includes('Resumen Ejecutivo')) {
    throw new Error('Email HTML must NOT contain disputed executive summary / hardware category rows');
  }
  if (!emailDraft.bodyHtml.includes('TOTAL SOLUCIÓN CISCO:')) throw new Error('Email HTML missing TOTAL SOLUCIÓN CISCO');
  if (emailDraft.bodyHtml.includes('Bodega E1') || emailDraft.bodyHtml.includes('Bodega ED')) {
    throw new Error('Email HTML must NOT mention internal warehouse codes (Bodega E1 / ED)');
  }
  console.log('✓ TEST 3 PASSED: Partner email draft contains professional greetings, clauses, and CLP (without disputed executive summary or warehouse codes).');

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
  if (pdfHtml.includes('Bloque Línea 1.0')) throw new Error('PDF must NOT contain banner row "Bloque Línea 1.0"');
  if (!pdfHtml.includes('repeated-header')) throw new Error('PDF missing repeated-header row for Line 2.0+');
  if (pdfHtml.includes('Bodega E1') || pdfHtml.includes('Bodega ED')) throw new Error('PDF must NOT contain internal warehouse codes');
  if (!pdfHtml.includes('Estimated Lead Time (Weeks)')) throw new Error('PDF must contain Estimated Lead Time (Weeks)');
  if (pdfHtml.includes('exec-card') || pdfHtml.includes('Resumen Ejecutivo de la Solución')) {
    throw new Error('Commercial PDF HTML must NOT contain Executive Summary card');
  }
  if (!pdfHtml.includes('Subtotal Línea 1.0:')) throw new Error('PDF missing Line 1.0 subtotal');
  if (!pdfHtml.includes('Subtotal Línea 2.0:')) throw new Error('PDF missing Line 2.0 subtotal');
  if (!pdfHtml.includes('PRICE TOTAL (USD):')) throw new Error('PDF missing Grand Total');
  if (!pdfHtml.includes('Validación Técnica y Responsabilidad:')) throw new Error('PDF missing technical validation clause');
  console.log('✓ TEST 4 PASSED: Commercial PDF HTML template renders perfectly with repeated headers, weeks and no warehouse codes.');

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

  // Check title & Column 4 header in Row 13
  if (ws.getCell('A2').value !== 'Price Estimate') throw new Error('Title A2 mismatch');
  if (ws.getCell('D13').value !== 'Estimated Lead Time (Weeks)') {
    throw new Error(`Row 13 column 4 header mismatch: expected 'Estimated Lead Time (Weeks)', got '${ws.getCell('D13').value}'`);
  }

  // Search for mother line blocks, repeated headers and subtotals
  let foundBannerBlock = false;
  let foundRepeatedHeader = false;
  let foundWarehouseCode = false;
  let foundSubtotal1 = false;
  let foundSubtotal2 = false;
  let foundPriceTotal = false;
  let foundClpRow = false;
  let foundExecSummary = false;
  let foundExecSummaryQtyHeader = false;
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

    if (aVal.includes('Bloque Línea')) foundBannerBlock = true;
    if (aVal.includes('Bodega E1') || aVal.includes('Bodega ED') || bVal.includes('Bodega E1')) {
      foundWarehouseCode = true;
    }

    // Repeated header on line 2.0+ (row > 13)
    if (r > 13 && aVal === 'Line Number' && bVal === 'Part Number') {
      foundRepeatedHeader = true;
      const leadTimeHeader = ws.getCell(r, 4).value;
      if (leadTimeHeader !== 'Estimated Lead Time (Weeks)') {
        throw new Error(`Repeated header column 4 mismatch: got ${leadTimeHeader}`);
      }
    }

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
    if (aVal.includes('Resumen Ejecutivo de la Solución')) {
      foundExecSummary = true;
      const eHeaderVal = ws.getCell(r, 5).value;
      const gHeaderVal = ws.getCell(r, 7).value;
      if (eHeaderVal === 'Qty') foundExecSummaryQtyHeader = true;
      console.log(`Exec Summary Header at row ${r}: Col E="${eHeaderVal}", Col G="${gHeaderVal}"`);
    }
    if (aVal.includes('Validez de la Oferta:')) foundValidity = true;
    if (aVal.includes('Validación Técnica y Responsabilidad:')) foundTechnicalValidation = true;
  }

  if (foundBannerBlock) throw new Error('Banner "Bloque Línea X.0" must NOT be present');
  if (!foundRepeatedHeader) throw new Error('Repeated header row (Line Number | Part Number...) must be present on Line 2.0+');
  if (foundWarehouseCode) throw new Error('Warehouse codes (Bodega E1 / ED) must NOT be present in Estimate');
  if (!foundSubtotal1) throw new Error('Missing Subtotal Línea 1.0 row');
  if (!foundSubtotal2) throw new Error('Missing Subtotal Línea 2.0 row');
  if (!foundPriceTotal) throw new Error('Missing Price Total row');
  if (!foundClpRow) throw new Error('Missing CLP row');
  if (foundExecSummary) throw new Error('Excel Price Estimate must NOT contain Executive Summary card (removed as requested)');
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

  console.log('\n--- TEST 7: Exact BOM Validation of sittco_cayo_C8200_Estimate_NQ168576338QO & Nature Differentiation ---');
  // Recreating the real BOM items from the user's quote:
  const sittcoItems: EstimateLineItem[] = [
    // Line 1.0 (6 Routers C8200)
    { rowIdx: 14, lineNumber: '1.0', partNumber: 'C8200-1N-4T', smartAccountMandatory: 'No', description: 'Cisco Catalyst C8200-1N-4T Router', serviceDurationMonths: '0', unitListPrice: 2000, pricingTerm: '1', netCiscoUnit: 2354.37, unitNetPriceCcw: 2354.37, discPct: 50, qty: 6, isIntangible: false, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 2354.37, precioVentaUnitario: 2354.37, precioVentaExtendido: 14126.22, originalLeadTimeDays: 14, transformedLeadTime: '4 a 5 semanas', isInfoRow: false },
    { rowIdx: 15, lineNumber: '1.0.1', partNumber: 'CON-SNT-C82001N4', smartAccountMandatory: 'No', description: 'SNTC-8X5XNBD Cisco Catalyst C8200 (5Y)', serviceDurationMonths: '60', unitListPrice: 2000, pricingTerm: '60', netCiscoUnit: 2295.53, unitNetPriceCcw: 2295.53, discPct: 50, qty: 6, isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 2295.53, precioVentaUnitario: 2295.53, precioVentaExtendido: 13773.18, originalLeadTimeDays: 1, transformedLeadTime: 'Digital', isInfoRow: false },
    { rowIdx: 16, lineNumber: '1.1', partNumber: 'MEM-C8200-4GB', smartAccountMandatory: 'No', description: 'Cisco Catalyst 8200 Edge 4GB memory ($0 included)', serviceDurationMonths: '0', unitListPrice: 0, pricingTerm: '1', netCiscoUnit: 0, unitNetPriceCcw: 0, discPct: 0, qty: 6, isIntangible: false, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 0, precioVentaUnitario: 0, precioVentaExtendido: 0, originalLeadTimeDays: 14, transformedLeadTime: '', isInfoRow: false },
    { rowIdx: 26, lineNumber: '1.11', partNumber: 'C-NIM-8T', smartAccountMandatory: 'No', description: 'Cisco NIM Switch Module 8-port 1G RJ45', serviceDurationMonths: '0', unitListPrice: 500, pricingTerm: '1', netCiscoUnit: 534.98, unitNetPriceCcw: 534.98, discPct: 50, qty: 6, isIntangible: false, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 534.98, precioVentaUnitario: 534.98, precioVentaExtendido: 3209.88, originalLeadTimeDays: 14, transformedLeadTime: '4 a 5 semanas', isInfoRow: false },
    { rowIdx: 27, lineNumber: '1.12', partNumber: 'GLC-SX-MMD', smartAccountMandatory: 'No', description: '1000BASE-SX SFP transceiver module, MMF, 850nm', serviceDurationMonths: '0', unitListPrice: 200, pricingTerm: '1', netCiscoUnit: 214.66, unitNetPriceCcw: 214.66, discPct: 50, qty: 12, isIntangible: false, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 214.66, precioVentaUnitario: 214.66, precioVentaExtendido: 2575.92, originalLeadTimeDays: 14, transformedLeadTime: '4 a 5 semanas', isInfoRow: false },
    { rowIdx: 43, lineNumber: '1.13.8', partNumber: 'DNA-P-T1-E-5Y', smartAccountMandatory: 'No', description: 'Cisco DNA Essentials On-Prem Lic 5Y', serviceDurationMonths: '60', unitListPrice: 1500, pricingTerm: '60', netCiscoUnit: 1584.00, unitNetPriceCcw: 1584.00, discPct: 50, qty: 6, isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 1584.00, precioVentaUnitario: 1584.00, precioVentaExtendido: 9504.00, originalLeadTimeDays: 1, transformedLeadTime: 'Digital', isInfoRow: false },

    // Line 2.0 (12 Switches Catalyst 9300L)
    { rowIdx: 49, lineNumber: '2.0', partNumber: 'C9300L-24P-4G-E', smartAccountMandatory: 'No', description: 'Catalyst 9300L 24p PoE, Network Essentials', serviceDurationMonths: '0', unitListPrice: 3000, pricingTerm: '1', netCiscoUnit: 2577.86, unitNetPriceCcw: 2577.86, discPct: 50, qty: 12, isIntangible: false, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 2577.86, precioVentaUnitario: 2577.86, precioVentaExtendido: 30934.32, originalLeadTimeDays: 14, transformedLeadTime: '4 a 5 semanas', isInfoRow: false },
    { rowIdx: 50, lineNumber: '2.0.1', partNumber: 'CON-SNT-C9300L2E', smartAccountMandatory: 'No', description: 'SNTC-8X5XNBD Catalyst 9300L 24p PoE (5Y)', serviceDurationMonths: '60', unitListPrice: 2000, pricingTerm: '60', netCiscoUnit: 1990.72, unitNetPriceCcw: 1990.72, discPct: 50, qty: 12, isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 1990.72, precioVentaUnitario: 1990.72, precioVentaExtendido: 23888.64, originalLeadTimeDays: 1, transformedLeadTime: 'Digital', isInfoRow: false },
    { rowIdx: 52, lineNumber: '2.1.1', partNumber: 'C9300L-DNA-E-24-5Y', smartAccountMandatory: 'No', description: 'C9300L Cisco DNA Essentials, 24-port 5 Year Term', serviceDurationMonths: '60', unitListPrice: 500, pricingTerm: '60', netCiscoUnit: 444.65, unitNetPriceCcw: 444.65, discPct: 50, qty: 12, isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 444.65, precioVentaUnitario: 444.65, precioVentaExtendido: 5335.80, originalLeadTimeDays: 1, transformedLeadTime: 'Digital', isInfoRow: false },

    // Line 3.0 (24 Transceivers Spare with Duty)
    { rowIdx: 69, lineNumber: '3.0', partNumber: 'GLC-SX-MMD=', smartAccountMandatory: 'No', description: '1000BASE-SX SFP transceiver module, MMF, 850nm', serviceDurationMonths: '0', unitListPrice: 200, pricingTerm: '1', netCiscoUnit: 226.71, unitNetPriceCcw: 226.71, discPct: 50, qty: 24, isIntangible: false, llevaArancel: true, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 226.71, precioVentaUnitario: 226.71, precioVentaExtendido: 5441.04, originalLeadTimeDays: 14, transformedLeadTime: '4 a 5 semanas', isInfoRow: false },
  ];

  const sittcoSummary = categorizeEstimateItems(sittcoItems);
  console.log('Sittco Hardware Qty:', sittcoSummary.hardwareQty, '(Expected: 60) | Total:', sittcoSummary.hardwareTotal, '(Expected: 56287.38)');
  console.log('Sittco Software Qty:', sittcoSummary.softwareQty, '(Expected: 18) | Total:', sittcoSummary.softwareTotal, '(Expected: 14839.80)');
  console.log('Sittco Services Qty:', sittcoSummary.servicesQty, '(Expected: 18) | Total:', sittcoSummary.servicesTotal, '(Expected: 37661.82)');
  console.log('Sittco Grand Total Qty:', sittcoSummary.totalQty, '(Expected: 96) | Total:', sittcoSummary.grandTotal, '(Expected: 108789.00)');

  if (sittcoSummary.hardwareQty !== 60) throw new Error(`Hardware Qty mismatch: got ${sittcoSummary.hardwareQty}, expected 60`);
  if (sittcoSummary.hardwareTotal !== 56287.38) throw new Error(`Hardware total mismatch: got ${sittcoSummary.hardwareTotal}`);
  if (sittcoSummary.softwareQty !== 18) throw new Error(`Software Qty mismatch: got ${sittcoSummary.softwareQty}, expected 18 (6 DNA routers + 12 DNA switches)`);
  if (sittcoSummary.softwareTotal !== 14839.80) throw new Error(`Software total mismatch: got ${sittcoSummary.softwareTotal}`);
  if (sittcoSummary.servicesQty !== 18) throw new Error(`Services Qty mismatch: got ${sittcoSummary.servicesQty}, expected 18 (6 SNTC routers + 12 SNTC switches)`);
  if (sittcoSummary.servicesTotal !== 37661.82) throw new Error(`Services total mismatch: got ${sittcoSummary.servicesTotal}`);
  if (sittcoSummary.totalQty !== 96) throw new Error(`Total Qty mismatch: got ${sittcoSummary.totalQty}, expected 96`);
  if (sittcoSummary.grandTotal !== 108789.00) throw new Error(`Grand total mismatch: got ${sittcoSummary.grandTotal}, expected 108789.00`);
  console.log('✓ TEST 7 PASSED: sittco real BOM confirmed: Hardware (60), Software (18), Services (18), Grand Total ($108,789.00).');

  console.log('\n--- TEST 8: Child Items Without Line Number Stay Under Mother Line 1.0 (No phantom 2.0, 3.0, 4.0) ---');
  // Build a test workbook with 1 mother line and 3 child items without line numbers
  const testWb = new ExcelJS.Workbook();
  const testWs = testWb.addWorksheet('Price Estimate');
  // Header row at 13
  const hRow = testWs.getRow(13);
  hRow.getCell(1).value = 'Line Number';
  hRow.getCell(2).value = 'Part Number';
  hRow.getCell(4).value = 'Description';
  hRow.getCell(7).value = 'List Price';
  hRow.getCell(9).value = 'Qty';
  hRow.getCell(10).value = 'Unit Net Price';
  hRow.getCell(12).value = 'Ext Net Price';

  // Row 14: Mother line 1.0
  const r14 = testWs.getRow(14);
  r14.getCell(1).value = '1.0';
  r14.getCell(2).value = 'C8200-1N-4T';
  r14.getCell(4).value = 'Cisco Catalyst C8200-1N-4T Router';
  r14.getCell(7).value = 3000;
  r14.getCell(9).value = 1;
  r14.getCell(10).value = 1500;
  r14.getCell(12).value = 1500;

  // Row 15: Child item with NO line number (SmartNet Service CON-SNT)
  const r15 = testWs.getRow(15);
  r15.getCell(1).value = ''; // BLANK LINE NUMBER
  r15.getCell(2).value = 'CON-SNT-C82001N4';
  r15.getCell(4).value = 'SNTC-8X5XNBD Cisco Catalyst C8200';
  r15.getCell(7).value = 500;
  r15.getCell(9).value = 1;
  r15.getCell(10).value = 250;
  r15.getCell(12).value = 250;

  // Row 16: Child item with NO line number (Hardware Component PWR-C1-BLANK)
  const r16 = testWs.getRow(16);
  r16.getCell(1).value = ''; // BLANK LINE NUMBER
  r16.getCell(2).value = 'PWR-C1-BLANK';
  r16.getCell(4).value = 'Power Supply Blank';
  r16.getCell(7).value = 0;
  r16.getCell(9).value = 1;
  r16.getCell(10).value = 0;
  r16.getCell(12).value = 0;

  // Row 17: Child item with NO line number (Software License DNA-C8200-SW)
  const r17 = testWs.getRow(17);
  r17.getCell(1).value = ''; // BLANK LINE NUMBER
  r17.getCell(2).value = 'DNA-C8200-SW';
  r17.getCell(4).value = 'Cisco DNA subscription for C8200';
  r17.getCell(7).value = 1000;
  r17.getCell(9).value = 1;
  r17.getCell(10).value = 500;
  r17.getCell(12).value = 500;

  // Row 18: Genuine Mother line 2.0
  const r18 = testWs.getRow(18);
  r18.getCell(1).value = '2.0';
  r18.getCell(2).value = 'C9300L-24P-4G-E';
  r18.getCell(4).value = 'Catalyst 9300L 24p PoE Switch';
  r18.getCell(7).value = 4000;
  r18.getCell(9).value = 1;
  r18.getCell(10).value = 2000;
  r18.getCell(12).value = 2000;

  const testBuf = await testWb.xlsx.writeBuffer();
  const { result: parsedHierarchyResult } = await parseEstimateWorkbook(
    testBuf as any,
    mockParams,
    'Test_Blank_Lines.xlsx'
  );

  const parsedItems = parsedHierarchyResult.items.filter(it => !it.isInfoRow);
  console.log('Parsed Items Line Numbers:');
  parsedItems.forEach(it => {
    console.log(`  SKU: ${it.partNumber.padEnd(18)} | Line: ${it.lineNumber.padEnd(8)} | Mother: ${it.inheritedFromMotherLine}`);
  });

  const item1 = parsedItems[0];
  const item2 = parsedItems[1];
  const item3 = parsedItems[2];
  const item4 = parsedItems[3];
  const item5 = parsedItems[4];

  if (item1.lineNumber !== '1.0') throw new Error(`Item 1 line should be 1.0, got ${item1.lineNumber}`);
  if (item2.lineNumber !== '1.0.1') throw new Error(`Item 2 line should be 1.0.1 (service child), got ${item2.lineNumber}`);
  if (item2.inheritedFromMotherLine !== '1.0') throw new Error(`Item 2 should inherit from 1.0, got ${item2.inheritedFromMotherLine}`);
  if (item3.lineNumber !== '1.1') throw new Error(`Item 3 line should be 1.1 (component child), got ${item3.lineNumber}`);
  if (item3.inheritedFromMotherLine !== '1.0') throw new Error(`Item 3 should inherit from 1.0, got ${item3.inheritedFromMotherLine}`);
  if (item4.lineNumber !== '1.2') throw new Error(`Item 4 line should be 1.2 (software child), got ${item4.lineNumber}`);
  if (item4.inheritedFromMotherLine !== '1.0') throw new Error(`Item 4 should inherit from 1.0, got ${item4.inheritedFromMotherLine}`);
  if (item5.lineNumber !== '2.0') throw new Error(`Item 5 line should be 2.0 (mother line), got ${item5.lineNumber}`);

  // Verify that NO phantom mother lines (3.0 or 4.0) were generated
  const phantomLines = parsedItems.filter(it => it.lineNumber === '3.0' || it.lineNumber === '4.0');
  if (phantomLines.length > 0) {
    throw new Error(`Phantom mother lines 3.0 or 4.0 detected: ${phantomLines.map(p => p.lineNumber).join(', ')}`);
  }

  console.log('✓ TEST 8 PASSED: Child items without line numbers stay strictly as children under 1.0 and do NOT create lines 2.0, 3.0, 4.0.');

  console.log('\n=======================================================');
  console.log('🎉 ALL ESTIMATE GROUPED EXPORT & CLP TESTS PASSED (8/8)');
  console.log('=======================================================');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
