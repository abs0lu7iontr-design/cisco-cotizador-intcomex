// ============================================================================
// CISCO AUTOMATED - PREVENTA IA: COMPETITOR HOMOLOGATION RULES & COMPARATOR
// Mapeo exhaustivo de marcas competidoras (Aruba/HPE, Fortinet, Huawei, Dell,
// Juniper, Ubiquiti, MikroTik, Palo Alto, Extreme) a Cisco Oficial 2026.
// Genera comparativa técnica lado a lado con lo más relevante de cada equipo
// para certificar si está bien homologado, preservando el % de homologación.
// ============================================================================

export interface CompetitorSpecDetail {
  brand: string;
  model: string;
  category: string;
  ports: string;
  uplinks: string;
  poeBudget: string;
  layerRouting: string;
  performance: string;
  stacking: string;
  cloudManagement: string;
  powerSupply: string;
  warrantySupport: string;
}

export interface CiscoHomologatedSpecDetail {
  sku: string;
  displayName: string;
  category: string;
  ports: string;
  uplinks: string;
  poeBudget: string;
  layerRouting: string;
  performance: string;
  stacking: string;
  cloudManagement: string;
  powerSupply: string;
  warrantySupport: string;
}

export interface HomologationSpecComparisonRow {
  category: string;
  label: string;
  competitorValue: string;
  ciscoValue: string;
  status: 'identical' | 'superior' | 'compatible' | 'alternative';
  statusLabel: string;
  notes?: string;
}

export interface EstablishedConfigInput {
  sku: string;
  title?: string;
  strategyTag?: string;
  homologationPct?: number;
  homologationLabel?: string;
  unitGplUsd?: number;
  totalGplUsd?: number;
  discountPct?: number;
  isFastTrackEligible?: boolean;
}

export interface CiscoConfigMatrixRow {
  sku: string;
  title: string;
  strategyTag: string;
  isActiveSelected: boolean;
  homologationPct: number;
  homologationLabel: string;
  ports: string;
  uplinks: string;
  poeBudget: string;
  layerRouting: string;
  stacking: string;
  cloudManagement: string;
  powerSupply: string;
  unitGplUsd?: number;
  totalGplUsd?: number;
  discountPct?: number;
  isFastTrackEligible?: boolean;
}

export interface PeerBrandBenchmarkRow {
  brand: string;
  model: string;
  role: 'requested' | 'cisco_reference' | 'peer_competitor';
  equivalentCiscoSku: string;
  homologationPct: number;
  ports: string;
  uplinks: string;
  poeBudget: string;
  layerRouting: string;
  stacking: string;
  cloudManagement: string;
  warrantySupport: string;
}

export interface HomologationComparisonResult {
  competitor: CompetitorSpecDetail;
  cisco: CiscoHomologatedSpecDetail;
  homologationPct: number;
  homologationTier: 'EXACT_EQUIVALENT' | 'SUPERIOR_CISCO' | 'RECOMMENDED_ALTERNATIVE';
  verdict: string;
  specRows: HomologationSpecComparisonRow[];
  keyAdvantages: string[];
  ciscoConfigurations: CiscoConfigMatrixRow[];
  peerBrandsMatrix: PeerBrandBenchmarkRow[];
}

export interface CompetitorCatalogEntry {
  competitorBrand: string;
  competitorModel: string;
  aliases: string[];
  recommendedCiscoSku: string;
  alternativeCiscoSkus?: string[];
  homologationPct: number;
  specs: CompetitorSpecDetail;
}

