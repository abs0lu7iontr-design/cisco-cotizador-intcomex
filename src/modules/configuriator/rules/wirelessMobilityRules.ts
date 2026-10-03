// ============================================================================
// 4. WIRELESS Y MOVILIDAD - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Catalyst Wireless 9100/9800, Meraki MR, Cisco Business Wireless (CBW)
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  RuleModulePackage,
  SubItemConfig,
} from './types';

// ----------------------------------------------------------------------------
// EOL MAPPINGS (ACCESS POINTS Y CONTROLADORES WIRELESS OBSOLETOS)
// ----------------------------------------------------------------------------
export const wirelessMobilityEolEntries: Record<string, EolMappingEntry> = {
  // Controladores Wireless Legacy Cisco AireOS (CT2504 / CT3504 / CT5520 -> Catalyst 9800)
  'AIR-CT2504-K9': {
    legacySku: 'AIR-CT2504-K9',
    replacementSku: 'C9800-L-F-K9',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'WLC 2504 AireOS End-of-Support. Reemplazo Wi-Fi 6 Enterprise: Catalyst 9800-L (Fiber).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/wireless/catalyst-9800-l-wireless-controller/index.html',
  },
  'AIR-CT3504-K9': {
    legacySku: 'AIR-CT3504-K9',
    replacementSku: 'C9800-L-C-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'WLC 3504 AireOS End-of-Sale. Reemplazo directo: Catalyst 9800-L-C (Copper).',
    canKeepOriginal: false,
  },
  'AIR-CT5520-K9': {
    legacySku: 'AIR-CT5520-K9',
    replacementSku: 'C9800-40-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'WLC 5520 Campus End-of-Sale. Reemplazo alta densidad: Catalyst 9800-40.',
    canKeepOriginal: false,
  },

  // Access Points Legacy Wave 1 / Wave 2 (Aironet -> Catalyst 9100 Wi-Fi 6 / 6E)
  'AIR-CAP2702I-A-K9': {
    legacySku: 'AIR-CAP2702I-A-K9',
    replacementSku: 'C9115AXI-A',
    status: 'eos_eol_active',
    eosYear: 2019,
    eolNote: 'Aironet 2702I 802.11ac Wave 1 End-of-Support. Reemplazo Wi-Fi 6: Catalyst 9115AXI.',
    canKeepOriginal: false,
  },
  'AIR-AP2802I-A-K9': {
    legacySku: 'AIR-AP2802I-A-K9',
    replacementSku: 'C9120AXI-A',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Aironet 2802I Wave 2 End-of-Sale. Reemplazo RF Excellence: Catalyst 9120AXI.',
    canKeepOriginal: false,
  },
  'AIR-AP3802I-A-K9': {
    legacySku: 'AIR-AP3802I-A-K9',
    replacementSku: 'C9130AXI-A',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Aironet 3802I Wave 2 End-of-Sale. Reemplazo Ultra Alta Densidad 8x8: Catalyst 9130AXI.',
    canKeepOriginal: false,
  },
  'AIR-AP1852I-A-K9': {
    legacySku: 'AIR-AP1852I-A-K9',
    replacementSku: 'C9105AXI-A',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Aironet 1852I End-of-Sale. Reemplazo compacto: Catalyst 9105AXI.',
    canKeepOriginal: false,
  },

  // Meraki MR Legacy (Wi-Fi 5 -> Meraki Wi-Fi 6 / 6E)
  'MR33-HW': {
    legacySku: 'MR33-HW',
    replacementSku: 'MR36-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR33 Wave 2 End-of-Sale. Reemplazo directo Wi-Fi 6: Meraki MR36-HW.',
    canKeepOriginal: false,
  },
  'MR42-HW': {
    legacySku: 'MR42-HW',
    replacementSku: 'MR44-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR42 Wave 2 End-of-Sale. Reemplazo directo: Meraki MR44-HW.',
    canKeepOriginal: false,
  },
  'MR52-HW': {
    legacySku: 'MR52-HW',
    replacementSku: 'MR46-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MR52 End-of-Sale. Reemplazo alta concurrencia: Meraki MR46-HW.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (C9800-L, C9120AXI, MR46)
// ----------------------------------------------------------------------------
export const wirelessMobilityChassisRules: Record<string, ChassisConfigRule> = {
  // Controlador Wireless Catalyst 9800-L
  'C9800-L-F-K9': {
    parentSku: 'C9800-L-F-K9',
    family: 'catalyst_wireless',
    description: 'Cisco Catalyst 9800-L Wireless Controller (Fiber Uplink, up to 250 APs)',
    estimatedListUsd: 4995,
    defaultSubItems: (opts) => [
      {
        partNumber: 'C9800-AC-110W',
        qtyMultiplier: 1,
        description: '110W AC Power Supply for Catalyst 9800-L',
        category: 'power_supply',
      },
      {
        partNumber: 'CAB-ACE',
        qtyMultiplier: 1,
        description: 'Power Cord AC',
        category: 'power_cord',
      },
      {
        partNumber: 'AIR-DNA-A',
        qtyMultiplier: 10,
        durationMonths: 36,
        description: 'Cisco DNA Advantage Term Wireless Subscription (10 AP Pack)',
        category: 'dna_license',
      },
    ],
  },

  // Catalyst 9120AXI Access Point Wi-Fi 6
  'C9120AXI-A': {
    parentSku: 'C9120AXI-A',
    family: 'catalyst_wireless',
    description: 'Cisco Catalyst 9120AX Series Wi-Fi 6 Access Point with Internal Antennas',
    estimatedListUsd: 1395,
    defaultSubItems: () => [
      {
        partNumber: 'AIR-AP-BRACKET-1',
        qtyMultiplier: 1,
        description: 'Cisco Low-Profile Mounting Bracket for Ceiling/Wall',
        category: 'server_component',
      },
      {
        partNumber: 'AIR-DNA-E-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco DNA Essentials Wireless License 3 Year Term',
        category: 'dna_license',
      },
    ],
  },

  // Meraki MR46 Wi-Fi 6 Cloud Managed AP
  'MR46-HW': {
    parentSku: 'MR46-HW',
    family: 'meraki_mr',
    description: 'Cisco Meraki MR46 Wi-Fi 6 Indoor Access Point (4x4:4 MU-MIMO)',
    estimatedListUsd: 1495,
    defaultSubItems: () => [
      {
        partNumber: 'LIC-ENT-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki Enterprise Cloud License and Support, 3 Years',
        category: 'dna_license',
      },
      {
        partNumber: 'MA-INJ-4',
        qtyMultiplier: 1,
        isOptional: true,
        description: 'Cisco Meraki 802.3at PoE+ Gigabit Power Injector',
        category: 'power_supply',
      },
    ],
  },
};

export const wirelessMobilityPackage: RuleModulePackage = {
  domainName: 'Wireless y Movilidad',
  eolEntries: wirelessMobilityEolEntries,
  chassisRules: wirelessMobilityChassisRules,
};
