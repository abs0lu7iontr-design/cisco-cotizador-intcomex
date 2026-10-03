// ============================================================================
// CISCO AUTOMATED v2.1 - EXPANDED PRODUCT FAMILY RULES TYPES (2026 CATALOG)
// ============================================================================

export type CiscoProductFamily =
  // 1. Routing y WAN
  | 'catalyst8000'
  | 'asr_router'
  | 'isr_router'
  | 'ncs_router'
  | 'cisco8000_silicon'
  | 'meraki_mx'
  // 2. Switching (Enterprise y Campus)
  | 'catalyst9200'
  | 'catalyst9300'
  | 'catalyst9400'
  | 'catalyst9500'
  | 'catalyst9600'
  | 'meraki_ms'
  | 'meraki_ms130'
  | 'meraki_ms225'
  | 'cisco_business'
  | 'catalyst1200_1300'
  // 3. Data Center Networking y Cómputo
  | 'nexus_dc'
  | 'mds_san'
  | 'ucs_server'
  | 'hyperflex'
  // 4. Wireless y Movilidad
  | 'catalyst_wireless'
  | 'meraki_mr'
  | 'cisco_business_wireless'
  // 5. Seguridad
  | 'firewall_fpr'
  | 'meraki_z'
  | 'secure_endpoint'
  | 'duo_security'
  | 'umbrella_security'
  | 'secure_access_sse'
  | 'cisco_ise'
  | 'secure_email'
  | 'secure_web'
  | 'stealthwatch'
  // 6. Colaboración y Comunicaciones Unificadas
  | 'collaboration'
  | 'cisco_phones'
  | 'webex_devices'
  | 'webex_software'
  | 'cucm_collaboration'
  | 'expressway_gateway'
  | 'cisco_headsets'
  // 7. IoT e Industrial Networking
  | 'industrial_ie'
  | 'industrial_ir'
  | 'industrial_iw'
  | 'meraki_mt'
  | 'meraki_mv'
  // 8. Observabilidad y Monitoreo de Red
  | 'thousandeyes'
  | 'appdynamics'
  | 'catalyst_center'
  | 'nexus_dashboard'
  | 'meraki_dashboard'
  // Misceláneos
  | 'accessory'
  | 'generic';

export type PowerCordStandard =
  | 'italy_chile'
  | 'rack_pdu'
  | 'schuko_eu'
  | 'nema_us'
  | 'argentina_iram';

export type EolLifecycleStatus = 'eos_eol_active' | 'active_with_newer_gen' | 'current_2026';

export interface EolMappingEntry {
  legacySku: string;
  replacementSku: string;
  status: EolLifecycleStatus;
  eosYear?: number;
  eolNote: string;
  canKeepOriginal: boolean;
  officialCiscoDocUrl?: string;
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

export interface SubItemConfig {
  partNumber: string;
  qtyMultiplier: number;
  durationMonths?: number;
  initialTerm?: number;
  autoRenewTerm?: number;
  billingModel?: string;
  description: string;
  isOptional?: boolean;
  unitListPriceUsd?: number;
  unitNetPriceUsd?: number;
  discountPct?: number;
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
  powerCordStandard?: PowerCordStandard;
  explicitPowerCordSku?: string;
  merakiLicenseMode?: 'coterm' | 'subscription';
}

export interface ChassisConfigRule {
  parentSku: string;
  family: CiscoProductFamily;
  description: string;
  officialUrl?: string;
  estimatedListUsd?: number;
  isGoldenTemplate?: boolean;
  goldenTemplateName?: string;
  goldenTemplateSource?: string;
  defaultSubItems: (options: ChassisConfigOptions) => SubItemConfig[];
}

export interface RuleModulePackage {
  domainName: string;
  eolEntries: Record<string, EolMappingEntry>;
  chassisRules: Record<string, ChassisConfigRule>;
  canonicalAlternatives?: Record<string, EolAlternative[]>;
}
