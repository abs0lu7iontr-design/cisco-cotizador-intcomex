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

  // Control de Pop-ups y Posponer (Snooze)
  snoozedUntil?: string;              // Fecha/hora hasta cuando se pospuso el recordatorio (ISO 8601)
  lastPopupDismissedAt?: string;      // Última vez que se cerró/pospuso el popup (ISO 8601)
  notificationEmail?: string;         // Correo para recordatorios offline (default 'mauricio.skill@intcomex.com')
  discountsApprovedAt?: string;       // Cuándo se confirmaron los descuentos (para parar pop-ups)

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

export type PopupReminderSlot = 'midday' | 'end_of_day' | 'overdue';

export interface DealPopupDueInfo {
  isDue: boolean;
  slot: PopupReminderSlot;
  slotTitle: string;
  slotBadge: string;
  reason: string;
  suggestedSnoozeDate: Date;
}

/**
 * Calcula la fecha sugerida para posponer (Snooze)
 * - Si es antes de las 17:30: pospone para las 17:30 de hoy
 * - Si es fin de jornada (>= 17:30): pospone para las 12:00 del día siguiente (o lunes si es viernes)
 */
export function calculateNextSnoozeDate(slot: PopupReminderSlot, now: Date = new Date()): Date {
  const next = new Date(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeDec = currentHour + currentMinute / 60;

  if (currentTimeDec < 17.5) {
    // Hoy a las 17:30
    next.setHours(17, 30, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setTime(now.getTime() + 2 * 3600 * 1000);
    }
    return next;
  }

  // Mañana a las 12:00 (avanza fin de semana a lunes)
  next.setDate(next.getDate() + 1);
  if (next.getDay() === 6) {
    next.setDate(next.getDate() + 2); // Sábado -> Lunes
  } else if (next.getDay() === 0) {
    next.setDate(next.getDate() + 1); // Domingo -> Lunes
  }
  next.setHours(12, 0, 0, 0);
  return next;
}

/**
 * Evalúa si un Deal requiere disparar un Pop-up proactivo en Cisco Automated
 * Requisitos del usuario:
 * 1. "al otro dia como a medio dia me recuerde que revise si se aprobaron los descuentos"
 * 2. "luego a fin de la jornada como a las 17:30"
 * 3. "en el pop up debe decir recordar mas tarde en caso de de apretar la x tambien se recordara"
 * 4. "en el caso que si se enviaron los descuento parar los pop up"
 */
export function checkDealPopupDue(deal: DealReminderRecord, now: Date = new Date()): DealPopupDueInfo {
  // 1. Si los descuentos ya fueron aprobados, rechazados o convertidos a BO -> DETENER POP-UPS
  if (
    deal.status === 'APPROVED' ||
    deal.status === 'REJECTED' ||
    deal.status === 'CONVERTED_TO_BO' ||
    Boolean(deal.discountsApprovedAt)
  ) {
    return {
      isDue: false,
      slot: 'midday',
      slotTitle: 'Descuentos Resueltos',
      slotBadge: 'bg-emerald-950 text-emerald-300',
      reason: 'Los descuentos ya fueron aprobados o resueltos. Pop-ups detenidos permanentemente.',
      suggestedSnoozeDate: new Date(now.getTime() + 24 * 3600 * 1000),
    };
  }

  // 2. Si el Deal está pospuesto (snooze activo) -> NO mostrar pop-up aún
  if (deal.snoozedUntil) {
    const snoozeDate = new Date(deal.snoozedUntil);
    if (!isNaN(snoozeDate.getTime()) && snoozeDate.getTime() > now.getTime()) {
      return {
        isDue: false,
        slot: 'midday',
        slotTitle: 'Pospuesto',
        slotBadge: 'bg-slate-800 text-slate-400',
        reason: `Pospuesto hasta ${snoozeDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}.`,
        suggestedSnoozeDate: snoozeDate,
      };
    }
  }

  // 3. Evaluar tiempo transcurrido desde el escalamiento:
  const escalatedDate = new Date(deal.escalatedAt || deal.createdAt);
  const diffHours = (now.getTime() - escalatedDate.getTime()) / (1000 * 60 * 60);

  // Consideramos "al otro día" si han pasado >= 14 horas o si es un día calendario posterior
  const isEscalatedPastDay =
    now.getDate() !== escalatedDate.getDate() ||
    now.getMonth() !== escalatedDate.getMonth() ||
    diffHours >= 14;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeDec = currentHour + currentMinute / 60;

  // Si no ha pasado suficiente tiempo (ej. escalado hace 2 horas hoy en la mañana),
  // no alertar hasta que llegue a las 17:30 o al día siguiente
  if (!isEscalatedPastDay && diffHours < 6 && currentTimeDec < 17.5) {
    return {
      isDue: false,
      slot: 'midday',
      slotTitle: 'En espera normal',
      slotBadge: 'bg-slate-800 text-slate-400',
      reason: 'Deal escalado recientemente en el día.',
      suggestedSnoozeDate: calculateNextSnoozeDate('midday', now),
    };
  }

  // 4. Identificar el slot correspondiente:
  // Slot Fin de Jornada: >= 17:30
  if (currentTimeDec >= 17.5) {
    return {
      isDue: true,
      slot: 'end_of_day',
      slotTitle: 'Fin de Jornada (17:30)',
      slotBadge: 'bg-purple-950/80 text-purple-300 border border-purple-700/50',
      reason: 'Revisar si se aprobaron los descuentos antes del cierre de operaciones.',
      suggestedSnoozeDate: calculateNextSnoozeDate('end_of_day', now),
    };
  }

  // Slot Medio Día: >= 12:00 y < 17:30
  if (currentTimeDec >= 12.0) {
    return {
      isDue: true,
      slot: 'midday',
      slotTitle: 'Medio Día (12:00)',
      slotBadge: 'bg-amber-950/80 text-amber-300 border border-amber-700/50',
      reason: 'Revisar si AM Cisco o Velocity Hub aprobaron los descuentos solicitados.',
      suggestedSnoozeDate: calculateNextSnoozeDate('midday', now),
    };
  }

  // Si son antes de las 12:00 pero ya lleva > 24 horas esperando:
  if (diffHours >= 24) {
    return {
      isDue: true,
      slot: 'overdue',
      slotTitle: 'Seguimiento Pendiente (> 24h)',
      slotBadge: 'bg-rose-950/80 text-rose-300 border border-rose-700/50',
      reason: 'El Deal lleva más de 24 horas esperando resolución de descuentos.',
      suggestedSnoozeDate: calculateNextSnoozeDate('midday', now),
    };
  }

  return {
    isDue: false,
    slot: 'midday',
    slotTitle: 'Esperando slot de medio día',
    slotBadge: 'bg-slate-800 text-slate-400',
    reason: 'Próxima alerta a las 12:00.',
    suggestedSnoozeDate: calculateNextSnoozeDate('midday', now),
  };
}
