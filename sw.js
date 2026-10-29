/* AJD's Wireless Repairs public app shell; private admin dashboard and customer data are never cached. */
const CACHE_NAME='ajd-store-shell-v6-glass';
const SHELL=['./store.html','./manifest.webmanifest','./admin.webmanifest','./ajd-app-icon.svg','./ajd-logo.svg','./ajd-logo.css','./ajd-logo-32.png','./admin-icon-192.png','./admin-icon-512.png'];
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
 const isAsset=/\/(manifest\.webmanifest|admin\.webmanifest|ajd-app-icon\.svg|ajd-logo\.svg|ajd-logo\.css|ajd-logo-32\.png|admin-icon-192\.png|admin-icon-512\.png)$/.test(url.pathname);
 if(isStore){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./store.html',copy)))}
   return response;
  }).catch(()=>caches.match('./store.html')));
 }else if(isAsset){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
 }
});

// Private admin notifications: keep push previews generic, without customer personal data.
self.addEventListener('push',event=>{
 let id='new';
 try{const payload=event.data?.json();if(payload&&typeof payload.id==='string')id=payload.id.slice(0,80)}catch{}
 event.waitUntil(self.registration.showNotification("AJD's Wireless Repairs",{
  body:"You have a new admin notification. Sign in to see details.",
  tag:'ajd-admin-'+id,
  icon:'/admin-icon-192.png',
  badge:'/admin-icon-192.png',
  data:{url:'/settings#notifications'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('/settings#notifications',self.location.origin).href;
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(x=>new URL(x.url).origin===self.location.origin && !/\/(store|request|track)(?:\.html)?\b/.test(new URL(x.url).pathname));
  if(existing){await existing.focus();if('navigate' in existing)await existing.navigate(target);return}
  await clients.openWindow(target);
 })());
});
