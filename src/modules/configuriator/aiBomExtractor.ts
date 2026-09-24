// ============================================================================
// CISCO AUTOMATED v2.1 - AI MULTIMODAL BOM EXTRACTOR & CISCO.COM GROUNDING
// Extrae requerimientos comerciales desde texto o capturas (Ctrl+V), consulta
// vigencia EOL 2026 en páginas oficiales de Cisco (cisco.com), rota entre
// múltiples API Keys/Proveedores si se agotan los tokens, y cuenta con un
// Motor NLP Determinista Local de respaldo (0 tokens).
// ============================================================================

import { GoogleGenAI } from '@google/genai';
import {
  loadAiSettings,
  markApiKeyStatus,
  ApiKeyEntry,
} from './aiProviderManager';
import {
  EOL_CATALOG_2026,
  saveLearnedCiscoSku,
  getLearnedCiscoSkus,
  CiscoProductFamily,
} from './catalogRules';

export interface ExtractedRequirementItem {
  id?: string;
  rawMentionedSku?: string;
  suggestedActiveSku?: string; // SKU vigente sugerido por IA o catálogo Cisco 2026
  isEol2026?: boolean;         // true solo si el SKU está obsoleto/EoS en 2026; si es false se mantiene el original
  keepOriginalSku?: boolean;   // Permite al preventa forzar conservar el SKU original
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
Tu misión es analizar correos comerciales, listas de materiales o capturas de pantalla de clientes y extraer los equipos y licencias Cisco solicitados.

REGLAS TÉCNICAS Y DE CICLO DE VIDA (EOL 2026) OBLIGATORIAS:
1. Si el cliente menciona un SKU específico de Cisco:
   - Colócalo en "rawMentionedSku" (ej: "WS-C2960X-24PS-L", "C9200L-24P-4G-E", "CBS350-24P-4G", "MR46-HW").
   - Evalúa su vigencia para el año 2026 basándote en documentación oficial de Cisco (cisco.com / meraki.cisco.com):
     * Si el SKU SIGUE VIGENTE y ordenable en 2026 (ej: C9200L-24P-4G-E, C9300-24P-E, C1300-24P-4G, MR46-HW, CW9164I-MR, C8200-1N-4T, FPR1010-NGFW-K9), establece "isEol2026": false y pon el mismo SKU en "suggestedActiveSku". ¡NO reemplaces un equipo que sigue vigente!
     * Si el SKU está en End-of-Sale / End-of-Life (EOL) para 2026 (ej: 2960X, 2960S, 3650, 3850, CBS250, CBS350, SG350, ISR4321, ISR4331, MR33, MR42, ASA5506), establece "isEol2026": true, coloca el SKU de reemplazo oficial Cisco 2026 en "suggestedActiveSku" y explica brevemente en "eolReason".
2. Si el cliente NO menciona un SKU sino especificaciones en lenguaje natural:
   - "switch 24 bocas/puertos PoE" -> deviceType="switch", ports=24, isPoe=true, suggestedActiveSku="C9200L-24P-4G-E" (o C9200L-24P-4X-E si pide uplinks 10G/SFP+).
   - "switch 48 bocas/puertos PoE" -> deviceType="switch", ports=48, isPoe=true, suggestedActiveSku="C9200L-48P-4G-E".
   - "switch 24 bocas sin PoE / datos" -> deviceType="switch", ports=24, isPoe=false, suggestedActiveSku="C9200L-24T-4G-E".
   - "switch SMB / económico / Catalyst 1200 o 1300" -> suggestedActiveSku="C1300-24P-4G" (o C1200-24P-4G).
   - "AP / Access Point Wi-Fi 6 Meraki" -> deviceType="access_point", suggestedActiveSku="MR46-HW" (o "CW9164I-MR" si pide Wi-Fi 6E).
   - "Router sucursal / WAN" -> deviceType="router", suggestedActiveSku="C8200-1N-4T".
3. Si no especifica cantidad, quantity = 1.
4. Si no especifica licencia (Essentials vs Advantage), licenseTier = "Essentials".
5. Si no especifica plazo de años de licencia, termYears = 3.
6. Si menciona "stack", "apilado" o "kit de stacking", activa "includeStacking": true.
7. Si menciona "fuente redundante" o "doble fuente", activa "includeRedundantPsu": true.
8. Incluye en "officialCiscoUrl" el enlace oficial de cisco.com o meraki.cisco.com de la familia del producto cuando corresponda.
9. Devuelve ESTRICTAMENTE un objeto JSON válido con la estructura:
{
  "clientName": "string opcional",
  "projectName": "string opcional",
  "items": [
    {
      "rawMentionedSku": "string opcional",
      "suggestedActiveSku": "string",
      "isEol2026": false,
      "eolReason": "string opcional",
      "officialCiscoUrl": "https://www.cisco.com/...",
      "deviceType": "switch | access_point | router | firewall | license_only | accessory",
      "ports": 24,
      "isPoe": true,
      "poeBudget": "standard | full_poe",
      "uplinkType": "1G | 10G | SFP+",
      "licenseTier": "Essentials | Advantage",
      "termYears": 3,
      "quantity": 1,
      "includeStacking": false,
      "includeRedundantPsu": false,
      "notes": "string"
    }
  ]
}
`;

/**
 * Extrae el primer objeto JSON válido desde la respuesta de un LLM
 */
function parseSafeJsonFromText(rawText: string): ExtractedRequirementResult {
  const trimmed = (rawText || '').trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFences) as ExtractedRequirementResult;
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1)) as ExtractedRequirementResult;
    }
    throw new Error('La respuesta del modelo no contenía un JSON válido.');
  }
}

/**
 * Ejecuta llamada con Google Gemini (@google/genai) con soporte opcional de Google Search Grounding (cisco.com)
 */
async function callGeminiProvider(
  keyEntry: ApiKeyEntry,
  input: { text?: string; imageBase64?: string; mimeType?: string },
  useWebGrounding: boolean
): Promise<ExtractedRequirementResult> {
  const ai = new GoogleGenAI({ apiKey: keyEntry.apiKey.trim() });
  const promptText = `Analiza la siguiente solicitud comercial de preventa Cisco (verifica vigencia EOL 2026 en páginas oficiales de cisco.com si aplica) y devuelve el JSON estructurado:\n\n${
    input.text || 'Analiza la imagen/captura adjunta y extrae todos los equipos y licencias Cisco.'
  }`;

  const contents: any[] = [];
  if (input.imageBase64 && input.mimeType) {
    contents.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType,
      },
    });
  }
  contents.push(promptText);

  const groundingSources: { title: string; url: string }[] = [];

  // Intento 1: Si useWebGrounding está activo y es consulta de texto/SKU, intentar con Google Search Grounding
  if (useWebGrounding) {
    try {
      const groundedResp = await ai.models.generateContent({
        model: keyEntry.model || 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
          tools: [{ googleSearch: {} }],
        },
      });

      const candidate = (groundedResp as any).candidates?.[0];
      const chunks = candidate?.groundingMetadata?.groundingChunks || [];
      for (const ch of chunks) {
        if (ch?.web?.uri) {
          groundingSources.push({
            title: ch.web.title || 'Cisco Official Documentation',
            url: ch.web.uri,
          });
        }
      }

      if (groundedResp.text) {
        const parsed = parseSafeJsonFromText(groundedResp.text);
        parsed.groundingSources = groundingSources;
        return parsed;
      }
    } catch (groundingErr: any) {
      // Si falla por incompatibilidad de tool en el modelo o clave, hacemos fallback inmediato a JSON directo
      const msg = String(groundingErr?.message || '');
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
        throw groundingErr;
      }
    }
  }

  // Intento 2: Llamada JSON estructurada directa
  const response = await ai.models.generateContent({
    model: keyEntry.model || 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const parsed = parseSafeJsonFromText(response.text || '{}');
  if (groundingSources.length > 0) {
    parsed.groundingSources = groundingSources;
  }
  return parsed;
}

/**
 * Ejecuta llamada compatible con OpenAI Chat Completions (OpenRouter, Groq, DeepSeek)
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

  const promptText = `Analiza la siguiente solicitud comercial de preventa Cisco para el año 2026 y devuelve ÚNICAMENTE el objeto JSON solicitado:\n\n${
    input.text || 'Extrae los ítems de la imagen adjunta.'
  }`;

  let userContent: any = promptText;
  if (input.imageBase64 && input.mimeType) {
    // Si el proveedor/modelo soporta visión (Groq Llama 4 Scout, OpenRouter Gemini/Qwen VL)
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${keyEntry.apiKey.trim()}`,
  };

  if (keyEntry.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://cisco-automated.pages.dev';
    headers['X-Title'] = 'Cisco Automated ConfigurIAtor';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: keyEntry.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return parseSafeJsonFromText(content);
}

