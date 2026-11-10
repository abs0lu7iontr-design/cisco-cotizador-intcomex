// ============================================================================
// CISCO AUTOMATED v2.10 - CCW-R EXCEL EXPORTER
// Generación Oficial de Planilla Excel de Cotización de Servicios y Licencias
// Diseño Ejecutivo Compacto y Auto-Ajustado con Logo Intcomex, Zebra Striping,
// Fondo Blanco sin Cuadrícula Externa y Formato de 13 Columnas Oficiales
// ============================================================================

import ExcelJS from 'exceljs';
import {
  CcwrHeaderInfo,
  CcwrLineItem,
  CcwrQuoteParameters,
  CcwrFinancialSummary,
} from './ccwrTypes';
import { INTCOMEX_LOGO_RAW_BASE64 } from '../../lib/intcomexLogoBase64';

export const CCWR_EXPORT_COLUMNS = [
  { header: 'Número de Producto', key: 'productNumber', minWidth: 18, maxWidth: 32 },
  { header: 'Descripción del Producto', key: 'productDescription', minWidth: 26, maxWidth: 65 },
  { header: 'Número de Serie / PAK', key: 'serialNumber', minWidth: 18, maxWidth: 28 },
  { header: 'Nivel de Servicio', key: 'serviceLevel', minWidth: 15, maxWidth: 24 },
  { header: 'Descripción del Servicio', key: 'serviceLevelDescription', minWidth: 22, maxWidth: 35 },
  { header: 'SKU del Servicio', key: 'serviceSku', minWidth: 18, maxWidth: 32 },
  { header: 'Fecha de Inicio', key: 'startDate', minWidth: 14, maxWidth: 18 },
  { header: 'Fecha de Término', key: 'endDate', minWidth: 14, maxWidth: 18 },
  { header: 'Cantidad', key: 'quantity', minWidth: 9, maxWidth: 12 },
  { header: 'Precio Unitario (USD)', key: 'unitSalePrice', minWidth: 22, maxWidth: 28 },
  { header: 'ID Cliente Final', key: 'endCustomerId', minWidth: 16, maxWidth: 24 },
  { header: 'Nombre Cliente Final', key: 'endCustomerName', minWidth: 28, maxWidth: 75 },
  { header: 'Dirección Cliente Final', key: 'endCustomerAddress', minWidth: 28, maxWidth: 85 },
];

const SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ENGLISH_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parsea un string de fecha en formato "DD-mmm-YYYY" o ISO a un objeto Date
 */
export function parseCcwrDateToDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);
    let monthIdx = SPANISH_MONTHS.indexOf(monthStr);
    if (monthIdx === -1) {
      monthIdx = ENGLISH_MONTHS.indexOf(monthStr);
    }
    if (!isNaN(day) && monthIdx !== -1 && !isNaN(year)) {
      return new Date(Date.UTC(year, monthIdx, day));
    }
  }
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }
  return null;
}

/**
 * Calcula con precisión los meses de vigencia del contrato a partir de las fechas de inicio y término
 */
export function calculateContractDurationMonths(items: CcwrLineItem[]): number {
  for (const it of items) {
    if (it.startDate && it.endDate) {
      const d1 = parseCcwrDateToDate(it.startDate);
      const d2 = parseCcwrDateToDate(it.endDate);
      if (d1 && d2 && d2 > d1) {
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1; // Rango inclusivo
        const months = Math.round(diffDays / 30.4375);
        if (months > 0) return months;
      }
    }
  }
  return 12; // Valor predeterminado estándar en servicios anuales
}

