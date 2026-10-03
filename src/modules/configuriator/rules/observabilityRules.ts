// ============================================================================
// 8. OBSERVABILIDAD Y MONITOREO DE RED - REGLAS DE CATÁLOGO Y PLATAFORMAS 2026
// ThousandEyes, AppDynamics APM, Catalyst Center (DNA Center), Nexus Dashboard
// ============================================================================

import {
  EolMappingEntry,
  ChassisConfigRule,
  RuleModulePackage,
  SubItemConfig,
} from './types';

// ----------------------------------------------------------------------------
// EOL MAPPINGS (APPLIANCES DNA CENTER GEN 1 -> CATALYST CENTER 2026)
// ----------------------------------------------------------------------------
export const observabilityEolEntries: Record<string, EolMappingEntry> = {
  // DNA Center Appliance Generación 1 (DN1-HW-APL -> DN2-HW-APL / Cloud)
  'DN1-HW-APL': {
    legacySku: 'DN1-HW-APL',
    replacementSku: 'DN2-HW-APL',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco DNA Center Gen 1 End-of-Sale. Reemplazo: Catalyst Center Gen 2 Appliance (DN2-HW-APL).',
    canKeepOriginal: false,
    officialCiscoDocUrl: 'https://www.cisco.com/c/en/us/products/cloud-systems-management/catalyst-center/index.html',
  },
  'DN1-HW-APL-U': {
    legacySku: 'DN1-HW-APL-U',
    replacementSku: 'DN2-HW-APL',
    status: 'eos_eol_active',
    eosYear: 2022,
    eolNote: 'Cisco DNA Center Appliance End-of-Sale. Reemplazo: Catalyst Center Gen 2.',
    canKeepOriginal: false,
  },
};

// ----------------------------------------------------------------------------
// CHASSIS ASSEMBLY RULES (CATALYST CENTER APPLIANCE, THOUSANDEYES)
// ----------------------------------------------------------------------------
export const observabilityChassisRules: Record<string, ChassisConfigRule> = {
  // Cisco Catalyst Center Gen 2 Appliance (Orquestación & Assurance Campus)
  'DN2-HW-APL': {
    parentSku: 'DN2-HW-APL',
    family: 'catalyst_center',
    description: 'Cisco Catalyst Center Gen 2 Hardware Appliance 44 Core Server',
    estimatedListUsd: 45000,
    defaultSubItems: () => [
      {
        partNumber: 'UCSC-PSU1-1050W',
        qtyMultiplier: 2,
        description: '1050W Redundant Power Supply for Catalyst Center Appliance',
        category: 'power_supply',
      },
      {
        partNumber: 'CAB-C13-C14-2M',
        qtyMultiplier: 2,
        description: 'Power Cord C13-C14 to Rack PDU',
        category: 'power_cord',
      },
    ],
  },
};

export const observabilityPackage: RuleModulePackage = {
  domainName: 'Observabilidad y Monitoreo de Red',
  eolEntries: observabilityEolEntries,
  chassisRules: observabilityChassisRules,
};
