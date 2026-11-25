// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/verify
// Native onRequestPost handler for Cloudflare Turnstile validation
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
    const rawToken = body?.token || body?.response || '';
    const token = String(rawToken).trim().replace(/^["']|["']$/g, '').trim();
    const remoteip = context.request.headers.get("CF-Connecting-IP") || undefined;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, "error-codes": ["missing-input-response"] }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const rawSecret = context.env.TURNSTILE_SECRET_KEY;
    const SECRET_KEY = rawSecret
      ? String(rawSecret).trim().replace(/^["']|["']$/g, '').trim()
      : '';

    if (!SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, "error-codes": ["turnstile-not-configured"] }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: SECRET_KEY,
          response: token,
          remoteip: remoteip,
        }),
      }
    );

    const result: any = await response.json();
    const isVerified = Boolean(result && result.success === true);

    return new Response(JSON.stringify(result), {
      status: isVerified ? 200 : 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return new Response(
      JSON.stringify({ success: false, "error-codes": ["internal-error"] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};
