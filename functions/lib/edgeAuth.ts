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
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  ALLOWED_REMINDER_DOMAINS?: string;
}

export interface EdgeSessionPayload {
  u: string; // username
  r: string; // role
  jti: string; // unique revocable session id
  iat: number;
  exp: number;
}

const EDGE_SESSION_COOKIE_NAME = 'cisco_edge_session';
const PBKDF2_ITERATIONS = 310000;
const revokedJtiMemory = new Map<string, number>();
const rateLimitMemory = new Map<string, { count: number; resetAt: number }>();

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

export async function hashPasswordPbkdf2Server(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

async function verifyPbkdf2Server(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expectedHex = parts[3].toLowerCase();
  if (!Number.isFinite(iterations) || iterations < 10000 || !/^[0-9a-f]{16,64}$/i.test(saltHex) || !/^[0-9a-f]{64}$/.test(expectedHex)) {
    return false;
  }
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256
  );
  const actualHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqualStr(actualHex, expectedHex);
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

export async function deriveScopedEdgeSecret(
  env: EdgeEnv,
  scope: string,
  preferredKey?: keyof EdgeEnv
): Promise<string | null> {
  const preferredVal = preferredKey ? String(env[preferredKey] || '') : '';
  const rawMaster = (
    preferredVal ||
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

let cachedAdminToken: { token: string; expiresAt: number } | null = null;

export async function getFirebaseAdminAccessToken(serviceAccountJson?: string): Promise<string | null> {
  if (!serviceAccountJson || !serviceAccountJson.trim()) return null;
  if (cachedAdminToken && Date.now() < cachedAdminToken.expiresAt - 60_000) {
    return cachedAdminToken.token;
  }
  try {
    const sa = JSON.parse(serviceAccountJson);
    const clientEmail = String(sa.client_email || '').trim();
    const privateKeyPem = String(sa.private_key || '').trim();
    const tokenUri = String(sa.token_uri || 'https://oauth2.googleapis.com/token').trim();
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
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: tokenUri,
        iat: now,
        exp: now + 3600,
      })
    );
    const signingInput = `${header}.${payload}`;
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
    const assertion = `${signingInput}.${toBase64Url(new Uint8Array(sigBuf))}`;

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    if (!data?.access_token) return null;
    cachedAdminToken = {
      token: String(data.access_token),
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return cachedAdminToken.token;
  } catch {
    return null;
  }
}

export type FirestoreUserLookupResult =
  | { status: 'ok'; user: FirestoreUserInfo }
  | { status: 'not_found' }
  | { status: 'backend_error'; httpStatus: number };

export async function fetchFirestoreUserRecordDetailed(
  projectId: string,
  username: string,
  serviceAccountJson?: string
): Promise<FirestoreUserLookupResult> {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !/^[a-z0-9._-]{1,64}$/.test(cleanUser)) {
    return { status: 'not_found' };
  }
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(cleanUser)}`;
  const adminToken = await getFirebaseAdminAccessToken(serviceAccountJson);
  const res = await fetch(firestoreUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 404) {
      return { status: 'not_found' };
    }
    return { status: 'backend_error', httpStatus: res.status };
  }
  const docJson: any = await res.json().catch(() => null);
  const fields = docJson?.fields;
  if (!fields) return { status: 'not_found' };

  const isActiveRaw = fields.is_active?.integerValue ?? fields.is_active?.doubleValue ?? '0';
  return {
    status: 'ok',
    user: {
      username: String(fields.username?.stringValue || cleanUser).trim().toLowerCase(),
      role: String(fields.role?.stringValue || '').trim().toLowerCase(),
      is_active: Number(isActiveRaw),
      password_hash: String(fields.password_hash?.stringValue || '').trim(),
      email: String(fields.email?.stringValue || '').trim(),
      full_name: String(fields.full_name?.stringValue || cleanUser).trim(),
    },
  };
}

export async function fetchFirestoreUserRecord(
  projectId: string,
  username: string,
  serviceAccountJson?: string
): Promise<FirestoreUserInfo | null> {
  const result = await fetchFirestoreUserRecordDetailed(projectId, username, serviceAccountJson);
  return result.status === 'ok' ? result.user : null;
}

export type VerifyCredentialsResult =
  | { status: 'ok'; user: FirestoreUserInfo }
  | { status: 'invalid' }
  | { status: 'backend_error'; httpStatus: number };

export async function verifyFirestoreUserCredentialsDetailed(
  projectId: string,
  username: string,
  password: string,
  requiredRole?: string,
  serviceAccountJson?: string
): Promise<VerifyCredentialsResult> {
  const cleanPass = password.trim();
  if (!cleanPass) return { status: 'invalid' };

  const lookup = await fetchFirestoreUserRecordDetailed(projectId, username, serviceAccountJson);
  if (lookup.status === 'backend_error') {
    return { status: 'backend_error', httpStatus: lookup.httpStatus };
  }
  if (lookup.status !== 'ok') {
    return { status: 'invalid' };
  }

  const record = lookup.user;
  if (record.is_active !== 1 || !record.password_hash) {
    return { status: 'invalid' };
  }
  if (requiredRole && record.role !== requiredRole) {
    return { status: 'invalid' };
  }

  if (record.password_hash.startsWith('pbkdf2$')) {
    const pbkdf2Ok = await verifyPbkdf2Server(cleanPass, record.password_hash);
    return pbkdf2Ok ? { status: 'ok', user: record } : { status: 'invalid' };
  }

  const perUserHash = await sha256SaltedServer(cleanPass, record.username);
  const legacyHash = await sha256SaltedServer(cleanPass);
  const isMatch =
    timingSafeEqualStr(record.password_hash, perUserHash) ||
    timingSafeEqualStr(record.password_hash, legacyHash);

  return isMatch ? { status: 'ok', user: record } : { status: 'invalid' };
}

export async function verifyFirestoreUserCredentials(
  projectId: string,
  username: string,
  password: string,
  requiredRole?: string,
  serviceAccountJson?: string
): Promise<FirestoreUserInfo | null> {
  const res = await verifyFirestoreUserCredentialsDetailed(
    projectId,
    username,
    password,
    requiredRole,
    serviceAccountJson
  );
  return res.status === 'ok' ? res.user : null;
}

export async function upgradeFirestoreUserLoginMetadata(
  projectId: string,
  username: string,
  upgradedPbkdf2Hash?: string,
  serviceAccountJson?: string
): Promise<void> {
  const adminToken = await getFirebaseAdminAccessToken(serviceAccountJson);
  if (!adminToken) return;
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !/^[a-z0-9._-]{1,64}$/.test(cleanUser)) return;

  const updateMasks = ['updateMask.fieldPaths=last_login'];
  const fields: Record<string, { stringValue: string }> = {
    last_login: { stringValue: new Date().toISOString() },
  };
  if (upgradedPbkdf2Hash && upgradedPbkdf2Hash.startsWith('pbkdf2$')) {
    updateMasks.push('updateMask.fieldPaths=password_hash');
    fields.password_hash = { stringValue: upgradedPbkdf2Hash };
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/users/${encodeURIComponent(cleanUser)}?${updateMasks.join('&')}`;

  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ fields }),
  }).catch(() => {});
}

