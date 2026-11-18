// ============================================================================
// CISCO AUTOMATED v2.1 - DATE NORMALIZATION, SOURCE PARSING & CHILE TIMEZONE
// Guarantees strict calendar validation, zero fabricated current dates for
// historical/corrupt records, and source-aware parsing (ISO, Spanish, Unix, Excel)
// ============================================================================

export const UNKNOWN_DATE_LABEL = 'Fecha desconocida';
export const CHILE_TIMEZONE = 'America/Santiago';

export type DateSourceKind =
  | 'auto'
  | 'iso'
  | 'spanish'
  | 'cl_dmy'
  | 'CL_DMY'
  | 'us_mdy'
  | 'US_MDY'
  | 'unix_seconds'
  | 'unix_ms'
  | 'excel_serial';

export interface DateParseOptions {
  source?: DateSourceKind;
  /** True if the Excel workbook uses the 1904 date system (Mac legacy) instead of 1900 */
  date1904?: boolean;
  /** Explicit IANA timezone when interpreting local timestamps without offset (defaults to America/Santiago) */
  timeZone?: string;
  /** Explicit fallback ISO string ONLY when creating a new record */
  fallbackIso?: string;
}

export interface ParsedDateResult {
  isValid: boolean;
  iso: string | null;
  isCalendarDateOnly: boolean;
  detectedSource: DateSourceKind | 'unknown';
  displayLabel: string;
}

const SPANISH_MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

/**
 * Checks if a given year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of days in a 1-based month (1 = January .. 12 = December).
 */
export function getDaysInMonth(year: number, month1Based: number): number {
  switch (month1Based) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Validates that (year, month1Based, day) is a real calendar date without JS Date rollover.
 * Rejects impossible dates such as 2026-02-31, 2025-02-29, month 13, day 0, etc.
 */
export function isValidCalendarDate(year: number, month1Based: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month1Based) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2200) return false;
  if (month1Based < 1 || month1Based > 12) return false;
  const maxDay = getDaysInMonth(year, month1Based);
  return day >= 1 && day <= maxDay;
}

/**
 * Validates 24-hour clock components.
 */
export function isValidTimeParts(
  hour: number,
  minute: number,
  second: number = 0,
  millisecond: number = 0
): boolean {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    !Number.isInteger(millisecond)
  ) {
    return false;
  }
  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    millisecond >= 0 &&
    millisecond <= 999
  );
}

/**
 * Computes the UTC offset in minutes for a specific UTC timestamp and IANA timezone.
 */
function getTimeZoneOffsetMinutes(utcMs: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = parseInt(p.value, 10);
      }
    }
    const hour = map.hour === 24 ? 0 : map.hour;
    const zonedAsUtc = Date.UTC(map.year, (map.month || 1) - 1, map.day || 1, hour || 0, map.minute || 0, map.second || 0);
    return Math.round((zonedAsUtc - utcMs) / 60000);
  } catch {
    // Fallback to Chile standard offset (-3h / -180m) if Intl timeZone is unavailable
    return -180;
  }
}

/**
 * Converts local wall-clock components in a given IANA timezone (e.g. America/Santiago) to a UTC Date.
 */
export function zonedComponentsToUtcIso(
  year: number,
  month1Based: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
  millisecond: number = 0,
  timeZone: string = CHILE_TIMEZONE
): string | null {
  if (!isValidCalendarDate(year, month1Based, day) || !isValidTimeParts(hour, minute, second, millisecond)) {
    return null;
  }
  const naiveUtc = Date.UTC(year, month1Based - 1, day, hour, minute, second, millisecond);
  const firstOffsetMin = getTimeZoneOffsetMinutes(naiveUtc, timeZone);
  const adjustedUtc = naiveUtc - firstOffsetMin * 60000;
  const secondOffsetMin = getTimeZoneOffsetMinutes(adjustedUtc, timeZone);
  const finalUtc = naiveUtc - secondOffsetMin * 60000;
  return new Date(finalUtc).toISOString();
}

