// ============================================================================
// CISCO AUTOMATED v2.1 - CONFIGURIATOR CATALOG, EOL 2026 & ASSEMBLY ENGINE
// Base determinista + auto-aprendizaje de SKUs Cisco, estado de ciclo de vida
// (EOL vs Vigente 2026) y reglas de ensamblaje secuencial para Cisco CCW.
// ============================================================================

import { getFastTrackItem, getAllFastTrackItems } from '../fasttrack/fastTrackDb';
import { FastTrackProduct } from '../fasttrack/types';
import { findGoldenTemplate, goldenTemplateToChassisRule } from './goldenTemplates';

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
 * - 'nema_us': Enchufe Americano NEMA 5-15P (CAB-AC / CAB-TA-NA / MA-PWR-CORD-US)
 * - 'argentina_iram': Enchufe Argentino IRAM 2073 (CAB-ACR / CAB-TA-AR)
 * Si el cliente solicita explícitamente otro cable en lenguaje natural o en una foto/captura, se da PRIORIDAD #1 al solicitado por el cliente.
 */
export type PowerCordStandard =
  | 'italy_chile'
  | 'rack_pdu'
  | 'schuko_eu'
  | 'nema_us'
  | 'argentina_iram';

export type EolLifecycleStatus = 'eos_eol_active' | 'active_with_newer_gen' | 'current_2026';

export type ProposalPrioritySortMode =
  | 'optimal_priority'      // Mayor % Compatibilidad/Homologación + Mejor % Descuento (Default)
  | 'priority_optimal'      // Alias UI: Mayor % Compatibilidad/Homologación + Mejor % Descuento
  | 'compatibility_desc'    // Mayor % Compatibilidad/Homologación (100% primero)
  | 'highest_compatibility' // Alias UI: Mayor % Compatibilidad/Homologación (100% primero)
  | 'discount_desc'         // Mejor % Descuento / Fast Track primero
  | 'best_discount'         // Alias UI: Mejor % Descuento / Fast Track primero
  | 'gpl_asc'               // Menor Valor GPL (Sin Descuentos) primero
  | 'lowest_gpl';           // Alias UI: Menor Valor GPL (Sin Descuentos) primero

export interface HomologatedProposalSubItem {
  partNumber: string;
  qty: number;
  unitGplUsd: number;
  totalGplUsd: number;
  description: string;
  durationMonths?: number;
}

export interface EolAlternative {
  recommendedSku: string;
  title: string;
  description: string;
  type: 'direct_equivalent' | 'cost_effective' | 'catalyst_alternative';
  compatibilityPct?: number;
  homologationLabel?: string;
  matchedSpecs?: string[];
  defaultDiscountPct?: number;
  isFastTrackPromo?: boolean;
}

export interface HomologatedProposal extends EolAlternative {
  proposalId: string;
  priorityRank: number;
  compatibilityPct: number; // Ej: 100%, 98%, 95%
  homologationLabel: string;
  compatibilityLabel: string;
  strategyTag: string;
  matchedSpecs: string[];
  unitChassisGplUsd: number; // Valor GPL unitario del Chasis/Equipo (Sin Descuentos)
  unitSolutionGplUsd: number; // Valor GPL unitario de toda la Solución Madre-Hijo (Sin Descuentos)
  totalSolutionGplUsd: number; // Valor GPL total (Solución Madre-Hijo × Cantidad, Sin Descuentos)
  estimatedDiscountPct: number; // % Descuento aplicable (Fast Track / Promo / Deal Reg)
  bestDiscountPct: number;      // Alias directo de estimatedDiscountPct
  isFastTrackEligible: boolean;
  promoBadge: string;
  discountSourceLabel: string;
  estimatedUnitNetUsd: number;
  unitEstimatedNetUsd: number;
  estimatedTotalNetUsd: number;
  totalEstimatedNetUsd: number;
  estimatedSavingsUsd: number;
  totalSavingsUsd: number;
  priorityScore: number;
  subItemsBreakdown: HomologatedProposalSubItem[];
  subItemsSummary: HomologatedProposalSubItem[];
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
  unitListPriceUsd?: number; // Precio Lista unitario extraído de solicitud/captura o catálogo GPL
  unitNetPriceUsd?: number;  // Precio Neto unitario extraído de solicitud/captura
  discountPct?: number;      // % Descuento extraído o simulado
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
  uplinkType?: '1G' | '10G' | 'SFP+' | 'Modular';
  includeStackingKit?: boolean;
  includeRedundantPsu?: boolean;
  includeSmartNet?: boolean;
  smartNetLevel?: '8x5xNBD' | '24x7x4';
  powerCordStandard?: PowerCordStandard; // Default: 'italy_chile' (CAB-IT)
  explicitPowerCordSku?: string;         // Si el cliente pidió explícitamente un código como CAB-C15-CBN
  merakiLicenseMode?: 'coterm' | 'subscription';
}

