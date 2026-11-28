#!/usr/bin/env node
// FunIntended provisioning agent. Runs ON THE VPS as root, started by systemd
// (funintended-provision.path when a request file appears, and funintended-provision.timer every
// few minutes to retry anything that is waiting on DNS or a certificate).
//
// The FunIntended backend writes one request per client to  $FI_PROVISION_DIR/requests/<clientId>.json:
//   { "action": "add",    "clientId": "acme", "sites": [{ "host": "us4-site-fun-acmem.us4atx.com", "app": "client-admin" }, ...] }
//   { "action": "remove", "clientId": "acme" }
// For each one this agent:
//   1. checks every hostname is one it may manage (us4-site-fun-*.us4atx.com, nothing else),
//   2. checks DNS points the hostname at this server (waits and retries if not yet),
//   3. writes a Caddy site block to $FI_CADDY_DIR/zz-fi-client-<clientId>.conf that proxies to the
//      FunIntended service, validates and reloads OpenPanel's Caddy (rolls the file back if that fails),
//   4. checks the site answers over HTTPS (Caddy gets the Let's Encrypt certificate by itself),
//   5. writes the outcome to $FI_PROVISION_DIR/status/<clientId>.json, which the backend shows.
// It never touches /etc/funintended.env, OpenPanel's own files, or any other site's config.
//
// Settings come from /etc/funintended-provision.env (written once by install.sh) or the environment.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import { execFileSync } from 'node:child_process';

