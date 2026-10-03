// ============================================================================
// 6. COLABORACIÓN Y COMUNICACIONES UNIFICADAS - REGLAS DE CATÁLOGO Y EOL 2026
// Cisco IP Phones 6800/7800/8800/9800, Webex Devices Room Kits, Webex Calling, Headsets
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  RuleModulePackage,
  SubItemConfig,
} from './types';

// ----------------------------------------------------------------------------
// EOL MAPPINGS (TELÉFONOS IP 7900 / 6900 Y CODECS TELEPRESENCE SX10 / SX20)
// ----------------------------------------------------------------------------
export const collaborationEolEntries: Record<string, EolMappingEntry> = {
  // Teléfonos IP Clásicos Cisco 7900 (End-of-Support -> Series 7800 / 8800 / 9800)
  'CP-7940G': {
    legacySku: 'CP-7940G',
    replacementSku: 'CP-7841-K9',
    status: 'eos_eol_active',
    eosYear: 2018,
    eolNote: 'Cisco 7940G End-of-Support. Reemplazo empresarial 4-Líneas Gigabit: Cisco IP Phone 7841.',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/unified-ip-phone-7800-series/index.html',
  },
  'CP-7942G': {
    legacySku: 'CP-7942G',
    replacementSku: 'CP-7841-K9',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Cisco 7942G End-of-Support. Reemplazo directo: Cisco IP Phone 7841.',
    canKeepOriginal: false,
  },
  'CP-7960G': {
    legacySku: 'CP-7960G',
    replacementSku: 'CP-8841-K9',
    status: 'eos_eol_active',
    eosYear: 2018,
    eolNote: 'Cisco 7960G End-of-Support. Reemplazo Color Display HD Audio: Cisco IP Phone 8841.',
    canKeepOriginal: false,
  },
  'CP-7962G': {
    legacySku: 'CP-7962G',
    replacementSku: 'CP-8851-K9',
    status: 'eos_eol_active',
    eosYear: 2020,
    eolNote: 'Cisco 7962G End-of-Support. Reemplazo Ejecutivo con Bluetooth: Cisco IP Phone 8851.',
    canKeepOriginal: false,
  },

  // Codecs TelePresence SX10 / SX20 (End-of-Sale -> Cisco Room Bar / Room Kit)
  'CTS-SX10-K9': {
    legacySku: 'CTS-SX10-K9',
    replacementSku: 'CS-BAR-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'TelePresence SX10 End-of-Sale. Reemplazo moderno 4K con IA y micrófonos integrados: Cisco Room Bar (CS-BAR-K9).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/collaboration-endpoints/webex-room-bar/index.html',
  },
  'CTS-SX20-PHD12X-K9': {
    legacySku: 'CTS-SX20-PHD12X-K9',
    replacementSku: 'CS-ROOM-KIT-K9',
    status: 'eos_eol_active',
    eosYear: 2021,
    eolNote: 'TelePresence SX20 End-of-Sale. Reemplazo para salas medianas: Cisco Webex Room Kit (CS-ROOM-KIT-K9).',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (TELÉFONOS 8851, ROOM BAR, WEBEX CALLING)
// ----------------------------------------------------------------------------
export const collaborationChassisRules: Record<string, ChassisConfigRule> = {
  // Teléfono IP Ejecutivo Cisco 8851 con Audio HD y Bluetooth
  'CP-8851-K9': {
    parentSku: 'CP-8851-K9',
    family: 'cisco_phones',
    description: 'Cisco IP Phone 8851 with Color Display, USB and Bluetooth',
    estimatedListUsd: 395,
    defaultSubItems: () => [
      {
        partNumber: 'CP-PWR-CUBE-4',
        qtyMultiplier: 1,
        isOptional: true,
        description: 'Power Cube 4 for Cisco IP Phone 8800 Series (if not using PoE)',
        category: 'power_supply',
      },
    ],
  },

  // Cisco Room Bar para salas de reuniones pequeñas/medianas
  'CS-BAR-K9': {
    parentSku: 'CS-BAR-K9',
    family: 'webex_devices',
    description: 'Cisco Webex Room Bar Video Conferencing System with 4K Camera and Microphone Array',
    estimatedListUsd: 3795,
    defaultSubItems: () => [
      {
        partNumber: 'CS-T10-TS-K9',
        qtyMultiplier: 1,
        description: 'Cisco Webex Room Navigator Tabletop Touch Control Unit 10-inch',
        category: 'server_component',
      },
      {
        partNumber: 'CAB-ETH-5M-GR',
        qtyMultiplier: 1,
        description: 'Ethernet Cable 5M Grey for Touch Navigator',
        category: 'power_cord',
      },
    ],
  },
};

export const collaborationPackage: RuleModulePackage = {
  domainName: 'Colaboración y Comunicaciones Unificadas',
  eolEntries: collaborationEolEntries,
  chassisRules: collaborationChassisRules,
};
