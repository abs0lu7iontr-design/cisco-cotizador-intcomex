// ============================================================================
// CISCO AUTOMATED v2.1 - DEAL CONSOLIDATOR & TEMPORAL VERSIONING ENGINE
// ============================================================================

import { CiscoSourceData, JorgeSourceData, ConsolidatedDealRecord } from './types';

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
   * Registra datos de Cisco aplicando regla de actualización más reciente por Deal ID
   * y combinando el archivo BOM o la dirección si provienen de eventos separados del mismo Deal.
   */
  public registerCiscoData(data: CiscoSourceData): void {
    const existing = this.ciscoRegistry.get(data.dealId);
    if (!existing) {
      this.ciscoRegistry.set(data.dealId, data);
      return;
    }

    if (data.lastModified > existing.lastModified) {
      this.ciscoRegistry.set(data.dealId, {
        ...data,
        address: data.address || existing.address,
        bomFile: data.bomFile || existing.bomFile,
      });
    } else {
      // Si el entrante es más antiguo pero tiene campos faltantes, los fusionamos sin sobreescribir la fecha
      if (!existing.bomFile && data.bomFile) {
        existing.bomFile = data.bomFile;
      }
      if (!existing.address && data.address) {
        existing.address = data.address;
      }
    }
  }

  /**
   * Registra datos de Jorge aplicando regla de actualización más reciente por Deal ID
   */
  public registerJorgeData(data: JorgeSourceData): void {
    const existing = this.jorgeRegistry.get(data.dealId);
    if (!existing || data.lastModified > existing.lastModified) {
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

      const latestTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

      records.push({
        dealId,
        status,
        lastUpdated: new Date(latestTime).toISOString(),
        cisco,
        jorge,
        validationErrors: errors,
      });
    }

    return records.sort((a, b) => b.dealId.localeCompare(a.dealId));
  }
}
