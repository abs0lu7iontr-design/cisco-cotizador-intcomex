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

/**
 * Normaliza y capitaliza nombres de partner/reseller:
 * - Unifica variantes con distinta capitalización o espacios (ej: 'ajj', 'Ajj', 'AJJ ' -> 'Ajj')
 * - Inicia cada palabra con la primera letra mayúscula (Title Case)
 * - Maneja palabras compuestas con guiones (ej: 'tech-data' -> 'Tech-Data')
 */
export function formatPartnerName(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Obtiene la lista única y ordenada de partners formateados con primera letra mayúscula,
 * deduplicando variaciones de mayúsculas/minúsculas.
 */
export function getUniqueFormattedPartners(records: Array<{ partnerName?: string }>): string[] {
  const map = new Map<string, string>(); // lowerKey -> formattedName
  for (const r of records) {
    const raw = (r.partnerName || '').trim();
    if (!raw) continue;
    const formatted = formatPartnerName(raw);
    if (!formatted) continue;
    const key = formatted.toLowerCase();
    if (!map.has(key)) {
      map.set(key, formatted);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

