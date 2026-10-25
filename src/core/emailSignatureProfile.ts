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
  greetingTemplate: 'Estimado(a) Partner / Cliente,\nJunto con saludar, comparto el resumen oficial de cotización comercial Cisco (Intcomex Chile):',
  commercialTerms: [
    'Valores unitarios y totales expresados en Dólares Americanos (USD), valores Netos (no incluyen IVA 19%).',
    'Precios calculados con internación y arancel aduanero chileno según aplique por SKU.',
    'Cotización sujeta a disponibilidad de stock y vigencia oficial en Cisco Commerce Workspace (CCW).',
    'Validez de la oferta: 30 días calendario desde su fecha de emisión.',
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
