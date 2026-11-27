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
  const input = String(rawHtml ?? '');
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      const blockedTags = 'script,iframe,object,embed,link,meta,base,svg,math,form,input,button,textarea,select,style';
      doc.querySelectorAll(blockedTags).forEach((el) => el.remove());

      doc.body?.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === 'href' || name === 'src') {
            const val = attr.value.trim();
            const lower = val.toLowerCase();
            if (lower.startsWith('mailto:')) {
              el.setAttribute(attr.name, sanitizeSafeMailtoUrl(val));
            } else {
              const safeHttp = sanitizeSafeHttpUrl(val);
              if (safeHttp) {
                el.setAttribute(attr.name, safeHttp);
              } else {
                el.removeAttribute(attr.name);
              }
            }
          }
        }
      });
      return doc.body ? doc.body.innerHTML : '';
    } catch {
      // Fall through to deterministic sanitizer below
    }
  }

  let cleaned = input;
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/<(script|iframe|svg|math|style|form)[\s\S]*?<\/\1>/gi, '')
      .replace(/<(object|embed|link|meta|base|input|button|textarea|select)[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, 'blocked:');
  }
  return cleaned;
}

const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

/**
 * Valida URLs dinámicas antes de asignarlas a `<a href>` (bloquea javascript:, data:, vbscript:, file:, etc.).
 */
export function sanitizeSafeHttpUrl(
  rawUrl?: string | null,
  allowedHostSuffixes?: readonly string[]
): string {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (parsed.username || parsed.password) {
      return '';
    }
    if (allowedHostSuffixes && allowedHostSuffixes.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const allowed = allowedHostSuffixes.some((rawSuffix) => {
        const suffix = rawSuffix.toLowerCase().replace(/^\.+/, '');
        return host === suffix || host.endsWith(`.${suffix}`);
      });
      if (!allowed) return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Valida enlaces `mailto:` para impedir esquemas alternativos o inyección de encabezados.
 */
export function sanitizeSafeMailtoUrl(rawUrl?: string | null): string {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed || !trimmed.toLowerCase().startsWith('mailto:')) return '#';
  if (/[\r\n]/.test(trimmed)) return '#';
  return trimmed;
}

/**
 * Valida formato de correo electrónico simple antes de generar enlaces mailto:.
 */
export function isValidSimpleEmail(email?: string | null): boolean {
  const trimmed = String(email ?? '').trim();
  return EMAIL_VALIDATION_REGEX.test(trimmed);
}
