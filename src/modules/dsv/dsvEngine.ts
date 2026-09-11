// ============================================================================
// CISCO AUTOMATED - ISOLATED DSV TRANSFORMATION & EXCELJS ENGINE (48 COLS)
// ============================================================================

import ExcelJS from 'exceljs';
import { RawBomItem, RawBomParsedResult, sanitizeTrim } from './dsvBomParser';
import { DsvModalFormData, Dsv48LineItem, DsvTransformationSummary, SkuCategoryType } from './types';

/**
 * Genera la fecha actual en formato oficial DD-MMM-YYYY con el mes en inglés y mayúsculas.
 * Ej: 23-AUG-2026
 */
export function getFormattedDsvDate(dateObj: Date = new Date()): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parsea un identificador o número para inyectarlo como Number nativo en Excel si es numérico,
 * eliminando los triángulos verdes de advertencia ("Number stored as text").
 */
export function parseCellNumericId(val: any): number | string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  // Si contiene solo dígitos numéricos, convertir a Number nativo
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return !isNaN(num) ? num : str;
  }
  return str;
}

/**
 * Clasificación automática de SKUs por defecto:
 * - Servicios: CON-SNT, CON-SNTP, CON-OSP, CON-PRE, CON-ECDN, CON-SAU, CON-SU1..4, etc.
 * - Suscripciones/Licencias: L-DNA-, LIC-, SUB-, S-, etc.
 * - Hardware: Todo lo demás
 */
export function detectSkuCategory(sku: string): SkuCategoryType {
  const upper = sanitizeTrim(sku).toUpperCase();

  // Prefijos explícitos de servicios Cisco
  const servicePrefixes = [
    'CON-SNT',
    'CON-SNTP',
    'CON-OSP',
    'CON-PRE',
    'CON-ECDN',
    'CON-SAU',
    'CON-SU1',
    'CON-SU2',
    'CON-SU3',
    'CON-SU4',
    'CON-ISV',
    'CON-SW',
    'CON-',
    'SNT-',
  ];

  for (const prefix of servicePrefixes) {
    if (upper.startsWith(prefix) || upper.includes('-SNT')) {
      return 'service';
    }
  }

  // Licencias / Suscripciones
  if (
    upper.startsWith('L-') ||
    upper.startsWith('LIC-') ||
    upper.startsWith('SUB-') ||
    upper.includes('-DNA') ||
    upper.includes('-LIC') ||
    upper.includes('-SUB')
  ) {
    return 'subscription';
  }

  return 'hardware';
}

/**
 * FASE 1: Filtro Estricto de Valor Cero
 * Descarta automáticamente líneas donde el precio de lista sea 0 (LIST_PRICE <= 0).
 */
export function isZeroValueBomItem(item: RawBomItem): boolean {
  const listPrice = Number(item.listPrice) || 0;
  const qty = Number(item.qty) || 0;
  return listPrice <= 0 || qty <= 0;
}

/**
 * Detecta equipos SMB (Catalyst 1000/1200/1300 y CBS) para cotizador DSV
 */
export function getDsvDiscountRate(sku: string, defaultRate: number = 42): number {
  const cleanSku = (sku || '').trim().toUpperCase();
  // Captura prefijos C1000-, C1200-, C1300- y CBS seguido de 3 dígitos (ej. CBS350-)
  const isSmbFamily = /^C1000-|^C1200-|^C1300-|^CBS\d{3}-/i.test(cleanSku);
  return isSmbFamily ? 20 : defaultRate;
}

/**
 * FASE 4: Lógica Financiera (Columnas J y K en DSV)
 * 
 * - Hardware y Suscripciones (Misma fórmula):
 *   * Col J (Reported Product Unit Price): LIST_PRICE * (1 - 0.42) [o 0.20 para familias SMB: C1000, C1200, C1300, CBS]
 *   * Col K (Reported Net Price): LIST_PRICE * (1 - (DISTI_DISCOUNT / 100))
 * 
 * - Servicios Cisco (SKUs CON-):
 *   * Determinación de Años: Duration(Months) / 12 (12m = 1 año, 36m = 3 años, 60m = 5 años; defecto = 1 año).
 *   * Descuento: 1 año (<= 12m) -> 37% (0.37) | 3 años o más (>= 36m) -> 41.41% (0.4141).
 *   * Col J (Reported Product Unit Price): LIST_PRICE * (1 - descuento) -> NUNCA se multiplica por años.
 *   * Col K (Reported Net Price): Columna_J * cantidad_de_años -> J multiplicado por los años.
 */
