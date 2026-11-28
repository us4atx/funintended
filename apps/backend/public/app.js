// FunIntended Backend / Administration Panel (platform owner).
// Manage clients (provision, features, branding, content, users), global page content,
// catalogs (games, trainings, rewards) and platform admins.
import {
  api, getSession, setSession, esc, fmt, fmtDate, timeAgo, avatar, tile, icon, logoMark, shell, hero, toast, modal,
  field, input, textarea, select, toggle, empty, renderLogin, currentRoute, onRoute, formValues,
} from './shared/fi.js';

const root = document.getElementById('root');
let me = null;
let FEATURES = null; // { modules, subFeatures }

async function boot() {
  if (!getSession()) return showLogin();
  try { me = (await api('/auth/me')).user; FEATURES = await api('/platform/features'); }
  catch { setSession(null); return showLogin(); }
  onRoute(render);
}
function showLogin() {
  renderLogin(root, {
    title: 'FunIntended Admin', subtitle: 'Platform administration',
    note: location.hostname === 'localhost' ? 'Local default: <b>admin@funintended.app</b> / <b>changeme</b>' : '',
    onLogin: async (v) => { const r = await api('/auth/login', { method: 'POST', body: v }); setSession(r); await boot(); },
  });
}

const NAV = [
  { href: '#/', label: 'Overview', icon: 'layout', id: '' },
  { href: '#/clients', label: 'Clients', icon: 'building', id: 'clients' },
  { section: 'Content' },
  { href: '#/content', label: 'Page Content', icon: 'edit', id: 'content' },
  { href: '#/catalog/games', label: 'Games', icon: 'game', id: 'catalog/games' },
  { href: '#/catalog/courses', label: 'Trainings', icon: 'book', id: 'catalog/courses' },
  { href: '#/catalog/rewards', label: 'Rewards', icon: 'gift', id: 'catalog/rewards' },
  { section: 'Platform' },
  { href: '#/features', label: 'Features', icon: 'shield', id: 'features' },
  { href: '#/admins', label: 'Admin Users', icon: 'key', id: 'admins' },
  { href: '#/deploy', label: 'Hosting', icon: 'globe', id: 'deploy' },
];

async function render() {
  if (!getSession()) return showLogin();
  const { parts } = currentRoute();
  const [a = '', b = '', c = ''] = parts;
  const activeId = a === 'catalog' ? `catalog/${b}` : a;
  const brand = `<div class="fi-brand">${logoMark(52)}<div class="name">Fun<small>Intended Admin</small></div></div>`;
  root.innerHTML = shell({ brand, nav: NAV.map((n) => ({ ...n, active: n.id === activeId })), top: [{ href: '#/', label: 'Overview', active: !a }, { href: '#/clients', label: 'Clients', active: a === 'clients' }, { href: '#/content', label: 'Content', active: ['content', 'catalog'].includes(a) }],
    chip: 'Platform Admin', user: me, content: '<div class="empty">Loading…</div>' });
  const content = document.getElementById('fi-content');
  try {
    const views = { '': overview, clients: b ? () => clientDetail(b, c || 'overview') : clients, content: contentPage, catalog: () => catalogPage(b), features: featuresPage, admins: adminsPage, deploy: deployPage };
    content.innerHTML = await (views[a] || overview)();
  } catch (e) { content.innerHTML = `<div class="card">${empty('⚠️', e.message)}</div>`; }
}
const rerender = () => render();

