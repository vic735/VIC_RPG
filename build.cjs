// Generates the portable single-file game from the same editable source files.
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
let html = read('index.html');
// New feature modules travel in the page so an already-running LAN server
// with the older static-file allowlist can deliver this release without a restart.
for (const file of ['meta.js','meta-screens.js','encounters.js','world-maps.js']) {
  const marker=`<!-- inline-module:${file} -->`,end='<!-- /inline-module -->';
  const escaped=file.replaceAll('.', '\\.');
  const pattern=new RegExp(`<!-- inline-module:${escaped} -->[\\s\\S]*?<!-- /inline-module -->|<script src="${escaped}"><\\/script>`);
  html=html.replace(pattern,()=>marker+'<script>\n'+read(file).replace(/<\/script/gi,'<\\/script')+'\n</script>'+end);
}
fs.writeFileSync(path.join(__dirname,'index.html'),html);
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) => '<script>\n' + read(file).replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.writeFileSync(path.join(__dirname, 'PLAY.html'), html);
console.log('PLAY.html ready: standalone, no network or external assets required.');

// A content-addressed cache installs one complete release before it can take over.
// Cache Storage contains only game files; player progress stays in browser storage.
const crypto=require('node:crypto');
const assets=['./','./index.html','./PLAY.html','./style.css','./manifest.webmanifest','./icon-192.png','./icon-512.png',...Array.from(read('index.html').matchAll(/<script src="([^"]+)"/g),m=>'./'+m[1])];
const version=crypto.createHash('sha256').update(assets.filter(a=>a!=='./').map(a=>read(a.slice(2))).join('')).digest('hex').slice(0,16);
const worker=`const VERSION=${JSON.stringify(version)}, ASSETS=${JSON.stringify(assets)};
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
`;
fs.writeFileSync(path.join(__dirname,'sw.js'),worker);
console.log('Offline release '+version+' generated with '+assets.length+' cached assets.');
