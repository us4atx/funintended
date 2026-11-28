// Client Employee Site: Dashboard + Fun Rewards + Fun & Games + The Fun Train + FunFluence.
import {
  CFG, api, capi, getSession, setSession, esc, fmt, fmtDate, timeAgo, firstName, fill, avatar, tile, donut, icon,
  brandBlock, shell, hero, toast, modal, field, input, textarea, select, empty, renderLogin, currentRoute, onRoute,
} from './shared/fi.js';

const root = document.getElementById('root');
let site = null; // public site info (branding, features, pages)
let D = null; // bootstrap data for the signed-in employee

// ---------- boot ----------
async function boot() {
  if (!CFG.clientId) { root.innerHTML = `<div class="fi-login"><div class="card"><h1>Not set up yet</h1><p class="sub">This site has no client assigned. Open it from the client's own site address, or add ?client=demo to the URL.</p></div></div>`; return; }
  try { site = await api(`/site/${CFG.clientId}`); }
  catch (e) { root.innerHTML = `<div class="fi-login"><div class="card"><h1>Site unavailable</h1><p class="sub">${esc(e.message)}</p></div></div>`; return; }
  document.title = `${site.branding.companyName || site.name} · FunIntended`;
  applyBranding(site.branding);
  if (!getSession()) return showLogin();
  await reload();
  onRoute(render);
}
function applyBranding(b) {
  if (b.primaryColor) document.documentElement.style.setProperty('--orange', b.primaryColor);
  if (b.accentColor) document.documentElement.style.setProperty('--navy-700', b.accentColor);
}
function showLogin() {
  renderLogin(root, {
    title: site.branding.companyName || site.name, subtitle: 'Sign in to FunIntended',
    note: CFG.clientId === 'demo' ? 'Demo login: <b>sarah@acme.demo</b> / <b>demo1234</b>' : '',
    onLogin: async ({ email, password }) => {
      const r = await api('/auth/login', { method: 'POST', body: { email, password, clientId: CFG.clientId } });
      setSession(r); await reload(); onRoute(render);
    },
  });
}
async function reload() { D = await capi('/bootstrap'); site.pages = D.pages; site.features = D.client.features; }
const F = (k) => site.features?.[k] !== false;
const user = (id) => D.users.find((u) => u.id === id) || { name: 'Former employee' };
const me = () => D.me || {};
const isManager = () => ['manager', 'client_admin'].includes(me().role);
const course = (id) => D.catalogs.courses.find((c) => c.id === id) || { name: 'Course', emoji: '📘' };
const game = (id) => D.catalogs.games.find((g) => g.id === id) || { name: 'Game', emoji: '🎮' };

// ---------- layout ----------
const MODULE_NAV = {
  home: [
    { href: '#/', label: 'Home', icon: 'home', id: '' },
    { href: '#/rewards', label: 'Fun Rewards', icon: 'feed', id: 'rewards', feature: 'rewards' },
    { href: '#/games', label: 'Fun & Games', icon: 'game', id: 'games', feature: 'games' },
    { href: '#/train', label: 'The Fun Train', icon: 'book', id: 'train', feature: 'train' },
    { href: '#/fluence', label: 'FunFluence', icon: 'users', id: 'fluence', feature: 'fluence' },
  ],
  rewards: [
    { href: '#/', label: 'Home', icon: 'home', id: 'home' },
    { href: '#/rewards', label: 'Feed', icon: 'feed', id: '' },
    { href: '#/rewards/shop', label: 'Rewards Shop', icon: 'gift', id: 'shop', feature: 'rewardsShop' },
    { href: '#/rewards/points', label: 'My Points', icon: 'coins', id: 'points' },
    { href: '#/rewards/orders', label: 'My Orders', icon: 'box', id: 'orders', feature: 'rewardsShop' },
    { href: '#/rewards/celebrations', label: 'Birthdays & Anniversaries', icon: 'cake', id: 'celebrations', feature: 'celebrations' },
    { href: '#/rewards/leaderboard', label: 'Leaderboards', icon: 'trophy', id: 'leaderboard', feature: 'leaderboards' },
  ],
  games: [
    { href: '#/', label: 'Home', icon: 'home', id: 'home' },
    { href: '#/games', label: 'Game Library', icon: 'game', id: '' },
    { href: '#/games/progress', label: 'My Progress', icon: 'chart', id: 'progress' },
    { href: '#/games/leaderboard', label: 'Leaderboard', icon: 'trophy', id: 'leaderboard' },
  ],
  train: [
    { href: '#/', label: 'Home', icon: 'home', id: 'home' },
    { href: '#/train', label: 'My Trainings', icon: 'clipboard', id: '' },
    { href: '#/train/library', label: 'Training Library', icon: 'book', id: 'library' },
    { href: '#/train/quiz', label: 'Quiz Your Skills', icon: 'rocket', id: 'quiz', feature: 'quizzes' },
  ],
  fluence: [
    { href: '#/', label: 'Home', icon: 'home', id: 'home' },
    { href: '#/fluence', label: 'My Mentorships', icon: 'heart', id: '' },
    { href: '#/fluence/mentors', label: 'Mentors', icon: 'user', id: 'mentors' },
    { href: '#/fluence/sessions', label: 'Sessions', icon: 'calendar', id: 'sessions' },
  ],
};
const SIDE_BADGE = {
  rewards: ['Fun Rewards', 'Celebrate. Motivate. Retain.'],
  games: ['Fun & Games', 'Play. Compete. Connect.'],
  train: ['The Fun Train', 'Learn. Grow. Advance. Engage.'],
  fluence: ['FunFluence', 'Connect. Learn. Grow.'],
};

