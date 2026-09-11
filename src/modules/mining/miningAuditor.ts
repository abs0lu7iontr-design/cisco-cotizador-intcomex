// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL AUDITOR ENGINE
// ============================================================================

import { AccountConditionRule, AuditedLineItem, AuditReport } from './types';
import { matchCustomerAccount, CustomerMatchInput } from './customerMatcher';
import { classifyCiscoLine } from './serviceClassifier';

const TOLERANCE_PCT = 0.5; // Tolerancia de 0.5 puntos porcentuales para redondeo

export function runMiningAudit(
  rawCustomerInput: string | CustomerMatchInput,
  items: any[],
  bomTotalUsd: number
): AuditReport {
  const matchResult = matchCustomerAccount(rawCustomerInput);
  const matchedRule = matchResult.matchedRule;
  const auditedLines: AuditedLineItem[] = [];
  const summary: string[] = [];
  let sntCount = 0;
  let hasUnconfigured = false;

  for (const item of items) {
    if (item.isInfoRow || (item.qty !== undefined && item.qty === 0)) {
      continue;
    }

    const { category, iotStatus, ruleEvidence } = classifyCiscoLine(item.partNumber, item.description);
    
    // Normalizar escala de descuento observado a 0-100
    const rawDisc = item.discPct ?? 0;
    const observedDisc = rawDisc <= 1.0 && rawDisc > 0 ? rawDisc * 100 : rawDisc;

    let calculatedDisc: number | null = null;
    if (item.unitListPrice && item.unitListPrice > 0 && item.netCiscoUnit !== undefined) {
      calculatedDisc = Math.round(((1 - (item.netCiscoUnit / item.unitListPrice)) * 100 + Number.EPSILON) * 100) / 100;
    }

    let expectedDisc: number | null = null;
    let status: AuditedLineItem['status'] = 'MANUAL_REVIEW';
    let notes = ruleEvidence;

    if (!matchedRule) {
      status = 'UNCONFIGURED';
      notes = 'Sin cuenta comercial asociada';
    } else {
      switch (category) {
        case 'SOLUTION_SUPPORT':
        case 'SUCCESS_TRACK':
          if (matchedRule.solutionSupportDiscountPct !== undefined) {
            expectedDisc = matchedRule.solutionSupportDiscountPct;
          } else {
            status = 'UNCONFIGURED';
            notes = `Descuento SS/CX no informado para ${matchedRule.groupName}`;
            hasUnconfigured = true;
          }
          break;

        case 'SMARTNET_SNT':
          sntCount++;
          status = 'CONTRACT_CHECK_REQUIRED';
          notes = 'Condición contractual requerida. Oportunidad: migrar a Success Track / Solution Support.';
          break;

        case 'SUBSCRIPTION':
          if (iotStatus === 'YES' && matchedRule.iotSubscriptionDiscountPct !== undefined) {
            expectedDisc = matchedRule.iotSubscriptionDiscountPct;
          } else if (matchedRule.subscriptionDiscountPct !== undefined) {
            expectedDisc = matchedRule.subscriptionDiscountPct;
          } else {
            status = 'UNCONFIGURED';
            hasUnconfigured = true;
          }
          break;

        case 'PRODUCT':
          const tiers = (iotStatus === 'YES' && matchedRule.iotProductTiers) 
            ? matchedRule.iotProductTiers 
            : matchedRule.productTiers;

          const matchedTier = tiers.find(t => bomTotalUsd >= t.minUsd && bomTotalUsd <= t.maxUsd);
          if (matchedTier) {
            expectedDisc = matchedTier.discountPct;
          } else {
            status = 'UNCONFIGURED';
            notes = `Monto BOM ($${bomTotalUsd.toLocaleString()} USD) fuera de tramos comerciales configurados`;
            hasUnconfigured = true;
          }
          break;

        default:
          status = 'MANUAL_REVIEW';
      }

      if (expectedDisc !== null) {
        const diff = Math.round((observedDisc - expectedDisc + Number.EPSILON) * 100) / 100;
        if (Math.abs(diff) <= TOLERANCE_PCT) {
          status = 'MATCH';
          notes = `Descuento coincide con la referencia (${expectedDisc}%)`;
        } else {
          status = 'MISMATCH';
          notes = `Diferencia de ${diff > 0 ? '+' : ''}${diff} pts porcentuales respecto a norma (${expectedDisc}%)`;
        }
      }
    }

    auditedLines.push({
      lineNumber: String(item.lineNumber || ''),
      partNumber: item.partNumber || '',
      description: item.description || '',
      category,
      iotStatus,
      unitListPrice: item.unitListPrice || 0,
      unitNetPrice: item.netCiscoUnit || 0,
      observedDiscountPct: observedDisc,
      calculatedDiscountPct: calculatedDisc,
      expectedDiscountPct: expectedDisc,
      differencePct: expectedDisc !== null ? observedDisc - expectedDisc : null,
      status,
      notes
    });
  }

  if (sntCount > 0 && matchedRule?.solutionSupportDiscountPct) {
    summary.push(`Se detectaron ${sntCount} contratos SNT. Se recomienda posicionar Success Track / Solution Support (55%).`);
  }

  const overallStatus = !matchedRule 
    ? 'NO_RULES' 
    : auditedLines.some(l => l.status === 'MISMATCH') 
    ? 'REQUIRES_REVIEW' 
    : hasUnconfigured 
    ? 'NOT_EVALUABLE' 
    : 'COMPLIANT';

  const resolvedCustomerName =
    typeof rawCustomerInput === 'string'
      ? rawCustomerInput
      : (matchResult.rawTargetFound || rawCustomerInput.companyName || rawCustomerInput.customerName || rawCustomerInput.fileName || 'No Identificado');

  return {
    timestamp: new Date().toISOString(),
    bomFingerprint: `${items.length}_${bomTotalUsd}`,
    customerNameRaw: resolvedCustomerName,
    matchedAccount: matchedRule,
    identificationSource: matchResult.matchedSource,
    lines: auditedLines,
    sntOpportunityCount: sntCount,
    hasUnconfiguredTiers: hasUnconfigured,
    overallStatus,
    summaryObservations: summary
  };
}
