// Versioned releases of the client sites (Management + Employee front-ends).
//
// Every deploy of FunIntended that carries a new version (api/version.mjs) is copied once into
//   FI_RELEASES_DIR/<release id>/{client-admin,client-employee,shared}/  + release.json
// by vps/server.mjs when it starts. Old releases stay there, so each client site can keep running the
// release it is on while the latest one is rolled out site by site from the backend (Releases page).
// The backend panel and the API always run the newest code, so API changes must stay backward
// compatible with the releases still in use.
//
// FI_RELEASES_DIR defaults to /var/lib/funintended/releases (outside /opt/funintended so deploys keep it).
import fs from 'node:fs/promises';
import path from 'node:path';
import { VERSION, RELEASE_NOTES } from './version.mjs';

export const releasesDir = () => process.env.FI_RELEASES_DIR || '/var/lib/funintended/releases';
export const SITE_APPS = ['client-admin', 'client-employee'];
const ID_RE = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,40}$/;

// Compare "1.2.10" style versions (anything after "-" / "+" breaks ties by creation time elsewhere).
export function compareVersions(a, b) {
  const pa = String(a).split(/[-+]/)[0].split('.').map(Number), pb = String(b).split(/[-+]/)[0].split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}

// All releases on disk, newest first.
export async function listReleases() {
  const dir = releasesDir();
  const out = [];
  for (const id of await fs.readdir(dir).catch(() => [])) {
    if (!ID_RE.test(id)) continue;
    try { out.push({ id, ...JSON.parse(await fs.readFile(path.join(dir, id, 'release.json'), 'utf8')) }); } catch {}
  }
  return out.sort((a, b) => compareVersions(b.version, a.version) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function releaseExists(id) {
  if (!id || !ID_RE.test(id)) return false;
  try { await fs.access(path.join(releasesDir(), id, 'release.json')); return true; } catch { return false; }
}

// Folder to serve a client site from, for a release (null = not on disk).
export async function releaseAppDir(id, app) {
  if (!(await releaseExists(id)) || !SITE_APPS.includes(app)) return null;
  return path.join(releasesDir(), id);
}

// Called by vps/server.mjs at start-up: store the running code as a release if it is new.
// appRoot holds client-admin/, client-employee/ and shared/ (the deploy's app/ folder).
export async function publishCurrentRelease(appRoot, sha = '') {
  const dir = releasesDir();
  await fs.mkdir(dir, { recursive: true });
  const existing = await listReleases();
  const same = existing.find((r) => r.version === VERSION && (!sha || !r.sha || r.sha === sha));
  if (same) return { id: same.id, created: false };
  // Same version number but different code (forgot to bump): keep both, tagged with the commit.
  let id = existing.some((r) => r.id === VERSION) ? `${VERSION}+${(sha || Date.now().toString(36)).slice(0, 7)}` : VERSION;
  if (!ID_RE.test(id)) throw new Error(`Bad release id ${id}`);
  const tmp = path.join(dir, `.${id}.tmp`);
  await fs.rm(tmp, { recursive: true, force: true });
  for (const a of [...SITE_APPS, 'shared']) await fs.cp(path.join(appRoot, a), path.join(tmp, a), { recursive: true });
  await fs.writeFile(path.join(tmp, 'release.json'), JSON.stringify({ version: VERSION, sha, notes: RELEASE_NOTES, createdAt: new Date().toISOString() }, null, 2));
  await fs.rename(tmp, path.join(dir, id));
  return { id, created: true };
}