// ---------- Overview ----------
async function overview() {
  const o = await api('/platform/overview');
  const users = o.clients.reduce((s, c) => s + c.users, 0);
  return `${hero({ title: `Hello, ${esc(me.name.split(' ')[0])}!`, subtitle: 'Manage every FunIntended client, feature and page from one place.', action: `<button class="btn primary big" data-act="new-client">${icon('plus')} New Client</button>` })}
  <div class="fi-cols-4 mb">
    ${stat('Clients', o.clients.length, `${o.clients.filter((c) => c.status === 'active').length} active`)}
    ${stat('Users', users, 'across all clients')}
    ${stat('Catalog items', o.catalogs.games + o.catalogs.courses + o.catalogs.rewards, `${o.catalogs.games} games · ${o.catalogs.courses} trainings · ${o.catalogs.rewards} rewards`)}
    ${stat('Platform admins', o.admins, o.hosting?.autoProvisioning ? 'VPS auto-hosting on' : 'VPS auto-hosting not installed')}
  </div>
  <div class="fi-grid"><section class="card panel"><div class="card-head"><h2>Clients</h2><a class="linkbtn" href="#/clients">Manage</a></div><div class="card inner table-wrap">${clientTable(o.clients)}</div></section>
  <section class="card"><h3>Recent activity</h3><div class="list mt">${o.audit.map((x) => `<div class="item"><div class="grow"><b>${esc(x.action)}</b> <span class="muted">${esc(x.detail || '')}</span><div class="muted" style="font-size:12px">${timeAgo(x.at)}</div></div></div>`).join('') || empty('🗒️', 'No changes yet')}</div></section></div>`;
}
const stat = (k, v, d) => `<div class="card stat"><div class="k">${esc(k)}</div><div class="v">${fmt(v)}</div><div class="d">${esc(d)}</div></div>`;
function clientTable(list) {
  if (!list.length) return empty('🏢', 'No clients yet');
  return `<table class="table"><thead><tr><th>Client</th><th>Plan</th><th>Status</th><th>Users</th><th>Sites</th><th></th></tr></thead><tbody>${list.map((c) => `<tr>
    <td><b>${esc(c.name)}</b><div class="muted mono" style="background:none;padding:0">${esc(c.id)}</div></td><td>${esc(c.plan)}</td>
    <td><span class="pill ${c.status === 'active' ? 'green' : 'yellow'}">${esc(c.status)}</span></td><td>${c.users ?? '–'}</td>
    <td style="font-size:13px">${siteLink(c.sites?.adminUrl, 'Management')}<br>${siteLink(c.sites?.employeeUrl, 'Employee')}</td>
    <td><a class="btn sm" href="#/clients/${esc(c.id)}">Open</a></td></tr>`).join('')}</tbody></table>`;
}
const siteLink = (u, label) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : `<span class="muted">${esc(label)}: not set</span>`);

// ---------- Clients ----------
async function clients() {
  const o = await api('/platform/overview');
  return `${hero({ title: 'Clients', subtitle: 'Each client gets a Management site for owners and managers, and an Employee site.', action: `<button class="btn primary big" data-act="new-client">${icon('plus')} New Client</button>` })}
  <section class="card panel"><div class="card inner table-wrap">${clientTable(o.clients)}</div></section>`;
}

