// ============================================================================
// CISCO AUTOMATED v2.1 - AI MULTIMODAL BOM EXTRACTOR & MADRE-HIJO ARCHITECT
// Prioridad #1: IA Multimodal (Gemini 3.7 Flash para texto / 3.6 Flash -> 3.8 Flash
// para imágenes y cascada ascendente + OpenRouter Vision/DeepSeek).
// Analiza lenguaje natural y capturas de pantalla (Ctrl+V), estructura siempre
// la jerarquía Madre-Hijo de Cisco CCW, evita P/N con EOL o eliminados en CCW
// y rota automáticamente entre modelos y API Keys.
// ============================================================================

import {
  loadAiSettings,
  saveAiSettings,
  markApiKeyStatus,
  ApiKeyEntry,
} from './aiProviderManager';
import {
  EOL_CATALOG_2026,
  saveLearnedCiscoSku,
  getLearnedCiscoSkus,
   sanitizeAndValidateCcwSku,
  CiscoProductFamily,
  SubItemConfig,
} from './catalogRules';

export interface ExtractedRequirementItem {
  id?: string;
  rawMentionedSku?: string;
  suggestedActiveSku?: string; // SKU Madre (Chasis Padre / Contenedor CCW) vigente 2026
  selectedEolAlternativeSku?: string; // Alternativa oficial seleccionada por el ingeniero en UI
  isEol2026?: boolean;         // true solo si está obsoleto/EoS en 2026
  keepOriginalSku?: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
  deviceType: 'switch' | 'access_point' | 'router' | 'firewall' | 'license_only' | 'accessory';
  ports?: 8 | 16 | 24 | 48;
  isPoe?: boolean;
  poeBudget?: 'standard' | 'full_poe';
  uplinkType?: '1G' | '10G' | 'SFP+';
  licenseTier?: 'Essentials' | 'Advantage';
  termYears?: number; // Default: 3
  quantity: number;   // Default: 1
  includeStacking?: boolean;
  includeRedundantPsu?: boolean;
  serviceLevel?: string;
  notes?: string;
  aiSubItems?: SubItemConfig[]; // Sub-líneas Hijo sugeridas por la IA para ensamblaje Madre-Hijo
}

export interface ExtractedRequirementResult {
  clientName?: string;
  projectName?: string;
  items: ExtractedRequirementItem[];
  providerUsed?: string;
  keyLabelUsed?: string;
  rotatedKeysLog?: string[];
  groundingSources?: { title: string; url: string }[];
}

