// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR CATALOG, EOL 2026 & ASSEMBLY ENGINE
// Base determinista + auto-aprendizaje de SKUs Cisco, estado de ciclo de vida
// (EOL vs Vigente 2026) y reglas de ensamblaje secuencial para Cisco CCW.
// ============================================================================

import { getFastTrackItem, getAllFastTrackItems } from '../fasttrack/fastTrackDb';
import { FastTrackProduct } from '../fasttrack/types';

export type CiscoProductFamily =
  | 'catalyst9200'
  | 'catalyst9300'
  | 'catalyst1200_1300'
  | 'catalyst8000'
  | 'meraki_mr'
  | 'meraki_ms'
  | 'meraki_mx'
  | 'catalyst_wireless'
  | 'firewall_fpr'
  | 'accessory'
  | 'generic';

export type EolLifecycleStatus = 'eos_eol_active' | 'active_with_newer_gen' | 'current_2026';

export interface EolMappingEntry {
  legacySku: string;
  replacementSku: string;
  status: EolLifecycleStatus;
  eosYear?: number;
  eolNote: string;
  canKeepOriginal: boolean; // Si aún es ordenable o si el cliente exige mantenerlo
  officialCiscoDocUrl?: string;
}

export interface SubItemConfig {
  partNumber: string;
  qtyMultiplier: number; // Por cada chasis padre (o 1 si es fijo)
  durationMonths?: number;
  initialTerm?: number;
  autoRenewTerm?: number;
  billingModel?: string;
  description: string;
  isOptional?: boolean;
  category?: 'dna_license' | 'power_supply' | 'power_cord' | 'network_stack' | 'stacking_kit' | 'uplink_module' | 'support';
}

export interface ChassisConfigOptions {
  licenseTier?: 'Essentials' | 'Advantage';
  termYears?: number; // 1, 3, 5, 7
  isPoe?: boolean;
  includeStackingKit?: boolean;
  includeRedundantPsu?: boolean;
  merakiLicenseMode?: 'coterm' | 'subscription';
}

export interface ChassisConfigRule {
  parentSku: string;
  family: CiscoProductFamily;
  description: string;
  officialUrl?: string;
  defaultSubItems: (options: ChassisConfigOptions) => SubItemConfig[];
}

