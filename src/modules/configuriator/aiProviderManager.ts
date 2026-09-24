// ============================================================================
// CISCO AUTOMATED v2.1 - MULTI-PROVIDER AI & KEY ROTATION MANAGER
// Soporta rotación automática de API Keys (si se agotan los tokens / 429)
// y múltiples proveedores: Gemini (con Google Search Grounding en cisco.com),
// DeepSeek, Groq (Gratuito) y OpenRouter (Modelos Gratuitos: DeepSeek/Qwen/Gemini).
// ============================================================================

export type AiProviderId = 'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'local_deterministic';

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
  autoFallbackToLocal: boolean;        // Continuar con motor determinista local si se agotan todos los tokens
  keys: ApiKeyEntry[];
}

const AI_CONFIG_STORAGE_KEY = 'cisco_configuriator_ai_settings_v1';
const LEGACY_GEMINI_KEY = 'cisco_gemini_api_key';

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
    name: 'Google Gemini (Oficial + Búsqueda Cisco.com)',
    badge: 'Multimodal + Web Grounding',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado Rápido)', supportsVision: true },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Alta Cuota)', supportsVision: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Razonamiento Profundo)', supportsVision: true },
    ],
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy... o AQ....',
  },
  openrouter: {
    name: 'OpenRouter (DeepSeek / Gemini / Qwen Gratis)',
    badge: 'Modelos Gratuitos (:free)',
    defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
    models: [
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Gratuito)', supportsVision: false },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoner (Gratuito)', supportsVision: false },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash Exp (Gratuito + Visión)', supportsVision: true },
      { id: 'qwen/qwen2.5-vl-72b-instruct:free', label: 'Qwen 2.5 VL 72B (Gratuito + Visión)', supportsVision: true },
    ],
    getKeyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
  },
  groq: {
    name: 'Groq Cloud (Llama 3.3 / Llama 4 Ultra Rápido)',
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
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  let legacyKey = '';
  try {
    legacyKey = localStorage.getItem(LEGACY_GEMINI_KEY) || '';
  } catch {}

  const initialKeys: ApiKeyEntry[] = [];
  const seedKey = (legacyKey || envKey).trim();
  if (seedKey) {
    initialKeys.push({
      id: 'key-gemini-primary',
      provider: 'gemini',
      label: 'Gemini Key Principal',
      apiKey: seedKey,
      model: 'gemini-2.5-flash',
      enabled: true,
      lastStatus: 'untested',
    });
  }

  return {
    preferredOrder: ['gemini', 'openrouter', 'groq', 'deepseek', 'local_deterministic'],
    useCiscoOfficialGrounding: true,
    autoFallbackToLocal: true,
    keys: initialKeys,
  };
}

export function loadAiSettings(): AiConfigSettings {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AiConfigSettings;
      if (parsed && Array.isArray(parsed.keys)) {
        return {
          ...getDefaultAiSettings(),
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.warn('[AiProviderManager] Error leyendo configuración IA:', err);
  }
  return getDefaultAiSettings();
}

export function saveAiSettings(settings: AiConfigSettings): void {
  try {
    const raw = JSON.stringify(settings);
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, raw);

    // Sincronizar primera key de Gemini con la clave legacy por compatibilidad
    const firstGemini = settings.keys.find((k) => k.provider === 'gemini' && k.enabled && k.apiKey.trim());
    if (firstGemini) {
      localStorage.setItem(LEGACY_GEMINI_KEY, firstGemini.apiKey.trim());
    }

    // Si estamos en la App de Escritorio (.exe), persistir en disco nativo (~/.cotizador_intcomex/ai_config.json)
    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.save_ai_config === 'function') {
      Promise.resolve(pyApi.save_ai_config(raw)).catch(() => {});
    }
  } catch (err) {
    console.warn('[AiProviderManager] Error guardando configuración IA:', err);
  }
}

/**
 * Sincroniza al iniciar con la configuración guardada en el disco de la App de Escritorio (.exe)
 */
export async function syncAiSettingsFromDesktopBridge(): Promise<AiConfigSettings> {
  const local = loadAiSettings();
  try {
    const pyApi = typeof window !== 'undefined' ? (window as any).pywebview?.api : null;
    if (pyApi && typeof pyApi.get_ai_config === 'function') {
      const res = await pyApi.get_ai_config();
      if (res && res.success && res.config && Array.isArray(res.config.keys)) {
        // Combinar keys de disco que no estén en localStorage
        const mergedKeys = [...local.keys];
        for (const diskKey of res.config.keys as ApiKeyEntry[]) {
          if (
            diskKey.apiKey &&
            !mergedKeys.some((k) => k.apiKey.trim() === diskKey.apiKey.trim() && k.provider === diskKey.provider)
          ) {
            mergedKeys.push(diskKey);
          }
        }
        const merged: AiConfigSettings = {
          ...local,
          ...res.config,
          keys: mergedKeys,
        };
        localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (_) {}
  return local;
}

/**
 * Actualiza el estado de salud de una API Key (ej. cuando se agotan sus tokens o responde OK)
 */
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

/**
 * Agrega rápidamente una nueva API Key al pool de rotación
 */
export function addApiKeyToPool(entry: {
  provider: Exclude<AiProviderId, 'local_deterministic'>;
  label?: string;
  apiKey: string;
  model?: string;
}): AiConfigSettings {
  const current = loadAiSettings();
  const cleanKey = entry.apiKey.trim();
  if (!cleanKey) return current;

  const existingIdx = current.keys.findIndex(
    (k) => k.provider === entry.provider && k.apiKey.trim() === cleanKey
  );

  const meta = PROVIDER_META[entry.provider];
  const newEntry: ApiKeyEntry = {
    id: existingIdx >= 0 ? current.keys[existingIdx].id : `key-${entry.provider}-${Date.now()}`,
    provider: entry.provider,
    label: entry.label?.trim() || `${meta.name.split(' ')[0]} Key #${current.keys.length + 1}`,
    apiKey: cleanKey,
    model: entry.model || meta.defaultModel,
    enabled: true,
    lastStatus: 'untested',
  };

  const nextKeys = [...current.keys];
  if (existingIdx >= 0) {
    nextKeys[existingIdx] = newEntry;
  } else {
    nextKeys.push(newEntry);
  }

  const nextSettings: AiConfigSettings = {
    ...current,
    keys: nextKeys,
  };
  saveAiSettings(nextSettings);
  return nextSettings;
}
