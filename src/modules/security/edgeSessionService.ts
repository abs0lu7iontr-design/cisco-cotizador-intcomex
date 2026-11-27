// ============================================================================
// CISCO AUTOMATED - EDGE SESSION TOKEN CLIENT MANAGER
// Stores short-lived server-signed Edge session tokens in sessionStorage
// (never persists raw passwords) to authenticate /api/cisco-proxy & /api/deal-reminder-cron.
// ============================================================================

import { signInFirebaseWithCustomToken, signOutFirebaseAuth } from '../cloud/firebaseConfig';

const EDGE_SESSION_STORAGE_KEY = 'cisco_edge_session_v1';

interface StoredEdgeSession {
  token: string;
  expiresAt: number;
  username: string;
}

let memorySession: StoredEdgeSession | null = null;

export function getEdgeSessionToken(): string | null {
  const now = Date.now();
  if (memorySession && memorySession.expiresAt > now + 30_000) {
    return memorySession.token;
  }
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(EDGE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEdgeSession;
    if (parsed?.token && parsed.expiresAt > now + 30_000) {
      memorySession = parsed;
      return parsed.token;
    }
    sessionStorage.removeItem(EDGE_SESSION_STORAGE_KEY);
  } catch {}
  return null;
}

export function getEdgeSessionHeaders(): Record<string, string> {
  const token = getEdgeSessionToken();
  return token ? { 'X-Session-Token': token } : {};
}

export function setEdgeSessionToken(token: string, expiresAt: number, username: string): void {
  const record: StoredEdgeSession = {
    token,
    expiresAt: Number(expiresAt) || Date.now() + 12 * 60 * 60 * 1000,
    username,
  };
  memorySession = record;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(EDGE_SESSION_STORAGE_KEY, JSON.stringify(record));
    } catch {}
  }
}

export function clearEdgeSessionToken(): void {
  memorySession = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(EDGE_SESSION_STORAGE_KEY);
    } catch {}
  }
}

export async function logoutEdgeSession(): Promise<void> {
  const headers = getEdgeSessionHeaders();
  clearEdgeSessionToken();
  await signOutFirebaseAuth();
  if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
    return;
  }
  try {
    await fetch('/api/session-auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch {}
}

export interface EdgeSessionAuthResult {
  success: boolean;
  requires2FA?: boolean;
  twoFactorChallenge?: string;
  geo?: {
    country: string;
    city: string;
    region: string;
    ip: string;
    isChile: boolean;
    requires2FA: boolean;
  };
  user?: {
    username: string;
    role: string;
    full_name: string;
    email: string;
  };
  firebaseCustomToken?: string;
  error?: string;
  status?: number;
  isEdgeUnavailable?: boolean;
}

export async function requestEdgeSessionToken(
  username: string,
  password: string,
  options?: { turnstileToken?: string; twoFactorProof?: string; requireTurnstile?: boolean }
): Promise<EdgeSessionAuthResult> {
  if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
    return { success: false, isEdgeUnavailable: true };
  }
  try {
    const res = await fetch('/api/session-auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        ...(options?.turnstileToken ? { turnstileToken: options.turnstileToken } : {}),
        ...(options?.twoFactorProof ? { twoFactorProof: options.twoFactorProof } : {}),
        ...(options?.requireTurnstile !== undefined ? { requireTurnstile: options.requireTurnstile } : {}),
      }),
    });

    if (res.status === 404 || res.status === 405) {
      return { success: false, status: res.status, isEdgeUnavailable: true };
    }

    const data: any = await res.json().catch(() => null);
    if (!data) {
      return { success: false, status: res.status, isEdgeUnavailable: res.status >= 500 };
    }

    if (res.ok && data.requires2FA) {
      return {
        success: false,
        requires2FA: true,
        twoFactorChallenge: data.twoFactorChallenge,
        geo: data.geo,
        user: data.user,
        error: data.error,
        status: res.status,
      };
    }

    if (res.ok && data.success && data.sessionToken) {
      setEdgeSessionToken(data.sessionToken, data.expiresAt, username);
      if (data.firebaseCustomToken) {
        await signInFirebaseWithCustomToken(data.firebaseCustomToken);
      }
      return {
        success: true,
        user: data.user,
        firebaseCustomToken: data.firebaseCustomToken,
        status: res.status,
      };
    }

    return {
      success: false,
      error: data.error || 'Error de autenticación Edge.',
      status: res.status,
    };
  } catch {
    return { success: false, isEdgeUnavailable: true };
  }
}