// ============================================================================
// 1. DICCIONARIO DE CICLO DE VIDA (EOL / EOS 2026 vs VIGENTE)
// Distingue entre equipos estrictamente End-of-Sale (no ordenables en CCW)
// y equipos de generación anterior que pueden tener reemplazo sugerido.
// ============================================================================
export const EOL_CATALOG_2026: Record<string, EolMappingEntry> = {
  // --- Catalyst 2960X / 2960XR / 2960S / 2960L (End-of-Sale -> Catalyst 9200L / 9200 / 1200) ---
  'WS-C2960X-24PS-L': {
    legacySku: 'WS-C2960X-24PS-L',
    replacementSku: 'C9200L-24P-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 24P PoE+ 4x1G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html',
  },
  'WS-C2960X-48FPS-L': {
    legacySku: 'WS-C2960X-48FPS-L',
    replacementSku: 'C9200L-48P-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P PoE+ 4x1G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html',
  },
  'WS-C2960X-48LPS-L': {
    legacySku: 'WS-C2960X-48LPS-L',
    replacementSku: 'C9200L-48P-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P PoE+ 4x1G.',
    canKeepOriginal: false,
  },
  'WS-C2960X-24TS-L': {
    legacySku: 'WS-C2960X-24TS-L',
    replacementSku: 'C9200L-24T-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 24T Data 4x1G.',
    canKeepOriginal: false,
  },
  'WS-C2960X-48TS-L': {
    legacySku: 'WS-C2960X-48TS-L',
    replacementSku: 'C9200L-48T-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48T Data 4x1G.',
    canKeepOriginal: false,
  },
  'WS-C2960X-24PD-L': {
    legacySku: 'WS-C2960X-24PD-L',
    replacementSku: 'C9200L-24P-4X-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 24P PoE+ 4x10G SFP+.',
    canKeepOriginal: false,
  },
  'WS-C2960X-48FPD-L': {
    legacySku: 'WS-C2960X-48FPD-L',
    replacementSku: 'C9200L-48P-4X-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P PoE+ 4x10G SFP+.',
    canKeepOriginal: false,
  },
  'WS-C2960X-48TD-L': {
    legacySku: 'WS-C2960X-48TD-L',
    replacementSku: 'C9200L-48T-4X-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48T Data 4x10G SFP+.',
    canKeepOriginal: false,
  },
  'WS-C2960XR-24PS-I': {
    legacySku: 'WS-C2960XR-24PS-I',
    replacementSku: 'C9200-24P-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo modular: Catalyst 9200 24P.',
    canKeepOriginal: false,
  },
  'WS-C2960XR-48FPS-I': {
    legacySku: 'WS-C2960XR-48FPS-I',
    replacementSku: 'C9200-48P-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo modular: Catalyst 9200 48P.',
    canKeepOriginal: false,
  },

  // --- Catalyst 3850 / 3650 -> Catalyst 9300 / 9300L ---
  'WS-C3850-24P-S': {
    legacySku: 'WS-C3850-24P-S',
    replacementSku: 'C9300-24P-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300 24-port PoE+.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-9300-series-switches/index.html',
  },
  'WS-C3850-48P-S': {
    legacySku: 'WS-C3850-48P-S',
    replacementSku: 'C9300-48P-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300 48-port PoE+.',
    canKeepOriginal: false,
  },
  'WS-C3850-24T-S': {
    legacySku: 'WS-C3850-24T-S',
    replacementSku: 'C9300-24T-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300 24-port Data.',
    canKeepOriginal: false,
  },
  'WS-C3850-48T-S': {
    legacySku: 'WS-C3850-48T-S',
    replacementSku: 'C9300-48T-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300 48-port Data.',
    canKeepOriginal: false,
  },
  'WS-C3650-24PD-S': {
    legacySku: 'WS-C3650-24PD-S',
    replacementSku: 'C9300L-24P-4X-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300L 24P 4x10G Uplinks.',
    canKeepOriginal: false,
  },
  'WS-C3650-48FD-S': {
    legacySku: 'WS-C3650-48FD-S',
    replacementSku: 'C9300L-48PF-4X-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo: Catalyst 9300L 48P Full PoE 4x10G.',
    canKeepOriginal: false,
  },

  // --- Small Business CBS250 / CBS350 / SG350 / C1000 -> Catalyst 1200 / 1300 (EOL 2024-2026) ---
  'CBS250-24P-4G': {
    legacySku: 'CBS250-24P-4G',
    replacementSku: 'C1200-24P-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'CBS250 End-of-Sale. Reemplazo vigente 2026: Cisco Catalyst 1200 24P PoE 4x1G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-1200-series-switches/index.html',
  },
  'CBS250-48P-4G': {
    legacySku: 'CBS250-48P-4G',
    replacementSku: 'C1200-48P-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'CBS250 End-of-Sale. Reemplazo vigente 2026: Cisco Catalyst 1200 48P PoE 4x1G.',
    canKeepOriginal: false,
  },
  'CBS350-24P-4G': {
    legacySku: 'CBS350-24P-4G',
    replacementSku: 'C1300-24P-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'CBS350 End-of-Sale. Reemplazo vigente 2026: Cisco Catalyst 1300 24P PoE 4x1G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-1300-series-switches/index.html',
  },
  'CBS350-48P-4G': {
    legacySku: 'CBS350-48P-4G',
    replacementSku: 'C1300-48P-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'CBS350 End-of-Sale. Reemplazo vigente 2026: Cisco Catalyst 1300 48P PoE 4x1G.',
    canKeepOriginal: false,
  },
  'C1000-24P-4G-L': {
    legacySku: 'C1000-24P-4G-L',
    replacementSku: 'C1300-24P-4G',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Catalyst 1000 en transición hacia Catalyst 1300 (C1300-24P-4G). Puedes mantener C1000 si hay stock o migrar a C1300.',
    canKeepOriginal: true,
  },
  'C1000-48P-4G-L': {
    legacySku: 'C1000-48P-4G-L',
    replacementSku: 'C1300-48P-4G',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Catalyst 1000 en transición hacia Catalyst 1300 (C1300-48P-4G). Puedes mantener C1000 o migrar a C1300.',
    canKeepOriginal: true,
  },

  // --- Routers ISR 4000 -> Catalyst 8200 / 8300 (EoS 2023) ---
  'ISR4321/K9': {
    legacySku: 'ISR4321/K9',
    replacementSku: 'C8200L-1N-4T',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'ISR 4321 End-of-Sale. Reemplazo oficial: Catalyst 8200L (C8200L-1N-4T) o C8200-1N-4T.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
  },
  'ISR4331/K9': {
    legacySku: 'ISR4331/K9',
    replacementSku: 'C8200-1N-4T',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'ISR 4331 End-of-Sale. Reemplazo oficial: Catalyst 8200 (C8200-1N-4T).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
  },
  'ISR4351/K9': {
    legacySku: 'ISR4351/K9',
    replacementSku: 'C8300-1N1S-4T2X',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'ISR 4351 End-of-Sale. Reemplazo oficial: Catalyst 8300 (C8300-1N1S-4T2X).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8300-series-edge-platforms/index.html',
  },
  'ISR4431/K9': {
    legacySku: 'ISR4431/K9',
    replacementSku: 'C8300-1N1S-6T',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'ISR 4431 End-of-Sale. Reemplazo oficial: Catalyst 8300 (C8300-1N1S-6T).',
    canKeepOriginal: false,
  },

  // --- Meraki Wi-Fi 5 (EoS) y Wi-Fi 6 (Vigentes / Evolución Wi-Fi 6E) ---
  'MR33': {
    legacySku: 'MR33',
    replacementSku: 'MR36-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR33 End-of-Sale. Reemplazo directo Wi-Fi 6: MR36-HW (o CW9162I-MR Wi-Fi 6E).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://meraki.cisco.com/product/wi-fi/indoor-access-points/mr36/',
  },
  'MR33-HW': {
    legacySku: 'MR33-HW',
    replacementSku: 'MR36-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR33-HW End-of-Sale. Reemplazo directo Wi-Fi 6: MR36-HW.',
    canKeepOriginal: false,
  },
  'MR42': {
    legacySku: 'MR42',
    replacementSku: 'MR46-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR42 End-of-Sale. Reemplazo directo Wi-Fi 6: MR46-HW (o CW9164I-MR Wi-Fi 6E).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://meraki.cisco.com/product/wi-fi/indoor-access-points/mr46/',
  },
  'MR42-HW': {
    legacySku: 'MR42-HW',
    replacementSku: 'MR46-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR42-HW End-of-Sale. Reemplazo directo Wi-Fi 6: MR46-HW.',
    canKeepOriginal: false,
  },
  'MR52': {
    legacySku: 'MR52',
    replacementSku: 'MR56-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR52 End-of-Sale. Reemplazo directo Wi-Fi 6: MR56-HW (o CW9166I-MR Wi-Fi 6E).',
    canKeepOriginal: false,
  },
  'MR52-HW': {
    legacySku: 'MR52-HW',
    replacementSku: 'MR56-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR52-HW End-of-Sale. Reemplazo directo Wi-Fi 6: MR56-HW.',
    canKeepOriginal: false,
  },
  // Firewalls ASA -> Secure Firewall
  'ASA5506-K9': {
    legacySku: 'ASA5506-K9',
    replacementSku: 'FPR1010-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'ASA 5506-X End-of-Sale. Reemplazo: Cisco Secure Firewall 1010 (FPR1010-NGFW-K9).',
    canKeepOriginal: false,
  },
  'ASA5516-K9': {
    legacySku: 'ASA5516-K9',
    replacementSku: 'FPR1120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'ASA 5516-X End-of-Sale. Reemplazo: Cisco Secure Firewall 1120 (FPR1120-NGFW-K9).',
    canKeepOriginal: false,
  },
};