/**
 * Converts an Excel serial date number into a canonical ISO-8601 timestamp.
 * Handles both the 1900 date system (including the Lotus 1-2-3 Feb 29 1900 leap bug at serial 60)
 * and the 1904 date system (`date1904: true`).
 */
export function excelSerialToIso(
  serial: number,
  options?: { date1904?: boolean }
): { iso: string; isCalendarDateOnly: boolean } | null {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  // Valid Excel serial range: 1 (1900-01-01) through ~2958465 (9999-12-31)
  if (serial < 1 || serial > 2958465) return null;

  const is1904 = Boolean(options?.date1904);
  const wholeDays = Math.floor(serial);
  const fractionalDay = serial - wholeDays;
  const totalSecondsInDay = Math.round(fractionalDay * 86400);
  const isCalendarDateOnly = totalSecondsInDay === 0;

  if (!is1904 && wholeDays === 60) {
    // Excel serial 60 in the 1900 system is the non-existent 1900-02-29
    return null;
  }

  let baseEpochMs: number;
  let adjustedDays = wholeDays;

  if (is1904) {
    // 1904 system: serial 0 is 1904-01-01
    baseEpochMs = Date.UTC(1904, 0, 1, 0, 0, 0, 0);
  } else {
    // 1900 system: serial 1 is 1900-01-01; serial > 60 shifts back by 1 day due to 1900-02-29 bug
    baseEpochMs = Date.UTC(1899, 11, 31, 0, 0, 0, 0);
    if (wholeDays > 60) {
      adjustedDays = wholeDays - 1;
    }
  }

  // For pure calendar dates, anchor at 12:00:00 UTC so rendering in Chile/Americas never shifts the day
  const timeMs = isCalendarDateOnly ? 12 * 3600 * 1000 : totalSecondsInDay * 1000;
  const targetMs = baseEpochMs + adjustedDays * 86400000 + timeMs;
  const d = new Date(targetMs);
  if (isNaN(d.getTime())) return null;

  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2200) return null;

  return {
    iso: d.toISOString(),
    isCalendarDateOnly,
  };
}

/**
 * Parses any date input according to its origin and timezone rules without fabricating the current date.
 */