/**
 * Genera el archivo Excel de cotización formal de servicios con la estructura, logo y diseño oficial
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
    views: [{ showGridLines: false }], // Sin líneas de cuadrícula grises fuera de la cotización
  });

  // 1. Inyección de Logo Oficial Intcomex en la parte superior izquierda
  try {
    const logoImageId = workbook.addImage({
      base64: INTCOMEX_LOGO_RAW_BASE64,
      extension: 'png',
    });

    worksheet.addImage(logoImageId, {
      tl: { col: 0.1, row: 0.3 },
      ext: { width: 145, height: 24 },
      editAs: 'oneCell',
    });
  } catch (e) {
    console.warn('Logo injection notice:', e);
  }

  // Estilos y Paleta de Colores Ejecutiva (Inspirada en el Módulo CCW)
  const plomoHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }, // Plomo / Gris corporativo oficial (Imagen 4)
  };

  const zebraLightFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' }, // Blanco puro
  };

  const zebraDarkFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // Gris/Slate sutil y limpio (alto contraste ejecutivo)
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 9.5,
    bold: true,
    color: { argb: 'FF000000' },
  };

  const boldFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: 'FF000000' },
  };

  const regularFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 9.5,
    color: { argb: 'FF1E293B' },
  };

  const executiveBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };

  const tableHeaderBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF334155' } },
    bottom: { style: 'medium', color: { argb: 'FF334155' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } },
  };

  // 2. Cabecera Ejecutiva Corporativa (Filas 3 a 7) - Compacta y sin espacios muertos
  const durationMonths = calculateContractDurationMonths(items);

  // Fila 3: Product Manager (Izquierda) | Vigencia del Servicio (Derecha con diseño integral)
  const row3 = worksheet.getRow(3);
  row3.height = 21;
  row3.getCell(1).value = 'Product Manager:';
  row3.getCell(1).font = boldFont;
  row3.getCell(2).value = params.sellerName || 'Mauricio Skill';
  row3.getCell(2).font = regularFont;

  // Celda D3 y E3: Vigencia del Servicio con diseño ejecutivo a juego
  row3.getCell(4).value = 'Vigencia del Servicio:';
  row3.getCell(4).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
  row3.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
  row3.getCell(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' }, // Soft blue
  };
  row3.getCell(4).border = {
    top: { style: 'thin', color: { argb: 'FF93C5FD' } },
    bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
    left: { style: 'thin', color: { argb: 'FF93C5FD' } },
  };

  row3.getCell(5).value = `${durationMonths} Meses`;
  row3.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
  row3.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
  row3.getCell(5).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDBEAFE' }, // Distinct soft blue badge
  };
  row3.getCell(5).border = {
    top: { style: 'thin', color: { argb: 'FF93C5FD' } },
    bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
    right: { style: 'thin', color: { argb: 'FF93C5FD' } },
  };

  // Fila 4: Empresa (Izquierda) | TOTAL COTIZACIÓN Encabezado (Derecha)
  const row4 = worksheet.getRow(4);
  row4.height = 18;
  row4.getCell(1).value = 'Empresa:';
  row4.getCell(1).font = boldFont;
  row4.getCell(2).value = params.companyName || 'INTCOMEX SA';
  row4.getCell(2).font = regularFont;

  worksheet.mergeCells('D4:E4');
  const totalBoxHeader = worksheet.getCell('D4');
  totalBoxHeader.value = 'TOTAL COTIZACIÓN';
  totalBoxHeader.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF065F46' } };
  totalBoxHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  totalBoxHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD1FAE5' }, // Verde menta suave
  };
  totalBoxHeader.border = {
    top: { style: 'medium', color: { argb: 'FF16A34A' } },
    left: { style: 'medium', color: { argb: 'FF16A34A' } },
    right: { style: 'medium', color: { argb: 'FF16A34A' } },
    bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
  };

  // Fila 5: Dirección (Izquierda) | Monto Total de Venta (Derecha)
  const row5 = worksheet.getRow(5);
  row5.height = 24;
  row5.getCell(1).value = 'Dirección:';
  row5.getCell(1).font = boldFont;
  row5.getCell(2).value = params.companyAddress || 'Rosario Norte 615, SANTIAGO';
  row5.getCell(2).font = regularFont;

  worksheet.mergeCells('D5:E5');
  const totalBoxValue = worksheet.getCell('D5');
  totalBoxValue.value = summary.totalPrecioVenta;
  totalBoxValue.numFmt = '"$ " #,##0.00';
  totalBoxValue.font = { name: 'Calibri', size: 13.5, bold: true, color: { argb: 'FF15803D' } };
  totalBoxValue.alignment = { vertical: 'middle', horizontal: 'center' };
  totalBoxValue.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' }, // Verde claro distinguido
  };
  totalBoxValue.border = {
    bottom: { style: 'medium', color: { argb: 'FF16A34A' } },
    left: { style: 'medium', color: { argb: 'FF16A34A' } },
    right: { style: 'medium', color: { argb: 'FF16A34A' } },
  };

  // Fila 6: Teléfono (Izquierda) | Fecha (Derecha)
  const row6 = worksheet.getRow(6);
  row6.height = 20;
  row6.getCell(1).value = 'Teléfono:';
  row6.getCell(1).font = boldFont;
  row6.getCell(2).value = params.sellerPhone || 'Movil :+56 9 88226530';
  row6.getCell(2).font = regularFont;

  row6.getCell(4).value = 'Fecha:';
  row6.getCell(4).font = boldFont;
  row6.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  worksheet.mergeCells('E6:F6');
  const dateCell = worksheet.getCell('E6');
  dateCell.value = today.toLocaleDateString('es-CL', dateOptions);
  dateCell.font = regularFont;
  dateCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Fila 7: Quote CCW-R (Izquierda) - Altura completa de 20px para que NUNCA aparezca cortada
  const row7 = worksheet.getRow(7);
  row7.height = 20;
  row7.getCell(1).value = 'Quote CCW-R:';
  row7.getCell(1).font = boldFont;
  row7.getCell(2).value = headerInfo.quoteNumber || 'S/N';
  row7.getCell(2).font = { ...boldFont, size: 10.5, color: { argb: 'FF002060' } };

  // 3. Fila 8: Encabezados de Tabla en Plomo / Gris (13 Columnas Oficiales en Español)
  const tableHeaderRow = worksheet.getRow(8);
  tableHeaderRow.height = 25;

  CCWR_EXPORT_COLUMNS.forEach((col, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = plomoHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = tableHeaderBorder;
  });

  // 4. Filas 9+: Detalle de Ítems con Alternancia (Zebra Striping)
  const exportItems = onlyServicesWithCost
    ? items.filter((it) => it.isServiceOrLicense && it.extendedNetPrice > 0)
    : items;

  let currentExcelRow = 9;

  for (let i = 0; i < exportItems.length; i++) {
    const it = exportItems[i];
    const row = worksheet.getRow(currentExcelRow);
    row.height = 19; // Compacto para lectura fluida

    // Alternar colores claro / oscuro para lectura ergonómica
    const rowFill = i % 2 === 0 ? zebraLightFill : zebraDarkFill;

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

    // Tipografía, bordes y fondo zebra
    for (let c = 1; c <= 13; c++) {
      const cell = row.getCell(c);
      cell.font = regularFont;
      cell.border = executiveBorder;
      cell.fill = rowFill;
      cell.alignment = { vertical: 'middle' };
    }

    // Refuerzo de bordes perimetrales de la tabla
    row.getCell(1).border = {
      ...executiveBorder,
      left: { style: 'medium', color: { argb: 'FF334155' } },
    };
    row.getCell(13).border = {
      ...executiveBorder,
      right: { style: 'medium', color: { argb: 'FF334155' } },
    };

    // Justificaciones y alineaciones estrictas para cada celda
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(10).numFmt = '"$ " #,##0.00';
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    row.getCell(13).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    currentExcelRow++;
  }

  // 5. Fila de Totales al final
  const totalRow = worksheet.getRow(currentExcelRow);
  totalRow.height = 24;

  worksheet.mergeCells(`G${currentExcelRow}:H${currentExcelRow}`);
  const totalLabelCell = worksheet.getCell(`G${currentExcelRow}`);
  totalLabelCell.value = 'TOTAL GENERAL:';
  totalLabelCell.font = boldFont;
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
  totalLabelCell.border = tableHeaderBorder;
  worksheet.getCell(`H${currentExcelRow}`).border = tableHeaderBorder;

  totalRow.getCell(9).value = summary.totalQuantity;
  totalRow.getCell(9).font = boldFont;
  totalRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
  totalRow.getCell(9).border = tableHeaderBorder;

  totalRow.getCell(10).value = summary.totalPrecioVenta;
  totalRow.getCell(10).numFmt = '"$ " #,##0.00';
  totalRow.getCell(10).font = { ...boldFont, color: { argb: 'FF006100' }, size: 10.5 };
  totalRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell(10).border = tableHeaderBorder;

  // Bordear celdas vacías del total para cerrar el recuadro inferior de la tabla
  for (let c = 1; c <= 6; c++) {
    totalRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left: c === 1 ? { style: 'medium', color: { argb: 'FF334155' } } : { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }
  for (let c = 11; c <= 13; c++) {
    totalRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: c === 13 ? { style: 'medium', color: { argb: 'FF334155' } } : { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // 6. Leyendas Legales Oficiales Intcomex (Filas Dinámicas ubicadas automáticamente al final)
  // Nota: "Plazo de entrega" eliminado ya que servicios y licencias son intangibles puros
  const footerRowStart = currentExcelRow + 2;

  // Leyenda 1: Validez de la Oferta (14 días corridos destacado en negrita y rojo)
  worksheet.mergeCells(`A${footerRowStart}:M${footerRowStart}`);
  const footer1 = worksheet.getCell(`A${footerRowStart}`);
  worksheet.getRow(footerRowStart).height = 18;
  footer1.value = {
    richText: [
      { text: 'Validez de la Oferta: ', font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF1F2937' } } },
      { text: 'Esta cotización tiene una validez de ', font: { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } } },
      { text: '14 días corridos', font: { name: 'Calibri', size: 8.5, bold: true, italic: true, color: { argb: 'FFC00000' } } },
      { text: ' a contar de su fecha de emisión.', font: { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } } },
    ],
  };
  footer1.alignment = { vertical: 'middle', horizontal: 'left' };

  // Leyenda 2: Validación Técnica y Responsabilidad
  const footerRow2 = footerRowStart + 1;
  worksheet.mergeCells(`A${footerRow2}:M${footerRow2}`);
  const footer2 = worksheet.getCell(`A${footerRow2}`);
  worksheet.getRow(footerRow2).height = 36;
  footer2.value = {
    richText: [
      { text: 'Validación Técnica y Responsabilidad: ', font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF1F2937' } } },
      { text: 'La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.', font: { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF475569' } } },
    ],
  };
  footer2.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  // 7. Cálculo Inteligente y Compacto de Ancho de Columnas (Auto-Ajustado al Contenido)
  CCWR_EXPORT_COLUMNS.forEach((col, idx) => {
    const colIndex = idx + 1;
    let maxContentLen = col.header.length;

    for (const it of exportItems) {
      let valStr = '';
      switch (col.key) {
        case 'productNumber':
          valStr = it.productNumber || '';
          break;
        case 'productDescription':
          valStr = it.productDescription || '';
          break;
        case 'serialNumber':
          valStr = it.serialNumber || '';
          break;
        case 'serviceLevel':
          valStr = it.serviceLevel || '';
          break;
        case 'serviceLevelDescription':
          valStr = it.serviceLevelDescription || '';
          break;
        case 'serviceSku':
          valStr = it.serviceSku || '';
          break;
        case 'startDate':
          valStr = it.startDate || '';
          break;
        case 'endDate':
          valStr = it.endDate || '';
          break;
        case 'quantity':
          valStr = String(it.quantity || '');
          break;
        case 'unitSalePrice':
          valStr = `$ ${it.precioVentaUnitario.toFixed(2)}`;
          break;
        case 'endCustomerId':
          valStr = it.endCustomerId || headerInfo.endCustomerId || '';
          break;
        case 'endCustomerName':
          valStr = it.endCustomerName || headerInfo.endCustomerName || '';
          break;
        case 'endCustomerAddress':
          valStr = it.endCustomerAddress || headerInfo.endCustomerAddressLine1 || '';
          break;
      }
      if (valStr.length > maxContentLen) {
        maxContentLen = valStr.length;
      }
    }

    // Comprobar también metadatos de cabecera general para blindar columnas
    if (col.key === 'endCustomerId') {
      const hVal = headerInfo.endCustomerId || '';
      if (hVal.length > maxContentLen) maxContentLen = hVal.length;
    } else if (col.key === 'endCustomerName') {
      const hVal = headerInfo.endCustomerName || '';
      if (hVal.length > maxContentLen) maxContentLen = hVal.length;
    } else if (col.key === 'endCustomerAddress') {
      const hVal = headerInfo.endCustomerAddressLine1 || '';
      if (hVal.length > maxContentLen) maxContentLen = hVal.length;
    }

    // Ancho ajustado con margen de respiro (+ 3.5 caracteres) para garantizar que NUNCA desborde el recuadro
    let adjustedWidth = maxContentLen + 3.5;

    if (col.key === 'quantity') {
      adjustedWidth = 10;
    } else if (col.key === 'startDate' || col.key === 'endDate') {
      adjustedWidth = 16;
    } else if (col.key === 'serviceLevel') {
      // Col 4 contiene en la cabecera superior "Vigencia del Servicio:" (22 caracteres)
      adjustedWidth = Math.max(adjustedWidth, 24);
    } else if (col.key === 'unitSalePrice') {
      // Encabezado "Precio Unitario (USD)" (21 caracteres)
      adjustedWidth = Math.max(adjustedWidth, 24);
    } else if (col.key === 'productNumber') {
      // Col 1 contiene en la cabecera "Product Manager:" y "Quote CCW-R:"
      adjustedWidth = Math.max(adjustedWidth, 22);
    } else if (col.key === 'productDescription') {
      // Col 2 contiene en la cabecera "Rosario Norte 615, SANTIAGO" (28 caracteres)
      adjustedWidth = Math.max(adjustedWidth, 32);
    } else if (col.key === 'serviceLevelDescription') {
      adjustedWidth = Math.max(adjustedWidth, 26);
    }

    // Aplicar minWidth y maxWidth de forma estricta asegurando que no se corte
    adjustedWidth = Math.min(Math.max(adjustedWidth, col.minWidth), col.maxWidth);

    worksheet.getColumn(colIndex).width = adjustedWidth;
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
  const pmName = params.sellerName || 'Mauricio Skill';

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
        <td style="padding: 8px 12px; border: 1px solid #d1d5db; font-family: Arial, sans-serif; font-size: 12px; text-align: right; font-weight: bold; color: #111827;">$ ${group.totalSalePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; color: #1f2937; margin: 0 auto;">
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #94a3b8; padding-bottom: 6px;">
          Cotización Oficial de Servicios y Licencias Cisco
        </h2>
        <table style="width: 100%; font-size: 13px; line-height: 1.5;">
          <tr>
            <td style="width: 50%;"><strong>Cliente Final:</strong> ${customer}</td>
            <td style="width: 50%;"><strong>Fecha de Emisión:</strong> ${dateStr}</td>
          </tr>
          <tr>
            <td><strong>Product Manager:</strong> ${pmName}</td>
            <td><strong>Quote Cisco CCW-R:</strong> ${quoteNum}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 8px;">
              <strong>Total Cotización:</strong> <span style="color: #059669; font-weight: bold; font-size: 15px;">$ ${summary.totalPrecioVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
            </td>
          </tr>
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background-color: #D9D9D9; color: #000000;">
            <th style="padding: 10px; border: 1px solid #475569; text-align: left;">Número de Producto</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: left;">Descripción</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: left;">SKU Servicio</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: center;">Nivel</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: center;">Cantidad</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: right;">Precio Unitario</th>
            <th style="padding: 10px; border: 1px solid #475569; text-align: right;">Total Venta</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td colspan="4" style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">TOTAL GENERAL:</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">${summary.totalQuantity}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1;"></td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #059669; font-size: 13px;">$ ${summary.totalPrecioVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
          </tr>
        </tfoot>
      </table>

      <div style="font-size: 11px; color: #64748b; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <p style="margin: 0 0 4px 0;">* Precios unitarios y totales expresados en Dólares Estadounidenses (USD).</p>
        <p style="margin: 0 0 4px 0;">* Los números de serie asociados a cada contrato se encuentran detallados en la planilla oficial adjunta.</p>
        <p style="margin: 0;">* Cotización generada por Intcomex Chile mediante la plataforma Cisco Automated.</p>
      </div>
    </div>
  `;
}
