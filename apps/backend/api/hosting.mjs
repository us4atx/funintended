// Client hosting on our own VPS (Ubuntu, 162.35.50.245, sites under us4atx.com).
//
// Every client gets two sites on the VPS:
//   https://us4-site-fun-<clientId>m.us4atx.com   Management site
//   https://us4-site-fun-<clientId>e.us4atx.com   Employee site
//
// The FunIntended server (vps/server.mjs) serves any site the client list knows about straight
// away. What it cannot do itself is the web-server side (HTTPS certificate + reverse proxy in
// OpenPanel's Caddy), because that needs root. So the backend drops a small request file into
// FI_PROVISION_DIR/requests/ and the root-owned provisioning agent on the VPS
// (vps/provisioner/fi-provision.mjs, run by systemd) picks it up, checks DNS, adds the Caddy
// site block, reloads Caddy and writes the result to FI_PROVISION_DIR/status/.
//
// Settings (all optional, defaults match the live VPS):
//   FI_HOSTING_DOMAIN   us4atx.com
//   FI_SITE_PREFIX      us4-site-fun-
//   FI_BACKEND_HOST     us4-app-funbackend.us4atx.com
//   FI_VPS_IP           162.35.50.245
//   FI_PROVISION_DIR    /var/lib/funintended/provision  (auto-provisioning is on when this folder exists)
import fs from 'node:fs/promises';
import path from 'node:path';

const env = (k, d) => process.env[k] || d;
export const hostingSettings = () => ({
  domain: env('FI_HOSTING_DOMAIN', 'us4atx.com').toLowerCase(),
  prefix: env('FI_SITE_PREFIX', 'us4-site-fun-').toLowerCase(),
  backendHost: env('FI_BACKEND_HOST', 'us4-app-funbackend.us4atx.com').toLowerCase(),
  vpsIp: env('FI_VPS_IP', '162.35.50.245'),
  dir: env('FI_PROVISION_DIR', '/var/lib/funintended/provision'),
});

export const apiBase = () => `https://${hostingSettings().backendHost}/api`;

// The standard addresses for a client's two sites.
export function defaultSites(clientId) {
  const { prefix, domain } = hostingSettings();
  return {
    adminUrl: `https://${prefix}${clientId}m.${domain}`,
    employeeUrl: `https://${prefix}${clientId}e.${domain}`,
  };
}

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

// A hostname the provisioning agent is allowed to manage: one label under our domain, starting with the prefix.
export function isManagedHost(host) {
  const { prefix, domain } = hostingSettings();
  if (!host || host.length > 253 || !host.endsWith(`.${domain}`)) return false;
  const label = host.slice(0, -(domain.length + 1));
  return label.startsWith(prefix) && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

// The sites to host for a client: its saved URLs when they are managed hosts, otherwise the standard ones.
export function sitesToHost(client) {
  const std = defaultSites(client.id);
  const pick = (u, d) => (isManagedHost(hostOf(u)) ? `https://${hostOf(u)}` : d);
  return { adminUrl: pick(client.sites?.adminUrl, std.adminUrl), employeeUrl: pick(client.sites?.employeeUrl, std.employeeUrl) };
}

// Old Netlify addresses of the first two clients, now served from the VPS.
const LEGACY = {
  'fidemoadmin.netlify.app': 'us4-site-fun-demo1m.us4atx.com',
  'fidemoemployee.netlify.app': 'us4-site-fun-demo1e.us4atx.com',
  'fibetaadmin1.netlify.app': 'us4-site-fun-beta1m.us4atx.com',
  'fiemployeebeta1.netlify.app': 'us4-site-fun-beta1e.us4atx.com',
};
// Rewrites a client's old Netlify site URLs in place. Returns true when something changed.
export function migrateLegacySites(client) {
  let changed = false;
  for (const k of ['adminUrl', 'employeeUrl']) {
    const h = hostOf(client.sites?.[k]);
    if (LEGACY[h]) { client.sites[k] = `https://${LEGACY[h]}`; changed = true; }
    else if (h.endsWith('.netlify.app')) { client.sites[k] = defaultSites(client.id)[k]; changed = true; }
  }
  return changed;
}

async function agentInstalled() {
  try { return (await fs.stat(path.join(hostingSettings().dir, 'requests'))).isDirectory(); } catch { return false; }
}

export async function hostingInfo() {
  const s = hostingSettings();
  return { provider: 'vps', server: s.vpsIp, domain: s.domain, backendHost: s.backendHost, siteHostPattern: `${s.prefix}<client-id>m / e.${s.domain}`, autoProvisioning: await agentInstalled() };
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}
const safeId = (id) => (/^[a-z0-9-]{1,40}$/.test(id) ? id : null);

// Queue hosting for a client's two sites. Returns { sites, hosting }.
export async function provisionHosting(client) {
  const sites = sitesToHost(client);
  const id = safeId(client.id);
  if (!id) return { sites, hosting: { state: 'error', message: 'Client id can only use a-z, 0-9 and -' } };
  if (!(await agentInstalled())) {
    return { sites, hosting: { state: 'manual', message: 'The VPS provisioning agent is not installed on this server, so the two sites must be added by hand (see Hosting).' } };
  }
  const request = {
    action: 'add', clientId: id, requestedAt: new Date().toISOString(),
    sites: [{ host: hostOf(sites.adminUrl), app: 'client-admin' }, { host: hostOf(sites.employeeUrl), app: 'client-employee' }],
  };
  await writeAtomic(path.join(hostingSettings().dir, 'requests', `${id}.json`), request);
  return { sites, hosting: { state: 'queued', message: 'Hosting requested. The VPS sets up the two sites and their HTTPS certificates, usually within a minute or two.', requestedAt: request.requestedAt } };
}

export async function removeHosting(clientId) {
  const id = safeId(clientId);
  if (!id || !(await agentInstalled())) return null;
  await writeAtomic(path.join(hostingSettings().dir, 'requests', `${id}.json`), { action: 'remove', clientId: id, requestedAt: new Date().toISOString() });
  return { state: 'removing' };
}

// The agent's latest report for a client, or a best guess when there is none yet.
export async function hostingStatus(clientId) {
  const id = safeId(clientId);
  if (!id) return null;
  const { dir } = hostingSettings();
  try { return JSON.parse(await fs.readFile(path.join(dir, 'status', `${id}.json`), 'utf8')); } catch {}
  try { await fs.access(path.join(dir, 'requests', `${id}.json`)); return { state: 'queued' }; } catch {}
  return null;
}
