/* Service Worker — محاضراتي (العمل بدون إنترنت)
   لو غيّرت أي حاجة هنا، زوّد رقم النسخة (v1 → v2) عشان الأجهزة تحدّث نفسها. */
const V = 'mohadarati-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(SHELL);
    try { await c.put(LIB, await fetch(LIB)); } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* الصفحة: الأول من النت (بحد أقصى 4 ثواني)، ولو مفيش نت تتفتح من الذاكرة */
async function netFirst(req) {
  const cache = await caches.open(V);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) ||
           (await cache.match('index.html')) || Response.error();
  }
}

/* باقي ملفات الموقع: من الذاكرة فوراً وتتحدّث في الخلفية */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(V);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

/* مكتبة Supabase: من الذاكرة، ولو مش موجودة تتحمّل وتتخزن */
async function cacheFirst(req) {
  const cache = await caches.open(V);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === 'navigate' ? netFirst(req) : staleWhileRevalidate(req));
  } else if (req.url === LIB) {
    e.respondWith(cacheFirst(req));
  }
  /* أي حاجة تانية (زي طلبات Supabase) بتعدّي عادي، والتطبيق بيحفظ نسخة من البيانات بنفسه */
});
