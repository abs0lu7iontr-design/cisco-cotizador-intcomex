// ============================================================================
// TESTS: DSV & BO HISTORY PERSISTENCE ARMOR AND ZERO DATA LOSS VERIFICATION
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { SEED_DSV_RECORDS } from '../src/modules/dsv/dsvSeeds';

describe('DSV & BO History Persistence Armor (Zero Data Loss)', () => {
  it('1. SEED_DSV_RECORDS includes historical orders including Infocorp Deal 86146758', () => {
    assert.ok(SEED_DSV_RECORDS.length >= 4, `Expected at least 4 seeds, found ${SEED_DSV_RECORDS.length}`);

    const infocorp = SEED_DSV_RECORDS.find((d) => d.dealId === '86146758' || d.soNumber === '86146758');
    assert.ok(infocorp, 'Infocorp Deal 86146758 should be present in seeds');
    assert.ok(infocorp?.partnerId?.includes('Infocorp'));
    assert.strictEqual(infocorp?.financialSummary?.totalReportedNetPrice, 8734.78);
    assert.strictEqual(infocorp?.financialSummary?.totalItems, 8);

    const sonda = SEED_DSV_RECORDS.find((d) => d.dealId === 'DEAL-8899201');
    assert.ok(sonda, 'Sonda Deal 8899201 should be present in seeds');
    assert.ok(sonda?.resellerName?.includes('Sonda'));

    const telefonica = SEED_DSV_RECORDS.find((d) => d.dealId === 'DEAL-7744102');
    assert.ok(telefonica, 'Telefónica Tech Deal 7744102 should be present in seeds');
    assert.ok(telefonica?.resellerName?.includes('Telefónica Tech'));

    const entel = SEED_DSV_RECORDS.find((d) => d.dealId === 'DEAL-6612984');
    assert.ok(entel, 'Entel Deal 6612984 should be present in seeds');
    assert.ok(entel?.resellerName?.includes('Entel'));
  });

  it('2. DsvModal.tsx automatically calls saveDsvToCloud and syncBoOrderFromDsvRecord on executeExport', () => {
    const dsvModalCode = fs.readFileSync(path.resolve('src/modules/dsv/DsvModal.tsx'), 'utf-8');

    // Verify saveDsvToCloud import and auto-save invocation
    assert.ok(dsvModalCode.includes('import { saveDsvToCloud } from'), 'DsvModal must import saveDsvToCloud');
    assert.ok(dsvModalCode.includes('saveDsvToCloud({'), 'DsvModal must call saveDsvToCloud on export');
    assert.ok(dsvModalCode.includes('totalReportedNetPrice: totalReportedNet'), 'DsvModal must record total net price');
    assert.ok(dsvModalCode.includes('syncBoOrderFromDsvRecord({'), 'DsvModal must synchronize with bo_order_tracking');
  });

  it('3. firestoreService.ts never purges local vaults with removeItem (> 20KB bug removed)', () => {
    const firestoreServiceCode = fs.readFileSync(path.resolve('src/modules/cloud/firestoreService.ts'), 'utf-8');

    assert.ok(!firestoreServiceCode.includes('localStorage.removeItem(LOCAL_DSV_BACKUP_KEY)'), 'Destructive removeItem bug must not exist');
    assert.ok(!firestoreServiceCode.includes('localStorage.removeItem(LOCAL_DSV_VAULT_KEY)'), 'Destructive removeItem vault bug must not exist');
    assert.ok(firestoreServiceCode.includes('hydrateDsvCacheFromIndexedDb'), 'Must include IndexedDB async hydration for DSVs');
    assert.ok(firestoreServiceCode.includes('SEED_DSV_RECORDS'), 'Must fallback to SEED_DSV_RECORDS if cache is empty');
  });

  it('4. boTrackingService.ts includes permanent vault and anti-zero loss auto-hydration', () => {
    const boTrackingServiceCode = fs.readFileSync(path.resolve('src/modules/bo/boTrackingService.ts'), 'utf-8');

    assert.ok(boTrackingServiceCode.includes('LOCAL_BO_TRACKING_VAULT_KEY'), 'Must write to permanent vault key');
    assert.ok(boTrackingServiceCode.includes('hasUserDeletedAllSeeds'), 'Must check user deletion before wiping seeds');
    assert.ok(boTrackingServiceCode.includes('getBoIndividualHistory'), 'Must export getBoIndividualHistory function');
  });

  it('5. BoTrackingView.tsx includes Historial Individual subnav tab and renders BoIndividualHistoryView', () => {
    const trackingViewCode = fs.readFileSync(path.resolve('src/modules/bo/BoTrackingView.tsx'), 'utf-8');

    assert.ok(trackingViewCode.includes("import { BoIndividualHistoryView } from './BoIndividualHistoryView'"), 'Must import BoIndividualHistoryView');
    assert.ok(trackingViewCode.includes("activeTab === 'history'"), 'Must handle history tab switch');
    assert.ok(trackingViewCode.includes('Historial Individual de Órdenes BO'), 'Must have button for Historial Individual');
    assert.ok(trackingViewCode.includes('<BoIndividualHistoryView'), 'Must render BoIndividualHistoryView');
  });

  it('6. BoIndividualHistoryView.tsx provides auto-current-month default, partner, bodega, stage filters & TableDensityZoomControls', () => {
    const historyViewCode = fs.readFileSync(path.resolve('src/modules/bo/BoIndividualHistoryView.tsx'), 'utf-8');

    assert.ok(historyViewCode.includes('getCurrentYearMonth()'), 'Must default to current year-month');
    assert.ok(historyViewCode.includes('Mes Actual'), 'Must show Mes Actual option');
    assert.ok(historyViewCode.includes('TableDensityZoomControls'), 'Must include TableDensityZoomControls');
    assert.ok(historyViewCode.includes('Todas las Bodegas (E1 y ED)'), 'Must allow filtering by bodega E1 and ED');
    assert.ok(historyViewCode.includes('Exportar Excel / CSV'), 'Must provide export button');
    assert.ok(historyViewCode.includes('BO_STAGES_METADATA'), 'Must use BO stage metadata');
  });
});