export function parseDateBySource(rawDate: unknown, options?: DateParseOptions): ParsedDateResult {
  const invalidResult: ParsedDateResult = {
    isValid: false,
    iso: null,
    isCalendarDateOnly: false,
    detectedSource: 'unknown',
    displayLabel: UNKNOWN_DATE_LABEL,
  };

  if (rawDate === null || rawDate === undefined || rawDate === '') {
    return invalidResult;
  }

  const sourceHint = options?.source ?? 'auto';
  const timeZone = options?.timeZone || CHILE_TIMEZONE;

  // 1. Firestore Timestamp-like object ({ toDate() } or { seconds, nanoseconds })
  if (typeof rawDate === 'object' && !(rawDate instanceof Date)) {
    const maybeTs = rawDate as { toDate?: () => unknown; seconds?: unknown; nanoseconds?: unknown };
    if (typeof maybeTs.toDate === 'function') {
      const converted = maybeTs.toDate();
      if (converted instanceof Date && !isNaN(converted.getTime())) {
        const iso = converted.toISOString();
        return {
          isValid: true,
          iso,
          isCalendarDateOnly: false,
          detectedSource: 'iso',
          displayLabel: formatSpanishDateTime(iso, { timeZone }),
        };
      }
      return invalidResult;
    }
    if (typeof maybeTs.seconds === 'number' && Number.isFinite(maybeTs.seconds)) {
      const ms = maybeTs.seconds * 1000 + (typeof maybeTs.nanoseconds === 'number' ? Math.floor(maybeTs.nanoseconds / 1e6) : 0);
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 1970 && d.getUTCFullYear() <= 2200) {
        const iso = d.toISOString();
        return {
          isValid: true,
          iso,
          isCalendarDateOnly: false,
          detectedSource: 'unix_seconds',
          displayLabel: formatSpanishDateTime(iso, { timeZone }),
        };
      }
      return invalidResult;
    }
    return invalidResult;
  }

  // 2. Native Date instance
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return invalidResult;
    const year = rawDate.getUTCFullYear();
    if (year < 1900 || year > 2200) return invalidResult;
    const iso = rawDate.toISOString();
    return {
      isValid: true,
      iso,
      isCalendarDateOnly: false,
      detectedSource: 'iso',
      displayLabel: formatSpanishDateTime(iso, { timeZone }),
    };
  }

  // 3. Numeric input: Excel serial vs Unix seconds vs Unix milliseconds
  if (typeof rawDate === 'number') {
    if (!Number.isFinite(rawDate)) return invalidResult;

    if (sourceHint === 'excel_serial' || (sourceHint === 'auto' && rawDate >= 1 && rawDate < 100000)) {
      const excelRes = excelSerialToIso(rawDate, { date1904: options?.date1904 });
      if (!excelRes) return invalidResult;
      return {
        isValid: true,
        iso: excelRes.iso,
        isCalendarDateOnly: excelRes.isCalendarDateOnly,
        detectedSource: 'excel_serial',
        displayLabel: formatSpanishDateTime(excelRes.iso, {
          timeZone: excelRes.isCalendarDateOnly ? 'UTC' : timeZone,
        }),
      };
    }

    if (sourceHint === 'unix_seconds' || (sourceHint === 'auto' && rawDate >= 100_000_000 && rawDate < 100_000_000_000)) {
      const d = new Date(rawDate * 1000);
      if (isNaN(d.getTime()) || d.getUTCFullYear() < 1970 || d.getUTCFullYear() > 2200) return invalidResult;
      const iso = d.toISOString();
      return {
        isValid: true,
        iso,
        isCalendarDateOnly: false,
        detectedSource: 'unix_seconds',
        displayLabel: formatSpanishDateTime(iso, { timeZone }),
      };
    }

    if (sourceHint === 'unix_ms' || (sourceHint === 'auto' && rawDate >= 100_000_000_000)) {
      const d = new Date(rawDate);
      if (isNaN(d.getTime()) || d.getUTCFullYear() < 1970 || d.getUTCFullYear() > 2200) return invalidResult;
      const iso = d.toISOString();
      return {
        isValid: true,
        iso,
        isCalendarDateOnly: false,
        detectedSource: 'unix_ms',
        displayLabel: formatSpanishDateTime(iso, { timeZone }),
      };
    }

    return invalidResult;
  }

  if (typeof rawDate !== 'string') {
    return invalidResult;
  }

  const s = rawDate.trim();
  if (!s || s === UNKNOWN_DATE_LABEL || s === 'UNKNOWN_DATE' || s === 'Invalid Date' || s === '-') {
    return invalidResult;
  }

  // 4. Pure numeric string (Excel serial, Unix seconds, or Unix ms)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const numVal = Number(s);
    return parseDateBySource(numVal, options);
  }

  // 5. ISO-8601 Calendar Date Only: YYYY-MM-DD
  const isoDateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    const year = parseInt(isoDateOnlyMatch[1], 10);
    const month = parseInt(isoDateOnlyMatch[2], 10);
    const day = parseInt(isoDateOnlyMatch[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      return invalidResult;
    }
    // Anchor calendar-only date at 12:00:00 UTC to avoid day shift in Chile timezone
    const iso = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).toISOString();
    return {
      isValid: true,
      iso,
      isCalendarDateOnly: true,
      detectedSource: 'iso',
      displayLabel: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    };
  }

  // 6. ISO-8601 Date-Time with optional offset: YYYY-MM-DD[T ]HH:mm(:ss(.sss))(Z|+-HH:mm)
  const isoDateTimeMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/
  );
  if (isoDateTimeMatch) {
    const year = parseInt(isoDateTimeMatch[1], 10);
    const month = parseInt(isoDateTimeMatch[2], 10);
    const day = parseInt(isoDateTimeMatch[3], 10);
    const hour = parseInt(isoDateTimeMatch[4], 10);
    const minute = parseInt(isoDateTimeMatch[5], 10);
    const second = isoDateTimeMatch[6] ? parseInt(isoDateTimeMatch[6], 10) : 0;
    const msRaw = isoDateTimeMatch[7] ? isoDateTimeMatch[7].slice(0, 3).padEnd(3, '0') : '000';
    const ms = parseInt(msRaw, 10);
    const tzToken = isoDateTimeMatch[8];

    if (!isValidCalendarDate(year, month, day) || !isValidTimeParts(hour, minute, second, ms)) {
      return invalidResult;
    }

    let iso: string | null = null;
    if (tzToken) {
      if (tzToken !== 'Z') {
        const normTz = tzToken.includes(':') ? tzToken : `${tzToken.slice(0, 3)}:${tzToken.slice(3)}`;
        const tzParts = normTz.slice(1).split(':');
        const tzH = parseInt(tzParts[0], 10);
        const tzM = parseInt(tzParts[1], 10);
        if (tzH > 14 || tzM > 59) return invalidResult;
      }
      const parsed = new Date(s);
      if (isNaN(parsed.getTime())) return invalidResult;
      iso = parsed.toISOString();
    } else {
      // Local timestamp without explicit offset -> interpret in target timezone (Chile default)
      iso = zonedComponentsToUtcIso(year, month, day, hour, minute, second, ms, timeZone);
    }

    if (!iso) return invalidResult;
    return {
      isValid: true,
      iso,
      isCalendarDateOnly: false,
      detectedSource: 'iso',
      displayLabel: formatSpanishDateTime(iso, { timeZone }),
    };
  }

  // 7. Slash/dash numeric format: DD/MM/YYYY (Chile/Spanish default) or MM/DD/YYYY (when source is US_MDY / us_mdy)
  const dmyMatch = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const firstPart = parseInt(dmyMatch[1], 10);
    const secondPart = parseInt(dmyMatch[2], 10);
    const isUsMdy = sourceHint === 'us_mdy' || sourceHint === 'US_MDY';
    const day = isUsMdy ? secondPart : firstPart;
    const month = isUsMdy ? firstPart : secondPart;
    const year = parseInt(dmyMatch[3], 10);
    const hasTime = dmyMatch[4] !== undefined;
    const hour = hasTime ? parseInt(dmyMatch[4], 10) : 12;
    const min = hasTime ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    if (!isValidCalendarDate(year, month, day) || !isValidTimeParts(hour, min, sec)) {
      return invalidResult;
    }

    const iso = hasTime
      ? zonedComponentsToUtcIso(year, month, day, hour, min, sec, 0, timeZone)
      : new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).toISOString();

    if (!iso) return invalidResult;
    return {
      isValid: true,
      iso,
      isCalendarDateOnly: !hasTime,
      detectedSource: isUsMdy ? 'us_mdy' : 'spanish',
      displayLabel: hasTime
        ? formatSpanishDateTime(iso, { timeZone })
        : `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    };
  }

  // 8. Spanish textual date (e.g. "12 oct 2026", "12 de octubre de 2026 14:30")
  const spanishTextMatch = s
    .toLowerCase()
    .match(
      /^(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\.?\s*(?:de\s+|del\s+|,\s*)?(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
  if (spanishTextMatch) {
    const day = parseInt(spanishTextMatch[1], 10);
    const monthName = spanishTextMatch[2];
    const month = SPANISH_MONTHS[monthName] || 0;
    const year = parseInt(spanishTextMatch[3], 10);
    const hasTime = spanishTextMatch[4] !== undefined;
    const hour = hasTime ? parseInt(spanishTextMatch[4], 10) : 12;
    const min = hasTime ? parseInt(spanishTextMatch[5], 10) : 0;
    const sec = spanishTextMatch[6] ? parseInt(spanishTextMatch[6], 10) : 0;

    if (!isValidCalendarDate(year, month, day) || !isValidTimeParts(hour, min, sec)) {
      return invalidResult;
    }

    const iso = hasTime
      ? zonedComponentsToUtcIso(year, month, day, hour, min, sec, 0, timeZone)
      : new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).toISOString();

    if (!iso) return invalidResult;
    return {
      isValid: true,
      iso,
      isCalendarDateOnly: !hasTime,
      detectedSource: 'spanish',
      displayLabel: hasTime
        ? formatSpanishDateTime(iso, { timeZone })
        : `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    };
  }

  return invalidResult;
}

