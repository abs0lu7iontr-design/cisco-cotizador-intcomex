// ============================================================================
// CISCO AUTOMATED v2.1 - TICKET DETAIL & FEEDBACK THREAD MODAL
// Full conversation timeline, SLA progress meter, technical context & email dispatch
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Send,
  Mail,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  Flame,
  User,
  ShieldCheck,
  Laptop,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { UserSession } from '../../core/types';
import {
  FeedbackTicket,
  TicketStatus,
  TicketPriority,
  SlaStatus,
  TicketFeedbackMessage,
} from './types';
import {
  computeSlaInfo,
  addFeedbackResponse,
  updateFeedbackTicketStatus,
  deleteFeedbackTicket,
  generateOutlookMailtoLink,
  markTicketAsRead,
} from './feedbackService';

interface TicketDetailModalProps {
  ticket: FeedbackTicket | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onTicketUpdated: () => void;
}

const STATUS_LABELS: Record<TicketStatus, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Abierto', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  IN_PROGRESS: { label: 'En Proceso', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  RESOLVED: { label: 'Resuelto', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  CLOSED: { label: 'Cerrado', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400' },
  REJECTED: { label: 'Rechazado', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
};

const QUICK_TEMPLATES: Array<{ label: string; text: string; newStatus?: TicketStatus }> = [
  {
    label: '🔍 Recibido y en análisis',
    text: 'Hola, hemos recibido tu reporte. El equipo técnico está reproduciendo la situación para aplicar el parche en la próxima versión.',
    newStatus: 'IN_PROGRESS',
  },
  {
    label: '✅ Corregido en nueva versión',
    text: '¡Excelente noticia! Esta corrección/mejora ya fue implementada y desplegada en la última compilación. Por favor actualiza la app o recarga la página para verificarlo.',
    newStatus: 'RESOLVED',
  },
  {
    label: '❓ Solicitar más información',
    text: 'Hola, para poder reproducir el inconveniente, ¿podrías indicarnos con qué archivo Estimate ocurrió o compartirnos el número de Deal?',
    newStatus: 'IN_PROGRESS',
  },
  {
    label: '💡 Sugerencia priorizada',
    text: '¡Muchas gracias por la sugerencia! La hemos incorporado al backlog de desarrollo prioritario de Cisco Automated.',
    newStatus: 'IN_PROGRESS',
  },
];

