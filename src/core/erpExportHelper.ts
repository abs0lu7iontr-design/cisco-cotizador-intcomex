// ============================================================================
// CISCO AUTOMATED - ERP INTCOMEX ORDER IMPORT HELPER
// Generador de plantilla estandarizada de importación masiva para ERP Intcomex
// ============================================================================

import ExcelJS from 'exceljs';
import { EstimateLineItem, EstimateHeaderInfo } from './types';

export async function generateErpTemplateWorkbook(
  items: readonly EstimateLineItem[],
  headerInfo?: EstimateHeaderInfo,
  partnerName: string = 'Intcomex',
  clientName: string = 'Cliente Final'
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Carga ERP Intcomex');

  // Freeze top header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Column definitions for ERP import
  worksheet.columns = [
    { header: 'Línea', key: 'line', width: 10 },
    { header: 'Part Number', key: 'partNumber', width: 25 },
    { header: 'Descripción', key: 'description', width: 45 },
    { header: 'Bodega', key: 'bodega', width: 12 },
    { header: 'Cantidad', key: 'qty', width: 12 },
    { header: 'Costo Cisco (U)', key: 'cogs', width: 16 },
    { header: 'Precio Venta Unit. USD', key: 'priceUnit', width: 22 },
    { header: 'Total Venta USD', key: 'priceExtended', width: 20 },
    { header: 'Categoría', key: 'category', width: 18 },
    { header: 'Deal ID Cisco', key: 'dealId', width: 18 },
    { header: 'Partner', key: 'partner', width: 20 },
    { header: 'Cliente Final', key: 'client', width: 24 },
  ];

  // Header row formatting
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate 900
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
    };
  });

  const dealId = headerInfo?.dealId || 'N/A';

  // Add items
  items.forEach((item) => {
    if (item.isInfoRow) return;

    const isIntangible = item.isIntangible;
    const isService =
      item.partNumber.startsWith('CON-') ||
      item.partNumber.startsWith('SVS-') ||
      item.partNumber.startsWith('CX-');
    const category = isService
      ? 'Servicio SmartNet'
      : isIntangible
      ? 'Licencia / SaaS'
      : 'Hardware';
    const bodega = isIntangible || isService ? 'ED' : 'E1';

    const row = worksheet.addRow({
      line: item.lineNumber,
      partNumber: item.partNumber,
      description: item.description,
      bodega,
      qty: item.qty,
      cogs: item.netCiscoUnit,
      priceUnit: item.precioVentaUnitario,
      priceExtended: item.precioVentaExtendido,
      category,
      dealId,
      partner: partnerName,
      client: clientName,
    });

    row.height = 20;

    // Numbers alignment and currency formatting
    row.getCell('qty').numFmt = '#,##0';
    row.getCell('qty').alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell('cogs').numFmt = '$#,##0.00';
    row.getCell('cogs').alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell('priceUnit').numFmt = '$#,##0.00';
    row.getCell('priceUnit').alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell('priceExtended').numFmt = '$#,##0.00';
    row.getCell('priceExtended').alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell('priceExtended').font = { bold: true };

    row.getCell('bodega').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('bodega').font = { bold: true };

    row.getCell('line').alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
