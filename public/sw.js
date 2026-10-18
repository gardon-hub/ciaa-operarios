// Guarda la app en el teléfono para abrirla sin señal.
// Las peticiones a la base de datos (supabase.co) nunca se guardan aquí:
// los datos sin enviar viven en la cola de la app.
const CACHE = "ciaa-operarios-v1";
const BASE = new URL("./", self.location).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icon-192.png`])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Página: primero la red (para recibir actualizaciones), si no hay, la copia
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(BASE, copia));
          return r;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  // Archivos de la app (llevan huella en el nombre): primero la copia
  e.respondWith(
    caches.match(e.request).then(
      (guardado) =>
        guardado ||
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
          }
          return r;
        }),
    ),
  );
});
