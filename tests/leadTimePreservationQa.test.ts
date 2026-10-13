import assert from 'node:assert';
import { describe, it } from 'node:test';
import { formatLeadTime } from '../src/core/calculations';
import {
  generateOptimizedWorkbook,
  parseEstimateWorkbook,
  synthesizeOfficialEstimateWorkbook,
} from '../src/core/excelEngine';
import { EstimateHeaderInfo, EstimateLineItem, QuoteParameters } from '../src/core/types';

describe('QA Golden Rules: Cisco CCW Lead Time Conversion & Anti-Degradation', () => {
  it('Regla 1: 175 días CCW (IE-3505-8P3S-E) se convierte a 25 semanas + 2 semanas de tránsito = 27 semanas a pedido', () => {
    const formatted = formatLeadTime(175);
    assert.strictEqual(formatted, '27 semanas a pedido');
  });

  it('Regla 2: 35 días CCW se convierte a 5 semanas + 2 semanas de tránsito = 7 semanas a pedido', () => {
    const formatted = formatLeadTime(35);
    assert.strictEqual(formatted, '7 semanas a pedido');
  });

  it('Regla 3: 28 días CCW se convierte a 4 semanas + 2 semanas de tránsito = 6 semanas a pedido', () => {
    const formatted = formatLeadTime(28);
    assert.strictEqual(formatted, '6 semanas a pedido');
  });

  it('Regla 4: 21 días CCW se convierte a 3 semanas + 2 semanas de tránsito = 5 semanas a pedido', () => {
    const formatted = formatLeadTime(21);
    assert.strictEqual(formatted, '5 semanas a pedido');
  });

  it('Regla 5: 14 días CCW se convierte a 2 semanas + 2 semanas = 4 semanas (formateado como 4 a 5 semanas a pedido)', () => {
    const formatted = formatLeadTime(14);
    assert.strictEqual(formatted, '4 a 5 semanas a pedido');
  });

  it('Regla 6: 7 días CCW se convierte a 1 semana + 2 semanas = 3 semanas (regla de oro Intcomex: mínimo 4 semanas a pedido)', () => {
    const formatted = formatLeadTime(7);
    assert.strictEqual(formatted, '4 semanas a pedido');
  });

  it('Regla 6b: 5 días CCW (o 3-6 días) da 1 sem fábrica + 2 sem tránsito = 3 semanas, pero la regla de oro exige mínimo 4 semanas a pedido', () => {
    assert.strictEqual(formatLeadTime(5), '4 semanas a pedido', '5 días debe dar exactamente 4 semanas a pedido');
    assert.strictEqual(formatLeadTime(3), '4 semanas a pedido', '3 días debe dar 4 semanas a pedido');
    assert.strictEqual(formatLeadTime(4), '4 semanas a pedido', '4 días debe dar 4 semanas a pedido');
    assert.strictEqual(formatLeadTime(6), '4 semanas a pedido', '6 días debe dar 4 semanas a pedido');
  });

  it('Regla 7: <= 2 días CCW es stock inmediato (retorna cadena vacía)', () => {
    assert.strictEqual(formatLeadTime(2), '');
    assert.strictEqual(formatLeadTime(0), '');
    assert.strictEqual(formatLeadTime(-1), '');
  });

  it('Regla 8: Protección de Idempotencia y Blindaje contra Degradación Múltiple (Anti-Degradación v1->v2->v3)', () => {
    // Si la función recibe una cadena que ya contiene semanas a pedido, jamás debe re-dividir ni degradar
    assert.strictEqual(formatLeadTime('27 semanas a pedido'), '27 semanas a pedido');
    assert.strictEqual(formatLeadTime('6 semanas a pedido'), '6 semanas a pedido');
    assert.strictEqual(formatLeadTime('4 a 5 semanas a pedido'), '4 a 5 semanas a pedido');
    assert.strictEqual(formatLeadTime('4 semanas a pedido'), '4 semanas a pedido');

    // Múltiples aplicaciones sucesivas deben ser perfectamente estables: f(f(f(175))) === '27 semanas a pedido'
    const r1 = formatLeadTime(175);
    const r2 = formatLeadTime(r1);
    const r3 = formatLeadTime(r2);
    assert.strictEqual(r1, '27 semanas a pedido');
    assert.strictEqual(r2, '27 semanas a pedido');
    assert.strictEqual(r3, '27 semanas a pedido');
  });

  it('Regla 9: Round-Trip Excel y Shadow Snapshot sys_metadata preserva 175 días y 27 semanas sin alteración', async () => {
    const headerInfo: EstimateHeaderInfo = {
      customerName: 'Mauricio Skill',
      companyName: 'INTCOMEX CHILE SA',
      address: 'ROSARIO NORTE 615, PISO 6',
      city: 'SANTIAGO, 0-0',
      country: 'CHILE',
      phone: 'Ph no:+56 223637100',
      estimateId: 'UO169143877OU',
      dealId: 'NA',
      priceList: 'Global Price List Latin America Availability (USD)',
      date: '09-Oct-2026',
    };

    const mockItems: EstimateLineItem[] = [
      {
        rowIdx: 14,
        lineNumber: '1.0',
        partNumber: 'IE-3505-8P3S-E',
        smartAccountMandatory: '-',
        description: 'Cisco IE3500 w/ 8 GE PoE+ and 3 GE SFP, Adv Modular, NE',
        serviceDurationMonths: '---',
        originalLeadTimeDays: 175,
        transformedLeadTime: '27 semanas a pedido',
        unitListPrice: 13027.59,
        pricingTerm: '',
        qty: 5,
        netCiscoUnit: 5471.59,
        discPct: 58,
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 273.58,
        costoArancel: 0,
        costoTotalUnitario: 5745.17,
        precioVentaUnitario: 6047.55,
        precioVentaExtendido: 30237.75,
      },
      {
        rowIdx: 15,
        lineNumber: '1.1',
        partNumber: 'IOT-OTHER',
        smartAccountMandatory: '-',
        description: 'Not related to an IoT Solution; For tracking only.',
        serviceDurationMonths: '---',
        originalLeadTimeDays: 35,
        transformedLeadTime: '7 semanas a pedido',
        unitListPrice: 0,
        pricingTerm: '',
        qty: 5,
        netCiscoUnit: 0,
        discPct: 58,
        isIntangible: true,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
      },
      {
        rowIdx: 16,
        lineNumber: '1.2',
        partNumber: 'NO-IOT-SOLUTION',
        smartAccountMandatory: '-',
        description: 'Not related to an IoT Solution; For tracking only.',
        serviceDurationMonths: '---',
        originalLeadTimeDays: 35,
        transformedLeadTime: '7 semanas a pedido',
        unitListPrice: 0,
        pricingTerm: '',
        qty: 5,
        netCiscoUnit: 0,
        discPct: 58,
        isIntangible: true,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
      },
      {
        rowIdx: 17,
        lineNumber: '1.3',
        partNumber: 'IE3500_SW',
        smartAccountMandatory: '-',
        description: 'Software for Catalyst IE3x00 rugged series',
        serviceDurationMonths: '---',
        originalLeadTimeDays: 28,
        transformedLeadTime: '6 semanas a pedido',
        unitListPrice: 0,
        pricingTerm: '',
        qty: 5,
        netCiscoUnit: 0,
        discPct: 58,
        isIntangible: false,
        llevaArancel: false,
        costoInternacion: 0,
        costoArancel: 0,
        costoTotalUnitario: 0,
        precioVentaUnitario: 0,
        precioVentaExtendido: 0,
      },
    ];

    const params: QuoteParameters = {
      internacionPct: 5.0,
      arancelPct: 6.0,
      margenPct: 5.0,
    };

    const mockResult = {
      fileName: 'supplyline_antucoya_Estimate_UO169143877OU.xlsx',
      headerInfo,
      items: mockItems,
      originalProductTotal: 30237.75,
      calculatedProductTotal: 30237.75,
      serviceTotal: 0,
      subscriptionTotal: 0,
      finalTotalPrice: 30237.75,
      headerRowIndex: 13,
      workbookBuffer: new ArrayBuffer(0),
    };

    // 1. Generar workbook oficial sintetizado Intcomex
    const buffer = await synthesizeOfficialEstimateWorkbook(mockResult, params);
    assert.ok(buffer.byteLength > 1000, 'El buffer generado debe tener contenido válido');

    // 2. Re-importar workbook generado (simulando subida posterior v2/v3)
    const { result: parsed } = await parseEstimateWorkbook(buffer, params, 'supplyline_antucoya_Estimate_UO169143877OU.xlsx');

    assert.ok(parsed.items.length === 4, 'Deben re-parsearse los 4 items');

    const item1 = parsed.items.find((i) => i.lineNumber === '1.0');
    assert.ok(item1, 'Debe encontrarse item 1.0 (IE-3505-8P3S-E)');
    assert.strictEqual(
      item1.transformedLeadTime,
      '27 semanas a pedido',
      'El lead time de IE-3505-8P3S-E debe preservarse exactamente en 27 semanas a pedido (NO 6 semanas)'
    );
    assert.strictEqual(
      Number(item1.originalLeadTimeDays),
      175,
      'originalLeadTimeDays debe restaurarse en 175 días'
    );

    const item2 = parsed.items.find((i) => i.lineNumber === '1.1');
    assert.ok(item2, 'Debe encontrarse item 1.1 (IOT-OTHER)');
    assert.strictEqual(
      item2.transformedLeadTime,
      '7 semanas a pedido',
      'El lead time de IOT-OTHER debe preservarse en 7 semanas a pedido'
    );

    const item4 = parsed.items.find((i) => i.lineNumber === '1.3');
    assert.ok(item4, 'Debe encontrarse item 1.3 (IE3500_SW)');
    assert.strictEqual(
      item4.transformedLeadTime,
      '6 semanas a pedido',
      'El lead time de IE3500_SW debe preservarse en 6 semanas a pedido'
    );
  });

  it('Regla 10: Importar archivo v3 previamente exportado no degrada el lead time existente a 4 semanas', async () => {
    const fs = await import('node:fs');
    const path = 'scratch/user_zip/supplyline_antucoya_Cisco_Estimate_UO169143877OU_I5M5_v3_11-18_13-10-26.xlsx';
    if (!fs.existsSync(path)) return;

    const fileBuf = fs.readFileSync(path);
    const params: QuoteParameters = {
      internacionPct: 5.0,
      arancelPct: 6.0,
      margenPct: 5.0,
    };

    const { result: parsed } = await parseEstimateWorkbook(
      fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength),
      params,
      'supplyline_antucoya_Estimate_UO169143877OU.xlsx'
    );

    const item1 = parsed.items.find((i) => i.lineNumber === '1.0');
    assert.ok(item1);
    // En el archivo v3 venía "6 semanas a pedido", la protección anti-degradación debe asegurar que NO caiga a 4 semanas
    assert.strictEqual(item1.transformedLeadTime, '6 semanas a pedido');
  });
});
