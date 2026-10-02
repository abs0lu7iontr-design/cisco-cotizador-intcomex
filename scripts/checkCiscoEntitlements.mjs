// ============================================================================
// CISCO AUTOMATED - CISCO B2B / COMMERCE / CATALOG API ENTITLEMENTS PROBE
// Script de diagnóstico técnico para verificar credenciales OAuth2 M2M,
// scopes autorizados y accesibilidad a endpoints de Configuración/BOM en Cisco.
// ============================================================================

import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env si existe
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadDotEnv();

const CLIENT_ID = process.env.VITE_CISCO_CLIENT_ID || 'q728v8x4rud2xhsqfrbztab6';
const CLIENT_SECRET = process.env.VITE_CISCO_CLIENT_SECRET || 'fkBRXQSQfsjbDMGknqxXx5m8';
const TOKEN_URL = process.env.VITE_CISCO_AUTH_URL || 'https://id.cisco.com/oauth2/default/v1/token';

console.log('================================================================');
console.log('   CISCO API & ENTITLEMENTS DIAGNOSTIC PROBE (v2.1)');
console.log('================================================================');
console.log(`[Config] Client ID: ${CLIENT_ID.slice(0, 6)}...${CLIENT_ID.slice(-4)}`);
console.log(`[Config] Token URL: ${TOKEN_URL}\n`);

