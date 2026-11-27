// ============================================================================
// CLOUDFLARE PAGES FUNCTIONS: /api/verify
// Re-exporta el manejador unificado /api/verify-turnstile sin duplicar lógica
// ============================================================================

export { onRequestOptions, onRequestPost } from './verify-turnstile';
