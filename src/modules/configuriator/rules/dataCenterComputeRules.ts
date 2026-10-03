// ============================================================================
// 3. DATA CENTER NETWORKING Y CÓMPUTO - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Nexus 9000/3000, MDS 9000 SAN, Servidores UCS Serie X/C/B, HyperFlex
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  RuleModulePackage,
  SubItemConfig,
} from './types';

// ----------------------------------------------------------------------------
// EOL MAPPINGS (NEXUS DC, MDS SAN Y SERVIDORES UCS)
// ----------------------------------------------------------------------------
export const dataCenterComputeEolEntries: Record<string, EolMappingEntry> = {
  // Nexus 9000 Generación 1 & 2 (EX / FX -> FX3 / FX3P 2026)
  'N9K-C93180YC-EX': {
    legacySku: 'N9K-C93180YC-EX',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Nexus 93180YC-EX End-of-Sale oficial Cisco. Reemplazo directo 100G/25G: Nexus 93180YC-FX3.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/nexus-9300-series-switches/index.html',
  },
  'N9K-C93180YC-FX': {
    legacySku: 'N9K-C93180YC-FX',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'active_with_newer_gen',
    eosYear: 2024,
    eolNote: 'Nexus 93180YC-FX transición recomendada. Reemplazo moderno: Nexus 93180YC-FX3 con MACsec 25G.',
    canKeepOriginal: true,
  },
  'N9K-C9372TX': {
    legacySku: 'N9K-C9372TX',
    replacementSku: 'N9K-C93108TC-FX3P',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Nexus 9372TX 10GBase-T End-of-Sale. Reemplazo directo 10G Cobre: Nexus 93108TC-FX3P.',
    canKeepOriginal: false,
  },
  'N9K-C9396PX': {
    legacySku: 'N9K-C9396PX',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Nexus 9396PX End-of-Support. Reemplazo de alta densidad: Nexus 93180YC-FX3.',
    canKeepOriginal: false,
  },

  // Cisco Nexus 3000
  'N3K-C3064PQ-10GE': {
    legacySku: 'N3K-C3064PQ-10GE',
    replacementSku: 'N9K-C93180YC-FX3',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Nexus 3064 End-of-Sale. Reemplazo Data Center Top-of-Rack: Nexus 93180YC-FX3.',
    canKeepOriginal: false,
  },

  // Cisco MDS 9000 SAN Switches (Fibre Channel 8G/16G -> 32G/64G)
  'DS-C9124-K9': {
    legacySku: 'DS-C9124-K9',
    replacementSku: 'DS-C9124V-K9',
    status: 'eos_eol_active',
    eosYear: 2018,
    eolNote: 'Cisco MDS 9124 4G FC End-of-Support. Reemplazo SAN 32G Fibre Channel: MDS 9124V.',
    canKeepOriginal: false,
  },
  'DS-C9148-K9': {
    legacySku: 'DS-C9148-K9',
    replacementSku: 'DS-C9148V-K9',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Cisco MDS 9148 8G FC End-of-Sale. Reemplazo SAN 64G Fibre Channel: MDS 9148V.',
    canKeepOriginal: false,
  },

  // Cisco UCS Servidores M4 / M5 (EOL -> UCS M7 Generación 2026)
  'UCSC-C220-M4S': {
    legacySku: 'UCSC-C220-M4S',
    replacementSku: 'UCSC-C220-M7S',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Servidor UCS C220 M4 End-of-Support. Reemplazo 1U 2-Sockets 2026: UCS C220 M7 (Intel 4th/5th Gen Xeon).',
    canKeepOriginal: false,
  },
  'UCSC-C240-M4SX': {
    legacySku: 'UCSC-C240-M4SX',
    replacementSku: 'UCSC-C240-M7SX',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Servidor UCS C240 M4 2U End-of-Support. Reemplazo 2U alta capacidad: UCS C240 M7.',
    canKeepOriginal: false,
  },
  'UCSB-B200-M4': {
    legacySku: 'UCSB-B200-M4',
    replacementSku: 'UCSX-210C-M7',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Blade Server B200 M4 End-of-Support. Reemplazo de cómputo modular: UCS X-Series X210c M7.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (NEXUS 93108TC, MDS 9124V, UCS C220 M7)
// ----------------------------------------------------------------------------
export const dataCenterComputeChassisRules: Record<string, ChassisConfigRule> = {
  // Nexus 93108TC-FX3P (48x 100M/1G/10GBase-T + 6x 40/100G QSFP28)
  'N9K-C93108TC-FX3P': {
    parentSku: 'N9K-C93108TC-FX3P',
    family: 'nexus_dc',
    description: 'Nexus 9300 with 48p 100M/1/10G BASE-T and 6p 40/100G QSFP28',
    estimatedListUsd: 19800,
    defaultSubItems: (opts) => [
      {
        partNumber: 'NXA-PAC-1100W-PI2',
        qtyMultiplier: 2,
        description: 'Nexus 1100W AC Power Supply, Port-side Intake',
        category: 'power_supply',
      },
      {
        partNumber: 'NXA-FAN-35CFM-PI',
        qtyMultiplier: 4,
        description: 'Nexus Fan 35CFM, Port-side Intake airflow',
        category: 'server_component',
      },
      {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier: 2,
        description: 'Power Cord 250VAC 10A IEC C13-C14 to Rack PDU',
        category: 'power_cord',
      },
      {
        partNumber: 'C1E1TN9300XF-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco DCN Premier Term License 3Y for Nexus 9300',
        category: 'dna_license',
      },
    ],
  },

  // Cisco MDS 9124V 32G Fibre Channel SAN Switch
  'DS-C9124V-K9': {
    parentSku: 'DS-C9124V-K9',
    family: 'mds_san',
    description: 'Cisco MDS 9124V 32G FC Switch with 24 active ports',
    estimatedListUsd: 14500,
    defaultSubItems: () => [
      {
        partNumber: 'DS-CAC-650W',
        qtyMultiplier: 2,
        description: '650W AC Redundant Power Supply for MDS 9100 Series',
        category: 'power_supply',
      },
      {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier: 2,
        description: 'Power Cord C13-C14 2M for Data Center Rack PDU',
        category: 'power_cord',
      },
      {
        partNumber: 'DS-SFP-FC32G-SW',
        qtyMultiplier: 16,
        description: '32G Fibre Channel Shortwave SFP+ Optical Transceiver',
        category: 'transceiver',
      },
    ],
  },

  // Servidor Rack Cisco UCS C220 M7S (Intel Xeon 4th/5th Gen)
  'UCSC-C220-M7S': {
    parentSku: 'UCSC-C220-M7S',
    family: 'ucs_server',
    description: 'Cisco UCS C220 M7 1RU Server with 10 SFF Drive Bays',
    estimatedListUsd: 4800,
    defaultSubItems: () => [
      {
        partNumber: 'UCSC-PSU1-1050W',
        qtyMultiplier: 2,
        description: '1050W AC Platinum Power Supply for UCS C-Series M7',
        category: 'power_supply',
      },
      {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier: 2,
        description: 'Power Cord C13-C14 2M to Rack PDU',
        category: 'power_cord',
      },
      {
        partNumber: 'UCSC-MLOM-C25Q-04',
        qtyMultiplier: 1,
        description: 'Cisco UCS VIC 1467 mLOM Dual-Port 25G Ethernet Adapter',
        category: 'server_component',
      },
    ],
  },
};

export const dataCenterComputePackage: RuleModulePackage = {
  domainName: 'Data Center Networking y Cómputo',
  eolEntries: dataCenterComputeEolEntries,
  chassisRules: dataCenterComputeChassisRules,
};
