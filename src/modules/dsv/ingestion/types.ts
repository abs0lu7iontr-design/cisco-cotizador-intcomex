// ============================================================================
// CISCO AUTOMATED v2.1 - DSV INGESTION TYPES & DOMAIN INTERFACES
// ============================================================================

export interface ExtractedAddress {
  street: string;
  city: string;
  country: string;
}

export interface CiscoSourceData {
  dealId: string;
  fileName: string;
  lastModified: number; // Timestamp en ms
  address?: ExtractedAddress;
  bomFile?: {
    fileName: string;
    fileBuffer: ArrayBuffer;
    lastModified: number;
  };
}

export interface JorgeSourceData {
  dealId: string;
  fileName: string;
  lastModified: number; // Timestamp en ms
  poNumber: string;     // Exactamente 6 dígitos
  soNumber: string;     // Exactamente 9 dígitos
}

export type ConsolidationStatus = 
  | 'READY'               // BOM + Dirección + PO + SO vinculados por el mismo Deal ID
  | 'PENDING_JORGE'       // Falta PO/SO de la carpeta Jorge
  | 'PENDING_CISCO_BOM'   // Falta el BOM .xls de Cisco
  | 'PENDING_ADDRESS'     // Falta la dirección del cliente final
  | 'INVALID_FORMAT';     // PO/SO o Deal ID no cumplen longitud exacta

export interface ConsolidatedDealRecord {
  dealId: string;
  status: ConsolidationStatus;
  lastUpdated: string; // ISO String del archivo más reciente
  cisco?: CiscoSourceData;
  jorge?: JorgeSourceData;
  validationErrors: string[];
}
