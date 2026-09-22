// ============================================================================
// CISCO AUTOMATED v2.1 - PARSER JERÁRQUICO DE ESTIMATES (MULTI-BLOQUE)
// ============================================================================

export interface ProcessedEstimateLine {
  lineNumber: string;
  partNumber: string;
  description: string;
  qty: number;
  unitListPrice: number;
  unitNetPriceCcw: number;
  extendedNetPriceCcw: number;
  parentGroup: string;             // Prefijo del grupo padre (ej: "1", "2", "4")
  detectedDurationMonths: number;  // 12, 24, 36, 60, etc.
  realUnitCost: number;            // Costo unitario real por el plazo completo
  isPeriodicSubscription: boolean; // True si el Unit Net de CCW venía en base mensual
}

function parseSafeNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/,/g, '').replace(/\$/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parseEstimateWithHierarchy(rawRows: any[][]): ProcessedEstimateLine[] {
  // Mapa de plazos por grupo mayor: "1" -> 36, "4" -> 12, etc.
  const parentGroupTerms = new Map<string, number>();
  let currentParentGroup = '1';

  // Paso 1: Mapear cabeceras y detectar términos por grupo padre
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const lineNum = String(row[0] || '').trim();
    const col1Text = String(row[1] || '').trim();
    const col3Text = String(row[3] || '').trim();
    const fullText = `${col1Text} ${col3Text}`;

    // Detectar línea mayor como "1.0", "2.0", "3.0"
    const majorMatch = lineNum.match(/^(\d+)\.0$/);
    if (majorMatch) {
      currentParentGroup = majorMatch[1];
    }

    // Detectar fila descriptiva de Initial Term asociada al grupo actual
    const termMatch = fullText.match(/Initial\s+Term\s*-\s*([\d.]+)\s*Months/i);
    if (termMatch) {
      const termMonths = Math.round(parseFloat(termMatch[1]));
      if (termMonths > 0) {
        parentGroupTerms.set(currentParentGroup, termMonths);
      }
    }
  }

  // Paso 2: Procesar cada línea y conciliar costos
  const processedLines: ProcessedEstimateLine[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const lineNum = String(row[0] || '').trim();
    const partNumber = String(row[1] || '').trim();
    const description = String(row[3] || '').trim();

    // Omitir filas de encabezado, notas, vacías o de metadata informativa
    if (!lineNum || !partNumber || lineNum.toLowerCase().includes('line')) continue;
    if (description.includes('Initial Term -') || partNumber.includes('Initial Term -')) continue;

    const parsedQty = parseSafeNum(row[8]);
    const qty = parsedQty || (lineNum.endsWith('.0') ? 1 : 0);
    const unitList = parseSafeNum(row[6]);
    const unitNetCcw = parseSafeNum(row[9]);
    const extNetCcw = parseSafeNum(row[11]);

    // Determinar a qué grupo padre pertenece esta línea (ej. "1.23" pertenece a "1")
    const groupMatch = lineNum.match(/^(\d+)/);
    const parentGroup = groupMatch ? groupMatch[1] : '1';
    const inheritedParentTerm = parentGroupTerms.get(parentGroup) || 1;

    let realUnitCost = unitNetCcw;
    let detectedDurationMonths = 1;
    let isPeriodicSubscription = false;

    // Contenedores padre como MERAKI-SUB con precio 0 se registran sin alterar totales
    if (lineNum.endsWith('.0') && extNetCcw === 0 && unitNetCcw === 0) {
      processedLines.push({
        lineNumber: lineNum,
        partNumber,
        description,
        qty: 1,
        unitListPrice: unitList,
        unitNetPriceCcw: 0,
        extendedNetPriceCcw: 0,
        parentGroup,
        detectedDurationMonths: inheritedParentTerm,
        realUnitCost: 0,
        isPeriodicSubscription: false
      });
      continue;
    }

    const calculatedSimple = unitNetCcw * qty;

    // Caso A: Líneas con precio donde el ExtNet refleja el plazo total
    if (extNetCcw > 0 && calculatedSimple > 0) {
      const ratio = extNetCcw / calculatedSimple;

      if (ratio > 1.05) {
        // Suscripción periódica detectada (12, 24, 36, 60 meses)
        isPeriodicSubscription = true;
        detectedDurationMonths = Math.round(ratio);
        realUnitCost = extNetCcw / (qty > 0 ? qty : 1);
      } else {
        // Hardware estándar o licencia DNA con Unit Net ya consolidado
        realUnitCost = unitNetCcw;
        detectedDurationMonths = inheritedParentTerm > 1 && !lineNum.endsWith('.0') ? inheritedParentTerm : 1;
      }
    } 
    // Caso B: Líneas a costo cero ($0.00) incluidas en suscripciones (ej. LIC-MT-E-INCL)
    else if (extNetCcw === 0 && unitNetCcw === 0) {
      realUnitCost = 0;
      detectedDurationMonths = inheritedParentTerm;
      isPeriodicSubscription = inheritedParentTerm > 1;
    }

    processedLines.push({
      lineNumber: lineNum,
      partNumber,
      description,
      qty,
      unitListPrice: unitList,
      unitNetPriceCcw: unitNetCcw,
      extendedNetPriceCcw: extNetCcw,
      parentGroup,
      detectedDurationMonths,
      realUnitCost,
      isPeriodicSubscription
    });
  }

  return processedLines;
}
