// Client Management Site: for a client's owners, administrators and managers.
// Employees, recognition, rewards orders, training assignments, games, mentorship, reports, settings.
import {
  CFG, api, capi, getSession, setSession, esc, fmt, fmtDate, timeAgo, avatar, tile, donut, icon, logoMark, shell, hero,
  toast, modal, field, input, textarea, select, toggle, empty, renderLogin, currentRoute, onRoute, formValues,
} from './shared/fi.js';

const root = document.getElementById('root');
let site = null, D = null, catalog = null;

async function boot() {
  if (!CFG.clientId) { root.innerHTML = `<div class="fi-login"><div class="card"><h1>Not set up yet</h1><p class="sub">Set FI_CLIENT_ID on this Netlify site, or add ?client=demo to the URL.</p></div></div>`; return; }
  try { site = await api(`/site/${CFG.clientId}`); }
  catch (e) { root.innerHTML = `<div class="fi-login"><div class="card"><h1>Site unavailable</h1><p class="sub">${esc(e.message)}</p></div></div>`; return; }
  document.title = `${site.branding.companyName || site.name} · FunIntended Management`;
  applyBranding(site.branding);
  if (!getSession()) return showLogin();
  try { await reload(); } catch (e) { setSession(null); return showLogin(e.message); }
  startRouting();
}
function showLogin(msg = '') {
  renderLogin(root, {
    title: `${site.branding.companyName || site.name}`, subtitle: 'FunIntended Management',
    note: (msg ? `<b style="color:var(--red)">${esc(msg)}</b><br>` : '') + (CFG.clientId === 'demo' ? 'Demo login: <b>admin@acme.demo</b> / <b>demo1234</b> (or a manager: <b>david@acme.demo</b>)' : ''),
    onLogin: async (v) => {
      const r = await api('/auth/login', { method: 'POST', body: { ...v, clientId: CFG.clientId } });
      if (!['client_admin', 'manager'].includes(r.role)) throw new Error('This site is for administrators and managers. Use your company’s employee site instead.');
      setSession(r); await reload(); startRouting();
    },
  });
}
// Apply the client's colors. Runs at boot and after every reload, so saved Settings show straight away.
function applyBranding(b = {}) {
  const st = document.documentElement.style;
  b.accentColor ? st.setProperty('--navy-700', b.accentColor) : st.removeProperty('--navy-700');
  b.primaryColor ? st.setProperty('--orange', b.primaryColor) : st.removeProperty('--orange');
}
async function reload() {
  D = await capi('/bootstrap');
  applyBranding(D.client.branding);
  if (!['client_admin', 'manager'].includes(D.me?.role)) throw new Error('Managers and admins only');
  catalog = await capi('/catalog');
}
const isAdmin = () => D.me.role === 'client_admin';
const F = (k) => D.client.features?.[k] !== false;
const user = (id) => D.users.find((u) => u.id === id) || { name: 'Former employee' };
const course = (id) => catalog.courses.find((c) => c.id === id) || { name: 'Course' };
const game = (id) => catalog.games.find((g) => g.id === id) || { name: 'Game' };

function nav(active) {
  const items = [
    { href: '#/', label: 'Dashboard', icon: 'layout', id: '' },
    { href: '#/employees', label: 'Employees', icon: 'users', id: 'employees' },
    F('rewards') && { section: 'Programs' },
    F('rewards') && { href: '#/recognition', label: 'Recognition', icon: 'feed', id: 'recognition' },
    F('rewards') && F('rewardsShop') && { href: '#/rewards', label: 'Rewards & Orders', icon: 'gift', id: 'rewards' },
    F('games') && { href: '#/games', label: 'Games', icon: 'game', id: 'games' },
    F('train') && { href: '#/training', label: 'Training', icon: 'book', id: 'training' },
    F('fluence') && { href: '#/mentorship', label: 'Mentorship', icon: 'heart', id: 'mentorship' },
    { section: 'Insights' },
    { href: '#/reports', label: 'Reports', icon: 'chart', id: 'reports' },
    isAdmin() && { href: '#/settings', label: 'Settings', icon: 'gear', id: 'settings' },
    D.client.sites?.employeeUrl && { section: 'Links' },
    D.client.sites?.employeeUrl && { href: D.client.sites.employeeUrl, label: 'Employee site', icon: 'external', id: '-' },
  ].filter(Boolean);
  return items.map((n) => ({ ...n, active: n.id === active }));
}

