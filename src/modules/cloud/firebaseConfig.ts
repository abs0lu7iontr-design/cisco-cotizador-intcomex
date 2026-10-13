// ============================================================================
// CISCO AUTOMATED - FIREBASE FIRESTORE INITIALIZATION & PROJECT ISOLATION (v10+)
// Consumes environment variables dynamically with per-project instance & cache isolation
// ============================================================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseCustomConfig } from './types';

export const STORAGE_KEY_CUSTOM_CONFIG = 'cisco_firebase_custom_config';

export interface ProjectExecutionContext {
  projectId: string;
  projectScopeKey: string;
  fingerprint: string;
  epoch: number;
}

type ProjectCleanupCallback = (prevProjectId: string, nextProjectId: string) => void;

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreDbInstance: Firestore | null = null;
let activeConfigFingerprint: string | null = null;
let activeProjectEpoch = 1;

const projectInstancesByFingerprint = new Map<
  string,
  { app: FirebaseApp; db: Firestore; config: FirebaseCustomConfig }
>();
const activeListenersRegistry = new Map<string, () => void>();
const cleanupCallbacksRegistry = new Set<ProjectCleanupCallback>();

/**
 * Reads environment variables injected by Vite based on the active mode (.env.development / .env.production)
 */
export function getEnvFirebaseConfig(): FirebaseCustomConfig {
  const env =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env
      : ({} as Record<string, string>);

  return {
    apiKey: (env.VITE_FIREBASE_API_KEY as string) || '',
    authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
    projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || '',
    storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
    messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
    appId: (env.VITE_FIREBASE_APP_ID as string) || '',
    measurementId: (env.VITE_FIREBASE_MEASUREMENT_ID as string) || '',
  };
}

/**
 * Normalizes a projectId into a safe, deterministic storage/app scope key.
 */
export function normalizeProjectScopeKey(projectId?: string): string {
  const defaultPid = getEnvFirebaseConfig().projectId || 'default_local';
  const raw = String(projectId !== undefined ? projectId : defaultPid).trim();
  const clean = (raw || 'default_local').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return clean || 'default_local';
}

/**
 * Computes a deterministic fingerprint for a FirebaseCustomConfig so changes in
 * projectId, apiKey, or appId trigger clean instance switching.
 */
export function computeFirebaseConfigFingerprint(config: FirebaseCustomConfig): string {
  const pid = normalizeProjectScopeKey(config?.projectId);
  const api = String(config?.apiKey || '').trim();
  const appId = String(config?.appId || '').trim();
  return `${pid}::${api}::${appId}`;
}

export function getActiveFirebaseConfig(): FirebaseCustomConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_CONFIG);
      if (custom) {
        const parsed = JSON.parse(custom);
        if (parsed && parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      }
    }
  } catch (_) {}

  return getEnvFirebaseConfig();
}

/**
 * Returns the active project scope key (e.g. 'cisco_automated' or custom project ID).
 */
export function getActiveProjectScopeKey(): string {
  return normalizeProjectScopeKey(getActiveFirebaseConfig().projectId);
}

/**
 * Returns whether the given projectId (or current active project) is the default environment project.
 * If no custom config is stored in `STORAGE_KEY_CUSTOM_CONFIG`, or if the custom config has the same
 * projectId as the environment default, it is treated as the default project.
 */
export function isDefaultFirebaseProject(projectId?: string): boolean {
  const envPid = normalizeProjectScopeKey(getEnvFirebaseConfig().projectId);
  if (projectId !== undefined) {
    return normalizeProjectScopeKey(projectId) === envPid;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_CONFIG);
      if (!custom) return true;
      const parsed = JSON.parse(custom);
      if (parsed && parsed.projectId) {
        return normalizeProjectScopeKey(parsed.projectId) === envPid;
      }
    }
  } catch (_) {}
  return true;
}

/**
 * Captures the current project execution context before starting an async operation.
 * Used with `isProjectContextCurrent(ctx)` to discard late responses after a project switch.
 */
export function captureProjectContext(): ProjectExecutionContext {
  const cfg = getActiveFirebaseConfig();
  return {
    projectId: cfg.projectId || 'default_local',
    projectScopeKey: normalizeProjectScopeKey(cfg.projectId),
    fingerprint: computeFirebaseConfigFingerprint(cfg),
    epoch: activeProjectEpoch,
  };
}

/**
 * Verifies whether a captured project context is still the active project context.
 * Returns false if the user switched projects (or if epoch advanced due to project switch).
 */
