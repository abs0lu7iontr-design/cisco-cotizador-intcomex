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
import { solveGoalSeekParameters, recalculateEstimateResult } from '../src/core/calculations';
import { resolveActiveParams, saveParamProfile, deleteParamProfile } from '../src/modules/cloud/partnerParamsService';
import { saveLocalPlatformConfig, resetLocalPlatformConfig } from '../src/core/storage/localPlatformConfig';
import { setManualOfflineMode } from '../src/core/storage/offlineModeManager';
import {
  sanitizeCsvCell,
  sanitizeRichClipboardHtml,
  sanitizeSafeHttpUrl,
  sanitizeSafeMailtoUrl,
} from '../src/utils/exportSanitizers';
import { getDefaultAiSettings, sanitizeAndMigrateSettings } from '../src/modules/configuriator/aiProviderManager';
import { saveCiscoConfig, getCiscoConfig } from '../src/modules/ciscoApi/ciscoAuthService';
import { sanitizeForFirestore } from '../src/modules/cloud/firestoreService';
import { parseCiscoEml } from '../src/modules/dsv/ingestion/emlParser';
import { generateBoHtmlTable } from '../src/modules/bo/boEmailHelper';
import { generateDealReminderEmail } from '../src/modules/bo/dealEmailHelper';
import { generatePartnerEmailDraft, categorizeEstimateItems } from '../src/modules/estimate/estimateExportHelper';
import { checkGeoLocation } from '../src/modules/security/twoFactorService';
import { formatCcwrDate } from '../src/modules/ccwrQuote/ccwrParser';
import { parseFastTrackDateRange } from '../src/modules/fasttrack/fastTrackParser';
import { generateCcwrEmailHtml } from '../src/modules/ccwrQuote/ccwrExcelExporter';
import { generateEstimateEmailHtml } from '../src/core/emailClipboardHelper';

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
  const rulesNoComments = rulesCode.replace(/\/\/.*$/gm, '');
  assert.ok(rulesCode.includes("userId in ['admin', 'mskill']"), 'firestore.rules debe proteger admin y mskill');
  assert.match(
    rulesNoComments,
    /allow\s+delete:\s+if\s+isAuthenticated\(\)\s*&&\s*versionId\s*!=\s*'v0_RAW'\s*&&\s*versionId\s*!=\s*'v0'/,
    'firestore.rules debe bloquear borrado de v0_RAW / v0'
  );
  assert.ok(!rulesNoComments.includes('!isAuthenticated()'), 'firestore.rules no debe mantener respaldos !isAuthenticated()');
  assert.ok(!rulesNoComments.includes('allow read: if true'), 'firestore.rules no debe mantener lecturas públicas');

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

  // Fast Track + 0% Internación / 0% Arancel / 0% Margen debe igualar Costo Net Cisco y Facturación sin Spread negativo
  const ftBaseResult: any = {
    fileName: 'prueba_soloprueba_equipo_Estimate_AL169066246QY.xlsx',
    headerInfo: {
      customerName: 'Minera', companyName: 'Computronic', address: '', city: 'Santiago', country: 'Chile',
      phone: '', estimateId: 'AL169066246QY', dealId: 'NA', priceList: 'GPL', date: '2026-10-05',
    },
    originalProductTotal: 3627.27,
    calculatedProductTotal: 3627.27,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 3627.27,
    headerRowIndex: 13,
    items: [
      {
        rowIdx: 14, lineNumber: '1.0', partNumber: 'C9200L-24P-4G-E', smartAccountMandatory: 'No',
        description: 'Catalyst Switch', serviceDurationMonths: '-', originalLeadTimeDays: 14,
        transformedLeadTime: '4-6 semanas', unitListPrice: 7254.54, pricingTerm: '', qty: 1,
        netCiscoUnit: 3627.27, discPct: 50, isIntangible: false, llevaArancel: false,
        realUnitCost: 3627.27, isPeriodicSubscription: false, months: 1,
        costoInternacion: 0, costoArancel: 0, costoTotalUnitario: 3627.27,
        precioVentaUnitario: 3627.27, precioVentaExtendido: 3627.27,
      },
    ],
  };
  const ftZeroParams = recalculateEstimateResult(
    ftBaseResult,
    { internacionPct: 0, arancelPct: 0, margenPct: 0 },
    {},
    { 14: 2656.93 }
  );
  assert.strictEqual(ftZeroParams.originalProductTotal, 2656.93, 'COGS Cisco debe reflejar costo neto Fast Track ($2656.93)');
  assert.strictEqual(ftZeroParams.calculatedProductTotal, 2656.93, 'Facturación a 0%/0%/0% debe igualar exactamente al costo ($2656.93)');
  assert.strictEqual(ftZeroParams.items[0].fastTrackSavings, 970.34, 'Debe preservar el ahorro Fast Track ($970.34)');
  assert.strictEqual(ftZeroParams.items[0].originalNetCiscoUnit, 3627.27, 'Debe preservar costo pre-promo como referencia');
  assert.ok(storeCode.includes('setPendingFastTrackAudit(null)'), 'applyFastTrackPromos debe limpiar el banner de oportunidad pendiente');

  const summaryCardsCode = fs.readFileSync(path.join(rootDir, 'src/components/SummaryCards.tsx'), 'utf8');
  assert.ok(summaryCardsCode.includes("totalDelta >= 0 ? '+' : ''"), 'Spread en SummaryCards no debe prefijar + ante valores negativos');

  // Regla obligatoria por defecto 7/6/5 + precedencia Archivo Pre-Editado > Perfil Partner/Cliente > 7/6/5
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const lsMem: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in lsMem ? lsMem[k] : null),
      setItem: (k: string, v: string) => { lsMem[k] = String(v); },
      removeItem: (k: string) => { delete lsMem[k]; },
      clear: () => { for (const k of Object.keys(lsMem)) delete lsMem[k]; },
    };
  }
  setManualOfflineMode(true);
  saveLocalPlatformConfig({ defaultParams: { internacionPct: 0, arancelPct: 0, margenPct: 0, parameterMode: 'standard' } });
  const factoryFallback = await resolveActiveParams('PartnerSinReglaX', 'EmpresaSinReglaY');
  assert.strictEqual(factoryFallback.source, 'factory_default');
  assert.deepStrictEqual(
    { int: factoryFallback.params.internacionPct, ar: factoryFallback.params.arancelPct, mg: factoryFallback.params.margenPct },
    { int: 7, ar: 6, mg: 5 },
    'Todo estimate nuevo sin perfil ni edición previa debe cargar en 7% Int / 6% Ar / 5% Mg'
  );
  await saveParamProfile({
    scope: 'partner',
    partnerName: 'Computronic SPA',
    params: { internacionPct: 4, arancelPct: 6, margenPct: 3.5 },
    durationType: 'permanent',
  });
  const partnerMatched = await resolveActiveParams('prueba', 'Computronic SPA');
  assert.strictEqual(partnerMatched.source, 'partner_custom');
  assert.strictEqual(partnerMatched.params.margenPct, 3.5);
  await deleteParamProfile({ scope: 'partner', partnerName: 'Computronic SPA' });
  resetLocalPlatformConfig();
  setManualOfflineMode(false);
  assert.ok(storeCode.includes('effectiveLoadedParams'), 'processFileBuffer debe preservar parámetros detectados del archivo cuando existen overrides');
  assert.ok(!storeCode.includes('defaultParams: {\n              internacionPct: resolved.internacionPct'), 'setParams temporal no debe sobreescribir defaultParams globales');

  const authPy = fs.readFileSync(path.join(rootDir, 'desktop_app/auth_manager.py'), 'utf8');
  assert.ok(!authPy.includes('return password == password_hash'), 'auth_manager.py no debe tener fallback en texto plano');

  const dbPy = fs.readFileSync(path.join(rootDir, 'desktop_app/db_manager.py'), 'utf8');
  assert.ok(!dbPy.includes('shutil.copy2(canonical_path, root_db)'), 'db_manager.py no debe copiar BD con credenciales a CWD');
  assert.ok(dbPy.includes('("admin", "mskill")'), 'db_manager.py debe proteger tanto a admin como a mskill');

  // ============================================================================
  // BLOQUES 1, 2 & 3 (Ciberseguridad Integral Plataforma Web/Edge/Desktop)
  // ============================================================================
  // Bloque 1: Cero semillas AI embebidas + purge automático + Edge AI Proxy autenticado
  const aiManagerCode = fs.readFileSync(path.join(rootDir, 'src/modules/configuriator/aiProviderManager.ts'), 'utf8');
  assert.ok(!aiManagerCode.includes('SEED_G_B64'), 'aiProviderManager.ts no debe contener claves Base64 embebidas');
  assert.ok(!aiManagerCode.includes('SEED_OR_INF_B64'), 'aiProviderManager.ts no debe contener semillas OpenRouter embebidas');
  assert.strictEqual(getDefaultAiSettings().keys.length, 0, 'Configuración por defecto de IA debe iniciar sin secretos en frontend');
  const purgedAi = sanitizeAndMigrateSettings({
    ...getDefaultAiSettings(),
    keys: [
      {
        id: 'old-seed',
        provider: 'gemini',
        apiKey: 'AQ.Ab8RN6TestLegacySeed',
        model: 'gemini-3.6-flash',
        label: 'old',
        enabled: true,
      },
      {
        id: 'user-byok',
        provider: 'gemini',
        apiKey: 'AIzaSyUserByokKeyPreserved',
        model: 'gemini-3.6-flash',
        label: 'byok',
        enabled: true,
      },
    ],
  });
  assert.strictEqual(purgedAi.keys.length, 1, 'Semillas expuestas legadas deben ser purgadas manteniendo BYOK de usuario');
  assert.strictEqual(purgedAi.keys[0].id, 'user-byok');

  assert.ok(fs.existsSync(path.join(rootDir, 'functions/api/ai-proxy.ts')), 'Debe existir proxy Edge autenticado /api/ai-proxy');
  assert.ok(ciscoProxyCode.includes("role === 'viewer'"), 'cisco-proxy.ts debe rechazar rol viewer');
  assert.ok(ciscoProxyCode.includes('hasCompleteClientCreds'), 'cisco-proxy.ts debe exigir par completo clientId+clientSecret para usar credenciales cliente');
  assert.ok(!ciscoProxyCode.includes('bodyClientSecret || bodyClientId'), 'cisco-proxy.ts no debe activar pass-through si solo se envía clientId');

  const sessionAuthCode = fs.readFileSync(path.join(rootDir, 'functions/api/session-auth.ts'), 'utf8');
  assert.ok(sessionAuthCode.includes("action === 'logout'"), 'session-auth.ts debe soportar revocación en logout');
  assert.ok(sessionAuthCode.includes('verifyTwoFactorProofToken'), 'session-auth.ts debe exigir proof cryptográfico antes de emitir tokens');
  assert.ok(sessionAuthCode.includes('Set-Cookie'), 'session-auth.ts debe emitir cookie HttpOnly');

  const firestoreRulesUserBlock = fs.readFileSync(path.join(rootDir, 'src/modules/cloud/firestoreService.ts'), 'utf8');
  assert.ok(!firestoreRulesUserBlock.includes('Intcomex2026!'), 'firestoreService.ts no debe contener contraseña semilla hardcodeada');
  assert.ok(firestoreRulesUserBlock.includes('PBKDF2_CLIENT_ITERATIONS = 310000'), 'firestoreService.ts debe usar PBKDF2 310k iteraciones');
  assert.ok(authPy.includes('pbkdf2_hmac') && authPy.includes('310000'), 'auth_manager.py debe usar PBKDF2-HMAC-SHA256 con 310,000 iteraciones');

  // Bloque 2: URLs dinámicas seguras, CSP estricta sin unsafe-eval/unsafe-inline en scripts, Desktop Bridge auth
  assert.strictEqual(sanitizeSafeHttpUrl('javascript:alert(1)'), '');
  assert.strictEqual(sanitizeSafeHttpUrl('data:text/html,<script>1</script>'), '');
  assert.strictEqual(sanitizeSafeHttpUrl('https://evil.com/phish', ['cisco.com']), '');
  assert.ok(sanitizeSafeHttpUrl('https://www.cisco.com/c/en/us/products.html', ['cisco.com']).startsWith('https://www.cisco.com/'));
  assert.strictEqual(sanitizeSafeMailtoUrl('javascript:alert(1)'), '#');

  const headersContent = fs.readFileSync(path.join(rootDir, 'public/_headers'), 'utf8');
  const scriptSrcMatch = headersContent.match(/script-src\s+([^;]+)/i);
  assert.ok(
    scriptSrcMatch &&
      !scriptSrcMatch[1].includes("'unsafe-inline'") &&
      !scriptSrcMatch[1].includes("'unsafe-eval'"),
    'CSP script-src no debe permitir unsafe-inline ni unsafe-eval'
  );
  assert.ok(headersContent.includes("frame-ancestors 'none'"), 'CSP debe incluir frame-ancestors none');

  const desktopWinPy = fs.readFileSync(path.join(rootDir, 'desktop_app/desktop_window.py'), 'utf8');
  assert.ok(desktopWinPy.includes('import urllib.parse'), 'desktop_window.py debe importar urllib.parse para _is_allowed_cisco_url');
  assert.ok(desktopWinPy.includes('_require_authenticated_user'), 'desktop_window.py debe exigir sesión autenticada en métodos sensibles');
  assert.ok(!desktopWinPy.includes('or "mskill"'), 'desktop_window.py no debe usar fallback mskill en auditoría');
  assert.ok(!desktopWinPy.includes("subprocess.Popen(f'explorer"), 'open_folder_in_explorer no debe interpolar comandos string');

  const fileProcPy = fs.readFileSync(path.join(rootDir, 'desktop_app/file_processor.py'), 'utf8');
  assert.ok(fileProcPy.includes('_ensure_within_base') && fileProcPy.includes('commonpath'), 'file_processor.py debe validar contención de rutas con commonpath');

  // Bloque 3: Secretos solo en memoria para Cisco M2M, Edge health/mining-audit, MIME ReDoS-safe, Firestore depth/proto guard
  localStorage.removeItem('cisco_api_config_v2');
  saveCiscoConfig({ clientId: 'test-client-id', clientSecret: 'super-secret-value' });
  const storedRawCfg = JSON.parse(localStorage.getItem('cisco_api_config_v2') || '{}');
  assert.strictEqual(storedRawCfg.clientSecret, undefined, 'saveCiscoConfig nunca debe persistir clientSecret en localStorage');
  assert.strictEqual(localStorage.getItem('cisco_oauth_token_v2'), null, 'saveCiscoConfig nunca debe persistir tokens OAuth en localStorage');
  assert.strictEqual(getCiscoConfig().clientSecret, 'super-secret-value', 'clientSecret ingresado en sesión debe mantenerse en memoria');

  const miningAuditFn = fs.readFileSync(path.join(rootDir, 'functions/api/mining-audit.ts'), 'utf8');
  assert.ok(miningAuditFn.includes('verifyEdgeSessionToken') && miningAuditFn.includes('MAX_MINING_ITEMS'), 'mining-audit.ts debe exigir sesión y acotar items');

  const healthFn = fs.readFileSync(path.join(rootDir, 'functions/api/health.ts'), 'utf8');
  assert.ok(!healthFn.includes("'Access-Control-Allow-Origin': '*'"), 'health.ts debe usar allowlist CORS en vez de wildcard');

  const emlParsed = parseCiscoEml(
    'MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="BOUND"\r\n\r\n--BOUND\r\nContent-Disposition: attachment; filename="12345678_Cisco-Deal-BOM-Pricing-Details.xls"\r\nContent-Transfer-Encoding: base64\r\n\r\naGVsbG8=\r\n--BOUND--\r\n'
  );
  assert.strictEqual(emlParsed.dealId, '12345678', 'Parser MIME lineal debe extraer Deal ID correctamente');
  assert.strictEqual(emlParsed.bomAttachment?.fileName, '12345678_Cisco-Deal-BOM-Pricing-Details.xls');

  const protoInput = JSON.parse('{"safe":"ok","__proto__":{"polluted":true},"nested":{"fn":null}}');
  const sanitizedDoc = sanitizeForFirestore(protoInput);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitizedDoc, '__proto__'), false);
  assert.strictEqual(sanitizedDoc.safe, 'ok');

  let deepObj: any = { leaf: 1 };
  for (let i = 0; i < 32; i++) deepObj = { next: deepObj };
  const boundedDoc = sanitizeForFirestore(deepObj);
  assert.ok(boundedDoc && boundedDoc.next, 'sanitizeForFirestore debe acotar recursión sin desbordar pila');

  assert.ok(desktopWinPy.includes('_dpapi_protect_text') && desktopWinPy.includes('_verify_bundle_manifest_sha256'), 'desktop_window.py debe proteger ai_config con DPAPI y verificar SHA-256 de bundle al iniciar');
  const dashPy = fs.readFileSync(path.join(rootDir, 'desktop_app/dashboard_analytics.py'), 'utf8');
  assert.ok(dashPy.includes('_sanitize_csv_cell'), 'dashboard_analytics.py debe sanitizar celdas CSV contra inyección de fórmulas');

  // QA Web P0/P1/P2 Hardening:
  assert.ok(rulesCode.includes('pbkdf2\\\\$'), 'firestore.rules debe aceptar hashes PBKDF2 además de SHA-256 legacy');
  const turnstileWidgetCode = fs.readFileSync(path.join(rootDir, 'src/modules/security/TurnstileWidget.tsx'), 'utf8');
  assert.ok(turnstileWidgetCode.includes('onSuccessRef') && turnstileWidgetCode.includes('}, [theme])'), 'TurnstileWidget no debe destruirse al escribir en LoginScreen');
  assert.ok(miningAuditFn.includes('X-Session-Token'), 'mining-audit.ts debe permitir header X-Session-Token en CORS');
  const aiProxyCode = fs.readFileSync(path.join(rootDir, 'functions/api/ai-proxy.ts'), 'utf8');
  assert.ok(aiProxyCode.includes('checkEdgeRateLimit'), 'ai-proxy.ts debe aplicar rate limiting');
  const swCode = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
  assert.ok(swCode.includes("url.pathname.startsWith('/api/')"), 'sw.js debe excluir explícitamente /api/');
  const htmlCode = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.ok(!htmlCode.includes('user-scalable=no'), 'index.html debe permitir zoom de accesibilidad');
  assert.strictEqual(sanitizeSafeMailtoUrl('mailto:invalid_email?subject=x'), '#', 'sanitizeSafeMailtoUrl debe rechazar direcciones malformadas');
  const twoFactorModalCode = fs.readFileSync(path.join(rootDir, 'src/modules/security/TwoFactorModal.tsx'), 'utf8');
  assert.ok(twoFactorModalCode.includes('useAccessibleModal'), 'TwoFactorModal debe usar useAccessibleModal');

  // Re-Auditoría Bloques X / Y / Z (v2.29.0):
  const sessionAuthCodeReaudit = fs.readFileSync(path.join(rootDir, 'functions/api/session-auth.ts'), 'utf8');
  assert.ok(sessionAuthCodeReaudit.includes('hasVerifiedTwoFactorProof'), 'session-auth debe validar twoFactorProof antes de eximir Turnstile');
  assert.ok(!sessionAuthCodeReaudit.includes('email_verified: Boolean(verifiedUser.email)'), 'session-auth no debe emitir email_verified desde documento mutable');
  assert.ok(rulesCode.includes('function isNotViewer()'), 'firestore.rules debe bloquear escrituras para rol viewer');
  assert.ok(rulesCode.includes('match /access_requests/{requesterId}'), 'firestore.rules debe aislar solicitudes de acceso en subcolección');
  assert.ok(swCode.includes('url.origin !== self.location.origin'), 'sw.js solo debe cachear recursos same-origin');
  assert.ok(headersContent.includes("worker-src 'self' blob:"), '_headers debe incluir worker-src self blob:');
  assert.ok(scriptSrcMatch && !scriptSrcMatch[1].includes('*.googleapis.com'), 'CSP script-src no debe incluir wildcard *.googleapis.com');
  assert.ok(!desktopWinPy.includes('existing_bundled_only'), 'desktop_window.py no debe cargar bundles frozen sin verificar SHA-256');
  const dbMgrPy = fs.readFileSync(path.join(rootDir, 'desktop_app/db_manager.py'), 'utf8');
  assert.ok(dbMgrPy.includes("'viewer'"), 'db_manager.py CHECK constraint debe aceptar rol viewer');
  assert.strictEqual(sanitizeForFirestore({ badNum: NaN } as any).badNum, undefined, 'sanitizeForFirestore debe omitir campos NaN para cumplir reglas numéricas de Firestore');
  assert.strictEqual(formatCcwrDate('2026-11-27'), '27-nov-2026', 'formatCcwrDate debe preservar fechas ISO YYYY-MM-DD sin shift UTC local');
  const usRange = parseFastTrackDateRange('Eligible from 10/25/2026 - 11/30/2026');
  assert.ok(usRange?.validFrom && new Date(usRange.validFrom).getMonth() === 9 && new Date(usRange.validFrom).getDate() === 25, 'parseFastTrackDateRange debe parsear MM/DD/YYYY correctamente');
  const escapedCcwrHtml = generateCcwrEmailHtml(
    { endCustomerName: '<img src=x onerror=alert(1)>', quoteNumber: 'Q1', quoteDate: '27-nov-2026' } as any,
    { byProduct: [], totalPrecioVenta: 100 } as any,
    { sellerName: 'Test <PM>' } as any
  );
  assert.ok(!escapedCcwrHtml.includes('<img src=x'), 'generateCcwrEmailHtml debe escapar HTML de campos de cliente');
  const mailDraft = generateEstimateEmailHtml(
    { fileName: 'Estimate_123.xlsx', headerInfo: { companyName: 'PartnerX', customerName: 'ClienteY' }, items: [], calculatedProductTotal: 0 } as any
  );
  assert.ok(mailDraft.includes('PartnerX') && mailDraft.includes('ClienteY'), 'generateEstimateEmailHtml debe conservar companyName->Partner y customerName->Cliente');

  console.log('  ✅ Bloques C, Hardening 1/2/3 & QA Web P0/P1/P2 verificados.');
  console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DE AUDITORÍA Y HARDENING PASARON AL 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en pruebas Bloques A/B/C:', err);
    process.exit(1);
  });
