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

import { generateEstimateEmailHtml } from '../src/core/emailClipboardHelper';
import { generateCommercialPdfHtml } from '../src/modules/estimate/estimateExportHelper';
import {
  saveEstimatesMirrorSnapshot,
  getEstimatesMirrorSnapshot,
} from '../src/hooks/useEstimatesMirror';

async function runTests() {
  console.log('🧪 Iniciando Suite: Desktop (#6), Exportadores/HTML (#7), UI (#8) y Caché (#9)...\n');

  // #6: Verificación estática de desktop_window.py y db_manager.py
  const desktopWinCode = fs.readFileSync(
    path.resolve(__dirname, '../desktop_app/desktop_window.py'),
    'utf8'
  );
  assert.ok(desktopWinCode.includes('_is_trusted_update_url'), 'Debe validar dominio HTTPS de descarga');
  assert.ok(!desktopWinCode.includes('usr-001-admin'), 'No debe asignar fallback usr-001-admin');

  const dbMgrCode = fs.readFileSync(
    path.resolve(__dirname, '../desktop_app/db_manager.py'),
    'utf8'
  );
  assert.ok(!dbMgrCode.includes('if is_admin or user_id is None:'), 'No debe devolver todos los estimates cuando user_id es None');
  console.log('  ✅ Reglas de seguridad Desktop (#6) verificadas.');

  // #7: Escape HTML contra XSS en emailClipboardHelper y estimateExportHelper + CSV BO
  const xssPayload = '<img src=x onerror=alert(1)>';
  const emailHtml = generateEstimateEmailHtml(
    {
      fileName: 'Estimate_Test.xlsx',
      headerInfo: {
        customerName: xssPayload,
        companyName: xssPayload,
        address: '',
        city: 'Santiago',
        country: 'CL',
        phone: '',
        estimateId: 'EST<script>',
        dealId: 'DEAL"123',
        priceList: 'GL',
        date: '2026-11-25',
      },
      items: [
        {
          rowIdx: 1,
          lineNumber: '1.0',
          partNumber: 'SKU<script>',
          smartAccountMandatory: 'No',
          description: xssPayload,
          serviceDurationMonths: '',
          originalLeadTimeDays: 7,
          transformedLeadTime: '1 semana',
          unitListPrice: 100,
          pricingTerm: '',
          qty: 1,
          discPct: 0,
          netCiscoUnit: 50,
          isIntangible: false,
          llevaArancel: false,
          costoInternacion: 3.5,
          costoArancel: 0,
          costoTotalUnitario: 53.5,
          precioVentaUnitario: 60,
          precioVentaExtendido: 60,
        },
      ],
      originalProductTotal: 50,
      calculatedProductTotal: 60,
      serviceTotal: 0,
      subscriptionTotal: 0,
      finalTotalPrice: 60,
      headerRowIndex: 1,
    } as any,
    xssPayload
  );
  assert.ok(!emailHtml.includes('<img src=x'), 'generateEstimateEmailHtml debe escapar etiquetas HTML');
  assert.ok(!emailHtml.includes('<script>'), 'generateEstimateEmailHtml debe escapar <script>');
  assert.ok(emailHtml.includes('&lt;img src=x'), 'Debe contener entidades escapadas &lt;');

  const printHtml = generateCommercialPdfHtml({
    headerInfo: {
      estimateId: 'EST<script>',
      dealId: 'DEAL"1',
      priceList: 'GL<xss>',
      date: '2026-11-25',
    } as any,
    partnerName: xssPayload,
    clientName: xssPayload,
    summary: {
      totalQty: 1,
      grandTotal: 60,
      motherLines: [
        {
          motherKey: '1.0<xss>',
          totalQty: 1,
          subtotal: 60,
          items: [
            {
              lineNumber: '1.0',
              partNumber: 'SKU<xss>',
              description: xssPayload,
              transformedLeadTime: 'Stock',
              qty: 1,
              precioVentaUnitario: 60,
              precioVentaExtendido: 60,
            } as any,
          ],
        },
      ],
    } as any,
    groupingOptions: { groupByLine: true, enableClp: false, clpExchangeRate: 950 } as any,
  });
  assert.ok(!printHtml.includes('<img src=x'), 'buildCommercialQuotePrintHtml debe escapar etiquetas HTML');
  assert.ok(!printHtml.includes('SKU<xss>'), 'Part Number debe escaparse en HTML de impresión');

  const ccwrViewCode = fs.readFileSync(
    path.resolve(__dirname, '../src/modules/ccwrQuote/CcwrQuoteView.tsx'),
    'utf8'
  );
  assert.ok(ccwrViewCode.includes('items: initialRecalc.calculatedItems'), 'CcwrQuoteView debe guardar items calculados');

  const boModalCode = fs.readFileSync(
    path.resolve(__dirname, '../src/modules/bo/BoRequestModal.tsx'),
    'utf8'
  );
  assert.ok(boModalCode.includes('csvCell(formatCLP(l.unitNetPrice'), 'BoRequestModal CSV debe entrecomillar montos formatCLP');
  console.log('  ✅ Escape HTML, CCW-R calculado y CSV BO entrecomillado (#7) verificados.');

  // #8: QuickCalculator prefill en App.tsx y eliminación de mock en AuditLogsView
  const appCode = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
  assert.ok(appCode.includes('setQuickCalcPrefill(item)'), 'onLoadIntoQuickCalc debe cargar el ítem en QuickCalculator');
  assert.ok(appCode.includes("setActiveQuoterTab('calculator')"), 'onLoadIntoQuickCalc debe activar tab calculator');

  const auditCode = fs.readFileSync(
    path.resolve(__dirname, '../src/components/AuditLogsView.tsx'),
    'utf8'
  );
  assert.ok(!auditCode.includes('MIGRATE_ROLES'), 'AuditLogsView no debe contener registros mock hardcoded');
  console.log('  ✅ Conexión de Calculadora Rápida y AuditLogs reales (#8) verificados.');

  // #9: Estabilidad referencial O(1) de useEstimatesMirror tras save -> get
  localStorage.clear();
  const sampleRecords: any[] = [
    {
      id: 'est_cache_1',
      estimateId: 'EST-CACHE-1',
      dealId: 'DEAL-1',
      partnerName: 'Sonda',
      clientFinalName: 'Minera Test',
      originalFileName: 'test.xlsx',
      createdAt: '2026-11-25T10:00:00.000Z',
      creator: { username: 'pm', fullName: 'PM', role: 'pm' },
      financialSummary: {
        totalNetCisco: 100,
        totalCotizadoIntcomex: 120,
        gananciaIntcomexUsd: 20,
        margenPct: 5,
        currency: 'USD',
        params: { internacionPct: 7, arancelPct: 6, margenPct: 5 },
      },
      headerInfo: { estimateId: 'EST-CACHE-1', dealId: 'DEAL-1', companyName: 'Sonda', customerName: 'Minera Test' },
      itemsCount: 1,
      items: [],
    },
  ];
  saveEstimatesMirrorSnapshot(sampleRecords);
  const read1 = getEstimatesMirrorSnapshot();
  const read2 = getEstimatesMirrorSnapshot();
  assert.strictEqual(
    read1,
    read2,
    'useEstimatesMirror debe retornar exactamente la misma referencia cachedSnapshot tras saveEstimatesMirrorSnapshot sin re-parsear'
  );
  assert.strictEqual(read1.length, 1);
  console.log('  ✅ Hit de caché O(1) e igualdad referencial en useEstimatesMirror (#9) verificados.');

  console.log('\n🎉 Todas las pruebas de los puntos #6, #7, #8 y #9 pasaron al 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en pruebas #6/#7/#8/#9:', err);
    process.exit(1);
  });
