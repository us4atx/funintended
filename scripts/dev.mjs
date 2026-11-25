// Local development server. Runs all three sites plus the API, with data in .dev-data.json.
//   node scripts/dev.mjs                 (DEV_CLIENT=beta1 node scripts/dev.mjs to default to another client)
//   Backend/Admin panel  http://localhost:8801
//   Client Management    http://localhost:8802   (?client=demo or ?client=beta1)
//   Client Employee      http://localhost:8803   (?client=demo or ?client=beta1)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.FI_DEV_STORE ||= path.join(root, '.dev-data.json');
const { handle } = await import('../apps/backend/api/core.mjs');

const apps = { 8801: 'backend', 8802: 'client-admin', 8803: 'client-employee' };
for (const app of Object.values(apps)) {
  execFileSync('node', [path.join(root, 'scripts/build.mjs'), app], { env: { ...process.env, FI_API_BASE: '/api', FI_CLIENT_ID: app === 'backend' ? '' : (process.env.DEV_CLIENT || 'demo') }, stdio: 'inherit' });
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

for (const [port, app] of Object.entries(apps)) {
  http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    // Serve from the source folders so edits show up on refresh.
    const shared = url.pathname.startsWith('/shared/');
    let file = shared ? path.join(root, url.pathname) : path.join(root, 'apps', app, 'public', url.pathname);
    if (url.pathname === '/config.js') file = path.join(root, 'apps', app, 'dist', 'config.js');
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(root, 'apps', app, 'public', 'index.html'); }
    try { res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(await fs.readFile(file)); }
    catch { res.writeHead(404); res.end('Not found'); }
  }).listen(port, () => console.log(`${app.padEnd(16)} http://localhost:${port}`));
}