let routed = false;
const startRouting = () => { if (!routed) { routed = true; onRoute(render); } else render(); };
async function render() {
  if (!getSession() || !D) return; // signed out: leave the login screen alone
  const { parts } = currentRoute();
  const [a = '', b = ''] = parts;
  const views = { '': dashboard, employees, recognition, rewards, games, training, mentorship, reports, settings };
  const brand = `<div class="fi-brand">${D.client.branding.logoUrl ? `<img src="${esc(D.client.branding.logoUrl)}" style="width:52px;height:52px;object-fit:contain">` : logoMark(52)}<div class="name">Fun<small>Intended Manager</small></div></div>`;
  let content;
  try { content = (views[a] || dashboard)(b || undefined); } catch (e) { content = `<div class="card">${empty('⚠️', e.message)}</div>`; console.error(e); }
  root.innerHTML = shell({ brand, nav: nav(a), top: [{ href: '#/', label: 'Home', active: !a }, { href: '#/employees', label: 'Employees', active: a === 'employees' }, { href: '#/reports', label: 'Reports', active: a === 'reports' }],
    chip: esc(D.client.branding.companyName || D.client.name), user: D.me, content });
}
const refresh = async () => { await reload(); render(); };
const stat = (k, v, d = '') => `<div class="card stat"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
const monthAgo = () => new Date(Date.now() - 30 * 864e5).toISOString();

// ---------- Dashboard ----------
function dashboard() {
  const emps = D.users.filter((u) => u.role !== 'client_admin');
  const recent = D.posts.filter((p) => p.type === 'recognition');
  const month = recent.filter((p) => p.createdAt > monthAgo());
  const done = D.assignments.filter((a) => a.status === 'completed').length;
  const pct = D.assignments.length ? (done / D.assignments.length) * 100 : 0;
  const pending = D.orders.filter((o) => o.status === 'Processing').length;
  const top = emps.map((u) => ({ u, n: recent.filter((p) => p.toUserId === u.id).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
  return `${hero({ title: `Welcome, ${esc(D.me.name.split(' ')[0])}!`, subtitle: `Here's how ${esc(D.client.branding.companyName || D.client.name)} is doing.`, action: isAdmin() ? `<button class="btn primary big" data-act="add-user">${icon('plus')} Add Employee</button>` : '' })}
  <div class="fi-cols-4 mb">${stat('Employees', fmt(emps.length), (() => { const m = D.users.filter((u) => u.role === 'manager').length; return `${m} manager${m === 1 ? '' : 's'}`; })())}
  ${F('rewards') ? stat('Recognitions (30 days)', fmt(month.length), `${fmt(month.reduce((s, p) => s + (p.points || 0), 0))} points awarded`) : ''}
  ${F('rewardsShop') ? stat('Orders to fulfil', fmt(pending), `<a href="#/rewards">Review orders</a>`) : ''}
  ${F('train') ? stat('Training completion', `${Math.round(pct)}%`, `${done} of ${D.assignments.length} assignments`) : ''}</div>
  <div class="fi-grid"><div class="fi-stack">
    ${F('rewards') ? `<section class="card panel"><div class="card-head"><h2>Latest Recognition</h2><a class="linkbtn" href="#/recognition">All</a></div><div class="card inner"><div class="list">${recent.slice(0, 6).map((p) => `<div class="item">${avatar(user(p.authorId), 'sm')}<div class="grow"><b>${esc(user(p.authorId).name)}</b> recognized <b>${esc(user(p.toUserId).name)}</b> <span class="pill">${esc(p.value || '')}</span><div class="muted ellipsis" style="font-size:13px">${esc(p.text)}</div></div><span class="pill yellow">${p.points} pts</span></div>`).join('') || empty('🌟', 'No recognition yet')}</div></div></section>` : ''}
    ${F('train') ? `<section class="card panel"><div class="card-head"><h2>Overdue Training</h2><a class="linkbtn" href="#/training">Manage</a></div><div class="card inner">${overdueList()}</div></section>` : ''}
  </div><div class="fi-stack">
    ${F('train') ? `<div class="card"><h3>Training Completion</h3>${D.assignments.length ? donut(pct, '#22a35a', 'Completed', '#f6a13c') : empty('🚂', 'No training assigned yet')}</div>` : ''}
    ${F('rewards') ? `<div class="card"><h3>Most Recognized</h3><div class="list mt">${top.map((x) => `<div class="item">${avatar(x.u, 'sm')}<span class="grow">${esc(x.u.name)}</span><b>${x.n}</b></div>`).join('') || empty('🏅', 'No one recognized yet')}</div></div>` : ''}
  </div></div>`;
}
function overdueList() {
  const today = new Date().toISOString().slice(0, 10);
  const od = D.assignments.filter((a) => a.status !== 'completed' && a.due && a.due < today);
  return od.length ? `<div class="list">${od.map((a) => `<div class="item">${avatar(user(a.userId), 'sm')}<div class="grow"><b>${esc(user(a.userId).name)}</b><div class="muted" style="font-size:13px">${esc(course(a.courseId).name)}</div></div><span class="pill red">Due ${fmtDate(a.due)}</span></div>`).join('')}</div>` : empty('🎉', 'Nothing overdue');
}

// ---------- Employees ----------
function employees() {
  return `${hero({ title: 'Employees', subtitle: 'Everyone who can sign in to your FunIntended sites.', action: isAdmin() ? `<button class="btn primary big" data-act="add-user">${icon('plus')} Add Employee</button>` : '' })}
  <section class="card panel"><div class="card inner table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Points</th><th>Status</th>${isAdmin() ? '<th></th>' : ''}</tr></thead><tbody>
  ${D.users.map((u) => `<tr><td><div class="row">${avatar(u, 'sm')}<div><b>${esc(u.name)}</b><div class="muted" style="font-size:12px">${esc(u.title || '')}</div></div></div></td><td>${esc(u.email || '')}</td>
  <td><span class="pill ${u.role === 'client_admin' ? 'orange' : u.role === 'manager' ? 'blue' : ''}">${esc({ client_admin: 'Admin', manager: 'Manager', employee: 'Employee' }[u.role] || u.role)}</span></td><td>${esc(u.department || '')}</td><td>${fmt(u.points)}</td>
  <td>${u.active === false ? '<span class="pill yellow">Disabled</span>' : '<span class="pill green">Active</span>'}</td>${isAdmin() ? `<td><button class="btn sm" data-act="edit-user" data-id="${u.id}">Edit</button></td>` : ''}</tr>`).join('')}
  </tbody></table></div></section>`;
}
function userForm(u = {}) {
  return `<div class="form-grid">${field('Name', input('name', u.name, 'required'))}${field('Email', input('email', u.email, 'type="email" required'))}
  ${field('Role', select('role', [['employee', 'Employee'], ['manager', 'Manager'], ['client_admin', 'Admin']], u.role || 'employee'))}${field('Job title', input('title', u.title))}
  ${field('Department', input('department', u.department))}${field('Points balance', input('points', u.points ?? 0, 'type="number"'))}
  ${field('Birthday', input('birthday', u.birthday, 'type="date"'))}${field('Hire date', input('hireDate', u.hireDate, 'type="date"'))}</div>
  ${field(u.id ? 'New password' : 'Password', input('password', '', `placeholder="${u.id ? 'Leave blank to keep' : 'Leave blank to generate'}"`))}${u.id ? toggle('active', u.active !== false, 'Active (can sign in)') : ''}`;
}

// ---------- Recognition ----------
function recognition() {
  return `${hero({ title: 'Recognition', subtitle: 'Everything posted to your Fun Rewards feed. Remove anything that shouldn’t be there.' })}
  <section class="card panel"><div class="card inner"><div class="list">${D.posts.map((p) => `<div class="item">${avatar(user(p.authorId), 'sm')}<div class="grow"><b>${esc(user(p.authorId).name)}</b>${p.type === 'recognition' ? ` → <b>${esc(user(p.toUserId).name)}</b> <span class="pill">${esc(p.value || '')}</span> <span class="pill yellow">${p.points} pts</span>` : ' <span class="pill blue">Post</span>'}
  <div class="ink2">${esc(p.text)}</div><div class="muted" style="font-size:12px">${timeAgo(p.createdAt)} · ${p.likes.length} likes · ${p.comments.length} comments</div></div><button class="btn sm danger" data-act="del-post" data-id="${p.id}">${icon('trash')} Remove</button></div>`).join('') || empty('📣', 'No posts yet')}</div></div></section>`;
}

// ---------- Rewards ----------
function rewards(tab = 'orders') {
  const tabs = `<div class="tabs"><button class="${tab === 'orders' ? 'on' : ''}" onclick="location.hash='#/rewards/orders'">Orders</button><button class="${tab === 'catalog' ? 'on' : ''}" onclick="location.hash='#/rewards/catalog'">Rewards Catalog</button></div>`;
  const body = tab === 'catalog' ? catalogManager('rewards') : `<div class="card inner table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Reward</th><th>Points</th><th>Date</th><th>Status</th></tr></thead><tbody>
    ${D.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => `<tr><td><div class="row">${avatar(user(o.userId), 'sm')}${esc(user(o.userId).name)}</div></td><td>${esc(o.name)}</td><td>${fmt(o.cost)}</td><td>${fmtDate(o.createdAt)}</td>
    <td><select class="input" style="width:auto" data-order="${o.id}">${['Processing', 'Ordered', 'Delivered', 'Completed', 'Cancelled'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') || `<tr><td colspan="5">${empty('📦', 'No orders yet')}</td></tr>`}</tbody></table></div>`;
  return `${hero({ title: 'Rewards & Orders', subtitle: 'Fulfil reward redemptions and choose what’s in your shop.' })}${tabs}<section class="card panel">${body}</section>`;
}
// Shared on/off + custom items manager for games, courses and rewards.
function catalogManager(kind) {
  const hidden = new Set(D.client.hidden?.[kind] || []);
  return `<div class="spread mb"><p class="ink2">Switch items on or off for your people, or add your own.</p>${isAdmin() ? `<button class="btn primary sm" data-act="cat-add" data-kind="${kind}">${icon('plus')} Add your own</button>` : ''}</div>
  <div class="fi-cols-3">${catalog[kind].map((x) => `<div class="card inner">${tile(x)}<h3 class="mt">${esc(x.name)} ${x.custom ? '<span class="pill blue">Yours</span>' : ''}</h3><p class="muted" style="font-size:14px">${esc(x.description || '')}</p>
  <div class="spread mt">${isAdmin() ? `<label class="toggle"><input type="checkbox" data-hide="${kind}" value="${esc(x.id)}" ${hidden.has(x.id) ? '' : 'checked'}><span>${hidden.has(x.id) ? 'Hidden' : 'Available'}</span></label>` : `<span>${hidden.has(x.id) ? 'Hidden' : 'Available'}</span>`}${x.custom && isAdmin() ? `<button class="btn sm danger" data-act="cat-del" data-kind="${kind}" data-id="${x.id}">${icon('trash')}</button>` : ''}</div></div>`).join('')}</div>`;
}

