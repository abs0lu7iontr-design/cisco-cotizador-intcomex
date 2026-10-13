// ============================================================================
// CISCO AUTOMATED v2.1 - ONEDRIVE DIRECTORY CONNECTOR & SCANNER
// Uses Shared DSV Ingestion Pipeline (Bounded Concurrency + AbortSignal + Error Isolation)
// ============================================================================

import {
  classifyIngestionFolder,
  DsvIngestionPipelineOptions,
  DsvVirtualFileEntry,
  executeDsvIngestionPipeline,
} from './dsvIngestionPipeline';
import { ConsolidatedDealRecord, DsvIngestionPipelineResult } from './types';

function createVirtualEntryFromFile(
  file: File,
  folder: 'cisco' | 'jorge' | 'unknown',
  explicitName?: string
): DsvVirtualFileEntry {
  return {
    name: explicitName || file.name,
    folder,
    lastModified: file.lastModified,
    readText: () => file.text(),
    readArrayBuffer: () => file.arrayBuffer(),
  };
}

/**
 * Escanea el directorio seleccionado de OneDrive utilizando File System Access API (showDirectoryPicker)
 * y devuelve el detalle completo del pipeline (registros consolidados, errores por archivo y estado de cancelación).
 */
export async function scanOneDriveDsvDirectoryDetailed(
  options: DsvIngestionPipelineOptions = {}
): Promise<DsvIngestionPipelineResult> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    throw new Error(
      'Tu navegador no soporta la selección directa de carpetas del sistema (showDirectoryPicker). Utiliza un navegador basado en Chromium como Chrome o Edge.'
    );
  }

  const rootHandle = await (window as any).showDirectoryPicker({
    id: 'cisco-onedrive-dsv',
    mode: 'read',
  });

  const entries: DsvVirtualFileEntry[] = [];

  // 1. Enumerar Subcarpeta "cisco"
  try {
    const ciscoDirHandle = await rootHandle.getDirectoryHandle('cisco');
    for await (const [name, handle] of (ciscoDirHandle as any).entries()) {
      if (options.signal?.aborted) break;
      if (handle.kind === 'file') {
        const file: File = await handle.getFile();
        entries.push(createVirtualEntryFromFile(file, 'cisco', name));
      }
    }
  } catch (err) {
    console.warn('Subcarpeta cisco no encontrada:', err);
  }

  // 2. Enumerar Subcarpeta "jorge"
  try {
    const jorgeDirHandle = await rootHandle.getDirectoryHandle('jorge');
    for await (const [name, handle] of (jorgeDirHandle as any).entries()) {
      if (options.signal?.aborted) break;
      if (handle.kind === 'file') {
        const file: File = await handle.getFile();
        entries.push(createVirtualEntryFromFile(file, 'jorge', name));
      }
    }
  } catch (err) {
    console.warn('Subcarpeta jorge no encontrada:', err);
  }

  return executeDsvIngestionPipeline(entries, options);
}

/**
 * Escanea el directorio seleccionado de OneDrive devolviendo los registros consolidados.
 */
export async function scanOneDriveDsvDirectory(
  options: DsvIngestionPipelineOptions = {}
): Promise<ConsolidatedDealRecord[]> {
  const result = await scanOneDriveDsvDirectoryDetailed(options);
  return result.records;
}

/**
 * Escaneo alternativo mediante FileList (para fallback con <input webkitdirectory />)
 * utilizando el pipeline compartido con concurrencia controlada y aislamiento de errores.
 */
export async function scanFileListDsvDirectoryDetailed(
  fileList: FileList | File[],
  options: DsvIngestionPipelineOptions = {}
): Promise<DsvIngestionPipelineResult> {
  const files = Array.from(fileList as ArrayLike<File>);
  const entries: DsvVirtualFileEntry[] = files.map((file) => {
    const folder = classifyIngestionFolder(file.webkitRelativePath || file.name);
    return createVirtualEntryFromFile(file, folder);
  });

  return executeDsvIngestionPipeline(entries, options);
}

export async function scanFileListDsvDirectory(
  fileList: FileList | File[],
  options: DsvIngestionPipelineOptions = {}
): Promise<ConsolidatedDealRecord[]> {
  const result = await scanFileListDsvDirectoryDetailed(fileList, options);
  return result.records;
}