/**
 * Normalizes a date input into a canonical ISO-8601 string or null if invalid/absent.
 * Never fabricates the current date unless `options.fallbackIso` is explicitly supplied.
 */
export function normalizeIsoTimestampOrNull(
  rawDate: unknown,
  options?: DateParseOptions
): string | null {
  const parsed = parseDateBySource(rawDate, options);
  if (parsed.isValid && parsed.iso) {
    return parsed.iso;
  }
  if (options?.fallbackIso) {
    const fbParsed = parseDateBySource(options.fallbackIso, { ...options, fallbackIso: undefined });
    return fbParsed.isValid ? fbParsed.iso : null;
  }
  return null;
}

/**
 * Normalizes any date input into a canonical ISO-8601 string.
 * IMPORTANT: Does NOT fabricate the current date (`new Date().toISOString()`) when `rawDate` is
 * missing or invalid unless an explicit `fallbackIso` is provided by a new-record creation flow.
 * Returns `''` (empty string) for unknown/invalid dates when no `fallbackIso` is given.
 */
export function normalizeIsoTimestamp(
  rawDate: unknown,
  fallbackIso?: string,
  options?: DateParseOptions
): string {
  const resolved = normalizeIsoTimestampOrNull(rawDate, {
    ...options,
    fallbackIso,
  });
  return resolved ?? '';
}

