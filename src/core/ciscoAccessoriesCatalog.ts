// ============================================================================
// CISCO AUTOMATED v2.1 - NON-EOL CISCO & MERAKI ACCESSORIES CATALOG & CLASSIFIER
// Catálogo exhaustivo + Clasificador Infinito de Accesorios Físicos Vigentes (No-EOL 2026)
// Regla de Negocio:
// 1. En Cisco CCW, TODAS las Líneas Madres (ya sean Hardware Principal, Accesorios o Suscripciones)
//    tienen SIEMPRE el formato "1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0", "11.0"...
//    hasta el infinito (NUNCA "1", "2", "3", "4", "5").
// 2. Cuando un SKU termina en '=' (repuesto/spare), la probabilidad de que venga en formato Línea Madre
//    (1.0, 2.0, 3.0, etc.) es del 100%, y SIEMPRE lleva ARANCEL (6% Arancel + 7% Internación).
// 3. Si un accesorio vigente No-EOL (Antena, Cable, Transceiver SFP/QSFP, Fuente PWR, Inyector PoE,
//    Kit de Montaje/Bracket, Kit de Apilamiento, Módulo de Expansión/NIM, Ventilador, Blank,
//    Cámara MV, Sensor MT, Teléfono IP CP/DP, Room Bar / Endpoint Webex CS-*)
//    aparece en formato Línea Madre (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0... al infinito)
//    incluso SIN el signo '=', SIEMPRE lleva ARANCEL (6% Arancel + 7% Internación).
// 4. Si el mismo accesorio aparece como Sub-Línea Hija (1.1, 1.2, 2.1, 1.0.1, etc.) SIN '=',
//    es parte del chasis padre -> EQUIPO / TANGIBLE (7% Internación, 0% Arancel).
// 5. Equipos Principales de Red/Cómputo (Switches, Routers, Access Points, Firewalls, Controladoras,
//    Servidores UCS) NUNCA son accesorios, por lo que en línea madre (1.0, 2.0, 3.0, 4.0, 5.0, 6.0...)
//    sin '=' son EQUIPO (7% Internación, 0% Arancel).
// ============================================================================

import { MODULAR_EOL_CATALOG_2026 } from '../modules/configuriator/rules';
import { isCiscoIntangibleSku } from './ciscoTaxonomy';

export type CiscoAccessoryCategory =
  | 'ANTENAS'
  | 'CABLES'
  | 'TRANSCEIVERS'
  | 'ENERGIA_FUENTES_INYECTORES'
  | 'MONTAJE_VENTILACION_BLANKS'
  | 'MODULOS_EXPANSION_ACCESORIOS'
  | 'CAMARAS_SENSORES_TELEFONOS_ROOMBAR';

export interface CiscoAccessoryCatalogEntry {
  sku: string;
  category: CiscoAccessoryCategory;
  description: string;
}

/**
 * Lista de SKUs de accesorios históricos que están en End-of-Sale / End-of-Life (EOL)
 * y por tanto quedan excluidos del catálogo vigente No-EOL 2026.
 */
export const KNOWN_EOL_ACCESSORY_SKUS: ReadonlySet<string> = new Set([
  // Antenas EOL (Legacy 802.11a/b/g/n)
  'AIR-ANT2422DW-R',
  'AIR-ANT5135DW-R',
  'AIR-ANT2410Y-R',
  'AIR-ANT5145V-R',
  'AIR-ANT2460NP-R',
  'AIR-ANT5160NP-R',
  // Inyectores y Fuentes EOL (Catalyst 2960X/3750X/3850 legacy)
  'AIR-PWRINJ4',
  'AIR-PWRINJ5',
  'MA-INJ-3',
  'PWR-C1-350WAC',
  'PWR-C1-715WAC',
  'PWR-C1-1100WAC',
  'PWR-C2-250WAC',
  'PWR-C2-640WAC',
  'PWR-C2-1025WAC',
  'PWR-C3-750WAC',
  // Transceivers EOL (Legacy non-D / non-S)
  'GLC-LH-SM',
  'GLC-SX-MM',
  'GLC-ZX-SM',
  'GLC-T',
  // Cables y Kits de Stacking EOL (Catalyst 2960S/2960X/3750/3650)
  'CAB-STACK-50CM',
  'CAB-STACK-1M',
  'CAB-STACK-3M',
  'CAB-STK-E-0.5M',
  'CAB-STK-E-1M',
  'CAB-STK-E-3M',
  'C2960X-STACK',
  'C3650-STACK-KIT',
  // Módulos de Uplink EOL (Catalyst 3850 / 3750X)
  'C3850-NM-4-1G',
  'C3850-NM-2-10G',
  'C3850-NM-4-10G',
  'C3850-NM-8-10G',
  'C3KX-NM-1G',
  'C3KX-NM-10G',
  // Cámaras y Teléfonos IP EOL (Legacy 7900 / MV Gen 1)
  'CP-7942G',
  'CP-7962G',
  'CP-7945G',
  'CP-7965G',
  'MV12W-HW',
  'MV12N-HW',
  'MV21-HW',
  'MV71-HW',
]);

/**
 * Catálogo Estructurado de Accesorios Cisco y Meraki Vigentes (No-EOL 2026),
 * organizados en sus 6 familias oficiales.
 */