export interface DsvDiscrepancy {
  sku: string;
  lineNumber: string;
  durationMonths: number;
  calculatedPrice: number;   // Opción 1: List * (1 - Disc)
  bomReportedPrice: number;  // Opción 2: Columna AE
  difference: number;
  selectedResolution?: 'BOM' | 'MATH';
}

// Clasificador universal de contratos de servicio Cisco
export function isCiscoServiceSku(sku: string, description: string = ''): boolean {
  const normSku = String(sku || '').trim().toUpperCase();
  const normDesc = String(description || '').trim().toUpperCase();

  const servicePrefixRegex = /^(CON|CX|CXE|CXS|SVS|AS|ASF|HT|HTS|SP|SPA|SOL|TRN|EDU)-/i;
  if (servicePrefixRegex.test(normSku)) return true;

  const serviceKeywords = ['SMARTNET', 'SOLUTION SUPPORT', 'SUCCESS TRACK', 'SUPPORT SERVICE', 'TECH SUPPORT'];
  return serviceKeywords.some((kw) => normDesc.includes(kw));
}

/**
 * FASE 4: Lógica Financiera (Columnas J y K en DSV) y Conciliación Silenciosa
 * 
 * - Hardware y Suscripciones (Misma fórmula):
 *   * Col J (Reported Product Unit Price): LIST_PRICE * (1 - 0.42) [o 0.20 para familias SMB: C1000, C1200, C1300, CBS]
 *   * Col K (Reported Net Price): LIST_PRICE * (1 - (DISTI_DISCOUNT / 100))
 * 
 * - Servicios Cisco:
 *   * Col J: INTACTA -> LIST_PRICE * (1 - descuento) [37% o 41.41%]
 *   * Opción 1 (Cálculo Teórico): durationList * (1 - distiDisc)
 *   * Opción 2 (Dato Oficial Cisco BOM): Columna AE (DURATION NET PRICE)
 *   * Conciliación: Si diff > $0.02 USD, genera DsvDiscrepancy para resolución de usuario
 *   * Col K por defecto: Opción 2 (Columna AE)
 */
export function calculateDsvPrices(
  sku: string,
  listPrice: number,
  distiDiscountPct: number,
  durationMonths: number,
  overrideCategory?: SkuCategoryType,
  itemData?: {
    durationNetPrice?: number;
    durationListPrice?: number;
    distiDiscount?: number;
    description?: string;
    lineNumber?: string;
    partNumber?: string;
  }
): {
  reportedProductUnitPrice: number;
  reportedNetPrice: number;
  effectiveCategory: SkuCategoryType;
  discrepancy: DsvDiscrepancy | null;
} {
  const effectiveCategory = overrideCategory || detectSkuCategory(sku);
  const partNumber = itemData?.partNumber || sku;
  const description = itemData?.description || '';
  const lineNumber = itemData?.lineNumber || '';

  const isService = effectiveCategory === 'service' || isCiscoServiceSku(partNumber, description);

  if (isService) {
    const years = durationMonths >= 12 ? Math.max(1, Math.round(durationMonths / 12)) : 1;

    // 1. Columna J: INTACTA
    const discount = durationMonths >= 36 ? 0.4141 : 0.37;
    const colJ = Number((listPrice * (1 - discount)).toFixed(2));

    // 2. Opción 1: Cálculo Teórico Dinámico
    const distiDisc =
      (itemData?.distiDiscount ?? distiDiscountPct) > 1
        ? (itemData?.distiDiscount ?? distiDiscountPct) / 100
        : (itemData?.distiDiscount ?? distiDiscountPct ?? 0);

    const durationList =
      itemData?.durationListPrice && itemData.durationListPrice > 0
        ? itemData.durationListPrice
        : listPrice * years;

    const option1_MathNet = Number((durationList * (1 - distiDisc)).toFixed(2));

    // 3. Opción 2: Dato Oficial Cisco (Columna AE)
    const hasBomDurationNet = itemData?.durationNetPrice !== undefined && itemData.durationNetPrice > 0;
    const option2_BomNet = hasBomDurationNet
      ? Number(itemData.durationNetPrice!.toFixed(2))
      : option1_MathNet;

    // 4. Conciliación silenciosa (Tolerancia: $0.02 USD)
    const diff = Number(Math.abs(option1_MathNet - option2_BomNet).toFixed(2));
    let discrepancy: DsvDiscrepancy | null = null;

    if (hasBomDurationNet && diff > 0.02) {
      discrepancy = {
        sku: partNumber,
        lineNumber: lineNumber,
        durationMonths,
        calculatedPrice: option1_MathNet,
        bomReportedPrice: option2_BomNet,
        difference: diff,
      };
    }

    // Valor por defecto: Columna AE oficial de Cisco
    const colK = option2_BomNet;

    return {
      reportedProductUnitPrice: colJ,
      reportedNetPrice: colK,
      effectiveCategory: 'service',
      discrepancy,
    };
  } else {
    // Hardware y Suscripciones (Misma fórmula financiera)
    const discountRate = getDsvDiscountRate(sku);
    const discountMultiplier = 1 - discountRate / 100;

    const costoDsv = Math.round(listPrice * discountMultiplier * 100) / 100;
    const colJ = costoDsv;
    const discRate = distiDiscountPct > 0 ? distiDiscountPct / 100 : discountRate / 100;
    const colK = Number((listPrice * (1 - discRate)).toFixed(2));
    return {
      reportedProductUnitPrice: colJ,
      reportedNetPrice: colK,
      effectiveCategory,
      discrepancy: null,
    };
  }
}

