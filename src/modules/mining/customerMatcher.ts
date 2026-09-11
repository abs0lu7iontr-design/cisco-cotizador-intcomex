// ============================================================================
// CISCO AUTOMATED v2.1 - MINING & INDUSTRIAL CUSTOMER MATCHER
// ============================================================================

import { MINING_CONDITIONS_CATALOG } from './miningCatalog';
import { AccountConditionRule } from './types';

export interface CustomerMatchInput {
  customerName?: string;
  companyName?: string;
  fileName?: string;
  dealName?: string;
}

export interface MatchCustomerAccountResult {
  matchedRule: AccountConditionRule | null;
  confidence: 'HIGH' | 'AMBIGUOUS' | 'NONE';
  matchedAlias?: string;
  matchedSource: 'HEADER_COMPANY' | 'FILE_NAME' | 'HEADER_CUSTOMER' | 'DEAL_NAME' | 'NONE';
  rawTargetFound?: string;
}

/**
 * Normaliza cadenas removiendo acentos, caracteres especiales y espacios redundantes.
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca candidatos que coincidan con la cadena normalizada.
 */
function findCandidates(normTarget: string): { rule: AccountConditionRule; alias: string }[] {
  if (!normTarget) return [];
  const candidates: { rule: AccountConditionRule; alias: string }[] = [];

  for (const rule of MINING_CONDITIONS_CATALOG) {
    for (const alias of rule.verifiedAliases) {
      const normAlias = normalizeText(alias);
      // Búsqueda por palabra/token delimitado para evitar falsos positivos
      const regex = new RegExp(`(^|\\s)${normAlias}(\\s|$)`, 'i');
      if (regex.test(normTarget)) {
        candidates.push({ rule, alias });
      }
    }
  }

  return candidates;
}

/**
 * Evalúa múltiples fuentes (companyName, fileName, customerName, dealName)
 * en cascada de prioridad estricta para identificar la cuenta minera.
 */
export function matchCustomerAccount(
  input: string | CustomerMatchInput
): MatchCustomerAccountResult {
  const sources: CustomerMatchInput =
    typeof input === 'string'
      ? { customerName: input }
      : (input || {});

  // 1. PRIORIDAD 1: Cliente Final explícito en cabecera CCW (companyName)
  if (sources.companyName && sources.companyName.trim()) {
    const norm = normalizeText(sources.companyName);
    const candidates = findCandidates(norm);
    if (candidates.length === 1) {
      return {
        matchedRule: candidates[0].rule,
        confidence: 'HIGH',
        matchedAlias: candidates[0].alias,
        matchedSource: 'HEADER_COMPANY',
        rawTargetFound: sources.companyName.trim(),
      };
    } else if (candidates.length > 1) {
      return {
        matchedRule: candidates[0].rule,
        confidence: 'AMBIGUOUS',
        matchedAlias: candidates[0].alias,
        matchedSource: 'HEADER_COMPANY',
        rawTargetFound: sources.companyName.trim(),
      };
    }
  }

  // 2. PRIORIDAD 2: Nombre del Archivo (fileName)
  // Convención Intcomex habitual: partner_cliente_equipo_...
  if (sources.fileName && sources.fileName.trim()) {
    const cleanFileName = sources.fileName.replace(/\.[^/.]+$/, '').trim();
    const tokens = cleanFileName.split(/[_.\s-]+/).map((t) => t.trim()).filter(Boolean);

    // 2a. Evaluar posición 1 (cliente en convención partner_cliente_equipo)
    if (tokens.length >= 2) {
      const clientCandidate = tokens[1];
      const norm = normalizeText(clientCandidate);
      const candidates = findCandidates(norm);
      if (candidates.length >= 1) {
        return {
          matchedRule: candidates[0].rule,
          confidence: candidates.length === 1 ? 'HIGH' : 'AMBIGUOUS',
          matchedAlias: candidates[0].alias,
          matchedSource: 'FILE_NAME',
          rawTargetFound: clientCandidate,
        };
      }
    }

    // 2b. Evaluar cada token individual del nombre del archivo
    for (const token of tokens) {
      const norm = normalizeText(token);
      if (!norm || norm.length < 3) continue; // Evitar tokens triviales
      const candidates = findCandidates(norm);
      if (candidates.length >= 1) {
        return {
          matchedRule: candidates[0].rule,
          confidence: candidates.length === 1 ? 'HIGH' : 'AMBIGUOUS',
          matchedAlias: candidates[0].alias,
          matchedSource: 'FILE_NAME',
          rawTargetFound: token,
        };
      }
    }

    // 2c. Evaluar el nombre de archivo completo normalizado (permite nombres compuestos como "antofagasta minerals")
    const normFullFile = normalizeText(cleanFileName);
    const candidatesFull = findCandidates(normFullFile);
    if (candidatesFull.length >= 1) {
      return {
        matchedRule: candidatesFull[0].rule,
        confidence: candidatesFull.length === 1 ? 'HIGH' : 'AMBIGUOUS',
        matchedAlias: candidatesFull[0].alias,
        matchedSource: 'FILE_NAME',
        rawTargetFound: cleanFileName,
      };
    }
  }

  // 3. PRIORIDAD 3: Customer Name en Cabecera CCW (customerName)
  if (sources.customerName && sources.customerName.trim()) {
    const norm = normalizeText(sources.customerName);
    const candidates = findCandidates(norm);
    if (candidates.length === 1) {
      return {
        matchedRule: candidates[0].rule,
        confidence: 'HIGH',
        matchedAlias: candidates[0].alias,
        matchedSource: 'HEADER_CUSTOMER',
        rawTargetFound: sources.customerName.trim(),
      };
    } else if (candidates.length > 1) {
      return {
        matchedRule: candidates[0].rule,
        confidence: 'AMBIGUOUS',
        matchedAlias: candidates[0].alias,
        matchedSource: 'HEADER_CUSTOMER',
        rawTargetFound: sources.customerName.trim(),
      };
    }
  }

  // 4. PRIORIDAD 4: Nombre del Deal (dealName)
  if (sources.dealName && sources.dealName.trim()) {
    const norm = normalizeText(sources.dealName);
    const candidates = findCandidates(norm);
    if (candidates.length >= 1) {
      return {
        matchedRule: candidates[0].rule,
        confidence: candidates.length === 1 ? 'HIGH' : 'AMBIGUOUS',
        matchedAlias: candidates[0].alias,
        matchedSource: 'DEAL_NAME',
        rawTargetFound: sources.dealName.trim(),
      };
    }
  }

  return {
    matchedRule: null,
    confidence: 'NONE',
    matchedSource: 'NONE',
  };
}
