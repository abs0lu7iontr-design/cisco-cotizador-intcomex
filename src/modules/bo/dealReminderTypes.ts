// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL REMINDER & NOTIFIER TYPES
// Modelo de datos y utilidades para el seguimiento y recordatorio de DEALS Cisco
// Escalados a AM Cisco (Account Manager) o Velocity Hub (VF)
// ============================================================================

export type DealEscalationChannel = 'AM_CISCO' | 'VELOCITY_HUB';

export type DealReminderStatus =
  | 'PENDING_APPROVAL' // En espera de revisión / aprobación por Cisco
  | 'APPROVED'         // Aprobado con descuento / DART
  | 'REJECTED'         // Rechazado por Cisco
  | 'INFO_REQUIRED'    // Requiere información o justificación adicional
  | 'CONVERTED_TO_BO'; // Convertido a OC / Seguimiento BO

export type DealAgingHealth = 'ON_TIME' | 'NEEDS_FOLLOW_UP' | 'CRITICAL_OVERDUE';

export interface DealHistoryNote {
  id: string;
  date: string; // ISO 8601
  author: string;
  action: 'CREATED' | 'REMINDER_COPIED' | 'STATUS_CHANGED' | 'NOTE_ADDED' | 'CONVERTED_TO_BO';
  comment: string;
}

export interface DealReminderRecord {
  id: string;                         // ID único (ej: "DEAL-REM-8899201")
  dealId: string;                     // 1. Número o ID del Deal Cisco (ej: "DEAL-8899201" o "981245")
  partnerName: string;                // 2. Nombre del Partner / Canal (ej: "Sonda Chile")
  endCustomerName: string;            // 3. Nombre del Cliente Final (ej: "Banco Santander")
  escalationChannel: DealEscalationChannel; // 4. 'AM_CISCO' o 'VELOCITY_HUB'

  // Datos complementarios opcionales
  amContactName?: string;             // Nombre del AM asignado (si aplica)
  amContactEmail?: string;            // Correo del AM
  vfTicketNumber?: string;            // Número de caso o ticket VF (si aplica)
  targetDiscountPct?: number;         // Descuento solicitado (% ej. 68%)
  estimatedTotalUsd?: number;         // Monto estimado en USD
  estimateId?: string;                // Estimate asociado si existe (ej. "OE169047114NP")
  notes?: string;                     // Justificación o notas comerciales

  // Estado y Envejecimiento (Aging)
  status: DealReminderStatus;
  escalatedAt: string;                // Fecha/hora de escalamiento (ISO 8601)
  lastReminderSentAt?: string;        // Fecha/hora de última copia de recordatorio (ISO 8601)
  reminderCount: number;              // Número de recordatorios generados

  // Auditoría y Bitácora
  createdAt: string;                  // ISO 8601
  updatedAt: string;                  // ISO 8601
  createdBy?: string;                 // Usuario que registró el deal
  history: DealHistoryNote[];
  archived?: boolean;
}

/**
 * Metadatos para los canales de escalamiento
 */
export const DEAL_ESCALATION_METADATA: Record<
  DealEscalationChannel,
  {
    id: DealEscalationChannel;
    label: string;
    shortLabel: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    borderClass: string;
    iconName: string;
  }
> = {
  AM_CISCO: {
    id: 'AM_CISCO',
    label: 'AM Cisco (Account Manager)',
    shortLabel: 'AM Cisco',
    description: 'Escalado directamente al Account Manager de territorio/cuenta Cisco.',
    badgeBg: 'bg-indigo-950/80',
    badgeText: 'text-indigo-300',
    borderClass: 'border-indigo-700/60',
    iconName: 'UserCheck',
  },
  VELOCITY_HUB: {
    id: 'VELOCITY_HUB',
    label: 'VF (Velocity Hub Cisco)',
    shortLabel: 'Velocity Hub (VF)',
    description: 'Escalado vía portal Cisco Velocity Hub para aprobación comercial express.',
    badgeBg: 'bg-cyan-950/80',
    badgeText: 'text-cyan-300',
    borderClass: 'border-cyan-700/60',
    iconName: 'Zap',
  },
};