/**
 * Checks whether a raw date or normalized string represents an unknown or invalid date.
 */
export function isUnknownDate(rawDate: unknown, options?: DateParseOptions): boolean {
  return normalizeIsoTimestampOrNull(rawDate, options) === null;
}

/**
 * Extracts 'YYYY-MM' in Chile timezone (or UTC for calendar dates) from a valid date input.
 * Returns `''` for unknown or invalid dates so they are excluded from temporal groupings.
 */
export function extractYearMonth(rawDate: unknown, options?: DateParseOptions): string {
  const parsed = parseDateBySource(rawDate, options);
  if (!parsed.isValid || !parsed.iso) return '';
  if (parsed.isCalendarDateOnly) {
    return parsed.iso.slice(0, 7);
  }
  const parts = getZonedDateParts(parsed.iso, options?.timeZone || CHILE_TIMEZONE);
  if (!parts) return parsed.iso.slice(0, 7);
  return `${parts.year}-${parts.month}`;
}

/**
 * Extracts 'YYYY' in Chile timezone (or UTC for calendar dates) from a valid date input.
 * Returns `''` for unknown or invalid dates so they are excluded from temporal groupings.
 */
export function extractYear(rawDate: unknown, options?: DateParseOptions): string {
  const ym = extractYearMonth(rawDate, options);
  return ym ? ym.slice(0, 4) : '';
}

function getZonedDateParts(
  iso: string,
  timeZone: string = CHILE_TIMEZONE
): { year: string; month: string; day: string; hour: string; minute: string } | null {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const map: Record<string, string> = {};
    for (const p of dtf.formatToParts(d)) {
      if (p.type !== 'literal') {
        map[p.type] = p.value;
      }
    }
    const hour = map.hour === '24' ? '00' : map.hour;
    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour,
      minute: map.minute,
    };
  } catch {
    return null;
  }
}

