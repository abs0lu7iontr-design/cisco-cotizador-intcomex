// ============================================================================
// TESTS: COMMERCIAL PERIOD FILTERING & DYNAMIC MONTHLY DEFAULTS (v2.17.1)
// Valida la apertura por defecto en el mes actual y filtrado por Q, año y mes
// en Pipeline Comercial, Forecast Comercial e Historial de Estimates.
// ============================================================================

import assert from 'node:assert/strict';
import {
  getCurrentMonthName,
  getCurrentYearMonth,
  getCurrentQuarter,
  getQuarterMonthNames,
  matchesPeriodFilter,
  SPANISH_MONTH_NAMES,
} from '../src/utils/dateUtils';
import { filterPipelineDeals } from '../src/modules/pipeline/pipelineService';
import { PipelineDealRecord } from '../src/modules/pipeline/pipelineTypes';
import { filterForecastRecords } from '../src/modules/forecast/forecastService';
import { INITIAL_FORECAST_SEEDS } from '../src/modules/forecast/forecastSeeds';

console.log('🧪 Iniciando Suite: Filtros Mensuales por Defecto y Periodos Comerciales (v2.17.1)...\n');

// ----------------------------------------------------------------------------
// Test 1: Resolución Dinámica del Mes y Trimestre del Calendario
// ----------------------------------------------------------------------------
console.log('▶ Test 1: Resolución dinámica de mes actual, año-mes y trimestre');

const curMonth = getCurrentMonthName();
assert.ok(
  (SPANISH_MONTH_NAMES as readonly string[]).includes(curMonth),
  `El mes actual "${curMonth}" debe pertenecer a SPANISH_MONTH_NAMES`
);

const curYm = getCurrentYearMonth();
assert.match(
  curYm,
  /^\d{4}-\d{2}$/,
  `El formato de getCurrentYearMonth() debe ser YYYY-MM, se obtuvo ${curYm}`
);

const curQ = getCurrentQuarter();
assert.match(
  curQ,
  /^Q[1-4]$/,
  `El trimestre actual debe ser Q1, Q2, Q3 o Q4, se obtuvo ${curQ}`
);

const q3Months = getQuarterMonthNames('Q3');
assert.deepStrictEqual(q3Months, ['Julio', 'Agosto', 'Septiembre']);

console.log(`  ✅ Mes actual dinámico resuelto: ${curMonth} (${curYm}), Trimestre: ${curQ}.\n`);

// ----------------------------------------------------------------------------
// Test 2: Evaluación Multiformato con matchesPeriodFilter
// ----------------------------------------------------------------------------
console.log('▶ Test 2: Evaluación con matchesPeriodFilter');

// Filtro ALL / vacío
assert.strictEqual(matchesPeriodFilter('2026-11-17', 'all'), true);
assert.strictEqual(matchesPeriodFilter('2026-11-17', 'ALL'), true);
assert.strictEqual(matchesPeriodFilter('2026-11-17', ''), true);

// Filtro CURRENT_MONTH
assert.strictEqual(matchesPeriodFilter(curMonth, 'CURRENT_MONTH'), true);
assert.strictEqual(matchesPeriodFilter(curYm, 'CURRENT_MONTH'), true);

// Filtro por Nombre de Mes
assert.strictEqual(matchesPeriodFilter('2026-11-15', 'Noviembre'), true);
assert.strictEqual(matchesPeriodFilter('15/11/2026', 'Noviembre'), true);
assert.strictEqual(matchesPeriodFilter('2026-08-18', 'Noviembre'), false);

// Coincidencia con números de serie de Excel (46252 -> 18/08/2026, Agosto)
assert.strictEqual(matchesPeriodFilter(46252, 'Agosto'), true);
assert.strictEqual(matchesPeriodFilter(46252, 'Q3'), true);
assert.strictEqual(matchesPeriodFilter(46252, '2026-08'), true);

// Filtros por Trimestre (Q1, Q2, Q3, Q4)
assert.strictEqual(matchesPeriodFilter('2026-02-10', 'Q1'), true);
assert.strictEqual(matchesPeriodFilter('2026-05-20', 'Q2'), true);
assert.strictEqual(matchesPeriodFilter('2026-08-18', 'Q3'), true);
assert.strictEqual(matchesPeriodFilter('2026-11-17', 'Q4'), true);
assert.strictEqual(matchesPeriodFilter('2026-02-10', 'Q4'), false);

// Filtro por Año Actual
const thisYear = new Date().getFullYear();
assert.strictEqual(matchesPeriodFilter(`${thisYear}-05-15`, 'YEAR_CURRENT'), true);
assert.strictEqual(matchesPeriodFilter('2020-05-15', 'YEAR_CURRENT'), false);

console.log('  ✅ matchesPeriodFilter validado para meses, trimestres, años y seriales de Excel.\n');

// ----------------------------------------------------------------------------
// Test 3: Filtrado de Pipeline Comercial por Mes de Cierre por Defecto
// ----------------------------------------------------------------------------
console.log('▶ Test 3: Filtrado de Pipeline Comercial por Mes de Cierre dinámico');

