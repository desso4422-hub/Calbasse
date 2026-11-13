/*
 * Service worker de Calbasse.
 * - Pages : réseau d'abord, sinon la dernière version gardée (l'app s'ouvre hors ligne).
 * - Fichiers de l'app (/_expo/static/…, icônes, polices) : gardés après le premier chargement.
 * - Serveur (/api, autres domaines) : jamais mis en cache ; la file d'attente des scans de l'app
 *   s'occupe des envois sans réseau.
 */
const CACHE = 'calbasse-v2';

const memeOrigine = (u) => {
  try {
    const url = new URL(u, self.location.origin);
    return url.origin === self.location.origin && !url.pathname.startsWith('/api');
  } catch {
    return false;
  }
};

// À l'installation : la page et les scripts qu'elle charge (leurs noms changent à chaque version)
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(['/', '/manifest.webmanifest', '/icons/icone-192.png']);
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      const liens = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(memeOrigine);
      await Promise.all(liens.map((u) => c.add(u).catch(() => {})));
    })(),
  );
  self.skipWaiting();
});

// La page envoie la liste des fichiers déjà chargés avant que le service worker ne soit actif
// (polices, images) : on les garde pour l'usage hors ligne.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'garder' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(memeOrigine);
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.match(u).then((deja) => deja || c.add(u).catch(() => {}))))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // Pages : réseau d'abord
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put('/', copie));
          return rep;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Fichiers : cache d'abord (les noms des fichiers de l'app changent à chaque version)
  event.respondWith(
    caches.match(req).then(
      (deja) =>
        deja ||
        fetch(req).then((rep) => {
          if (rep.ok) {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        }),
    ),
  );
});
