// ============================================================================
// CISCO AUTOMATED v2.1 - EML WORKER CONNECTOR (MOTOR V2 AVANZADO)
// ============================================================================

import * as Comlink from 'comlink';
import { DealConsolidator } from './dealConsolidator';
import { ConsolidatedDealRecord } from './types';
import { extractHighestDealId, parseCiscoEml, parseJorgeEml } from './emlParser';
import { ParsedCiscoEmlSchema, ParsedJorgeEmlSchema } from './schemas';
import type { DsvEmlWorkerType } from './emlWorker';

let emlWorkerApi: Comlink.Remote<DsvEmlWorkerType> | null = null;

/**
 * Obtiene o inicializa la instancia remota de Comlink con el Web Worker.
 * Si el navegador o entorno no soporta Workers, retorna null para fallback síncrono.
 */
function getWorkerApi(): Comlink.Remote<DsvEmlWorkerType> | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!emlWorkerApi) {
    try {
      const worker = new Worker(new URL('./emlWorker.ts', import.meta.url), { type: 'module' });
      emlWorkerApi = Comlink.wrap<DsvEmlWorkerType>(worker);
    } catch (e) {
      console.warn('No se pudo inicializar Web Worker, usando procesamiento síncrono fallback:', e);
      emlWorkerApi = null;
    }
  }
  return emlWorkerApi;
}

/**
 * Procesa archivos seleccionados mediante input HTML usando Web Worker (Comlink) y validación Zod.
 * Compatible con Windows y POSIX tanto para archivos en subcarpetas cisco/ y jorge/.
 */
export async function processFilesFromInput(files: FileList): Promise<ConsolidatedDealRecord[]> {
  const consolidator = new DealConsolidator();
  const fileArray = Array.from(files);
  const workerApi = getWorkerApi();

  const bomFilesMap = new Map<string, { fileName: string; fileBuffer: ArrayBuffer; lastModified: number }>();

  // 1. Recolectar BOMs sueltos en disco (.xls / .xlsx) si existen
  for (const file of fileArray) {
    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm');
    if (isExcel) {
      const dealId = extractHighestDealId(file.name);
      if (dealId) {
        bomFilesMap.set(dealId, {
          fileName: file.name,
          fileBuffer: await file.arrayBuffer(),
          lastModified: file.lastModified,
        });
      }
    }
  }

  // 2. Procesar correos .eml con Worker + Zod
  for (const file of fileArray) {
    const pathLower = (file.webkitRelativePath || file.name).toLowerCase();
    const pathParts = pathLower.split(/[/\\]/);

    const isCisco = pathParts.includes('cisco') || pathLower.includes('/cisco/') || pathLower.includes('\\cisco\\');
    const isJorge = pathParts.includes('jorge') || pathLower.includes('/jorge/') || pathLower.includes('\\jorge\\');

    if (!file.name.toLowerCase().endsWith('.eml')) continue;

    const content = await file.text();

    if (isCisco) {
      let parsed: any;
      if (workerApi) {
        try {
          parsed = await workerApi.processCiscoEmail(content, file.name);
        } catch (workerErr) {
          console.warn('Fallo en worker para Cisco eml, usando fallback síncrono:', workerErr);
          const raw = parseCiscoEml(content, file.name);
          const v = ParsedCiscoEmlSchema.safeParse(raw);
          parsed = v.success ? v.data : raw;
        }
      } else {
        const raw = parseCiscoEml(content, file.name);
        const v = ParsedCiscoEmlSchema.safeParse(raw);
        parsed = v.success ? v.data : raw;
      }

      const dealId = parsed.dealId || extractHighestDealId(file.name);

      if (dealId) {
        const bomFile = parsed.bomAttachment
          ? {
              fileName: parsed.bomAttachment.fileName,
              fileBuffer: parsed.bomAttachment.buffer,
              lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
            }
          : bomFilesMap.get(dealId);

        consolidator.registerCiscoData({
          dealId,
          fileName: file.name,
          lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
          address: parsed.address,
          bomFile,
        });
      }
    } else if (isJorge) {
      let parsed: any;
      if (workerApi) {
        try {
          parsed = await workerApi.processJorgeEmail(content, file.name);
        } catch (workerErr) {
          console.warn('Fallo en worker para Jorge eml, usando fallback síncrono:', workerErr);
          const raw = parseJorgeEml(content, file.name);
          const v = ParsedJorgeEmlSchema.safeParse(raw);
          parsed = v.success ? v.data : raw;
        }
      } else {
        const raw = parseJorgeEml(content, file.name);
        const v = ParsedJorgeEmlSchema.safeParse(raw);
        parsed = v.success ? v.data : raw;
      }

      const dealId = parsed.dealId || extractHighestDealId(file.name);

      if (dealId) {
        consolidator.registerJorgeData({
          dealId,
          fileName: file.name,
          lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
          poNumber: parsed.poNumber || '',
          soNumber: parsed.soNumber || '',
        });
      }
    }
  }

  // 3. Registrar BOMs sueltos sin correo asociado
  for (const [dealId, bom] of bomFilesMap.entries()) {
    if (!consolidator.hasCiscoData(dealId)) {
      consolidator.registerCiscoData({
        dealId,
        fileName: bom.fileName,
        lastModified: bom.lastModified,
        bomFile: bom,
      });
    }
  }

  return consolidator.consolidate();
}
