// FunIntended central API. One handler serves every site:
//   - the Backend/Administration panel (platform admins)
//   - each client's Management site (client admins and managers)
//   - each client's Employee site (employees)
// On the VPS it runs inside vps/server.mjs (us4-app-funbackend.us4atx.com/api); locally, inside scripts/dev.mjs.
import crypto from 'node:crypto';
import { getDoc, setDoc, deleteDoc } from './store.mjs';
import { platformSeed, newClientDoc, demoData, MODULES, SUB_FEATURES } from './seed.mjs';
import { provisionHosting, removeHosting, hostingStatus, hostingInfo, defaultSites, migrateLegacySites, apiBase } from './hosting.mjs';

const SECRET = () => process.env.FI_SECRET || 'dev-secret-change-me';
const CLIENT_COLLECTIONS = ['users', 'posts', 'orders', 'assignments', 'mentorships', 'sessions', 'results', 'events', 'games', 'courses', 'rewards'];
const CATALOGS = ['games', 'courses', 'rewards'];

// ---------- helpers ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const uid = (p = '') => p + crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function corsHeaders() {
  return {
    'access-control-allow-origin': process.env.FI_ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...corsHeaders() } });

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 36e5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET()).update(body || '').digest('base64url');
  if (!sig || sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
}
const strip = (u) => { if (!u) return u; const { passwordHash, ...rest } = u; return rest; };
const tempPassword = () => crypto.randomBytes(5).toString('hex');

// ---------- data access ----------
async function loadPlatform() {
  let p = await getDoc('platform');
  if (!p) {
    p = platformSeed();
    p.admins.push({
      id: uid('adm-'), name: 'Platform Owner',
      email: (process.env.FI_ADMIN_EMAIL || 'admin@funintended.app').toLowerCase(),
      passwordHash: hashPassword(process.env.FI_ADMIN_PASSWORD || 'changeme'), createdAt: now(),
    });
    // First run: create the demo client and the first beta client so the
    // sites already set up on the VPS have something to connect to.
    const demoPw = hashPassword('demo1234');
    const demo = demoData(newClientDoc({ id: 'demo', name: 'Acme Corp', plan: 'demo',
      sites: { adminUrl: 'https://us4-site-fun-demo1m.us4atx.com', employeeUrl: 'https://us4-site-fun-demo1e.us4atx.com' } }), demoPw);
    demo.users.push({ id: 'u-admin', name: 'Acme Admin', email: 'admin@acme.demo', role: 'client_admin', title: 'HR Director', department: 'People', points: 0, passwordHash: demoPw, active: true, createdAt: now() });
    const beta = newClientDoc({ id: 'beta1', name: 'Beta Client 1', plan: 'beta',
      sites: { adminUrl: 'https://us4-site-fun-beta1m.us4atx.com', employeeUrl: 'https://us4-site-fun-beta1e.us4atx.com' } });
    beta.users.push({ id: uid('u-'), name: 'Beta Admin', email: 'admin@beta1.client', role: 'client_admin', title: 'Administrator', department: '', points: 0, passwordHash: demoPw, active: true, createdAt: now() });
    for (const c of [demo, beta]) {
      await setDoc(`client/${c.client.id}`, c);
      p.clients.push(indexEntry(c.client));
    }
    await setDoc('platform', p);
  }
  // One-time move of old Netlify site addresses to the VPS ones.
  if (p.clients.some((c) => migrateLegacySites(c))) await setDoc('platform', p);
  return p;
}
const indexEntry = (c) => ({ id: c.id, name: c.name, status: c.status, plan: c.plan, createdAt: c.createdAt, sites: c.sites });

async function loadClient(id) {
  const c = await getDoc(`client/${id}`);
  if (!c) fail(404, 'Client not found');
  if (migrateLegacySites(c.client)) await setDoc(`client/${id}`, c);
  return c;
}

// Which client site a hostname belongs to (used by vps/server.mjs to serve newly provisioned sites).
let siteCache = { at: 0, map: new Map() };
export async function resolveSiteHost(host) {
  if (Date.now() - siteCache.at > 15000) {
    const p = await loadPlatform();
    const map = new Map();
    const h = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
    for (const c of p.clients) {
      if (c.sites?.adminUrl) map.set(h(c.sites.adminUrl), { app: 'client-admin', clientId: c.id });
      if (c.sites?.employeeUrl) map.set(h(c.sites.employeeUrl), { app: 'client-employee', clientId: c.id });
    }
    map.delete('');
    siteCache = { at: Date.now(), map };
  }
  return siteCache.map.get(host) || null;
}
const saveClient = (doc) => setDoc(`client/${doc.client.id}`, doc);

