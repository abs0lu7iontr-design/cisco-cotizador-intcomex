// ============================================================================
// CISCO AUTOMATED v2.1 - MINING AUDIT ADAPTER
// ============================================================================

import { runMiningAudit } from './miningAuditor';
import { AuditReport } from './types';

/**
 * Adaptador seguro para aislar errores del motor auditor.
 */
export function executeSafeMiningAudit(parsedEstimate: any): AuditReport | null {
  try {
    if (!parsedEstimate || !Array.isArray(parsedEstimate.items)) {
      return null;
    }

    const customerName = parsedEstimate.headerInfo?.customerName || '';
    const totalUsd = parsedEstimate.originalProductTotal || parsedEstimate.calculatedProductTotal || 0;

    return runMiningAudit(customerName, parsedEstimate.items, totalUsd);
  } catch (error) {
    console.warn("Auditor de minería no pudo evaluar el archivo (continuando flujo normal):", error);
    return null;
  }
}
