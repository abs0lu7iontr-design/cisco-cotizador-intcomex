// ============================================================================
// CISCO AUTOMATED - MATHEMATICAL FUZZY MATCHING ENGINE
// Tolerant Company Name Matching using Normalized Levenshtein Distance
// ============================================================================

/**
 * Normaliza un nombre de empresa exclusivamente para comparaciones internas de búsqueda.
 * Remueve tildes, signos de puntuación, sufijos societarios y espacios redundantes.
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[.,&/#!$%^&*;:{}=\-_`~()]/g, ' ') // Quitar puntuación
    .replace(/\s{2,}/g, ' ').trim();

  const suffixes = [
    ' s p a', ' spa', ' s a', ' sa', ' ltda', ' limitada',
    ' e i r l', ' eirl', ' cia', ' soc', ' s c p'
  ];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length).trim();
    }
  }
  return normalized.replace(/\s+/g, '');
}

/**
 * Calcula la distancia de edición de Levenshtein entre dos cadenas de texto.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Retorna el porcentaje de similitud (0 - 100) entre dos nombres de empresas.
 * Si son idénticos tras la normalización retorna 100%.
 */
export function getSimilarityScore(str1: string, str2: string): number {
  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return ((maxLength - distance) / maxLength) * 100;
}