const SYSTEM_INSTRUCTION = `
Eres el Arquitecto Senior de Preventa Técnica "ConfigurIAtor" de Cisco e Intcomex (Año 2026).
Tu prioridad absoluta es comprender solicitudes en LENGUAJE NATURAL (correos, chats, requerimientos técnicos) o CAPTURAS DE PANTALLA (tablas, cotizaciones, diagramas, listas de equipos) y transformarlas en una estructura jerárquica **MADRE-HIJO (Parent-Child Assembly)** 100% compatible con Cisco Commerce Workspace (CCW), sin entregar jamás Part Numbers con End-of-Sale (EOL) ni SKUs inexistentes.

REGLAS OBLIGATORIAS DE ESTRUCTURA MADRE-HIJO Y PREVENTA CISCO CCW (2026):
1. INTERPRETACIÓN DE LENGUAJE NATURAL E IMÁGENES:
   - Analiza con precisión qué pide el cliente aunque esté escrito de forma coloquial (ej. "Cotizar 1 switch Meraki MS210-48FP con licencia por 3 años", "2 switches de 24 bocas PoE con licencia a 3 años", "necesito equipos para 40 usuarios con Wi-Fi 6 y un router de borde", o una foto/captura de una tabla de equipos).
   - Si en la captura de pantalla aparecen SKUs, descripciones o cantidades, extráelos TODOS sin omitir ninguno.
2. PROHIBICIÓN ESTRICTA DE ALUCINACIÓN DE SKUs (REGLAS OFICIALES MERAKI & CATALYST EN CCW):
   - **PROHIBIDO INVENTAR SKUs**: En la familia Meraki **MS130** NO existen modelos terminados en "FP" ni en "-HW" (JAMÁS devuelvas "MS130-48FP", "MS130-48FP-HW", "MS130-24FP-HW" ni "MS130-48P-HW").
   - Los únicos modelos Meraki MS130 reales en Cisco CCW son: "MS130-8", "MS130-8P", "MS130-8X", "MS130-12X", "MS130-24", "MS130-24P", "MS130-24X", "MS130-48", "MS130-48P", "MS130-48X" (máximo 370W PoE+).
   - Además, en Cisco CCW todo switch Meraki MS130 se ensambla bajo el contenedor Madre **"MS130-SWITCHES"** (o indícalo como "MS130-SWITCHES:MS130-48P") con sus Hijos:
     1) Modelo Hardware (SIN "-HW"): ej. "MS130-48P" o "MS130-24P".
     2) Cable de poder: "CAB-ACE".
     3) Licencia por familia (con "-3Y", un solo carácter Y): "LIC-MS130-48-3Y", "LIC-MS130-24-3Y" o "LIC-MS130-CMPT-3Y".
   - Cuando el cliente pide un switch EOL de 740W Full PoE+ como **"MS210-48FP"** o **"MS210-48FP-HW"**:
     * Pon siempre "rawMentionedSku": "MS210-48FP" y "isEol2026": true.
     * Su reemplazo técnico exacto 1:1 en Meraki (740W Full PoE+ y apilado físico) es **"MS225-48FP-HW"** con hijos "LIC-MS225-48FP-3YR" y "CAB-ACE".
     * Si el cliente pide explícitamente Meraki MS130 de 48 puertos PoE (370W), usa "suggestedActiveSku": "MS130-SWITCHES:MS130-48P".
3. REGLA DE ORO MADRE-HIJO (CHASIS PADRE + COMPONENTES HIJOS):
   - Todo equipo de hardware Cisco en CCW requiere un **SKU MADRE (suggestedActiveSku)** y sus **SUB-SKUs HIJOS (aiSubItems)** para quedar en estado VALID (Verde):
     * Para Switches Catalyst 9200L/9200 (ej. Madre: "C9200L-24P-4G-E", "C9200L-48P-4X-E" o "C9200L-48FP-4G-E"):
       Hijos obligatorios en "aiSubItems":
       1) Licencia DNA: "C9200L-DNA-E-24-3Y" (o -A- / -48- / -5Y según corresponda), durationMonths=36, initialTerm=36, billingModel="Prepaid Term".
       2) Fuente de poder: "PWR-C5-600WAC" (para 24P), "PWR-C5-1KWAC" (para 48P/48FP) o "PWR-C5-125WAC" (para 24T/48T sin PoE).
       3) Cable de poder Chile/Europa: "CAB-ACE" (qtyMultiplier=1).
       4) Network Stack: "C9200L-NW-E-24" (o -A- / -48).
       5) Si pide stacking/apilado: "C9200L-STACK-KIT" (o "C9200-STACK-KIT").
     * Para Switches Catalyst 9300/9300L (ej. Madre: "C9300-24P-E" o "C9300L-24P-4X-E"):
       Hijos obligatorios en "aiSubItems":
       1) Licencia DNA: "C9300-DNA-E-24-3Y" (o C9300L-DNA-...), durationMonths=36, initialTerm=36, billingModel="Prepaid Term".
       2) Fuente de poder: "PWR-C1-715WAC-P" (24P) o "PWR-C1-1100WAC-P" (48P).
       3) Cable de poder: "CAB-TA-EU".
       4) Network Stack: "C9300-NW-E-24".
       5) Módulo Uplink (en C9300 modular): "C9300-NM-8X" y cable stack "STACK-T1-50CM".
     * Para Switches Meraki MS225 (ej. Madre: "MS225-48FP-HW", "MS225-48LP-HW", "MS225-24P-HW"):
       Hijos en "aiSubItems": Licencia "LIC-MS225-48FP-3YR" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term") y cable "CAB-ACE".
     * Para Switches Meraki MS130 (ej. Madre: "MS130-SWITCHES:MS130-48P" o "MS130-SWITCHES:MS130-24P"):
       Hijos en "aiSubItems": Hardware "MS130-48P", cable "CAB-ACE" y licencia "LIC-MS130-48-3Y" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term").
     * Para Switches SMB Catalyst 1200 / 1300 (ej. Madre: "C1300-24P-4G" o "C1200-24P-4G"):
       Hijos en "aiSubItems": Cable de poder "CAB-C13-CE".
     * Para Routers Catalyst 8200 / 8300 / ISR 1100 (ej. Madre: "C8200-1N-4T" o "C8300-1N1S-4T2X"):
       Hijos en "aiSubItems": Licencia DNA "DNA-C-T0-E-3Y" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term"), fuente y cable "CAB-ACE".
     * Para Access Points Meraki / Wi-Fi 6E (ej. Madre: "MR46-HW" o "CW9164I-MR"):
       Hijos en "aiSubItems": Licencia "LIC-MR-E" o "LIC-ENT-3YR" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term").
     * Para Firewalls Cisco Secure Firewall / Meraki MX (ej. Madre: "FPR1010-NGFW-K9" o "MX68-HW"):
       Hijos en "aiSubItems": Licencia "L-FPR1010T-TMC-3Y" o "LIC-MX68-SEC-3YR" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term") y cable "CAB-ACE".
4. REGLA DE VIGENCIA EOL 2026:
   - Si el SKU mencionado SIGUE VIGENTE en 2026 (ej. C9200L-24P-4G-E, C9200L-48P-4X-E, C9300-24P-E, C1300-24P-4G, MR46-HW, MS225-48FP-HW, C8200-1N-4T), pon "isEol2026": false y mantén ese mismo SKU en "suggestedActiveSku".
   - Si el SKU está en End-of-Sale / EOL en 2026 (ej. MS210-48FP, MS210-24P, MS120-48FP, MS120-24P, WS-C2960X-24PS-L, WS-C2960X-24TS-L, WS-C3850-24P-S, CBS250, CBS350, ISR4321, ISR4331, MR33, MR42, MX64, MX84), pon "isEol2026": true, conserva el SKU original en "rawMentionedSku" (SIN "-HW" de más) y coloca su reemplazo oficial 2026 en "suggestedActiveSku".
5. DEFAULTS DE INGENIERÍA:
   - Si no indica cantidad: quantity = 1.
   - Si no indica licencia: licenseTier = "Essentials".
   - Si no indica plazo: termYears = 3 (36 meses).
   - Asegúrate de que los SKUs Catalyst 9200/9300 siempre terminen en "-E" (Essentials) o "-A" (Advantage), ej: "C9200L-24P-4G-E".

Devuelve ESTRICTAMENTE un JSON válido con esta estructura exacta (sin bloques markdown adicionales):
{
  "clientName": "Cliente",
  "projectName": "Proyecto Preventa Cisco",
  "items": [
    {
      "rawMentionedSku": "string opcional",
      "suggestedActiveSku": "C9200L-24P-4G-E",
      "isEol2026": false,
      "eolReason": "string opcional",
      "officialCiscoUrl": "https://www.cisco.com/...",
      "deviceType": "switch",
      "ports": 24,
      "isPoe": true,
      "poeBudget": "standard",
      "uplinkType": "1G",
      "licenseTier": "Essentials",
      "termYears": 3,
      "quantity": 1,
      "includeStacking": false,
      "includeRedundantPsu": false,
      "notes": "Descripción clara del equipo Madre",
      "aiSubItems": [
        {
          "partNumber": "C9200L-DNA-E-24-3Y",
          "qtyMultiplier": 1,
          "durationMonths": 36,
          "initialTerm": 36,
          "billingModel": "Prepaid Term",
          "description": "C9200L Cisco DNA Essentials, 24-Port, 3 Year Term"
        },
        {
          "partNumber": "PWR-C5-600WAC",
          "qtyMultiplier": 1,
          "description": "600W AC Config 5 Power Supply"
        },
        {
          "partNumber": "CAB-ACE",
          "qtyMultiplier": 1,
          "description": "AC Power Cord (Europe/Chile), CEE 7/7, 1.5M"
        },
        {
          "partNumber": "C9200L-NW-E-24",
          "qtyMultiplier": 1,
          "description": "C9200L Network Essentials, 24-Port"
        }
      ]
    }
  ]
}
`;

