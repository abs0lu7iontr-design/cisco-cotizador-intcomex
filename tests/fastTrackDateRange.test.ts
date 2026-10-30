// ============================================================================
// TESTS: CISCO FAST TRACK DATE RANGE PARSING (CELL A3) & CHROME COMPATIBILITY
// ============================================================================

import assert from 'node:assert/strict';
import {
  parseFastTrackDateRange,
  scanFastTrackMetadata,
} from '../src/modules/fasttrack/fastTrackParser';
import { getFastTrackExpirationStatus } from '../src/modules/fasttrack/fastTrackDb';

console.log('🧪 Starting Fast Track Date Range & Expiration Parsing Test Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: Cell A3 exact range with year 2027
// ----------------------------------------------------------------------------
console.log('▶ Test 1: "Eligible from Oct 25th 2026- Jan 23rd 2027"');
{
  const raw = 'Eligible from Oct 25th 2026- Jan 23rd 2027';
  const res = parseFastTrackDateRange(raw);
  assert.ok(res, 'Must successfully parse range');
  assert.ok(res.validUntil, 'validUntil must be non-null');
  assert.ok(res.validFrom, 'validFrom must be non-null');

  const endDate = new Date(res.validUntil);
  assert.strictEqual(endDate.getFullYear(), 2027, 'End date year must be 2027 (not 2026)');
  assert.strictEqual(endDate.getMonth(), 0, 'End date month must be January (0)');
  assert.strictEqual(endDate.getDate(), 23, 'End date day must be 23');

  const startDate = new Date(res.validFrom);
  assert.strictEqual(startDate.getFullYear(), 2026, 'Start date year must be 2026');
  assert.strictEqual(startDate.getMonth(), 9, 'Start date month must be October (9)');
  assert.strictEqual(startDate.getDate(), 25, 'Start date day must be 25');
  console.log('  ✅ Extracted: 25-10-2026 to 23-01-2027 correctly.');
}

// ----------------------------------------------------------------------------
// Test 2: Standard range within same year
// ----------------------------------------------------------------------------
console.log('\n▶ Test 2: "Eligible from Aug 23rd 2026- Oct 24th 2026"');
{
  const raw = 'Eligible from Aug 23rd 2026- Oct 24th 2026';
  const res = parseFastTrackDateRange(raw);
  assert.ok(res, 'Must parse successfully');
  const endDate = new Date(res.validUntil!);
  assert.strictEqual(endDate.getFullYear(), 2026);
  assert.strictEqual(endDate.getMonth(), 9);
  assert.strictEqual(endDate.getDate(), 24);

  const startDate = new Date(res.validFrom!);
  assert.strictEqual(startDate.getFullYear(), 2026);
  assert.strictEqual(startDate.getMonth(), 7);
  assert.strictEqual(startDate.getDate(), 23);
  console.log('  ✅ Extracted: 23-08-2026 to 24-10-2026 correctly.');
}

// ----------------------------------------------------------------------------
// Test 3: Year boundary inference (year specified only on end date)
// ----------------------------------------------------------------------------
console.log('\n▶ Test 3: "Eligible from Oct 25th - Jan 23rd 2027"');
{
  const raw = 'Eligible from Oct 25th - Jan 23rd 2027';
  const res = parseFastTrackDateRange(raw);
  assert.ok(res, 'Must parse successfully');
  const endDate = new Date(res.validUntil!);
  assert.strictEqual(endDate.getFullYear(), 2027);
  assert.strictEqual(endDate.getMonth(), 0);
  assert.strictEqual(endDate.getDate(), 23);

  const startDate = new Date(res.validFrom!);
  assert.strictEqual(startDate.getFullYear(), 2026, 'Start date year must be automatically inferred as 2026');
  assert.strictEqual(startDate.getMonth(), 9);
  assert.strictEqual(startDate.getDate(), 25);
  console.log('  ✅ Extracted: 25-10-2026 to 23-01-2027 correctly.');
}

// ----------------------------------------------------------------------------
// Test 4: scanFastTrackMetadata across raw Excel rows
// ----------------------------------------------------------------------------
console.log('\n▶ Test 4: scanFastTrackMetadata across raw Excel rows');
{
  const rawRows = [
    ['Q1M2 FY27 - Fast Track Base - LATAM MCO - Chile, Colombia, Paraguay'],
    ['Promotion Code: PP-Fast-170729-01820'],
    ['Eligible from Oct 25th 2026- Jan 23rd 2027'],
    ['Part Number', 'Description', 'Distributor Discount %'],
  ];

  const meta = scanFastTrackMetadata(rawRows);
  assert.strictEqual(
    meta.promotionTitle,
    'Q1M2 FY27 - Fast Track Base - LATAM MCO - Chile, Colombia, Paraguay'
  );
  assert.strictEqual(meta.promotionCode, 'PP-Fast-170729-01820');
  assert.ok(meta.validUntil);
  assert.ok(meta.validFrom);

  const endDate = new Date(meta.validUntil);
  assert.strictEqual(endDate.getFullYear(), 2027);
  assert.strictEqual(endDate.getMonth(), 0);
  assert.strictEqual(endDate.getDate(), 23);

  // Status check with both timestamps
  const status = getFastTrackExpirationStatus(meta.validUntil, meta.validFrom);
  assert.strictEqual(status.validUntilFormatted, '23-01-2027');
  assert.strictEqual(status.validFromFormatted, '25-10-2026');
  assert.strictEqual(status.isExpired, false, 'Catalog must NOT be marked expired in late 2026');
  console.log('  ✅ Sheet metadata scanned and verified: Status Vigente.');
}

console.log('\n🎉 All Fast Track Date Range tests passed successfully!\n');
