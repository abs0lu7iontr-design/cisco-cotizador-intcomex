import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Unified Toast, Offline Conflict Resolution & PWA Service Worker Suite', () => {
  // =========================================================================
  // 1. Unified Toast System Verification
  // =========================================================================
  it('1. ToastContext file exists and exports required hooks, providers and global dispatcher', async () => {
    const toastContextPath = path.join(rootDir, 'src', 'context', 'ToastContext.tsx');
    assert.ok(fs.existsSync(toastContextPath), 'ToastContext.tsx must exist');

    const content = fs.readFileSync(toastContextPath, 'utf8');
    assert.ok(content.includes('ToastProvider'), 'ToastProvider must be exported');
    assert.ok(content.includes('useToast'), 'useToast must be exported');
    assert.ok(content.includes('triggerGlobalToast'), 'triggerGlobalToast must be exported');
    assert.ok(content.includes('cisco-toast'), 'Must listen to cisco-toast custom event');
    assert.ok(content.includes('success') && content.includes('error') && content.includes('warning') && content.includes('info'));
  });

  it('2. App.tsx wraps the component tree with ToastProvider', () => {
    const appPath = path.join(rootDir, 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('ToastProvider'), 'App.tsx must import and wrap ToastProvider');
  });

  it('3. Views consume useToast hook instead of maintaining duplicate local toast divs', () => {
    const dashboardContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'DashboardView.tsx'), 'utf8');
    assert.ok(dashboardContent.includes('useToast()'), 'DashboardView must consume useToast');

    const estimatesContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'EstimatesHistoryView.tsx'), 'utf8');
    assert.ok(estimatesContent.includes('useToast()'), 'EstimatesHistoryView must consume useToast');

    const interactiveTableContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'InteractiveTable.tsx'), 'utf8');
    assert.ok(interactiveTableContent.includes('useToast()'), 'InteractiveTable must consume useToast');
  });

  // =========================================================================
  // 2. Offline Concurrency & Conflict Detection Verification
  // =========================================================================
  it('4. offlineConflictDetector exports detection and 3-way resolution functions', async () => {
    const conflictDetectorPath = path.join(rootDir, 'src', 'core', 'storage', 'offlineConflictDetector.ts');
    assert.ok(fs.existsSync(conflictDetectorPath), 'offlineConflictDetector.ts must exist');

    const content = fs.readFileSync(conflictDetectorPath, 'utf8');
    assert.ok(content.includes('checkItemConflict'), 'Must export checkItemConflict');
    assert.ok(content.includes('detectAllOfflineConflicts'), 'Must export detectAllOfflineConflicts');
    assert.ok(content.includes('resolveOfflineConflict'), 'Must export resolveOfflineConflict');
    assert.ok(content.includes('keep_cloud'), 'Must support keep_cloud mode');
    assert.ok(content.includes('overwrite_local'), 'Must support overwrite_local mode');
    assert.ok(content.includes('fork_version'), 'Must support fork_version mode');
  });

  it('5. OfflineConflictModal renders side-by-side comparison with resolution actions', () => {
    const modalPath = path.join(rootDir, 'src', 'components', 'OfflineConflictModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'OfflineConflictModal.tsx must exist');

    const content = fs.readFileSync(modalPath, 'utf8');
    assert.ok(content.includes('Versión en la Nube (Remota)'), 'Must show cloud remote version');
    assert.ok(content.includes('Tu Versión Local (Offline)'), 'Must show local offline version');
    assert.ok(content.includes('Bifurcar Versión'), 'Must offer fork version button');
    assert.ok(content.includes('Sobrescribir Nube'), 'Must offer overwrite button');
    assert.ok(content.includes('Conservar Nube'), 'Must offer keep cloud button');
  });

  it('6. OfflineSyncModal performs proactive conflict detection prior to cloud upload', () => {
    const syncModalPath = path.join(rootDir, 'src', 'components', 'OfflineSyncModal.tsx');
    const content = fs.readFileSync(syncModalPath, 'utf8');
    assert.ok(content.includes('detectAllOfflineConflicts'), 'OfflineSyncModal must call detectAllOfflineConflicts');
    assert.ok(content.includes('OfflineConflictModal'), 'OfflineSyncModal must embed OfflineConflictModal');
  });

  // =========================================================================
  // 3. PWA Service Worker & Shell Caching Verification
  // =========================================================================
  it('7. public/sw.js exists and implements Cache-First and Navigation Fallback strategies', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');

    const content = fs.readFileSync(swPath, 'utf8');
    assert.ok(content.includes('cisco-automated-shell-'), 'Must declare versioned cache name');
    assert.ok(content.includes('PRECACHE_ASSETS'), 'Must define precache assets');
    assert.ok(content.includes('navigate'), 'Must handle navigate requests with offline fallback');
    assert.ok(content.includes('firestore.googleapis.com'), 'Must exclude cloud APIs from offline shell cache');
    assert.ok(content.includes('stale-while-revalidate') || content.includes('caches.match'), 'Must implement caching for assets');
  });

  it('8. serviceWorkerManager.ts manages registration and PWA installation prompt', () => {
    const swManagerPath = path.join(rootDir, 'src', 'core', 'serviceWorkerManager.ts');
    assert.ok(fs.existsSync(swManagerPath), 'serviceWorkerManager.ts must exist');

    const content = fs.readFileSync(swManagerPath, 'utf8');
    assert.ok(content.includes('registerServiceWorker'), 'Must export registerServiceWorker');
    assert.ok(content.includes('canInstallPwa'), 'Must export canInstallPwa');
    assert.ok(content.includes('promptPwaInstall'), 'Must export promptPwaInstall');
    assert.ok(content.includes('beforeinstallprompt'), 'Must listen to beforeinstallprompt');
  });

  it('9. main.tsx invokes registerServiceWorker and index.html includes complete PWA meta tags', () => {
    const mainPath = path.join(rootDir, 'src', 'main.tsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    assert.ok(mainContent.includes('registerServiceWorker()'), 'main.tsx must invoke registerServiceWorker');

    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('manifest.json'), 'index.html must reference manifest.json');
    assert.ok(indexContent.includes('mobile-web-app-capable'), 'index.html must specify mobile-web-app-capable');
    assert.ok(indexContent.includes('apple-mobile-web-app-capable'), 'index.html must specify apple-mobile-web-app-capable');
  });

  it('10. prepare_deploy.js synchronizes sw.js and PWA assets to dist-pages', () => {
    const deployPrepPath = path.join(rootDir, 'scripts', 'prepare_deploy.js');
    const content = fs.readFileSync(deployPrepPath, 'utf8');
    assert.ok(content.includes('sw.js'), 'prepare_deploy.js must copy sw.js to dist-pages');
    assert.ok(content.includes('manifest.json'), 'prepare_deploy.js must copy manifest.json to dist-pages');
  });
});