function parseSafeJsonFromText(rawText: string): ExtractedRequirementResult {
  const trimmed = (rawText || '').trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFences);
    if (Array.isArray(parsed)) {
      return { clientName: 'Cliente', items: parsed };
    }
    return parsed as ExtractedRequirementResult;
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1)) as ExtractedRequirementResult;
    }
    throw new Error('La respuesta del modelo no contenía un JSON estructurado válido.');
  }
}

/**
 * Llamada resiliente a Google Gemini con cascada inteligente 2026:
 * - Si es TEXTO (Lenguaje Natural): usa "gemini-3.7-flash" como primera opción (#1),
 *   y si falla o excede tiempo salta a "gemini-3.6-flash" y hacia arriba ("gemini-3.8-flash").
 * - Si incluye IMAGEN / CAPTURA DE PANTALLA: usa directamente "gemini-3.6-flash" y hacia arriba
 *   ("gemini-3.8-flash", "gemini-3.5-flash-lite") ya que 3.7-flash no procesa visión multimodal.
 * - Incluye AbortController por intento (8.5s) para evitar cuelgues de red.
 */
async function callGeminiProvider(
  keyEntry: ApiKeyEntry,
  input: { text?: string; imageBase64?: string; mimeType?: string },
  _useWebGrounding: boolean
): Promise<ExtractedRequirementResult> {
  const cleanKey = keyEntry.apiKey.trim();
  const hasImage = Boolean(input.imageBase64 && input.mimeType);

  const preferredModel =
    keyEntry.model === 'gemini-2.5-flash' || keyEntry.model === 'gemini-3.5-flash'
      ? 'gemini-3.7-flash'
      : keyEntry.model || 'gemini-3.7-flash';

  // Cascada según si hay imagen adjunta o es solicitud en lenguaje natural (texto)
  const modelCascade = hasImage
    ? Array.from(
        new Set([
          preferredModel === 'gemini-3.7-flash' ? 'gemini-3.6-flash' : preferredModel,
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.7-flash',
        ].filter(Boolean))
      )
    : Array.from(
        new Set([
          preferredModel,
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-lite-latest',
        ].filter(Boolean))
      );

  const userPrompt = input.text?.trim()
    ? `Analiza la siguiente solicitud comercial en lenguaje natural (y la imagen adjunta si existe). Extrae todos los equipos Cisco, reemplaza cualquier SKU en EOL por su equivalente oficial vigente en CCW y genera su estructura completa Madre-Hijo (suggestedActiveSku + aiSubItems) en JSON:\n\n"${input.text.trim()}"`
    : `Analiza minuciosamente esta captura de pantalla / imagen. Extrae todos los equipos, SKUs o requerimientos Cisco que aparezcan en la imagen, reemplaza cualquier SKU con EOL y genera su estructura completa Madre-Hijo (suggestedActiveSku + aiSubItems) en JSON.`;

  const parts: any[] = [];
  if (input.imageBase64 && input.mimeType) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    });
  }
  parts.push({ text: userPrompt });

  let lastModelError = '';

  for (const modelName of modelCascade) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        lastModelError = `HTTP ${res.status} (${modelName}): ${errBody.slice(0, 160)}`;
        // Si es error de autenticación de la API Key (401/403/API_KEY_INVALID), no seguir probando modelos con la misma key
        if (res.status === 401 || res.status === 403 || errBody.includes('API_KEY_INVALID')) {
          throw new Error(lastModelError);
        }
        // Si es 404, 400 por falta de visión en el modelo, o 503/429 temporal, saltar al siguiente modelo (3.6-flash -> 3.8-flash)
        continue;
      }

      const data: any = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || '')
          .join('') || '';

      if (rawText) {
        const parsed = parseSafeJsonFromText(rawText);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          parsed.providerUsed = `Google Gemini (${modelName})`;
          return parsed;
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError' || String(err?.message || '').includes('aborted');
      lastModelError = isAbort
        ? `Timeout en ${modelName} (>8.5s) -> saltando al siguiente modelo Flash`
        : String(err?.message || err);
      if (
        lastModelError.includes('API_KEY_INVALID') ||
        lastModelError.includes('HTTP 401') ||
        lastModelError.includes('HTTP 403')
      ) {
        throw err;
      }
    }
  }

  throw new Error(lastModelError || 'No se obtuvo respuesta válida de los modelos Gemini.');
}

