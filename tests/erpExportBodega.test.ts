import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { generateErpTemplateWorkbook } from '../src/core/erpExportHelper';
import { EstimateLineItem } from '../src/core/types';

async function runTests() {
  console.log('🧪 Iniciando pruebas de Asignación de Bodega ERP (E1 vs ED)...');

  const baseItem: Partial<EstimateLineItem> = {
    netCiscoUnit: 100,
    precioVentaUnitario: 110,
    precioVentaExtendido: 110,
    transformedLeadTime: 'Estándar',
  };

  // Escenario 1: Cotización Mixta (Hardware + Licencias + Servicios) -> Todas deben ser E1
  {
    console.log('--- Test 1: Cotización mixta (Hardware + Licencia DNA + SmartNet CON-SNT) ---');
    const mixedItems: EstimateLineItem[] = [
      {
        ...baseItem,
        lineNumber: '1.0',
        partNumber: 'C9300L-24P-4G-E',
        description: 'Catalyst 9300L 24p PoE',
        qty: 1,
        isIntangible: false,
        llevaArancel: false,
      } as EstimateLineItem,
      {
        ...baseItem,
        lineNumber: '1.1',
        partNumber: 'C9300L-DNA-E-24',
        description: 'Cisco DNA On-Prem Essential 24-Port',
        qty: 1,
        isIntangible: true,
        llevaArancel: false,
      } as EstimateLineItem,
      {
        ...baseItem,
        lineNumber: '2.0',
        partNumber: 'CON-SNT-C9300L24',
        description: 'SNTC-8X5XNBD Catalyst 9300L',
        qty: 1,
        isIntangible: true,
        llevaArancel: false,
      } as EstimateLineItem,
    ];

    const buffer = await generateErpTemplateWorkbook(mixedItems);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Carga ERP Intcomex');
    assert(ws, 'Worksheet debe existir');

    // Filas 2, 3 y 4 (después del header en fila 1)
    // Columna 2 = Part Number, Columna 4 = Bodega
    for (let r = 2; r <= 4; r++) {
      const row = ws.getRow(r);
      const pn = row.getCell(2).value;
      const bodega = row.getCell(4).value;
      assert.strictEqual(
        bodega,
        'E1',
        `En cotización con Hardware, la línea ${pn} debe tener bodega E1 pero tiene ${bodega}`
      );
    }
    console.log('✅ Cotización Mixta: Todas las líneas asignadas a E1.');
  }

  // Escenario 2: Cotización Exclusivamente Intangible (Solo Licencias / SaaS) -> Todas deben ser ED
  {
    console.log('--- Test 2: Cotización de solo Licencias SaaS ---');
    const licenseOnlyItems: EstimateLineItem[] = [
      {
        ...baseItem,
        lineNumber: '1.0',
        partNumber: 'LIC-SEC-SUB',
        description: 'Cisco Umbrella Security Subscription',
        qty: 50,
        isIntangible: true,
        llevaArancel: false,
      } as EstimateLineItem,
      {
        ...baseItem,
        lineNumber: '2.0',
        partNumber: 'DUO-MFA-SUB',
        description: 'Duo MFA Subscription User Lic',
        qty: 50,
        isIntangible: true,
        llevaArancel: false,
      } as EstimateLineItem,
    ];

    const buffer = await generateErpTemplateWorkbook(licenseOnlyItems);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Carga ERP Intcomex');
    assert(ws, 'Worksheet debe existir');

    for (let r = 2; r <= 3; r++) {
      const row = ws.getRow(r);
      const pn = row.getCell(2).value;
      const bodega = row.getCell(4).value;
      assert.strictEqual(
        bodega,
        'ED',
        `En cotización de solo licencias, la línea ${pn} debe tener bodega ED pero tiene ${bodega}`
      );
    }
    console.log('✅ Cotización Solo Licencias: Todas las líneas asignadas a ED.');
  }

  // Escenario 3: Cotización Exclusivamente de Servicios SmartNet (CON- o SVS- o CX-) -> Todas ED
  {
    console.log('--- Test 3: Cotización de solo Servicios SmartNet ---');
    const serviceOnlyItems: EstimateLineItem[] = [
      {
        ...baseItem,
        lineNumber: '1.0',
        partNumber: 'CON-SNT-C920048P',
        description: 'SNTC-8X5XNBD Catalyst 9200',
        qty: 2,
        isIntangible: false, // Aunque el flag no viniera puesto, el prefijo CON- lo clasifica
        llevaArancel: false,
      } as EstimateLineItem,
      {
        ...baseItem,
        lineNumber: '2.0',
        partNumber: 'SVS-SMA-SUP',
        description: 'Cisco Software Support Service',
        qty: 1,
        isIntangible: true,
        llevaArancel: false,
      } as EstimateLineItem,
    ];

    const buffer = await generateErpTemplateWorkbook(serviceOnlyItems);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Carga ERP Intcomex');
    assert(ws, 'Worksheet debe existir');

    for (let r = 2; r <= 3; r++) {
      const row = ws.getRow(r);
      const pn = row.getCell(2).value;
      const bodega = row.getCell(4).value;
      assert.strictEqual(
        bodega,
        'ED',
        `En cotización de solo servicios, la línea ${pn} debe tener bodega ED pero tiene ${bodega}`
      );
    }
    console.log('✅ Cotización Solo Servicios: Todas las líneas asignadas a ED.');
  }

  console.log('🎉 ¡TODAS LAS PRUEBAS DE ASIGNACIÓN DE BODEGA ERP PASARON CON ÉXITO!');
}

runTests().catch((err) => {
  console.error('❌ Error en pruebas de bodega ERP:', err);
  process.exit(1);
});
