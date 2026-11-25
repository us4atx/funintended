// Builds one ready-to-upload folder (and zip) per Netlify site into ./deploy.
//   node scripts/package-sites.mjs
// Client sites: drag-and-drop the zip in Netlify (settings are baked in).
// Backend: needs the Netlify CLI because it includes the API function (see its DEPLOY.txt).
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'deploy');
const API = process.env.FI_API_BASE || 'https://fibackend.netlify.app/api';
const SITES = [
  { name: 'fidemoadmin', app: 'client-admin', clientId: 'demo' },
  { name: 'fidemoemployee', app: 'client-employee', clientId: 'demo' },
  { name: 'fibetaadmin1', app: 'client-admin', clientId: 'beta1' },
  { name: 'fiemployeebeta1', app: 'client-employee', clientId: 'beta1' },
];
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out);
const build = (app, env) => execFileSync('node', [path.join(root, 'scripts/build.mjs'), app], { env: { ...process.env, ...env }, stdio: 'ignore' });
const zip = (dir, name) => execFileSync('zip', ['-qr', path.join(out, `${name}.zip`), '.'], { cwd: dir });

for (const s of SITES) {
  build(s.app, { FI_API_BASE: API, FI_CLIENT_ID: s.clientId });
  const dir = path.join(out, s.name);
  await fs.cp(path.join(root, 'apps', s.app, 'dist'), dir, { recursive: true });
  zip(dir, s.name);
}

// Backend: static panel + function + API code, deployable with one CLI command.
build('backend', { FI_API_BASE: '/api' });
const be = path.join(out, 'fibackend');
await fs.cp(path.join(root, 'apps/backend/dist'), path.join(be, 'site'), { recursive: true });
await fs.cp(path.join(root, 'apps/backend/api'), path.join(be, 'api'), { recursive: true });
await fs.cp(path.join(root, 'apps/backend/netlify/functions'), path.join(be, 'netlify/functions'), { recursive: true });
await fs.cp(path.join(root, 'apps/backend/package.json'), path.join(be, 'package.json'));
const pkg = JSON.parse(await fs.readFile(path.join(be, 'package.json'), 'utf8'));
delete pkg.scripts;
await fs.writeFile(path.join(be, 'package.json'), JSON.stringify(pkg, null, 2));
await fs.writeFile(path.join(be, 'netlify.toml'), `[build]\n  publish = "site"\n  functions = "netlify/functions"\n\n[functions]\n  node_bundler = "esbuild"\n`);
await fs.writeFile(path.join(be, 'DEPLOY.txt'), `FunIntended backend: deploy steps
==================================

The backend includes the API (a Netlify Function), so it can't be drag-and-dropped.
Deploy it with the Netlify CLI (needs Node.js 18+ installed):

1. In Netlify, create the site "fibackend" (Add new site > Deploy manually > drop any file,
   then rename it under Site configuration). Add these environment variables to it:
     SUPABASE_URL               your Supabase Project URL
     SUPABASE_SERVICE_ROLE_KEY  your Supabase service_role key
     FI_SECRET                  any long random string

2. Open a terminal in this folder and run:

     npm install
     npx netlify-cli login
     npx netlify-cli link --name fibackend
     npx netlify-cli deploy --prod

3. Check it works: open https://fibackend.netlify.app/api/health
`);
zip(be, 'fibackend');
await fs.rm(path.join(root, 'apps/backend/dist'), { recursive: true, force: true });
for (const s of SITES) await fs.rm(path.join(root, 'apps', s.app, 'dist'), { recursive: true, force: true });
console.log((await fs.readdir(out)).filter((f) => f.endsWith('.zip')));
