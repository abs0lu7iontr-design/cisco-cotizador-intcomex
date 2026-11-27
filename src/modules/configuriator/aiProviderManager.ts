// ============================================================================
// CISCO AUTOMATED v2.1 - MULTI-PROVIDER AI & KEY ROTATION MANAGER
// Prioridad #1: IA Multimodal (Gemini 3.5/3.8 Flash + OpenRouter Auto/DeepSeek)
// Incluye auto-migración de modelos deprecados (2.5 -> 3.5/3.8) y auto-provisión
// cuando se ingresa una Provisioning Key de OpenRouter.
// ============================================================================

export type AiProviderId = 'gemini' | 'openrouter' | 'groq' | 'deepseek' | 'local_deterministic';

export interface ApiKeyEntry {
  id: string;
  provider: Exclude<AiProviderId, 'local_deterministic'>;
  label: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  lastStatus?: 'ok' | 'quota_exceeded' | 'invalid' | 'untested';
  lastError?: string;
  lastUsedAt?: string;
}

export interface AiConfigSettings {
  preferredOrder: AiProviderId[];
  useCiscoOfficialGrounding: boolean; // Consultar páginas oficiales cisco.com para EOL 2026
  autoFallbackToLocal: boolean;        // Desactivado por defecto para priorizar siempre la IA
  keys: ApiKeyEntry[];
}

const AI_CONFIG_STORAGE_KEY = 'cisco_configuriator_ai_settings_v2';
const LEGACY_STORAGE_KEY_V1 = 'cisco_configuriator_ai_settings_v1';
const LEGACY_GEMINI_KEY = 'cisco_gemini_api_key';

export const EDGE_AI_SENTINEL = '__EDGE_MANAGED__';

// Prefijos heredados de versiones anteriores que deben purgarse del caché del navegador
const LEGACY_EXPOSED_SEED_PREFIXES = [
  'AQ.Ab8RN6',
  'sk-or-v1-b20c3b7e',
  'sk-or-v1-f946b521696ae58a',
];

function isLegacyExposedSeed(key: string): boolean {
  const clean = (key || '').trim();
  return LEGACY_EXPOSED_SEED_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

export const PROVIDER_META: Record<
  Exclude<AiProviderId, 'local_deterministic'>,
  {
    name: string;
    badge: string;
    defaultModel: string;
    models: { id: string; label: string; supportsVision: boolean }[];
    getKeyUrl: string;
    placeholder: string;
  }
> = {
  gemini: {
    name: 'Google Gemini (Oficial Multimodal + Cisco.com)',
    badge: 'Prioridad #1 (3.6 Flash Visión / 3.5 Flash Lite)',
    defaultModel: 'gemini-3.6-flash',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Prioridad #1 Multimodal Visión + Texto • Estable)', supportsVision: true },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Ultra Rápido • Máxima Resiliencia)', supportsVision: true },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Equilibrado)', supportsVision: true },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Rápido)', supportsVision: true },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest (Fallback)', supportsVision: true },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Lenguaje Natural)', supportsVision: false },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Última Generación)', supportsVision: true },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Razonamiento Complejo Preventa)', supportsVision: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Razonamiento Lógico Profundo • 1M Contexto)', supportsVision: true },
    ],
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AQ.... o AIzaSy...',
  },
  openrouter: {
    name: 'OpenRouter (Auto Multimodal / DeepSeek / GPT / Qwen)',
    badge: 'Failover Automático (Texto + Visión)',
    defaultModel: 'openrouter/auto',
    models: [
      { id: 'openrouter/auto', label: 'OpenRouter Auto Router (Óptimo para Texto e Imagen)', supportsVision: true },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 Reasoner (Razonamiento Profundo)', supportsVision: false },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (Chat Rápido y Preciso)', supportsVision: false },
      { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet (Arquitecto Enterprise Multimodal)', supportsVision: true },
      { id: 'openai/gpt-4o', label: 'GPT-4o Multimodal (OpenAI)', supportsVision: true },
      { id: 'qwen/qwen2.5-vl-72b-instruct:free', label: 'Qwen 2.5 VL 72B (Gratuito + Visión)', supportsVision: true },
    ],
    getKeyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
  },
  groq: {
    name: 'Groq Cloud (Llama 4 Scout / Llama 3.3)',
    badge: 'Tier Gratuito Rápido',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Texto + Imágenes)', supportsVision: true },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Texto)', supportsVision: false },
    ],
    getKeyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
  },
  deepseek: {
    name: 'DeepSeek Oficial API',
    badge: 'DeepSeek V3 / R1',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek-V3 (deepseek-chat)', supportsVision: false },
      { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (deepseek-reasoner)', supportsVision: false },
    ],
    getKeyUrl: 'https://platform.deepseek.com/api_keys',
    placeholder: 'sk-...',
  },
};

export function getDefaultAiSettings(): AiConfigSettings {
  return {
    preferredOrder: ['gemini', 'openrouter', 'groq', 'deepseek'],
    useCiscoOfficialGrounding: true,
    autoFallbackToLocal: true, // Fallback automático al proxy Edge o motor determinístico local
    keys: [],
  };
}

/**
 * Normaliza configuraciones IA, migra modelos deprecados y purga cualquier semilla expuesta heredada.
 */