export interface ChassisConfigRule {
  parentSku: string;
  family: CiscoProductFamily;
  description: string;
  officialUrl?: string;
  estimatedListUsd?: number; // Precio Lista referencial en USD para pre-cotización instantánea
  isGoldenTemplate?: boolean;
  goldenTemplateName?: string;
  goldenTemplateSource?: string;
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

// Patrones oficiales estrictos de familias reales en Cisco Commerce Workspace (CCW)
const OFFICIAL_CISCO_SKU_PATTERNS: RegExp[] = [
  // Catalyst 9200 / 9200L / 9200CX
  /^C9200L-(?:24|48)(?:T|P|FP|PXG)-(?:4G|4X|2Y|8X|12X)(?:-(?:E|A))?$/i,
  /^C9200-(?:24|48)(?:T|P|PB|PXG)(?:-(?:E|A))?$/i,
  /^C9200CX-(?:8|12)(?:P|T|UXG)-(?:2X|2G2X)(?:-(?:E|A))?$/i,
  // Catalyst 9300 / 9300L / 9300X / 9300LM
  /^C9300-(?:24|48)(?:T|P|U|UXM|S|H|B)(?:-(?:E|A))?$/i,
  /^C9300L-(?:24|48)(?:T|P|PF|UXG)-(?:4G|4X)(?:-(?:E|A))?$/i,
  /^C9300X-(?:12|24|48)(?:Y|HX|TX)(?:-(?:E|A))?$/i,
  /^C9300LM-(?:24|48)(?:U|UX|T)-4Y(?:-(?:E|A))?$/i,
  // Catalyst 9400 / 9500 / 9600 Core (Solo modelos reales de fibra/chasis; NO existe C9580 ni C9500-24P-4G)
  /^C94(?:04|07|10)R$/i,
  /^C9500-(?:12Q|16X|24Q|24Y4C|32C|32QC|40X|48Y4C)(?:-(?:E|A))?$/i,
  /^C9606R$/i,
  // Catalyst 1000 / 1200 / 1300 SMB
  /^C1000-(?:8|16|24|48)(?:T|P|FP)-(?:2G|4G|4X)-L$/i,
  /^C1[23]00-(?:8|16|24|48)(?:T|P|FP|MGP|X)-(?:2G|4G|4X)$/i,
  // Meraki MS Switches
  /^(?:MS130-SWITCHES:)?MS130R?-(?:8|8P|8X|12X|24|24P|24X|48|48P|48X)$/i,
  /^MS130-SWITCHES$/i,
  /^MS(?:120|125|150|210|220|225|250|350|355|390)-(?:8|8P|8LP|8FP|24|24P|24X|24U|24UX|48|48LP|48FP|48P|48U|48UX|48X)(?:-HW)?$/i,
  /^MS(?:410|425|450)-(?:12|16|32)(?:-HW)?$/i,
  // Meraki MR / Catalyst Wireless CW Access Points
  /^MR(?:28|30H|33|36|36H|42|44|45|46|46E|52|53|55|56|57|70|74|76|78|84|86)(?:-HW)?$/i,
  /^CW91(?:62|63|64|66|72|76|78)[A-Z]*-(?:MR|ROW|B|A|E|Z)$/i,
  /^C91(?:05|15|20|24|30|36)AX[IEW]-[A-Z0-9]+$/i,
  // Meraki MX / MV
  /^MX(?:64|64W|65|65W|67|67C|67W|68|68W|68CW|75|84|85|95|100|105|250|450)(?:-HW)?$/i,
  /^MV(?:2|12|13|22|23|32|33|52|63|72|73|93)[A-Z0-9-]*(?:-HW)?$/i,
  // Routers Catalyst 8200 / 8300 / 8500 & ISR 1100 / 4000
  /^C8200L?-1N-4T$/i,
  /^C8300-(?:1N1S|2N2S)-(?:4T2X|6T)$/i,
  /^C8500L?-(?:12X|12X4QC|20X6C|4C8X)$/i,
  /^C11(?:11|21|61)X?-(?:4P|8P)$/i,
  /^ISR4(?:221|321|331|351|431|451)(?:\/K9|-K9)?$/i,
  // Industrial Ethernet IE-3100 / IE-3200 / IE-3300 / IE-3400 (y EOL IE-2000/3000/4000)
  /^IE-(?:2000|3000|3100|3200|3300|3400|4000)-[A-Z0-9-]+$/i,
  // Servidores Cisco UCS C220 / C240 / C225 / C245 / UCSX
  /^UCSC-C(?:220|240|225|245)-M(?:5|6|7|8)[A-Z0-9-]*$/i,
  /^UCSX-(?:210C|410C|9508)-[A-Z0-9-]+$/i,
  // Switches Data Center Nexus 9000
  /^N9K-C9[235][0-9]{2,3}[A-Z0-9-]+$/i,
  // Firewalls Cisco Secure Firewall FPR & ASA
  /^FPR(?:1010|1120|1140|1150|2110|2120|2130|2140|3105|3110|3120|3130|3140|4110|4115|4125|4145)(?:-NGFW-K9|-ASA-K9)?$/i,
  /^FPR(?:1210|1220)T-K9$/i,
  /^ASA55(?:06|08|16|25|45|55)-[A-Z0-9-]+$/i,
  // Colaboración Teléfonos IP & Video Salas
  /^DP-98(?:41|51|61|71)-K9$/i,
  /^CP-(?:7811|7821|7841|7861|8811|8841|8845|8851|8861|8865)-[A-Z0-9-]+$/i,
  /^CS-(?:BAR-T-C-K9|BARPRO-C-K9|BRD55P-G2-K9|BRD75P-G2-K9|DESKPRO-K9|KIT-K9|KITMINI-K9|KITPLUS-K9)$/i,
  // Transceivers / Fuentes / Cables / Licencias oficiales
  /^(?:SFP-10G-SR-S|SFP-10G-LR-S|SFP-10G-SR|SFP-10G-LR|SFP-H10GB-CU[135]M|GLC-SX-MMD|GLC-LH-SMD|GLC-TE|GLC-SX-MM|GLC-LH-SM|GLC-T|MA-SFP-10GB-SR|MA-SFP-1GB-SX)$/i,
  /^(?:CAB-ACA|CAB-ACE|CAB-TA-IT|CAB-TA-EU|CAB-TA-NA|CAB-TA-AR|CAB-C13-IT|CAB-C13-CE|CAB-C13-CBN|CAB-C13-C14-2M|CAB-C15-CBN|CAB-AC|CAB-ACR|MA-PWR-CORD-IT|MA-PWR-CORD-EU|MA-PWR-CORD-US|MA-PWR-CORD-AR)$/i,
  /^(?:PWR-C[156]-[A-Z0-9/-]+|PWR-IE[A-Z0-9=-]+|SD-IE-[A-Z0-9=-]+|C9[23]00L?-STACK-KIT|STACK-T[14]-[A-Z0-9]+|C9[23]00-NM-[A-Z0-9]+)$/i,
  /^(?:C9[23]00L?-DNA-[EA]-(?:24|48)-[1357]Y|C9[23]00L?-NW-[EA]-(?:24|48)|LIC-[A-Z0-9-]+|L-FPR[A-Z0-9-]+|DNA-[A-Z0-9-]+|CON-SNT[A-Z0-9-]*)$/i,
];

/**
 * Mapa de corrección coherente para errores de tipeo frecuentes, SKUs incompletos o nomenclatura cruzada del cliente.
 * Convierte la solicitud con error del cliente en el Part Number oficial vigente en CCW manteniendo 100% coherencia técnica.
 */
const CLIENT_TYPO_COHERENT_MAP: Record<
  string,
  {
    targetSku: string;
    inferredEolSku?: string;
    reason: string;
    alternatives?: EolAlternative[];
  }
> = {
  // Nomenclatura cruzada C9200 (modular) escrito con uplinks fijos -4G / -4X de C9200L
  'C9200-24P-4G-E': {
    targetSku: 'C9200L-24P-4G-E',
    reason: 'Corrección coherente CCW: Los uplinks fijos 4x1G corresponden a C9200L-24P-4G-E (o C9200-24P-E modular con C9200-NM-4G).',
    alternatives: [
      {
        recommendedSku: 'C9200L-24P-4G-E',
        title: 'Catalyst 9200L-24P-4G-E (Uplinks Fijos 4x1G)',
        description: 'Switch 24P PoE+ (370W) con 4x1G SFP fijos y DNA Essentials.',
        type: 'direct_equivalent',
      },
      {
        recommendedSku: 'C9200-24P-E',
        title: 'Catalyst 9200-24P-E (Chasis Modular + C9200-NM-4X/4G)',
        description: 'Switch 24P PoE+ modular con ranura de uplink intercambiable.',
        type: 'catalyst_alternative',
      },
    ],
  },
  'C9200-24P-4X-E': {
    targetSku: 'C9200L-24P-4X-E',
    reason: 'Corrección coherente CCW: Los uplinks fijos 4x10G corresponden a C9200L-24P-4X-E (o C9200-24P-E modular con C9200-NM-4X).',
    alternatives: [
      {
        recommendedSku: 'C9200L-24P-4X-E',
        title: 'Catalyst 9200L-24P-4X-E (Uplinks Fijos 4x10G)',
        description: 'Switch 24P PoE+ (370W) con 4x10G SFP+ fijos y DNA Essentials.',
        type: 'direct_equivalent',
      },
      {
        recommendedSku: 'C9200-24P-E',
        title: 'Catalyst 9200-24P-E (Modular + C9200-NM-4X)',
        description: 'Switch 24P PoE+ modular con módulo C9200-NM-4X incluido.',
        type: 'catalyst_alternative',
      },
    ],
  },
  'C9200-48P-4G-E': {
    targetSku: 'C9200L-48P-4G-E',
    reason: 'Corrección coherente CCW: Los uplinks fijos 4x1G en 48P corresponden a C9200L-48P-4G-E (o C9200-48P-E modular).',
  },
  'C9200-48P-4X-E': {
    targetSku: 'C9200L-48P-4X-E',
    reason: 'Corrección coherente CCW: Los uplinks fijos 4x10G en 48P corresponden a C9200L-48P-4X-E (o C9200-48P-E modular).',
  },
  'C9200-48FP-4G-E': {
    targetSku: 'C9200L-48FP-4G-E',
    reason: 'Corrección coherente CCW: El modelo 48 puertas Full PoE 740W con 4x1G es C9200L-48FP-4G-E.',
  },
  'C9200-48FP-4X-E': {
    targetSku: 'C9200L-48FP-4X-E',
    reason: 'Corrección coherente CCW: El modelo 48 puertas Full PoE 740W con 4x10G es C9200L-48FP-4X-E.',
  },
  // SKUs incompletos de clientes sin sufijo de licencia o uplink
  'C9200-24P': {
    targetSku: 'C9200-24P-E',
    reason: 'SKU completado con licencia oficial Network Essentials: C9200-24P-E (incluye módulo C9200-NM-4X).',
  },
  'C9200-48P': {
    targetSku: 'C9200-48P-E',
    reason: 'SKU completado con licencia oficial Network Essentials: C9200-48P-E (incluye módulo C9200-NM-4X).',
  },
  'C9200-24T': {
    targetSku: 'C9200-24T-E',
    reason: 'SKU completado con licencia oficial Network Essentials: C9200-24T-E.',
  },
  'C9200-48T': {
    targetSku: 'C9200-48T-E',
    reason: 'SKU completado con licencia oficial Network Essentials: C9200-48T-E.',
  },
  'C9200L-24P': {
    targetSku: 'C9200L-24P-4G-E',
    reason: 'SKU incompleto normalizado a C9200L-24P-4G-E (disponible también en 10G: C9200L-24P-4X-E).',
  },
  'C9200L-48P': {
    targetSku: 'C9200L-48P-4G-E',
    reason: 'SKU incompleto normalizado a C9200L-48P-4G-E (disponible también en 10G: C9200L-48P-4X-E).',
  },
  'C9200L-48FP': {
    targetSku: 'C9200L-48FP-4G-E',
    reason: 'SKU incompleto normalizado a C9200L-48FP-4G-E (740W Full PoE+).',
  },
  'C9200L-24T': {
    targetSku: 'C9200L-24T-4G-E',
    reason: 'SKU incompleto normalizado a C9200L-24T-4G-E.',
  },
  'C9200L-48T': {
    targetSku: 'C9200L-48T-4G-E',
    reason: 'SKU incompleto normalizado a C9200L-48T-4G-E.',
  },
  'C9300-24P': {
    targetSku: 'C9300-24P-E',
    reason: 'SKU incompleto normalizado a C9300-24P-E.',
  },
  'C9300-48P': {
    targetSku: 'C9300-48P-E',
    reason: 'SKU incompleto normalizado a C9300-48P-E.',
  },
  'C9300L-24P': {
    targetSku: 'C9300L-24P-4X-E',
    reason: 'SKU incompleto normalizado a C9300L-24P-4X-E.',
  },
  'C9300L-48P': {
    targetSku: 'C9300L-48P-4X-E',
    reason: 'SKU incompleto normalizado a C9300L-48P-4X-E.',
  },
  'C9300-24P-4X-E': {
    targetSku: 'C9300L-24P-4X-E',
    reason: 'Corrección coherente CCW: El modelo 9300 con uplinks fijos 4x10G es C9300L-24P-4X-E (o C9300-24P-E con C9300-NM-8X).',
  },
  'C9300-48P-4X-E': {
    targetSku: 'C9300L-48P-4X-E',
    reason: 'Corrección coherente CCW: El modelo 9300 con uplinks fijos 4x10G es C9300L-48P-4X-E (o C9300-48P-E con C9300-NM-8X).',
  },
  // Abreviaciones EOL frecuentes de clientes (sin prefijo WS-C)
  '2960X-24PS-L': {
    targetSku: 'C9200L-24P-4G-E',
    inferredEolSku: 'WS-C2960X-24PS-L',
    reason: 'Catalyst 2960-X (WS-C2960X-24PS-L) está en End-of-Life. Migrado coherentemente a Catalyst C9200L-24P-4G-E.',
  },
  'C2960X-24PS-L': {
    targetSku: 'C9200L-24P-4G-E',
    inferredEolSku: 'WS-C2960X-24PS-L',
    reason: 'Catalyst 2960-X (WS-C2960X-24PS-L) está en End-of-Life. Migrado coherentemente a Catalyst C9200L-24P-4G-E.',
  },
  '2960X-48FPS-L': {
    targetSku: 'C9200L-48FP-4G-E',
    inferredEolSku: 'WS-C2960X-48FPS-L',
    reason: 'Catalyst 2960-X (WS-C2960X-48FPS-L) está en End-of-Life. Migrado coherentemente a Catalyst C9200L-48FP-4G-E (740W).',
  },
  '2960X-48LPS-L': {
    targetSku: 'C9200L-48P-4G-E',
    inferredEolSku: 'WS-C2960X-48LPS-L',
    reason: 'Catalyst 2960-X (WS-C2960X-48LPS-L) está en End-of-Life. Migrado coherentemente a Catalyst C9200L-48P-4G-E (370W).',
  },
  '3850-24P': {
    targetSku: 'C9300-24P-E',
    inferredEolSku: 'WS-C3850-24P-S',
    reason: 'Catalyst 3850 24P está en End-of-Life. Migrado coherentemente a su reemplazo oficial C9300-24P-E.',
  },
  '3850-48P': {
    targetSku: 'C9300-48P-E',
    inferredEolSku: 'WS-C3850-48P-S',
    reason: 'Catalyst 3850 48P está en End-of-Life. Migrado coherentemente a su reemplazo oficial C9300-48P-E.',
  },
};

export interface OfficialSkuValidationResult {
  isValidOfficialSku: boolean;
  isNonExistentSku: boolean;
  isKnownEolSku: boolean;
  wasCorrectedFromClientTypo?: boolean;
  cleanSku: string;
  recommendedValidSku: string;
  reason?: string;
  alternatives: EolAlternative[];
}

/**
 * Validador y reconciliador inteligente contra el catálogo real de Cisco Commerce Workspace (CCW).
 * - Si el cliente comete un error de tipeo o envía un SKU incompleto/abreviado o con error (ej. "C9200-24P-4G-E", "C9200-24P", "C9580-24P-4G-E"),
 *   analiza las especificaciones pedidas (puertos, PoE, uplinks, familia Cisco o Meraki) y entrega un Part Number 100% coherente y vigente (no EOL).
 */
export function validateOfficialCiscoSku(rawSku: string): OfficialSkuValidationResult {
  const clean = (rawSku || '').trim().toUpperCase();
  if (!clean) {
    return {
      isValidOfficialSku: false,
      isNonExistentSku: true,
      isKnownEolSku: false,
      cleanSku: '',
      recommendedValidSku: 'C9200L-24P-4G-E',
      reason: 'SKU vacío.',
      alternatives: [],
    };
  }

  // 0. Verificar si está en el mapa de reconciliación coherente de errores frecuentes de clientes
  const typoEntry = CLIENT_TYPO_COHERENT_MAP[clean];
  if (typoEntry) {
    const isEol = Boolean(typoEntry.inferredEolSku);
    return {
      isValidOfficialSku: !isEol,
      isNonExistentSku: false,
      isKnownEolSku: isEol,
      wasCorrectedFromClientTypo: !isEol,
      cleanSku: typoEntry.inferredEolSku || clean,
      recommendedValidSku: typoEntry.targetSku,
      reason: typoEntry.reason,
      alternatives:
        typoEntry.alternatives ||
        (typoEntry.inferredEolSku ? EOL_CANONICAL_MAPPING[typoEntry.inferredEolSku] || [] : []),
    };
  }

  // 1. Verificar si está en el catálogo EOL oficial 2026 (con o sin sufijo -HW / =)
  const eolEntry =
    EOL_CATALOG_2026[clean] ||
    EOL_CATALOG_2026[clean.replace(/-HW$/i, '')] ||
    EOL_CATALOG_2026[clean.replace(/=$/, '')];
  if (eolEntry) {
    return {
      isValidOfficialSku: true,
      isNonExistentSku: false,
      isKnownEolSku: eolEntry.status === 'eos_eol_active',
      cleanSku: clean,
      recommendedValidSku: eolEntry.replacementSku,
      reason: eolEntry.eolNote,
      alternatives:
        EOL_CANONICAL_MAPPING[clean] ||
        EOL_CANONICAL_MAPPING[clean.replace(/-HW$/i, '')] ||
        [],
    };
  }

  // 2. Verificar si es un SKU Catalyst 9200L/9300L al que solo le faltó el sufijo "-E"
  if (/^C9[23]00L?-(?:24|48)(?:T|P|FP|PF)-(?:4G|4X)$/i.test(clean)) {
    const withE = `${clean}-E`;
    return {
      isValidOfficialSku: true,
      isNonExistentSku: false,
      isKnownEolSku: false,
      wasCorrectedFromClientTypo: true,
      cleanSku: withE,
      recommendedValidSku: withE,
      reason: `Se normalizó el SKU agregando el sufijo de licenciamiento oficial (${withE}).`,
      alternatives: [],
    };
  }

  // 3. Verificar si calza con los patrones oficiales reales de Cisco CCW
  const matchesOfficialPattern = OFFICIAL_CISCO_SKU_PATTERNS.some((rx) => rx.test(clean));
  if (matchesOfficialPattern) {
    return {
      isValidOfficialSku: true,
      isNonExistentSku: false,
      isKnownEolSku: false,
      cleanSku: clean,
      recommendedValidSku: clean,
      alternatives: [],
    };
  }

  // 4. Si NO calza con ningún patrón oficial -> Analizar intención técnica del cliente (puertos, PoE, uplinks, familia)
  // para entregar un Part Number 100% coherente y vigente en CCW
  const is48 = clean.includes('48');
  const is8 = /\b8[PTX]|\b08[PTX]|-8[PTX]/i.test(clean);
  const isFullPoe = clean.includes('FP') || clean.includes('740W');
  const isNoPoe = /-(?:24|48|8|16)T\b/i.test(clean);
  const is10G = clean.includes('4X') || clean.includes('10G') || clean.includes('Y4C') || clean.includes('8X');
  const tierCode = clean.endsWith('-A') ? 'A' : 'E';
  const portNum = is48 ? '48' : '24';
  const poeCode = isNoPoe ? 'T' : isFullPoe && is48 ? 'FP' : 'P';

  // Caso A: Error de tipeo o modelo inventado en serie Catalyst 9xxx (ej. "C9580-24P-4G-E", "C9250-24P", "C9500-24P-4G")
  if (/^C9\d{2,3}/i.test(clean)) {
    const recAccessFixed = `C9200L-${portNum}${poeCode}-${is10G ? '4X' : '4G'}-${tierCode}`;
    const recAccessModular = `C9200-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode}`;
    const rec9300 = `C9300-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode}`;
    const recCore = `C9500-24Y4C-${tierCode}`;
    return {
      isValidOfficialSku: false,
      isNonExistentSku: true,
      isKnownEolSku: false,
      cleanSku: clean,
      recommendedValidSku: recAccessFixed,
      reason: `⚠️ Corrección Coherente CCW: El código "${clean}" presenta un error de tipeo o no existe en el catálogo oficial de Cisco. Según las características solicitadas (${portNum} puertos ${isNoPoe ? 'Datos' : isFullPoe ? 'Full PoE+ 740W' : 'PoE+ 370W'}, uplinks ${is10G ? '10G' : '1G'}), se asignó el Part Number oficial vigente ${recAccessFixed}:`,
      alternatives: [
        {
          recommendedSku: recAccessFixed,
          title: `Catalyst ${recAccessFixed} (Equivalente Coherente Fijo)`,
          description: `Switch oficial Cisco Catalyst 9200L de ${portNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} con uplinks ${is10G ? '4x10G SFP+' : '4x1G SFP'}.`,
          type: 'direct_equivalent',
        },
        {
          recommendedSku: recAccessModular,
          title: `Catalyst ${recAccessModular} (Equivalente Modular + C9200-NM-4X)`,
          description: `Switch oficial Cisco Catalyst 9200 modular de ${portNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} con módulo de uplink intercambiable.`,
          type: 'catalyst_alternative',
        },
        {
          recommendedSku: rec9300,
          title: `Catalyst ${rec9300} (Enterprise Stackable)`,
          description: `Switch oficial Cisco Catalyst 9300 de ${portNum} puertos de alto rendimiento.`,
          type: 'catalyst_alternative',
        },
        {
          recommendedSku: recCore,
          title: `Catalyst ${recCore} (Switch Core Fibra 25G/100G)`,
          description: 'Switch Core oficial de la serie Catalyst 9500 (24 puertos SFP28 10G/25G + 4x 100G QSFP28).',
          type: 'cost_effective',
        },
      ],
    };
  }

  // Caso B: Error de tipeo o modelo EOL en serie Meraki MS
  if (clean.startsWith('MS')) {
    const recMeraki = is48 && isFullPoe
      ? 'MS225-48FP-HW'
      : is8
        ? `MS130-SWITCHES:MS130-8${isNoPoe ? '' : 'P'}`
        : `MS130-SWITCHES:MS130-${portNum}${isNoPoe ? '' : 'P'}`;
    return {
      isValidOfficialSku: false,
      isNonExistentSku: true,
      isKnownEolSku: false,
      cleanSku: clean,
      recommendedValidSku: recMeraki,
      reason: `⚠️ Corrección Coherente Meraki CCW: El código "${clean}" presenta un error o está descontinuado. Según las especificaciones (${is8 ? '8' : portNum} puertos ${isNoPoe ? 'Data' : isFullPoe ? 'Full PoE 740W' : 'PoE+'}), se asignó el Part Number oficial vigente ${recMeraki}:`,
      alternatives: is48 && isFullPoe ? ALT_MS_48FP : is48 ? ALT_MS_48LP : ALT_MS_24P,
    };
  }

  // Caso C: Error de tipeo o modelo antiguo en Access Points Meraki MR / Catalyst CW
  if (clean.startsWith('MR') || clean.startsWith('CW') || clean.startsWith('AIR-')) {
    const isHighDensity = clean.includes('4') || clean.includes('5') || clean.includes('6');
    const recAp = isHighDensity ? 'MR46-HW' : 'MR36-HW';
    return {
      isValidOfficialSku: false,
      isNonExistentSku: true,
      isKnownEolSku: true,
      cleanSku: clean,
      recommendedValidSku: recAp,
      reason: `⚠️ Corrección Coherente Wireless CCW: El modelo "${clean}" está en EOL o presenta un error de tipeo. Se asignó el Access Point Wi-Fi 6 vigente ${recAp} (alternativa Wi-Fi 6E: CW9164I-MR):`,
      alternatives: [
        {
          recommendedSku: recAp,
          title: `Meraki ${recAp} (Wi-Fi 6 Vigente)`,
          description: 'Access Point Cloud Managed Wi-Fi 6 100% vigente en CCW.',
          type: 'direct_equivalent',
        },
        {
          recommendedSku: 'CW9164I-MR',
          title: 'Catalyst Wireless CW9164I-MR (Wi-Fi 6E Tri-Band)',
          description: 'Access Point Wi-Fi 6E de nueva generación gestionable en Meraki Cloud.',
          type: 'catalyst_alternative',
        },
      ],
    };
  }

  // Caso D: Cualquier otro SKU con error de tipeo -> Reconciliar coherentemente según puertos/PoE
  const fallbackValid = `C9200L-${portNum}${poeCode}-${is10G ? '4X' : '4G'}-${tierCode}`;
  return {
    isValidOfficialSku: false,
    isNonExistentSku: true,
    isKnownEolSku: false,
    cleanSku: clean,
    recommendedValidSku: fallbackValid,
    reason: `⚠️ Corrección Coherente CCW: El Part Number "${clean}" no existe exactamente en Cisco CCW o tiene un error de escritura. Se reconcilió con el modelo oficial vigente más cercano (${fallbackValid}):`,
    alternatives: [
      {
        recommendedSku: fallbackValid,
        title: `Catalyst ${fallbackValid} (Equivalente Coherente Vigente)`,
        description: 'Switch oficial Cisco Catalyst 9200L 100% ordenable en Cisco CCW.',
        type: 'direct_equivalent',
      },
      {
        recommendedSku: `C9200-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode}`,
        title: `Catalyst C9200-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode} (Chasis Modular)`,
        description: 'Switch oficial Cisco Catalyst 9200 modular con C9200-NM-4X.',
        type: 'catalyst_alternative',
      },
      {
        recommendedSku: `C9300-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode}`,
        title: `Catalyst C9300-${portNum}${isNoPoe ? 'T' : 'P'}-${tierCode} (Línea Enterprise)`,
        description: 'Switch oficial Cisco Catalyst 9300 modular apilable.',
        type: 'catalyst_alternative',
      },
      {
        recommendedSku: `MS130-SWITCHES:MS130-${portNum}${isNoPoe ? '' : 'P'}`,
        title: `Meraki MS130-${portNum}${isNoPoe ? '' : 'P'} (Línea Cloud Managed)`,
        description: 'Switch oficial Meraki administrado en la nube con 4x 10G SFP+.',
        type: 'cost_effective',
      },
    ],
  };
}

/**
 * Devuelve las alternativas validadas en CCW para un SKU en EOL o para un SKU con error/reconciliado
 */
export function getEolAlternatives(rawSku?: string): EolAlternative[] {
  if (!rawSku) return [];
  const clean = rawSku.trim().toUpperCase();
  if (CLIENT_TYPO_COHERENT_MAP[clean]?.alternatives) {
    return CLIENT_TYPO_COHERENT_MAP[clean].alternatives!;
  }
  if (EOL_CANONICAL_MAPPING[clean]) {
    return EOL_CANONICAL_MAPPING[clean];
  }
  const withoutHw = clean.replace(/-HW$/i, '');
  if (EOL_CANONICAL_MAPPING[withoutHw]) {
    return EOL_CANONICAL_MAPPING[withoutHw];
  }
  const validation = validateOfficialCiscoSku(clean);
  if ((validation.isNonExistentSku || validation.alternatives.length > 0) && validation.alternatives.length > 0) {
    return validation.alternatives;
  }
  return [];
}

/**
 * Sanitizador y reconciliador determinista para cualquier SKU Cisco/Meraki antes de ir a CCW:
 * - Corrige errores de tipeo del cliente manteniendo coherencia técnica (puertos, PoE, uplinks, familia).
 * - Elimina sufijo ilegal "-HW" en la familia MS130 y CW916x, y agrega "-HW" donde es obligatorio (MR36-HW, MX67-HW, MS225-24P-HW).
 * - Envuelve cualquier modelo suelto MS130-xx dentro de su contenedor Madre obligatorio "MS130-SWITCHES:MS130-xx".
 * - Reemplaza transceivers y equipos EOL por sus equivalentes vigentes 2026.
 */
export function sanitizeAndValidateCcwSku(rawSku: string): {
  sanitizedSku: string;
  inferredLegacyEolSku?: string;
  correctionReason?: string;
  isNonExistentSku?: boolean;
  wasCorrectedFromClientTypo?: boolean;
} {
  const clean = (rawSku || '').trim().toUpperCase();
  if (!clean) return { sanitizedSku: '' };

  // 0. Revisar si coincide con un error frecuente o SKU incompleto del cliente en CLIENT_TYPO_COHERENT_MAP
  const typoMatch = CLIENT_TYPO_COHERENT_MAP[clean];
  if (typoMatch) {
    return {
      sanitizedSku: typoMatch.targetSku,
      inferredLegacyEolSku: typoMatch.inferredEolSku || clean,
      isNonExistentSku: !typoMatch.inferredEolSku,
      correctionReason: typoMatch.reason,
    };
  }

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
      isNonExistentSku: true,
      correctionReason:
        '⚠️ Corrección Coherente CCW: No existe el modelo MS130-48FP (el tope de la serie MS130 es 370W en MS130-48P). Para respetar los 740W Full PoE solicitados se asignó MS225-48FP-HW (y se habilitaron las alternativas MS130-48P y C9200L-48FP-4G-E).',
    };
  }

  // Caso: IA o usuario escribió "MS130-48LP(-HW)" o "MS130-24LP(-HW)" o "MS130-24FP(-HW)"
  if (/^MS130-48LP(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-48P',
      inferredLegacyEolSku: 'MS210-48LP',
      isNonExistentSku: true,
      correctionReason: 'En la serie MS130 el modelo PoE+ de 48 puertas es MS130-48P (bajo contenedor Madre MS130-SWITCHES, sin -HW).',
    };
  }
  if (/^MS130-24(?:FP|LP)(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-24P',
      inferredLegacyEolSku: 'MS210-24P',
      isNonExistentSku: true,
      correctionReason: 'En la serie MS130 el modelo PoE+ de 24 puertas es MS130-24P (bajo contenedor Madre MS130-SWITCHES, sin -HW).',
    };
  }
  if (/^MS130-8(?:FP|LP)(?:-HW)?$/i.test(clean)) {
    return {
      sanitizedSku: 'MS130-SWITCHES:MS130-8P',
      inferredLegacyEolSku: 'MS120-8LP',
      isNonExistentSku: true,
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

  // Si es un modelo Meraki vigente MR / MX / MS225 escrito sin "-HW" (ej. "MR36" -> "MR36-HW", "MX67" -> "MX67-HW", "MS225-24P" -> "MS225-24P-HW")
  if (/^(?:MR(?:28|36|36H|44|46|46E|56|57|76|78|86)|MX(?:67|67C|67W|68|68W|68CW|75|85|95|105|250|450)|MS(?:225|250|350|355)-(?:24|24P|24X|48|48LP|48FP))$/i.test(clean)) {
    return {
      sanitizedSku: `${clean}-HW`,
      correctionReason: `Se normalizó el Part Number Meraki al formato oficial de hardware en CCW (${clean}-HW).`,
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

  // Validación y reconciliación inteligente contra SKUs con errores de tipeo o EOL
  const officialCheck = validateOfficialCiscoSku(clean);
  if (officialCheck.isKnownEolSku) {
    return {
      sanitizedSku: officialCheck.recommendedValidSku,
      inferredLegacyEolSku: clean,
      correctionReason: officialCheck.reason,
    };
  }
  if (officialCheck.isNonExistentSku) {
    return {
      sanitizedSku: officialCheck.recommendedValidSku,
      inferredLegacyEolSku: clean,
      isNonExistentSku: true,
      correctionReason: officialCheck.reason,
    };
  }

  return { sanitizedSku: officialCheck.cleanSku || clean };
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
    const candidate = record.sku.trim().toUpperCase();
    // NUNCA guardar un SKU inexistente/alucinado en la base de aprendizaje
    const check = validateOfficialCiscoSku(candidate);
    if (check.isNonExistentSku) return;

    const current = getLearnedCiscoSkus();
    current[candidate] = {
      ...record,
      sku: candidate,
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
 * Detecta con PRIORIDAD #1 si el cliente solicitó explícitamente otro cable de poder
 * ya sea en lenguaje natural (texto) o dentro de una foto/captura de pantalla (aiSubItems / aiCordStandard).
 * Si el cliente NO pidió un cable distinto, devuelve 'italy_chile' (CAB-IT: CAB-ACA / CAB-TA-IT / MA-PWR-CORD-IT).
 */
export function detectClientRequestedPowerCord(
  rawText?: string,
  aiSubItems?: SubItemConfig[],
  aiCordStandard?: string
): {
  standard: PowerCordStandard;
  explicitlyRequestedByClient: boolean;
  detectedLabel?: string;
} {
  const text = (rawText || '').trim();
  const subText = Array.isArray(aiSubItems)
    ? aiSubItems.map((s) => `${s.partNumber || ''} ${s.description || ''}`).join(' ')
    : '';
  const combined = `${text} ${subText}`;

  // 1. Revisar si en lenguaje natural o en los SKUs de la captura pidió Rack PDU (C13-C14 / C15)
  if (
    /\bpdu\b|\bc13-?c14\b|\bc14-?c15\b|\bcab-c13-c14\b|\bcab-c15-cbn\b|\bjumper\s+cord\b/i.test(
      combined
    ) ||
    aiCordStandard === 'rack_pdu'
  ) {
    return {
      standard: 'rack_pdu',
      explicitlyRequestedByClient: true,
      detectedLabel: 'Rack PDU (CAB-C13-C14-2M / CAB-C15-CBN) solicitado por cliente',
    };
  }

  // 2. Revisar si pidió NEMA / Americano / USA (CAB-TA-NA / CAB-AC / MA-PWR-CORD-US)
  if (
    /\bnema\b|\b5-15p\b|\bamericano\b|\benchufe\s+us(?:a)?\b|\bcable\s+us(?:a)?\b|\bnorma\s+americana\b|\bcab-ta-na\b|\bcab-ac\b|\bcab-9k12a-na\b|\bma-pwr-cord-us\b|\bcab-us\b/i.test(
      combined
    ) ||
    aiCordStandard === 'nema_us'
  ) {
    return {
      standard: 'nema_us',
      explicitlyRequestedByClient: true,
      detectedLabel: 'NEMA 5-15P USA/Americano (CAB-AC / CAB-TA-NA) solicitado por cliente',
    };
  }

  // 3. Revisar si pidió Argentina / IRAM (CAB-ACR / CAB-TA-AR)
  if (
    /\bargentin[oa]\b|\biram\b|\bcab-acr\b|\bcab-ta-ar\b|\bma-pwr-cord-ar\b/i.test(combined) ||
    aiCordStandard === 'argentina_iram'
  ) {
    return {
      standard: 'argentina_iram',
      explicitlyRequestedByClient: true,
      detectedLabel: 'Argentina IRAM (CAB-ACR / CAB-TA-AR) solicitado por cliente',
    };
  }

  // 4. Revisar si pidió explícitamente Schuko / Europeo (CAB-ACE / CAB-TA-EU / CEE 7/7) en texto o captura
  if (
    /\bschuko\b|\bcee\s*7\/7\b|\bcab-ace\b|\bcab-ta-eu\b|\bcab-c13-ce\b|\bma-pwr-cord-eu\b|\beuropeo\b|\bnorma\s+europea\b/i.test(
      combined
    ) ||
    aiCordStandard === 'schuko_eu'
  ) {
    return {
      standard: 'schuko_eu',
      explicitlyRequestedByClient: true,
      detectedLabel: 'Schuko Europeo (CAB-ACE / CAB-TA-EU) solicitado por cliente',
    };
  }

  // 5. Revisar si pidió explícitamente Italia / Norma Chile (CAB-ACA / CAB-TA-IT / CAB-IT)
  if (/\bcab-aca\b|\bcab-ta-it\b|\bcab-c13-it\b|\bma-pwr-cord-it\b|\bcab-it\b|\bitalia\b/i.test(text)) {
    return {
      standard: 'italy_chile',
      explicitlyRequestedByClient: true,
      detectedLabel: 'Norma Chile / Italia (CAB-IT) solicitado explícitamente por cliente',
    };
  }

  // 6. Si no solicitó otro cable distinto -> Por defecto en Chile siempre Norma Italia/Chile (CAB-IT)
  return {
    standard: 'italy_chile',
    explicitlyRequestedByClient: false,
  };
}

/**
 * Resuelve el cable de poder oficial en Cisco CCW según la norma seleccionada.
 * - Si el cliente solicitó otro cable en texto o captura (PDU, Schuko, NEMA USA, Argentina), se prioriza ese cable.
 * - POR DEFECTO EN CHILE (Intcomex Chile): 'italy_chile' (CAB-IT: CAB-ACA / CAB-TA-IT / CAB-C13-IT / MA-PWR-CORD-IT).
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
    if (standard === 'nema_us') {
      return {
        partNumber: 'CAB-TA-NA',
        qtyMultiplier,
        description: 'North America AC Type A Power Cable (NEMA 5-15P)',
        category: 'power_cord',
      };
    }
    if (standard === 'argentina_iram') {
      return {
        partNumber: 'CAB-TA-AR',
        qtyMultiplier,
        description: 'Argentina AC Type A Power Cable (IRAM 2073)',
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
    if (standard === 'nema_us') {
      return {
        partNumber: 'CAB-C13-CBN',
        qtyMultiplier,
        description: 'Power Cord North America NEMA 5-15P to C13',
        category: 'power_cord',
      };
    }
    if (standard === 'argentina_iram') {
      return {
        partNumber: 'CAB-ACR',
        qtyMultiplier,
        description: 'Power Cord Argentina IRAM 2073 to C13',
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
    if (standard === 'nema_us') {
      return {
        partNumber: 'MA-PWR-CORD-US',
        qtyMultiplier,
        description: 'Meraki AC Power Cord for US/NEMA 5-15P',
        category: 'power_cord',
      };
    }
    if (standard === 'argentina_iram') {
      return {
        partNumber: 'MA-PWR-CORD-AR',
        qtyMultiplier,
        description: 'Meraki AC Power Cord for Argentina (IRAM)',
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

  // 4. Estándar General Cisco (Catalyst 9200/9200L, MS130-SWITCHES, C8200/8300, Firepower, UCS, Nexus, IE, Collab)
  if (standard === 'rack_pdu') {
    if (family === 'catalyst9200') {
      return {
        partNumber: 'CAB-C15-CBN',
        qtyMultiplier,
        description: 'Cabinet Jumper Power Cord, 250 VAC 13A, C14-C15 Connectors (Rack PDU)',
        category: 'power_cord',
      };
    }
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
  if (standard === 'nema_us') {
    return {
      partNumber: 'CAB-AC',
      qtyMultiplier,
      description: 'AC Power Cord (North America NEMA 5-15P), 125V 10A, 2.5m',
      category: 'power_cord',
    };
  }
  if (standard === 'argentina_iram') {
    return {
      partNumber: 'CAB-ACR',
      qtyMultiplier,
      description: 'AC Power Cord (Argentina IRAM 2073), 10A, 250V, 2.5m',
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
    'C9200-24P-E': `${sntPrefix}-C920024P`,
    'C9200-24P-A': `${sntPrefix}-C920024A`,
    'C9200-48P-E': `${sntPrefix}-C920048P`,
    'C9200-48P-A': `${sntPrefix}-C920048A`,
    'C9200-24T-E': `${sntPrefix}-C920024T`,
    'C9200-48T-E': `${sntPrefix}-C920048T`,
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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Catalyst ${prefix} ${ports}P ${poeType === 'T' ? 'Data' : 'PoE+'} Ensamble Oficial CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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

      // Si es un chasis Catalyst 9200 Modular (ej. C9200-24P-E, C9200-48P-E), agregar módulo de uplink oficial (C9200-NM-4X o C9200-NM-4G)
      if (isModular9200) {
        const use1G = opts.uplinkType === '1G';
        items.push({
          partNumber: use1G ? 'C9200-NM-4G' : 'C9200-NM-4X',
          qtyMultiplier: 1,
          description: use1G
            ? 'Catalyst 9200 4 x 1G Network Module'
            : 'Catalyst 9200 4 x 10G Network Module',
          category: 'uplink_module',
        });
      }

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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Catalyst ${prefix} ${ports}P Ensamble Modular Oficial CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Catalyst ${series} Ensamble Industrial Rugged CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Nexus 9000 (${parentSku}) Ensamble Data Center CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Secure Firewall (${baseModel}) Ensamble NGFW CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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
    isGoldenTemplate: true,
    goldenTemplateName: 'Cisco Meraki MS130 Contenedor Cloud Switch CCW',
    goldenTemplateSource: 'Cisco CCW / Netformx',
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
    isGoldenTemplate: true,
    goldenTemplateName: `Cisco Meraki ${modelBase} Cloud Switch CCW`,
    goldenTemplateSource: 'Cisco CCW / Netformx',
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

  // 0. Búsqueda prioritaria en la Biblioteca de Golden Templates Oficiales (Cisco CCW & Netformx)
  const golden = findGoldenTemplate(cleanSku);
  if (golden) {
    return goldenTemplateToChassisRule(golden);
  }

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
      isGoldenTemplate: true,
      goldenTemplateName: `Cisco ${cleanSku.startsWith('C1300-') ? 'Catalyst 1300' : 'Catalyst 1200'} Smart Switch Ensamble CCW`,
      goldenTemplateSource: 'Cisco CCW / Netformx',
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
 * Estimador referencial de Precio Lista GPL (USD) calibrado con Cisco Commerce Workspace (CCW) 2026
 */
export function estimateReferencePriceUsd(partNumber: string, isParent: boolean): number {
  const clean = (partNumber || '').trim().toUpperCase();
  if (!clean || clean === 'MS130-SWITCHES') return 0; // Contenedor lógico $0 en CCW (el precio va en el hijo MS130-xx)

  // Cables de poder ($0 incluidos en configuración de chasis CCW)
  if (clean.startsWith('CAB-') || clean.startsWith('MA-PWR-CORD')) return 0;
  // Network Stack y cables internos de stack incluidos en kit ($0 en CCW)
  if (clean.includes('-NW-') || clean === 'STACK-T4-50CM' || clean === 'STACK-T1-50CM') return 0;
  // Contenedores padres de suscripción DNA sin sufijo de años ($0 en CCW)
  if (/^C9[23]00L?-DNA-[EA]-(?:24|48)$/i.test(clean)) return 0;

  // Catálogo oficial referencial GPL CCW 2026 (USD)
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
    // Catalyst 9200 Modular (Calibrado con Estimate Oficial CCW MF168965528OJ)
    'C9200-24P-E': 5041.72,
    'C9200-24P-A': 6450.0,
    'C9200-48P-E': 8650.0,
    'C9200-48P-A': 10490.0,
    'C9200-24T-E': 3890.0,
    'C9200-48T-E': 6490.0,
    'C9200-NM-4X': 2557.27,
    'C9200-NM-4G': 715.0,
    'C9200-STACK-KIT': 1636.65,
    'C9200L-STACK-KIT': 1195.0,
    'CON-SNT-C920024P': 1501.5,
    'C9200-DNA-E-24-3Y': 1068.93,
    'C9200L-DNA-E-24-3Y': 1068.93,
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
    'C9300-NM-8X': 2850,
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
    // Catalyst 1200 / 1300 SMB & Core 9500 & Adicionales
    'C1200-24T-4G': 695,
    'C1200-24P-4G': 1150,
    'C1200-48T-4G': 1290,
    'C1200-48P-4G': 2190,
    'C1300-24T-4G': 990,
    'C1300-24P-4G': 1590,
    'C1300-24P-4X': 1995,
    'C1300-48T-4G': 1790,
    'C1300-48P-4G': 2890,
    'C1300-48P-4X': 3490,
    'C9300L-48PF-4X-E': 8950,
    'C9300-24T-E': 4650,
    'C9300-48T-E': 7850,
    'C9300L-24T-4X-E': 3950,
    'C9300L-48T-4X-E': 6750,
    'C9500-24Y4C-A': 19800,
    'C9500-24Y4C-E': 15900,
    'CW9162I-MR': 1095,
    'CW9166I-MR': 1995,
    'MR56-HW': 1895,
    'MX75-HW': 1695,
    'MX95-HW': 4495,
    'FPR1140-NGFW-K9': 4495,
    'FPR1220T-K9': 3290,
    'FPR3120-NGFW-K9': 14500,
    'C8300-1N1S-6T': 5450,
    'IE-3300-8T2S-A': 3450,
    'IE-3300-8P2S-A': 4150,
    'MS225-24-HW': 2990,
    'MS225-48-HW': 4690,
    // Sub-componentes Servidores UCS M7 / Nexus / Colaboración
    'UCS-CPU-I4410Y': 1150,
    'UCS-MRX32G1RE1': 420,
    'UCSC-RAID-M7': 690,
    'UCS-HD12TB10K12N': 380,
    'UCSC-PSU1-1050W': 390,
    'UCSC-RAIL-M7': 165,
    'DC-MGT-SAAS-EST-3Y': 540,
    'C1E1TN9300XF-3Y': 3450,
    'C1A1TN9300XF-3Y': 5850,
    'NXA-PAC-650W-PE': 0,
    'NXA-FAN-35CFM-PE': 0,
    'A-FLEX-3': 162,
    'L-WBX-DEV-ROOM': 720,
  };

  if (refPrices[clean] !== undefined) return refPrices[clean];

  // En configuraciones de chasis Catalyst 9200/9300, la fuente de poder primaria incluida sin "=" cuesta $0.00 en CCW
  if (/^PWR-C[156]-/i.test(clean) && !clean.endsWith('=')) return 0;

  // Estimación por familia de sub-componentes
  if (clean.startsWith('LIC-MS130-48')) return 1150;
  if (clean.startsWith('LIC-MS130-24')) return 690;
  if (clean.startsWith('LIC-MS130-CMPT')) return 320;
  if (clean.startsWith('LIC-MS225-48FP')) return 1690;
  if (clean.startsWith('LIC-MS225-48')) return 1350;
  if (clean.startsWith('LIC-MS225-24')) return 890;
  if (clean.startsWith('LIC-MR-') || clean.startsWith('LIC-ENT-')) return 450;
  if (clean.startsWith('LIC-MX')) return 1450;
  if (clean.includes('-DNA-E-24')) return 1068.93;
  if (clean.includes('-DNA-E-48')) return 1850;
  if (clean.includes('-DNA-A-24')) return 2150;
  if (clean.includes('-DNA-A-48')) return 3950;
  if (clean.startsWith('IE3') && clean.includes('-DNA-')) return 890;
  if (clean.startsWith('DNA-C-T0')) return 1250;
  if (clean.startsWith('L-FPR')) return 1650;
  if (clean.startsWith('CON-SNT')) return 1150;
  if (clean.startsWith('PWR-')) return 450;
  if (clean.includes('STACK')) return 1195;
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

// ============================================================================
// 4. MOTOR DE MÍNIMO 3 PROPUESTAS HOMOLOGADAS CON VALOR GPL (SIN DESCUENTO)
//    Y ORDENAMIENTO INTELIGENTE POR PRIORIDAD (% HOMOLOGACIÓN + MEJOR DESCUENTO)
// ============================================================================

/**
 * Descuentos referenciales Fast Track / Deal Reg CCW 2026 por SKU cuando no hay Excel Fast Track cargado
 */
const REFERENCE_FASTTRACK_DISCOUNTS_2026: Record<
  string,
  { discountPct: number; isFastTrack: boolean; promoLabel: string }
> = {
  'C9200L-24P-4G-E': { discountPct: 49.5, isFastTrack: true, promoLabel: '⚡ Fast Track Top Seller' },
  'C9200L-24P-4X-E': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track 10G' },
  'C9200L-24T-4G-E': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Data' },
  'C9200L-24T-4X-E': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track 10G' },
  'C9200L-48P-4G-E': { discountPct: 49.0, isFastTrack: true, promoLabel: '⚡ Fast Track 48P' },
  'C9200L-48P-4X-E': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track 48P 10G' },
  'C9200L-48FP-4G-E': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Full PoE 740W' },
  'C9200L-48FP-4X-E': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track Full PoE 10G' },
  'C9200L-48T-4G-E': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track 48T' },
  'C9200-24P-E': { discountPct: 45.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Modular' },
  'C9200-48P-E': { discountPct: 45.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Modular' },
  'C9200-24T-E': { discountPct: 44.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Modular' },
  'C9200-48T-E': { discountPct: 44.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Modular' },
  'C9300L-24P-4X-E': { discountPct: 49.0, isFastTrack: true, promoLabel: '⚡ Fast Track Core/Access' },
  'C9300L-48P-4X-E': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Core/Access' },
  'C9300L-48PF-4X-E': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track Full PoE' },
  'C9300-24P-E': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track Enterprise' },
  'C9300-48P-E': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track Enterprise' },
  'C1300-24P-4G': { discountPct: 51.0, isFastTrack: true, promoLabel: '⚡ Fast Track SMB' },
  'C1300-24P-4X': { discountPct: 50.0, isFastTrack: true, promoLabel: '⚡ Fast Track SMB 10G' },
  'C1300-48P-4G': { discountPct: 50.5, isFastTrack: true, promoLabel: '⚡ Fast Track SMB 48P' },
  'C1300-48P-4X': { discountPct: 49.5, isFastTrack: true, promoLabel: '⚡ Fast Track SMB 10G' },
  'C1200-24P-4G': { discountPct: 52.0, isFastTrack: true, promoLabel: '⚡ Fast Track Entry' },
  'C1200-48P-4G': { discountPct: 51.5, isFastTrack: true, promoLabel: '⚡ Fast Track Entry' },
  'MS130-SWITCHES:MS130-24P': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki Cloud' },
  'MS130-SWITCHES:MS130-48P': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki Cloud' },
  'MS130-SWITCHES:MS130-24': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki Cloud' },
  'MS130-SWITCHES:MS130-48': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki Cloud' },
  'MS130-SWITCHES:MS130-8P': { discountPct: 49.0, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki Compact' },
  'MS225-24P-HW': { discountPct: 46.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Cloud Stack' },
  'MS225-48LP-HW': { discountPct: 46.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Cloud Stack' },
  'MS225-48FP-HW': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track 740W Cloud' },
  'MR36-HW': { discountPct: 50.0, isFastTrack: true, promoLabel: '⚡ Fast Track Wi-Fi 6' },
  'MR46-HW': { discountPct: 49.5, isFastTrack: true, promoLabel: '⚡ Fast Track Wi-Fi 6' },
  'CW9162I-MR': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track Wi-Fi 6E' },
  'CW9164I-MR': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Wi-Fi 6E' },
  'CW9166I-MR': { discountPct: 46.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Wi-Fi 6E' },
  'C8200L-1N-4T': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track SD-WAN' },
  'C8200-1N-4T': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track SD-WAN' },
  'C8300-1N1S-4T2X': { discountPct: 45.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg WAN Core' },
  'FPR1010-NGFW-K9': { discountPct: 49.5, isFastTrack: true, promoLabel: '⚡ Fast Track Security' },
  'FPR1120-NGFW-K9': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Security' },
  'FPR1210T-K9': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Promo Serie 1200' },
  'FPR1220T-K9': { discountPct: 46.5, isFastTrack: true, promoLabel: '⚡ Promo Serie 1200' },
  'FPR3110-NGFW-K9': { discountPct: 45.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Enterprise FW' },
  'MX67-HW': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki MX' },
  'MX68-HW': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track Meraki MX PoE' },
  'MX85-HW': { discountPct: 46.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Meraki SD-WAN' },
  'IE-3100-8T2C-E': { discountPct: 47.5, isFastTrack: true, promoLabel: '⚡ Fast Track Industrial' },
  'IE-3300-8T2S-E': { discountPct: 46.5, isFastTrack: true, promoLabel: '⚡ Fast Track Industrial' },
  'IE-3300-8P2S-E': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track Industrial PoE' },
  'IE-3400-8P2S-E': { discountPct: 45.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Heavy Duty' },
  'UCSC-C220-M7S': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Compute M7' },
  'UCSC-C240-M7S': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track Compute 2U' },
  'N9K-C93180YC-FX3': { discountPct: 46.5, isFastTrack: true, promoLabel: '⚡ Fast Track Data Center' },
  'N9K-C93108TC-FX3P': { discountPct: 45.5, isFastTrack: false, promoLabel: '🏷️ Deal Reg Data Center' },
  'DP-9841-K9': { discountPct: 48.5, isFastTrack: true, promoLabel: '⚡ Fast Track Collab 9800' },
  'DP-9851-K9': { discountPct: 48.0, isFastTrack: true, promoLabel: '⚡ Fast Track Collab 9800' },
  'DP-9861-K9': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track Collab Wi-Fi' },
  'DP-9871-K9': { discountPct: 46.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Collab Touch' },
  'CS-BAR-T-C-K9': { discountPct: 47.0, isFastTrack: true, promoLabel: '⚡ Fast Track Room Bar' },
  'CS-BARPRO-C-K9': { discountPct: 46.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Room Bar Pro' },
  'CS-BRD55P-G2-K9': { discountPct: 45.0, isFastTrack: false, promoLabel: '🏷️ Deal Reg Board Pro G2' },
};

/**
 * Calcula de forma determinista el Valor GPL (Sin Descuentos) del Chasis y de la Solución Madre-Hijo completa
 * para cualquier SKU candidato dentro del motor de propuestas homologadas.
 */
export function computeProposalSolutionGpl(
  recommendedSku: string,
  options: {
    quantity?: number;
    licenseTier?: 'Essentials' | 'Advantage';
    termYears?: number;
    powerCordStandard?: PowerCordStandard;
    includeStacking?: boolean;
    includeRedundantPsu?: boolean;
    includeSmartNet?: boolean;
    smartNetLevel?: '8x5xNBD' | '24x7x4';
    merakiLicenseMode?: 'coterm' | 'subscription';
  } = {}
): {
  unitChassisGplUsd: number;
  unitSolutionGplUsd: number;
  totalSolutionGplUsd: number;
  subItemsBreakdown: HomologatedProposalSubItem[];
} {
  const qty = options.quantity && options.quantity > 0 ? options.quantity : 1;
  const cleanSku = recommendedSku.trim().toUpperCase();
  const containerChildModel = cleanSku.includes(':') ? cleanSku.split(':')[1] : undefined;
  const rule = resolveChassisRule(cleanSku);

  const chassisLookupSku = containerChildModel || (rule ? rule.parentSku : cleanSku);
  const unitChassisGplUsd = estimateReferencePriceUsd(chassisLookupSku, true);

  let rawSubItems: SubItemConfig[] = [];
  if (rule) {
    rawSubItems = rule.defaultSubItems({
      licenseTier: options.licenseTier || 'Essentials',
      termYears: options.termYears || 3,
      isPoe: !cleanSku.includes('24T') && !cleanSku.includes('48T') && !cleanSku.includes('8T'),
      includeStackingKit: options.includeStacking,
      includeRedundantPsu: options.includeRedundantPsu,
      includeSmartNet: options.includeSmartNet,
      smartNetLevel: options.smartNetLevel || '8x5xNBD',
      powerCordStandard: options.powerCordStandard || 'italy_chile',
      merakiLicenseMode: options.merakiLicenseMode || 'subscription',
      selectedModel: containerChildModel,
    });
  } else {
    const merakiLic = resolveMerakiSubLicense(cleanSku, {
      licenseTier: options.licenseTier || 'Essentials',
      termYears: options.termYears || 3,
      merakiLicenseMode: options.merakiLicenseMode || 'subscription',
    });
    if (merakiLic) rawSubItems.push(merakiLic);
    if (options.includeSmartNet) {
      const snt = resolveSmartNetSubItem(cleanSku, {
        licenseTier: options.licenseTier || 'Essentials',
        termYears: options.termYears || 3,
        includeSmartNet: true,
        smartNetLevel: options.smartNetLevel || '8x5xNBD',
      });
      if (snt) rawSubItems.push(snt);
    }
  }

  const subItemsBreakdown: HomologatedProposalSubItem[] = rawSubItems.map((sub) => {
    const subQtyPerParent = sub.qtyMultiplier > 0 ? sub.qtyMultiplier : 1;
    const totalSubQty = subQtyPerParent * qty;
    const unitGpl = estimateReferencePriceUsd(sub.partNumber, false);
    return {
      partNumber: sub.partNumber,
      qty: totalSubQty,
      unitGplUsd: unitGpl,
      totalGplUsd: Number((unitGpl * totalSubQty).toFixed(2)),
      description: sub.description,
      durationMonths: sub.durationMonths,
    };
  });

  // En MS130-SWITCHES:MS130-xx el contenedor padre vale $0 y el switch físico ya viene como Hijo 1.1 en subItemsBreakdown
  const isContainerWithHardwareChild = Boolean(containerChildModel);
  const childrenUnitGplSum = rawSubItems.reduce((acc, sub) => {
    const mult = sub.qtyMultiplier > 0 ? sub.qtyMultiplier : 1;
    return acc + estimateReferencePriceUsd(sub.partNumber, false) * mult;
  }, 0);

  const unitSolutionGplUsd = Number(
    ((isContainerWithHardwareChild ? 0 : unitChassisGplUsd) + childrenUnitGplSum).toFixed(2)
  );
  const totalSolutionGplUsd = Number((unitSolutionGplUsd * qty).toFixed(2));

  return {
    unitChassisGplUsd: Number(unitChassisGplUsd.toFixed(2)),
    unitSolutionGplUsd,
    totalSolutionGplUsd,
    subItemsBreakdown,
  };
}

/**
 * Ordena las propuestas homologadas según el modo de prioridad seleccionado:
 * - 'optimal_priority' | 'priority_optimal': Prioriza Mayor % de Compatibilidad/Homologación + Mejor % Descuento / Fast Track
 * - 'compatibility_desc' | 'highest_compatibility': Mayor % de Homologación primero (100% -> menor), desempatando por mejor descuento
 * - 'discount_desc' | 'best_discount': Mayor % de Descuento primero, desempatando por mayor % de homologación
 * - 'gpl_asc' | 'lowest_gpl': Menor Valor GPL (Sin Descuento) primero
 */
export function sortHomologatedProposals(
  proposals: HomologatedProposal[],
  sortMode: ProposalPrioritySortMode = 'optimal_priority'
): HomologatedProposal[] {
  const copy = [...proposals];
  copy.sort((a, b) => {
    const aCompat = Number(a.compatibilityPct) || 0;
    const bCompat = Number(b.compatibilityPct) || 0;
    const aDisc = Number(a.bestDiscountPct ?? a.estimatedDiscountPct) || 0;
    const bDisc = Number(b.bestDiscountPct ?? b.estimatedDiscountPct) || 0;
    const aGpl = Number(a.totalSolutionGplUsd) || 0;
    const bGpl = Number(b.totalSolutionGplUsd) || 0;
    const aScore = Number(a.priorityScore) || 0;
    const bScore = Number(b.priorityScore) || 0;

    if (sortMode === 'compatibility_desc' || sortMode === 'highest_compatibility') {
      if (bCompat !== aCompat) {
        return bCompat - aCompat;
      }
      return bDisc - aDisc;
    }
    if (sortMode === 'discount_desc' || sortMode === 'best_discount') {
      if (bDisc !== aDisc) {
        return bDisc - aDisc;
      }
      return bCompat - aCompat;
    }
    if (sortMode === 'gpl_asc' || sortMode === 'lowest_gpl') {
      if (aGpl !== bGpl) {
        return aGpl - bGpl;
      }
      return bCompat - aCompat;
    }
    // Default 'optimal_priority' | 'priority_optimal': combina % de Homologación y % de Descuento
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    return bCompat - aCompat;
  });

  return copy.map((p, idx) => ({
    ...p,
    priorityRank: idx + 1,
  }));
}

/**
 * Genera SIEMPRE al menos 3 propuestas homologadas (idealmente con 100% de homologación técnica)
 * para cualquier equipo solicitado (esté en EOL, corregido por tipeo o vigente 2026),
 * calculando el Valor GPL (sin descuentos) del Chasis y de la Solución Madre-Hijo completa,
 * el % de compatibilidad/homologación y el % de descuento para ordenarlas por prioridad.
 */
export function generateHomologatedProposalsForItem(
  params: {
    rawMentionedSku?: string;
    suggestedActiveSku?: string;
    deviceType?: string;
    ports?: number;
    isPoe?: boolean;
    poeBudget?: 'standard' | 'full_poe';
    uplinkType?: string;
    licenseTier?: 'Essentials' | 'Advantage';
    termYears?: number;
    quantity?: number;
    includeStacking?: boolean;
    includeRedundantPsu?: boolean;
    includeSmartNet?: boolean;
    smartNetLevel?: '8x5xNBD' | '24x7x4';
    powerCordStandard?: PowerCordStandard;
    merakiLicenseMode?: 'coterm' | 'subscription';
    fastTrackDiscountMap?: Record<string, number>;
    sortMode?: ProposalPrioritySortMode;
  },
  sortMode?: ProposalPrioritySortMode
): HomologatedProposal[] {
  const effectiveSortMode: ProposalPrioritySortMode =
    sortMode || params.sortMode || 'optimal_priority';
  const rawSku = (params.rawMentionedSku || '').trim().toUpperCase();
  const activeSku = (params.suggestedActiveSku || '').trim().toUpperCase();
  const primaryRefSku = rawSku || activeSku || 'C9200L-24P-4G-E';
  const tier = params.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
  const tierCode = tier === 'Advantage' ? 'A' : 'E';
  const years = params.termYears && params.termYears > 0 ? params.termYears : 3;
  const qty = params.quantity && params.quantity > 0 ? params.quantity : 1;
  const cordLabel =
    params.powerCordStandard === 'rack_pdu'
      ? 'Cable PDU Rack'
      : params.powerCordStandard === 'schuko_eu'
        ? 'Cable Schuko EU'
        : params.powerCordStandard === 'nema_us'
          ? 'Cable NEMA USA'
          : 'Cable Norma Chile CAB-IT';

  const combinedSku = `${rawSku} ${activeSku}`;
  const is48 = params.ports === 48 || /48(?:P|FP|LP|T|X|U|Y)/i.test(combinedSku);
  const is8 = params.ports === 8 || /(?:-8|08)(?:P|FP|LP|T|X)/i.test(combinedSku);
  const isNoPoe =
    params.isPoe === false || /-(?:24|48|8|16)T\b|MS(?:120|130|210|225)-(?:24|48|8)$/i.test(combinedSku);
  const isFullPoe =
    params.poeBudget === 'full_poe' || /48FP|48PF|48FPD|740W/i.test(combinedSku);
  const is10G =
    params.uplinkType === '10G' ||
    params.uplinkType === 'SFP+' ||
    /4X|8X|10G|PD-L|FPD-L|TD-L|24X|48X/i.test(combinedSku);

  const portNum = is48 ? 48 : is8 ? 8 : 24;

  interface CandidateSeed {
    sku: string;
    title: string;
    description: string;
    type: 'direct_equivalent' | 'cost_effective' | 'catalyst_alternative';
    compatibilityPct: number;
    homologationLabel: string;
    matchedSpecs: string[];
    customDiscountPct?: number;
  }

  const seeds: CandidateSeed[] = [];

  // 1. Evaluar por familia de producto para generar al menos 3 propuestas idealmente 100% homologadas
  if (
    params.deviceType === 'industrial_switch' ||
    primaryRefSku.startsWith('IE-')
  ) {
    const iePoe = !isNoPoe;
    seeds.push(
      {
        sku: iePoe ? `IE-3300-8P2S-${tierCode}` : `IE-3300-8T2S-${tierCode}`,
        title: `Propuesta Modular Industrial: Catalyst ${iePoe ? 'IE-3300-8P2S' : 'IE-3300-8T2S'} (Riel DIN)`,
        description: `Switch Industrial Rugged de riel DIN con 8 puertos GE ${iePoe ? 'PoE+ (hasta 240W)' : 'Data'} + 2x SFP 1G, expandible con módulos.`,
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Estándar Industrial Minería/Planta',
        matchedSpecs: [
          `8 Puertos ${iePoe ? 'PoE+ Industrial' : 'GE Rugged'}`,
          '2x Uplinks SFP Fibra',
          `Fuente Riel DIN + ${cordLabel}`,
          `DNA ${tier} ${years * 12}M`,
        ],
      },
      {
        sku: iePoe ? 'IE-3400-8P2S-E' : 'IE-3400-8T2S-E',
        title: `Propuesta Heavy-Duty Avanzada: Catalyst ${iePoe ? 'IE-3400-8P2S-E' : 'IE-3400-8T2S-E'}`,
        description: 'Switch Industrial de alto rendimiento con soporte de ciberseguridad TrustSec, telemetría avanzada y mayor buffer.',
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Superioridad Técnica IE3400',
        matchedSpecs: [
          `8 Puertos ${iePoe ? 'Full PoE+' : 'GE Industrial'}`,
          '2x SFP + Módulos Expansión',
          'Soporte Ambientes Extremos (-40°C a +75°C)',
          `DNA ${tier} ${years * 12}M`,
        ],
      },
      {
        sku: 'IE-3100-8T2C-E',
        title: 'Propuesta Compacta Costo-Efectiva: Catalyst IE-3100-8T2C-E',
        description: 'Switch Industrial DIN-Rail ultracompacto de última generación con 8 puertos GE + 2 puertos Combo Dual-Purpose.',
        type: 'cost_effective',
        compatibilityPct: iePoe ? 94 : 100,
        homologationLabel: iePoe
          ? '94% Homologado • Alternativa Industrial Data (Sin PoE)'
          : '100% Homologado • Reemplazo Directo Compacto',
        matchedSpecs: [
          '8 Puertos GE + 2x Combo SFP/RJ45',
          'Diseño Riel DIN Ultra-Compacto',
          `Fuente AC/DC + ${cordLabel}`,
          `DNA Essentials ${years * 12}M`,
        ],
      }
    );
  } else if (
    params.deviceType === 'server_ucs' ||
    primaryRefSku.startsWith('UCSC-') ||
    primaryRefSku.startsWith('UCSX-')
  ) {
    seeds.push(
      {
        sku: 'UCSC-C220-M7S',
        title: 'Propuesta Rack 1U Optimizada: Cisco UCS C220 M7 SFF (DDR5)',
        description: 'Servidor 1U Intel Xeon Scalable 4ta/5ta Gen, 64GB DDR5, Controladora RAID M7, 2x 1.2TB SAS, 2x PSU 1050W e Intersight.',
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Reemplazo Oficial Directo M7 (1U)',
        matchedSpecs: [
          'Chasis 1U SFF + Rieles M7',
          'Xeon 4410Y + 64GB DDR5-4800',
          '2x Discos 1.2TB SAS RAID + 2x PSU 1050W',
          `Intersight SaaS ${years * 12}M + ${cordLabel}`,
        ],
      },
      {
        sku: 'UCSC-C240-M7S',
        title: 'Propuesta Rack 2U Alta Capacidad: Cisco UCS C240 M7 SFF',
        description: 'Servidor 2U con alta capacidad de bahías de almacenamiento SFF, ranuras PCIe 5.0 adicionales y redundancia total.',
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Expansión Superior Storage/GPU (2U)',
        matchedSpecs: [
          'Chasis 2U Alta Densidad Discos',
          'Xeon Scalable + 64GB DDR5 Expandible',
          'RAID Hardware M7 + 2x PSU 1050W',
          `Intersight SaaS ${years * 12}M + ${cordLabel}`,
        ],
      },
      {
        sku: 'UCSC-C220-M7S',
        title: 'Propuesta Virtualización Enterprise: UCS C220 M7 + Soporte SmartNet 24x7',
        description: 'Arquitectura 1U UCS C220 M7 configurada para clústeres de virtualización crítica con Intersight y alta disponibilidad.',
        type: 'cost_effective',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Configuración Clúster HA',
        matchedSpecs: [
          'Homologación 100% Compute & Memoria',
          'Doble Fuente Titanium 1050W',
          'Gestión Cloud Cisco Intersight',
          'Compatible VMware / Hyper-V / Nutanix',
        ],
        customDiscountPct: 49.0,
      }
    );
  } else if (
    params.deviceType === 'nexus_dc' ||
    primaryRefSku.startsWith('N9K-')
  ) {
    seeds.push(
      {
        sku: 'N9K-C93180YC-FX3',
        title: 'Propuesta Data Center Fibra SFP28: Nexus N9K-C93180YC-FX3',
        description: 'Switch ToR/ Spine Nexus 9300 con 48 puertos 1/10/25G SFP28 + 6 puertos 40/100G QSFP28, doble fuente y ventilación redundante.',
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Reemplazo Oficial EX/FX a FX3',
        matchedSpecs: [
          '48x 1/10/25G SFP28 Fibra',
          '6x Uplinks 40/100G QSFP28',
          '2x PSU 650W + 4x Fans Redundantes',
          `Licencia DCN ${tier} ${years * 12}M`,
        ],
      },
      {
        sku: 'N9K-C93108TC-FX3P',
        title: 'Propuesta Data Center 10GBASE-T Cobre: Nexus N9K-C93108TC-FX3P',
        description: 'Switch Nexus 9300 con 48 puertos 100M/1G/10GBASE-T RJ45 + 6 puertos 40/100G QSFP28 para servidores en cobre.',
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Equivalente 10G Cobre + 100G Fibra',
        matchedSpecs: [
          '48x 10GBASE-T RJ45 + 6x 100G QSFP28',
          'Redundancia Total Fuentes y Ventiladores',
          `Licencia DCN ${tier} ${years * 12}M`,
          cordLabel,
        ],
      },
      {
        sku: `C9500-24Y4C-${tierCode}`,
        title: `Propuesta Core Enterprise Fibra: Catalyst C9500-24Y4C-${tierCode}`,
        description: 'Switch Core Catalyst 9500 de 24 puertos 1/10/25G SFP28 + 4 puertos 40/100G QSFP28 con StackWise Virtual.',
        type: 'cost_effective',
        compatibilityPct: 97,
        homologationLabel: '97% Homologado • Alternativa Core Catalyst 25G/100G',
        matchedSpecs: [
          '24x 10/25G SFP28 + 4x 100G QSFP28',
          'StackWise Virtual Alta Disponibilidad',
          `Cisco DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      }
    );
  } else if (
    params.deviceType === 'firewall' ||
    primaryRefSku.startsWith('FPR') ||
    primaryRefSku.startsWith('ASA') ||
    primaryRefSku.startsWith('MX')
  ) {
    const isMerakiMx = primaryRefSku.startsWith('MX');
    const isHighEndFw = /2110|2120|3110|3120|5516|5525|MX84|MX85|MX95/i.test(primaryRefSku);
    if (isMerakiMx) {
      seeds.push(
        {
          sku: isHighEndFw ? 'MX85-HW' : primaryRefSku.includes('65') || primaryRefSku.includes('68') ? 'MX68-HW' : 'MX67-HW',
          title: `Propuesta Reemplazo Directo Meraki SD-WAN: ${isHighEndFw ? 'MX85-HW' : primaryRefSku.includes('65') || primaryRefSku.includes('68') ? 'MX68-HW' : 'MX67-HW'}`,
          description: 'Appliance de Seguridad y SD-WAN 100% administrado en la nube Meraki con Auto-VPN, IPS Snort 3 y AMP.',
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Reemplazo Directo Meraki MX',
          matchedSpecs: [
            '100% Compatible Dashboard Meraki',
            'Auto-VPN SD-WAN + Firewall L7',
            `Licencia Meraki ${years * 12}M Incluida`,
            cordLabel,
          ],
        },
        {
          sku: isHighEndFw ? 'MX95-HW' : 'MX75-HW',
          title: `Propuesta Alto Rendimiento Cloud: Meraki ${isHighEndFw ? 'MX95-HW' : 'MX75-HW'}`,
          description: 'Mayor throughput de inspección TLS/IPS, puertos WAN en fibra SFP/SFP+ y alta densidad de túneles VPN.',
          type: 'catalyst_alternative',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Mayor Throughput WAN/VPN',
          matchedSpecs: [
            'Puertos WAN Dedicados Fibra/RJ45',
            'Doble capacidad de usuarios concurrentes',
            `Licencia Meraki ${years * 12}M`,
            cordLabel,
          ],
        },
        {
          sku: isHighEndFw ? 'FPR1220T-K9' : 'FPR1010-NGFW-K9',
          title: `Propuesta Cisco Secure Firewall NGFW: ${isHighEndFw ? 'FPR1220T-K9' : 'FPR1010-NGFW-K9'}`,
          description: 'Appliance Cisco Secure Firewall Threat Defense con licencia Threat, Malware & URL Filtering (TMC).',
          type: 'cost_effective',
          compatibilityPct: 98,
          homologationLabel: '98% Homologado • Equivalente Cisco Secure Firewall FTD',
          matchedSpecs: [
            'Inspección Profunda NGFW Snort 3',
            `Suscripción TMC (IPS+AMP+URL) ${years * 12}M`,
            'Puertos RJ45 / PoE Integrados',
            cordLabel,
          ],
        }
      );
    } else {
      seeds.push(
        {
          sku: isHighEndFw ? 'FPR3110-NGFW-K9' : primaryRefSku.includes('5508') || primaryRefSku.includes('1120') ? 'FPR1120-NGFW-K9' : 'FPR1010-NGFW-K9',
          title: `Propuesta Oficial Directa NGFW: ${isHighEndFw ? 'FPR3110-NGFW-K9' : primaryRefSku.includes('5508') || primaryRefSku.includes('1120') ? 'FPR1120-NGFW-K9' : 'FPR1010-NGFW-K9'}`,
          description: 'Reemplazo directo Cisco Secure Firewall con suscripción Threat Defense IPS, Malware (AMP) y URL Filtering.',
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Reemplazo Oficial Directo NGFW',
          matchedSpecs: [
            '100% Homologado para Migración ASA/FPR',
            `Licencia TMC (IPS+Malware+URL) ${years * 12}M`,
            'Soporta FTD o imagen ASA',
            cordLabel,
          ],
        },
        {
          sku: isHighEndFw ? 'FPR3120-NGFW-K9' : 'FPR1210T-K9',
          title: `Propuesta Nueva Generación AI/Hardware: ${isHighEndFw ? 'FPR3120-NGFW-K9' : 'FPR1210T-K9 (Serie 1200)'}`,
          description: 'Nueva arquitectura Cisco Secure Firewall con aceleración criptográfica por hardware para inspección TLS 1.3.',
          type: 'catalyst_alternative',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Nueva Generación Alto Desempeño',
          matchedSpecs: [
            'Mayor Throughput IPS + Cifrado TLS',
            'Puertos 1G/10G SFP+ Integrados',
            `Licencia TMC ${years * 12}M`,
            cordLabel,
          ],
        },
        {
          sku: isHighEndFw ? 'MX85-HW' : 'MX68-HW',
          title: `Propuesta Cloud SD-WAN Unificada: Meraki ${isHighEndFw ? 'MX85-HW' : 'MX68-HW'}`,
          description: 'Firewall L7 y SD-WAN gestionado 100% desde la nube Meraki con despliegue Zero-Touch y soporte 24x7 incluido.',
          type: 'cost_effective',
          compatibilityPct: 97,
          homologationLabel: '97% Homologado • Alternativa Cloud SD-WAN Meraki',
          matchedSpecs: [
            'Gestión Cloud Zero-Touch',
            'Soporte 24x7 Cisco Meraki Incluido',
            `Licencia Seguridad ${years * 12}M`,
            cordLabel,
          ],
        }
      );
    }
  } else if (
    params.deviceType === 'router' ||
    primaryRefSku.startsWith('ISR') ||
    primaryRefSku.startsWith('C8') ||
    primaryRefSku.startsWith('C11')
  ) {
    seeds.push(
      {
        sku: 'C8200-1N-4T',
        title: 'Propuesta Oficial Directa WAN/SD-WAN: Catalyst C8200-1N-4T',
        description: 'Router Edge Catalyst 8200 (1RU) con 4 puertos WAN 1G (RJ45/SFP), 1 ranura NIM modular y suscripción Cisco DNA.',
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Reemplazo Oficial ISR4331 / WAN',
        matchedSpecs: [
          '4x Puertos WAN 1G (2x RJ45 + 2x SFP)',
          '1x Ranura Modular NIM',
          `Licencia DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      },
      {
        sku: 'C8200L-1N-4T',
        title: 'Propuesta Optimizada Fast Track: Catalyst C8200L-1N-4T',
        description: 'Router Edge Catalyst 8200L para sucursales con 4 puertos WAN 1G, ranura NIM y excelente relación costo-beneficio.',
        type: 'cost_effective',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Mejor Descuento Fast Track',
        matchedSpecs: [
          '4x Puertos WAN 1G + 1x Ranura NIM',
          '100% Compatible IOS-XE / SD-WAN',
          `Licencia DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      },
      {
        sku: 'C8300-1N1S-4T2X',
        title: 'Propuesta Alta Capacidad 10G: Catalyst C8300-1N1S-4T2X',
        description: 'Router Edge Catalyst 8300 con 2 puertos 10G SFP+ + 4 puertos 1G, ranura NIM + Service Module (SM) y doble fuente.',
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Superioridad WAN 10G + Redundancia',
        matchedSpecs: [
          '2x 10G SFP+ + 4x 1G WAN',
          '1x NIM + 1x Service Module (SM)',
          `Licencia DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      }
    );
  } else if (
    params.deviceType === 'access_point' ||
    primaryRefSku.startsWith('MR') ||
    primaryRefSku.startsWith('CW') ||
    primaryRefSku.startsWith('C91') ||
    primaryRefSku.startsWith('AIR-')
  ) {
    seeds.push(
      {
        sku: 'MR46-HW',
        title: 'Propuesta Wi-Fi 6 Alto Rendimiento: Meraki MR46-HW',
        description: 'Access Point Cloud Managed Wi-Fi 6 (802.11ax) 4x4:4 MU-MIMO con radio dedicado de seguridad WIDS/WIPS y BLE.',
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Estándar Corporativo Wi-Fi 6',
        matchedSpecs: [
          'Wi-Fi 6 4x4:4 MU-MIMO (3.5 Gbps)',
          'Puerto Multigigabit 2.5G PoE+',
          'Radio Seguridad WIDS/WIPS Dedicado',
          `Licencia Meraki ${years * 12}M`,
        ],
      },
      {
        sku: 'CW9164I-MR',
        title: 'Propuesta Evolución Wi-Fi 6E Tri-Banda (6GHz): Catalyst CW9164I-MR',
        description: 'Access Point Wi-Fi 6E Tri-Band (2.4GHz + 5GHz + nueva banda 6GHz) 100% administrable en Meraki Dashboard o DNA Center.',
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Nueva Generación Wi-Fi 6E (6GHz)',
        matchedSpecs: [
          'Tri-Banda 2.4 / 5 / 6 GHz Wi-Fi 6E',
          'Hardware Dual-Persona (Meraki / Catalyst)',
          'Puerto 2.5G Multigigabit PoE+',
          `Licencia Suscripción ${years * 12}M`,
        ],
      },
      {
        sku: 'MR36-HW',
        title: 'Propuesta Wi-Fi 6 Costo-Efectiva Fast Track: Meraki MR36-HW',
        description: 'Access Point Cloud Managed Wi-Fi 6 2x2:2 MU-MIMO de bajo consumo PoE (15W 802.3af) ideal para oficinas y densidad media.',
        type: 'cost_effective',
        compatibilityPct: 98,
        homologationLabel: '98% Homologado • Optimización Presupuesto & PoE',
        matchedSpecs: [
          'Wi-Fi 6 2x2:2 MU-MIMO',
          'Bajo consumo PoE (Opera con 15.4W 802.3af)',
          'Radio Seguridad + Bluetooth BLE',
          `Licencia Meraki ${years * 12}M`,
        ],
      }
    );
  } else if (
    params.deviceType === 'collaboration' ||
    primaryRefSku.startsWith('DP-') ||
    primaryRefSku.startsWith('CP-') ||
    primaryRefSku.startsWith('CS-')
  ) {
    const isVideoRoom = primaryRefSku.startsWith('CS-');
    if (isVideoRoom) {
      seeds.push(
        {
          sku: 'CS-BAR-T-C-K9',
          title: 'Propuesta Sala de Reuniones Estándar: Cisco Room Bar + Navigator',
          description: 'Barra de videoconferencia inteligente con cámara 4K AI, parlantes estéreo, arreglo de micrófonos y panel táctil Room Navigator.',
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Reemplazo Oficial Room Kit / Mini',
          matchedSpecs: [
            'Cámara 4K con Encuadre AI + Audio HD',
            'Incluye Panel Táctil Room Navigator',
            'Nativo Webex / Microsoft Teams / Zoom',
            `Suscripción Cloud ${years * 12}M + ${cordLabel}`,
          ],
        },
        {
          sku: 'CS-BARPRO-C-K9',
          title: 'Propuesta Sala Mediana/Grande Dual-Lens: Cisco Room Bar Pro',
          description: 'Barra de video avanzada con doble lente 48MP de largo alcance, inteligencia artificial NVIDIA y entradas/salidas extendidas.',
          type: 'catalyst_alternative',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Alcance Extendido Dual-Lens AI',
          matchedSpecs: [
            'Doble Cámara 48MP Zoom Inteligente',
            'Soporta hasta 3 Pantallas Externas',
            'Incluye Room Navigator Táctil',
            `Suscripción Cloud ${years * 12}M + ${cordLabel}`,
          ],
        },
        {
          sku: 'CS-BRD55P-G2-K9',
          title: 'Propuesta Todo-en-Uno Interactiva: Cisco Board Pro G2 55"',
          description: 'Pantalla colaborativa 4K de 55 pulgadas Todo-en-Uno con pizarra interactiva, doble cámara AI y audio espacial integrado.',
          type: 'cost_effective',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Solución All-in-One con Pantalla 55"',
          matchedSpecs: [
            'Pantalla 55" 4K Touch + Pizarra Digital',
            'Cámara Dual AI + Micrófonos Integrados',
            'No requiere monitores externos',
            `Suscripción Cloud ${years * 12}M + ${cordLabel}`,
          ],
        }
      );
    } else {
      seeds.push(
        {
          sku: 'DP-9851-K9',
          title: 'Propuesta Corporativa Estándar: Cisco Desk Phone 9851',
          description: 'Teléfono IP de nueva generación Serie 9800 con pantalla color de alta resolución, doble puerto Gigabit PoE, USB-C y botón de acción.',
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Reemplazo Oficial CP-7841 / 8841',
          matchedSpecs: [
            'Switch Gigabit 2 Puertos RJ45 PoE',
            'Pantalla Color + Audio HD con AI Noise Removal',
            'Compatible CUCM On-Prem y Webex Calling',
            `Suscripción Flex Calling ${years * 12}M`,
          ],
        },
        {
          sku: 'DP-9861-K9',
          title: 'Propuesta Inalámbrica Ejecutiva: Cisco Desk Phone 9861 (Wi-Fi + BT)',
          description: 'Teléfono IP Serie 9800 con Wi-Fi Dual-Band integrado, Bluetooth para headsets inalámbricos y pantalla grande.',
          type: 'catalyst_alternative',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Incluye Wi-Fi & Bluetooth Integrado',
          matchedSpecs: [
            'Wi-Fi + Bluetooth + Gigabit PoE',
            'Ideal para escritorios con o sin punto de red',
            'Seguridad TPM 2.0 + Audio AI',
            `Suscripción Flex Calling ${years * 12}M`,
          ],
        },
        {
          sku: 'DP-9841-K9',
          title: 'Propuesta Costo-Efectiva Fast Track: Cisco Desk Phone 9841',
          description: 'Teléfono IP corporativo Serie 9800 con puertos Gigabit PoE y bajo consumo energético para despliegues masivos.',
          type: 'cost_effective',
          compatibilityPct: 98,
          homologationLabel: '98% Homologado • Mejor Precio GPL & Descuento',
          matchedSpecs: [
            '2x Puertos Gigabit Ethernet PoE',
            'Audio HD + Reducción de Ruido AI',
            'Menor consumo PoE (Clase 1/2)',
            `Suscripción Flex Calling ${years * 12}M`,
        ],
        }
      );
    }
  } else if (primaryRefSku.startsWith('MS')) {
    // Familia Meraki Cloud Switches (MS120, MS210, MS220, MS130, MS225)
    if (isFullPoe && portNum === 48) {
      seeds.push(
        {
          sku: 'MS225-48FP-HW',
          title: 'Propuesta Reemplazo Directo 740W + Stacking: Meraki MS225-48FP-HW',
          description: 'Switch L2 Cloud Managed de 48 puertos GigE Full PoE+ (740W), 4x 10G SFP+ uplinks y puertos de Stacking físico dedicado (80G).',
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Cumple 740W Full PoE+ y Stacking',
          matchedSpecs: [
            '48 Puertos Full PoE+ (740W Budget)',
            '4x Uplinks 10G SFP+ + Stacking 80G',
            `Licencia Meraki ${years * 12}M + ${cordLabel}`,
          ],
        },
        {
          sku: `C9200L-48FP-4X-${tierCode}`,
          title: `Propuesta Enterprise 740W 10G: Catalyst C9200L-48FP-4X-${tierCode}`,
          description: 'Switch Cisco Catalyst 9200L con 48 puertos Full PoE+ (740W con fuente 1KW), 4x 10G SFP+ uplinks y monitoreo Cloud/CLI.',
          type: 'catalyst_alternative',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado en Potencia 740W & 4x10G SFP+',
          matchedSpecs: [
            '48 Puertos Full PoE+ (740W Fuente 1KW)',
            '4x Uplinks 10G SFP+ Fibra',
            `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
          ],
        },
        {
          sku: 'MS130-SWITCHES:MS130-48P',
          title: 'Propuesta Cloud Native 370W Costo-Efectiva: Meraki MS130-48P',
          description: 'Contenedor Madre MS130-SWITCHES + Hijo MS130-48P (370W PoE+ budget) y 4x 10G SFP+. Ideal si el consumo PoE es menor a 370W.',
          type: 'cost_effective',
          compatibilityPct: 95,
          homologationLabel: '95% Homologado • Presupuesto PoE 370W (Ahorro Alto)',
          matchedSpecs: [
            '48 Puertos PoE+ (370W Budget)',
            '4x Uplinks 10G SFP+ Integrados',
            `Contenedor MS130-SWITCHES + Lic ${years}Y`,
          ],
        }
      );
    } else {
      const ms130Child = is8
        ? `MS130-8${isNoPoe ? '' : 'P'}`
        : `MS130-${portNum}${isNoPoe ? '' : 'P'}`;
      const ms225Sku = `MS225-${portNum === 8 ? 24 : portNum}${isNoPoe ? '' : portNum === 48 ? 'LP' : 'P'}-HW`;
      const catEquiv = `C9200L-${portNum === 8 ? 24 : portNum}${isNoPoe ? 'T' : 'P'}-4X-${tierCode}`;

      seeds.push(
        {
          sku: `MS130-SWITCHES:${ms130Child}`,
          title: `Propuesta Oficial Cloud Native: Meraki ${ms130Child} (Bajo MS130-SWITCHES)`,
          description: `Reemplazo oficial vigente 2026 en contenedor Madre MS130-SWITCHES con ${portNum} puertos ${isNoPoe ? 'Data' : 'PoE+ (370W)'} y 4x 10G SFP+.`,
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Reemplazo Oficial Directo Meraki',
          matchedSpecs: [
            `${portNum} Puertos ${isNoPoe ? 'GigE Data' : 'PoE+ (370W)'}`,
            '4x Uplinks 10G SFP+ Fibra',
            `Contenedor MS130-SWITCHES + Lic ${years}Y`,
            cordLabel,
          ],
        },
        {
          sku: ms225Sku,
          title: `Propuesta con Stacking Físico Dedicado: Meraki ${ms225Sku}`,
          description: `Switch Cloud Managed con ${portNum === 8 ? 24 : portNum} puertos ${isNoPoe ? 'Data' : 'PoE+ (370W)'}, 4x 10G SFP+ y apilamiento físico 80G.`,
          type: 'direct_equivalent',
          compatibilityPct: 100,
          homologationLabel: '100% Homologado • Incluye Stacking Físico 80G',
          matchedSpecs: [
            `${portNum === 8 ? 24 : portNum} Puertos ${isNoPoe ? 'Data' : 'PoE+ 370W'}`,
            'Stacking Físico Dedicado + 4x 10G SFP+',
            `Licencia Meraki ${years}YR + ${cordLabel}`,
          ],
        },
        {
          sku: catEquiv,
          title: `Propuesta Equivalente Catalyst 10G: ${catEquiv}`,
          description: `Switch Cisco Catalyst 9200L con ${portNum === 8 ? 24 : portNum} puertos ${isNoPoe ? 'Data' : 'PoE+ (370W)'}, 4x 10G SFP+ y excelente descuento Fast Track.`,
          type: 'catalyst_alternative',
          compatibilityPct: 98,
          homologationLabel: '98% Homologado • Equivalente Catalyst Fast Track',
          matchedSpecs: [
            `${portNum === 8 ? 24 : portNum} Puertos ${isNoPoe ? 'Data' : 'PoE+ 370W'}`,
            '4x Uplinks 10G SFP+',
            `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
          ],
        }
      );
    }
  } else if (
    primaryRefSku.includes('3850') ||
    primaryRefSku.includes('3650') ||
    primaryRefSku.startsWith('C9300')
  ) {
    // Familia Catalyst 3850 / 3650 (EOL) o Catalyst 9300 / 9300L (Vigentes)
    const pNum = is48 ? 48 : 24;
    const poe9300 = isNoPoe ? 'T' : 'P';
    const poe9300L = isNoPoe ? 'T' : isFullPoe && pNum === 48 ? 'PF' : 'P';

    seeds.push(
      {
        sku: `C9300L-${pNum}${poe9300L}-4X-${tierCode}`,
        title: `Propuesta #1 Fast Track Uplinks 10G: Catalyst C9300L-${pNum}${poe9300L}-4X-${tierCode}`,
        description: `Switch Enterprise Catalyst 9300L de ${pNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} con 4x 10G SFP+ integrados, fuente redundante opcional y StackWise-320.`,
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Mejor Descuento Fast Track + 4x10G',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'GigE Data' : isFullPoe ? 'Full PoE+ 1100W' : 'PoE+ (715W PSU)'}`,
          '4x Uplinks 10G SFP+ Integrados',
          `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
        ],
      },
      {
        sku: `C9300-${pNum}${poe9300}-${tierCode}`,
        title: `Propuesta Modular StackWise-480: Catalyst C9300-${pNum}${poe9300}-${tierCode}`,
        description: `Reemplazo modular directo con módulo de red C9300-NM-8X (8x10G SFP+) y cable de apilamiento STACK-T1-50CM incluidos.`,
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Chasis Modular + Módulo 8x10G',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'Data' : 'PoE+'} + StackWise-480`,
          'Incluye Módulo C9300-NM-8X (8x10G)',
          'Incluye Cable Stack STACK-T1-50CM',
          `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
        ],
      },
      {
        sku: `C9200-${pNum}${poe9300}-${tierCode}`,
        title: `Propuesta Optimización Modular: Catalyst C9200-${pNum}${poe9300}-${tierCode}`,
        description: `Switch modular Catalyst 9200 de ${pNum} puertos con módulo C9200-NM-4X (4x10G SFP+), fuentes y ventiladores redundantes a menor GPL.`,
        type: 'cost_effective',
        compatibilityPct: 98,
        homologationLabel: '98% Homologado • Chasis Modular con Ahorro en GPL',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'Data' : 'PoE+'} Modulares`,
          'Incluye Módulo Uplink C9200-NM-4X (4x10G)',
          `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
        ],
      }
    );
  } else if (
    primaryRefSku.startsWith('CBS') ||
    primaryRefSku.startsWith('SG') ||
    primaryRefSku.startsWith('C1000') ||
    primaryRefSku.startsWith('C1200') ||
    primaryRefSku.startsWith('C1300')
  ) {
    // Familia SMB / Branch (CBS250, CBS350, C1000, C1200, C1300)
    const pNum = is48 ? 48 : 24;
    const poeChar = isNoPoe ? 'T' : 'P';
    seeds.push(
      {
        sku: `C1300-${pNum}${poeChar}-4G`,
        title: `Propuesta Oficial Directa (Sin Suscripción Obligatoria): Catalyst C1300-${pNum}${poeChar}-4G`,
        description: `Switch administrable Capa 3 Cisco Catalyst 1300 de ${pNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} con 4x1G SFP y licenciamiento perpetuo incluido.`,
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Reemplazo Oficial CBS350 / C1000',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'GigE' : 'PoE+'} + 4x1G SFP`,
          'Sin costo de licencia DNA recurrente',
          'Soporte Layer 3 Estático/RIP + Stacking',
          cordLabel,
        ],
      },
      {
        sku: `C1300-${pNum}${poeChar}-4X`,
        title: `Propuesta Evolución Uplinks 10G SFP+: Catalyst C1300-${pNum}${poeChar}-4X`,
        description: `Switch Cisco Catalyst 1300 de ${pNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} con 4 puertos de fibra 10G SFP+ para apilamiento y enlaces troncales 10G.`,
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Upgrade a 4x10G SFP+',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'GigE' : 'PoE+'} + 4x10G SFP+`,
          'Apilamiento hasta 8 unidades por 10G',
          'Sin licencia recurrente obligatoria',
          cordLabel,
        ],
      },
      {
        sku: `C9200L-${pNum}${poeChar}-4G-${tierCode}`,
        title: `Propuesta Enterprise IOS-XE: Catalyst C9200L-${pNum}${poeChar}-4G-${tierCode}`,
        description: `Salto a arquitectura corporativa Catalyst 9200L con IOS-XE, telemetría DNA y garantía limitada de por vida (E-LLW).`,
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Salto a Línea Enterprise C9200L',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'Data' : 'PoE+'} + 4x1G SFP`,
          'Sistema Operativo Empresarial IOS-XE',
          `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
        ],
      }
    );
  } else {
    // Familia General Enterprise Switching: Catalyst 2960X / 2960L / 2960XR / C9200L / C9200
    const pNum = is48 ? 48 : 24;
    const poe9200L = isNoPoe ? 'T' : isFullPoe && pNum === 48 ? 'FP' : 'P';
    const poe9200Mod = isNoPoe ? 'T' : 'P';

    seeds.push(
      {
        sku: `C9200L-${pNum}${poe9200L}-${is10G ? '4X' : '4G'}-${tierCode}`,
        title: `Propuesta #1 Equivalente Exacto Fast Track: Catalyst C9200L-${pNum}${poe9200L}-${is10G ? '4X' : '4G'}-${tierCode}`,
        description: `Switch Cisco Catalyst 9200L de ${pNum} puertos ${isNoPoe ? 'Data' : poe9200L === 'FP' ? 'Full PoE+ (740W)' : 'PoE+ (370W)'} con uplinks fijos ${is10G ? '4x10G SFP+' : '4x1G SFP'} y descuento preferencial Fast Track.`,
        type: 'direct_equivalent',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Reemplazo Directo + Mejor Dcto Fast Track',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'GigE Data' : poe9200L === 'FP' ? 'Full PoE+ 740W' : 'PoE+ 370W'}`,
          `Uplinks Fijos ${is10G ? '4x10G SFP+' : '4x1G SFP'}`,
          `Cisco DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      },
      {
        sku: `C9200L-${pNum}${poe9200L}-${is10G ? '4G' : '4X'}-${tierCode}`,
        title: is10G
          ? `Propuesta Optimización Uplinks 1G: Catalyst C9200L-${pNum}${poe9200L}-4G-${tierCode}`
          : `Propuesta Upgrade Uplinks 10G SFP+: Catalyst C9200L-${pNum}${poe9200L}-4X-${tierCode}`,
        description: is10G
          ? `Versión con uplinks 4x1G SFP para reducir el Valor GPL manteniendo el 100% de puertos y potencia PoE+.`
          : `Misma densidad de ${pNum} puertos ${isNoPoe ? 'Data' : 'PoE+'} pero duplicando la velocidad troncal con 4 puertos de fibra 10G SFP+ (elegible Fast Track).`,
        type: 'direct_equivalent',
        compatibilityPct: is10G ? 96 : 100,
        homologationLabel: is10G
          ? '96% Homologado • Opción Económica Uplinks 4x1G'
          : '100% Homologado • Superioridad Troncales 4x10G SFP+',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'GigE Data' : poe9200L === 'FP' ? 'Full PoE+ 740W' : 'PoE+ 370W'}`,
          `Uplinks ${is10G ? '4x1G SFP (Ahorro GPL)' : '4x10G SFP+ Fibra'}`,
          `Cisco DNA ${tier} ${years * 12}M`,
          cordLabel,
        ],
      },
      {
        sku: `C9200-${pNum}${poe9200Mod}-${tierCode}`,
        title: `Propuesta Chasis Modular Enterprise: Catalyst C9200-${pNum}${poe9200Mod}-${tierCode}`,
        description: `Switch Catalyst 9200 Modular con módulo de red C9200-NM-4X (4x10G), ventiladores redundantes extraíbles en caliente y StackWise-160.`,
        type: 'catalyst_alternative',
        compatibilityPct: 100,
        homologationLabel: '100% Homologado • Chasis Modular + Ventiladores Redundantes',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'Data' : 'PoE+'} Chasis Modular`,
          'Incluye Módulo Uplink C9200-NM-4X',
          'Ventiladores Field-Replaceable + StackWise-160',
          `Cisco DNA ${tier} ${years * 12}M + ${cordLabel}`,
        ],
      },
      {
        sku:
          poe9200L === 'FP' && pNum === 48
            ? 'MS225-48FP-HW'
            : `MS130-SWITCHES:MS130-${pNum}${isNoPoe ? '' : 'P'}`,
        title:
          poe9200L === 'FP' && pNum === 48
            ? 'Propuesta Equivalente Cloud 740W: Meraki MS225-48FP-HW'
            : `Propuesta Equivalente Cloud Native: Meraki MS130-${pNum}${isNoPoe ? '' : 'P'}`,
        description: `Alternativa 100% administrada en la nube Cisco Meraki con ${pNum} puertos ${isNoPoe ? 'Data' : poe9200L === 'FP' ? 'Full PoE+ 740W' : 'PoE+ 370W'} y 4x 10G SFP+ uplinks.`,
        type: 'cost_effective',
        compatibilityPct: 98,
        homologationLabel: '98% Homologado • Equivalente Cloud Meraki + 4x10G',
        matchedSpecs: [
          `${pNum} Puertos ${isNoPoe ? 'Data' : poe9200L === 'FP' ? 'Full PoE+ 740W' : 'PoE+ 370W'}`,
          '4x Uplinks 10G SFP+ Integrados',
          `Gestión Cloud Meraki + Soporte 24x7 (${years}Y)`,
        ],
      }
    );
  }

  // Asegurar que si el activeSku actual no estaba entre las semillas, se incluya también sin duplicados
  const seenSkus = new Set<string>();
  const uniqueSeeds: CandidateSeed[] = [];
  for (const s of seeds) {
    const key = s.sku.trim().toUpperCase();
    if (!seenSkus.has(key)) {
      seenSkus.add(key);
      uniqueSeeds.push(s);
    }
  }

  // Construir las propuestas enriquecidas con su cálculo GPL (0% descuento) y neto estimado
  const builtProposals: HomologatedProposal[] = uniqueSeeds.map((seed, idx) => {
    const gplInfo = computeProposalSolutionGpl(seed.sku, {
      quantity: qty,
      licenseTier: tier,
      termYears: years,
      powerCordStandard: params.powerCordStandard || 'italy_chile',
      includeStacking: params.includeStacking,
      includeRedundantPsu: params.includeRedundantPsu,
      includeSmartNet: params.includeSmartNet,
      smartNetLevel: params.smartNetLevel || '8x5xNBD',
      merakiLicenseMode: params.merakiLicenseMode || 'subscription',
    });

    const upperSeedSku = seed.sku.toUpperCase();
    const childSeedSku = upperSeedSku.includes(':') ? upperSeedSku.split(':')[1] : upperSeedSku;
    const uploadedFtDisc =
      params.fastTrackDiscountMap?.[upperSeedSku] ??
      params.fastTrackDiscountMap?.[childSeedSku];

    const discountRef =
      REFERENCE_FASTTRACK_DISCOUNTS_2026[upperSeedSku] ||
      REFERENCE_FASTTRACK_DISCOUNTS_2026[childSeedSku] ||
      REFERENCE_FASTTRACK_DISCOUNTS_2026[upperSeedSku.replace(/-(E|A)$/i, '-E')] || {
        discountPct: seed.customDiscountPct || 44.0,
        isFastTrack: false,
        promoLabel: '🏷️ Descuento Estándar Deal Reg CCW',
      };

    const estimatedDiscountPct = Number(
      uploadedFtDisc && uploadedFtDisc > 0
        ? uploadedFtDisc
        : seed.customDiscountPct || discountRef.discountPct || 44.0
    );
    const isFastTrackEligible = Boolean(
      (uploadedFtDisc && uploadedFtDisc > 0) || discountRef.isFastTrack
    );
    const promoBadge =
      uploadedFtDisc && uploadedFtDisc > 0
        ? `⚡ Promo Fast Track Activa (${estimatedDiscountPct}% Dcto)`
        : `${discountRef.promoLabel} (${estimatedDiscountPct}% Dcto)`;

    const strategyTag =
      seed.type === 'direct_equivalent'
        ? '🎯 Equivalente Directo 1:1'
        : seed.type === 'cost_effective'
          ? '💰 Optimización Costo / Cloud'
          : '🚀 Alternativa Superior / Modular';

    const estimatedUnitNetUsd = Number(
      (gplInfo.unitSolutionGplUsd * (1 - estimatedDiscountPct / 100)).toFixed(2)
    );
    const estimatedTotalNetUsd = Number((estimatedUnitNetUsd * qty).toFixed(2));
    const estimatedSavingsUsd = Number(
      Math.max(0, gplInfo.totalSolutionGplUsd - estimatedTotalNetUsd).toFixed(2)
    );

    // Score de Prioridad: pondera 65% el % de Homologación Técnica + 35% el % de Descuento + bono Fast Track
    const priorityScore = Number(
      (
        seed.compatibilityPct * 0.65 +
        estimatedDiscountPct * 0.35 +
        (isFastTrackEligible ? 4.5 : 0)
      ).toFixed(2)
    );

    return {
      proposalId: `prop-${idx + 1}-${seed.sku}`,
      priorityRank: idx + 1,
      recommendedSku: seed.sku,
      title: seed.title,
      description: seed.description,
      type: seed.type,
      strategyTag,
      compatibilityPct: seed.compatibilityPct,
      homologationLabel: seed.homologationLabel,
      compatibilityLabel: seed.homologationLabel,
      matchedSpecs: seed.matchedSpecs || [],
      unitChassisGplUsd: gplInfo.unitChassisGplUsd,
      unitSolutionGplUsd: gplInfo.unitSolutionGplUsd,
      totalSolutionGplUsd: gplInfo.totalSolutionGplUsd,
      estimatedDiscountPct,
      bestDiscountPct: estimatedDiscountPct,
      isFastTrackEligible,
      promoBadge,
      discountSourceLabel: promoBadge,
      estimatedUnitNetUsd,
      unitEstimatedNetUsd: estimatedUnitNetUsd,
      estimatedTotalNetUsd,
      totalEstimatedNetUsd: estimatedTotalNetUsd,
      estimatedSavingsUsd,
      totalSavingsUsd: estimatedSavingsUsd,
      priorityScore,
      subItemsBreakdown: gplInfo.subItemsBreakdown,
      subItemsSummary: gplInfo.subItemsBreakdown,
    };
  });

  return sortHomologatedProposals(builtProposals, effectiveSortMode);
}


