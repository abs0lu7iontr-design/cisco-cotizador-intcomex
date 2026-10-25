// ============================================================================
// CISCO AUTOMATED - FINANCIAL GUARDRAILS & COMMERCIAL SAFETY THRESHOLDS
// Reglas de seguridad para evitar ventas a pérdida o márgenes sub-estándar
// ============================================================================

import { EstimateLineItem, QuoteParameters } from './types';

/** Margen comercial mínimo recomendado por la gerencia de Intcomex */
export const MIN_RECOMMENDED_MARGIN_PCT = 4.0;

/** Tasa de internación mínima recomendada para hardware tangible */
export const MIN_RECOMMENDED_INTERNACION_PCT = 4.0;

export interface GuardrailIssue {
  type: 'margin_below_minimum' | 'internacion_below_minimum' | 'negative_profit';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  lineNumber?: string;
}

export interface GuardrailValidationResult {
  hasIssues: boolean;
  isSafe: boolean;
  issues: GuardrailIssue[];
  effectiveMarginPct: number;
  effectiveInternacionPct: number;
}

/**
 * Evalúa los parámetros y líneas cotizadas frente a los guardarraíles financieros corporativos.
 * Margen mínimo = 4.0%, Internación mínima en hardware = 4.0%
 */
export function validateQuoteGuardrails(
  params: QuoteParameters,
  items: readonly EstimateLineItem[] = []
): GuardrailValidationResult {
  const issues: GuardrailIssue[] = [];

  const margin = Number(params.margenPct ?? 5.0);
  const internacion = Number(params.internacionPct ?? 7.0);

  // 1. Verificación de Margen Global
  if (margin < MIN_RECOMMENDED_MARGIN_PCT) {
    issues.push({
      type: 'margin_below_minimum',
      severity: margin <= 1.0 ? 'critical' : 'warning',
      title: 'Margen por debajo del 4.0% mínimo corporativo',
      message: `El margen global configurado (${margin.toFixed(1)}%) es inferior al umbral de seguridad comercial (4.0%).`,
      value: margin,
      threshold: MIN_RECOMMENDED_MARGIN_PCT,
    });
  }

  // 2. Verificación de Internación Global en Hardware Tangible
  const hasTangibleHardware = items.some(
    (it) => !it.isIntangible && !it.isInfoRow && it.netCiscoUnit > 0
  );

  if (hasTangibleHardware && internacion < MIN_RECOMMENDED_INTERNACION_PCT) {
    issues.push({
      type: 'internacion_below_minimum',
      severity: internacion === 0 ? 'critical' : 'warning',
      title: 'Internación de Hardware por debajo del 4.0% mínimo',
      message: `La tasa de internación (${internacion.toFixed(1)}%) es inferior al 4.0% mínimo para cubrir costos logísticos en Chile.`,
      value: internacion,
      threshold: MIN_RECOMMENDED_INTERNACION_PCT,
    });
  }

  // 3. Verificación de Bloques Custom por Línea (si aplica)
  if (params.parameterMode === 'custom_lines' && params.lineCustomParams) {
    Object.entries(params.lineCustomParams).forEach(([motherKey, custom]) => {
      if (custom.margenPct !== undefined && custom.margenPct < MIN_RECOMMENDED_MARGIN_PCT) {
        issues.push({
          type: 'margin_below_minimum',
          severity: custom.margenPct <= 1.0 ? 'critical' : 'warning',
          title: `Línea ${motherKey}: Margen por debajo del 4.0%`,
          message: `El bloque ${motherKey} tiene un margen de ${custom.margenPct.toFixed(1)}%, inferior al piso corporativo (4.0%).`,
          value: custom.margenPct,
          threshold: MIN_RECOMMENDED_MARGIN_PCT,
          lineNumber: motherKey,
        });
      }

      if (
        custom.internacionPct !== undefined &&
        custom.internacionPct < MIN_RECOMMENDED_INTERNACION_PCT
      ) {
        // Verificar si la línea madre tiene ítems tangibles
        const lineHasTangible = items.some(
          (it) =>
            !it.isIntangible &&
            !it.isInfoRow &&
            it.lineNumber?.startsWith(motherKey.replace('.0', ''))
        );
        if (lineHasTangible) {
          issues.push({
            type: 'internacion_below_minimum',
            severity: custom.internacionPct === 0 ? 'critical' : 'warning',
            title: `Línea ${motherKey}: Internación por debajo del 4.0%`,
            message: `El bloque ${motherKey} tiene internación de ${custom.internacionPct.toFixed(1)}% en hardware tangible.`,
            value: custom.internacionPct,
            threshold: MIN_RECOMMENDED_INTERNACION_PCT,
            lineNumber: motherKey,
          });
        }
      }
    });
  }

  return {
    hasIssues: issues.length > 0,
    isSafe: issues.length === 0,
    issues,
    effectiveMarginPct: margin,
    effectiveInternacionPct: internacion,
  };
}
