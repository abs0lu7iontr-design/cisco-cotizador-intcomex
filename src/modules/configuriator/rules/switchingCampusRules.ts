// ============================================================================
// 2. SWITCHING (ENTERPRISE Y CAMPUS) - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Catalyst 9200/9300/9400/9500/9600, Meraki MS, Cisco Business & Catalyst 1200/1300
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  PowerCordStandard,
  RuleModulePackage,
  SubItemConfig,
} from './types';

function resolvePowerCord(cordStd: PowerCordStandard = 'italy_chile'): string {
  switch (cordStd) {
    case 'rack_pdu':
      return 'CAB-C13-C14-2M';
    case 'schuko_eu':
      return 'CAB-ACE';
    case 'nema_us':
      return 'CAB-AC';
    case 'argentina_iram':
      return 'CAB-ACR';
    case 'italy_chile':
    default:
      return 'CAB-ACA';
  }
}

// ----------------------------------------------------------------------------
// EOL MAPPINGS (SWITCHES ENTERPRISE, CAMPUS Y SMB)
// ----------------------------------------------------------------------------
export const switchingCampusEolEntries: Record<string, EolMappingEntry> = {
  // Cisco 2960-X / 2960-XR
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
    eolNote: 'End-of-Sale oficial Cisco. Reemplazo directo: Catalyst 9200L 48P Full PoE+ (740W).',
    canKeepOriginal: false,
  },

  // Cisco Catalyst 3850 / 3750-X (EOL -> Catalyst 9300 / 9300X)
  'WS-C3850-24P-S': {
    legacySku: 'WS-C3850-24P-S',
    replacementSku: 'C9300-24P-A',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Catalyst 3850 End-of-Sale. Reemplazo Enterprise Capa 3: Catalyst 9300 24P DNA Advantage.',
    canKeepOriginal: false,
  },
  'WS-C3850-48F-S': {
    legacySku: 'WS-C3850-48F-S',
    replacementSku: 'C9300-48P-A',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Catalyst 3850 48P Full PoE End-of-Sale. Reemplazo: Catalyst 9300 48P PoE+.',
    canKeepOriginal: false,
  },
  'WS-C3750X-24P-S': {
    legacySku: 'WS-C3750X-24P-S',
    replacementSku: 'C9300-24P-E',
    status: 'eos_eol_active',
    eosYear: 2016,
    eolNote: 'Catalyst 3750-X End-of-Support. Reemplazo: Catalyst 9300.',
    canKeepOriginal: false,
  },

  // Catalyst 4500 / 4500-E (Chassis Modular EOL -> Catalyst 9400)
  'WS-C4506-E': {
    legacySku: 'WS-C4506-E',
    replacementSku: 'C9407R',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Catalyst 4506-E End-of-Sale. Reemplazo modular campus: Catalyst 9407R (7 slots).',
    canKeepOriginal: false,
  },
  'WS-C4507R+E': {
    legacySku: 'WS-C4507R+E',
    replacementSku: 'C9407R',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Catalyst 4507R+E End-of-Sale. Reemplazo: Catalyst 9407R Redundant Supervisor.',
    canKeepOriginal: false,
  },

  // Catalyst 6500 / 6800 (Core Modular EOL -> Catalyst 9600)
  'WS-C6509-E': {
    legacySku: 'WS-C6509-E',
    replacementSku: 'C9606R',
    status: 'eos_eol_active',
    eosYear: 2019,
    eolNote: 'Catalyst 6509-E End-of-Sale. Reemplazo Core Enterprise 100G/400G: Catalyst 9606R.',
    canKeepOriginal: false,
  },

  // Cisco Catalyst 3560-CX / 2960-CX (Compact Switches -> Catalyst 9200CX)
  'WS-C3560CX-8PC-S': {
    legacySku: 'WS-C3560CX-8PC-S',
    replacementSku: 'C9200CX-8P-2X2G-E',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Catalyst 3560-CX Compact End-of-Sale. Reemplazo silencioso: Catalyst 9200CX 8P PoE+ 2x10G.',
    canKeepOriginal: false,
  },

  // Cisco Business (CBS 250 / 350 End-of-Sale 2024 -> Catalyst 1200 / 1300)
  'CBS250-24P-4G': {
    legacySku: 'CBS250-24P-4G',
    replacementSku: 'C1200-24FP-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco Business CBS250 End-of-Sale oficial. Reemplazo PyME 2026: Catalyst 1200 24P PoE+ (C1200-24FP-4G).',
    canKeepOriginal: false,
  },
  'CBS250-48P-4G': {
    legacySku: 'CBS250-48P-4G',
    replacementSku: 'C1200-48P-4G',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco Business CBS250 48P End-of-Sale. Reemplazo directo: Catalyst 1200 48P.',
    canKeepOriginal: false,
  },
  'CBS350-24P-4X': {
    legacySku: 'CBS350-24P-4X',
    replacementSku: 'C1300-24P-4X',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco Business CBS350 10G Uplink End-of-Sale. Reemplazo avanzado: Catalyst 1300 24P PoE+ 4x10G SFP+.',
    canKeepOriginal: false,
  },
  'CBS350-48P-4X': {
    legacySku: 'CBS350-48P-4X',
    replacementSku: 'C1300-48P-4X',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Cisco Business CBS350 48P 10G End-of-Sale. Reemplazo directo: Catalyst 1300 48P PoE+ 4x10G.',
    canKeepOriginal: false,
  },

  // Meraki MS120 Series (Fin de venta -> Meraki MS130)
  'MS120-24P': {
    legacySku: 'MS120-24P',
    replacementSku: 'MS130-SWITCHES:MS130-24P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-24P End-of-Sale. Reemplazo oficial 2026: MS130-24P (Contenedor MS130-SWITCHES).',
    canKeepOriginal: false,
  },
  'MS120-48FP': {
    legacySku: 'MS120-48FP',
    replacementSku: 'MS130-SWITCHES:MS130-48P',
    status: 'eos_eol_active',
    eosYear: 2024,
    eolNote: 'Meraki MS120-48FP End-of-Sale. Reemplazo: MS130-48P.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (CATALYST 9400, 9500, 9600, C1200, C1300)
// ----------------------------------------------------------------------------
export const switchingCampusChassisRules: Record<string, ChassisConfigRule> = {
  // Catalyst 9407R Modular Chassis (Campus Core/Distro)
  'C9407R': {
    parentSku: 'C9407R',
    family: 'catalyst9400',
    description: 'Cisco Catalyst 9400 Series 7-Slot Modular Chassis',
    estimatedListUsd: 11000,
    defaultSubItems: (opts) => [
      {
        partNumber: 'C9400X-SUP-2XL',
        qtyMultiplier: 1,
        description: 'Cisco Catalyst 9400 Series Supervisor 2XL Module',
        category: 'server_component',
      },
      {
        partNumber: 'C9400-LC-48U',
        qtyMultiplier: 2,
        description: 'Cisco Catalyst 9400 Series 48-Port UPOE Linecard',
        category: 'server_component',
      },
      {
        partNumber: 'C9400-PWR-3200AC',
        qtyMultiplier: 2,
        description: 'Cisco Catalyst 9400 Series 3200W AC Power Supply',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 2,
        description: 'AC Power Cord for Chassis',
        category: 'power_cord',
      },
      {
        partNumber: 'C9400-DNA-A',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Catalyst 9400 Cisco DNA Advantage Term 3Y Subscription',
        category: 'dna_license',
      },
    ],
  },

  // Catalyst 9500 High-Performance Core/Aggregation 40x10G
  'C9500-40X': {
    parentSku: 'C9500-40X',
    family: 'catalyst9500',
    description: 'Cisco Catalyst 9500 40-Port 10G SFP+ Aggregation Switch',
    estimatedListUsd: 22000,
    defaultSubItems: (opts) => [
      {
        partNumber: 'C9K-PWR-950WAC-R',
        qtyMultiplier: 2,
        description: '950W AC Redundant Power Supply Port-Side Exhaust',
        category: 'power_supply',
      },
      {
        partNumber: 'C9K-T1-F-A',
        qtyMultiplier: 5,
        description: 'Catalyst 9500 Fan Tray, Port-Side Exhaust',
        category: 'server_component',
      },
      {
        partNumber: opts.explicitPowerCordSku || (opts.powerCordStandard === 'rack_pdu' ? 'CAB-C13-C14-2M' : 'CAB-ACE'),
        qtyMultiplier: 2,
        description: 'Power Cord for Catalyst 9500',
        category: 'power_cord',
      },
      {
        partNumber: 'C9500-DNA-A',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Catalyst 9500 Cisco DNA Advantage Term 3Y',
        category: 'dna_license',
      },
    ],
  },

  // Catalyst 1200 Series Smart Managed Switch 24P PoE+
  'C1200-24FP-4G': {
    parentSku: 'C1200-24FP-4G',
    family: 'catalyst1200_1300',
    description: 'Cisco Catalyst 1200 24-Port GE Full PoE+ (370W), 4x 1G SFP Smart Switch',
    estimatedListUsd: 795,
    defaultSubItems: (opts) => [
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'AC Power Cord for Catalyst 1200 Switch',
        category: 'power_cord',
      },
    ],
  },

  // Catalyst 1300 Series Enterprise Managed Switch 24P PoE+ 4x10G
  'C1300-24P-4X': {
    parentSku: 'C1300-24P-4X',
    family: 'catalyst1200_1300',
    description: 'Cisco Catalyst 1300 24-Port GE PoE+ (195W), 4x 10G SFP+ Managed Switch',
    estimatedListUsd: 1395,
    defaultSubItems: (opts) => [
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'AC Power Cord for Catalyst 1300 Switch',
        category: 'power_cord',
      },
    ],
  },
};

export const switchingCampusPackage: RuleModulePackage = {
  domainName: 'Switching (Enterprise y Campus)',
  eolEntries: switchingCampusEolEntries,
  chassisRules: switchingCampusChassisRules,
};
