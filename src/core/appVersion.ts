// ============================================================================
// CISCO AUTOMATED - CENTRAL APPLICATION VERSION & RELEASE METADATA
// Single source of truth for versioning across Web, Desktop and Cloud
// Automatically synchronized by scripts/version_manager.js
// ============================================================================

export const APP_NAME = 'cisco-automated';
export const APP_DISPLAY_NAME = 'Cisco Automated';
export const APP_VERSION = '2.7.6';
export const APP_CHANNEL = 'develop';
export const APP_EDITION = 'Enterprise Suite (Cloud & Desktop Ready)';
export const APP_ENGINE_VERSION = 'ExcelJS CCW Engine v2.7';

/**
 * Returns formatted version string, e.g. "v2.7.6"
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
