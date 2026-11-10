// ============================================================================
// CISCO AUTOMATED v2.9 - CCW-R EXCEL EXPORTER
// Generación Oficial de Planilla Excel de Cotización de Servicios y Licencias
// Replica exacta del formato corporativo Intcomex (13 columnas + cabecera ejecutiva)
// ============================================================================

import ExcelJS from 'exceljs';
import {
  CcwrHeaderInfo,
  CcwrLineItem,
  CcwrQuoteParameters,
  CcwrFinancialSummary,
} from './ccwrTypes';

export const CCWR_EXPORT_COLUMNS = [
  { header: 'Product Number', key: 'productNumber', width: 22 },
  { header: 'Descripcion del Producto', key: 'productDescription', width: 45 },
  { header: 'PAK/Serial Number', key: 'serialNumber', width: 24 },
  { header: 'Nivel Servicios', key: 'serviceLevel', width: 16 },
  { header: 'Descripcion Servicio', key: 'serviceLevelDescription', width: 22 },
  { header: 'SKU', key: 'serviceSku', width: 24 },
  { header: 'Fecha Inicio', key: 'startDate', width: 16 },
  { header: 'Fecha Termino', key: 'endDate', width: 16 },
  { header: 'Cant', key: 'quantity', width: 10 },
  { header: 'Unit', key: 'unitSalePrice', width: 16 },
  { header: 'ID Cliente Final', key: 'endCustomerId', width: 18 },
  { header: 'Nombre Cliente Final', key: 'endCustomerName', width: 38 },
  { header: 'Direccion Cliente Final', key: 'endCustomerAddress', width: 35 },
];

/**
 * Genera el archivo Excel de cotización formal de servicios con la estructura y diseño oficial
 */
export async function generateCcwrQuoteExcel(
  items: CcwrLineItem[],
  headerInfo: CcwrHeaderInfo,
  params: CcwrQuoteParameters,
  summary: CcwrFinancialSummary,
  onlyServicesWithCost: boolean = true
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Intcomex Chile - Cisco Automated';
  workbook.created = new Date();

  const sheetName = (headerInfo.quoteNumber || 'Cotizacion').slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Estilos corporativos
  const greenFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF92D050' }, // Verde corporativo Intcomex oficial
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: 'FF000000' },
  };

  const boldFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF000000' },
  };

  const regularFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
    color: { argb: 'FF000000' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  };

  const tableHeaderBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // 1. Cabecera Ejecutiva (Filas 1 a 8)
  // Fila 1: Vendedor
  const row1 = worksheet.getRow(2);
  row1.getCell(2).value = params.sellerName || 'Mauricio Skill';
  row1.getCell(2).font = boldFont;

  // Fila 2: Empresa
  const row2 = worksheet.getRow(3);
  row2.getCell(2).value = params.companyName || 'INTCOMEX SA';
  row2.getCell(2).font = regularFont;

  // Fila 3: Dirección & Total Cotización
  const row3 = worksheet.getRow(4);
  row3.getCell(2).value = params.companyAddress || 'Rosario Norte 615, SANTIAGO';
  row3.getCell(2).font = regularFont;
  row3.getCell(3).value = 'Total Cotizacion';
  row3.getCell(3).font = boldFont;
  row3.getCell(4).value = summary.totalPrecioVenta;
  row3.getCell(4).numFmt = '"$ " #,##0.00';
  row3.getCell(4).font = { ...boldFont, color: { argb: 'FF006100' }, size: 12 };

  // Fila 4: Teléfono
  const row4 = worksheet.getRow(5);
  row4.getCell(2).value = params.sellerPhone || 'Movil :+56 9 88226530';
  row4.getCell(2).font = regularFont;

  // Fila 6: Fecha
  const row6 = worksheet.getRow(7);
  row6.getCell(1).value = 'Fecha';
  row6.getCell(1).font = boldFont;
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  row6.getCell(2).value = today.toLocaleDateString('es-CL', dateOptions);
  row6.getCell(2).font = regularFont;

  // Fila 8: Número de Cotización
  const row8 = worksheet.getRow(9);
  row8.getCell(2).value = 'Numero de Cotizacion';
  row8.getCell(2).font = boldFont;
  row8.getCell(3).value = headerInfo.quoteNumber || 'S/N';
  row8.getCell(3).font = { ...boldFont, color: { argb: 'FF002060' } };

  // 2. Fila 10: Encabezados de la Tabla
  const tableHeaderRow = worksheet.getRow(10);
  tableHeaderRow.height = 25;

  CCWR_EXPORT_COLUMNS.forEach((col, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = greenFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = tableHeaderBorder;
  });

  // 3. Filas 11+: Detalle de Ítems
  const exportItems = onlyServicesWithCost
    ? items.filter((it) => it.isServiceOrLicense && it.extendedNetPrice > 0)
    : items;

  let currentExcelRow = 11;

  for (const it of exportItems) {
    const row = worksheet.getRow(currentExcelRow);
    row.height = 20;

    row.getCell(1).value = it.productNumber;
    row.getCell(2).value = it.productDescription;
    row.getCell(3).value = it.serialNumber || '-';
    row.getCell(4).value = it.serviceLevel || 'SNT';
    row.getCell(5).value = it.serviceLevelDescription || 'BAS 8X5XNBD';
    row.getCell(6).value = it.serviceSku;
    row.getCell(7).value = it.startDate;
    row.getCell(8).value = it.endDate;
    row.getCell(9).value = it.quantity;
    row.getCell(10).value = it.precioVentaUnitario;
    row.getCell(11).value = it.endCustomerId || headerInfo.endCustomerId || '-';
    row.getCell(12).value = it.endCustomerName || headerInfo.endCustomerName || '-';
    row.getCell(13).value = it.endCustomerAddress || headerInfo.endCustomerAddressLine1 || '-';

    // Tipografía y bordes
    for (let c = 1; c <= 13; c++) {
      const cell = row.getCell(c);
      cell.font = regularFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
    }

    // Alineaciones específicas
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(10).numFmt = '"$ " #,##0.00';
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    currentExcelRow++;
  }

  // Fila de Totales al final
  const totalRow = worksheet.getRow(currentExcelRow);
  totalRow.height = 22;
  totalRow.getCell(8).value = 'TOTAL GENERAL:';
  totalRow.getCell(8).font = boldFont;
  totalRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

  totalRow.getCell(9).value = summary.totalQuantity;
  totalRow.getCell(9).font = boldFont;
  totalRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

  totalRow.getCell(10).value = summary.totalPrecioVenta;
  totalRow.getCell(10).numFmt = '"$ " #,##0.00';
  totalRow.getCell(10).font = { ...boldFont, color: { argb: 'FF006100' } };
  totalRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

  // Ancho de columnas
  CCWR_EXPORT_COLUMNS.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = col.width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Genera el resumen en formato HTML limpio para copiar al portapapeles y pegar en correo Outlook
 */
