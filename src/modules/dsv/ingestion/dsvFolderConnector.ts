// ============================================================================
// CISCO AUTOMATED v2.1 - ONEDRIVE DIRECTORY CONNECTOR & SCANNER
// ============================================================================

import { parseEmlContent, extractHighestDealId } from './emlParser';
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
    const emlEntries: Array<{ name: string; content: string; lastModified: number }> = [];

    for await (const [name, handle] of (ciscoDirHandle as any).entries()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        const lowerName = name.toLowerCase();

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
          emlEntries.push({
            name,
            content: await file.text(),
            lastModified: file.lastModified,
          });
        }
      }
    }

    // Procesar correos de Cisco (Dirección y vinculación a BOM)
    for (const eml of emlEntries) {
      const parsed = parseEmlContent(eml.content, eml.name);
      if (parsed.dealId) {
        consolidator.registerCiscoData({
          dealId: parsed.dealId,
          fileName: eml.name,
          lastModified: parsed.dateHeaderTimestamp ?? eml.lastModified,
          address: parsed.address,
          bomFile: bomFilesMap.get(parsed.dealId),
        });
      }
    }

    // Asegurar registro de BOMs huérfanos sin correo previo
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
    console.warn('No se encontró la subcarpeta cisco/ en el directorio seleccionado.', err);
  }

  // 2. Procesar Subcarpeta "jorge"
  try {
    const jorgeDirHandle = await rootHandle.getDirectoryHandle('jorge');
    for await (const [name, handle] of (jorgeDirHandle as any).entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.eml')) {
        const file = await handle.getFile();
        const content = await file.text();
        const parsed = parseEmlContent(content, name);

        if (parsed.dealId) {
          consolidator.registerJorgeData({
            dealId: parsed.dealId,
            fileName: name,
            lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
            poNumber: parsed.poNumber || '',
            soNumber: parsed.soNumber || '',
          });
        }
      }
    }
  } catch (err) {
    console.warn('No se encontró la subcarpeta jorge/ en el directorio seleccionado.', err);
  }

  return consolidator.consolidate();
}

/**
 * Escaneo alternativo mediante FileList (para fallback con <input webkitdirectory />)
 */
export async function scanFileListDsvDirectory(fileList: FileList): Promise<ConsolidatedDealRecord[]> {
  const consolidator = new DealConsolidator();
  const bomFilesMap = new Map<string, { fileName: string; fileBuffer: ArrayBuffer; lastModified: number }>();
  const ciscoEmlEntries: Array<{ name: string; content: string; lastModified: number }> = [];

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
        ciscoEmlEntries.push({
          name,
          content: await file.text(),
          lastModified: file.lastModified,
        });
      }
    } else if (isJorge && lowerName.endsWith('.eml')) {
      const content = await file.text();
      const parsed = parseEmlContent(content, name);
      if (parsed.dealId) {
        consolidator.registerJorgeData({
          dealId: parsed.dealId,
          fileName: name,
          lastModified: parsed.dateHeaderTimestamp ?? file.lastModified,
          poNumber: parsed.poNumber || '',
          soNumber: parsed.soNumber || '',
        });
      }
    }
  }

  for (const eml of ciscoEmlEntries) {
    const parsed = parseEmlContent(eml.content, eml.name);
    if (parsed.dealId) {
      consolidator.registerCiscoData({
        dealId: parsed.dealId,
        fileName: eml.name,
        lastModified: parsed.dateHeaderTimestamp ?? eml.lastModified,
        address: parsed.address,
        bomFile: bomFilesMap.get(parsed.dealId),
      });
    }
  }

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
