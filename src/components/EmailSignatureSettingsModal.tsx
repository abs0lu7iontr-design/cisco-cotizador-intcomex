// ============================================================================
// CISCO AUTOMATED v2.7 - EMAIL SIGNATURE & TEMPLATE SETTINGS MODAL
// Interfaz interactiva para configurar la firma ejecutiva y condiciones comerciales
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Mail,
  User,
  Briefcase,
  Phone,
  Building2,
  FileText,
  Save,
  RotateCcw,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  EmailSignatureProfile,
  DEFAULT_EMAIL_SIGNATURE,
  getSavedEmailSignature,
  saveEmailSignature,
} from '../core/emailSignatureProfile';

interface EmailSignatureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const EmailSignatureSettingsModal: React.FC<EmailSignatureSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [profile, setProfile] = useState<EmailSignatureProfile>(DEFAULT_EMAIL_SIGNATURE);
  const [termsText, setTermsText] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSavedEmailSignature().then((saved) => {
        setProfile(saved);
        setTermsText((saved.commercialTerms || DEFAULT_EMAIL_SIGNATURE.commercialTerms).join('\n'));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const splitTerms = termsText
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const updatedProfile: EmailSignatureProfile = {
      ...profile,
      commercialTerms: splitTerms.length > 0 ? splitTerms : DEFAULT_EMAIL_SIGNATURE.commercialTerms,
    };

    await saveEmailSignature(updatedProfile);
    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
      if (onSaved) onSaved();
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setProfile(DEFAULT_EMAIL_SIGNATURE);
    setTermsText(DEFAULT_EMAIL_SIGNATURE.commercialTerms.join('\n'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Firma y Plantilla de Correo Outlook
              </h3>
              <p className="text-xs text-slate-400">
                Personaliza los datos del remitente y términos incluidos al copiar correos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Datos del Remitente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Nombre del Remitente / PM</span>
              </label>
              <input
                type="text"
                value={profile.senderName}
                onChange={(e) => setProfile({ ...profile, senderName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cargo o Rol Oficial</span>
              </label>
              <input
                type="text"
                value={profile.jobTitle}
                onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                placeholder="Ej: Product Manager Cisco"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Teléfono / WhatsApp</span>
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="Ej: +56 9 1234 5678"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Correo Electrónico Corporativo</span>
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Ej: jperez@intcomex.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Términos Comerciales en Viñetas */}
          <div className="space-y-1 pt-2">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Condiciones Comerciales (1 por línea)</span>
            </label>
            <textarea
              rows={4}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Ingresa las condiciones comerciales que se incluirán al pie de la cotización..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            />
          </div>

          {/* Pie Legal */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pie Legal o Dirección Corporativa</span>
            </label>
            <input
              type="text"
              value={profile.disclaimerText}
              onChange={(e) => setProfile({ ...profile, disclaimerText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-[11px]"
            />
          </div>

          {/* Vista Previa de la Firma */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Vista Previa de la Firma</span>
            <div className="border-l-2 border-indigo-500 pl-3 py-0.5 space-y-0.5 font-sans">
              <div className="font-bold text-white text-xs">{profile.senderName || 'Nombre del PM'}</div>
              <div className="text-[11px] text-indigo-400 font-medium">{profile.jobTitle || 'Cargo'}</div>
              <div className="text-[10px] text-slate-400">
                {profile.phone && `📞 ${profile.phone}  `}
                {profile.email && `✉️ ${profile.email}`}
              </div>
              <div className="text-[9px] text-slate-500">{profile.disclaimerText}</div>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Base</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSavedToast ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Firma</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
