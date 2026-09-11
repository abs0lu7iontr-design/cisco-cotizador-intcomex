// ============================================================================
// CISCO AUTOMATED - DSV MODULE TYPES (48 COLUMNS OFFICIAL DSV SCHEMA)
// ============================================================================

export type SkuCategoryType = 'hardware' | 'subscription' | 'service';

export interface DsvModalFormData {
  so: string;                 // Col C: Distributor Sales Order Number (9 numeric digits)
  po: string;                 // Col R: Reseller to Distributor PO Number (6 numeric digits)
  dealId: string;             // Col L: Deal ID (8 numeric digits)
  partnerId: string;          // Col U: Buyer/Reseller Partner Identification
  endCustomerAddress: string; // Col AQ: End Customer Address1
  partnerName?: string;       // Col T: Buyer/Reseller Name (Auto-detectado del BOM)
  endCustomerName?: string;   // Col AP: End Customer Name (Auto-detectado del BOM)
}

export interface Dsv48LineItem {
  status: string;                               // Col A (1): "NEW"
  distributorToResellerSalesOrderDate: string;  // Col B (2): DD-MMM-YYYY
  distributorSalesOrderNumber: string;          // Col C (3): Manual SO (9 digits)
  soLineNum: string;                            // Col D (4): BOM Col F (LINE#)
  ciscoStandardPartNumber: string;              // Col E (5): BOM Col H (CISCO SKU)
  startDate: string;                            // Col F (6): ""
  endDate: string;                              // Col G (7): ""
  duration: string;                             // Col H (8): ""
  productQuantity: number;                      // Col I (9): BOM Col J (QUANTITY)
  reportedProductUnitPrice: number;             // Col J (10): Calculado
  reportedNetPrice: number;                     // Col K (11): Calculado
  dealId: string;                               // Col L (12): Manual/BOM Col A (8 digits)
  magicKey: string;                             // Col M (13): BOM Col G (MAGIC KEY)
  promotionAuthorizationNumber: string;         // Col N (14): ""
  distiPoToCisco: string;                       // Col O (15): ""
  serviceQuoteNumber: string;                   // Col P (16): ""
  dropShip: string;                             // Col Q (17): "N"
  resellerToDistributorPoNumber: string;        // Col R (18): Manual PO (6 digits)
  customerRequestedShipDate: string;            // Col S (19): DD-MMM-YYYY
  buyerResellerName: string;                    // Col T (20): BOM Col C (RESELLER NAME)
  buyerResellerPartnerIdentification: string;   // Col U (21): Manual Partner ID
  buyerResellerAddress1: string;                // Col V (22): "Chile"
  buyerResellerAddress2: string;                // Col W (23): ""
  buyerResellerCity: string;                    // Col X (24): "Chile"
  buyerResellerStateProvinceCountyRegion: string;// Col Y (25): "Chile"
  buyerResellerZipPostalCode: string;           // Col Z (26): ""
  buyerResellerCountry: string;                 // Col AA (27): "CL"
  billToName: string;                           // Col AB (28): "" [HIDDEN]
  billToAddress1: string;                       // Col AC (29): "" [HIDDEN]
  billToAddress2: string;                       // Col AD (30): "" [HIDDEN]
  billToCity: string;                           // Col AE (31): "" [HIDDEN]
  billToStateProvinceCountyRegion: string;      // Col AF (32): "" [HIDDEN]
  billToZipPostalCode: string;                  // Col AG (33): "" [HIDDEN]
  billToCountry: string;                        // Col AH (34): "" [HIDDEN]
  shipToName: string;                           // Col AI (35): BOM Col C (RESELLER NAME / Partner - Igual a Col T)
  shipToAddress1: string;                       // Col AJ (36): "Chile"
  shipToAddress2: string;                       // Col AK (37): ""
  shipToCity: string;                           // Col AL (38): "Chile"
  shipToStateProvinceCountyRegion: string;      // Col AM (39): "Chile"
  shipToZipPostalCode: string;                  // Col AN (40): ""
  shipToCountry: string;                        // Col AO (41): "CL"
  endCustomerName: string;                      // Col AP (42): BOM Col E (ENDUSER NAME)
  endCustomerAddress1: string;                  // Col AQ (43): Manual End Customer Address
  endCustomerAddress2: string;                  // Col AR (44): ""
  endCustomerCity: string;                      // Col AS (45): "Chile"
  endCustomerStateProvinceCountyRegion: string; // Col AT (46): "Chile"
  endCustomerZipPostalCode: string;             // Col AU (47): ""
  endCustomerCountry: string;                   // Col AV (48): "CL"

  // Metadata for UI and Calculation Engine
  originalListPrice: number;
  originalDistiDiscountPct: number;
  durationMonths: number;
  detectedType: SkuCategoryType;
  overrideType?: SkuCategoryType;
}

export interface DsvTransformationSummary {
  totalOriginalItems: number;
  validDsvItems: number;
  discardedZeroItems: number;
  rows: Dsv48LineItem[];
}