export function generateCcwrEmailHtml(
  headerInfo: CcwrHeaderInfo,
  summary: CcwrFinancialSummary,
  params: CcwrQuoteParameters
): string {
  const customer = headerInfo.endCustomerName || 'Cliente';
  const quoteNum = headerInfo.quoteNumber || 'S/N';
  const dateStr = headerInfo.quoteDate || new Date().toLocaleDateString('es-CL');

  let rowsHtml = '';
  for (const group of summary.byProduct) {
    rowsHtml += `
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; color: #111827;">${group.productNumber}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; color: #374151;">${group.description}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; color: #111827;">${group.serviceSku}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; text-align: center; color: #111827;">${group.serviceLevel}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; text-align: center; font-weight: bold; color: #111827;">${group.totalQty}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; text-align: right; color: #111827;">$ ${group.unitSalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; text-align: right; font-weight: bold; color: #059669;">$ ${group.totalSalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }

  return `
<div style="font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; line-height: 1.5; max-width: 850px;">
  <p>Estimados,</p>
  <p>Junto con saludar, comparto cotización formal de renovación de <strong>Servicios y Soporte Cisco Smart Net Total Care</strong> para <strong>${customer}</strong>.</p>
  
  <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 0 0 6px 0;"><strong>Número de Cotización Cisco CCW-R:</strong> ${quoteNum}</p>
    <p style="margin: 0 0 6px 0;"><strong>Cliente Final:</strong> ${customer} ${headerInfo.endCustomerId ? `(ID: ${headerInfo.endCustomerId})` : ''}</p>
    <p style="margin: 0 0 6px 0;"><strong>Fecha de Emisión:</strong> ${dateStr}</p>
    <p style="margin: 0;"><strong>Total Dispositivos / Seriales:</strong> ${summary.totalQuantity} unidades</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px;">
    <thead>
      <tr style="background-color: #92D050; color: #000000;">
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: left;">Product Number</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: left;">Descripción</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: left;">SKU Servicio</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: center;">Nivel</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: center;">Cant</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: right;">Unit USD</th>
        <th style="padding: 9px 12px; border: 1px solid #65a30d; text-align: right;">Total USD</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr style="background-color: #f9fafb; font-weight: bold;">
        <td colspan="4" style="padding: 10px 12px; border: 1px solid #d1d5db; text-align: right;">TOTAL GENERAL:</td>
        <td style="padding: 10px 12px; border: 1px solid #d1d5db; text-align: center;">${summary.totalQuantity}</td>
        <td style="padding: 10px 12px; border: 1px solid #d1d5db;"></td>
        <td style="padding: 10px 12px; border: 1px solid #d1d5db; text-align: right; color: #059669; font-size: 14px;">$ ${summary.totalPrecioVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
      </tr>
    </tfoot>
  </table>

  <p style="font-size: 11px; color: #6b7280; font-style: italic; margin-top: 16px;">
    * Precios expresados en Dólares Americanos (USD), válidos según condiciones comerciales de Intcomex Chile.
  </p>

  <p style="margin-top: 20px;">
    Atentamente,<br/>
    <strong>${params.sellerName || 'Mauricio Skill'}</strong><br/>
    ${params.companyName || 'INTCOMEX SA'}<br/>
    ${params.sellerPhone || ''}
  </p>
</div>
  `.trim();
}