/**
 * FASES 1, 2, 3, 4 y 5: Orquestador de Transformación BOM -> 48 Columnas DSV
 * Sanitiza todos los campos con .trim() y no renumera los números de línea (LINE#).
 */
export function transformRawBomToDsv(
  rawBom: RawBomParsedResult,
  form: DsvModalFormData,
  overrides: Record<string, SkuCategoryType> = {},
  allowExportAll: boolean = false
): DsvTransformationSummary {
  const dsvDate = getFormattedDsvDate();

  const cleanSo = sanitizeTrim(form.so);
  const cleanPo = sanitizeTrim(form.po);
  const cleanDealId = sanitizeTrim(form.dealId || rawBom.dealIdFromBom || rawBom.authorizationNumber);
  const cleanPartnerId = sanitizeTrim(form.partnerId);
  const cleanEndCustomerAddress = sanitizeTrim(form.endCustomerAddress);

  let discardedCount = 0;
  const dsvRows: Dsv48LineItem[] = [];

  for (const item of rawBom.items) {
    // Filtro de valor cero (Columna O: LIST_PRICE <= 0)
    if (!allowExportAll && isZeroValueBomItem(item)) {
      discardedCount++;
      continue;
    }

    const itemLineKey = sanitizeTrim(item.lineNumber);
    const itemOverride = overrides[itemLineKey];

    // Lógica Financiera Columnas J y K con Doble Verificación
    const { reportedProductUnitPrice, reportedNetPrice, effectiveCategory, discrepancy } =
      calculateDsvPrices(
        item.ciscoSku,
        item.listPrice,
        item.distiDiscountPct,
        item.durationMonths,
        itemOverride,
        {
          durationNetPrice: item.durationNetPrice,
          durationListPrice: item.durationListPrice,
          distiDiscount: item.distiDiscount ?? item.distiDiscountPct,
          description: item.description,
          lineNumber: item.lineNumber,
          partNumber: item.partNumber || item.ciscoSku,
        }
      );

    const resellerNameVal = sanitizeTrim(
      form?.partnerName || item.resellerName || rawBom.resellerName
    );
    const endUserNameVal = sanitizeTrim(
      form?.endCustomerName || item.endUserName || rawBom.endUserName
    );
    const authNumberVal = cleanDealId || sanitizeTrim(item.authorizationNumber);

    // Mapeo Oficial de las 48 Columnas (A - AV)
    const dsvRow: Dsv48LineItem = {
      status: 'NEW',                                      // A (1)
      distributorToResellerSalesOrderDate: dsvDate,       // B (2)
      distributorSalesOrderNumber: cleanSo,               // C (3) - 9 dígitos numéricos
      soLineNum: sanitizeTrim(item.lineNumber),          // D (4) - SO Line Number (Order Line Item Number)
      ciscoStandardPartNumber: sanitizeTrim(item.ciscoSku), // E (5)
      startDate: '',                                      // F (6) [ANCHO 5]
      endDate: '',                                        // G (7) [ANCHO 5]
      duration: '',                                       // H (8) [ANCHO 5]
      productQuantity: Math.max(1, Math.round(Number(item.qty))), // I (9)
      reportedProductUnitPrice,                           // J (10) - Reported Product Unit Price - Reported Currency
      reportedNetPrice,                                   // K (11) - Reported Net Price
      dealId: authNumberVal,                              // L (12) - Deal ID (8 dígitos numéricos)
      magicKey: sanitizeTrim(item.magicKey),              // M (13) - Magic Key
      promotionAuthorizationNumber: '',                   // N (14) [ANCHO 5]
      distiPoToCisco: '',                                 // O (15) [ANCHO 5]
      serviceQuoteNumber: '',                             // P (16) [ANCHO 5]
      dropShip: 'N',                                      // Q (17) - Drop Ship
      resellerToDistributorPoNumber: cleanPo,             // R (18) - Reseller to Distributor PO Number (6 dígitos numéricos)
      customerRequestedShipDate: dsvDate,                 // S (19) - Customer Requested Ship Date
      buyerResellerName: resellerNameVal,                 // T (20) - Buyer/Reseller Name
      buyerResellerPartnerIdentification: cleanPartnerId, // U (21) - Buyer/Reseller Partner Identification
      buyerResellerAddress1: 'Chile',                     // V (22)
      buyerResellerAddress2: '',                          // W (23) [ANCHO 5]
      buyerResellerCity: 'Chile',                         // X (24)
      buyerResellerStateProvinceCountyRegion: 'Chile',    // Y (25)
      buyerResellerZipPostalCode: '',                     // Z (26) [ANCHO 5]
      buyerResellerCountry: 'CL',                         // AA (27)
      billToName: '',                                     // AB (28) [HIDDEN]
      billToAddress1: '',                                 // AC (29) [HIDDEN]
      billToAddress2: '',                                 // AD (30) [HIDDEN]
      billToCity: '',                                     // AE (31) [HIDDEN]
      billToStateProvinceCountyRegion: '',                // AF (32) [HIDDEN]
      billToZipPostalCode: '',                            // AG (33) [HIDDEN]
      billToCountry: '',                                  // AH (34) [HIDDEN]
      shipToName: resellerNameVal,                        // AI (35) - Ship-To Name (Igual a Buyer/Reseller Name en Celda T)
      shipToAddress1: 'Chile',                            // AJ (36)
      shipToAddress2: '',                                 // AK (37) [ANCHO 5]
      shipToCity: 'Chile',                                // AL (38)
      shipToStateProvinceCountyRegion: 'Chile',           // AM (39)
      shipToZipPostalCode: '',                            // AN (40) [ANCHO 5]
      shipToCountry: 'CL',                                // AO (41)
      endCustomerName: endUserNameVal,                    // AP (42) - End Customer Name
      endCustomerAddress1: cleanEndCustomerAddress || 'Chile', // AQ (43) - End Customer Address1
      endCustomerAddress2: '',                            // AR (44) [ANCHO 5]
      endCustomerCity: 'Chile',                           // AS (45)
      endCustomerStateProvinceCountyRegion: 'Chile',      // AT (46)
      endCustomerZipPostalCode: '',                       // AU (47) [ANCHO 5]
      endCustomerCountry: 'CL',                           // AV (48)

      originalListPrice: Number(item.listPrice) || 0,
      originalDistiDiscountPct: Number(item.distiDiscountPct) || 0,
      durationMonths: Number(item.durationMonths) || 0,
      detectedType: effectiveCategory,
      overrideType: itemOverride,
      discrepancy,
    };

    dsvRows.push(dsvRow);
  }

  const discrepanciesList = dsvRows
    .filter((r) => r.discrepancy !== null && r.discrepancy !== undefined)
    .map((r) => r.discrepancy!);

  return {
    totalOriginalItems: rawBom.items.length,
    validDsvItems: dsvRows.length,
    discardedZeroItems: discardedCount,
    rows: dsvRows,
    discrepancies: discrepanciesList,
  };
}

