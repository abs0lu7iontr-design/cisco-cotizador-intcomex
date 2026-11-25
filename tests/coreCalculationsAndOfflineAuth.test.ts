import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

import { parseFlexibleNumber } from '../src/modules/forecast/forecastService';
import { safeParseFloat, checkIsIntangible, solveGoalSeekParameters } from '../src/core/calculations';
import {
  extractMonthAndYearFromCommercialValue,
  matchesPeriodFilter,
} from '../src/utils/dateUtils';
import { sha256Salted } from '../src/modules/cloud/firestoreService';

async function runTests() {
  console.log('🧪 Iniciando Suite: Offline Queue/Conflictos (#3), Auth (#4) y Cálculos/Fechas (#5)...\n');

  // #3: Verificación estática y de tipos en offlineSyncQueue y offlineConflictDetector
  const queueCode = fs.readFileSync(
    path.resolve(__dirname, '../src/core/storage/offlineSyncQueue.ts'),
    'utf8'
  );
  assert.ok(queueCode.includes("case 'save_sku_override'"), 'offlineSyncQueue debe manejar save_sku_override');
  assert.ok(queueCode.includes("case 'save_ticket'"), 'offlineSyncQueue debe manejar save_ticket');
  assert.ok(
    !queueCode.includes('default:\n      return { ok: true }'),
    'default en executeQueuedItem no debe descartar acciones desconocidas retornando ok: true'
  );

  const conflictCode = fs.readFileSync(
    path.resolve(__dirname, '../src/core/storage/offlineConflictDetector.ts'),
    'utf8'
  );
  assert.ok(
    !conflictCode.includes('remoteCreatedTs > localRec.createdAt'),
    'offlineConflictDetector no debe comparar number contra string ISO en createdAt'
  );
  console.log('  ✅ Reglas de cola offline y comparador temporal de conflictos (#3) verificados.');

  // #4: Auth con sal por usuario, sin fallback texto plano ni reset silencioso a Intcomex2026!
  const hashAdmin = await sha256Salted('ClaveSegura#2026', 'admin');
  const hashPm = await sha256Salted('ClaveSegura#2026', 'pm_cisco');
  assert.strictEqual(hashAdmin.length, 64);
  assert.strictEqual(hashPm.length, 64);
  assert.notStrictEqual(hashAdmin, hashPm, 'La sal por usuario debe generar hashes distintos por username');

  const fsServiceCode = fs.readFileSync(
    path.resolve(__dirname, '../src/modules/cloud/firestoreService.ts'),
    'utf8'
  );
  assert.ok(
    !fsServiceCode.includes('userData.password_hash === cleanPass'),
    'firestoreService no debe aceptar contraseñas en texto plano'
  );

  const userMgmtCode = fs.readFileSync(
    path.resolve(__dirname, '../src/components/UserManagementView.tsx'),
    'utf8'
  );
  assert.ok(
    !userMgmtCode.includes("sha256Salted('Intcomex2026!')"),
    'UserManagementView nunca debe asignar silenciosamente Intcomex2026! al editar/cambiar rol/estado'
  );

  const loginCode = fs.readFileSync(
    path.resolve(__dirname, '../src/components/LoginScreen.tsx'),
    'utf8'
  );
  assert.ok(
    !loginCode.includes('btoa(encodeURIComponent('),
    'LoginScreen no debe codificar contraseñas con Base64 reversible para localStorage'
  );
  console.log('  ✅ Endurecimiento de Auth y protección de contraseñas (#4) verificados.');

  // #5: Parseo numérico, Goal Seek < 1%, checkIsIntangible y fechas
  assert.strictEqual(parseFlexibleNumber('0.125'), 0.125, '0.125 NO debe multiplicarse por 1000 a 125');
  assert.strictEqual(parseFlexibleNumber('0,125'), 0.125, '0,125 NO debe multiplicarse por 1000 a 125');
  assert.strictEqual(parseFlexibleNumber('-0.125'), -0.125, '-0.125 debe conservar signo y decimales');
  assert.strictEqual(parseFlexibleNumber('US$ 1,250.50'), 1250.5, 'US$ 1,250.50 debe parsearse limpio');
  assert.strictEqual(parseFlexibleNumber('1.085.000'), 1085000, '1.085.000 miles chilenos sigue siendo 1085000');

  assert.strictEqual(safeParseFloat('US$ 1,250.50'), 1250.5, 'safeParseFloat no debe dejar prefijo US residual');
  assert.strictEqual(safeParseFloat('$ 950,50 CLP'), 950.5);

  assert.strictEqual(checkIsIntangible('CON-SNT-C9200L24', 'SNTC'), true);
  assert.strictEqual(checkIsIntangible('CONSOLE-24-KIT', 'Rack hardware kit'), false);
  assert.strictEqual(checkIsIntangible('SILICON-PAD-1U', 'Thermal chassis hardware'), false);
  assert.strictEqual(checkIsIntangible('LIC-CW-E', 'Cloud License'), true);

  // Goal Seek con margen objetivo 0.5% (no debe tratarse como 50%)
  const gsRes = solveGoalSeekParameters(
    [
      {
        netCiscoUnit: 1000,
        qty: 1,
        partNumber: 'C9200L-24P-4G-E',
        description: 'Switch Catalyst 9200L',
        lineNumber: '1.0',
      },
    ],
    1020,
    'target_price',
    { internacionPct: 7, arancelPct: 6, margenPct: 0.5 }
  );
  assert.strictEqual(gsRes.success, true, 'Goal Seek con margen 0.5% debe converger correctamente');
  assert.ok(Math.abs(gsRes.achievedTotal - 1020) < 0.1);

  // Fechas: mes UTC real (no día del mes) y años en CURRENT_MONTH / Qx-YYYY
  const extractedNov = extractMonthAndYearFromCommercialValue('20 nov 2026');
  assert.deepStrictEqual(extractedNov, { month: 11, year: 2026 }, '20 nov 2026 debe retornar mes 11 (no día 20)');

  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, '0');
  assert.strictEqual(matchesPeriodFilter(`${curY}-${curM}-15`, 'CURRENT_MONTH'), true);
  assert.strictEqual(
    matchesPeriodFilter(`${curY - 1}-${curM}-15`, 'CURRENT_MONTH'),
    false,
    'CURRENT_MONTH no debe mezclar registros del mismo mes en años anteriores'
  );
  assert.strictEqual(matchesPeriodFilter('2025-02-10', 'Q1-2026'), false);
  assert.strictEqual(matchesPeriodFilter('2026-02-10', 'Q1-2026'), true);
  console.log('  ✅ Parseo numérico, Goal Seek sub-1%, SKUs y filtros de fecha (#5) verificados.');

  console.log('\n🎉 Todas las pruebas de los puntos #3, #4 y #5 pasaron al 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en pruebas #3/#4/#5:', err);
    process.exit(1);
  });
