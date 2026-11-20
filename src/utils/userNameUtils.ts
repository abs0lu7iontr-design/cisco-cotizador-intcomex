// ============================================================================
// CISCO AUTOMATED - USER NAME FORMATTING UTILITIES FOR COMPACT CELL FIT
// Convierte nombres completos (ej. "Mauricio Skill", "Luis Burgos", "Johana Valencia")
// a nombres de pila directos ("Mauricio", "Luis", "Johana", "Marta", "Raul") para que
// las celdas de las tablas se ajusten de manera óptima sin desbordar ni recortar texto.
// ============================================================================

const KNOWN_USER_MAP: Record<string, string> = {
  mskill: 'Mauricio',
  pm_cisco: 'Mauricio',
  mauricioskill: 'Mauricio',
  lburgos: 'Luis',
  luisburgos: 'Luis',
  jvalencia: 'Johana',
  johanavalencia: 'Johana',
  madasme: 'Marta',
  martaadasme: 'Marta',
  rcuevas: 'Raul',
  raulcuevas: 'Raul',
  admin: 'Admin',
  operaciones: 'Operaciones',
  preventa: 'Preventa',
  logistica: 'Logística',
};

/**
 * Normaliza y extrae el primer nombre de un usuario para maximizar el espacio en celdas de tabla.
 * Ejemplos:
 * - "Mauricio Skill (Administrador)" -> "Mauricio"
 * - "Mauricio Skill" -> "Mauricio"
 * - "Luis Burgos" -> "Luis"
 * - "Johana Valencia" -> "Johana"
 * - "Marta Adasme" -> "Marta"
 * - "Raul Cuevas" -> "Raul"
 * - "Raúl Cuevas" -> "Raul"
 * - "mskill" -> "Mauricio"
 * - "lburgos" -> "Luis"
 */
export function formatShortUserFirstName(rawNameOrUser?: string | null): string {
  if (!rawNameOrUser || typeof rawNameOrUser !== 'string') return 'Usuario';
  const trimmed = rawNameOrUser.trim();
  if (!trimmed) return 'Usuario';

  // 1. Quitar etiquetas entre paréntesis (ej. "Mauricio Skill (Administrador)" -> "Mauricio Skill")
  let clean = trimmed;
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }

  // 2. Comprobar contra mapa de identificadores conocidos (sin espacios ni caracteres especiales)
  const normalizedKey = clean.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (KNOWN_USER_MAP[normalizedKey]) {
    return KNOWN_USER_MAP[normalizedKey];
  }

  // 3. Comprobaciones de prefijos comunes
  const lowerClean = clean.toLowerCase();
  if (lowerClean.startsWith('mauricio')) return 'Mauricio';
  if (lowerClean.startsWith('luis')) return 'Luis';
  if (lowerClean.startsWith('johana') || lowerClean.startsWith('jovana') || lowerClean.startsWith('yohana')) return 'Johana';
  if (lowerClean.startsWith('marta')) return 'Marta';
  if (lowerClean.startsWith('raul') || lowerClean.startsWith('raúl')) return 'Raul';

  // 4. Si tiene palabras separadas por espacios, tomar la primera
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length > 0) {
    const firstWord = parts[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return clean;
}

/**
 * Obtiene el nombre corto a partir de un objeto de sesión de usuario o creador de registro.
 */
export function getShortDisplayName(
  user?: { fullName?: string; full_name?: string; username?: string } | string | null
): string {
  if (!user) return 'Usuario';
  if (typeof user === 'string') {
    return formatShortUserFirstName(user);
  }
  const raw = user.fullName || user.full_name || user.username || '';
  return formatShortUserFirstName(raw);
}

/**
 * Mapea el usuario de la sesión actual al nombre de PM Responsable en Pipeline / Forecast.
 * Retorna el nombre oficial de la lista PIPELINE_PM_LIST o null si es un visualizador externo.
 * Ejemplos:
 * - "pm_cisco" / "mskill" / "Mauricio Skill" -> "Mauricio Skill"
 * - "rcuevas" / "Raul Cuevas" -> "Raul Cuevas"
 * - "madasme" / "Marta Adasme" -> "Marta Adasme"
 * - "jvalencia" / "Johana Valencia" -> "Johana Valencia"
 */
export function getPipelinePmForUser(
  user?: { username?: string; fullName?: string; full_name?: string; role?: string } | string | null
): string | null {
  if (!user) return null;
  const firstName = getShortDisplayName(user);
  const normalized = firstName.toLowerCase();

  if (normalized.includes('mauricio')) {
    return 'Mauricio Skill';
  }
  if (normalized.includes('raul') || normalized.includes('raúl')) {
    return 'Raul Cuevas';
  }
  if (normalized.includes('marta')) {
    return 'Marta Adasme';
  }
  if (normalized.includes('johana') || normalized.includes('jovana') || normalized.includes('yohana')) {
    return 'Johana Valencia';
  }

  // Si no coincide con un PM específico pero es admin o pm_cisco
  const rawStr = typeof user === 'string' ? user.toLowerCase() : `${user.username || ''} ${user.fullName || ''}`.toLowerCase();
  if (rawStr.includes('pm_cisco') || rawStr.includes('mskill')) {
    return 'Mauricio Skill';
  }

  return null;
}