function audit(p, who, action, detail) {
  p.audit = [{ at: now(), who, action, detail }, ...(p.audit || [])].slice(0, 200);
}

// Merge platform catalog + client additions, minus anything the client hid.
function catalogFor(p, doc, type) {
  const hidden = new Set(doc.client.hidden?.[type] || []);
  return [...(p.catalogs[type] || []), ...(doc[type] || []).map((x) => ({ ...x, custom: true }))]
    .filter((x) => !hidden.has(x.id) && !x.archived);
}
function pagesFor(p, doc) {
  const out = {};
  for (const [k, v] of Object.entries(p.pages)) out[k] = { ...v, ...(doc.client.pageOverrides?.[k] || {}) };
  return out;
}

// ---------- permissions ----------
const isPlatform = (s) => s?.role === 'platform';
const isClientAdmin = (s, cid) => isPlatform(s) || (s?.clientId === cid && s.role === 'client_admin');
const isManager = (s, cid) => isClientAdmin(s, cid) || (s?.clientId === cid && s.role === 'manager');
const isMember = (s, cid) => isPlatform(s) || s?.clientId === cid;
const need = (ok, msg = 'Not allowed') => { if (!ok) fail(403, msg); };

// ---------- main handler ----------
export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const session = verify((req.headers.get('authorization') || '').replace(/^Bearer /, ''));
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await req.json().catch(() => ({})) : {};
    const ctx = { req, url, parts, session, body, method: req.method };
    const result = await route(ctx);
    return result instanceof Response ? result : json(result ?? { ok: true });
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return json({ error: e.message || 'Server error' }, e.status || 500);
  }
}

async function route(ctx) {
  const { parts, method, session, body } = ctx;
  const [a, b, c, d] = parts;

  if (a === 'health') return { ok: true, time: now(), hosting: await hostingInfo() };

  // --- auth ---
  if (a === 'auth' && b === 'login' && method === 'POST') return login(body);
  if (a === 'auth' && b === 'me') {
    need(session, 'Not signed in');
    if (isPlatform(session)) return { role: 'platform', user: strip((await loadPlatform()).admins.find((x) => x.id === session.userId)) };
    const doc = await loadClient(session.clientId);
    return { role: session.role, clientId: session.clientId, user: strip(doc.users.find((x) => x.id === session.userId)) };
  }

  // --- public site bootstrap (branding, features, page content) ---
  if (a === 'site' && b && method === 'GET') {
    const p = await loadPlatform();
    const doc = await loadClient(b);
    const cl = doc.client;
    if (cl.status !== 'active') fail(403, 'This site is not active');
    return { id: cl.id, name: cl.name, branding: cl.branding, features: cl.features, modules: MODULES, pages: pagesFor(p, doc), recognition: cl.recognition, sites: cl.sites };
  }

  // --- platform administration ---
  if (a === 'platform') { need(isPlatform(session)); return platformRoutes(ctx); }
  if (a === 'clients') { need(isPlatform(session)); return clientRoutes(ctx); }

  // --- client-scoped data (/api/c/:clientId/...) ---
  if (a === 'c' && b) { need(isMember(session, b), 'Sign in to this client first'); return clientDataRoutes(ctx, b, c, d); }

  fail(404, 'Unknown endpoint');
}

async function login({ email, password, clientId }) {
  email = String(email || '').trim().toLowerCase();
  if (!clientId) {
    const p = await loadPlatform();
    const u = p.admins.find((x) => x.email === email);
    if (!u || !checkPassword(password, u.passwordHash)) fail(401, 'Wrong email or password');
    return { token: sign({ role: 'platform', userId: u.id }), user: strip(u), role: 'platform' };
  }
  await loadPlatform();
  const doc = await loadClient(clientId);
  const u = doc.users.find((x) => x.email === email && x.active !== false);
  if (!u || !checkPassword(password, u.passwordHash)) fail(401, 'Wrong email or password');
  return { token: sign({ role: u.role, userId: u.id, clientId }), user: strip(u), role: u.role };
}

