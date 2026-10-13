// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL CONSOLIDATOR & TEMPORAL VERSIONING ENGINE
// ============================================================================

import {
  BomFileCandidate,
  CiscoSourceData,
  JorgeSourceData,
  ConsolidatedDealRecord,
} from './types';

/**
 * Extracts an explicit revision number from a BOM filename if present
 * (e.g. `BOM_67956558_v3.xlsx` -> 3, `Deal_67956558_rev2.xls` -> 2, `file (1).xlsx` -> 1).
 */
export function extractBomRevisionNumber(fileName: string): number {
  const clean = String(fileName || '').replace(/\.[^/.]+$/, '');
  if (/(?:_|-|\b)final(?:\b|_|-)/i.test(clean)) {
    const finalRevMatch = clean.match(/(?:_v|-v|\brev[_\s-]?|\bversion[_\s-]?)(\d+)\b/i);
    return 1000 + (finalRevMatch ? parseInt(finalRevMatch[1], 10) || 0 : 0);
  }
  const revMatch = clean.match(/(?:_v|-v|\brev[_\s-]?|\bversion[_\s-]?)(\d+)\b/i);
  if (revMatch) {
    const n = parseInt(revMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  const parenMatch = clean.match(/\((\d+)\)\s*$/);
  if (parenMatch) {
    const n = parseInt(parenMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/**
 * Deterministic comparator between two BOM candidates for the same Deal ID.
 * Returns > 0 if `candidate` should win over `existing`, < 0 if `existing` wins, 0 if identical.
 *
 * Hierarchy of criteria (independent of file iteration order):
 * 1. Valid timestamp (`lastModified`) — newer timestamp wins when both are positive and differ.
 * 2. Explicit revision number in filename (`_v2`, `rev2`, `(2)`).
 * 3. Source priority (`email_attachment` > `loose_file`).
 * 4. Buffer byte length (larger non-empty BOM wins over empty/smaller stub).
 * 5. Lexicographical tie-breaker on normalized `fileName` descending.
 */
export function compareBomCandidatesDeterministic(
  existing: BomFileCandidate,
  candidate: BomFileCandidate
): { winner: BomFileCandidate; reason: string } {
  const timeA = Number.isFinite(existing.lastModified) ? existing.lastModified : 0;
  const timeB = Number.isFinite(candidate.lastModified) ? candidate.lastModified : 0;

  if (timeA !== timeB) {
    return timeB > timeA
      ? { winner: candidate, reason: `timestamp más reciente (${timeB} > ${timeA})` }
      : { winner: existing, reason: `timestamp más reciente (${timeA} > ${timeB})` };
  }

  const revA = existing.revisionHint ?? extractBomRevisionNumber(existing.fileName);
  const revB = candidate.revisionHint ?? extractBomRevisionNumber(candidate.fileName);
  if (revA !== revB) {
    return revB > revA
      ? { winner: candidate, reason: `revisión explícita mayor (v${revB} > v${revA})` }
      : { winner: existing, reason: `revisión explícita mayor (v${revA} > v${revB})` };
  }

  const srcPriorityA = existing.source === 'email_attachment' ? 2 : 1;
  const srcPriorityB = candidate.source === 'email_attachment' ? 2 : 1;
  if (srcPriorityA !== srcPriorityB) {
    return srcPriorityB > srcPriorityA
      ? { winner: candidate, reason: 'prioridad adjunto oficial de correo sobre archivo suelto' }
      : { winner: existing, reason: 'prioridad adjunto oficial de correo sobre archivo suelto' };
  }

  const sizeA = existing.fileBuffer?.byteLength ?? 0;
  const sizeB = candidate.fileBuffer?.byteLength ?? 0;
  if (sizeA !== sizeB) {
    return sizeB > sizeA
      ? { winner: candidate, reason: `mayor tamaño de payload (${sizeB}B > ${sizeA}B)` }
      : { winner: existing, reason: `mayor tamaño de payload (${sizeA}B > ${sizeB}B)` };
  }

  const cmpName = String(candidate.fileName || '').localeCompare(String(existing.fileName || ''));
  if (cmpName !== 0) {
    return cmpName > 0
      ? { winner: candidate, reason: `desempate léxico determinista (${candidate.fileName})` }
      : { winner: existing, reason: `desempate léxico determinista (${existing.fileName})` };
  }

  return { winner: existing, reason: 'candidatos idénticos' };
}

/**
 * Selects the canonical BOM from a list of 1 or more candidates for the same Deal ID.
 * Completely independent of input array permutation.
 */
export function selectCanonicalBomCandidate(candidates: BomFileCandidate[]): {
  selected: BomFileCandidate | undefined;
  warnings: string[];
} {
  if (!candidates || candidates.length === 0) {
    return { selected: undefined, warnings: [] };
  }
  if (candidates.length === 1) {
    return { selected: candidates[0], warnings: [] };
  }

  let current = candidates[0];
  let lastReason = '';
  for (let i = 1; i < candidates.length; i++) {
    const res = compareBomCandidatesDeterministic(current, candidates[i]);
    current = res.winner;
    lastReason = res.reason;
  }

  const allNames = candidates
    .map((c) => c.fileName)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');

  return {
    selected: current,
    warnings: [
      `Se detectaron ${candidates.length} archivos BOM para este Deal ID (${allNames}). Se seleccionó determinísticamente "${current.fileName}" por ${lastReason}.`,
    ],
  };
}

export class DealConsolidator {
  private ciscoRegistry = new Map<string, CiscoSourceData>();
  private jorgeRegistry = new Map<string, JorgeSourceData>();

  /**
   * Verifica si ya existe registro de Cisco para este Deal ID
   */
  public hasCiscoData(dealId: string): boolean {
    return this.ciscoRegistry.has(dealId);
  }

  /**
   * Verifica si ya existe registro de Jorge para este Deal ID
   */
  public hasJorgeData(dealId: string): boolean {
    return this.jorgeRegistry.has(dealId);
  }

  /**
   * Registra datos de Cisco aplicando selección determinista de metadatos y BOM por Deal ID.
   * El resultado final es invariante ante cualquier permutación en el orden de lectura de archivos.
   */
  public registerCiscoData(data: CiscoSourceData): void {
    const existing = this.ciscoRegistry.get(data.dealId);
    if (!existing) {
      this.ciscoRegistry.set(data.dealId, {
        ...data,
        duplicateBomNotifications: data.duplicateBomNotifications
          ? [...data.duplicateBomNotifications]
          : [],
      });
      return;
    }

    const notifications = new Set<string>([
      ...(existing.duplicateBomNotifications || []),
      ...(data.duplicateBomNotifications || []),
    ]);

    let resolvedBom: BomFileCandidate | undefined = existing.bomFile;
    if (existing.bomFile && data.bomFile) {
      const comparison = compareBomCandidatesDeterministic(existing.bomFile, data.bomFile);
      resolvedBom = comparison.winner;
      if (existing.bomFile.fileName !== data.bomFile.fileName || existing.bomFile.lastModified !== data.bomFile.lastModified) {
        const pair = [existing.bomFile.fileName, data.bomFile.fileName].sort().join(' vs ');
        notifications.add(
          `BOM duplicado detectado (${pair}): seleccionado "${resolvedBom.fileName}" (${comparison.reason}).`
        );
      }
    } else if (!existing.bomFile && data.bomFile) {
      resolvedBom = data.bomFile;
    }

    // Determinar cuál registro Cisco domina en metadatos (fecha + desempate léxico por fileName)
    const incomingWinsMeta =
      data.lastModified > existing.lastModified ||
      (data.lastModified === existing.lastModified &&
        String(data.fileName || '').localeCompare(String(existing.fileName || '')) > 0);

    const primary = incomingWinsMeta ? data : existing;
    const secondary = incomingWinsMeta ? existing : data;

    this.ciscoRegistry.set(data.dealId, {
      ...primary,
      address: primary.address || secondary.address,
      bomFile: resolvedBom,
      duplicateBomNotifications: Array.from(notifications),
    });
  }

  /**
   * Registra datos de Jorge aplicando regla determinista por Deal ID
   * (timestamp más reciente y desempate léxico por nombre de archivo / SO).
   */
  public registerJorgeData(data: JorgeSourceData): void {
    const existing = this.jorgeRegistry.get(data.dealId);
    if (!existing) {
      this.jorgeRegistry.set(data.dealId, data);
      return;
    }

    const incomingWins =
      data.lastModified > existing.lastModified ||
      (data.lastModified === existing.lastModified &&
        (String(data.fileName || '').localeCompare(String(existing.fileName || '')) > 0 ||
          String(data.soNumber || '').localeCompare(String(existing.soNumber || '')) > 0));

    if (incomingWins) {
      this.jorgeRegistry.set(data.dealId, data);
    }
  }

  /**
   * Consolida unificando estrictamente por Deal ID compartido con validaciones exactas
   */
  public consolidate(): ConsolidatedDealRecord[] {
    const allDealIds = new Set([
      ...this.ciscoRegistry.keys(),
      ...this.jorgeRegistry.keys(),
    ]);

    const records: ConsolidatedDealRecord[] = [];

    for (const dealId of allDealIds) {
      const cisco = this.ciscoRegistry.get(dealId);
      const jorge = this.jorgeRegistry.get(dealId);
      const errors: string[] = [];
      const warnings: string[] = [...(cisco?.duplicateBomNotifications || [])];

      let status: ConsolidatedDealRecord['status'] = 'READY';

      // 1. Validación de Longitud Exacta de Deal ID (8 dígitos numéricos)
      if (!/^\d{8}$/.test(dealId)) {
        status = 'INVALID_FORMAT';
        errors.push(`Deal ID inválido: esperado exactamente 8 dígitos numéricos (obtenido: "${dealId}").`);
      }

      // 2. Validación de BOM de Cisco
      if (!cisco || !cisco.bomFile) {
        if (status === 'READY') status = 'PENDING_CISCO_BOM';
        errors.push('Falta archivo BOM (.xls / .xlsx) en carpeta Cisco.');
      }

      // 3. Validación de Dirección de Despacho
      if (!cisco?.address) {
        if (status === 'READY') status = 'PENDING_ADDRESS';
        errors.push('Dirección de despacho no detectada en correo de Cisco.');
      }

      // 4. Validación de Datos de Jorge (PO y SO)
      if (!jorge) {
        if (status === 'READY') status = 'PENDING_JORGE';
        errors.push('Faltan datos de PO/SO en carpeta Jorge.');
      } else {
        const isPoValid = jorge.poNumber && /^\d{6}$/.test(jorge.poNumber);
        const isSoValid = jorge.soNumber && /^\d{9}$/.test(jorge.soNumber);

        if (!isPoValid) {
          status = 'INVALID_FORMAT';
          errors.push(`PO inválido: esperado exactamente 6 dígitos numéricos (obtenido: "${jorge.poNumber ?? 'vacío'}").`);
        }
        if (!isSoValid) {
          status = 'INVALID_FORMAT';
          errors.push(`SO inválido: esperado exactamente 9 dígitos numéricos (obtenido: "${jorge.soNumber ?? 'vacío'}").`);
        }
      }

      // 5. Determinar la fecha de la última actualización
      const timestamps = [
        cisco?.lastModified,
        cisco?.bomFile?.lastModified,
        jorge?.lastModified,
      ].filter((t): t is number => typeof t === 'number' && !isNaN(t));

      const latestTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;

      records.push({
        dealId,
        status,
        lastUpdated: latestTime > 0 ? new Date(latestTime).toISOString() : '',
        cisco,
        jorge,
        validationErrors: errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    return records.sort((a, b) => b.dealId.localeCompare(a.dealId));
  }
}