export const NON_EOL_CISCO_ACCESSORIES_CATALOG: Record<CiscoAccessoryCategory, readonly string[]> = {
  ANTENAS: [
    // Catalyst Wi-Fi 6 / 6E / 7 External & Smart Antennas (Vigentes)
    'C-ANT9101',
    'C-ANT9102',
    'C-ANT9103',
    'C-ANT9104',
    'CW-ANT-O1-NS-00',
    'CW-ANT-D1-NS-00',
    'CW-ANT-GPS1-S-00',
    'CW-ANT-T-1-00',
    // Aironet Active Dual-Band & Directional Antennas (Vigentes)
    'AIR-ANT2524DW-R',
    'AIR-ANT2524DW-RS',
    'AIR-ANT2524DB-R',
    'AIR-ANT2524DG-R',
    'AIR-ANT2524V4C-R',
    'AIR-ANT2524V4C-RS',
    'AIR-ANT2535SDW-R',
    'AIR-ANT2535SDW-RS',
    'AIR-ANT2544V4M-R',
    'AIR-ANT2544V4M-RS',
    'AIR-ANT2566P4W-R',
    'AIR-ANT2566P4W-RS',
    'AIR-ANT2566D4M-R',
    'AIR-ANT2566D4M-RS',
    'AIR-ANT2513P4M-N',
    'AIR-ANT5114P2M-N',
    'AIR-ANT2450V-N',
    'AIR-ANT2480V-N',
    'AIR-ANT5180V-N',
    // Meraki External Antennas (Wi-Fi 6 / 6E / Outdoor MR)
    'MA-ANT-3-A6',
    'MA-ANT-3-B6',
    'MA-ANT-3-C6',
    'MA-ANT-3-D6',
    'MA-ANT-3-E6',
    'MA-ANT-3-F6',
    'MA-ANT-20',
    'MA-ANT-21',
    'MA-ANT-23',
    'MA-ANT-25',
    'MA-ANT-27',
    'MA-ANT-28',
    'MA-ANT-35',
    'MA-ANT-CBL-1',
    // Cellular 4G LTE / 5G / Industrial / IoT / GPS Antennas
    'ANT-4G-OMNI-OUT-N',
    'ANT-4G-DP-OUT-TNC',
    'ANT-4G-SR-OUT-TNC',
    '4G-ANTM-OM-CM',
    '5G-ANTM-O-4-B',
    '5G-ANTM-O-2-B',
    'LTE-ANTM-SMA-D',
    'LTE-ANTM-D',
    'GPS-ACT-ANTM-SMA',
    'IR-ANT-5G-4-B',
    'C-ANT-5G-O',
    // RF Coaxial Antenna Cables & Lightning Arrestors
    'AIR-CAB002-D8-R',
    'AIR-CAB003-D8-R',
    'AIR-CAB005LL-R',
    'AIR-CAB010LL-R',
    'AIR-CAB020LL-R',
    'AIR-CAB050LL-R',
    'CAB-L400-5-N-N',
    'CAB-L400-10-N-N',
    'CAB-L400-20-N-N',
    'AIR-ACC2450-LA-N',
    'CGR-LA-NM-NF',
    'CGR-LA-NF-NF',
  ],

  CABLES: [
    // Power Cords (Chile/Italy, Rack PDU Jumper, Europe/Schuko, US/NEMA, Argentina, UK, Brazil, Meraki)
    'CAB-ACI',
    'CAB-ACA',
    'CAB-ACE',
    'CAB-AC',
    'CAB-ACR',
    'CAB-ACC',
    'CAB-ACU',
    'CAB-ACBZ-12A',
    'CAB-ACBZ-10A',
    'CAB-TA-IT',
    'CAB-TA-EU',
    'CAB-TA-NA',
    'CAB-TA-AR',
    'CAB-TA-UK',
    'CAB-TA-IN',
    'CAB-TA-AP',
    'CAB-TA-250V-JP',
    'CAB-C13-C14-2M',
    'CAB-C13-C14-AC',
    'CAB-C13-C14-JMPR',
    'CAB-C13-CBN',
    'CAB-C13-IT',
    'CAB-C14-C15',
    'CAB-C15-CBN',
    'CAB-C15-CBN-IT',
    'CAB-C15-CBN-EU',
    'CAB-C15-IT',
    'CAB-C19-CBN',
    'CAB-9K12A-NA',
    'CAB-9K10A-IT',
    'CAB-9K10A-EU',
    'CAB-9K10A-AR',
    'CAB-AC-C6K-TWLK',
    'MA-PWR-CORD-IT',
    'MA-PWR-CORD-EU',
    'MA-PWR-CORD-US',
    'MA-PWR-CORD-AR',
    'MA-PWR-CORD-UK',
    'MA-PWR-CORD-AU',
    'MA-PWR-CORD-CN',
    'MA-PWR-CORD-BR',
    'PWR-CORD-IT-A',
    'PWR-CORD-EU-A',
    'PWR-CORD-US-A',
    'PWR-CORD-AR-A',
    // Stacking & StackPower Cables (Catalyst 9200 / 9300 / Meraki MS)
    'STACK-T1-50CM',
    'STACK-T1-1M',
    'STACK-T1-3M',
    'STACK-T3-50CM',
    'STACK-T3-1M',
    'STACK-T3-3M',
    'STACK-T4-50CM',
    'STACK-T4-1M',
    'STACK-T4-3M',
    'CAB-SPWR-30CM',
    'CAB-SPWR-150CM',
    'MA-CBL-40G-50CM',
    'MA-CBL-40G-1M',
    'MA-CBL-40G-3M',
    'MA-CBL-100G-50CM',
    'MA-CBL-100G-1M',
    'MA-CBL-100G-3M',
    'MA-CBL-TA-1M',
    'MA-CBL-TA-3M',
    // High-Speed DAC (Twinax) & AOC Cables (10G / 25G / 40G / 100G / 400G)
    'SFP-H10GB-CU1M',
    'SFP-H10GB-CU1-5M',
    'SFP-H10GB-CU2M',
    'SFP-H10GB-CU2-5M',
    'SFP-H10GB-CU3M',
    'SFP-H10GB-CU5M',
    'SFP-H10GB-ACU7M',
    'SFP-H10GB-ACU10M',
    'SFP-10G-AOC1M',
    'SFP-10G-AOC2M',
    'SFP-10G-AOC3M',
    'SFP-10G-AOC5M',
    'SFP-10G-AOC7M',
    'SFP-10G-AOC10M',
    'SFP-25G-CU1M',
    'SFP-25G-CU2M',
    'SFP-25G-CU3M',
    'SFP-25G-CU5M',
    'SFP-25G-AOC1M',
    'SFP-25G-AOC2M',
    'SFP-25G-AOC3M',
    'SFP-25G-AOC5M',
    'SFP-25G-AOC7M',
    'SFP-25G-AOC10M',
    'QSFP-H40G-CU1M',
    'QSFP-H40G-CU3M',
    'QSFP-H40G-CU5M',
    'QSFP-H40G-ACU7M',
    'QSFP-H40G-ACU10M',
    'QSFP-H40G-AOC1M',
    'QSFP-H40G-AOC3M',
    'QSFP-H40G-AOC5M',
    'QSFP-H40G-AOC10M',
    'QSFP-100G-CU1M',
    'QSFP-100G-CU2M',
    'QSFP-100G-CU3M',
    'QSFP-100G-CU5M',
    'QSFP-100G-AOC1M',
    'QSFP-100G-AOC2M',
    'QSFP-100G-AOC3M',
    'QSFP-100G-AOC5M',
    'QSFP-100G-AOC7M',
    'QSFP-100G-AOC10M',
    'QSFP-100G-AOC15M',
    'QSFP-100G-AOC20M',
    'QSFP-100G-AOC30M',
    'QSFP-4SFP25G-CU1M',
    'QSFP-4SFP25G-CU3M',
    'QSFP-4SFP25G-CU5M',
    'QSFP-4X10G-AOC1M',
    'QSFP-4X10G-AOC3M',
    'QSFP-4X10G-AOC5M',
    'QDD-400G-CU1M',
    'QDD-400G-CU2M',
    'QDD-400G-CU3M',
    'QDD-400G-AOC1M',
    'QDD-400G-AOC3M',
    'QDD-400G-AOC5M',
    // Console, Serial, Patch & Collaboration Video/Audio Cables
    'CAB-CONSOLE-RJ45',
    'CAB-CONSOLE-USB',
    'CAB-USB-UB',
    'CAB-ETH-S-RJ45',
    'CAB-2HDMI-3M-GR',
    'CAB-HDMI-2M',
    'CAB-PRES-2HDMI-GR',
    'CAB-USBC-4K-3M',
    'CAB-MIC-T10-EXT',
    'CAB-ETH-5M-GR',
    'CAB-SS-V35MT',
    'CAB-SS-232MT',
  ],

  TRANSCEIVERS: [
    // 1G SFP Vigentes
    'GLC-TE',
    'GLC-SX-MMD',
    'GLC-LH-SMD',
    'GLC-ZX-SMD',
    'GLC-EX-SMD',
    'GLC-FE-100FX-RGD',
    'GLC-BX-D',
    'GLC-BX-U',
    'GLC-BX40-D-I',
    'GLC-BX40-U-I',
    'GLC-BX80-D-I',
    'GLC-BX80-U-I',
    // 10G SFP+ Vigentes
    'SFP-10G-SR',
    'SFP-10G-SR-S',
    'SFP-10G-SR-X',
    'SFP-10G-LR',
    'SFP-10G-LR-S',
    'SFP-10G-LR-X',
    'SFP-10G-ER',
    'SFP-10G-ER-S',
    'SFP-10G-ZR',
    'SFP-10G-ZR-S',
    'SFP-10G-LRM',
    'SFP-10G-T-X',
    'SFP-10G-BXD-I',
    'SFP-10G-BXU-I',
    'CWDM-SFP10G-1470',
    'CWDM-SFP10G-1490',
    'CWDM-SFP10G-1510',
    'CWDM-SFP10G-1530',
    'CWDM-SFP10G-1550',
    'CWDM-SFP10G-1570',
    'CWDM-SFP10G-1590',
    'CWDM-SFP10G-1610',
    // 25G SFP28 Vigentes
    'SFP-25G-SR-S',
    'SFP-10/25G-CSR-S',
    'SFP-10/25G-LR-S',
    'SFP-25G-ER-I',
    // 40G QSFP+ Vigentes
    'QSFP-40G-SR4',
    'QSFP-40G-SR4-S',
    'QSFP-40G-SR-BD',
    'QSFP-40G-LR4',
    'QSFP-40G-LR4-S',
    'QSFP-40G-ER4',
    'CVR-QSFP-SFP10G',
    // 100G QSFP28 Vigentes
    'QSFP-100G-SR4-S',
    'QSFP-100G-LR4-S',
    'QSFP-100G-CWDM4-S',
    'QSFP-100G-SM-SR',
    'QSFP-100G-ER4L-S',
    'QSFP-100G-ZR4-S',
    'QSFP-100G-DR-S',
    'QSFP-100G-FR-S',
    'QSFP-40/100-SRBD',
    'QSA-QSFP-SFP25G',
    // 400G QSFP-DD Vigentes
    'QDD-400G-DR4-S',
    'QDD-400G-FR4-S',
    'QDD-400G-LR4-S',
    'QDD-400G-SR8-S',
    'QDD-400G-ZRP-S',
    // Meraki Transceivers Vigentes
    'MA-SFP-1GB-SX',
    'MA-SFP-1GB-LX10',
    'MA-SFP-1GB-TX',
    'MA-SFP-10GB-SR',
    'MA-SFP-10GB-LR',
    'MA-SFP-10GB-LRM',
    'MA-SFP-10GB-ER',
    'MA-QSFP-40G-SR4',
    'MA-QSFP-40G-CSR4',
    'MA-QSFP-40G-LR4',
    'MA-QSFP-40G-SR-BD',
    'MA-QSFP-100G-SR4',
    'MA-QSFP-100G-LR4',
    // MDS SAN Fibre Channel Transceivers Vigentes
    'DS-SFP-FC16G-SW',
    'DS-SFP-FC16G-LW',
    'DS-SFP-FC32G-SW',
    'DS-SFP-FC32G-LW',
    'DS-SFP-FC64G-SW',
    'DS-SFP-FC64G-LW',
  ],

  ENERGIA_FUENTES_INYECTORES: [
    // Catalyst 9200 / 9300 / 9400 / 9500 / 9600 Power Supplies Vigentes
    'PWR-C1-350WAC-P',
    'PWR-C1-715WAC-P',
    'PWR-C1-1100WAC-P',
    'PWR-C1-715WDC',
    'PWR-C1-1900WAC-P',
    'PWR-C5-125WAC',
    'PWR-C5-600WAC',
    'PWR-C5-1KWAC',
    'PWR-C6-125WAC',
    'PWR-C6-600WAC',
    'PWR-C6-1KWAC',
    'PWR-C45-1000ACV',
    'C9400-PWR-3200AC',
    'C9400-PWR-2100AC',
    'C9K-PWR-650WAC-R',
    'C9K-PWR-1600WAC-R',
    'C9K-PWR-930WDC-R',
    'C9600-PWR-2KWAC',
    'C9600-PWR-3KWAC',
    // Nexus 9000 / Router 8000 / Firewall Power Supplies Vigentes
    'NXA-PAC-500W-PE',
    'NXA-PAC-500W-PI',
    'NXA-PAC-650W-PE',
    'NXA-PAC-650W-PI',
    'NXA-PAC-1100W-PE2',
    'NXA-PAC-1100W-PI2',
    'NXA-PAC-1200W-PE',
    'NXA-PAC-1200W-PI',
    'NXA-PAC-1900W-PE',
    'NXA-PAC-2000W-PE',
    'PWR-CC1-400WAC',
    'PWR-CC1-650WAC',
    'PWR-CC1-1000WAC',
    'FPR1K-PWR-AC-400',
    'FPR2K-PWR-AC-400',
    'FPR3K-PWR-AC-950',
    // Meraki Power Supplies Vigentes
    'MA-PWR-30W-US',
    'MA-PWR-50WAC',
    'MA-PWR-90WAC',
    'MA-PWR-100WAC',
    'MA-PWR-150WAC',
    'MA-PWR-250WAC',
    'MA-PWR-640WAC',
    'MA-PWR-1025WAC',
    'MA-PWR-1100WAC',
    'MA-PWR-MV-LV',
    // PoE / UPOE Injectors & Power Cubes Vigentes
    'AIR-PWRINJ6',
    'AIR-PWRINJ7',
    'AIR-PWRINJ-60RGD1',
    'AIR-PWRINJ-60RGD2',
    'CW-INJ-8',
    'MA-INJ-4',
    'MA-INJ-5',
    'MA-INJ-6',
    'SB-PWR-INJ2-NA',
    'SB-PWR-INJ2-EU',
    'PWR-IE50W-AC-L',
    'PWR-IE65W-PC-AC',
    'PWR-IE170W-PC-AC',
    'PWR-IE240W-PC-AC',
    'PWR-IE480W-PC-AC',
    'CP-PWR-CUBE-4',
    'CP-PWR-CUBE-5',
    'CP-PWR-ADPT-3',
    'CP-PWR-ADPT-4-NA',
    'PWR-4320-AC',
    'PWR-1100-AC',
    'PWR-1111-AC',
  ],

  MONTAJE_VENTILACION_BLANKS: [
    // Wireless AP Brackets, Clips & Mounts
    'AIR-AP-BRACKET-1',
    'AIR-AP-BRACKET-2',
    'AIR-AP-BRACKET-3',
    'AIR-AP-BRACKET-7',
    'AIR-AP-BRACKET-8',
    'AIR-AP-BRACKET-9',
    'AIR-AP-T-RAIL-R',
    'AIR-AP-T-RAIL-F',
    'AIR-CHNL-ADAPTER',
    'CW-MNT-ART1-00',
    'CW-MNT-ART2-00',
    'CW-MNT-HORZ1-00',
    'CW-MNT-VERT1-00',
    'MA-MNT-MR-14',
    'MA-MNT-MR-15',
    'MA-MNT-MR-16',
    'MA-MNT-MR-17',
    'MA-MNT-MR-18',
    'MA-MNT-MR-19',
    'MA-MNT-ANT-1',
    'MA-MNT-MV-1',
    'MA-MNT-MV-2',
    'MA-MNT-MV-11',
    'MA-MNT-MV-21',
    'MA-MNT-MV-31',
    'MA-MNT-MV-41',
    'MA-MNT-CLG-1',
    // Switch / Router / Firewall Rack Mount Kits, DIN Rails & Guard Kits
    'C9200-ACC-KIT',
    'C9200-ACC-KIT-19',
    'C9200-ACC-KIT-23',
    'C9200-ACC-KIT-24',
    'C9300-ACC-KIT',
    'C9300-ACC-KIT-19',
    'C9300-ACC-KIT-23',
    'C9300-ACC-KIT-24',
    'C9500-ACC-KIT-19',
    'C9500-ACC-KIT-23',
    'C9200-4PT-KIT',
    'C9300-4PT-KIT',
    'C9500-4PT-KIT',
    'RCKMNT-1RU-2KX',
    'RCKMNT-19-CMPCT',
    'RCKMNT-REC-2KX',
    'C1000-ACC-KIT',
    'ACS-1100-RM-19',
    'ACS-4320-RM-19',
    'ACS-4330-RM-19',
    'ACS-4430-RM-19',
    'ACS-8200-RM-19',
    'ACS-8300-RM-19',
    'C8200-RM-19-1R',
    'C8300-RM-19-1R',
    'C8300-RM-19-2R',
    'C9800-AC-RM-19',
    'FPR1K-DT-RCKMNT',
    'FPR1100-RCKMNT',
    'FPR2100-RCKMNT',
    'FPR3100-RCKMNT',
    'N9K-C9300-ACK',
    'N9K-C9300-RMK',
    'NXK-ACC-KIT-1RU',
    'NXK-ACC-KIT-2RU',
    'STK-RACK-DINRAIL',
    'DNA-DINRAIL',
    'MA-RACK-1U',
    'MA-DIN-MOUNT',
    // Fans & Blowers
    'FAN-T2',
    'FAN-T3',
    'FAN-T4-R',
    'NXA-FAN-30CFM-F',
    'NXA-FAN-30CFM-B',
    'NXA-FAN-35CFM-PE',
    'NXA-FAN-35CFM-PI',
    'NXA-FAN-65CFM-PE',
    'NXA-FAN-65CFM-PI',
    'NXA-FAN-160CFM-PE',
    'NXA-FAN-160CFM-PI',
    'C9400-FAN',
    'C9600-FAN',
    'C9K-T1-FANTRAY',
    'MA-FAN-18K',
    'MA-FAN-16K',
    // Blank Covers / Fillers
    'C9200-STACK-BLANK',
    'C9200-NM-BLANK',
    'C9300-NM-BLANK',
    'C9400-S-BLANK',
    'C9400-PWR-BLANK',
    'C9600-S-BLANK',
    'C9600-PWR-BLANK',
    'PWR-C1-BLANK',
    'PWR-C4-BLANK',
    'PWR-C5-BLANK',
    'PWR-C6-BLANK',
    'C8300-NIM-BLANK',
    'C8300-SM-BLANK',
    'C8300-PIM-BLANK',
    'TYPE1-STACK-BLANK',
    'TYPE3-STACK-BLANK',
  ],

  MODULOS_EXPANSION_ACCESORIOS: [
    // Switch Network Uplink Modules & Stack Kits
    'C9200-NM-4G',
    'C9200-NM-4X',
    'C9200-NM-2Y',
    'C9200-NM-2Q',
    'C9300-NM-4G',
    'C9300-NM-8X',
    'C9300-NM-2Y',
    'C9300-NM-2Q',
    'C9300-NM-4M',
    'C9300X-NM-8Y',
    'C9300X-NM-2C',
    'C9300X-NM-4C',
    'C9500-NM-8X',
    'C9500-NM-2Q',
    'C9200-STACK-KIT',
    'C9200L-STACK-KIT',
    'C9300L-STACK-KIT',
    'C9300L-STACK-KIT2',
    'MA-MOD-4X10G',
    'MA-MOD-8X10G',
    'MA-MOD-2X40G',
    // Modular Chassis Line Cards, Supervisors & SSDs
    'C9400-LC-48P',
    'C9400-LC-48U',
    'C9400-LC-48UX',
    'C9400-LC-48T',
    'C9400-LC-24XS',
    'C9400-LC-48XS',
    'C9400-LC-48HN',
    'C9400-LC-48HX',
    'C9400-SUP-1',
    'C9400-SUP-1XL',
    'C9400-SUP-1XL-Y',
    'C9400-SUP-2',
    'C9400-SUP-2XL',
    'C9400-SSD-240GB',
    'C9400-SSD-480GB',
    'C9400-SSD-960GB',
    'C9600-LC-48YL',
    'C9600-LC-24C',
    'C9600-LC-48TX',
    'C9600-LC-48S',
    'C9600X-LC-32CD',
    'C9600-SUP-1',
    'C9600X-SUP-2',
    'C9K-F1-SSD-240G',
    'C9K-F2-SSD-240GB',
    'SSD-120G',
    'SSD-240G',
    // Router NIMs, Service Modules (SM), Cellular Pluggables (LTE/5G) & Voice Modules
    'C-NIM-1M',
    'C-NIM-2T',
    'C-NIM-4X',
    'C-NIM-8MFT-T1/E1',
    'C-NIM-8T',
    'NIM-1MFT-T1/E1',
    'NIM-2MFT-T1/E1',
    'NIM-4MFT-T1/E1',
    'NIM-8MFT-T1/E1',
    'NIM-2FXO',
    'NIM-4FXO',
    'NIM-2FXS',
    'NIM-4FXS',
    'NIM-2FXSP',
    'NIM-4FXSP',
    'NIM-2FXS/4FXO',
    'NIM-2BRI-NT/TE',
    'NIM-4BRI-NT/TE',
    'NIM-ES2-4',
    'NIM-ES2-8',
    'NIM-ES2-8-P',
    'NIM-1GE-CU-SFP',
    'NIM-2GE-CU-SFP',
    'NIM-VAB-A',
    'NIM-SSD',
    'C-SM-NIM-ADPT',
    'SM-X-1T3/E3',
    'SM-X-4X1G-1X10G',
    'SM-X-6X1G',
    'SM-X-16G4M2X',
    'SM-X-24X1G-2X10G',
    'P-LTEAP18-GL',
    'P-LTEA-EA',
    'P-LTEA-LA',
    'P-5GS6-GL',
    'PVDM4-32',
    'PVDM4-64',
    'PVDM4-128',
    'PVDM4-256',
    'MEM-FLSH-4G',
    'MEM-FLSH-8G',
    'MEM-FLSH-16G',
    'MEM-C8200-8GB',
    'MEM-C8200-16GB',
    'MEM-C8300-16GB',
    'MEM-C8300-32GB',
    // Collaboration / Webex Accessories (Key Expansion Modules, Microphones, Mounts, Headsets)
    'CP-8800-A-KEM',
    'CP-8800-V-KEM',
    'CP-8800-WMK',
    'CP-9800-KEM',
    'CP-9800-WMK',
    'CS-MIC-TABLE-J',
    'CS-MIC-TABLE-E',
    'CS-MIC-CLG2',
    'CS-MIC-ARRAY-T',
    'CS-WALLMOUNT-S',
    'CS-WALLMOUNT-M',
    'CS-WALLMOUNT-L',
    'CS-T10-WMK',
    'CS-T10-TS',
    'CP-HS-WL-730',
    'HS-WL-980-BUNA',
    'HS-WL-562-S-US',
    'HS-W-321-C-USB',
  ],

  CAMARAS_SENSORES_TELEFONOS_ROOMBAR: [
    // Cámaras Meraki MV Vigentes (Indoor & Outdoor Gen 2 / Gen 3)
    'MV2-HW',
    'MV2',
    'MV12WE-HW',
    'MV12WE',
    'MV13-HW',
    'MV13',
    'MV13M-HW',
    'MV13M',
    'MV22X-HW',
    'MV22X',
    'MV23M-HW',
    'MV23M',
    'MV23X-HW',
    'MV23X',
    'MV32-HW',
    'MV32',
    'MV33-HW',
    'MV33',
    'MV33M-HW',
    'MV33M',
    'MV52-HW',
    'MV52',
    'MV63-HW',
    'MV63',
    'MV63M-HW',
    'MV63M',
    'MV63X-HW',
    'MV63X',
    'MV72X-HW',
    'MV72X',
    'MV73M-HW',
    'MV73M',
    'MV73X-HW',
    'MV73X',
    'MV84X-HW',
    'MV84X',
    'MV93-HW',
    'MV93',
    'MV93M-HW',
    'MV93M',
    'MV93X-HW',
    'MV93X',
    // Sensores Meraki MT Vigentes (Ambientales, Puertas, Agua, Calidad de Aire, Energía)
    'MT10-HW',
    'MT10',
    'MT11-HW',
    'MT11',
    'MT12-HW',
    'MT12',
    'MT14-HW',
    'MT14',
    'MT15-HW',
    'MT15',
    'MT20-HW',
    'MT20',
    'MT30-HW',
    'MT30',
    'MT40-HW',
    'MT40',
    'MA-SFP-MT11-1',
    'MA-CBL-MT12-1',
    'MA-CBL-MT12-2',
    // Teléfonos IP Cisco Vigentes (Series DP-9800, CP-9800, CP-8800, CP-7800, CP-6800, DECT & Conferencia)
    'DP-9841-K9',
    'DP-9851-K9',
    'DP-9861-K9',
    'DP-9871-K9',
    'CP-9841-K9',
    'CP-9851-K9',
    'CP-9861-K9',
    'CP-9871-K9',
    'CP-8811-K9',
    'CP-8811-3PCC-K9',
    'CP-8841-K9',
    'CP-8841-3PCC-K9',
    'CP-8845-K9',
    'CP-8845-3PCC-K9',
    'CP-8851-K9',
    'CP-8851-3PCC-K9',
    'CP-8861-K9',
    'CP-8861-3PCC-K9',
    'CP-8865-K9',
    'CP-8865-3PCC-K9',
    'CP-8875-K9',
    'CP-8875NR-K9',
    'CP-8832-K9',
    'CP-8832-3PCC-K9',
    'CP-8821-K9-BUN',
    'CP-7811-K9',
    'CP-7811-3PCC-K9',
    'CP-7821-K9',
    'CP-7821-3PCC-K9',
    'CP-7841-K9',
    'CP-7841-3PCC-K9',
    'CP-7861-K9',
    'CP-7861-3PCC-K9',
    'CP-7832-K9',
    'CP-7832-3PCC-K9',
    'CP-6821-3PCC-K9',
    'CP-6841-3PCC-K9',
    'CP-6851-3PCC-K9',
    'CP-6861-3PCC-K9',
    'CP-6871-3PCC-K9',
    'DBS-210-3PC-K9',
    'CP-6825-3PC-K9',
    'ATA191-K9',
    'ATA191-3PW-K9',
    // Room Bar, Room Kit, Board Pro, Desk Pro, Codecs, Cámaras PTZ y Touch Panels Webex Vigentes
    'CS-BAR-T-K9',
    'CS-BAR-T-C-K9',
    'CS-BARPRO-K9',
    'CS-BARPRO-C-K9',
    'CS-BAR-BYOD-K9',
    'CS-KIT-EQ-K9',
    'CS-KIT-EQX-K9',
    'CS-KITPLUS-K9',
    'CS-KITPRO-K9',
    'CS-KITMINI-K9',
    'CS-CODEC-EQ-K9',
    'CS-CODEC-PRO-K9',
    'CS-CODEC-PLUS-K9',
    'CS-BRD55P-K9',
    'CS-BRD75P-K9',
    'CS-BRD55P-G2-K9',
    'CS-BRD75P-G2-K9',
    'CS-DESKPRO-K9',
    'CS-DESK-K9',
    'CS-DESKMINI-K9',
    'CS-CAM-PTZ4K',
    'CS-QUADCAM2',
    'CS-T10-TS-K9',
    'CS-T10-WM-K9',
    'CS-T10-TS-L-K9',
    'CS-T10-WM-L-K9',
  ],
};

