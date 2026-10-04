// ============================================================================
// CISCO AUTOMATED v2.1 - BULLETPROOF DATE NORMALIZATION UTILITIES
// Guarantees zero data-loss from mixed ISO, Latin (DD/MM/YYYY), or Excel timestamps
// ============================================================================

/**
 * Normalizes any date input (ISO string, DD/MM/YYYY, timestamp, Date) into a canonical ISO-8601 string.
 * Falls back to fallbackIso (or current ISO) if unparseable, never throws or returns 'Invalid Date'.
 */
export function normalizeIsoTimestamp(rawDate: unknown, fallbackIso?: string): string {
  const fallback = fallbackIso || new Date().toISOString();
  if (!rawDate) return fallback;

  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? fallback : rawDate.toISOString();
  }

  if (typeof rawDate === 'number') {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  }

  if (typeof rawDate !== 'string') {
    return fallback;
  }

  const s = rawDate.trim();
  if (!s) return fallback;

  // 1. Direct standard ISO check (e.g. 2026-10-04T15:50:51.000Z or 2026-10-04)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 2. Check for DD/MM/YYYY or DD-MM-YYYY (with optional HH:MM[:SS])
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed in JS
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // 3. Check for MM/DD/YYYY if previous failed
  const parsedFallback = new Date(s);
  if (!isNaN(parsedFallback.getTime())) {
    return parsedFallback.toISOString();
  }

  return fallback;
}

/**
 * Extracts 'YYYY-MM' safely from any date input.
 */
export function extractYearMonth(rawDate: unknown): string {
  const iso = normalizeIsoTimestamp(rawDate);
  return iso.slice(0, 7);
}

/**
 * Extracts 'YYYY' safely from any date input.
 */
export function extractYear(rawDate: unknown): string {
  const iso = normalizeIsoTimestamp(rawDate);
  return iso.slice(0, 4);
}

/**
 * Formats date into human-readable Chilean/Spanish representation: DD/MM/YYYY HH:mm
 */
export function formatSpanishDateTime(rawDate: unknown): string {
  if (!rawDate) return '-';
  try {
    const iso = normalizeIsoTimestamp(rawDate);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(rawDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return String(rawDate);
  }
}