function provisionModal() {
  const mods = FEATURES.modules.map((m) => toggle(`f_${m.id}`, true, `${m.icon} ${m.name}`)).join('');
  const m = modal({
    title: 'Provision a new client', submitLabel: 'Create client', wide: true,
    body: `<div class="form-grid">${field('Company name', input('name', '', 'required placeholder="Acme Corp"'))}${field('Client ID', input('id', '', 'placeholder="acme" pattern="[a-z0-9-]*"'), 'Lowercase, used in the two site addresses. Leave blank to generate.')}</div>
    <div class="form-grid">${field('Plan', select('plan', ['standard', 'premium', 'beta', 'demo']))}${field('Primary color', input('primaryColor', '#f97316', 'type="color"'))}</div>
    <h3 class="mt mb">First client admin</h3>
    <div class="form-grid">${field('Name', input('adminName', '', 'placeholder="Jane Doe"'))}${field('Email', input('adminEmail', '', 'type="email" required'))}</div>
    ${field('Temporary password', input('adminPassword', '', 'placeholder="Leave blank to generate one"'))}
    <h3 class="mt mb">Hosting</h3>
    <p class="ink2 mb">Both sites are hosted on our VPS. With the switch on, they are set up automatically (web address, HTTPS certificate and server config) as soon as you create the client.</p>
    <div class="card inner mb" data-site-preview>${sitePreview('')}</div>
    ${toggle('autoHosting', true, 'Set up hosting on the VPS automatically')}
    <h3 class="mt mb">Modules</h3><div class="fi-cols-2">${mods}</div>
    ${toggle('seedDemo', false, 'Fill with sample employees and activity (for demos)')}`,
    onSubmit: async (v) => {
      const features = Object.fromEntries(FEATURES.modules.map((m) => [m.id, v[`f_${m.id}`]]));
      const r = await api('/clients', { method: 'POST', body: { ...v, features, branding: { primaryColor: v.primaryColor } } });
      showProvisionResult(r);
    },
  });
  // Show the addresses the new sites will get while the name / id is typed.
  const f = m.el.querySelector('form');
  const update = () => { f.querySelector('[data-site-preview]').innerHTML = sitePreview(slug(f.elements.id.value || f.elements.name.value)); };
  f.elements.id.addEventListener('input', update); f.elements.name.addEventListener('input', update);
}
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const hostFor = (id, kind) => `${HOSTING.prefix}${id || '&lt;client-id&gt;'}${kind}.${HOSTING.domain}`;
const sitePreview = (id) => `<div class="list"><div class="item"><span class="grow muted">Management site</span><code>https://${hostFor(esc(id), 'm')}</code></div><div class="item"><span class="grow muted">Employee site</span><code>https://${hostFor(esc(id), 'e')}</code></div></div>`;
const HOSTING = { prefix: 'us4-site-fun-', domain: 'us4atx.com', server: '162.35.50.245' };
function showProvisionResult(r) {
  modal({
    title: `🎉 ${esc(r.client.name)} is ready`, hideSubmit: true, cancelLabel: 'Done', wide: true,
    body: `<p>Share these sign-in details with the client admin. The password is shown only once.</p>
    <pre class="mono mt">Email:    ${esc(r.credentials.email)}\nPassword: ${esc(r.credentials.password)}</pre>
    <h3 class="mt2 mb">Hosting ${hostingPill(r.hosting)}</h3>${r.hosting?.message ? `<p class="ink2 mb">${esc(r.hosting.message)}</p>` : ''}${sitesBlock(r.sites)}`,
  });
  setTimeout(() => { location.hash = `#/clients/${r.client.id}`; }, 0);
}
function sitesBlock(d) {
  const one = (label, x) => `<div class="card inner mb"><b>${label}</b> ${x.url ? siteLink(x.url, x.url.replace(/^https?:\/\//, '')) : ''}
    <pre class="mono mt">Site:      ${esc(x.app)}
Client ID: ${esc(x.config.clientId)}
API:       ${esc(x.config.apiBase)}</pre></div>`;
  return one('Management site', d.admin) + one('Employee site', d.employee);
}
const HOSTING_STATES = {
  live: ['green', 'Live'], queued: ['yellow', 'Queued'], working: ['yellow', 'Setting up'], waiting_dns: ['yellow', 'Waiting for DNS'],
  issuing_cert: ['yellow', 'Getting HTTPS certificate'], removing: ['yellow', 'Removing'], removed: ['', 'Removed'],
  error: ['red', 'Problem'], manual: ['yellow', 'Set up by hand'], none: ['', 'Not set up'],
};
function hostingPill(h) {
  const [color, label] = HOSTING_STATES[h?.state || 'none'] || ['', h.state];
  return `<span class="pill ${color}">${esc(label)}</span>`;
}