/**
 * Set consolidado O(1) de todos los SKUs de accesorios vigentes No-EOL 2026.
 */
export const NON_EOL_CISCO_ACCESSORIES_SET: ReadonlySet<string> = new Set(
  Object.values(NON_EOL_CISCO_ACCESSORIES_CATALOG)
    .flat()
    .map((sku) => sku.trim().toUpperCase())
);

/**
 * Expresiones Regulares de cobertura infinita para identificar CUALQUIER accesorio
 * Cisco / Meraki vigente (Antenas, Cables, Transceivers, Fuentes, Inyectores, Kits de Montaje,
 * Kits de Stacking, Módulos de Expansión, Ventiladores, Blanks, Cámaras, Sensores, Teléfonos IP, Room Bar).
 */
export const CISCO_ACCESSORY_INFINITE_PATTERNS: readonly RegExp[] = [
  // 1. ANTENAS y Accesorios RF
  /^C-ANT\d+/i,
  /^CW-ANT[-A-Z0-9]+/i,
  /^AIR-ANT\d+/i,
  /^MA-ANT[-A-Z0-9]+/i,
  /^ANT-(4G|5G|LTE|GPS)[-A-Z0-9]*/i,
  /^(4G|5G|LTE|GPS)(-ACT)?-ANTM[-A-Z0-9]*/i,
  /^IR-ANT[-A-Z0-9]+/i,
  /^C-ANT-5G[-A-Z0-9]*/i,
  /^AIR-CAB\d+/i,
  /^AIR-ACC[-A-Z0-9]+/i,
  /^CGR-LA[-A-Z0-9]+/i,

  // 2. CABLES (Poder, Stacking, StackPower, DAC, AOC, Consola, Patch, Video/Audio)
  /^CAB-[A-Z0-9-]+/i,
  /-CAB-[A-Z0-9-]+/i,
  /^MA-PWR-CORD[-A-Z0-9]*/i,
  /^PWR-CORD[-A-Z0-9]*/i,
  /^STACK-T[1-9][-A-Z0-9]*/i,
  /^MA-CBL[-A-Z0-9]+/i,

  // 3. TRANSCEIVERS ÓPTICOS Y DAC/AOC (1G, 10G, 25G, 40G, 100G, 400G, Fibre Channel)
  /^GLC-(TE|SX|LH|ZX|EX|FE|BX)[-A-Z0-9]*/i,
  /^SFP-(10G|25G|10\/25G|H10GB|H25G|GE)[-A-Z0-9]*/i,
  /^QSFP-(40G|100G|40\/100|H40G|4SFP|4X10G)[-A-Z0-9]*/i,
  /^QDD-400G[-A-Z0-9]*/i,
  /^CVR-(QSFP|X2)[-A-Z0-9]*/i,
  /^QSA-QSFP[-A-Z0-9]*/i,
  /^CWDM-SFP[-A-Z0-9]*/i,
  /^DWDM-SFP[-A-Z0-9]*/i,
  /^MA-SFP[-A-Z0-9]+/i,
  /^MA-QSFP[-A-Z0-9]+/i,
  /^DS-SFP-FC[-A-Z0-9]+/i,
  /^ONS-SC[-A-Z0-9]+/i,

  // 4. FUENTES DE PODER, INYECTORES PoE Y ADAPTADORES AC/DC
  /^PWR-(C[1-9]|CC[1-9]|C45|IE|43\d\d|44\d\d|11\d\d)[-A-Z0-9]*/i,
  /^C9[23456]00-PWR[-A-Z0-9]+/i,
  /^C9K-PWR[-A-Z0-9]+/i,
  /^NXA-PAC[-A-Z0-9]+/i,
  /^FPR[12349]K-PWR[-A-Z0-9]+/i,
  /^MA-PWR-\d+W/i,
  /^MA-PWR-MV/i,
  /^AIR-PWRINJ[-A-Z0-9]*/i,
  /^CW-INJ[-A-Z0-9]+/i,
  /^MA-INJ-[4-9][-A-Z0-9]*/i,
  /^SB-PWR-INJ[-A-Z0-9]*/i,
  /^CP-PWR-(CUBE|ADPT)[-A-Z0-9]*/i,

  // 5. KITS DE MONTAJE, BRACKETS, RIELES, VENTILADORES Y TAPAS CIEGAS (BLANKS)
  /^AIR-AP-(BRACKET|T-RAIL)[-A-Z0-9]*/i,
  /^AIR-CHNL-ADAPTER/i,
  /^CW-MNT[-A-Z0-9]+/i,
  /^MA-MNT[-A-Z0-9]+/i,
  /^C(1000|1200|1300|9200|9300|9400|9500|9600)X?-(ACC|4PT)-KIT[-A-Z0-9]*/i,
  /^RCKMNT[-A-Z0-9]+/i,
  /-RCKMNT$/i,
  /^ACS-\d+-RM[-A-Z0-9]*/i,
  /^C8[235]00-RM[-A-Z0-9]+/i,
  /^C9800-[A-Z0-9]+-RM[-A-Z0-9]*/i,
  /^N9K-[A-Z0-9]+-(ACK|RMK)/i,
  /^NXK-ACC-KIT[-A-Z0-9]*/i,
  /^STK-RACK-DINRAIL/i,
  /^DNA-DINRAIL/i,
  /^MA-(RACK|DIN)[-A-Z0-9]+/i,
  /^FAN-T[1-9][-A-Z0-9]*/i,
  /^NXA-FAN[-A-Z0-9]+/i,
  /^C9[46]00-FAN/i,
  /^C9K-T1-FANTRAY/i,
  /^MA-FAN[-A-Z0-9]+/i,
  /-BLANK$/i,

  // 6. MÓDULOS DE EXPANSIÓN (NM, NIM, SM), STACK KITS, TARJETAS DE LÍNEA Y ACCESORIOS COLAB
  /^C9[235]00X?-NM[-A-Z0-9]+/i,
  /^C9[23]00L?-STACK-KIT\d*/i,
  /^MA-MOD[-A-Z0-9]+/i,
  /^C9[46]00X?-(LC|SUP|SSD)[-A-Z0-9]+/i,
  /^C9K-F[12]-SSD[-A-Z0-9]+/i,
  /^SSD-\d+G/i,
  /^C-NIM[-A-Z0-9/]+/i,
  /^NIM-[A-Z0-9/-]+/i,
  /^C-SM-NIM-ADPT/i,
  /^SM-X-[A-Z0-9/-]+/i,
  /^P-(LTE|5G)[A-Z0-9-]+/i,
  /^PVDM4-\d+/i,
  /^MEM-(FLSH|C8200|C8300)[-A-Z0-9]+/i,
  /^CP-(8800|9800)-[A-Z0-9-]*?(KEM|WMK)/i,
  /^CS-(MIC|WALLMOUNT|T10)[-A-Z0-9]+/i,
  /^(CP-)?HS-(WL|W)-\d+[-A-Z0-9]*/i,

  // 7. CÁMARAS (MV), SENSORES (MT), TELÉFONOS IP (CP/DP) Y ROOM BAR / COLABORACIÓN WEBEX (CS-*)
  /^MV([12356789]\d|2)[A-Z0-9-]*/i,
  /^MT(10|11|12|14|15|20|30|40)(-HW)?$/i,
  /^(CP|DP)-(68\d\d|78\d\d|88\d\d|98\d\d)[A-Z0-9-]*/i,
  /^DBS-\d{3}[-A-Z0-9]*/i,
  /^ATA19\d[-A-Z0-9]*/i,
  /^CS-(BAR|BARPRO|KIT|CODEC|BRD|BOARD|DESK|ROOM|CAM|QUADCAM|T10|TOUCH|MIC|WALLMOUNT)[A-Z0-9-]*/i,
];

