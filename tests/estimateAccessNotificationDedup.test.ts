// ============================================================================
// CISCO AUTOMATED v2.17.5 - TEST SUITE: DEDUPLICACIÓN DE SOLICITUDES Y NOTIFICACIONES DE PERMISO
// Valida:
// 1. deduplicateAccessRequests elimina duplicados por usuario sin importar mayúsculas/minúsculas
// 2. mergeAndDeduplicateEstimates en useEstimatesMirror no duplica accessRequests al cruzar niveles de storage
// 3. getPendingAccessRequestsForUser retorna estrictamente 1 sola notificación por estimate y usuario
// 4. requestEstimateAccess previene acumulación de solicitudes repetidas
// 5. Auto-curación de registros existentes contaminados con duplicados en disco
// ============================================================================

import {
  deduplicateAccessRequests,
  CloudEstimateRecord,
  EstimateAccessRequest,
} from '../src/modules/cloud/types';
import { getPendingAccessRequestsForUser, getMyAccessResolutionNotices } from '../src/modules/notifications/estimateAccessNotificationService';
import { mergeAndDeduplicateEstimates } from '../src/hooks/useEstimatesMirror';
import { requestEstimateAccess, resolveEstimateAccessRequest } from '../src/modules/cloud/firestoreService';

// Mock localStorage if in Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