async function clientDetail(id, tab = 'overview') {
  const c = await api(`/clients/${id}`);
  const tabs = [['overview', 'Overview'], ['features', 'Features'], ['branding', 'Branding'], ['content', 'Page Content'], ['catalog', 'Catalog'], ['users', 'Users'], ['danger', 'Status']];
  let body = '';
  if (tab === 'overview') {
    body = `<div class="fi-cols-4 mb">${stat('Users', c.counts.users, 'employees and admins')}${stat('Posts', c.counts.posts, 'recognition and feed')}${stat('Orders', c.counts.orders, 'reward redemptions')}${stat('Assignments', c.counts.assignments, 'training assignments')}</div>
    <div class="fi-grid"><section class="card"><div class="card-head"><h3>Sites ${hostingPill(c.hostingStatus || (c.hosting ? { state: 'queued' } : null))}</h3><button class="btn sm" data-act="edit-sites" data-id="${c.id}">Edit URLs</button><button class="btn sm primary" data-act="hosting" data-id="${c.id}">${c.hostingStatus?.state === 'live' ? 'Re-check hosting' : 'Set up hosting'}</button></div>
    ${c.hostingStatus?.message ? `<p class="ink2 mb" style="font-size:13px">${esc(c.hostingStatus.message)}${c.hostingStatus.updatedAt ? ` <span class="muted">(${timeAgo(c.hostingStatus.updatedAt)})</span>` : ''}</p>` : ''}${sitesBlock(c.siteInfo)}</section>
    <section class="card"><h3>Details</h3><div class="list mt"><div class="item"><span class="grow muted">Client ID</span><code>${esc(c.id)}</code></div><div class="item"><span class="grow muted">Plan</span>${esc(c.plan)}</div><div class="item"><span class="grow muted">Status</span><span class="pill ${c.status === 'active' ? 'green' : 'yellow'}">${esc(c.status)}</span></div><div class="item"><span class="grow muted">Created</span>${fmtDate(c.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</div></div></section></div>`;
  } else if (tab === 'features') {
    body = `<form class="card" data-form="features" data-id="${c.id}"><p class="ink2 mb">Turn modules and features on or off for this client. Changes apply to both of their sites on the next page load.</p>
      ${FEATURES.modules.map((m) => `<div class="card inner mb"><div class="spread">${toggle(m.id, c.features[m.id] !== false, `${m.icon} ${m.name}`)}<span class="muted" style="font-size:13px">${esc(m.description)}</span></div>
      <div class="fi-cols-3" style="padding-left:50px">${FEATURES.subFeatures.filter((s) => s.module === m.id).map((s) => toggle(s.id, c.features[s.id] !== false, s.name)).join('')}</div></div>`).join('')}
      <button class="btn primary">Save features</button></form>`;
  } else if (tab === 'branding') {
    const b = c.branding;
    body = `<form class="card" data-form="branding" data-id="${c.id}"><div class="form-grid">${field('Company display name', input('companyName', b.companyName))}${field('Logo URL', input('logoUrl', b.logoUrl, 'placeholder="https://…/logo.png"'), 'Shown on the employee home page sidebar.')}
      ${field('Primary (button) color', input('primaryColor', b.primaryColor, 'type="color"'))}${field('Accent (navigation) color', input('accentColor', b.accentColor, 'type="color"'))}</div>
      <h3 class="mt mb">Recognition</h3><div class="form-grid">${field('Company values (comma separated)', input('values', (c.recognition.values || []).join(', ')))}${field('Max points per recognition', input('maxPerRecognition', c.recognition.maxPerRecognition, 'type="number" min="0"'))}${field('Monthly allowance per person', input('monthlyAllowance', c.recognition.monthlyAllowance, 'type="number" min="0"'), 'Placeholder: not enforced yet.')}</div>
      <button class="btn primary">Save branding</button></form>`;
  } else if (tab === 'content') {
    const pages = await api('/platform/pages');
    body = `<form class="card" data-form="overrides" data-id="${c.id}"><p class="ink2 mb">Override the platform's default page text for this client only. Leave a field blank to use the default (shown as the placeholder).</p>${pageFields(pages, c.pageOverrides || {}, true)}<button class="btn primary">Save page content</button></form>`;
  } else if (tab === 'catalog') {
    const cats = await Promise.all(['games', 'courses', 'rewards'].map((k) => api(`/platform/${k}`)));
    body = `<form class="card" data-form="hidden" data-id="${c.id}"><p class="ink2 mb">Choose which platform catalog items this client sees. Client admins can also add their own items from their Management site.</p>
      ${['games', 'courses', 'rewards'].map((k, i) => `<h3 class="mt mb">${{ games: 'Games', courses: 'Trainings', rewards: 'Rewards' }[k]}</h3><div class="fi-cols-3">${cats[i].map((x) => `<label class="toggle"><input type="checkbox" name="${k}[]" value="${esc(x.id)}" ${(c.hidden?.[k] || []).includes(x.id) ? '' : 'checked'}><span>${esc(x.emoji || '')} ${esc(x.name)}</span></label>`).join('')}</div>`).join('')}
      <button class="btn primary mt">Save catalog</button></form>`;
  } else if (tab === 'users') {
    const users = await api(`/clients/${id}/users`);
    body = `<section class="card"><div class="card-head"><h3>Users</h3><button class="btn primary sm" data-act="add-user" data-id="${c.id}">${icon('plus')} Add user</button></div><div class="table-wrap">${usersTable(users, c.id)}</div></section>`;
  } else if (tab === 'danger') {
    body = `<section class="card"><h3>Client status</h3><p class="ink2 mt">Suspending a client blocks both of their sites but keeps all data. Deleting removes the client and all their data permanently.</p>
      <div class="row mt wrap"><button class="btn" data-act="status" data-id="${c.id}" data-status="${c.status === 'active' ? 'suspended' : 'active'}">${c.status === 'active' ? 'Suspend client' : 'Reactivate client'}</button><button class="btn danger" data-act="delete-client" data-id="${c.id}">${icon('trash')} Delete client</button></div></section>`;
  }
  return `${hero({ title: esc(c.name), subtitle: `Client ID <code>${esc(c.id)}</code> · ${esc(c.plan)} plan` })}
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" onclick="location.hash='#/clients/${esc(c.id)}/${k}'">${l}</button>`).join('')}</div>${body}`;
}
function usersTable(users, cid) {
  if (!users.length) return empty('👥', 'No users yet');
  return `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Points</th><th>Status</th><th></th></tr></thead><tbody>${users.map((u) => `<tr>
    <td><div class="row">${avatar(u, 'sm')}<b>${esc(u.name)}</b></div></td><td>${esc(u.email)}</td><td><span class="pill ${u.role === 'client_admin' ? 'orange' : u.role === 'manager' ? 'blue' : ''}">${esc(roleLabel(u.role))}</span></td>
    <td>${esc(u.department || '')}</td><td>${fmt(u.points)}</td><td>${u.active === false ? '<span class="pill yellow">Disabled</span>' : '<span class="pill green">Active</span>'}</td>
    <td class="row"><button class="btn sm" data-act="edit-user" data-id="${cid}" data-user="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
}
const roleLabel = (r) => ({ client_admin: 'Client admin', manager: 'Manager', employee: 'Employee' }[r] || r);
function userForm(u = {}) {
  return `<div class="form-grid">${field('Name', input('name', u.name, 'required'))}${field('Email', input('email', u.email, 'type="email" required'))}
  ${field('Role', select('role', [['employee', 'Employee'], ['manager', 'Manager'], ['client_admin', 'Client admin']], u.role || 'employee'))}${field('Job title', input('title', u.title))}
  ${field('Department', input('department', u.department))}${field('Points', input('points', u.points ?? 0, 'type="number"'))}
  ${field('Birthday', input('birthday', u.birthday, 'type="date"'))}${field('Hire date', input('hireDate', u.hireDate, 'type="date"'))}</div>
  ${field(u.id ? 'New password' : 'Password', input('password', '', `placeholder="${u.id ? 'Leave blank to keep' : 'Leave blank to generate'}"`))}
  ${u.id ? toggle('active', u.active !== false, 'Active (can sign in)') : ''}`;
}

// ---------- Page content ----------
const PAGE_LABELS = { home: 'Employee Home Dashboard', rewards: 'Fun Rewards', games: 'Fun & Games', train: 'The Fun Train', fluence: 'FunFluence' };
const PAGE_FIELDS = { title: 'Heading', subtitle: 'Subheading', body: 'Small print', cta: 'Button label', promo: 'Promo text' };
function pageFields(pages, values, asOverride) {
  return Object.entries(pages).map(([k, p]) => `<div class="card inner mb"><h3 class="mb">${esc(PAGE_LABELS[k] || k)}</h3><div class="form-grid">${Object.keys(PAGE_FIELDS).filter((f) => f in p || (values[k] && f in values[k])).map((f) =>
    field(PAGE_FIELDS[f], input(`${k}.${f}`, asOverride ? values[k]?.[f] || '' : p[f], asOverride ? `placeholder="${esc(p[f] || '')}"` : ''))).join('')}</div></div>`).join('');
}
async function contentPage() {
  const pages = await api('/platform/pages');
  return `${hero({ title: 'Page Content', subtitle: 'Default text for every client\'s employee site. Use {firstName} to greet the signed-in person. Clients can be given their own text from their client page.' })}
  <form class="card" data-form="pages">${pageFields(pages, pages, false)}<button class="btn primary">Save page content</button></form>`;
}
function nestForm(v) {
  const out = {};
  for (const [k, val] of Object.entries(v)) { const [p, f] = k.split('.'); if (!f) continue; out[p] = out[p] || {}; out[p][f] = val; }
  return out;
}

// ---------- Catalogs ----------
const CAT = {
  games: { title: 'Games', fields: [['name', 'Name'], ['description', 'Description'], ['emoji', 'Emoji'], ['color', 'Tile color', 'color'], ['type', 'Game type', ['trivia', 'scramble', 'memory', 'race']], ['points', 'Max points', 'number'], ['imageUrl', 'Image URL']] },
  courses: { title: 'Trainings', fields: [['name', 'Name'], ['description', 'Description'], ['emoji', 'Emoji'], ['category', 'Category'], ['minutes', 'Length (minutes)', 'number'], ['contentUrl', 'Content URL (video, SCORM, doc)'], ['imageUrl', 'Image URL']] },
  rewards: { title: 'Rewards', fields: [['name', 'Name'], ['description', 'Description'], ['emoji', 'Emoji'], ['category', 'Category'], ['cost', 'Cost (points)', 'number'], ['imageUrl', 'Image URL']] },
};
async function catalogPage(kind) {
  const cfg = CAT[kind] || CAT.games;
  const items = await api(`/platform/${kind}`);
  return `${hero({ title: cfg.title, subtitle: `The ${cfg.title.toLowerCase()} every client gets by default. Hide items per client from the client's Catalog tab.`, action: `<button class="btn primary big" data-act="cat-add" data-kind="${kind}">${icon('plus')} Add</button>` })}
  <section class="card panel"><div class="fi-cols-3">${items.map((x) => `<div class="card inner">${tile(x)}<h3 class="mt">${esc(x.name)}</h3><p class="muted" style="font-size:14px">${esc(x.description || '')}</p>
    <div class="spread mt"><span class="pill">${esc(x.category || x.type || '')}${x.cost ? ` · ${fmt(x.cost)} pts` : ''}${x.minutes ? ` · ${x.minutes} min` : ''}</span><span class="row"><button class="btn sm" data-act="cat-edit" data-kind="${kind}" data-id="${x.id}">Edit</button><button class="btn sm danger" data-act="cat-del" data-kind="${kind}" data-id="${x.id}">${icon('trash')}</button></span></div></div>`).join('') || empty('📦', 'Nothing here yet')}</div></section>`;
}
function catForm(kind, x = {}) {
  return `<div class="form-grid">${CAT[kind].fields.map(([k, label, type]) => field(label, Array.isArray(type) ? select(k, type, x[k]) : input(k, x[k] ?? (type === 'color' ? '#6d83e8' : ''), type ? `type="${type}"` : k === 'name' ? 'required' : ''))).join('')}</div>`;
}

// ---------- Features ----------
async function featuresPage() {
  const o = await api('/platform/overview');
  const docs = await Promise.all(o.clients.map((c) => api(`/clients/${c.id}`)));
  return `${hero({ title: 'Features', subtitle: 'Every module and feature on the platform, and which clients have it switched on. Change a client\'s features from their client page.' })}
  <section class="card panel"><div class="card inner table-wrap"><table class="table"><thead><tr><th>Feature</th><th>Module</th>${docs.map((d) => `<th>${esc(d.name)}</th>`).join('')}</tr></thead><tbody>
  ${[...FEATURES.modules.map((m) => ({ id: m.id, name: `${m.icon} ${m.name}`, module: '—', bold: true })), ...FEATURES.subFeatures.map((s) => ({ ...s, module: FEATURES.modules.find((m) => m.id === s.module)?.name }))].map((f) => `<tr><td>${f.bold ? `<b>${esc(f.name)}</b>` : esc(f.name)}</td><td class="muted">${esc(f.module)}</td>${docs.map((d) => `<td>${d.features[f.id] !== false ? '✅' : '—'}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div></section>`;
}

// ---------- Admins ----------
async function adminsPage() {
  const admins = await api('/platform/admins');
  return `${hero({ title: 'Admin Users', subtitle: 'People who can sign in to this administration panel.', action: `<button class="btn primary big" data-act="admin-add">${icon('plus')} Add admin</button>` })}
  <section class="card panel"><div class="card inner table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Added</th><th></th></tr></thead><tbody>${admins.map((a) => `<tr><td><div class="row">${avatar(a, 'sm')}<b>${esc(a.name)}</b></div></td><td>${esc(a.email)}</td><td>${fmtDate(a.createdAt)}</td>
  <td class="row"><button class="btn sm" data-act="admin-edit" data-id="${a.id}">Edit</button>${a.id !== me.id ? `<button class="btn sm danger" data-act="admin-del" data-id="${a.id}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}

// ---------- Hosting ----------
async function deployPage() {
  const h = (await api('/health')).hosting || {};
  const o = await api('/platform/overview');
  return `${hero({ title: 'Hosting', subtitle: 'Every FunIntended site runs on our own VPS.' })}
  <div class="fi-cols-2">
  <section class="card"><h3>The server</h3><div class="list mt">
    <div class="item"><span class="grow muted">Server</span><code>Ubuntu VPS · ${esc(h.server || HOSTING.server)}</code></div>
    <div class="item"><span class="grow muted">Backend + API</span><code>https://${esc(h.backendHost || 'us4-app-funbackend.us4atx.com')}/api</code></div>
    <div class="item"><span class="grow muted">Database</span><code>Self-hosted Supabase (fi_documents)</code></div>
    <div class="item"><span class="grow muted">Web server / HTTPS</span><code>OpenPanel (Caddy, Let's Encrypt)</code></div>
    <div class="item"><span class="grow muted">Client site addresses</span><code>${esc(h.siteHostPattern || `${HOSTING.prefix}<client-id>m / e.${HOSTING.domain}`)}</code></div>
    <div class="item"><span class="grow muted">Automatic hosting for new clients</span>${h.autoProvisioning ? '<span class="pill green">on</span>' : '<span class="pill yellow">agent not installed</span>'}</div>
  </div>
  <p class="ink2 mt" style="font-size:13px">When a client is created, the backend asks the provisioning agent on the VPS to add its two sites. The agent checks the address points at the server, adds it to the web server, gets the HTTPS certificate and reports back here.
  The server itself (and its DNS records) is tracked in US4 Site Admin → Infrastructure.</p></section>
  <section class="card"><h3>Client sites</h3><p class="ink2 mt">Every client has two sites built from the same code. They differ only by client ID.</p>
  <div class="list mt">${o.clients.map((c) => `<div class="item"><div class="grow"><b>${esc(c.name)}</b><div class="muted" style="font-size:13px">${siteLink(c.sites?.adminUrl, 'Management')} · ${siteLink(c.sites?.employeeUrl, 'Employee')}</div></div><code>${esc(c.id)}</code></div>`).join('') || empty('🏢', 'No clients yet')}</div></section></div>`;
}

// ---------- actions ----------
root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act], [data-action="logout"]');
  if (!el) return;
  if (el.dataset.action === 'logout') { setSession(null); location.hash = ''; return showLogin(); }
  const { act, id, kind } = el.dataset;
  try {
    if (act === 'new-client') return provisionModal();
    if (act === 'edit-sites') {
      const c = await api(`/clients/${id}`);
      return modal({ title: 'Site URLs', body: field('Management site URL', input('adminUrl', c.sites.adminUrl)) + field('Employee site URL', input('employeeUrl', c.sites.employeeUrl)), onSubmit: async (v) => { await api(`/clients/${id}`, { method: 'PUT', body: { sites: v } }); toast('Saved'); rerender(); } });
    }
    if (act === 'hosting') { el.disabled = true; const r = await api(`/clients/${id}/hosting`, { method: 'POST' }); toast(r.hosting?.message || 'Hosting requested', r.hosting?.state === 'error'); return rerender(); }
    if (act === 'add-user') return modal({ title: 'Add user', wide: true, body: userForm(), onSubmit: async (v) => { const r = await api(`/clients/${id}/users`, { method: 'POST', body: v }); modal({ title: 'User added', hideSubmit: true, cancelLabel: 'Done', body: `<p>Share these sign-in details:</p><pre class="mono mt">Email:    ${esc(r.user.email)}\nPassword: ${esc(r.password)}</pre>` }); rerender(); } });
    if (act === 'edit-user') {
      const users = await api(`/clients/${id}/users`); const u = users.find((x) => x.id === el.dataset.user);
      return modal({ title: `Edit ${esc(u.name)}`, wide: true, body: userForm(u) + `<button type="button" class="btn danger mt" data-del-user>Delete user</button>`,
        onSubmit: async (v) => { if (!v.password) delete v.password; await api(`/clients/${id}/users/${u.id}`, { method: 'PUT', body: v }); toast('Saved'); rerender(); } })
        .el.querySelector('[data-del-user]').addEventListener('click', async (ev) => { if (!confirmTwice(ev.target)) return; await api(`/clients/${id}/users/${u.id}`, { method: 'DELETE' }); document.querySelector('.fi-modal-bg')?.remove(); toast('User deleted'); rerender(); });
    }
    if (act === 'status') { await api(`/clients/${id}`, { method: 'PUT', body: { status: el.dataset.status } }); toast('Status updated'); return rerender(); }
    if (act === 'delete-client') return modal({ title: 'Delete client?', submitLabel: 'Delete permanently', body: `<p>This permanently deletes <b>${esc(id)}</b> and all of their users and activity. Type the client ID to confirm.</p>${field('Client ID', input('confirm', '', 'required'))}`,
      onSubmit: async (v) => { if (v.confirm !== id) { toast('Client ID does not match', true); return false; } await api(`/clients/${id}`, { method: 'DELETE' }); toast('Client deleted'); location.hash = '#/clients'; } });
    if (act === 'cat-add') return modal({ title: `Add to ${CAT[kind].title}`, wide: true, body: catForm(kind), onSubmit: async (v) => { await api(`/platform/${kind}`, { method: 'POST', body: v }); toast('Added'); rerender(); } });
    if (act === 'cat-edit') { const items = await api(`/platform/${kind}`); const x = items.find((i) => i.id === id); return modal({ title: `Edit ${esc(x.name)}`, wide: true, body: catForm(kind, x), onSubmit: async (v) => { await api(`/platform/${kind}/${id}`, { method: 'PUT', body: v }); toast('Saved'); rerender(); } }); }
    if (act === 'cat-del') { if (!confirmTwice(el)) return; await api(`/platform/${kind}/${id}`, { method: 'DELETE' }); toast('Removed'); return rerender(); }
    if (act === 'admin-add') return modal({ title: 'Add admin', body: field('Name', input('name', '', 'required')) + field('Email', input('email', '', 'type="email" required')) + field('Password', input('password', '', 'type="password" required minlength="8"')), onSubmit: async (v) => { await api('/platform/admins', { method: 'POST', body: v }); toast('Admin added'); rerender(); } });
    if (act === 'admin-edit') { const list = await api('/platform/admins'); const a = list.find((x) => x.id === id); return modal({ title: 'Edit admin', body: field('Name', input('name', a.name)) + field('Email', input('email', a.email, 'type="email"')) + field('New password', input('password', '', 'type="password" placeholder="Leave blank to keep"')), onSubmit: async (v) => { if (!v.password) delete v.password; await api(`/platform/admins/${id}`, { method: 'PUT', body: v }); toast('Saved'); rerender(); } }); }
    if (act === 'admin-del') { if (!confirmTwice(el)) return; await api(`/platform/admins/${id}`, { method: 'DELETE' }); toast('Removed'); return rerender(); }
  } catch (err) { toast(err.message, true); }
});
// Destructive buttons need a second click within 3 seconds.
function confirmTwice(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1'; const old = el.innerHTML; el.textContent = 'Click again to confirm';
  setTimeout(() => { delete el.dataset.armed; el.innerHTML = old; }, 3000);
  return false;
}

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const v = formValues(form); const id = form.dataset.id;
  try {
    if (form.dataset.form === 'features') await api(`/clients/${id}`, { method: 'PUT', body: { features: v } });
    if (form.dataset.form === 'branding') await api(`/clients/${id}`, { method: 'PUT', body: { branding: { companyName: v.companyName, logoUrl: v.logoUrl, primaryColor: v.primaryColor, accentColor: v.accentColor }, recognition: { values: v.values.split(',').map((s) => s.trim()).filter(Boolean), maxPerRecognition: Number(v.maxPerRecognition), monthlyAllowance: Number(v.monthlyAllowance) } } });
    if (form.dataset.form === 'overrides') { const o = nestForm(v); for (const p of Object.values(o)) for (const k of Object.keys(p)) if (!p[k]) delete p[k]; await api(`/clients/${id}`, { method: 'PUT', body: { pageOverrides: o } }); }
    if (form.dataset.form === 'hidden') {
      const all = await Promise.all(['games', 'courses', 'rewards'].map((k) => api(`/platform/${k}`)));
      const hidden = Object.fromEntries(['games', 'courses', 'rewards'].map((k, i) => [k, all[i].map((x) => x.id).filter((x) => !(v[k] || []).includes(x))]));
      await api(`/clients/${id}`, { method: 'PUT', body: { hidden } });
    }
    if (form.dataset.form === 'pages') await api('/platform/pages', { method: 'PUT', body: nestForm(v) });
    toast('Saved ✓');
  } catch (err) { toast(err.message, true); }
});

boot();
