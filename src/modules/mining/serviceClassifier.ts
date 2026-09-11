// ============================================================================
// CISCO AUTOMATED v2.1 - CISCO SERVICE & LINE CLASSIFIER
// ============================================================================

import { LineCategory, IotStatus } from './types';
import { isCiscoLicenseSku } from '../../core/ciscoTaxonomy';

export function classifyCiscoLine(partNumber: string, description: string): {
  category: LineCategory;
  iotStatus: IotStatus;
  ruleEvidence: string;
} {
  const sku = (partNumber || '').toUpperCase().trim();
  const desc = (description || '').toUpperCase().trim();

  // Detección IoT
  const isIot = sku.startsWith('IE-') || sku.startsWith('IR-') || desc.includes('INDUSTRIAL ETHERNET') || desc.includes('RUGGED');
  const iotStatus: IotStatus = isIot ? 'YES' : 'NO';

  // 1. Solution Support
  if (sku.startsWith('CON-SS') || desc.includes('SOLUTION SUPPORT') || desc.includes('SWSS')) {
    return { category: 'SOLUTION_SUPPORT', iotStatus, ruleEvidence: 'Patrón CON-SS o etiqueta SOLUTION SUPPORT' };
  }

  // 2. Success Track (CX)
  if (sku.startsWith('CX') || sku.startsWith('CXE-') || desc.includes('SUCCESS TRACK')) {
    return { category: 'SUCCESS_TRACK', iotStatus, ruleEvidence: 'Prefijo CX o descripción SUCCESS TRACK' };
  }

  // 3. SmartNet Tradicional (SNT / CXL1)
  if (
    sku.startsWith('CON-SNT') || 
    sku.startsWith('CON-SNTP') || 
    sku.startsWith('CON-L1') || 
    sku.startsWith('CON-OS') || 
    sku.startsWith('CON-ECDN')
  ) {
    return { category: 'SMARTNET_SNT', iotStatus, ruleEvidence: 'Contrato tradicional Cisco SmartNet' };
  }

  // 4. Suscripciones SaaS / Licenciamiento Cloud
  const isSubscriptionSku = 
    sku.startsWith('LIC-') || 
    sku.endsWith('-SUB') || 
    desc.includes('SUBSCRIPTION') || 
    desc.includes('TERM LICENSE') ||
    isCiscoLicenseSku(sku, desc);

  if (isSubscriptionSku) {
    return { category: 'SUBSCRIPTION', iotStatus, ruleEvidence: 'Licencia Cloud / Suscripción de software Cisco' };
  }

  // 5. Otros Servicios
  if (sku.startsWith('CON-') || desc.includes('SUPPORT')) {
    return { category: 'OTHER_SERVICE', iotStatus, ruleEvidence: 'Servicio Cisco misceláneo' };
  }

  // 6. Producto Hardware / Default
  return { category: 'PRODUCT', iotStatus, ruleEvidence: 'Hardware o equipamiento base' };
}
