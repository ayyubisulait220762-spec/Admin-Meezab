// Admin meezab service worker: the app opens at once from the phone's saved copy; a newer version is fetched quietly
// in the background and the page is told, so it can offer "Update". Data always comes live from the Sheet.
var V = 'admin-meezab-v4';
var FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'qrcode.min.js', 'jsQR.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n !== V; }).map(function (n) { return caches.delete(n); })); }));
  self.clients.claim();
});
function tell(msg) { self.clients.matchAll({ type: 'window' }).then(function (cs) { cs.forEach(function (c) { c.postMessage(msg); }); }); }
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;    // Sheet calls go straight to the internet
  var page = e.request.mode === 'navigate', key = page ? 'index.html' : e.request, check = null;
  e.respondWith(caches.open(V).then(function (c) {
    return c.match(key, { ignoreSearch: page }).then(function (hit) {
      var oldText = page && hit ? hit.clone().text() : null;   // read now: the saved copy is handed to the page below
      var net = fetch(e.request, { cache: 'no-cache' }).then(function (r) {
        if (!r || !r.ok) return r;
        var copy = r.clone();
        if (page && hit) {                                   // compare with the saved page; if different, save it and tell the page
          check = Promise.all([oldText, r.clone().text()]).then(function (t) {
            if (t[0] === t[1]) return;
            return c.put('index.html', copy).then(function () { return new Promise(function (ok) { setTimeout(ok, 1500); }); })   // let the page finish opening first
              .then(function () { tell({ type: 'updated' }); });
          });
        } else c.put(key, copy);
        return r;
      }).catch(function () { return hit || caches.match('index.html'); });
      if (hit) { e.waitUntil(net.then(function () { return check; })); return hit; }
      return net;
    });
  }));
});
