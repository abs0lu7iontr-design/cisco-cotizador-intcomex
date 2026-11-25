// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS - SERVERLESS TURNSTILE SITEVERIFY ENDPOINT
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';

interface Env {
  TURNSTILE_SECRET_KEY?: string;
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const body: any = await context.request.json();
    const token = String(body?.token || '').trim();
    const ip = context.request.headers.get('CF-Connecting-IP') || '';

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Turnstile no proporcionado.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const secretKey = context.env.TURNSTILE_SECRET_KEY
      ? String(context.env.TURNSTILE_SECRET_KEY).trim().replace(/^["']|["']$/g, '').trim()
      : '';

    if (!secretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Servicio Turnstile no configurado en el servidor.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

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
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno de validación Turnstile.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};
