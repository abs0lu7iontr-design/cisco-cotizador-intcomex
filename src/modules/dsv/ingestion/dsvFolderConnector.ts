// ============================================================================
// CISCO AUTOMATED v2.1 - ONEDRIVE DIRECTORY CONNECTOR & SCANNER
// ============================================================================

import { parseCiscoEml, parseJorgeEml, extractHighestDealId } from './emlParser';
import { DealConsolidator } from './dealConsolidator';
import { ConsolidatedDealRecord } from './types';

/**
 * Escanea el directorio seleccionado de OneDrive utilizando File System Access API (showDirectoryPicker)
 */
export async function scanOneDriveDsvDirectory(): Promise<ConsolidatedDealRecord[]> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    throw new Error('Tu navegador no soporta la selección directa de carpetas del sistema (showDirectoryPicker). Utiliza un navegador basado en Chromium como Chrome o Edge.');
  }

  const rootHandle = await (window as any).showDirectoryPicker({
    id: 'cisco-onedrive-dsv',
    mode: 'read',
  });

  const consolidator = new DealConsolidator();

  // 1. Procesar Subcarpeta "cisco"
  try {
    const ciscoDirHandle = await rootHandle.getDirectoryHandle('cisco');
    const bomFilesMap = new Map<string, { fileName: string; fileBuffer: ArrayBuffer; lastModified: number }>();
    const emlEntries: Array<{ name: string; file: File }> = [];

    for await (const [name, handle] of (ciscoDirHandle as any).entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        const lowerName = name.toLowerCase();

        if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm')) {
          // Archivo BOM suelto en disco (si existiera)
          const dealId = extractHighestDealId(name);
          if (dealId) {
            bomFilesMap.set(dealId, {
              fileName: name,
              fileBuffer: await file.arrayBuffer(),
              lastModified: file.lastModified,
            });
          }
        } else if (lowerName.endsWith('.eml')) {
          emlEntries.push({ name, file });
        }
      }
    }

    // Procesar correos .eml de Cisco (Extracción de Base64 MIME BOM y Dirección)
    for (const entry of emlEntries) {
      const rawContent = await entry.file.text();
      const parsed = parseCiscoEml(rawContent, entry.name);

      const dealId = parsed.dealId || extractHighestDealId(entry.name);

      if (dealId) {
        // El BOM se extrae preferentemente del adjunto Base64 dentro del .eml
        const bomFile = parsed.bomAttachment
          ? {
              fileName: parsed.bomAttachment.fileName,
              fileBuffer: parsed.bomAttachment.buffer,
              lastModified: parsed.dateHeaderTimestamp ?? entry.file.lastModified,
            }
          : bomFilesMap.get(dealId);

        consolidator.registerCiscoData({
          dealId,
          fileName: entry.name,
          lastModified: parsed.dateHeaderTimestamp ?? entry.file.lastModified,
          address: parsed.address,
          bomFile,
        });
      }
    }

    // Asegurar registro de BOMs sueltos en disco sin correo asociado
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
  } catch (err) {
    console.warn('Subcarpeta cisco no encontrada:', err);
  }

  // 2. Procesar Subcarpeta "jorge"
  try {
    const jorgeDirHandle = await rootHandle.getDirectoryHandle('jorge');
    for await (const [name, handle] of (jorgeDirHandle as any).entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.eml')) {
        const file = await handle.getFile();
        const rawContent = await file.text();
        const parsed = parseJorgeEml(rawContent, name);

        const dealId = parsed.dealId || extractHighestDealId(name);

        if (dealId) {
          consolidator.registerJorgeData({
            dealId,
            fileName: name,
            lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
            poNumber: parsed.poNumber || '',
            soNumber: parsed.soNumber || '',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Subcarpeta jorge no encontrada:', err);
  }

  return consolidator.consolidate();
}

/**
 * Escaneo alternativo mediante FileList (para fallback con <input webkitdirectory />)
 */
export async function scanFileListDsvDirectory(fileList: FileList): Promise<ConsolidatedDealRecord[]> {
  const consolidator = new DealConsolidator();
  const bomFilesMap = new Map<string, { fileName: string; fileBuffer: ArrayBuffer; lastModified: number }>();
  const ciscoEmlEntries: Array<{ name: string; file: File }> = [];
  const jorgeEmlEntries: Array<{ name: string; file: File }> = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const pathParts = (file.webkitRelativePath || file.name).toLowerCase().split(/[/\\]/);

    const isCisco = pathParts.includes('cisco');
    const isJorge = pathParts.includes('jorge');
    const name = file.name;
    const lowerName = name.toLowerCase();

    if (isCisco) {
      if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm')) {
        const dealId = extractHighestDealId(name);
        if (dealId) {
          bomFilesMap.set(dealId, {
            fileName: name,
            fileBuffer: await file.arrayBuffer(),
            lastModified: file.lastModified,
          });
        }
      } else if (lowerName.endsWith('.eml')) {
        ciscoEmlEntries.push({ name, file });
      }
    } else if (isJorge && lowerName.endsWith('.eml')) {
      jorgeEmlEntries.push({ name, file });
    }
  }

  // 1. Procesar correos Cisco
  for (const entry of ciscoEmlEntries) {
    const rawContent = await entry.file.text();
    const parsed = parseCiscoEml(rawContent, entry.name);
    const dealId = parsed.dealId || extractHighestDealId(entry.name);

    if (dealId) {
      const bomFile = parsed.bomAttachment
        ? {
            fileName: parsed.bomAttachment.fileName,
            fileBuffer: parsed.bomAttachment.buffer,
            lastModified: parsed.dateHeaderTimestamp ?? entry.file.lastModified,
          }
        : bomFilesMap.get(dealId);

      consolidator.registerCiscoData({
        dealId,
        fileName: entry.name,
        lastModified: parsed.dateHeaderTimestamp ?? entry.file.lastModified,
        address: parsed.address,
        bomFile,
      });
    }
  }

  // 2. Procesar correos Jorge
  for (const entry of jorgeEmlEntries) {
    const rawContent = await entry.file.text();
    const parsed = parseJorgeEml(rawContent, entry.name);
    const dealId = parsed.dealId || extractHighestDealId(entry.name);

    if (dealId) {
      consolidator.registerJorgeData({
        dealId,
        fileName: entry.name,
        lastModified: parsed.dateHeaderTimestamp ?? entry.file.lastModified,
        poNumber: parsed.poNumber || '',
        soNumber: parsed.soNumber || '',
      });
    }
  }

  // 3. Registrar BOMs sueltos sin correo
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
