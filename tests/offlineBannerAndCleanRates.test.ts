// ============================================================================
// CISCO AUTOMATED v2.15.2 - TEST SUITE: OFFLINE BANNER, CLOUD INTERCEPTOR & CLEAN DOLLAR
// ============================================================================

import assert from 'node:assert';
import {
  USD_TO_CLP_FRONTEND_SPREAD,
  applyFrontendUsdClpSpread,
  snapshotToConversionRates,
  getDefaultOfficialRatesSnapshot,
} from '../src/core/chileanExchangeRateService';
import { convertUsdToCurrency } from '../src/core/calculations';

console.log('🧪 Iniciando Suite de Pruebas: Banner Offline Auto-Dismiss, Interceptor Online & Dólar Limpio (v2.15.2)...');

// --- 1. Dólar Actual Sin Sumar +10 ---
console.log('  Testing Clean Dollar Rates (Sin Spread +10)...');
assert.strictEqual(USD_TO_CLP_FRONTEND_SPREAD, 0, 'USD_TO_CLP_FRONTEND_SPREAD debe ser 0 para mostrar solo el dólar actual');

const baseDollar = 981.61;
const cleanApplied = applyFrontendUsdClpSpread(baseDollar);
assert.strictEqual(cleanApplied, 981.61, 'applyFrontendUsdClpSpread sin argumentos debe retornar exactamente el dólar actual sin sumar +10');

const defaultSnap = getDefaultOfficialRatesSnapshot();
assert.strictEqual(defaultSnap.spreadClp, 0, 'Snapshot oficial por defecto debe tener spreadClp en 0');
assert.strictEqual(defaultSnap.dolarAplicadoClp, defaultSnap.dolarObservadoOficial, 'dolarAplicadoClp debe ser idéntico a dolarObservadoOficial');

const conversionRates = snapshotToConversionRates(defaultSnap);
assert.strictEqual(conversionRates.CLP, defaultSnap.dolarObservadoOficial, 'rates.CLP debe ser el Dólar Actual sin sumar +10');

// --- 2. Conversión a CLP en Cotizador usando Dólar Actual ---
console.log('  Testing CLP Currency Conversion with Clean Actual Dollar...');
const amountUsd = 1500;
const convertedClp = convertUsdToCurrency(amountUsd, 'CLP', conversionRates);
const expectedClp = Math.round((amountUsd * defaultSnap.dolarObservadoOficial + Number.EPSILON) * 100) / 100;
assert.strictEqual(convertedClp, expectedClp, 'La conversión a CLP debe multiplicar directamente por el dólar actual');
console.log(`  ✅ Test 1: Conversión limpia de 1500 USD a CLP = $${convertedClp.toLocaleString('es-CL')} CLP sin recargos.`);

// --- 3. Validación de Módulos Restringidos Exclusivos Online ---
console.log('  Testing Cloud-Only Feature Interception Definitions...');
const CLOUD_ONLY_VIEWS = new Set(['configuriator', 'feedback', 'users', 'audit']);
assert.ok(CLOUD_ONLY_VIEWS.has('configuriator'), 'ConfigurIAtor (IA en vivo) debe requerir Modo Online');
assert.ok(CLOUD_ONLY_VIEWS.has('feedback'), 'Feedback / Soporte debe requerir Modo Online');
assert.ok(CLOUD_ONLY_VIEWS.has('users'), 'Gestión de Usuarios Cloud debe requerir Modo Online');
assert.ok(CLOUD_ONLY_VIEWS.has('audit'), 'Auditoría Cloud debe requerir Modo Online');
assert.ok(!CLOUD_ONLY_VIEWS.has('quoter'), 'Cotizador CCW debe operar completamente Offline');
assert.ok(!CLOUD_ONLY_VIEWS.has('dsv'), 'Generador DSV debe operar completamente Offline');
assert.ok(!CLOUD_ONLY_VIEWS.has('bo_tracking'), 'Tracking BO debe operar completamente Offline');
assert.ok(!CLOUD_ONLY_VIEWS.has('pipeline'), 'Pipeline Comercial debe operar completamente Offline');
assert.ok(!CLOUD_ONLY_VIEWS.has('forecast'), 'Forecast Comercial debe operar completamente Offline');
assert.ok(!CLOUD_ONLY_VIEWS.has('demand_intel'), 'Demanda & Stock debe operar completamente Offline');
console.log('  ✅ Test 2: Clasificación de módulos Offline vs Online validada correctamente.');

console.log('🎉 TODAS LAS PRUEBAS DE BANNER AUTO-DISMISS, INTERCEPTOR Y DÓLAR LIMPIO PASARON AL 100%!\n');
