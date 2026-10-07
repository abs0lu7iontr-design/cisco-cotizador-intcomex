// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL REMINDER & NOTIFIER TEST SUITE
// Verificación integral de modelos, envejecimiento, generación de correo
// y flujo operativo de Deals escalados a AM Cisco y Velocity Hub (VF)
// ============================================================================

import {
  DealReminderRecord,
  DealEscalationChannel,
  DealReminderStatus,
  calculateDealAging,
  DEAL_ESCALATION_METADATA,
  DEAL_STATUS_METADATA,
  checkDealPopupDue,
  calculateNextSnoozeDate,
} from '../src/modules/bo/dealReminderTypes';
import {
  generateDealReminderEmail,
  getDealTimeGreeting,
  copyDealReminderToClipboard,
} from '../src/modules/bo/dealEmailHelper';
import {
  getLocalDealRemindersCache,
  saveLocalDealRemindersCache,
  getDealReminders,
  saveDealReminder,
  updateDealReminderStatus,
  recordDealReminderSent,
  addDealHistoryNote,
  deleteDealReminder,
  createDealReminderFromEstimate,
  snoozeDealReminder,
  markDealDiscountsApproved,
} from '../src/modules/bo/dealReminderService';
import { ProcessedEstimateResult } from '../src/core/types';

