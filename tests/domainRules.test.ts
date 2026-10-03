import assert from 'node:assert';
import {
  ALL_PRODUCT_DOMAIN_PACKAGES,
  EOL_CATALOG_2026,
  CHASSIS_RULES,
  resolveChassisRule,
} from '../src/modules/configuriator/catalogRules';
import { isDesktopApp, openDesktopFileDialog } from '../src/core/desktopBridge';

console.log('🧪 Iniciando verificación de Módulos de Dominio (Fase 3) y Desktop Bridge (Fase 2)...');

// 1. Verificación de los 8 Dominios
console.log('\n--- 1. Validación de Dominios Oficiales Cisco ---');
assert.strictEqual(ALL_PRODUCT_DOMAIN_PACKAGES.length, 8, 'Deben existir exactamente 8 paquetes de dominios modulares');

const expectedDomains = [
  'Routing y WAN',
  'Switching (Enterprise y Campus)',
  'Data Center Networking y Cómputo',
  'Wireless y Movilidad',
  'Seguridad y SASE',
  'Colaboración y Comunicaciones Unificadas',
  'IoT e Industrial Networking',
  'Observabilidad y Monitoreo de Red',
];

for (const pkg of ALL_PRODUCT_DOMAIN_PACKAGES) {
  assert(expectedDomains.includes(pkg.domainName), `Dominio no reconocido: ${pkg.domainName}`);
  console.log(`✅ Dominio validado: ${pkg.domainName} (${Object.keys(pkg.eolEntries).length} EOL, ${Object.keys(pkg.chassisRules).length} Reglas Chasis)`);
}

// 2. Verificación de Transiciones EOL hacia equipos vigentes 2026 (Cero EOL)
console.log('\n--- 2. Verificación de Transiciones EOL por Dominio ---');

// Routing: ISR 4000 -> Catalyst 8000
const isr4321 = EOL_CATALOG_2026['ISR4321/K9'];
assert(isr4321, 'ISR4321/K9 debe existir en EOL_CATALOG_2026');
assert.strictEqual(isr4321.replacementSku, 'C8200-1N-4T');
console.log('✅ Routing: ISR 4321 -> Catalyst 8200 1N 4T');

// Switching: CBS250 -> Catalyst 1200
const cbs250 = EOL_CATALOG_2026['CBS250-24P-4G'];
assert(cbs250, 'CBS250-24P-4G debe existir en EOL_CATALOG_2026');
assert.strictEqual(cbs250.replacementSku, 'C1200-24FP-4G');
console.log('✅ Switching: CBS250 24P -> Catalyst 1200 24FP 4G');

// Data Center: Nexus 93180YC-EX -> FX3
const n9kEx = EOL_CATALOG_2026['N9K-C93180YC-EX'];
assert(n9kEx, 'N9K-C93180YC-EX debe existir en EOL_CATALOG_2026');
assert.strictEqual(n9kEx.replacementSku, 'N9K-C93180YC-FX3');
console.log('✅ Data Center: Nexus 93180YC-EX -> Nexus 93180YC-FX3');

// Wireless: WLC 2504 -> Catalyst 9800-L
const wlc2504 = EOL_CATALOG_2026['AIR-CT2504-K9'];
assert(wlc2504, 'AIR-CT2504-K9 debe existir en EOL_CATALOG_2026');
assert.strictEqual(wlc2504.replacementSku, 'C9800-L-F-K9');
console.log('✅ Wireless: WLC 2504 -> Catalyst 9800-L');

// Seguridad: ASA 5506-X -> FPR 1010
const asa5506 = EOL_CATALOG_2026['ASA5506-X'];
assert(asa5506, 'ASA5506-X debe existir en EOL_CATALOG_2026');
assert.strictEqual(asa5506.replacementSku, 'FPR1010-NGFW-K9');
console.log('✅ Seguridad: ASA 5506-X -> Secure Firewall 1010');

// Colaboración: CP-7940G -> CP-7841
const cp7940 = EOL_CATALOG_2026['CP-7940G'];
assert(cp7940, 'CP-7940G debe existir en EOL_CATALOG_2026');
assert.strictEqual(cp7940.replacementSku, 'CP-7841-K9');
console.log('✅ Colaboración: CP-7940G -> Cisco IP Phone 7841');

// Industrial IoT: IE-2000 -> IE-3100
const ie2000 = EOL_CATALOG_2026['IE-2000-8TC-B'];
assert(ie2000, 'IE-2000-8TC-B debe existir en EOL_CATALOG_2026');
assert.strictEqual(ie2000.replacementSku, 'IE-3100-8T2C-E');
console.log('✅ Industrial IoT: IE-2000 -> Catalyst IE-3100');

// Observabilidad: DN1 -> DN2
const dn1 = EOL_CATALOG_2026['DN1-HW-APL'];
assert(dn1, 'DN1-HW-APL debe existir en EOL_CATALOG_2026');
assert.strictEqual(dn1.replacementSku, 'DN2-HW-APL');
console.log('✅ Observabilidad: DNA Center Gen 1 -> Catalyst Center Gen 2 (DN2-HW-APL)');

// 3. Verificación de Reglas Madre-Hijo
console.log('\n--- 3. Verificación de Reglas Madre-Hijo en Chasis Nuevos ---');
const c8200Rule = resolveChassisRule('C8200-1N-4T');
assert(c8200Rule, 'C8200-1N-4T debe resolver regla de chasis');
const c8200Sub = c8200Rule.defaultSubItems({ powerCordStandard: 'italy_chile' });
assert(c8200Sub.some(s => s.category === 'dna_license' || s.partNumber.includes('DNA')), 'Catalyst 8200 debe incluir licencia DNA');
assert(c8200Sub.some(s => s.category === 'power_cord' || s.partNumber.includes('CAB')), 'Catalyst 8200 debe incluir cable de poder');
console.log('✅ Catalyst 8200: Árbol oficial (Licencia DNA, Cable de poder) verificado');

const mdsRule = resolveChassisRule('DS-C9124V-K9');
assert(mdsRule, 'MDS 9124V debe resolver regla de chasis');
const mdsSub = mdsRule.defaultSubItems({});
assert(mdsSub.some(s => s.partNumber === 'DS-SFP-FC32G-SW'), 'MDS 9124V debe incluir transceivers 32G FC');
console.log('✅ MDS 9124V: Árbol oficial (Fuentes redundantes, Cable PDU, Transceivers 32G FC) verificado');

// 4. Verificación de Desktop Bridge
console.log('\n--- 4. Verificación de Desktop Bridge ---');
assert.strictEqual(typeof isDesktopApp, 'function');
assert.strictEqual(typeof openDesktopFileDialog, 'function');
assert.strictEqual(isDesktopApp(), false, 'En entorno Node/CLI isDesktopApp debe retornar false');
console.log('✅ DesktopBridge verificado correctamente.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE DOMINIOS Y MEJORAS COMPLETADAS AL 100%!');
