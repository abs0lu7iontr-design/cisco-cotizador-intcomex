import assert from 'assert';
import {
  checkGeoLocation,
  sendTwoFactorOtp,
  verifyTwoFactorOtp,
  requestAdminUnlock,
  getAdminOverrideCode,
  GeoLocationInfo,
} from '../src/modules/security/twoFactorService';

async function runTwoFactorTests() {
  console.log('🧪 Iniciando suite de pruebas unitarias: 2FA Adaptativo & Geolocalización...');

  const originalFetch = globalThis.fetch;

  try {
    // 1. Fallback local / dev: debe detectar Chile (CL) y requires2FA = false
    globalThis.fetch = async () => {
      throw new Error('Network error simulado');
    };
    const defaultGeo = await checkGeoLocation();
    assert.strictEqual(defaultGeo.country, 'CL', 'Debe retornar CL por defecto');
    assert.strictEqual(defaultGeo.isChile, true, 'isChile debe ser true');
    assert.strictEqual(defaultGeo.requires2FA, false, 'requires2FA debe ser false en Chile');
    console.log('  ✅ Fallback local / dev retorna conexión Chile (CL) sin 2FA.');

    // 2. Conexión chilena en Cloudflare: requires2FA = false
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          country: 'CL',
          city: 'Santiago',
          region: 'RM',
          ip: '200.89.68.1',
          isChile: true,
          requires2FA: false,
        }),
      } as any;
    };
    const chileGeo = await checkGeoLocation();
    assert.strictEqual(chileGeo.country, 'CL');
    assert.strictEqual(chileGeo.requires2FA, false);
    console.log('  ✅ Conexión nacional en Chile detectada sin requerir 2FA.');

    // 3. Conexión internacional (EE.UU., España, etc.): requires2FA = true
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          country: 'US',
          city: 'Miami',
          region: 'FL',
          ip: '198.51.100.24',
          isChile: false,
          requires2FA: true,
        }),
      } as any;
    };
    const intlGeo = await checkGeoLocation();
    assert.strictEqual(intlGeo.country, 'US');
    assert.strictEqual(intlGeo.isChile, false);
    assert.strictEqual(intlGeo.requires2FA, true);
    console.log('  ✅ Conexión internacional (US) detectada activando 2FA adaptativo.');

    // 4. Envío de OTP: action 'send'
    let lastRequest: any = null;
    globalThis.fetch = async (_url: any, init: any) => {
      lastRequest = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Código enviado',
          otpSignature: 'hmac_sig_xyz',
          expiresAt: Date.now() + 600000,
        }),
      } as any;
    };
    const sendRes = await sendTwoFactorOtp('colaborador.test', 'colaborador@intcomex.com', intlGeo);
    assert.strictEqual(sendRes.success, true);
    assert.strictEqual(lastRequest.action, 'send');
    assert.strictEqual(lastRequest.username, 'colaborador.test');
    assert.strictEqual(lastRequest.country, 'US');
    assert.strictEqual(sendRes.otpSession?.otpSignature, 'hmac_sig_xyz');
    console.log('  ✅ Despacho de OTP 2FA construye payload correcto.');

    // 5. Verificación de OTP: action 'verify'
    globalThis.fetch = async (_url: any, init: any) => {
      lastRequest = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Autenticación 2FA completada exitosamente.',
        }),
      } as any;
    };
    const verifyRes = await verifyTwoFactorOtp('colaborador.test', '654321', {
      otpSignature: 'hmac_sig_xyz',
      expiresAt: Date.now() + 600000,
    });
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(lastRequest.action, 'verify');
    assert.strictEqual(lastRequest.code, '654321');
    assert.strictEqual(lastRequest.otpSignature, 'hmac_sig_xyz');
    console.log('  ✅ Verificación criptográfica de OTP exitosa.');

    // 6. Generación de Código Maestro para Administrador (mskill)
    globalThis.fetch = async (_url: any, init: any) => {
      lastRequest = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          code: 'ADMN2026',
          dayStamp: '2026-10-24',
          target: 'colaborador.test',
        }),
      } as any;
    };
    const adminRes = await getAdminOverrideCode('colaborador.test');
    assert.strictEqual(adminRes.success, true);
    assert.strictEqual(adminRes.code, 'ADMN2026');
    assert.strictEqual(lastRequest.action, 'generate_admin_override');
    assert.strictEqual(lastRequest.username, 'colaborador.test');
    console.log('  ✅ Generador de Código Maestro para administrador opera correctamente.');

    // 7. Notificación de desbloqueo al administrador (mskill)
    globalThis.fetch = async (_url: any, init: any) => {
      lastRequest = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Se ha notificado al Administrador Principal.',
        }),
      } as any;
    };
    const unlockRes = await requestAdminUnlock('colaborador.test', 'colaborador@intcomex.com', intlGeo);
    assert.strictEqual(unlockRes.success, true);
    assert.strictEqual(lastRequest.action, 'request_admin_unlock');
    assert.strictEqual(lastRequest.country, 'US');
    console.log('  ✅ Solicitud de desbloqueo notifica a mskill.');

    console.log('🎉 Todas las pruebas de 2FA Adaptativo pasaron exitosamente!');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runTwoFactorTests().catch((err) => {
  console.error('❌ Error en pruebas de 2FA:', err);
  process.exit(1);
});
