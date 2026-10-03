// ============================================================================
// 5. SEGURIDAD Y SASE - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Secure Firewall FPR 1000/2100/3100/4200, FMC, Meraki Z, Duo, Umbrella, ISE, SASE
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
// EOL MAPPINGS (FIREWALLS ASA 5500-X / FPR 2100 LEGACY A SECURE FIREWALL 2026)
// ----------------------------------------------------------------------------
export const securitySaseEolEntries: Record<string, EolMappingEntry> = {
  // Cisco ASA 5500-X Series (Fin de ciclo oficial -> Secure Firewall 1000 / 3100)
  'ASA5506-X': {
    legacySku: 'ASA5506-X',
    replacementSku: 'FPR1010-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco ASA 5506-X End-of-Support. Reemplazo NGFW moderno 2026: FPR1010-NGFW-K9.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/security/firepower-1000-series/index.html',
  },
  'ASA5506-K9': {
    legacySku: 'ASA5506-K9',
    replacementSku: 'FPR1010-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco ASA 5506 End-of-Support. Reemplazo: FPR1010-NGFW-K9.',
    canKeepOriginal: false,
  },
  'ASA5508-X': {
    legacySku: 'ASA5508-X',
    replacementSku: 'FPR1120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco ASA 5508-X End-of-Support. Reemplazo 1.5Gbps NGFW: FPR1120-NGFW-K9.',
    canKeepOriginal: false,
  },
  'ASA5516-X': {
    legacySku: 'ASA5516-X',
    replacementSku: 'FPR1140-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco ASA 5516-X End-of-Support. Reemplazo 2.2Gbps NGFW: FPR1140-NGFW-K9.',
    canKeepOriginal: false,
  },
  'ASA5525-X': {
    legacySku: 'ASA5525-X',
    replacementSku: 'FPR3105-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco ASA 5525-X End-of-Support. Reemplazo Data Center/HQ: FPR3105-NGFW-K9 (10Gbps).',
    canKeepOriginal: false,
  },
  'ASA5545-X': {
    legacySku: 'ASA5545-X',
    replacementSku: 'FPR3110-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco ASA 5545-X End-of-Support. Reemplazo alta capacidad: FPR3110-NGFW-K9 (17Gbps).',
    canKeepOriginal: false,
  },
  'ASA5555-X': {
    legacySku: 'ASA5555-X',
    replacementSku: 'FPR3120-NGFW-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco ASA 5555-X End-of-Support. Reemplazo: FPR3120-NGFW-K9 (21Gbps).',
    canKeepOriginal: false,
  },

  // Firepower 2100 (Transición hacia Firepower 3100 Series)
  'FPR2110-NGFW-K9': {
    legacySku: 'FPR2110-NGFW-K9',
    replacementSku: 'FPR3105-NGFW-K9',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Firepower 2110 transición recomendada: Firepower 3105 con arquitectura modular y mayor cifrado TLS.',
    canKeepOriginal: true,
  },
  'FPR2130-NGFW-K9': {
    legacySku: 'FPR2130-NGFW-K9',
    replacementSku: 'FPR3110-NGFW-K9',
    status: 'active_with_newer_gen',
    eosYear: 2025,
    eolNote: 'Firepower 2130 transición recomendada: Firepower 3110.',
    canKeepOriginal: true,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (FPR 1010, FPR 1120, FPR 3105, DUO, UMBRELLA)
// ----------------------------------------------------------------------------
export const securitySaseChassisRules: Record<string, ChassisConfigRule> = {
  // Cisco Secure Firewall 1120 1RU
  'FPR1120-NGFW-K9': {
    parentSku: 'FPR1120-NGFW-K9',
    family: 'firewall_fpr',
    description: 'Cisco Firepower 1120 NGFW Appliance, 1RU, 8x 1GE RJ45, 4x 1GE SFP',
    estimatedListUsd: 3995,
    defaultSubItems: (opts) => [
      {
        partNumber: 'FPR1120-PWR-AC',
        qtyMultiplier: 1,
        description: 'AC Power Supply for Firepower 1120',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'Power Cord AC for Chile/Italy standard',
        category: 'power_cord',
      },
      {
        partNumber: 'L-FPR1120T-TMC-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Firepower 1120 Threat, Malware and URL Filtering 3Y Term License',
        category: 'dna_license',
      },
    ],
  },

  // Cisco Secure Firewall 3105 Enterprise/Data Center NGFW
  'FPR3105-NGFW-K9': {
    parentSku: 'FPR3105-NGFW-K9',
    family: 'firewall_fpr',
    description: 'Cisco Secure Firewall 3105 Appliance, 1RU, 16x 10M/100M/1G, 8x 1G/10G/25G',
    estimatedListUsd: 14500,
    defaultSubItems: (opts) => [
      {
        partNumber: 'FPR3K-PWR-AC-650',
        qtyMultiplier: 2,
        description: '650W AC Redundant Power Supply for Firepower 3100',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || (opts.powerCordStandard === 'rack_pdu' ? 'CAB-C13-C14-2M' : 'CAB-ACE'),
        qtyMultiplier: 2,
        description: 'AC Power Cord for FPR 3100',
        category: 'power_cord',
      },
      {
        partNumber: 'L-FPR3105T-TMC-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco FPR 3105 Threat, Malware and URL Filtering 3Y Subscription',
        category: 'dna_license',
      },
    ],
  },

  // Meraki Z4 Teleworker Gateway
  'Z4-HW': {
    parentSku: 'Z4-HW',
    family: 'meraki_z',
    description: 'Cisco Meraki Z4 Cloud Managed Teleworker Gateway Wi-Fi 6 with PoE',
    estimatedListUsd: 695,
    defaultSubItems: () => [
      {
        partNumber: 'LIC-Z-ENT-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki Z-Series Enterprise License, 3 Years',
        category: 'dna_license',
      },
    ],
  },
};

export const securitySasePackage: RuleModulePackage = {
  domainName: 'Seguridad y SASE',
  eolEntries: securitySaseEolEntries,
  chassisRules: securitySaseChassisRules,
};