/**
 * Expresiones Regulares de EQUIPOS PRINCIPALES DE RED Y CÓMPUTO (NO son accesorios).
 * Protege switches, routers, access points, firewalls, controladoras inalámbricas y servidores UCS
 * para que NUNCA sean confundidos con accesorios cuando están en línea madre (1.0, 2.0, 3.0...) sin '='.
 * Nota: Cámaras (MV), Sensores (MT), Teléfonos IP (CP/DP) y Room Bar (CS-*) SÍ se consideran accesorios.
 */
const MAIN_EQUIPMENT_CHASSIS_EXCLUSION_PATTERNS: readonly RegExp[] = [
  // Switches Catalyst, Nexus, Meraki MS, Industrial IE, Business CBS/C1200/C1300
  /^C(1000|1200|1300|9200|9300|9400|9500|9600)[A-Z]*-\d+[A-Z0-9-]+/i,
  /^C9[46]00R?-\d+R\b/i, // Chasis modulares C9404R, C9407R, C9410R, C9606R
  /^WS-C\d+/i,
  /^N[39]K-C\d+/i, // Switches Nexus (excepto ACK/RMK que se filtran aparte)
  /^MS[1234]\d\d-/i,
  /^IE-\d{4}-/i,
  /^CBS\d{3}-/i,

  // Routers Catalyst 8000, ISR 1000/4000, ASR, Meraki MX/MG/Z, Industrial IR
  /^C(11\d\d|81\d\d|82\d\d|83\d\d|85\d\d|8[235]00)[A-Z0-9-]*-(1N|2N|4N|4T|8P|4P|G2|1S|2S|4S)/i,
  /^ISR4\d{3}/i,
  /^ASR1\d{3}/i,
  /^IR(1101|18\d\d)/i,
  /^MX(6\d|7\d|8\d|9\d|10\d|250|450)\b/i,
  /^MG(21|41|51|52)/i,
  /^Z[34][A-Z0-9-]*/i,

  // Access Points & Wireless Controllers (Catalyst 9100 / CW916x / CW917x / C9800 / Meraki MR)
  /^CW91[67]\d[A-Z0-9-]*/i,
  /^C91[01236]\d[A-Z0-9-]*/i,
  /^AIR-AP\d{4}/i,
  /^MR[234578]\d[A-Z0-9-]*/i,
  /^C9800-(L|40|80|CL)-(F|C|K9)/i,

  // Firewalls & Security Appliances (Secure Firewall FPR / ASA / FMC / ISE)
  /^FPR[12349]\d{3}-(NGFW|ASA|TD|SMP|K9)/i,
  /^ASA55\d\d/i,
  /^FMC\d{4}/i,
  /^SNS-\d{4}/i,

  // UCS Servers & Catalyst Center Appliances
  /^UCSC?-C\d{3}/i,
  /^UCSB-B\d{3}/i,
  /^UCSX-\d+/i,
  /^DN2-HW-APL/i,
];

