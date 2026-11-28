// FunIntended VPS server: one Node process for all 5 sites, behind the HTTPS reverse proxy.
// Routes by Host header: /api/* on the backend host goes to the API; everything else is static
// from sites/<host>/ with SPA fallback to index.html. Data: self-hosted Supabase (settings in /etc/funintended.env).
// Every client site (including ones added later from the backend) is served from the release it is pinned
// to (FI_RELEASES_DIR/<release>/<site>/, see api/releases.mjs) with a generated config.js, as soon as the
// client exists; sites/<host>/ is only a fallback. The HTTPS side
// (Caddy block + certificate) is added by the provisioning agent, see provisioner/fi-provision.mjs.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const { handle, resolveSiteHost } = await import('./api/core.mjs');
const { publishCurrentRelease, releaseAppDir } = await import('./api/releases.mjs');
// Keep a copy of this deploy's client sites as a versioned release (see api/releases.mjs).
const REVISION = (await fs.readFile(path.join(root, 'REVISION'), 'utf8').catch(() => '')).trim();
await publishCurrentRelease(path.join(root, 'app'), REVISION)
  .then((r) => console.log(r.created ? `Published release ${r.id}` : `Release ${r.id} already published`))
  .catch((e) => console.error('Could not publish release:', e.message));
const BACKEND = process.env.FI_BACKEND_HOST || 'us4-app-funbackend.us4atx.com';
const PORT = Number(process.env.PORT || 8800);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const sites = new Set(await fs.readdir(path.join(root, 'sites')).catch(() => []));
const API_BASE = `https://${BACKEND}/api`;
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
    // Client sites: served from the release the backend has them on (Releases page), else from this deploy's app/.
    let base, dyn = host === BACKEND ? null : await resolveSiteHost(host).catch(() => null), appRoot = null;
    if (dyn) { appRoot = (dyn.version && (await releaseAppDir(dyn.version, dyn.app))) || path.join(root, 'app'); base = path.join(appRoot, dyn.app); }
    else if (sites.has(host)) base = path.join(root, 'sites', host);
    else { res.writeHead(404); res.end('Unknown site'); return; }
    if (dyn && url.pathname === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' });
      res.end(`window.FI_CONFIG = ${JSON.stringify({ apiBase: API_BASE, clientId: dyn.clientId, site: dyn.app, version: dyn.version || 'current' })};\n`);
      return;
    }
    const siteBase = base;
    if (dyn && url.pathname.startsWith('/shared/')) base = appRoot;
    let file = path.normalize(path.join(base, decodeURIComponent(url.pathname)));
    if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(400); res.end(); return; }
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(siteBase, 'index.html'); }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('.html') || file.endsWith('config.js') ? 'no-cache' : 'public, max-age=300' });
    res.end(body);
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end('Server error'); }
}).listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`FunIntended on ${process.env.HOST || '127.0.0.1'}:${PORT}`));