/**
 * Formats a date into human-readable Chilean representation: `DD/MM/YYYY HH:mm`
 * Returns `Fecha desconocida` if the input is missing or invalid.
 */
export function formatSpanishDateTime(
  rawDate: unknown,
  options?: { timeZone?: string; fallbackLabel?: string }
): string {
  const fallbackLabel = options?.fallbackLabel ?? UNKNOWN_DATE_LABEL;
  if (rawDate === null || rawDate === undefined || rawDate === '') return fallbackLabel;

  const timeZone = options?.timeZone || CHILE_TIMEZONE;
  const d =
    typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(rawDate)
      ? new Date(rawDate)
      : (() => {
          const parsed = parseDateBySource(rawDate, { timeZone });
          return parsed.isValid && parsed.iso ? new Date(parsed.iso) : null;
        })();

  if (!d || isNaN(d.getTime())) return fallbackLabel;

  const parts = getZonedDateParts(d.toISOString(), timeZone);
  if (!parts) return fallbackLabel;
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/**
 * Formats only the date portion (`DD-MM-YYYY` or `DD/MM/YYYY`) in Chile timezone,
 * or returns `Fecha desconocida` when invalid/absent.
 */
export function formatChileDateOnly(
  rawDate: unknown,
  fallbackLabel: string = UNKNOWN_DATE_LABEL
): string {
  const parsed = parseDateBySource(rawDate, { timeZone: CHILE_TIMEZONE });
  if (!parsed.isValid || !parsed.iso) return fallbackLabel;
  const parts = getZonedDateParts(
    parsed.iso,
    parsed.isCalendarDateOnly ? 'UTC' : CHILE_TIMEZONE
  );
  if (!parts) return fallbackLabel;
  return `${parts.day}-${parts.month}-${parts.year}`;
}

/**
 * Formats only the time portion (`HH:mm`) in Chile timezone, or `''` if unknown/calendar-only.
 */
export function formatChileTimeOnly(rawDate: unknown): string {
  const parsed = parseDateBySource(rawDate, { timeZone: CHILE_TIMEZONE });
  if (!parsed.isValid || !parsed.iso || parsed.isCalendarDateOnly) return '';
  const parts = getZonedDateParts(parsed.iso, CHILE_TIMEZONE);
  if (!parts) return '';
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Comparator that consistently places unknown/invalid dates at the end regardless of sort direction.
 */
export function compareDatesUnknownLast(
  a: unknown,
  b: unknown,
  direction: 'desc' | 'asc' = 'desc'
): number {
  const isoA = normalizeIsoTimestampOrNull(a);
  const isoB = normalizeIsoTimestampOrNull(b);

  if (!isoA && !isoB) return 0;
  if (!isoA) return 1; // Always push unknown A to the end
  if (!isoB) return -1; // Always push unknown B to the end

  const msA = new Date(isoA).getTime();
  const msB = new Date(isoB).getTime();
  return direction === 'desc' ? msB - msA : msA - msB;
}

/**
 * Convierte cualquier fecha en valor representativo comercial limpio (DD/MM/YYYY).
 * Tolera números de serie de Excel (como 46252 -> 18/08/2026), strings numéricos ("46252"),
 * fechas ISO (2026-08-18), fechas con slash (18/08/2026 o 8/18/2026), y conserva textos
 * no interpretables como meses (ej. "Nov-2026", "Q4").
 */
export function formatCommercialDate(val: unknown, fallbackEmpty = '-'): string {
  if (val === undefined || val === null) return fallbackEmpty;
  const s = String(val).trim();
  if (!s || s === '-' || s === 'N/A' || s === 'n/a' || s === 'undefined' || s === 'null') {
    return fallbackEmpty;
  }

  // 1. Números enteros/flotantes o strings numéricos que representan seriales de Excel (ej. 46252, "46252")
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const num = Number(s);
    // Rango válido de fechas Excel comerciales (año 1954 a 2173)
    if (num >= 20000 && num <= 100000) {
      const excelRes = excelSerialToIso(num);
      if (excelRes && excelRes.iso) {
        const d = new Date(excelRes.iso);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    }
  }

  // 2. Fechas DD-MM-YYYY o DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];

    if (p1 > 12 && p2 <= 12) {
      return `${String(p1).padStart(2, '0')}/${String(p2).padStart(2, '0')}/${year}`;
    }
    if (p2 > 12 && p1 <= 12) {
      return `${String(p2).padStart(2, '0')}/${String(p1).padStart(2, '0')}/${year}`;
    }
    return `${String(p1).padStart(2, '0')}/${String(p2).padStart(2, '0')}/${year}`;
  }

  // 3. Fechas ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // 4. Intentar con parseDateBySource general
  const parsed = parseDateBySource(s);
  if (parsed.isValid && parsed.iso) {
    const d = new Date(parsed.iso);
    const day = String(parsed.isCalendarDateOnly ? d.getUTCDate() : d.getDate()).padStart(2, '0');
    const month = String((parsed.isCalendarDateOnly ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
    const year = parsed.isCalendarDateOnly ? d.getUTCFullYear() : d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Si es un texto libre como mes ("Noviembre", "Ago-2026", "Cierre Q4"), retornarlo tal cual
  return s;
}

/**
 * Normaliza cualquier formato de fecha a DD-MM-YYYY (estándar de inputs y exportaciones Intcomex).
 */
export function formatCommercialDateHyphen(val: unknown, fallbackEmpty = ''): string {
  const formatted = formatCommercialDate(val, fallbackEmpty);
  if (!formatted || formatted === '-') return fallbackEmpty;
  return formatted.replace(/\//g, '-');
}

// ============================================================================
// PERIOD & MONTH RANGE UTILITIES (PIPELINE, FORECAST, ESTIMATE HISTORY)
// ============================================================================

export const SPANISH_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/**
 * Retorna el nombre en español del mes actual según el reloj del sistema (ej. "Noviembre").
 * Si el mes cambia en el reloj del sistema, avanza automáticamente al nuevo mes.
 */
export function getCurrentMonthName(): string {
  const m = new Date().getMonth();
  return SPANISH_MONTH_NAMES[m] || 'Enero';
}

/**
 * Retorna el periodo del mes actual en formato "YYYY-MM" (ej. "2026-11").
 */
export function getCurrentYearMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retorna el trimestre actual ("Q1", "Q2", "Q3", "Q4").
 */
export function getCurrentQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const month1Based = new Date().getMonth() + 1;
  if (month1Based <= 3) return 'Q1';
  if (month1Based <= 6) return 'Q2';
  if (month1Based <= 9) return 'Q3';
  return 'Q4';
}

/**
 * Retorna la lista de nombres de mes de un trimestre.
 */
export function getQuarterMonthNames(quarter: string): string[] {
  switch (quarter.toUpperCase()) {
    case 'Q1':
      return ['Enero', 'Febrero', 'Marzo'];
    case 'Q2':
      return ['Abril', 'Mayo', 'Junio'];
    case 'Q3':
      return ['Julio', 'Agosto', 'Septiembre'];
    case 'Q4':
      return ['Octubre', 'Noviembre', 'Diciembre'];
    default:
      return [];
  }
}

/**
 * Extrae el mes (1-12) y año de cualquier string de fecha o valor comercial (incluso seriales de Excel o nombres de mes).
 */
export function extractMonthAndYearFromCommercialValue(
  val: unknown
): { month: number; year: number } | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s === '—' || s === 'N/A') return null;

  // 1. Nombre de mes en español directo (ej. "Noviembre", "Julio")
  for (let idx = 0; idx < SPANISH_MONTH_NAMES.length; idx++) {
    if (s.toLowerCase().includes(SPANISH_MONTH_NAMES[idx].toLowerCase())) {
      const yearMatch = s.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
      return { month: idx + 1, year };
    }
  }

  // 2. Serial de Excel numérico
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const num = Number(s);
    if (num >= 20000 && num <= 100000) {
      const excelRes = excelSerialToIso(num);
      if (excelRes && excelRes.iso) {
        const d = new Date(excelRes.iso);
        return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
      }
    }
  }

  // 3. DD-MM-YYYY o DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const month = p1 > 12 && p2 <= 12 ? p2 : p2 > 12 && p1 <= 12 ? p1 : p2;
    return { month, year };
  }

  // 4. ISO YYYY-MM o YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return { year: parseInt(isoMatch[1], 10), month: parseInt(isoMatch[2], 10) };
  }

  // 5. Intento general
  const parsed = parseDateBySource(s);
  if (parsed.isValid && parsed.iso) {
    const d = new Date(parsed.iso);
    return {
      month: (parsed.isCalendarDateOnly ? d.getUTCDate() : d.getMonth()) + 1,
      year: parsed.isCalendarDateOnly ? d.getUTCFullYear() : d.getFullYear(),
    };
  }

  return null;
}