/**
 * Normaliza el número de línea de un Estimate CCW para garantizar que toda Línea Madre
 * (ya sea Hardware, Accesorio o Suscripción) tenga siempre el formato "1.0", "2.0", "3.0",
 * "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0", "11.0"... (y nunca "1", "2", "3", "4", "5"
 * ni con coma decimal "1,0", "2,0").
 */
export function normalizeCcwLineNumber(lineNumber?: string | number): string {
  if (lineNumber === undefined || lineNumber === null) return '';
  if (typeof lineNumber === 'number' && !isNaN(lineNumber) && lineNumber >= 0) {
    if (Number.isInteger(lineNumber)) return `${lineNumber}.0`;
    return String(lineNumber);
  }
  const clean = String(lineNumber).trim().replace(/,/g, '.');
  if (!clean) return '';
  if (/^\d+$/.test(clean)) {
    return `${clean}.0`;
  }
  return clean;
}

/**
 * Verifica si el número de línea corresponde estrictamente al formato de LÍNEA MADRE (Main Line):
 * Formato exclusivo válido: "1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0", "11.0"... hasta el infinito
 * (también soporta si viene con coma "1,0", "2,0", "3,0").
 * NUNCA "1", "2", "3", "4", "5" sin ".0", y NUNCA sub-líneas hijas ("1.1", "1.2", "2.1", "3.4", "1.0.1").
 */
