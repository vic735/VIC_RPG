// Optional local/LAN server for phone play. No packages required.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const port = Number(process.env.PORT || 8000);
const allowed = new Set(['index.html', 'meta.js', 'meta-screens.js', 'content-v1.js', 'classes.js', 'achievements.js', 'sw.js', 'offline.js', 'pwa-install.js', 'run-save.js', 'level-up.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'PLAY.html', 'combat-content.js', 'skill-runtime.js', 'world-content.js', 'world-rewards.js', 'world-debug.js', 'data.js', 'engine.js', 'progression.js', 'world.js', 'renderer.js', 'ui.js', 'screens.js', 'audio.js', 'debug-lab.js', 'app.js', 'style.css']);
const server = http.createServer((req, res) => {
  let name; try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; } catch (_) { res.writeHead(400).end(); return; }
  if (!allowed.has(name)) { res.writeHead(404).end('Not found'); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  const file = path.join(__dirname, name), type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/javascript';
  fs.readFile(file, (err, content) => { if (err) { res.writeHead(500).end('Unable to read game file'); return; } res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : content); });
});
server.on('error', err => { console.error('Unable to start server:', err.message); process.exitCode = 1; });
server.listen(port, '0.0.0.0', () => { console.log('AFTERLIGHT: http://localhost:' + port); for (const entries of Object.values(os.networkInterfaces())) for (const address of entries || []) if (address.family === 'IPv4' && !address.internal) console.log('Phone on same Wi-Fi: http://' + address.address + ':' + port); console.log('Keep this window open. Ctrl+C to stop.'); });