/**
 * Comprueba si un registro o fecha coincide con un periodo de filtro seleccionado.
 * period puede ser:
 *  - "ALL" o "all": siempre true
 *  - "CURRENT_MONTH": coincide con el mes calendario actual (ej. Noviembre)
 *  - Nombre de mes: "Enero" ... "Diciembre"
 *  - Trimestre: "Q1", "Q2", "Q3", "Q4"
 *  - Año: "YEAR_CURRENT" o "YEAR_2026"
 *  - Clave YYYY-MM: ej. "2026-11"
 */
export function matchesPeriodFilter(dateValue: unknown, period: string): boolean {
  if (!period || period === 'ALL' || period === 'all') return true;

  const currentYear = new Date().getFullYear();
  const currentMonthName = getCurrentMonthName();

  // Si el filtro es CURRENT_MONTH, resolver al mes actual
  const targetPeriod =
    period === 'CURRENT_MONTH' || period === 'current_month' ? currentMonthName : period;

  const extracted = extractMonthAndYearFromCommercialValue(dateValue);
  if (!extracted) {
    // Si no se pudo extraer fecha numérica, comprobar coincidencia textual directa de nombre de mes
    if (typeof dateValue === 'string') {
      const lower = dateValue.toLowerCase();
      if (
        SPANISH_MONTH_NAMES.some(
          (m) => targetPeriod.toLowerCase().includes(m.toLowerCase()) && lower.includes(m.toLowerCase())
        )
      ) {
        return true;
      }
    }
    return false;
  }

  // Caso A: Filtro por Trimestre (Q1, Q2, Q3, Q4)
  if (/^Q[1-4]$/i.test(targetPeriod)) {
    const qNum = parseInt(targetPeriod.slice(1), 10);
    const startMonth = (qNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return extracted.month >= startMonth && extracted.month <= endMonth;
  }

  // Caso B: Filtro por Año Actual
  if (
    targetPeriod === 'YEAR_CURRENT' ||
    targetPeriod === 'year_current' ||
    targetPeriod === `YEAR_${currentYear}`
  ) {
    return extracted.year === currentYear;
  }

  // Caso C: Filtro por clave "YYYY-MM"
  if (/^\d{4}-\d{2}$/.test(targetPeriod)) {
    const [filterY, filterM] = targetPeriod.split('-').map(Number);
    return extracted.year === filterY && extracted.month === filterM;
  }

  // Caso D: Filtro por Nombre de Mes ("Noviembre", etc.)
  for (let idx = 0; idx < SPANISH_MONTH_NAMES.length; idx++) {
    const mName = SPANISH_MONTH_NAMES[idx];
    if (targetPeriod.toLowerCase().includes(mName.toLowerCase())) {
      return extracted.month === idx + 1;
    }
  }

  return false;
}