// Helper para decodificar JWT sin librerías externas
function decodeJwtPayload(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function runAudit() {
  try {
    console.log('🔍 [1/3] Solicitando Token OAuth2 M2M a Cisco Identity (id.cisco.com)...');

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    const tokenStart = Date.now();
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });
    const tokenLatency = Date.now() - tokenStart;

    if (!tokenRes.ok) {
      console.error(`❌ Error obteniendo token: HTTP ${tokenRes.status} (${tokenLatency}ms)`);
      console.error(await tokenRes.text());
      return;
    }

    const tokenData = await tokenRes.json();
    console.log(`✅ Token obtenido exitosamente en ${tokenLatency}ms.`);
    console.log(`   Tipo de Token: ${tokenData.token_type || 'Bearer'}`);
    console.log(`   Expira en: ${tokenData.expires_in} segundos (~${Math.round(tokenData.expires_in / 60)} min)`);

    // Inspeccionar scopes directos y payload JWT
    console.log('\n📋 [2/3] Análisis de Scopes y Entitlements Registrados:');
    if (tokenData.scope) {
      console.log('   Scopes reportados en respuesta OAuth:');
      tokenData.scope.split(' ').forEach((s) => console.log(`     ✓ ${s}`));
    } else {
      console.log('   (OAuth no incluyó campo "scope" plano en la respuesta raíz)');
    }

    const jwtPayload = decodeJwtPayload(tokenData.access_token);
    if (jwtPayload) {
      console.log('\n   Atributos decodificados del JWT (Claims):');
      if (jwtPayload.sub) console.log(`     - Subject (sub): ${jwtPayload.sub}`);
      if (jwtPayload.client_id) console.log(`     - Client ID: ${jwtPayload.client_id}`);
      if (jwtPayload.scope) console.log(`     - Scopes JWT: ${jwtPayload.scope}`);
      if (jwtPayload.roles) console.log(`     - Roles: ${JSON.stringify(jwtPayload.roles)}`);
      if (jwtPayload.org) console.log(`     - Org: ${jwtPayload.org}`);
      if (jwtPayload.app_name) console.log(`     - App Name: ${jwtPayload.app_name}`);
      if (jwtPayload.iss) console.log(`     - Emisor (iss): ${jwtPayload.iss}`);
    }

    const token = tokenData.access_token;

    // Lista exhaustiva de endpoints candidatos en apix.cisco.com y api.cisco.com
    const endpointsToProbe = [
      // 1. Verificación base APIX (Conocido funcional en el proyecto)
      {
        category: 'Base APIX',
        name: 'Cisco PSIRT openVuln v2',
        url: 'https://apix.cisco.com/security/advisories/v2/latest/1',
        method: 'GET',
      },

      // 2. HelloCommerce & Commerce B2B Sandbox / Production
      {
        category: 'Commerce',
        name: 'HelloCommerce APIX (v1)',
        url: 'https://apix.cisco.com/hellocommerce/v1',
        method: 'GET',
      },
      {
        category: 'Commerce',
        name: 'Commerce Hello (apix)',
        url: 'https://apix.cisco.com/commerce/v1/hello',
        method: 'GET',
      },
      {
        category: 'Commerce',
        name: 'Commerce Hello (apx)',
        url: 'https://apx.cisco.com/commerce/v1/hello',
        method: 'GET',
      },

      // 3. CCW Configuration / Assemble / BOM
      {
        category: 'Configuration / BOM',
        name: 'CCW Configuration API (apix v1)',
        url: 'https://apix.cisco.com/commerce/v1/config/configurations',
        method: 'GET',
      },
      {
        category: 'Configuration / BOM',
        name: 'CCW Configuration Assemble (apix v2 POST probe)',
        url: 'https://apix.cisco.com/commerce/v2/catalog/config',
        method: 'POST',
        body: JSON.stringify({ partNumber: 'C9200L-24P-4G-E' }),
      },
      {
        category: 'Configuration / BOM',
        name: 'CCW Config Service (apix v1)',
        url: 'https://apix.cisco.com/commerce/v1/config/configurations/C9200L-24P-4G-E',
        method: 'GET',
      },
      {
        category: 'Configuration / BOM',
        name: 'CCW Config API (api.cisco.com v1)',
        url: 'https://api.cisco.com/commerce/v1/config/configurations',
        method: 'GET',
      },

      // 4. Catálogo & Pricing
      {
        category: 'Catalog & Pricing',
        name: 'CCW Pricing API (apix v1)',
        url: 'https://apix.cisco.com/commerce/v1/pricing',
        method: 'GET',
      },
      {
        category: 'Catalog & Pricing',
        name: 'Product Information API (api.cisco.com)',
        url: 'https://api.cisco.com/product/v1/information/product_ids/C9200L-24P-4G-E',
        method: 'GET',
      },

      // 5. Support EoX (Ciclo de vida y Reemplazo Madre / Hijo)
      {
        category: 'Support & EoX',
        name: 'Support EoX API (api.cisco.com v5)',
        url: 'https://api.cisco.com/supporttool/eox/rest/5/EOXByProductID/1/WS-C2960X-24PS-L?response=json',
        method: 'GET',
      },
      {
        category: 'Support & EoX',
        name: 'Support EoX API (apix.cisco.com v5)',
        url: 'https://apix.cisco.com/supporttool/eox/rest/5/EOXByProductID/1/WS-C2960X-24PS-L?response=json',
        method: 'GET',
      },

      // 6. CX Cloud Inventory & Datafoundation POE
      {
        category: 'CX Cloud',
        name: 'CX Cloud Hardware Inventory',
        url: 'https://apix.cisco.com/cs/api/v2/inventory/hardware',
        method: 'GET',
      },
    ];

    console.log('\n🚀 [3/3] Sondeando endpoints de Cisco Commerce, Configuración y Catálogo...\n');

    const results = [];

    for (const ep of endpointsToProbe) {
      const probeStart = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const res = await fetch(ep.url, {
          method: ep.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            ...(ep.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: ep.body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const latency = Date.now() - probeStart;
        const status = res.status;
        let bodySnippet = '';
        try {
          const rawText = await res.text();
          bodySnippet = rawText.replace(/\s+/g, ' ').slice(0, 180);
        } catch {
          bodySnippet = '(sin body)';
        }

        let verdict = 'DESCONOCIDO';
        let badge = '⚪';
        if (status === 200) {
          badge = '🟢';
          verdict = 'DISPONIBLE / AUTORIZADO (200 OK)';
        } else if (status === 400 || status === 422) {
          badge = '🟡';
          verdict = 'HABILITADO (Ruta activa y escuchando; requiere parámetros válidos)';
        } else if (status === 401) {
          badge = '🔴';
          verdict = 'TOKEN NO ACEPTADO (401 Unauthorized)';
        } else if (status === 403) {
          badge = '🔒';
          verdict = 'BLOQUEADO / REQUIERE ENTITLEMENT B2B (403 Forbidden)';
        } else if (status === 404) {
          badge = '⚪';
          verdict = 'RUTA NO ENCONTRADA / SERVICIO NO EXPUESTO (404 Not Found)';
        } else {
          verdict = `HTTP ${status}`;
        }

        console.log(`${badge} [${ep.category}] ${ep.name}`);
        console.log(`   URL: ${ep.url}`);
        console.log(`   Resultado: ${verdict} (${latency}ms)`);
        if (bodySnippet) {
          console.log(`   Detalle: ${bodySnippet}`);
        }
        console.log('');

        results.push({ ...ep, status, verdict, latency, bodySnippet });
      } catch (err) {
        const latency = Date.now() - probeStart;
        console.log(`⚠️ [${ep.category}] ${ep.name}`);
        console.log(`   URL: ${ep.url}`);
        console.log(`   Error de red: ${err.message} (${latency}ms)\n`);
        results.push({ ...ep, status: 0, verdict: 'Error de red / Timeout', latency, error: err.message });
      }
    }

    console.log('================================================================');
    console.log('   RESUMEN EJECUTIVO DE FACTIBILIDAD');
    console.log('================================================================');
    const available = results.filter((r) => r.status === 200 || r.status === 400 || r.status === 422);
    const forbidden = results.filter((r) => r.status === 403);
    const notFound = results.filter((r) => r.status === 404);

    console.log(`• Endpoints Habilitados / Activos: ${available.length}`);
    console.log(`• Endpoints Requieren Onboarding B2B (403): ${forbidden.length}`);
    console.log(`• Rutas No Encontradas (404): ${notFound.length}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Error general durante la ejecución de la auditoría:', err);
  }
}

runAudit();
