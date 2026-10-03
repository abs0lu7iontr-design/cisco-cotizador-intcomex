// ============================================================================
// 7. IOT E INDUSTRIAL NETWORKING - REGLAS DE CATÁLOGO, ENSAMBLE Y EOL 2026
// Catalyst IE3100-IE9300, Industrial Routers IR1101/IR1800, Meraki MT/MV, IW9160
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  RuleModulePackage,
  SubItemConfig,
} from './types';

// ----------------------------------------------------------------------------
// EOL MAPPINGS (SWITCHES IE-2000 / IE-3000 Y ROUTERS C819 A PLATAFORMAS IE/IR)
// ----------------------------------------------------------------------------
export const industrialIotEolEntries: Record<string, EolMappingEntry> = {
  // Switches Industriales Legacy (IE-2000 / IE-3000 -> Catalyst IE-3100 / IE-3200 / IE-3300)
  'IE-2000-8TC-B': {
    legacySku: 'IE-2000-8TC-B',
    replacementSku: 'IE-3100-8T2C-E',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Industrial Ethernet IE-2000 End-of-Sale. Reemplazo DIN-Rail compacto: Catalyst IE-3100 8T2C.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3100-rugged-series/index.html',
  },
  'IE-2000-16TC-B': {
    legacySku: 'IE-2000-16TC-B',
    replacementSku: 'IE-3200-8T2S-E',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Industrial Ethernet IE-2000 16-Port End-of-Sale. Reemplazo Gigabit: Catalyst IE-3200.',
    canKeepOriginal: false,
  },
  'IE-3000-8TC': {
    legacySku: 'IE-3000-8TC',
    replacementSku: 'IE-3300-8T2S-E',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Industrial Ethernet IE-3000 End-of-Support. Reemplazo modular expandible: Catalyst IE-3300.',
    canKeepOriginal: false,
  },

  // Routers Industriales Celulares Legacy (C819 / IR829 -> Catalyst IR1101 / IR1800)
  'C819G-4G-GA-K9': {
    legacySku: 'C819G-4G-GA-K9',
    replacementSku: 'IR1101-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'Cisco 819 4G LTE End-of-Support. Reemplazo modular 5G Ready: Catalyst IR1101 Rugged Router.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/routers/1101-industrial-integrated-services-router/index.html',
  },
  'IR829B-2LTE-EA-AK9': {
    legacySku: 'IR829B-2LTE-EA-AK9',
    replacementSku: 'IR1821-K9',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco IR829 Dual LTE End-of-Sale. Reemplazo automotriz/ferroviario: Catalyst IR1821.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (CATALYST IE-3400, IR1101, MERAKI MV/MT)
// ----------------------------------------------------------------------------
export const industrialIotChassisRules: Record<string, ChassisConfigRule> = {
  // Catalyst Industrial Ethernet IE-3400 Heavy Duty Rugged Switch
  'IE-3400-8P2S-A': {
    parentSku: 'IE-3400-8P2S-A',
    family: 'industrial_ie',
    description: 'Cisco Catalyst IE3400 Rugged Series, 8x GE PoE+, 2x 1G SFP Uplinks, Network Advantage',
    estimatedListUsd: 3100,
    defaultSubItems: () => [
      {
        partNumber: 'PWR-IE170W-PC-AC',
        qtyMultiplier: 1,
        description: '170W AC-DC DIN-Rail Power Supply for Industrial Ethernet PoE',
        category: 'power_supply',
      },
      {
        partNumber: 'IE-DNA-A',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco DNA Advantage Term License for IE3400 3Y',
        category: 'dna_license',
      },
    ],
  },

  // Catalyst Industrial Router IR1101 Modular IoT Gateway
  'IR1101-K9': {
    parentSku: 'IR1101-K9',
    family: 'industrial_ir',
    description: 'Cisco Catalyst IR1101 Rugged Series Modular Industrial Router with Base Unit',
    estimatedListUsd: 1850,
    defaultSubItems: () => [
      {
        partNumber: 'PWR-IE50W-AC',
        qtyMultiplier: 1,
        description: '50W AC DIN-Rail Power Supply for IR1101',
        category: 'power_supply',
      },
      {
        partNumber: 'P-LTEAP18-GL',
        qtyMultiplier: 1,
        description: 'Pluggable Interface Module 4G LTE Advanced Pro Cat18 Global',
        category: 'server_component',
      },
    ],
  },

  // Meraki MV63 Outdoor 4K Smart Camera
  'MV63-HW': {
    parentSku: 'MV63-HW',
    family: 'meraki_mv',
    description: 'Cisco Meraki MV63 Outdoor HD/4K Smart Infrared Varifocal Bullet Camera',
    estimatedListUsd: 1495,
    defaultSubItems: () => [
      {
        partNumber: 'LIC-MV-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki MV Enterprise Cloud License and Support, 3 Years',
        category: 'dna_license',
      },
    ],
  },

  // Meraki MT10 IoT Sensor de Temperatura y Humedad
  'MT10-HW': {
    parentSku: 'MT10-HW',
    family: 'meraki_mt',
    description: 'Cisco Meraki MT10 Cloud Managed Indoor Temperature & Humidity IoT Sensor',
    estimatedListUsd: 195,
    defaultSubItems: () => [
      {
        partNumber: 'LIC-MT-3Y',
        qtyMultiplier: 1,
        durationMonths: 36,
        description: 'Cisco Meraki MT Cloud License, 3 Years',
        category: 'dna_license',
      },
    ],
  },
};

export const industrialIotPackage: RuleModulePackage = {
  domainName: 'IoT e Industrial Networking',
  eolEntries: industrialIotEolEntries,
  chassisRules: industrialIotChassisRules,
};