export function isMotherLineFormat(lineNumber?: string): boolean {
  if (lineNumber === undefined || lineNumber === null) return false;
  const clean = String(lineNumber).trim().replace(/,/g, '.');
  if (!clean) return false;
  return /^\d+\.0$/.test(clean);
}

/**
 * Verifica si un SKU (sin el '=' final) está marcado como End-of-Life / End-of-Sale (EOL).
 */
export function isEolAccessoryOrProductSku(sku: string): boolean {
  const cleanSku = (sku || '').trim().toUpperCase().replace(/=$/, '');
  if (!cleanSku) return false;
  if (KNOWN_EOL_ACCESSORY_SKUS.has(cleanSku)) return true;
  const eolEntry = MODULAR_EOL_CATALOG_2026[cleanSku];
  if (eolEntry && eolEntry.status === 'eos_eol_active' && !eolEntry.canKeepOriginal) {
    return true;
  }
  return false;
}

/**
 * Determina si un SKU es un Equipo Principal de Red/Cómputo (Switch, Router, AP, Firewall,
 * Controladora Inalámbrica, Servidor UCS).
 */
export function isMainHardwareChassisSku(sku: string): boolean {
  const cleanSku = (sku || '').trim().toUpperCase().replace(/=$/, '');
  if (!cleanSku) return false;

  // Excepciones de accesorios que comparten prefijo con chasis (ej. N9K-C9300-ACK / RMK, C9800-AC-RM-19)
  if (
    /-(ACK|RMK|ACC-KIT|4PT-KIT|STACK-KIT\d*|BLANK|RCKMNT|KEM|WMK)$/i.test(cleanSku) ||
    /-RM-19/i.test(cleanSku)
  ) {
    return false;
  }

  return MAIN_EQUIPMENT_CHASSIS_EXCLUSION_PATTERNS.some((regex) => regex.test(cleanSku));
}

