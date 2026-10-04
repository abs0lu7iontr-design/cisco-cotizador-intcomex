// ============================================================================
// CISCO AUTOMATED v2.1 - DESKTOP PYWEBVIEW BRIDGE SERVICE
// Capa unificada y tipada para comunicarse con el entorno de escritorio Python/PyWebView
// ============================================================================

export interface DesktopFileOpenResult {
  success: boolean;
  buffer?: ArrayBuffer;
  filename?: string;
  partner?: string;
  client?: string;
  storedFilepath?: string;
  error?: string;
}

export interface DesktopFileSaveResult {
  success: boolean;
  filePath?: string;
  folder?: string;
  month?: string;
  filename?: string;
  cancelled?: boolean;
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
    if (!res) {
      return null;
    }
    if (!res.success) {
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
      partner: res.partner,
      client: res.client,
      storedFilepath: res.stored_filepath || res.storedFilepath,
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
      filePath: res?.filepath || res?.file_path,
      folder: res?.folder,
      cancelled: Boolean(res?.cancelled),
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
 * Guarda el archivo cotizado en la estructura jerárquica corporativa de carpetas:
 * gravity_storage / [Partner] / [ClienteFinal] / [Mes] / [filename]
 */
export async function saveStructuredDesktopEstimate(
  partnerName: string,
  clientFinalName: string,
  filename: string,
  buffer: ArrayBuffer | Uint8Array
): Promise<DesktopFileSaveResult> {
  const api = getDesktopApi();
  if (!api || typeof api.save_estimate_structured !== 'function') {
    return { success: false, error: 'Puente desktop estructurado no disponible' };
  }

  try {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const bytesList = Array.from(uint8);
    const res = await api.save_estimate_structured(partnerName, clientFinalName, filename, bytesList);
    return {
      success: Boolean(res?.success),
      filePath: res?.filepath || res?.file_path,
      folder: res?.folder,
      month: res?.month,
      filename: res?.filename,
      cancelled: Boolean(res?.cancelled),
      error: res?.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error guardando archivo estructurado en Desktop',
    };
  }
}

export interface DesktopSearchResult {
  filename: string;
  filepath: string;
  folder: string;
  partner?: string;
  client?: string;
  month?: string;
  size_bytes?: number;
  modified_at?: string;
}

export interface DesktopUpdateResult {
  success: boolean;
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_url: string;
  release_notes: string;
}

/**
 * Abre el cliente nativo de correo (Outlook) con los parámetros especificados.
 */
export async function openDesktopEmailClient(
  recipient: string,
  cc: string = '',
  subject: string = '',
  body: string = ''
): Promise<boolean> {
  const api = getDesktopApi();
  if (api && typeof api.open_email_client === 'function') {
    try {
      const res = await api.open_email_client(recipient, cc, subject, body);
      return Boolean(res && res.success);
    } catch (e) {
      console.warn('[DesktopBridge] Error abriendo cliente de correo nativo:', e);
    }
  }
  return false;
}

/**
 * Busca cotizaciones en la estructura jerárquica gravity_storage y la base de datos local.
 */
export async function searchDesktopStorage(queryText: string): Promise<DesktopSearchResult[]> {
  const api = getDesktopApi();
  if (api && typeof api.search_storage === 'function') {
    try {
      const res = await api.search_storage(queryText);
      if (res && res.success && Array.isArray(res.results)) {
        return res.results;
      }
    } catch (e) {
      console.warn('[DesktopBridge] Error en búsqueda de archivos desktop:', e);
    }
  }
  return [];
}

/**
 * Comprueba si existe una versión más reciente de la aplicación en la nube.
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdateResult | null> {
  const api = getDesktopApi();
  if (api && typeof api.check_for_updates === 'function') {
    try {
      const res = await api.check_for_updates();
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.warn('[DesktopBridge] Error comprobando actualizaciones:', e);
    }
  }
  return null;
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

