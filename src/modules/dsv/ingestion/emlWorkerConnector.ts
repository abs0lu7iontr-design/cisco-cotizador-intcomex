// ============================================================================
// CISCO AUTOMATED v2.1 - EML WORKER CONNECTOR (MOTOR V2 AVANZADO)
// Uses Shared DSV Ingestion Pipeline + Comlink Web Worker & Zod Validation
// ============================================================================

import * as Comlink from 'comlink';
import {
  classifyIngestionFolder,
  DsvIngestionPipelineOptions,
  DsvVirtualFileEntry,
  executeDsvIngestionPipeline,
} from './dsvIngestionPipeline';
import { ConsolidatedDealRecord, DsvIngestionPipelineResult } from './types';
import { parseCiscoEml, parseJorgeEml } from './emlParser';
import { ParsedCiscoEmlSchema, ParsedJorgeEmlSchema } from './schemas';
import type { DsvEmlWorkerType } from './emlWorker';

let emlWorkerApi: Comlink.Remote<DsvEmlWorkerType> | null = null;
let emlWorkerInstance: Worker | null = null;

/**
 * Obtiene o inicializa la instancia remota de Comlink con el Web Worker.
 * Si el navegador o entorno no soporta Workers, retorna null para fallback síncrono.
 */
function getWorkerApi(): Comlink.Remote<DsvEmlWorkerType> | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!emlWorkerApi) {
    try {
      emlWorkerInstance = new Worker(new URL('./emlWorker.ts', import.meta.url), {
        type: 'module',
      });
      emlWorkerApi = Comlink.wrap<DsvEmlWorkerType>(emlWorkerInstance);
    } catch (e) {
      console.warn('No se pudo inicializar Web Worker, usando procesamiento síncrono fallback:', e);
      emlWorkerApi = null;
      emlWorkerInstance = null;
    }
  }
  return emlWorkerApi;
}

/**
 * Termina la instancia activa del Web Worker (útil al cancelar un escaneo pesado).
 */
export function terminateEmlWorker(): void {
  if (emlWorkerInstance) {
    try {
      emlWorkerInstance.terminate();
    } catch {}
    emlWorkerInstance = null;
    emlWorkerApi = null;
  }
}

async function parseCiscoWithWorkerAndZod(content: string, fileName: string): Promise<any> {
  const workerApi = getWorkerApi();
  if (workerApi) {
    try {
      return await workerApi.processCiscoEmail(content, fileName);
    } catch (workerErr) {
      console.warn('Fallo en worker para Cisco eml, usando fallback síncrono:', workerErr);
    }
  }
  const raw = parseCiscoEml(content, fileName);
  const v = ParsedCiscoEmlSchema.safeParse(raw);
  return v.success ? v.data : raw;
}

async function parseJorgeWithWorkerAndZod(content: string, fileName: string): Promise<any> {
  const workerApi = getWorkerApi();
  if (workerApi) {
    try {
      return await workerApi.processJorgeEmail(content, fileName);
    } catch (workerErr) {
      console.warn('Fallo en worker para Jorge eml, usando fallback síncrono:', workerErr);
    }
  }
  const raw = parseJorgeEml(content, fileName);
  const v = ParsedJorgeEmlSchema.safeParse(raw);
  return v.success ? v.data : raw;
}

/**
 * Procesa archivos seleccionados mediante input HTML usando el pipeline compartido + Web Worker (Comlink) y validación Zod.
 * Devuelve el resultado detallado incluyendo errores aislados por archivo y estado de cancelación.
 */
export async function processFilesFromInputDetailed(
  files: FileList | File[],
  options: DsvIngestionPipelineOptions = {}
): Promise<DsvIngestionPipelineResult> {
  const fileArray = Array.from(files as ArrayLike<File>);
  const entries: DsvVirtualFileEntry[] = fileArray.map((file) => ({
    name: file.name,
    folder: classifyIngestionFolder(file.webkitRelativePath || file.name),
    lastModified: file.lastModified,
    readText: () => file.text(),
    readArrayBuffer: () => file.arrayBuffer(),
  }));

  if (options.signal) {
    options.signal.addEventListener(
      'abort',
      () => {
        terminateEmlWorker();
      },
      { once: true }
    );
  }

  return executeDsvIngestionPipeline(entries, {
    ...options,
    parseCiscoEmailFn: options.parseCiscoEmailFn ?? parseCiscoWithWorkerAndZod,
    parseJorgeEmailFn: options.parseJorgeEmailFn ?? parseJorgeWithWorkerAndZod,
  });
}

/**
 * Procesa archivos seleccionados mediante input HTML usando Web Worker (Comlink) y validación Zod.
 * Compatible con Windows y POSIX tanto para archivos en subcarpetas cisco/ y jorge/.
 */
export async function processFilesFromInput(
  files: FileList | File[],
  options: DsvIngestionPipelineOptions = {}
): Promise<ConsolidatedDealRecord[]> {
  const result = await processFilesFromInputDetailed(files, options);
  return result.records;
}
