import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getGitValue(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

/**
 * Parses SemVer string "X.Y.Z" into [major, minor, patch] numbers
 */
function parseSemVer(versionStr) {
  const clean = (versionStr || '2.1.0').replace(/^v/, '').trim();
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  return {
    major: parts[0] ?? 2,
    minor: parts[1] ?? 1,
    patch: parts[2] ?? 0,
    raw: `${parts[0] ?? 2}.${parts[1] ?? 1}.${parts[2] ?? 0}`
  };
}

/**
 * Evaluates whether recent changes represent a major, minor, or patch update.
 * - Major: Breaking changes, architectural overhauls ("feat!", "BREAKING CHANGE", "major")
 * - Minor: New features, new modules, database schemas, new views ("feat:", "modulo", "feature", "minor")
 * - Patch: Bug fixes, UI repairs, documentation, maintenance ("fix:", "chore:", "docs:", "patch")
 */
export function analyzeVersionBump(currentVersion, forcedBump = null) {
  const semver = parseSemVer(currentVersion);

  if (forcedBump) {
    if (forcedBump === 'major') return `${semver.major + 1}.0.0`;
    if (forcedBump === 'minor') return `${semver.major}.${semver.minor + 1}.0`;
    if (forcedBump === 'patch') return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
  }

  // Get recent commit messages (last 3 commits)
  const commitMessages = getGitValue('git log -3 --pretty=%s', '').toLowerCase();

  const isMajor = /breaking change|feat!|major/.test(commitMessages);
  const isMinor = /feat(\(.*\))?:|feat:|modulo|module|nuevo modulo|new feature|minor/.test(commitMessages);

  if (isMajor) {
    return `${semver.major + 1}.0.0`;
  }
  if (isMinor) {
    return `${semver.major}.${semver.minor + 1}.0`;
  }
  // Default to patch
  return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
}

/**
 * Synchronizes the version across all code files, package.json, and desktop scripts.
 */
export function syncVersionAcrossCodebase(targetVersion) {
  const version = targetVersion.replace(/^v/, '').trim();
  console.log(`🔄 [version-sync] Sincronizando versión ${version} en todo el código...`);

  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version !== version) {
      pkg.version = version;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`  ✓ package.json actualizado a ${version}`);
    }
  }

  // 2. src/core/appVersion.ts
  const appVersionPath = path.join(rootDir, 'src', 'core', 'appVersion.ts');
  const appVersionContent = `// ============================================================================
// CISCO AUTOMATED - CENTRAL APPLICATION VERSION & RELEASE METADATA
// Single source of truth for versioning across Web, Desktop and Cloud
// Automatically synchronized by scripts/version_manager.js
// ============================================================================

export const APP_NAME = 'cisco-automated';
export const APP_DISPLAY_NAME = 'Cisco Automated';
export const APP_VERSION = '${version}';
export const APP_CHANNEL = 'develop';
export const APP_EDITION = 'Enterprise Suite (Cloud & Desktop Ready)';
export const APP_ENGINE_VERSION = 'ExcelJS CCW Engine v${version.split('.').slice(0, 2).join('.')}';

/**
 * Returns formatted version string, e.g. "v${version}"
 */
export function getFormattedAppVersion(prefix: boolean = true): string {
  return prefix ? \`v\${APP_VERSION}\` : APP_VERSION;
}

/**
 * Formats full application title with version
 */
export function getAppTitle(): string {
  return \`\${APP_DISPLAY_NAME} \${getFormattedAppVersion()} (\${APP_EDITION})\`;
}
`;
  fs.writeFileSync(appVersionPath, appVersionContent, 'utf8');
  console.log(`  ✓ src/core/appVersion.ts actualizado a ${version}`);

  // 3. desktop_app/desktop_window.py (si existe)
  const pyPath = path.join(rootDir, 'desktop_app', 'desktop_window.py');
  if (fs.existsSync(pyPath)) {
    try {
      let pyContent = fs.readFileSync(pyPath, 'utf8');
      pyContent = pyContent.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`);
      pyContent = pyContent.replace(/local_meta\.get\("version",\s*"[^"]+"\)/, `local_meta.get("version", "${version}")`);
      fs.writeFileSync(pyPath, pyContent, 'utf8');
      console.log(`  ✓ desktop_app/desktop_window.py actualizado a ${version}`);
    } catch (err) {
      console.warn(`  ⚠️ No se pudo actualizar desktop_window.py:`, err.message);
    }
  }

  return version;
}

// Execution if called directly from CLI: `node scripts/version_manager.js [--patch|--minor|--major|--sync]`
if (process.argv[1] && process.argv[1].endsWith('version_manager.js')) {
  const arg = process.argv[2] ? process.argv[2].replace(/^--/, '') : null;
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const current = pkg.version || '2.1.0';

  let nextVersion = current;
  if (arg === 'patch' || arg === 'minor' || arg === 'major') {
    nextVersion = analyzeVersionBump(current, arg);
  } else if (arg === 'auto') {
    nextVersion = analyzeVersionBump(current, null);
  } else if (arg && /^[0-9]+\.[0-9]+\.[0-9]+/.test(arg)) {
    nextVersion = arg;
  }

  syncVersionAcrossCodebase(nextVersion);
  console.log(`✅ [version-sync] Versión lista: ${nextVersion}`);
}
