// ============================================================================
// CISCO AUTOMATED v2.1 - BACK ORDER (BO) ORDER TRACKING & FULFILLMENT TYPES
// Modelo de datos y utilidades para el ciclo de vida logístico de órdenes Cisco
// ============================================================================

export type BoStage =
  | 'OC_RECEIVED'          // 1. OC Recibida de Cliente / Reseller
  | 'CISCO_SO_BOOKED'      // 2. Sales Order (SO) oficial confirmada en Cisco CCW
  | 'IN_PRODUCTION'        // 3. En fabricación / ensamble en planta Cisco
  | 'SHIPPED_COURIER'      // 4. Despachado por Cisco vía Courier (FedEx/UPS/DHL)
  | 'MIAMI_FORWARDER'      // 5. Arribo y consolidación en Freight Forwarder Miami
  | 'CUSTOMS_CLEARANCE'    // 6. Tránsito aéreo internacional y Aduana Chile
  | 'INTCOMEX_WAREHOUSE'   // 7. Recepción física en Bodega Intcomex ENEA Santiago
  | 'DELIVERED';           // 8. Facturado y entregado formalmente al Partner

export type CourierProvider = 'FedEx' | 'UPS' | 'DHL' | 'Otro';

export interface BoDailyNote {
  id: string;
  date: string;            // ISO timestamp
  author: string;          // Nombre de usuario / PM
  stage: BoStage;          // Etapa en que se registró la nota
  comment: string;
}

export interface BoOrderTrackingRecord {
  id: string;                      // ID único (ej: "BO-OC9812-OE169047114NP")
  estimateId: string;              // "OE169047114NP"
  estimateVersionTag: string;      // "v1", "v2", etc.
  dealId: string;                  // "DEAL-998877"
  partnerName: string;             // "Sonda Chile", "Telefónica Tech", etc.
  endCustomerName: string;         // "Banco Santander"
  clientPoNumber: string;          // "OC-889922" (Orden de compra de cliente)
  ciscoSoNumber?: string;          // "SO-1298457" (Sales Order de Cisco)
  
  // Courier y Seguimiento
  courier: CourierProvider;
  courierTrackingNumber?: string;  // ej. "771234567890" (FedEx tracking)
  courierTrackingUrl?: string;     // URL generada para tracking en 1 clic
  
  // Etapa Actual y Fechas Clave
  currentStage: BoStage;
  estimatedShipDate?: string;      // ESD de Cisco (YYYY-MM-DD)
  estimatedArrivalDate?: string;   // Fecha estimada en Chile (YYYY-MM-DD)
  actualDeliveryDate?: string;     // Fecha real de entrega (YYYY-MM-DD)
  createdAt: string;               // ISO timestamp creación
  updatedAt: string;               // ISO timestamp última modificación
  lastDailyReviewAt?: string;      // ISO timestamp de última nota/revisión diaria
  
  // Resumen Financiero Vinculado
  totalSaleUsd: number;            // Total venta con margen
  grossProfitUsd: number;          // Margen bruto en USD
  marginPct?: number;              // Porcentaje de margen aplicado
  internacionUsd?: number;         // Costo de internación calculado
  arancelUsd?: number;             // Costo de arancel calculado
  itemsCount: number;              // Número total de ítems / equipos
  bodegaDestino?: 'E1' | 'ED';     // Bodega principal asignada (E1 Hardware / ED Intangibles)
  
  // Bitácora y Notas
  notes: BoDailyNote[];
  archived?: boolean;              // Si está completada o archivada
}

/**
 * Definición estructurada de cada etapa del ciclo de vida
 */
export interface BoStageMetadata {
  id: BoStage;
  stepNumber: number;
  title: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
}

