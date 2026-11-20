// ============================================================================
// CISCO AUTOMATED v2.24.0 - INSTANT LOGIN STARTUP OPTIMIZATION SUITE
// Verifies zero startup delay, isolation of unauthenticated mounts,
// O(1) mirror snapshot checks, and non-blocking PWA registration
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Instant Login Startup Optimization Suite (Anti-Lag / Zero Delay)', () => {
  it('1. App.tsx isolates AuthenticatedApp and renders LoginScreen directly on cold start', () => {
    const appPath = path.join(rootDir, 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('function AuthenticatedApp()'), 'App.tsx must define AuthenticatedApp');
    assert.ok(content.includes('function AppContent()'), 'App.tsx must define AppContent gateway');
    assert.ok(
      content.includes('if (!currentUser)') && content.includes('<LoginScreen onLoginSuccess='),
      'AppContent must return LoginScreen immediately when !currentUser'
    );
    assert.ok(
      content.includes('<AuthenticatedApp />'),
      'AppContent must only mount AuthenticatedApp once currentUser exists'
    );
  });

  it('2. useEstimatesMirror implements O(1) fingerprint check avoiding multi-megabyte string churn', () => {
    const mirrorPath = path.join(rootDir, 'src', 'hooks', 'useEstimatesMirror.ts');
    const content = fs.readFileSync(mirrorPath, 'utf8');

    assert.ok(
      content.includes('currentFingerprint'),
      'useEstimatesMirror must use currentFingerprint to avoid 10-20 MB string concatenations'
    );
    assert.ok(
      content.includes('rawPrimary.length'),
      'Fingerprint must evaluate lengths rather than full raw strings'
    );
  });

  it('3. main.tsx defers Service Worker registration via requestIdleCallback to free main thread', () => {
    const mainPath = path.join(rootDir, 'src', 'main.tsx');
    const content = fs.readFileSync(mainPath, 'utf8');

    assert.ok(
      content.includes('requestIdleCallback') || content.includes('setTimeout'),
      'main.tsx must register service worker in idle/deferred callback'
    );
    assert.ok(
      content.includes('registerServiceWorker()'),
      'main.tsx must invoke registerServiceWorker'
    );
  });

  it('4. index.html does not contain render-blocking external scripts in head', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert.ok(
      !content.includes('challenges.cloudflare.com/turnstile'),
      'index.html head must not contain remote turnstile script tag'
    );
  });

  it('5. brandingLogos.ts uses lightweight static assets and eliminates 3 MB base64 overhead', () => {
    const brandingPath = path.join(rootDir, 'src', 'core', 'brandingLogos.ts');
    const content = fs.readFileSync(brandingPath, 'utf8');

    assert.ok(
      content.length < 10000,
      `brandingLogos.ts must be lightweight (< 10 KB), but got ${content.length} bytes`
    );
    assert.ok(content.includes('getSeasonalLoginLogo'), 'Must export getSeasonalLoginLogo');
    assert.ok(content.includes('CISCO_AUTOMATED_SEAL_DATA_URI'), 'Must export CISCO_AUTOMATED_SEAL_DATA_URI');
  });

  it('6. checkGeoLocation in twoFactorService includes timeout signal to prevent hanging requests', () => {
    const twoFactorPath = path.join(rootDir, 'src', 'modules', 'security', 'twoFactorService.ts');
    const content = fs.readFileSync(twoFactorPath, 'utf8');

    assert.ok(
      content.includes('AbortSignal.timeout'),
      'twoFactorService must protect geolocation fetch with AbortSignal.timeout'
    );
  });
});
