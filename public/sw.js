/* 论坛 PWA Service Worker
   策略：
   - /assets/*（文件名带哈希）：缓存优先，命中即返回
   - 页面导航：网络优先，断网时回退到缓存的首页外壳
   - /api/*（Supabase 代理）与跨域请求：一律不缓存，直接放行
*/
const CACHE = 'forum-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return; // 跨域（含 Supabase 代理）不介入
  if (url.pathname.startsWith('/api/')) return;    // 数据接口永不缓存
  if (url.pathname === '/sw.js') return;

  // 静态资源：缓存优先
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // 页面导航：网络优先 + 离线回退
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit || Response.error()))
    );
  }
});