function generateRandomHex(bytesLen = 8): string {
  const arr = new Uint8Array(bytesLen);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkEdgeRateLimit(
  bucket: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const cacheKey = `https://edge-ratelimit.internal/${await sha256Hex(bucket)}`;
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;

  let current = rateLimitMemory.get(bucket);
  if (!current || now >= current.resetAt) {
    if (cacheStorage) {
      try {
        const cached = await cacheStorage.match(cacheKey);
        if (cached) {
          const parsed: any = await cached.json();
          if (parsed && now < Number(parsed.resetAt)) {
            current = { count: Number(parsed.count) || 0, resetAt: Number(parsed.resetAt) };
          }
        }
      } catch {}
    }
  }

  if (!current || now >= current.resetAt) {
    current = { count: 0, resetAt: now + windowSeconds * 1000 };
  }

  current.count += 1;
  rateLimitMemory.set(bucket, current);

  if (cacheStorage) {
    try {
      const ttl = Math.max(10, Math.ceil((current.resetAt - now) / 1000));
      await cacheStorage.put(
        cacheKey,
        new Response(JSON.stringify(current), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` },
        })
      );
    } catch {}
  }

  return {
    allowed: current.count <= maxRequests,
    remaining: Math.max(0, maxRequests - current.count),
    resetAt: current.resetAt,
  };
}

export async function revokeEdgeSessionJti(jti: string, expSeconds: number): Promise<void> {
  if (!jti || !/^[0-9a-f]{8,64}$/i.test(jti)) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, expSeconds - nowSec);
  revokedJtiMemory.set(jti, Date.now() + ttl * 1000);
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (cacheStorage) {
    try {
      await cacheStorage.put(
        `https://edge-revoked-jti.internal/${jti}`,
        new Response(JSON.stringify({ revoked: true }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` },
        })
      );
    } catch {}
  }
}

export async function isEdgeSessionRevoked(jti?: string): Promise<boolean> {
  if (!jti) return false;
  const memExp = revokedJtiMemory.get(jti);
  if (memExp && Date.now() < memExp) return true;
  const cacheStorage = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (cacheStorage) {
    try {
      const res = await cacheStorage.match(`https://edge-revoked-jti.internal/${jti}`);
      if (res) return true;
    } catch {}
  }
  return false;
}

export function extractEdgeTokenFromRequest(request: Request): string {
  const cookieHeader = request.headers.get('Cookie') || '';
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      if (name === EDGE_SESSION_COOKIE_NAME) {
        const val = decodeURIComponent(part.slice(idx + 1).trim());
        if (val) return val;
      }
    }
  }
  const sessionHeader = request.headers.get('X-Session-Token')?.trim() || '';
  if (sessionHeader) return sessionHeader;
  const authHeader = request.headers.get('Authorization')?.trim() || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export function buildEdgeSessionCookie(token: string, maxAgeSeconds: number, request: Request): string {
  const isHttps = (() => {
    try {
      return new URL(request.url).protocol === 'https:';
    } catch {
      return true;
    }
  })();
  const parts = [
    `${EDGE_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
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
): Promise<{ token: string; expiresAt: number; jti: string } | null> {
  const signingKey = await deriveScopedEdgeSecret(env, 'edge-session-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const jti = generateRandomHex(8);
  const payload: EdgeSessionPayload = {
    u: username.trim().toLowerCase(),
    r: role.trim().toLowerCase() || 'user',
    jti,
    iat: now,
    exp,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = await createHmacSignature(encodedPayload, signingKey);
  return {
    token: `v1.${encodedPayload}.${sig}`,
    expiresAt: exp * 1000,
    jti,
  };
}

export async function mintTwoFactorChallengeToken(
  username: string,
  ip: string,
  env: EdgeEnv,
  ttlSeconds = 900
): Promise<string | null> {
  const signingKey = await deriveScopedEdgeSecret(env, '2fa-preauth-challenge-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const ipHash = (await sha256Hex(ip || '0.0.0.0')).slice(0, 16);
  const payload = {
    u: username.trim().toLowerCase(),
    iph: ipHash,
    n: generateRandomHex(6),
    exp: now + ttlSeconds,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = await createHmacSignature(encoded, signingKey);
  return `ch1.${encoded}.${sig}`;
}

export async function verifyTwoFactorChallengeToken(
  token: string,
  username: string,
  ip: string,
  env: EdgeEnv
): Promise<boolean> {
  if (!token) return false;
  const signingKey = await deriveScopedEdgeSecret(env, '2fa-preauth-challenge-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'ch1') return false;
  const [, encoded, sig] = parts;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expectedSig = await createHmacSignature(encoded, signingKey);
  if (!timingSafeEqualStr(sig.toLowerCase(), expectedSig.toLowerCase())) return false;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded));
    const expectedIpHash = (await sha256Hex(ip || '0.0.0.0')).slice(0, 16);
    const nowSec = Math.floor(Date.now() / 1000);
    return (
      parsed?.u === username.trim().toLowerCase() &&
      parsed?.iph === expectedIpHash &&
      Number(parsed?.exp) > nowSec
    );
  } catch {
    return false;
  }
}

export async function mintTwoFactorProofToken(
  username: string,
  ip: string,
  env: EdgeEnv,
  ttlSeconds = 300
): Promise<string | null> {
  const signingKey = await deriveScopedEdgeSecret(env, '2fa-verified-proof-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const ipHash = (await sha256Hex(ip || '0.0.0.0')).slice(0, 16);
  const payload = {
    u: username.trim().toLowerCase(),
    iph: ipHash,
    n: generateRandomHex(6),
    exp: now + ttlSeconds,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = await createHmacSignature(encoded, signingKey);
  return `pf1.${encoded}.${sig}`;
}

export async function verifyTwoFactorProofToken(
  token: string,
  username: string,
  ip: string,
  env: EdgeEnv
): Promise<boolean> {
  if (!token) return false;
  const signingKey = await deriveScopedEdgeSecret(env, '2fa-verified-proof-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'pf1') return false;
  const [, encoded, sig] = parts;
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expectedSig = await createHmacSignature(encoded, signingKey);
  if (!timingSafeEqualStr(sig.toLowerCase(), expectedSig.toLowerCase())) return false;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded));
    const expectedIpHash = (await sha256Hex(ip || '0.0.0.0')).slice(0, 16);
    const nowSec = Math.floor(Date.now() / 1000);
    return (
      parsed?.u === username.trim().toLowerCase() &&
      parsed?.iph === expectedIpHash &&
      Number(parsed?.exp) > nowSec
    );
  } catch {
    return false;
  }
}

export async function verifyEdgeSessionToken(
  request: Request,
  env: EdgeEnv
): Promise<{ valid: boolean; username?: string; role?: string; jti?: string; exp?: number; error?: string }> {
  const signingKey = await deriveScopedEdgeSecret(env, 'edge-session-v1', 'EDGE_SESSION_SECRET');
  if (!signingKey) {
    return { valid: false, error: 'Secreto de sesión Edge no configurado en el servidor.' };
  }

  const rawToken = extractEdgeTokenFromRequest(request);
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
    if (parsed.jti && (await isEdgeSessionRevoked(parsed.jti))) {
      return { valid: false, error: 'La sesión autenticada fue revocada.' };
    }
    return {
      valid: true,
      username: String(parsed.u).toLowerCase(),
      role: String(parsed.r || 'user').toLowerCase(),
      jti: parsed.jti,
      exp: Number(parsed.exp),
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
