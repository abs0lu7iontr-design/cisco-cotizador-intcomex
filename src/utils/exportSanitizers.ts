// ============================================================================
// CISCO AUTOMATED - SHARED EXPORT & CLIPBOARD SANITIZATION HELPERS
// ============================================================================

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Neutraliza fórmulas peligrosas (CSV Formula Injection: =, +, -, @, TAB, CR)
 * excepto números negativos puros (ej. -123.45), escapa comillas y entrecomilla.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `"${value}"` : '""';
  }
  let text = String(value ?? '');
  const trimmedStart = text.trimStart();
  const isPlainNegativeNumber = /^-\d+(\.\d+)?$/.test(trimmedStart);
  if (!isPlainNegativeNumber && /^[=+\-@\t\r]/.test(trimmedStart)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Sanitiza HTML antes de insertarlo temporalmente en el DOM para el fallback
 * de copia en portapapeles, eliminando etiquetas activas y atributos `on*`.
 */
export function sanitizeRichClipboardHtml(rawHtml: string): string {
  return String(rawHtml ?? '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|link|meta|base)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
}