// ---------- /api/platform/... ----------
async function platformRoutes({ parts, method, body, session }) {
  const [, section, id] = parts;
  const p = await loadPlatform();
  const save = async (what) => { audit(p, session.userId, what, section); await setDoc('platform', p); };

  if (section === 'overview') {
    const clients = [];
    for (const entry of p.clients) {
      const doc = await getDoc(`client/${entry.id}`);
      if (!doc) continue;
      clients.push({ ...entry, users: doc.users.length, posts: doc.posts.length, orders: doc.orders.length,
        pointsAwarded: doc.posts.reduce((s, x) => s + (x.points || 0), 0) });
    }
    return { clients, catalogs: Object.fromEntries(CATALOGS.map((k) => [k, p.catalogs[k].length])), admins: p.admins.length, audit: p.audit.slice(0, 20), hosting: await hostingInfo() };
  }
  if (section === 'features') {
    if (method === 'GET') return { modules: MODULES, subFeatures: SUB_FEATURES };
  }
  if (section === 'pages') {
    if (method === 'GET') return p.pages;
    if (method === 'PUT') { p.pages = { ...p.pages, ...body }; await save('update pages'); return p.pages; }
  }
  if (section === 'admins') {
    if (method === 'GET') return p.admins.map(strip);
    if (method === 'POST') {
      if (!body.email || !body.password) fail(400, 'Email and password are required');
      if (p.admins.some((x) => x.email === body.email.toLowerCase())) fail(409, 'That email is already an admin');
      const u = { id: uid('adm-'), name: body.name || body.email, email: body.email.toLowerCase(), passwordHash: hashPassword(body.password), createdAt: now() };
      p.admins.push(u); await save('add admin'); return strip(u);
    }
    if (method === 'PUT' && id) {
      const u = p.admins.find((x) => x.id === id) || fail(404, 'Admin not found');
      if (body.name) u.name = body.name;
      if (body.email) u.email = body.email.toLowerCase();
      if (body.password) u.passwordHash = hashPassword(body.password);
      await save('update admin'); return strip(u);
    }
    if (method === 'DELETE' && id) {
      if (p.admins.length <= 1) fail(400, 'You cannot remove the last admin');
      p.admins = p.admins.filter((x) => x.id !== id); await save('remove admin'); return { ok: true };
    }
  }
  if (CATALOGS.includes(section)) {
    const list = p.catalogs[section];
    if (method === 'GET') return list;
    if (method === 'POST') { const item = { id: uid(section[0] + '-'), ...body }; list.push(item); await save(`add ${section}`); return item; }
    if (method === 'PUT' && id) { const i = list.findIndex((x) => x.id === id); if (i < 0) fail(404, 'Not found'); list[i] = { ...list[i], ...body, id }; await save(`update ${section}`); return list[i]; }
    if (method === 'DELETE' && id) { p.catalogs[section] = list.filter((x) => x.id !== id); await save(`delete ${section}`); return { ok: true }; }
  }
  fail(404, 'Unknown platform endpoint');
}