export function TicketDetailModal({
  ticket,
  isOpen,
  onClose,
  currentUser,
  onTicketUpdated,
}: TicketDetailModalProps) {
  const [replyMessage, setReplyMessage] = useState('');
  const [targetStatus, setTargetStatus] = useState<TicketStatus | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [showTechContext, setShowTechContext] = useState(false);
  const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null);

  const isSupportTeam = currentUser.role === 'admin' || currentUser.role === 'pm';
  const isAuthor = ticket ? ticket.author.username === currentUser.username : false;

  useEffect(() => {
    if (isOpen && ticket) {
      markTicketAsRead(ticket.id, isAuthor);
    }
  }, [isOpen, ticket, isAuthor]);

  if (!isOpen || !ticket) return null;

  const slaInfo = computeSlaInfo(ticket);
  const statusInfo = STATUS_LABELS[ticket.status] || STATUS_LABELS.OPEN;

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return;
    setIsSubmitting(true);
    const newStatus = targetStatus ? (targetStatus as TicketStatus) : undefined;
    const res = await addFeedbackResponse(ticket.id, replyMessage, currentUser, newStatus);
    setIsSubmitting(false);

    if (res.success) {
      setReplyMessage('');
      setTargetStatus('');
      onTicketUpdated();
    }
  };

  const handleQuickStatusChange = async (newStatus: TicketStatus) => {
    setIsSubmitting(true);
    const res = await updateFeedbackTicketStatus(
      ticket.id,
      newStatus,
      currentUser,
      `Estado cambiado a ${STATUS_LABELS[newStatus]?.label || newStatus}`
    );
    setIsSubmitting(false);
    if (res.success) {
      onTicketUpdated();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente el ticket ${ticket.id}?`)) {
      return;
    }
    const res = await deleteFeedbackTicket(ticket.id);
    if (res.success) {
      onTicketUpdated();
      onClose();
    }
  };

  const handleCopyFormatted = () => {
    const text = [
      `[${ticket.id}] ${ticket.title}`,
      `Estado: ${ticket.status} | Prioridad: ${ticket.priority} | Módulo: ${ticket.module}`,
      `Autor: ${ticket.author.fullName} (${ticket.author.role})`,
      `SLA: ${slaInfo.formattedRemaining}`,
      `\nDescripción:`,
      ticket.description,
      replyMessage ? `\nRespuesta Actual:\n${replyMessage}` : '',
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 3000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div className="relative w-full max-w-4xl my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-5 sm:p-6 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between shrink-0">
            <div className="space-y-1.5 max-w-[80%]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-lg">
                  {ticket.id}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${statusInfo.bg} ${statusInfo.text}`}
                >
                  {statusInfo.label}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  {ticket.module}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  {ticket.type}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide leading-snug">
                {ticket.title}
              </h2>
              <p className="text-xs text-slate-400 flex items-center space-x-2">
                <span>Reportado por <strong className="text-slate-200">{ticket.author.fullName}</strong> ({ticket.author.role})</span>
                <span>•</span>
                <span>{new Date(ticket.createdAt).toLocaleString('es-CL')}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
            {/* SLA Progress Banner */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                slaInfo.status === 'BREACHED'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : slaInfo.status === 'NEAR_BREACH'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    slaInfo.status === 'BREACHED'
                      ? 'bg-rose-500/20 text-rose-400'
                      : slaInfo.status === 'NEAR_BREACH'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Compromiso SLA ({ticket.targetHours}h)
                    </span>
                    <span className="text-xs font-mono font-bold">
                      • {slaInfo.formattedRemaining}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    Fecha límite:{' '}
                    {new Date(ticket.dueAt).toLocaleString('es-CL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>

              {/* Progress Meter */}
              <div className="w-full sm:w-48 flex flex-col space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Tiempo transcurrido</span>
                  <span>{slaInfo.percentUsed}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-500 ${
                      slaInfo.status === 'BREACHED'
                        ? 'bg-rose-500'
                        : slaInfo.status === 'NEAR_BREACH'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${slaInfo.percentUsed}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Status Control for Admin & PM */}
            {isSupportTeam && (
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-300">Cambio Rápido de Estado:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'] as TicketStatus[]).map(
                    (st) => {
                      const isCurr = ticket.status === st;
                      const item = STATUS_LABELS[st];
                      return (
                        <button
                          key={st}
                          onClick={() => handleQuickStatusChange(st)}
                          disabled={isCurr || isSubmitting}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            isCurr
                              ? `${item.bg} ${item.text} ring-1 ring-white/20`
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Description Card */}
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Detalle del Reporte / Solicitud
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>

              {/* Attachments */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 block mb-2">
                    Capturas y Evidencias ({ticket.attachments.length}):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ticket.attachments.map((att, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveImageZoom(att.dataUrl)}
                        className="group relative rounded-xl border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer hover:border-indigo-500/50 transition-all"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="p-1.5 bg-slate-950/90 text-[10px] text-slate-400 truncate">
                          {att.name} ({att.sizeKb} KB)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Technical Context Accordion */}
            {ticket.technicalContext && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTechContext((p) => !p)}
                  className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Laptop className="w-4 h-4 text-cyan-400" />
                    <span>Diagnóstico Técnico Registrado</span>
                  </div>
                  {showTechContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTechContext && (
                  <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/60 bg-slate-950/60">
                    <div>
                      Versión App: <strong className="text-white">{ticket.technicalContext.appVersion}</strong>
                    </div>
                    <div>
                      Commit Git: <strong className="text-white">{ticket.technicalContext.gitCommit}</strong>
                    </div>
                    <div>
                      Plataforma: <strong className="text-white">{ticket.technicalContext.environment}</strong>
                    </div>
                    <div>
                      Módulo Activo: <strong className="text-white">{ticket.technicalContext.activeView}</strong>
                    </div>
                    {ticket.technicalContext.currentEstimateFileName && (
                      <div className="sm:col-span-2 truncate">
                        Archivo de Trabajo: <strong className="text-white">{ticket.technicalContext.currentEstimateFileName}</strong>
                      </div>
                    )}
                    {ticket.technicalContext.dealId && (
                      <div>
                        Deal ID: <strong className="text-white">{ticket.technicalContext.dealId}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feedback & Conversation Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span>Hilo de Respuestas & Seguimiento ({ticket.responses?.length || 0})</span>
                </h3>
              </div>

              {ticket.responses && ticket.responses.length > 0 ? (
                <div className="space-y-3">
                  {ticket.responses.map((msg) => {
                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          msg.author.isSupportTeam
                            ? 'bg-indigo-950/20 border-indigo-500/30 ml-4 sm:ml-8'
                            : 'bg-slate-950/40 border-slate-800/80 mr-4 sm:mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                msg.author.isSupportTeam
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {msg.author.isSupportTeam ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs font-bold text-white">
                              {msg.author.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({msg.author.role})
                            </span>
                            {msg.author.isSupportTeam && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Soporte Cisco
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleString('es-CL')}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {msg.message}
                        </p>

                        {msg.statusChange && (
                          <div className="mt-2 text-[10px] font-bold text-indigo-300 flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>
                              Estado actualizado a:{' '}
                              {STATUS_LABELS[msg.statusChange]?.label || msg.statusChange}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-950/20 text-center text-xs text-slate-400">
                  No hay respuestas en este ticket todavía. Escribe una respuesta a continuación.
                </div>
              )}
            </div>

            {/* Quick Templates for Support Team */}
            {isSupportTeam && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400">Plantillas Rápidas de Respuesta:</span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setReplyMessage(tmpl.text);
                        if (tmpl.newStatus) setTargetStatus(tmpl.newStatus);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reply Compose Box */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isSupportTeam ? 'Enviar Feedback o Respuesta al Usuario' : 'Responder al Equipo de Soporte'}
              </label>

              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={3}
                placeholder="Escribe tu mensaje, actualización de estado o confirmación aquí..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none custom-scrollbar"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Optional Status change upon reply */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Cambiar estado a:</span>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as TicketStatus)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">(Mantener actual: {statusInfo.label})</option>
                    {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'] as TicketStatus[]).map(
                      (st) => (
                        <option key={st} value={st}>
                          {STATUS_LABELS[st].label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyFormatted}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    title="Copiar resumen del ticket y respuesta"
                  >
                    {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResponse ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <a
                    href={generateOutlookMailtoLink(ticket, replyMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    title="Enviar respuesta a través de Outlook"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Outlook</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isSubmitting || !replyMessage.trim()}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Enviando...' : 'Enviar Respuesta'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
            <div>
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Ticket</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Modal for Attachments */}
      {activeImageZoom && (
        <div
          onClick={() => setActiveImageZoom(null)}
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <img
            src={activeImageZoom}
            alt="Zoom evidencia"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
