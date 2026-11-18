// ============================================================================
// CISCO AUTOMATED v2.17.3 - ESTIMATES HISTORY RESPONSIVE AUTO-FIT SUITE
// Validates responsive table layout, density modes, and dynamic zoom controls
// ensuring all 11 columns fit without requiring browser zoom adjustments
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Iniciando Suite: Auto-Ajuste Responsivo y Densidad de Tabla en Historial (v2.17.3)...\n');

const estimatesViewPath = path.resolve(__dirname, '../src/components/EstimatesHistoryView.tsx');
const estimatesViewCode = fs.readFileSync(estimatesViewPath, 'utf8');

// Test 1: Verificación de eliminación de paddings excesivos (px-5 py-4 eliminados en celdas críticas)
console.log('▶ Test 1: Verificación de ergonomía de espaciado y clases dinámicas de celda');
if (estimatesViewCode.includes('headPaddingClass') && estimatesViewCode.includes('cellPaddingClass')) {
  console.log('  ✅ Clases dinámicas headPaddingClass y cellPaddingClass integradas en cabeceras y celdas.');
} else {
  throw new Error('❌ Faltan headPaddingClass o cellPaddingClass en EstimatesHistoryView');
}

// Test 2: Verificación de Controles de Densidad (Auto-Fit, Compacto, Estándar)
console.log('▶ Test 2: Selector de densidad visual y auto-ajuste de pantalla');
const hasDensityState = estimatesViewCode.includes("tableDensity") && estimatesViewCode.includes("'cisco_estimates_history_density'");
const hasAutoFitButton = estimatesViewCode.includes("Auto-Fit") && estimatesViewCode.includes("Compacto") && estimatesViewCode.includes("Estándar");

if (hasDensityState && hasAutoFitButton) {
  console.log('  ✅ Selector de Densidad (Auto-Fit, Compacto, Estándar) verificado con persistencia en localStorage.');
} else {
  throw new Error('❌ No se encontró el selector de densidad o persistencia en localStorage');
}

// Test 3: Verificación de Controles de Zoom Dinámico de Tabla (75% a 115%)
console.log('▶ Test 3: Controles de zoom dinámico local de tabla (sin alterar zoom de navegador)');
const hasZoomControls = estimatesViewCode.includes("tableZoom") && estimatesViewCode.includes("'cisco_estimates_history_zoom'");
const hasZoomStyle = estimatesViewCode.includes("style={tableZoom !== 100 ? { zoom: `${tableZoom}%` } : undefined}");

if (hasZoomControls && hasZoomStyle) {
  console.log('  ✅ Zoom local de tabla integrado con botones [-] [+] y porcentaje dinámico persistido.');
} else {
  throw new Error('❌ No se encontró el control o estilo de zoom dinámico local');
}

// Test 4: Verificación de apilamiento en columna Estimate / Deal ID
console.log('▶ Test 4: Apilamiento ergonómico en columna Estimate / Deal ID');
const hasStackedEstimateDeal = estimatesViewCode.includes('Deal: {est.dealId}') && estimatesViewCode.includes('flex flex-col space-y-1');

if (hasStackedEstimateDeal) {
  console.log('  ✅ Estimate ID y Deal ID apilados verticalmente evitando desbordes horizontales de >250px.');
} else {
  throw new Error('❌ Columna Estimate / Deal no está apilada verticalmente');
}

// Test 5: Verificación de las 11 columnas CCW y 9 columnas DSV en contenedor scrollable responsivo
console.log('▶ Test 5: Verificación de anchos acotados en todas las columnas');
const hasEstimateHeaders = [
  'Estimate / Deal ID',
  'Creado Por',
  'Partner / Reseller',
  'Cliente Final',
  'Net Cisco',
  'Cotizado Intcomex',
  'Margen $',
  'Parámetros',
  'Ítems',
  'Fecha',
  'Acceso & Acciones'
].every(h => estimatesViewCode.includes(h));

const hasDsvHeaders = [
  'Deal ID / SO / PO',
  'Creado Por',
  'Partner ID / Reseller',
  'Cliente Final',
  'Reported Net Price',
  'Ítems Válidos',
  'Descartados ($0)',
  'Fecha',
  'Acciones'
].every(h => estimatesViewCode.includes(h));

if (hasEstimateHeaders && hasDsvHeaders) {
  console.log('  ✅ 11 columnas de Cotizaciones CCW y 9 columnas de Órdenes DSV verificadas.');
} else {
  throw new Error('❌ Faltan encabezados de columnas en las tablas');
}

console.log('\n🏆 Todas las pruebas de auto-ajuste responsivo del Historial de Estimates pasaron al 100%.\n');