// ---------- Games ----------
function games(tab = 'results') {
  const tabs = `<div class="tabs"><button class="${tab === 'results' ? 'on' : ''}" onclick="location.hash='#/games/results'">Results</button><button class="${tab === 'catalog' ? 'on' : ''}" onclick="location.hash='#/games/catalog'">Game Library</button></div>`;
  const body = tab === 'catalog' ? catalogManager('games') : `<div class="card inner table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Game</th><th>Score</th><th>Points</th><th>When</th></tr></thead><tbody>
    ${D.results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => `<tr><td><div class="row">${avatar(user(r.userId), 'sm')}${esc(user(r.userId).name)}</div></td><td>${esc(game(r.gameId).name)}</td><td>${fmt(r.score)}</td><td>+${r.points}</td><td>${timeAgo(r.createdAt)}</td></tr>`).join('') || `<tr><td colspan="5">${empty('🎮', 'No games played yet')}</td></tr>`}</tbody></table></div>`;
  return `${hero({ title: 'Fun & Games', subtitle: 'See who’s playing and choose which games are available.' })}${tabs}<section class="card panel">${body}</section>`;
}

// ---------- Training ----------
function training(tab = 'assignments') {
  const tabs = `<div class="tabs"><button class="${tab === 'assignments' ? 'on' : ''}" onclick="location.hash='#/training/assignments'">Assignments</button><button class="${tab === 'catalog' ? 'on' : ''}" onclick="location.hash='#/training/catalog'">Training Library</button></div>`;
  const today = new Date().toISOString().slice(0, 10);
  const pill = (a) => a.status === 'completed' ? '<span class="pill green">Completed</span>' : a.due < today ? '<span class="pill red">Overdue</span>' : a.progress > 0 ? `<span class="pill blue">${a.progress}%</span>` : '<span class="pill">Not started</span>';
  const body = tab === 'catalog' ? catalogManager('courses') : `<div class="spread mb"><p class="ink2">Assign trainings and track progress.</p><button class="btn primary sm" data-act="assign">${icon('plus')} Assign training</button></div>
    <div class="card inner table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Training</th><th>Due</th><th>Progress</th><th></th></tr></thead><tbody>
    ${D.assignments.slice().sort((a, b) => (a.due || '').localeCompare(b.due || '')).map((a) => `<tr><td><div class="row">${avatar(user(a.userId), 'sm')}${esc(user(a.userId).name)}</div></td><td>${esc(course(a.courseId).name)}</td><td>${fmtDate(a.due)}</td><td style="min-width:140px"><div class="bar"><span style="width:${a.progress}%"></span></div></td><td>${pill(a)} <button class="btn sm danger" data-act="unassign" data-id="${a.id}">${icon('trash')}</button></td></tr>`).join('') || `<tr><td colspan="5">${empty('🎓', 'No assignments yet')}</td></tr>`}</tbody></table></div>`;
  return `${hero({ title: 'The Fun Train', subtitle: 'Assign learning, set due dates and see who has finished.' })}${tabs}<section class="card panel">${body}</section>`;
}

