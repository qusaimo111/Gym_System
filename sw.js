const CACHE_NAME = 'gym-app-v6';
const assetsToCache = [
  './',
  './index.html',
  './app.js',
  './style.css',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode'
];

// 1. التثبيت وحفظ الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting();
});

// 2. تفعيل وتنظيف النسخ القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. الاعتراض وتوفير الملفات من الكاش عند غياب الإنترنت
self.addEventListener('fetch', (event) => {
  // لا نتدخل بطلبات الـ API الخاصة بجوجل شيت لكي لا نتعارض مع جلب البيانات
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
        // في حال فشل كل شيء وانقطع الإنترنت
        return caches.match('./index.html');
    })
  );
});
