// ============================================================================
// CISCO AUTOMATED v2.1 - OFFICIAL CHILEAN DAILY EXCHANGE RATE SERVICE (BCCh / SII)
// ============================================================================
// Extrae diariamente el Dólar Observado y la Unidad de Fomento (UF) desde medios
// oficiales chilenos (Banco Central de Chile / SII vía mindicador.cl y findic.cl).
// Regla comercial Front-End Intcomex Chile:
//   Valor USD -> CLP = Dólar Observado Oficial + $10 CLP de spread
//   (Ejemplo: si el Dólar Observado es $970 CLP -> se aplica $980 CLP por dólar).
// ============================================================================

import { CurrencyConversionRates, roundFinancial } from './calculations';

export const USD_TO_CLP_FRONTEND_SPREAD = 10;

export interface OfficialChileanRatesSnapshot {
  /** Valor oficial del Dólar Observado publicado por el Banco Central de Chile (sin recargo) */
  dolarObservadoOficial: number;
  /** Recargo comercial fijo en Front-End (+10 pesos chilenos por dólar) */
  spreadClp: number;
  /** Valor efectivo aplicado en Front-End para conversión USD -> CLP (dolarObservadoOficial + 10) */
  dolarAplicadoClp: number;
  /** Valor oficial diario de la Unidad de Fomento (UF) en CLP publicado por el Banco Central / SII */
  ufOficialClp: number;
  /** Fecha del indicador oficial (YYYY-MM-DD) */
  indicatorDate: string;
  /** Fecha local de consulta (YYYY-MM-DD en zona America/Santiago) */
  fetchedDayKey: string;
  /** Timestamp ISO de la última sincronización */
  fetchedAtIso: string;
  /** Fuente oficial utilizada */
  sourceName: string;
  /** Indica si el usuario sobrescribió manualmente el valor en la sesión actual */
  isManualOverride?: boolean;
}

const DAILY_CACHE_STORAGE_KEY = 'cisco_bcch_daily_rates_v2';

/**
 * Obtiene la clave de fecha actual en horario de Chile (YYYY-MM-DD)
 */
