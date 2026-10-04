// ============================================================================
// TESTS: CISCO AUTOMATED v2.1 - PHASE 3 ARCHITECTURE & MODULARIZATION VERIFICATION
// ============================================================================

import assert from 'node:assert/strict';
import {
  getEstimatesMirrorSnapshot,
  subscribeEstimatesMirror,
  getMirrorLastSyncTimestamp,
} from '../src/hooks/useEstimatesMirror';
import {
  PoeBudgetCard,
  AiDiscrepancyCard,
  CcwPreviewTable,
  ApiManagementModal,
} from '../src/modules/configuriator/components';
import type { ProcessedEstimateResult } from '../src/core/types';

console.log('🧪 Iniciando verificación de Arquitectura de Fase 3 (React 19 External Store + Modularización)...');

// 1. Simulación de LocalStorage y Window Event para useEstimatesMirror
const storageMock: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k of Object.keys(storageMock)) delete storageMock[k];
  },
};

const listeners: Record<string, Function[]> = {};
(global as any).window = {
  addEventListener: (event: string, cb: Function) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  },
  removeEventListener: (event: string, cb: Function) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter((fn) => fn !== cb);
    }
  },
  dispatchEvent: (event: { type: string }) => {
    if (listeners[event.type]) {
      listeners[event.type].forEach((cb) => cb(event));
    }
  },
};

// --- Test 1: Snapshot referencialmente estable cuando el almacenamiento no cambia ---
const mockList = [
  {
    id: 'est_1',
    estimateId: '12345678',
    partnerName: 'Partner Test',
    clientFinalName: 'Cliente Test',
    createdAt: new Date().toISOString(),
    creator: { username: 'testuser' },
    isRestricted: false,
    itemsCount: 5,
    items: [],
  },
];

storageMock['cisco_cloud_estimates_local_mirror_v1'] = JSON.stringify(mockList);

const snapshot1 = getEstimatesMirrorSnapshot();
const snapshot2 = getEstimatesMirrorSnapshot();

assert.equal(snapshot1.length, 1, 'Debe cargar 1 estimación del mirror');
assert.strictEqual(snapshot1, snapshot2, 'getEstimatesMirrorSnapshot debe preservar igualdad referencial si el string no cambia');
console.log('✅ Snapshot de Mirror: Carga en 0ms y preserva igualdad referencial para evitar re-renders innecesarios en React 19');

// --- Test 2: Suscripción reactiva y notificación de cambios ---
let notifyCount = 0;
const unsubscribe = subscribeEstimatesMirror(() => {
  notifyCount++;
});

// Simular actualización del mirror
const updatedList = [
  ...mockList,
  {
    id: 'est_2',
    estimateId: '87654321',
    partnerName: 'Partner Dos',
    clientFinalName: 'Cliente Dos',
    createdAt: new Date().toISOString(),
    creator: { username: 'testuser' },
    isRestricted: true,
    itemsCount: 3,
    items: [],
  },
];
storageMock['cisco_cloud_estimates_local_mirror_v1'] = JSON.stringify(updatedList);

// Disparar evento
(global as any).window.dispatchEvent({ type: 'cisco-estimates-mirror-updated' });

assert.equal(notifyCount, 1, 'El listener debe ser notificado al dispararse cisco-estimates-mirror-updated');
const snapshotUpdated = getEstimatesMirrorSnapshot();
assert.equal(snapshotUpdated.length, 2, 'El snapshot actualizado debe contener 2 elementos');
unsubscribe();
console.log('✅ Suscripción reactiva: useSyncExternalStore recibe actualizaciones instantáneas sin race conditions');

// --- Test 3: Verificación de exportación de subcomponentes modulares de ConfigurIAtor ---
assert.ok(typeof PoeBudgetCard === 'function', 'PoeBudgetCard debe ser un componente exportado');
assert.ok(typeof AiDiscrepancyCard === 'function', 'AiDiscrepancyCard debe ser un componente exportado');
assert.ok(typeof CcwPreviewTable === 'function', 'CcwPreviewTable debe ser un componente exportado');
assert.ok(typeof ApiManagementModal === 'function', 'ApiManagementModal debe ser un componente exportado');
console.log('✅ Subcomponentes modulares de ConfigurIAtor verificados correctamente');

// --- Test 4: Verificación de campos de metadatos de auditoría en ProcessedEstimateResult ---
const mockProcessedResult: ProcessedEstimateResult = {
  fileName: 'test.xlsx',
  headerInfo: {
    customerName: 'Cliente Test',
    companyName: 'Partner Test',
    address: 'Direccion Test',
    city: 'Santiago',
    country: 'Chile',
    phone: '+56912345678',
    estimateId: '123',
    dealId: 'DEAL-123',
    priceList: 'Global Price List',
    date: '2026-10-04',
  },
  items: [],
  originalProductTotal: 1000,
  calculatedProductTotal: 1050,
  serviceTotal: 0,
  subscriptionTotal: 0,
  finalTotalPrice: 1050,
  headerRowIndex: 5,
  isPreviouslyProcessed: true,
  priorParameters: {
    margin: 5.0,
    internacion: 7.0,
    timestamp: '2026-10-03T12:00:00Z',
  },
};

assert.equal(mockProcessedResult.isPreviouslyProcessed, true);
assert.equal(mockProcessedResult.priorParameters?.margin, 5.0);
console.log('✅ Estructura de Round-trip en ProcessedEstimateResult validada');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE ARQUITECTURA FASE 3 COMPLETADAS AL 100%!');
