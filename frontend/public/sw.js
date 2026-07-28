const CACHE = 'inimigoscore-v2'

self.addEventListener('install', e => {
  self.skipWaiting()
  // Pré-cacheia o shell do app para funcionar offline imediatamente
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.add(new Request('/', { cache: 'reload' })).catch(() => {})
    )
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // API e POST nunca passam pelo cache
  if (url.pathname.startsWith('/api') || request.method !== 'GET') return

  // Fontes externas: ignora (Cross-Origin complexo)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request)

      // Busca na rede em paralelo para manter o cache atualizado
      const networkPromise = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone())
        return res
      }).catch(() => null)

      // Serve do cache imediatamente se disponível; senão aguarda rede
      return cached || networkPromise || new Response('Offline', { status: 503 })
    })
  )
})
