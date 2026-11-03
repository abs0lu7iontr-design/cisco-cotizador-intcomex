// ============================================================================
// CISCO AUTOMATED v2.9 - FORECAST COMERCIAL TYPES (36 EXACT EXCEL COLUMNS)
// ============================================================================

export interface ForecastRecord {
  id: string; // e.g. "FC-0001"

  // --- 36 OFFICIAL INTCOMEX BUSINESS COLUMNS ---
  // Col 1
  fechaLevantamiento: string; // Fecha de Levantamiento
  // Col 2
  fechaCotizacion: string; // Fecha de Cotizacion
  // Col 3
  marca: string; // Marca (CISCO)
  // Col 4
  pmResponsable: string; // PM Responsable (Raul Cuevas, Marta Adasme, Johana Valencia, Mauricio Skill, Web)
  // Col 5
  partner: string; // Partner
  // Col 6
  ejecutivoPartner: string; // Ejecutivo Partner
  // Col 7
  endUser: string; // End User
  // Col 8
  usdIntcomex: number; // USD Intcomex
  // Col 9
  emailEjecutivoPartner: string; // e-mail ejecutivo partner
  // Col 10
  mesFacturacion: string; // Mes de Facturación
  // Col 11
  emailClienteFinal: string; // e-mail cliente final
  // Col 12
  detalleProductos: string; // Detalle Productos
  // Col 13
  oc: string; // OC (Orden de Compra Partner -> Intcomex)
  // Col 14
  deal: string; // Deal (# Registro Oportunidad Marca CCW)
  // Col 15
  productos: number; // Productos ($)
  // Col 16
  suscripciones: number; // Suscripciones ($)
  // Col 17
  servicios: number; // Servicios ($)
  // Col 18
  meraki: number; // Meraki ($)
  // Col 19
  am: string; // AM (Cisco Account Manager)
  // Col 20
  grupoVentas: string; // Grupo de Ventas (Enterprise, Top Volume, Grupo3)
  // Col 21
  observacion: string; // Obsevacion (RR, Adjudicado, etc.)
  // Col 22
  dsvSubmission: string; // DSV Sumission
  // Col 23
  po: string; // PO (Cisco Purchase Order)
  // Col 24
  so: string; // SO (Cisco Sales Order)
  // Col 25
  submittedDate: string; // Submitted Date
  // Col 26
  clienteCisco: string; // # Cliente (XCL / XCLN)
  // Col 27
  promotionAuthorizationNumber: string; // Promotion Authorization Number
  // Col 28
  endCustomerName: string; // End Customer Name
  // Col 29
  endCustomerAddress1: string; // End Customer Address1
  // Col 30
  numeroVenta: string; // Numero de Venta (NV Intcomex)
  // Col 31
  bodega: string; // Bodega (E1, ED, E1, ED)
  // Col 32
  caso: string; // Caso (Cisco TAC / Operations case)
  // Col 33
  priceProtectionExpiryDate: string; // Price Protection Expiry Date
  // Col 34
  credit: string; // Credit (Aprobado, En revisión de credito, Pdte, Omitir)
  // Col 35
  nuevoCaso: string; // Nuevo Caso
  // Col 36
  confirmacionCredito: string; // Confirmación Credito

  // Internal Audit & Cross-Module Traceability
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isSeed?: boolean;
  sourceEstimateId?: string;
  sourceBoTrackingId?: string;
  sourceDsvId?: string;
  sourcePipelineId?: string;
}

export interface ForecastColumnDef {
  key: keyof ForecastRecord;
  colIndex: number;
  label: string;
  category: 'COMERCIAL' | 'PRODUCTOS' | 'CISCO_DSV' | 'OPERACIONES' | 'ALERTAS';
  minWidth: string;
  align: 'left' | 'center' | 'right';
  isMoney?: boolean;
  isDate?: boolean;
}

