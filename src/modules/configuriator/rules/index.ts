// ============================================================================
// CISCO AUTOMATED v2.1 - EXPANDED DOMAIN RULES AGGREGATOR (2026 PORTFOLIO)
// Agrupa y unifica las reglas de catálogo, EOL y ensamble para los 8 dominios:
// 1. Routing y WAN (Catalyst 8000, ASR, ISR, NCS, Meraki MX, Silicon One)
// 2. Switching (Catalyst 9200-9600, Meraki MS, Cisco Business, C1200/C1300)
// 3. Data Center y Cómputo (Nexus 9000/3000, MDS SAN, UCS M7, HyperFlex)
// 4. Wireless y Movilidad (Catalyst Wireless 9100/9800, Meraki MR, CBW)
// 5. Seguridad y SASE (Secure Firewall FPR, FMC, Meraki Z, Duo, Umbrella, ISE)
// 6. Colaboración (IP Phones 6800-9800, Webex Devices, Room Bar, CUCM)
// 7. IoT e Industrial (Catalyst IE3100-IE9300, IR1101/IR1800, Meraki MT/MV)
// 8. Observabilidad (ThousandEyes, AppDynamics, Catalyst Center, Nexus Dashboard)
// ============================================================================

export * from './types';
export * from './routingWanRules';
export * from './switchingCampusRules';
export * from './dataCenterComputeRules';
export * from './wirelessMobilityRules';
export * from './securitySaseRules';
export * from './collaborationRules';
export * from './industrialIotRules';
export * from './observabilityRules';

import { EolMappingEntry, ChassisConfigRule, RuleModulePackage } from './types';
import { routingWanPackage } from './routingWanRules';
import { switchingCampusPackage } from './switchingCampusRules';
import { dataCenterComputePackage } from './dataCenterComputeRules';
import { wirelessMobilityPackage } from './wirelessMobilityRules';
import { securitySasePackage } from './securitySaseRules';
import { collaborationPackage } from './collaborationRules';
import { industrialIotPackage } from './industrialIotRules';
import { observabilityPackage } from './observabilityRules';

export const ALL_PRODUCT_DOMAIN_PACKAGES: RuleModulePackage[] = [
  routingWanPackage,
  switchingCampusPackage,
  dataCenterComputePackage,
  wirelessMobilityPackage,
  securitySasePackage,
  collaborationPackage,
  industrialIotPackage,
  observabilityPackage,
];

/**
 * Catálogo consolidado de transiciones EOL/EOS 2026 de todos los dominios
 */
export const MODULAR_EOL_CATALOG_2026: Record<string, EolMappingEntry> = {
  ...routingWanPackage.eolEntries,
  ...switchingCampusPackage.eolEntries,
  ...dataCenterComputePackage.eolEntries,
  ...wirelessMobilityPackage.eolEntries,
  ...securitySasePackage.eolEntries,
  ...collaborationPackage.eolEntries,
  ...industrialIotPackage.eolEntries,
  ...observabilityPackage.eolEntries,
};

/**
 * Catálogo consolidado de reglas de ensamble Madre-Hijo de todos los dominios
 */
export const MODULAR_CHASSIS_RULES: Record<string, ChassisConfigRule> = {
  ...routingWanPackage.chassisRules,
  ...switchingCampusPackage.chassisRules,
  ...dataCenterComputePackage.chassisRules,
  ...wirelessMobilityPackage.chassisRules,
  ...securitySasePackage.chassisRules,
  ...collaborationPackage.chassisRules,
  ...industrialIotPackage.chassisRules,
  ...observabilityPackage.chassisRules,
};