// ---------- Mentorship ----------
function mentorship() {
  return `${hero({ title: 'FunFluence Mentorship', subtitle: 'Pair mentors with mentees and schedule group sessions.', action: `<button class="btn primary big" data-act="pair">${icon('plus')} New pairing</button>` })}
  <div class="fi-grid"><section class="card panel"><h2 class="mb">Pairings</h2><div class="card inner"><div class="list">${D.mentorships.map((m) => { const done = D.sessions.filter((s) => s.mentorshipId === m.id && s.status === 'completed').length; return `<div class="item">${avatar(user(m.mentorId))}<div class="grow"><b>${esc(user(m.mentorId).name)}</b> mentoring <b>${esc(user(m.menteeId).name)}</b><div class="muted" style="font-size:13px">${esc(m.goal || '')} · since ${fmtDate(m.startedAt)}</div><div class="bar warm mt"><span style="width:${(done / (m.totalSessions || 6)) * 100}%"></span></div></div><span class="pill">${done}/${m.totalSessions || 6}</span><button class="btn sm" data-act="add-session" data-id="${m.id}">Schedule</button><button class="btn sm danger" data-act="unpair" data-id="${m.id}">${icon('trash')}</button></div>`; }).join('') || empty('🤝', 'No pairings yet')}</div></div></section>
  <section class="card"><div class="card-head"><h3>Group Sessions</h3>${F('groupSessions') ? `<button class="btn sm" data-act="add-group">${icon('plus')}</button>` : ''}</div><div class="list">${D.sessions.filter((s) => s.group).map((s) => `<div class="item"><div class="grow"><b>${esc(s.title)}</b><div class="muted" style="font-size:13px">${fmtDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(s.time)} · ${(s.attendeeIds || []).length} attending</div></div></div>`).join('') || empty('📅', 'None scheduled')}</div></section></div>`;
}

