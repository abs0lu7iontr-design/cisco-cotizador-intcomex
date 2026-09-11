// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL CUSTOMER MATCHER
// ============================================================================

import { MINING_CONDITIONS_CATALOG } from './miningCatalog';
import { AccountConditionRule } from './types';

/**
 * Normaliza cadenas removiendo acentos, caracteres especiales y espacios redundantes.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchCustomerAccount(rawCustomerName: string): {
  matchedRule: AccountConditionRule | null;
  confidence: 'HIGH' | 'AMBIGUOUS' | 'NONE';
  matchedAlias?: string;
} {
  if (!rawCustomerName) return { matchedRule: null, confidence: 'NONE' };

  const normTarget = normalizeText(rawCustomerName);
  const candidates: { rule: AccountConditionRule; alias: string }[] = [];

  for (const rule of MINING_CONDITIONS_CATALOG) {
    for (const alias of rule.verifiedAliases) {
      const normAlias = normalizeText(alias);
      // Búsqueda por token delimitado para evitar falsos positivos
      const regex = new RegExp(`(^|\\s)${normAlias}(\\s|$)`, 'i');
      if (regex.test(normTarget)) {
        candidates.push({ rule, alias });
      }
    }
  }

  if (candidates.length === 1) {
    return { matchedRule: candidates[0].rule, confidence: 'HIGH', matchedAlias: candidates[0].alias };
  } else if (candidates.length > 1) {
    return { matchedRule: candidates[0].rule, confidence: 'AMBIGUOUS', matchedAlias: candidates[0].alias };
  }

  return { matchedRule: null, confidence: 'NONE' };
}
