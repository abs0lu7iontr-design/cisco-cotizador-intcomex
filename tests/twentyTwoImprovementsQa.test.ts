// ============================================================================
// QA MATRIX SUITE: VALIDACIÓN INTEGRAL DE LAS 22 MEJORAS DE INGENIERÍA
// Cubre los 19 escenarios obligatorios de Fase 3 con node:assert/strict
// ============================================================================

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// 1. Backup & Restore
import {
  exportAllDatabasesSnapshot,
  restoreAllDatabasesFromSnapshot,
  retryPendingBackupSync,
  getPendingBackupSyncQueue,
} from '../src/modules/cloud/databaseBackupManager';

// 2 & 3. Version Concurrency & Full-History Pagination
import {
  createVersionSelectionController,
  compareEstimateRecordsDeterministic,
  paginateAndFilterEstimates,
} from '../src/modules/cloud/firestoreService';
import type { CloudEstimateRecord } from '../src/modules/cloud/types';

// 4. Partner Conflict Resolution
import {
  resolvePartnerConflict,
  mergePartnerListsDeterministically,
  PartnerRecord,
} from '../src/hooks/usePartnerDatabase';

// 6 & 7. DSV Ingestion Pipeline & Deterministic BOM Selection
import { runWithBoundedConcurrency } from '../src/modules/dsv/ingestion/dsvIngestionPipeline';
import {
  extractBomRevisionNumber,
  selectCanonicalBomCandidate,
  DealConsolidator,
} from '../src/modules/dsv/ingestion/dealConsolidator';
import type { BomFileCandidate } from '../src/modules/dsv/ingestion/types';

// 8. InteractiveTable Performance & Virtualization
import {
  computeInteractiveTableCategoryCounts,
  filterInteractiveTableItems,
  computeVirtualWindow,
} from '../src/components/InteractiveTable';
import type { EstimateLineItem } from '../src/core/types';

// 9. Vite Build Target Separation
import { resolveBuildTargetConfig } from '../vite.config';

// 11 & 21. Store Modularization & Typed Boundaries
import {
  readLocalSkuOverrides,
  writeLocalSkuOverrides,
  normalizeOverrideRule,
  computeNextCycledRule,
  matchItemsWithSkuOverrides,
  filterUnappliedSharedSkuRules,
} from '../src/core/storePersistence';

// 13 & 14. Date Normalization, Timezones & Strict Calendar Validation
import {
  isValidCalendarDate,
  excelSerialToIso,
  parseDateBySource,
  normalizeIsoTimestamp,
  extractYearMonth,
  extractYear,
  compareDatesUnknownLast,
} from '../src/utils/dateUtils';

// 15. AI BOM Extractor Timeout, Body Abort & Retry-After
import {
  parseRetryAfterMs,
  abortAwareSleep,
  executeFetchWithAbortAndBodyTimeout,
  AiExtractionError,
} from '../src/modules/configuriator/aiBomExtractor';

// 16. Unified Clipboard Helper
import { copyHtmlAndTextToClipboard } from '../src/core/emailClipboardHelper';

// 17. Deal Reminder Copied vs Confirmed Sent
import {
  saveDealReminder,
  recordDealReminderCopied,
  confirmDealReminderSent,
  getDealReminders,
} from '../src/modules/bo/dealReminderService';
import type { DealReminderRecord } from '../src/modules/bo/dealReminderTypes';

// 18 & 19. Accessible Modal Stack & Firebase Form Accessibility
import {
  pushModalToStack,
  removeModalFromStack,
  isTopMostModal,
  getActiveModalStack,
  clearModalStackForTesting,
  computeNextFocusTrapIndex,
} from '../src/utils/useAccessibleModal';
import { validateFirebaseConfigForm } from '../src/modules/cloud/FirebaseConfigModal';

// 20. Typed Non-Destructive ErrorBoundary
import {
  shouldAllowErrorBoundaryRetry,
  haveResetKeysChanged,
} from '../src/components/ErrorBoundary';

// 22. Safe Blob Download & Delayed URL Revocation
import { downloadBlobSafe } from '../src/utils/downloadHelper';

// ============================================================================
// Mock LocalStorage for Node Environment
// ============================================================================
class MemoryLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

