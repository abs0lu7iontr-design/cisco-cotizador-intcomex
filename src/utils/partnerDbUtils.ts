// ============================================================================
// CISCO AUTOMATED - PARTNER DATABASE UTILITIES
// Canonical Deterministic Document ID Generator for Firestore & Offline Cache
// ============================================================================

/**
 * Genera un Document ID determinista y seguro para Firestore
 * a partir del nombre del partner extraído del BOM.
 */
export function getPartnerDocId(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes y diacríticos
    .replace(/[\/\\.#$\[\]]/g, '-')  // Sanitiza caracteres reservados por Firestore
    .replace(/\s+/g, '_');          // Espacios a guiones bajos
}