function layout(mod, sub, content) {
  let nav = MODULE_NAV[mod].filter((n) => !n.feature || F(n.feature)).map((n) => ({ ...n, active: n.id === (sub || '') }));
  if (isManager() && D.client.sites?.adminUrl) nav = [...nav, { section: 'Admin' }, { href: D.client.sites.adminUrl, label: 'Management site', icon: 'external' }];
  const top = [{ href: '#/', label: 'Home', active: mod === 'home' }]
    .concat(F('rewards') ? [{ href: '#/rewards', label: 'Rewards', active: mod === 'rewards' }] : [])
    .concat(F('games') ? [{ href: '#/games', label: 'Games', active: mod === 'games' }] : [])
    .concat(F('train') ? [{ href: '#/train', label: 'Training', active: mod === 'train' }] : [])
    .concat(F('fluence') ? [{ href: '#/fluence', label: 'Mentorship', active: mod === 'fluence' }] : []);
  const badge = SIDE_BADGE[mod] ? `<div class="fi-side-badge">${brandBlock(mod).replace('fi-brand', 'fi-brand" style="justify-content:center;padding:0')}<div class="s">${esc(SIDE_BADGE[mod][1])}</div></div>` : '';
  return shell({ brand: brandBlock(mod, mod === 'home' ? D.client.branding.logoUrl : ''), nav, top, chip: esc(D.client.branding.companyName || D.client.name), user: me(), badge, content });
}

const recognizeBtn = (label = 'Give Recognition') => F('rewards') ? `<button class="btn primary big" data-act="recognize">${icon('plus')} ${esc(label)} ${icon('chevron')}</button>` : '';

// ---------- router ----------
function render() {
  const { parts } = currentRoute();
  const [mod = 'home', sub = '', id = ''] = parts;
  const pages = { home: homePage, rewards: rewardsPage, games: gamesPage, train: trainPage, fluence: fluencePage };
  const fn = pages[mod] && (mod === 'home' || F(mod)) ? pages[mod] : homePage;
  root.innerHTML = layout(pages[mod] ? mod : 'home', sub, fn(sub, id));
  window.scrollTo(0, 0);
}

// ---------- shared widgets ----------
function pointsCard() {
  return `<div class="card"><h3>My Points</h3><div class="row mt"><span style="font-size:30px">🪙</span><span style="font-family:var(--font-display);font-size:30px;font-weight:700">${fmt(me().points)}</span><span class="muted">Points</span></div>
    ${F('rewardsShop') ? `<a class="btn primary block mt" href="#/rewards/shop">Redeem Points</a>` : ''}<a class="btn block mt" href="#/rewards/points">View History</a></div>`;
}
function leaderboardList(limit = 5, by = 'points') {
  const rows = D.users.filter((u) => u.role !== 'client_admin').map((u) => ({ u, v: by === 'games' ? gameScore(u.id) : u.points || 0 }))
    .sort((a, b) => b.v - a.v).slice(0, limit);
  return `<div class="list">${rows.map((r) => `<div class="item">${avatar(r.u, 'sm')}<span class="grow ellipsis">${esc(r.u.name)}</span><span class="score">${fmt(r.v)}</span></div>`).join('')}</div>`;
}
const gameScore = (uid) => D.results.filter((r) => r.userId === uid).reduce((s, r) => Math.max(s, r.score), 0);
function upcomingCelebrations(limit = 4) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = (d) => { if (!d) return null; const x = new Date(d + 'T12:00:00'); x.setFullYear(today.getFullYear()); if (x < today) x.setFullYear(today.getFullYear() + 1); return x; };
  const items = [];
  for (const u of D.users) {
    if (u.birthday) items.push({ u, kind: 'Birthday', date: next(u.birthday), emoji: '🎂' });
    if (u.hireDate) { const y = today.getFullYear() - new Date(u.hireDate).getFullYear(); const dt = next(u.hireDate); if (y >= 1) items.push({ u, kind: `${dt.getFullYear() - new Date(u.hireDate).getFullYear()}-year anniversary`, date: dt, emoji: '🎉' }); }
  }
  return items.filter((x) => x.date).sort((a, b) => a.date - b.date).slice(0, limit);
}
function celebrationsCard(limit = 3) {
  const items = upcomingCelebrations(limit);
  return `<div class="card"><h3>Birthdays &amp; Anniversaries</h3><div class="list mt">${items.length ? items.map((x) => `<div class="item">${avatar(x.u, 'sm')}<div class="grow"><b>${esc(x.u.name)}</b><div class="muted" style="font-size:13px">${x.emoji} ${esc(x.kind)}</div></div><span class="muted" style="font-size:13px">${fmtDate(x.date.toISOString())}</span></div>`).join('') : empty('🎈', 'Nothing coming up')}</div></div>`;
}
function postCard(p) {
  const author = user(p.authorId);
  const liked = p.likes.includes(me().id);
  const likers = p.likes.map((id) => (id === me().id ? 'You' : firstName(user(id).name)));
  let bodyHtml = '';
  if (p.type === 'recognition') {
    const to = user(p.toUserId);
    bodyHtml = `<div class="spread mt"><div class="congrats">Congratulations <b>${esc(to.name)}</b></div>${p.points ? `<span class="points-badge ${p.points < 200 ? 'green' : ''}">${fmt(p.points)} <small>Points</small></span>` : ''}</div>
      <p class="mt" style="font-size:17px;line-height:1.5">${esc(p.text)}</p>`;
  } else {
    bodyHtml = `<p class="mt" style="font-size:17px">${esc(p.text)}</p>${p.gif ? `<div class="gif">🍌🌽🍕</div>` : ''}`;
  }
  return `<article class="card inner post" data-post="${p.id}">
    <div class="head">${avatar(author)}<div class="grow"><b>${esc(author.name)}</b>${p.type === 'recognition' ? `<div class="muted" style="font-size:13px">Recognized · <span class="pill">${esc(p.value || 'Great work')}</span></div>` : `<div class="muted" style="font-size:13px">${timeAgo(p.createdAt)}</div>`}</div>
    ${p.type === 'recognition' ? `<span class="muted" style="font-size:13px">${timeAgo(p.createdAt)}</span>` : ''}</div>
    ${bodyHtml}
    <div class="actions"><button data-act="like" class="${liked ? 'on' : ''}">${icon('thumb')} ${p.likes.length}</button><button data-act="comment">${icon('chat')} Comment</button><button data-act="share">${icon('share')} Share</button></div>
    ${likers.length ? `<div class="muted mt" style="font-size:13.5px">${esc(likers.slice(0, 2).join(', '))}${likers.length > 2 ? ` and ${likers.length - 2} others` : ''} liked this.</div>` : ''}
    ${p.comments.map((c) => `<div class="comment">${avatar(user(c.userId), 'sm')}<div class="bubble"><b>${esc(user(c.userId).name)}</b> ${esc(c.text)}</div></div>`).join('')}
  </article>`;
}

