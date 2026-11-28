// Builds one site into apps/<app>/dist:
//   - copies apps/<app>/public
//   - copies the shared design system and UI helpers into dist/shared
//   - writes dist/config.js from FI_API_BASE / FI_CLIENT_ID (used by scripts/dev.mjs; on the VPS,
//     vps/server.mjs and vps/make-sites.sh write config.js themselves)
// Usage: node scripts/build.mjs backend|client-admin|client-employee
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = process.argv[2];
if (!['backend', 'client-admin', 'client-employee'].includes(app)) {
  console.error('Usage: node scripts/build.mjs backend|client-admin|client-employee');
  process.exit(1);
}
const appDir = path.join(root, 'apps', app);
const dist = path.join(appDir, 'dist');
await fs.rm(dist, { recursive: true, force: true });
await fs.cp(path.join(appDir, 'public'), dist, { recursive: true });
await fs.cp(path.join(root, 'shared'), path.join(dist, 'shared'), { recursive: true });

const config = {
  apiBase: process.env.FI_API_BASE || (app === 'backend' ? '/api' : 'https://us4-app-funbackend.us4atx.com/api'),
  clientId: process.env.FI_CLIENT_ID || (app === 'backend' ? '' : 'demo'),
  site: app,
};
await fs.writeFile(path.join(dist, 'config.js'), `window.FI_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
console.log(`Built ${app} ->`, path.relative(root, dist), config);