export function sanitizeAndMigrateSettings(rawSettings: AiConfigSettings): AiConfigSettings {
  const defaults = getDefaultAiSettings();
  const migratedKeys: ApiKeyEntry[] = [];

  for (const k of rawSettings.keys || []) {
    if (!k || !k.apiKey) continue;
    const cleanKey = k.apiKey.trim();
    if (!cleanKey || isLegacyExposedSeed(cleanKey)) {
      continue;
    }

    let model = k.model;
    if (
      k.provider === 'gemini' &&
      (model === 'gemini-2.5-flash' ||
        model === 'gemini-2.5-pro' ||
        model === 'gemini-2.0-flash' ||
        model === 'gemini-3.7-flash' ||
        model === 'gemini-3.8-flash' ||
        !model)
    ) {
      model = 'gemini-3.6-flash';
    }

    migratedKeys.push({
      ...k,
      apiKey: cleanKey,
      model,
      lastStatus: k.lastStatus === 'invalid' ? 'untested' : k.lastStatus,
      lastError: undefined,
    });
  }

  migratedKeys.sort((a, b) => {
    if (a.provider === 'gemini' && b.provider !== 'gemini') return -1;
    if (a.provider !== 'gemini' && b.provider === 'gemini') return 1;
    return 0;
  });

  return {
    ...defaults,
    ...rawSettings,
    autoFallbackToLocal: rawSettings.autoFallbackToLocal ?? true,
    keys: migratedKeys,
  };
}

export function loadAiSettings(): AiConfigSettings {
  const sessionStore = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  const legacyLocal = typeof localStorage !== 'undefined' ? localStorage : null;
  try {
    const rawSession = sessionStore?.getItem(AI_CONFIG_STORAGE_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as AiConfigSettings;
      if (parsed && Array.isArray(parsed.keys)) {
        return sanitizeAndMigrateSettings(parsed);
      }
    }
    const rawV2 = legacyLocal?.getItem(AI_CONFIG_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as AiConfigSettings;
      if (parsed && Array.isArray(parsed.keys)) {
        const migrated = sanitizeAndMigrateSettings(parsed);
        saveAiSettings(migrated);
        legacyLocal?.removeItem(AI_CONFIG_STORAGE_KEY);
        legacyLocal?.removeItem(LEGACY_GEMINI_KEY);
        return migrated;
      }
    }
    // Migrar desde V1 si existía
    const rawV1 = legacyLocal?.getItem(LEGACY_STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as AiConfigSettings;
      const migrated = sanitizeAndMigrateSettings(parsedV1);
      saveAiSettings(migrated);
      legacyLocal?.removeItem(LEGACY_STORAGE_KEY_V1);
      legacyLocal?.removeItem(LEGACY_GEMINI_KEY);
      return migrated;
    }
  } catch (err) {
    console.warn('[AiProviderManager] Error leyendo configuración IA:', err);
  }
  const initial = getDefaultAiSettings();
  saveAiSettings(initial);
  return initial;
}

export function saveAiSettings(settings: AiConfigSettings): void {
  try {
    const raw = JSON.stringify(settings);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AI_CONFIG_STORAGE_KEY, raw);
    }
    // Limpiar claves BYOK heredadas de localStorage para no dejar API keys persistentes en claro
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    }

    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.save_ai_config === 'function') {
      Promise.resolve(pyApi.save_ai_config(raw)).catch(() => {});
    }
  } catch (err) {
    console.warn('[AiProviderManager] Error guardando configuración IA:', err);
  }
}

export async function syncAiSettingsFromDesktopBridge(): Promise<AiConfigSettings> {
  const local = loadAiSettings();
  try {
    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.get_ai_config === 'function') {
      const res = await pyApi.get_ai_config();
      if (res && res.success && res.config && Array.isArray(res.config.keys)) {
        const mergedKeys = [...local.keys];
        for (const diskKey of res.config.keys as ApiKeyEntry[]) {
          if (
            diskKey.apiKey &&
            !mergedKeys.some((k) => k.apiKey.trim() === diskKey.apiKey.trim() && k.provider === diskKey.provider)
          ) {
            mergedKeys.push(diskKey);
          }
        }
        const merged = sanitizeAndMigrateSettings({
          ...local,
          ...res.config,
          keys: mergedKeys,
        });
        saveAiSettings(merged);
        return merged;
      }
    }
  } catch (_) {}
  return local;
}

export function markApiKeyStatus(
  keyId: string,
  status: 'ok' | 'quota_exceeded' | 'invalid',
  errorMsg?: string
): AiConfigSettings {
  const current = loadAiSettings();
  const updated: AiConfigSettings = {
    ...current,
    keys: current.keys.map((k) =>
      k.id === keyId
        ? {
            ...k,
            lastStatus: status,
            lastError: errorMsg,
            lastUsedAt: new Date().toISOString(),
          }
        : k
    ),
  };
  saveAiSettings(updated);
  return updated;
}

export function addApiKeyToPool(entry: {
  provider: Exclude<AiProviderId, 'local_deterministic'>;
  label?: string;
  apiKey: string;
  model?: string;
}): AiConfigSettings {
  const current = loadAiSettings();
  const cleanKey = entry.apiKey.trim();
  if (!cleanKey) return current;

  const meta = PROVIDER_META[entry.provider];
  const newEntry: ApiKeyEntry = {
    id: `key-${entry.provider}-${Date.now()}`,
    provider: entry.provider,
    label: entry.label?.trim() || `${meta.name.split(' ')[0]} Key #${current.keys.length + 1}`,
    apiKey: cleanKey,
    model: entry.model || meta.defaultModel,
    enabled: true,
    lastStatus: 'untested',
  };

  const nextSettings = sanitizeAndMigrateSettings({
    ...current,
    keys: [...current.keys, newEntry],
  });
  saveAiSettings(nextSettings);
  return nextSettings;
}
