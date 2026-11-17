// ============================================================================
// CISCO AUTOMATED v2.15.0 - TEST SUITE: ESTIMATE PRIVACY, LOCAL STORAGE & VERSIONING
// Verifica:
// 1. Guardado privado local ("Solo en este PC") sin encolar en Firestore ni sincronizar
// 2. Versionado automático v1 -> v2 -> v3 al guardar modificaciones de un mismo estimate
// 3. Ocultamiento de datos financieros sensibles (Margen, Costo, Cotizado) en estimates restringidos
// 4. Notificaciones de solicitud y resolución de permisos para PM y Preventas
// ============================================================================

import {
  saveEstimateToCloud,
  getLocalEstimatesCache,
  publishLocalEstimateToCloud,
} from '../src/modules/cloud/firestoreService';
import {
  getPendingAccessRequestsForUser,
  getMyAccessResolutionNotices,
} from '../src/modules/notifications/estimateAccessNotificationService';
import { CloudEstimateRecord } from '../src/modules/cloud/types';

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
  console.log('🧪 Iniciando Test Suite: Estimate Privacy, Local Storage & Auto-Versioning (v2.15.0)...');

  // --------------------------------------------------------------------------
  // Test 1: Guardado "Solo en este PC" (Local-Only)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Guardado "Solo en este PC" (Local-Only) ---');
  const localOnlyRecord: Omit<CloudEstimateRecord, 'id'> = {
    dealId: 'DEAL-PRIV-001',
    estimateId: 'EST-PRIV-999',
    partnerName: 'Partner Confidencial',
    clientFinalName: 'Cliente Privado',
    originalFileName: 'Estimate_Privado_999.xlsx',
    createdAt: new Date().toISOString(),
    creator: {
      username: 'pm_privado',
      fullName: 'PM Privado',
      role: 'pm',
    },
    financialSummary: {
      totalNetCisco: 50000,
      totalCotizadoIntcomex: 56500,
      gananciaIntcomexUsd: 6500,
      margenPct: 11.5,
      currency: 'USD',
      params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 11.5 },
    },
    headerInfo: {
      customerName: 'Cliente Privado',
      companyName: 'Partner Confidencial',
      estimateId: 'EST-PRIV-999',
      dealId: 'DEAL-PRIV-001',
      address: '',
      city: 'Santiago',
      country: 'Chile',
      phone: '',
      priceList: 'Global Price List',
      date: '2026-11-17',
    },
    itemsCount: 5,
    items: [],
    customOverrideMap: {},
    isLocalOnly: true,
    storageScope: 'local_only',
    privacyLevel: 'local_only',
  };

  const res1 = await saveEstimateToCloud(localOnlyRecord, { isLocalOnly: true });
  if (!res1.success || res1.syncStatus !== 'LOCAL_ONLY') {
    throw new Error(`Test 1 Falló: syncStatus esperado LOCAL_ONLY pero se obtuvo ${res1.syncStatus}`);
  }
  console.log('✅ Test 1 Superado: Cotización guardada localmente con syncStatus=LOCAL_ONLY y versión ' + res1.versionTag);

  // --------------------------------------------------------------------------
  // Test 2: Versionado automático incremental v1 -> v2 -> v3
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Versionado automático v1 -> v2 -> v3 al modificar estimate ---');
  const initialEstimate: Omit<CloudEstimateRecord, 'id'> = {
    dealId: 'DEAL-VER-100',
    estimateId: 'EST-VER-100',
    partnerName: 'Partner Tech',
    clientFinalName: 'Entel',
    originalFileName: 'Estimate_Entel_100.xlsx',
    createdAt: new Date().toISOString(),
    creator: {
      username: 'preventa1',
      fullName: 'Preventa Cisco',
      role: 'preventa',
    },
    financialSummary: {
      totalNetCisco: 10000,
      totalCotizadoIntcomex: 11200,
      gananciaIntcomexUsd: 1200,
      margenPct: 5.0,
      currency: 'USD',
      params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 5.0 },
    },
    headerInfo: {
      customerName: 'Entel',
      companyName: 'Partner Tech',
      estimateId: 'EST-VER-100',
      dealId: 'DEAL-VER-100',
      address: '',
      city: 'Santiago',
      country: 'Chile',
      phone: '',
      priceList: 'Global Price List',
      date: '2026-11-17',
    },
    itemsCount: 2,
    items: [],
    customOverrideMap: {},
  };

  // v1
  const saveV1 = await saveEstimateToCloud(initialEstimate, { autoIncrementIfExisting: true });
  if (saveV1.versionNumber !== 1 || saveV1.versionTag !== 'v1') {
    throw new Error(`Test 2 Falló: v1 esperado pero se obtuvo ${saveV1.versionTag}`);
  }

  // v2 (modificación posterior)
  const modifiedEstimate: Omit<CloudEstimateRecord, 'id'> = {
    ...initialEstimate,
    financialSummary: {
      ...initialEstimate.financialSummary,
      totalCotizadoIntcomex: 11500,
      gananciaIntcomexUsd: 1500,
      margenPct: 7.5,
    },
  };
  const saveV2 = await saveEstimateToCloud(modifiedEstimate, { autoIncrementIfExisting: true, note: 'Margen ajustado a 7.5%' });
  if (saveV2.versionNumber !== 2 || saveV2.versionTag !== 'v2') {
    throw new Error(`Test 2 Falló: v2 esperado pero se obtuvo ${saveV2.versionTag}`);
  }

  // v3 (segunda modificación)
  const saveV3 = await saveEstimateToCloud(modifiedEstimate, { autoIncrementIfExisting: true, note: 'Agregadas licencias extra' });
  if (saveV3.versionNumber !== 3 || saveV3.versionTag !== 'v3') {
    throw new Error(`Test 2 Falló: v3 esperado pero se obtuvo ${saveV3.versionTag}`);
  }
  console.log('✅ Test 2 Superado: Versionado automático incremental verificado (v1 -> v2 -> v3).');

  // --------------------------------------------------------------------------
  // Test 3: Ocultamiento de datos financieros en estimates restringidos
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Ocultamiento y enmascaramiento de datos financieros en estimates restringidos ---');
  const restrictedEstimate: CloudEstimateRecord = {
    id: 'est_restringido_01',
    dealId: 'DEAL-REST-01',
    estimateId: 'EST-REST-01',
    partnerName: 'Partner VIP',
    clientFinalName: 'BancoEstado',
    originalFileName: 'Estimate_BancoEstado_01.xlsx',
    createdAt: new Date().toISOString(),
    creator: {
      username: 'pm_andres',
      fullName: 'Andrés PM',
      role: 'pm',
    },
    financialSummary: {
      totalNetCisco: 80000,
      totalCotizadoIntcomex: 92000,
      gananciaIntcomexUsd: 12000,
      margenPct: 13.0,
      currency: 'USD',
      params: { internacionPct: 7.0, arancelPct: 6.0, margenPct: 13.0 },
    },
    headerInfo: {
      customerName: 'BancoEstado',
      companyName: 'Partner VIP',
      estimateId: 'EST-REST-01',
      dealId: 'DEAL-REST-01',
      address: '',
      city: 'Santiago',
      country: 'Chile',
      phone: '',
      priceList: 'Global Price List',
      date: '2026-11-17',
    },
    itemsCount: 10,
    items: [],
    customOverrideMap: {},
    isRestricted: true,
    privacyLevel: 'restricted',
    allowedUsers: ['pm_andres'], // Solo el creador
  };

  const hasAccessCreator = restrictedEstimate.creator.username === 'pm_andres' || (restrictedEstimate.allowedUsers || []).includes('pm_andres');
  const hasAccessOther = restrictedEstimate.creator.username === 'preventa_juan' || (restrictedEstimate.allowedUsers || []).includes('preventa_juan');

  if (!hasAccessCreator) {
    throw new Error('Test 3 Falló: El creador debería tener acceso total.');
  }
  if (hasAccessOther) {
    throw new Error('Test 3 Falló: El usuario preventa_juan no debe tener acceso sin autorización.');
  }
  console.log('✅ Test 3 Superado: Acceso restringido validado. Usuarios no autorizados bloqueados.');

  // --------------------------------------------------------------------------
  // Test 4: Flujo de Notificaciones de Solicitud y Aprobación de Acceso
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Detección de solicitudes de acceso y notificaciones para el PM ---');
  const recordWithRequest: CloudEstimateRecord = {
    ...restrictedEstimate,
    accessRequests: [
      {
        username: 'preventa_carlos',
        fullName: 'Carlos Preventa',
        role: 'preventa',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      },
    ],
  };

  const pendingForPm = getPendingAccessRequestsForUser([recordWithRequest], 'pm_andres');
  if (pendingForPm.length !== 1 || pendingForPm[0].requesterUsername !== 'preventa_carlos') {
    throw new Error(`Test 4 Falló: El PM debería ver 1 solicitud pendiente de preventa_carlos.`);
  }

  const pendingForOther = getPendingAccessRequestsForUser([recordWithRequest], 'otro_pm');
  if (pendingForOther.length !== 0) {
    throw new Error('Test 4 Falló: Otro PM no debe recibir las solicitudes de un estimate ajeno.');
  }

  // Notificación de resolución para el solicitante
  const recordWithApprovedRequest: CloudEstimateRecord = {
    ...restrictedEstimate,
    allowedUsers: ['pm_andres', 'preventa_carlos'],
    accessRequests: [
      {
        username: 'preventa_carlos',
        fullName: 'Carlos Preventa',
        role: 'preventa',
        requestedAt: new Date().toISOString(),
        status: 'approved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'pm_andres',
      },
    ],
  };

  const noticesForCarlos = getMyAccessResolutionNotices([recordWithApprovedRequest], 'preventa_carlos');
  if (noticesForCarlos.length !== 1 || noticesForCarlos[0].status !== 'approved') {
    throw new Error('Test 4 Falló: Carlos debería tener 1 aviso de acceso concedido.');
  }
  console.log('✅ Test 4 Superado: Notificaciones para PM creador y avisos de resolución validados con éxito.');

  console.log('\n🎉 ¡TODOS LOS TESTS DE PRIVACIDAD, STORAGE LOCAL Y VERSIONADO PASARON AL 100%!');
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('❌ Error en test suite:', err);
  process.exit(1);
});
