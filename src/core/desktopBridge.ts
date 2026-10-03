// ============================================================================
// CISCO AUTOMATED v2.1 - DESKTOP PYWEBVIEW BRIDGE SERVICE
// Capa unificada y tipada para comunicarse con el entorno de escritorio Python/PyWebView
// ============================================================================

export interface DesktopFileOpenResult {
  success: boolean;
  buffer?: ArrayBuffer;
  filename?: string;
  error?: string;
}

export interface DesktopFileSaveResult {
  success: boolean;
  filePath?: string;
  folder?: string;
  error?: string;
}

/**
 * Retorna true si la aplicación se está ejecutando dentro del contenedor de escritorio PyWebView (.exe).
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).pywebview?.api);
}

/**
 * Acceso directo y seguro al objeto API expuesto por Python en PyWebView.
 */
export function getDesktopApi(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).pywebview?.api || null;
}

/**
 * Abre el selector nativo de archivos de Windows/PyWebView y convierte
 * la respuesta (base64 o bytes) en un ArrayBuffer nativo listo para ExcelJS.
 */
export async function openDesktopFileDialog(): Promise<DesktopFileOpenResult | null> {
  const api = getDesktopApi();
  if (!api || typeof api.open_file_dialog !== 'function') {
    return null;
  }

  try {
    const res = await api.open_file_dialog();
    if (!res || !res.success) {
      return { success: false, error: res?.error || 'Apertura cancelada' };
    }

    let buffer: ArrayBuffer;
    if (res.file_base64) {
      const binaryStr = atob(res.file_base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      buffer = bytes.buffer;
    } else if (res.file_bytes && Array.isArray(res.file_bytes)) {
      buffer = new Uint8Array(res.file_bytes).buffer;
    } else {
      return { success: false, error: 'Formato de archivo no reconocido' };
    }

    return {
      success: true,
      buffer,
      filename: res.filename || 'cotizacion.xlsx',
    };
  } catch (err: any) {
    console.error('[DesktopBridge] Error en openDesktopFileDialog:', err);
    return {
      success: false,
      error: err?.message || 'Error al invocar diálogo de archivos',
    };
  }
}

/**
 * Guarda un archivo Excel directamente en el disco mediante el diálogo nativo de PyWebView.
 */
export async function saveDesktopExcelFile(
  filename: string,
  buffer: ArrayBuffer | Uint8Array
): Promise<DesktopFileSaveResult> {
  const api = getDesktopApi();
  if (!api || typeof api.download_excel_file !== 'function') {
    return { success: false, error: 'Puente desktop no disponible' };
  }

  try {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const bytesList = Array.from(uint8);
    const res = await api.download_excel_file(filename, bytesList);
    return {
      success: Boolean(res?.success),
      filePath: res?.file_path,
      folder: res?.folder,
      error: res?.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error guardando archivo en Desktop',
    };
  }
}

/**
 * Abre la carpeta contenedora en el Explorador de archivos de Windows.
 */
export async function openFolderInExplorer(folderPath: string): Promise<void> {
  const api = getDesktopApi();
  if (api && typeof api.open_folder_in_explorer === 'function' && folderPath) {
    try {
      await api.open_folder_in_explorer(folderPath);
    } catch (e) {
      console.warn('[DesktopBridge] No se pudo abrir la carpeta en Explorer:', e);
    }
  }
}
