import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  transformRawBomToDsv,
  isZeroValueBomItem,
  calculateDsvPrices,
} from '../src/modules/dsv/dsvEngine';
import type { RawBomParsedResult } from '../src/modules/dsv/dsvBomParser';
import type { DsvModalFormData } from '../src/modules/dsv/types';

describe('DSV Excluded Items Visibility & Optional Force-Inclusion (Estilo BO)', () => {
  const dummyFormData: DsvModalFormData = {
    so: '123456789',
    po: '123456',
    dealId: '87654321',
    partnerId: 'XCL12345',
    endCustomerAddress: 'Av. Providencia 1234, Santiago, Chile',
    partnerName: 'Test Reseller SpA',
    endCustomerName: 'Test End User Corp',
  };

  const sampleBom: RawBomParsedResult = {
    fileName: '87654321_Cisco-Deal-BOM.xlsx',
    dealIdFromBom: '87654321',
    authorizationNumber: '87654321',
    resellerName: 'Test Reseller SpA',
    endUserName: 'Test End User Corp',
    items: [
      {
        rowIdx: 1,
        authorizationNumber: '87654321',
        resellerName: 'Test Reseller SpA',
        endUserName: 'Test End User Corp',
        lineNumber: '1.0',
        magicKey: 'MK-100',
        ciscoSku: 'C9300-48P-A',
        qty: 2,
        durationMonths: 0,
        listPrice: 10000,
        distiDiscountPct: 42,
        description: 'Catalyst 9300 48-port PoE+',
      },
      {
        rowIdx: 2,
        authorizationNumber: '87654321',
        resellerName: 'Test Reseller SpA',
        endUserName: 'Test End User Corp',
        lineNumber: '1.0.1',
        magicKey: 'MK-101',
        ciscoSku: 'PWR-C1-715WAC-P',
        qty: 2,
        durationMonths: 0,
        listPrice: 0, // Zero cost component / included
        distiDiscountPct: 42,
        description: '715W AC Power Supply',
      },
      {
        rowIdx: 3,
        authorizationNumber: '87654321',
        resellerName: 'Test Reseller SpA',
        endUserName: 'Test End User Corp',
        lineNumber: '1.0.2',
        magicKey: 'MK-102',
        ciscoSku: 'CAB-TA-NA',
        qty: 2,
        durationMonths: 0,
        listPrice: 0, // Power cable $0.00
        distiDiscountPct: 0,
        description: 'Power Cable',
      },
      {
        rowIdx: 4,
        authorizationNumber: '87654321',
        resellerName: 'Test Reseller SpA',
        endUserName: 'Test End User Corp',
        lineNumber: '2.0',
        magicKey: 'MK-200',
        ciscoSku: 'CON-SNT-C930048P',
        qty: 2,
        durationMonths: 36,
        listPrice: 1500,
        distiDiscountPct: 41.41,
        description: 'SNTC-8X5XNBD Catalyst 9300 48-port',
      },
    ],
  };

  it('1. isZeroValueBomItem correctly classifies lines with $0.00 list price or 0 qty', () => {
    assert.strictEqual(isZeroValueBomItem(sampleBom.items[0]), false, 'C9300 with $10,000 list price is not zero-value');
    assert.strictEqual(isZeroValueBomItem(sampleBom.items[1]), true, 'PWR-C1 with $0 list price is zero-value');
    assert.strictEqual(isZeroValueBomItem(sampleBom.items[2]), true, 'CAB-TA-NA with $0 list price is zero-value');
    assert.strictEqual(isZeroValueBomItem(sampleBom.items[3]), false, 'Service with $1,500 list price is not zero-value');
  });

  it('2. transformRawBomToDsv excludes zero-value items by default and returns discardedRows', () => {
    const summary = transformRawBomToDsv(sampleBom, dummyFormData, {}, false);

    assert.strictEqual(summary.totalOriginalItems, 4, 'Total original items must be 4');
    assert.strictEqual(summary.validDsvItems, 2, 'Only 2 items (with list price > 0) should be included by default');
    assert.strictEqual(summary.discardedZeroItems, 2, '2 items should be discarded by default');
    assert.strictEqual(summary.rows.length, 2, 'Only 2 rows generated');
    assert.ok(Array.isArray(summary.discardedRows), 'discardedRows must be an array');
    assert.strictEqual(summary.discardedRows!.length, 2, 'discardedRows must contain the 2 excluded items');
    assert.strictEqual(summary.discardedRows![0].ciscoSku, 'PWR-C1-715WAC-P');
    assert.strictEqual(summary.discardedRows![1].ciscoSku, 'CAB-TA-NA');
  });

  it('3. transformRawBomToDsv allows force-including specific zero-value lines without corrupting financial formulas', () => {
    // Force include line 1.0.1 (PWR-C1-715WAC-P)
    const forceSet = new Set(['1.0.1']);
    const summary = transformRawBomToDsv(sampleBom, dummyFormData, {}, false, forceSet);

    assert.strictEqual(summary.validDsvItems, 3, 'Should now include 3 items (2 normal + 1 forced)');
    assert.strictEqual(summary.discardedZeroItems, 1, 'Only 1 item should remain discarded');
    assert.strictEqual(summary.discardedRows!.length, 1);
    assert.strictEqual(summary.discardedRows![0].ciscoSku, 'CAB-TA-NA');

    // Verify the forced item is present and marked
    const forcedRow = summary.rows.find((r) => r.soLineNum === '1.0.1' || r.ciscoStandardPartNumber === 'PWR-C1-715WAC-P');
    assert.ok(forcedRow, 'Forced row must be present in rows');
    assert.strictEqual(forcedRow!.isForcedIncluded, true, 'isForcedIncluded must be true');
    assert.strictEqual(forcedRow!.reportedProductUnitPrice, 0, 'Reported unit price for $0 item must remain $0.00');
    assert.strictEqual(forcedRow!.reportedNetPrice, 0, 'Reported net price for $0 item must remain $0.00');
  });

  it('4. transformRawBomToDsv allows force-including all lines (via Set or array)', () => {
    const allForced = ['1.0.1', '1.0.2'];
    const summary = transformRawBomToDsv(sampleBom, dummyFormData, {}, false, allForced);

    assert.strictEqual(summary.validDsvItems, 4, 'All 4 items must be included');
    assert.strictEqual(summary.discardedZeroItems, 0, '0 items discarded');
    assert.strictEqual(summary.discardedRows!.length, 0, 'discardedRows must be empty');
  });

  it('5. Normal items with non-zero prices retain exact financial math and discounts', () => {
    const pricesHw = calculateDsvPrices('C9300-48P-A', 10000, 42, 0);
    assert.strictEqual(pricesHw.reportedProductUnitPrice, 5800, 'Hardware Unit Price: 10000 * 0.58 = 5800');
    assert.strictEqual(pricesHw.reportedNetPrice, 5800, 'Hardware Net Price: 10000 * 0.58 = 5800');

    // Service item: 36 months CON-
    const pricesSvc = calculateDsvPrices('CON-SNT-C930048P', 1500, 41.41, 36);
    // 3 years: discount 41.41% -> Col J = 1500 * (1 - 0.4141) = 878.85
    // Col K = Col J * 3 years = 878.85 * 3 = 2636.55
    assert.strictEqual(pricesSvc.reportedProductUnitPrice, 878.85, 'Service Col J: 1500 * (1 - 0.4141) = 878.85');
    assert.strictEqual(pricesSvc.reportedNetPrice, 2636.55, 'Service Col K: 878.85 * 3 = 2636.55');
  });

  it('6. DsvView.tsx incorporates collapsible discarded panel, action buttons and forced badges', () => {
    const viewPath = path.resolve('src/modules/dsv/DsvView.tsx');
    const content = fs.readFileSync(viewPath, 'utf8');

    assert.ok(content.includes('forceIncludedLines'), 'Must manage forceIncludedLines state');
    assert.ok(content.includes('isDiscardedExpanded'), 'Must manage isDiscardedExpanded state');
    assert.ok(content.includes('P/N Descartados / Excluidos del DSV'), 'Must render P/N Descartados header');
    assert.ok(content.includes('handleDownloadDiscardedCsv'), 'Must provide handleDownloadDiscardedCsv');
    assert.ok(content.includes('handleIncludeDiscardedLine'), 'Must provide handleIncludeDiscardedLine');
    assert.ok(content.includes('handleIncludeAllDiscarded'), 'Must provide handleIncludeAllDiscarded');
    assert.ok(content.includes('+ Incluir en DSV'), 'Must have button to include discarded item');
    assert.ok(content.includes('+ Forzado'), 'Must display + Forzado badge on forced active lines');
  });

  it('7. DsvModal.tsx supports forceIncludedLines and interactive discarded items review', () => {
    const modalPath = path.resolve('src/modules/dsv/DsvModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('forceIncludedLines?: Set<string>'), 'Must accept forceIncludedLines prop');
    assert.ok(content.includes('onToggleForceIncludeLine'), 'Must accept onToggleForceIncludeLine callback');
    assert.ok(content.includes('onIncludeAllLines'), 'Must accept onIncludeAllLines callback');
    assert.ok(content.includes('isDiscardedModalExpanded'), 'Must support interactive expansion of discarded in modal');
  });
});
