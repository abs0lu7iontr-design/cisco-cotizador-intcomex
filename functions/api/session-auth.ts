// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/session-auth
// Verifies user credentials against Firestore and mints an HMAC-signed Edge
// session token (plus an optional Firebase Custom Token when SA JSON exists).
// ============================================================================

import { buildEdgeCorsHeaders } from '../../src/utils/edgeCors';
import {
  EdgeEnv,
  mintEdgeSessionToken,
  mintFirebaseCustomToken,
  resolveFirebaseProjectId,
  verifyFirestoreUserCredentials,
} from '../lib/edgeAuth';

export const onRequestOptions: PagesFunction<EdgeEnv> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: buildEdgeCorsHeaders(context.request, 'POST, OPTIONS'),
  });
};

export const onRequestPost: PagesFunction<EdgeEnv> = async (context) => {
  const corsHeaders = buildEdgeCorsHeaders(context.request, 'POST, OPTIONS');
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario y contraseña requeridos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const projectId = resolveFirebaseProjectId(context.env);
    const verifiedUser = await verifyFirestoreUserCredentials(projectId, username, password);
    if (!verifiedUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciales inválidas o usuario inactivo.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const session = await mintEdgeSessionToken(verifiedUser.username, verifiedUser.role, context.env);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Servicio de sesión Edge no configurado.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const firebaseCustomToken = await mintFirebaseCustomToken(
      verifiedUser.username,
      {
        role: verifiedUser.role,
        admin: verifiedUser.role === 'admin',
        email: verifiedUser.email || undefined,
      },
      context.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        ...(firebaseCustomToken ? { firebaseCustomToken } : {}),
        user: {
          username: verifiedUser.username,
          role: verifiedUser.role,
          full_name: verifiedUser.full_name,
          email: verifiedUser.email,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error interno en autenticación Edge.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