export const FORECAST_36_COLUMNS: ForecastColumnDef[] = [
  { key: 'fechaLevantamiento', colIndex: 1, label: 'Fecha de Levantamiento', category: 'COMERCIAL', minWidth: 'min-w-[130px]', align: 'center', isDate: true },
  { key: 'fechaCotizacion', colIndex: 2, label: 'Fecha de Cotizacion', category: 'COMERCIAL', minWidth: 'min-w-[130px]', align: 'center', isDate: true },
  { key: 'marca', colIndex: 3, label: 'Marca', category: 'COMERCIAL', minWidth: 'min-w-[100px]', align: 'center' },
  { key: 'pmResponsable', colIndex: 4, label: 'PM Responsable', category: 'COMERCIAL', minWidth: 'min-w-[150px]', align: 'left' },
  { key: 'partner', colIndex: 5, label: 'Partner', category: 'COMERCIAL', minWidth: 'min-w-[200px]', align: 'left' },
  { key: 'ejecutivoPartner', colIndex: 6, label: 'Ejecutivo Partner', category: 'COMERCIAL', minWidth: 'min-w-[160px]', align: 'left' },
  { key: 'endUser', colIndex: 7, label: 'End User', category: 'COMERCIAL', minWidth: 'min-w-[180px]', align: 'left' },
  { key: 'usdIntcomex', colIndex: 8, label: 'USD Intcomex', category: 'PRODUCTOS', minWidth: 'min-w-[130px]', align: 'right', isMoney: true },
  { key: 'emailEjecutivoPartner', colIndex: 9, label: 'e-mail ejecutivo partner', category: 'COMERCIAL', minWidth: 'min-w-[180px]', align: 'left' },
  { key: 'mesFacturacion', colIndex: 10, label: 'Mes de Facturación', category: 'OPERACIONES', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'emailClienteFinal', colIndex: 11, label: 'e-mail cliente final', category: 'COMERCIAL', minWidth: 'min-w-[180px]', align: 'left' },
  { key: 'detalleProductos', colIndex: 12, label: 'Detalle Productos', category: 'PRODUCTOS', minWidth: 'min-w-[220px]', align: 'left' },
  { key: 'oc', colIndex: 13, label: 'OC', category: 'OPERACIONES', minWidth: 'min-w-[110px]', align: 'center' },
  { key: 'deal', colIndex: 14, label: 'Deal', category: 'CISCO_DSV', minWidth: 'min-w-[150px]', align: 'center' },
  { key: 'productos', colIndex: 15, label: 'Productos', category: 'PRODUCTOS', minWidth: 'min-w-[120px]', align: 'right', isMoney: true },
  { key: 'suscripciones', colIndex: 16, label: 'Suscripciones', category: 'PRODUCTOS', minWidth: 'min-w-[120px]', align: 'right', isMoney: true },
  { key: 'servicios', colIndex: 17, label: 'Servicios', category: 'PRODUCTOS', minWidth: 'min-w-[120px]', align: 'right', isMoney: true },
  { key: 'meraki', colIndex: 18, label: 'Meraki', category: 'PRODUCTOS', minWidth: 'min-w-[120px]', align: 'right', isMoney: true },
  { key: 'am', colIndex: 19, label: 'AM', category: 'COMERCIAL', minWidth: 'min-w-[130px]', align: 'left' },
  { key: 'grupoVentas', colIndex: 20, label: 'Grupo de Ventas', category: 'COMERCIAL', minWidth: 'min-w-[140px]', align: 'center' },
  { key: 'observacion', colIndex: 21, label: 'Obsevacion', category: 'COMERCIAL', minWidth: 'min-w-[160px]', align: 'left' },
  { key: 'dsvSubmission', colIndex: 22, label: 'DSV Sumission', category: 'CISCO_DSV', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'po', colIndex: 23, label: 'PO', category: 'CISCO_DSV', minWidth: 'min-w-[110px]', align: 'center' },
  { key: 'so', colIndex: 24, label: 'SO', category: 'CISCO_DSV', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'submittedDate', colIndex: 25, label: 'Submitted Date', category: 'CISCO_DSV', minWidth: 'min-w-[130px]', align: 'center', isDate: true },
  { key: 'clienteCisco', colIndex: 26, label: '# Cliente', category: 'CISCO_DSV', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'promotionAuthorizationNumber', colIndex: 27, label: 'Promotion Authorization Number', category: 'CISCO_DSV', minWidth: 'min-w-[180px]', align: 'center' },
  { key: 'endCustomerName', colIndex: 28, label: 'End Customer Name', category: 'CISCO_DSV', minWidth: 'min-w-[180px]', align: 'left' },
  { key: 'endCustomerAddress1', colIndex: 29, label: 'End Customer Address1', category: 'CISCO_DSV', minWidth: 'min-w-[200px]', align: 'left' },
  { key: 'numeroVenta', colIndex: 30, label: 'Numero de Venta', category: 'OPERACIONES', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'bodega', colIndex: 31, label: 'Bodega', category: 'OPERACIONES', minWidth: 'min-w-[100px]', align: 'center' },
  { key: 'caso', colIndex: 32, label: 'Caso', category: 'ALERTAS', minWidth: 'min-w-[120px]', align: 'center' },
  { key: 'priceProtectionExpiryDate', colIndex: 33, label: 'Price Protection Expiry Date', category: 'ALERTAS', minWidth: 'min-w-[160px]', align: 'center', isDate: true },
  { key: 'credit', colIndex: 34, label: 'Credit', category: 'OPERACIONES', minWidth: 'min-w-[150px]', align: 'center' },
  { key: 'nuevoCaso', colIndex: 35, label: 'Nuevo Caso', category: 'ALERTAS', minWidth: 'min-w-[120px]', align: 'center' },
  { key: 'confirmacionCredito', colIndex: 36, label: 'Confirmación Credito', category: 'OPERACIONES', minWidth: 'min-w-[160px]', align: 'left' },
];

export type ReminderType = 'EXPIRY' | 'CREDIT' | 'CASE' | 'BILLING';
export type ReminderSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ForecastReminderItem {
  id: string;
  forecastId: string;
  dealId: string;
  partner: string;
  endUser: string;
  type: ReminderType;
  severity: ReminderSeverity;
  title: string;
  message: string;
  dueDate?: string;
  actionLabel?: string;
}

export interface ForecastStats {
  totalRecords: number;
  totalUsdIntcomex: number;
  totalProductos: number;
  totalSuscripciones: number;
  totalServicios: number;
  totalMeraki: number;
  recordsConSoCount: number;
  recordsBodegaE1Count: number;
  recordsBodegaEdCount: number;
  activeRemindersCount: number;
  criticalRemindersCount: number;
  creditPendingCount: number;
}

export interface ForecastFilterOptions {
  searchQuery?: string;
  pmResponsable?: string;
  bodega?: string;
  grupoVentas?: string;
  credit?: string;
  am?: string;
  onlyWithReminders?: boolean;
}

export const FORECAST_PM_LIST = [
  'Raul Cuevas',
  'Marta Adasme',
  'Johana Valencia',
  'Mauricio Skill',
  'Web',
] as const;

export const FORECAST_BODEGA_OPTIONS = [
  'E1',
  'ED',
  'E1, ED',
] as const;

export const FORECAST_CREDIT_STATUSES = [
  'Aprobado',
  'En revisión de credito',
  'Pdte',
  'Omitir',
] as const;
