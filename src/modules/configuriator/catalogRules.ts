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
  | 'industrial_ie'
  | 'ucs_server'
  | 'nexus_dc'
  | 'meraki_mr'
  | 'meraki_ms'
  | 'meraki_ms130'
  | 'meraki_ms225'
  | 'meraki_mx'
  | 'catalyst_wireless'
  | 'firewall_fpr'
  | 'collaboration'
  | 'accessory'
  | 'generic';

/**
 * Norma de cable de poder para Chile (Intcomex Chile):
 * - 'italy_chile' (POR DEFECTO): Enchufe 3 patas en línea CEI 23-50 / Tipo L (CAB-ACA / CAB-TA-IT / CAB-C13-IT / MA-PWR-CORD-IT)
 * - 'rack_pdu': Cable puente para PDU en gabinete rack (CAB-C13-C14-2M / CAB-C15-CBN)
 * - 'schuko_eu': Enchufe Schuko Europeo CEE 7/7 (CAB-ACE / CAB-TA-EU)
 */
export type PowerCordStandard = 'italy_chile' | 'rack_pdu' | 'schuko_eu';

export type EolLifecycleStatus = 'eos_eol_active' | 'active_with_newer_gen' | 'current_2026';

export interface EolAlternative {
  recommendedSku: string;
  title: string;
  description: string;
  type: 'direct_equivalent' | 'cost_effective' | 'catalyst_alternative';
}

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
  category?:
    | 'dna_license'
    | 'power_supply'
    | 'power_cord'
    | 'network_stack'
    | 'stacking_kit'
    | 'uplink_module'
    | 'transceiver'
    | 'support'
    | 'server_component';
}

export interface ChassisConfigOptions {
  selectedModel?: string;
  licenseTier?: 'Essentials' | 'Advantage';
  termYears?: number; // 1, 3, 5, 7
  isPoe?: boolean;
  includeStackingKit?: boolean;
  includeRedundantPsu?: boolean;
  includeSmartNet?: boolean;
  smartNetLevel?: '8x5xNBD' | '24x7x4';
  powerCordStandard?: PowerCordStandard; // Default: 'italy_chile' (CAB-IT)
  merakiLicenseMode?: 'coterm' | 'subscription';
}

