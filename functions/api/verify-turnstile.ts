// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS - SERVERLESS TURNSTILE SITEVERIFY ENDPOINT
// ============================================================================

interface Env {
  TURNSTILE_SECRET_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json();
    const token = body?.token;
    const ip = context.request.headers.get('CF-Connecting-IP') || '';

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Turnstile no proporcionado.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const secretKey = context.env.TURNSTILE_SECRET_KEY || '0x4AAAAAAAEiYjd6iGHpIhd9x_V1M5DDctRI';

    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const siteVerifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome: any = await siteVerifyRes.json();

    if (outcome.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Desafío de seguridad no válido o rechazado por Cloudflare.',
          'error-codes': outcome['error-codes'],
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error interno de validación' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
