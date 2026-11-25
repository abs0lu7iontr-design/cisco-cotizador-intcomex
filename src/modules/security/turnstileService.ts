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
      }
    }

    let codes: string[] = [];
    try {
      const errBody: any = await res.json();
      if (Array.isArray(errBody?.['error-codes'])) {
        codes = errBody['error-codes'];
      }
    } catch {}
    const codeText = codes.length > 0 ? ` (${codes.join(', ')})` : '';
    return {
      success: false,
      error: `Desafío de seguridad Turnstile no válido o expirado${codeText}.`,
      errorCodes: codes,
    };
  } catch (err) {
    console.warn('[Turnstile /api/verify communication note]:', err);
    return {
      success: false,
      error: 'No se pudo validar el desafío de seguridad Turnstile con el servidor.',
    };
  }
}