// ============================================================================
// MOTOR DETERMINISTA LOCAL DE PREVENTA CISCO (FALLBACK 0 TOKENS / OFFLINE)
// Analiza correos en español/inglés, cantidades, bocas, PoE, plazos y SKUs
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
      providerUsed: 'Motor Local Determinista Cisco (Offline / 0 Tokens)',
    };
  }

  // Dividir por líneas o frases separadas por ";" o "además" / "y también"
  const segments = cleanText
    .split(/\r?\n|;|(?:\s+y\s+(?=\d+\s*(?:switch|ap|access|router|firewall|licencia|c9|ws-|mr|mx|ms|isr|cbs)))/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const extractedItems: ExtractedRequirementItem[] = [];
  const learnedSkus = getLearnedCiscoSkus();

  // Regex para detectar SKUs explícitos de Cisco en el texto
  const skuRegex = /\b(WS-C[A-Z0-9-]+|C9[2345]00[A-Z0-9-]*|C1[023]00-[A-Z0-9-]+|CBS[23]50-[A-Z0-9-]+|ISR4[0-9]{3}[A-Z0-9/-]*|C8[235]00[A-Z0-9-]*|MR[345][0-9](?:-HW)?|CW91[67][0-9][A-Z0-9-]*|MS[1234][0-9]{2}-[A-Z0-9-]+|MX[6789][0-9](?:-HW)?|FPR[1234][0-9]{3}-[A-Z0-9-]+|ASA55[0-9]{2}-[A-Z0-9-]+|GLC-[A-Z0-9-]+|SFP-[A-Z0-9-]+)\b/gi;

  const processSegment = (seg: string, idx: number) => {
    const upper = seg.toUpperCase();

    // Extraer plazo en años (ej. "por 5 años", "5Y", "36 meses", "60 meses")
    let termYears = 3;
    const yearsMatch = seg.match(/(\d+)\s*(?:años?|year|yr|y\b)/i);
    const monthsMatch = seg.match(/(\d+)\s*(?:meses|months|m\b)/i);
    if (yearsMatch) {
      termYears = Number(yearsMatch[1]) || 3;
    } else if (monthsMatch) {
      const m = Number(monthsMatch[1]);
      if (m >= 12) termYears = Math.round(m / 12);
    }

    // Extraer Tier (Advantage vs Essentials)
    const licenseTier: 'Essentials' | 'Advantage' =
      /\badvantage\b|\bdna-a\b|\bnw-a\b/i.test(seg) ? 'Advantage' : 'Essentials';

    // Stacking y Fuente redundante
    const includeStacking = /\bstack(?:ing|eable|s)?\b|\bapilad[oa]s?\b/i.test(seg);
    const includeRedundantPsu = /\bredundante\b|\bdoble\s+fuente\b/i.test(seg);

    // Cantidad: buscar número al inicio o antes del tipo de equipo (evitando confundir con "24 bocas" o "3 años")
    let quantity = 1;
    const qtyBeforeKeyword = seg.match(/(?:^|\bcot[ií]zame\s+|\bnecesito\s+|\brequiero\s+|\bson\s+)(\d{1,3})\s+(?:switch|equipo|ap\b|access|router|firewall|unidad|chasis|ws-|c9|mr|mx|ms|isr|cbs)/i);
    const qtyLeading = seg.match(/^\s*(?:[-*•]\s*)?(\d{1,3})\s*(?:x\b|unid(?:ades)?|equipos?|pcs?)?\s+/i);
    if (qtyBeforeKeyword) {
      quantity = Number(qtyBeforeKeyword[1]) || 1;
    } else if (qtyLeading && ![8, 16, 24, 48].includes(Number(qtyLeading[1]))) {
      quantity = Number(qtyLeading[1]) || 1;
    } else if (qtyLeading && [8, 16, 24, 48].includes(Number(qtyLeading[1])) && !/^\s*\d+\s*(?:bocas|puertos|ports)/i.test(seg)) {
      quantity = Number(qtyLeading[1]) || 1;
    }

    // 1. ¿Menciona algún SKU explícito?
    const skuMatches = Array.from(seg.matchAll(skuRegex));
    if (skuMatches.length > 0) {
      for (const m of skuMatches) {
        const rawSku = m[1].toUpperCase().trim();
        const eolInfo = EOL_CATALOG_2026[rawSku];
        const learned = learnedSkus[rawSku];

        const isEol = eolInfo
          ? eolInfo.status === 'eos_eol_active'
          : learned
            ? learned.isEol
            : false;

        const suggestedSku = eolInfo
          ? eolInfo.replacementSku
          : learned?.replacementSku || rawSku;

        const isPoe = /P|FP|POE/i.test(suggestedSku) && !/24T|48T/i.test(suggestedSku);
        const ports: 8 | 16 | 24 | 48 | undefined = suggestedSku.includes('48')
          ? 48
          : suggestedSku.includes('24')
            ? 24
            : suggestedSku.includes('16')
              ? 16
              : suggestedSku.includes('8')
                ? 8
                : undefined;

        extractedItems.push({
          id: `item-${Date.now()}-${idx}-${rawSku}`,
          rawMentionedSku: rawSku,
          suggestedActiveSku: suggestedSku,
          isEol2026: isEol,
          eolReason: eolInfo?.eolNote || learned?.eolNote,
          officialCiscoUrl: eolInfo?.officialCiscoDocUrl || learned?.officialUrl,
          deviceType:
            suggestedSku.startsWith('MR') || suggestedSku.startsWith('CW')
              ? 'access_point'
              : suggestedSku.startsWith('C8') || suggestedSku.startsWith('ISR')
                ? 'router'
                : suggestedSku.startsWith('FPR') || suggestedSku.startsWith('ASA') || suggestedSku.startsWith('MX')
                  ? 'firewall'
                  : suggestedSku.startsWith('GLC') || suggestedSku.startsWith('SFP')
                    ? 'accessory'
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

    // 2. Inferencia por lenguaje natural (sin SKU explícito)
    const mentionsSwitch = /\bswitch(?:es)?\b|\bbocas\b|\bpuertos\b|\bcatalyst\b/i.test(seg);
    const mentionsAp = /\b(?:ap|aps|access\s*points?|wifi|wi-fi|inal[aá]mbric[oa]|meraki\s+mr)\b/i.test(seg);
    const mentionsRouter = /\brouter(?:s)?\b|\bisr\b|\bwan\b|\bsucursal\b/i.test(seg);
    const mentionsFirewall = /\bfirewall(?:s)?\b|\bfirepower\b|\bngfw\b|\bmeraki\s+mx\b/i.test(seg);

    if (mentionsSwitch) {
      const ports: 8 | 16 | 24 | 48 = /\b48\s*(?:bocas|puertos|ports|p\b|t\b)/i.test(seg)
        ? 48
        : /\b16\s*(?:bocas|puertos|ports)/i.test(seg)
          ? 16
          : /\b8\s*(?:bocas|puertos|ports)/i.test(seg)
            ? 8
            : 24;

      const explicitlyNoPoe = /\bsin\s+poe\b|\bdata\s+only\b|\bsolo\s+datos\b/i.test(seg);
      const isPoe = explicitlyNoPoe ? false : /\bpoe\+?\b|\bfull\s*poe\b/i.test(seg) || true;
      const isFullPoe = /\bfull\s*poe\b|\b740w\b|\bfp\b/i.test(seg);
      const is10G = /\b10\s*g\b|\bsfp\+\b|\b4x\b/i.test(seg);
      const is9300 = /\b9300\b|\bcore\b|\bcapa\s*3\s*avanzad/i.test(seg);
      const isSmb = /\bsmb\b|\becon[oó]mico\b|\bc1200\b|\bc1300\b|\bcbs\b/i.test(seg);

      let suggestedSku = '';
      if (isSmb) {
        suggestedSku = `C1300-${ports}${isPoe ? 'P' : 'T'}-${is10G ? '4X' : '4G'}`;
      } else if (is9300) {
        suggestedSku = `C9300-${ports}${isPoe ? 'P' : 'T'}-${licenseTier === 'Advantage' ? 'A' : 'E'}`;
      } else {
        const poeCode = !isPoe ? 'T' : isFullPoe && ports === 48 ? 'FP' : 'P';
        const uplinkCode = is10G ? '4X' : '4G';
        const tierCode = licenseTier === 'Advantage' ? 'A' : 'E';
        suggestedSku = `C9200L-${ports === 48 ? 48 : 24}${poeCode}-${uplinkCode}-${tierCode}`;
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
      const suggestedSku = isWifi6E ? 'CW9164I-MR' : 'MR46-HW';
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-ap`,
        suggestedActiveSku: suggestedSku,
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

  // Si no detectó en segmentos individuales, evaluar el bloque entero
  if (extractedItems.length === 0) {
    processSegment(cleanText, 0);
  }

  return {
    clientName: 'Cliente',
    items: extractedItems,
    providerUsed: 'Motor Local Determinista Cisco (0 Tokens)',
  };
}

/**
 * Enriquecimiento post-inferencia:
 * 1. Verifica contra EOL_CATALOG_2026 que no se reemplace un modelo vigente en 2026.
 * 2. Guarda cualquier SKU nuevo descubierto por la IA en la base dinámica auto-aprendizaje.
 */
function postProcessExtractedResult(result: ExtractedRequirementResult): ExtractedRequirementResult {
  const processedItems = (result.items || []).map((item, idx) => {
    const rawSku = (item.rawMentionedSku || '').trim().toUpperCase();
    let suggested = (item.suggestedActiveSku || '').trim().toUpperCase();

    // Si hay SKU mencionado en nuestro catálogo verificado EOL 2026:
    if (rawSku && EOL_CATALOG_2026[rawSku]) {
      const entry = EOL_CATALOG_2026[rawSku];
      suggested = entry.replacementSku;
      item.isEol2026 = entry.status === 'eos_eol_active';
      item.eolReason = entry.eolNote;
      item.officialCiscoUrl = item.officialCiscoUrl || entry.officialCiscoDocUrl;
    } else if (rawSku && !item.isEol2026) {
      // Si el modelo NO está en EOL 2026 (sigue vigente), respetamos el modelo original solicitado
      suggested = rawSku;
    }

    // Auto-aprender el SKU en nuestra base dinámica local si la IA trajo información nueva
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
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      ...item,
      id: item.id || `item-${Date.now()}-${idx}`,
      suggestedActiveSku: suggested,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      licenseTier: item.licenseTier || 'Essentials',
      termYears: item.termYears && item.termYears > 0 ? item.termYears : 3,
    };
  });

  return {
    ...result,
    items: processedItems,
  };
}

/**
 * Función principal de extracción inteligente con rotación automática de API Keys
 * y fallback determinista local sin interrupción del servicio.
 */
export async function extractBOMRequirementsFromInput(
  input: { text?: string; imageBase64?: string; mimeType?: string },
  explicitApiKey?: string
): Promise<ExtractedRequirementResult> {
  const settings = loadAiSettings();
  const rotatedKeysLog: string[] = [];

  // Construir lista priorizada de API Keys activas
  const candidateKeys: ApiKeyEntry[] = [];
  if (explicitApiKey && explicitApiKey.trim()) {
    candidateKeys.push({
      id: 'explicit-runtime-key',
      provider: 'gemini',
      label: 'API Key Directa',
      apiKey: explicitApiKey.trim(),
      model: 'gemini-2.5-flash',
      enabled: true,
    });
  }

  for (const k of settings.keys) {
    if (k.enabled && k.apiKey && k.apiKey.trim()) {
      candidateKeys.push(k);
    }
  }

  // Probar cada API Key activa en orden; si una agota tokens (429) o falla, rotar a la siguiente
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
        finalResult.providerUsed = `${keyEntry.provider.toUpperCase()} (${keyEntry.model})`;
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
          isQuota ? 'Tokens/Cuota agotada (429) -> Rotando a siguiente API...' : `Error (${errMsg.slice(0, 80)}) -> Rotando...`
        }`
      );
    }
  }

  // Fallback automático al Motor Determinista Local si no hay keys activas o todas agotaron tokens
  if (settings.autoFallbackToLocal || candidateKeys.length === 0) {
    if (input.text && input.text.trim()) {
      const localRes = postProcessExtractedResult(extractWithLocalDeterministicEngine(input.text));
      localRes.rotatedKeysLog = rotatedKeysLog;
      if (rotatedKeysLog.length > 0) {
        localRes.providerUsed = 'Motor Local Determinista Cisco (Activado por rotación tras agotarse tokens API)';
      }
      return localRes;
    }
  }

  throw new Error(
    rotatedKeysLog.length > 0
      ? `Todas las API Keys configuradas fallaron o agotaron sus tokens:\n${rotatedKeysLog.join('\n')}`
      : 'No hay una API Key válida para procesar imágenes sin texto. Configura una API Key (Gemini, Groq o OpenRouter) en el botón "Configurar APIs / Rotación".'
  );
}