/**
 * Si el usuario ingresó una Provisioning Key de OpenRouter (que devuelve 401 User not found en /chat/completions),
 * aprovisiona automáticamente una Inference Key real vía POST /api/v1/keys y actualiza la configuración.
 */
async function tryAutoProvisionOpenRouterKey(provisioningKey: string, keyId: string): Promise<string | null> {
  try {
    const createRes = await fetch('https://openrouter.ai/api/v1/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provisioningKey.trim()}`,
      },
      body: JSON.stringify({ name: 'CiscoAutomated_ConfigurIAtor_Auto' }),
    });

    if (!createRes.ok) return null;
    const data: any = await createRes.json();
    const newInferenceKey = data?.key;
    if (newInferenceKey && typeof newInferenceKey === 'string') {
      const current = loadAiSettings();
      const updated = {
        ...current,
        keys: current.keys.map((k) =>
          k.id === keyId ? { ...k, apiKey: newInferenceKey, model: 'openrouter/auto', lastStatus: 'ok' as const } : k
        ),
      };
      saveAiSettings(updated);
      return newInferenceKey;
    }
  } catch {}
  return null;
}

/**
 * Llamada compatible con OpenAI Chat Completions (OpenRouter, Groq, DeepSeek)
 */
async function callOpenAiCompatibleProvider(
  keyEntry: ApiKeyEntry,
  input: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<ExtractedRequirementResult> {
  const endpointMap: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions',
  };

  const url = endpointMap[keyEntry.provider];
  if (!url) throw new Error(`Proveedor ${keyEntry.provider} no soportado.`);

  const promptText = input.text?.trim()
    ? `Analiza la siguiente solicitud comercial de preventa Cisco para el año 2026 y devuelve ÚNICAMENTE el objeto JSON con la estructura Madre-Hijo (suggestedActiveSku + aiSubItems):\n\n${input.text.trim()}`
    : `Analiza minuciosamente esta imagen/captura de pantalla, extrae todos los equipos o SKUs Cisco que aparecen y devuelve ÚNICAMENTE el objeto JSON con la estructura Madre-Hijo (suggestedActiveSku + aiSubItems).`;

  let userContent: any = promptText;
  if (input.imageBase64 && input.mimeType) {
    userContent = [
      { type: 'text', text: promptText },
      {
        type: 'image_url',
        image_url: {
          url: `data:${input.mimeType};base64,${input.imageBase64}`,
        },
      },
    ];
  }

  const effectiveModel =
    keyEntry.provider === 'openrouter' && input.imageBase64 && keyEntry.model.includes('deepseek')
      ? 'openrouter/auto'
      : keyEntry.model || 'openrouter/auto';

  const executeRequest = async (token: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.trim()}`,
    };

    if (keyEntry.provider === 'openrouter') {
      headers['HTTP-Referer'] =
        typeof window !== 'undefined' ? window.location.origin : 'https://cisco-automated.pages.dev';
      headers['X-Title'] = 'Cisco Automated ConfigurIAtor';
    }

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: effectiveModel,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userContent },
        ],
      }),
    });
  };

  let res = await executeRequest(keyEntry.apiKey);

  if (!res.ok && res.status === 401 && keyEntry.provider === 'openrouter') {
    const provisionedKey = await tryAutoProvisionOpenRouterKey(keyEntry.apiKey, keyEntry.id);
    if (provisionedKey) {
      res = await executeRequest(provisionedKey);
    }
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  const parsed = parseSafeJsonFromText(content);
  parsed.providerUsed = `${keyEntry.provider.toUpperCase()} (${data?.model || effectiveModel})`;
  return parsed;
}

// ============================================================================
// MOTOR DETERMINISTA LOCAL DE PREVENTA CISCO (SOLO SI EL USUARIO LO ACTIVA)
// ============================================================================
export function extractWithLocalDeterministicEngine(text: string): ExtractedRequirementResult {
  const cleanText = (text || '').trim();
  if (!cleanText) {
    return {
      clientName: 'Cliente',
      items: [
        {
          id: `item-${Date.now()}-1`,
          suggestedActiveSku: 'C9200L-24P-4G-E',
          isEol2026: false,
          deviceType: 'switch',
          ports: 24,
          isPoe: true,
          uplinkType: '1G',
          licenseTier: 'Essentials',
          termYears: 3,
          quantity: 1,
          notes: 'Configuración base Catalyst 9200L 24P PoE+',
        },
      ],
      providerUsed: 'Motor Local Determinista Cisco',
    };
  }

  const segments = cleanText
    .split(/\r?\n|;|(?:\s+y\s+(?=\d+\s*(?:switch|ap|access|router|firewall|licencia|c9|ws-|mr|mx|ms|isr|cbs)))/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const extractedItems: ExtractedRequirementItem[] = [];
  const learnedSkus = getLearnedCiscoSkus();
  const skuRegex = /\b(WS-C[A-Z0-9-]+|C9[2345]00[A-Z0-9-]*|C1[023]00-[A-Z0-9-]+|CBS[23]50-[A-Z0-9-]+|ISR4[0-9]{3}[A-Z0-9/-]*|C8[235]00[A-Z0-9-]*|MR[345][0-9](?:-HW)?|CW91[67][0-9][A-Z0-9-]*|MS[1234][0-9]{2}-[A-Z0-9-]+|MX[6789][0-9](?:-HW)?|FPR[1234][0-9]{3}-[A-Z0-9-]+|ASA55[0-9]{2}-[A-Z0-9-]+|GLC-[A-Z0-9-]+|SFP-[A-Z0-9-]+)\b/gi;

  const processSegment = (seg: string, idx: number) => {
    const upper = seg.toUpperCase();
    let termYears = 3;
    const yearsMatch = seg.match(/(\d+)\s*(?:años?|year|yr|y\b)/i);
    const monthsMatch = seg.match(/(\d+)\s*(?:meses|months|m\b)/i);
    if (yearsMatch) {
      termYears = Number(yearsMatch[1]) || 3;
    } else if (monthsMatch) {
      const m = Number(monthsMatch[1]);
      if (m >= 12) termYears = Math.round(m / 12);
    }

    const licenseTier: 'Essentials' | 'Advantage' =
      /\badvantage\b|\bdna-a\b|\bnw-a\b/i.test(seg) ? 'Advantage' : 'Essentials';
    const includeStacking = /\bstack(?:ing|eable|s)?\b|\bapilad[oa]s?\b/i.test(seg);
    const includeRedundantPsu = /\bredundante\b|\bdoble\s+fuente\b/i.test(seg);

    let quantity = 1;
    const qtyBeforeKeyword = seg.match(/(?:^|\bcot[ií]zame\s+|\bcotizar\s+|\bnecesito\s+|\brequiero\s+|\bson\s+)(\d{1,3})\s+(?:switch|equipo|ap\b|access|router|firewall|unidad|chasis|ws-|c9|mr|mx|ms|isr|cbs)/i);
    const qtyLeading = seg.match(/^\s*(?:[-*•]\s*)?(\d{1,3})\s*(?:x\b|unid(?:ades)?|equipos?|pcs?)?\s+/i);
    if (qtyBeforeKeyword) {
      quantity = Number(qtyBeforeKeyword[1]) || 1;
    } else if (qtyLeading && ![8, 16, 24, 48].includes(Number(qtyLeading[1]))) {
      quantity = Number(qtyLeading[1]) || 1;
    }

    const skuMatches = Array.from(seg.matchAll(skuRegex));
    if (skuMatches.length > 0) {
      for (const m of skuMatches) {
        const rawSku = m[1].toUpperCase().trim();
        const eolInfo = EOL_CATALOG_2026[rawSku] || EOL_CATALOG_2026[rawSku.replace(/-HW$/i, '')];
        const learned = learnedSkus[rawSku];
        const isEol = eolInfo ? eolInfo.status === 'eos_eol_active' : learned ? learned.isEol : false;
        const rawSuggested = eolInfo ? eolInfo.replacementSku : learned?.replacementSku || rawSku;
        const sanitized = sanitizeAndValidateCcwSku(rawSuggested);
        const suggestedSku = sanitized.sanitizedSku;
        const isPoe = /P|FP|POE/i.test(suggestedSku) && !/24T|48T/i.test(suggestedSku);
        const ports: 8 | 16 | 24 | 48 | undefined = suggestedSku.includes('48')
          ? 48
          : suggestedSku.includes('24')
            ? 24
            : undefined;

        extractedItems.push({
          id: `item-${Date.now()}-${idx}-${rawSku}`,
          rawMentionedSku: sanitized.inferredLegacyEolSku || rawSku,
          suggestedActiveSku: suggestedSku,
          isEol2026: isEol || Boolean(sanitized.inferredLegacyEolSku),
          eolReason: eolInfo?.eolNote || sanitized.correctionReason || learned?.eolNote,
          officialCiscoUrl: eolInfo?.officialCiscoDocUrl || learned?.officialUrl,
          deviceType:
            suggestedSku.startsWith('MR') || suggestedSku.startsWith('CW')
              ? 'access_point'
              : suggestedSku.startsWith('C8') || suggestedSku.startsWith('ISR')
                ? 'router'
                : suggestedSku.startsWith('FPR') || suggestedSku.startsWith('ASA') || suggestedSku.startsWith('MX')
                  ? 'firewall'
                  : 'switch',
          ports,
          isPoe,
          uplinkType: suggestedSku.includes('4X') ? '10G' : '1G',
          licenseTier,
          termYears,
          quantity,
          includeStacking,
          includeRedundantPsu,
          notes: seg.slice(0, 120),
        });
      }
      return;
    }

    const mentionsSwitch = /\bswitch(?:es)?\b|\bbocas\b|\bpuertos\b|\bcatalyst\b|\bmeraki\s+ms\b/i.test(seg);
    const mentionsAp = /\b(?:ap|aps|access\s*points?|wifi|wi-fi|inal[aá]mbric[oa]|meraki\s+mr)\b/i.test(seg);
    const mentionsRouter = /\brouter(?:s)?\b|\bisr\b|\bwan\b|\bsucursal\b/i.test(seg);
    const mentionsFirewall = /\bfirewall(?:s)?\b|\bfirepower\b|\bngfw\b|\bmeraki\s+mx\b/i.test(seg);

    if (mentionsSwitch) {
      const ports: 8 | 16 | 24 | 48 = /\b48\s*(?:bocas|puertos|ports|p\b|t\b)/i.test(seg) ? 48 : 24;
      const explicitlyNoPoe = /\bsin\s+poe\b|\bdata\s+only\b|\bsolo\s+datos\b/i.test(seg);
      const isPoe = explicitlyNoPoe ? false : true;
      const isFullPoe = /\bfull\s*poe\b|\b740w\b|\bfp\b/i.test(seg);
      const is10G = /\b10\s*g\b|\bsfp\+\b|\b4x\b/i.test(seg);
      const is9300 = /\b9300\b|\bcore\b/i.test(seg);
      const isSmb = /\bsmb\b|\becon[oó]mico\b|\bc1200\b|\bc1300\b|\bcbs\b/i.test(seg);
      const isMerakiSwitch = /\bmeraki\b|\bms130\b|\bms225\b/i.test(seg);

      const tierCode = licenseTier === 'Advantage' ? 'A' : 'E';
      let suggestedSku = '';
      if (isMerakiSwitch) {
        if (isFullPoe && ports === 48) {
          suggestedSku = 'MS225-48FP-HW';
        } else {
          suggestedSku = `MS130-SWITCHES:MS130-${ports}${isPoe ? (is10G ? 'X' : 'P') : ''}`;
        }
      } else if (isSmb) {
        suggestedSku = `C1300-${ports}${isPoe ? 'P' : 'T'}-${is10G ? '4X' : '4G'}`;
      } else if (is9300) {
        suggestedSku = `C9300-${ports}${isPoe ? 'P' : 'T'}-${tierCode}`;
      } else {
        const poeCode = !isPoe ? 'T' : isFullPoe && ports === 48 ? 'FP' : 'P';
        const uplinkCode = is10G ? '10G' : '4G';
        suggestedSku = `C9200L-${ports}${poeCode}-${uplinkCode === '10G' ? '4X' : '4G'}-${tierCode}`;
      }

      extractedItems.push({
        id: `item-${Date.now()}-${idx}-sw`,
        suggestedActiveSku: suggestedSku,
        isEol2026: false,
        officialCiscoUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html',
        deviceType: 'switch',
        ports,
        isPoe,
        poeBudget: isFullPoe ? 'full_poe' : 'standard',
        uplinkType: is10G ? '10G' : '1G',
        licenseTier,
        termYears,
        quantity,
        includeStacking,
        includeRedundantPsu,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsAp) {
      const isWifi6E = /\b6e\b|\b9164\b|\b9166\b/i.test(seg);
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-ap`,
        suggestedActiveSku: isWifi6E ? 'CW9164I-MR' : 'MR46-HW',
        isEol2026: false,
        officialCiscoUrl: 'https://meraki.cisco.com/product/wi-fi/indoor-access-points/mr46/',
        deviceType: 'access_point',
        licenseTier,
        termYears,
        quantity,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsRouter) {
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-rt`,
        suggestedActiveSku: 'C8200-1N-4T',
        isEol2026: false,
        officialCiscoUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
        deviceType: 'router',
        licenseTier,
        termYears,
        quantity,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsFirewall) {
      const isMerakiMx = /\bmeraki\b|\bmx\b/i.test(upper);
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-fw`,
        suggestedActiveSku: isMerakiMx ? 'MX68-HW' : 'FPR1010-NGFW-K9',
        isEol2026: false,
        deviceType: 'firewall',
        licenseTier,
        termYears,
        quantity,
        notes: seg.slice(0, 120),
      });
    }
  };

  segments.forEach((seg, idx) => processSegment(seg, idx));
  if (extractedItems.length === 0) processSegment(cleanText, 0);

  return {
    clientName: 'Cliente',
    items: extractedItems,
    providerUsed: 'Motor Local Determinista Cisco',
  };
}

