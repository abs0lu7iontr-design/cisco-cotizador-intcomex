// ============================================================================
// CISCO AUTOMATED - ENTERPRISE SERVICE WORKER (PWA & OFFLINE SHELL CACHE)
// Version: 2.22.0
// Strategies:
// 1. Navigation (HTML): Network-First with Cache Fallback for 100% offline opening
// 2. Static Assets (JS/CSS/Fonts/Icons): Stale-While-Revalidate
// 3. Cloud & Firestore APIs: Network-Only (handled by IndexedDB offline vaults)
// ============================================================================

const CACHE_NAME = 'cisco-automated-shell-v2.26.6';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Lista inyectada automáticamente por scripts/prepare_deploy.js durante el build web
// para pre-cachear en segundo plano todos los chunks lazy (.js / .css) y garantizar 100% modo offline.
const PRECACHE_CHUNKS = [];

async function precacheChunksResiliently(cache, chunkUrls) {
  if (!Array.isArray(chunkUrls) || chunkUrls.length === 0) return;
  const BATCH_SIZE = 6;
  for (let i = 0; i < chunkUrls.length; i += BATCH_SIZE) {
    const batch = chunkUrls.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (url) => {
        const hit = await cache.match(url);
        if (!hit) {
          await cache.add(url);
        }
      })
    );
  }
}

// 1. Instalación del Service Worker: Pre-cacheo de shell mínimo + chunks divididos (Code-Splitting Offline)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(PRECACHE_ASSETS);
        await precacheChunksResiliently(cache, PRECACHE_CHUNKS);
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
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Excluir peticiones no GET, no HTTP o cross-origin (el SW solo cachea assets same-origin)
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // A. Endpoints internos /api/*, version.json, desktop_build.html y APIs Cloud -> Network Only
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/version.json' ||
    url.pathname === '/desktop_build.html' ||
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
    const isHashedAsset = url.pathname.startsWith('/assets/');
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          if (!isHashedAsset) {
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                  });
                }
              })
              .catch(() => {});
          }
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
  }
});
