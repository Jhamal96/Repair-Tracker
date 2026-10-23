/* AJD's Wireless Repairs public app shell; private admin dashboard and customer data are never cached. */
const CACHE_NAME='ajd-store-shell-v3';
const SHELL=['./store.html','./manifest.webmanifest','./admin.webmanifest','./ajd-app-icon.svg','./admin-icon-192.png','./admin-icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ajd-store-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const isStore=/\/store(?:\.html)?\/?$/.test(url.pathname);
 const isAsset=/\/(manifest\.webmanifest|admin\.webmanifest|ajd-app-icon\.svg|admin-icon-192\.png|admin-icon-512\.png)$/.test(url.pathname);
 if(isStore){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./store.html',copy)))}
   return response;
  }).catch(()=>caches.match('./store.html')));
 }else if(isAsset){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
 }
});