// ---------- Reports ----------
function reports() {
  const depts = {};
  for (const u of D.users.filter((x) => x.role !== 'client_admin')) {
    const d = (depts[u.department || 'Unassigned'] ||= { people: 0, points: 0, given: 0, received: 0, done: 0, total: 0 });
    d.people++; d.points += u.points || 0;
    d.given += D.posts.filter((p) => p.type === 'recognition' && p.authorId === u.id).length;
    d.received += D.posts.filter((p) => p.toUserId === u.id).length;
    const as = D.assignments.filter((a) => a.userId === u.id); d.total += as.length; d.done += as.filter((a) => a.status === 'completed').length;
  }
  return `${hero({ title: 'Reports', subtitle: 'Engagement by department. Export to CSV for your own analysis.', action: `<button class="btn primary big" data-act="csv">Download CSV</button>` })}
  <section class="card panel"><div class="card inner table-wrap"><table class="table" id="report"><thead><tr><th>Department</th><th>People</th><th>Points balance</th><th>Recognitions given</th><th>Recognitions received</th><th>Training completion</th></tr></thead><tbody>
  ${Object.entries(depts).map(([k, d]) => `<tr><td><b>${esc(k)}</b></td><td>${d.people}</td><td>${fmt(d.points)}</td><td>${d.given}</td><td>${d.received}</td><td>${d.total ? Math.round((d.done / d.total) * 100) + '%' : '–'}</td></tr>`).join('') || `<tr><td colspan="6">${empty('📊', 'Add employees to see engagement by department')}</td></tr>`}</tbody></table></div></section>`;
}