async function runSuite() {
  console.log('🧪 Iniciando Suite: Deduplicación de Solicitudes y Notificaciones de Acceso (v2.17.5)...');

  // --------------------------------------------------------------------------
  // Test 1: Función deduplicateAccessRequests
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 1: deduplicateAccessRequests purga duplicados idénticos o con diferente mayúscula/minúscula');
  const dirtyRequests: EstimateAccessRequest[] = [
    {
      username: 'lburgos',
      fullName: 'Luis Burgos',
      role: 'preventa',
      requestedAt: '2026-11-18T18:00:00Z',
      status: 'pending',
    },
    {
      username: 'LBURGOS',
      fullName: 'Luis Burgos',
      role: 'preventa',
      requestedAt: '2026-11-18T18:05:00Z',
      status: 'pending',
    },
    {
      username: 'andres_pm',
      fullName: 'Andres PM',
      role: 'pm',
      requestedAt: '2026-11-18T17:00:00Z',
      status: 'rejected',
    },
  ];

  const deduplicated = deduplicateAccessRequests(dirtyRequests);
  if (deduplicated.length !== 2) {
    throw new Error(`Test 1 Falló: Esperaba 2 usuarios distintos, pero obtuvo ${deduplicated.length}`);
  }
  const lburgosReq = deduplicated.find((r) => r.username.toLowerCase() === 'lburgos');
  if (!lburgosReq || lburgosReq.requestedAt !== '2026-11-18T18:05:00Z') {
    throw new Error('Test 1 Falló: No preservó la solicitud más reciente de lburgos.');
  }
  console.log('  ✅ deduplicateAccessRequests purga duplicados y conserva la solicitud más reciente.');

  // --------------------------------------------------------------------------
  // Test 2: Cruce de storage tiers en mergeAndDeduplicateEstimates (Caso del Bug Reportado)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Fusión de niveles de almacenamiento en mergeAndDeduplicateEstimates no multiplica solicitudes');
  const baseEstimate: CloudEstimateRecord = {
    id: 'est_0616968297423',
    dealId: 'DEAL-999',
    estimateId: '0616968297423',
    partnerName: 'Zimac',
    clientFinalName: 'mineroelcielo',
    originalFileName: 'Estimate_0616968297423.xlsx',
    createdAt: '2026-11-18T12:00:00Z',
    creator: {
      username: 'mskill',
      fullName: 'Mauricio Skill',
      role: 'admin',
    },
    isRestricted: true,
    allowedUsers: ['mskill'],
    accessRequests: [
      {
        username: 'lburgos',
        fullName: 'Luis Burgos',
        role: 'pm',
        requestedAt: '2026-11-18T15:00:00Z',
        status: 'pending',
      },
    ],
    itemsCount: 0,
    items: [],
    customOverrideMap: {},
    financialSummary: {
      totalNetCisco: 10000,
      totalCotizadoIntcomex: 11000,
      gananciaIntcomexUsd: 1000,
      margenPct: 5,
      currency: 'USD',
      params: { internacionPct: 7, arancelPct: 6, margenPct: 5 },
    },
    headerInfo: {
      customerName: 'mineroelcielo',
      companyName: 'Zimac',
      address: '',
      city: 'Santiago',
      country: 'Chile',
      phone: '',
      estimateId: '0616968297423',
      dealId: 'DEAL-999',
      priceList: 'Global Price List',
      date: '2026-11-18',
    },
  };

  // Simula el estimate presente en IndexedDB Tier 1, Primary Cache y Vault
  const idbTierRecord = { ...baseEstimate };
  const primaryCacheRecord = { ...baseEstimate, updatedAt: '2026-11-18T15:01:00Z' };
  const vaultRecord = { ...baseEstimate, updatedAt: '2026-11-18T15:02:00Z' };

  const mergedList = mergeAndDeduplicateEstimates([idbTierRecord, primaryCacheRecord, vaultRecord]);
  if (mergedList.length !== 1) {
    throw new Error(`Test 2 Falló: Esperaba 1 estimate único, pero obtuvo ${mergedList.length}`);
  }
  const mergedEstimate = mergedList[0];
  if ((mergedEstimate.accessRequests || []).length !== 1) {
    throw new Error(
      `Test 2 Falló: Esperaba exactamente 1 accessRequest para Luis Burgos, pero obtuvo ${
        (mergedEstimate.accessRequests || []).length
      }. (Bug de duplicación por fusión de tiers detectado)`
    );
  }
  console.log('  ✅ mergeAndDeduplicateEstimates fusiona múltiples tiers locales manteniendo exactamente 1 solicitud.');

  // --------------------------------------------------------------------------
  // Test 3: getPendingAccessRequestsForUser genera estrictamente 1 notificación
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: getPendingAccessRequestsForUser devuelve 1 sola notificación para el creador');
  // Incluso si el array tuviese datos corruptos con dos requests de lburgos para el estimate 0616968297423
  const corruptedEstimate: CloudEstimateRecord = {
    ...baseEstimate,
    accessRequests: [
      {
        username: 'lburgos',
        fullName: 'Luis Burgos',
        role: 'pm',
        requestedAt: '2026-11-18T15:00:00Z',
        status: 'pending',
      },
      {
        username: 'lburgos',
        fullName: 'Luis Burgos',
        role: 'pm',
        requestedAt: '2026-11-18T15:00:00Z',
        status: 'pending',
      },
    ],
  };

  const notifications = getPendingAccessRequestsForUser([corruptedEstimate], 'mskill');
  if (notifications.length !== 1) {
    throw new Error(
      `Test 3 Falló: El creador vio ${notifications.length} notificaciones del mismo estimate. Debe ser exactamente 1.`
    );
  }
  if (notifications[0].requesterUsername !== 'lburgos' || notifications[0].estimateId !== '0616968297423') {
    throw new Error('Test 3 Falló: Metadatos de la notificación incorrectos.');
  }
  console.log('  ✅ getPendingAccessRequestsForUser emite estrictamente 1 notificación única por estimate y solicitante.');

  // --------------------------------------------------------------------------
  // Test 4: requestEstimateAccess previene duplicación ante múltiples solicitudes consecutivas
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: requestEstimateAccess garantiza unicidad de la solicitud en caché');
  const reqRes1 = await requestEstimateAccess('est_0616968297423', '0616968297423', {
    username: 'lburgos',
    fullName: 'Luis Burgos',
    role: 'pm',
  });
  if (!reqRes1.success) {
    throw new Error(`Test 4 Falló en primera solicitud: ${reqRes1.error}`);
  }

  // Segunda solicitud inmediata (doble clic)
  const reqRes2 = await requestEstimateAccess('est_0616968297423', '0616968297423', {
    username: 'lburgos',
    fullName: 'Luis Burgos',
    role: 'pm',
  });
  if (!reqRes2.success) {
    throw new Error(`Test 4 Falló en segunda solicitud: ${reqRes2.error}`);
  }

  const updatedRequests = reqRes2.updatedRequests || [];
  const lburgosMatches = updatedRequests.filter((r) => r.username.toLowerCase() === 'lburgos');
  if (lburgosMatches.length !== 1) {
    throw new Error(
      `Test 4 Falló: Tras doble solicitud, existen ${lburgosMatches.length} entradas para lburgos. Debe haber solo 1.`
    );
  }
  console.log('  ✅ requestEstimateAccess evita acumulación y preserva unicidad ante solicitudes repetidas.');

  // --------------------------------------------------------------------------
  // Test 5: Aprobación y Resolución Limpia
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: resolveEstimateAccessRequest resuelve de forma determinista sin duplicar');
  const resolveRes = await resolveEstimateAccessRequest(
    'est_0616968297423',
    '0616968297423',
    'lburgos',
    true,
    'mskill'
  );
  if (!resolveRes.success) {
    throw new Error(`Test 5 Falló en resolución: ${resolveRes.error}`);
  }
  const resolvedList = resolveRes.accessRequests || [];
  const lburgosResolved = resolvedList.filter((r) => r.username.toLowerCase() === 'lburgos');
  if (lburgosResolved.length !== 1 || lburgosResolved[0].status !== 'approved') {
    throw new Error('Test 5 Falló: La solicitud resuelta no quedó en approved o está duplicada.');
  }
  console.log('  ✅ resolveEstimateAccessRequest aprueba el permiso y conserva el registro único saneado.');

  console.log('\n🏆 Todas las pruebas de deduplicación de solicitudes y notificaciones pasaron al 100%.\n');
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('\n❌ ERROR EN SUITE:', err);
  process.exit(1);
});
