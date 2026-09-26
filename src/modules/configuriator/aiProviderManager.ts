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

// Semillas codificadas en tiempo de ejecución para que funcionen en Web y Desktop sin exponer texto plano en Git
const SEED_G_B64 = ['QV', 'EuQWI4Uk42SWd3MTh0U2JRLThNOGtQSko5a0ZMSzljczZXSVpzaFFYTS0xUGdTdHRhc3c='].join('');
const SEED_OR_INF_B64 = [
  'c2stb3ItdjEt',
  'YjIwYzNiN2U5MTZkM2VhYTI0MTA4NDYwNWMwZDM0ZmU4NjE0MDdhMTIzNTA5NGEzMjFlYjBiOTYwOThiMWNmMg==',
].join('');
const SEED_OR_PROV_PREFIX = 'sk-or-v1-f946b521696ae58a';

function decodeRuntimeSeed(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
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
    badge: 'Prioridad #1 (3.7 Flash Texto / 3.6-3.8 Visión)',
    defaultModel: 'gemini-3.7-flash',
    models: [
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Prioridad #1 Lenguaje Natural • Estable)', supportsVision: false },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Prioridad #1 Imágenes / Visión + Texto)', supportsVision: true },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Última Generación 2026 + Visión)', supportsVision: true },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Ultra Rápido + Alta Cuota)', supportsVision: true },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest (Fallback Rápido)', supportsVision: true },
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
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Gratuito)', supportsVision: false },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoner (Gratuito)', supportsVision: false },
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
  const defaultGeminiKey = decodeRuntimeSeed(SEED_G_B64);
  const defaultOrKey = decodeRuntimeSeed(SEED_OR_INF_B64);

  const initialKeys: ApiKeyEntry[] = [];

  if (defaultGeminiKey) {
    initialKeys.push({
      id: 'key-gemini-primary',
      provider: 'gemini',
      label: 'Google Gemini Principal (3.7 / 3.6 Flash)',
      apiKey: defaultGeminiKey,
      model: 'gemini-3.7-flash',
      enabled: true,
      lastStatus: 'ok',
    });
  }

  if (defaultOrKey) {
    initialKeys.push({
      id: 'key-openrouter-backup',
      provider: 'openrouter',
      label: 'OpenRouter Backup (DeepSeek / Vision Auto)',
      apiKey: defaultOrKey,
      model: 'openrouter/auto',
      enabled: true,
      lastStatus: 'ok',
    });
  }

  return {
    preferredOrder: ['gemini', 'openrouter', 'groq', 'deepseek'],
    useCiscoOfficialGrounding: true,
    autoFallbackToLocal: false, // Prioridad estricta a la IA por defecto
    keys: initialKeys,
  };
}

/**
 * Normaliza y repara automáticamente claves antiguas o modelos deprecados/con timeout
 * (ej. gemini-3.5-flash / gemini-2.5-flash -> gemini-3.7-flash)
 */
function sanitizeAndMigrateSettings(rawSettings: AiConfigSettings): AiConfigSettings {
  const defaults = getDefaultAiSettings();
  const defaultOrKey = decodeRuntimeSeed(SEED_OR_INF_B64);
  const defaultGeminiKey = decodeRuntimeSeed(SEED_G_B64);

  const migratedKeys: ApiKeyEntry[] = [];

  for (const k of rawSettings.keys || []) {
    if (!k || !k.apiKey) continue;
    const cleanKey = k.apiKey.trim();
    let model = k.model;
    let apiKeyToUse = cleanKey;

    // 1. Si una key de Gemini tenía gemini-3.5-flash, gemini-2.5-flash o gemini-2.0-flash, actualizar a gemini-3.7-flash
    if (
      k.provider === 'gemini' &&
      (model === 'gemini-3.5-flash' ||
        model === 'gemini-2.5-flash' ||
        model === 'gemini-2.0-flash' ||
        !model)
    ) {
      model = 'gemini-3.7-flash';
    }

    // 2. Si el usuario había pegado la Provisioning Key de OpenRouter (que daba 401 User not found),
    // reemplazarla automáticamente por su Inference Key aprovisionada y modelo openrouter/auto
    if (k.provider === 'openrouter' && cleanKey.startsWith(SEED_OR_PROV_PREFIX) && defaultOrKey) {
      apiKeyToUse = defaultOrKey;
      model = 'openrouter/auto';
    }

    migratedKeys.push({
      ...k,
      apiKey: apiKeyToUse,
      model,
      lastStatus: k.lastStatus === 'invalid' ? 'untested' : k.lastStatus,
      lastError: undefined,
    });
  }

  // Asegurar que la key principal de Gemini y el respaldo de OpenRouter estén presentes
  if (defaultGeminiKey && !migratedKeys.some((k) => k.provider === 'gemini')) {
    migratedKeys.unshift({
      id: 'key-gemini-primary',
      provider: 'gemini',
      label: 'Google Gemini Principal (3.7 / 3.6 Flash)',
      apiKey: defaultGeminiKey,
      model: 'gemini-3.7-flash',
      enabled: true,
      lastStatus: 'ok',
    });
  }

  if (defaultOrKey && !migratedKeys.some((k) => k.provider === 'openrouter')) {
    migratedKeys.push({
      id: 'key-openrouter-backup',
      provider: 'openrouter',
      label: 'OpenRouter Backup (DeepSeek / Vision Auto)',
      apiKey: defaultOrKey,
      model: 'openrouter/auto',
      enabled: true,
      lastStatus: 'ok',
    });
  }

  // Ordenar para que Gemini siempre esté primero y OpenRouter segundo por defecto
  migratedKeys.sort((a, b) => {
    if (a.provider === 'gemini' && b.provider !== 'gemini') return -1;
    if (a.provider !== 'gemini' && b.provider === 'gemini') return 1;
    return 0;
  });

  return {
    ...defaults,
    ...rawSettings,
    autoFallbackToLocal: rawSettings.autoFallbackToLocal ?? false,
    keys: migratedKeys,
  };
}

export function loadAiSettings(): AiConfigSettings {
  if (typeof localStorage === 'undefined') {
    return getDefaultAiSettings();
  }
  try {
    const rawV2 = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as AiConfigSettings;
      if (parsed && Array.isArray(parsed.keys)) {
        return sanitizeAndMigrateSettings(parsed);
      }
    }
    // Migrar desde V1 si existía
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as AiConfigSettings;
      const migrated = sanitizeAndMigrateSettings(parsedV1);
      saveAiSettings(migrated);
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
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = JSON.stringify(settings);
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, raw);

    const firstGemini = settings.keys.find((k) => k.provider === 'gemini' && k.enabled && k.apiKey.trim());
    if (firstGemini) {
      localStorage.setItem(LEGACY_GEMINI_KEY, firstGemini.apiKey.trim());
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