function loadEnvFile(file) {
  try {
    for (const line of fss.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnvFile(process.env.FI_PROVISION_ENV || '/etc/funintended-provision.env');

const S = {
  dir: process.env.FI_PROVISION_DIR || '/var/lib/funintended/provision',
  domain: (process.env.FI_HOSTING_DOMAIN || 'us4atx.com').toLowerCase(),
  prefix: (process.env.FI_SITE_PREFIX || 'us4-site-fun-').toLowerCase(),
  vpsIp: process.env.FI_VPS_IP || '162.35.50.245',
  caddyDir: process.env.FI_CADDY_DIR || '/etc/openpanel/caddy/domains',
  upstream: process.env.FI_UPSTREAM || '127.0.0.1:8800',
  // Shell commands. Empty = auto-detect the Caddy container (Podman or Docker) and use `caddy validate` / `caddy reload`.
  validateCmd: process.env.FI_CADDY_VALIDATE_CMD || '',
  reloadCmd: process.env.FI_CADDY_RELOAD_CMD || '',
  caddyfile: process.env.FI_CADDYFILE_IN_CONTAINER || '/etc/caddy/Caddyfile',
  fileOwner: process.env.FI_STATUS_OWNER || '', // uid:gid that should be able to read status files
};
const REQ = path.join(S.dir, 'requests');
const STATUS = path.join(S.dir, 'status');
const log = (...a) => console.log('[fi-provision]', ...a);
const now = () => new Date().toISOString();

function isManagedHost(host) {
  if (typeof host !== 'string' || host.length > 253 || !host.endsWith(`.${S.domain}`)) return false;
  const label = host.slice(0, -(S.domain.length + 1));
  return label.startsWith(S.prefix) && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}
const confFile = (id) => path.join(S.caddyDir, `zz-fi-client-${id}.conf`);

function caddyBlock(id, hosts) {
  return `# Managed by the FunIntended provisioning agent (client "${id}"). Do not edit by hand:
# it is rewritten from the FunIntended backend. Removing the client removes this file.
${hosts.join(', ')} {
\tencode gzip
\treverse_proxy ${S.upstream}
}
`;
}

let caddyRunner = null;
function caddy(args) {
  if (!caddyRunner) {
    for (const rt of ['podman', 'docker']) {
      try {
        const names = execFileSync(rt, ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).split('\n').filter(Boolean);
        const name = names.find((n) => /caddy/i.test(n));
        if (name) { caddyRunner = [rt, 'exec', name, 'caddy']; break; }
      } catch {}
    }
    if (!caddyRunner) caddyRunner = ['caddy']; // Caddy on the host itself
  }
  const [cmd, ...pre] = caddyRunner;
  return execFileSync(cmd, [...pre, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
const sh = (cmd) => execFileSync('/bin/sh', ['-c', cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function validateAndReload() {
  if (S.validateCmd) sh(S.validateCmd); else caddy(['validate', '--config', S.caddyfile, '--adapter', 'caddyfile']);
  if (S.reloadCmd) sh(S.reloadCmd); else caddy(['reload', '--config', S.caddyfile, '--adapter', 'caddyfile']);
}

async function writeStatus(id, status) {
  const file = path.join(STATUS, `${id}.json`);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ clientId: id, updatedAt: now(), ...status }, null, 2), { mode: 0o644 });
  if (S.fileOwner) { const [u, g] = S.fileOwner.split(':').map(Number); await fs.chown(tmp, u, g).catch(() => {}); }
  await fs.rename(tmp, file);
}
async function readJson(file) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } }

async function pointsHere(host) {
  try { return (await dns.resolve4(host)).includes(S.vpsIp); } catch { return false; }
}
async function httpsOk(host) {
  try {
    const r = await fetch(`https://${host}/`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return r.status < 500;
  } catch { return false; }
}

async function swapConf(file, content) {
  const before = await fs.readFile(file, 'utf8').catch(() => null);
  if (before === content) return false;
  if (content === null) await fs.rm(file, { force: true }); else await fs.writeFile(file, content, { mode: 0o644 });
  try { validateAndReload(); }
  catch (e) {
    // Put things back the way they were so one bad request can't break the other sites.
    if (before === null) await fs.rm(file, { force: true }); else await fs.writeFile(file, before);
    try { validateAndReload(); } catch {}
    throw new Error(`Caddy rejected the change: ${String(e.stderr || e.message).trim().slice(0, 400)}`);
  }
  return true;
}

async function hostsDefinedElsewhere(id, hosts) {
  const found = new Set();
  const mine = path.basename(confFile(id));
  for (const f of await fs.readdir(S.caddyDir).catch(() => [])) {
    if (f === mine) continue;
    const text = await fs.readFile(path.join(S.caddyDir, f), 'utf8').catch(() => '');
    for (const h of hosts) if (new RegExp(`(^|[\\s,/])${h.replace(/[.-]/g, '\\$&')}(?=[\\s,:{]|$)`, 'm').test(text)) found.add(h);
  }
  return found;
}

async function handleAdd(id, req) {
  const sites = Array.isArray(req.sites) ? req.sites : [];
  const bad = sites.filter((s) => !isManagedHost(String(s.host || '').toLowerCase()) || !['client-admin', 'client-employee'].includes(s.app));
  if (!sites.length || bad.length) {
    await writeStatus(id, { state: 'error', message: `Refused: only ${S.prefix}*.${S.domain} client sites can be set up here (${bad.map((s) => s.host).join(', ') || 'no sites'}).` });
    await fs.rm(path.join(REQ, `${id}.json`), { force: true });
    return;
  }
  const hosts = [...new Set(sites.map((s) => s.host.toLowerCase()))];
  // Hosts another config file already serves (e.g. the original demo / beta1 sites in
  // zz-funintended-custom.conf) are left alone: a second block for them would make Caddy refuse the config.
  const elsewhere = await hostsDefinedElsewhere(id, hosts);
  const ours = hosts.filter((h) => !elsewhere.has(h));
  const prev = await readJson(path.join(STATUS, `${id}.json`));
  const content = ours.length ? caddyBlock(id, ours) : null;
  const current = await fs.readFile(confFile(id), 'utf8').catch(() => null);
  if (prev?.state === 'live' && current === content && prev.requestedAt === req.requestedAt) return; // nothing to do

  const dnsOk = Object.fromEntries(await Promise.all(hosts.map(async (h) => [h, await pointsHere(h)])));
  const missing = hosts.filter((h) => !dnsOk[h]);
  if (missing.length) {
    await writeStatus(id, { state: 'waiting_dns', requestedAt: req.requestedAt, hosts: hosts.map((h) => ({ host: h, dns: dnsOk[h], https: false })),
      message: `Waiting for DNS: ${missing.join(', ')} must point to ${S.vpsIp}. A wildcard A record *.${S.domain} → ${S.vpsIp} covers every new client. Retrying every few minutes.` });
    return;
  }
  await writeStatus(id, { state: 'working', requestedAt: req.requestedAt, message: 'Adding the sites to the web server.' });
  const changed = await swapConf(confFile(id), content);
  if (changed) log(`client ${id}: Caddy block ${content ? `written for ${ours.join(', ')}` : 'not needed'}${elsewhere.size ? ` (already served elsewhere: ${[...elsewhere].join(', ')})` : ''}`);

  // Caddy fetches the certificate in the background; give it a moment on the first run.
  let https = {};
  for (let i = 0; i < (changed ? 6 : 1); i++) {
    https = Object.fromEntries(await Promise.all(hosts.map(async (h) => [h, await httpsOk(h)])));
    if (hosts.every((h) => https[h])) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const live = hosts.every((h) => https[h]);
  await writeStatus(id, {
    state: live ? 'live' : 'issuing_cert', requestedAt: req.requestedAt,
    hosts: hosts.map((h) => ({ host: h, dns: true, https: !!https[h] })),
    message: live ? `Live: ${hosts.map((h) => `https://${h}`).join(' and ')}` : 'Web server updated. Waiting for the HTTPS certificate; this is re-checked every few minutes.',
  });
}

async function handleRemove(id) {
  const changed = await swapConf(confFile(id), null);
  if (changed) log(`client ${id}: Caddy block removed`);
  await writeStatus(id, { state: 'removed', message: 'Sites removed from the web server.' });
  await fs.rm(path.join(REQ, `${id}.json`), { force: true });
}

async function main() {
  await fs.mkdir(STATUS, { recursive: true });
  const files = (await fs.readdir(REQ).catch(() => [])).filter((f) => /^[a-z0-9-]{1,40}\.json$/.test(f));
  for (const f of files) {
    const id = f.slice(0, -5);
    const req = await readJson(path.join(REQ, f));
    try {
      if (!req || req.clientId !== id) throw new Error('Unreadable request');
      if (req.action === 'remove') await handleRemove(id);
      else await handleAdd(id, req);
    } catch (e) {
      log(`client ${id}: ${e.message}`);
      await writeStatus(id, { state: 'error', requestedAt: req?.requestedAt, message: e.message }).catch(() => {});
    }
  }
}

// One run at a time (the path unit and the timer can both fire).
const lock = path.join(S.dir, '.lock');
let fd;
try { fd = fss.openSync(lock, 'wx'); } catch {
  const age = Date.now() - (fss.statSync(lock, { throwIfNoEntry: false })?.mtimeMs || 0);
  if (age < 10 * 60e3) { log('another run is in progress'); process.exit(0); }
  fss.rmSync(lock, { force: true }); fd = fss.openSync(lock, 'wx');
}
try { await main(); } finally { fss.closeSync(fd); fss.rmSync(lock, { force: true }); }
