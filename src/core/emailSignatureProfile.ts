// ============================================================================
// CISCO AUTOMATED v2.7 - EMAIL SIGNATURE & TEMPLATE PROFILE MANAGER
// Manages customizable executive signatures and greeting templates for Outlook
// ============================================================================

import { idbGet, idbSet, STORES } from './storage/indexedDbStorage';

export interface EmailSignatureProfile {
  senderName: string;
  jobTitle: string;
  phone: string;
  email: string;
  greetingTemplate: string;
  commercialTerms: string[];
  disclaimerText: string;
}

export const DEFAULT_EMAIL_SIGNATURE: EmailSignatureProfile = {
  senderName: 'Equipo Cisco • Intcomex Chile',
  jobTitle: 'Product Management Cisco',
  phone: '+56 2 2490 5000',
  email: 'cisco@intcomex.com',
  greetingTemplate: 'Estimados,\nBuenos días/tardes, adjunto cotización solicitada.',
  commercialTerms: [
    'Validez de la Oferta: Esta cotización tiene una validez de 14 días corridos a contar de su fecha de emisión.',
    'Plazo de entrega: El tiempo final de despacho está determinado por el producto con mayor tiempo de espera (lead time) de la orden.',
    'Validación Técnica y Responsabilidad: La presente cotización constituye una propuesta referencial de preventa basada en los requerimientos informados. Es responsabilidad exclusiva del Partner revisar y validar técnicamente la compatibilidad, completitud y exactitud de todos los números de parte (BOM) y licenciamiento antes de formalizar la orden de compra. Intcomex no asumirá costos ni mermas derivados de omisiones o inconsistencias en compras de productos a pedido no validadas previamente por el Partner.',
  ],
  disclaimerText: 'Distribuidor Mayorista Autorizado Cisco • Intcomex Chile • Av. El Retiro 1255, Renca, Santiago',
};

const STORAGE_KEY = 'cisco_email_signature_profile';

/**
 * Obtiene el perfil de firma corporativa guardado en IndexedDB (o fallback localStorage).
 */
export async function getSavedEmailSignature(): Promise<EmailSignatureProfile> {
  try {
    const saved = await idbGet<EmailSignatureProfile>(STORES.KEYVAL, STORAGE_KEY);
    if (saved && saved.senderName) {
      return { ...DEFAULT_EMAIL_SIGNATURE, ...saved };
    }
  } catch {}
  return DEFAULT_EMAIL_SIGNATURE;
}

/**
 * Guarda el perfil de firma corporativa en IndexedDB y localStorage.
 */
export async function saveEmailSignature(profile: EmailSignatureProfile): Promise<boolean> {
  try {
    await idbSet(STORES.KEYVAL, STORAGE_KEY, profile);
    return true;
  } catch (err) {
    console.error('Error guardando firma de correo:', err);
    return false;
  }
}
