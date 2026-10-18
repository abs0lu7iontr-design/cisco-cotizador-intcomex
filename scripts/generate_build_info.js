import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { syncVersionAcrossCodebase, analyzeVersionBump } from './version_manager.js';

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

const pkgPath = path.join(rootDir, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Comprobar si se solicitó un bump automático o manual
const bumpReq = process.env.BUMP_VERSION; // 'patch' | 'minor' | 'major' | 'auto'
if (bumpReq) {
  const nextVer = analyzeVersionBump(pkg.version, bumpReq === 'auto' ? null : bumpReq);
  syncVersionAcrossCodebase(nextVer);
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} else {
  // Asegurar que src/core/appVersion.ts esté sincronizado con package.json
  syncVersionAcrossCodebase(pkg.version);
}

const gitCommit = getGitValue('git rev-parse --short HEAD', 'dev-local');
const gitBranch = getGitValue('git rev-parse --abbrev-ref HEAD', 'develop');
const gitMessage = getGitValue('git log -1 --pretty=%s', 'Build de desarrollo');
const buildTimestamp = new Date().toISOString();

const buildInfo = {
  name: pkg.name || 'cisco-automated',
  version: pkg.version || '2.2.0',
  git_commit: gitCommit,
  git_branch: gitBranch,
  build_timestamp: buildTimestamp,
  release_notes: gitMessage,
  download_url: 'https://develop.cisco-automated.pages.dev/desktop_build.html',
  fallback_url: 'https://raw.githubusercontent.com/abs0lu7iontr-design/cisco-cotizador-intcomex/develop/dist_exe/GravityDesktop/_internal/index.html',
  channel: gitBranch === 'main' ? 'production' : 'develop',
};

const jsonStr = JSON.stringify(buildInfo, null, 2);

const targetPaths = [
  path.join(rootDir, 'public', 'version.json'),
  path.join(rootDir, 'dist', 'version.json'),
  path.join(rootDir, 'desktop_app', 'version.json'),
  path.join(rootDir, 'dist_exe', 'GravityDesktop', '_internal', 'version.json'),
];

for (const p of targetPaths) {
  try {
    const dir = path.dirname(p);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(p, jsonStr, 'utf8');
      console.log(`[build-info] Escrito: ${p}`);
    }
  } catch (err) {
    console.warn(`[build-info] No se pudo escribir en ${p}:`, err.message);
  }
}

console.log('[build-info] Metadata generada exitosamente:', buildInfo);
