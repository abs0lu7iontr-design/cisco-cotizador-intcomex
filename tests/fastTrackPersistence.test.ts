// ============================================================================
// TESTS: CISCO FAST TRACK PERSISTENCE, CLOUD SYNC & MASTER SEED BLINDAJE
// ============================================================================

import assert from 'node:assert/strict';
import {
  sanitizePartNumberKey,
  getFastTrackExpirationStatus,
} from '../src/modules/fasttrack/fastTrackDb';
import {
  FAST_TRACK_MASTER_METADATA,
  FAST_TRACK_MASTER_SEEDS,
} from '../src/modules/fasttrack/fastTrackMasterSeeds';
import { auditEstimateWithFastTrack } from '../src/modules/fasttrack/fastTrackAuditor';
import { EstimateLineItem } from '../src/core/types';

console.log('🧪 Starting Fast Track Persistence & Blindaje Test Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: Part Number Sanitization
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Part Number Sanitization');
assert.strictEqual(sanitizePartNumberKey(' c9200l-24p-4g-e '), 'C9200L-24P-4G-E');
assert.strictEqual(sanitizePartNumberKey('MR36-HW'), 'MR36-HW');
assert.strictEqual(sanitizePartNumberKey(''), '');
assert.strictEqual(sanitizePartNumberKey('   ms130-24p-hw   '), 'MS130-24P-HW');
console.log('  ✅ Part Number sanitization verified.');

// ----------------------------------------------------------------------------
// Test 2: Master Seed Integrity & Zero-State Armor
// ----------------------------------------------------------------------------
console.log('\n▶ Test 2: Master Seed Integrity & Zero-State Armor');
assert.ok(FAST_TRACK_MASTER_SEEDS.length >= 30, `Expected at least 30 master SKUs, got ${FAST_TRACK_MASTER_SEEDS.length}`);
assert.ok(FAST_TRACK_MASTER_METADATA.validUntil > Date.now(), 'Master seed validUntil must be in the future');
assert.ok(FAST_TRACK_MASTER_METADATA.promotionCode.length > 5, 'Promotion code must be defined');
assert.ok(FAST_TRACK_MASTER_METADATA.fileName.endsWith('.xlsx'), 'File name must be valid Excel extension');

// Check key flagship SKUs
const c9200 = FAST_TRACK_MASTER_SEEDS.find((s) => s.partNumber === 'C9200L-24P-4G-E');
assert.ok(c9200, 'C9200L-24P-4G-E must exist in master seeds');
assert.strictEqual(c9200.distributorDiscount, 64.5);
assert.strictEqual(c9200.listPrice, 2580);

const mr36 = FAST_TRACK_MASTER_SEEDS.find((s) => s.partNumber === 'MR36-HW');
assert.ok(mr36, 'MR36-HW must exist in master seeds');
assert.strictEqual(mr36.distributorDiscount, 68.5);

const ms130 = FAST_TRACK_MASTER_SEEDS.find((s) => s.partNumber === 'MS130-24P-HW');
assert.ok(ms130, 'MS130-24P-HW must exist in master seeds');
assert.strictEqual(ms130.distributorDiscount, 65.0);

console.log(`  ✅ Master seeds valid with ${FAST_TRACK_MASTER_SEEDS.length} SKUs and official discounts.`);

// ----------------------------------------------------------------------------
// Test 3: Expiration Status Calculation
// ----------------------------------------------------------------------------
console.log('\n▶ Test 3: Expiration Status Calculation');
const futureDate = Date.now() + 60 * 24 * 60 * 60 * 1000; // +60 days
const futureStatus = getFastTrackExpirationStatus(futureDate);
assert.strictEqual(futureStatus.isExpired, false);
assert.strictEqual(futureStatus.isExpiringSoon, false);
assert.ok(futureStatus.daysRemaining !== null && futureStatus.daysRemaining >= 59);

const pastDate = Date.now() - 24 * 60 * 60 * 1000; // -1 day
const pastStatus = getFastTrackExpirationStatus(pastDate);
assert.strictEqual(pastStatus.isExpired, true);

const soonDate = Date.now() + 6 * 60 * 60 * 1000; // +6 hours
const soonStatus = getFastTrackExpirationStatus(soonDate);
assert.strictEqual(soonStatus.isExpired, false);
assert.strictEqual(soonStatus.isExpiringSoon, true);
console.log('  ✅ Expiration calculation handles future, expired, and expiring-soon states.');

// ----------------------------------------------------------------------------
// Test 4: Cross-Check Auditor with Master Catalog Lookup
// ----------------------------------------------------------------------------
console.log('\n▶ Test 4: Fast Track Cross-Check Auditor against Master Catalog');

// In-memory lookup function simulating the hydrated catalog
const seedMap = new Map(FAST_TRACK_MASTER_SEEDS.map((s) => [s.partNumber, s]));
const mockLookup = async (pn: string) => seedMap.get(sanitizePartNumberKey(pn)) || null;

const testItems: EstimateLineItem[] = [
  {
    rowIdx: 1,
    lineNumber: '1.0',
    partNumber: 'C9200L-24P-4G-E',
    smartAccountMandatory: 'No',
    description: 'Catalyst 9200L 24-port PoE+',
    serviceDurationMonths: '',
    originalLeadTimeDays: 14,
    transformedLeadTime: '14 días',
    unitListPrice: 2580,
    pricingTerm: '1',
    qty: 2,
    netCiscoUnit: 1290, // 50% discount in CCW BOM (2580 * 0.5)
    discPct: 50.0,
    isIntangible: false,
    llevaArancel: true,
    costoInternacion: 90.3,
    costoArancel: 77.4,
    costoTotalUnitario: 1457.7,
    precioVentaUnitario: 1714.94,
    precioVentaExtendido: 3429.88,
  },
  {
    rowIdx: 2,
    lineNumber: '2.0',
    partNumber: 'NON-FT-SKU-999',
    smartAccountMandatory: 'No',
    description: 'Specialty Cable',
    serviceDurationMonths: '',
    originalLeadTimeDays: 7,
    transformedLeadTime: '7 días',
    unitListPrice: 100,
    pricingTerm: '1',
    qty: 1,
    netCiscoUnit: 55,
    discPct: 45.0,
    isIntangible: false,
    llevaArancel: false,
    costoInternacion: 3.85,
    costoArancel: 0,
    costoTotalUnitario: 58.85,
    precioVentaUnitario: 69.24,
    precioVentaExtendido: 69.24,
  },
];

async function runAuditTest() {
  const auditResult = await auditEstimateWithFastTrack(testItems, mockLookup);
  assert.ok(auditResult, 'Audit result must not be null');
  assert.strictEqual(auditResult.hasOpportunity, true, 'Should detect opportunity on C9200L-24P-4G-E');
  assert.strictEqual(auditResult.totalMatchedSkus, 1, 'Should match 1 SKU');

  const match = auditResult.matches[0];
  assert.strictEqual(match.partNumber, 'C9200L-24P-4G-E');
  assert.strictEqual(match.currentDiscountPct, 50.0);
  assert.strictEqual(match.fastTrackDiscountPct, 64.5);
  // FT net price: 2580 * (1 - 0.645) = 2580 * 0.355 = 915.90
  assert.strictEqual(match.promoUnitNetPrice, 915.90);
  // Savings: 1290 - 915.90 = 374.10 per unit, total for qty 2 = 748.20
  assert.strictEqual(match.unitSavings, 374.10);
  assert.strictEqual(match.totalSavings, 748.20);
  assert.strictEqual(auditResult.totalSavings, 748.20);

  console.log(`  ✅ Fast Track audit matched SKU ${match.partNumber} saving $${auditResult.totalSavings.toFixed(2)} USD.`);
}

runAuditTest().then(() => {
  console.log('\n🎉 ALL FAST TRACK PERSISTENCE & BLINDAJE TESTS PASSED!\n');
}).catch((err) => {
  console.error('\n❌ Fast Track Persistence Test Failed:', err);
  process.exit(1);
});