/**
 * Las 48 Cabeceras Oficiales del Portal Cisco DSV
 */
export const DSV_48_HEADERS = [
  'Status',                                                   // A (1)
  'Distributor to Reseller Sales Order Date',                 // B (2)
  'Distributor Sales Order Number',                           // C (3)
  'SO Line Number (Order Line Item Number)',                  // D (4)
  'Cisco Standard Part Number',                               // E (5)
  'Start Date',                                               // F (6)
  'End Date',                                                 // G (7)
  'Duration',                                                 // H (8)
  'Product Quantity',                                         // I (9)
  'Reported Product Unit Price - Reported Currency',          // J (10)
  'Reported Net Price',                                       // K (11)
  'Deal ID',                                                  // L (12)
  'Magic Key',                                                // M (13)
  'Promotion Authorization Number',                           // N (14)
  'Disti PO to Cisco',                                        // O (15)
  'Service Quote Number',                                     // P (16)
  'Drop Ship',                                                // Q (17)
  'Reseller to Distributor PO Number',                        // R (18)
  'Customer Requested Ship Date',                             // S (19)
  'Buyer/Reseller Name',                                      // T (20)
  'Buyer/Reseller Partner Identification',                    // U (21)
  'Buyer/Reseller Address1',                                  // V (22)
  'Buyer/Reseller Address2',                                  // W (23)
  'Buyer/Reseller City',                                      // X (24)
  'Buyer/Reseller State/Province/County/Region',              // Y (25)
  'Buyer/Reseller Zip / Postal Code',                         // Z (26)
  'Buyer/Reseller Country',                                   // AA (27)
  'Bill-To Name',                                             // AB (28)
  'Bill-To Address1',                                         // AC (29)
  'Bill-To Address2',                                         // AD (30)
  'Bill-To City',                                             // AE (31)
  'Bill-To State/Province/County/Region',                     // AF (32)
  'Bill-To Zip / Postal Code',                                // AG (33)
  'Bill-To Country',                                          // AH (34)
  'Ship-To Name',                                             // AI (35)
  'Ship-To Address1',                                         // AJ (36)
  'Ship-To Address2',                                         // AK (37)
  'Ship-To City',                                             // AL (38)
  'Ship-To State/Province/County/Region',                     // AM (39)
  'Ship-To Zip / Postal Code',                                // AN (40)
  'Ship-To Country',                                          // AO (41)
  'End Customer Name',                                        // AP (42)
  'End Customer Address1',                                    // AQ (43)
  'End Customer Address2',                                    // AR (44)
  'End Customer City',                                        // AS (45)
  'End Customer State/Province/County/Region',                // AT (46)
  'End Customer Zip / Postal Code',                           // AU (47)
  'End Customer Country',                                     // AV (48)
];

