// Service worker DIANAST-app — оболочка ставится иконкой и работает оффлайн.
// Стратегия: при установке скачиваем ВСЁ приложение целиком (список ФАЙЛЫ),
//            дальше: страницы и скрипты → сначала сеть (свежий код), кэш как запас;
//            картинки → сначала кэш (быстро).
// Чтение из кэша идёт с ignoreSearch, поэтому смена версии ?v= не обнуляет оффлайн.
const CACHE = 'dianast-app-v10';

const ФАЙЛЫ = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/logo.png',
  './vendor/supabase-2.110.8.js',
  './облако.js', './цены.js', './настройки.js', './данные.js', './заявка-бухгалтеру.js',
  './tools/dobornye/index.html', './tools/dobornye/лого-знак.png',
  './tools/raskroy/index.html', './tools/raskroy/лого-знак.png',
  './tools/otlivy/index.html', './tools/otlivy/app.js', './tools/otlivy/лого-знак.png',
  './tools/crm/index.html', './tools/crm/лого-знак.png',
  './tools/sebestoimost/index.html', './tools/sebestoimost/лого-знак.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // по одному, а не addAll: один недоступный файл не должен срывать всю установку
    await Promise.allSettled(ФАЙЛЫ.map(async (путь) => {
      try {
        const r = await fetch(путь, { cache: 'reload' });
        if (r.ok) await c.put(путь, r);
      } catch (err) { /* нет сети — доберём при первом онлайн-визите */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const изКэша = (req) => caches.match(req, { ignoreSearch: true });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => изКэша(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // свои скрипты и стили — сначала сеть: иначе после правки на устройстве
  // останется старая версия, пока пользователь не почистит браузер
  if (/\.(js|css|webmanifest|json)(\?|$)/.test(req.url)) {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => изКэша(req).then((m) => m || новыйОтвет()))
    );
    return;
  }

  e.respondWith(
    изКэша(req).then((m) => m || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return r;
    }).catch(() => новыйОтвет()))
  );
});

// когда нет ни сети, ни копии — отдаём понятный ответ, а не пустоту
function новыйОтвет() {
  return new Response('Нет сети и нет сохранённой копии', {
    status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
