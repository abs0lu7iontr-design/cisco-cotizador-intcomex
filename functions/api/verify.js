// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/verify
// Native onRequestPost handler for Cloudflare Turnstile validation with Failsafe
// ============================================================================

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const rawToken = body?.token || body?.response || '';
    const token = String(rawToken).trim().replace(/^["']|["']$/g, '').trim();
    const remoteip = request.headers.get("CF-Connecting-IP") || undefined;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, "error-codes": ["missing-input-response"] }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Candidate keys list
      const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
      if (!secret) {
        return new Response(JSON.stringify({ success: false, 'error-codes': ['missing-input-secret'] }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
    }

      const formData = new FormData();
      formData.append('secret', secret);
      formData.append('response', token);
      if (remoteip) {
        formData.append('remoteip', remoteip);
    }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      return new Response(JSON.stringify(result), {
        status: result?.success ? 200 : 403,
        headers: { 'Content-Type': 'application/json' },
      });
      }
    );
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
}
