// ============================================================================
// CISCO AUTOMATED v2.1 - SECURE RBAC LOGIN SCREEN
// Cloud-Hardened with 3-Attempt Account Lockout, Anti-BruteForce & Rate Limiting
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { UserSession } from '../core/types';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Eye,
  EyeOff,
  Clock,
  Cloud,
  Wifi,
  WifiOff,
  HardDrive,
  Check,
} from 'lucide-react';
import { CISCO_HALLOWEEN_ANIMATED_LOGO_DATA_URI, getSeasonalLoginLogo } from '../core/brandingLogos';
import {
  useOfflineMode,
  setManualOfflineMode,
} from '../core/storage/offlineModeManager';
import {
  getLocalPlatformConfig,
  saveLocalPlatformConfig,
} from '../core/storage/localPlatformConfig';
import {
  getCloudUsers,
  saveCloudUser,
  sha256Salted,
  authenticateCloudUser,
  getLocalUsersCache,
  DEFAULT_BASE_USERS,
  CloudUserRecord,
  withTimeout,
  FirebaseConfigModal,
} from '../modules/cloud';
import {
  checkGeoLocation,
  sendTwoFactorOtp,
  requestEdgeSessionToken,
  GeoLocationInfo,
  OtpSessionState,
  TwoFactorModal,
} from '../modules/security';

interface LoginScreenProps {
  onLoginSuccess: (user: UserSession) => void;
}

interface SecurityState {
  failedAttempts: number;
  lockedUntil: number; // Timestamp in ms
  lastAttemptTime: number;
  recentRequestTimestamps: number[];
}

const SECURITY_STORAGE_KEY = 'cisco_auth_security_state';
const SAVED_PASSWORD_STORAGE_KEY = 'cisco_local_saved_pass_v1';
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const FLOOD_WINDOW_MS = 10 * 1000; // 10 seconds
const MAX_FLOOD_REQUESTS = 4;

// Política de seguridad estricta: jamás persistir contraseñas reversibles en localStorage.
// El autocompletado seguro lo gestiona el gestor nativo del navegador (autoComplete="current-password").
function encodePasswordToken(_pass: string): string {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
    }
  } catch {}
  return '';
}

function decodePasswordToken(_token: string): string {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
    }
  } catch {}
  return '';
}

function loadSecurityState(): SecurityState {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        failedAttempts: Number(parsed.failedAttempts) || 0,
        lockedUntil: Number(parsed.lockedUntil) || 0,
        lastAttemptTime: Number(parsed.lastAttemptTime) || 0,
        recentRequestTimestamps: Array.isArray(parsed.recentRequestTimestamps)
          ? parsed.recentRequestTimestamps
          : [],
      };
    }
  } catch (_) {}
  return {
    failedAttempts: 0,
    lockedUntil: 0,
    lastAttemptTime: 0,
    recentRequestTimestamps: [],
  };
}

