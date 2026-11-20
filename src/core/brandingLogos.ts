// Official High-Performance Branding Assets for Cisco Automated v2.24.0
// Uses lightweight asset paths to ensure instant zero-latency page loading

export const CISCO_AUTOMATED_SEAL_DATA_URI = './cisco-seal.png';
export const CISCO_AUTOMATED_SEAL_BASE64 = '';
export const INTCOMEX_LOGO_DATA_URI = './intcomex-logo.png';
export const CISCO_LOGO_DATA_URI = './icon-192.svg';
export const CISCO_HALLOWEEN_ANIMATED_LOGO_DATA_URI = './logo-halloween-animado.gif';
export const CISCO_AUTOMATED_ANIMATED_LOGO_DATA_URI = CISCO_HALLOWEEN_ANIMATED_LOGO_DATA_URI;

export function getSeasonalLoginLogo(): string {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const forced = (params.get('theme') || params.get('logo') || '').toLowerCase();
      if (forced === 'navidad' || forced === 'christmas' || forced === 'navideño') {
        return './logo-navidad-nieve.gif';
      }
      if (forced === 'halloween') {
        return './logo-halloween-animado.gif';
      }
    }
  } catch (_) {}

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Enero ... 11 = Diciembre
  const day = now.getDate();

  // Activación automática: 1 de Diciembre de 2026 en adelante durante diciembre y fiesta de Reyes (hasta 6 de enero)
  const isChristmasSeason =
    (year === 2026 && month === 11 && day >= 1) ||
    (year > 2026 && (month === 11 || (month === 0 && day <= 6)));

  if (isChristmasSeason) {
    return './logo-navidad-nieve.gif';
  }

  return './logo-halloween-animado.gif';
}
