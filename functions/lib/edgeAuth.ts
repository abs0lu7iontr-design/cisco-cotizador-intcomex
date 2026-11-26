// ============================================================================
// CLOUDFLARE PAGES SHARED EDGE AUTH & CRYPTO HELPERS
// Zero hardcoded secret fallbacks: derives domain-separated HMAC keys from
// Cloudflare Pages environment secrets (`EDGE_SESSION_SECRET`, `NOTIFY_SECRET`,
// `ADMIN_OVERRIDE_SECRET`, `TURNSTILE_SECRET_KEY`).
// ============================================================================

export interface EdgeEnv {
  EDGE_SESSION_SECRET?: string;
  NOTIFY_SECRET?: string;
  ADMIN_OVERRIDE_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CISCO_CLIENT_ID?: string;
  CISCO_CLIENT_SECRET?: string;
  CISCO_AUTH_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  ALLOWED_REMINDER_DOMAINS?: string;
}

export interface EdgeSessionPayload {
  u: string; // username
  r: string; // role
  iat: number;
  exp: number;
}

export interface FirestoreUserInfo {
  username: string;
  role: string;
  is_active: number;
  password_hash: string;
  email: string;
  full_name: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function sha256Hex(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256SaltedServer(password: string, usernameSalt?: string): Promise<string> {
  const salt = 'Cisco_Automated_Intcomex_Salt_2026!';
  const normalizedUser = (usernameSalt || '').trim().toLowerCase();
  const payload = normalizedUser ? `${normalizedUser}:${password}:${salt}` : `${password}${salt}`;
  return sha256Hex(payload);
}

export async function createHmacSignature(payload: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveScopedEdgeSecret(env: EdgeEnv, scope: string): Promise<string | null> {
  const rawMaster = (
    env.EDGE_SESSION_SECRET ||
    env.NOTIFY_SECRET ||
    env.ADMIN_OVERRIDE_SECRET ||
    env.TURNSTILE_SECRET_KEY ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  if (!rawMaster) {
    return null;
  }
  return sha256Hex(`cisco-automated:${scope}:${rawMaster}`);
}

export function resolveFirebaseProjectId(env: EdgeEnv): string {
  return (env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || 'cisco-automated').trim();
}

export async function fetchFirestoreUserRecord(
  projectId: string,
  username: string
): Promise<FirestoreUserInfo | null> {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !/^[a-z0-9._-]{1,64}$/.test(cleanUser)) {
    return null;
  }
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(cleanUser)}`;
  const res = await fetch(firestoreUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    return null;
  }
  const docJson: any = await res.json();
  const fields = docJson?.fields;
  if (!fields) return null;

  const isActiveRaw = fields.is_active?.integerValue ?? fields.is_active?.doubleValue ?? '0';
  return {
    username: String(fields.username?.stringValue || cleanUser).trim().toLowerCase(),
    role: String(fields.role?.stringValue || '').trim().toLowerCase(),
    is_active: Number(isActiveRaw),
    password_hash: String(fields.password_hash?.stringValue || '').trim(),
    email: String(fields.email?.stringValue || '').trim(),
    full_name: String(fields.full_name?.stringValue || cleanUser).trim(),
  };
}

export async function verifyFirestoreUserCredentials(
  projectId: string,
  username: string,
  password: string,
  requiredRole?: string
): Promise<FirestoreUserInfo | null> {
  const cleanPass = password.trim();
  if (!cleanPass) return null;

  const record = await fetchFirestoreUserRecord(projectId, username);
  if (!record || record.is_active !== 1 || !record.password_hash) {
    return null;
  }
  if (requiredRole && record.role !== requiredRole) {
    return null;
  }

  const perUserHash = await sha256SaltedServer(cleanPass, record.username);
  const legacyHash = await sha256SaltedServer(cleanPass);
  const isMatch =
    timingSafeEqualStr(record.password_hash, perUserHash) ||
    timingSafeEqualStr(record.password_hash, legacyHash);

  return isMatch ? record : null;
}

function toBase64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string): string {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function mintEdgeSessionToken(
  username: string,
  role: string,
  env: EdgeEnv,
  ttlSeconds = 43200
): Promise<{ token: string; expiresAt: number } | null> {
  const signingKey = await deriveScopedEdgeSecret(env, 'edge-session-v1');
  if (!signingKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const payload: EdgeSessionPayload = {
    u: username.trim().toLowerCase(),
    r: role.trim().toLowerCase() || 'user',
    iat: now,
    exp,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = await createHmacSignature(encodedPayload, signingKey);
  return {
    token: `v1.${encodedPayload}.${sig}`,
    expiresAt: exp * 1000,
  };
}

export async function verifyEdgeSessionToken(
  request: Request,
  env: EdgeEnv
): Promise<{ valid: boolean; username?: string; role?: string; error?: string }> {
  const signingKey = await deriveScopedEdgeSecret(env, 'edge-session-v1');
  if (!signingKey) {
    return { valid: false, error: 'Secreto de sesión Edge no configurado en el servidor.' };
  }

  const sessionHeader = request.headers.get('X-Session-Token')?.trim() || '';
  const authHeader = request.headers.get('Authorization')?.trim() || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const rawToken = sessionHeader || bearerToken;

  if (!rawToken) {
    return { valid: false, error: 'Sesión autenticada requerida.' };
  }

  const parts = rawToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return { valid: false, error: 'Formato de token de sesión inválido.' };
  }

  const [, encodedPayload, providedSig] = parts;
  if (!encodedPayload || !/^[0-9a-f]{64}$/i.test(providedSig)) {
    return { valid: false, error: 'Firma de sesión inválida.' };
  }

  const expectedSig = await createHmacSignature(encodedPayload, signingKey);
  if (!timingSafeEqualStr(providedSig.toLowerCase(), expectedSig.toLowerCase())) {
    return { valid: false, error: 'Token de sesión adulterado o inválido.' };
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as EdgeSessionPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed?.u || !parsed?.exp || nowSec > Number(parsed.exp)) {
      return { valid: false, error: 'La sesión autenticada ha expirado.' };
    }
    return {
      valid: true,
      username: String(parsed.u).toLowerCase(),
      role: String(parsed.r || 'user').toLowerCase(),
    };
  } catch {
    return { valid: false, error: 'Payload de sesión corrupto.' };
  }
}

export async function mintFirebaseCustomToken(
  uid: string,
  claims: Record<string, any>,
  serviceAccountJson?: string
): Promise<string | null> {
  if (!serviceAccountJson || !serviceAccountJson.trim()) return null;
  try {
    const sa = JSON.parse(serviceAccountJson);
    const clientEmail = String(sa.client_email || '').trim();
    const privateKeyPem = String(sa.private_key || '').trim();
    if (!clientEmail || !privateKeyPem) return null;

    const pemBody = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s+/g, '');
    const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 1000);
    const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = toBase64Url(
      JSON.stringify({
        iss: clientEmail,
        sub: clientEmail,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: now,
        exp: now + 3600,
        uid,
        claims,
      })
    );

    const signingInput = `${header}.${payload}`;
    const sigBuf = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );
    const sig = toBase64Url(new Uint8Array(sigBuf));
    return `${signingInput}.${sig}`;
  } catch (err) {
    console.warn('[FirebaseCustomToken] Signing error:', err);
    return null;
  }
}