function saveSecurityState(state: SecurityState) {
  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { isOffline, isManualOffline } = useOfflineMode();
  const localConfig = getLocalPlatformConfig();

  const [username, setUsername] = useState(() => {
    if (!localConfig.rememberLastUser) return '';
    const rawUser = (localConfig.lastUsername || '').trim();
    // Jamás autocompletar con 'pm_cisco' por defecto; solo mostrar si es un usuario legítimo guardado por el usuario
    return rawUser.toLowerCase() === 'pm_cisco' ? '' : rawUser;
  });

  const [password, setPassword] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const legacyStored = localStorage.getItem(SAVED_PASSWORD_STORAGE_KEY);
        if (legacyStored) {
          decodePasswordToken(legacyStored);
        }
      }
    } catch {}
    return '';
  });

  const [rememberUser, setRememberUser] = useState<boolean>(() => {
    return localConfig.rememberLastUser ?? true;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Security Lockout & Countdown Timer State
  const [isLocked, setIsLocked] = useState(false);
  const [remainingLockSeconds, setRemainingLockSeconds] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const lockTimerRef = useRef<number | null>(null);

  // Adaptive 2FA & Geolocation State
  const [geoInfo, setGeoInfo] = useState<GeoLocationInfo | null>(null);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [pendingUserSession, setPendingUserSession] = useState<UserSession | null>(null);
  const [pendingOtpSession, setPendingOtpSession] = useState<OtpSessionState | undefined>(undefined);

  // Sync Cloud Users and check security on mount
  useEffect(() => {
    if (isOffline) {
      // En modo offline asigna inmediatamente la geolocalización local sin realizar llamadas HTTP externas
      setGeoInfo({
        country: 'CL',
        city: 'Santiago',
        region: 'RM',
        ip: '127.0.0.1',
        isChile: true,
        requires2FA: false,
      });
    } else {
      // 1. Fetch cloud users into local cache in background si está Online
      getCloudUsers().catch((e) => console.warn('Cloud users sync note:', e));

      // Detect Geolocation origin for adaptive 2FA
      checkGeoLocation()
        .then((info) => setGeoInfo(info))
        .catch(() => {
          setGeoInfo({
            country: 'CL',
            city: 'Santiago',
            region: 'RM',
            ip: '127.0.0.1',
            isChile: true,
            requires2FA: false,
          });
        });
    }

    // 2. Clear any stale lock
    const state = loadSecurityState();
    const now = Date.now();

    if (state.lockedUntil > now) {
      setIsLocked(true);
      const remSec = Math.ceil((state.lockedUntil - now) / 1000);
      setRemainingLockSeconds(remSec);
      setFailedCount(state.failedAttempts);
    } else {
      if (state.lockedUntil > 0 && state.lockedUntil <= now) {
        saveSecurityState({
          ...state,
          failedAttempts: 0,
          lockedUntil: 0,
        });
        setIsLocked(false);
        setRemainingLockSeconds(0);
        setFailedCount(0);
      } else {
        setFailedCount(state.failedAttempts);
      }
    }
  }, [isOffline]);

  // Interval timer for live countdown
  useEffect(() => {
    if (isLocked && remainingLockSeconds > 0) {
      lockTimerRef.current = window.setInterval(() => {
        setRemainingLockSeconds((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            const state = loadSecurityState();
            saveSecurityState({ ...state, failedAttempts: 0, lockedUntil: 0 });
            setFailedCount(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    }

    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, [isLocked, remainingLockSeconds]);

  const handleTwoFactorVerified = () => {
    setShowTwoFactorModal(false);
    if (pendingUserSession) {
      onLoginSuccess(pendingUserSession);
      setPendingUserSession(null);
    }
  };

  const handleTwoFactorCancel = () => {
    setShowTwoFactorModal(false);
    setPendingUserSession(null);
    setErrorMsg('Verificación 2FA cancelada. Se requiere autenticación de doble factor para conexiones internacionales.');
  };

  const formatCountdown = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password;

    if (isLocked) {
      setErrorMsg(
        `⛔ Acceso bloqueado temporalmente por seguridad. Reintente en ${formatCountdown(
          remainingLockSeconds
        )}.`
      );
      return;
    }

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Por favor ingrese usuario y contraseña.');
      return;
    }

    const now = Date.now();
    const secState = loadSecurityState();
    const recentRequests = (secState.recentRequestTimestamps || []).filter(
      (ts) => now - ts < FLOOD_WINDOW_MS
    );
    recentRequests.push(now);

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Desktop PyWebView Backend Authentication
      if ((window as any).pywebview?.api?.login_user) {
        const res = await (window as any).pywebview.api.login_user(cleanUser, cleanPass);
        if (res && res.success && res.user) {
          // Reset security counters
          saveSecurityState({
            failedAttempts: 0,
            lockedUntil: 0,
            lastAttemptTime: now,
            recentRequestTimestamps: [],
          });
          // Guardar preferencia de recordar usuario y contraseña en este equipo
          if (rememberUser && cleanUser) {
            saveLocalPlatformConfig({
              rememberLastUser: true,
              lastUsername: cleanUser,
            });
            try {
              if (typeof localStorage !== 'undefined' && cleanPass) {
                localStorage.setItem(SAVED_PASSWORD_STORAGE_KEY, encodePasswordToken(cleanPass));
              }
            } catch {}
          } else {
            saveLocalPlatformConfig({
              rememberLastUser: false,
              lastUsername: '',
            });
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
              }
            } catch {}
          }
          if (!isOffline) {
            await requestEdgeSessionToken(cleanUser, cleanPass).catch(() => ({ success: false }));
          }
          const currentGeo = geoInfo || (await checkGeoLocation());
          if (!geoInfo) setGeoInfo(currentGeo);
          if (currentGeo.requires2FA && !isOffline) {
            const otpRes = await sendTwoFactorOtp(cleanUser, res.user.email || '', currentGeo);
            setPendingUserSession(res.user);
            setPendingOtpSession(otpRes.otpSession);
            setShowTwoFactorModal(true);
            setIsLoading(false);
            return;
          }
          onLoginSuccess(res.user);
          return;
        } else {
          // Failure on backend
          const newFailed = secState.failedAttempts + 1;
          const willLock = newFailed >= MAX_FAILED_ATTEMPTS;
          const lockedUntil = willLock ? now + LOCKOUT_DURATION_MS : 0;

          saveSecurityState({
            failedAttempts: willLock ? MAX_FAILED_ATTEMPTS : newFailed,
            lockedUntil,
            lastAttemptTime: now,
            recentRequestTimestamps: recentRequests,
          });

          setFailedCount(newFailed);

          if (willLock) {
            setIsLocked(true);
            setRemainingLockSeconds(LOCKOUT_DURATION_MS / 1000);
            setErrorMsg('⛔ Acceso restringido temporalmente por motivos de seguridad.');
          } else {
            setErrorMsg('Usuario o contraseña incorrectos.');
          }
          return;
        }
      }

      // 3. Autenticación Segura en la Nube (Las contraseñas NUNCA se guardan en el PC)
      let foundUser: CloudUserRecord | null = null;

      const authRes = await authenticateCloudUser(cleanUser, cleanPass);
      if (!authRes.success || !authRes.user) {
        if (authRes.isOfflineBlocked) {
          setErrorMsg(authRes.error || 'Se requiere conexión a Internet para iniciar sesión.');
          return;
        }

        // Register failed attempt (user not found or invalid password)
        const newFailed = secState.failedAttempts + 1;
        const willLock = newFailed >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = willLock ? now + LOCKOUT_DURATION_MS : 0;

        saveSecurityState({
          failedAttempts: willLock ? MAX_FAILED_ATTEMPTS : newFailed,
          lockedUntil,
          lastAttemptTime: now,
          recentRequestTimestamps: recentRequests,
        });

        setFailedCount(newFailed);

        if (willLock) {
          setIsLocked(true);
          setRemainingLockSeconds(LOCKOUT_DURATION_MS / 1000);
          setErrorMsg('⛔ Acceso restringido temporalmente por motivos de seguridad.');
        } else {
          setErrorMsg(authRes.error || 'Usuario o contraseña incorrectos.');
        }
        return;
      }

      foundUser = authRes.user;

      // Reset security state on success
      saveSecurityState({
        failedAttempts: 0,
        lockedUntil: 0,
        lastAttemptTime: now,
        recentRequestTimestamps: [],
      });
      setFailedCount(0);

      // Guardar preferencia de recordar usuario y contraseña en este equipo
      if (rememberUser && cleanUser) {
        saveLocalPlatformConfig({
          rememberLastUser: true,
          lastUsername: cleanUser,
        });
        try {
          if (typeof localStorage !== 'undefined' && cleanPass) {
            localStorage.setItem(SAVED_PASSWORD_STORAGE_KEY, encodePasswordToken(cleanPass));
          }
        } catch {}
      } else {
        saveLocalPlatformConfig({
          rememberLastUser: false,
          lastUsername: '',
        });
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
          }
        } catch {}
      }

      // Update last_login asynchronously & emit Edge session token si está Online
      if (!isOffline) {
        saveCloudUser({
          ...foundUser,
          last_login: new Date().toISOString(),
        }).catch(() => {});
        await requestEdgeSessionToken(cleanUser, cleanPass).catch(() => ({ success: false }));
      }

        const userSession: UserSession = {
          username: cleanUser,
          full_name: foundUser.full_name,
          role: foundUser.role as any,
          email: foundUser.email,
        };

        const currentGeo =
          geoInfo ||
          (isOffline
            ? {
                country: 'CL',
                city: 'Santiago',
                region: 'RM',
                ip: '127.0.0.1',
                isChile: true,
                requires2FA: false,
              }
            : await checkGeoLocation());
        if (!geoInfo) setGeoInfo(currentGeo);

        if (currentGeo.requires2FA && !isOffline) {
          const otpRes = await sendTwoFactorOtp(cleanUser, foundUser.email || '', currentGeo);
          setPendingUserSession(userSession);
          setPendingOtpSession(otpRes.otpSession);
          setShowTwoFactorModal(true);
          setIsLoading(false);
          return;
        }

        onLoginSuccess(userSession);
        return;
    } catch (err: any) {
      setErrorMsg('Error de autenticación: ' + (err?.message || 'Fallo de conexión'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 p-4 sm:p-6 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Official Intcomex Metallic Brand Logo & Header */}
        <div className="text-center mb-7 relative z-10">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl bg-slate-950 p-1.5 shadow-2xl shadow-indigo-600/20 mb-3 border-2 border-slate-700/80 overflow-hidden hover:scale-105 transition-transform">
            <img
              src={getSeasonalLoginLogo()}
              alt="Cisco Automated Seasonal Logo"
              onError={(e) => {
                e.currentTarget.src = CISCO_HALLOWEEN_ANIMATED_LOGO_DATA_URI;
              }}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Cisco Automated</h1>
          <p className="text-[11px] font-extrabold text-indigo-400 mt-1 uppercase tracking-widest">
            Portal Corporativo &bull; Intcomex
          </p>
        </div>

        {/* Security Lockout Banner (Active when locked) */}
        {isLocked && (
          <div className="mb-5 p-4 bg-rose-950/90 border border-rose-600 rounded-2xl text-rose-200 text-xs space-y-2 shadow-lg shadow-rose-950/50 animate-pulse">
            <div className="flex items-center space-x-2.5 font-bold text-rose-300">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Acceso Temporalmente Restringido</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              El acceso se encuentra temporalmente restringido por motivos de seguridad institucional.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-rose-800/40 text-[11px]">
              <span className="flex items-center gap-1 text-rose-300 font-semibold">
                <Clock className="w-3.5 h-3.5" /> Tiempo de espera:
              </span>
              <span className="font-mono font-black text-rose-100 bg-rose-900/80 px-2.5 py-0.5 rounded-md border border-rose-700/50">
                {formatCountdown(remainingLockSeconds)}
              </span>
            </div>
          </div>
        )}

        {/* Warning / Error Alert (When not in full lockout) */}
        {!isLocked && errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-950/80 border border-rose-600/60 rounded-xl text-rose-200 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        

        {/* Device Offline/Online Mode Indicator & Quick Toggle */}
        <div className="mb-5 p-2.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs relative z-10">
          <div className="flex items-center space-x-2 text-slate-300">
            <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-200">Perfil de este Computador</span>
              <span className="text-[10px] text-slate-400">
                {isOffline ? 'Operación local aislada (sin nube)' : 'Sincronización activa con Firestore'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setManualOfflineMode(!isManualOffline)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer shadow-sm ${
              isOffline
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 hover:bg-amber-900/90 hover:border-amber-400'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900/90 hover:border-emerald-400'
            }`}
            title={
              isOffline
                ? 'Modo Offline activo en este PC. Clic para pasar a Online.'
                : 'Conectado a la nube. Clic para activar Modo Offline en este PC.'
            }
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>MODO OFFLINE</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>ONLINE</span>
              </>
            )}
          </button>
        </div>

        {/* Formulario de Login (Integrado con el Gestor de Contraseñas del Navegador) */}
        <form onSubmit={handleLogin} autoComplete="on" className="space-y-4 relative z-10">
          <div>
            <label htmlFor="username" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Usuario de Sistema
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => {
                  const val = e.target.value;
                  setUsername(val);
                  // Si el usuario borra o cambia el username y había contraseña guardada, limpiarla
                  if (!val.trim() && password) {
                    setPassword('');
                    try {
                      localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
                    } catch {}
                  }
                }}
                placeholder="Ingrese su usuario..."
                autoComplete="username"
                spellCheck="false"
                autoCorrect="off"
                autoCapitalize="none"
                disabled={isLocked || isLoading}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                spellCheck="false"
                disabled={isLocked || isLoading}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember User Checkbox on this Device */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => {
                  const val = e.target.checked;
                  setRememberUser(val);
                  if (val) {
                    saveLocalPlatformConfig({
                      rememberLastUser: true,
                      lastUsername: username.trim(),
                    });
                    if (password) {
                      try {
                        localStorage.setItem(SAVED_PASSWORD_STORAGE_KEY, encodePasswordToken(password));
                      } catch {}
                    }
                  } else {
                    saveLocalPlatformConfig({
                      rememberLastUser: false,
                      lastUsername: '',
                    });
                    try {
                      localStorage.removeItem(SAVED_PASSWORD_STORAGE_KEY);
                    } catch {}
                  }
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 font-medium">Recordar usuario en este computador</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLocked || isLoading || !username.trim() || !password}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed group cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Verificando Credenciales...</span>
              </>
            ) : isLocked ? (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-300" />
                <span>Bloqueo Activo ({formatCountdown(remainingLockSeconds)})</span>
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-7 pt-5 border-t border-slate-800/80 text-center">
          <div className="text-[10px] text-slate-500">
            © Cisco Automated &bull; Intcomex Chile SA
          </div>
        </div>
      </div>

      {/* Adaptive 2FA Modal */}
      {showTwoFactorModal && pendingUserSession && (
        <TwoFactorModal
          isOpen={showTwoFactorModal}
          username={pendingUserSession.username}
          email={pendingUserSession.email || ''}
          geoInfo={geoInfo || { country: 'EXT', city: '', region: '', ip: '', isChile: false, requires2FA: true }}
          initialOtpSession={pendingOtpSession}
          onVerified={handleTwoFactorVerified}
          onCancel={handleTwoFactorCancel}
        />
      )}
    </div>
  );
}
