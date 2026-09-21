const VERSION="3f0196e7004e3f30", ASSETS=["./","./index.html","./PLAY.html","./style.css","./manifest.webmanifest","./icon-192.png","./icon-512.png","./combat-content.js","./world-content.js","./data.js","./content-v1.js","./classes.js","./achievements.js","./skill-runtime.js","./engine.js","./world-rewards.js","./progression.js","./world.js","./renderer.js","./ui.js","./audio.js","./screens.js","./debug-lab.js","./world-debug.js","./run-save.js","./level-up.js","./app.js","./offline.js","./pwa-install.js"];
const PREFIX='afterlight-'+encodeURIComponent(self.registration.scope)+'-',CACHE=PREFIX+VERSION;
const inScope=url=>{const scope=new URL(self.registration.scope);return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);};
const knownAsset=url=>{const scope=new URL(self.registration.scope),relative='./'+url.pathname.slice(scope.pathname.length);return ASSETS.includes(relative);};
// A new worker never activates with a partial cache. If any file fails, this
// candidate cache is removed and the previously active release stays usable.
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(ASSETS);await self.skipWaiting();}catch(error){await caches.delete(CACHE);throw error;}})()));
// Only versioned game caches are removed. localStorage, IndexedDB and all save
// formats are deliberately outside this worker and are never touched here.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
// Online requests always win. The offline fallback reads the last fully
// installed release; individual responses are not written into it, preventing
// a half-published deployment from creating a mixed offline build.
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(!inScope(url)||!knownAsset(url))return;event.respondWith((async()=>{try{return await fetch(event.request);}catch(error){const cache=await caches.open(CACHE),cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;throw error;}})());});