// ---------- HOME DASHBOARD ----------
function homePage() {
  const pg = site.pages.home;
  const myAssign = D.assignments.filter((a) => a.userId === me().id && a.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due));
  const mship = D.mentorships.find((m) => m.menteeId === me().id || m.mentorId === me().id);
  const nextSession = mship && D.sessions.filter((s) => s.mentorshipId === mship.id && s.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
  const modules = site.modules.filter((m) => F(m.id));
  const routes = { rewards: '#/rewards', games: '#/games', train: '#/train', fluence: '#/fluence' };
  const colors = { rewards: '#f97316', games: '#8b5cf6', train: '#3651ad', fluence: '#22a35a' };
  return `${hero({ title: fill(pg.title, me()), subtitle: esc(pg.subtitle), action: recognizeBtn(pg.cta) })}
  <div class="fi-grid"><div class="fi-stack">
    <div class="fi-cols-${Math.min(4, Math.max(2, modules.length))}">${modules.map((m) => `<a class="card" href="${routes[m.id]}" style="text-decoration:none;color:inherit">${tile({ emoji: m.icon, color: colors[m.id] })}<h3 class="mt">${esc(m.name)}</h3><p class="muted" style="font-size:14px;margin-top:4px">${esc(m.tagline)}</p></a>`).join('')}</div>
    ${F('rewards') ? `<section class="card panel"><div class="card-head"><h2>Recent Recognition</h2><a class="linkbtn" href="#/rewards">See all</a></div><div class="fi-stack">${D.posts.filter((p) => p.type === 'recognition').slice(0, 2).map(postCard).join('') || empty('🌟', 'No recognition yet. Be the first!')}</div></section>` : ''}
    <div class="fi-cols-2">
      ${F('train') ? `<section class="card"><div class="card-head"><h3>My Trainings</h3><a class="linkbtn" href="#/train">Open</a></div>${myAssign.slice(0, 3).map((a) => `<div class="item row" style="padding:8px 0">${tile(course(a.courseId), 'sq')}<div class="grow"><b class="ellipsis" style="display:block">${esc(course(a.courseId).name)}</b><span class="muted" style="font-size:13px">Due ${fmtDate(a.due)}</span></div>${statusPill(a)}</div>`).join('') || empty('🎓', 'All caught up!')}</section>` : ''}
      ${F('fluence') ? `<section class="card"><div class="card-head"><h3>Mentorship</h3><a class="linkbtn" href="#/fluence">Open</a></div>${mship ? `<div class="row">${avatar(user(mship.mentorId === me().id ? mship.menteeId : mship.mentorId))}<div><b>${esc(user(mship.mentorId === me().id ? mship.menteeId : mship.mentorId).name)}</b><div class="muted" style="font-size:13px">${mship.mentorId === me().id ? 'Your mentee' : 'Your mentor'}</div></div></div>${nextSession ? `<p class="mt ink2">Next session: <b>${fmtDate(nextSession.date, { weekday: 'long', month: 'short', day: 'numeric' })} · ${esc(nextSession.time)}</b></p>` : ''}` : empty('🤝', 'No mentor match yet')}</section>` : ''}
    </div>
  </div><div class="fi-stack">
    ${F('rewards') ? pointsCard() : ''}
    ${F('games') ? `<div class="card"><h3>Challenges Leaderboard</h3><div class="mt">${leaderboardList(5, 'games')}</div><a class="btn block mt" href="#/games/leaderboard">View Full Leaderboard</a></div>` : ''}
    ${F('rewards') && F('celebrations') ? celebrationsCard() : ''}
  </div></div>`;
}