export interface ChassisConfigRule {
  parentSku: string;
  family: CiscoProductFamily;
  description: string;
  officialUrl?: string;
  estimatedListUsd?: number; // Precio Lista referencial en USD para pre-cotización instantánea
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
    replacementSku: 'C9200L-48FP-4G-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P Full PoE+ (740W) 4x1G.',
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
    replacementSku: 'C9200L-48FP-4X-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P Full PoE+ (740W) 4x10G SFP+.',
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
  // --- Switches Meraki MS120 / MS210 / MS220 (End-of-Sale -> MS225 / MS130-SWITCHES / Catalyst 9200L) ---
  'MS210-48FP': {
    legacySku: 'MS210-48FP',
    replacementSku: 'MS225-48FP-HW',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48FP (740W PoE+) End-of-Sale. Reemplazo equivalente 740W: MS225-48FP-HW | Opción Cloud 370W: MS130-48P (bajo MS130-SWITCHES) | Alternativa Catalyst: C9200L-48FP-4G-E.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
  },
  'MS210-48FP-HW': {
    legacySku: 'MS210-48FP-HW',
    replacementSku: 'MS225-48FP-HW',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48FP-HW (740W PoE+) End-of-Sale. Reemplazo equivalente 740W: MS225-48FP-HW | Opción Cloud 370W: MS130-48P (bajo MS130-SWITCHES) | Alternativa Catalyst: C9200L-48FP-4G-E.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
  },
  'MS210-48LP': {
    legacySku: 'MS210-48LP',
    replacementSku: 'MS130-SWITCHES:MS130-48P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48LP (370W PoE+) End-of-Sale. Reemplazo Cloud: MS130-48P (Madre MS130-SWITCHES) o MS225-48LP-HW con Stacking físico.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
  },
  'MS210-48LP-HW': {
    legacySku: 'MS210-48LP-HW',
    replacementSku: 'MS130-SWITCHES:MS130-48P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48LP-HW (370W PoE+) End-of-Sale. Reemplazo Cloud: MS130-48P (Madre MS130-SWITCHES) o MS225-48LP-HW.',
    canKeepOriginal: false,
  },
  'MS210-48': {
    legacySku: 'MS210-48',
    replacementSku: 'MS130-SWITCHES:MS130-48',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48 End-of-Sale. Reemplazo Cloud: MS130-48 (Madre MS130-SWITCHES) o MS225-48-HW.',
    canKeepOriginal: false,
  },
  'MS210-48-HW': {
    legacySku: 'MS210-48-HW',
    replacementSku: 'MS130-SWITCHES:MS130-48',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-48-HW End-of-Sale. Reemplazo Cloud: MS130-48 (Madre MS130-SWITCHES) o MS225-48-HW.',
    canKeepOriginal: false,
  },
  'MS210-24P': {
    legacySku: 'MS210-24P',
    replacementSku: 'MS130-SWITCHES:MS130-24P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-24P End-of-Sale. Reemplazo Cloud: MS130-24P (Madre MS130-SWITCHES) o MS225-24P-HW con Stacking físico.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
  },
  'MS210-24P-HW': {
    legacySku: 'MS210-24P-HW',
    replacementSku: 'MS130-SWITCHES:MS130-24P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-24P-HW End-of-Sale. Reemplazo Cloud: MS130-24P (Madre MS130-SWITCHES) o MS225-24P-HW.',
    canKeepOriginal: false,
  },
  'MS210-24': {
    legacySku: 'MS210-24',
    replacementSku: 'MS130-SWITCHES:MS130-24',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-24 End-of-Sale. Reemplazo Cloud: MS130-24 (Madre MS130-SWITCHES) o MS225-24-HW.',
    canKeepOriginal: false,
  },
  'MS210-24-HW': {
    legacySku: 'MS210-24-HW',
    replacementSku: 'MS130-SWITCHES:MS130-24',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS210-24-HW End-of-Sale. Reemplazo Cloud: MS130-24 (Madre MS130-SWITCHES) o MS225-24-HW.',
    canKeepOriginal: false,
  },
  'MS120-48FP': {
    legacySku: 'MS120-48FP',
    replacementSku: 'MS225-48FP-HW',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48FP (740W PoE+) End-of-Sale. En MS130 el tope es 370W (MS130-48P); para 740W Full PoE usar MS225-48FP-HW o C9200L-48FP-4G-E.',
    canKeepOriginal: false,
  },
  'MS120-48FP-HW': {
    legacySku: 'MS120-48FP-HW',
    replacementSku: 'MS225-48FP-HW',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48FP-HW (740W PoE+) End-of-Sale. Para 740W usar MS225-48FP-HW o C9200L-48FP-4G-E; para 370W usar MS130-48P.',
    canKeepOriginal: false,
  },
  'MS120-48LP': {
    legacySku: 'MS120-48LP',
    replacementSku: 'MS130-SWITCHES:MS130-48P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48LP End-of-Sale. Reemplazo directo: MS130-48P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-48LP-HW': {
    legacySku: 'MS120-48LP-HW',
    replacementSku: 'MS130-SWITCHES:MS130-48P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48LP-HW End-of-Sale. Reemplazo directo: MS130-48P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-48': {
    legacySku: 'MS120-48',
    replacementSku: 'MS130-SWITCHES:MS130-48',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48 End-of-Sale. Reemplazo directo: MS130-48 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-48-HW': {
    legacySku: 'MS120-48-HW',
    replacementSku: 'MS130-SWITCHES:MS130-48',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48-HW End-of-Sale. Reemplazo directo: MS130-48 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-24P': {
    legacySku: 'MS120-24P',
    replacementSku: 'MS130-SWITCHES:MS130-24P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-24P End-of-Sale. Reemplazo directo: MS130-24P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-24P-HW': {
    legacySku: 'MS120-24P-HW',
    replacementSku: 'MS130-SWITCHES:MS130-24P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-24P-HW End-of-Sale. Reemplazo directo: MS130-24P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-24': {
    legacySku: 'MS120-24',
    replacementSku: 'MS130-SWITCHES:MS130-24',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-24 End-of-Sale. Reemplazo directo: MS130-24 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-24-HW': {
    legacySku: 'MS120-24-HW',
    replacementSku: 'MS130-SWITCHES:MS130-24',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-24-HW End-of-Sale. Reemplazo directo: MS130-24 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8FP': {
    legacySku: 'MS120-8FP',
    replacementSku: 'MS130-SWITCHES:MS130-8X',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8FP (124W PoE+) End-of-Sale. Reemplazo 120W PoE+: MS130-8X o MS130-8P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8FP-HW': {
    legacySku: 'MS120-8FP-HW',
    replacementSku: 'MS130-SWITCHES:MS130-8X',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8FP-HW End-of-Sale. Reemplazo 120W PoE+: MS130-8X o MS130-8P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8LP': {
    legacySku: 'MS120-8LP',
    replacementSku: 'MS130-SWITCHES:MS130-8P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8LP (67W PoE) End-of-Sale. Reemplazo directo: MS130-8P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8LP-HW': {
    legacySku: 'MS120-8LP-HW',
    replacementSku: 'MS130-SWITCHES:MS130-8P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8LP-HW End-of-Sale. Reemplazo directo: MS130-8P (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8': {
    legacySku: 'MS120-8',
    replacementSku: 'MS130-SWITCHES:MS130-8',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8 End-of-Sale. Reemplazo directo: MS130-8 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-8-HW': {
    legacySku: 'MS120-8-HW',
    replacementSku: 'MS130-SWITCHES:MS130-8',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-8-HW End-of-Sale. Reemplazo directo: MS130-8 (Madre MS130-SWITCHES).',
    canKeepOriginal: false,
  },

  // --- Firewalls Meraki MX64 / MX65 / MX84 / ASA -> MX67 / MX68 / MX85 / Secure Firewall ---
  'MX64': {
    legacySku: 'MX64',
    replacementSku: 'MX67-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX64 End-of-Sale. Reemplazo directo: MX67-HW.',
    canKeepOriginal: false,
  },
  'MX64-HW': {
    legacySku: 'MX64-HW',
    replacementSku: 'MX67-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX64-HW End-of-Sale. Reemplazo directo: MX67-HW.',
    canKeepOriginal: false,
  },
  'MX65': {
    legacySku: 'MX65',
    replacementSku: 'MX68-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX65 (con puertos PoE+) End-of-Sale. Reemplazo directo: MX68-HW.',
    canKeepOriginal: false,
  },
  'MX65-HW': {
    legacySku: 'MX65-HW',
    replacementSku: 'MX68-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX65-HW End-of-Sale. Reemplazo directo: MX68-HW.',
    canKeepOriginal: false,
  },
  'MX84': {
    legacySku: 'MX84',
    replacementSku: 'MX85-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX84 End-of-Sale. Reemplazo directo: MX85-HW.',
    canKeepOriginal: false,
  },
  'MX84-HW': {
    legacySku: 'MX84-HW',
    replacementSku: 'MX85-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX84-HW End-of-Sale. Reemplazo directo: MX85-HW.',
    canKeepOriginal: false,
  },
  'ASA5506-K9': {
    legacySku: 'ASA5506-K9',
    replacementSku: 'FPR1010-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'ASA 5506-X End-of-Sale. Reemplazo vigente: Cisco Secure Firewall 1010 (FPR1010-NGFW-K9) o FPR1210T-K9.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/security/firewalls/index.html',
  },
  'ASA5508-K9': {
    legacySku: 'ASA5508-K9',
    replacementSku: 'FPR1120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'ASA 5508-X End-of-Sale. Reemplazo vigente: Cisco Secure Firewall 1120 (FPR1120-NGFW-K9) o FPR1220T-K9.',
    canKeepOriginal: false,
  },
  'ASA5516-K9': {
    legacySku: 'ASA5516-K9',
    replacementSku: 'FPR1120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'ASA 5516-X End-of-Sale. Reemplazo vigente: Cisco Secure Firewall 1120 (FPR1120-NGFW-K9) o FPR1220T-K9.',
    canKeepOriginal: false,
  },
  'FPR2110-NGFW-K9': {
    legacySku: 'FPR2110-NGFW-K9',
    replacementSku: 'FPR3110-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Firepower 2110 End-of-Sale. Reemplazo oficial vigente 2026: Cisco Secure Firewall 3110 (FPR3110-NGFW-K9).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/security/firewalls/secure-firewall-3100-series/index.html',
  },
  'FPR2120-NGFW-K9': {
    legacySku: 'FPR2120-NGFW-K9',
    replacementSku: 'FPR3120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Firepower 2120 End-of-Sale. Reemplazo oficial vigente 2026: Cisco Secure Firewall 3120 (FPR3120-NGFW-K9).',
    canKeepOriginal: false,
  },

  // --- Switches Industriales Cisco IE-2000 / IE-3000 / IE-4000 -> Catalyst IE3100 / IE3300 / IE3400 ---
  'IE-2000-8TC-B': {
    legacySku: 'IE-2000-8TC-B',
    replacementSku: 'IE-3100-8T2C-E',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco IE-2000 End-of-Sale. Reemplazo industrial vigente 2026: Catalyst IE3100 Rugged (IE-3100-8T2C-E) o IE-3300-8T2S-E.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3100-rugged-series/index.html',
  },
  'IE-2000-8TC-G-B': {
    legacySku: 'IE-2000-8TC-G-B',
    replacementSku: 'IE-3100-8T2C-E',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco IE-2000 End-of-Sale. Reemplazo industrial vigente 2026: Catalyst IE3100 Rugged (IE-3100-8T2C-E) o IE-3300-8T2S-E.',
    canKeepOriginal: false,
  },
  'IE-2000-16TC-G-E': {
    legacySku: 'IE-2000-16TC-G-E',
    replacementSku: 'IE-3300-8T2S-E',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco IE-2000 16P End-of-Sale. Reemplazo modular industrial: Catalyst IE3300 Rugged (IE-3300-8T2S-E).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3300-rugged-series/index.html',
  },
  'IE-3000-8TC': {
    legacySku: 'IE-3000-8TC',
    replacementSku: 'IE-3300-8T2S-E',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco IE-3000 End-of-Sale. Reemplazo oficial: Catalyst IE3300 Rugged (IE-3300-8T2S-E).',
    canKeepOriginal: false,
  },
  'IE-4000-8GT4G-E': {
    legacySku: 'IE-4000-8GT4G-E',
    replacementSku: 'IE-3400-8T2S-E',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco IE-4000 End-of-Sale. Reemplazo oficial vigente 2026: Catalyst IE3400 Heavy Duty (IE-3400-8T2S-E).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3400-rugged-series/index.html',
  },
  'IE-4000-8GS4G-E': {
    legacySku: 'IE-4000-8GS4G-E',
    replacementSku: 'IE-3400-8P2S-E',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco IE-4000 PoE End-of-Sale. Reemplazo oficial vigente 2026: Catalyst IE3400 PoE+ (IE-3400-8P2S-E).',
    canKeepOriginal: false,
  },

  // --- Servidores Cisco UCS M5 / M6 -> UCS M7 Vigentes 2026 & Switches Nexus ---
  'UCSC-C220-M5SX': {
    legacySku: 'UCSC-C220-M5SX',
    replacementSku: 'UCSC-C220-M7S',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Servidor UCS C220 M5 End-of-Sale. Reemplazo vigente 2026: Cisco UCS C220 M7 SFF (UCSC-C220-M7S).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/servers-unified-computing/ucs-c220-m7-rack-server/index.html',
  },
  'UCSC-C240-M5SX': {
    legacySku: 'UCSC-C240-M5SX',
    replacementSku: 'UCSC-C240-M7S',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Servidor UCS C240 M5 End-of-Sale. Reemplazo vigente 2026: Cisco UCS C240 M7 SFF (UCSC-C240-M7S).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/servers-unified-computing/ucs-c240-m7-rack-server/index.html',
  },
  'UCSC-C220-M6S': {
    legacySku: 'UCSC-C220-M6S',
    replacementSku: 'UCSC-C220-M7S',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'UCS C220 M6 en transición a generación DDR5 PCIe 5.0. Reemplazo recomendado 2026: Cisco UCS C220 M7 (UCSC-C220-M7S).',
    canKeepOriginal: true,
  },
  'UCSC-C240-M6S': {
    legacySku: 'UCSC-C240-M6S',
    replacementSku: 'UCSC-C240-M7S',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'UCS C240 M6 en transición a generación M7. Reemplazo recomendado 2026: Cisco UCS C240 M7 (UCSC-C240-M7S).',
    canKeepOriginal: true,
  },
  'N9K-C93180YC-EX': {
    legacySku: 'N9K-C93180YC-EX',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Nexus 93180YC-EX End-of-Sale. Reemplazo Data Center vigente 2026: Nexus N9K-C93180YC-FX3.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/nexus-9000-series-switches/index.html',
  },
  'N9K-C93180YC-FX': {
    legacySku: 'N9K-C93180YC-FX',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Nexus 93180YC-FX End-of-Sale. Reemplazo Data Center vigente 2026: Nexus N9K-C93180YC-FX3.',
    canKeepOriginal: false,
  },
  'N9K-C93108TC-EX': {
    legacySku: 'N9K-C93108TC-EX',
    replacementSku: 'N9K-C93108TC-FX3P',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Nexus 93108TC-EX End-of-Sale. Reemplazo 10GBASE-T vigente 2026: Nexus N9K-C93108TC-FX3P.',
    canKeepOriginal: false,
  },

  // --- Colaboración: Teléfonos IP 7800/8800 & Video Webex Room Kit -> Serie DP-9800 & Room Bar ---
  'CP-7821-K9=': {
    legacySku: 'CP-7821-K9=',
    replacementSku: 'DP-9841-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Teléfono IP 7821 en End-of-Sale. Reemplazo oficial vigente 2026: Cisco Desk Phone 9841 (DP-9841-K9).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/desk-phone-9800-series/index.html',
  },
  'CP-7841-K9=': {
    legacySku: 'CP-7841-K9=',
    replacementSku: 'DP-9851-K9',
    status: 'eos_eol_active',
    eosYear: 2025,
    eolNote: 'Teléfono IP 7841 en transición EOL. Reemplazo oficial vigente 2026: Cisco Desk Phone 9851 (DP-9851-K9).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/desk-phone-9800-series/index.html',
  },
  'CP-8841-K9=': {
    legacySku: 'CP-8841-K9=',
    replacementSku: 'DP-9861-K9',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Teléfono IP 8841 reemplazado por la nueva serie Cisco Desk Phone 9861 (DP-9861-K9).',
    canKeepOriginal: true,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/desk-phone-9800-series/index.html',
  },
  'CP-8865-K9=': {
    legacySku: 'CP-8865-K9=',
    replacementSku: 'DP-9871-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Teléfono IP 8865 End-of-Sale. Reemplazo oficial con cámara y Wi-Fi: Cisco Desk Phone 9871 (DP-9871-K9).',
    canKeepOriginal: false,
  },
  'CS-KIT-K9': {
    legacySku: 'CS-KIT-K9',
    replacementSku: 'CS-BAR-T-C-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Webex Room Kit End-of-Sale. Reemplazo oficial vigente 2026: Cisco Room Bar (CS-BAR-T-C-K9).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/webex-room-series/index.html',
  },
  'CS-KITMINI-K9': {
    legacySku: 'CS-KITMINI-K9',
    replacementSku: 'CS-BAR-T-C-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Webex Room Kit Mini End-of-Sale. Reemplazo oficial vigente 2026: Cisco Room Bar (CS-BAR-T-C-K9).',
    canKeepOriginal: false,
  },
  'CS-KITPLUS-K9': {
    legacySku: 'CS-KITPLUS-K9',
    replacementSku: 'CS-BARPRO-C-K9',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Webex Room Kit Plus End-of-Sale. Reemplazo oficial vigente 2026: Cisco Room Bar Pro (CS-BARPRO-C-K9).',
    canKeepOriginal: false,
  },

  // --- Transceivers / SFP Obsoletos -> Vigentes 2026 ---
  'GLC-SX-MM': {
    legacySku: 'GLC-SX-MM',
    replacementSku: 'GLC-SX-MMD',
    status: 'eos_eol_active',
    eosYear: 2018,
    eolNote: 'Transceiver GLC-SX-MM End-of-Sale. Reemplazo oficial con DOM vigente: GLC-SX-MMD.',
    canKeepOriginal: false,
  },
  'GLC-LH-SM': {
    legacySku: 'GLC-LH-SM',
    replacementSku: 'GLC-LH-SMD',
    status: 'eos_eol_active',
    eosYear: 2018,
    eolNote: 'Transceiver GLC-LH-SM End-of-Sale. Reemplazo oficial con DOM vigente: GLC-LH-SMD.',
    canKeepOriginal: false,
  },
  'GLC-T': {
    legacySku: 'GLC-T',
    replacementSku: 'GLC-TE',
    status: 'eos_eol_active',
    eosYear: 2019,
    eolNote: 'Transceiver GLC-T End-of-Sale. Reemplazo oficial temperatura extendida vigente: GLC-TE.',
    canKeepOriginal: false,
  },
  'SFP-10G-SR': {
    legacySku: 'SFP-10G-SR',
    replacementSku: 'SFP-10G-SR-S',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Se recomienda versión S-Class costo-efectiva vigente en CCW: SFP-10G-SR-S.',
    canKeepOriginal: true,
  },
  'SFP-10G-LR': {
    legacySku: 'SFP-10G-LR',
    replacementSku: 'SFP-10G-LR-S',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Se recomienda versión S-Class costo-efectiva vigente en CCW: SFP-10G-LR-S.',
    canKeepOriginal: true,
  },
};

// Compatibilidad directa clave-valor requerida por código externo
export const EOL_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(EOL_CATALOG_2026).map(([k, v]) => [k, v.replacementSku])
);

// ============================================================================
// 1.1 MATRIZ CANÓNICA DE ALTERNATIVAS EOL SELECCIONABLES EN UI (CCW VALIDATED)
// ============================================================================
const ALT_MS_48FP: EolAlternative[] = [
  {
    recommendedSku: 'MS225-48FP-HW',
    title: 'Meraki MS225-48FP (Reemplazo Directo 740W + Stack)',
    description: 'Switch L2 Cloud Managed, 48x GigE Full PoE+ (740W budget) con Stacking físico y 4x 10G SFP+.',
    type: 'direct_equivalent',
  },
  {
    recommendedSku: 'MS130-SWITCHES:MS130-48P',
    title: 'Meraki MS130-48P (Opción Acceso Cloud 370W)',
    description: 'Contenedor Madre MS130-SWITCHES + Hijo MS130-48P (370W PoE+ budget), 4x 10G SFP+. Sin stacking físico.',
    type: 'cost_effective',
  },
  {
    recommendedSku: 'C9200L-48FP-4G-E',
    title: 'Cisco Catalyst 9200L-48FP (Enterprise Full PoE 740W)',
    description: '48 puertos Full PoE+ (740W con fuente 1KW), 4x1G uplinks con Cisco DNA Essentials.',
    type: 'catalyst_alternative',
  },
];

const ALT_MS_48LP: EolAlternative[] = [
  {
    recommendedSku: 'MS130-SWITCHES:MS130-48P',
    title: 'Meraki MS130-48P (Reemplazo Directo Cloud 370W)',
    description: 'Contenedor Madre MS130-SWITCHES + Hijo MS130-48P, 48x GigE PoE+ (370W), 4x 10G SFP+.',
    type: 'direct_equivalent',
  },
  {
    recommendedSku: 'MS225-48LP-HW',
    title: 'Meraki MS225-48LP (Con Stacking Físico 370W)',
    description: 'Switch L2 Cloud Managed 48x GigE PoE+ (370W) con Stacking físico dedicado.',
    type: 'direct_equivalent',
  },
  {
    recommendedSku: 'C9200L-48P-4G-E',
    title: 'Cisco Catalyst 9200L-48P (Enterprise PoE+ 370W)',
    description: '48 puertos PoE+ (370W), 4x1G uplinks con Cisco DNA Essentials.',
    type: 'catalyst_alternative',
  },
];

const ALT_MS_24P: EolAlternative[] = [
  {
    recommendedSku: 'MS130-SWITCHES:MS130-24P',
    title: 'Meraki MS130-24P (Reemplazo Cloud 370W)',
    description: 'Contenedor Madre MS130-SWITCHES + Hijo MS130-24P, 24x GigE PoE+ (370W), 4x 10G SFP+.',
    type: 'direct_equivalent',
  },
  {
    recommendedSku: 'MS225-24P-HW',
    title: 'Meraki MS225-24P (Con Stacking Físico 370W)',
    description: 'Switch L2 Cloud Managed 24x GigE PoE+ (370W) con Stacking físico dedicado.',
    type: 'direct_equivalent',
  },
  {
    recommendedSku: 'C9200L-24P-4G-E',
    title: 'Cisco Catalyst 9200L-24P (Enterprise PoE+ 370W)',
    description: '24 puertos PoE+ (370W), 4x1G uplinks con Cisco DNA Essentials.',
    type: 'catalyst_alternative',
  },
];

export const EOL_CANONICAL_MAPPING: Record<string, EolAlternative[]> = {
  'MS210-48FP': ALT_MS_48FP,
  'MS210-48FP-HW': ALT_MS_48FP,
  'MS120-48FP': ALT_MS_48FP,
  'MS120-48FP-HW': ALT_MS_48FP,
  'MS220-48FP': ALT_MS_48FP,
  'MS220-48FP-HW': ALT_MS_48FP,

  'MS210-48LP': ALT_MS_48LP,
  'MS210-48LP-HW': ALT_MS_48LP,
  'MS120-48LP': ALT_MS_48LP,
  'MS120-48LP-HW': ALT_MS_48LP,

  'MS210-24P': ALT_MS_24P,
  'MS210-24P-HW': ALT_MS_24P,
  'MS120-24P': ALT_MS_24P,
  'MS120-24P-HW': ALT_MS_24P,
  'MS220-24P': ALT_MS_24P,
  'MS220-24P-HW': ALT_MS_24P,

  'WS-C2960X-24PS-L': [
    {
      recommendedSku: 'C9200L-24P-4G-E',
      title: 'Catalyst 9200L 24P PoE+ (370W • 4x1G)',
      description: '24 puertos PoE+, 4x1G uplinks con Network & DNA Essentials.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'C9200L-24P-4X-E',
      title: 'Catalyst 9200L 24P PoE+ (370W • 4x10G SFP+)',
      description: '24 puertos PoE+, 4x10G SFP+ uplinks con Network & DNA Essentials.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'MS130-SWITCHES:MS130-24P',
      title: 'Meraki MS130-24P (Alternativa Cloud 370W)',
      description: '24 puertos PoE+ (370W), 4x10G SFP+ uplinks administrado en nube Meraki.',
      type: 'cost_effective',
    },
  ],
  'WS-C2960X-48FPS-L': [
    {
      recommendedSku: 'C9200L-48FP-4G-E',
      title: 'Catalyst 9200L 48P Full PoE+ (740W • 4x1G)',
      description: '48 puertos Full PoE+ (740W con fuente 1KW), 4x1G uplinks con Network & DNA Essentials.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'C9200L-48P-4G-E',
      title: 'Catalyst 9200L 48P Standard PoE+ (370W • 4x1G)',
      description: '48 puertos PoE+ (370W), 4x1G uplinks costo-efectivo.',
      type: 'cost_effective',
    },
    {
      recommendedSku: 'MS225-48FP-HW',
      title: 'Meraki MS225-48FP (Alternativa Cloud 740W)',
      description: '48 puertos Full PoE+ (740W) con Stacking físico y gestión Meraki Cloud.',
      type: 'catalyst_alternative',
    },
  ],
  'IE-2000-8TC-B': [
    {
      recommendedSku: 'IE-3100-8T2C-E',
      title: 'Catalyst IE3100 Rugged (8x GE + 2x Combo)',
      description: 'Switch Industrial DIN-Rail compacto de última generación con Network Essentials.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'IE-3300-8T2S-E',
      title: 'Catalyst IE3300 Rugged Modular (8x GE + 2x SFP)',
      description: 'Switch Industrial DIN-Rail modular expandible con Cisco DNA Essentials.',
      type: 'catalyst_alternative',
    },
    {
      recommendedSku: 'IE-3300-8P2S-E',
      title: 'Catalyst IE3300 Rugged PoE+ (8x PoE+ + 2x SFP)',
      description: 'Switch Industrial con PoE+ para cámaras/APs en planta industrial.',
      type: 'cost_effective',
    },
  ],
  'UCSC-C220-M5SX': [
    {
      recommendedSku: 'UCSC-C220-M7S',
      title: 'Cisco UCS C220 M7 SFF 1U Rack Server (Vigente)',
      description: 'Servidor 1U Intel Xeon Scalable 4ta/5ta Gen, DDR5, PCIe 5.0 con Intersight.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'UCSC-C240-M7S',
      title: 'Cisco UCS C240 M7 SFF 2U Rack Server (Alta Capacidad)',
      description: 'Servidor 2U de alta densidad de discos y expansión GPU/PCIe.',
      type: 'catalyst_alternative',
    },
  ],
  'ASA5506-K9': [
    {
      recommendedSku: 'FPR1010-NGFW-K9',
      title: 'Cisco Secure Firewall 1010 (Desktop NGFW)',
      description: 'Firewall NGFW compacto silencioso con puertos PoE integrados y suscripción TMC.',
      type: 'direct_equivalent',
    },
    {
      recommendedSku: 'FPR1210T-K9',
      title: 'Cisco Secure Firewall 1210CE (Nueva Serie 1200)',
      description: 'Nuevo Firewall de alto rendimiento SD-WAN / NGFW serie 1200.',
      type: 'catalyst_alternative',
    },
    {
      recommendedSku: 'MX67-HW',
      title: 'Meraki MX67 Cloud Security & SD-WAN',
      description: 'Firewall/SD-WAN 100% administrado en la nube Meraki.',
      type: 'cost_effective',
    },
  ],
};

/**
 * Devuelve las alternativas validadas en CCW para un SKU en EOL (si existen)
 */
export function getEolAlternatives(rawSku?: string): EolAlternative[] {
  if (!rawSku) return [];
  const clean = rawSku.trim().toUpperCase();
  if (EOL_CANONICAL_MAPPING[clean]) {
    return EOL_CANONICAL_MAPPING[clean];
  }
  const withoutHw = clean.replace(/-HW$/i, '');
  if (EOL_CANONICAL_MAPPING[withoutHw]) {
    return EOL_CANONICAL_MAPPING[withoutHw];
  }
  return [];
}

/**
 * Sanitizador determinista anti-alucinación para cualquier SKU Cisco/Meraki antes de ir a CCW:
 * - Elimina sufijo ilegal "-HW" en la familia MS130 y CW916x.
 * - Corrige SKUs inexistentes alucinados (ej. "MS130-48FP-HW" o "MS130-48FP" -> no existe 48FP en MS130).
 * - Envuelve cualquier modelo suelto MS130-xx dentro de su contenedor Madre obligatorio "MS130-SWITCHES:MS130-xx".
 * - Reemplaza transceivers obsoletos (GLC-SX-MM -> GLC-SX-MMD, GLC-LH-SM -> GLC-LH-SMD, GLC-T -> GLC-TE).
 */
export function sanitizeAndValidateCcwSku(rawSku: string): {
  sanitizedSku: string;
  inferredLegacyEolSku?: string;
  correctionReason?: string;
} {
  const clean = (rawSku || '').trim().toUpperCase();
  if (!clean) return { sanitizedSku: '' };

  // Si ya viene en formato contenedor MS130-SWITCHES:MODELO, limpiar el modelo hijo
  if (clean.startsWith('MS130-SWITCHES:')) {
    const childRaw = clean.split(':')[1]?.trim().replace(/-HW$/i, '') || 'MS130-24P';
    const validChild = childRaw.replace(/48FP|48LP/i, '48P').replace(/24FP|24LP/i, '24P').replace(/8FP|8LP/i, '8P');
    return { sanitizedSku: `MS130-SWITCHES:${validChild}` };
  }

  // Caso crítico: IA o usuario escribió "MS130-48FP" o "MS130-48FP-HW" (No existe 48FP en MS130)
  if (/^MS130-48FP(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS225-48FP-HW',
      inferredLegacyEolSku: 'MS210-48FP',
      correctionReason:
        'En CCW no existe el modelo MS130-48FP ni lleva sufijo -HW. Se asignó MS225-48FP-HW (740W Full PoE) y se habilitaron las alternativas MS130-48P (370W) y C9200L-48FP-4G-E.',
    };
  }

  // Caso: IA o usuario escribió "MS130-48LP(-HW)" o "MS130-24LP(-HW)" o "MS130-24FP(-HW)"
  if (/^MS130-48LP(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-48P',
      inferredLegacyEolSku: 'MS210-48LP',
      correctionReason: 'En la serie MS130 el modelo PoE+ de 48 puertas es MS130-48P (bajo contenedor Madre MS130-SWITCHES, sin -HW).',
    };
  }
  if (/^MS130-24(?:FP|LP)(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-24P',
      inferredLegacyEolSku: 'MS210-24P',
      correctionReason: 'En la serie MS130 el modelo PoE+ de 24 puertas es MS130-24P (bajo contenedor Madre MS130-SWITCHES, sin -HW).',
    };
  }
  if (/^MS130-8(?:FP|LP)(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-8P',
      inferredLegacyEolSku: 'MS120-8LP',
      correctionReason: 'En la serie MS130 el modelo compacto PoE+ es MS130-8P / MS130-8X (bajo contenedor Madre MS130-SWITCHES, sin -HW).',
    };
  }

  // Cualquier modelo válido de la familia MS130 escrito directamente (con o sin -HW):
  const ms130Match = clean.match(/^(MS130R?-(?:8|8P|8X|12X|24|24P|24X|48|48P|48X))(?:-HW)?$/i);
  if (ms130Match) {
    const baseMs130 = ms130Match[1].toUpperCase();
    return {
      sanitizedSku: `MS130-SWITCHES:${baseMs130}`,
      correctionReason: clean.endsWith('-HW')
        ? `La serie Meraki MS130 no lleva sufijo -HW en CCW y requiere el contenedor Madre MS130-SWITCHES -> Hijo ${baseMs130}.`
        : undefined,
    };
  }

  // Si es un AP Catalyst Wireless Meraki CW916x con -HW erróneo (ej. CW9164I-MR-HW -> CW9164I-MR)
  if (/^CW91\d{2}[A-Z]*-MR-HW$/i.test(clean)) {
    return {
      sanitizedSku: clean.replace(/-HW$/i, ''),
    };
  }

  // Transceivers obsoletos comunes
  if (clean === 'GLC-SX-MM' || clean === 'GLC-SX-MM=') {
    return {
      sanitizedSku: 'GLC-SX-MMD',
      inferredLegacyEolSku: 'GLC-SX-MM',
      correctionReason: 'GLC-SX-MM está en EOL. Se reemplazó por GLC-SX-MMD (con DOM vigente en CCW).',
    };
  }
  if (clean === 'GLC-LH-SM' || clean === 'GLC-LH-SM=') {
    return {
      sanitizedSku: 'GLC-LH-SMD',
      inferredLegacyEolSku: 'GLC-LH-SM',
      correctionReason: 'GLC-LH-SM está en EOL. Se reemplazó por GLC-LH-SMD (con DOM vigente en CCW).',
    };
  }
  if (clean === 'GLC-T' || clean === 'GLC-T=') {
    return {
      sanitizedSku: 'GLC-TE',
      inferredLegacyEolSku: 'GLC-T',
      correctionReason: 'GLC-T está en EOL. Se reemplazó por GLC-TE (vigente en CCW).',
    };
  }

  return { sanitizedSku: clean };
}

// ============================================================================
// 2. BASE DE CONOCIMIENTO DINÁMICA AUTO-APRENDIZAJE (LOCALSTORAGE / INDEXEDDB)
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
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DYNAMIC_SKU_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLearnedCiscoSku(record: LearnedCiscoSkuRecord): void {
  if (typeof localStorage === 'undefined') return;
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
    return { skuSuffixYear: 3, months: 36 };
  }
  if (y >= 7) return { skuSuffixYear: 7, months: 84 };
  if (y >= 5) return { skuSuffixYear: 5, months: 60 };
  return { skuSuffixYear: 3, months: 36 };
}

/**
 * Resuelve el cable de poder oficial en Cisco CCW según la norma seleccionada.
 * POR DEFECTO EN CHILE (Intcomex Chile): 'italy_chile' (CAB-IT: CAB-ACA / CAB-TA-IT / CAB-C13-IT / MA-PWR-CORD-IT).
 */
export function resolvePowerCordSubItem(
  family: CiscoProductFamily,
  standard: PowerCordStandard = 'italy_chile',
  qtyMultiplier = 1
): SubItemConfig {
  // 1. Familia Catalyst 9300 / 9300L usa conector C15 Notch (Config 1 Power Supply)
  if (family === 'catalyst9300') {
    if (standard === 'rack_pdu') {
      return {
        partNumber: 'CAB-C15-CBN',
        qtyMultiplier,
        description: 'Cabinet Jumper Power Cord, 250 VAC 13A, C14-C15 Connectors (Rack PDU)',
        category: 'power_cord',
      };
    }
    if (standard === 'schuko_eu') {
      return {
        partNumber: 'CAB-TA-EU',
        qtyMultiplier,
        description: 'Europe AC Type A Power Cable (Schuko CEE 7/7)',
        category: 'power_cord',
      };
    }
    // Por defecto Chile / Italia (CAB-TA-IT)
    return {
      partNumber: 'CAB-TA-IT',
      qtyMultiplier,
      description: 'Italy/Chile AC Type A Power Cable (Norma Chilena CEI 23-16 10A)',
      category: 'power_cord',
    };
  }

  // 2. Familia Catalyst 1200 / 1300 SMB
  if (family === 'catalyst1200_1300') {
    if (standard === 'rack_pdu') {
      return {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier,
        description: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter (Rack PDU)',
        category: 'power_cord',
      };
    }
    if (standard === 'schuko_eu') {
      return {
        partNumber: 'CAB-C13-CE',
        qtyMultiplier,
        description: 'Power Cord Europe Schuko CEE 7/7 to C13',
        category: 'power_cord',
      };
    }
    return {
      partNumber: 'CAB-C13-IT',
      qtyMultiplier,
      description: 'Power Cord Italy/Chile CEI 23-50 (Norma Chilena 10A) to C13',
      category: 'power_cord',
    };
  }

  // 3. Familia Meraki MS225 / MS250 / MS350 / MX (Con -HW tradicional)
  if (family === 'meraki_ms225' || family === 'meraki_ms' || family === 'meraki_mx') {
    if (standard === 'rack_pdu') {
      return {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier,
        description: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter (Rack PDU)',
        category: 'power_cord',
      };
    }
    if (standard === 'schuko_eu') {
      return {
        partNumber: 'MA-PWR-CORD-EU',
        qtyMultiplier,
        description: 'Meraki AC Power Cord for Europe (Schuko)',
        category: 'power_cord',
      };
    }
    return {
      partNumber: 'MA-PWR-CORD-IT',
      qtyMultiplier,
      description: 'Meraki AC Power Cord for Italy/Chile (Norma Chilena CEI 23-50)',
      category: 'power_cord',
    };
  }

  // 4. Estándar General Cisco C13 (Catalyst 9200/9200L, MS130-SWITCHES, C8200/8300, Firepower, UCS, Nexus, IE, Collab)
  if (standard === 'rack_pdu') {
    return {
      partNumber: 'CAB-C13-C14-2M',
      qtyMultiplier,
      description: 'Power Cord Jumper, C13-C14 Connectors, 2 Meter (Rack PDU)',
      category: 'power_cord',
    };
  }
  if (standard === 'schuko_eu') {
    return {
      partNumber: 'CAB-ACE',
      qtyMultiplier,
      description: 'AC Power Cord (Europe Schuko), CEE 7/7, 1.5M',
      category: 'power_cord',
    };
  }
  // Por defecto Chile / Italia (CAB-ACA)
  return {
    partNumber: 'CAB-ACA',
    qtyMultiplier,
    description: 'AC Power Cord (Italy/Chile Norma Chilena CEI 23-16), 10A, 250V, 2.5m',
    category: 'power_cord',
  };
}

/**
 * Resuelve el servicio de soporte oficial Cisco SmartNet Total Care (SNTC) sincronizado en meses
 */
export function resolveSmartNetSubItem(
  parentSku: string,
  options: ChassisConfigOptions
): SubItemConfig | null {
  if (!options.includeSmartNet) return null;
  const clean = parentSku.trim().toUpperCase();
  if (clean.startsWith('MR') || clean.startsWith('MS') || clean.startsWith('MX') || clean.endsWith('-MR')) {
    // En Meraki el soporte 24x7 ya viene incluido dentro de la licencia LIC-...
    return null;
  }

  const years = [1, 3, 5, 7].includes(Number(options.termYears)) ? Number(options.termYears) : 3;
  const months = years * 12;
  const is24x7 = options.smartNetLevel === '24x7x4';
  const sntPrefix = is24x7 ? 'CON-SNTP' : 'CON-SNT';
  const slaLabel = is24x7 ? '24x7x4' : '8x5xNBD';

  // Mapa canónico de SKUs SmartNet más comunes en CCW
  const sntMap: Record<string, string> = {
    'C9200L-24P-4G-E': `${sntPrefix}-C920L24P`,
    'C9200L-24P-4X-E': `${sntPrefix}-C920L24X`,
    'C9200L-48P-4G-E': `${sntPrefix}-C920L48P`,
    'C9200L-48FP-4G-E': `${sntPrefix}-C92L48FP`,
    'C9200L-48P-4X-E': `${sntPrefix}-C920L48X`,
    'C9200L-24T-4G-E': `${sntPrefix}-C920L24T`,
    'C9200L-48T-4G-E': `${sntPrefix}-C920L48T`,
    'C9300-24P-E': `${sntPrefix}-C930024P`,
    'C9300-48P-E': `${sntPrefix}-C930048P`,
    'C9300L-24P-4X-E': `${sntPrefix}-C930L24P`,
    'C9300L-48P-4X-E': `${sntPrefix}-C930L48P`,
    'C8200-1N-4T': `${sntPrefix}-C82001N4`,
    'C8200L-1N-4T': `${sntPrefix}-C8200L1N`,
    'C8300-1N1S-4T2X': `${sntPrefix}-C83001N1`,
    'FPR1010-NGFW-K9': `${sntPrefix}-FPR1010N`,
    'FPR1120-NGFW-K9': `${sntPrefix}-FPR1120N`,
    'FPR1210T-K9': `${sntPrefix}-FPR1210T`,
    'FPR3110-NGFW-K9': `${sntPrefix}-FPR3110N`,
    'IE-3100-8T2C-E': `${sntPrefix}-IE3108T2`,
    'IE-3300-8T2S-E': `${sntPrefix}-IE33008T`,
    'IE-3300-8P2S-E': `${sntPrefix}-IE33008P`,
    'IE-3400-8P2S-E': `${sntPrefix}-IE34008P`,
    'UCSC-C220-M7S': `${sntPrefix}-C220M7S`,
    'UCSC-C240-M7S': `${sntPrefix}-C240M7S`,
    'N9K-C93180YC-FX3': `${sntPrefix}-N9318FX3`,
  };

  const compactCode = clean.replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const partNumber = sntMap[clean] || `${sntPrefix}-${compactCode}`;

  return {
    partNumber,
    qtyMultiplier: 1,
    durationMonths: months,
    description: `SNTC-${slaLabel} Cisco SmartNet Total Care Support for ${clean} (${months} Months)`,
    category: 'support',
    isOptional: true,
  };
}

/**
 * Catálogo de Módulos SFP / Fibra Óptica / DAC 100% vigentes en CCW 2026 para asistente de 1 clic
 */
export interface TransceiverSuggestion {
  sku: string;
  label: string;
  speed: '1G' | '10G' | '25G';
  description: string;
  defaultQty: number;
  listPriceUsd: number;
}

export const COMPATIBLE_TRANSCEIVERS_2026: TransceiverSuggestion[] = [
  {
    sku: 'SFP-10G-SR-S',
    label: '10G Multimodo (SFP-10G-SR-S)',
    speed: '10G',
    description: '10GBASE-SR SFP+ Module, Multimode 850nm (OM3/OM4 300m/400m) - S-Class Vigente',
    defaultQty: 2,
    listPriceUsd: 685,
  },
  {
    sku: 'SFP-10G-LR-S',
    label: '10G Monomodo (SFP-10G-LR-S)',
    speed: '10G',
    description: '10GBASE-LR SFP+ Module, Singlemode 1310nm (10km) - S-Class Vigente',
    defaultQty: 2,
    listPriceUsd: 1390,
  },
  {
    sku: 'SFP-H10GB-CU1M',
    label: 'Cable DAC 10G 1m (SFP-H10GB-CU1M)',
    speed: '10G',
    description: '10GBASE-CU SFP+ Direct Attach Copper Twinax Cable, 1 Meter, Passive',
    defaultQty: 1,
    listPriceUsd: 150,
  },
  {
    sku: 'GLC-SX-MMD',
    label: '1G Multimodo (GLC-SX-MMD)',
    speed: '1G',
    description: '1000BASE-SX SFP Transceiver Module, Multimode 850nm, DOM (Reemplazo oficial de GLC-SX-MM)',
    defaultQty: 2,
    listPriceUsd: 395,
  },
  {
    sku: 'GLC-LH-SMD',
    label: '1G Monomodo (GLC-LH-SMD)',
    speed: '1G',
    description: '1000BASE-LX/LH SFP Transceiver Module, Singlemode 1310nm 10km, DOM (Reemplazo de GLC-LH-SM)',
    defaultQty: 2,
    listPriceUsd: 795,
  },
  {
    sku: 'GLC-TE',
    label: '1G RJ45 Cobre (GLC-TE)',
    speed: '1G',
    description: '1000BASE-T SFP Transceiver Module for Category 5铜/UTP, Extended Temp',
    defaultQty: 2,
    listPriceUsd: 355,
  },
  {
    sku: 'MA-SFP-10GB-SR',
    label: 'Meraki 10G MM (MA-SFP-10GB-SR)',
    speed: '10G',
    description: 'Cisco Meraki 10GBASE-SR SFP+ Multimode Transceiver for MS130/MS225/MX',
    defaultQty: 2,
    listPriceUsd: 695,
  },
];

// ============================================================================
// 3. MOTOR DINÁMICO DE ENSAMBLAJE SECUENCIAL CCW (CHASSIS_RULES + RESOLVER)
// Soporta Catalyst 9200/9300/1200/1300, Routers C8200/8300, Industrial IE3100/3300/3400,
// Servidores UCS M7, Switches Nexus 9000 FX3, Firewalls FPR 1000/1200/3100,
// Colaboración DP-9800 / Room Bar y Meraki MR/MS/MX.
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
      const cordQty = opts.includeRedundantPsu ? 2 : 1;

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
          qtyMultiplier: cordQty,
          description: opts.includeRedundantPsu ? `${psuDesc} (Incluye Fuente Redundante)` : psuDesc,
          category: 'power_supply',
        },
        resolvePowerCordSubItem('catalyst9200', opts.powerCordStandard || 'italy_chile', cordQty),
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

      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) items.push(snt);

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
      const cordQty = opts.includeRedundantPsu ? 2 : 1;

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
          qtyMultiplier: cordQty,
          description: `Config 1 Platinum Power Supply (${psuSku})`,
          category: 'power_supply',
        },
        resolvePowerCordSubItem('catalyst9300', opts.powerCordStandard || 'italy_chile', cordQty),
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

      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);

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
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const subItems: SubItemConfig[] = [
        {
          partNumber: `DNA-C-T0-${tierCode}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco DNA Subscription for Routers Tier 0 (${opts.licenseTier || 'Essentials'}, ${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        resolvePowerCordSubItem('catalyst8000', opts.powerCordStandard || 'italy_chile', 1),
      ];
      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Regla Madre-Hijo para Switches Industriales Cisco Catalyst IE3100 / IE3300 / IE3400 Rugged (Vigentes 2026)
 */
function buildIndustrialIeRule(
  parentSku: string,
  series: 'IE3100' | 'IE3300' | 'IE3400',
  isPoe: boolean
): ChassisConfigRule {
  const psuSku = isPoe ? 'PWR-IE170W-PC-AC=' : 'PWR-IE65W-PC-AC=';
  const psuDesc = isPoe
    ? '170W AC to DC DIN-Rail Industrial Power Supply for PoE+'
    : '65W AC to DC DIN-Rail Industrial Power Supply';

  return {
    parentSku,
    family: 'industrial_ie',
    description: `Cisco Catalyst ${series} Rugged Industrial Ethernet Switch (${isPoe ? 'PoE+' : 'Data'})`,
    officialUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3300-rugged-series/index.html',
    defaultSubItems: (opts) => {
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const cordQty = opts.includeRedundantPsu ? 2 : 1;

      const subItems: SubItemConfig[] = [
        {
          partNumber: `${series}-DNA-${tierCode}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Catalyst ${series} DNA ${opts.licenseTier || 'Essentials'} License (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: psuSku,
          qtyMultiplier: cordQty,
          description: psuDesc,
          category: 'power_supply',
        },
        resolvePowerCordSubItem('industrial_ie', opts.powerCordStandard || 'italy_chile', cordQty),
        {
          partNumber: `IE-NW-${tierCode}`,
          qtyMultiplier: 1,
          description: `Cisco Industrial Ethernet Network ${opts.licenseTier || 'Essentials'} Stack`,
          category: 'network_stack',
        },
      ];

      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Regla Madre-Hijo para Servidores Rack Cisco UCS C220 M7 / C240 M7 (Vigentes 2026)
 */
function buildUcsServerM7Rule(parentSku: string, description: string): ChassisConfigRule {
  return {
    parentSku,
    family: 'ucs_server',
    description,
    officialUrl: 'https://www.cisco.com/c/en/us/products/servers-unified-computing/ucs-c-series-rack-servers/index.html',
    defaultSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const subItems: SubItemConfig[] = [
        {
          partNumber: 'UCS-CPU-I4410Y',
          qtyMultiplier: 1,
          description: 'Intel Xeon Silver 4410Y 2.0GHz 12-Core 150W Processor for UCS M7',
          category: 'server_component',
        },
        {
          partNumber: 'UCS-MRX32G1RE1',
          qtyMultiplier: 2,
          description: '32GB DDR5-4800MHz RDIMM 1Rx4 (Total 64GB RAM)',
          category: 'server_component',
        },
        {
          partNumber: 'UCSC-RAID-M7',
          qtyMultiplier: 1,
          description: 'Cisco 12G Modular SAS RAID Controller for UCS M7',
          category: 'server_component',
        },
        {
          partNumber: 'UCS-HD12TB10K12N',
          qtyMultiplier: 2,
          description: '1.2TB 12G SAS 10K RPM SFF HDD Hot-Plug (RAID 1)',
          category: 'server_component',
        },
        {
          partNumber: 'UCSC-PSU1-1050W',
          qtyMultiplier: 2,
          description: 'Cisco UCS 1050W Titanium Hot-Plug Redundant Power Supply',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('ucs_server', opts.powerCordStandard || 'italy_chile', 2),
        {
          partNumber: 'UCSC-RAIL-M7',
          qtyMultiplier: 1,
          description: 'Ball Bearing Rail Kit for Cisco UCS C220/C240 M7 Rack Server',
          category: 'server_component',
        },
        {
          partNumber: `DC-MGT-SAAS-EST-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Intersight Infrastructure SaaS Essentials (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
      ];
      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Regla Madre-Hijo para Switches Data Center Cisco Nexus 9300-FX3 (Vigentes 2026)
 */
function buildNexus9000Rule(parentSku: string, description: string): ChassisConfigRule {
  return {
    parentSku,
    family: 'nexus_dc',
    description,
    officialUrl: 'https://www.cisco.com/c/en/us/products/switches/nexus-9000-series-switches/index.html',
    defaultSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierPrefix = opts.licenseTier === 'Advantage' ? 'C1A1TN9300XF' : 'C1E1TN9300XF';
      const subItems: SubItemConfig[] = [
        {
          partNumber: `${tierPrefix}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Data Center Networking ${opts.licenseTier || 'Essentials'} Term N9300 XF (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: 'NXA-PAC-650W-PE',
          qtyMultiplier: 2,
          description: 'Nexus NEBS AC 650W Power Supply - Port Side Exhaust (Redundant)',
          category: 'power_supply',
        },
        {
          partNumber: 'NXA-FAN-35CFM-PE',
          qtyMultiplier: 4,
          description: 'Nexus Fan, 35CFM, Port Side Exhaust',
          category: 'server_component',
        },
        resolvePowerCordSubItem('nexus_dc', opts.powerCordStandard || 'italy_chile', 2),
      ];
      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Regla Madre-Hijo para Cisco Secure Firewall (Series 1000, 1200, 3100 Vigentes 2026)
 */
function buildSecureFirewallRule(parentSku: string, description: string): ChassisConfigRule {
  const baseModel = parentSku.split('-')[0].replace(/T$/i, ''); // Ej. FPR1010, FPR1120, FPR1210, FPR3110
  return {
    parentSku,
    family: 'firewall_fpr',
    description,
    officialUrl: 'https://www.cisco.com/c/en/us/products/security/firewalls/index.html',
    defaultSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      const subItems: SubItemConfig[] = [
        {
          partNumber: `L-${baseModel}T-TMC-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Secure Firewall ${baseModel} Threat Defense IPS, Malware & URL License (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        resolvePowerCordSubItem('firewall_fpr', opts.powerCordStandard || 'italy_chile', cordQty),
      ];
      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Regla Madre-Hijo para Colaboración Cisco (Desk Phone Serie 9800 y Webex Room Bar / Board Pro G2 Vigentes 2026)
 */
function buildCollaborationRule(
  parentSku: string,
  description: string,
  isRoomVideoDevice: boolean
): ChassisConfigRule {
  return {
    parentSku,
    family: 'collaboration',
    description,
    officialUrl: isRoomVideoDevice
      ? 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/webex-room-series/index.html'
      : 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/desk-phone-9800-series/index.html',
    defaultSubItems: (opts) => {
      const { months } = normalizeCiscoDnaTermYears(opts.termYears);
      const subItems: SubItemConfig[] = [];

      if (isRoomVideoDevice) {
        subItems.push({
          partNumber: 'L-WBX-DEV-ROOM',
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Webex Cloud Device Registration Subscription (${months}M)`,
          category: 'dna_license',
        });
        subItems.push(
          resolvePowerCordSubItem('collaboration', opts.powerCordStandard || 'italy_chile', 1)
        );
      } else {
        subItems.push({
          partNumber: 'A-FLEX-3',
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Collaboration Flex Plan 3.0 Calling Subscription (${months}M)`,
          category: 'dna_license',
        });
      }

      const snt = resolveSmartNetSubItem(parentSku, opts);
      if (snt) subItems.push(snt);
      return subItems;
    },
  };
}

/**
 * Resuelve el SKU oficial de licencia Meraki MS130 en Cisco CCW según documentation.meraki.com:
 * - Modelos compactos (8, 8P, 8X, 12X, R): LIC-MS130-CMPT-{years}Y (o CMPTA para Advanced)
 * - Modelos 24 puertas (24, 24P, 24X):     LIC-MS130-24-{years}Y   (o 24A para Advanced)
 * - Modelos 48 puertas (48, 48P, 48X):     LIC-MS130-48-{years}Y   (o 48A para Advanced)
 */
export function resolveMs130LicenseSku(
  model: string,
  termYears?: number,
  licenseTier?: 'Essentials' | 'Advantage'
): string {
  const cleanModel = (model || 'MS130-24P').trim().toUpperCase().replace(/-HW$/i, '');
  const validYears = [1, 3, 5, 7, 10].includes(Number(termYears)) ? Number(termYears) : 3;
  const advSuffix = licenseTier === 'Advantage' ? 'A' : '';

  if (cleanModel.includes('-48')) {
    return `LIC-MS130-48${advSuffix}-${validYears}Y`;
  }
  if (cleanModel.includes('-24')) {
    return `LIC-MS130-24${advSuffix}-${validYears}Y`;
  }
  return `LIC-MS130-CMPT${advSuffix}-${validYears}Y`;
}

function buildMerakiMs130Rule(defaultSubModel = 'MS130-24P'): ChassisConfigRule {
  return {
    parentSku: 'MS130-SWITCHES',
    family: 'meraki_ms130',
    description: 'Cloud-Native Access Switches in Mixed Port Options',
    officialUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
    defaultSubItems: (opts) => {
      const model = (opts.selectedModel || defaultSubModel).trim().toUpperCase().replace(/-HW$/i, '');
      const validYears = [1, 3, 5, 7, 10].includes(Number(opts.termYears)) ? Number(opts.termYears) : 3;
      const termMonths = validYears * 12;
      const licSku = resolveMs130LicenseSku(model, validYears, opts.licenseTier);
      const tierLabel = opts.licenseTier === 'Advantage' ? 'Advanced' : 'Enterprise';

      return [
        {
          partNumber: model, // Hijo 1 (1.1): Switch físico sin -HW (ej. MS130-48P, MS130-24P, MS130-12X)
          qtyMultiplier: 1,
          description: `Meraki ${model} Cloud-Native Switch Hardware`,
          category: 'network_stack',
        },
        // Hijo 2 (1.2): Cable de poder Norma Chile / Italia (CAB-ACA por defecto en contenedor CCW)
        resolvePowerCordSubItem('meraki_ms130', opts.powerCordStandard || 'italy_chile', 1),
        {
          partNumber: licSku, // Hijo 3 (1.3): Licencia oficial Meraki MS130 (LIC-MS130-48-3Y / LIC-MS130-24-3Y / LIC-MS130-CMPT-3Y)
          qtyMultiplier: 1,
          durationMonths: termMonths,
          initialTerm: termMonths,
          billingModel: 'Prepaid Term',
          description: `Meraki ${model} ${tierLabel} License and Support (${validYears}Y)`,
          category: 'dna_license',
        },
      ];
    },
  };
}

function buildMerakiMs225Rule(parentSku: string, description: string): ChassisConfigRule {
  const modelBase = parentSku.trim().toUpperCase().replace(/-HW$/i, '');
  return {
    parentSku: `${modelBase}-HW`,
    family: 'meraki_ms225',
    description,
    officialUrl: 'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS225_Datasheet',
    defaultSubItems: (opts) => {
      const validYears = [1, 3, 5, 7, 10].includes(Number(opts.termYears)) ? Number(opts.termYears) : 3;
      const termMonths = validYears * 12;
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      return [
        resolvePowerCordSubItem('meraki_ms225', opts.powerCordStandard || 'italy_chile', cordQty),
        {
          partNumber: `LIC-${modelBase}-${validYears}YR`,
          qtyMultiplier: 1,
          durationMonths: termMonths,
          initialTerm: termMonths,
          billingModel: 'Prepaid Term',
          description: `Meraki ${modelBase} Enterprise License and Support (${validYears}YR)`,
          category: 'dna_license',
        },
      ];
    },
  };
}

export const CHASSIS_RULES: Record<string, ChassisConfigRule> = {
  // --- Contenedor Madre Meraki MS130 en CCW ---
  'MS130-SWITCHES': buildMerakiMs130Rule('MS130-24P'),

  // --- Meraki MS225 Series (Con Stacking Físico + Full PoE 740W / 370W) ---
  'MS225-48FP-HW': buildMerakiMs225Rule(
    'MS225-48FP-HW',
    'Meraki MS225-48FP L2 Stck Cld-Mngd 48x GigE 740W PoE Switch'
  ),
  'MS225-48LP-HW': buildMerakiMs225Rule(
    'MS225-48LP-HW',
    'Meraki MS225-48LP L2 Stck Cld-Mngd 48x GigE 370W PoE Switch'
  ),
  'MS225-48-HW': buildMerakiMs225Rule(
    'MS225-48-HW',
    'Meraki MS225-48 L2 Stck Cld-Mngd 48x GigE Switch'
  ),
  'MS225-24P-HW': buildMerakiMs225Rule(
    'MS225-24P-HW',
    'Meraki MS225-24P L2 Stck Cld-Mngd 24x GigE 370W PoE Switch'
  ),
  'MS225-24-HW': buildMerakiMs225Rule(
    'MS225-24-HW',
    'Meraki MS225-24 L2 Stck Cld-Mngd 24x GigE Switch'
  ),

  // --- Catalyst 9200L 1G Uplinks ---
  'C9200L-24P-4G-E': buildCatalyst9200Rule('C9200L-24P-4G-E', 24, 'P', '4x1G uplink'),
  'C9200L-24P-4G-A': buildCatalyst9200Rule('C9200L-24P-4G-A', 24, 'P', '4x1G uplink'),
  'C9200L-24T-4G-E': buildCatalyst9200Rule('C9200L-24T-4G-E', 24, 'T', '4x1G uplink'),
  'C9200L-24T-4G-A': buildCatalyst9200Rule('C9200L-24T-4G-A', 24, 'T', '4x1G uplink'),
  'C9200L-48P-4G-E': buildCatalyst9200Rule('C9200L-48P-4G-E', 48, 'P', '4x1G uplink'),
  'C9200L-48P-4G-A': buildCatalyst9200Rule('C9200L-48P-4G-A', 48, 'P', '4x1G uplink'),
  'C9200L-48FP-4G-E': buildCatalyst9200Rule('C9200L-48FP-4G-E', 48, 'FP', '4x1G uplink'),
  'C9200L-48FP-4G-A': buildCatalyst9200Rule('C9200L-48FP-4G-A', 48, 'FP', '4x1G uplink'),
  'C9200L-48T-4G-E': buildCatalyst9200Rule('C9200L-48T-4G-E', 48, 'T', '4x1G uplink'),
  'C9200L-48T-4G-A': buildCatalyst9200Rule('C9200L-48T-4G-A', 48, 'T', '4x1G uplink'),

  // --- Catalyst 9200L 10G SFP+ Uplinks (4X) ---
  'C9200L-24P-4X-E': buildCatalyst9200Rule('C9200L-24P-4X-E', 24, 'P', '4x10G SFP+ uplink'),
  'C9200L-24P-4X-A': buildCatalyst9200Rule('C9200L-24P-4X-A', 24, 'P', '4x10G SFP+ uplink'),
  'C9200L-24T-4X-E': buildCatalyst9200Rule('C9200L-24T-4X-E', 24, 'T', '4x10G SFP+ uplink'),
  'C9200L-48P-4X-E': buildCatalyst9200Rule('C9200L-48P-4X-E', 48, 'P', '4x10G SFP+ uplink'),
  'C9200L-48P-4X-A': buildCatalyst9200Rule('C9200L-48P-4X-A', 48, 'P', '4x10G SFP+ uplink'),
  'C9200L-48FP-4X-E': buildCatalyst9200Rule('C9200L-48FP-4X-E', 48, 'FP', '4x10G SFP+ uplink'),
  'C9200L-48FP-4X-A': buildCatalyst9200Rule('C9200L-48FP-4X-A', 48, 'FP', '4x10G SFP+ uplink'),
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

  // --- Switches Industriales Cisco Catalyst IE3100 / IE3300 / IE3400 Rugged ---
  'IE-3100-8T2C-E': buildIndustrialIeRule('IE-3100-8T2C-E', 'IE3100', false),
  'IE-3300-8T2S-E': buildIndustrialIeRule('IE-3300-8T2S-E', 'IE3300', false),
  'IE-3300-8T2S-A': buildIndustrialIeRule('IE-3300-8T2S-A', 'IE3300', false),
  'IE-3300-8P2S-E': buildIndustrialIeRule('IE-3300-8P2S-E', 'IE3300', true),
  'IE-3300-8P2S-A': buildIndustrialIeRule('IE-3300-8P2S-A', 'IE3300', true),
  'IE-3400-8T2S-E': buildIndustrialIeRule('IE-3400-8T2S-E', 'IE3400', false),
  'IE-3400-8P2S-E': buildIndustrialIeRule('IE-3400-8P2S-E', 'IE3400', true),

  // --- Servidores Cisco UCS C220 M7 / C240 M7 ---
  'UCSC-C220-M7S': buildUcsServerM7Rule(
    'UCSC-C220-M7S',
    'Cisco UCS C220 M7 1U SFF Rack Server (Intel Xeon Scalable, DDR5)'
  ),
  'UCSC-C240-M7S': buildUcsServerM7Rule(
    'UCSC-C240-M7S',
    'Cisco UCS C240 M7 2U SFF Rack Server (Intel Xeon Scalable, DDR5)'
  ),

  // --- Switches Data Center Cisco Nexus 9300-FX3 ---
  'N9K-C93180YC-FX3': buildNexus9000Rule(
    'N9K-C93180YC-FX3',
    'Nexus 9300 48p 1/10/25G SFP28 + 6p 40/100G QSFP28 Data Center Switch'
  ),
  'N9K-C93108TC-FX3P': buildNexus9000Rule(
    'N9K-C93108TC-FX3P',
    'Nexus 9300 48p 10GBASE-T + 6p 40/100G QSFP28 Data Center Switch'
  ),

  // --- Cisco Secure Firewalls (Series 1000, 1200, 3100) ---
  'FPR1010-NGFW-K9': buildSecureFirewallRule(
    'FPR1010-NGFW-K9',
    'Cisco Secure Firewall 1010 Next-Generation Firewall Appliance'
  ),
  'FPR1120-NGFW-K9': buildSecureFirewallRule(
    'FPR1120-NGFW-K9',
    'Cisco Secure Firewall 1120 1U Next-Generation Firewall Appliance'
  ),
  'FPR1140-NGFW-K9': buildSecureFirewallRule(
    'FPR1140-NGFW-K9',
    'Cisco Secure Firewall 1140 1U Next-Generation Firewall Appliance'
  ),
  'FPR1210T-K9': buildSecureFirewallRule(
    'FPR1210T-K9',
    'Cisco Secure Firewall 1210CE Threat Defense Compact NGFW (Serie 1200)'
  ),
  'FPR1220T-K9': buildSecureFirewallRule(
    'FPR1220T-K9',
    'Cisco Secure Firewall 1220CX Threat Defense NGFW (Serie 1200)'
  ),
  'FPR3110-NGFW-K9': buildSecureFirewallRule(
    'FPR3110-NGFW-K9',
    'Cisco Secure Firewall 3110 1U Enterprise NGFW Appliance'
  ),
  'FPR3120-NGFW-K9': buildSecureFirewallRule(
    'FPR3120-NGFW-K9',
    'Cisco Secure Firewall 3120 1U Enterprise NGFW Appliance'
  ),

  // --- Colaboración: Cisco Desk Phone 9800 Series & Webex Room Bar / Board Pro G2 ---
  'DP-9841-K9': buildCollaborationRule('DP-9841-K9', 'Cisco Desk Phone 9841 (Vigencia 2026)', false),
  'DP-9851-K9': buildCollaborationRule('DP-9851-K9', 'Cisco Desk Phone 9851 (Vigencia 2026)', false),
  'DP-9861-K9': buildCollaborationRule('DP-9861-K9', 'Cisco Desk Phone 9861 con Wi-Fi & Bluetooth (Vigencia 2026)', false),
  'DP-9871-K9': buildCollaborationRule('DP-9871-K9', 'Cisco Desk Phone 9871 Touch con Cámara HD (Vigencia 2026)', false),
  'CS-BAR-T-C-K9': buildCollaborationRule('CS-BAR-T-C-K9', 'Cisco Room Bar Video Collaboration con Room Navigator', true),
  'CS-BARPRO-C-K9': buildCollaborationRule('CS-BARPRO-C-K9', 'Cisco Room Bar Pro Dual-Lens AI Video Bar con Navigator', true),
  'CS-BRD55P-G2-K9': buildCollaborationRule('CS-BRD55P-G2-K9', 'Cisco Board Pro G2 55-inch All-in-One Collaboration Board', true),
  'CS-BRD75P-G2-K9': buildCollaborationRule('CS-BRD75P-G2-K9', 'Cisco Board Pro G2 75-inch All-in-One Collaboration Board', true),
};

/**
 * Resuelve dinámicamente una regla de ensamblaje para cualquier SKU Catalyst/Meraki/Router/IE/UCS/Nexus/Firewall/Collab.
 */
export function resolveChassisRule(sku: string): ChassisConfigRule | null {
  const cleanSku = sku.trim().toUpperCase();

  // 1. Contenedor compuesto Meraki MS130 ("MS130-SWITCHES:MS130-48P" o similar)
  if (cleanSku.startsWith('MS130-SWITCHES:')) {
    const subModel = cleanSku.split(':')[1]?.trim().replace(/-HW$/i, '') || 'MS130-24P';
    return buildMerakiMs130Rule(subModel);
  }

  // 2. Modelo Meraki MS130 directo -> envolver en MS130-SWITCHES
  const directMs130 = cleanSku.match(/^(MS130R?-(?:8|8P|8X|12X|24|24P|24X|48|48P|48X))(?:-HW)?$/i);
  if (directMs130) {
    return buildMerakiMs130Rule(directMs130[1].toUpperCase());
  }

  // 3. Regla exacta en CHASSIS_RULES
  if (CHASSIS_RULES[cleanSku]) {
    return CHASSIS_RULES[cleanSku];
  }

  // 4. Detección dinámica Meraki MS225 / MS250 / MS350 / MS355 (con o sin -HW)
  const ms2xxMatch = cleanSku.match(/^(MS(?:225|250|350|355|425)-[0-9A-Z]+?)(?:-HW)?$/i);
  if (ms2xxMatch) {
    const baseMs = ms2xxMatch[1].toUpperCase();
    return buildMerakiMs225Rule(`${baseMs}-HW`, `Meraki ${baseMs} Cloud Managed Switch`);
  }

  // 5. Detección dinámica por patrón de familia Catalyst 9200L / 9200
  const cat9200Match = cleanSku.match(/^(C9200L?)-(\d{2})(FP|P|T|PXG)-([0-9A-Z]+)?-?(E|A)?$/);
  if (cat9200Match) {
    const isModular = cat9200Match[1] === 'C9200';
    const ports = Number(cat9200Match[2]) === 48 ? 48 : 24;
    const poeRaw = cat9200Match[3];
    const poeType: 'T' | 'P' | 'FP' = poeRaw === 'T' ? 'T' : poeRaw === 'FP' ? 'FP' : 'P';
    return buildCatalyst9200Rule(cleanSku, ports, poeType, cat9200Match[4] || 'Uplink', isModular);
  }

  // 6. Detección dinámica por patrón de familia Catalyst 9300 / 9300L
  const cat9300Match = cleanSku.match(/^(C9300L?)-(\d{2})(PF|P|T|U|UXM)/);
  if (cat9300Match) {
    const is9300L = cat9300Match[1] === 'C9300L';
    const ports = Number(cat9300Match[2]) === 48 ? 48 : 24;
    const poeRaw = cat9300Match[3];
    const poeType: 'T' | 'P' | 'PF' | 'U' = poeRaw === 'T' ? 'T' : poeRaw === 'PF' ? 'PF' : 'P';
    return buildCatalyst9300Rule(cleanSku, ports, poeType, is9300L);
  }

  // 7. Detección dinámica Switches Industriales IE-3100 / IE-3200 / IE-3300 / IE-3400
  if (cleanSku.startsWith('IE-3')) {
    const series: 'IE3100' | 'IE3300' | 'IE3400' = cleanSku.startsWith('IE-34')
      ? 'IE3400'
      : cleanSku.startsWith('IE-31')
        ? 'IE3100'
        : 'IE3300';
    const isPoe = /-\d+P/i.test(cleanSku);
    return buildIndustrialIeRule(cleanSku, series, isPoe);
  }

  // 8. Detección dinámica Servidores UCS C220 / C240 / UCSX
  if (cleanSku.startsWith('UCSC-') || cleanSku.startsWith('UCSX-')) {
    return buildUcsServerM7Rule(cleanSku, `Cisco UCS Rack/Modular Server (${cleanSku})`);
  }

  // 9. Detección dinámica Switches Data Center Nexus N9K
  if (cleanSku.startsWith('N9K-')) {
    return buildNexus9000Rule(cleanSku, `Cisco Nexus 9000 Data Center Switch (${cleanSku})`);
  }

  // 10. Detección dinámica Cisco Secure Firewall FPR
  if (cleanSku.startsWith('FPR')) {
    return buildSecureFirewallRule(cleanSku, `Cisco Secure Firewall Appliance (${cleanSku})`);
  }

  // 11. Detección dinámica Colaboración (DP-98xx, CP-88xx, CS-BAR, CS-BRD)
  if (
    cleanSku.startsWith('DP-98') ||
    cleanSku.startsWith('CP-88') ||
    cleanSku.startsWith('CS-BAR') ||
    cleanSku.startsWith('CS-BRD')
  ) {
    const isVideo = cleanSku.startsWith('CS-');
    return buildCollaborationRule(cleanSku, `Cisco Collaboration Endpoint (${cleanSku})`, isVideo);
  }

  // 12. Detección dinámica Catalyst 1200 / 1300 (SMB Switches: llevan cable de poder CAB-C13-IT por defecto en Chile)
  if (cleanSku.startsWith('C1200-') || cleanSku.startsWith('C1300-')) {
    return {
      parentSku: cleanSku,
      family: 'catalyst1200_1300',
      description: `Cisco ${cleanSku.startsWith('C1300-') ? 'Catalyst 1300' : 'Catalyst 1200'} Smart Managed Switch (${cleanSku})`,
      officialUrl: cleanSku.startsWith('C1300-')
        ? 'https://www.cisco.com/c/en/us/products/switches/catalyst-1300-series-switches/index.html'
        : 'https://www.cisco.com/c/en/us/products/switches/catalyst-1200-series-switches/index.html',
      defaultSubItems: (opts) => {
        const items: SubItemConfig[] = [
          resolvePowerCordSubItem('catalyst1200_1300', opts.powerCordStandard || 'italy_chile', 1),
        ];
        const snt = resolveSmartNetSubItem(cleanSku, opts);
        if (snt) items.push(snt);
        return items;
      },
    };
  }

  // 13. Detección en base auto-aprendida
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
  const years = [1, 3, 5, 7, 10].includes(Number(options.termYears)) ? Number(options.termYears) : 3;
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

  // Switches Meraki MS130 (LIC-MS130-48-3Y / LIC-MS130-24-3Y / LIC-MS130-CMPT-3Y)
  if (clean.startsWith('MS130')) {
    const licSku = resolveMs130LicenseSku(clean, years, options.licenseTier);
    return {
      partNumber: licSku,
      qtyMultiplier: 1,
      durationMonths: months,
      initialTerm: months,
      billingModel: 'Prepaid Term',
      description: `Meraki ${clean.replace(/-HW$/i, '')} ${isAdv ? 'Advanced' : 'Enterprise'} License and Support (${years}Y)`,
      category: 'dna_license',
    };
  }

  // Switches Meraki MS225 / MS250 / MS350 / MS425 (LIC-MS225-48FP-3YR)
  if (clean.startsWith('MS1') || clean.startsWith('MS2') || clean.startsWith('MS3') || clean.startsWith('MS4')) {
    const modelBase = clean.replace(/-HW$/i, '');
    return {
      partNumber: `LIC-${modelBase}-${years}YR`,
      qtyMultiplier: 1,
      durationMonths: months,
      initialTerm: months,
      billingModel: 'Prepaid Term',
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
      durationMonths: months,
      initialTerm: months,
      billingModel: 'Prepaid Term',
      description: `Meraki ${modelBase} ${isAdv ? 'Advanced Security' : 'Enterprise'} License (${years}YR)`,
      category: 'dna_license',
    };
  }

  return null;
}

/**
 * Estimador referencial de Precio Lista (USD) para pre-cotización instantánea antes de subir a CCW
 */
export function estimateReferencePriceUsd(partNumber: string, isParent: boolean): number {
  const clean = (partNumber || '').trim().toUpperCase();
  if (!clean || clean === 'MS130-SWITCHES') return 0; // Contenedor lógico $0 en CCW (el precio va en el hijo MS130-xx)

  // Cables de poder ($0 - $50 incluidos/bajo costo en configuración CCW)
  if (clean.startsWith('CAB-') || clean.startsWith('MA-PWR-CORD')) return 0;
  // Network Stack incluido en chasis ($0 en CCW)
  if (clean.includes('-NW-')) return 0;

  // Catálogo referencial GPL aproximado (USD)
  const refPrices: Record<string, number> = {
    // Meraki MS130 / MS225
    'MS130-8': 645,
    'MS130-8P': 835,
    'MS130-8X': 1190,
    'MS130-12X': 1750,
    'MS130-24': 1490,
    'MS130-24P': 2195,
    'MS130-24X': 2850,
    'MS130-48': 2720,
    'MS130-48P': 4050,
    'MS130-48X': 4950,
    'MS225-24P-HW': 4150,
    'MS225-48LP-HW': 6120,
    'MS225-48FP-HW': 7290,
    // Catalyst 9200L / 9300
    'C9200L-24T-4G-E': 1995,
    'C9200L-24P-4G-E': 2690,
    'C9200L-24P-4X-E': 3450,
    'C9200L-48T-4G-E': 3650,
    'C9200L-48P-4G-E': 4890,
    'C9200L-48FP-4G-E': 5650,
    'C9200L-48P-4X-E': 6250,
    'C9200L-48FP-4X-E': 6980,
    'C9300-24P-E': 5850,
    'C9300-48P-E': 9450,
    'C9300L-24P-4X-E': 4950,
    'C9300L-48P-4X-E': 7950,
    // Industrial IE / UCS / Nexus / Security / Collab
    'IE-3100-8T2C-E': 1890,
    'IE-3300-8T2S-E': 2650,
    'IE-3300-8P2S-E': 3190,
    'IE-3400-8T2S-E': 4250,
    'IE-3400-8P2S-E': 4890,
    'UCSC-C220-M7S': 3950,
    'UCSC-C240-M7S': 4850,
    'N9K-C93180YC-FX3': 18500,
    'N9K-C93108TC-FX3P': 17900,
    'FPR1010-NGFW-K9': 995,
    'FPR1120-NGFW-K9': 2995,
    'FPR1210T-K9': 2150,
    'FPR3110-NGFW-K9': 9850,
    'C8200L-1N-4T': 2190,
    'C8200-1N-4T': 3650,
    'C8300-1N1S-4T2X': 6950,
    'MR36-HW': 895,
    'MR46-HW': 1495,
    'CW9164I-MR': 1595,
    'MX67-HW': 795,
    'MX68-HW': 1095,
    'MX85-HW': 2995,
    'DP-9841-K9': 245,
    'DP-9851-K9': 315,
    'DP-9861-K9': 395,
    'DP-9871-K9': 545,
    'CS-BAR-T-C-K9': 4990,
    'CS-BARPRO-C-K9': 7990,
    'CS-BRD55P-G2-K9': 11500,
    'CS-BRD75P-G2-K9': 16900,
  };

  if (refPrices[clean] !== undefined) return refPrices[clean];

  // Estimación por familia de sub-componentes
  if (clean.startsWith('LIC-MS130-48')) return 1150;
  if (clean.startsWith('LIC-MS130-24')) return 690;
  if (clean.startsWith('LIC-MS130-CMPT')) return 320;
  if (clean.startsWith('LIC-MS225-48FP')) return 1690;
  if (clean.startsWith('LIC-MS225-48')) return 1350;
  if (clean.startsWith('LIC-MS225-24')) return 890;
  if (clean.startsWith('LIC-MR-') || clean.startsWith('LIC-ENT-')) return 450;
  if (clean.startsWith('LIC-MX')) return 1450;
  if (clean.includes('-DNA-E-24')) return 980;
  if (clean.includes('-DNA-E-48')) return 1850;
  if (clean.includes('-DNA-A-24')) return 2150;
  if (clean.includes('-DNA-A-48')) return 3950;
  if (clean.startsWith('DNA-C-T0')) return 1250;
  if (clean.startsWith('L-FPR')) return 1650;
  if (clean.startsWith('CON-SNT')) return 650;
  if (clean.startsWith('PWR-')) return 450;
  if (clean.includes('STACK')) return 890;
  if (clean.startsWith('SFP-10G')) return 685;
  if (clean.startsWith('GLC-')) return 395;

  return isParent ? 2200 : 350;
}

/**
 * Cruza un SKU contra la base de datos local Fast Track (IndexedDB)
 */
export async function checkSkuInFastTrackDb(sku: string): Promise<FastTrackProduct | null> {
  if (!sku) return null;
  const clean = sku.trim().toUpperCase();
  const direct = await getFastTrackItem(clean);
  if (direct) return direct;
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
