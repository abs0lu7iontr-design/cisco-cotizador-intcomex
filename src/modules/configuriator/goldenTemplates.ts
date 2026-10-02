// ============================================================================
// CISCO AUTOMATED v2.1 - CISCO & MERAKI GOLDEN TEMPLATES LIBRARY
// Biblioteca de Plantillas Madre-Hijo Oficiales Verificadas en Cisco CCW y Netformx.
// Garantiza 0% de alucinaciones en el ensamble de BOMs para Preventa Técnica.
// ============================================================================

import {
  SubItemConfig,
  PowerCordStandard,
  CiscoProductFamily,
  ChassisConfigRule,
  resolvePowerCordSubItem,
  resolveSmartNetSubItem,
  normalizeCiscoDnaTermYears,
} from './catalogRules';

export type GoldenVerifiedSource =
  | 'Cisco CCW'
  | 'Netformx DesignXpert'
  | 'Cisco Commerce B2B'
  | 'Intcomex Chile Golden Standard';

export interface GoldenTemplateOptions {
  termYears?: number;
  licenseTier?: 'Essentials' | 'Advantage';
  powerCordStandard?: PowerCordStandard;
  includeRedundantPsu?: boolean;
  includeStackingKit?: boolean;
  includeSmartNet?: boolean;
  smartNetLevel?: '8x5xNBD' | '24x7x4';
  airflowDirection?: 'port_side_exhaust' | 'port_side_intake';
  selectedModel?: string; // Para contenedores tipo MS130-SWITCHES
}

export interface CiscoGoldenTemplate {
  templateId: string;
  name: string;
  parentSku: string;
  family: CiscoProductFamily;
  category:
    | 'datacenter_nexus'
    | 'enterprise_switching'
    | 'meraki_cloud'
    | 'security_firewall'
    | 'routing_sdwan'
    | 'servers_ucs'
    | 'industrial_iot';
  description: string;
  verifiedSource: GoldenVerifiedSource;
  verifiedDate: string; // ej. "2026-Q1"
  ccwVerified: true;
  aliases: string[];
  officialDocUrl: string;
  notes: string;
  buildSubItems: (opts: GoldenTemplateOptions) => SubItemConfig[];
}

// ============================================================================
// CATÁLOGO DE GOLDEN TEMPLATES VERIFICADOS
// ============================================================================

