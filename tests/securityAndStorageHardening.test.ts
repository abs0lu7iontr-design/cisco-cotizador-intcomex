import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill localStorage for Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

import { buildEdgeCorsHeaders, isAllowedEdgeOrigin } from '../src/utils/edgeCors';
import { verifyTurnstileToken } from '../src/modules/security/turnstileService';
import { optimizeAndMigrateLocalStorage } from '../src/core/storage/modernStorageEngine';
import {
  persistPartnersToStorage,
  hydratePartnersFromIndexedDb,
  loadPartnersFromStorage,
} from '../src/hooks/usePartnerDatabase';
import { exportAllDatabasesSnapshotAsync } from '../src/modules/cloud/databaseBackupManager';

async function runHardeningTests() {
  console.log('🧪 Iniciando Suite: Seguridad Edge + Persistencia Partners/Backups/Storage...\n');

  // 1. Edge CORS Allowlist
  assert.strictEqual(isAllowedEdgeOrigin('https://cisco-automated.pages.dev'), true);
  assert.strictEqual(isAllowedEdgeOrigin('https://develop.cisco-automated.pages.dev'), true);
  assert.strictEqual(isAllowedEdgeOrigin('http://localhost:3000'), true);
  assert.strictEqual(isAllowedEdgeOrigin('http://127.0.0.1:8788'), true);
  assert.strictEqual(isAllowedEdgeOrigin('http://cisco-automated.pages.dev'), false);
  assert.strictEqual(isAllowedEdgeOrigin('https://evil-attacker.com'), false);
  assert.strictEqual(isAllowedEdgeOrigin('https://cisco-automated.pages.dev.evil.com'), false);

  const allowedHeaders = buildEdgeCorsHeaders(
    new Request('https://develop.cisco-automated.pages.dev/api/cisco-proxy', {
      headers: { Origin: 'https://develop.cisco-automated.pages.dev' },
    })
  );
  assert.strictEqual(allowedHeaders['Access-Control-Allow-Origin'], 'https://develop.cisco-automated.pages.dev');

  const blockedHeaders = buildEdgeCorsHeaders(
    new Request('https://develop.cisco-automated.pages.dev/api/cisco-proxy', {
      headers: { Origin: 'https://evil-site.org' },
    })
  );
  assert.strictEqual(blockedHeaders['Access-Control-Allow-Origin'], undefined);
  console.log('  ✅ Allowlist CORS Edge validada.');

  // 2. Turnstile failsafe bypass removed
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 403,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      }) as any;
    const rejected = await verifyTurnstileToken('X'.repeat(40));
    assert.strictEqual(rejected.success, false, 'Un token arbitrario >= 20 chars NO debe aprobar Turnstile');

    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    const networkErr = await verifyTurnstileToken('Y'.repeat(40));
    assert.strictEqual(networkErr.success, false, 'Fallo de red en Turnstile no debe aprobar en blanco');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.strictEqual(
    fs.existsSync(path.resolve(__dirname, '../functions/api/verify.js')),
    false,
    'functions/api/verify.js duplicado debe permanecer eliminado'
  );
  console.log('  ✅ Eliminación de bypass Turnstile y archivo duplicado verify.js verificada.');

  // 3. Partners > 20 KB: persistPartnersToStorage + loadPartnersFromStorage + hydratePartnersFromIndexedDb
  localStorage.clear();
  const largePartnerList = Array.from({ length: 450 }, (_, idx) => ({
    resellerName: `Partner Largo Prueba ${idx} SpA Chile`,
    xclCode: `XCL${String(idx).padStart(5, '0')}`,
    updatedAt: 1795000000000 + idx,
  }));
  persistPartnersToStorage(largePartnerList);
  assert.ok(
    JSON.stringify(largePartnerList).length >= 20_000,
    'El payload de prueba de partners debe superar 20 KB'
  );
  assert.strictEqual(
    localStorage.getItem('cisco_partners_xcl_cache_v1'),
    null,
    'Dataset > 20 KB debe salir de localStorage para proteger cuota'
  );
  // Esperar persistencia asíncrona en IDB/SQLite
  await new Promise((r) => setTimeout(r, 150));

  const syncLoaded = loadPartnersFromStorage();
  assert.strictEqual(syncLoaded.length, 450, 'loadPartnersFromStorage debe conservar partners en memoria');

  const idbHydrated = await hydratePartnersFromIndexedDb();
  assert.strictEqual(idbHydrated.length, 450, 'hydratePartnersFromIndexedDb debe recuperar los 450 partners');

  const asyncBackup = await exportAllDatabasesSnapshotAsync('test_runner');
  assert.strictEqual(
    asyncBackup.stats.partnersXclCount,
    450,
    'Backup maestro asíncrono debe incluir todos los partners aunque no estén en localStorage'
  );
  console.log('  ✅ Persistencia >20 KB de Partners e inclusión en Backup Maestro verificadas.');

  // 4. modernStorageEngine compacta cisco_cloud_estimates_cache_v2 (>40 KB) antes que purga genérica >30 KB
  localStorage.clear();
  const estCache = Array.from({ length: 25 }, (_, i) => ({
    id: `est_${i}`,
    estimateId: `EST_${i}`,
    dealId: `DEAL_${i}`,
    partnerName: `Partner ${i}`,
    clientFinalName: `Client ${i}`,
    createdAt: new Date().toISOString(),
    creator: { username: 'admin', full_name: 'Admin', role: 'admin', email: 'a@b.c' },
    itemsCount: 10,
    items: Array.from({ length: 12 }, (_, j) => ({
      partNumber: `SKU-${i}-${j}`,
      description: 'X'.repeat(180),
      qty: 1,
    })),
  }));
  const estStr = JSON.stringify(estCache);
  assert.ok(estStr.length > 40_000, 'Cache de estimates de prueba debe superar 40 KB');
  localStorage.setItem('cisco_cloud_estimates_cache_v2', estStr);

  const optResult = await optimizeAndMigrateLocalStorage();
  const afterTrimRaw = localStorage.getItem('cisco_cloud_estimates_cache_v2');
  assert.ok(afterTrimRaw !== null, 'La caché compactada de las últimas 15 cabeceras debe permanecer accesible');
  const afterTrim = JSON.parse(afterTrimRaw!);
  assert.strictEqual(afterTrim.length, 15, 'Debe compactarse exactamente a 15 cabeceras');
  assert.ok(
    optResult.clearedKeys.some((k) => k.includes('compactado a 15 registros')),
    'El branch de compactación de estimates debe ser alcanzable'
  );
  console.log('  ✅ Compactación de caché de estimates y orden de migración verificados.');

  console.log('\n🎉 Todas las pruebas de endurecimiento (#1 y #2) pasaron al 100%!');
}

runHardeningTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en hardening tests:', err);
    process.exit(1);
  });
