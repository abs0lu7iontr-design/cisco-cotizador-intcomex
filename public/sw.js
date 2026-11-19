// ============================================================================
// CISCO AUTOMATED - ENTERPRISE SERVICE WORKER (PWA & OFFLINE SHELL CACHE)
// Version: 2.22.0
// Strategies:
// 1. Navigation (HTML): Network-First with Cache Fallback for 100% offline opening
// 2. Static Assets (JS/CSS/Fonts/Icons): Stale-While-Revalidate
// 3. Cloud & Firestore APIs: Network-Only (handled by IndexedDB offline vaults)
// ============================================================================

const CACHE_NAME = 'cisco-automated-shell-v2.22.0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
  '/logo-halloween-animado.gif',
  '/logo-navidad-nieve.gif',
];

// 1. Instalación del Service Worker: Pre-cacheados de recursos mínimos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[ServiceWorker] Falló pre-cacheo parcial:', err);
      })
  );
});

// 2. Activación: Limpieza de versiones obsoletas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME && name.startsWith('cisco-automated-shell-')) {
              console.log('[ServiceWorker] Purgando caché obsoleta:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// 3. Intercepción y Gestión de Peticiones Fetch
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Excluir peticiones no GET o de extensiones de navegador
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // A. Peticiones de API en la Nube (Firestore, Google APIs, OpenRouter) -> Network Only
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // B. Peticiones de Navegación (HTML de la aplicación) -> Network First con Fallback a Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Si no hay red, recuperar la aplicación desde la caché offline
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback a la raíz index.html
          const rootFallback = await caches.match('/index.html');
          if (rootFallback) {
            return rootFallback;
          }
          return new Response(
            '<html><body style="font-family:sans-serif;background:#030712;color:white;text-align:center;padding:50px;"><h2>Cisco Automated</h2><p>Estás en modo offline. Revisa tu conexión o abre tu acceso directo guardado.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // C. Assets Estáticos (.js, .css, .svg, .ico, imágenes, fuentes) -> Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
