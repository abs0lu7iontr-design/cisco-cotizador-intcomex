// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/verify
// Native onRequestPost handler for Cloudflare Turnstile validation
// ============================================================================

interface Env {
  TURNSTILE_SECRET_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
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
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Read SECRET_KEY from environment variables and strip any quotes or whitespace
      const SECRET_KEY = String(context.env.TURNSTILE_SECRET_KEY || '').trim();
      if (!SECRET_KEY) {
        return new Response(JSON.stringify({ success: false, 'error-codes': ['missing-input-secret'] }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
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

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return new Response(
      JSON.stringify({ success: false, "error-codes": ["internal-error"] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
