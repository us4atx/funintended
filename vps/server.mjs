// FunIntended VPS server: one Node process for all 5 sites, behind the HTTPS reverse proxy.
// Routes by Host header: /api/* on the backend host goes to the API; everything else is static
// from sites/<host>/ with SPA fallback to index.html. Data: JSON file at FI_DEV_STORE.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const { handle } = await import('./api/core.mjs');
const BACKEND = process.env.FI_BACKEND_HOST || 'us4-app-funbackend.us4atx.com';
const PORT = Number(process.env.PORT || 8800);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const sites = new Set(await fs.readdir(path.join(root, 'sites')));
http.createServer(async (req, res) => {
  try {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
    const url = new URL(req.url, `https://${host}`);
    if (host === BACKEND && (url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (!sites.has(host)) { res.writeHead(404); res.end('Unknown site'); return; }
    const base = path.join(root, 'sites', host);
    let file = path.normalize(path.join(base, decodeURIComponent(url.pathname)));
    if (!file.startsWith(base)) { res.writeHead(400); res.end(); return; }
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(base, 'index.html'); }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('.html') || file.endsWith('config.js') ? 'no-cache' : 'public, max-age=300' });
    res.end(body);
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end('Server error'); }
}).listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`FunIntended on ${process.env.HOST || '127.0.0.1'}:${PORT}`));
