import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runTests() {
  console.log('🧪 Iniciando Suite #10: Verificación de Code-Splitting y Lazy Loading...\n');

  const viteConfigCode = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
  assert.ok(viteConfigCode.includes("return 'vendor-sqljs'"), 'vite.config.ts debe aislar sql.js en vendor-sqljs');
  assert.ok(viteConfigCode.includes("return 'vendor-genai'"), 'vite.config.ts debe aislar @google/genai en vendor-genai');
  assert.ok(viteConfigCode.includes("return 'vendor-zod'"), 'vite.config.ts debe aislar zod en vendor-zod');
  assert.ok(viteConfigCode.includes('isPortableSingleFile'), 'vite.config.ts debe respetar modo portable_singlefile');
  console.log('  ✅ Reglas de manualChunks en vite.config.ts verificadas.');

  const appCode = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
  const lazyTargets = [
    './components/DashboardView',
    './components/UploadView',
    './components/EstimatesHistoryView',
    './components/SettingsView',
    './components/AuditLogsView',
    './components/QuickCalculator',
    './modules/dsv/DsvView',
    './modules/pipeline/PipelineView',
    './modules/forecast/ForecastView',
    './modules/ccwrQuote/CcwrQuoteView',
    './modules/configuriator/ConfiguriatorView',
    './modules/bo/BoTrackingView',
    './modules/bo/BoRequestModal',
    './components/DownloadModal',
  ];

  for (const modPath of lazyTargets) {
    assert.ok(
      appCode.includes(`import('${modPath}')`),
      `App.tsx debe cargar bajo demanda (React.lazy) el módulo ${modPath}`
    );
  }
  assert.ok(appCode.includes('<Suspense fallback='), 'App.tsx debe envolver vistas/modales lazy en <Suspense>');
  assert.ok(
    appCode.includes("from './core/webAuditLog'"),
    'App.tsx debe importar appendWebAuditLog desde core/webAuditLog para no arrastrar AuditLogsView'
  );
  console.log('  ✅ Vistas y modales lazy + Suspense en App.tsx verificados.');

  const sqliteCode = fs.readFileSync(
    path.join(rootDir, 'src', 'core', 'storage', 'sqliteStorageEngine.ts'),
    'utf8'
  );
  assert.ok(
    !sqliteCode.includes("import initSqlJs from 'sql.js/dist/sql-wasm-inline.js'"),
    'sqliteStorageEngine.ts no debe importar sql-wasm-inline.js estáticamente'
  );
  assert.ok(
    sqliteCode.includes("import('sql.js/dist/sql-wasm-inline.js')"),
    'sqliteStorageEngine.ts debe importar sql-wasm-inline.js de forma diferida'
  );
  console.log('  ✅ Carga diferida de sql-wasm-inline.js verificada.');

  const distAssetsDir = path.join(rootDir, 'dist', 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const entryFiles = fs
      .readdirSync(distAssetsDir)
      .filter((name) => /^index-.*\.js$/.test(name));
    assert.ok(entryFiles.length >= 1, 'Debe existir el chunk principal index-*.js en dist/assets');
    const entrySizeBytes = fs.statSync(path.join(distAssetsDir, entryFiles[0])).size;
    assert.ok(
      entrySizeBytes < 950 * 1024,
      `El chunk principal (${entryFiles[0]}) debe pesar menos de 950 KB (actual: ${(entrySizeBytes / 1024).toFixed(1)} KB)`
    );
    console.log(
      `  ✅ Chunk principal web (${entryFiles[0]}): ${(entrySizeBytes / 1024).toFixed(2)} KB (< 950 KB).`
    );
  }

  console.log('\n🎉 Todas las pruebas de Code-Splitting (#10) pasaron al 100%!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en pruebas #10:', err);
    process.exit(1);
  });
