// ============================================================================
// CISCO AUTOMATED v2.1 - CREATE TICKET & FEEDBACK MODAL
// Friendly reporting modal with auto diagnostics & clipboard screenshot paste
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Sparkles,
  HelpCircle,
  Clock,
  Send,
  Paperclip,
  CheckCircle,
  AlertTriangle,
  Monitor,
  Laptop,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { UserSession } from '../../core/types';
import {
  FeedbackType,
  TicketPriority,
  ModuleContext,
  CreateTicketInput,
  TicketAttachment,
} from './types';
import { createFeedbackTicket, SLA_TARGET_HOURS, captureTechnicalContext } from './feedbackService';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onTicketCreated: () => void;
  defaultModule?: ModuleContext;
  currentEstimateFileName?: string;
  dealId?: string;
}

const FEEDBACK_TYPES: Array<{
  type: FeedbackType;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  border: string;
}> = [
  {
    type: 'BUG',
    label: 'Error o Falla Técnica',
    desc: 'Un cálculo falló, un botón no responde o la app muestra un error.',
    icon: Bug,
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  {
    type: 'IMPROVEMENT',
    label: 'Mejora de Función',
    desc: 'Una pantalla existente podría funcionar de forma más ágil o cómoda.',
    icon: Sparkles,
    color: 'text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  {
    type: 'FEATURE_REQUEST',
    label: 'Nueva Funcionalidad',
    desc: 'Sugerencia para agregar un nuevo flujo, reporte o automatización.',
    icon: CheckCircle,
    color: 'text-cyan-400 bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  {
    type: 'UX_UI',
    label: 'Diseño & Usabilidad',
    desc: 'Tipografía, colores, visualización en pantalla o textos confusos.',
    icon: Monitor,
    color: 'text-purple-400 bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  {
    type: 'DATA_CATALOG',
    label: 'Catálogo / SKUs',
    desc: 'Regla de arancel, SKU de hardware mal detectado o SKU sin clasificar.',
    icon: AlertTriangle,
    color: 'text-blue-400 bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  {
    type: 'OTHER',
    label: 'Consulta u Otro',
    desc: 'Dudas generales, felicitaciones u observaciones al equipo.',
    icon: HelpCircle,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
];

const PRIORITIES: Array<{
  priority: TicketPriority;
  label: string;
  sla: string;
  color: string;
  badge: string;
}> = [
  {
    priority: 'CRITICAL',
    label: 'Crítica',
    sla: 'SLA 4 Horas',
    color: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
    badge: 'bg-rose-500 text-white',
  },
  {
    priority: 'HIGH',
    label: 'Alta',
    sla: 'SLA 24 Horas (1 día)',
    color: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
    badge: 'bg-amber-500 text-slate-950',
  },
  {
    priority: 'MEDIUM',
    label: 'Media',
    sla: 'SLA 72 Horas (3 días)',
    color: 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300',
    badge: 'bg-indigo-500 text-white',
  },
  {
    priority: 'LOW',
    label: 'Baja',
    sla: 'SLA 120 Horas (5 días)',
    color: 'border-slate-700 bg-slate-900 text-slate-300',
    badge: 'bg-slate-700 text-slate-200',
  },
];

const MODULES: Array<{ value: ModuleContext; label: string }> = [
  { value: 'QUOTER', label: 'Cotizador Cisco CCW' },
  { value: 'CONFIGURIATOR', label: 'ConfigurIAtor (AI BOM)' },
  { value: 'DSV', label: 'Generador DSV Cisco' },
  { value: 'BO_TRACKING', label: 'Back Order & Tracking Logístico' },
  { value: 'ESTIMATES', label: 'Historial de Cotizaciones' },
  { value: 'MINING', label: 'Condiciones de Minería & Daniel Peña' },
  { value: 'SETTINGS', label: 'Configuración & Auto-Deploy' },
  { value: 'DESKTOP_APP', label: 'App Desktop Portable' },
  { value: 'GENERAL', label: 'General / Otro Módulo' },
];

export function CreateTicketModal({
  isOpen,
  onClose,
  currentUser,
  onTicketCreated,
  defaultModule = 'QUOTER',
  currentEstimateFileName,
  dealId,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<FeedbackType>('BUG');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>('MEDIUM');
  const [selectedModule, setSelectedModule] = useState<ModuleContext>(defaultModule);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto technical diagnosis preview
  const techContext = React.useMemo(() => {
    return captureTechnicalContext(selectedModule, currentEstimateFileName, dealId);
  }, [selectedModule, currentEstimateFileName, dealId]);

  // Support pasting screenshots from clipboard (Ctrl + V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const sizeKb = Math.round(blob.size / 1024);
                setAttachments((prev) => [
                  ...prev,
                  {
                    name: `screenshot-${Date.now().toString().slice(-4)}.png`,
                    dataUrl,
                    sizeKb,
                  },
                ]);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              dataUrl,
              sizeKb: Math.round(file.size / 1024),
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Por favor ingresa un título o resumen del reporte.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Por favor describe detalladamente la situación o sugerencia.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const input: CreateTicketInput = {
      title: title.trim(),
      description: description.trim(),
      type: selectedType,
      priority: selectedPriority,
      module: selectedModule,
      attachments,
      customContext: includeDiagnostics
        ? {
            activeView: selectedModule,
            currentEstimateFileName,
            dealId,
          }
        : undefined,
    };

    const res = await createFeedbackTicket(input, currentUser);
    setIsSubmitting(false);

    if (res.success) {
      if (res.ticket) {
        // Trigger background AI evaluation & proposed solution without blocking modal close
        import('./aiFeedbackAdvisor')
          .then(({ analyzeTicketWithAi }) => analyzeTicketWithAi(res.ticket!))
          .then((diagnosis) => {
            if (res.ticket) {
              return import('./feedbackService').then(({ saveTicketAiDiagnosis }) =>
                saveTicketAiDiagnosis(res.ticket!.id, diagnosis)
              );
            }
          })
          .catch(() => {});
      }
      setTitle('');
      setDescription('');
      setAttachments([]);
      onTicketCreated();
      onClose();
    } else {
      setErrorMessage(res.error || 'No se pudo registrar el ticket.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Mesa de Mejoras & Soporte Cisco Automated
              </h2>
              <p className="text-xs text-slate-400">
                Reporta un error, solicita una mejora o sugiere una nueva función con seguimiento y SLA.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Tipo de Solicitud */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2.5 uppercase tracking-wider">
              1. Tipo de Reporte o Solicitud
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {FEEDBACK_TYPES.map((item) => {
                const isSelected = selectedType === item.type;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedType(item.type)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${item.color} ${item.border} ring-2 ring-indigo-500/50 shadow-lg`
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <IconComponent className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Módulo y Prioridad (SLA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Módulo Afectado
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value as ModuleContext)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {MODULES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Prioridad / Nivel de Impacto
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => {
                  const isSelected = selectedPriority === p.priority;
                  return (
                    <button
                      key={p.priority}
                      type="button"
                      onClick={() => setSelectedPriority(p.priority)}
                      className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? `${p.color} ring-1 ring-white/30`
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{p.label}</span>
                        <span className="text-[9px] opacity-75">{p.sla}</span>
                      </div>
                      {isSelected && <span className={`w-2 h-2 rounded-full ${p.badge}`} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Título & Descripción */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Título o Resumen Breve <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Falla al calcular margen en SKU C9200L / Agregar filtro por cliente en historial"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Detalle, Pasos para Reproducir o Explicación de la Mejora <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Explica qué ocurrió, qué resultado esperabas o cómo imaginas que debería funcionar. También puedes presionar Ctrl+V en esta ventana para pegar una captura de pantalla directamente."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none custom-scrollbar"
              />
            </div>
          </div>

          {/* 4. Adjuntos & Capturas de Pantalla */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>Capturas de Pantalla o Evidencias</span>
              </label>
              <label className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-bold cursor-pointer transition-colors border border-slate-700">
                <span>+ Adjuntar Imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 text-center">
                <ImageIcon className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                <p className="text-[11px] text-slate-400">
                  Tip Pro: Toma un pantallazo con <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">Win + Shift + S</kbd> y presiona <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">Ctrl + V</kbd> aquí para pegarlo directamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-2xl border border-slate-800 bg-slate-950 p-2 overflow-hidden flex flex-col"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-full h-20 object-cover rounded-xl mb-1.5"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[90px]">{att.name}</span>
                      <span>{att.sizeKb} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute top-3 right-3 p-1 rounded-lg bg-rose-950/90 text-rose-300 border border-rose-500/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Diagnóstico Técnico Automático */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Laptop className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Diagnóstico Técnico del Sistema (Auto-adjunto)
                </span>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-slate-400">Incluir metadatos</span>
              </label>
            </div>
            {includeDiagnostics && (
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  Versión: <strong className="text-slate-200">{techContext.appVersion}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  Commit: <strong className="text-slate-200">{techContext.gitCommit}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  Plataforma: <strong className="text-slate-200">{techContext.environment}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  Usuario: <strong className="text-slate-200">{currentUser.username} ({currentUser.role})</strong>
                </span>
                {currentEstimateFileName && (
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 truncate max-w-[200px]">
                    Archivo: <strong className="text-slate-200">{currentEstimateFileName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>
              Compromiso SLA:{' '}
              <strong className="text-slate-200">
                {SLA_TARGET_HOURS[selectedPriority]} Horas
              </strong>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando Ticket...' : 'Enviar Reporte al Equipo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