export function isProjectContextCurrent(
  captured: Pick<ProjectExecutionContext, 'projectId'> & { epoch?: number; fingerprint?: string }
): boolean {
  if (!captured) return false;
  const currentCfg = getActiveFirebaseConfig();
  const currentScope = normalizeProjectScopeKey(currentCfg.projectId);
  const capturedScope = normalizeProjectScopeKey(captured.projectId);
  if (currentScope !== capturedScope) return false;
  if (captured.epoch !== undefined && captured.epoch !== activeProjectEpoch) return false;
  if (
    captured.fingerprint !== undefined &&
    captured.fingerprint !== computeFirebaseConfigFingerprint(currentCfg)
  ) {
    return false;
  }
  return true;
}

/**
 * Registers an active real-time listener or background subscription tied to the current project.
 * Automatically unsubscribed when the active Firebase project changes.
 */
export function registerProjectListener(listenerId: string, unsubscribe: () => void): () => void {
  const existing = activeListenersRegistry.get(listenerId);
  if (existing) {
    try {
      existing();
    } catch {}
  }
  activeListenersRegistry.set(listenerId, unsubscribe);
  return () => {
    const current = activeListenersRegistry.get(listenerId);
    if (current === unsubscribe) {
      activeListenersRegistry.delete(listenerId);
    }
  };
}

/**
 * Registers a cleanup callback invoked whenever the active Firebase project switches.
 */
export function registerProjectScopedCleanup(callback: ProjectCleanupCallback): () => void {
  cleanupCallbacksRegistry.add(callback);
  return () => {
    cleanupCallbacksRegistry.delete(callback);
  };
}

/**
 * Returns the count of currently active project listeners (for QA & diagnostics).
 */
export function getActiveProjectListenerCount(): number {
  return activeListenersRegistry.size;
}

/**
 * Returns the current active project epoch counter (for diagnostics and QA verification).
 */
export function getActiveProjectEpoch(): number {
  return activeProjectEpoch;
}

function notifyProjectSwitch(prevProjectId: string, nextProjectId: string): void {
  activeProjectEpoch += 1;

  for (const [id, unsub] of Array.from(activeListenersRegistry.entries())) {
    try {
      unsub();
    } catch (e) {
      console.warn(`[FirebaseConfig] Error unsubscribing listener ${id}:`, e);
    }
    activeListenersRegistry.delete(id);
  }

  for (const cb of Array.from(cleanupCallbacksRegistry)) {
    try {
      cb(prevProjectId, nextProjectId);
    } catch (e) {
      console.warn('[FirebaseConfig] Error in project cleanup callback:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('cisco-firebase-project-switched', {
          detail: { prevProjectId, nextProjectId, epoch: activeProjectEpoch },
        })
      );
      window.dispatchEvent(new CustomEvent('cisco-estimates-mirror-updated'));
    } catch {}
  }
}

/**
 * Computes a project-scoped localStorage key.
 * - For the default project, returns the baseKey (unless `forceScopedKey` is true).
 * - For any non-default custom project, returns `${baseKey}__proj_${scopeKey}` so caches never mix.
 */