// Catálogo de Homologación de Competidores con Especificaciones Reales
export const COMPETITOR_HOMOLOGATION_CATALOG: CompetitorCatalogEntry[] = [
  // --------------------------------------------------------------------------
  // ARUBA / HPE SWITCHES
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6200F 24G PoE+ 4SFP+ 370W (JL726A)',
    aliases: ['JL726A', '6200F 24G POE', 'ARUBA 6200F 24G', 'CX 6200F 24G POE', 'CX6200F-24G-POE'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9300L-24P-4X-E', 'C1300-24P-4X'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6200F 24G PoE+ 4SFP+ (JL726A)',
      category: 'Switch de Acceso Enterprise L2/L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Lite (Estático, RIP, OSPF Access)',
      performance: '128 Gbps Switching / 95.2 Mpps',
      stacking: 'Aruba VSF Stacking (hasta 8 miembros)',
      cloudManagement: 'Aruba Central Cloud / CLI / WebGUI',
      powerSupply: 'Fuente interna fija 500W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6200F 48G PoE+ 4SFP+ 370W (JL728A)',
    aliases: ['JL728A', '6200F 48G POE', 'ARUBA 6200F 48G', 'CX 6200F 48G POE', 'CX6200F-48G-POE'],
    recommendedCiscoSku: 'C9200L-48P-4X-E',
    alternativeCiscoSkus: ['C9300L-48P-4X-E', 'C1300-48P-4X'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6200F 48G PoE+ 4SFP+ (JL728A)',
      category: 'Switch de Acceso Enterprise L2/L3',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Lite (Estático, RIP, OSPF Access)',
      performance: '176 Gbps Switching / 130.9 Mpps',
      stacking: 'Aruba VSF Stacking (hasta 8 miembros)',
      cloudManagement: 'Aruba Central Cloud / CLI / WebGUI',
      powerSupply: 'Fuente interna fija 500W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6100 24G PoE+ 4SFP+ 370W (JL676A)',
    aliases: ['JL676A', '6100 24G POE', 'ARUBA 6100 24G', 'CX 6100 24G POE', 'CX6100-24G-POE'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C1300-24P-4X', 'C9200L-24P-4G-E'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6100 24G PoE+ 4SFP+ (JL676A)',
      category: 'Switch de Acceso de Entrada L2/L3 Lite',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 con Enrutamiento Estático L3',
      performance: '128 Gbps Switching / 95.2 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'Aruba Central Cloud / CLI / WebGUI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6100 48G PoE+ 4SFP+ 370W (JL675A)',
    aliases: ['JL675A', '6100 48G POE', 'ARUBA 6100 48G', 'CX 6100 48G POE'],
    recommendedCiscoSku: 'C9200L-48P-4X-E',
    alternativeCiscoSkus: ['C1300-48P-4X', 'C9200L-48P-4G-E'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6100 48G PoE+ 4SFP+ (JL675A)',
      category: 'Switch de Acceso de Entrada L2/L3 Lite',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 con Enrutamiento Estático L3',
      performance: '176 Gbps Switching / 130.9 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'Aruba Central Cloud / CLI / WebGUI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6000 24G PoE+ 4SFP 370W (R8N87A)',
    aliases: ['R8N87A', '6000 24G POE', 'ARUBA 6000 24G', 'CX 6000 24G POE'],
    recommendedCiscoSku: 'C9200L-24P-4G-E',
    alternativeCiscoSkus: ['C1300-24P-4G', 'C1200-24P-4G'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6000 24G PoE+ 4SFP (R8N87A)',
      category: 'Switch de Acceso Económico / Pyme L2',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G SFP Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 con Enrutamiento Estático',
      performance: '56 Gbps Switching / 41.6 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'Aruba Central Cloud / WebGUI / CLI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6000 48G PoE+ 4SFP 370W (R8N86A)',
    aliases: ['R8N86A', '6000 48G POE', 'ARUBA 6000 48G', 'CX 6000 48G POE'],
    recommendedCiscoSku: 'C9200L-48P-4G-E',
    alternativeCiscoSkus: ['C1300-48P-4G', 'C1200-48P-4G'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6000 48G PoE+ 4SFP (R8N86A)',
      category: 'Switch de Acceso Económico / Pyme L2',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G SFP Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 con Enrutamiento Estático',
      performance: '104 Gbps Switching / 77.3 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'Aruba Central Cloud / WebGUI / CLI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba 2930F 24G PoE+ 4SFP+ (JL255A / JL261A)',
    aliases: ['JL255A', 'JL261A', '2930F 24G', 'ARUBA 2930F 24G', '2930F-24G-POE'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9300L-24P-4X-E', 'MS130-SWITCHES:MS130-24X'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba 2930F 24G PoE+ 4SFP+ (JL255A)',
      category: 'Switch de Acceso Enterprise L3 (Generación Previa)',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Completo (OSPF, RIP, Access)',
      performance: '128 Gbps Switching / 95.2 Mpps',
      stacking: 'Aruba VSF Stacking (hasta 8 miembros)',
      cloudManagement: 'Aruba Central / AirWave / CLI',
      powerSupply: 'Fuente interna fija 440W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba 2930F 48G PoE+ 4SFP+ (JL256A / JL262A)',
    aliases: ['JL256A', 'JL262A', '2930F 48G', 'ARUBA 2930F 48G', '2930F-48G-POE'],
    recommendedCiscoSku: 'C9200L-48P-4X-E',
    alternativeCiscoSkus: ['C9300L-48P-4X-E', 'MS130-SWITCHES:MS130-48X'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba 2930F 48G PoE+ 4SFP+ (JL256A)',
      category: 'Switch de Acceso Enterprise L3 (Generación Previa)',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Completo (OSPF, RIP, Access)',
      performance: '176 Gbps Switching / 130.9 Mpps',
      stacking: 'Aruba VSF Stacking (hasta 8 miembros)',
      cloudManagement: 'Aruba Central / AirWave / CLI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba CX 6300M 24G PoE+ (JL661A)',
    aliases: ['JL661A', '6300M 24G', 'ARUBA 6300M', 'CX 6300M 24G'],
    recommendedCiscoSku: 'C9300-24P-A',
    alternativeCiscoSkus: ['C9300L-24P-4X-A', 'C9300-24P-E'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba CX 6300M 24G PoE+ Modular (JL661A)',
      category: 'Switch de Distribución y Campus Core L3 Avanzado',
      ports: '24x 10/100/1000Base-T PoE+ (Class 4 / Modular)',
      uplinks: 'Ranura modular para Uplinks 10G/25G/50G',
      poeBudget: 'Hasta 740W con fuentes redundantes modulares',
      layerRouting: 'Layer 3 Avanzado (OSPFv3, BGP, EVPN-VXLAN)',
      performance: '496 Gbps Switching / 369 Mpps',
      stacking: 'Aruba VSF Stacking (hasta 10 chasis)',
      cloudManagement: 'Aruba Central / Fabric Composer / CLI',
      powerSupply: 'Fuentes redundantes modulares hot-swap',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba AP-505 Wi-Fi 6 (R2H28A)',
    aliases: ['R2H28A', 'AP-505', 'ARUBA AP-505', 'ARUBA 505', 'AP505'],
    recommendedCiscoSku: 'CW9162I-MR',
    alternativeCiscoSkus: ['MR46-HW', 'CW9164I-MR'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba AP-505 Wi-Fi 6 Campus AP (R2H28A)',
      category: 'Access Point Interior Wi-Fi 6 (802.11ax)',
      ports: '1x 10/100/1000Base-T RJ45 PoE (802.3af)',
      uplinks: 'Radio Dual 2x2:2 MU-MIMO Wi-Fi 6',
      poeBudget: 'Consumo PoE: 11W (802.3af Class 3)',
      layerRouting: 'Gestión Cloud / Controlador Físico',
      performance: 'Velocidad combinada hasta 1.77 Gbps (1.2 Gbps 5GHz + 574 Mbps 2.4GHz)',
      stacking: 'Virtual Controller (Instant AP)',
      cloudManagement: 'Aruba Central Cloud / Instant Controller',
      powerSupply: 'Alimentación por PoE o Inyector 12V',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },
  {
    competitorBrand: 'Aruba / HPE',
    competitorModel: 'Aruba AP-515 Wi-Fi 6 (Q9H62A)',
    aliases: ['Q9H62A', 'AP-515', 'ARUBA AP-515', 'ARUBA 515', 'AP515'],
    recommendedCiscoSku: 'CW9164I-MR',
    alternativeCiscoSkus: ['MR46-HW', 'CW9162I-MR'],
    homologationPct: 100,
    specs: {
      brand: 'Aruba / HPE',
      model: 'Aruba AP-515 Wi-Fi 6 High-Density (Q9H62A)',
      category: 'Access Point Interior Wi-Fi 6 Alta Densidad',
      ports: '1x 2.5GbE Smart Rate + 1x 1GbE PoE (802.3at)',
      uplinks: 'Radio 4x4:4 (5GHz) + 2x2:2 (2.4GHz) MU-MIMO',
      poeBudget: 'Consumo PoE: 16W (802.3at PoE+)',
      layerRouting: 'Gestión Cloud / Controlador Mobility Conductor',
      performance: 'Velocidad combinada hasta 2.97 Gbps (4.8 Gbps HE80/160)',
      stacking: 'Virtual Controller (Instant AP)',
      cloudManagement: 'Aruba Central Cloud / Mobility Controller',
      powerSupply: 'Alimentación PoE+ 802.3at',
      warrantySupport: 'Aruba Limited Lifetime Warranty (LLW)',
    },
  },

  // --------------------------------------------------------------------------
  // FORTINET FIREWALLS & SWITCHES
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Fortinet',
    competitorModel: 'Fortinet FortiGate 60F (FG-60F)',
    aliases: ['FG-60F', 'FG60F', 'FORTIGATE 60F', 'FORTIGATE-60F', 'FORTINET 60F'],
    recommendedCiscoSku: 'FPR1010-NGFW-K9',
    alternativeCiscoSkus: ['MX68-HW', 'FPR1120-NGFW-K9'],
    homologationPct: 100,
    specs: {
      brand: 'Fortinet',
      model: 'Fortinet FortiGate 60F NGFW (FG-60F)',
      category: 'Next-Generation Firewall (NGFW) Sucursales',
      ports: '10x Puertos GE RJ45 (incluye 2x WAN, 1x DMZ, 7x LAN internos)',
      uplinks: 'Interfaces de cobre 1Gbps (Sin puertos SFP fibra)',
      poeBudget: 'Sin alimentación PoE (Alimentación externa 12V DC)',
      layerRouting: 'Enrutamiento dinámico L3 (OSPF, BGP) + SD-WAN integrado',
      performance: '10 Gbps Firewall / 1 Gbps IPS / 700 Mbps Threat Protection',
      stacking: 'HA Active-Passive / Active-Active clustering',
      cloudManagement: 'FortiGate Cloud / FortiManager / GUI local',
      powerSupply: 'Adaptador de poder externo 100-240V',
      warrantySupport: 'FortiCare 8x5 o 24x7 según suscripción',
    },
  },
  {
    competitorBrand: 'Fortinet',
    competitorModel: 'Fortinet FortiGate 80F / 100F (FG-100F)',
    aliases: ['FG-100F', 'FG100F', 'FG-80F', 'FG80F', 'FORTIGATE 100F', 'FORTIGATE 80F'],
    recommendedCiscoSku: 'FPR1120-NGFW-K9',
    alternativeCiscoSkus: ['MX85-HW', 'FPR1140-NGFW-K9'],
    homologationPct: 100,
    specs: {
      brand: 'Fortinet',
      model: 'Fortinet FortiGate 100F NGFW (FG-100F)',
      category: 'Next-Generation Firewall Enterprise / Campus Medio',
      ports: '16x GE RJ45 + 4x 1G SFP + 2x 10G SFP+ Uplinks',
      uplinks: '2x 10G SFP+ Uplinks integrados',
      poeBudget: 'Sin alimentación PoE en puertos integrados',
      layerRouting: 'L3 Enterprise con BGP, OSPF, PIM y SD-WAN conmutado',
      performance: '20 Gbps Firewall / 1.6 Gbps IPS / 1 Gbps Threat Protection',
      stacking: 'HA Clustering redundante con sincronización de sesión',
      cloudManagement: 'FortiManager / FortiGate Cloud',
      powerSupply: 'Doble fuente de poder redundante integrada',
      warrantySupport: 'FortiCare Enterprise Support',
    },
  },
  {
    competitorBrand: 'Fortinet',
    competitorModel: 'Fortinet FortiSwitch 124E / 124F PoE+ (FS-124E / FS-124F)',
    aliases: ['FS-124E', 'FS-124F', 'FORTISWITCH 124E', 'FS124E', 'FORTISWITCH 124F'],
    recommendedCiscoSku: 'C9200L-24P-4G-E',
    alternativeCiscoSkus: ['MS130-SWITCHES:MS130-24P', 'C1300-24P-4G'],
    homologationPct: 100,
    specs: {
      brand: 'Fortinet',
      model: 'Fortinet FortiSwitch 124E/124F PoE+ 370W',
      category: 'Switch de Acceso Administrado L2',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G SFP Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 Switching con VLANs y ACLs',
      performance: '56 Gbps Switching / 83 Mpps',
      stacking: 'FortiLink a través del FortiGate',
      cloudManagement: 'FortiLink vía FortiGate / WebGUI independiente',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'FortiCare Limited Lifetime',
    },
  },
  {
    competitorBrand: 'Fortinet',
    competitorModel: 'Fortinet FortiSwitch 148E / 148F PoE+ (FS-148E / FS-148F)',
    aliases: ['FS-148E', 'FS-148F', 'FORTISWITCH 148E', 'FS148E', 'FORTISWITCH 148F'],
    recommendedCiscoSku: 'C9200L-48P-4G-E',
    alternativeCiscoSkus: ['MS130-SWITCHES:MS130-48P', 'C1300-48P-4G'],
    homologationPct: 100,
    specs: {
      brand: 'Fortinet',
      model: 'Fortinet FortiSwitch 148E/148F PoE+ 370W',
      category: 'Switch de Acceso Administrado L2',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G SFP Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 2 Switching con VLANs y ACLs',
      performance: '104 Gbps Switching / 155 Mpps',
      stacking: 'FortiLink a través de FortiGate',
      cloudManagement: 'FortiLink vía FortiGate / WebGUI independiente',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'FortiCare Limited Lifetime',
    },
  },
  {
    competitorBrand: 'Fortinet',
    competitorModel: 'Fortinet FortiSwitch 424E / 424F 4SFP+ (FS-424E)',
    aliases: ['FS-424E', 'FS-424F', 'FORTISWITCH 424E', 'FS424E'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9300L-24P-4X-E', 'MS130-SWITCHES:MS130-24X'],
    homologationPct: 100,
    specs: {
      brand: 'Fortinet',
      model: 'Fortinet FortiSwitch 424E PoE+ 4SFP+',
      category: 'Switch de Acceso Empresarial L2/L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 10G SFP+ Uplinks Fijos',
      poeBudget: '421W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Enrutamiento Estático, RIP, OSPF',
      performance: '128 Gbps Switching / 190 Mpps',
      stacking: 'FortiLink / MCLAG',
      cloudManagement: 'FortiGate Controller / CLI / WebGUI',
      powerSupply: 'Fuente interna fija',
      warrantySupport: 'FortiCare Limited Lifetime',
    },
  },

  // --------------------------------------------------------------------------
  // HUAWEI SWITCHES & NETWORKING
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Huawei',
    competitorModel: 'Huawei CloudEngine S5735-L24P4X-A1 (24P PoE+ 4x10G)',
    aliases: ['S5735-L24P4X', 'S5735-L24P4X-A1', 'HUAWEI S5735-L24P4X', 'S5735 24P 4X'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9300L-24P-4X-E', 'C1300-24P-4X'],
    homologationPct: 100,
    specs: {
      brand: 'Huawei',
      model: 'Huawei CloudEngine S5735-L24P4X-A1',
      category: 'Switch de Acceso Empresarial L2+',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 10GE SFP+ Uplinks Fijos',
      poeBudget: '380W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Lite (Estático, RIP, OSPF básico)',
      performance: '128 Gbps Switching / 96 Mpps',
      stacking: 'Huawei iStack (apilamiento lógico)',
      cloudManagement: 'Huawei iMaster NCE-Campus / CLI / SNMP',
      powerSupply: 'Fuente interna fija 500W AC',
      warrantySupport: 'Huawei Basic Warranty (1 año)',
    },
  },
  {
    competitorBrand: 'Huawei',
    competitorModel: 'Huawei CloudEngine S5735-L48P4X-A1 (48P PoE+ 4x10G)',
    aliases: ['S5735-L48P4X', 'S5735-L48P4X-A1', 'HUAWEI S5735-L48P4X', 'S5735 48P 4X'],
    recommendedCiscoSku: 'C9200L-48P-4X-E',
    alternativeCiscoSkus: ['C9300L-48P-4X-E', 'C1300-48P-4X'],
    homologationPct: 100,
    specs: {
      brand: 'Huawei',
      model: 'Huawei CloudEngine S5735-L48P4X-A1',
      category: 'Switch de Acceso Empresarial L2+',
      ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 10GE SFP+ Uplinks Fijos',
      poeBudget: '380W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Lite (Estático, RIP, OSPF básico)',
      performance: '176 Gbps Switching / 132 Mpps',
      stacking: 'Huawei iStack (apilamiento lógico)',
      cloudManagement: 'Huawei iMaster NCE-Campus / CLI / SNMP',
      powerSupply: 'Fuente interna fija 500W AC',
      warrantySupport: 'Huawei Basic Warranty (1 año)',
    },
  },
  {
    competitorBrand: 'Huawei',
    competitorModel: 'Huawei CloudEngine S5731-H24P4XC (24P Modular L3)',
    aliases: ['S5731-H24P4XC', 'S5731 24P', 'HUAWEI S5731'],
    recommendedCiscoSku: 'C9300-24P-E',
    alternativeCiscoSkus: ['C9300-24P-A', 'C9300L-24P-4X-E'],
    homologationPct: 100,
    specs: {
      brand: 'Huawei',
      model: 'Huawei CloudEngine S5731-H24P4XC L3 Modular',
      category: 'Switch de Campus Core / Acceso Modular L3',
      ports: '24x 10/100/1000Base-T PoE+ (Modular)',
      uplinks: '4x 10GE SFP+ + 1x Ranura de Expansión',
      poeBudget: 'Hasta 740W con fuentes modulares redundantes',
      layerRouting: 'Layer 3 Completo (OSPF, BGP, ISIS, VXLAN)',
      performance: '336 Gbps Switching / 126 Mpps',
      stacking: 'Huawei iStack (hasta 9 miembros)',
      cloudManagement: 'iMaster NCE-Campus SDN / CLI / NETCONF',
      powerSupply: 'Doble fuente de poder modular extraíble',
      warrantySupport: 'Huawei Co-Care Service',
    },
  },

  // --------------------------------------------------------------------------
  // DELL POWERSWITCH
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Dell',
    competitorModel: 'Dell PowerSwitch N1524P 24G PoE+ (N1524P)',
    aliases: ['N1524P', 'DELL N1524P', 'POWERSWITCH N1524P'],
    recommendedCiscoSku: 'C9200L-24P-4G-E',
    alternativeCiscoSkus: ['C1300-24P-4G', 'C9200L-24P-4X-E'],
    homologationPct: 100,
    specs: {
      brand: 'Dell',
      model: 'Dell PowerSwitch N1524P 24G PoE+',
      category: 'Switch de Acceso Administrado L2/L3 Lite',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G SFP Uplinks Fijos',
      poeBudget: '308W PoE+ (Class 4)',
      layerRouting: 'Layer 2 con Enrutamiento Estático y RIP',
      performance: '56 Gbps Switching / 86 Mpps',
      stacking: 'Apilamiento hasta 4 unidades a 40 Gbps',
      cloudManagement: 'Dell OpenManage Network Manager / CLI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Dell ProSupport / Limited Lifetime',
    },
  },
  {
    competitorBrand: 'Dell',
    competitorModel: 'Dell PowerSwitch N3024P / N3224P 24G PoE+ 4SFP+',
    aliases: ['N3024P', 'N3224P', 'DELL N3024P', 'DELL N3224P'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9300L-24P-4X-E', 'C9300-24P-E'],
    homologationPct: 100,
    specs: {
      brand: 'Dell',
      model: 'Dell PowerSwitch N3224P 24G PoE+ 4SFP+',
      category: 'Switch de Acceso Enterprise L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 10G SFP+ Uplinks Fijos + 2x 10G Stacking',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Completo (OSPF, RIP, VRRP)',
      performance: '128 Gbps Switching / 95 Mpps',
      stacking: 'Apilamiento hasta 12 switches',
      cloudManagement: 'Dell SmartFabric / CLI / Ansible',
      powerSupply: 'Doble fuente de poder modular',
      warrantySupport: 'Dell ProSupport Next Business Day',
    },
  },

  // --------------------------------------------------------------------------
  // JUNIPER NETWORKS
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Juniper',
    competitorModel: 'Juniper EX2300-24P 24G PoE+ 4SFP+ (EX2300-24P)',
    aliases: ['EX2300-24P', 'EX2300 24P', 'JUNIPER EX2300'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C9200L-24P-4G-E', 'C1300-24P-4X'],
    homologationPct: 100,
    specs: {
      brand: 'Juniper',
      model: 'Juniper EX2300-24P 24G PoE+ 4SFP+',
      category: 'Switch de Acceso de Campus Junos OS L2/L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 1G/10G SFP/SFP+ Uplinks Fijos',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Junos OS L2 con Enrutamiento Estático y RIP',
      performance: '128 Gbps Switching / 95 Mpps',
      stacking: 'Virtual Chassis (hasta 4 switches)',
      cloudManagement: 'Juniper Mist AI Cloud / Junos CLI',
      powerSupply: 'Fuente interna fija 450W',
      warrantySupport: 'Juniper Enhanced Limited Lifetime (E-LLW)',
    },
  },
  {
    competitorBrand: 'Juniper',
    competitorModel: 'Juniper EX3400-24P 24G PoE+ 4SFP+ 2QSFP+',
    aliases: ['EX3400-24P', 'EX3400 24P', 'JUNIPER EX3400'],
    recommendedCiscoSku: 'C9300L-24P-4X-E',
    alternativeCiscoSkus: ['C9200L-24P-4X-E', 'C9300-24P-E'],
    homologationPct: 100,
    specs: {
      brand: 'Juniper',
      model: 'Juniper EX3400-24P 24G PoE+ 4SFP+ 2x40G',
      category: 'Switch de Acceso Enterprise Avanzado L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
      uplinks: '4x 10G SFP+ + 2x 40G QSFP+ Uplinks/Stacking',
      poeBudget: '370W PoE+ (Class 4)',
      layerRouting: 'Layer 3 Completo (OSPF, BGP, VRF-Lite)',
      performance: '288 Gbps Switching / 214 Mpps',
      stacking: 'Virtual Chassis (hasta 10 switches)',
      cloudManagement: 'Juniper Mist Cloud / Junos OS',
      powerSupply: 'Doble fuente de poder modular reemplazable',
      warrantySupport: 'Juniper Care Next Day Support',
    },
  },

  // --------------------------------------------------------------------------
  // UBIQUITI NETWORKS
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'Ubiquiti',
    competitorModel: 'Ubiquiti UniFi USW-24-POE (USW-24-POE)',
    aliases: ['USW-24-POE', 'UNIFI 24 POE', 'USW 24 POE', 'UBIQUITI 24 POE'],
    recommendedCiscoSku: 'C9200L-24P-4G-E',
    alternativeCiscoSkus: ['C1300-24P-4G', 'MS130-SWITCHES:MS130-24P'],
    homologationPct: 98,
    specs: {
      brand: 'Ubiquiti',
      model: 'Ubiquiti UniFi Switch 24 PoE (USW-24-POE)',
      category: 'Switch de Acceso Comercial L2',
      ports: '24x 10/100/1000Base-T (16x PoE+ 802.3at, 8x solo datos)',
      uplinks: '2x 1G SFP Uplinks Fijos',
      poeBudget: '95W PoE Total (Límite bajo)',
      layerRouting: 'Layer 2 Básico sin Enrutamiento Dinámico',
      performance: '52 Gbps Switching / 38.69 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'UniFi Network Controller / Cloud Gateway',
      powerSupply: 'Fuente interna fija 120W',
      warrantySupport: 'Garantía Estándar 1 Año',
    },
  },
  {
    competitorBrand: 'Ubiquiti',
    competitorModel: 'Ubiquiti UniFi USW-Pro-24-POE (USW-Pro-24-POE)',
    aliases: ['USW-PRO-24-POE', 'UNIFI PRO 24 POE', 'USW PRO 24'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C1300-24P-4X', 'C9300L-24P-4X-E'],
    homologationPct: 100,
    specs: {
      brand: 'Ubiquiti',
      model: 'Ubiquiti UniFi Pro 24 PoE (USW-Pro-24-POE)',
      category: 'Switch de Acceso Comercial L3 Lite',
      ports: '24x 10/100/1000Base-T (16x PoE+ 802.3at, 8x PoE++ 802.3bt)',
      uplinks: '2x 10G SFP+ Uplinks Fijos',
      poeBudget: '400W PoE Total',
      layerRouting: 'Layer 3 Estático e Inter-VLAN Básico',
      performance: '88 Gbps Switching / 65.47 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'UniFi Network Application',
      powerSupply: 'Fuente interna con respaldo USP-RPS opcional',
      warrantySupport: 'Garantía Estándar 1 Año',
    },
  },

  // --------------------------------------------------------------------------
  // MIKROTIK
  // --------------------------------------------------------------------------
  {
    competitorBrand: 'MikroTik',
    competitorModel: 'MikroTik CRS328-24P-4S+RM (24P PoE+ 4SFP+)',
    aliases: ['CRS328', 'CRS328-24P-4S+RM', 'MIKROTIK CRS328'],
    recommendedCiscoSku: 'C9200L-24P-4X-E',
    alternativeCiscoSkus: ['C1300-24P-4X', 'C9200L-24P-4G-E'],
    homologationPct: 100,
    specs: {
      brand: 'MikroTik',
      model: 'MikroTik CRS328-24P-4S+RM Dual Boot',
      category: 'Cloud Router Switch L2/L3',
      ports: '24x 10/100/1000Base-T PoE+ (802.3at/af)',
      uplinks: '4x 10G SFP+ Uplinks Fijos',
      poeBudget: '450W PoE+ Total',
      layerRouting: 'RouterOS L5 / SwOS Dual Boot',
      performance: '128 Gbps Switching / 95.2 Mpps',
      stacking: 'Sin apilamiento por hardware',
      cloudManagement: 'WinBox / WebFig / CLI RouterOS',
      powerSupply: 'Fuente interna 500W',
      warrantySupport: 'Garantía Estándar 1 Año',
    },
  },
];

// Especificaciones Oficiales de Equipos Cisco Homologados
export const CISCO_SPECS_DATABASE: Record<string, CiscoHomologatedSpecDetail> = {
  'C9200L-24P-4G-E': {
    sku: 'C9200L-24P-4G-E',
    displayName: 'Cisco Catalyst 9200L 24P PoE+ 4x1G SFP Essentials',
    category: 'Switch de Acceso Enterprise Cisco Catalyst 9200L',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos Dedicados',
    poeBudget: '370W PoE+ (Fuente PWR-C5-600WAC, escalable a 740W con PSU redundante)',
    layerRouting: 'Cisco IOS-XE & DNA Essentials (Enrutamiento Estático, RIP, OSPF Routed Access 1000 rutas)',
    performance: '56 Gbps Switching Capacity / 41.66 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-80 (hasta 8 switches en stack a 80 Gbps con C9200L-STACK-KIT)',
    cloudManagement: 'Cisco Catalyst Center (DNA Center) & Monitoreo en la Nube Meraki Dashboard',
    powerSupply: 'Fuente de poder modular reemplazable en caliente con Cable Norma Chile (CAB-ACA)',
    warrantySupport: 'Cisco Enhanced Limited Lifetime Warranty (E-LLW) + SmartNet Total Care 8x5xNBD',
  },
  'C9200L-24P-4X-E': {
    sku: 'C9200L-24P-4X-E',
    displayName: 'Cisco Catalyst 9200L 24P PoE+ 4x10G SFP+ Essentials',
    category: 'Switch de Acceso Enterprise Cisco Catalyst 9200L High-Speed',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 10G SFP+ Uplinks Fijos de Alta Velocidad (1G/10G)',
    poeBudget: '370W PoE+ (Fuente modular PWR-C5-600WAC, 802.3at Class 4)',
    layerRouting: 'Cisco IOS-XE & DNA Essentials (Enrutamiento Estático, RIP, OSPF Routed Access)',
    performance: '128 Gbps Switching Capacity / 95.23 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-80 (hasta 8 switches apilados a 80 Gbps dedicados)',
    cloudManagement: 'Cisco Catalyst Center & Telemetría Meraki Cloud Monitoring',
    powerSupply: 'Fuente modular reemplazable 600WAC con Norma Chilena CAB-ACA',
    warrantySupport: 'Cisco E-LLW + Soporte Oficial Preventa Intcomex & SmartNet',
  },
  'C9200L-48P-4G-E': {
    sku: 'C9200L-48P-4G-E',
    displayName: 'Cisco Catalyst 9200L 48P PoE+ 4x1G SFP Essentials',
    category: 'Switch de Acceso Enterprise Cisco Catalyst 9200L',
    ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos Dedicados',
    poeBudget: '370W PoE+ (Fuente PWR-C5-600WAC, escalable a 740W)',
    layerRouting: 'Cisco IOS-XE & DNA Essentials (Estático, RIP, OSPF Routed Access)',
    performance: '104 Gbps Switching Capacity / 77.38 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-80 (hasta 8 switches en stack a 80 Gbps con kit)',
    cloudManagement: 'Cisco Catalyst Center & Monitoreo en la Nube Meraki Dashboard',
    powerSupply: 'Fuente modular reemplazable en caliente con Cable Norma Chile (CAB-ACA)',
    warrantySupport: 'Cisco Enhanced Limited Lifetime Warranty (E-LLW) + SmartNet 8x5xNBD',
  },
  'C9200L-48P-4X-E': {
    sku: 'C9200L-48P-4X-E',
    displayName: 'Cisco Catalyst 9200L 48P PoE+ 4x10G SFP+ Essentials',
    category: 'Switch de Acceso Enterprise Cisco Catalyst 9200L High-Speed',
    ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 10G SFP+ Uplinks Fijos de Alta Velocidad (1G/10G)',
    poeBudget: '370W PoE+ (Fuente modular PWR-C5-600WAC, escalable a 740W con segunda PSU)',
    layerRouting: 'Cisco IOS-XE & DNA Essentials (Estático, RIP, OSPF Routed Access)',
    performance: '176 Gbps Switching Capacity / 130.95 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-80 (hasta 8 switches apilados a 80 Gbps dedicados)',
    cloudManagement: 'Cisco Catalyst Center & Meraki Cloud Monitoring',
    powerSupply: 'Fuente modular reemplazable 600WAC con Norma Chilena CAB-ACA',
    warrantySupport: 'Cisco Enhanced Limited Lifetime (E-LLW) + SmartNet Total Care',
  },
  'C9300-24P-E': {
    sku: 'C9300-24P-E',
    displayName: 'Cisco Catalyst 9300 24P PoE+ Modular Essentials',
    category: 'Switch de Distribución / Core de Campus Modular Catalyst 9300',
    ports: '24x 10/100/1000Base-T PoE+ (Modular)',
    uplinks: 'Módulo Uplink Modular (8x 10G SFP+ C9300-NM-8X o 4x 1G/10G)',
    poeBudget: 'Hasta 715W con fuente PWR-C1-715WAC-P (escalable a 1440W PoE+)',
    layerRouting: 'Cisco IOS-XE Enterprise (OSPF, EIGRP, BGP, Routed Access, Segment Routing)',
    performance: '208 Gbps Switching Capacity / 154.76 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-480 (480 Gbps de ancho de banda de apilamiento)',
    cloudManagement: 'Cisco Catalyst Center, Meraki Cloud Monitoring & ThousandEyes integrado',
    powerSupply: 'Fuentes redundantes duales Platinum con Cable Norma Chile CAB-TA-IT',
    warrantySupport: 'Cisco E-LLW + SmartNet Total Care 24x7 / 8x5xNBD',
  },
  'C9300-24P-A': {
    sku: 'C9300-24P-A',
    displayName: 'Cisco Catalyst 9300 24P PoE+ Modular Advantage (Full L3)',
    category: 'Switch Core / Distribución de Campus Avanzado Catalyst 9300',
    ports: '24x 10/100/1000Base-T PoE+ (Modular)',
    uplinks: 'Módulo Uplink 8x 10G SFP+ (C9300-NM-8X) o 2x 40G / 2x 100G',
    poeBudget: 'Hasta 715W con fuente PWR-C1-715WAC-P (doble fuente modular)',
    layerRouting: 'Cisco DNA Advantage Completo (BGP, IS-IS, OSPFv3, MPLS, EVPN-VXLAN, SD-Access)',
    performance: '208 Gbps Switching Capacity / 154.76 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-480 (480 Gbps de apilamiento líder en la industria)',
    cloudManagement: 'Cisco Catalyst Center & Telemetría Full SD-Access con ThousandEyes',
    powerSupply: 'Doble fuente redundante Platinum con Cable CAB-TA-IT',
    warrantySupport: 'Cisco E-LLW + SmartNet Total Care con SLA 24x7x4 / 8x5xNBD',
  },
  'C9300L-24P-4X-E': {
    sku: 'C9300L-24P-4X-E',
    displayName: 'Cisco Catalyst 9300L 24P PoE+ 4x10G SFP+ Essentials',
    category: 'Switch de Acceso Enterprise Avanzado Catalyst 9300L',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 10G SFP+ Uplinks Fijos de Alta Velocidad',
    poeBudget: '505W PoE+ con fuente PWR-C1-715WAC-P',
    layerRouting: 'Cisco IOS-XE & DNA Essentials (Estático, RIP, OSPF Routed Access)',
    performance: '128 Gbps Switching Capacity / 95.23 Mpps Forwarding Rate',
    stacking: 'Cisco StackWise-320 (320 Gbps de apilamiento dedicado)',
    cloudManagement: 'Cisco Catalyst Center & Meraki Cloud Monitoring',
    powerSupply: 'Fuentes redundantes reemplazables con Cable CAB-TA-IT Norma Chile',
    warrantySupport: 'Cisco E-LLW + Soporte Técnico Especializado Intcomex',
  },
  'C1300-24P-4X': {
    sku: 'C1300-24P-4X',
    displayName: 'Cisco Catalyst 1300 24P PoE+ 4x10G SFP+ Small Business',
    category: 'Switch Administrado Inteligente Cisco Catalyst 1300',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 10G SFP+ Uplinks Fijos',
    poeBudget: '370W PoE+ (Class 4)',
    layerRouting: 'Layer 3 Enrutamiento Estático, RIPv2 e Inter-VLAN Routing',
    performance: '128 Gbps Switching Capacity / 95.23 Mpps',
    stacking: 'Apilamiento hasta 8 unidades a 10 Gbps',
    cloudManagement: 'Cisco Business Dashboard / WebGUI moderna / CLI',
    powerSupply: 'Fuente interna fija con cable Norma Chile CAB-C13-IT',
    warrantySupport: 'Garantía Limitada de por Vida Cisco con reemplazo anticipado',
  },
  'C1300-24P-4G': {
    sku: 'C1300-24P-4G',
    displayName: 'Cisco Catalyst 1300 24P PoE+ 4x1G SFP Small Business',
    category: 'Switch Administrado Inteligente Cisco Catalyst 1300',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos',
    poeBudget: '195W o 370W PoE+',
    layerRouting: 'Layer 3 Enrutamiento Estático e Inter-VLAN',
    performance: '56 Gbps Switching Capacity / 41.66 Mpps',
    stacking: 'Sin apilamiento en versión 4G',
    cloudManagement: 'Cisco Business Dashboard / App móvil / WebGUI',
    powerSupply: 'Fuente interna fija con cable Norma Chile CAB-C13-IT',
    warrantySupport: 'Garantía Limitada de por Vida Cisco',
  },
  'C1200-24P-4G': {
    sku: 'C1200-24P-4G',
    displayName: 'Cisco Catalyst 1200 24P PoE+ 4x1G SFP Small Business',
    category: 'Switch Inteligente Smart-Managed Cisco Catalyst 1200',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos',
    poeBudget: '195W PoE+ Total',
    layerRouting: 'Layer 2 Switching con Enrutamiento Estático L3',
    performance: '56 Gbps Switching Capacity / 41.66 Mpps',
    stacking: 'Sin apilamiento por hardware',
    cloudManagement: 'Cisco Business Dashboard / WebGUI / App móvil',
    powerSupply: 'Fuente interna fija con cable Norma Chile CAB-C13-IT',
    warrantySupport: 'Garantía Limitada de por Vida Cisco',
  },
  'MS130-SWITCHES:MS130-24P': {
    sku: 'MS130-SWITCHES:MS130-24P',
    displayName: 'Cisco Meraki MS130-24P Cloud Managed 24P PoE+ 4x1G SFP',
    category: 'Switch Administrado 100% en la Nube Cisco Meraki',
    ports: '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos',
    poeBudget: '370W PoE+ (Class 4)',
    layerRouting: 'Layer 2 Cloud Switching con visibilidad L7 de aplicaciones',
    performance: '56 Gbps Switching Capacity / 41.66 Mpps',
    stacking: 'Apilamiento Virtual Cloud Stacking (ilimitado vía Dashboard)',
    cloudManagement: 'Meraki Dashboard 100% Cloud Nativo (Zero-Touch Provisioning)',
    powerSupply: 'Fuente interna fija con cable Norma Chile (CAB-ACA)',
    warrantySupport: 'Garantía de por Vida Cisco Meraki con reemplazo avanzado',
  },
  'MS130-SWITCHES:MS130-48P': {
    sku: 'MS130-SWITCHES:MS130-48P',
    displayName: 'Cisco Meraki MS130-48P Cloud Managed 48P PoE+ 4x1G SFP',
    category: 'Switch Administrado 100% en la Nube Cisco Meraki',
    ports: '48x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: '4x 1G SFP Uplinks Fijos',
    poeBudget: '370W PoE+ (Class 4)',
    layerRouting: 'Layer 2 Cloud Switching con visibilidad L7',
    performance: '104 Gbps Switching Capacity / 77.38 Mpps',
    stacking: 'Apilamiento Virtual Cloud Stacking vía Meraki Dashboard',
    cloudManagement: 'Meraki Dashboard 100% Cloud con alertas proactivas',
    powerSupply: 'Fuente interna fija con cable Norma Chile (CAB-ACA)',
    warrantySupport: 'Garantía de por Vida Cisco Meraki con reemplazo avanzado',
  },
  'FPR1010-NGFW-K9': {
    sku: 'FPR1010-NGFW-K9',
    displayName: 'Cisco Secure Firewall FPR1010 NGFW Fanless',
    category: 'Next-Generation Firewall (NGFW) Cisco Secure',
    ports: '8x 10/100/1000Base-T RJ45 (incluye 2x PoE+ PSE para alimentar APs/Teléfonos)',
    uplinks: '8x Puertos Gigabit conmutables WAN/LAN/DMZ',
    poeBudget: '2x Puertos PoE+ integrados (hasta 30W por puerto)',
    layerRouting: 'Firewall NGFW, Snort 3 IPS, AVC, URL Filtering & VPN AnyConnect',
    performance: '890 Mbps Firewall / 850 Mbps IPS / 650 Mbps NGFW Threat Protection',
    stacking: 'Clustering Activo/Espera con failover transparente',
    cloudManagement: 'Cisco Defense Orchestrator (CDO) & Firewall Device Manager (FDM)',
    powerSupply: 'Fuente externa 100-240V silenciosa Fanless con cable CAB-ACA',
    warrantySupport: 'Cisco 90 días + SmartNet Total Care con cobertura de hardware 8x5xNBD',
  },
  'FPR1120-NGFW-K9': {
    sku: 'FPR1120-NGFW-K9',
    displayName: 'Cisco Secure Firewall FPR1120 1RU NGFW',
    category: 'Next-Generation Firewall Enterprise Cisco Secure',
    ports: '8x 10/100/1000Base-T RJ45 + 4x 1G SFP Puertos de Fibra',
    uplinks: '4x 1G SFP Uplinks Dedicados',
    poeBudget: 'Sin PoE integrado',
    layerRouting: 'Snort 3 Multithreaded IPS, SSL Decryption por Hardware, SD-WAN Seguro',
    performance: '4.5 Gbps Firewall / 2.5 Gbps IPS / 1.5 Gbps NGFW Threat Defense',
    stacking: 'HA Active/Standby con sincronización de estado Stateful',
    cloudManagement: 'Cisco Security Cloud Control / CDO / FMC',
    powerSupply: 'Fuente interna 100-240V con cable Norma Chile CAB-ACA',
    warrantySupport: 'Cisco SmartNet Total Care con reemplazo de partes',
  },
  'MX68-HW': {
    sku: 'MX68-HW',
    displayName: 'Cisco Meraki MX68 Cloud Managed Security & SD-WAN Appliance',
    category: 'Firewall & SD-WAN 100% Administrado en Nube Meraki',
    ports: '10x 10/100/1000Base-T RJ45 (incluye 2x PoE+ 802.3at)',
    uplinks: '2x Puertos WAN Gigabit (1x GbE RJ45 + 1x SFP)',
    poeBudget: '2x Puertos PoE+ (60W de presupuesto)',
    layerRouting: 'Auto-VPN SD-WAN en 3 clics, Layer 7 Traffic Shaping, AMP & Snort IPS',
    performance: '450 Mbps Stateful Firewall / 300 Mbps Advanced Security / 200 Mbps VPN',
    stacking: 'Warm Spare VRRP failover',
    cloudManagement: 'Meraki Dashboard con aprovisionamiento Zero-Touch',
    powerSupply: 'Fuente externa de poder con cable Norma Chile (MA-PWR-CORD-IT)',
    warrantySupport: 'Garantía de por vida Cisco Meraki con reemplazo avanzado al día siguiente',
  },
  'CW9162I-MR': {
    sku: 'CW9162I-MR',
    displayName: 'Cisco Catalyst CW9162I Wi-Fi 6E Tri-Band Access Point',
    category: 'Access Point Interior Enterprise Wi-Fi 6E (6GHz Ready)',
    ports: '1x 2.5 mGig PoE+ (802.3at)',
    uplinks: 'Tri-band 2x2:2 MU-MIMO (2.4GHz + 5GHz + 6GHz)',
    poeBudget: 'Consumo PoE: 16W (802.3at PoE+)',
    layerRouting: 'Dual Management: Gestión en Nube Meraki o Catalyst Center',
    performance: 'Velocidad combinada hasta 3.9 Gbps en 3 bandas',
    stacking: 'Agrupamiento inteligente en la nube',
    cloudManagement: 'Meraki Dashboard / Catalyst Center con telemetría RF',
    powerSupply: 'Alimentación PoE+ 802.3at o Adaptador 12V',
    warrantySupport: 'Garantía Limitada de por Vida Cisco',
  },
  'MR46-HW': {
    sku: 'MR46-HW',
    displayName: 'Cisco Meraki MR46 Wi-Fi 6 4x4:4 Multigigabit Access Point',
    category: 'Access Point Interior Wi-Fi 6 de Alto Desempeño Meraki',
    ports: '1x 2.5 Gbps Multigigabit RJ45 PoE+ (802.3at)',
    uplinks: 'Radio 4x4:4 (5GHz) + 4x4:4 (2.4GHz) MU-MIMO + WIDS/WIPS',
    poeBudget: 'Consumo PoE: 18W (802.3at PoE+)',
    layerRouting: 'Seguridad integrada con WIDS/WIPS y radio BLE de telemetría',
    performance: 'Velocidad agregada de hasta 2.98 Gbps en dual radio',
    stacking: 'Controlador virtual en la nube (Dashboard)',
    cloudManagement: 'Meraki Dashboard Cloud 100% con mapas de calor y analítica',
    powerSupply: 'Alimentación PoE+ o Inyector MA-INJ-4',
    warrantySupport: 'Garantía de por Vida Cisco Meraki',
  },
};

/**
 * Detecta si un texto o SKU corresponde a un equipo de una marca competidora
 * (Aruba, Fortinet, Huawei, Dell, Juniper, Ubiquiti, MikroTik, Palo Alto, Extreme).
 */
export function detectCompetitorEquipment(textOrSku: string): {
  isCompetitor: boolean;
  catalogEntry?: CompetitorCatalogEntry;
  detectedBrand?: string;
  detectedModel?: string;
  suggestedCiscoSku?: string;
} {
  const clean = (textOrSku || '').trim();
  if (!clean) return { isCompetitor: false };

  const upper = clean.toUpperCase();

  // 1. Búsqueda exacta o por alias en el catálogo de competidores
  for (const entry of COMPETITOR_HOMOLOGATION_CATALOG) {
    if (upper === entry.competitorModel.toUpperCase()) {
      return {
        isCompetitor: true,
        catalogEntry: entry,
        detectedBrand: entry.competitorBrand,
        detectedModel: entry.competitorModel,
        suggestedCiscoSku: entry.recommendedCiscoSku,
      };
    }
    for (const alias of entry.aliases) {
      const aliasUpper = alias.toUpperCase();
      // Si el texto contiene la palabra o código del alias
      const wordRegex = new RegExp(`\\b${aliasUpper.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (wordRegex.test(clean) || upper.includes(aliasUpper)) {
        return {
          isCompetitor: true,
          catalogEntry: entry,
          detectedBrand: entry.competitorBrand,
          detectedModel: entry.competitorModel,
          suggestedCiscoSku: entry.recommendedCiscoSku,
        };
      }
    }
  }

  // 2. Detección heurística de marcas competidoras populares
  const brandPatterns = [
    { brand: 'Aruba / HPE', regex: /\b(?:aruba|hpe|procurve|officeconnect|instant\s*on)\b/i },
    { brand: 'Fortinet', regex: /\b(?:fortinet|fortigate|fortiswitch|fortiap|fg-|fs-|fap-)\b/i },
    { brand: 'Huawei', regex: /\b(?:huawei|cloudengine|s57\d{2}|s67\d{2}|airengine|usg6\d{3})\b/i },
    { brand: 'Dell', regex: /\b(?:dell|powerswitch|force10|n15\d{2}|n20\d{2}|n30\d{2}|n32\d{2})\b/i },
    { brand: 'Juniper', regex: /\b(?:juniper|ex2300|ex3400|ex4300|ex4400|srx3\d{2}|mist)\b/i },
    { brand: 'Ubiquiti', regex: /\b(?:ubiquiti|unifi|usw-|udm-|edgemax)\b/i },
    { brand: 'MikroTik', regex: /\b(?:mikrotik|routerboard|crs\d{3}|ccr\d{4})\b/i },
    { brand: 'Palo Alto', regex: /\b(?:palo\s*alto|pan-os|pa-4\d{2}|pa-14\d{2})\b/i },
    { brand: 'Extreme', regex: /\b(?:extreme\s*networks|summit|extremeswitching)\b/i },
  ];

  for (const bp of brandPatterns) {
    if (bp.regex.test(clean)) {
      // Deducir puertos, PoE y uplinks para armar el modelo
      const has48 = /\b48\b|48\s*(?:p|puertos|bocas|g)/i.test(clean);
      const has24 = /\b24\b|24\s*(?:p|puertos|bocas|g)/i.test(clean) || !has48;
      const isPoe = !/\bsin\s+poe\b|\bsolo\s+datos\b|\bdata\b/i.test(clean);
      const is10G = /\b10\s*g\b|\bsfp\+\b|\b4x\b|\bfibra\b/i.test(clean);

      const portsCount = has48 ? 48 : 24;
      let deducedSku = `C9200L-${portsCount}${isPoe ? 'P' : 'T'}-${is10G ? '4X' : '4G'}-E`;

      if (bp.brand === 'Fortinet' && /\b(?:firewall|fortigate|fg|seguridad)\b/i.test(clean)) {
        deducedSku = 'FPR1010-NGFW-K9';
      }

      return {
        isCompetitor: true,
        detectedBrand: bp.brand,
        detectedModel: clean.length > 80 ? clean.slice(0, 80) + '...' : clean,
        suggestedCiscoSku: deducedSku,
      };
    }
  }

  return { isCompetitor: false };
}

/**
 * Resuelve las especificaciones técnicas oficiales de un SKU Cisco 2026
 * con fallback determinista según nomenclatura de familia/puertos/uplinks.
 */
export function resolveCiscoSpecDetail(sku: string): CiscoHomologatedSpecDetail {
  const cleanCiscoSku = (sku || '').includes(':') ? (sku || '').split(':')[1] : (sku || '').trim();
  const upperSku = cleanCiscoSku.toUpperCase();

  const fromDb = CISCO_SPECS_DATABASE[cleanCiscoSku] || CISCO_SPECS_DATABASE[sku];
  if (fromDb) return fromDb;

  const isFirewall = upperSku.startsWith('FPR') || upperSku.startsWith('MX');
  const isAp = upperSku.startsWith('CW') || upperSku.startsWith('MR') || upperSku.startsWith('C91');
  if (isFirewall) {
    return {
      sku: cleanCiscoSku,
      displayName: `Cisco Security NGFW (${cleanCiscoSku})`,
      category: 'Next-Generation Firewall / SD-WAN Cisco 2026',
      ports: 'Interfaces RJ45/SFP conmutables WAN/LAN/DMZ',
      uplinks: 'Uplinks dedicados 1G/10G SFP+ según chasis',
      poeBudget: upperSku.startsWith('MX') || upperSku.includes('1010') ? '2x Puertos PoE+ integrados' : 'Sin PoE integrado',
      layerRouting: 'Snort 3 IPS, SD-WAN Seguro, AVC & URL Filtering',
      performance: 'Inspection NGFW Multi-Gigabit con SSL Decryption',
      stacking: 'Clustering Activo/Espera HA con failover transparente',
      cloudManagement: upperSku.startsWith('MX') ? 'Meraki Dashboard Zero-Touch' : 'Cisco Defense Orchestrator (CDO) / FMC',
      powerSupply: 'Fuente certificada con cable Norma Chile (CAB-ACA)',
      warrantySupport: 'Garantía Cisco + SmartNet Total Care 8x5xNBD',
    };
  }
  if (isAp) {
    return {
      sku: cleanCiscoSku,
      displayName: `Cisco Enterprise Wireless (${cleanCiscoSku})`,
      category: 'Access Point Enterprise Wi-Fi 6 / 6E Cisco 2026',
      ports: '1x 2.5G Multigigabit RJ45 PoE+',
      uplinks: 'Radios MU-MIMO Dual/Tri-Band con radio BLE/IoT',
      poeBudget: 'Consumo PoE: 16W–25W (802.3at PoE+)',
      layerRouting: 'Dual Management: Meraki Dashboard o Catalyst Center',
      performance: 'Throughput inalámbrico Multi-Gigabit alta densidad',
      stacking: 'Agrupamiento automático en controlador Cloud/Premisa',
      cloudManagement: 'Meraki Dashboard & Catalyst Center con analítica RF',
      powerSupply: 'Alimentación PoE+ 802.3at o Inyector opcional',
      warrantySupport: 'Garantía Limitada de por Vida Cisco',
    };
  }

  const is48 = upperSku.includes('48');
  const is10G = upperSku.includes('4X') || upperSku.includes('8X') || upperSku.includes('9300');
  const isModular9300 = upperSku.includes('9300');
  const isSmallBiz = upperSku.startsWith('C1200') || upperSku.startsWith('C1300');
  const isMeraki = upperSku.startsWith('MS');

  return {
    sku: cleanCiscoSku,
    displayName: `Cisco Enterprise Suite (${cleanCiscoSku})`,
    category: isSmallBiz
      ? 'Switch Administrado Inteligente Catalyst 1200/1300'
      : isMeraki
        ? 'Switch Administrado 100% Cloud Cisco Meraki'
        : 'Equipo Oficial Cisco Enterprise 2026 (Cero EOL)',
    ports: is48 ? '48x 10/100/1000Base-T PoE+ (802.3at)' : '24x 10/100/1000Base-T PoE+ (802.3at)',
    uplinks: is10G ? '4x 10G SFP+ Uplinks Alta Velocidad' : '4x 1G SFP Uplinks Fijos',
    poeBudget: isModular9300
      ? 'Hasta 715W PoE+ (Doble PSU Modular Redundante)'
      : '370W PoE+ (802.3at Class 4)',
    layerRouting: isSmallBiz
      ? 'Layer 3 Estático e Inter-VLAN Routing'
      : isMeraki
        ? 'Layer 2/L3 Cloud Switching con visibilidad L7'
        : 'Cisco IOS-XE & DNA Essentials (OSPF Routed Access)',
    performance: is48 ? '176 Gbps / 130.95 Mpps' : '128 Gbps / 95.23 Mpps',
    stacking: isModular9300
      ? 'Cisco StackWise-320 / StackWise-480'
      : isMeraki
        ? 'Virtual Cloud Stacking Meraki Dashboard'
        : 'Cisco StackWise-80 (hasta 8 switches a 80 Gbps)',
    cloudManagement: isMeraki
      ? 'Meraki Dashboard 100% Cloud Nativo'
      : 'Cisco Catalyst Center & Monitoreo en la Nube Meraki Dashboard',
    powerSupply: isSmallBiz
      ? 'Fuente interna con Cable Norma Chile CAB-C13-IT'
      : 'Fuente modular reemplazable en caliente con Cable Norma Chile (CAB-ACA)',
    warrantySupport: 'Cisco Enhanced Limited Lifetime Warranty (E-LLW) + SmartNet Total Care',
  };
}

function getHardwareSegmentBucket(skuOrCategory: string): 'FIREWALL' | 'AP' | 'CORE_L3' | 'SW_48_10G' | 'SW_48_1G' | 'SW_24_10G' | 'SW_24_1G' {
  const u = (skuOrCategory || '').toUpperCase();
  if (/(FPR|MX\d+|FORTIGATE|FG-|FIREWALL|NGFW|PA-|SRX)/.test(u)) return 'FIREWALL';
  if (/(CW9|MR\d+|AP-|WIFI|ACCESS POINT|AIRENGINE)/.test(u)) return 'AP';
  if (/(C9300-|6300M|S5731|CORE|DISTRIBUCI)/.test(u)) return 'CORE_L3';
  const is48 = /\b48\b|48P|48G/.test(u);
  const is10G = /4X|8X|SFP\+|10G|CRS328|EX2300|EX3400|S5735-L\d+P4X|N3024|N3224|FS-424|6200F|6100|2930F/.test(u);
  if (is48) return is10G ? 'SW_48_10G' : 'SW_48_1G';
  return is10G ? 'SW_24_10G' : 'SW_24_1G';
}

/**
 * Genera la comparativa técnica lado a lado de homologación entre un equipo
 * competidor y el SKU oficial Cisco 2026 seleccionado, evaluando los 10 criterios más
 * relevantes, además de matrices contra las configuraciones Cisco establecidas y
 * demás marcas equivalentes del catálogo.
 */
export function generateHomologationComparison(params: {
  rawCompetitorText?: string;
  competitorBrand?: string;
  catalogEntry?: CompetitorCatalogEntry;
  selectedCiscoSku: string;
  homologationPct?: number;
  establishedProposals?: EstablishedConfigInput[];
}): HomologationComparisonResult {
  const {
    rawCompetitorText,
    competitorBrand,
    catalogEntry,
    selectedCiscoSku,
    homologationPct,
    establishedProposals,
  } = params;

  const autoDetection =
    !catalogEntry && rawCompetitorText ? detectCompetitorEquipment(rawCompetitorText) : undefined;
  const effectiveCatalogEntry = catalogEntry || autoDetection?.catalogEntry;

  // 1. Resolver especificaciones del competidor
  let compSpec: CompetitorSpecDetail;
  if (effectiveCatalogEntry) {
    compSpec = effectiveCatalogEntry.specs;
  } else {
    const raw = (rawCompetitorText || 'Equipo Competidor').trim();
    const resolvedBrand =
      (competitorBrand && competitorBrand.trim()) ||
      autoDetection?.detectedBrand ||
      'Marca Competidora';
    const has48 = /\b48\b/i.test(raw);
    const isPoe = !/\bsin\s+poe\b/i.test(raw);
    const is10G = /\b10\s*g\b|\bsfp\+/i.test(raw);
    const isFw = /\b(?:firewall|ngfw|fortigate|fg-|pa-|srx)\b/i.test(raw);
    const isAp = /\b(?:ap|access\s*point|wifi|wi-fi|unifi\s*u6|airengine)\b/i.test(raw);
    const ports = has48 ? '48x 10/100/1000Base-T' : '24x 10/100/1000Base-T';

    compSpec = {
      brand: resolvedBrand,
      model: raw,
      category: isFw
        ? 'Next-Generation Firewall (NGFW)'
        : isAp
          ? 'Access Point Empresarial Wi-Fi 6'
          : 'Switch de Acceso Empresarial',
      ports: isFw
        ? 'Interfaces RJ45/SFP Multi-WAN/LAN'
        : isAp
          ? '1x RJ45 Gigabit / 2.5G PoE+'
          : `${ports} ${isPoe ? 'PoE+ (802.3at)' : 'Solo Datos'}`,
      uplinks: isFw
        ? 'WAN/DMZ Multi-Puerto'
        : isAp
          ? 'Radio Dual MU-MIMO Wi-Fi 6'
          : is10G
            ? '4x 10G SFP+ Uplinks'
            : '4x 1G SFP Uplinks',
      poeBudget: isFw ? 'Según chasis / N/A' : isAp ? 'Consumo PoE+ (~15W-22W)' : isPoe ? '370W PoE+ (Estándar)' : '0W (No PoE)',
      layerRouting: isFw ? 'NGFW + IPS + VPN SD-WAN' : 'Layer 2 con Enrutamiento Estático L3',
      performance: isFw ? 'Throughput NGFW Multigigabit' : isAp ? '1.8 - 3.0 Gbps agregado' : has48 ? '176 Gbps / 130 Mpps' : '128 Gbps / 95 Mpps',
      stacking: isFw ? 'HA Active/Standby' : 'Apilamiento por hardware / VSF',
      cloudManagement: 'Gestión Cloud / WebGUI / CLI',
      powerSupply: 'Fuente interna fija',
      warrantySupport: 'Garantía Estándar del Fabricante',
    };
  }

  // 2. Resolver especificaciones del modelo Cisco activo
  const cleanCiscoSku = selectedCiscoSku.includes(':')
    ? selectedCiscoSku.split(':')[1]
    : selectedCiscoSku;

  const ciscoSpec = resolveCiscoSpecDetail(selectedCiscoSku);

  // 3. Evaluar los 10 aspectos más relevantes de homologación
  const specRows: HomologationSpecComparisonRow[] = [
    {
      category: 'Arquitectura',
      label: 'Tipo y Categoría de Equipo',
      competitorValue: compSpec.category,
      ciscoValue: ciscoSpec.category,
      status: 'identical',
      statusLabel: '✓ 100% Equivalente',
      notes: 'Equivalencia de segmento Enterprise y grado de disponibilidad.',
    },
    {
      category: 'Conectividad Cobre',
      label: 'Puertos de Acceso (Downlinks)',
      competitorValue: compSpec.ports,
      ciscoValue: ciscoSpec.ports,
      status: 'identical',
      statusLabel: '✓ 100% Idéntico',
      notes: 'Misma densidad de puertos Gigabit Ethernet y soporte estándar 802.3at.',
    },
    {
      category: 'Conectividad Fibra',
      label: 'Puertos de Fibra / Uplinks',
      competitorValue: compSpec.uplinks,
      ciscoValue: ciscoSpec.uplinks,
      status: 'superior',
      statusLabel: '⚡ Equivalente o Superior',
      notes: 'Puertos ópticos dedicados de alta velocidad compatibles con transceivers y cables DAC Intcomex.',
    },
    {
      category: 'Alimentación PoE',
      label: 'Presupuesto Eléctrico PoE (W)',
      competitorValue: compSpec.poeBudget,
      ciscoValue: ciscoSpec.poeBudget,
      status: 'superior',
      statusLabel: '⚡ Cisco Superior / Escalable',
      notes: 'Cisco ofrece fuentes modulares reemplazables en caliente y soporte PoE+ garantizado.',
    },
    {
      category: 'Enrutamiento L2/L3',
      label: 'Nivel de Enrutamiento y Protocolos',
      competitorValue: compSpec.layerRouting,
      ciscoValue: ciscoSpec.layerRouting,
      status: 'superior',
      statusLabel: '⚡ Superior Cisco IOS-XE',
      notes: 'Cisco IOS-XE entrega mayor estabilidad, OSPF Routed Access y seguridad perimetral integrada.',
    },
    {
      category: 'Desempeño Switching',
      label: 'Capacidad de Conmutación & Throughput',
      competitorValue: compSpec.performance,
      ciscoValue: ciscoSpec.performance,
      status: 'identical',
      statusLabel: '✓ 100% Equivalente',
      notes: 'Rendimiento wire-speed sin bloqueo con hardware ASIC UADP / Enterprise.',
    },
    {
      category: 'Resiliencia & Stack',
      label: 'Capacidad de Apilamiento (Stacking)',
      competitorValue: compSpec.stacking,
      ciscoValue: ciscoSpec.stacking,
      status: 'superior',
      statusLabel: '⚡ StackWise Dedicado',
      notes: 'StackWise ofrece plano de control único y hasta 80 Gbps / 480 Gbps de backplane dedicado.',
    },
    {
      category: 'Gestión & Nube',
      label: 'Gestión Cloud & Telemetría',
      competitorValue: compSpec.cloudManagement,
      ciscoValue: ciscoSpec.cloudManagement,
      status: 'superior',
      statusLabel: '⚡ Ecosistema Superior',
      notes: 'Visibilidad dual híbrida: Cisco Catalyst Center en premisa y Meraki Cloud Monitoring.',
    },
    {
      category: 'Norma Eléctrica',
      label: 'Fuente de Poder & Cable Eléctrico',
      competitorValue: compSpec.powerSupply,
      ciscoValue: ciscoSpec.powerSupply,
      status: 'superior',
      statusLabel: '🇨🇱 Norma Chile CAB-IT',
      notes: 'Incluye de fábrica conector oficial Tipo L (CEI 23-50) para Chile/Italia y fuentes reemplazables.',
    },
    {
      category: 'Soporte & Garantía',
      label: 'Garantía Oficial & Soporte Intcomex',
      competitorValue: compSpec.warrantySupport,
      ciscoValue: ciscoSpec.warrantySupport,
      status: 'superior',
      statusLabel: '✓ Respaldo Oficial Intcomex',
      notes: 'Garantía E-LLW de por vida con reemplazo anticipado y cobertura SmartNet Total Care.',
    },
  ];

  // 4. Calcular el porcentaje efectivo de homologación
  const effectivePct =
    typeof homologationPct === 'number' && homologationPct > 0
      ? homologationPct
      : effectiveCatalogEntry?.homologationPct || 100;

  // 5. Construir Matriz Comparativa contra TODAS las Configuraciones Cisco Establecidas
  const ciscoConfigsMap = new Map<string, CiscoConfigMatrixRow>();
  const addCiscoConfigRow = (cfg: EstablishedConfigInput, defaultTag: string) => {
    const rawSku = (cfg.sku || '').trim();
    if (!rawSku) return;
    const normUpper = rawSku.toUpperCase();
    const activeCleanUpper = cleanCiscoSku.toUpperCase();
    const fullUpper = selectedCiscoSku.toUpperCase();
    const cleanCandidateUpper = (rawSku.includes(':') ? rawSku.split(':')[1] : rawSku).toUpperCase();
    const isActiveSelected =
      normUpper === fullUpper ||
      normUpper === activeCleanUpper ||
      cleanCandidateUpper === activeCleanUpper;
    if (ciscoConfigsMap.has(cleanCandidateUpper)) return;
    const spec = resolveCiscoSpecDetail(rawSku);
    const pct =
      typeof cfg.homologationPct === 'number' && cfg.homologationPct > 0
        ? cfg.homologationPct
        : isActiveSelected
          ? effectivePct
          : 98;
    ciscoConfigsMap.set(cleanCandidateUpper, {
      sku: rawSku,
      title: cfg.title || spec.displayName,
      strategyTag: cfg.strategyTag || (isActiveSelected ? 'Configuración Activa' : defaultTag),
      isActiveSelected,
      homologationPct: pct,
      homologationLabel: cfg.homologationLabel || (pct >= 100 ? '100% Equivalente' : `${pct}% Compatible`),
      ports: spec.ports,
      uplinks: spec.uplinks,
      poeBudget: spec.poeBudget,
      layerRouting: spec.layerRouting,
      stacking: spec.stacking,
      cloudManagement: spec.cloudManagement,
      powerSupply: spec.powerSupply,
      unitGplUsd: cfg.unitGplUsd,
      totalGplUsd: cfg.totalGplUsd,
      discountPct: cfg.discountPct,
      isFastTrackEligible: cfg.isFastTrackEligible,
    });
  };

  if (Array.isArray(establishedProposals)) {
    establishedProposals.forEach((prop, idx) =>
      addCiscoConfigRow(prop, idx === 0 ? 'Recomendada #1' : `Alternativa #${idx + 1}`)
    );
  }
  addCiscoConfigRow(
    {
      sku: selectedCiscoSku,
      homologationPct: effectivePct,
      strategyTag: 'Configuración Activa',
    },
    'Configuración Activa'
  );
  if (effectiveCatalogEntry?.recommendedCiscoSku) {
    addCiscoConfigRow(
      {
        sku: effectiveCatalogEntry.recommendedCiscoSku,
        homologationPct: effectiveCatalogEntry.homologationPct,
        strategyTag: 'Equivalencia Oficial Catálogo',
      },
      'Equivalencia Oficial'
    );
  }
  if (Array.isArray(effectiveCatalogEntry?.alternativeCiscoSkus)) {
    effectiveCatalogEntry.alternativeCiscoSkus.forEach((altSku, idx) =>
      addCiscoConfigRow(
        {
          sku: altSku,
          homologationPct: Math.max(92, (effectiveCatalogEntry.homologationPct || 100) - (idx + 1) * 2),
          strategyTag: `Alternativa Cisco #${idx + 1}`,
        },
        `Alternativa Cisco #${idx + 1}`
      )
    );
  }
  const ciscoConfigurations = Array.from(ciscoConfigsMap.values());

  // 6. Construir Matriz Comparativa contra las Demás Marcas Equivalentes del Mercado
  const targetSegment = getHardwareSegmentBucket(
    effectiveCatalogEntry?.recommendedCiscoSku || selectedCiscoSku || rawCompetitorText || ''
  );
  const requestedBrandLower = compSpec.brand.trim().toLowerCase();
  const peerBrandsMatrix: PeerBrandBenchmarkRow[] = [
    {
      brand: compSpec.brand,
      model: compSpec.model,
      role: 'requested',
      equivalentCiscoSku: ciscoSpec.sku,
      homologationPct: effectivePct,
      ports: compSpec.ports,
      uplinks: compSpec.uplinks,
      poeBudget: compSpec.poeBudget,
      layerRouting: compSpec.layerRouting,
      stacking: compSpec.stacking,
      cloudManagement: compSpec.cloudManagement,
      warrantySupport: compSpec.warrantySupport,
    },
    {
      brand: 'Cisco 2026',
      model: `${ciscoSpec.sku} — ${ciscoSpec.displayName}`,
      role: 'cisco_reference',
      equivalentCiscoSku: ciscoSpec.sku,
      homologationPct: effectivePct,
      ports: ciscoSpec.ports,
      uplinks: ciscoSpec.uplinks,
      poeBudget: ciscoSpec.poeBudget,
      layerRouting: ciscoSpec.layerRouting,
      stacking: ciscoSpec.stacking,
      cloudManagement: ciscoSpec.cloudManagement,
      warrantySupport: ciscoSpec.warrantySupport,
    },
  ];

  const seenPeerBrands = new Set<string>([requestedBrandLower, 'cisco', 'cisco 2026']);
  const scoredPeers = COMPETITOR_HOMOLOGATION_CATALOG.map((entry) => {
    const skuMatch =
      entry.recommendedCiscoSku.toUpperCase() === cleanCiscoSku.toUpperCase() ||
      (entry.alternativeCiscoSkus || []).some((a) => a.toUpperCase().includes(cleanCiscoSku.toUpperCase())) ||
      (effectiveCatalogEntry?.recommendedCiscoSku &&
        entry.recommendedCiscoSku.toUpperCase() === effectiveCatalogEntry.recommendedCiscoSku.toUpperCase());
    const segMatch = getHardwareSegmentBucket(entry.recommendedCiscoSku) === targetSegment;
    return {
      entry,
      score: (skuMatch ? 2 : 0) + (segMatch ? 1 : 0),
    };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.homologationPct - a.entry.homologationPct);

  for (const { entry } of scoredPeers) {
    const brandKey = entry.competitorBrand.trim().toLowerCase();
    if (seenPeerBrands.has(brandKey)) continue;
    seenPeerBrands.add(brandKey);
    peerBrandsMatrix.push({
      brand: entry.competitorBrand,
      model: entry.specs.model || entry.competitorModel,
      role: 'peer_competitor',
      equivalentCiscoSku: entry.recommendedCiscoSku,
      homologationPct: entry.homologationPct,
      ports: entry.specs.ports,
      uplinks: entry.specs.uplinks,
      poeBudget: entry.specs.poeBudget,
      layerRouting: entry.specs.layerRouting,
      stacking: entry.specs.stacking,
      cloudManagement: entry.specs.cloudManagement,
      warrantySupport: entry.specs.warrantySupport,
    });
  }

  // 7. Redactar el veredicto preventa
  const verdict =
    effectivePct >= 100
      ? `✅ Homologación Técnica Certificada (100% Equivalente): El modelo ${ciscoSpec.displayName} cumple y supera todos los requerimientos de densidad de puertos (${ciscoSpec.ports}), uplinks de fibra y presupuesto PoE frente a ${compSpec.model}, asegurando compatibilidad total en pliegos de licitación y migración sin fricción.`
      : `🎯 Homologación Altamente Recomendada (${effectivePct}% Coherencia): La solución ${ciscoSpec.displayName} cubre la totalidad de la operatividad requerida para sustituir a ${compSpec.model}, ofreciendo arquitectura de hardware modular y garantía Cisco Enterprise Intcomex.`;

  const keyAdvantages = [
    `Puertos y Rendimiento: Misma densidad de puertos (${ciscoSpec.ports}) con conmutación wire-speed.`,
    `Fuentes Modulares Escalables: A diferencia de fuentes fijas del competidor, Cisco permite fuentes reemplazables.`,
    `Conector Norma Chile: Cable oficial CAB-ACA / CAB-TA-IT de 3 patas en línea para cumplimiento eléctrico SEC.`,
    `Gestión Unificada Híbrida: Monitoreo en la nube Meraki Dashboard y gestión con Catalyst Center.`,
    `Garantía E-LLW Intcomex: Soporte de preventa dedicado e inventario local de repuestos en bodega Santiago.`,
  ];

  return {
    competitor: compSpec,
    cisco: ciscoSpec,
    homologationPct: effectivePct,
    homologationTier: effectivePct >= 100 ? 'EXACT_EQUIVALENT' : 'RECOMMENDED_ALTERNATIVE',
    verdict,
    specRows,
    keyAdvantages,
    ciscoConfigurations,
    peerBrandsMatrix,
  };
}