// ---------- /api/clients/... (platform admins provisioning clients) ----------
async function clientRoutes({ parts, method, body, session }) {
  const [, id, sub, subId] = parts;
  const p = await loadPlatform();

  if (!id && method === 'GET') return p.clients;

  if (!id && method === 'POST') {
    // Provision a new client: client record + first admin + the two sites.
    const name = String(body.name || '').trim() || fail(400, 'Client name is required');
    const cid = slugify(body.id || name);
    if (!cid) fail(400, 'Client id is required');
    if (p.clients.some((x) => x.id === cid)) fail(409, `A client with id "${cid}" already exists`);
    const std = defaultSites(cid);
    const doc = newClientDoc({ id: cid, name, plan: body.plan || 'standard', features: body.features, branding: body.branding,
      sites: { adminUrl: body.adminUrl || std.adminUrl, employeeUrl: body.employeeUrl || std.employeeUrl } });
    const password = body.adminPassword || tempPassword();
    const adminEmail = String(body.adminEmail || `admin@${cid}.client`).toLowerCase();
    doc.users.push({ id: uid('u-'), name: body.adminName || 'Client Admin', email: adminEmail, role: 'client_admin', title: 'Administrator', department: '', points: 0, passwordHash: hashPassword(password), active: true, createdAt: now() });
    if (body.seedDemo) demoData(doc, hashPassword(password));
    await saveClient(doc);
    p.clients.push(indexEntry(doc.client));
    audit(p, session.userId, 'provision client', cid);
    await setDoc('platform', p);
    // New clients get their two sites on the VPS automatically (unless turned off in the form).
    let hosting = null;
    if (body.autoHosting !== false) {
      const r = await provisionHosting(doc.client).catch((e) => ({ hosting: { state: 'error', message: e.message } }));
      hosting = r.hosting;
      if (r.sites) {
        doc.client.sites = { ...doc.client.sites, ...r.sites };
        doc.client.hosting = { provider: 'vps', requestedAt: hosting?.requestedAt || now() };
        await saveClient(doc);
        Object.assign(p.clients.find((x) => x.id === cid), indexEntry(doc.client));
        await setDoc('platform', p);
        siteCache.at = 0;
      }
    }
    return { client: doc.client, credentials: { email: adminEmail, password }, sites: siteInfo(doc.client), hosting };
  }

  const doc = await loadClient(id);

  if (!sub) {
    if (method === 'GET') return { ...doc.client, counts: Object.fromEntries(CLIENT_COLLECTIONS.map((k) => [k, (doc[k] || []).length])), siteInfo: siteInfo(doc.client), hostingStatus: await hostingStatus(id).catch(() => null) };
    if (method === 'PUT') {
      const allowed = ['name', 'plan', 'status', 'features', 'branding', 'sites', 'pageOverrides', 'hidden', 'recognition'];
      for (const k of allowed) if (k in body) doc.client[k] = typeof body[k] === 'object' && !Array.isArray(body[k]) ? { ...doc.client[k], ...body[k] } : body[k];
      await saveClient(doc);
      Object.assign(p.clients.find((x) => x.id === id), indexEntry(doc.client));
      audit(p, session.userId, 'update client', id);
      await setDoc('platform', p);
      siteCache.at = 0;
      return doc.client;
    }
    if (method === 'DELETE') {
      await deleteDoc(`client/${id}`);
      p.clients = p.clients.filter((x) => x.id !== id);
      audit(p, session.userId, 'delete client', id);
      await setDoc('platform', p);
      siteCache.at = 0;
      // Take the client's sites off the VPS too.
      await removeHosting(id).catch((e) => console.error('remove hosting', id, e));
      return { ok: true };
    }
  }
  if (sub === 'hosting' && method === 'POST') {
    // (Re)run hosting setup on the VPS for this client's two sites.
    const r = await provisionHosting(doc.client);
    doc.client.sites = { ...doc.client.sites, ...r.sites };
    doc.client.hosting = { provider: 'vps', requestedAt: r.hosting?.requestedAt || now() };
    await saveClient(doc);
    Object.assign(p.clients.find((x) => x.id === id), indexEntry(doc.client));
    audit(p, session.userId, 'set up hosting', id);
    await setDoc('platform', p);
    siteCache.at = 0;
    return r;
  }
  if (sub === 'hosting' && method === 'GET') return (await hostingStatus(id)) || { state: 'none' };
  if (sub === 'users') return userRoutes(doc, method, subId, body, true);
  fail(404, 'Unknown client endpoint');
}

// Where a client's two sites live and what they are configured with.
function siteInfo(cl) {
  const api = apiBase();
  return {
    admin: { url: cl.sites.adminUrl, app: 'client-admin', config: { apiBase: api, clientId: cl.id } },
    employee: { url: cl.sites.employeeUrl, app: 'client-employee', config: { apiBase: api, clientId: cl.id } },
  };
}

async function userRoutes(doc, method, id, body, canManage) {
  if (method === 'GET' && !id) return doc.users.map(strip);
  need(canManage);
  if (method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase() || fail(400, 'Email is required');
    if (doc.users.some((x) => x.email === email)) fail(409, 'A user with that email already exists');
    const password = body.password || tempPassword();
    const u = { id: uid('u-'), name: body.name || email, email, role: body.role || 'employee', title: body.title || '', department: body.department || '',
      birthday: body.birthday || '', hireDate: body.hireDate || '', points: Number(body.points || 0), passwordHash: hashPassword(password), active: true, createdAt: now() };
    doc.users.push(u); await saveClient(doc);
    return { user: strip(u), password };
  }
  const u = doc.users.find((x) => x.id === id) || fail(404, 'User not found');
  if (method === 'PUT') {
    for (const k of ['name', 'email', 'role', 'title', 'department', 'birthday', 'hireDate', 'active', 'points']) if (k in body) u[k] = k === 'points' ? Number(body[k]) : body[k];
    if (body.password) u.passwordHash = hashPassword(body.password);
    await saveClient(doc); return strip(u);
  }
  if (method === 'DELETE') { doc.users = doc.users.filter((x) => x.id !== id); await saveClient(doc); return { ok: true }; }
  fail(405, 'Method not allowed');
}

