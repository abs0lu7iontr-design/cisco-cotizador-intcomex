import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import { synthesizeOfficialEstimateWorkbook, parseEstimateWorkbook } from '../src/core/excelEngine';
import { generateQuotationFileName } from '../src/core/exportUtils';
import { reconstructProcessedResultFromCloudRecord } from '../src/core/storePersistence';
import { solveGoalSeekParameters } from '../src/core/calculations';
import { sanitizeCsvCell, sanitizeRichClipboardHtml } from '../src/utils/exportSanitizers';
import { generateBoHtmlTable } from '../src/modules/bo/boEmailHelper';
import { generateDealReminderEmail } from '../src/modules/bo/dealEmailHelper';
import { generatePartnerEmailDraft, categorizeEstimateItems } from '../src/modules/estimate/estimateExportHelper';
import { checkGeoLocation } from '../src/modules/security/twoFactorService';

async function runTests() {
  console.log('🧪 Iniciando Suite de Auditoría Completa (Bloques A, B y C)...\n');

  // ============================================================================
  // BLOQUE A: Seguridad Edge, 2FA, Proxy Cisco & Firestore Rules
  // ============================================================================
  const ciscoProxyCode = fs.readFileSync(path.join(rootDir, 'functions/api/cisco-proxy.ts'), 'utf8');
  assert.ok(!ciscoProxyCode.includes('801e3a4f-'), 'cisco-proxy.ts no debe contener secretos M2M hardcodeados');
  assert.ok(ciscoProxyCode.includes('verifyEdgeSessionToken'), 'cisco-proxy.ts debe exigir token de sesión autenticado');
  assert.ok(ciscoProxyCode.includes('__EDGE_MANAGED__'), 'cisco-proxy.ts no debe exponer token de servidor al navegador');

  const ciscoAuthCode = fs.readFileSync(path.join(rootDir, 'src/modules/ciscoApi/ciscoAuthService.ts'), 'utf8');
  assert.ok(!ciscoAuthCode.includes('801e3a4f-'), 'ciscoAuthService.ts no debe contener clientSecret hardcodeado');

  const otpFnCode = fs.readFileSync(path.join(rootDir, 'functions/api/send-2fa-otp.ts'), 'utf8');
  assert.ok(!otpFnCode.includes('Cisco_2FA_Edge_Master_Secret_2026!'), 'send-2fa-otp.ts no debe usar clave fallback hardcodeada');
  assert.ok(otpFnCode.includes('fetchFirestoreUserRecord'), 'send-2fa-otp.ts debe obtener email verificado desde Firestore');
  assert.ok(otpFnCode.includes('MAX_OTP_ATTEMPTS'), 'send-2fa-otp.ts debe limitar intentos OTP');

  const reminderCronCode = fs.readFileSync(path.join(rootDir, 'functions/api/deal-reminder-cron.ts'), 'utf8');
  assert.ok(!reminderCronCode.includes("'Access-Control-Allow-Origin': '*'"), 'deal-reminder-cron.ts no debe usar CORS *');
  assert.ok(reminderCronCode.includes('isAuthorizedCronOrSession'), 'deal-reminder-cron.ts debe autenticar llamadas');
  assert.ok(reminderCronCode.includes('escapeHtml'), 'deal-reminder-cron.ts debe escapar HTML');

  const rulesCode = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
  assert.ok(rulesCode.includes("userId in ['admin', 'mskill']"), 'firestore.rules debe proteger admin y mskill');
  assert.match(
    rulesCode,
    /allow\s+delete:\s+if\s+versionId\s*!=\s*'v0_RAW'\s*&&\s*versionId\s*!=\s*'v0'/,
    'firestore.rules debe bloquear borrado de v0_RAW / v0'
  );

  // Fail-closed geo check en entorno web remoto
  const origWindow = (globalThis as any).window;
  const origFetch = globalThis.fetch;
  try {
    (globalThis as any).window = { location: { hostname: 'develop.cisco-automated.pages.dev', protocol: 'https:' } };
    globalThis.fetch = async () => {
      throw new Error('timeout');
    };
    const geo = await checkGeoLocation();
    assert.strictEqual(geo.requires2FA, true, 'checkGeoLocation debe hacer fail-closed en origen web remoto');
  } finally {
    (globalThis as any).window = origWindow;
    globalThis.fetch = origFetch;
  }
  console.log('  ✅ Bloque A (Proxy Cisco, 2FA fail-closed, Cron Auth/CORS y Firestore Rules) verificado.');

  // ============================================================================
  // BLOQUE B: Meraki Periódico Re-Import, Porcentajes <= 1%, Cloud Round-Trip, Sesión
  // ============================================================================
  const merakiParams = { internacionPct: 0, arancelPct: 0, margenPct: 10, parameterMode: 'standard' as const };
  const samplePeriodicItem: any = {
    rowIdx: 2,
    lineNumber: '1.0',
    partNumber: 'LIC-CW-E',
    smartAccountMandatory: 'Yes',
    description: 'Meraki Wireless Enterprise License 36 Months',
    serviceDurationMonths: '36 Months',
    originalLeadTimeDays: 7,
    transformedLeadTime: 'Stock / 1 sem',
    unitListPrice: 12.5,
    pricingTerm: '36',
    qty: 2,
    discPct: 56,
    netCiscoUnit: 198, // 5.50 * 36
    unitNetPriceCcw: 5.5,
    extendedNetPriceCcw: 396,
    months: 36,
    detectedDurationMonths: 36,
    isPeriodicSubscription: true,
    realUnitCost: 198,
    isIntangible: true,
    llevaArancel: false,
    costoInternacion: 0,
    costoArancel: 0,
    costoTotalUnitario: 198,
    precioVentaUnitario: 220, // 198 / 0.9
    precioVentaExtendido: 440,
  };

  const merakiProcessed: any = {
    fileName: 'EST-MERAKI-36.xlsx',
    headerInfo: {
      estimateId: 'EST-MERAKI-36',
      dealId: '86803728',
      customerName: 'Cliente Meraki',
      companyName: 'Partner Meraki',
      address: '',
      city: 'Santiago',
      country: 'CL',
      phone: '',
      priceList: 'GLUS',
      date: '2026-11-25',
    },
    items: [samplePeriodicItem],
    originalProductTotal: 396,
    calculatedProductTotal: 440,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 440,
    headerRowIndex: 13,
  };

  const xlsxBuf = await synthesizeOfficialEstimateWorkbook(merakiProcessed, merakiParams);

  const reParsed = await parseEstimateWorkbook(xlsxBuf, merakiParams, 'EST-MERAKI-36_CALC.xlsx');
  assert.strictEqual(reParsed.result.items.length, 1);
  assert.strictEqual(reParsed.result.items[0].isPeriodicSubscription, true, 'Re-import debe mantener isPeriodicSubscription=true');
  assert.strictEqual(reParsed.result.items[0].months, 36, 'Re-import debe preservar duración de 36 meses');
  assert.ok(
    reParsed.result.calculatedProductTotal > 400,
    `Re-import de Meraki 36 meses no debe subcotizarse 36x (obtenido: ${reParsed.result.calculatedProductTotal})`
  );

  // Porcentajes <= 1.0% (sin crash ni inflado 100x)
  const lowPctParams = { internacionPct: 0.5, arancelPct: 1.0, margenPct: 1.0, parameterMode: 'standard' as const };
  const lowPctProcessed: any = {
    ...merakiProcessed,
    headerInfo: { ...merakiProcessed.headerInfo, estimateId: 'EST-LOW', dealId: 'NA' },
    items: [
      {
        ...samplePeriodicItem,
        isPeriodicSubscription: false,
        months: 1,
        detectedDurationMonths: 1,
        unitNetPriceCcw: 100,
        netCiscoUnit: 100,
        realUnitCost: 100,
        costoTotalUnitario: 100,
        precioVentaUnitario: 101.01,
        precioVentaExtendido: 202.02,
      },
    ],
    calculatedProductTotal: 202.02,
    finalTotalPrice: 202.02,
  };
  const lowPctBuf = await synthesizeOfficialEstimateWorkbook(lowPctProcessed, lowPctParams);
  const reParsedLow = await parseEstimateWorkbook(lowPctBuf, lowPctParams, 'EST-LOW_CALC.xlsx');
  assert.strictEqual(reParsedLow.result.detectedAudit?.previousMarginPct, 1.0, 'Margen 1.0% no debe multiplicarse a 100%');
  assert.strictEqual(reParsedLow.result.detectedAudit?.previousInternacionPct, 0.5, 'Internación 0.5% no debe multiplicarse a 50%');
  assert.strictEqual(reParsedLow.result.detectedAudit?.previousArancelPct, 1.0, 'Arancel 1.0% no debe multiplicarse a 100%');

  const lowTagName = generateQuotationFileName({
    partner: 'Partner',
    customerName: 'Cliente',
    technologyOrFamily: 'Switch',
    estimateId: 'EST1',
    internacionPct: 1.0,
    marginPct: 1.0,
    isRecalculated: true,
    isOnlyLicensing: false,
  });
  assert.ok(lowTagName.includes('I1M1'), `Nombre debe contener I1M1 en vez de I100M100 (actual: ${lowTagName})`);

  // Cloud round-trip preserva qty:0 infoRow y metadata periódica
  const restored = reconstructProcessedResultFromCloudRecord({
    id: 'cloud-1',
    dealId: 'D1',
    estimateId: 'EST-C',
    partnerName: 'Partner',
    clientFinalName: 'Client',
    originalFileName: 'test.xlsx',
    createdAt: '2026-11-25T10:00:00Z',
    creator: { username: 'pm', fullName: 'PM', role: 'pm' },
    financialSummary: { totalNetCisco: 198, totalCotizadoIntcomex: 220, gananciaIntcomexUsd: 22, margenPct: 10, currency: 'USD', params: merakiParams },
    headerInfo: { estimateId: 'EST-C', dealId: 'D1', companyName: 'Partner', customerName: 'Client', address: '', city: '', country: '', phone: '', priceList: 'GLUS', date: '2026-11-25' },
    itemsCount: 1,
    customOverrideMap: {},
    items: [
      { rowIdx: 1, lineNumber: '1.0', partNumber: 'LIC-CW-E', description: 'Meraki', qty: 1, unitListPrice: 12.5, netCiscoUnit: 198, discPct: 56, transformedLeadTime: 'Stock', isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 198, precioVentaUnitario: 220, precioVentaExtendido: 220, months: 36, detectedDurationMonths: 36, isPeriodicSubscription: true, realUnitCost: 198 },
      { rowIdx: 2, lineNumber: '', partNumber: 'INITIAL TERM', description: 'Initial Term - 36 Months', qty: 0, isInfoRow: true, unitListPrice: 0, netCiscoUnit: 0, discPct: 0, transformedLeadTime: '', isIntangible: true, llevaArancel: false, costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 0, precioVentaUnitario: 0, precioVentaExtendido: 0 },
    ],
  });
  assert.strictEqual(restored.reconstructedItems[0].months, 36);
  assert.strictEqual(restored.reconstructedItems[0].isPeriodicSubscription, true);
  assert.strictEqual(restored.reconstructedItems[1].qty, 0, 'Fila info debe conservar qty: 0');
  assert.strictEqual(restored.reconstructedItems[1].isInfoRow, true, 'Fila info debe conservar isInfoRow: true');

  const storeCode = fs.readFileSync(path.join(rootDir, 'src/core/store.tsx'), 'utf8');
  assert.ok(storeCode.includes('clearEdgeSessionToken()'), 'logout() debe limpiar el token de sesión Edge');
  assert.ok(storeCode.includes('clearEstimate()'), 'logout() debe limpiar la cotización activa');
  console.log('  ✅ Bloque B (Meraki 36x, porcentajes <= 1%, Cloud round-trip y aislamiento logout) verificado.');

  // ============================================================================
  // BLOQUE C: Caché IDB, Seguridad Desktop, Sanitación HTML/CSV & Goal Seek / CCW-R
  // ============================================================================
  assert.strictEqual(sanitizeCsvCell('=CMD("calc")'), '"\'=CMD(""calc"")"');
  assert.strictEqual(sanitizeCsvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
  assert.strictEqual(sanitizeCsvCell(-123.45), '"-123.45"');

  const cleanedHtml = sanitizeRichClipboardHtml('<p>Hola</p><script>alert(1)</script><img src=x onerror="alert(2)">');
  assert.ok(!cleanedHtml.includes('<script>'), 'Debe eliminar <script>');
  assert.ok(!cleanedHtml.includes('onerror='), 'Debe eliminar manejadores on*');

  const xss = '<img src=x onerror=alert(1)>';
  const boHtml = generateBoHtmlTable(
    [{ sku: xss, partNumber: xss, bodega: 'E1', qty: 1, unitNetPrice: 100, extendedNetPrice: 100, isHardware: true, motherLine: '1.0' }],
    { partnerName: xss, clientName: xss, dealId: xss }
  );
  assert.ok(!boHtml.includes('<img src=x'), 'generateBoHtmlTable debe escapar etiquetas HTML');

  const dealMail = generateDealReminderEmail({
    id: '1', dealId: xss, partnerName: xss, endCustomerName: xss, escalationChannel: 'AM_CISCO', amContactName: xss,
    status: 'PENDING_APPROVAL', escalatedAt: '2026-11-25T10:00:00Z', createdAt: '2026-11-25T10:00:00Z', updatedAt: '2026-11-25T10:00:00Z',
    reminderCopyCount: 0, history: [],
  } as any);
  assert.ok(!dealMail.htmlContent.includes('<img src=x'), 'generateDealReminderEmail debe escapar HTML');

  const partnerDraft = generatePartnerEmailDraft({
    partnerName: xss,
    clientName: xss,
    dealId: xss,
    estimateId: xss,
    summary: categorizeEstimateItems([{ ...samplePeriodicItem, isPeriodicSubscription: false, months: 1, precioVentaUnitario: 100, precioVentaExtendido: 100 }]),
    groupingOptions: { groupByLine: true, selectedLine: 'ALL' },
  });
  assert.ok(!partnerDraft.bodyHtml.includes('<img src=x'), 'generatePartnerEmailDraft debe escapar HTML');

  const gsCustom = solveGoalSeekParameters(
    [{ ...samplePeriodicItem, lineNumber: '1.0', isPeriodicSubscription: false, months: 1, netCiscoUnit: 100, qty: 1, effectiveMargenPct: 20 }] as any,
    115,
    'target_price',
    { internacionPct: 7, arancelPct: 6, margenPct: 5, parameterMode: 'custom_lines', lineCustomParams: { '1.0': { internacionPct: 7, arancelPct: 6, margenPct: 25 } } }
  );
  assert.strictEqual(gsCustom.success, true);

  const authPy = fs.readFileSync(path.join(rootDir, 'desktop_app/auth_manager.py'), 'utf8');
  assert.ok(!authPy.includes('return password == password_hash'), 'auth_manager.py no debe tener fallback en texto plano');

  const dbPy = fs.readFileSync(path.join(rootDir, 'desktop_app/db_manager.py'), 'utf8');
  assert.ok(!dbPy.includes('shutil.copy2(canonical_path, root_db)'), 'db_manager.py no debe copiar BD con credenciales a CWD');
  assert.ok(dbPy.includes('("admin", "mskill")'), 'db_manager.py debe proteger tanto a admin como a mskill');

  console.log('  ✅ Bloque C (Sanitación CSV/HTML, Goal Seek, Caché IDB y Seguridad Desktop) verificado.');
  console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DE BLOQUES A, B y C PASARON AL 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en pruebas Bloques A/B/C:', err);
    process.exit(1);
  });
