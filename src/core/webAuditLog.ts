// ============================================================================
// CISCO AUTOMATED - WEB SESSION AUDIT LOG HELPER
// Extraído de AuditLogsView para permitir code-splitting limpio sin cargar la UI
// ============================================================================

import { AuditLog } from './types';

export const WEB_AUDIT_LOGS_STORAGE_KEY = 'cisco_web_audit_logs_v1';

export function appendWebAuditLog(username: string, action: string, details: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(WEB_AUDIT_LOGS_STORAGE_KEY);
    const current: AuditLog[] = raw ? JSON.parse(raw) : [];
    const next: AuditLog = {
      id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      username: username || 'usuario',
      action,
      details,
      created_at: new Date().toISOString(),
    };
    const updated = [next, ...(Array.isArray(current) ? current : [])].slice(0, 200);
    localStorage.setItem(WEB_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function getWebAuditLogs(): AuditLog[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const rawWeb = localStorage.getItem(WEB_AUDIT_LOGS_STORAGE_KEY);
    const parsed = rawWeb ? JSON.parse(rawWeb) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
