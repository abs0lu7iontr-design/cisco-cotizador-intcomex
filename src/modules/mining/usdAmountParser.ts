// ============================================================================
// CISCO AUTOMATED v2.1 - USD AMOUNT PARSER
// ============================================================================

/**
 * Analizador numérico general para importes monetarios en USD.
 * Admite: "20K", "20k", "150K USD", "21000", "1.5K", "1,500.50".
 */
export function parseUsdAmount(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return isFinite(raw) && raw >= 0 ? Math.round((raw + Number.EPSILON) * 100) / 100 : null;
  }
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.trim().toUpperCase();
  cleaned = cleaned.replace(/\bUSD\b/g, '').replace(/\$/g, '').trim();

  // Detección de sufijo K/k
  const hasK = cleaned.endsWith('K');
  if (hasK) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Normalización de separadores decimales/miles
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const parsed = Number(cleaned);
  if (isNaN(parsed) || parsed < 0 || !isFinite(parsed)) {
    return null;
  }

  const finalAmount = hasK ? parsed * 1000 : parsed;
  return Math.round((finalAmount + Number.EPSILON) * 100) / 100;
}
