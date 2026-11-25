// FunIntended shared UI helpers (no framework, no build step).
// Each site imports this file as an ES module.

export const CFG = window.FI_CONFIG || { apiBase: '/api', clientId: '', site: 'unknown' };

// Allow ?client=<id> to override the configured client (handy for local testing).
const qsClient = new URLSearchParams(location.search).get('client');
if (qsClient && CFG.site !== 'backend') { CFG.clientId = qsClient; try { localStorage.setItem('fi:client', qsClient); } catch {} }
else if (CFG.site !== 'backend' && !CFG.clientId) { try { CFG.clientId = localStorage.getItem('fi:client') || ''; } catch {} }

// ---------- session ----------
const tokenKey = () => `fi:${CFG.site}:${CFG.clientId || 'platform'}:session`;
export function getSession() { try { return JSON.parse(localStorage.getItem(tokenKey())) || null; } catch { return null; } }
export function setSession(s) { try { s ? localStorage.setItem(tokenKey(), JSON.stringify(s)) : localStorage.removeItem(tokenKey()); } catch {} }

// ---------- API ----------
export async function api(path, { method = 'GET', body } = {}) {
  const s = getSession();
  const res = await fetch(CFG.apiBase.replace(/\/$/, '') + path, {
    method,
    headers: { 'content-type': 'application/json', ...(s?.token ? { authorization: `Bearer ${s.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && s && !path.startsWith('/auth/login')) { setSession(null); location.reload(); }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
export const capi = (path, opts) => api(`/c/${CFG.clientId}${path}`, opts);

// ---------- formatting ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Number(n || 0).toLocaleString();
export function fmtDate(d, opts = { month: 'short', day: 'numeric' }) {
  if (!d) return '';
  const dt = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  return isNaN(dt) ? '' : dt.toLocaleDateString(undefined, opts);
}
export function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}
export const firstName = (n) => String(n || '').split(' ')[0];
export const fill = (tpl, user) => String(tpl || '').replace('{firstName}', esc(firstName(user?.name) || 'there'));

const AV_COLORS = ['#f97316', '#3651ad', '#22a35a', '#8b5cf6', '#e5484d', '#0ea5e9', '#d97706', '#db2777'];
export function avatar(u, cls = '') {
  const name = u?.name || '?';
  const initials = name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const color = AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
  const style = u?.photoUrl ? `background-image:url('${esc(u.photoUrl)}')` : `background:${color}`;
  return `<span class="avatar ${cls}" style="${style}" title="${esc(name)}">${u?.photoUrl ? '' : esc(initials)}</span>`;
}
export function tile(item, cls = '') {
  const bg = item?.imageUrl ? `background-image:url('${esc(item.imageUrl)}')` : `background:linear-gradient(135deg, ${item?.color || '#6d83e8'}, ${shade(item?.color || '#6d83e8')})`;
  return `<div class="tile ${cls}" style="${bg}">${item?.imageUrl ? '' : esc(item?.emoji || '✨')}</div>`;
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v - 50)).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
export function donut(pct, color = '#22a35a', label = 'Complete', rest = '#f6a13c') {
  return `<div class="donut" style="background:conic-gradient(${color} 0 ${pct}%, ${rest} ${pct}% 100%)"><div><span><b>${Math.round(pct)}%</b><small>${esc(label)}</small></span></div></div>`;
}

// ---------- icons ----------
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  feed: '<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4 9 8 12 8zm0 0s2-5 4.5-4S15 8 12 8z"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5A6 6 0 1 1 9.5 15.5"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  cake: '<path d="M4 21h16v-8H4z"/><path d="M4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 13V9M12 6a1.5 1.5 0 0 0 0-3c0 1-1.5 1.5 0 3z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 12h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  thumb: '<path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18 21H7"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.feed}</svg>`;

// ---------- logos ----------
// Placeholder logos drawn in SVG. Swap in your real artwork by setting a logo URL
// in the admin panel (client branding) or replacing these functions.
export function logoMark(size = 52, variant = 'fi') {
  const smile = `<circle cx="36" cy="17" r="12" fill="#fbbf24" stroke="#fff" stroke-width="2"/><circle cx="32" cy="15" r="1.8" fill="#1b2559"/><path d="M38 14.5q2-2 4 0" stroke="#1b2559" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M30.5 20q5.5 5 11 0" stroke="#1b2559" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const cap = variant === 'train' ? `<path d="M24 6l12-5 12 5-12 5z" fill="#1b2559"/><path d="M45 6v6" stroke="#fbbf24" stroke-width="2"/>` : '';
  const second = variant === 'fluence' ? `<circle cx="16" cy="17" r="12" fill="#fbbf24" stroke="#fff" stroke-width="2"/><circle cx="12" cy="15" r="1.8" fill="#1b2559"/><circle cx="19" cy="15" r="1.8" fill="#1b2559"/><path d="M10.5 20q5.5 5 11 0" stroke="#1b2559" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
  const body = variant === 'fluence'
    ? `<path d="M6 54c0-14 8-22 16-22s8 10 14 10 8-12 12-10 6 10 4 22z" fill="#f97316"/>${second}`
    : `<path d="M8 12h20v9H18v6h9v8h-9v16H8z" fill="#f97316"/><path d="M26 40c4 6 14 8 20 0" stroke="#f97316" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" aria-hidden="true">${body}${smile}${cap}</svg>`;
}
export const MODULE_BRAND = {
  home: { name: 'Fun', sub: 'Intended', variant: 'fi' },
  rewards: { name: 'Fun', sub: 'Rewards', variant: 'fi' },
  games: { name: 'Fun', sub: '& Games', variant: 'fi' },
  train: { name: 'The Fun', sub: 'Train', variant: 'train' },
  fluence: { name: 'Fun', sub: 'Fluence', variant: 'fluence' },
};
export function brandBlock(mod = 'home', logoUrl = '') {
  const b = MODULE_BRAND[mod] || MODULE_BRAND.home;
  const mark = logoUrl ? `<img src="${esc(logoUrl)}" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:10px">` : logoMark(52, b.variant);
  return `<div class="fi-brand">${mark}<div class="name">${esc(b.name)}<small>${esc(b.sub)}</small></div></div>`;
}

// ---------- shell ----------
// nav: [{ href, label, icon, active, section }] ; top: [{ href, label, active }]
export function shell({ brand, nav, top = [], chip = '', user, badge = '', content }) {
  const navHtml = nav.map((n) => n.section
    ? `<div class="section">${esc(n.section)}</div>`
    : `<a href="${n.href}" class="${n.active ? 'active' : ''}">${icon(n.icon)}<span>${esc(n.label)}</span></a>`).join('');
  return `
  <div class="fi-app" id="fi-app">
    <aside class="fi-sidebar">${brand}<nav class="fi-nav">${navHtml}</nav>${badge}</aside>
    <div class="fi-main">
      <header class="fi-topbar">
        <button class="fi-iconbtn fi-menu-toggle" data-action="toggle-nav" aria-label="Menu">${icon('menu')}</button>
        <nav class="links">${top.map((t) => `<a href="${t.href}" class="${t.active ? 'active' : ''}">${esc(t.label)}</a>`).join('')}</nav>
        <span class="spacer-m"></span>
        ${chip ? `<span class="fi-chip">${chip}</span>` : ''}
        <button class="fi-iconbtn" title="Notifications" aria-label="Notifications">${icon('bell')}</button>
        <span title="${esc(user?.name || '')}">${avatar(user, 'sm')}</span>
        <button class="fi-iconbtn" data-action="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button>
      </header>
      <main class="fi-content" id="fi-content">${content}</main>
    </div>
  </div>`;
}
export function hero({ title, subtitle, small = '', action = '' }) {
  return `<section class="fi-hero"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}${small ? `<p class="small">${small}</p>` : ''}</div>
  <span class="confetti">🎉</span>${action ? `<div>${action}</div>` : ''}</section>`;
}

// ---------- toasts & modals ----------
export function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'fi-toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
// Opens a modal. `onSubmit(formValues)` may return false to keep it open.
export function modal({ title, body, submitLabel = 'Save', cancelLabel = 'Cancel', onSubmit, wide = false, hideSubmit = false }) {
  const bg = document.createElement('div');
  bg.className = 'fi-modal-bg';
  bg.innerHTML = `<form class="fi-modal ${wide ? 'wide' : ''}"><header><h3>${title}</h3><button type="button" class="fi-iconbtn" data-close style="color:var(--ink)">✕</button></header>
    <div class="body">${body}</div><footer><button type="button" class="btn" data-close>${cancelLabel}</button>${hideSubmit ? '' : `<button class="btn primary" type="submit">${submitLabel}</button>`}</footer></form>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  bg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; if (btn) btn.disabled = true;
    try { const keep = onSubmit ? await onSubmit(formValues(e.target), e.target) : null; if (keep !== false) close(); }
    catch (err) { toast(err.message, true); }
    finally { if (btn) btn.disabled = false; }
  });
  document.body.appendChild(bg);
  bg.querySelector('input,select,textarea')?.focus();
  return { close, el: bg };
}
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.name.endsWith('[]')) { const k = el.name.slice(0, -2); out[k] = out[k] || []; if (el.checked) out[k].push(el.value); }
      else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ''; }
    else if (el.type === 'number') out[el.name] = el.value === '' ? '' : Number(el.value);
    else out[el.name] = el.value;
  }
  return out;
}
export const field = (label, input, hint = '') => `<div class="field"><label>${esc(label)}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export const input = (name, value = '', attrs = '') => `<input class="input" name="${name}" value="${esc(value)}" ${attrs}>`;
export const textarea = (name, value = '', attrs = '') => `<textarea class="input" name="${name}" ${attrs}>${esc(value)}</textarea>`;
export const select = (name, options, value = '') => `<select class="input" name="${name}">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
export const toggle = (name, checked, label) => `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
export const empty = (emoji, text) => `<div class="empty"><div class="e">${emoji}</div>${esc(text)}</div>`;

// ---------- login screen ----------
export function renderLogin(root, { title, subtitle, variant = 'fi', note = '', onLogin }) {
  root.innerHTML = `<div class="fi-login"><form class="card">
    <div class="logo">${logoMark(72, variant)}</div>
    <h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>
    ${field('Email', input('email', '', 'type="email" required autocomplete="username"'))}
    ${field('Password', input('password', '', 'type="password" required autocomplete="current-password"'))}
    <button class="btn primary block big" type="submit">Sign in</button>
    <p class="err" style="color:var(--red);margin-top:12px;min-height:20px;text-align:center"></p>
    ${note ? `<div class="demo-note">${note}</div>` : ''}
  </form></div>`;
  const form = root.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    form.querySelector('button').disabled = true;
    try { await onLogin(v); }
    catch (err) { form.querySelector('.err').textContent = err.message; }
    finally { form.querySelector('button').disabled = false; }
  });
}

// ---------- tiny hash router ----------
export function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}
export function onRoute(fn) { window.addEventListener('hashchange', fn); fn(); }

// Global click handling for the shell.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action="toggle-nav"]');
  if (t) document.getElementById('fi-app')?.classList.toggle('nav-open');
  else if (e.target.closest('.fi-nav a')) document.getElementById('fi-app')?.classList.remove('nav-open');
});