// ---------- /api/c/:clientId/... ----------
async function clientDataRoutes({ method, body, session }, cid, col, id) {
  const p = await loadPlatform();
  const doc = await loadClient(cid);
  const me = doc.users.find((x) => x.id === session.userId);
  const admin = isClientAdmin(session, cid);
  const manager = isManager(session, cid);

  // Everything the employee site needs in one call.
  if (col === 'bootstrap') {
    return {
      client: doc.client, pages: pagesFor(p, doc), me: strip(me),
      users: doc.users.filter((u) => u.active !== false).map(strip),
      catalogs: Object.fromEntries(CATALOGS.map((k) => [k, catalogFor(p, doc, k)])),
      posts: doc.posts.slice().sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 50),
      orders: manager ? doc.orders : doc.orders.filter((o) => o.userId === me?.id),
      assignments: manager ? doc.assignments : doc.assignments.filter((x) => x.userId === me?.id),
      mentorships: doc.mentorships, sessions: doc.sessions, results: doc.results, events: doc.events,
    };
  }
  if (col === 'catalog') {
    // Full catalogs including hidden items, for the client admin's on/off switches.
    need(manager);
    return Object.fromEntries(CATALOGS.map((k) => [k, [...p.catalogs[k], ...(doc[k] || []).map((x) => ({ ...x, custom: true }))]]));
  }
  if (col === 'settings' && method === 'PUT') {
    need(admin, 'Only client admins can change settings');
    for (const k of ['branding', 'recognition', 'pageOverrides', 'hidden']) if (k in body) doc.client[k] = { ...doc.client[k], ...body[k] };
    // Feature switches are owned by the platform admin panel, not the client.
    await saveClient(doc); return doc.client;
  }
  if (col === 'users') return userRoutes(doc, method, id, body, admin);

  // ----- employee actions -----
  if (col === 'recognize' && method === 'POST') {
    const to = doc.users.find((x) => x.id === body.toUserId) || fail(400, 'Choose who to recognize');
    if (to.id === me?.id) fail(400, "You can't recognize yourself");
    const pts = Math.max(0, Math.min(Number(body.points || 0), doc.client.recognition.maxPerRecognition || 250));
    to.points = (to.points || 0) + pts;
    const post = { id: uid('p-'), type: 'recognition', authorId: me?.id, toUserId: to.id, value: body.value || '', points: pts, text: String(body.text || '').slice(0, 1000), likes: [], comments: [], createdAt: now() };
    doc.posts.push(post); await saveClient(doc); return post;
  }
  if (col === 'posts' && method === 'POST' && !id) {
    const post = { id: uid('p-'), type: 'post', authorId: me?.id, text: String(body.text || '').slice(0, 1000), gif: body.gif || '', tags: body.tags || [], likes: [], comments: [], createdAt: now() };
    if (!post.text && !post.gif) fail(400, 'Write something first');
    doc.posts.push(post); await saveClient(doc); return post;
  }
  if (col === 'posts' && id && method === 'POST') {
    const post = doc.posts.find((x) => x.id === id) || fail(404, 'Post not found');
    if (body.action === 'like') {
      post.likes = post.likes.includes(me.id) ? post.likes.filter((x) => x !== me.id) : [...post.likes, me.id];
    } else if (body.action === 'comment') {
      post.comments.push({ userId: me.id, text: String(body.text || '').slice(0, 500), createdAt: now() });
    }
    await saveClient(doc); return post;
  }
  if (col === 'redeem' && method === 'POST') {
    if (!doc.client.features.rewardsShop) fail(403, 'The rewards shop is turned off');
    const reward = catalogFor(p, doc, 'rewards').find((x) => x.id === body.rewardId) || fail(404, 'Reward not found');
    if ((me.points || 0) < reward.cost) fail(400, 'Not enough points for this reward');
    me.points -= reward.cost;
    const order = { id: uid('o-'), userId: me.id, rewardId: reward.id, name: reward.name, cost: reward.cost, status: 'Processing', createdAt: now() };
    doc.orders.push(order); await saveClient(doc); return { order, points: me.points };
  }
  if (col === 'play' && method === 'POST') {
    const game = catalogFor(p, doc, 'games').find((x) => x.id === body.gameId) || fail(404, 'Game not found');
    const score = Math.max(0, Math.round(Number(body.score || 0)));
    const points = Math.min(game.points || 100, Math.round(score / 5));
    me.points = (me.points || 0) + points;
    const r = { id: uid('r-'), userId: me.id, gameId: game.id, score, points, label: body.label || '', createdAt: now() };
    doc.results.push(r); await saveClient(doc); return { result: r, points: me.points };
  }
  if (col === 'assignments' && id && method === 'PATCH') {
    const a = doc.assignments.find((x) => x.id === id) || fail(404, 'Assignment not found');
    need(manager || a.userId === me?.id);
    a.progress = Math.max(0, Math.min(100, Number(body.progress ?? a.progress)));
    a.status = a.progress >= 100 ? 'completed' : a.progress > 0 ? 'in_progress' : a.status;
    if (a.status === 'completed' && !a.completedAt) a.completedAt = now().slice(0, 10);
    await saveClient(doc); return a;
  }
  if (col === 'mentorships' && id && method === 'PATCH') {
    const m = doc.mentorships.find((x) => x.id === id) || fail(404, 'Mentorship not found');
    need(manager || m.menteeId === me?.id || m.mentorId === me?.id);
    if (body.note) m.notes.push({ userId: me.id, text: String(body.note).slice(0, 1000), createdAt: now() });
    await saveClient(doc); return m;
  }
  if (col === 'sessions' && id && method === 'PATCH') {
    const s = doc.sessions.find((x) => x.id === id) || fail(404, 'Session not found');
    if (body.status) s.status = body.status;
    if (body.date) s.date = body.date;
    if (body.time) s.time = body.time;
    if (body.join && s.group) s.attendeeIds = [...new Set([...(s.attendeeIds || []), me.id])];
    await saveClient(doc); return s;
  }
  if (col === 'leaderboard') {
    return doc.users.filter((u) => u.active !== false && u.role !== 'client_admin').map((u) => ({ ...strip(u),
      gamePoints: doc.results.filter((r) => r.userId === u.id).reduce((s, r) => s + r.points, 0),
      recognitions: doc.posts.filter((x) => x.toUserId === u.id).length })).sort((x, y) => y.points - x.points);
  }

  if (col === 'assignments' && method === 'POST' && !manager) {
    // Employees may enroll themselves in a library course.
    if (body.userId !== me?.id) fail(403, 'You can only enroll yourself');
    if (doc.assignments.some((a) => a.userId === me.id && a.courseId === body.courseId)) fail(409, 'Already enrolled');
    const a = { id: uid('a-'), userId: me.id, courseId: body.courseId, due: body.due || '', progress: 0, status: 'not_started', createdAt: now() };
    doc.assignments.push(a); await saveClient(doc); return a;
  }

  // ----- generic CRUD for managers (games/courses/rewards are client additions) -----
  if (CLIENT_COLLECTIONS.includes(col)) {
    const list = doc[col] || (doc[col] = []);
    // Employees only see their own orders and assignments.
    const visible = manager || !['orders', 'assignments'].includes(col) ? list : list.filter((x) => x.userId === me?.id);
    if (method === 'GET') return id ? visible.find((x) => x.id === id) || fail(404, 'Not found') : visible;
    need(manager, 'Only managers can change this');
    if (method === 'POST') { const item = { id: uid(col[0] + '-'), createdAt: now(), ...body }; list.push(item); await saveClient(doc); return item; }
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) fail(404, 'Not found');
    if (method === 'PUT' || method === 'PATCH') { list[i] = { ...list[i], ...body, id }; await saveClient(doc); return list[i]; }
    if (method === 'DELETE') { list.splice(i, 1); await saveClient(doc); return { ok: true }; }
  }
  fail(404, 'Unknown endpoint');
}