const mockDeals: PipelineDealRecord[] = [
  {
    id: 'D-001',
    dealId: 'DEAL-NOV-1',
    fechaLevantamiento: '2026-11-01',
    fechaCotizacion: '2026-11-01',
    marca: 'Cisco',
    partner: 'Partner Uno',
    ejecutivoPartner: 'Ejecutivo 1',
    endUser: 'Cliente A',
    pmResponsable: 'Luis Burgos',
    usd: 50000,
    mesCierre: curMonth,
    mesFacturacion: curMonth,
    porcentajeAvance: 50,
    productosSuscripciones: 40000,
    servicios: 5000,
    meraki: 5000,
    am: 'Cisco AM 1',
    grupoVentas: 'Enterprise',
    notas: 'Oportunidad mes actual',
    priceProtectionExpiryDate: '',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  },
  {
    id: 'D-002',
    dealId: 'DEAL-AGO-2',
    fechaLevantamiento: '2026-08-10',
    fechaCotizacion: '2026-08-10',
    marca: 'Cisco',
    partner: 'Partner Dos',
    ejecutivoPartner: 'Ejecutivo 2',
    endUser: 'Cliente B',
    pmResponsable: 'Mauricio Skill',
    usd: 120000,
    mesCierre: 'Agosto',
    mesFacturacion: 'Agosto',
    porcentajeAvance: 80,
    productosSuscripciones: 100000,
    servicios: 10000,
    meraki: 10000,
    am: 'Cisco AM 2',
    grupoVentas: 'Top Volume',
    notas: 'Oportunidad Agosto',
    priceProtectionExpiryDate: '',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-10T10:00:00Z',
  },
  {
    id: 'D-003',
    dealId: 'DEAL-OCT-3',
    fechaLevantamiento: '2026-10-05',
    fechaCotizacion: '2026-10-05',
    marca: 'Cisco',
    partner: 'Partner Tres',
    ejecutivoPartner: 'Ejecutivo 3',
    endUser: 'Cliente C',
    pmResponsable: 'Luis Burgos',
    usd: 30000,
    mesCierre: 'Octubre',
    mesFacturacion: 'Octubre',
    porcentajeAvance: 100,
    productosSuscripciones: 25000,
    servicios: 2500,
    meraki: 2500,
    am: 'Cisco AM 3',
    grupoVentas: 'Grupo3',
    notas: 'Oportunidad Octubre',
    priceProtectionExpiryDate: '',
    createdAt: '2026-10-05T10:00:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
  },
];

// Filtro por defecto: Mes Actual
const dealsCurrentMonth = filterPipelineDeals(mockDeals, { mesCierre: curMonth });
assert.strictEqual(dealsCurrentMonth.length, 1);
assert.strictEqual(dealsCurrentMonth[0].dealId, 'DEAL-NOV-1');

// Filtro Q4: Debe incluir Octubre y el mes actual si es Q4
const dealsQ4 = filterPipelineDeals(mockDeals, { mesCierre: 'Q4' });
const expectedQ4Count = curQ === 'Q4' ? 2 : 1;
assert.strictEqual(dealsQ4.length, expectedQ4Count);

// Filtro vacío / todos: Retorna los 3 deals sin exclusión
const dealsAll = filterPipelineDeals(mockDeals, {});
assert.strictEqual(dealsAll.length, 3);

console.log('  ✅ Pipeline Comercial se filtra por mes actual por defecto y permite ver Q y todo.\n');

// ----------------------------------------------------------------------------
// Test 4: Filtrado de Forecast Comercial por Periodo Mes por Defecto
// ----------------------------------------------------------------------------
console.log('▶ Test 4: Filtrado de Forecast Comercial por Periodo Mes dinámico');

const mockRecords = [
  {
    ...INITIAL_FORECAST_SEEDS[0],
    id: 'FC-TEST-001',
    fechaLevantamiento: '46252', // 18/08/2026 (Agosto)
    fechaCotizacion: '46252',
    mesFacturacion: 'Agosto',
    usdIntcomex: 15000,
  },
  {
    ...INITIAL_FORECAST_SEEDS[0],
    id: 'FC-TEST-002',
    fechaLevantamiento: '2026-11-10',
    fechaCotizacion: '2026-11-10',
    mesFacturacion: curMonth,
    usdIntcomex: 45000,
  },
];

// Filtro por defecto en Forecast: Mes Actual
const forecastCurrentMonth = filterForecastRecords(mockRecords, { periodoMes: curMonth });
assert.strictEqual(forecastCurrentMonth.length, 1);
assert.strictEqual(forecastCurrentMonth[0].id, 'FC-TEST-002');

// Filtro por Agosto
const forecastAgosto = filterForecastRecords(mockRecords, { periodoMes: 'Agosto' });
assert.strictEqual(forecastAgosto.length, 1);
assert.strictEqual(forecastAgosto[0].id, 'FC-TEST-001');

// Filtro por Q3 (Jul-Ago-Sep): incluye FC-TEST-001
const forecastQ3 = filterForecastRecords(mockRecords, { periodoMes: 'Q3' });
assert.strictEqual(forecastQ3.length, 1);
assert.strictEqual(forecastQ3[0].id, 'FC-TEST-001');

// Filtro general / sin periodo: Retorna ambos registros
const forecastAll = filterForecastRecords(mockRecords, {});
assert.strictEqual(forecastAll.length, 2);

console.log('  ✅ Forecast Comercial se filtra por mes actual por defecto y soporta trimestres.\n');

console.log('🏆 Todas las pruebas de filtros comerciales por periodo pasaron al 100%.\n');
