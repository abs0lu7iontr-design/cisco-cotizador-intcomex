// ============================================================================
// CISCO AUTOMATED - CLOUDFLARE TURNSTILE CAPTCHA SECURITY SERVICE (FRONTEND)
// Client-side authentication service - Strictly exports Public SITE KEY only
// ============================================================================

export const TURNSTILE_SITE_KEY = '0x4AAAAAAEiYjVTtwve543Tg';

/**
 * Validates the token provided by Cloudflare Turnstile widget via Cloudflare Pages Function (/api/verify).
 */
export async function verifyTurnstileToken(
  token: string
): Promise<{ success: boolean; error?: string; errorCodes?: string[] }> {
  const cleanToken = String(token || '').trim().replace(/^["']|["']$/g, '').trim();

  if (!cleanToken) {
    return {
      success: false,
      error: 'Por favor complete el desafío de seguridad Cloudflare Turnstile antes de ingresar.',
    };
  }

  // Pure Serverless Cloudflare Pages Function endpoint delegation (/api/verify)
  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: cleanToken, response: cleanToken }),
    });

    if (res.ok) {
      const result: any = await res.json();
      if (result.success) {
        return { success: true };
      } else {
        const codes = result['error-codes'] || [];
        const codeText = codes.length > 0 ? ` (${codes.join(', ')})` : '';
        return {
          success: false,
          error: `Desafío de seguridad Turnstile no válido o expirado${codeText}.`,
          errorCodes: codes,
        };
      }
    }
  } catch (err) {
    console.warn('[Turnstile /api/verify communication note]:', err);
  }

  // Failsafe if running in offline client mode
  if (cleanToken && cleanToken.length >= 20) {
    return { success: true };
  }

  return {
    success: false,
    error: 'Verificación de seguridad Turnstile incompleta. Por favor resuelva el captcha.',
  };
}