function runTests() {
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DE RECORDADOR Y NOTIFICADOR DE DEALS (CISCO AUTOMATED v2.1)...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FALLÓ: ${msg}`);
      process.exit(1);
    }
    console.log(`✅ ${msg}`);
    passed++;
  }

  // --------------------------------------------------------------------------
  // TEST 1: Validación de los 4 Campos Esenciales y Estructura del Modelo
  // --------------------------------------------------------------------------
  console.log('--- 1. Validación de los 4 Campos Esenciales del Deal ---');
  const nowIso = new Date().toISOString();
  const sampleDealAm: DealReminderRecord = {
    id: 'DEAL-REM-1001',
    dealId: 'DEAL-9988221',
    partnerName: 'Sonda Chile',
    endCustomerName: 'Banco Santander',
    escalationChannel: 'AM_CISCO',
    amContactName: 'Rodrigo Alarcón',
    amContactEmail: 'ralarcon@cisco.com',
    targetDiscountPct: 68.0,
    estimatedTotalUsd: 85000.0,
    status: 'PENDING_APPROVAL',
    escalatedAt: nowIso,
    reminderCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: 'pm_cisco',
    history: [],
  };

  assert(Boolean(sampleDealAm.dealId), 'Campo 1 (Deal ID) presente');
  assert(Boolean(sampleDealAm.partnerName), 'Campo 2 (Partner) presente');
  assert(Boolean(sampleDealAm.endCustomerName), 'Campo 3 (Cliente Final) presente');
  assert(sampleDealAm.escalationChannel === 'AM_CISCO', 'Campo 4 (Canal Escalamiento: AM Cisco) válido');
  assert(DEAL_ESCALATION_METADATA.AM_CISCO.shortLabel === 'AM Cisco', 'Metadatos de AM Cisco configurados');
  assert(DEAL_ESCALATION_METADATA.VELOCITY_HUB.shortLabel === 'Velocity Hub (VF)', 'Metadatos de Velocity Hub configurados');

  // --------------------------------------------------------------------------
  // TEST 2: Cálculo de Envejecimiento (Aging & Semáforo de Recordatorio)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Cálculo de Envejecimiento y Semáforo de Seguimiento ---');
  const baseNow = new Date('2026-10-07T15:00:00Z');

  // Caso A: Escalado hace 6 horas (< 24h -> ON_TIME)
  const dealRecent: DealReminderRecord = {
    ...sampleDealAm,
    escalatedAt: new Date(baseNow.getTime() - 6 * 3600 * 1000).toISOString(),
  };
  const agingRecent = calculateDealAging(dealRecent, baseNow);
  assert(agingRecent.health === 'ON_TIME', 'Menos de 24h clasificado como ON_TIME');
  assert(!agingRecent.isOverdue, 'Menos de 24h no está vencido/overdue');
  assert(agingRecent.elapsedHours === 6, 'Horas transcurridas calculadas correctamente (6h)');

  // Caso B: Escalado hace 30 horas (24h a 48h -> NEEDS_FOLLOW_UP)
  const dealFollowUp: DealReminderRecord = {
    ...sampleDealAm,
    escalatedAt: new Date(baseNow.getTime() - 30 * 3600 * 1000).toISOString(),
  };
  const agingFollowUp = calculateDealAging(dealFollowUp, baseNow);
  assert(agingFollowUp.health === 'NEEDS_FOLLOW_UP', '30 horas clasificado como NEEDS_FOLLOW_UP (Requiere Seguimiento)');
  assert(agingFollowUp.isOverdue, '30 horas activa flag isOverdue');
  assert(agingFollowUp.elapsedDays === 1, 'Días transcurridos = 1');

  // Caso C: Escalado hace 72 horas (> 48h -> CRITICAL_OVERDUE)
  const dealOverdue: DealReminderRecord = {
    ...sampleDealAm,
    escalatedAt: new Date(baseNow.getTime() - 72 * 3600 * 1000).toISOString(),
  };
  const agingOverdue = calculateDealAging(dealOverdue, baseNow);
  assert(agingOverdue.health === 'CRITICAL_OVERDUE', '72 horas clasificado como CRITICAL_OVERDUE (Demorado > 48h)');
  assert(agingOverdue.isOverdue, '72 horas activa flag isOverdue');
  assert(agingOverdue.elapsedDays === 3, 'Días transcurridos = 3');

  // Caso D: Deal ya Aprobado (no debe alertar aunque pasen 100h)
  const dealApproved: DealReminderRecord = {
    ...sampleDealAm,
    status: 'APPROVED',
    escalatedAt: new Date(baseNow.getTime() - 100 * 3600 * 1000).toISOString(),
  };
  const agingApproved = calculateDealAging(dealApproved, baseNow);
  assert(agingApproved.health === 'ON_TIME', 'Deal aprobado no genera alerta de vencimiento');
  assert(!agingApproved.isOverdue, 'Deal aprobado no está vencido');

  // --------------------------------------------------------------------------
  // TEST 3: Generador de Correo Outlook HTML y Saludo Dinámico
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Generador de Correo y Saludo Dinámico por Horario ---');

  // Saludo en la mañana (09:00)
  const morningDate = new Date('2026-10-07T09:30:00');
  const morningGreeting = getDealTimeGreeting(morningDate);
  assert(morningGreeting === 'Buenos días', 'Saludo matutino verificado: Buenos días');

  // Saludo en la tarde (15:00)
  const afternoonDate = new Date('2026-10-07T15:30:00');
  const afternoonGreeting = getDealTimeGreeting(afternoonDate);
  assert(afternoonGreeting === 'Buenas tardes', 'Saludo vespertino verificado: Buenas tardes');

  // Plantilla para AM Cisco
  const emailAm = generateDealReminderEmail(sampleDealAm, afternoonDate);
  assert(emailAm.greeting === 'Buenas tardes', 'Email AM contiene saludo correcto');
  assert(emailAm.recipientLabel.includes('Rodrigo Alarcón'), 'Email AM incluye nombre del AM');
  assert(emailAm.subject.includes(sampleDealAm.dealId), 'Asunto contiene Deal ID');
  assert(emailAm.subject.includes('AM Cisco'), 'Asunto indica AM Cisco');
  assert(emailAm.htmlContent.includes('FICHA DE SEGUIMIENTO DE DEAL CISCO'), 'HTML contiene encabezado corporativo');
  assert(emailAm.htmlContent.includes(sampleDealAm.partnerName), 'HTML contiene nombre del partner');
  assert(emailAm.htmlContent.includes(sampleDealAm.endCustomerName), 'HTML contiene nombre del cliente final');
  assert(emailAm.htmlContent.includes('style='), 'HTML cuenta con estilos inline para compatibilidad Outlook');

  // Plantilla para Cisco Velocity Hub (VF)
  const sampleDealVf: DealReminderRecord = {
    ...sampleDealAm,
    id: 'DEAL-REM-1002',
    dealId: 'DEAL-5544332',
    escalationChannel: 'VELOCITY_HUB',
    vfTicketNumber: 'VF-998811',
  };
  const emailVf = generateDealReminderEmail(sampleDealVf, morningDate);
  assert(emailVf.greeting === 'Buenos días', 'Email VF contiene saludo Buenos días');
  assert(emailVf.recipientLabel.includes('Velocity Hub'), 'Email VF dirigido al Equipo Cisco Velocity Hub');
  assert(emailVf.subject.includes('VF Velocity Hub'), 'Asunto indica VF Velocity Hub');
  assert(emailVf.htmlContent.includes('VF-998811'), 'HTML contiene número de caso VF');

  // --------------------------------------------------------------------------
  // TEST 4: Servicio y Operaciones CRUD en Memoria / Cache
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Servicio DealReminderService & Flujo Operativo ---');

  // Guardar y recuperar
  saveLocalDealRemindersCache([sampleDealAm, sampleDealVf]);
  const cached = getLocalDealRemindersCache();
  assert(cached.length === 2, 'Caché local almacena 2 deals');

  // Actualizar estado a Aprobado
  saveLocalDealRemindersCache([sampleDealAm]);
  updateDealReminderStatus(sampleDealAm.id, 'APPROVED', 'operaciones', 'Aprobado en CCW por Cisco');
  const updatedAfterStatus = getLocalDealRemindersCache().find((d) => d.id === sampleDealAm.id);
  assert(updatedAfterStatus?.status === 'APPROVED', 'Estado actualizado a APPROVED');
  assert((updatedAfterStatus?.history?.length || 0) >= 1, 'Nota registrada en bitácora de historial');

  // Registrar copia de recordatorio
  recordDealReminderSent(sampleDealAm.id, 'pm_cisco');
  const updatedAfterReminder = getLocalDealRemindersCache().find((d) => d.id === sampleDealAm.id);
  assert(updatedAfterReminder?.reminderCount === 1, 'Contador de recordatorios incrementado a 1');
  assert(Boolean(updatedAfterReminder?.lastReminderSentAt), 'Fecha de último recordatorio actualizada');

  // Agregar nota personalizada
  addDealHistoryNote(sampleDealAm.id, 'preventa', 'AM confirmó que responderá en la tarde');
  const updatedAfterNote = getLocalDealRemindersCache().find((d) => d.id === sampleDealAm.id);
  const noteAdded = updatedAfterNote?.history?.find((h) => h.comment.includes('AM confirmó'));
  assert(Boolean(noteAdded), 'Nota de bitácora agregada correctamente');

  // Eliminar
  deleteDealReminder(sampleDealAm.id);
  const updatedAfterDelete = getLocalDealRemindersCache().find((d) => d.id === sampleDealAm.id);
  assert(!updatedAfterDelete, 'Deal eliminado exitosamente');

  // --------------------------------------------------------------------------
  // TEST 5: Generación desde Estimate Activo (createDealReminderFromEstimate)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Creación Automática de Recordatorio desde Estimate ---');
  const mockEstimate: ProcessedEstimateResult = {
    fileName: 'Estimate_OE169047114NP.xlsx',
    headerInfo: {
      dealId: 'DEAL-332211',
      estimateId: 'OE169047114NP',
      customerName: 'Adexus Chile',
      companyName: 'Ministerio de Hacienda',
    } as any,
    calculatedProductTotal: 92400.0,
    originalProductTotal: 84000.0,
    serviceTotal: 0,
    subscriptionTotal: 0,
    finalTotalPrice: 92400.0,
    headerRowIndex: 0,
    versionTag: 'v1',
    items: [],
  };

  const dealFromEstimate = createDealReminderFromEstimate(mockEstimate, 'AM_CISCO', 'pm_cisco', {
    amContactName: 'Felipe Campos',
    targetDiscountPct: 70.0,
    notes: 'Renovación de infraestructura ministerial',
  });

  assert(dealFromEstimate.dealId === 'DEAL-332211', 'Deal ID extraído del estimate');
  assert(dealFromEstimate.partnerName === 'Adexus Chile', 'Partner extraído del estimate');
  assert(dealFromEstimate.endCustomerName === 'Ministerio de Hacienda', 'Cliente final extraído del estimate');
  assert(dealFromEstimate.estimateId === 'OE169047114NP', 'Estimate ID vinculado');
  assert(dealFromEstimate.estimatedTotalUsd === 92400.0, 'Total solución en USD vinculado');
  assert(dealFromEstimate.escalationChannel === 'AM_CISCO', 'Canal AM Cisco configurado');
  assert(dealFromEstimate.status === 'PENDING_APPROVAL', 'Estado inicial PENDING_APPROVAL');

  // --------------------------------------------------------------------------
  // TEST 6: Pop-up Proactivo en Horarios Clave (12:00 Medio Día y 17:30 Fin de Jornada)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Evaluación de Pop-up Proactivo (12:00 y 17:30) ---');

  // Deal escalado ayer a las 15:00
  const yesterdayEscalated = new Date(2026, 9, 6, 15, 0, 0); // Martes 6 Oct 2026
  const dealEscalatedYesterday: DealReminderRecord = {
    ...sampleDealAm,
    id: 'DEAL-POPUP-TEST',
    dealId: 'DEAL-774411',
    escalatedAt: yesterdayEscalated.toISOString(),
  };

  // Escenario A: Al otro día a las 12:15 (Horario Medio Día)
  const nextDayMidday = new Date(2026, 9, 7, 12, 15, 0); // Miércoles 7 Oct 12:15
  const popupMidday = checkDealPopupDue(dealEscalatedYesterday, nextDayMidday);
  assert(popupMidday.isDue, 'Deal escalado ayer activa Pop-up a mediodía (12:15)');
  assert(popupMidday.slot === 'midday', 'Slot identificado correctamente como midday');
  assert(popupMidday.slotTitle.includes('Medio Día'), 'Título de slot refleja Medio Día (12:00)');

  // Escenario B: Al otro día a las 17:40 (Horario Fin de Jornada)
  const nextDayEvening = new Date(2026, 9, 7, 17, 40, 0); // Miércoles 7 Oct 17:40
  const popupEvening = checkDealPopupDue(dealEscalatedYesterday, nextDayEvening);
  assert(popupEvening.isDue, 'Deal escalado ayer activa Pop-up al fin de jornada (17:40)');
  assert(popupEvening.slot === 'end_of_day', 'Slot identificado correctamente como end_of_day');
  assert(popupEvening.slotTitle.includes('Fin de Jornada'), 'Título de slot refleja Fin de Jornada (17:30)');

  // Escenario C: Deal escalado hoy recién en la mañana (ej. hace 1.5 horas, a las 10:00 y son las 11:30)
  const todayMorning = new Date(2026, 9, 7, 10, 0, 0);
  const dealEscalatedToday: DealReminderRecord = {
    ...sampleDealAm,
    id: 'DEAL-TODAY',
    escalatedAt: todayMorning.toISOString(),
  };
  const checkEarlyToday = new Date(2026, 9, 7, 11, 30, 0);
  const popupEarly = checkDealPopupDue(dealEscalatedToday, checkEarlyToday);
  assert(!popupEarly.isDue, 'Deal escalado hoy en la mañana no debe alertar antes del horario objetivo');

  // --------------------------------------------------------------------------
  // TEST 7: Mecanismo de Snooze ("Recordar más tarde" / "X") y Detención Permanente
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Snooze ("Recordar más tarde" / "X") y Detención al Aprobar ---');

  // Cálculo de snooze a mediodía -> debe posponer para las 17:30 de hoy
  const snoozeFromMidday = calculateNextSnoozeDate('midday', nextDayMidday);
  assert(snoozeFromMidday.getHours() === 17 && snoozeFromMidday.getMinutes() === 30, 'Snooze desde mediodía programa a las 17:30 de hoy');

  // Cálculo de snooze al fin de jornada (Miércoles 17:40) -> debe posponer para mañana a las 12:00
  const snoozeFromEvening = calculateNextSnoozeDate('end_of_day', nextDayEvening);
  assert(snoozeFromEvening.getDate() === nextDayEvening.getDate() + 1, 'Snooze desde fin de jornada pasa al día siguiente');
  assert(snoozeFromEvening.getHours() === 12 && snoozeFromEvening.getMinutes() === 0, 'Snooze desde fin de jornada fija hora a las 12:00');

  // Cálculo de snooze al fin de jornada un Viernes -> debe saltar sábado y domingo hasta el Lunes a las 12:00
  const fridayEvening = new Date(2026, 9, 9, 17, 45, 0); // Viernes 9 Octubre 2026
  assert(fridayEvening.getDay() === 5, 'Verificado que es día Viernes');
  const snoozeWeekend = calculateNextSnoozeDate('end_of_day', fridayEvening);
  assert(snoozeWeekend.getDay() === 1, 'Snooze de fin de semana avanza a Lunes (day 1)');
  assert(snoozeWeekend.getHours() === 12 && snoozeWeekend.getMinutes() === 0, 'Snooze de fin de semana fija Lunes a las 12:00');

  // Poner el Deal en Snooze y verificar que checkDealPopupDue retorne isDue: false
  saveLocalDealRemindersCache([dealEscalatedYesterday]);
  snoozeDealReminder(dealEscalatedYesterday.id, snoozeFromMidday.toISOString(), 'pm_test', 'Pospuesto con botón X');
  const dealAfterSnooze = getLocalDealRemindersCache().find((d) => d.id === dealEscalatedYesterday.id)!;
  assert(Boolean(dealAfterSnooze.snoozedUntil), 'deal.snoozedUntil persistido correctamente');
  const popupWhileSnoozed = checkDealPopupDue(dealAfterSnooze, new Date(nextDayMidday.getTime() + 30 * 60 * 1000));
  assert(!popupWhileSnoozed.isDue, 'Deal en snooze activo NO muestra pop-up');

  // Aprobar descuentos y verificar que los pop-ups se DETENGAN DEFINITIVAMENTE
  markDealDiscountsApproved(dealEscalatedYesterday.id, 'pm_test', 'Descuentos formalmente aprobados por Cisco');
  const dealAfterApproved = getLocalDealRemindersCache().find((d) => d.id === dealEscalatedYesterday.id)!;
  assert(dealAfterApproved.status === 'APPROVED', 'Estado cambiado a APPROVED');
  assert(Boolean(dealAfterApproved.discountsApprovedAt), 'discountsApprovedAt registrado');
  const popupAfterApproval = checkDealPopupDue(dealAfterApproved, nextDayEvening);
  assert(!popupAfterApproval.isDue, 'Deal con descuentos aprobados DETIENE pop-ups permanentemente ("parar los pop up")');

  console.log(`\n🎉 ¡TODAS LAS PRUEBAS DE RECORDADOR Y NOTIFICADOR DE DEALS COMPLETADAS AL 100%! (${passed}/${total})`);
}

runTests();
