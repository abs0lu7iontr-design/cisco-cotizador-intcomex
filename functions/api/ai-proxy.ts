// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/ai-proxy
// Authenticated Server-Side AI Proxy (Gemini / OpenRouter / Groq / DeepSeek).
// Keeps AI provider API keys exclusively in Cloudflare Pages environment secrets
// so zero paid/quota keys are ever bundled into client JavaScript.
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import { EdgeEnv, verifyEdgeSessionToken } from '../lib/edgeAuth';

type SupportedAiProvider = 'gemini' | 'openrouter' | 'groq' | 'deepseek';

const SAFE_MODEL_RE = /^[a-zA-Z0-9._:/-]{2,80}$/;

const PROVIDER_CONFIG: Record<
  SupportedAiProvider,
  { envKey: keyof EdgeEnv; endpoint: string }
> = {
  gemini: {
    envKey: 'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  openrouter: {
    envKey: 'OPENROUTER_API_KEY',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  groq: {
    envKey: 'GROQ_API_KEY',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  deepseek: {
    envKey: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/chat/completions',
  },
};

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const env = (context.env || {}) as EdgeEnv;
    const sessionCheck = await verifyEdgeSessionToken(context.request, env);
    if (!sessionCheck.valid) {
      return new Response(
        JSON.stringify({ success: false, error: sessionCheck.error || 'Sesión Edge requerida.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (sessionCheck.role === 'viewer') {
      return new Response(
        JSON.stringify({ success: false, error: 'Rol sin permisos para invocar modelos IA del servidor.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const contentLength = Number(context.request.headers.get('Content-Length') || 0);
    if (contentLength > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload demasiado grande para el proxy IA (máx 5 MB).' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body: any = await context.request.json().catch(() => null);
    const provider = String(body?.provider || 'gemini').trim().toLowerCase() as SupportedAiProvider;
    const model = String(body?.model || '').trim();
    const payload = body?.payload;

    if (!(provider in PROVIDER_CONFIG)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Proveedor IA no soportado.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!model || !SAFE_MODEL_RE.test(model) || !payload || typeof payload !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Parámetros de modelo o payload IA inválidos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cfg = PROVIDER_CONFIG[provider];
    const apiKey = String(env[cfg.envKey] || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          notConfigured: true,
          error: `Proveedor IA '${provider}' sin clave configurada en el servidor.`,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (provider === 'gemini') {
      const targetUrl = `${cfg.endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = context.request.headers.get('Origin') || 'https://cisco-automated.pages.dev';
      headers['X-Title'] = 'Cisco Automated ConfigurIAtor';
    }

    const upstream = await fetch(cfg.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, model }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error interno en proxy IA.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