// ---------- Settings ----------
function settings() {
  const b = D.client.branding, r = D.client.recognition, po = D.client.pageOverrides || {};
  const pages = { home: 'Employee Home', rewards: 'Fun Rewards', games: 'Fun & Games', train: 'The Fun Train', fluence: 'FunFluence' };
  return `${hero({ title: 'Settings', subtitle: 'Your company’s look, recognition rules and page text. Feature switches are managed by FunIntended.' })}
  <form class="card" data-form="settings"><h3 class="mb">Branding</h3><div class="form-grid">${field('Company display name', input('companyName', b.companyName))}${field('Logo URL', input('logoUrl', b.logoUrl, 'placeholder="https://…/logo.png"'))}${field('Button color', input('primaryColor', b.primaryColor, 'type="color"'))}${field('Navigation color', input('accentColor', b.accentColor, 'type="color"'))}</div>
  <h3 class="mt mb">Recognition</h3><div class="form-grid">${field('Company values (comma separated)', input('values', (r.values || []).join(', ')))}${field('Max points per recognition', input('maxPerRecognition', r.maxPerRecognition, 'type="number" min="0"'))}</div>
  <h3 class="mt mb">Page headings</h3><div class="form-grid">${Object.entries(pages).map(([k, l]) => field(`${l} heading`, input(`${k}.title`, po[k]?.title || '', `placeholder="${esc(D.pages[k]?.title || '')}"`)) + field(`${l} subheading`, input(`${k}.subtitle`, po[k]?.subtitle || '', `placeholder="${esc(D.pages[k]?.subtitle || '')}"`))).join('')}</div>
  <button class="btn primary">Save settings</button></form>
  <section class="card mt2"><h3>Enabled features</h3><div class="row wrap mt">${Object.entries(D.client.features).map(([k, v]) => `<span class="pill ${v ? 'green' : ''}">${v ? '✓' : '✕'} ${esc(FEATURE_NAMES[k] || k)}</span>`).join('')}</div></section>`;
}