// Set de columnas que contienen datos (1-based index)
const DATA_COLUMN_INDICES = new Set([
  1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22, 24, 25, 27, 35, 36, 38, 39, 41, 42, 43, 45, 46, 48,
]);

/**
 * FASE 6: Generación y Exportación del Excel Oficial DSV con ExcelJS
 * 
 * Correcciones críticas aplicadas:
 * 1. Parseo Numérico de IDs (SO Col C, Deal ID Col L, PO Col R) como Number nativo para eliminar triángulos verdes en Excel.
 * 2. Reducción de ancho a width: 5 en columnas vacías: F, G, H, N, O, P, W, Z, AK, AN, AR, AU.
 * 3. Ocultamiento de columnas Bill-To (AB a AH).
 * 4. Tipografía Calibri 11 y colores dinámicos de cabecera.
 */
export async function generateCleanDsvWorkbook(
  dsvRows: Dsv48LineItem[],
  customFilename?: string
): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cisco Automated | DSV Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('DSV', {
    views: [{ showGridLines: true }],
  });

  // 1. Inyectar las 48 cabeceras oficiales en Fila 1
  const headerRow = worksheet.addRow(DSV_48_HEADERS);
  headerRow.height = 26;

  headerRow.eachCell((cell, colNumber) => {
    const hasData = DATA_COLUMN_INDICES.has(colNumber);

    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: hasData ? 'FFFF0000' : 'FF000000' }, // Rojo con datos, Negro si está vacía
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFBFBFBF' }, // Plomo / Gris (#BFBFBF)
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFA0A0A0' } },
      left: { style: 'thin', color: { argb: 'FFA0A0A0' } },
      bottom: { style: 'thin', color: { argb: 'FFA0A0A0' } },
      right: { style: 'thin', color: { argb: 'FFA0A0A0' } },
    };
  });

  // 2. Inyectar datos fila por fila
  dsvRows.forEach((row) => {
    // Inyectar IDs numéricos como Number nativo para eliminar triángulos verdes de advertencia
    const parsedSo = parseCellNumericId(row.distributorSalesOrderNumber);
    const parsedDealId = parseCellNumericId(row.dealId);
    const parsedPo = parseCellNumericId(row.resellerToDistributorPoNumber);

    const dataRow = worksheet.addRow([
      sanitizeTrim(row.status),                               // A (1)
      sanitizeTrim(row.distributorToResellerSalesOrderDate),   // B (2)
      parsedSo,                                               // C (3) - Number nativo (sin triángulo verde)
      sanitizeTrim(row.soLineNum),                            // D (4)
      sanitizeTrim(row.ciscoStandardPartNumber),               // E (5)
      '',                                                     // F (6)
      '',                                                     // G (7)
      '',                                                     // H (8)
      Number(row.productQuantity),                            // I (9)
      Number(row.reportedProductUnitPrice),                   // J (10)
      Number(row.reportedNetPrice),                           // K (11)
      parsedDealId,                                           // L (12) - Number nativo (sin triángulo verde)
      sanitizeTrim(row.magicKey),                             // M (13)
      '',                                                     // N (14)
      '',                                                     // O (15)
      '',                                                     // P (16)
      sanitizeTrim(row.dropShip),                             // Q (17)
      parsedPo,                                               // R (18) - Number nativo (sin triángulo verde)
      sanitizeTrim(row.customerRequestedShipDate),            // S (19)
      sanitizeTrim(row.buyerResellerName),                    // T (20)
      sanitizeTrim(row.buyerResellerPartnerIdentification),   // U (21)
      sanitizeTrim(row.buyerResellerAddress1),                // V (22)
      '',                                                     // W (23)
      sanitizeTrim(row.buyerResellerCity),                    // X (24)
      sanitizeTrim(row.buyerResellerStateProvinceCountyRegion),// Y (25)
      '',                                                     // Z (26)
      sanitizeTrim(row.buyerResellerCountry),                 // AA (27)
      '',                                                     // AB (28) [HIDDEN]
      '',                                                     // AC (29) [HIDDEN]
      '',                                                     // AD (30) [HIDDEN]
      '',                                                     // AE (31) [HIDDEN]
      '',                                                     // AF (32) [HIDDEN]
      '',                                                     // AG (33) [HIDDEN]
      '',                                                     // AH (34) [HIDDEN]
      sanitizeTrim(row.shipToName),                           // AI (35)
      sanitizeTrim(row.shipToAddress1),                       // AJ (36)
      '',                                                     // AK (37)
      sanitizeTrim(row.shipToCity),                           // AL (38)
      sanitizeTrim(row.shipToStateProvinceCountyRegion),      // AM (39)
      '',                                                     // AN (40)
      sanitizeTrim(row.shipToCountry),                        // AO (41)
      sanitizeTrim(row.endCustomerName),                      // AP (42)
      sanitizeTrim(row.endCustomerAddress1),                  // AQ (43)
      '',                                                     // AR (44)
      sanitizeTrim(row.endCustomerCity),                      // AS (45)
      sanitizeTrim(row.endCustomerStateProvinceCountyRegion), // AT (46)
      '',                                                     // AU (47)
      sanitizeTrim(row.endCustomerCountry),                   // AV (48)
    ]);

    dataRow.height = 20;

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };

      // Columna 9 (I): Cantidad (Entero)
      if (colNumber === 9) {
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Columna 10 (J) y 11 (K): Precios (Float 0.00)
      else if (colNumber === 10 || colNumber === 11) {
        cell.numFmt = '0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      // Columna 3 (SO), 12 (Deal ID), 18 (PO): Si son números, formatear como entero '0'
      else if ((colNumber === 3 || colNumber === 12 || colNumber === 18) && typeof cell.value === 'number') {
        cell.numFmt = '0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Fechas y Códigos centrados
      else if ([1, 2, 4, 12, 13, 17, 19, 21, 27, 34, 41, 48].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // 3. Configuración de anchos de columna para las 48 columnas
  // Columnas vacías reducidas a width: 5 para optimizar espacio visual
  worksheet.columns = [
    { width: 14 }, // A: Status
    { width: 22 }, // B: Distributor to Reseller Sales Order Date
    { width: 28 }, // C: Distributor Sales Order Number
    { width: 28 }, // D: SO Line Number (Order Line Item Number)
    { width: 26 }, // E: Cisco Standard Part Number
    { width: 5 },  // F: Start Date (Vacía reducida)
    { width: 5 },  // G: End Date (Vacía reducida)
    { width: 5 },  // H: Duration (Vacía reducida)
    { width: 18 }, // I: Product Quantity
    { width: 32 }, // J: Reported Product Unit Price - Reported Currency
    { width: 22 }, // K: Reported Net Price
    { width: 18 }, // L: Deal ID
    { width: 20 }, // M: Magic Key
    { width: 5 },  // N: Promotion Authorization Number (Vacía reducida)
    { width: 5 },  // O: Disti PO to Cisco (Vacía reducida)
    { width: 5 },  // P: Service Quote Number (Vacía reducida)
    { width: 14 }, // Q: Drop Ship
    { width: 28 }, // R: Reseller to Distributor PO Number
    { width: 22 }, // S: Customer Requested Ship Date
    { width: 28 }, // T: Buyer/Reseller Name
    { width: 28 }, // U: Buyer/Reseller Partner Identification
    { width: 22 }, // V: Buyer/Reseller Address1
    { width: 5 },  // W: Buyer/Reseller Address2 (Vacía reducida)
    { width: 18 }, // X: Buyer/Reseller City
    { width: 26 }, // Y: Buyer/Reseller State/Province/County/Region
    { width: 5 },  // Z: Buyer/Reseller Zip / Postal Code (Vacía reducida)
    { width: 16 }, // AA: Buyer/Reseller Country
    { width: 18, hidden: true }, // AB: Bill-To Name [OCULTA]
    { width: 18, hidden: true }, // AC: Bill-To Address1 [OCULTA]
    { width: 18, hidden: true }, // AD: Bill-To Address2 [OCULTA]
    { width: 16, hidden: true }, // AE: Bill-To City [OCULTA]
    { width: 18, hidden: true }, // AF: Bill-To State/Province/County/Region [OCULTA]
    { width: 16, hidden: true }, // AG: Bill-To Zip / Postal Code [OCULTA]
    { width: 16, hidden: true }, // AH: Bill-To Country [OCULTA]
    { width: 28 }, // AI: Ship-To Name
    { width: 22 }, // AJ: Ship-To Address1
    { width: 5 },  // AK: Ship-To Address2 (Vacía reducida)
    { width: 18 }, // AL: Ship-To City
    { width: 26 }, // AM: Ship-To State/Province/County/Region
    { width: 5 },  // AN: Ship-To Zip / Postal Code (Vacía reducida)
    { width: 16 }, // AO: Ship-To Country
    { width: 28 }, // AP: End Customer Name
    { width: 28 }, // AQ: End Customer Address1
    { width: 5 },  // AR: End Customer Address2 (Vacía reducida)
    { width: 18 }, // AS: End Customer City
    { width: 26 }, // AT: End Customer State/Province/County/Region
    { width: 5 },  // AU: End Customer Zip / Postal Code (Vacía reducida)
    { width: 16 }, // AV: End Customer Country
  ];

  // 4. Ocultar explícitamente las columnas Bill-To AB a AH (28 a 34)
  for (let c = 28; c <= 34; c++) {
    worksheet.getColumn(c).hidden = true;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = getFormattedDsvDate();
  const outFileName = customFilename || `DSV_Export_${dateStr}.xlsx`;

  return {
    buffer: buffer as ArrayBuffer,
    fileName: outFileName,
  };
}

/**
 * Sanitiza una cadena para incluirla de manera limpia en el nombre de archivo DSV
 */
export function sanitizeDsvFilenamePart(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/[\\/:*?"<>|.,;()]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Genera el nombre de archivo oficial estandarizado para la exportación DSV:
 * NumerodeDEAL_DSV_partner_clientefinal_fecha.xlsx
 */
export function generateDsvFilename(
  dealId?: string,
  partner?: string,
  client?: string,
  dateStr?: string
): string {
  const cleanDeal = (dealId || '').replace(/[^\w-]/g, '').trim() || 'DEAL';
  const cleanPartner = sanitizeDsvFilenamePart(partner || '') || 'Partner';
  const cleanClient = sanitizeDsvFilenamePart(client || '') || 'Cliente';
  const date = dateStr || getFormattedDsvDate();

  return `${cleanDeal}_DSV_${cleanPartner}_${cleanClient}_${date}.xlsx`;
}
