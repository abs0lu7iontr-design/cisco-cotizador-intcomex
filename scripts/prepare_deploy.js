import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 [deploy-prep] Iniciando preparación de artefactos de despliegue y auto-update...');

// 1. Generar metadatos version.json
console.log('📦 [deploy-prep] 1/4 Generando metadatos de versión y Git...');
execSync('node scripts/generate_build_info.js', { cwd: rootDir, stdio: 'inherit' });

// 2. Compilar paquete portable single-file para Desktop (desktop_build.html)
console.log('⚡ [deploy-prep] 2/4 Compilando bundle portable single-file para la aplicación de escritorio...');
execSync('npx vite build', {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_SINGLE_FILE: 'true' },
});

const portableHtmlPath = path.join(rootDir, 'dist', 'index.html');
if (!fs.existsSync(portableHtmlPath)) {
  throw new Error('No se generó dist/index.html tras compilar single-file');
}

const portableBundleBuffer = fs.readFileSync(portableHtmlPath);
const desktopBundleSha256 = crypto.createHash('sha256').update(portableBundleBuffer).digest('hex');
console.log(`✅ [deploy-prep] Bundle portable compilado: ${(portableBundleBuffer.length / (1024 * 1024)).toFixed(2)} MB (sha256: ${desktopBundleSha256.slice(0, 12)}...)`);

// Inyectar `desktop_bundle_sha256` en todos los version.json generados para verificación obligatoria en Desktop
for (const vPath of [
  path.join(rootDir, 'public', 'version.json'),
  path.join(rootDir, 'dist', 'version.json'),
  path.join(rootDir, 'desktop_app', 'version.json'),
  path.join(rootDir, 'dist_exe', 'GravityDesktop', '_internal', 'version.json'),
]) {
  try {
    if (fs.existsSync(vPath)) {
      const meta = JSON.parse(fs.readFileSync(vPath, 'utf8'));
      meta.desktop_bundle_sha256 = desktopBundleSha256;
      fs.writeFileSync(vPath, JSON.stringify(meta, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn(`⚠️ [deploy-prep] No se pudo inyectar SHA-256 en ${vPath}:`, e.message);
  }
}

// Copiar bundle portable a los destinos locales de Desktop
const desktopTargets = [
  path.join(rootDir, 'desktop_app', 'index.html'),
  path.join(rootDir, 'desktop_app', 'frontend', 'index.html'),
  path.join(rootDir, 'dist_exe', 'GravityDesktop', '_internal', 'index.html'),
];

for (const target of desktopTargets) {
  try {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, portableBundleBuffer);
    console.log(`📋 [deploy-prep] Sincronizado a desktop local: ${path.relative(rootDir, target)}`);
    // Sincronizar assets estáticos de branding ligero (Halloween, Navidad, Cisco Seal, Intcomex)
    for (const logo of ['logo-navidad-nieve.gif', 'logo-halloween-animado.gif', 'cisco-seal.png', 'intcomex-logo.png']) {
      const src = path.join(rootDir, 'public', logo);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(dir, logo));
      }
    }
  } catch (err) {
    console.warn(`⚠️ [deploy-prep] No se pudo escribir en ${target}:`, err.message);
  }
}

// 3. Compilar versión web chunked optimizada para Cloudflare Pages
console.log('🌐 [deploy-prep] 3/4 Compilando versión web optimizada para Cloudflare Pages...');
execSync('npx vite build', {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_SINGLE_FILE: 'false' },
});

// 4. Armar directorio dist-pages para Cloudflare Pages
console.log('📁 [deploy-prep] 4/4 Estructurando dist-pages para CDN de Cloudflare Pages...');
const distPagesDir = path.join(rootDir, 'dist-pages');
if (fs.existsSync(distPagesDir)) {
  fs.rmSync(distPagesDir, { recursive: true, force: true });
}
fs.mkdirSync(distPagesDir, { recursive: true });

// Copiar todo el contenido de dist a dist-pages
function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyDirRecursive(path.join(rootDir, 'dist'), distPagesDir);

// Añadir el bundle portable compilado a dist-pages y dist como desktop_build.html, preservando version.json con SHA-256
const cdnDesktopBundlePath = path.join(distPagesDir, 'desktop_build.html');
fs.writeFileSync(cdnDesktopBundlePath, portableBundleBuffer);
fs.writeFileSync(path.join(rootDir, 'dist', 'desktop_build.html'), portableBundleBuffer);
const pubVerPath = path.join(rootDir, 'public', 'version.json');
if (fs.existsSync(pubVerPath)) {
  const verRaw = fs.readFileSync(pubVerPath, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'dist', 'version.json'), verRaw, 'utf8');
  fs.writeFileSync(path.join(distPagesDir, 'version.json'), verRaw, 'utf8');
}
console.log(`🚀 [deploy-prep] Inyectado en CDN Cloudflare: desktop_build.html (${(portableBundleBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

// Asegurar headers, version.json y PWA assets
const staticAssetsToSync = [
  'version.json',
  'sw.js',
  'manifest.json',
  'icon-192.svg',
  'icon-512.svg',
  'favicon.ico',
  'logo-navidad-nieve.gif',
  'logo-halloween-animado.gif',
  'cisco-seal.png',
  'intcomex-logo.png',
];
for (const asset of staticAssetsToSync) {
  const assetSrc = path.join(rootDir, 'public', asset);
  if (fs.existsSync(assetSrc)) {
    fs.copyFileSync(assetSrc, path.join(distPagesDir, asset));
  }
}

const headersCandidates = [
  path.join(rootDir, 'public', '_headers'),
  path.join(rootDir, '_headers'),
];
for (const h of headersCandidates) {
  if (fs.existsSync(h)) {
    fs.copyFileSync(h, path.join(distPagesDir, '_headers'));
    break;
  }
}

// Inyectar manifiesto real de chunks code-split y versión actual en dist-pages/sw.js para soporte 100% offline PWA
const distAssetsPath = path.join(distPagesDir, 'assets');
const distSwPath = path.join(distPagesDir, 'sw.js');
if (fs.existsSync(distAssetsPath) && fs.existsSync(distSwPath)) {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const appVersion = String(pkgJson.version || '0.0.0').trim();
  const precacheChunks = fs
    .readdirSync(distAssetsPath)
    .filter((f) => /\.(js|css)$/i.test(f))
    .sort()
    .map((f) => `/assets/${f}`);

  let swCode = fs.readFileSync(distSwPath, 'utf8');
  swCode = swCode
    .replace(
      /const CACHE_NAME = ['"][^'"]+['"];/,
      `const CACHE_NAME = 'cisco-automated-shell-v${appVersion}';`
    )
    .replace(
      /const PRECACHE_CHUNKS = \[\];/,
      `const PRECACHE_CHUNKS = ${JSON.stringify(precacheChunks)};`
    );
  fs.writeFileSync(distSwPath, swCode, 'utf8');
  console.log(`🛡️ [deploy-prep] Inyectados ${precacheChunks.length} chunks en dist-pages/sw.js (cache v${appVersion}) para Modo Offline PWA 100% completo.`);
}

console.log('🎉 [deploy-prep] ¡Preparación de despliegue completada con éxito!');
