import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  X,
  KeyRound,
  ShieldAlert,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useCiscoAutomatedStore } from '../core/store';
import { useEstimatesMirror } from '../hooks/useEstimatesMirror';
import {
  getPendingAccessRequestsForUser,
  getMyAccessResolutionNotices,
  quickResolveAccessRequest,
  dismissAccessResolutionNotice,
  PendingAccessNotification,
  MyAccessResolutionNotice,
} from '../modules/notifications/estimateAccessNotificationService';

interface AccessNotificationsDropdownProps {
  onOpenEstimateHistory?: () => void;
}

export const AccessNotificationsDropdown: React.FC<AccessNotificationsDropdownProps> = ({
  onOpenEstimateHistory,
}) => {
  const { currentUser } = useCiscoAutomatedStore();
  const mirrorEstimates = useEstimatesMirror();

  const [isOpen, setIsOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pendingRequests = getPendingAccessRequestsForUser(mirrorEstimates, currentUser?.username);
  const myResolutions = getMyAccessResolutionNotices(mirrorEstimates, currentUser?.username);

  const totalBadges = pendingRequests.length + myResolutions.length;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleResolve = async (
    item: PendingAccessNotification,
    approve: boolean
  ) => {
    if (!currentUser) return;
    setResolvingId(`${item.docId}::${item.requesterUsername}`);

    try {
      const res = await quickResolveAccessRequest(
        item.docId,
        item.estimateId,
        item.requesterUsername,
        approve,
        currentUser.username
      );

      if (res.success) {
        setToastFeedback(
          approve
            ? `✅ Acceso concedido a @${item.requesterUsername}`
            : `❌ Solicitud rechazada`
        );
        setTimeout(() => setToastFeedback(null), 3000);
      } else {
        setToastFeedback(`Error: ${res.error || 'No se pudo procesar'}`);
        setTimeout(() => setToastFeedback(null), 3500);
      }
    } catch (err: any) {
      setToastFeedback(`Error: ${err?.message || 'Fallo de red'}`);
      setTimeout(() => setToastFeedback(null), 3500);
    } finally {
      setResolvingId(null);
    }
  };

  const handleDismissResolution = (notice: MyAccessResolutionNotice) => {
    const key = `${notice.docId}::${notice.status}::${notice.resolvedAt || ''}`;
    dismissAccessResolutionNotice(key);
    setToastFeedback('Notificación archivada');
    setTimeout(() => setToastFeedback(null), 2000);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="btn-access-notifications"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          totalBadges > 0
            ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/40'
            : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
        }`}
        title={
          totalBadges > 0
            ? `Tienes ${totalBadges} notificación(es) de permisos de cotizaciones`
            : 'Notificaciones de Seguridad y Permisos'
        }
      >
        <Bell className={`w-4 h-4 ${totalBadges > 0 ? 'text-amber-400 animate-bounce' : ''}`} />
        {totalBadges > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono font-black text-[10px] flex items-center justify-center shadow-md animate-pulse">
            {totalBadges}
          </span>
        )}
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black text-white">
                Permisos & Notificaciones
              </h4>
            </div>
            {totalBadges > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {totalBadges} activa(s)
              </span>
            )}
          </div>

          {/* Toast inside dropdown */}
          {toastFeedback && (
            <div className="px-3 py-1.5 bg-indigo-950/90 border-b border-indigo-700/40 text-indigo-200 text-[11px] font-bold text-center">
              {toastFeedback}
            </div>
          )}

          {/* Scrollable list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80 custom-scrollbar">
            {/* Section 1: Pending Requests Directed to Me */}
            {pendingRequests.length > 0 && (
              <div className="p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 px-2 pt-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Solicitudes de Acceso a tus Cotizaciones ({pendingRequests.length})</span>
                </div>

                {pendingRequests.map((item) => {
                  const isResolving =
                    resolvingId === `${item.docId}::${item.requesterUsername}`;
                  return (
                    <div
                      key={`${item.docId}-${item.requesterUsername}`}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>@{item.requesterUsername}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({item.requesterFullName})
                            </span>
                          </div>
                          <div className="text-[11px] text-cyan-300 font-medium">
                            Estimate #{item.estimateId} &bull; {item.partnerName}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {new Date(item.requestedAt).toLocaleDateString('es-CL')}{' '}
                              {new Date(item.requestedAt).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => handleResolve(item, true)}
                          className="flex-1 inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-md shadow-emerald-950/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Conceder Acceso</span>
                        </button>
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => handleResolve(item, false)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section 2: Resolutions for Requests I Made */}
            {myResolutions.length > 0 && (
              <div className="p-2 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400 px-2 pt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>Respuestas a tus Solicitudes ({myResolutions.length})</span>
                </div>

                {myResolutions.map((notice) => (
                  <div
                    key={`${notice.docId}-${notice.status}`}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-2 text-xs ${
                      notice.status === 'approved'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>
                          {notice.status === 'approved'
                            ? '✅ Solicitud Aprobada'
                            : '❌ Solicitud Rechazada'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Estimate #{notice.estimateId} ({notice.partnerName})
                        {notice.resolvedBy && ` por @${notice.resolvedBy}`}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismissResolution(notice)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Archivar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {totalBadges === 0 && (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">Sin notificaciones pendientes</div>
                <p className="text-[11px] text-slate-500">
                  Cuando alguien solicite acceso a tus cotizaciones protegidas, aparecerá aquí.
                </p>
              </div>
            )}
          </div>

          {/* Footer link to history */}
          {onOpenEstimateHistory && (
            <div className="p-2.5 border-t border-slate-800 bg-slate-950/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEstimateHistory();
                }}
                className="inline-flex items-center space-x-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <span>Ir al Historial de Estimates</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
