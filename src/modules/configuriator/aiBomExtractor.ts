// ============================================================================
// CISCO AUTOMATED v2.1 - AI MULTIMODAL BOM EXTRACTOR & MADRE-HIJO ARCHITECT
// Prioridad #1: IA Multimodal (Gemini 3.7 Flash para texto / 3.6 Flash -> 3.8 Flash
// para imágenes y cascada ascendente + OpenRouter Vision/DeepSeek).
// Analiza lenguaje natural y capturas de pantalla (Ctrl+V), estructura siempre
// la jerarquía Madre-Hijo de Cisco CCW para TODA la línea Cisco & Meraki (Switching,
// Industrial IE, Servidores UCS M7, Nexus DC, Seguridad FPR/MX, Colaboración DP-9800/Room Bar),
// usa por defecto el cable de poder Norma Chile / Italia (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT),
// evita 100% cualquier P/N con EOL y rota automáticamente entre modelos y API Keys.
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
  PowerCordStandard,
} from './catalogRules';

export interface ExtractedRequirementItem {
  id?: string;
  rawMentionedSku?: string;
  suggestedActiveSku?: string; // SKU Madre (Chasis Padre / Contenedor CCW) 100% vigente 2026
  selectedEolAlternativeSku?: string; // Alternativa oficial seleccionada por el ingeniero en UI
  isEol2026?: boolean;         // true solo si está obsoleto/EoS en 2026
  keepOriginalSku?: boolean;
  eolReason?: string;
  officialCiscoUrl?: string;
  deviceType:
    | 'switch'
    | 'access_point'
    | 'router'
    | 'firewall'
    | 'industrial_switch'
    | 'server_ucs'
    | 'nexus_dc'
    | 'collaboration'
    | 'license_only'
    | 'accessory';
  ports?: 8 | 16 | 24 | 48;
  isPoe?: boolean;
  poeBudget?: 'standard' | 'full_poe';
  uplinkType?: '1G' | '10G' | 'SFP+';
  licenseTier?: 'Essentials' | 'Advantage';
  termYears?: number; // Default: 3
  quantity: number;   // Default: 1
  includeStacking?: boolean;
  includeRedundantPsu?: boolean;
  includeSmartNet?: boolean;
  smartNetLevel?: '8x5xNBD' | '24x7x4';
  powerCordStandard?: PowerCordStandard; // Default en Chile: 'italy_chile' (CAB-IT: CAB-ACA / CAB-TA-IT)
  merakiLicenseMode?: 'subscription' | 'coterm';
  extraTransceivers?: { sku: string; qty: number; description: string }[];
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
Eres el Arquitecto Senior de Preventa Técnica "ConfigurIAtor" de Cisco e Intcomex Chile (Año 2026).
Tu prioridad absoluta es comprender solicitudes en LENGUAJE NATURAL (correos, chats, requerimientos técnicos) o CAPTURAS DE PANTALLA (tablas, cotizaciones, diagramas, listas de equipos) de CUALQUIER familia del portafolio completo de Cisco y Meraki, y transformarlas en una estructura jerárquica **MADRE-HIJO (Parent-Child Assembly)** 100% compatible con Cisco Commerce Workspace (CCW) y 100% VIGENTE EN 2026 (CERO SKUs con End-of-Sale / EOL).

REGLAS OBLIGATORIAS DE ESTRUCTURA MADRE-HIJO Y PREVENTA CISCO CCW CHILE (2026):
1. REGLA CRÍTICA DE CABLE DE PODER EN CHILE (NORMA CHILE / ITALIA "CAB-IT" POR DEFECTO):
   - En Chile el enchufe eléctrico estándar es **Tipo L / Norma Chilena-Italiana (CEI 23-50 / CEI 23-16 de 3 patas en línea)**.
   - Por lo tanto, **SIEMPRE POR DEFECTO** cuando el cliente no pida otro tipo de enchufe, debes asignar "powerCordStandard": "italy_chile" y usar el cable de poder de Italia/Chile en los Hijos (aiSubItems):
     * Para Switches Catalyst 9200/9200L, Meraki MS130-SWITCHES, Routers C8200/C8300, Firewalls FPR, Servidores UCS M7 y Switches Nexus: usa **"CAB-ACA"** ("AC Power Cord (Italy/Chile), 10A, CEI 23-16, 2.5m").
     * Para Switches Catalyst 9300/9300L (Config 1): usa **"CAB-TA-IT"** ("Cisco Cabinet Jumper Power Cord, 250VAC 10A, Italy/Chile Plug").
     * Para Switches SMB Catalyst 1200/1300: usa **"CAB-C13-IT"**.
     * Para equipos Meraki MS225 / MX: usa **"MA-PWR-CORD-IT"**.
   - Solo si el cliente pide explícitamente cable para **PDU de Rack (C13-C14 / C15)** pon "powerCordStandard": "rack_pdu" ("CAB-C13-C14-2M" o "CAB-C15-CBN"), y si pide explícitamente **Schuko Europeo** pon "powerCordStandard": "schuko_eu" ("CAB-ACE" o "CAB-TA-EU").

2. COBERTURA TOTAL DEL PORTAFOLIO CISCO & MERAKI (100% VIGENTE 2026 — PROHIBIDO ENTREGAR EOL):
   - **Enterprise Switching (Catalyst)**:
     * Modelos activos 2026: "C9200L-24P-4G-E", "C9200L-24P-4X-E", "C9200L-48P-4G-E", "C9200L-48P-4X-E", "C9200L-48FP-4G-E", "C9200L-48FP-4X-E", "C9300-24P-E", "C9300-48P-E", "C9300L-24P-4X-E", "C9300L-48P-4X-E", "C1300-24P-4G", "C1300-24P-4X", "C1300-48P-4X", "C1200-24P-4G".
     * Reemplazos EOL obligatorios: WS-C2960X / WS-C2960L -> C9200L; WS-C3850 / WS-C3650 -> C9300; CBS250 / SG250 -> C1200; CBS350 / SG350 -> C1300.
   - **Meraki Cloud Switching, Wi-Fi, SD-WAN & Cámaras**:
     * **PROHIBIDO INVENTAR SKUs EN MS130**: En la familia Meraki **MS130** NO existen modelos terminados en "FP" ni en "-HW" (JAMÁS devuelvas "MS130-48FP", "MS130-48FP-HW" ni "MS130-48P-HW"). Los únicos modelos MS130 reales son: "MS130-8", "MS130-8P", "MS130-8X", "MS130-12X", "MS130-24", "MS130-24P", "MS130-24X", "MS130-48", "MS130-48P", "MS130-48X" (máx. 370W PoE+), ensamblados siempre bajo el contenedor Madre **"MS130-SWITCHES:MS130-48P"** con hijos "MS130-48P", "CAB-ACA" y "LIC-MS130-48-3Y".
     * Si el cliente pide un switch EOL de 740W Full PoE+ como **"MS210-48FP"**, pon "rawMentionedSku": "MS210-48FP", "isEol2026": true y "suggestedActiveSku": "MS225-48FP-HW" (con hijos "LIC-MS225-48FP-3YR" y "MA-PWR-CORD-IT").
     * Wi-Fi vigente 2026: "MR36-HW", "MR46-HW", "CW9162I-MR", "CW9164I-MR", "CW9166I-MR" (con hijo "LIC-MR-E" o "LIC-ENT-3YR"). Reemplaza MR33/MR42/MR52 EOL.
     * Firewalls Meraki MX vigentes 2026: "MX67-HW", "MX68-HW", "MX75-HW", "MX85-HW", "MX95-HW". Reemplaza MX64/MX65/MX84/MX100 EOL.
   - **Switches Industriales Cisco Industrial Ethernet (IE — Minería, Subestaciones, Plantas)**:
     * Modelos activos 2026 (deviceType: "industrial_switch"): **"IE-3100-8T2C-E"**, **"IE-3300-8T2S-E"**, **"IE-3300-8P2S-E"** (PoE+), **"IE-3400-8P2S-E"** (Full PoE+), **"IE-3400-8T2S-E"**.
     * Reemplazos EOL obligatorios: IE-2000 -> "IE-3100-8T2C-E"; IE-3000 -> "IE-3300-8T2S-E"; IE-4000 -> "IE-3400-8P2S-E".
     * Hijos obligatorios en aiSubItems: Licencia DNA Industrial ("IE3300-DNA-E-3Y" / "IE3400-DNA-E-3Y", durationMonths=36, initialTerm=36, billingModel="Prepaid Term"), Fuente DIN-Rail ("PWR-IE170W-PC-AC=" para PoE o "PWR-IE50W-AC=" sin PoE), Cable Italia/Chile "CAB-ACA" y Memoria SD "SD-IE-4GB=".
   - **Servidores Data Center Cisco UCS M7 (deviceType: "server_ucs")**:
     * Modelos activos 2026: **"UCSC-C220-M7S"** (Rack 1RU) y **"UCSC-C240-M7S"** (Rack 2RU).
     * Reemplazos EOL obligatorios: UCSC-C220-M5SX / UCSC-C220-M6S -> "UCSC-C220-M7S"; UCSC-C240-M5SX / UCSC-C240-M6S -> "UCSC-C240-M7S".
     * Hijos obligatorios en aiSubItems: Licencia Intersight ("DC-MGT-SAAS-EST-3Y", durationMonths=36, initialTerm=36, billingModel="Prepaid Term"), CPU Xeon Gen 5 ("UCS-CPU-I4510"), 2x RAM DDR5 ("UCS-MRX32G1RE3", qtyMultiplier=2), Controladora RAID ("UCSC-RAID-M7"), 2x SSD Enterprise ("UCS-SD960GM3X-EP", qtyMultiplier=2), TPM 2.0 ("UCSX-TPM-OPT-002"), Rieles ("UCSC-RAIL-M7"), Fuente ("UCSC-PSU1-1050W") y Cable Italia/Chile **"CAB-ACA"**.
   - **Data Center Switching Cisco Nexus 9000 (deviceType: "nexus_dc")**:
     * Modelos activos 2026: **"N9K-C93180YC-FX3"** (48p 10/25G SFP28 + 6p 40/100G QSFP28) y **"N9K-C9336C-FX2"**.
     * Reemplazos EOL obligatorios: N9K-C93180YC-EX / N9K-C93180YC-FX -> "N9K-C93180YC-FX3".
     * Hijos en aiSubItems: Suscripción DCN ("DCN-E-C93180-3Y", durationMonths=36, initialTerm=36, billingModel="Prepaid Term"), 2x Fuentes ("NXA-PAC-650W-PI", qtyMultiplier=2), 2x Cables Italia/Chile ("CAB-ACA", qtyMultiplier=2), 4x Ventiladores ("NXA-FAN-30CFM-F", qtyMultiplier=4) y Kit Rieles ("N9K-C9300-ACK").
   - **Seguridad Cisco Secure Firewall FPR (deviceType: "firewall")**:
     * Modelos activos 2026: **"FPR1010-NGFW-K9"** (Desktop), **"FPR1120-NGFW-K9"** (1RU Branch), **"FPR1140-NGFW-K9"**, **"FPR1210T-K9"**, **"FPR3110-NGFW-K9"** (Reemplazo oficial de la serie FPR2100).
     * Reemplazos EOL obligatorios: ASA5506-X -> "FPR1010-NGFW-K9"; ASA5508-X / ASA5516-X -> "FPR1120-NGFW-K9"; FPR2110 / FPR2120 -> "FPR3110-NGFW-K9".
     * Hijos en aiSubItems: Suscripción Threat Defense TMC ("L-FPR1010T-TMC-3Y" / "L-FPR1120T-TMC-3Y" / "L-FPR3110T-TMC-3Y", durationMonths=36, initialTerm=36, billingModel="Prepaid Term"), Software base y Cable Italia/Chile **"CAB-ACA"**.
   - **Colaboración: Teléfonos IP Cisco Desk Phone 9800 & Barras de Video Webex Room Bar (deviceType: "collaboration")**:
     * Modelos activos 2026: Teléfonos IP **"DP-9841-K9"**, **"DP-9851-K9"**, **"DP-9861-K9"**, **"DP-9871-K9"**; Video Colaboración **"CS-BAR-T-C-K9"** (Cisco Room Bar), **"CS-BARPRO-C-K9"** (Cisco Room Bar Pro), **"CS-BRD55P-G2-K9"** (Board Pro 55 G2).
     * Reemplazos EOL obligatorios: CP-7821-K9 / CP-7841-K9 -> "DP-9841-K9"; CP-8841-K9 / CP-8851-K9 -> "DP-9851-K9"; CP-8861-K9 / CP-8865-K9 -> "DP-9861-K9"; CS-KIT-K9 / CS-KITMINI-K9 -> "CS-BAR-T-C-K9"; CS-KITPLUS-K9 -> "CS-BARPRO-C-K9".
     * Hijos en aiSubItems: Para teléfonos DP-98xx incluye "LIC-CE-USER-3Y" (durationMonths=36, initialTerm=36, billingModel="Prepaid Term"); para Room Bar incluye "L-ROOM-RM-3Y" y cable Italia/Chile **"CAB-ACA"**.
   - **Transceivers / Módulos SFP y Fibra Óptica Vigentes 2026**:
     * PROHIBIDO entregar "GLC-SX-MM" (EOL -> usar **"GLC-SX-MMD"**), "GLC-LH-SM" (EOL -> usar **"GLC-LH-SMD"**), "GLC-T" (EOL -> usar **"GLC-TE"**). Para 10G usa **"SFP-10G-SR-S"**, **"SFP-10G-LR-S"** o DAC **"SFP-H10GB-CU1M"** / **"SFP-H10GB-CU3M"**. Si el cliente pide módulos SFP junto con un switch, agrégalos en "extraTransceivers": [{ "sku": "SFP-10G-SR-S", "qty": 2, "description": "10GBASE-SR SFP+ Module" }].

3. DETECCIÓN DE SMARTNET Y ESQUEMA MERAKI:
   - Si el cliente menciona "SmartNet", "SNTC", "CON-SNT", "soporte 8x5xNBD" o "24x7x4", activa "includeSmartNet": true y "smartNetLevel": "8x5xNBD" (o "24x7x4").
   - Si el cliente menciona en Meraki "Co-Term" o "Co-Termination", pon "merakiLicenseMode": "coterm"; por defecto usa "merakiLicenseMode": "subscription".

4. DEFAULTS DE INGENIERÍA:
   - Si no indica cantidad: quantity = 1.
   - Si no indica licencia: licenseTier = "Essentials".
   - Si no indica plazo: termYears = 3 (36 meses).
   - Si no indica cable de poder: powerCordStandard = "italy_chile" (Cable Italia/Norma Chile CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT).

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
      "includeSmartNet": false,
      "smartNetLevel": "8x5xNBD",
      "powerCordStandard": "italy_chile",
      "merakiLicenseMode": "subscription",
      "extraTransceivers": [],
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
          "partNumber": "CAB-ACA",
          "qtyMultiplier": 1,
          "description": "AC Power Cord (Italy/Chile CAB-IT), 10A, CEI 23-16, 2.5m"
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
    ? `Analiza la siguiente solicitud comercial en lenguaje natural (y la imagen adjunta si existe). Extrae todos los equipos Cisco o Meraki (Switching, Industrial IE, Servidores UCS, Nexus, Seguridad, Colaboración, Wi-Fi), reemplaza cualquier SKU en EOL por su equivalente oficial 100% vigente en CCW, aplica por defecto el cable de poder Norma Chile / Italia (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT) salvo que pidan otro, y genera su estructura completa Madre-Hijo (suggestedActiveSku + aiSubItems) en JSON:\n\n"${input.text.trim()}"`
    : `Analiza minuciosamente esta captura de pantalla / imagen. Extrae todos los equipos, SKUs o requerimientos Cisco/Meraki que aparezcan en la imagen, reemplaza cualquier SKU con EOL por su equivalente 100% vigente, aplica por defecto el cable de poder Norma Chile / Italia (CAB-IT: CAB-ACA / CAB-TA-IT) y genera su estructura completa Madre-Hijo (suggestedActiveSku + aiSubItems) en JSON.`;

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
        if (res.status === 401 || res.status === 403 || errBody.includes('API_KEY_INVALID')) {
          throw new Error(lastModelError);
        }
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
    ? `Analiza la siguiente solicitud comercial de preventa Cisco/Meraki para el año 2026 y devuelve ÚNICAMENTE el objeto JSON con la estructura Madre-Hijo (suggestedActiveSku + aiSubItems) usando por defecto el cable Norma Chile/Italia (CAB-IT: CAB-ACA / CAB-TA-IT):\n\n${input.text.trim()}`
    : `Analiza minuciosamente esta imagen/captura de pantalla, extrae todos los equipos o SKUs Cisco/Meraki que aparecen y devuelve ÚNICAMENTE el objeto JSON con la estructura Madre-Hijo (suggestedActiveSku + aiSubItems).`;

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
// MOTOR DETERMINISTA LOCAL DE PREVENTA CISCO (RESPALDO INTEGRAL)
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
          powerCordStandard: 'italy_chile',
          notes: 'Configuración base Catalyst 9200L 24P PoE+ (Norma Chile/Italia CAB-ACA)',
        },
      ],
      providerUsed: 'Motor Local Determinista Cisco',
    };
  }

  const segments = cleanText
    .split(
      /\r?\n|;|(?:\s+y\s+(?=\d+\s*(?:switch|ap|access|router|firewall|servidor|server|ucs|nexus|ie-|industrial|tel[eé]fono|phone|room|webex|licencia|c9|ws-|mr|mx|ms|isr|cbs|dp-|cp-|cs-)))/i
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const extractedItems: ExtractedRequirementItem[] = [];
  const learnedSkus = getLearnedCiscoSkus();
  const skuRegex =
    /\b(WS-C[A-Z0-9-]+|C9[2345]00[A-Z0-9-]*|C1[023]00-[A-Z0-9-]+|CBS[23]50-[A-Z0-9-]+|ISR4[0-9]{3}[A-Z0-9/-]*|C8[235]00[A-Z0-9-]*|MR[345][0-9](?:-HW)?|CW91[67][0-9][A-Z0-9-]*|MS[1234][0-9]{2}-[A-Z0-9-]+|MX[6789][0-9](?:-HW)?|FPR[1234][0-9]{3}[A-Z0-9-]*|ASA55[0-9]{2}-[A-Z0-9-]+|IE-[234][0-9]{3}-[A-Z0-9-]+|UCSC-C[24][24]0-M[567][A-Z0-9-]*|N9K-C[A-Z0-9-]+|CP-[78][80-9]{3}-[A-Z0-9-]+|DP-98[4567]1-K9|CS-(?:KIT|BAR|BRD)[A-Z0-9-]*|GLC-[A-Z0-9-]+|SFP-[A-Z0-9-]+)\b/gi;

  const inferDeviceTypeFromSku = (sku: string): ExtractedRequirementItem['deviceType'] => {
    const s = sku.toUpperCase();
    if (s.startsWith('IE-')) return 'industrial_switch';
    if (s.startsWith('UCSC-')) return 'server_ucs';
    if (s.startsWith('N9K-')) return 'nexus_dc';
    if (s.startsWith('DP-') || s.startsWith('CP-') || s.startsWith('CS-')) return 'collaboration';
    if (s.startsWith('MR') || s.startsWith('CW')) return 'access_point';
    if (s.startsWith('C8') || s.startsWith('ISR')) return 'router';
    if (s.startsWith('FPR') || s.startsWith('ASA') || s.startsWith('MX')) return 'firewall';
    return 'switch';
  };

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
    const includeSmartNet = /\bsmartnet\b|\bsntc\b|\bcon-snt\b|\b8x5xnbd\b|\b24x7x4\b/i.test(seg);
    const smartNetLevel: '8x5xNBD' | '24x7x4' = /\b24x7/i.test(seg) ? '24x7x4' : '8x5xNBD';
    const powerCordStandard: PowerCordStandard = /\bpdu\b|\bc13-c14\b|\bc15\b/i.test(seg)
      ? 'rack_pdu'
      : /\bschuko\b|\bcee\s*7\/7\b|\bcab-ace\b/i.test(seg)
        ? 'schuko_eu'
        : 'italy_chile';
    const merakiLicenseMode: 'subscription' | 'coterm' = /\bco-?term/i.test(seg)
      ? 'coterm'
      : 'subscription';

    let quantity = 1;
    const qtyBeforeKeyword = seg.match(
      /(?:^|\bcot[ií]zame\s+|\bcotizar\s+|\bnecesito\s+|\brequiero\s+|\bson\s+)(\d{1,3})\s+(?:switch|equipo|ap\b|access|router|firewall|servidor|server|ucs|nexus|tel[eé]fono|barra|unidad|chasis|ws-|c9|mr|mx|ms|isr|cbs|ie-|dp-|cp-)/i
    );
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
        const isPoe = /P|FP|POE/i.test(suggestedSku) && !/24T|48T|8T/i.test(suggestedSku);
        const ports: 8 | 16 | 24 | 48 | undefined = suggestedSku.includes('48')
          ? 48
          : suggestedSku.includes('24')
            ? 24
            : suggestedSku.includes('8')
              ? 8
              : undefined;

        extractedItems.push({
          id: `item-${Date.now()}-${idx}-${rawSku}`,
          rawMentionedSku: sanitized.inferredLegacyEolSku || rawSku,
          suggestedActiveSku: suggestedSku,
          isEol2026: isEol || Boolean(sanitized.inferredLegacyEolSku),
          eolReason: eolInfo?.eolNote || sanitized.correctionReason || learned?.eolNote,
          officialCiscoUrl: eolInfo?.officialCiscoDocUrl || learned?.officialUrl,
          deviceType: inferDeviceTypeFromSku(suggestedSku),
          ports,
          isPoe,
          uplinkType: suggestedSku.includes('4X') ? '10G' : '1G',
          licenseTier,
          termYears,
          quantity,
          includeStacking,
          includeRedundantPsu,
          includeSmartNet,
          smartNetLevel,
          powerCordStandard,
          merakiLicenseMode,
          notes: seg.slice(0, 120),
        });
      }
      return;
    }

    const mentionsIndustrial = /\bindustrial(?:es)?\b|\bdin-?rail\b|\brie?l\s+din\b|\bminera\b|\bsubestaci[oó]n\b|\bie-?3[0134]00\b/i.test(seg);
    const mentionsServer = /\bservidor(?:es)?\b|\bserver\b|\bucs\b|\bm7\b|\bc220\b|\bc240\b/i.test(seg);
    const mentionsNexus = /\bnexus\b|\bn9k\b|\bdata\s*center\s+switch\b|\btor\s+switch\b/i.test(seg);
    const mentionsCollab = /\btel[eé]fono(?:s)?\b|\bip\s*phone\b|\bvideoconferencia\b|\broom\s*bar\b|\bwebex\b|\bcolaboraci[oó]n\b/i.test(seg);
    const mentionsSwitch = /\bswitch(?:es)?\b|\bbocas\b|\bpuertos\b|\bcatalyst\b|\bmeraki\s+ms\b/i.test(seg);
    const mentionsAp = /\b(?:ap|aps|access\s*points?|wifi|wi-fi|inal[aá]mbric[oa]|meraki\s+mr)\b/i.test(seg);
    const mentionsRouter = /\brouter(?:s)?\b|\bisr\b|\bwan\b|\bsucursal\b/i.test(seg);
    const mentionsFirewall = /\bfirewall(?:s)?\b|\bfirepower\b|\bngfw\b|\bmeraki\s+mx\b|\bseguridad\b/i.test(seg);

    if (mentionsIndustrial) {
      const isPoe = !/\bsin\s+poe\b|\bsolo\s+datos\b/i.test(seg);
      const isRugged3400 = /\b3400\b|\bfull\s*poe\b/i.test(seg);
      const suggestedSku = isRugged3400
        ? 'IE-3400-8P2S-E'
        : isPoe
          ? 'IE-3300-8P2S-E'
          : 'IE-3300-8T2S-E';
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-ie`,
        suggestedActiveSku: suggestedSku,
        isEol2026: false,
        deviceType: 'industrial_switch',
        ports: 8,
        isPoe,
        licenseTier,
        termYears,
        quantity,
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsServer) {
      const is2Ru = /\b2ru\b|\b2u\b|\bc240\b|\balto\s+almacenamiento\b/i.test(seg);
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-ucs`,
        suggestedActiveSku: is2Ru ? 'UCSC-C240-M7S' : 'UCSC-C220-M7S',
        isEol2026: false,
        deviceType: 'server_ucs',
        licenseTier,
        termYears,
        quantity,
        includeRedundantPsu: true,
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsNexus) {
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-n9k`,
        suggestedActiveSku: 'N9K-C93180YC-FX3',
        isEol2026: false,
        deviceType: 'nexus_dc',
        ports: 48,
        licenseTier,
        termYears,
        quantity,
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsCollab) {
      const isVideoBar = /\bvideo\b|\bsala\b|\broom\b|\bbar\b|\bkit\b/i.test(seg);
      extractedItems.push({
        id: `item-${Date.now()}-${idx}-collab`,
        suggestedActiveSku: isVideoBar ? 'CS-BAR-T-C-K9' : 'DP-9851-K9',
        isEol2026: false,
        deviceType: 'collaboration',
        isPoe: !isVideoBar,
        licenseTier,
        termYears,
        quantity,
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        notes: seg.slice(0, 120),
      });
    } else if (mentionsSwitch) {
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
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        merakiLicenseMode,
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
        isPoe: true,
        licenseTier,
        termYears,
        quantity,
        merakiLicenseMode,
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
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
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
        includeSmartNet,
        smartNetLevel,
        powerCordStandard,
        merakiLicenseMode,
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

  const sanitized = sanitizeAndValidateCcwSku(rawClean);
  const clean = sanitized.sanitizedSku;

  if (clean.startsWith('MS130-SWITCHES:') || clean === 'MS130-SWITCHES') {
    return clean;
  }

  const tierCode = tier === 'Advantage' ? 'A' : 'E';

  if (/^C9200L?-\d{2}(?:FP|P|T|PXG)-(?:4G|4X|2Y|8X|12X)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  if (/^C9[23]00-\d{2}(?:FP|P|T|U|UXM|PF)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  if (/^C9300L-\d{2}(?:PF|P|T)-(?:4G|4X)$/i.test(clean)) {
    return `${clean}-${tierCode}`;
  }
  if (
    /^(?:MR[3456]\d|MX[6789]\d|MX10\d|MS(?:210|220|225|250|350|390|410|425)-[0-9A-Z]+)$/i.test(clean) &&
    !clean.endsWith('-HW')
  ) {
    return `${clean}-HW`;
  }
  if (/^FPR(?:1010|1120|1140|1150|2110|2120|2130|2140|3110)$/i.test(clean)) {
    return `${clean}-NGFW-K9`;
  }

  return clean;
}

function isLooksLikeRealCiscoSku(str: string): boolean {
  const s = (str || '').trim().toUpperCase();
  if (!s || s.includes(' ')) return false;
  return /^(?:WS-C|C9[23456]00|C1[0123]00|C8[235]00|ISR\d|ASR\d|FPR\d|ASA\d|MR\d|MS\d|MX\d|CW\d|CBS\d|IE-\d|UCSC-|N9K-|DP-98|CP-[78]|CS-|SFP-|GLC-|PWR-|CAB-)/i.test(s);
}

function postProcessExtractedResult(result: ExtractedRequirementResult): ExtractedRequirementResult {
  const processedItems = (result.items || []).map((item, idx) => {
    const tier: 'Essentials' | 'Advantage' =
      item.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';

    let rawSku = (item.rawMentionedSku || '').trim().toUpperCase();
    const rawSanitized = sanitizeAndValidateCcwSku(item.suggestedActiveSku || rawSku);

    if (!rawSku && rawSanitized.inferredLegacyEolSku) {
      rawSku = rawSanitized.inferredLegacyEolSku;
    }
    if (/^MS130-(?:48|24)FP(?:-HW)?$/i.test(rawSku) && rawSanitized.inferredLegacyEolSku) {
      rawSku = rawSanitized.inferredLegacyEolSku;
    }

    let suggested = normalizeParentChassisSku(rawSanitized.sanitizedSku || item.suggestedActiveSku || '', tier);

    const eolLookup = EOL_CATALOG_2026[rawSku] || EOL_CATALOG_2026[rawSku.replace(/-HW$/i, '')];
    if (rawSku && eolLookup) {
      const isValidAlternative =
        suggested.startsWith('MS130-SWITCHES:') ||
        suggested.startsWith('MS225-') ||
        suggested.startsWith('C9200') ||
        suggested.startsWith('C9300') ||
        suggested.startsWith('C1200') ||
        suggested.startsWith('C1300') ||
        suggested.startsWith('IE-3') ||
        suggested.startsWith('UCSC-C2') ||
        suggested.startsWith('N9K-') ||
        suggested.startsWith('FPR') ||
        suggested.startsWith('MX') ||
        suggested.startsWith('DP-98') ||
        suggested.startsWith('CS-BAR');
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

    // Por defecto en Chile siempre Norma Italia/Chile (CAB-IT)
    const powerCordStandard: PowerCordStandard = item.powerCordStandard || 'italy_chile';

    // Normalizar cualquier sub-item de cable de poder o transceiver obsoleto devuelto por la IA
    const normalizedAiSubs = Array.isArray(item.aiSubItems)
      ? item.aiSubItems.map((sub) => {
          let pNum = (sub.partNumber || '').trim().toUpperCase();
          let desc = sub.description || '';
          if (powerCordStandard === 'italy_chile') {
            if (pNum === 'CAB-ACE') {
              pNum = 'CAB-ACA';
              desc = 'AC Power Cord (Italy/Chile CAB-IT), 10A, CEI 23-16, 2.5m';
            } else if (pNum === 'CAB-TA-EU') {
              pNum = 'CAB-TA-IT';
              desc = 'Cisco Cabinet Jumper Power Cord, 250VAC 10A, Italy/Chile Plug (CAB-TA-IT)';
            } else if (pNum === 'CAB-C13-CE') {
              pNum = 'CAB-C13-IT';
              desc = 'AC Power Cord C13 (Italy/Chile CAB-IT), 10A, CEI 23-16';
            }
          }
          // Reemplazar transceivers EOL si la IA los incluyó como sub-item
          const subSanitized = sanitizeAndValidateCcwSku(pNum);
          if (subSanitized.sanitizedSku !== pNum) {
            pNum = subSanitized.sanitizedSku;
          }
          return {
            ...sub,
            partNumber: pNum,
            description: desc || sub.description,
          };
        })
      : undefined;

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
                : targetToLearn.startsWith('IE-')
                  ? 'industrial_ie'
                  : targetToLearn.startsWith('UCSC-')
                    ? 'ucs_server'
                    : targetToLearn.startsWith('N9K-')
                      ? 'nexus_dc'
                      : targetToLearn.startsWith('DP-98') || targetToLearn.startsWith('CS-')
                        ? 'collaboration'
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
        defaultSubSkus: normalizedAiSubs && normalizedAiSubs.length > 0 ? normalizedAiSubs : undefined,
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
      powerCordStandard,
      merakiLicenseMode: item.merakiLicenseMode || 'subscription',
      aiSubItems: normalizedAiSubs,
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