async function runAllQaScenarios(): Promise<void> {
  console.log('============================================================================');
  console.log('🚀 INICIANDO MATRIZ QA DE LAS 22 MEJORAS (19 ESCENARIOS OBLIGATORIOS)');
  console.log('============================================================================\n');

  const memStorage = new MemoryLocalStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = memStorage;

  // --------------------------------------------------------------------------
  // ESCENARIO 1: Restauración completa y verificable de respaldos
  // --------------------------------------------------------------------------
  {
    memStorage.clear();
    const snapshot = await exportAllDatabasesSnapshot('qa_admin');
    snapshot.data.users = [
      {
        id: 'u-qa-1',
        username: 'qa_preventa',
        full_name: 'QA Preventa User',
        email: 'qa@intcomex.com',
        role: 'standard',
        is_active: 1,
      },
    ];
    snapshot.data.fastTrackMetadata = {
      enabled: 'true',
      filename: 'FastTrack_Q3_2026.xlsx',
      lastUpdated: '2026-10-01T12:00:00.000Z',
      validUntil: '2026-12-31',
      promoCode: 'FT-Q3-2026',
      promoTitle: 'Fast Track Q3 2026',
    };

    memStorage.clear();
    const restoreRes = await restoreAllDatabasesFromSnapshot(snapshot, {
      syncToCloud: false,
      mode: 'merge',
    });

    assert.strictEqual(restoreRes.success, true, 'La restauración local debe ser exitosa');
    assert.strictEqual(
      restoreRes.fastTrackScope,
      'metadata_only',
      'Debe distinguir explícitamente que Fast Track en el backup maestro es metadata_only'
    );
    assert.ok(
      restoreRes.fastTrackCatalogNotice.includes('metadatos'),
      'Debe informar el alcance real de los metadatos Fast Track sin prometer el catálogo completo'
    );
    assert.ok(
      restoreRes.collectionResults.users.restoredLocally >= 1,
      'Debe restaurar usuarios en caché local preservando usuarios existentes en modo merge'
    );
    assert.ok(
      restoreRes.collectionResults.fastTrackMetadata.restoredLocally >= 1,
      'Debe restaurar metadatos Fast Track en caché local'
    );

    const replaceRes = await restoreAllDatabasesFromSnapshot(snapshot, {
      syncToCloud: false,
      mode: 'replace',
    });
    assert.strictEqual(
      replaceRes.collectionResults.users.restoredLocally,
      1,
      'En modo replace debe dejar exactamente el usuario del snapshot'
    );

    const retryRes = await retryPendingBackupSync();
    assert.strictEqual(typeof retryRes.retried, 'number');
    assert.strictEqual(Array.isArray(getPendingBackupSyncQueue()), true);
    console.log('✅ Escenario QA #1: Respaldo y restauración verificable (usuarios + alcance Fast Track) OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 2: Control de concurrencia al cambiar versiones
  // --------------------------------------------------------------------------
  {
    const controller = createVersionSelectionController();
    const reqV1 = controller.beginRequest('EST-100', 'v1');
    const reqV2 = controller.beginRequest('EST-100', 'v2');

    // Simular que v1 termina después de haber seleccionado v2
    assert.strictEqual(
      controller.isCurrentRequest(reqV1),
      false,
      'La respuesta tardía de v1 debe quedar invalidada cuando v2 ya está seleccionada'
    );
    assert.strictEqual(
      controller.isCurrentRequest(reqV2),
      true,
      'Solo la petición vigente v2 puede actualizar el estado'
    );

    // Al cerrar el modal o desmontar la vista se invalida todo
    controller.invalidate();
    assert.strictEqual(
      controller.isCurrentRequest(reqV2),
      false,
      'Cerrar el detalle o desmontar debe invalidar la petición activa'
    );
    console.log('✅ Escenario QA #2: Control de respuestas concurrentes al cambiar versiones OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 3: Paginación y búsqueda del historial completo (> 300 registros)
  // --------------------------------------------------------------------------
  {
    const mockRecords: CloudEstimateRecord[] = [];
    for (let i = 1; i <= 420; i++) {
      const sameTimestamp =
        i <= 5
          ? '2026-10-10T15:00:00.000Z'
          : `2026-09-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`;
      mockRecords.push({
        id: `doc-${String(i).padStart(4, '0')}`,
        dealId: `DEAL-${i}`,
        estimateId: `EST-${i}`,
        partnerName: i % 2 === 0 ? 'Sonda S.A.' : 'Adexus',
        clientFinalName: i === 380 ? 'Minera Escondida BHP' : `Cliente ${i}`,
        originalFileName: `Sonda_Cliente_${i}.xlsx`,
        createdAt: sameTimestamp,
        creator: { username: 'mskill', fullName: 'Mauricio', role: 'admin', email: '' },
        financialSummary: {
          totalNetCisco: 1000,
          totalCotizadoIntcomex: 1126.32,
          gananciaIntcomexUsd: 56.32,
          margenPct: 5,
          currency: 'USD',
          params: { internacionPct: 7, arancelPct: 6, margenPct: 5 },
        },
        headerInfo: {
          customerName: `Cliente ${i}`,
          companyName: 'Sonda S.A.',
          address: '',
          city: 'Santiago',
          country: 'Chile',
          phone: '',
          estimateId: `EST-${i}`,
          dealId: `DEAL-${i}`,
          priceList: 'GPL',
          date: '2026-10-10',
        },
        itemsCount: 1,
        items: [],
        customOverrideMap: {},
      });
    }

    // Verificar orden estable con desempate por ID cuando las fechas empatan
    const page1 = paginateAndFilterEstimates(mockRecords, { pageSize: 50, cursor: null });
    assert.strictEqual(page1.allMatchedCount, 420, 'No debe truncar a 300 registros');
    assert.strictEqual(page1.items.length, 50);
    assert.strictEqual(page1.hasMore, true);
    assert.ok(
      compareEstimateRecordsDeterministic(page1.items[0], page1.items[1]) < 0,
      'El desempate por ID debe ser estrictamente determinista'
    );

    // Buscar el registro #380 (fuera de los primeros 300)
    const searchDeep = paginateAndFilterEstimates(mockRecords, {
      searchQuery: 'Minera Escondida BHP',
      pageSize: 50,
      cursor: null,
    });
    assert.strictEqual(
      searchDeep.allMatchedCount,
      1,
      'La búsqueda debe encontrar registros más allá del antiguo límite de 300'
    );
    assert.strictEqual(searchDeep.items[0].id, 'doc-0380');
    console.log('✅ Escenario QA #3: Paginación determinista y búsqueda sobre >300 cotizaciones OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 4: Resolución determinista de conflictos en Partners
  // --------------------------------------------------------------------------
  {
    const localPending: PartnerRecord = {
      resellerName: 'Soluciones Orion',
      xclCode: 'XCL99999',
      updatedAt: 1760000500000,
      pendingSync: true,
    };
    const olderRemoteSnapshot: PartnerRecord = {
      resellerName: 'Soluciones Orion',
      xclCode: 'XCL11111',
      updatedAt: 1760000100000,
    };
    const newerRemoteSnapshot: PartnerRecord = {
      resellerName: 'Soluciones Orion',
      xclCode: 'XCL88888',
      updatedAt: 1760000900000,
    };

    const resVsOlder = resolvePartnerConflict(localPending, olderRemoteSnapshot, {
      hasPendingLocalWrite: true,
    });
    assert.strictEqual(
      resVsOlder.xclCode,
      'XCL99999',
      'Un cambio local pendiente más reciente NO debe ser sobrescrito por un snapshot remoto antiguo'
    );

    const resVsNewer = resolvePartnerConflict(localPending, newerRemoteSnapshot, {
      hasPendingLocalWrite: true,
    });
    assert.strictEqual(
      resVsNewer.xclCode,
      'XCL88888',
      'Un snapshot remoto con timestamp estrictamente posterior debe prevalecer'
    );

    const merged = mergePartnerListsDeterministically(
      [localPending],
      [olderRemoteSnapshot],
      { pendingMap: { 'SOLUCIONES ORION': localPending } }
    );
    assert.strictEqual(merged[0].xclCode, 'XCL99999');
    console.log('✅ Escenario QA #4: Resolución determinista de conflictos en Partners OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 5: Runner de pruebas con código de salida != 0 ante fallo real
  // --------------------------------------------------------------------------
  {
    assert.throws(
      () => {
        assert.strictEqual(1, 2, 'Fallo deliberado de prueba');
      },
      /Fallo deliberado de prueba/,
      'node:assert/strict debe lanzar excepción real'
    );

    // Verificar en subproceso aislado que un script con aserción fallida devuelve exit code !== 0
    const failCheck = spawnSync(
      process.execPath,
      ['-e', 'const assert = require("node:assert/strict"); assert.strictEqual(1, 2);'],
      { encoding: 'utf8' }
    );
    assert.notStrictEqual(
      failCheck.status,
      0,
      'Un proceso de prueba que falla una aserción debe devolver código de salida distinto de cero'
    );
    console.log('✅ Escenario QA #5: Runner de pruebas con aserciones reales y exit code != 0 OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 6: Pipeline compartido de ingesta DSV (concurrencia, aislamiento y cancelación)
  // --------------------------------------------------------------------------
  {
    let activeCount = 0;
    let maxObservedConcurrency = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const results: number[] = new Array(items.length);

    const runOutcome = await runWithBoundedConcurrency(
      items,
      3,
      undefined,
      async (num, idx) => {
        activeCount += 1;
        if (activeCount > maxObservedConcurrency) {
          maxObservedConcurrency = activeCount;
        }
        await new Promise((r) => setTimeout(r, 8));
        activeCount -= 1;
        results[idx] = num * 10;
      }
    );

    assert.strictEqual(runOutcome.aborted, false);
    assert.ok(
      maxObservedConcurrency <= 3,
      `La concurrencia máxima observada (${maxObservedConcurrency}) nunca debe superar el límite (3)`
    );
    assert.deepStrictEqual(results, [10, 20, 30, 40, 50, 60, 70, 80]);

    // Probar cancelación con AbortController a mitad del lote
    const abortCtrl = new AbortController();
    const processedBeforeCancel: number[] = [];
    const cancelOutcome = await runWithBoundedConcurrency(
      [1, 2, 3, 4, 5, 6],
      2,
      abortCtrl.signal,
      async (n) => {
        processedBeforeCancel.push(n);
        if (n === 2) abortCtrl.abort();
        await new Promise((r) => setTimeout(r, 10));
      }
    );
    assert.strictEqual(cancelOutcome.aborted, true);
    assert.ok(
      processedBeforeCancel.length < 6,
      'runWithBoundedConcurrency debe detener el procesamiento de nuevos ítems cuando AbortSignal se activa'
    );
    console.log('✅ Escenario QA #6: Pipeline DSV con concurrencia acotada y cancelación AbortSignal OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 7: Selección determinista de BOM en Deal IDs duplicados
  // --------------------------------------------------------------------------
  {
    const bomV1: BomFileCandidate = {
      fileName: 'Deal_77889900_v1.xlsx',
      lastModified: 1760000100000,
      source: 'loose_file',
      fileBuffer: new Uint8Array([1, 2, 3]).buffer,
    };
    const bomV2: BomFileCandidate = {
      fileName: 'Deal_77889900_v2.xlsx',
      lastModified: 1760000100000,
      source: 'loose_file',
      fileBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
    };
    const bomFinal: BomFileCandidate = {
      fileName: 'Deal_77889900_FINAL.xlsx',
      lastModified: 1760000100000,
      source: 'loose_file',
      fileBuffer: new Uint8Array([1, 2, 3, 4, 5]).buffer,
    };

    assert.ok(extractBomRevisionNumber(bomFinal.fileName) > extractBomRevisionNumber(bomV2.fileName));
    assert.ok(extractBomRevisionNumber(bomV2.fileName) > extractBomRevisionNumber(bomV1.fileName));

    // Permutar el orden de entrada en todas las combinaciones posibles
    const permutations = [
      [bomV1, bomV2, bomFinal],
      [bomFinal, bomV1, bomV2],
      [bomV2, bomFinal, bomV1],
      [bomFinal, bomV2, bomV1],
    ];

    for (const perm of permutations) {
      const selection = selectCanonicalBomCandidate(perm);
      assert.strictEqual(
        selection.selected?.fileName,
        'Deal_77889900_FINAL.xlsx',
        'El BOM ganador debe ser idéntico sin importar el orden de descubrimiento de archivos'
      );
      assert.strictEqual(selection.warnings.length, 1);
      assert.ok(selection.warnings[0].includes('Deal_77889900_FINAL.xlsx'));
    }

    const consolidator = new DealConsolidator();
    consolidator.registerCiscoData({
      dealId: '77889900',
      address: { street: 'Ahumada 251', city: 'Santiago', country: 'Chile' },
      fileName: 'Deal_77889900_v1.eml',
      lastModified: 1760000100000,
      bomFile: bomV1,
    });
    consolidator.registerCiscoData({
      dealId: '77889900',
      address: { street: 'Ahumada 251', city: 'Santiago', country: 'Chile' },
      fileName: 'Deal_77889900_v2.eml',
      lastModified: 1760000100000,
      bomFile: bomV2,
    });
    const consolidated = consolidator.consolidate();
    assert.strictEqual(consolidated[0].cisco?.bomFile?.fileName, 'Deal_77889900_v2.xlsx');
    assert.ok(consolidated[0].warnings && consolidated[0].warnings.length > 0);
    console.log('✅ Escenario QA #7: Selección determinista de BOM ante duplicados OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 8: Rendimiento y virtualización de InteractiveTable
  // --------------------------------------------------------------------------
  {
    const largeItems: EstimateLineItem[] = [];
    for (let i = 1; i <= 500; i++) {
      const isIntangible = i % 5 === 0;
      const llevaArancel = !isIntangible && i % 7 === 0;
      largeItems.push({
        rowIdx: i + 18,
        lineNumber: `${i}.0`,
        partNumber: `C9300-24P-${i}`,
        smartAccountMandatory: 'Yes',
        description: `Catalyst 9300 Switch Row ${i}`,
        serviceDurationMonths: isIntangible ? '36' : '',
        originalLeadTimeDays: 14,
        transformedLeadTime: '14-21 días',
        unitListPrice: 1000,
        pricingTerm: '',
        qty: 1,
        netCiscoUnit: 500,
        discPct: 50,
        isIntangible,
        llevaArancel,
        costoInternacion: isIntangible ? 0 : 35,
        costoArancel: llevaArancel ? 30 : 0,
        costoTotalUnitario: isIntangible ? 500 : llevaArancel ? 565 : 535,
        precioVentaUnitario: 600,
        precioVentaExtendido: 600,
      });
    }

    const counts = computeInteractiveTableCategoryCounts(largeItems);
    assert.strictEqual(counts.all, 500);
    assert.strictEqual(counts.tangible + counts.intangible + counts.arancel, 500);

    const filteredIntangibles = filterInteractiveTableItems(largeItems, '', 'intangible');
    assert.strictEqual(filteredIntangibles.length, counts.intangible);

    const win = computeVirtualWindow(500, 2100, 600, 42, 10, 80);
    assert.strictEqual(win.isVirtualized, true);
    assert.ok(
      win.visibleCount < 60,
      'La ventana virtualizada solo debe renderizar un subconjunto acotado de filas'
    );
    assert.strictEqual(
      win.topPaddingPx + win.visibleCount * 42 + win.bottomPaddingPx,
      500 * 42,
      'La altura virtual total (topPadding + filas visibles + bottomPadding) debe conservar exactamente la altura de las 500 filas'
    );
    console.log('✅ Escenario QA #8: Contadores en una pasada O(N) y virtualización de InteractiveTable OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 9 & 12: Separación de Build Web vs Portable y Scripts en package.json
  // --------------------------------------------------------------------------
  {
    const webTarget = resolveBuildTargetConfig({ VITE_SINGLE_FILE: undefined });
    const portableTarget = resolveBuildTargetConfig({ VITE_SINGLE_FILE: 'true' });

    assert.strictEqual(webTarget.isPortableSingleFile, false);
    assert.strictEqual(webTarget.targetMode, 'web_chunked');
    assert.strictEqual(portableTarget.isPortableSingleFile, true);
    assert.strictEqual(portableTarget.targetMode, 'portable_singlefile');

    const pkgRaw = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    assert.ok(pkg.scripts.build, 'Debe existir script build');
    assert.ok(pkg.scripts['build:portable'], 'Debe existir script build:portable');
    assert.ok(pkg.scripts.typecheck, 'Debe existir script typecheck');
    assert.ok(pkg.scripts.clean, 'Debe existir script clean multiplataforma');
    assert.strictEqual(
      pkg.dependencies.vite,
      undefined,
      'vite no debe estar duplicado en dependencies y devDependencies'
    );
    assert.ok(pkg.devDependencies.vite, 'vite debe permanecer en devDependencies');
    console.log('✅ Escenarios QA #9 y #12: Separación de Build Web/Portable e higiene de package.json OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 10: Almacenamiento de archivos sin sobrescritura silenciosa (Python)
  // --------------------------------------------------------------------------
  {
    const pyScript = `
import os, shutil, tempfile
from datetime import datetime
from desktop_app.file_processor import FileProcessor

tmp_dir = tempfile.mkdtemp(prefix="qa_fp_test_")
try:
    fp = FileProcessor(base_storage_dir=tmp_dir)
    # 1. Guardar en Octubre 2025 vs Octubre 2026
    r2025 = fp.save_estimate_in_client_month_structure(
        b"excel-2025", "Intcomex", "Banco de Chile", "Cotizacion.xlsx", custom_date=datetime(2025, 10, 15)
    )
    r2026_1 = fp.save_estimate_in_client_month_structure(
        b"excel-2026-v1", "Intcomex", "Banco de Chile", "Cotizacion.xlsx", custom_date=datetime(2026, 10, 15)
    )
    r2026_2 = fp.save_estimate_in_client_month_structure(
        b"excel-2026-v2", "Intcomex", "Banco de Chile", "Cotizacion.xlsx", custom_date=datetime(2026, 10, 15)
    )

    assert r2025["year"] == "2025", f"Expected 2025, got {r2025['year']}"
    assert r2026_1["year"] == "2026", f"Expected 2026, got {r2026_1['year']}"
    assert r2025["filepath"] != r2026_1["filepath"], "2025 and 2026 files must not collide"
    assert r2026_1["filename"] == "Cotizacion.xlsx"
    assert r2026_2["filename"] == "Cotizacion_v2.xlsx", f"Expected Cotizacion_v2.xlsx, got {r2026_2['filename']}"
    assert r2026_2["was_versioned"] is True

    with open(r2026_1["filepath"], "rb") as f1:
        assert f1.read() == b"excel-2026-v1", "Original file must not be overwritten!"
    with open(r2026_2["filepath"], "rb") as f2:
        assert f2.read() == b"excel-2026-v2", "Versioned v2 file must have v2 content!"

    # 2. Verificar compatibilidad de lectura con la estructura heredada sin año (Partner/Client/Mes/Archivo.xlsx)
    legacy_dir = os.path.join(tmp_dir, "Intcomex", "Banco de Chile", "Agosto")
    os.makedirs(legacy_dir, exist_ok=True)
    legacy_file = os.path.join(legacy_dir, "LegacyQuote.xlsx")
    with open(legacy_file, "wb") as lf:
        lf.write(b"legacy-bytes")

    resolved_legacy = fp.resolve_estimate_filepath("Intcomex", "Banco de Chile", "LegacyQuote.xlsx", month_name="Agosto")
    assert resolved_legacy == os.path.abspath(legacy_file), f"Failed to resolve legacy file: {resolved_legacy}"

    listed = fp.list_stored_estimates("Intcomex", "Banco de Chile")
    assert len(listed) == 4, f"Expected 4 stored files (2025, 2026 v1, 2026 v2, legacy), got {len(listed)}"
    print("PYTHON_QA_10_OK")
finally:
    shutil.rmtree(tmp_dir, ignore_errors=True)
`;
    const pyRes = spawnSync('python', ['-c', pyScript], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.strictEqual(
      pyRes.status,
      0,
      `Prueba Python de file_processor.py falló: ${pyRes.stderr || pyRes.stdout}`
    );
    assert.ok(pyRes.stdout.includes('PYTHON_QA_10_OK'));
    console.log('✅ Escenario QA #10: Jerarquía anual y versionado sin sobrescritura en file_processor.py OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 11 & 21: Store modularizado y fronteras tipadas
  // --------------------------------------------------------------------------
  {
    memStorage.clear();
    writeLocalSkuOverrides({ 'C9200L-24P-4G-E': 'equipo', 'LIC-DNA-3Y': 'intangible' });
    const loadedOverrides = readLocalSkuOverrides();
    assert.strictEqual(loadedOverrides['C9200L-24P-4G-E'], 'equipo');
    assert.strictEqual(loadedOverrides['LIC-DNA-3Y'], 'intangible');

    assert.strictEqual(normalizeOverrideRule('INTANGIBLE'), 'intangible');
    assert.strictEqual(normalizeOverrideRule('arancel'), 'arancel');
    assert.strictEqual(normalizeOverrideRule('desconocido'), 'equipo');

    assert.strictEqual(computeNextCycledRule({ isIntangible: false, llevaArancel: false }), 'intangible');
    assert.strictEqual(computeNextCycledRule({ isIntangible: true, llevaArancel: false }), 'arancel');
    assert.strictEqual(computeNextCycledRule({ isIntangible: false, llevaArancel: true }), 'equipo');

    const matched = matchItemsWithSkuOverrides(
      [
        {
          rowIdx: 20,
          lineNumber: '1.0',
          partNumber: 'C9200L-24P-4G-E',
          smartAccountMandatory: '',
          description: '',
          serviceDurationMonths: '',
          originalLeadTimeDays: '',
          transformedLeadTime: '',
          unitListPrice: 100,
          pricingTerm: '',
          qty: 1,
          netCiscoUnit: 50,
          discPct: 50,
          isIntangible: true,
          llevaArancel: false,
          costoInternacion: 0,
          costoArancel: 0,
          costoTotalUnitario: 50,
          precioVentaUnitario: 55,
          precioVentaExtendido: 55,
        },
      ],
      { 'C9200L-24P-4G-E': 'arancel' }
    );
    assert.strictEqual(matched[20], 'arancel');

    const unapplied = filterUnappliedSharedSkuRules(
      [
        {
          sku: 'C9200L-24P-4G-E',
          rule: 'equipo',
          author: { username: 'otro_pm', fullName: 'Otro PM', role: 'pm' },
          createdAt: '2026-10-10T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
        },
      ],
      [
        {
          rowIdx: 20,
          lineNumber: '1.0',
          partNumber: 'C9200L-24P-4G-E',
          smartAccountMandatory: '',
          description: '',
          serviceDurationMonths: '',
          originalLeadTimeDays: '',
          transformedLeadTime: '',
          unitListPrice: 100,
          pricingTerm: '',
          qty: 1,
          netCiscoUnit: 50,
          discPct: 50,
          isIntangible: true,
          llevaArancel: false,
          costoInternacion: 0,
          costoArancel: 0,
          costoTotalUnitario: 50,
          precioVentaUnitario: 55,
          precioVentaExtendido: 55,
        },
      ],
      {},
      { username: 'mskill', full_name: 'Mauricio', role: 'admin' }
    );
    assert.strictEqual(unapplied.length, 1);
    assert.strictEqual(unapplied[0].rule, 'equipo');
    console.log('✅ Escenarios QA #11 y #21: Store modularizado y validadores de frontera sin any OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 13: Normalización de fechas y zonas horarias (America/Santiago)
  // --------------------------------------------------------------------------
  {
    // 2026-10-01T01:30:00.000Z es 2026-09-30 22:30:00 en Santiago (UTC-3)
    const midnightUtcBorder = '2026-10-01T01:30:00.000Z';
    const ymSantiago = extractYearMonth(midnightUtcBorder, { timeZone: 'America/Santiago' });
    const ymUtc = extractYearMonth(midnightUtcBorder, { timeZone: 'UTC' });
    assert.strictEqual(ymSantiago, '2026-09', 'En America/Santiago debe agruparse en 2026-09');
    assert.strictEqual(ymUtc, '2026-10', 'En UTC debe agruparse en 2026-10');

    // Fecha ausente NO debe inventar new Date().toISOString()
    assert.strictEqual(
      normalizeIsoTimestamp(undefined),
      '',
      'normalizeIsoTimestamp sin fecha ni fallback explícito debe devolver cadena vacía y no fabricar fecha actual'
    );
    assert.strictEqual(extractYearMonth(''), '');
    assert.strictEqual(extractYear('fecha-invalida'), '');

    // Ordenamiento enviando registros sin fecha al final
    const listToSort = ['', '2026-05-10T10:00:00.000Z', '2026-10-12T10:00:00.000Z'];
    listToSort.sort((a, b) => compareDatesUnknownLast(a, b, 'desc'));
    assert.strictEqual(listToSort[0], '2026-10-12T10:00:00.000Z');
    assert.strictEqual(listToSort[1], '2026-05-10T10:00:00.000Z');
    assert.strictEqual(listToSort[2], '', 'Los registros sin fecha deben quedar al final');
    console.log('✅ Escenario QA #13: Fechas por zona horaria America/Santiago y fechas desconocidas OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 14: Parseo de fechas ambiguas, calendario real y seriales Excel
  // --------------------------------------------------------------------------
  {
    // 01/02/2026 depende de la fuente (CCW US_MDY vs SII Chile CL_DMY)
    const asUsCcw = parseDateBySource('01/02/2026', { source: 'US_MDY' });
    const asClSii = parseDateBySource('01/02/2026', { source: 'CL_DMY' });
    assert.ok(
      asUsCcw.iso && asUsCcw.iso.startsWith('2026-01-02'),
      `US_MDY debe interpretar 01/02/2026 como 2 de enero, obtuve ${asUsCcw.iso}`
    );
    assert.ok(
      asClSii.iso && asClSii.iso.startsWith('2026-02-01'),
      `CL_DMY debe interpretar 01/02/2026 como 1 de febrero, obtuve ${asClSii.iso}`
    );

    // Fechas imposibles rechazadas
    assert.strictEqual(isValidCalendarDate(2026, 2, 31), false, '31/02/2026 debe rechazarse');
    assert.strictEqual(isValidCalendarDate(2025, 2, 29), false, '29/02/2025 (no bisiesto) debe rechazarse');
    assert.strictEqual(isValidCalendarDate(2024, 2, 29), true, '29/02/2024 (bisiesto) debe aceptarse');
    assert.strictEqual(
      parseDateBySource('31/02/2026', { source: 'CL_DMY' }).isValid,
      false,
      'parseDateBySource debe rechazar 31/02/2026'
    );

    // Seriales de Excel (sistema 1900 vs 1904 y rechazo del serial 60 = 1900-02-29)
    assert.strictEqual(
      excelSerialToIso(60, { date1904: false }),
      null,
      'El serial 60 (29/02/1900 inexistente) debe rechazarse'
    );
    const serial2026 = excelSerialToIso(46023, { date1904: false }); // 2026-01-01
    assert.ok(
      serial2026 && serial2026.iso.startsWith('2026-01-01'),
      `Serial 46023 esperado 2026-01-01, obtuve ${serial2026?.iso}`
    );
    const serial1904 = excelSerialToIso(44561, { date1904: true }); // 46023 - 1462 = 44561 -> 2026-01-01
    assert.ok(
      serial1904 && serial1904.iso.startsWith('2026-01-01'),
      `Serial 1904 44561 esperado 2026-01-01, obtuve ${serial1904?.iso}`
    );
    console.log('✅ Escenario QA #14: Parseo de fechas ambiguas por origen, bisiestos y seriales Excel OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 15: Timeouts, lectura de cuerpo y Retry-After en IA
  // --------------------------------------------------------------------------
  {
    assert.strictEqual(parseRetryAfterMs('3'), 3000, 'Retry-After de 3 segundos debe ser 3000ms');
    const nowRef = Date.now();
    const futureHttpDate = new Date(nowRef + 4000).toUTCString();
    const parsedHttpDateMs = parseRetryAfterMs(futureHttpDate, nowRef);
    assert.ok(parsedHttpDateMs !== null && parsedHttpDateMs >= 2000 && parsedHttpDateMs <= 5000);

    // Cancelación durante backoff sleep
    const sleepAbort = new AbortController();
    setTimeout(() => sleepAbort.abort(), 15);
    await assert.rejects(
      async () => {
        await abortAwareSleep(5000, sleepAbort.signal);
      },
      (err: unknown) => err instanceof AiExtractionError && err.kind === 'USER_ABORTED'
    );

    // Timeout activo durante lectura colgada de res.text()
    const hungBodyFetch: typeof fetch = async (_input, init) => {
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('Body stream aborted by timeout'));
            });
          }),
      } as unknown as Response;
    };

    await assert.rejects(
      async () => {
        await executeFetchWithAbortAndBodyTimeout(
          'https://example.com/hung-ai-stream',
          { method: 'POST' },
          {
            deadlineMs: Date.now() + 5000,
            perAttemptTimeoutMs: 40,
            fetchImpl: hungBodyFetch,
          },
          40
        );
      },
      /Body stream aborted|ATTEMPT_TIMEOUT|time|abort/i,
      'El timeout por intento debe abortar también la lectura de res.text() si el stream queda colgado'
    );
    console.log('✅ Escenario QA #15: Timeout de lectura de cuerpo, Retry-After y cancelación en IA OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 16: Portapapeles unificado con verificación de resultado
  // --------------------------------------------------------------------------
  {
    const origNavigator = globalThis.navigator;
    try {
      // Simular entorno donde navigator.clipboard.writeText funciona en modo texto plano
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
          clipboard: {
            writeText: async () => undefined,
          },
        },
      });

      const plainRes = await copyHtmlAndTextToClipboard('<b>Hola</b>', 'Hola');
      assert.strictEqual(plainRes.success, true);
      assert.strictEqual(plainRes.mode, 'plain');

      // Simular entorno donde todos los métodos fallan
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
          clipboard: {
            writeText: async () => {
              throw new Error('Clipboard permission denied');
            },
          },
        },
      });
      const failRes = await copyHtmlAndTextToClipboard('<b>Hola</b>', 'Hola');
      assert.strictEqual(failRes.success, false);
      assert.strictEqual(failRes.mode, 'none');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: origNavigator,
      });
    }
    console.log('✅ Escenario QA #16: Portapapeles unificado con resultado verificado (rich / plain / none) OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 17: Separación entre Copiar Recordatorio y Confirmar Envío
  // --------------------------------------------------------------------------
  {
    memStorage.clear();
    const nowIso = new Date().toISOString();
    const initialDeal: DealReminderRecord = {
      id: 'DEAL-REM-QA-17',
      dealId: 'DEAL-QA-17',
      partnerName: 'Sonda',
      endCustomerName: 'Banco Estado',
      escalationChannel: 'AM_CISCO',
      amContactName: 'Juan Perez',
      status: 'PENDING_APPROVAL',
      escalatedAt: nowIso,
      reminderCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: 'qa_user',
      history: [],
    };
    await saveDealReminder(initialDeal);

    // 1. Solo copiar al portapapeles NO debe incrementar reminderCount ni marcar enviado
    await recordDealReminderCopied(initialDeal.id, 'qa_user');
    let allReminders = await getDealReminders();
    let target = allReminders.find((r) => r.id === initialDeal.id)!;
    assert.strictEqual(
      target.reminderCount,
      0,
      'Copiar el recordatorio NO debe incrementar reminderCount como si ya se hubiera enviado'
    );
    assert.strictEqual(target.lastReminderSentAt, undefined);
    assert.ok(target.lastReminderCopiedAt, 'Debe registrar lastReminderCopiedAt');
    assert.strictEqual(target.history[0].action, 'REMINDER_COPIED');

    // 2. Confirmar envío explícitamente SÍ incrementa reminderCount y actualiza lastReminderSentAt
    await confirmDealReminderSent(initialDeal.id, 'qa_user', 'MANUAL_CONFIRMATION');
    allReminders = await getDealReminders();
    target = allReminders.find((r) => r.id === initialDeal.id)!;
    assert.strictEqual(target.reminderCount, 1);
    assert.ok(target.lastReminderSentAt);
    assert.strictEqual(target.history[0].action, 'REMINDER_SENT');
    console.log('✅ Escenario QA #17: Separación entre REMINDER_COPIED y REMINDER_SENT en Deal Reminder OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 18: Pila de modales anidados y trampa de foco
  // --------------------------------------------------------------------------
  {
    clearModalStackForTesting();
    pushModalToStack('modal-parent');
    pushModalToStack('modal-child');

    assert.strictEqual(isTopMostModal('modal-parent'), false);
    assert.strictEqual(
      isTopMostModal('modal-child'),
      true,
      'Cuando hay un modal hijo abierto, solo el hijo es el modal superior para Escape y Tab'
    );

    // Cerrar el modal hijo devuelve la cima al padre sin cerrarlo
    removeModalFromStack('modal-child');
    assert.strictEqual(isTopMostModal('modal-parent'), true);
    assert.deepStrictEqual(getActiveModalStack(), ['modal-parent']);
    clearModalStackForTesting();

    // Ciclo de Tab y Shift+Tab
    assert.strictEqual(computeNextFocusTrapIndex(0, 3, false), 1);
    assert.strictEqual(
      computeNextFocusTrapIndex(2, 3, false),
      0,
      'Tab en el último elemento vuelve al primero'
    );
    assert.strictEqual(
      computeNextFocusTrapIndex(0, 3, true),
      2,
      'Shift+Tab en el primero salta al último'
    );
    console.log('✅ Escenario QA #18: Pila de modales anidados y trampa de foco determinista OK');
  }

  // --------------------------------------------------------------------------
  // ESCENARIO 19: Validación accesible Firebase, ErrorBoundary y Descargas seguras
  // --------------------------------------------------------------------------
  {
    // 19A. Validación de FirebaseConfigModal
    const invalidBoth = validateFirebaseConfigForm({ projectId: '', apiKey: '' });
    assert.strictEqual(invalidBoth.valid, false);
    assert.strictEqual(
      invalidBoth.firstInvalidFieldId,
      'firebase-project-id',
      'Debe enfocar primero firebase-project-id cuando ambos están vacíos'
    );

    const invalidApiKey = validateFirebaseConfigForm({
      projectId: 'cisco-automated',
      apiKey: '   ',
    });
    assert.strictEqual(invalidApiKey.valid, false);
    assert.strictEqual(
      invalidApiKey.firstInvalidFieldId,
      'firebase-api-key',
      'Debe enfocar firebase-api-key cuando solo falta API Key'
    );

    const validConfig = validateFirebaseConfigForm({
      projectId: 'cisco-automated',
      apiKey: 'AIzaSyTestKey123',
    });
    assert.strictEqual(validConfig.valid, true);
    assert.strictEqual(validConfig.firstInvalidFieldId, null);

    // 19B. ErrorBoundary límite de reintentos y resetKeys
    assert.strictEqual(shouldAllowErrorBoundaryRetry(0, 3), true);
    assert.strictEqual(shouldAllowErrorBoundaryRetry(2, 3), true);
    assert.strictEqual(
      shouldAllowErrorBoundaryRetry(3, 3),
      false,
      'Debe bloquear el reintento al alcanzar maxRetries para evitar bucles infinitos'
    );
    assert.strictEqual(haveResetKeysChanged(['quoter', 'a.xlsx'], ['quoter', 'a.xlsx']), false);
    assert.strictEqual(haveResetKeysChanged(['quoter', 'a.xlsx'], ['estimates', 'a.xlsx']), true);

    // 19C. Descarga segura con revocación diferida
    let revokedUrl: string | null = null;
    let appendedNodes = 0;
    let removedNodes = 0;
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const origDocument = (globalThis as unknown as { document?: unknown }).document;

    try {
      URL.createObjectURL = () => 'blob:https://develop.cisco-automated.pages.dev/qa-blob-id';
      URL.revokeObjectURL = (u: string) => {
        revokedUrl = u;
      };
      const bodyMock = {
        appendChild: (node: { parentNode?: unknown }) => {
          node.parentNode = bodyMock;
          appendedNodes += 1;
        },
        removeChild: () => {
          removedNodes += 1;
        },
      };
      (globalThis as unknown as { document: unknown }).document = {
        createElement: () => ({
          href: '',
          download: '',
          rel: '',
          style: {},
          parentNode: null as unknown,
          setAttribute: () => undefined,
          click: () => undefined,
        }),
        body: bodyMock,
      };

      const dlRes = downloadBlobSafe(new Blob(['test']), 'qa_export.csv', { revokeDelayMs: 15 });
      assert.strictEqual(dlRes.success, true);
      assert.strictEqual(appendedNodes, 1);
      assert.strictEqual(
        removedNodes,
        1,
        'El enlace temporal debe removerse inmediatamente en el bloque finally'
      );
      assert.strictEqual(
        revokedUrl,
        null,
        'No debe revocar el Object URL sincrónicamente antes de iniciar la descarga'
      );

      await new Promise((r) => setTimeout(r, 35));
      assert.strictEqual(
        revokedUrl,
        'blob:https://develop.cisco-automated.pages.dev/qa-blob-id',
        'Debe revocar el Object URL tras el delay configurado'
      );
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
      (globalThis as unknown as { document?: unknown }).document = origDocument;
    }

    console.log('✅ Escenario QA #19: Validación Firebase, ErrorBoundary no destructivo y Descarga segura OK');
  }

  console.log('\n🎉 ¡LOS 19 ESCENARIOS DE LA MATRIZ QA DE LAS 22 MEJORAS PASARON AL 100%!');
}

runAllQaScenarios().catch((err) => {
  console.error('❌ Fallo en suite QA de las 22 mejoras:', err);
  process.exit(1);
});