// Friendly names for the feature switches set in the FunIntended backend (see apps/backend/api/seed.mjs).
const FEATURE_NAMES = { rewards: 'Fun Rewards', games: 'Fun & Games', train: 'The Fun Train', fluence: 'FunFluence', rewardsShop: 'Rewards shop', gifPosts: 'GIFs in posts',
  celebrations: 'Birthdays & anniversaries', leaderboards: 'Leaderboards', tournaments: 'Weekly tournaments', quizzes: 'Skill quizzes', createTraining: 'Client-created trainings',
  groupSessions: 'Group mentorship sessions', surveyBuilder: 'Survey builder' };

// ---------- actions ----------
const people = () => D.users.filter((u) => u.active !== false && u.role !== 'client_admin');
root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act], [data-action="logout"]');
  if (!el) return;
  if (el.dataset.action === 'logout') { setSession(null); D = null; location.hash = ''; return showLogin(); }
  const { act, id, kind } = el.dataset;
  try {
    if (act === 'add-user') return modal({ title: 'Add employee', wide: true, body: userForm(), onSubmit: async (v) => { const r = await capi('/users', { method: 'POST', body: v }); modal({ title: 'Employee added', hideSubmit: true, cancelLabel: 'Done', body: `<p>Share these sign-in details${D.client.sites?.employeeUrl ? ` for <a href="${esc(D.client.sites.employeeUrl)}" target="_blank">${esc(D.client.sites.employeeUrl)}</a>` : ''}:</p><pre class="mono mt">Email:    ${esc(r.user.email)}\nPassword: ${esc(r.password)}</pre>` }); await refresh(); } });
    if (act === 'edit-user') { const u = D.users.find((x) => x.id === id); return modal({ title: `Edit ${esc(u.name)}`, wide: true, body: userForm(u), onSubmit: async (v) => { if (!v.password) delete v.password; await capi(`/users/${id}`, { method: 'PUT', body: v }); toast('Saved'); await refresh(); } }); }
    if (act === 'del-post') { await capi(`/posts/${id}`, { method: 'DELETE' }); toast('Removed'); return refresh(); }
    if (act === 'cat-add') {
      const extra = kind === 'rewards' ? field('Cost (points)', input('cost', 1000, 'type="number" required')) : kind === 'courses' ? field('Length (minutes)', input('minutes', 20, 'type="number"')) + field('Content URL', input('contentUrl')) : field('Game type', select('type', ['trivia', 'scramble', 'memory']));
      return modal({ title: 'Add your own', body: field('Name', input('name', '', 'required')) + field('Description', input('description')) + `<div class="form-grid">${field('Emoji', input('emoji', '⭐'))}${field('Image URL', input('imageUrl'))}</div>` + extra, onSubmit: async (v) => { await capi(`/${kind}`, { method: 'POST', body: v }); toast('Added'); await refresh(); } });
    }
    if (act === 'cat-del') { await capi(`/${kind}/${id}`, { method: 'DELETE' }); toast('Removed'); return refresh(); }
    if (act === 'assign') return modal({ title: 'Assign training', wide: true, submitLabel: 'Assign',
      body: field('Training', select('courseId', catalog.courses.map((c) => [c.id, c.name]))) + field('Due date', input('due', new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), 'type="date" required'))
        + `<label style="font-weight:700;color:var(--ink-2)">Assign to</label><div class="fi-cols-3 mt">${people().map((u) => `<label class="toggle"><input type="checkbox" name="users[]" value="${u.id}"><span>${esc(u.name)}</span></label>`).join('')}</div>`,
      onSubmit: async (v) => { if (!v.users?.length) { toast('Pick at least one person', true); return false; } for (const uid of v.users) await capi('/assignments', { method: 'POST', body: { userId: uid, courseId: v.courseId, due: v.due, progress: 0, status: 'not_started' } }); toast(`Assigned to ${v.users.length}`); await refresh(); } });
    if (act === 'unassign') { await capi(`/assignments/${id}`, { method: 'DELETE' }); toast('Removed'); return refresh(); }
    if (act === 'pair') return modal({ title: 'New mentorship pairing', body: `<div class="form-grid">${field('Mentor', select('mentorId', people().map((u) => [u.id, u.name])))}${field('Mentee', select('menteeId', people().map((u) => [u.id, u.name]), people()[1]?.id))}</div>${field('Goal', input('goal', '', 'placeholder="e.g. Grow into a team lead role"'))}${field('Planned sessions', input('totalSessions', 6, 'type="number" min="1"'))}`,
      onSubmit: async (v) => { if (v.mentorId === v.menteeId) { toast('Pick two different people', true); return false; } await capi('/mentorships', { method: 'POST', body: { ...v, startedAt: new Date().toISOString().slice(0, 10), notes: [] } }); toast('Paired'); await refresh(); } });
    if (act === 'unpair') { await capi(`/mentorships/${id}`, { method: 'DELETE' }); toast('Removed'); return refresh(); }
    if (act === 'add-session') return modal({ title: 'Schedule session', body: field('Title', input('title', 'Mentorship session', 'required')) + `<div class="form-grid">${field('Date', input('date', '', 'type="date" required'))}${field('Time', input('time', '14:00', 'type="time"'))}</div>` + field('Suggested prompt', textarea('prompt', '')),
      onSubmit: async (v) => { await capi('/sessions', { method: 'POST', body: { ...v, mentorshipId: id, status: 'scheduled' } }); toast('Scheduled'); await refresh(); } });
    if (act === 'add-group') return modal({ title: 'New group session', body: field('Title', input('title', '', 'required')) + `<div class="form-grid">${field('Date', input('date', '', 'type="date" required'))}${field('Time', input('time', '10:00', 'type="time"'))}</div>` + `<label style="font-weight:700;color:var(--ink-2)">Hosts</label><div class="fi-cols-2 mt">${people().map((u) => `<label class="toggle"><input type="checkbox" name="hostIds[]" value="${u.id}"><span>${esc(u.name)}</span></label>`).join('')}</div>`,
      onSubmit: async (v) => { await capi('/sessions', { method: 'POST', body: { ...v, group: true, attendeeIds: [], status: 'scheduled' } }); toast('Created'); await refresh(); } });
    if (act === 'csv') {
      const rows = [...document.querySelectorAll('#report tr')].map((tr) => [...tr.children].map((td) => `"${td.textContent.replace(/"/g, '""')}"`).join(','));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'funintended-report.csv'; a.click();
    }
  } catch (err) { toast(err.message, true); }
});
root.addEventListener('change', async (e) => {
  try {
    const o = e.target.closest('[data-order]');
    if (o) { await capi(`/orders/${o.dataset.order}`, { method: 'PATCH', body: { status: o.value } }); toast('Order updated'); return refresh(); }
    const h = e.target.closest('[data-hide]');
    if (h) {
      const kind = h.dataset.hide;
      const set = new Set(D.client.hidden?.[kind] || []);
      h.checked ? set.delete(h.value) : set.add(h.value);
      await capi('/settings', { method: 'PUT', body: { hidden: { [kind]: [...set] } } });
      toast(h.checked ? 'Now available' : 'Hidden'); return refresh();
    }
  } catch (err) { toast(err.message, true); }
});
root.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form="settings"]');
  if (!form) return;
  e.preventDefault();
  const v = formValues(form);
  const pageOverrides = {};
  for (const [k, val] of Object.entries(v)) { const [p, f] = k.split('.'); if (f) { pageOverrides[p] ||= {}; if (val) pageOverrides[p][f] = val; } }
  try {
    await capi('/settings', { method: 'PUT', body: { branding: { companyName: v.companyName, logoUrl: v.logoUrl, primaryColor: v.primaryColor, accentColor: v.accentColor }, recognition: { values: v.values.split(',').map((s) => s.trim()).filter(Boolean), maxPerRecognition: Number(v.maxPerRecognition) }, pageOverrides } });
    toast('Saved ✓'); await refresh();
  } catch (err) { toast(err.message, true); }
});

boot();
