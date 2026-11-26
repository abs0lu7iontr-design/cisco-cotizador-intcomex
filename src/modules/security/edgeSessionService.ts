// ============================================================================
// CISCO AUTOMATED - EDGE SESSION TOKEN CLIENT MANAGER
// Stores short-lived server-signed Edge session tokens in sessionStorage
// (never persists raw passwords) to authenticate /api/cisco-proxy & /api/deal-reminder-cron.
// ============================================================================

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

export async function requestEdgeSessionToken(
  username: string,
  password: string
): Promise<{ success: boolean; firebaseCustomToken?: string }> {
  if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
    return { success: false };
  }
  try {
    const res = await fetch('/api/session-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return { success: false };
    const data: any = await res.json();
    if (data?.success && data?.sessionToken) {
      setEdgeSessionToken(data.sessionToken, data.expiresAt, username);
      return {
        success: true,
        firebaseCustomToken: data.firebaseCustomToken,
      };
    }
  } catch {
    // Offline / local vite dev without Wrangler Functions
  }
  return { success: false };
}
