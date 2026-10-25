// ============================================================================
// CISCO AUTOMATED - TWO FACTOR AUTHENTICATION (2FA) MODAL
// Adaptive Risk-Based Verification for International Access
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Globe,
  Mail,
  Clock,
  KeyRound,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import {
  GeoLocationInfo,
  OtpSessionState,
  sendTwoFactorOtp,
  verifyTwoFactorOtp,
  requestAdminUnlock,
} from './twoFactorService';

interface TwoFactorModalProps {
  isOpen: boolean;
  username: string;
  email: string;
  geoInfo: GeoLocationInfo;
  initialOtpSession?: OtpSessionState;
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorModal({
  isOpen,
  username,
  email,
  geoInfo,
  initialOtpSession,
  onVerified,
  onCancel,
}: TwoFactorModalProps) {
  const [code, setCode] = useState('');
  const [otpSession, setOtpSession] = useState<OtpSessionState | undefined>(initialOtpSession);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isNotifyingAdmin, setIsNotifyingAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(30);
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [adminOverrideCode, setAdminOverrideCode] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initial session
  useEffect(() => {
    if (initialOtpSession) {
      setOtpSession(initialOtpSession);
      const diffSec = Math.max(0, Math.floor((initialOtpSession.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diffSec > 0 ? diffSec : 600);
    }
  }, [initialOtpSession]);

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Countdown timer for 10-min OTP
  useEffect(() => {
    if (!isOpen || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, remainingSeconds]);

  // Cooldown for resend button
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    : 'tu correo corporativo';

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = (adminOverrideCode.trim() || code.trim()).replace(/\s+/g, '');

    if (!cleanCode) {
      setErrorMsg('Por favor introduce el código de verificación.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await verifyTwoFactorOtp(username, cleanCode, otpSession);
      if (res.success) {
        onVerified();
      } else {
        setErrorMsg(res.error || 'Código incorrecto o expirado.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de verificación.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await sendTwoFactorOtp(username, email, geoInfo);
      if (res.success && res.otpSession) {
        setOtpSession(res.otpSession);
        setRemainingSeconds(600);
        setResendCooldown(45);
        setInfoMsg('¡Nuevo código enviado exitosamente a tu correo!');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg('Error al reenviar el código.');
    } finally {
      setIsResending(false);
    }
  };

  const handleNotifyAdmin = async () => {
    if (isNotifyingAdmin) return;
    setIsNotifyingAdmin(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await requestAdminUnlock(username, email, geoInfo);
      if (res.success) {
        setInfoMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg('No se pudo contactar al administrador.');
    } finally {
      setIsNotifyingAdmin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <Globe className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Verificación 2FA
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  Internacional
                </span>
              </h3>
              <p className="text-xs text-slate-400">Autenticación en Dos Pasos</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            title="Cancelar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Location Banner */}
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              Conexión fuera de Chile detectada:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[11px]">
              {geoInfo.country} • {geoInfo.city || 'Desconocida'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Por directivas de seguridad corporativas, todo inicio de sesión fuera de territorio nacional requiere validar el código temporal enviado a tu correo.
          </p>
        </div>

        {/* Info or Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                Código enviado a <strong className="text-white">{maskedEmail}</strong>:
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400">
                <Clock className="w-3 h-3" />
                {formatTimer(remainingSeconds)}
              </span>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                maxLength={8}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                  setErrorMsg('');
                }}
                placeholder="000000"
                className="w-full h-14 bg-slate-950 border border-slate-700/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 rounded-2xl text-center text-3xl font-mono font-black tracking-[0.4em] text-white placeholder-slate-600 transition"
                autoComplete="one-time-code"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !code.trim()}
            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                Verificar e Ingresar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Resend & Admin Options */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">¿No recibiste el correo?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 disabled:opacity-40 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
            </button>
          </div>

          {/* Admin Override Dropdown */}
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setShowAdminSection(!showAdminSection)}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition font-medium"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              ¿Sin acceso al correo? Desbloqueo por Administrador (mskill)
            </button>

            {showAdminSection && (
              <div className="mt-3 p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Si estás en viaje o tu buzón corporativo no está accesible, puedes notificar directamente al Administrador Principal (<strong>mskill</strong>) o ingresar un <strong>Código Maestro de Contingencia</strong>.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleNotifyAdmin}
                    disabled={isNotifyingAdmin}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                  >
                    <Send className="w-3 h-3 text-amber-400" />
                    {isNotifyingAdmin ? 'Notificando...' : 'Notificar a mskill'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Código Maestro entregado por mskill:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="CÓDIGO-ADMIN"
                      value={adminOverrideCode}
                      onChange={(e) => setAdminOverrideCode(e.target.value.toUpperCase())}
                      className="flex-1 h-9 bg-slate-900 border border-slate-700 rounded-lg px-2.5 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerify()}
                      disabled={isVerifying || !adminOverrideCode.trim()}
                      className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
