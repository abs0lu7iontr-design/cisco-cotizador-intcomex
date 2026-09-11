// ============================================================================
// CISCO AUTOMATED v2.1 - MINING AUDIT ADAPTER
// ============================================================================

import { runMiningAudit } from './miningAuditor';
import { CustomerMatchInput } from './customerMatcher';
import { AuditReport } from './types';

/**
 * Adaptador seguro para aislar errores del motor auditor.
 * Ejecuta análisis local inmediato (cero latencia, soporte 100% offline).
 */
export function executeSafeMiningAudit(parsedEstimate: any): AuditReport | null {
  try {
    if (!parsedEstimate || !Array.isArray(parsedEstimate.items)) {
      return null;
    }

    const customerInput: CustomerMatchInput = {
      customerName: parsedEstimate.headerInfo?.customerName || '',
      companyName: parsedEstimate.headerInfo?.companyName || '',
      dealName: parsedEstimate.headerInfo?.dealName || parsedEstimate.headerInfo?.dealId || '',
      fileName: parsedEstimate.fileName || parsedEstimate.originalFileName || '',
    };

    const totalUsd = parsedEstimate.originalProductTotal || parsedEstimate.calculatedProductTotal || 0;

    return runMiningAudit(customerInput, parsedEstimate.items, totalUsd);
  } catch (error) {
    console.warn("Auditor de minería no pudo evaluar el archivo (continuando flujo normal):", error);
    return null;
  }
}

/**
 * Cliente HTTP para invocar el microservicio edge (/api/mining-audit) en Cloudflare Pages Functions.
 */
export async function auditEstimateViaMicroservice(payload: {
  customerName?: string;
  companyName?: string;
  fileName?: string;
  dealName?: string;
  items: any[];
  bomTotalUsd: number;
}): Promise<AuditReport | null> {
  try {
    const res = await fetch('/api/mining-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.report || null;
  } catch (err) {
    console.warn('Microservicio /api/mining-audit no disponible:', err);
    return null;
  }
}