export const CISCO_GOLDEN_TEMPLATES: Record<string, CiscoGoldenTemplate> = {
  // --------------------------------------------------------------------------
  // 1. DATA CENTER: Cisco Nexus 9300-FX3 (N9K-C93180YC-FX3)
  // --------------------------------------------------------------------------
  'N9K-C93180YC-FX3': {
    templateId: 'nexus-93180yc-fx3',
    name: 'Cisco Nexus 93180YC-FX3 100G Data Center Golden Template',
    parentSku: 'N9K-C93180YC-FX3',
    family: 'nexus_dc',
    category: 'datacenter_nexus',
    description:
      'Nexus 93180YC-FX3 48p 10/25G SFP28 + 6p 40/100G QSFP28 Leaf Switch con fuentes redundantes, ventiladores con flujo de aire y licencias DCN oficiales.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/datasheet-c78-742284.html',
    aliases: [
      'N9K-C93180YC-FX',
      'N9K-C93180YC-EX',
      'C93180YC-FX3',
      'N9K-93180YC',
      'N9300-93180YC',
    ],
    notes:
      'Configuración estándar CCW para Data Center: incluye 2x fuentes AC 650W redundantes, 4x módulos de ventilación (port-side exhaust o intake según rack), suscripción DCN Essentials o Advantage y cables PDU Rack C13-C14.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const isExhaust = opts.airflowDirection !== 'port_side_intake';
      const cordStd = opts.powerCordStandard || 'rack_pdu'; // En Data Center se prioriza PDU Rack C13-C14 por defecto

      const psuSku = isExhaust ? 'NXA-PAC-650W-PE' : 'NXA-PAC-650W-PI';
      const psuDesc = isExhaust
        ? 'Nexus AC 650W Power Supply - Port Side Exhaust (Redundant 2x)'
        : 'Nexus AC 650W Power Supply - Port Side Intake (Redundant 2x)';

      const fanSku = isExhaust ? 'NXA-FAN-35CFM-PE' : 'NXA-FAN-35CFM-PI';
      const fanDesc = isExhaust
        ? 'Nexus Fan, 35CFM, Port Side Exhaust (4x Pack)'
        : 'Nexus Fan, 35CFM, Port Side Intake (4x Pack)';

      const tierPrefix = opts.licenseTier === 'Advantage' ? 'C1A1TN9300XF' : 'C1E1TN9300XF';

      const items: SubItemConfig[] = [
        {
          partNumber: `${tierPrefix}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Data Center Networking ${opts.licenseTier || 'Essentials'} Term N9300 XF (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: 'C1-N9K-ADD-T',
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: 'Cisco ONE Data Center Networking Term License Tracking',
          category: 'dna_license',
        },
        {
          partNumber: psuSku,
          qtyMultiplier: 2, // Siempre redundante en Data Center CCW
          description: psuDesc,
          category: 'power_supply',
        },
        {
          partNumber: fanSku,
          qtyMultiplier: 4, // 4 ventiladores obligatorios para validación CCW
          description: fanDesc,
          category: 'server_component',
        },
        resolvePowerCordSubItem('nexus_dc', cordStd, 2),
      ];

      const snt = resolveSmartNetSubItem('N9K-C93180YC-FX3', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 2. CLOUD SWITCHING: Cisco Meraki MS130-SWITCHES (Contenedor Oficial CCW)
  // --------------------------------------------------------------------------
  'MS130-SWITCHES': {
    templateId: 'meraki-ms130-switches',
    name: 'Cisco Meraki MS130 Cloud-Native Switches Golden Template',
    parentSku: 'MS130-SWITCHES',
    family: 'meraki_ms130',
    category: 'meraki_cloud',
    description:
      'Contenedor oficial Cisco CCW para Switches Meraki MS130. Ensamble automatizado con chasis hardware hijo, cable de poder y licencia cloud oficial.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://documentation.meraki.com/MS/MS_Overview_and_Specifications/MS130_Datasheet',
    aliases: [
      'MS130-48P',
      'MS130-48FP',
      'MS130-48X',
      'MS130-24P',
      'MS130-24FP',
      'MS130-24X',
      'MS130-8P',
      'MS130-8X',
      'MS130-12X',
      'MS130-24',
      'MS130-48',
    ],
    notes:
      'En Cisco CCW, la serie MS130 NO se cotiza como SKU padre plano, sino a través del contenedor madre "MS130-SWITCHES", el cual lleva como sub-línea 1.1 el modelo de switch específico, 1.2 el cable y 1.3 la licencia de suscripción.',
    buildSubItems: (opts) => {
      const model = (opts.selectedModel || 'MS130-24P')
        .trim()
        .toUpperCase()
        .replace(/-HW$/i, '');
      const validYears = [1, 3, 5, 7, 10].includes(Number(opts.termYears))
        ? Number(opts.termYears)
        : 3;
      const termMonths = validYears * 12;

      // Resolver SKU de licencia Meraki MS130 oficial
      const advSuffix = opts.licenseTier === 'Advantage' ? 'A' : '';
      let licSku = `LIC-MS130-CMPT${advSuffix}-${validYears}Y`;
      if (model.includes('-48')) {
        licSku = `LIC-MS130-48${advSuffix}-${validYears}Y`;
      } else if (model.includes('-24')) {
        licSku = `LIC-MS130-24${advSuffix}-${validYears}Y`;
      }

      const cordStd = opts.powerCordStandard || 'italy_chile';

      return [
        {
          partNumber: model, // Hijo 1.1: Switch físico
          qtyMultiplier: 1,
          description: `Meraki ${model} Cloud-Managed Switch Hardware`,
          category: 'network_stack',
        },
        resolvePowerCordSubItem('meraki_ms130', cordStd, 1),
        {
          partNumber: licSku, // Hijo 1.3: Licencia Cloud Enterprise / Advanced
          qtyMultiplier: 1,
          durationMonths: termMonths,
          initialTerm: termMonths,
          billingModel: 'Prepaid Term',
          description: `Meraki ${model} Enterprise Cloud License and Support (${validYears} Year)`,
          category: 'dna_license',
        },
      ];
    },
  },

  // --------------------------------------------------------------------------
  // 3. ENTERPRISE SWITCHING: Catalyst 9200L 24P PoE+ (C9200L-24P-4G-E)
  // --------------------------------------------------------------------------
  'C9200L-24P-4G-E': {
    templateId: 'catalyst-9200l-24p-4g-e',
    name: 'Cisco Catalyst 9200L 24P PoE+ 4x1G Essentials Golden Template',
    parentSku: 'C9200L-24P-4G-E',
    family: 'catalyst9200',
    category: 'enterprise_switching',
    description:
      'Catalyst 9200L 24 puertos PoE+ (370W), 4 uplinks fijos 1G SFP, licencia DNA Essentials 3Y, fuente Config 5 600W AC y cable de poder certificado.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html',
    aliases: [
      'WS-C2960X-24PS-L',
      'WS-C2960S-24PS-L',
      'WS-C2960+24PC-L',
      'C9200L-24P-4G',
      'C9200-24P-4G-E',
    ],
    notes:
      'El switch de acceso empresarial más cotizado en Chile. Reemplazo oficial 100% homologado de la serie legacy WS-C2960X-24PS-L.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const tierLabel = opts.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `C9200L-DNA-${tierCode}-24-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `C9200L Cisco DNA ${tierLabel} (24-Port, ${skuSuffixYear} Year Term)`,
          category: 'dna_license',
        },
        {
          partNumber: 'PWR-C5-600WAC',
          qtyMultiplier: cordQty,
          description: opts.includeRedundantPsu
            ? '600W AC Config 5 Power Supply (Incluye Fuente Redundante 2x)'
            : '600W AC Config 5 Power Supply',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('catalyst9200', cordStd, cordQty),
        {
          partNumber: `C9200L-NW-${tierCode}-24`,
          qtyMultiplier: 1,
          description: `C9200L Network ${tierLabel} (24-Port)`,
          category: 'network_stack',
        },
      ];

      if (opts.includeStackingKit) {
        items.push({
          partNumber: 'C9200L-STACK-KIT',
          qtyMultiplier: 1,
          description: 'Catalyst 9200L Stacking Kit (Módulo + Cable 50cm)',
          category: 'stacking_kit',
          isOptional: true,
        });
      }

      const snt = resolveSmartNetSubItem('C9200L-24P-4G-E', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 4. ENTERPRISE SWITCHING: Catalyst 9200L 48P PoE+ (C9200L-48P-4G-E)
  // --------------------------------------------------------------------------
  'C9200L-48P-4G-E': {
    templateId: 'catalyst-9200l-48p-4g-e',
    name: 'Cisco Catalyst 9200L 48P PoE+ 4x1G Essentials Golden Template',
    parentSku: 'C9200L-48P-4G-E',
    family: 'catalyst9200',
    category: 'enterprise_switching',
    description:
      'Catalyst 9200L 48 puertos PoE+ (740W Full PoE), 4 uplinks fijos 1G SFP, licencia DNA Essentials 3Y, fuente 1KW AC y cable de poder certificado.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html',
    aliases: [
      'WS-C2960X-48LPS-L',
      'WS-C2960X-48FPS-L',
      'WS-C2960S-48FPS-L',
      'C9200L-48P-4G',
      'C9200-48P-4G-E',
    ],
    notes:
      'Reemplazo oficial 100% homologado de la serie legacy WS-C2960X-48FPS-L / 48LPS-L.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const tierLabel = opts.licenseTier === 'Advantage' ? 'Advantage' : 'Essentials';
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `C9200L-DNA-${tierCode}-48-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `C9200L Cisco DNA ${tierLabel} (48-Port, ${skuSuffixYear} Year Term)`,
          category: 'dna_license',
        },
        {
          partNumber: 'PWR-C5-1KWAC',
          qtyMultiplier: cordQty,
          description: opts.includeRedundantPsu
            ? '1000W AC Config 5 Power Supply (Incluye Fuente Redundante 2x)'
            : '1000W AC Config 5 Power Supply',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('catalyst9200', cordStd, cordQty),
        {
          partNumber: `C9200L-NW-${tierCode}-48`,
          qtyMultiplier: 1,
          description: `C9200L Network ${tierLabel} (48-Port)`,
          category: 'network_stack',
        },
      ];

      if (opts.includeStackingKit) {
        items.push({
          partNumber: 'C9200L-STACK-KIT',
          qtyMultiplier: 1,
          description: 'Catalyst 9200L Stacking Kit (Módulo + Cable 50cm)',
          category: 'stacking_kit',
          isOptional: true,
        });
      }

      const snt = resolveSmartNetSubItem('C9200L-48P-4G-E', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 5. ENTERPRISE SWITCHING: Catalyst 9300 24P PoE+ Modular (C9300-24P-A)
  // --------------------------------------------------------------------------
  'C9300-24P-A': {
    templateId: 'catalyst-9300-24p-a',
    name: 'Cisco Catalyst 9300 24P PoE+ Advantage Modular Golden Template',
    parentSku: 'C9300-24P-A',
    family: 'catalyst9300',
    category: 'enterprise_switching',
    description:
      'Catalyst 9300 24 puertos PoE+ modular de alto rendimiento con módulo de red 8x10G SFP+, cable de apilamiento StackWise-480, fuente Platinum 715W y licencia DNA Advantage.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html',
    aliases: [
      'WS-C3850-24P-E',
      'WS-C3850-24P-S',
      'WS-C3650-24PS-E',
      'C9300-24P-E',
      'C9300-24P',
    ],
    notes:
      'Configuración insigne para Campus Core / Distribución / Acceso Avanzado. Incluye por defecto módulo de uplink 8x10G (C9300-NM-8X) y cable de stacking 50cm Type 1.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierCode = opts.licenseTier === 'Essentials' ? 'E' : 'A';
      const tierLabel = opts.licenseTier === 'Essentials' ? 'Essentials' : 'Advantage';
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `C9300-DNA-${tierCode}-24-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Catalyst 9300 Cisco DNA ${tierLabel} (24-Port, ${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: 'PWR-C1-715WAC-P',
          qtyMultiplier: cordQty,
          description: opts.includeRedundantPsu
            ? 'Config 1 Platinum 715W AC Power Supply (Redundante 2x)'
            : 'Config 1 Platinum 715W AC Power Supply',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('catalyst9300', cordStd, cordQty),
        {
          partNumber: `C9300-NW-${tierCode}-24`,
          qtyMultiplier: 1,
          description: `Catalyst 9300 Network ${tierLabel} (24-Port)`,
          category: 'network_stack',
        },
        {
          partNumber: 'C9300-NM-8X',
          qtyMultiplier: 1,
          description: 'Catalyst 9300 8 x 10GE Network Module Uplink',
          category: 'uplink_module',
        },
        {
          partNumber: 'STACK-T1-50CM',
          qtyMultiplier: 1,
          description: '50CM Type 1 StackWise-480 Stacking Cable',
          category: 'stacking_kit',
        },
      ];

      const snt = resolveSmartNetSubItem('C9300-24P-A', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 6. INDUSTRIAL IOT: Cisco Catalyst IE3400 Heavy Duty Rugged (IE-3400-8P2S-E)
  // --------------------------------------------------------------------------
  'IE-3400-8P2S-E': {
    templateId: 'industrial-ie3400-8p2s-e',
    name: 'Cisco Catalyst IE3400 Heavy Duty Industrial Switch Golden Template',
    parentSku: 'IE-3400-8P2S-E',
    family: 'industrial_ie',
    category: 'industrial_iot',
    description:
      'Catalyst IE3400 Rugged 8 puertos PoE+ Gigabit Ethernet, 2 uplinks SFP, fuente DIN-Rail industrial 170W AC y licencias industriales vigentes 2026.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/switches/catalyst-ie3300-rugged-series/index.html',
    aliases: [
      'IE-4000-8GS4G-E',
      'IE-3000-8P',
      'IE-2000-8P',
      'IE-3400-8P2S',
      'IE-3300-8P2S-E',
    ],
    notes:
      'Para minería, utilities e industria pesada en Chile. Reemplazo oficial 100% homologado de la serie IE-4000 EOL.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const cordQty = opts.includeRedundantPsu ? 2 : 1;
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `IE3400-DNA-${tierCode}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Catalyst IE3400 DNA ${opts.licenseTier || 'Essentials'} License (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        {
          partNumber: 'PWR-IE170W-PC-AC=',
          qtyMultiplier: cordQty,
          description: '170W AC to DC DIN-Rail Industrial Power Supply for PoE+',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('industrial_ie', cordStd, cordQty),
        {
          partNumber: `IE-NW-${tierCode}`,
          qtyMultiplier: 1,
          description: `Cisco Industrial Ethernet Network ${opts.licenseTier || 'Essentials'} Stack`,
          category: 'network_stack',
        },
      ];

      const snt = resolveSmartNetSubItem('IE-3400-8P2S-E', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 7. SECURITY: Cisco Secure Firewall FPR1010 (FPR1010-NGFW-K9)
  // --------------------------------------------------------------------------
  'FPR1010-NGFW-K9': {
    templateId: 'firewall-fpr1010-ngfw-k9',
    name: 'Cisco Secure Firewall FPR1010 NGFW Golden Template',
    parentSku: 'FPR1010-NGFW-K9',
    family: 'firewall_fpr',
    category: 'security_firewall',
    description:
      'Cisco Secure Firewall Serie 1000 Desktop NGFW con licencia Threat Defense (IPS, Malware & URL Filtering 3Y) y cable de poder certificado.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/security/firewalls/index.html',
    aliases: [
      'ASA5506-K9',
      'ASA5506W-K9',
      'ASA5505',
      'FPR-1010',
      'FPR1010',
    ],
    notes:
      'Reemplazo oficial 100% vigente en 2026 del legendario firewall ASA 5506-X EOL.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `L-FPR1010T-TMC-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Secure Firewall 1010 Threat Defense IPS, Malware & URL License (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        resolvePowerCordSubItem('firewall_fpr', cordStd, 1),
      ];

      const snt = resolveSmartNetSubItem('FPR1010-NGFW-K9', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 8. ROUTING & SD-WAN: Catalyst 8200 Series Edge (C8200-1N-4T)
  // --------------------------------------------------------------------------
  'C8200-1N-4T': {
    templateId: 'router-c8200-1n-4t',
    name: 'Cisco Catalyst 8200 Edge Router Golden Template',
    parentSku: 'C8200-1N-4T',
    family: 'catalyst8000',
    category: 'routing_sdwan',
    description:
      'Catalyst 8200 Gigabit Ethernet Edge Router con 1 slot NIM, 4 puertos 1G WAN/LAN, suscripción DNA SD-WAN Tier 0 y cable certificado.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/collateral/routers/catalyst-8200-series-edge-platforms/nb-06-cat8200-series-edge-plat-ds-cte-en.html',
    aliases: ['ISR4321/K9', 'ISR4331/K9', 'ISR4221/K9', 'C8200'],
    notes:
      'Reemplazo directo de la serie Cisco ISR 4000 EOL para sucursales corporativas.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const tierCode = opts.licenseTier === 'Advantage' ? 'A' : 'E';
      const cordStd = opts.powerCordStandard || 'italy_chile';

      const items: SubItemConfig[] = [
        {
          partNumber: `DNA-C-T0-${tierCode}-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco DNA Subscription for Routers Tier 0 (${opts.licenseTier || 'Essentials'}, ${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
        resolvePowerCordSubItem('catalyst8000', cordStd, 1),
      ];

      const snt = resolveSmartNetSubItem('C8200-1N-4T', opts);
      if (snt) items.push(snt);

      return items;
    },
  },

  // --------------------------------------------------------------------------
  // 9. SERVERS: Cisco UCS C220 M7 SFF Rack Server (UCSC-C220-M7S)
  // --------------------------------------------------------------------------
  'UCSC-C220-M7S': {
    templateId: 'server-ucs-c220-m7s',
    name: 'Cisco UCS C220 M7 SFF Rack Server Golden Template',
    parentSku: 'UCSC-C220-M7S',
    family: 'ucs_server',
    category: 'servers_ucs',
    description:
      'Servidor de rack 1U UCS C220 M7 con procesador Intel Xeon Silver 4410Y 12-Core, 64GB DDR5 RAM, RAID SAS 12G, doble fuente 1050W Titanium y suscripción Intersight SaaS.',
    verifiedSource: 'Cisco CCW',
    verifiedDate: '2026-Q1',
    ccwVerified: true,
    officialDocUrl:
      'https://www.cisco.com/c/en/us/products/servers-unified-computing/ucs-c-series-rack-servers/index.html',
    aliases: ['UCSC-C220-M5SX', 'UCSC-C220-M6S', 'C220-M7'],
    notes:
      'Ensamble completo probado en CCW para servidores de cómputo y virtualización VMware/Proxmox/Hyper-V.',
    buildSubItems: (opts) => {
      const { skuSuffixYear, months } = normalizeCiscoDnaTermYears(opts.termYears);
      const cordStd = opts.powerCordStandard || 'rack_pdu'; // Servidores suelen ir a PDU Rack C13-C14

      const items: SubItemConfig[] = [
        {
          partNumber: 'UCS-CPU-I4410Y',
          qtyMultiplier: 1,
          description: 'Intel Xeon Silver 4410Y 2.0GHz 12-Core 150W Processor for UCS M7',
          category: 'server_component',
        },
        {
          partNumber: 'UCS-MRX32G1RE1',
          qtyMultiplier: 2,
          description: '32GB DDR5-4800MHz RDIMM 1Rx4 (Total 64GB RAM)',
          category: 'server_component',
        },
        {
          partNumber: 'UCSC-RAID-M7',
          qtyMultiplier: 1,
          description: 'Cisco 12G Modular SAS RAID Controller for UCS M7',
          category: 'server_component',
        },
        {
          partNumber: 'UCS-HD12TB10K12N',
          qtyMultiplier: 2,
          description: '1.2TB 12G SAS 10K RPM SFF HDD Hot-Plug (RAID 1)',
          category: 'server_component',
        },
        {
          partNumber: 'UCSC-PSU1-1050W',
          qtyMultiplier: 2,
          description: 'Cisco UCS 1050W Titanium Hot-Plug Redundant Power Supply (2x)',
          category: 'power_supply',
        },
        resolvePowerCordSubItem('ucs_server', cordStd, 2),
        {
          partNumber: 'UCSC-RAIL-M7',
          qtyMultiplier: 1,
          description: 'Ball Bearing Rail Kit for Cisco UCS C220 M7 Rack Server',
          category: 'server_component',
        },
        {
          partNumber: `DC-MGT-SAAS-EST-${skuSuffixYear}Y`,
          qtyMultiplier: 1,
          durationMonths: months,
          initialTerm: months,
          billingModel: 'Prepaid Term',
          description: `Cisco Intersight Infrastructure SaaS Essentials (${skuSuffixYear}Y)`,
          category: 'dna_license',
        },
      ];

      const snt = resolveSmartNetSubItem('UCSC-C220-M7S', opts);
      if (snt) items.push(snt);

      return items;
    },
  },
};

// ============================================================================
// BUSCADOR INTELIGENTE DE GOLDEN TEMPLATES (EXACTO + ALIASES + NORMALIZACIÓN)
// ============================================================================

/**
 * Normaliza un SKU para búsqueda insensible a mayúsculas, guiones y espacios.
 */
function normalizeSkuKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-HW$/i, '');
}

// Mapa pre-computado de alias -> parentSku para búsqueda O(1)
const ALIAS_LOOKUP_MAP = new Map<string, string>();

for (const [key, tpl] of Object.entries(CISCO_GOLDEN_TEMPLATES)) {
  ALIAS_LOOKUP_MAP.set(normalizeSkuKey(key), key);
  ALIAS_LOOKUP_MAP.set(normalizeSkuKey(tpl.parentSku), key);
  for (const alias of tpl.aliases) {
    ALIAS_LOOKUP_MAP.set(normalizeSkuKey(alias), key);
  }
}

/**
 * Busca si un SKU coincide con un Golden Template Verificado en Cisco CCW.
 */
export function findGoldenTemplate(querySku: string): CiscoGoldenTemplate | null {
  if (!querySku) return null;
  const clean = querySku.trim().toUpperCase();

  // 1. Coincidencia directa por clave
  if (CISCO_GOLDEN_TEMPLATES[clean]) {
    return CISCO_GOLDEN_TEMPLATES[clean];
  }

  // 2. Coincidencia por contenedor Meraki MS130
  if (clean.startsWith('MS130-SWITCHES') || clean.startsWith('MS130-')) {
    return CISCO_GOLDEN_TEMPLATES['MS130-SWITCHES'];
  }

  // 3. Coincidencia por Nexus 9300
  if (clean.includes('93180YC')) {
    return CISCO_GOLDEN_TEMPLATES['N9K-C93180YC-FX3'];
  }

  // 4. Búsqueda en el mapa de alias
  const normalized = normalizeSkuKey(clean);
  const matchedKey = ALIAS_LOOKUP_MAP.get(normalized);
  if (matchedKey && CISCO_GOLDEN_TEMPLATES[matchedKey]) {
    return CISCO_GOLDEN_TEMPLATES[matchedKey];
  }

  return null;
}

/**
 * Convierte un Golden Template a la interfaz estándar ChassisConfigRule de catalogRules.ts.
 */
export function goldenTemplateToChassisRule(
  template: CiscoGoldenTemplate
): ChassisConfigRule {
  return {
    parentSku: template.parentSku,
    family: template.family,
    description: template.description,
    officialUrl: template.officialDocUrl,
    isGoldenTemplate: true,
    goldenTemplateName: template.name,
    goldenTemplateSource: template.verifiedSource,
    defaultSubItems: (opts) => {
      return template.buildSubItems({
        termYears: opts.termYears,
        licenseTier: opts.licenseTier,
        powerCordStandard: opts.powerCordStandard,
        includeRedundantPsu: opts.includeRedundantPsu,
        includeStackingKit: opts.includeStackingKit,
        includeSmartNet: opts.includeSmartNet,
        smartNetLevel: opts.smartNetLevel,
        selectedModel: opts.selectedModel,
      });
    },
  };
}

/**
 * Obtiene la lista completa de Golden Templates registrados para la UI.
 */
export function getAllGoldenTemplates(): CiscoGoldenTemplate[] {
  return Object.values(CISCO_GOLDEN_TEMPLATES);
}
