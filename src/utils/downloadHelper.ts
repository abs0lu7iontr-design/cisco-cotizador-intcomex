// ============================================================================
// CISCO AUTOMATED v2.1 - SAFE BLOB & TEMPORARY URL DOWNLOAD HELPER
// Centralizes Blob creation, temporary object URL lifecycle, DOM link cleanup,
// and delayed URL revocation so downloads never leak memory or abort mid-stream
// ============================================================================

export interface DownloadResourceOptions {
  /** Delay in ms before revoking the temporary object URL (default: 1500ms) */
  revokeDelayMs?: number;
}

export interface DownloadExecutionResult {
  success: boolean;
  filename: string;
  objectUrl?: string;
  error?: string;
}

interface PendingObjectUrlEntry {
  url: string;
  timerId: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

const pendingObjectUrls = new Map<string, PendingObjectUrlEntry>();

/**
 * Returns the number of currently active (unrevoked) temporary download object URLs.
 * Useful for diagnostics and QA resource-release verification.
 */
export function getPendingDownloadUrlCount(): number {
  return pendingObjectUrls.size;
}

/**
 * Immediately revokes a specific temporary object URL and clears its scheduled timer.
 */
export function revokeDownloadUrlNow(url: string): void {
  const entry = pendingObjectUrls.get(url);
  if (entry) {
    if (entry.timerId !== null) {
      clearTimeout(entry.timerId);
    }
    pendingObjectUrls.delete(url);
  }
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    // Ignore errors during URL revocation
  }
}

/**
 * Immediately revokes all pending temporary object URLs (e.g. on page unload or test cleanup).
 */
export function revokeAllPendingDownloadUrls(): number {
  const urls = Array.from(pendingObjectUrls.keys());
  for (const url of urls) {
    revokeDownloadUrlNow(url);
  }
  return urls.length;
}

/**
 * Safely triggers a browser file download from a Blob, removes the temporary DOM anchor
 * in a `finally` block, and schedules `URL.revokeObjectURL` after `revokeDelayMs`
 * so the browser can start the download stream without interruption.
 */
export function downloadBlobSafe(
  blob: Blob,
  filename: string,
  options?: DownloadResourceOptions
): DownloadExecutionResult {
  const safeFilename = (filename || 'download.bin').trim();
  const revokeDelayMs =
    typeof options?.revokeDelayMs === 'number' && options.revokeDelayMs >= 0
      ? options.revokeDelayMs
      : 1500;

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return {
      success: false,
      filename: safeFilename,
      error: 'URL.createObjectURL no está disponible en este entorno.',
    };
  }

  let objectUrl: string | undefined;
  let linkElement: HTMLAnchorElement | null = null;

  try {
    objectUrl = URL.createObjectURL(blob);

    if (typeof document !== 'undefined' && document.body) {
      linkElement = document.createElement('a');
      linkElement.href = objectUrl;
      linkElement.download = safeFilename;
      linkElement.setAttribute('download', safeFilename);
      linkElement.style.display = 'none';
      linkElement.rel = 'noopener';
      document.body.appendChild(linkElement);
      linkElement.click();
    }

    const urlToRevoke = objectUrl;
    if (revokeDelayMs === 0) {
      revokeDownloadUrlNow(urlToRevoke);
    } else {
      const timerId = setTimeout(() => {
        revokeDownloadUrlNow(urlToRevoke);
      }, revokeDelayMs);

      pendingObjectUrls.set(urlToRevoke, {
        url: urlToRevoke,
        timerId,
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      filename: safeFilename,
      objectUrl,
    };
  } catch (err: unknown) {
    if (objectUrl) {
      revokeDownloadUrlNow(objectUrl);
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      filename: safeFilename,
      error: message,
    };
  } finally {
    if (linkElement && linkElement.parentNode) {
      try {
        linkElement.parentNode.removeChild(linkElement);
      } catch {
        // Ignore DOM detachment race
      }
    }
  }
}

/**
 * Helper to create a Blob from text/binary content and trigger `downloadBlobSafe`.
 */
export function downloadContentSafe(
  content: BlobPart | BlobPart[],
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8;',
  options?: DownloadResourceOptions
): DownloadExecutionResult {
  try {
    const parts = Array.isArray(content) ? content : [content];
    const blob = new Blob(parts, { type: mimeType });
    return downloadBlobSafe(blob, filename, options);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      filename,
      error: message,
    };
  }
}
