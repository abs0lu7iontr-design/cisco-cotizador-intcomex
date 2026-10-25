// ============================================================================
// CISCO AUTOMATED - PREDICTIVE BOM VALIDATOR
// Escaneo heurístico preventivo de compatibilidad y completitud en listas Cisco CCW
// ============================================================================

import { EstimateLineItem } from './types';

export interface BomValidationIssue {
  id: string;
  category: 'license' | 'accessory' | 'support' | 'hardware';
  severity: 'warning' | 'info' | 'recommendation';
  title: string;
  description: string;
  affectedPartNumbers: string[];
  suggestedAction: string;
}

export interface BomValidationReport {
  hasIssues: boolean;
  totalIssuesCount: number;
  warningsCount: number;
  recommendationsCount: number;
  issues: BomValidationIssue[];
}

/**
 * Analiza las líneas de una cotización para detectar omisiones comunes de preventa Cisco
 */
export function validateCiscoBom(items: readonly EstimateLineItem[] = []): BomValidationReport {
  const issues: BomValidationIssue[] = [];

  const validItems = items.filter((it) => !it.isInfoRow && it.partNumber);
  const partNumbers = validItems.map((it) => it.partNumber.toUpperCase().trim());

  // 1. Detección de Switches Catalyst sin licencia DNA obligatoria
  const catalystSwitches = validItems.filter((it) =>
    /^(C9200|C9300|C9400|C9500|C9600)/i.test(it.partNumber)
  );

  if (catalystSwitches.length > 0) {
    const hasDnaLicense = partNumbers.some(
      (pn) =>
        pn.includes('DNA') ||
        pn.includes('NETWORK-') ||
        pn.includes('-DNA-E') ||
        pn.includes('-DNA-A') ||
        pn.includes('-DNA-P')
    );

    if (!hasDnaLicense) {
      issues.push({
        id: 'catalyst-missing-dna',
        category: 'license',
        severity: 'warning',
        title: 'Switch Catalyst sin licencia de suscripción Cisco DNA detectada',
        description: `Se detectaron ${catalystSwitches.length} switches Catalyst serie 9000 sin licencias DNA (Essential / Advantage). Cisco exige al menos 3 o 5 años de suscripción de software en la mayoría de estos modelos.`,
        affectedPartNumbers: catalystSwitches.map((s) => s.partNumber),
        suggestedAction: 'Verificar en Cisco CCW si el switch requiere agregar la suscripción DNA-E o DNA-A correspondiente.',
      });
    }
  }

  // 2. Detección de Hardware con Fuente de Poder sin Cable de Alimentación Chileno
  const requiresPowerCord = validItems.filter((it) =>
    /(^C9200|^C9300|^C9400|^ISR4|^C8200|^C8300|^PWR-)/i.test(it.partNumber) && !it.isIntangible
  );

  if (requiresPowerCord.length > 0) {
    const hasChileanPowerCord = partNumbers.some(
      (pn) =>
        pn.includes('CHL') ||
        pn.includes('CAB-ETH-CHL') ||
        pn.includes('CAB-ACT-CHL') ||
        pn.includes('CAB-AC') ||
        pn.includes('CAB-9K')
    );

    if (!hasChileanPowerCord) {
      issues.push({
        id: 'missing-chile-power-cord',
        category: 'accessory',
        severity: 'info',
        title: 'Sin cable de alimentación estándar para Chile detectado',
        description: 'La cotización incluye chasis o fuentes de poder Cisco pero no se observa un cable de corriente local (ej. CAB-ETH-CHL o CAB-ACT-CHL).',
        affectedPartNumbers: requiresPowerCord.slice(0, 5).map((s) => s.partNumber),
        suggestedAction: 'Confirmar si el cliente final reutilizará cables de rack existentes o si requiere cotizar CAB-ETH-CHL.',
      });
    }
  }

  // 3. Equipos Meraki (-HW) sin Licencia de Operación Cloud (LIC-)
  const merakiHardware = validItems.filter(
    (it) => it.partNumber.endsWith('-HW') || /^MR\d|^MS\d|^MX\d/i.test(it.partNumber)
  );

  if (merakiHardware.length > 0) {
    const hasMerakiLic = partNumbers.some(
      (pn) => pn.startsWith('LIC-') || pn.includes('LIC-ENT') || pn.includes('LIC-SEC')
    );

    if (!hasMerakiLic) {
      issues.push({
        id: 'meraki-missing-cloud-license',
        category: 'license',
        severity: 'warning',
        title: 'Equipos Cisco Meraki sin licencia de gestión Dashboard',
        description: `Se detectaron ${merakiHardware.length} dispositivos Meraki sin su respectiva licencia cloud obligatoria. Los equipos Meraki no operan sin licencia activa.`,
        affectedPartNumbers: merakiHardware.map((m) => m.partNumber),
        suggestedAction: 'Agregar las licencias correspondientes (ej. LIC-ENT-1YR o LIC-SEC-3YR) para cada dispositivo.',
      });
    }
  }

  // 4. Hardware de Alto Valor sin Soporte SmartNet
  const highValueHardware = validItems.filter(
    (it) => !it.isIntangible && it.netCiscoUnit >= 800 && it.qty > 0
  );

  const hasSmartNet = partNumbers.some(
    (pn) =>
      pn.startsWith('CON-') ||
      pn.startsWith('SVS-') ||
      pn.startsWith('CX-') ||
      pn.startsWith('CXS-') ||
      pn.includes('SNTC')
  );

  if (highValueHardware.length > 0 && !hasSmartNet) {
    issues.push({
      id: 'high-value-missing-smartnet',
      category: 'support',
      severity: 'recommendation',
      title: 'Equipos críticos sin contrato de soporte SmartNet',
      description: `Hay ${highValueHardware.length} ítems de hardware de alto valor sin cobertura de soporte técnico ni reemplazo de partes (CON-SNT/SNTC).`,
      affectedPartNumbers: highValueHardware.slice(0, 5).map((h) => h.partNumber),
      suggestedAction: 'Ofrecer al Partner el contrato de soporte oficial SmartNet 8x5xNBD o 24x7x4 para asegurar su continuidad operacional.',
    });
  }

  const warningsCount = issues.filter((i) => i.severity === 'warning').length;
  const recommendationsCount = issues.filter((i) => i.severity !== 'warning').length;

  return {
    hasIssues: issues.length > 0,
    totalIssuesCount: issues.length,
    warningsCount,
    recommendationsCount,
    issues,
  };
}
