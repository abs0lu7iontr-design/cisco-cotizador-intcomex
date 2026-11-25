// ============================================================================
// TEST: DIAGNÓSTICO DE EXCLUSIÓN SAAS / XAAS EN DSV Y VERIFICACIÓN DE FÓRMULAS
// Reproducción exacta del caso Deal 86803728 (computronic spa / MINERA LOS PELAMBRES):
//   - Línea 1.0 CW9174I-CFG (Hardware) -> POSTED (Col J: 1463.83, Col K: 1009.54)
//   - Línea 2.2 LIC-CW-E (SKU IDENTIFIER = XAAS) -> REJECTED en Cisco ("SAAS SKU NOT ELIGIBLE FOR DSV")
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseRawDealBom } from '../src/modules/dsv/dsvBomParser';
import {
  calculateDsvPrices,
  isSaasIneligibleForDsv,
  isDefaultExcludedFromDsv,
  getDsvExclusionReason,
  transformRawBomToDsv,
} from '../src/modules/dsv/dsvEngine';
import type { DsvModalFormData } from '../src/modules/dsv/types';

function buildDeal86803728Buffer(): ArrayBuffer {
  const headers = [
    'AUTHORIZATION NUMBER', 'VERSION', 'RESELLER NAME', 'RESELLER ACCT', 'ENDUSER NAME',
    'LINE#', 'MAGIC KEY', 'CISCO SKU', 'INCLUDED ITEM', 'QUANTITY', 'DURATION(Months)',
    'REQUESTED START DATE', 'REQUESTED END DATE', 'AUTO RENEWAL TERM(Months)',
    'LIST_PRICE', 'EXTENDED LIST PRICE', 'UNIT NET PRICE', 'EXTENDED NET PRICE',
    'DISTI DISCOUNT', 'DEAL APPROVAL DATE', 'DEAL EXPIRY DATE', 'PRICE PROTECTION EXPIRY DATE',
    'CISCO TRY AND BUY', 'BILLING MODEL', 'SKU IDENTIFIER', 'MANDATORY ATTACH RELAX',
    'ORIGINAL UNIT LIST PRICE', 'ORIGINAL DURATION LIST PRICE', 'ORIGINAL EXTENDED LIST PRICE',
    'DURATION LIST PRICE', 'DURATION NET PRICE', 'PRICING TERM',
  ];

  const rows = [
    headers,
    [
      '86803728', 3, 'computronic spa', 0, 'MINERA LOS PELAMBRES',
      '1.0', 'Q14541574387-000', 'CW9174I-CFG', 'No', 2, 0,
      '', '', 0,
      2523.85, 5047.7, 1009.54, 2019.08,
      60, '11/20/2026', '02/18/2027', '12/04/2026',
      '', '', '', '',
      '', '', '',
      0, 0, 0,
    ],
    [
      '86803728', 3, 'computronic spa', 0, 'MINERA LOS PELAMBRES',
      '1.1', 'Q14541574388-000', 'AIR-AP-BRACKET-2', 'No', 2, 0,
      '', '', 0,
      0, 0, 0, 0,
      42, '11/20/2026', '02/18/2027', '12/04/2026',
      '', '', '', '',
      '', '', '',
      0, 0, 0,
    ],
    [
      '86803728', 3, 'computronic spa', 0, 'MINERA LOS PELAMBRES',
      '2.0', 'Q14541574392-000', 'CISCO-NETWORK-SUB', 'No', 1, 36,
      '01/15/2027', '01/14/2030', 0,
      0, 0, 0, 0,
      56, '11/20/2026', '02/18/2027', '12/04/2026',
      '', 'Prepaid Term', 'XAAS', '',
      '', '', '',
      0, 0, 0,
    ],
    [
      '86803728', 3, 'computronic spa', 0, 'MINERA LOS PELAMBRES',
      '2.2', 'Q14541574393-000', 'LIC-CW-E', 'No', 2, 36,
      '01/15/2027', '01/14/2030', 0,
      12.5, 900, 5.5, 396,
      56, '11/20/2026', '02/18/2027', '12/04/2026',
      '', 'Prepaid Term', 'XAAS', '',
      '', '', '',
      450, 198, 1,
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
}

describe('DSV SaaS / XaaS Exclusion & Deal 86803728 Diagnostic Suite', () => {
  const formData: DsvModalFormData = {
    so: '120846007',
    po: '332540',
    dealId: '86803728',
    partnerId: 'XCLN14351',
    endCustomerAddress: 'VITACURA 2909,501 ,SANTIAGO,METROPOLITANA DE SANTIAGO,CL,8320000',
    partnerName: 'computronic spa',
    endCustomerName: 'MINERA LOS PELAMBRES',
  };

  it('1. parseRawDealBom extracts BILLING MODEL, SKU IDENTIFIER (XAAS) and DURATION LIST/NET PRICE accurately', async () => {
    const buffer = buildDeal86803728Buffer();
    const parsed = await parseRawDealBom(buffer, '86803728_Cisco-Deal-BOM.xlsx');

    assert.strictEqual(parsed.items.length, 4);
    const licItem = parsed.items.find((i) => i.ciscoSku === 'LIC-CW-E')!;
    assert.ok(licItem, 'LIC-CW-E must be parsed');
    assert.strictEqual(licItem.skuIdentifier, 'XAAS');
    assert.strictEqual(licItem.billingModel, 'Prepaid Term');
    assert.strictEqual(licItem.durationMonths, 36);
    assert.strictEqual(licItem.durationListPrice, 450);
    assert.strictEqual(licItem.durationNetPrice, 198);
  });

  it('2. Financial formulas (Col J and Col K) match Cisco DART math for both CW9174I-CFG and LIC-CW-E', () => {
    const hw = calculateDsvPrices('CW9174I-CFG', 2523.85, 60, 0, undefined, {
      lineNumber: '1.0',
      qty: 2,
      unitNetPrice: 1009.54,
      extendedNetPrice: 2019.08,
    });
    assert.strictEqual(hw.reportedProductUnitPrice, 1463.83, 'CW9174I-CFG Col J = 2523.85 * 0.58 = 1463.83');
    assert.strictEqual(hw.reportedNetPrice, 1009.54, 'CW9174I-CFG Col K = 1009.54');

    const saas = calculateDsvPrices('LIC-CW-E', 12.5, 56, 36, undefined, {
      lineNumber: '2.2',
      qty: 2,
      extendedListPrice: 900,
      unitNetPrice: 5.5,
      extendedNetPrice: 396,
      skuIdentifier: 'XAAS',
      durationListPrice: 450,
      durationNetPrice: 198,
      pricingTerm: 1,
    });
    assert.strictEqual(saas.reportedProductUnitPrice, 261, 'LIC-CW-E Col J = 450 * 0.58 = 261.00');
    assert.strictEqual(saas.reportedNetPrice, 198, 'LIC-CW-E Col K = 198.00');
  });

  it('3. isSaasIneligibleForDsv and transformRawBomToDsv automatically exclude XAAS SaaS lines by default', async () => {
    const buffer = buildDeal86803728Buffer();
    const parsed = await parseRawDealBom(buffer, '86803728_Cisco-Deal-BOM.xlsx');

    const hwItem = parsed.items.find((i) => i.ciscoSku === 'CW9174I-CFG')!;
    const licItem = parsed.items.find((i) => i.ciscoSku === 'LIC-CW-E')!;

    assert.strictEqual(isSaasIneligibleForDsv(hwItem), false);
    assert.strictEqual(isDefaultExcludedFromDsv(hwItem), false);
    assert.strictEqual(isSaasIneligibleForDsv(licItem), true);
    assert.strictEqual(isDefaultExcludedFromDsv(licItem), true);
    assert.strictEqual(getDsvExclusionReason(licItem).code, 'SAAS_NOT_ELIGIBLE');

    const summary = transformRawBomToDsv(parsed, formData, {}, false);
    assert.strictEqual(summary.validDsvItems, 1, 'Only CW9174I-CFG must be exported by default');
    assert.strictEqual(summary.rows[0].ciscoStandardPartNumber, 'CW9174I-CFG');
    assert.strictEqual(summary.discardedZeroItems, 3, '1.1, 2.0 ($0) and 2.2 (XAAS) must be excluded by default');
    assert.strictEqual(summary.discardedSaasItems, 1, '1 priced SaaS item (LIC-CW-E) excluded');
  });

  it('4. Users can still force-include an excluded XAAS line via forceIncludedLines if desired', async () => {
    const buffer = buildDeal86803728Buffer();
    const parsed = await parseRawDealBom(buffer, '86803728_Cisco-Deal-BOM.xlsx');

    const summary = transformRawBomToDsv(parsed, formData, {}, false, new Set(['2.2']));
    assert.strictEqual(summary.validDsvItems, 2);
    const forcedSaas = summary.rows.find((r) => r.ciscoStandardPartNumber === 'LIC-CW-E');
    assert.ok(forcedSaas);
    assert.strictEqual(forcedSaas.isForcedIncluded, true);
    assert.strictEqual(forcedSaas.reportedProductUnitPrice, 261);
    assert.strictEqual(forcedSaas.reportedNetPrice, 198);
  });
});