// ---------- FUN REWARDS ----------
function rewardsPage(sub) {
  const pg = site.pages.rewards;
  const head = hero({ title: esc(pg.title), subtitle: esc(pg.subtitle), small: esc(pg.body || ''), action: recognizeBtn(pg.cta) });
  const side = `<div class="fi-stack">${pointsCard()}
    ${F('rewardsShop') ? `<div class="card"><h3>Rewards Shop</h3><div class="row mt" style="gap:6px">${D.catalogs.rewards.slice(0, 4).map((r) => tile(r, 'sq')).join('')}</div><a class="btn block mt" href="#/rewards/shop">Browse Rewards</a></div>` : ''}
    ${F('rewardsShop') ? `<div class="card"><h3>My Orders</h3><div class="list mt">${myOrders().slice(0, 3).map(orderRow).join('') || empty('📦', 'No orders yet')}</div></div>` : ''}
    ${F('celebrations') ? celebrationsCard() : ''}
    ${F('leaderboards') ? `<div class="card"><div class="card-head"><h3>Leaderboards</h3><a class="linkbtn" href="#/rewards/leaderboard">${icon('chevron')}</a></div>${leaderboardList(3)}</div>` : ''}
  </div>`;
  let main = '';
  if (!sub) {
    main = `<div class="card composer"><textarea class="input" id="composer" placeholder="Write something fun..." rows="2"></textarea>
      <div class="spread"><div class="row">${F('gifPosts') ? `<button class="btn sm ghost" data-act="gif">🖼️ Add GIF</button>` : ''}<button class="btn sm ghost" data-act="recognize">🏷️ Tag Employees</button></div><button class="btn primary sm" data-act="post">Post</button></div></div>
      ${D.posts.map(postCard).join('') || empty('📣', 'The feed is quiet. Post something!')}
      ${F('leaderboards') ? `<a class="btn navy block big" href="#/rewards/leaderboard">View Full Leaderboard ${icon('chevron')}</a>` : ''}`;
  } else if (sub === 'shop') {
    main = `<section class="card panel"><div class="card-head"><h2>Rewards Shop</h2><span class="pill blue">${fmt(me().points)} points available</span></div>
      <div class="fi-cols-3">${D.catalogs.rewards.map((r) => `<div class="card inner">${tile(r)}<h3 class="mt">${esc(r.name)}</h3><p class="muted" style="font-size:14px">${esc(r.description || '')}</p>
      <div class="spread mt"><div><b>${fmt(r.cost)} pts</b>${me().points < r.cost ? `<div class="muted" style="font-size:12.5px">${fmt(r.cost - me().points)} more to go</div>` : ''}</div><button class="btn primary sm" data-act="redeem" data-id="${r.id}" ${me().points < r.cost ? 'disabled' : ''}>Redeem</button></div></div>`).join('')}</div></section>`;
  } else if (sub === 'points') {
    const received = D.posts.filter((p) => p.toUserId === me().id).map((p) => ({ d: p.createdAt, t: `Recognized by ${user(p.authorId).name} · ${p.value || ''}`, v: +p.points }));
    const games = D.results.filter((r) => r.userId === me().id).map((r) => ({ d: r.createdAt, t: `Played ${game(r.gameId).name}`, v: +r.points }));
    const spent = myOrders().map((o) => ({ d: o.createdAt, t: `Redeemed ${o.name}`, v: -o.cost }));
    const all = [...received, ...games, ...spent].sort((a, b) => b.d.localeCompare(a.d));
    main = `<section class="card panel"><div class="card-head"><h2>Points History</h2><span class="points-badge">${fmt(me().points)} <small>Points</small></span></div>
      <div class="card inner"><div class="list">${all.map((x) => `<div class="item"><span class="grow">${esc(x.t)}<div class="muted" style="font-size:13px">${timeAgo(x.d)}</div></span><b style="color:${x.v >= 0 ? 'var(--green)' : 'var(--red)'}">${x.v >= 0 ? '+' : ''}${fmt(x.v)}</b></div>`).join('') || empty('🪙', 'No point activity yet')}</div></div></section>`;
  } else if (sub === 'orders') {
    main = `<section class="card panel"><h2 class="mb">My Orders</h2><div class="card inner"><div class="list">${myOrders().map(orderRow).join('') || empty('📦', 'No orders yet')}</div></div></section>`;
  } else if (sub === 'celebrations') {
    main = `<section class="card panel"><h2 class="mb">Birthdays &amp; Anniversaries</h2><div class="card inner"><div class="list">${upcomingCelebrations(30).map((x) => `<div class="item">${avatar(x.u)}<div class="grow"><b>${esc(x.u.name)}</b><div class="muted">${x.emoji} ${esc(x.kind)}</div></div><span>${fmtDate(x.date.toISOString(), { weekday: 'short', month: 'short', day: 'numeric' })}</span><button class="btn sm" data-act="recognize" data-to="${x.u.id}">Celebrate</button></div>`).join('') || empty('🎈', 'Nothing coming up')}</div></div></section>`;
  } else if (sub === 'leaderboard') {
    main = `<section class="card panel"><h2 class="mb">Points Leaderboard</h2><div class="card inner">${leaderboardList(50)}</div></section>`;
  }
  return `${head}<div class="fi-grid"><div class="fi-stack">${main}</div>${side}</div>`;
}
const myOrders = () => D.orders.filter((o) => o.userId === me().id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const orderRow = (o) => { const r = D.catalogs.rewards.find((x) => x.id === o.rewardId); return `<div class="item">${tile(r || { emoji: '🎁' }, 'sq')}<div class="grow"><b>${esc(o.name)}</b><div class="muted" style="font-size:13px">${esc(o.status)}</div></div><span class="muted" style="font-size:13px">${fmtDate(o.createdAt)}</span></div>`; };

// ---------- FUN & GAMES ----------
function gamesPage(sub, id) {
  const pg = site.pages.games;
  const head = hero({ title: esc(pg.title), subtitle: esc(pg.subtitle), action: `<button class="btn primary big" data-act="play" data-id="${D.catalogs.games[0]?.id || ''}">${icon('plus')} ${esc(pg.cta)} ${icon('chevron')}</button>` });
  const myBest = gameScore(me().id);
  const myGamePts = D.results.filter((r) => r.userId === me().id).reduce((s, r) => s + r.points, 0);
  const recent = D.results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const side = `<div class="fi-stack">
    <div class="card"><h3>My Progress</h3><div class="row mt">${avatar(me(), 'lg').replace('avatar lg', 'avatar')}<div><span style="font-family:var(--font-display);font-size:30px;font-weight:700">${fmt(myBest)}</span> <span class="muted">best score</span><div class="muted">${fmt(myGamePts)} points earned</div></div></div><a class="btn block mt" href="#/games/progress">View Details ${icon('chevron')}</a></div>
    <div class="card"><h3>Challenges Leaderboard</h3><div class="mt">${leaderboardList(5, 'games')}</div><a class="btn block mt" href="#/games/leaderboard">View Full Leaderboard</a></div>
  </div>`;
  let main = '';
  if (!sub) {
    main = `<section class="card panel"><div class="card-head"><h2>Game Library</h2><span class="pill blue">${D.catalogs.games.length} games</span></div>
      <div class="fi-cols-2">${D.catalogs.games.map((g) => `<div class="card inner">${tile(g)}<h3 class="mt">${esc(g.name)}</h3><p class="muted" style="font-size:14px;min-height:40px">${esc(g.description || '')}</p><div class="spread mt"><span class="muted" style="font-size:13px">Up to ${g.points || 100} pts</span><button class="btn primary sm" data-act="play" data-id="${g.id}">Join Now ${icon('chevron')}</button></div></div>`).join('')}</div></section>
      <section class="card panel"><h2 class="mb">Recent Results</h2><div class="card inner"><div class="list">${recent.map((r) => `<div class="item">${tile(game(r.gameId), 'sq')}<div class="grow"><b>${esc(game(r.gameId).name)}</b> <span class="muted" style="font-size:13px">${esc(r.label || '')}</span><div>${esc(user(r.userId).name)} earned +${fmt(r.points)} points</div></div><span class="pill yellow">${fmt(r.score)} score</span></div>`).join('') || empty('🎲', 'No games played yet')}</div></div></section>`;
  } else if (sub === 'progress') {
    const mine = D.results.filter((r) => r.userId === me().id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    main = `<section class="card panel"><h2 class="mb">My Progress</h2><div class="fi-cols-3 mb"><div class="card inner stat"><div class="k">Games played</div><div class="v">${mine.length}</div></div><div class="card inner stat"><div class="k">Best score</div><div class="v">${fmt(myBest)}</div></div><div class="card inner stat"><div class="k">Points earned</div><div class="v">${fmt(myGamePts)}</div></div></div>
      <div class="card inner"><div class="list">${mine.map((r) => `<div class="item">${tile(game(r.gameId), 'sq')}<span class="grow"><b>${esc(game(r.gameId).name)}</b><div class="muted" style="font-size:13px">${timeAgo(r.createdAt)}</div></span><span>${fmt(r.score)}</span><span class="pill green">+${r.points}</span></div>`).join('') || empty('🎮', 'Play a game to see your progress')}</div></div></section>`;
  } else if (sub === 'leaderboard') {
    main = `<section class="card panel"><h2 class="mb">Challenges Leaderboard</h2><div class="card inner">${leaderboardList(50, 'games')}</div></section>`;
  }
  return `${head}<div class="fi-grid"><div class="fi-stack">${main}</div>${side}</div>`;
}

// ---------- THE FUN TRAIN ----------
function statusPill(a) {
  const today = new Date().toISOString().slice(0, 10);
  if (a.status === 'completed') return '<span class="pill green">Completed</span>';
  if (a.due < today) return '<span class="pill red">Overdue</span>';
  if (a.due === today) return '<span class="pill orange">Due Today</span>';
  if (a.status === 'pending') return '<span class="pill yellow">Pending</span>';
  if (a.status === 'in_progress') return '<span class="pill blue">In progress</span>';
  return '<span class="pill">Not Started</span>';
}
function trainPage(sub) {
  const pg = site.pages.train;
  const head = hero({ title: esc(pg.title), subtitle: esc(pg.subtitle), action: recognizeBtn(pg.cta) });
  const mine = D.assignments.filter((a) => a.userId === me().id);
  const open = mine.filter((a) => a.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due));
  const done = mine.filter((a) => a.status === 'completed').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = open.filter((a) => a.due < today).length;
  const pct = mine.length ? (done.length / mine.length) * 100 : 0;
  const side = `<div class="fi-stack">
    <div class="card"><h3>Upskill Your Career!</h3><p class="ink2 mt">${esc(pg.promo || '')}</p><div class="center" style="font-size:80px">🦉</div><a class="btn primary block" href="#/train/library">Browse Trainings ${icon('chevron')}</a></div>
    <div class="card"><h3>Completed vs Overdue</h3><p class="muted" style="font-size:13px">Your assignments</p>${donut(pct, '#22a35a', 'Completed', overdue ? '#f6a13c' : '#e2e5f4')}
      <div class="spread"><span>🟢 Completed</span><b>${done.length}</b></div><div class="spread"><span>🟠 Overdue</span><b>${overdue}</b></div></div>
    ${F('quizzes') ? `<div class="card"><h3>Quiz Your Skills!</h3><p class="ink2 mt">Take a quiz to test your skills and see where you can improve.</p><a class="btn primary block mt" href="#/train/quiz">Start a Quiz ${icon('chevron')}</a></div>` : ''}
  </div>`;
  let main = '';
  if (!sub) {
    main = `<section class="card panel"><h2 class="mb">Assigned Trainings</h2><div class="fi-stack">${open.map((a) => { const c = course(a.courseId); return `<div class="card inner"><div class="row" style="align-items:flex-start"><div class="grow"><h3>${esc(c.name)}</h3><p class="muted">Due: ${fmtDate(a.due, { month: 'long', day: 'numeric' })}</p>
      ${a.progress > 0 ? `<div class="bar mt"><span style="width:${a.progress}%"></span></div>` : ''}<div class="spread mt">${a.progress > 0 ? `<b>${a.progress}%</b>` : statusPill(a)}${a.progress > 0 ? statusPill(a) : ''}<button class="btn ${a.progress > 0 ? 'primary' : ''} sm" data-act="train" data-id="${a.id}">${a.progress > 0 ? 'Continue' : 'Start Now'} ${icon('chevron')}</button></div></div><div style="width:120px">${tile(c)}</div></div></div>`; }).join('') || empty('🎉', 'No open trainings. Nice work!')}</div></section>
      <section class="card panel"><h2 class="mb">Completed Trainings</h2><div class="fi-cols-2">${done.map((a) => `<div class="card inner row"><span style="font-size:22px">✅</span><div><b>${esc(course(a.courseId).name)}</b><div class="muted">${fmtDate(a.completedAt)}</div></div></div>`).join('') || empty('📘', 'Nothing completed yet')}</div></section>`;
  } else if (sub === 'library') {
    main = `<section class="card panel"><h2 class="mb">Training Library</h2><div class="fi-cols-2">${D.catalogs.courses.map((c) => { const a = mine.find((x) => x.courseId === c.id); return `<div class="card inner">${tile(c)}<h3 class="mt">${esc(c.name)}</h3><p class="muted" style="font-size:14px">${esc(c.description || '')}</p><div class="spread mt"><span class="pill">${esc(c.category || 'General')} · ${c.minutes || 15} min</span>${a ? statusPill(a) : `<button class="btn sm primary" data-act="enroll" data-id="${c.id}">Enroll</button>`}</div></div>`; }).join('')}</div></section>`;
  } else if (sub === 'quiz') {
    main = `<section class="card panel"><h2>Quiz Your Skills</h2><p class="ink2 mt mb">Pick a topic. Each quiz is three quick questions.</p><div class="fi-cols-2">${D.catalogs.courses.slice(0, 6).map((c) => `<div class="card inner row">${tile(c, 'sq')}<b class="grow">${esc(c.name)}</b><button class="btn sm primary" data-act="quiz" data-id="${c.id}">Start</button></div>`).join('')}</div></section>`;
  }
  return `${head}<div class="fi-grid"><div class="fi-stack">${main}</div>${side}</div>`;
}

// ---------- FUNFLUENCE ----------
function fluencePage(sub) {
  const pg = site.pages.fluence;
  const head = hero({ title: fill(pg.title, me()), subtitle: esc(pg.subtitle), action: recognizeBtn(pg.cta) });
  const mship = D.mentorships.find((m) => m.menteeId === me().id) || D.mentorships.find((m) => m.mentorId === me().id);
  const sessions = mship ? D.sessions.filter((s) => s.mentorshipId === mship.id) : [];
  const past = sessions.filter((s) => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
  const next = sessions.filter((s) => s.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
  const groups = D.sessions.filter((s) => s.group && s.status === 'scheduled');
  const allMs = D.mentorships.length;
  const completedAll = D.sessions.filter((s) => s.status === 'completed').length;
  const totalAll = D.mentorships.reduce((s, m) => s + (m.totalSessions || 6), 0) || 1;
  const side = `<div class="fi-stack">
    <div class="card"><h3>Stats Dashboard</h3>${donut((completedAll / totalAll) * 100, '#22a35a', `${completedAll} sessions`, '#e2e5f4')}<div class="spread"><span>✅ Active pairings</span><b>${allMs}</b></div><div class="spread"><span>🟡 Sessions done</span><b>${completedAll}</b></div></div>
    ${F('groupSessions') ? `<div class="card"><h3>Upcoming Group Sessions</h3>${groups.map((g) => `<div class="mt"><b>${esc(g.title)}</b><div class="muted" style="font-size:13px">${fmtDate(g.date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${esc(g.time)}</div><div class="row mt">${(g.hostIds || []).map((h) => avatar(user(h), 'sm')).join('')}<span class="muted" style="font-size:13px">${(g.attendeeIds || []).length} attending</span></div>
      <button class="btn primary block mt" data-act="join-group" data-id="${g.id}" ${(g.attendeeIds || []).includes(me().id) ? 'disabled' : ''}>${(g.attendeeIds || []).includes(me().id) ? 'You’re in!' : 'Join Group Session'}</button></div>`).join('') || empty('📅', 'None scheduled')}</div>` : ''}
  </div>`;
  let main = '';
  if (!sub) {
    if (!mship) main = `<section class="card panel">${empty('🤝', 'You don’t have a mentor match yet. Browse mentors to request one.')}<a class="btn primary" href="#/fluence/mentors">Browse Mentors</a></section>`;
    else {
      const other = user(mship.mentorId === me().id ? mship.menteeId : mship.mentorId);
      const days = Math.max(0, Math.floor((Date.now() - new Date(mship.startedAt || Date.now())) / 864e5));
      const months = Math.round(days / 30);
      const paired = days < 7 ? 'Paired this week' : days < 30 ? `Paired for ${Math.floor(days / 7)} week${days >= 14 ? 's' : ''}` : `Paired for ${months} month${months > 1 ? 's' : ''}`;
      main = `<section class="card panel"><h2 class="mb">My Match</h2><div class="card inner"><div class="row" style="align-items:flex-start">${avatar(other, 'lg')}<div class="grow"><h2>${esc(other.name)}</h2><p class="muted">${paired}</p><p class="mt">${esc(other.title || '')}${other.department ? `, ${esc(other.department)} Team` : ''}</p>${mship.goal ? `<p class="mt ink2">🎯 Goal: <b>${esc(mship.goal)}</b></p>` : ''}</div></div>
        <div class="divider"></div><div class="spread"><span>${next ? `Next session: <b>${fmtDate(next.date, { weekday: 'long' })} · ${esc(next.time)}</b>` : 'No session scheduled'}</span>${next ? `<button class="btn primary" data-act="join-session" data-id="${next.id}">Join Session ${icon('chevron')}</button>` : ''}</div></div>
        <div class="card inner mt"><h3>Progress Tracker</h3><p class="muted">${paired}</p><div class="bar warm mt"><span style="width:${(past.length / (mship.totalSessions || 6)) * 100}%"></span></div><p class="mt">Completed Sessions: <b>${past.length}/${mship.totalSessions || 6}</b></p>
        ${next?.prompt ? `<div class="divider"></div><div class="row" style="align-items:flex-start"><span style="font-size:24px">💡</span><div><b>Suggested Prompt for Next Session</b><p class="ink2 mt">${esc(next.prompt)}</p></div></div>` : ''}
        ${next ? `<div class="row mt wrap"><button class="btn" data-act="complete-session" data-id="${next.id}">Mark as Complete</button><button class="btn" data-act="reschedule" data-id="${next.id}">Reschedule ${icon('chevron')}</button></div>` : ''}
        <div class="row mt"><input class="input grow" id="private-note" placeholder="Add private note..."><button class="btn primary" data-act="note" data-id="${mship.id}">Save Note</button></div>
        ${(mship.notes || []).filter((n) => n.userId === me().id).map((n) => `<div class="comment"><div class="bubble">${esc(n.text)} <span class="muted">· ${timeAgo(n.createdAt)}</span></div></div>`).join('')}</div></section>
        <section class="card panel"><h2 class="mb">Past Sessions</h2><div class="card inner"><div class="list">${past.map((s) => `<div class="item"><div class="grow"><b>${fmtDate(s.date, { month: 'long', day: 'numeric' })}</b> <span class="pill green">Completed</span><div>${esc(s.title)}</div></div></div>`).join('') || empty('🗓️', 'No sessions yet')}</div></div></section>`;
    }
  } else if (sub === 'mentors') {
    const mentors = D.users.filter((u) => u.role === 'manager' || D.mentorships.some((m) => m.mentorId === u.id));
    main = `<section class="card panel"><h2 class="mb">Mentors</h2><div class="fi-cols-2">${mentors.map((u) => `<div class="card inner row">${avatar(u)}<div class="grow"><b>${esc(u.name)}</b><div class="muted" style="font-size:13px">${esc(u.title || '')}</div></div><button class="btn sm" data-act="request-mentor" data-id="${u.id}">Request</button></div>`).join('') || empty('🧑‍🏫', 'No mentors listed yet')}</div></section>`;
  } else if (sub === 'sessions') {
    const all = D.sessions.filter((s) => (mship && s.mentorshipId === mship.id) || s.group).sort((a, b) => b.date.localeCompare(a.date));
    main = `<section class="card panel"><h2 class="mb">Sessions</h2><div class="card inner"><div class="list">${all.map((s) => `<div class="item"><div class="grow"><b>${esc(s.title)}</b> ${s.group ? '<span class="pill blue">Group</span>' : ''}<div class="muted">${fmtDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(s.time)}</div></div><span class="pill ${s.status === 'completed' ? 'green' : 'yellow'}">${s.status === 'completed' ? 'Completed' : 'Scheduled'}</span></div>`).join('') || empty('📅', 'No sessions')}</div></div></section>`;
  }
  return `${head}<div class="fi-grid"><div class="fi-stack">${main}</div>${side}</div>`;
}

// ---------- mini games (placeholders you can replace with real games) ----------
const TRIVIA = [
  ['What does “KPI” stand for?', ['Key Performance Indicator', 'Known Process Input', 'Key Project Item'], 0],
  ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter'], 1],
  ['How many minutes are in a full day?', ['1,440', '1,240', '2,400'], 0],
  ['What is the most common password mistake?', ['Too long', 'Reusing it everywhere', 'Using symbols'], 1],
  ['Which of these is a phishing red flag?', ['Urgent request for credentials', 'A calendar invite from your team', 'A company newsletter'], 0],
  ['Which ocean is the largest?', ['Atlantic', 'Indian', 'Pacific'], 2],
];
const WORDS = ['TEAMWORK', 'KUDOS', 'MENTOR', 'REWARD', 'TRAINING', 'CELEBRATE'];
function playGame(g) {
  if (g.type === 'scramble') return scramble(g);
  if (g.type === 'memory') return memory(g);
  return trivia(g.name, (score, correct, total) => submitScore(g, score, correct, total));
}
function trivia(title, done) {
  const qs = TRIVIA.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  modal({ title: esc(title), submitLabel: 'Submit answers', body: qs.map((q, i) => `<div class="field"><label>${i + 1}. ${esc(q[0])}</label>${q[1].map((o, j) => `<label class="row"><input type="radio" name="q${i}" value="${j}" required> ${esc(o)}</label>`).join('')}</div>`).join(''),
    onSubmit: (v) => { const correct = qs.filter((q, i) => Number(v[`q${i}`]) === q[2]).length; done(correct * 250, correct, qs.length); } });
}
function scramble(g) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  let mixed = word; while (mixed === word) mixed = word.split('').sort(() => Math.random() - 0.5).join('');
  const start = Date.now();
  modal({ title: esc(g.name), submitLabel: 'Check', body: `<p class="center" style="font-family:var(--font-display);font-size:38px;letter-spacing:8px">${mixed}</p>${field('Your answer', input('answer', '', 'required autocomplete="off"'))}`,
    onSubmit: (v) => { const ok = v.answer.trim().toUpperCase() === word; const secs = (Date.now() - start) / 1000; submitScore(g, ok ? Math.max(100, Math.round(800 - secs * 10)) : 0, ok ? 1 : 0, 1); } });
}
function memory(g) {
  const faces = ['⭐', '🎯', '🚀', '🎉', '💡', '🏆'];
  const deck = [...faces, ...faces].sort(() => Math.random() - 0.5);
  let open = [], matched = 0, moves = 0;
  const m = modal({ title: esc(g.name), hideSubmit: true, cancelLabel: 'Close', body: `<p class="muted mb">Match all the pairs in as few moves as you can.</p><div id="mem" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${deck.map((f, i) => `<button type="button" class="btn" data-i="${i}" style="height:64px;font-size:28px">?</button>`).join('')}</div>` });
  m.el.querySelector('#mem').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]'); if (!b || b.disabled || open.length === 2) return;
    b.textContent = deck[b.dataset.i]; b.disabled = true; open.push(b);
    if (open.length === 2) {
      moves++;
      const [a, c] = open;
      if (deck[a.dataset.i] === deck[c.dataset.i]) { matched++; open = []; if (matched === faces.length) { m.close(); submitScore(g, Math.max(150, 1000 - moves * 40), faces.length, faces.length); } }
      else setTimeout(() => { a.textContent = '?'; c.textContent = '?'; a.disabled = false; c.disabled = false; open = []; }, 700);
    }
  });
}
async function submitScore(g, score, correct, total) {
  try {
    const r = await capi('/play', { method: 'POST', body: { gameId: g.id, score } });
    toast(`${correct}/${total} correct · score ${fmt(score)} · +${r.result.points} points`);
    await reload(); render();
  } catch (e) { toast(e.message, true); }
}

