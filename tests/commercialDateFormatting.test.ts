// ============================================================================
// TESTS: COMMERCIAL DATE FORMATTING & EXCEL SERIAL RESOLUTION (v2.16.2)
// Valida que números de serie de Excel (46252, 45846, 45978) se conviertan
// fielmente a fechas legibles DD/MM/YYYY en Forecast y Pipeline.
// ============================================================================

import assert from 'node:assert/strict';
import {
  formatCommercialDate,
  formatCommercialDateHyphen,
  parseDateBySource,
} from '../src/utils/dateUtils';
import { parseFlexibleDate } from '../src/modules/forecast/forecastService';

console.log('🧪 Iniciando Suite de Pruebas: Formato de Fechas Comerciales & Seriales Excel (v2.16.2)...\n');

// ----------------------------------------------------------------------------
// Test 1: Resolución de Seriales de Excel (46252, 45846, 45978)
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Resolución de números de serie de Excel');

// 46252 -> 18/08/2026 (FC-0001 de la imagen del usuario)
const d1 = formatCommercialDate(46252);
assert.strictEqual(d1, '18/08/2026', `Se esperaba 18/08/2026, se obtuvo ${d1}`);

const d1Str = formatCommercialDate('46252');
assert.strictEqual(d1Str, '18/08/2026', `Se esperaba 18/08/2026 para string '46252', se obtuvo ${d1Str}`);

// 45846 -> 08/07/2025 (FC-0002 de la imagen del usuario)
const d2 = formatCommercialDate(45846);
assert.strictEqual(d2, '08/07/2025', `Se esperaba 08/07/2025, se obtuvo ${d2}`);

// 45978 -> 17/11/2025 (FC-0004 de la imagen del usuario)
const d3 = formatCommercialDate(45978);
assert.strictEqual(d3, '17/11/2025', `Se esperaba 17/11/2025, se obtuvo ${d3}`);

console.log('  ✅ Seriales de Excel (46252, 45846, 45978) convertidos con 100% de precisión a DD/MM/YYYY.\n');

// ----------------------------------------------------------------------------
// Test 2: Formatos de Fechas Variadas (ISO, Guiones, Slashes)
// ----------------------------------------------------------------------------
console.log('▶ Test 2: Normalización de formatos varios (ISO, DD-MM-YYYY, DD/MM/YYYY)');

assert.strictEqual(formatCommercialDate('2026-08-18'), '18/08/2026');
assert.strictEqual(formatCommercialDate('18-08-2026'), '18/08/2026');
assert.strictEqual(formatCommercialDate('18/08/2026'), '18/08/2026');
assert.strictEqual(formatCommercialDate('2026-11-17T14:30:00.000Z'), '17/11/2026');

// Casos vacíos o nulos
assert.strictEqual(formatCommercialDate(''), '-');
assert.strictEqual(formatCommercialDate(null), '-');
assert.strictEqual(formatCommercialDate(undefined), '-');
assert.strictEqual(formatCommercialDate('-'), '-');

// Textos descriptivos no-fechas (meses, trimestres)
assert.strictEqual(formatCommercialDate('Nov-2026'), 'Nov-2026');
assert.strictEqual(formatCommercialDate('Cierre Q4'), 'Cierre Q4');

console.log('  ✅ Normalización de formatos varios y protección de textos descriptivos validada.\n');

// ----------------------------------------------------------------------------
// Test 3: formatCommercialDateHyphen para inputs y exportación
// ----------------------------------------------------------------------------
console.log('▶ Test 3: Formateo con guiones (DD-MM-YYYY)');
assert.strictEqual(formatCommercialDateHyphen(46252), '18-08-2026');
assert.strictEqual(formatCommercialDateHyphen('45846'), '08-07-2025');
assert.strictEqual(formatCommercialDateHyphen('2026-08-18'), '18-08-2026');
assert.strictEqual(formatCommercialDateHyphen(''), '');
console.log('  ✅ formatCommercialDateHyphen verificado exitosamente.\n');

// ----------------------------------------------------------------------------
// Test 4: parseFlexibleDate con soporte de Seriales de Excel
// ----------------------------------------------------------------------------
console.log('▶ Test 4: parseFlexibleDate con Seriales de Excel');
const parsedDate = parseFlexibleDate(46252);
assert.ok(parsedDate instanceof Date, 'Debe retornar una instancia de Date');
assert.strictEqual(parsedDate.getUTCDate(), 18);
assert.strictEqual(parsedDate.getUTCMonth() + 1, 8);
assert.strictEqual(parsedDate.getUTCFullYear(), 2026);

const parsedDateStr = parseFlexibleDate('45846');
assert.ok(parsedDateStr instanceof Date, 'Debe retornar una instancia de Date');
assert.strictEqual(parsedDateStr.getUTCDate(), 8);
assert.strictEqual(parsedDateStr.getUTCMonth() + 1, 7);
assert.strictEqual(parsedDateStr.getUTCFullYear(), 2025);

console.log('  ✅ parseFlexibleDate resuelve seriales numéricos y genera fechas válidas para recordatorios.\n');

console.log('🏆 Todas las pruebas de formato de fechas comerciales pasaron al 100%.\n');