/**
 * Metadatos de estados de Deals
 */
export const DEAL_STATUS_METADATA: Record<
  DealReminderStatus,
  {
    id: DealReminderStatus;
    label: string;
    badgeClass: string;
    color: string;
  }
> = {
  PENDING_APPROVAL: {
    id: 'PENDING_APPROVAL',
    label: 'En Espera de Aprobación',
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-700/50',
    color: 'amber',
  },
  APPROVED: {
    id: 'APPROVED',
    label: 'Aprobado por Cisco',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
    color: 'emerald',
  },
  INFO_REQUIRED: {
    id: 'INFO_REQUIRED',
    label: 'Requiere Información / Justificación',
    badgeClass: 'bg-sky-950/70 text-sky-300 border-sky-700/50',
    color: 'sky',
  },
  REJECTED: {
    id: 'REJECTED',
    label: 'Rechazado por Cisco',
    badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-700/50',
    color: 'rose',
  },
  CONVERTED_TO_BO: {
    id: 'CONVERTED_TO_BO',
    label: 'OC Recibida (En Tracking BO)',
    badgeClass: 'bg-purple-950/70 text-purple-300 border-purple-700/50',
    color: 'purple',
  },
};

/**
 * Calcula el tiempo transcurrido (Aging) y determina la salud del recordatorio
 * Reglas de negocio:
 * - < 24 horas: 'ON_TIME' (Verde)
 * - 24 a 48 horas: 'NEEDS_FOLLOW_UP' (Amarillo - Se sugiere enviar primer recordatorio)
 * - > 48 horas: 'CRITICAL_OVERDUE' (Rojo - Deal demorado, requiere escalamiento urgente)
 */
export function calculateDealAging(
  deal: DealReminderRecord,
  now: Date = new Date()
): {
  health: DealAgingHealth;
  elapsedHours: number;
  elapsedDays: number;
  label: string;
  badgeClass: string;
  isOverdue: boolean;
} {
  // Si ya fue aprobado, rechazado o convertido a BO, no está vencido
  if (deal.status !== 'PENDING_APPROVAL' && deal.status !== 'INFO_REQUIRED') {
    return {
      health: 'ON_TIME',
      elapsedHours: 0,
      elapsedDays: 0,
      label: DEAL_STATUS_METADATA[deal.status].label,
      badgeClass: DEAL_STATUS_METADATA[deal.status].badgeClass,
      isOverdue: false,
    };
  }

  const escalatedDate = new Date(deal.escalatedAt || deal.createdAt);
  const diffMs = Math.max(0, now.getTime() - escalatedDate.getTime());
  const elapsedHours = Math.floor(diffMs / (1000 * 60 * 60));
  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedHours < 24) {
    return {
      health: 'ON_TIME',
      elapsedHours,
      elapsedDays,
      label: elapsedHours === 0 ? 'Escalado recién' : `Escalado hace ${elapsedHours}h`,
      badgeClass: 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40',
      isOverdue: false,
    };
  }

  if (elapsedHours <= 48) {
    return {
      health: 'NEEDS_FOLLOW_UP',
      elapsedHours,
      elapsedDays,
      label: `Requiere Seguimiento (${elapsedHours}h sin respuesta)`,
      badgeClass: 'bg-amber-950/70 text-amber-300 border border-amber-700/50',
      isOverdue: true,
    };
  }

  return {
    health: 'CRITICAL_OVERDUE',
    elapsedHours,
    elapsedDays,
    label: `Demorado (${elapsedDays} días sin respuesta)`,
    badgeClass: 'bg-rose-950/80 text-rose-300 border border-rose-700/60 animate-pulse',
    isOverdue: true,
  };
}