// Compatibilidad directa clave-valor requerida por código externo
export const EOL_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(EOL_CATALOG_2026).map(([k, v]) => [k, v.replacementSku])
);

// ============================================================================
// 2. BASE DE CONOCIMIENTO DINÁMICA AUTO-APRENDIZAJE (LOCALSTORAGE / INDEXEDDB)
// Permite almacenar infinitos SKUs descubiertos por IA o importados de CCW
// ============================================================================
const DYNAMIC_SKU_STORAGE_KEY = 'cisco_configuriator_dynamic_skus_v1';

export interface LearnedCiscoSkuRecord {
  sku: string;
  description: string;
  family: CiscoProductFamily;
  isEol: boolean;
  replacementSku?: string;
  eolNote?: string;
  officialUrl?: string;
  defaultSubSkus?: SubItemConfig[];
  updatedAt: string;
}

export function getLearnedCiscoSkus(): Record<string, LearnedCiscoSkuRecord> {
  try {
    const raw = localStorage.getItem(DYNAMIC_SKU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLearnedCiscoSku(record: LearnedCiscoSkuRecord): void {
  try {
    const current = getLearnedCiscoSkus();
    current[record.sku.trim().toUpperCase()] = {
      ...record,
      sku: record.sku.trim().toUpperCase(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DYNAMIC_SKU_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('[ConfigurIAtor] Error guardando SKU aprendido:', err);
  }
}

/**
 * Normaliza el plazo en años para SKUs DNA de Cisco (3Y, 5Y, 7Y)
 */
export function normalizeCiscoDnaTermYears(years?: number): {
  skuSuffixYear: number;
  months: number;
} {
  const y = Number(years) || 3;
  if (y <= 1) {
    // En Catalyst 9200/9300 el mínimo estándar de DNA inicial en CCW es 3Y (36m),
    // salvo renovaciones; mantenemos 3Y como SKU base o ajustamos meses según solicitud.
    return { skuSuffixYear: 3, months: 36 };
  }
  if (y >= 7) return { skuSuffixYear: 7, months: 84 };
  if (y >= 5) return { skuSuffixYear: 5, months: 60 };
  return { skuSuffixYear: 3, months: 36 };
}

// ============================================================================
// 3. MOTOR DINÁMICO DE ENSAMBLAJE SECUENCIAL CCW (CHASSIS_RULES + RESOLVER)
// Soporta cualquier variante de Catalyst 9200L, 9200, 9300, 9300L, 1200, 1300,
// Routers Catalyst 8200/8300, Meraki MR/MS/MX y Catalyst Wireless CW916x.
// ============================================================================

function buildCatalyst9200Rule(
  parentSku: string,
  ports: 24 | 48,
  poeType: 'T' | 'P' | 'FP',
  uplinkDesc: string,
  isModular9200 = false
): ChassisConfigRule {
  const psuSku =
    poeType === 'T'
      ? 'PWR-C5-125WAC'
      : poeType === 'FP' || ports === 48
        ? 'PWR-C5-1KWAC'
        : 'PWR-C5-600WAC';

  const psuDesc =
    psuSku === 'PWR-C5-125WAC'
      ? '125W AC Config 5 Power Supply'
      : psuSku === 'PWR-C5-1KWAC'
        ? '1000W AC Config 5 Power Supply'
        : '600W AC Config 5 Power Supply';

  const prefix = isModular9200 ? 'C9200' : 'C9200L';
  const stackKitSku = isModular9200 ? 'C9200-STACK-KIT' : 'C9200L-STACK-KIT';

  return {
    parentSku,
    family: 'catalyst9200',
    description: `Catalyst ${prefix} ${ports}-port ${poeType === 'T' ? 'Data' : poeType === 'FP' ? 'Full PoE+' : 'PoE+'}, ${uplinkDesc} Switch`,
    officialUrl: 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html',
    defaultSubItems: (opts) => {
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const tierLabel = opts.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);

      const items: SubItemConfig[] = [
        {
          partNumber: `${prefix}-DNA-${tierCode}-${ports}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `${prefix} Cisco DNA ${tierLabel} (${ports}-Port, ${skuSuffixYear} Year Term)`,
          category: 'dna_license',
        },
        {
          partNumber: psuSku,
          qtyMultiplier: opts.includeRedundantPsu ? 2 : 1,
          description: opts.includeRedundantPsu ? `${psuDesc} (Incluye Fuente Redundante)` : psuDesc,
          category: 'power_supply',
        },
        {
          partNumber: 'CAB-ACE',
          qtyMultiplier: opts.includeRedundantPsu ? 2 : 1,
          description: 'AC Power Cord (Europe/Chile), CEE 7/7, 1.5M',
          category: 'power_cord',
        },
        {
          partNumber: `${prefix}-NW-${tierCode}-${ports}`,
          qtyMultiplier: 1,
          description: `${prefix} Network ${tierLabel} (${ports}-Port)`,
          category: 'network_stack',
        },
      ];

      if (opts.includeStackingKit) {
        items.push({
          partNumber: stackKitSku,
          qtyMultiplier: 1,
          description: `${prefix} Stack Module & 50cm Stacking Cable Kit`,
          category: 'stacking_kit',
          isOptional: true,
        });
      }

      return items;
    },
  };
}

function buildCatalyst9300Rule(
  parentSku: string,
  ports: 24 | 48,
  poeType: 'T' | 'P' | 'PF' | 'U',
  is9300L = false
): ChassisConfigRule {
  const psuSku =
    poeType === 'T'
      ? 'PWR-C1-350WAC-P'
      : poeType === 'PF' || poeType === 'U' || ports === 48
        ? 'PWR-C1-1100WAC-P'
        : 'PWR-C1-715WAC-P';

  const prefix = is9300L ? 'C9300L' : 'C9300';

  return {
    parentSku,
    family: 'catalyst9300',
    description: `Catalyst ${prefix} ${ports}-port ${poeType === 'T' ? 'Data' : 'PoE+'} Enterprise Switch`,
    officialUrl: 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html',
    defaultSubItems: (opts) => {
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const tierLabel = opts.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);

      const subItems: SubItemConfig[] = [
        {
          partNumber: `${prefix}-DNA-${tierCode}-${ports}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `${prefix} Cisco DNA ${tierLabel} (${ports}-Port, ${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: psuSku,
          qtyMultiplier: opts.includeRedundantPsu ? 2 : 1,
          description: `Config 1 Platinum Power Supply (${psuSku})`,
          category: 'power_supply',
        },
        {
          partNumber: 'CAB-TA-EU',
          qtyMultiplier: opts.includeRedundantPsu ? 2 : 1,
          description: 'Europe/Chile AC Type A Power Cable',
          category: 'power_cord',
        },
        {
          partNumber: `${prefix}-NW-${tierCode}-${ports}`,
          qtyMultiplier: 1,
          description: `${prefix} Network ${tierLabel} (${ports}-Port)`,
          category: 'network_stack',
        },
      ];

      if (!is9300L) {
        subItems.push({
          partNumber: 'C9300-NM-8X',
          qtyMultiplier: 1,
          description: 'Catalyst 9300 8 x 10GE Network Module',
          category: 'uplink_module',
        });
        subItems.push({
          partNumber: 'STACK-T1-50CM',
          qtyMultiplier: 1,
          description: '50CM Type 1 Stacking Cable',
          category: 'stacking_kit',
        });
      } else if (opts.includeStackingKit) {
        subItems.push({
          partNumber: 'C9300L-STACK-KIT',
          qtyMultiplier: 1,
          description: 'Catalyst 9300L Stacking Kit',
          category: 'stacking_kit',
          isOptional: true,
        });
      }

      return subItems;
    },
  };
}

function buildCatalyst8000Rule(parentSku: string, description: string): ChassisConfigRule {
  return {
    parentSku,
    family: 'catalyst8000',
    description,
    officialUrl: 'https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8200-series-edge-platforms/nb-06-cat8200-series-edge-plat-ds-cte-en.html',
    defaultSubItems: (opts) => {
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const { months } = normalizeCiscoDnaTermYears(opts.termYears);
      return [
        {
          partNumber: `DNA-C-T0-${tierCode}-3Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco DNA Subscription for Routers Tier 0 (${opts.licenseTier || 'Essentials'})`,
          category: 'dna_license',
        },
        {
          partNumber: 'CAB-ACE',
          qtyMultiplier: 1,
          description: 'AC Power Cord (Europe/Chile), CEE 7/7, 1.5M',
          category: 'power_cord',
        },
      ];
    },
  };
}

export const CHASSIS_RULES: Record<string, ChassisConfigRule> = {
  // --- Catalyst 9200L 1G Uplinks ---
  'C9200L-24P-4G-E': buildCatalyst9200Rule('C9200L-24P-4G-E', 24, 'P', '4x1G uplink'),
  'C9200L-24P-4G-A': buildCatalyst9200Rule('C9200L-24P-4G-A', 24, 'P', '4x1G uplink'),
  'C9200L-24T-4G-E': buildCatalyst9200Rule('C9200L-24T-4G-E', 24, 'T', '4x1G uplink'),
  'C9200L-24T-4G-A': buildCatalyst9200Rule('C9200L-24T-4G-A', 24, 'T', '4x1G uplink'),
  'C9200L-48P-4G-E': buildCatalyst9200Rule('C9200L-48P-4G-E', 48, 'P', '4x1G uplink'),
  'C9200L-48P-4G-A': buildCatalyst9200Rule('C9200L-48P-4G-A', 48, 'P', '4x1G uplink'),
  'C9200L-48FP-4G-E': buildCatalyst9200Rule('C9200L-48FP-4G-E', 48, 'FP', '4x1G uplink'),
  'C9200L-48T-4G-E': buildCatalyst9200Rule('C9200L-48T-4G-E', 48, 'T', '4x1G uplink'),
  'C9200L-48T-4G-A': buildCatalyst9200Rule('C9200L-48T-4G-A', 48, 'T', '4x1G uplink'),

  // --- Catalyst 9200L 10G SFP+ Uplinks (4X) ---
  'C9200L-24P-4X-E': buildCatalyst9200Rule('C9200L-24P-4X-E', 24, 'P', '4x10G SFP+ uplink'),
  'C9200L-24P-4X-A': buildCatalyst9200Rule('C9200L-24P-4X-A', 24, 'P', '4x10G SFP+ uplink'),
  'C9200L-24T-4X-E': buildCatalyst9200Rule('C9200L-24T-4X-E', 24, 'T', '4x10G SFP+ uplink'),
  'C9200L-48P-4X-E': buildCatalyst9200Rule('C9200L-48P-4X-E', 48, 'P', '4x10G SFP+ uplink'),
  'C9200L-48P-4X-A': buildCatalyst9200Rule('C9200L-48P-4X-A', 48, 'P', '4x10G SFP+ uplink'),
  'C9200L-48FP-4X-E': buildCatalyst9200Rule('C9200L-48FP-4X-E', 48, 'FP', '4x10G SFP+ uplink'),
  'C9200L-48T-4X-E': buildCatalyst9200Rule('C9200L-48T-4X-E', 48, 'T', '4x10G SFP+ uplink'),

  // --- Catalyst 9200 Modular ---
  'C9200-24P-E': buildCatalyst9200Rule('C9200-24P-E', 24, 'P', 'Modular Uplink', true),
  'C9200-24P-A': buildCatalyst9200Rule('C9200-24P-A', 24, 'P', 'Modular Uplink', true),
  'C9200-48P-E': buildCatalyst9200Rule('C9200-48P-E', 48, 'P', 'Modular Uplink', true),
  'C9200-48P-A': buildCatalyst9200Rule('C9200-48P-A', 48, 'P', 'Modular Uplink', true),
  'C9200-24T-E': buildCatalyst9200Rule('C9200-24T-E', 24, 'T', 'Modular Uplink', true),
  'C9200-48T-E': buildCatalyst9200Rule('C9200-48T-E', 48, 'T', 'Modular Uplink', true),

  // --- Catalyst 9300 / 9300L ---
  'C9300-24P-E': buildCatalyst9300Rule('C9300-24P-E', 24, 'P', false),
  'C9300-24P-A': buildCatalyst9300Rule('C9300-24P-A', 24, 'P', false),
  'C9300-48P-E': buildCatalyst9300Rule('C9300-48P-E', 48, 'P', false),
  'C9300-48P-A': buildCatalyst9300Rule('C9300-48P-A', 48, 'P', false),
  'C9300-24T-E': buildCatalyst9300Rule('C9300-24T-E', 24, 'T', false),
  'C9300-48T-E': buildCatalyst9300Rule('C9300-48T-E', 48, 'T', false),
  'C9300L-24P-4X-E': buildCatalyst9300Rule('C9300L-24P-4X-E', 24, 'P', true),
  'C9300L-24P-4X-A': buildCatalyst9300Rule('C9300L-24P-4X-A', 24, 'P', true),
  'C9300L-48P-4X-E': buildCatalyst9300Rule('C9300L-48P-4X-E', 48, 'P', true),
  'C9300L-48PF-4X-E': buildCatalyst9300Rule('C9300L-48PF-4X-E', 48, 'PF', true),
  'C9300L-24T-4X-E': buildCatalyst9300Rule('C9300L-24T-4X-E', 24, 'T', true),
  'C9300L-48T-4X-E': buildCatalyst9300Rule('C9300L-48T-4X-E', 48, 'T', true),

  // --- Routers Catalyst 8200 / 8300 ---
  'C8200L-1N-4T': buildCatalyst8000Rule('C8200L-1N-4T', 'Cisco Catalyst 8200L Edge Platform (1 NIM, 4x1G WAN)'),
  'C8200-1N-4T': buildCatalyst8000Rule('C8200-1N-4T', 'Cisco Catalyst 8200 Edge Platform (1 NIM, 4x1G/SFP WAN)'),
  'C8300-1N1S-4T2X': buildCatalyst8000Rule('C8300-1N1S-4T2X', 'Cisco Catalyst 8300 Edge Platform (1 NIM, 1 SM, 2x10G + 4x1G)'),
  'C8300-1N1S-6T': buildCatalyst8000Rule('C8300-1N1S-6T', 'Cisco Catalyst 8300 Edge Platform (1 NIM, 1 SM, 6x1G)'),
};

/**
 * Resuelve dinámicamente una regla de ensamblaje para cualquier SKU Catalyst/Meraki/Router,
 * incluso si no está explícitamente listado en CHASSIS_RULES (ej. C9200L-24PXG-4X-E, C1200, C1300).
 */
export function resolveChassisRule(sku: string): ChassisConfigRule | null {
  const cleanSku = sku.trim().toUpperCase();
  if (CHASSIS_RULES[cleanSku]) {
    return CHASSIS_RULES[cleanSku];
  }

  // Detección dinámica por patrón de familia Catalyst 9200L / 9200
  const cat9200Match = cleanSku.match(/^(C9200L?)-(\d{2})(FP|P|T|PXG)-([0-9A-Z]+)?-?(E|A)?$/);
  if (cat9200Match) {
    const isModular = cat9200Match[1] === 'C9200';
    const ports = Number(cat9200Match[2]) === 48 ? 48 : 24;
    const poeRaw = cat9200Match[3];
    const poeType: 'T' | 'P' | 'FP' = poeRaw === 'T' ? 'T' : poeRaw === 'FP' ? 'FP' : 'P';
    return buildCatalyst9200Rule(cleanSku, ports, poeType, cat9200Match[4] || 'Uplink', isModular);
  }

  // Detección dinámica por patrón de familia Catalyst 9300 / 9300L
  const cat9300Match = cleanSku.match(/^(C9300L?)-(\d{2})(PF|P|T|U|UXM)/);
  if (cat9300Match) {
    const is9300L = cat9300Match[1] === 'C9300L';
    const ports = Number(cat9300Match[2]) === 48 ? 48 : 24;
    const poeRaw = cat9300Match[3];
    const poeType: 'T' | 'P' | 'PF' | 'U' = poeRaw === 'T' ? 'T' : poeRaw === 'PF' ? 'PF' : 'P';
    return buildCatalyst9300Rule(cleanSku, ports, poeType, is9300L);
  }

  // Detección dinámica Catalyst 1200 / 1300 (SMB Switches: llevan cable de poder pero NO requieren DNA)
  if (cleanSku.startsWith('C1200-') || cleanSku.startsWith('C1300-')) {
    return {
      parentSku: cleanSku,
      family: 'catalyst1200_1300',
      description: `Cisco ${cleanSku.startsWith('C1300-') ? 'Catalyst 1300' : 'Catalyst 1200'} Smart Managed Switch (${cleanSku})`,
      officialUrl: cleanSku.startsWith('C1300-')
        ? 'https://www.cisco.com/c/en/us/products/switches/catalyst-1300-series-switches/index.html'
        : 'https://www.cisco.com/c/en/us/products/switches/catalyst-1200-series-switches/index.html',
      defaultSubItems: () => [
        {
          partNumber: 'CAB-C13-CE',
          qtyMultiplier: 1,
          description: 'Power Cord Europe/Chile CEE 7/7 to C13 (Catalyst 1200/1300)',
          category: 'power_cord',
        },
      ],
    };
  }

  // Detección en base auto-aprendida
  const learned = getLearnedCiscoSkus()[cleanSku];
  if (learned && learned.defaultSubSkus && learned.defaultSubSkus.length > 0) {
    return {
      parentSku: cleanSku,
      family: learned.family,
      description: learned.description,
      officialUrl: learned.officialUrl,
      defaultSubItems: () => learned.defaultSubSkus || [],
    };
  }

  return null;
}

/**
 * Resuelve la licencia correspondiente para equipos Meraki (MR, CW, MS, MX)
 */
export function resolveMerakiSubLicense(
  targetSku: string,
  options: ChassisConfigOptions
): SubItemConfig | null {
  const clean = targetSku.trim().toUpperCase();
  const years = [1, 3, 5, 7].includes(Number(options.termYears)) ? Number(options.termYears) : 3;
  const months = years * 12;
  const isAdv = options.licenseTier === 'Advantage';
  const mode = options.merakiLicenseMode || 'subscription';

  // Access Points Meraki (MR36, MR46, MR56, CW9162I-MR, CW9164I-MR, CW9166I-MR)
  if (clean.startsWith('MR') || clean.endsWith('-MR')) {
    if (mode === 'coterm') {
      return {
        partNumber: isAdv ? `LIC-MR-ADV-${years}Y` : `LIC-ENT-${years}YR`,
        qtyMultiplier: 1,
        description: `Meraki MR ${isAdv ? 'Advanced' : 'Enterprise'} Co-Term License (${years}YR)`,
        category: 'dna_license',
      };
    }
    return {
      partNumber: isAdv ? 'LIC-MR-A' : 'LIC-MR-E',
      qtyMultiplier: 1,
      durationMonths: months,
      initialTerm: months,
      billingModel: 'Prepaid Term',
      description: `Meraki MR ${isAdv ? 'Advance' : 'Enterprise'} Subscription (${years}Y / ${months}M)`,
      category: 'dna_license',
    };
  }

  // Switches Meraki MS (ej. MS120-24P-HW, MS130-24P-HW, MS225-24P-HW)
  if (clean.startsWith('MS1') || clean.startsWith('MS2') || clean.startsWith('MS3') || clean.startsWith('MS4')) {
    const modelBase = clean.replace(/-HW$/i, '');
    return {
      partNumber: `LIC-${modelBase}-${years}YR`,
      qtyMultiplier: 1,
      description: `Meraki ${modelBase} Enterprise License and Support (${years}YR)`,
      category: 'dna_license',
    };
  }

  // Firewalls Meraki MX (ej. MX67-HW, MX68-HW, MX75-HW, MX85-HW, MX95-HW)
  if (clean.startsWith('MX')) {
    const modelBase = clean.replace(/-HW$/i, '');
    const secTier = isAdv ? 'SEC' : 'ENT';
    return {
      partNumber: `LIC-${modelBase}-${secTier}-${years}YR`,
      qtyMultiplier: 1,
      description: `Meraki ${modelBase} ${isAdv ? 'Advanced Security' : 'Enterprise'} License (${years}YR)`,
      category: 'dna_license',
    };
  }

  return null;
}

/**
 * Cruza un SKU contra la base de datos local Fast Track (IndexedDB)
 */
export async function checkSkuInFastTrackDb(sku: string): Promise<FastTrackProduct | null> {
  if (!sku) return null;
  const clean = sku.trim().toUpperCase();
  const direct = await getFastTrackItem(clean);
  if (direct) return direct;
  // Probar variante con o sin sufijo -E / -HW
  if (!clean.endsWith('-E')) {
    const withE = await getFastTrackItem(`${clean}-E`);
    if (withE) return withE;
  }
  if (!clean.endsWith('-HW')) {
    const withHw = await getFastTrackItem(`${clean}-HW`);
    if (withHw) return withHw;
  }
  return null;
}

/**
 * Busca SKUs en Fast Track DB por coincidencia de texto o familia
 */
export async function searchFastTrackCatalogByKeywords(keywords: string[]): Promise<FastTrackProduct[]> {
  const all = await getAllFastTrackItems(500);
  if (!all.length || !keywords.length) return [];
  const normKws = keywords.map((k) => k.toUpperCase().trim()).filter(Boolean);
  return all.filter((item) => {
    const haystack = `${item.partNumber} ${item.description || ''} ${item.category || ''}`.toUpperCase();
    return normKws.every((kw) => haystack.includes(kw));
  });
}