/**
 * Normaliza SKUs de chasis Cisco devueltos por la IA para garantizar que calcen
 * con el catálogo oficial de Cisco CCW y activen sus sub-líneas Madre-Hijo.
 * NUNCA agrega "-HW" a Meraki MS130 ni a Catalyst Wireless CW916x.
 */
export function normalizeParentChassisSku(
  sku: string,
  tier: 'Essentials' | 'Advantage' = 'Essentials'
): string {
  const rawClean = (sku || '').trim().toUpperCase();
  if (!rawClean) return '';

  // 1. Primero pasar por el validador anti-alucinación CCW (MS130-SWITCHES, MS130 sin -HW, MS130-48FP -> MS225-48FP-HW)
  const sanitized = sanitizeAndValidateCcwSku(rawClean);
  const clean = sanitized.sanitizedSku;

  if (clean.startsWith('MS130-SWITCHES:') || clean === 'MS130-SWITCHES') {
    return clean;
  }

  const tierCode = tier === 'Advantage' ? 'A' : 'E';

  // Si la IA devolvió ej. "C9200L-24P-4G" o "C9200L-48P-4X" sin el "-E" o "-A" final:
  if (/^C9200L?-\d{2}(?:FP|P|T|PXG)-(?:4G|4X|2Y|8X|12X)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  // Si la IA devolvió "C9200-24P" o "C9300-24P" o "C9300-48P" sin "-E"/"-A":
  if (/^C9[23]00-\d{2}(?:FP|P|T|U|UXM|PF)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  // Si la IA devolvió "C9300L-24P-4X" sin "-E"/"-A":
  if (/^C9300L-\d{2}(?:PF|P|T)-(?:4G|4X)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  // Si es Meraki MR36/MR46/MR56/MX67/MX68/MS225/MS250/MS350 (EXCLUYENDO MS130 y CW916x) sin "-HW":
  if (
    /^(?:MR[3456]\d|MX[6789]\d|MX10\d|MS(?:210|220|225|250|350|390|410|425)-[0-9A-Z]+)$/i.test(clean) &&
    !clean.endsWith('-HW')
  ) {
    return `${clean}-HW`;
  }
  // Si es Firepower FPR1010/1120/1140/1150/2110/2120/2130/2140 sin "-NGFW-K9":
  if (/^FPR(?:1010|1120|1140|1150|2110|2120|2130|2140)$/i.test(clean)) {
    return `${clean}-NGFW-K9`;
  }

  return clean;
}

function isLooksLikeRealCiscoSku(str: string): boolean {
  const s = (str || '').trim().toUpperCase();
  if (!s || s.includes(' ')) return false;
  return /^(?:WS-C|C9[23456]00|C1[0123]00|C8[235]00|ISR\d|ASR\d|FPR\d|ASA\d|MR\d|MS\d|MX\d|CW\d|CBS\d|N9K|SFP-|GLC-|PWR-|CAB-)/i.test(s);
}

function postProcessExtractedResult(result: ExtractedRequirementResult): ExtractedRequirementResult {
  const processedItems = (result.items || []).map((item, idx) => {
    const tier: 'Essentials' | 'Advantage' =
      item.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';

    let rawSku = (item.rawMentionedSku || '').trim().toUpperCase();
    const rawSanitized = sanitizeAndValidateCcwSku(item.suggestedActiveSku || rawSku);

    // Si la IA alucinó MS130-48FP-HW sin poner rawMentionedSku, rescatar el EOL original (MS210-48FP)
    if (!rawSku && rawSanitized.inferredLegacyEolSku) {
      rawSku = rawSanitized.inferredLegacyEolSku;
    }
    // Si la IA puso el mismo SKU alucinado en rawMentionedSku (ej. MS130-48FP-HW), corregirlo a MS210-48FP
    if (/^MS130-(?:48|24)FP(?:-HW)?$/i.test(rawSku) && rawSanitized.inferredLegacyEolSku) {
      rawSku = rawSanitized.inferredLegacyEolSku;
    }

    let suggested = normalizeParentChassisSku(rawSanitized.sanitizedSku || item.suggestedActiveSku || '', tier);

    const eolLookup = EOL_CATALOG_2026[rawSku] || EOL_CATALOG_2026[rawSku.replace(/-HW$/i, '')];
    if (rawSku && eolLookup) {
      // Si el modelo sugerido por la IA ya es una alternativa válida (ej. MS130-SWITCHES:MS130-48P o MS225-48FP-HW), conservarlo; si no, usar replacementSku oficial
      const isValidAlternative =
        suggested.startsWith('MS130-SWITCHES:') ||
        suggested.startsWith('MS225-') ||
        suggested.startsWith('C9200') ||
        suggested.startsWith('C9300');
      if (!isValidAlternative || suggested === rawSku || suggested === `${rawSku}-HW`) {
        suggested = normalizeParentChassisSku(eolLookup.replacementSku, tier);
      }
      item.isEol2026 = eolLookup.status === 'eos_eol_active';
      item.eolReason = rawSanitized.correctionReason || eolLookup.eolNote;
      item.officialCiscoUrl = item.officialCiscoUrl || eolLookup.officialCiscoDocUrl;
    } else if (rawSanitized.correctionReason) {
      item.isEol2026 = Boolean(rawSanitized.inferredLegacyEolSku) || item.isEol2026;
      item.eolReason = rawSanitized.correctionReason;
    } else if (!suggested && isLooksLikeRealCiscoSku(rawSku)) {
      suggested = normalizeParentChassisSku(rawSku, tier);
    }

    const targetToLearn = suggested || rawSku;
    if (targetToLearn) {
      const familyGuess: CiscoProductFamily =
        targetToLearn.startsWith('C9200')
          ? 'catalyst9200'
          : targetToLearn.startsWith('C9300')
            ? 'catalyst9300'
            : targetToLearn.startsWith('C1200') || targetToLearn.startsWith('C1300')
              ? 'catalyst1200_1300'
              : targetToLearn.startsWith('C8')
                ? 'catalyst8000'
                : targetToLearn.startsWith('MR')
                  ? 'meraki_mr'
                  : targetToLearn.startsWith('MS130')
                    ? 'meraki_ms130'
                    : targetToLearn.startsWith('MS225')
                      ? 'meraki_ms225'
                      : targetToLearn.startsWith('MS')
                        ? 'meraki_ms'
                        : targetToLearn.startsWith('MX')
                          ? 'meraki_mx'
                          : 'generic';

      saveLearnedCiscoSku({
        sku: targetToLearn,
        description: item.notes || `${targetToLearn} (${item.deviceType})`,
        family: familyGuess,
        isEol: false,
        officialUrl: item.officialCiscoUrl,
        defaultSubSkus: Array.isArray(item.aiSubItems) && item.aiSubItems.length > 0 ? item.aiSubItems : undefined,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      ...item,
      id: item.id || `item-${Date.now()}-${idx}`,
      rawMentionedSku: rawSku || item.rawMentionedSku,
      suggestedActiveSku: suggested,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      licenseTier: tier,
      termYears: item.termYears && item.termYears > 0 ? item.termYears : 3,
    };
  });

  return {
    ...result,
    items: processedItems,
  };
}

export async function extractBOMRequirementsFromInput(
  input: { text?: string; imageBase64?: string; mimeType?: string },
  explicitApiKey?: string
): Promise<ExtractedRequirementResult> {
  const settings = loadAiSettings();
  const rotatedKeysLog: string[] = [];

  const candidateKeys: ApiKeyEntry[] = [];
  if (explicitApiKey && explicitApiKey.trim()) {
    candidateKeys.push({
      id: 'explicit-runtime-key',
      provider: 'gemini',
      label: 'API Key Directa',
      apiKey: explicitApiKey.trim(),
      model: 'gemini-3.7-flash',
      enabled: true,
    });
  }

  for (const k of settings.keys) {
    if (k.enabled && k.apiKey && k.apiKey.trim()) {
      candidateKeys.push(k);
    }
  }

  // Prioridad #1: Consultar proveedores de IA en orden (Gemini 3.7/3.6/3.8 Flash -> OpenRouter -> Groq -> DeepSeek)
  for (const keyEntry of candidateKeys) {
    try {
      let result: ExtractedRequirementResult;
      if (keyEntry.provider === 'gemini') {
        result = await callGeminiProvider(keyEntry, input, settings.useCiscoOfficialGrounding);
      } else {
        result = await callOpenAiCompatibleProvider(keyEntry, input);
      }

      if (result && Array.isArray(result.items) && result.items.length > 0) {
        markApiKeyStatus(keyEntry.id, 'ok');
        const finalResult = postProcessExtractedResult(result);
        finalResult.providerUsed = result.providerUsed || `${keyEntry.provider.toUpperCase()} (${keyEntry.model})`;
        finalResult.keyLabelUsed = keyEntry.label;
        finalResult.rotatedKeysLog = rotatedKeysLog;
        return finalResult;
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err || 'Error desconocido');
      const isQuota =
        errMsg.includes('429') ||
        errMsg.toUpperCase().includes('QUOTA') ||
        errMsg.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
        errMsg.toUpperCase().includes('RATE_LIMIT');

      markApiKeyStatus(
        keyEntry.id,
        isQuota ? 'quota_exceeded' : 'invalid',
        errMsg.slice(0, 140)
      );
      rotatedKeysLog.push(
        `[${keyEntry.label} - ${keyEntry.provider}]: ${
          isQuota ? 'Tokens agotados (429) -> Rotando a siguiente API...' : `Aviso (${errMsg.slice(0, 90)}) -> Rotando...`
        }`
      );
    }
  }

  // Si el usuario tiene habilitado el fallback local para texto
  if (settings.autoFallbackToLocal && input.text && input.text.trim()) {
    const localRes = postProcessExtractedResult(extractWithLocalDeterministicEngine(input.text));
    localRes.rotatedKeysLog = rotatedKeysLog;
    return localRes;
  }

  throw new Error(
    rotatedKeysLog.length > 0
      ? `No se pudo completar el análisis con las APIs configuradas:\n${rotatedKeysLog.join('\n')}`
      : 'No hay ninguna API Key activa en el pool. Revisa el botón "APIs & Rotación".'
  );
}