export function getScopedStorageKey(
  baseKey: string,
  projectId?: string,
  forceScopedKey: boolean = false
): string {
  const isDef =
    projectId !== undefined ? isDefaultFirebaseProject(projectId) : isDefaultFirebaseProject();
  if (!forceScopedKey && isDef) {
    return baseKey;
  }
  const scopeKey = normalizeProjectScopeKey(projectId ?? getActiveFirebaseConfig().projectId);
  return `${baseKey}__proj_${scopeKey}`;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined') {
      const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      if (desc && 'value' in desc && desc.value && typeof desc.value.getItem === 'function') {
        return desc.value as Storage;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Reads a value from project-scoped localStorage without destructive re-attribution.
 * - Default project reads the legacy `baseKey` (and falls back to explicit `__proj_<default>` if present).
 * - Non-default projects read ONLY their isolated `${baseKey}__proj_${scopeKey}`.
 */
export function readProjectScopedStorage(baseKey: string, projectId?: string): string | null {
  try {
    const storage = getSafeStorage();
    if (!storage) return null;
    const isDef =
      projectId !== undefined ? isDefaultFirebaseProject(projectId) : isDefaultFirebaseProject();
    const scopeKey = normalizeProjectScopeKey(projectId ?? getActiveFirebaseConfig().projectId);
    const explicitScopedKey = `${baseKey}__proj_${scopeKey}`;
    if (isDef) {
      return storage.getItem(baseKey) ?? storage.getItem(explicitScopedKey);
    }
    return storage.getItem(explicitScopedKey);
  } catch {
    return null;
  }
}

/**
 * Writes a value to project-scoped localStorage.
 * - Default project writes to `baseKey` (preserving 100% compatibility with legacy readers).
 * - Non-default projects write ONLY to `${baseKey}__proj_${scopeKey}`, leaving default project data untouched.
 */
export function writeProjectScopedStorage(
  baseKey: string,
  value: string,
  projectId?: string
): void {
  try {
    const storage = getSafeStorage();
    if (!storage) return;
    const isDef =
      projectId !== undefined ? isDefaultFirebaseProject(projectId) : isDefaultFirebaseProject();
    const scopeKey = normalizeProjectScopeKey(projectId ?? getActiveFirebaseConfig().projectId);
    const explicitScopedKey = `${baseKey}__proj_${scopeKey}`;
    if (isDef) {
      storage.setItem(baseKey, value);
    } else {
      storage.setItem(explicitScopedKey, value);
    }
  } catch {}
}

export function saveActiveFirebaseConfig(config: FirebaseCustomConfig) {
  const prevConfig = getActiveFirebaseConfig();
  const prevFingerprint = computeFirebaseConfigFingerprint(prevConfig);
  const nextFingerprint = computeFirebaseConfigFingerprint(config);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_CONFIG, JSON.stringify(config));
    }
  } catch (_) {}

  firebaseAppInstance = null;
  firestoreDbInstance = null;
  activeConfigFingerprint = null;

  if (prevFingerprint !== nextFingerprint) {
    notifyProjectSwitch(prevConfig.projectId || 'default_local', config.projectId || 'default_local');
  }
}

export function resetToDefaultFirebaseConfig() {
  const prevConfig = getActiveFirebaseConfig();
  const prevFingerprint = computeFirebaseConfigFingerprint(prevConfig);
  const envConfig = getEnvFirebaseConfig();
  const nextFingerprint = computeFirebaseConfigFingerprint(envConfig);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_CONFIG);
    }
  } catch (_) {}

  firebaseAppInstance = null;
  firestoreDbInstance = null;
  activeConfigFingerprint = null;

  if (prevFingerprint !== nextFingerprint) {
    notifyProjectSwitch(
      prevConfig.projectId || 'default_local',
      envConfig.projectId || 'default_local'
    );
  }
}

export function getFirestoreInstance(): {
  db: Firestore | null;
  isReady: boolean;
  error: string | null;
  projectId?: string;
  epoch?: number;
} {
  try {
    const config = getActiveFirebaseConfig();
    if (!config.projectId || !config.apiKey) {
      return {
        db: null,
        isReady: false,
        error: 'Credenciales de Firebase no configuradas en variables de entorno.',
        projectId: config.projectId,
        epoch: activeProjectEpoch,
      };
    }

    const fingerprint = computeFirebaseConfigFingerprint(config);
    if (firestoreDbInstance && activeConfigFingerprint === fingerprint) {
      return {
        db: firestoreDbInstance,
        isReady: true,
        error: null,
        projectId: config.projectId,
        epoch: activeProjectEpoch,
      };
    }

    const cached = projectInstancesByFingerprint.get(fingerprint);
    if (cached) {
      firebaseAppInstance = cached.app;
      firestoreDbInstance = cached.db;
      activeConfigFingerprint = fingerprint;
      return {
        db: firestoreDbInstance,
        isReady: true,
        error: null,
        projectId: config.projectId,
        epoch: activeProjectEpoch,
      };
    }

    const scopeKey = normalizeProjectScopeKey(config.projectId);
    const appName = isDefaultFirebaseProject(config.projectId)
      ? '[DEFAULT]'
      : `cisco-automated-proj-${scopeKey}`;

    const existingApps = getApps();
    const matchingApp = existingApps.find((a) => a.name === appName);

    firebaseAppInstance = matchingApp
      ? matchingApp
      : appName === '[DEFAULT]'
      ? initializeApp(config)
      : initializeApp(config, appName);

    firestoreDbInstance = getFirestore(firebaseAppInstance);
    activeConfigFingerprint = fingerprint;
    projectInstancesByFingerprint.set(fingerprint, {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      config,
    });

    return {
      db: firestoreDbInstance,
      isReady: true,
      error: null,
      projectId: config.projectId,
      epoch: activeProjectEpoch,
    };
  } catch (err: any) {
    console.warn('[Firebase Cloud Layer Note]: Initializing Firestore fallback:', err?.message || err);
    return {
      db: null,
      isReady: false,
      error: err?.message || 'Error inicializando Firestore',
      epoch: activeProjectEpoch,
    };
  }
}