// ============================================================================
// CISCO AUTOMATED - CENTRAL APPLICATION VERSION & RELEASE METADATA
// Single source of truth for versioning across Web, Desktop and Cloud
// Automatically synchronized by scripts/version_manager.js
// ============================================================================

export const APP_NAME = 'cisco-automated';
export const APP_DISPLAY_NAME = 'Cisco Automated';
export const APP_VERSION = '2.25.0';
export const APP_CHANNEL = 'develop';
export const APP_EDITION = 'Enterprise Suite (Cloud & Desktop Ready)';
export const APP_ENGINE_VERSION = 'ExcelJS CCW Engine v2.25';

/**
 * Returns formatted version string, e.g. "v2.25.0"
 */
export function getFormattedAppVersion(prefix: boolean = true): string {
  return prefix ? `v${APP_VERSION}` : APP_VERSION;
}

/**
 * Formats full application title with version
 */
export function getAppTitle(): string {
  return `${APP_DISPLAY_NAME} ${getFormattedAppVersion()} (${APP_EDITION})`;
}

/**
 * Compara dos versiones SemVer (ej. "2.15.1" vs "2.15.0").
 * Retorna true si remoteVersion es estrictamente mayor que currentVersion.
 */
export function isNewerVersion(remoteVersion: string, currentVersion: string = APP_VERSION): boolean {
  try {
    const parse = (v: string) => {
      const clean = (v || '').replace(/^v/, '').trim();
      const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
      return {
        major: parts[0] ?? 0,
        minor: parts[1] ?? 0,
        patch: parts[2] ?? 0,
      };
    };

    const remote = parse(remoteVersion);
    const current = parse(currentVersion);

    if (remote.major > current.major) return true;
    if (remote.major < current.major) return false;

    if (remote.minor > current.minor) return true;
    if (remote.minor < current.minor) return false;

    return remote.patch > current.patch;
  } catch (_) {
    return false;
  }
}
