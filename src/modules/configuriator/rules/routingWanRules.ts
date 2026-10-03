// ============================================================================
// 1. ROUTING Y WAN - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Catalyst 8000, ASR 1000/9000, ISR 1000/4000, NCS 500/5000, Meraki MX, Cisco 8000
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
// EOL MAPPINGS (TRANSICIÓN DE ROUTERS OBSOLETOS A PLATAFORMAS 2026 VIGENTES)
// ----------------------------------------------------------------------------
export const routingWanEolEntries: Record<string, EolMappingEntry> = {
  // ISR 4000 Series (EOL Cisco 2023-2024 -> Catalyst 8200 / 8300)
  'ISR4321/K9': {
    legacySku: 'ISR4321/K9',
    replacementSku: 'C8200-1N-4T',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Cisco ISR 4321 End-of-Sale oficial. Reemplazo SD-WAN Edge 2026: Catalyst 8200 1N 4x1G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8200-series-edge-platforms/index.html',
  },
  'ISR4331/K9': {
    legacySku: 'ISR4331/K9',
    replacementSku: 'C8300-1N1S-4T2X',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Cisco ISR 4331 End-of-Sale oficial. Reemplazo WAN Edge 10G 2026: Catalyst 8300 1N1S 4x1G 2x10G.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/catalyst-8300-series-edge-platforms/index.html',
  },
  'ISR4351/K9': {
    legacySku: 'ISR4351/K9',
    replacementSku: 'C8300-2N2S-4T2X',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Cisco ISR 4351 End-of-Sale. Reemplazo modular alto rendimiento: Catalyst 8300 2N2S.',
    canKeepOriginal: false,
  },
  'ISR4431/K9': {
    legacySku: 'ISR4431/K9',
    replacementSku: 'C8300-2N2S-4T2X',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Cisco ISR 4431 End-of-Sale. Reemplazo directo: Catalyst 8300 2N2S 4x1G 2x10G.',
    canKeepOriginal: false,
  },
  'ISR4451/K9': {
    legacySku: 'ISR4451/K9',
    replacementSku: 'C8500-12X',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Cisco ISR 4451 End-of-Sale. Reemplazo agregación: Catalyst 8500 Edge Platform.',
    canKeepOriginal: false,
  },

  // ISR 1900 / 2900 / 3900 Legacy (Fin de soporte -> Catalyst 8200 / ISR 1100)
  'CISCO2911/K9': {
    legacySku: 'CISCO2911/K9',
    replacementSku: 'C8200-1N-4T',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Cisco 2911 End-of-Support. Reemplazo SD-WAN Enterprise: Catalyst 8200.',
    canKeepOriginal: false,
  },
  'CISCO2921/K9': {
    legacySku: 'CISCO2921/K9',
    replacementSku: 'C8300-1N1S-4T2X',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Cisco 2921 End-of-Support. Reemplazo directo: Catalyst 8300.',
    canKeepOriginal: false,
  },
  'CISCO1941/K9': {
    legacySku: 'CISCO1941/K9',
    replacementSku: 'C1111-8P',
    status: 'eos_eol_active',
    eosYear: 2019,
    eolNote: 'Cisco 1941 End-of-Support. Reemplazo sucursal compacta: ISR 1111 8P PoE.',
    canKeepOriginal: false,
  },

  // Meraki MX Legacy (Fin de venta -> Meraki MX Nueva Generación)
  'MX64-HW': {
    legacySku: 'MX64-HW',
    replacementSku: 'MX67-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX64 End-of-Sale. Reemplazo directo 450Mbps: Meraki MX67-HW.',
    canKeepOriginal: false,
  },
  'MX65-HW': {
    legacySku: 'MX65-HW',
    replacementSku: 'MX68-HW',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Meraki MX65 End-of-Sale. Reemplazo directo con PoE: Meraki MX68-HW.',
    canKeepOriginal: false,
  },
  'MX84-HW': {
    legacySku: 'MX84-HW',
    replacementSku: 'MX85-HW',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Meraki MX84 End-of-Sale. Reemplazo 1Gbps / 10G SFP+: Meraki MX85-HW.',
    canKeepOriginal: false,
  },
  'MX100-HW': {
    legacySku: 'MX100-HW',
    replacementSku: 'MX95-HW',
    status: 'eos_eol_active',
    eosYear: 2023,
    eolNote: 'Meraki MX100 End-of-Sale. Reemplazo alta capacidad 2Gbps: Meraki MX95-HW.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (REGLAS DE ENSAMBLE MADRE-HIJO VIGENTES 2026)
// ----------------------------------------------------------------------------
export const routingWanChassisRules: Record<string, ChassisConfigRule> = {
  // Catalyst 8200 Series Edge Platform
  'C8200-1N-4T': {
    parentSku: 'C8200-1N-4T',
    family: 'catalyst8000',
    description: 'Cisco Catalyst 8200 Series Edge Platform 1 NIM slot, 4x 1GE WAN/LAN ports',
    estimatedListUsd: 2950,
    defaultSubItems: (opts) => [
      {
        partNumber: 'C8200-DNA-P',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Catalyst 8200 Cisco DNA Premier Term 3Y Subscription',
        category: 'dna_license',
      },
      {
        partNumber: 'PWR-CC1-100WAC',
        qtyMultiplier: 1,
        description: '100W AC Power Supply for Catalyst 8200',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'AC Power Cord for Chile/Italy standard CEI 23-50 / Type L',
        category: 'power_cord',
      },
    ],
  },

  // Catalyst 8300 Series Edge Platform 1N1S
  'C8300-1N1S-4T2X': {
    parentSku: 'C8300-1N1S-4T2X',
    family: 'catalyst8000',
    description: 'Cisco Catalyst 8300 Edge Platform 1 NIM, 1 SM slot, 4x 1GE, 2x 10GE SFP+',
    estimatedListUsd: 5600,
    defaultSubItems: (opts) => [
      {
        partNumber: 'C8300-DNA-A',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Catalyst 8300 Cisco DNA Advantage Term 3Y Subscription',
        category: 'dna_license',
      },
      {
        partNumber: 'PWR-CC1-250WAC',
        qtyMultiplier: 1,
        description: '250W AC Power Supply for Catalyst 8300',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'AC Power Cord for Chile/Italy standard',
        category: 'power_cord',
      },
    ],
  },

  // Cisco ISR 1100 Series Integrated Services Router
  'C1111-8P': {
    parentSku: 'C1111-8P',
    family: 'isr_router',
    description: 'Cisco ISR 1100 8-Port Dual GE WAN Router with 4-Port PoE',
    estimatedListUsd: 1450,
    defaultSubItems: (opts) => [
      {
        partNumber: 'PWR-66W-AC-V2',
        qtyMultiplier: 1,
        description: 'Power Supply 66W AC for Cisco 1100 Series',
        category: 'power_supply',
      },
      {
        partNumber: opts.explicitPowerCordSku || resolvePowerCord(opts.powerCordStandard),
        qtyMultiplier: 1,
        description: 'AC Power Cord for Cisco ISR 1100',
        category: 'power_cord',
      },
    ],
  },

  // Meraki MX68 SD-WAN & Security Appliance
  'MX68-HW': {
    parentSku: 'MX68-HW',
    family: 'meraki_mx',
    description: 'Cisco Meraki MX68 Cloud Managed Security & SD-WAN Appliance with PoE',
    estimatedListUsd: 1195,
    defaultSubItems: (opts) => [
      {
        partNumber: 'LIC-MX68-ENT-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki MX68 Enterprise License and Support, 3 Years',
        category: 'dna_license',
      },
      {
        partNumber: opts.explicitPowerCordSku || (opts.powerCordStandard === 'italy_chile' ? 'MA-PWR-CORD-IT' : 'CAB-ACE'),
        qtyMultiplier: 1,
        description: 'Meraki AC Power Cord Standard',
        category: 'power_cord',
      },
    ],
  },

  // Meraki MX85 SD-WAN Appliance 1Gbps / 10G SFP+
  'MX85-HW': {
    parentSku: 'MX85-HW',
    family: 'meraki_mx',
    description: 'Cisco Meraki MX85 Cloud Managed Security & SD-WAN Appliance 1Gbps',
    estimatedListUsd: 2795,
    defaultSubItems: (opts) => [
      {
        partNumber: 'LIC-MX85-SEC-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki MX85 Advanced Security License and Support, 3 Years',
        category: 'dna_license',
      },
      {
        partNumber: opts.explicitPowerCordSku || (opts.powerCordStandard === 'italy_chile' ? 'MA-PWR-CORD-IT' : 'CAB-ACE'),
        qtyMultiplier: 1,
        description: 'Meraki Power Cord',
        category: 'power_cord',
      },
    ],
  },
};

export const routingWanPackage: RuleModulePackage = {
  domainName: 'Routing y WAN',
  eolEntries: routingWanEolEntries,
  chassisRules: routingWanChassisRules,
};
