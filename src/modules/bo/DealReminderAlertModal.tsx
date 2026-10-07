// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL REMINDER ALERT MODAL (POP-UP PROACTIVO)
// Pop-up inteligente de alerta programado a medio día (12:00) y fin de jornada (17:30)
// Con opciones para "Recordar más tarde" (o cerrar con 'X'), "Ya se aprobaron los descuentos"
// (que detiene los pop-ups definitivamente) y copiar correo para insistir a AM o VF.
// ============================================================================

import React, { useState } from 'react';
import {
  BellRing,
  Clock,
  CheckCircle2,
  X,
  Mail,
  Zap,
  UserCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  DealReminderRecord,
  DEAL_ESCALATION_METADATA,
  checkDealPopupDue,
  calculateNextSnoozeDate,
} from './dealReminderTypes';
import {
  snoozeDealReminder,
  markDealDiscountsApproved,
  recordDealReminderSent,
} from './dealReminderService';
import { copyDealReminderToClipboard } from './dealEmailHelper';
import { useCiscoAutomatedStore } from '../../core/store';

interface DealReminderAlertModalProps {
  deals: DealReminderRecord[];
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export function DealReminderAlertModal({
  deals,
  isOpen,
  onClose,
  onRefreshData,
}: DealReminderAlertModalProps) {
  const { currentUser } = useCiscoAutomatedStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [approvedSuccessDealId, setApprovedSuccessDealId] = useState<string | null>(null);

  if (!isOpen || !deals || deals.length === 0) {
    return null;
  }

  // Prevenir desbordamiento de índice
  const activeIndex = Math.min(currentIndex, deals.length - 1);
  const currentDeal = deals[activeIndex];
  if (!currentDeal) return null;

  const popupInfo = checkDealPopupDue(currentDeal);
  const channelMeta = DEAL_ESCALATION_METADATA[currentDeal.escalationChannel];
  const isVF = currentDeal.escalationChannel === 'VELOCITY_HUB';
  const author = currentUser?.full_name || currentUser?.username || 'Usuario';

  // 1. Manejo de "Recordar más tarde" o Cerrar con 'X' (Snooze al siguiente horario)
  const handleSnooze = async (customHours?: number) => {
    let snoozeDate: Date;
    let reasonText = 'Recordatorio pospuesto';

    if (customHours && customHours > 0) {
      snoozeDate = new Date(Date.now() + customHours * 3600 * 1000);
      reasonText = `Pospuesto por ${customHours} hora(s)`;
    } else {
      snoozeDate = calculateNextSnoozeDate(popupInfo.slot);
      const isEvening = popupInfo.slot === 'end_of_day';
      reasonText = isEvening
        ? 'Pospuesto para mañana a mediodía (12:00)'
        : 'Pospuesto para fin de jornada (17:30)';
    }

    await snoozeDealReminder(currentDeal.id, snoozeDate.toISOString(), author, reasonText);
    if (onRefreshData) onRefreshData();

    // Si hay más deals, avanzar al siguiente; si no, cerrar
    if (deals.length > 1 && activeIndex < deals.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  // 2. Manejo de "Ya se aprobaron los descuentos" (Parar los pop-ups)
  const handleMarkApproved = async () => {
    setApprovedSuccessDealId(currentDeal.id);
    await markDealDiscountsApproved(
      currentDeal.id,
      author,
      'Descuentos aprobados por Cisco. Pop-ups finalizados.'
    );

    setTimeout(() => {
      setApprovedSuccessDealId(null);
      if (onRefreshData) onRefreshData();
      if (deals.length > 1 && activeIndex < deals.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    }, 1200);
  };

  // 3. Copiar correo Outlook de recordatorio
  const handleCopyEmail = async () => {
    const res = await copyDealReminderToClipboard(currentDeal);
    if (res.success) {
      setCopiedSuccess(true);
      await recordDealReminderSent(currentDeal.id, author);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setCopiedSuccess(false), 3000);
    } else {
      alert(`No se pudo copiar: ${res.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div
        className={`bg-slate-900 border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative my-6 transition-all animate-scale ${
          popupInfo.slot === 'end_of_day'
            ? 'border-purple-600/60 shadow-purple-950/60'
            : 'border-amber-600/60 shadow-amber-950/60'
        }`}
      >
        {/* Banner Superior con Identificador de Horario */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            popupInfo.slot === 'end_of_day'
              ? 'bg-gradient-to-r from-purple-950/90 via-slate-900 to-slate-950 border-purple-800/50'
              : 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-amber-800/50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-2xl border shadow-inner animate-bounce ${
                popupInfo.slot === 'end_of_day'
                  ? 'bg-purple-600/20 border-purple-500/40 text-purple-400'
                  : 'bg-amber-600/20 border-amber-500/40 text-amber-400'
              }`}
            >
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">
                  Recordatorio de Descuentos Cisco
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${popupInfo.slotBadge}`}
                >
                  {popupInfo.slotTitle}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{popupInfo.reason}</p>
            </div>
          </div>

          {/* Botón X: Al cerrarlo también se recuerda más tarde según regla de negocio */}
          <button
            onClick={() => handleSnooze()}
            title="Cerrar y recordar más tarde en el siguiente horario"
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Principal del Deal */}
        <div className="p-6 space-y-4">
          {approvedSuccessDealId === currentDeal.id ? (
            <div className="bg-emerald-950/70 border border-emerald-600/60 rounded-2xl p-6 text-center space-y-2 animate-scale">
              <div className="w-12 h-12 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white">¡Descuentos Confirmados!</h4>
              <p className="text-xs text-emerald-200">
                El Deal <strong>{currentDeal.dealId}</strong> ha sido marcado como aprobado. Los pop-ups han sido detenidos permanentemente para este Deal.
              </p>
            </div>
          ) : (
            <>
              {/* Tarjeta de Información Clave */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-black text-cyan-400">
                    {currentDeal.dealId}
                  </span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${channelMeta.badgeBg} ${channelMeta.badgeText} ${channelMeta.borderClass}`}
                  >
                    {isVF ? <Zap className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                    <span>{channelMeta.shortLabel}</span>
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-1.5 text-white font-bold">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Partner:</span>
                    <span className="text-indigo-300">{currentDeal.partnerName}</span>
                  </div>
                  <div className="text-slate-300 pl-5">
                    Cliente Final: <strong className="text-white">{currentDeal.endCustomerName}</strong>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  {currentDeal.amContactName && (
                    <span>
                      AM: <strong className="text-slate-200">{currentDeal.amContactName}</strong>
                    </span>
                  )}
                  {currentDeal.vfTicketNumber && (
                    <span>
                      Caso VF: <strong className="text-cyan-300 font-mono">{currentDeal.vfTicketNumber}</strong>
                    </span>
                  )}
                  {currentDeal.targetDiscountPct && (
                    <span>
                      Desc. Solicitado: <strong className="text-emerald-400">{currentDeal.targetDiscountPct}%</strong>
                    </span>
                  )}
                  <span>
                    Escalado: {new Date(currentDeal.escalatedAt || currentDeal.createdAt).toLocaleDateString('es-CL')}
                  </span>
                </div>

                {currentDeal.notes && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    "{currentDeal.notes}"
                  </p>
                )}
              </div>

              {/* Botones de Acción Solicitados */}
              <div className="space-y-2.5 pt-1">
                {/* 1. Botón Principal: YA SE APROBARON LOS DESCUENTOS (Parar pop-ups) */}
                <button
                  type="button"
                  onClick={handleMarkApproved}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:scale-[1.01]"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                  <span>✅ Sí, ya se aprobaron los descuentos (Detener Alertas)</span>
                </button>

                {/* 2. Botón Copiar Correo para insistir */}
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                    copiedSuccess
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {copiedSuccess ? <Check className="w-4 h-4" /> : <Mail className="w-4 h-4 text-indigo-400" />}
                  <span>
                    {copiedSuccess
                      ? '¡Copiado con saludo según la hora para Outlook!'
                      : `📧 Copiar correo para insistir a ${isVF ? 'Velocity Hub' : currentDeal.amContactName || 'AM Cisco'}`}
                  </span>
                </button>

                {/* 3. Botón "Recordar más tarde" (Snooze al siguiente horario) */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSnooze()}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {popupInfo.slot === 'end_of_day'
                        ? 'Recordar mañana a mediodía (12:00)'
                        : 'Recordar a fin de jornada (17:30)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSnooze(2)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    title="Posponer solo 2 horas"
                  >
                    +2 hrs
                  </button>
                </div>
              </div>

              {/* Paginador si hay múltiples Deals */}
              {deals.length > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Deal <strong>{activeIndex + 1}</strong> de <strong>{deals.length}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={activeIndex === deals.length - 1}
                      onClick={() => setCurrentIndex((prev) => Math.min(deals.length - 1, prev + 1))}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      deals.forEach((d) => {
                        const date = calculateNextSnoozeDate(popupInfo.slot);
                        snoozeDealReminder(d.id, date.toISOString(), author);
                      });
                      onClose();
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Posponer todos al siguiente horario
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
