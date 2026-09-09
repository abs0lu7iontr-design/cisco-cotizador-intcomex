// ============================================================================
// CISCO AUTOMATED - FIREBASE FIRESTORE INITIALIZATION (MODULAR SDK v10+)
// Consumes environment variables dynamically with failsafe fallback layer
// ============================================================================

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseCustomConfig } from './types';

const STORAGE_KEY_CUSTOM_CONFIG = 'cisco_firebase_custom_config';

/**
 * Reads environment variables injected by Vite based on the active mode (.env.development / .env.production)
 */
function getEnvFirebaseConfig(): FirebaseCustomConfig {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : ({} as Record<string, string>);

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

export function getActiveFirebaseConfig(): FirebaseCustomConfig {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_CONFIG);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (_) {}

  return getEnvFirebaseConfig();
}

export function saveActiveFirebaseConfig(config: FirebaseCustomConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_CONFIG, JSON.stringify(config));
  } catch (_) {}
}

export function resetToDefaultFirebaseConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_CONFIG);
  } catch (_) {}
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreDbInstance: Firestore | null = null;

export function getFirestoreInstance(): { db: Firestore | null; isReady: boolean; error: string | null } {
  try {
    if (firestoreDbInstance) {
      return { db: firestoreDbInstance, isReady: true, error: null };
    }

    const config = getActiveFirebaseConfig();
    if (!config.projectId || !config.apiKey) {
      return { db: null, isReady: false, error: 'Credenciales de Firebase no configuradas en variables de entorno.' };
    }

    const existingApps = getApps();
    firebaseAppInstance = existingApps.length > 0 ? getApp() : initializeApp(config);
    firestoreDbInstance = getFirestore(firebaseAppInstance);

    return { db: firestoreDbInstance, isReady: true, error: null };
  } catch (err: any) {
    console.warn('[Firebase Cloud Layer Note]: Initializing Firestore fallback:', err?.message || err);
    return { db: null, isReady: false, error: err?.message || 'Error inicializando Firestore' };
  }
}