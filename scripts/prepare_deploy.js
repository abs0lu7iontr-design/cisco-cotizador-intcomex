import fs from 'fs';
import path from 'path';
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
console.log(`✅ [deploy-prep] Bundle portable compilado: ${(portableBundleBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

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
    // Sincronizar assets estáticos de branding ligero (Halloween y Navidad)
    for (const logo of ['logo-navidad-nieve.gif', 'logo-halloween-animado.gif']) {
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

// Añadir el bundle portable compilado a dist-pages como desktop_build.html
const cdnDesktopBundlePath = path.join(distPagesDir, 'desktop_build.html');
fs.writeFileSync(cdnDesktopBundlePath, portableBundleBuffer);
console.log(`🚀 [deploy-prep] Inyectado en CDN Cloudflare: desktop_build.html (${(portableBundleBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

// Asegurar headers y version.json
const versionSrc = path.join(rootDir, 'public', 'version.json');
if (fs.existsSync(versionSrc)) {
  fs.copyFileSync(versionSrc, path.join(distPagesDir, 'version.json'));
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

console.log('🎉 [deploy-prep] ¡Preparación de despliegue completada con éxito!');