/**
 * Determina si un SKU o descripción corresponde a un ACCESORIO FÍSICO CISCO / MERAKI VIGENTE (No-EOL).
 * Cubre de forma infinita:
 * - Antenas (Catalyst, Aironet, Meraki, Celulares 4G/5G, GPS)
 * - Cables (Poder AC/DC, Stacking, StackPower, DAC Twinax, AOC, Consola, HDMI/Audio/Red)
 * - Transceivers Ópticos (SFP, SFP+, SFP28, QSFP+, QSFP28, QSFP-DD, Fibre Channel)
 * - Fuentes de Poder, Inyectores PoE y Cubos/Adaptadores de Energía
 * - Kits de Montaje, Brackets de AP, Rieles de Rack/DIN, Ventiladores (Fans) y Tapas Ciegas (Blanks)
 * - Módulos de Expansión (NM, NIM, SM-X), Kits de Apilamiento (Stack Kits), Tarjetas de Línea y Accesorios Webex
 * - Cámaras (MV), Sensores (MT), Teléfonos IP (CP/DP) y Room Bar / Endpoints de Colaboración (CS-*)
 */
export function isCiscoAccessorySku(sku: string, description: string = ''): boolean {
  const cleanSku = (sku || '').trim().toUpperCase().replace(/=$/, '');
  const lowerDesc = (description || '').trim().toLowerCase();

  if (!cleanSku) return false;

  // 1. Nunca clasificar licencias/software/servicios intangibles como accesorios físicos
  if (isCiscoIntangibleSku(cleanSku, lowerDesc)) {
    return false;
  }
  if (
    cleanSku.startsWith('CON-') ||
    cleanSku.startsWith('CON') ||
    cleanSku.startsWith('LIC-') ||
    cleanSku.startsWith('L-') ||
    cleanSku.startsWith('SVS-') ||
    cleanSku.startsWith('CX-') ||
    cleanSku.includes('-DNA-') ||
    cleanSku.startsWith('DNA-') ||
    lowerDesc.includes('term license') ||
    lowerDesc.includes('smartnet') ||
    lowerDesc.includes('subscription')
  ) {
    if (!cleanSku.includes('DINRAIL')) {
      return false;
    }
  }

  // 2. Excluir SKUs que estén en End-of-Life (EOL)
  if (isEolAccessoryOrProductSku(cleanSku)) {
    return false;
  }

  // 3. Excluir Equipos Principales (Switches, Routers, APs, Firewalls, Controladoras, Servidores UCS)
  if (isMainHardwareChassisSku(cleanSku)) {
    return false;
  }

  // 4. Búsqueda directa O(1) en el Catálogo Oficial de Accesorios No-EOL 2026
  if (NON_EOL_CISCO_ACCESSORIES_SET.has(cleanSku)) {
    return true;
  }

  // 5. Evaluación contra los Patrones RegExp Infinitos de Familias de Accesorios Cisco/Meraki
  if (CISCO_ACCESSORY_INFINITE_PATTERNS.some((pattern) => pattern.test(cleanSku))) {
    return true;
  }

  // 6. Respaldo semántico por descripción para accesorios genéricos no-chasis
  const accessoryDescKeywords = [
    'antenna',
    'antena',
    'power cord',
    'power cable',
    'jumper cord',
    'cabinet jumper',
    'stacking cable',
    'stack cable',
    'stackpower cable',
    'console cable',
    'twinax cable',
    'transceiver module',
    'sfp module',
    'qsfp module',
    'power injector',
    'poe injector',
    'mounting bracket',
    'mount kit',
    'rack mount kit',
    'accessory kit',
    'fan tray',
    'blank module',
    'blank cover',
    'key expansion module',
    'ip phone',
    'desk phone',
    'room bar',
    'room kit',
    'varifocal camera',
    'smart camera',
    'humidity sensor',
    'environmental sensor',
  ];

  if (accessoryDescKeywords.some((kw) => lowerDesc.includes(kw))) {
    return true;
  }

  return false;
}