// ---------- actions ----------
function recognizeModal(toId = '') {
  const people = D.users.filter((u) => u.id !== me().id && u.role !== 'client_admin');
  const values = D.client.recognition?.values || [];
  const max = D.client.recognition?.maxPerRecognition || 250;
  modal({
    title: 'Give Recognition', submitLabel: 'Send recognition',
    body: field('Who are you recognizing?', select('toUserId', [['', 'Choose a coworker…'], ...people.map((u) => [u.id, u.name])], toId))
      + `<div class="form-grid">${field('Company value', select('value', values))}${field('Points', input('points', Math.min(100, max), `type="number" min="0" max="${max}" step="25"`), `Up to ${max} per recognition`)}</div>`
      + field('Message', textarea('text', '', 'required placeholder="Say what they did and why it mattered…"')),
    onSubmit: async (v) => { if (!v.toUserId) { toast('Choose who to recognize', true); return false; } await capi('/recognize', { method: 'POST', body: v }); toast('Recognition sent! 🎉'); await reload(); location.hash = '#/rewards'; render(); },
  });
}

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act], [data-action="logout"]');
  if (!el) return;
  if (el.dataset.action === 'logout') { setSession(null); location.hash = ''; return showLogin(); }
  const act = el.dataset.act, id = el.dataset.id;
  const postId = el.closest('[data-post]')?.dataset.post;
  try {
    if (act === 'recognize') return recognizeModal(el.dataset.to);
    if (act === 'post' || act === 'gif') {
      const text = document.getElementById('composer')?.value.trim();
      if (act === 'post' && !text) return toast('Write something first', true);
      await capi('/posts', { method: 'POST', body: { text: text || '', gif: act === 'gif' ? 'party' : '' } });
      await reload(); render(); return;
    }
    if (act === 'like') { await capi(`/posts/${postId}`, { method: 'POST', body: { action: 'like' } }); await reload(); return render(); }
    if (act === 'comment') return modal({ title: 'Add a comment', submitLabel: 'Comment', body: textarea('text', '', 'required'), onSubmit: async (v) => { await capi(`/posts/${postId}`, { method: 'POST', body: { action: 'comment', text: v.text } }); await reload(); render(); } });
    if (act === 'share') { await navigator.clipboard?.writeText(location.href).catch(() => {}); return toast('Link copied'); }
    if (act === 'redeem') {
      const r = D.catalogs.rewards.find((x) => x.id === id);
      return modal({ title: `Redeem ${esc(r.name)}?`, submitLabel: `Redeem for ${fmt(r.cost)} points`, body: `<p>${esc(r.description || '')}</p><p class="mt">You have <b>${fmt(me().points)}</b> points. After this you'll have <b>${fmt(me().points - r.cost)}</b>.</p>`,
        onSubmit: async () => { await capi('/redeem', { method: 'POST', body: { rewardId: id } }); toast('Order placed! 🎁'); await reload(); location.hash = '#/rewards/orders'; } });
    }
    if (act === 'play') { const g = game(id); if (g.id) playGame(g); return; }
    if (act === 'train') {
      const a = D.assignments.find((x) => x.id === id); const c = course(a.courseId);
      return modal({ title: esc(c.name), submitLabel: a.progress >= 70 ? 'Finish course' : 'Complete next lesson',
        body: `${tile(c)}<p class="mt ink2">${esc(c.description || '')}</p>${c.contentUrl ? `<p class="mt"><a class="btn sm" href="${esc(c.contentUrl)}" target="_blank" rel="noopener">${icon('external')} Open course material</a></p>` : ''}<p class="mt">Lesson ${Math.min(3, Math.floor(a.progress / 34) + 1)} of 3. Work through the material, then mark the lesson complete to save your progress.</p><div class="spread mt"><div class="bar grow"><span style="width:${a.progress}%"></span></div><b style="margin-left:12px">${a.progress}%</b></div>`,
        onSubmit: async () => { await capi(`/assignments/${id}`, { method: 'PATCH', body: { progress: Math.min(100, a.progress + 34) } }); await reload(); render(); } });
    }
    if (act === 'enroll') { await capi('/assignments', { method: 'POST', body: { userId: me().id, courseId: id, due: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), progress: 0, status: 'not_started' } }); toast('Enrolled'); await reload(); return render(); }
    if (act === 'quiz') { const c = course(id); return trivia(`Quiz: ${c.name}`, (score, correct, total) => toast(`You got ${correct} of ${total} right!`)); }
    if (act === 'note') { const text = document.getElementById('private-note').value.trim(); if (!text) return; await capi(`/mentorships/${id}`, { method: 'PATCH', body: { note: text } }); toast('Note saved'); await reload(); return render(); }
    if (act === 'complete-session') { await capi(`/sessions/${id}`, { method: 'PATCH', body: { status: 'completed' } }); toast('Session marked complete'); await reload(); return render(); }
    if (act === 'reschedule') return modal({ title: 'Reschedule session', body: `<div class="form-grid">${field('Date', input('date', '', 'type="date" required'))}${field('Time', input('time', '14:00', 'type="time" required'))}</div>`, onSubmit: async (v) => { await capi(`/sessions/${id}`, { method: 'PATCH', body: v }); await reload(); render(); } });
    if (act === 'join-session') { const s = D.sessions.find((x) => x.id === id); if (s?.meetingUrl) { window.open(s.meetingUrl, '_blank', 'noopener'); return; } return toast('The meeting link will appear here when your mentor adds one.'); }
    if (act === 'join-group') { await capi(`/sessions/${id}`, { method: 'PATCH', body: { join: true } }); toast('You’re signed up!'); await reload(); return render(); }
    if (act === 'request-mentor') return toast('Request sent to your program admin.');
  } catch (err) { toast(err.message, true); }
});

boot();
