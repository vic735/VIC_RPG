// Generates the portable single-file game from the same editable source files.
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
let html = read('index.html');
// New feature modules travel in the page so an already-running LAN server
// with the older static-file allowlist can deliver this release without a restart.
for (const file of ['meta.js','meta-screens.js','encounters.js']) {
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

// A content-addressed cache installs as one complete release. Do not skipWaiting:
// existing tabs keep their matching code/cache until closed.
const crypto=require('node:crypto');
const assets=['./','./index.html','./PLAY.html','./style.css','./manifest.webmanifest','./icon-192.png','./icon-512.png',...Array.from(read('index.html').matchAll(/<script src="([^"]+)"/g),m=>'./'+m[1])];
const version=crypto.createHash('sha256').update(assets.filter(a=>a!=='./').map(a=>read(a.slice(2))).join('')).digest('hex').slice(0,16);
const worker=`const VERSION=${JSON.stringify(version)}, ASSETS=${JSON.stringify(assets)};
const PREFIX='afterlight-'+encodeURIComponent(self.registration.scope)+'-',CACHE=PREFIX+VERSION;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(ASSETS);}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;const relative='./'+url.pathname.slice(scope.pathname.length);if(!ASSETS.includes(relative))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(new URL(relative,scope).href)||fetch(event.request);})());});
`;
fs.writeFileSync(path.join(__dirname,'sw.js'),worker);
console.log('Offline release '+version+' generated with '+assets.length+' cached assets.');