export const BO_STAGES_METADATA: Record<BoStage, BoStageMetadata> = {
  OC_RECEIVED: {
    id: 'OC_RECEIVED',
    stepNumber: 1,
    title: 'OC Recibida del Cliente',
    shortLabel: 'OC Recibida',
    description: 'El cliente formalizó la compra mediante Orden de Compra.',
    colorClass: 'text-indigo-400',
    bgClass: 'bg-indigo-950/30',
    borderClass: 'border-indigo-800/40',
    badgeBg: 'bg-indigo-950/80',
    badgeText: 'text-indigo-300 border-indigo-700/50',
  },
  CISCO_SO_BOOKED: {
    id: 'CISCO_SO_BOOKED',
    stepNumber: 2,
    title: 'Sales Order Cisco Registrada',
    shortLabel: 'SO Cisco',
    description: 'Orden de venta CCW confirmada con número de SO asignado.',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-950/30',
    borderClass: 'border-blue-800/40',
    badgeBg: 'bg-blue-950/80',
    badgeText: 'text-blue-300 border-blue-700/50',
  },
  IN_PRODUCTION: {
    id: 'IN_PRODUCTION',
    stepNumber: 3,
    title: 'En Fábrica Cisco (Ensamble)',
    shortLabel: 'En Fábrica',
    description: 'Equipos en proceso de manufactura con fecha ESD programada.',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-950/30',
    borderClass: 'border-amber-800/40',
    badgeBg: 'bg-amber-950/80',
    badgeText: 'text-amber-300 border-amber-700/50',
  },
  SHIPPED_COURIER: {
    id: 'SHIPPED_COURIER',
    stepNumber: 4,
    title: 'Despachado por Cisco (Courier)',
    shortLabel: 'En Courier / FedEx',
    description: 'Carga despachada de fábrica en tránsito con número de guía.',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-950/30',
    borderClass: 'border-purple-800/40',
    badgeBg: 'bg-purple-950/80',
    badgeText: 'text-purple-300 border-purple-700/50',
  },
  MIAMI_FORWARDER: {
    id: 'MIAMI_FORWARDER',
    stepNumber: 5,
    title: 'Arribo a Forwarder Miami',
    shortLabel: 'Hub Miami',
    description: 'Carga recibida en casillero Miami lista para vuelo a Chile.',
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-950/30',
    borderClass: 'border-cyan-800/40',
    badgeBg: 'bg-cyan-950/80',
    badgeText: 'text-cyan-300 border-cyan-700/50',
  },
  CUSTOMS_CLEARANCE: {
    id: 'CUSTOMS_CLEARANCE',
    stepNumber: 6,
    title: 'Vuelo y Trámite Aduana Chile',
    shortLabel: 'Aduana Chile',
    description: 'Proceso de internación, aranceles y desaduanamiento en SCL.',
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-950/30',
    borderClass: 'border-orange-800/40',
    badgeBg: 'bg-orange-950/80',
    badgeText: 'text-orange-300 border-orange-700/50',
  },
  INTCOMEX_WAREHOUSE: {
    id: 'INTCOMEX_WAREHOUSE',
    stepNumber: 7,
    title: 'Recepción Bodega Intcomex',
    shortLabel: 'Bodega ENEA',
    description: 'Equipos disponibles en bodega Santiago para entrega al Partner.',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-950/30',
    borderClass: 'border-emerald-800/40',
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300 border-emerald-700/50',
  },
  DELIVERED: {
    id: 'DELIVERED',
    stepNumber: 8,
    title: 'Entregado al Partner / Cerrado',
    shortLabel: 'Entregado',
    description: 'Orden culminada con éxito, facturada y recepcionada.',
    colorClass: 'text-slate-400',
    bgClass: 'bg-slate-900/40',
    borderClass: 'border-slate-700/40',
    badgeBg: 'bg-slate-800',
    badgeText: 'text-slate-300 border-slate-600',
  },
};

export const ORDERED_BO_STAGES: BoStage[] = [
  'OC_RECEIVED',
  'CISCO_SO_BOOKED',
  'IN_PRODUCTION',
  'SHIPPED_COURIER',
  'MIAMI_FORWARDER',
  'CUSTOMS_CLEARANCE',
  'INTCOMEX_WAREHOUSE',
  'DELIVERED',
];

/**
 * Genera la URL de seguimiento oficial según el transportista ingresado
 */
export function getCourierTrackingUrl(courier: CourierProvider, trackingNumber?: string): string {
  const trk = (trackingNumber || '').trim();
  if (!trk) return '';

  switch (courier) {
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trk)}`;
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trk)}`;
    case 'DHL':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trk)}&brand=DHL`;
    default:
      return trk.startsWith('http') ? trk : `https://www.google.com/search?q=${encodeURIComponent(trk + ' tracking')}`;
  }
}

export type OrderHealthStatus = 'up_to_date' | 'needs_review' | 'delayed';

/**
 * Determina el estado de atención sanitaria de una orden:
 * - 'delayed' (Rojo): Si la fecha estimada de embarque (ESD) ya expiró y no está en courier/Miami.
 * - 'needs_review' (Amarillo): Si pasaron más de 24 horas hábiles sin actualización de notas.
 * - 'up_to_date' (Verde): Al día.
 */
export function getOrderHealthStatus(order: BoOrderTrackingRecord, now: Date = new Date()): {
  status: OrderHealthStatus;
  label: string;
  badgeClass: string;
} {
  if (order.currentStage === 'DELIVERED') {
    return {
      status: 'up_to_date',
      label: 'Completado',
      badgeClass: 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40',
    };
  }

  // Verificar si la fecha de embarque estimada ya venció
  if (
    order.estimatedShipDate &&
    (order.currentStage === 'OC_RECEIVED' ||
      order.currentStage === 'CISCO_SO_BOOKED' ||
      order.currentStage === 'IN_PRODUCTION')
  ) {
    const esd = new Date(order.estimatedShipDate);
    if (!isNaN(esd.getTime()) && esd.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      return {
        status: 'delayed',
        label: 'ESD Vencida',
        badgeClass: 'bg-rose-950/70 text-rose-300 border border-rose-700/60 animate-pulse',
      };
    }
  }

  // Verificar si necesita revisión diaria (> 24 horas sin actualización de bitácora)
  const lastUpdateStr = order.lastDailyReviewAt || order.updatedAt || order.createdAt;
  const lastUpdate = new Date(lastUpdateStr);
  const hoursSinceLastReview = !isNaN(lastUpdate.getTime())
    ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)
    : 0;

  if (hoursSinceLastReview > 24) {
    return {
      status: 'needs_review',
      label: 'Actualización Requerida',
      badgeClass: 'bg-amber-950/70 text-amber-300 border border-amber-700/50',
    };
  }

  return {
    status: 'up_to_date',
    label: 'Al Día',
    badgeClass: 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/40',
  };
}