export function getChileTodayDateKey(now: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Aplica la regla comercial Front-End: al valor oficial de USD a CLP se le suman +10 pesos.
 * Ejemplo: 970 -> 980 CLP por dólar.
 */
export function applyFrontendUsdClpSpread(
  dolarObservadoOficial: number,
  spread: number = USD_TO_CLP_FRONTEND_SPREAD
): number {
  if (!dolarObservadoOficial || isNaN(dolarObservadoOficial) || dolarObservadoOficial <= 0) {
    return 970 + spread;
  }
  return roundFinancial(dolarObservadoOficial + spread);
}

/**
 * Convierte un snapshot oficial en el objeto CurrencyConversionRates usado por la UI.
 */
export function snapshotToConversionRates(
  snapshot: OfficialChileanRatesSnapshot
): CurrencyConversionRates {
  return {
    USD: 1,
    CLP: snapshot.dolarAplicadoClp,
    UF: snapshot.ufOficialClp,
  };
}

/**
 * Snapshot por defecto de respaldo (en caso de modo offline sin caché previa)
 */
export function getDefaultOfficialRatesSnapshot(): OfficialChileanRatesSnapshot {
  const todayKey = getChileTodayDateKey();
  const baseDolar = 981.61;
  const spread = USD_TO_CLP_FRONTEND_SPREAD;
  return {
    dolarObservadoOficial: baseDolar,
    spreadClp: spread,
    dolarAplicadoClp: applyFrontendUsdClpSpread(baseDolar, spread),
    ufOficialClp: 41146.83,
    indicatorDate: todayKey,
    fetchedDayKey: todayKey,
    fetchedAtIso: new Date().toISOString(),
    sourceName: 'Banco Central de Chile (Referencia Base)',
    isManualOverride: false,
  };
}

/**
 * Lee el snapshot diario almacenado en localStorage si corresponde al día de hoy.
 */
export function getCachedDailyOfficialRates(
  requireToday: boolean = true
): OfficialChileanRatesSnapshot | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(DAILY_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfficialChileanRatesSnapshot;
    if (
      !parsed ||
      typeof parsed.dolarObservadoOficial !== 'number' ||
      typeof parsed.dolarAplicadoClp !== 'number' ||
      typeof parsed.ufOficialClp !== 'number' ||
      parsed.dolarObservadoOficial <= 0 ||
      parsed.ufOficialClp <= 0
    ) {
      return null;
    }
    if (requireToday && parsed.fetchedDayKey !== getChileTodayDateKey()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Guarda el snapshot diario en localStorage.
 */
export function saveCachedDailyOfficialRates(snapshot: OfficialChileanRatesSnapshot): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DAILY_CACHE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignorar errores de cuota en localStorage
  }
}

/**
 * Consulta en vivo los indicadores económicos diarios oficiales de Chile:
 * 1. Fuente Primaria: https://mindicador.cl/api (Datos oficiales Banco Central de Chile / SII)
 * 2. Fuente Secundaria: https://findic.cl/api/ (Espejo oficial Banco Central de Chile)
 * 3. Fuente Terciaria: https://cl.dolarapi.com/v1/cotizaciones/usd (Respaldo Dólar Oficial Chile)
 *
 * Aplica automáticamente los +10 CLP al valor del Dólar Observado para la conversión USD -> CLP.
 */
export async function fetchDailyOfficialChileanRates(
  forceRefresh: boolean = false
): Promise<OfficialChileanRatesSnapshot> {
  if (!forceRefresh) {
    const cachedToday = getCachedDailyOfficialRates(true);
    if (cachedToday) {
      return cachedToday;
    }
  }

  const todayKey = getChileTodayDateKey();

  // 1. Intento Primario: mindicador.cl (API oficial de indicadores del Banco Central de Chile)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const response = await fetch('https://mindicador.cl/api', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as {
        dolar?: { valor?: number; fecha?: string };
        uf?: { valor?: number; fecha?: string };
      };
      const rawUsd = Number(data?.dolar?.valor);
      const rawUf = Number(data?.uf?.valor);
      if (rawUsd > 300 && rawUf > 10000) {
        const rawDate = typeof data?.dolar?.fecha === 'string'
          ? data.dolar.fecha.slice(0, 10)
          : todayKey;
        const snapshot: OfficialChileanRatesSnapshot = {
          dolarObservadoOficial: roundFinancial(rawUsd),
          spreadClp: USD_TO_CLP_FRONTEND_SPREAD,
          dolarAplicadoClp: applyFrontendUsdClpSpread(rawUsd, USD_TO_CLP_FRONTEND_SPREAD),
          ufOficialClp: roundFinancial(rawUf),
          indicatorDate: rawDate,
          fetchedDayKey: todayKey,
          fetchedAtIso: new Date().toISOString(),
          sourceName: 'Banco Central de Chile (mindicador.cl)',
          isManualOverride: false,
        };
        saveCachedDailyOfficialRates(snapshot);
        return snapshot;
      }
    }
  } catch {
    // Continúa al espejo secundario
  }

  // 2. Intento Secundario: findic.cl (Espejo oficial de indicadores Banco Central de Chile)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const response = await fetch('https://findic.cl/api/', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as {
        dolar?: { valor?: number; fecha?: string };
        uf?: { valor?: number; fecha?: string };
      };
      const rawUsd = Number(data?.dolar?.valor);
      const rawUf = Number(data?.uf?.valor);
      if (rawUsd > 300 && rawUf > 10000) {
        const rawDate = typeof data?.dolar?.fecha === 'string'
          ? data.dolar.fecha.slice(0, 10)
          : todayKey;
        const snapshot: OfficialChileanRatesSnapshot = {
          dolarObservadoOficial: roundFinancial(rawUsd),
          spreadClp: USD_TO_CLP_FRONTEND_SPREAD,
          dolarAplicadoClp: applyFrontendUsdClpSpread(rawUsd, USD_TO_CLP_FRONTEND_SPREAD),
          ufOficialClp: roundFinancial(rawUf),
          indicatorDate: rawDate,
          fetchedDayKey: todayKey,
          fetchedAtIso: new Date().toISOString(),
          sourceName: 'Banco Central de Chile (findic.cl)',
          isManualOverride: false,
        };
        saveCachedDailyOfficialRates(snapshot);
        return snapshot;
      }
    }
  } catch {
    // Continúa al respaldo terciario
  }

  // 3. Intento Terciario: cl.dolarapi.com (Cotización oficial USD Chile) + UF de última caché
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch('https://cl.dolarapi.com/v1/cotizaciones/usd', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as {
        compra?: number;
        ultimoCierre?: number;
        venta?: number;
        fechaActualizacion?: string;
      };
      const rawUsd = Number(data?.compra || data?.ultimoCierre || data?.venta);
      const previousCache = getCachedDailyOfficialRates(false);
      const fallbackUf = previousCache?.ufOficialClp || 41146.83;
      if (rawUsd > 300) {
        const rawDate = typeof data?.fechaActualizacion === 'string'
          ? data.fechaActualizacion.slice(0, 10)
          : todayKey;
        const snapshot: OfficialChileanRatesSnapshot = {
          dolarObservadoOficial: roundFinancial(rawUsd),
          spreadClp: USD_TO_CLP_FRONTEND_SPREAD,
          dolarAplicadoClp: applyFrontendUsdClpSpread(rawUsd, USD_TO_CLP_FRONTEND_SPREAD),
          ufOficialClp: roundFinancial(fallbackUf),
          indicatorDate: rawDate,
          fetchedDayKey: todayKey,
          fetchedAtIso: new Date().toISOString(),
          sourceName: 'Dólar Oficial Chile (cl.dolarapi.com)',
          isManualOverride: false,
        };
        saveCachedDailyOfficialRates(snapshot);
        return snapshot;
      }
    }
  } catch {
    // Continúa al fallback local
  }

  // 4. Fallback: Última caché conocida o valores oficiales base
  const anyPreviousCached = getCachedDailyOfficialRates(false);
  if (anyPreviousCached) {
    return anyPreviousCached;
  }

  return getDefaultOfficialRatesSnapshot();
}

const FRONTEND_CURRENCY_EVENT = 'cisco-frontend-currency-changed';

export function getSavedFrontendCurrency(): 'USD' | 'CLP' | 'UF' {
  try {
    if (typeof localStorage === 'undefined') return 'USD';
    const saved = localStorage.getItem('cisco_selected_currency');
    if (saved === 'USD' || saved === 'CLP' || saved === 'UF') return saved;
  } catch {}
  return 'USD';
}

export function notifyFrontendCurrencyChange(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FRONTEND_CURRENCY_EVENT));
    }
  } catch {}
}

export function subscribeFrontendCurrencyChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(FRONTEND_CURRENCY_EVENT, callback);
  return () => window.removeEventListener(FRONTEND_CURRENCY_EVENT, callback);
}

