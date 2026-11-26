// ============================================================================
// CISCO AUTOMATED - ADAPTIVE RISK-BASED 2FA & GEOLOCATION SERVICE
// ============================================================================

export interface GeoLocationInfo {
  country: string;
  city: string;
  region: string;
  ip: string;
  isChile: boolean;
  requires2FA: boolean;
  detectedAt?: string;
}

export interface OtpSessionState {
  otpSignature: string;
  expiresAt: number;
  nonce?: string;
}

function isLocalOrDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return true;
  if (Boolean((window as any).pywebview?.api)) return true;
  const host = (window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || window.location?.protocol === 'file:';
}

/**
 * Detects the client connection origin via Cloudflare Pages Edge (/api/geo-auth).
 * Fails closed (`requires2FA: true`) on non-local HTTPS web origins if geo-auth errors/times out.
 */
export async function checkGeoLocation(): Promise<GeoLocationInfo> {
  try {
    const res = await fetch('/api/geo-auth', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(1500) : undefined,
    });
    if (res.ok) {
      const data: any = await res.json();
      return {
        country: data.country || 'UNKNOWN',
        city: data.city || 'Desconocida',
        region: data.region || 'N/A',
        ip: data.ip || '0.0.0.0',
        isChile: Boolean(data.isChile),
        requires2FA: Boolean(data.requires2FA),
        detectedAt: data.detectedAt,
      };
    }
  } catch (err) {
    console.warn('[2FA Geo Check] Local dev or offline fallback:', err);
  }

  const allowDomesticLocalFallback = isLocalOrDesktopRuntime();
  return {
    country: allowDomesticLocalFallback ? 'CL' : 'UNKNOWN',
    city: allowDomesticLocalFallback ? 'Santiago' : 'Desconocida',
    region: allowDomesticLocalFallback ? 'RM' : 'N/A',
    ip: allowDomesticLocalFallback ? '127.0.0.1' : '0.0.0.0',
    isChile: allowDomesticLocalFallback,
    requires2FA: !allowDomesticLocalFallback,
  };
}

/**
 * Dispatches an email with a 6-digit verification code to the user's corporate email
 */
export async function sendTwoFactorOtp(
  username: string,
  email: string,
  geoInfo: GeoLocationInfo
): Promise<{ success: boolean; message: string; otpSession?: OtpSessionState; error?: string }> {
  try {
    const res = await fetch('/api/send-2fa-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        username,
        email,
        country: geoInfo.country,
        city: geoInfo.city,
        ip: geoInfo.ip,
      }),
    });

    const data: any = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message,
        otpSession: {
          otpSignature: data.otpSignature,
          expiresAt: data.expiresAt,
          nonce: data.nonce,
        },
      };
    }
    return {
      success: false,
      message: data.error || 'No se pudo enviar el código de verificación.',
      error: data.error,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de conexión al despachar 2FA.',
      error: err?.message,
    };
  }
}

/**
 * Verifies the 6-digit OTP code or Admin Override Code
 */
export async function verifyTwoFactorOtp(
  username: string,
  code: string,
  otpSession?: OtpSessionState
): Promise<{ success: boolean; message?: string; isOverride?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/send-2fa-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        username,
        code,
        otpSignature: otpSession?.otpSignature,
        expiresAt: otpSession?.expiresAt,
        nonce: otpSession?.nonce,
      }),
    });

    const data: any = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message,
        isOverride: data.isOverride,
      };
    }
    return {
      success: false,
      error: data.error || 'Código incorrecto o expirado.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error de conexión al verificar 2FA.',
    };
  }
}

/**
 * Notifies Root Admin (mskill) to request international access authorization
 */
export async function requestAdminUnlock(
  username: string,
  email: string,
  geoInfo: GeoLocationInfo
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/send-2fa-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_admin_unlock',
        username,
        email,
        country: geoInfo.country,
        city: geoInfo.city,
        ip: geoInfo.ip,
      }),
    });
    const data: any = await res.json();
    return {
      success: res.ok && data.success,
      message: data.message || 'Se ha notificado al Administrador Principal.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error al contactar al Administrador.',
    };
  }
}

/**
 * Obtains or generates an admin contingency override code for a traveling user
 */
export async function getAdminOverrideCode(
  username?: string,
  adminCredentials?: { adminUsername: string; adminPassword: string }
): Promise<{ success: boolean; code?: string; dayStamp?: string; target?: string; error?: string }> {
  try {
    const res = await fetch('/api/send-2fa-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_admin_override',
        username: username || '',
        ...(adminCredentials?.adminUsername ? { adminUsername: adminCredentials.adminUsername } : {}),
        ...(adminCredentials?.adminPassword ? { adminPassword: adminCredentials.adminPassword } : {}),
      }),
    });
    const data: any = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        code: data.code,
        dayStamp: data.dayStamp,
        target: data.target,
      };
    }
    return {
      success: false,
      error: data.error || 'Error al generar código de contingencia.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error de conexión al generar código.',
    };
  }
}
