// Records the FunIntended Client Management (admin) walkthrough via CDP screencast.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'frames');
const BASE = 'http://localhost:8802/';
const DRY = process.argv.includes('--dry');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const OVERLAY = `
(() => {
  if (window.__ov) return; window.__ov = true;
  const css = \`
  #rec-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  .rec-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f97316;z-index:2147483646;pointer-events:none;animation:recr .55s ease-out forwards}
  @keyframes recr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #rec-cap{position:fixed;left:50%;bottom:22px;transform:translate(-50%,30px);opacity:0;transition:opacity .45s ease,transform .45s ease;z-index:2147483640;pointer-events:none;
    width:min(940px,calc(100vw - 80px));background:rgba(22,32,82,.96);color:#fff;border-radius:18px;padding:16px 22px;display:flex;gap:18px;align-items:center;
    box-shadow:0 18px 50px rgba(10,16,50,.35);border:1px solid rgba(255,255,255,.08);font-family:'Nunito',system-ui,sans-serif}
  #rec-cap.on{opacity:1;transform:translate(-50%,0)}
  #rec-cap.top{bottom:auto;top:76px;transform:translate(-50%,-30px)} #rec-cap.top.on{transform:translate(-50%,0)}
  #rec-cap .n{flex:0 0 auto;width:50px;height:50px;border-radius:13px;background:linear-gradient(160deg,#fb923c,#f97316);display:grid;place-items:center;font:700 22px 'Fredoka',sans-serif}
  #rec-cap .k{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#fdba74;font-weight:800}
  #rec-cap .t{font:600 21px/1.25 'Fredoka',sans-serif;margin:2px 0}
  #rec-cap .s{font-size:14.5px;color:#c9d0f2;line-height:1.4}
  .fi-toast{bottom:150px !important}
  .fi-modal-bg{place-items:start center !important;padding-top:184px !important}
  .fi-modal{max-height:calc(100vh - 200px) !important}
  html{scroll-behavior:smooth}\`;
  const add = () => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'rec-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11.5-6.6 1.1 3.9 7.4-3 1.5-3.8-7.5L4 20.5z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    c.style.left = (window.__cx ?? 1100) + 'px'; c.style.top = (window.__cy ?? 600) + 'px';
    document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id = 'rec-cap'; document.body.appendChild(cap);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.className = 'rec-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
    // keep overlays on top when the SPA rewrites #root (they live on body, so they survive)
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, acceptDownloads: true });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));

  const cdp = await ctx.newCDPSession(page);
  let n = 0; const meta = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `f${String(n++).padStart(6, '0')}.jpg`;
    if (!DRY) fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64'));
    meta.push({ file, t: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });

  const wait = (ms) => page.waitForTimeout(DRY ? Math.min(ms, 150) : ms);
  let cx = 1100, cy = 600;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  async function moveXY(x, y, ms = 700) {
    const steps = Math.max(8, Math.round(ms / 16)); const sx = cx, sy = cy;
    for (let i = 1; i <= steps; i++) { const k = ease(i / steps); await page.mouse.move(sx + (x - sx) * k, sy + (y - sy) * k); if (!DRY) await page.waitForTimeout(14); }
    cx = x; cy = y; await page.evaluate(([x, y]) => { window.__cx = x; window.__cy = y; }, [x, y]);
  }
  async function box(sel) {
    const loc = typeof sel === 'string' ? page.locator(sel).first() : sel.first();
    await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox();
    if (!b) throw new Error('no box ' + sel); return { loc, b };
  }
  async function hover(sel, ms = 700) { const { b } = await box(sel); await moveXY(b.x + b.width / 2, b.y + b.height / 2, ms); }
  async function click(sel, after = 700) { await hover(sel); await wait(250); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(after); }
  async function append(sel, text) { await click(sel, 200); await page.keyboard.press('End'); await page.keyboard.type(text, { delay: DRY ? 0 : 55 }); await wait(250); }
  async function type(sel, text) { await click(sel, 200); await page.keyboard.press('Control+A'); await page.keyboard.type(text, { delay: DRY ? 0 : 55 }); await wait(250); }
  async function choose(sel, value) { await click(sel, 250); await page.locator(sel).first().selectOption(value); await wait(500); }
  async function caption(num, kicker, title, sub, pos = 'bottom') {
    await page.evaluate(({ num, kicker, title, sub, pos }) => {
      const c = document.getElementById('rec-cap'); c.classList.remove('on');
      setTimeout(() => {
        c.className = pos === 'top' ? 'top' : '';
        c.innerHTML = `<div class="n">${num}</div><div><div class="k">${kicker}</div><div class="t">${title}</div><div class="s">${sub}</div></div>`;
        requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
      }, 250);
    }, { num: String(num).padStart(2, '0'), kicker, title, sub, pos });
    await wait(700);
  }
  async function hideCaption() { await page.evaluate(() => document.getElementById('rec-cap')?.classList.remove('on')); await wait(450); }
  async function capPos(pos) { await page.evaluate((pos) => { const c = document.getElementById('rec-cap'); c.classList.toggle('top', pos === 'top'); }, pos); }
  async function scrollTo(y, ms = 1200) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y); await wait(ms); }
  async function go(hash) { await page.evaluate((h) => { location.hash = h; }, hash); await wait(600); }
  async function card(html, ms) { await page.setContent(html, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await wait(ms); }

  const cardCss = `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>html,body{margin:0;height:100%}body{display:grid;place-items:center;font-family:Nunito,sans-serif;color:#fff;overflow:hidden;
  background:radial-gradient(700px 480px at 78% 12%,rgba(249,115,22,.30),transparent 70%),radial-gradient(900px 600px at 8% 105%,rgba(99,129,230,.55),transparent 70%),linear-gradient(160deg,#2b4192,#1b2a63)}
  .w{text-align:center;max-width:1100px;padding:0 40px;animation:in 1s ease both}@keyframes in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  .k{color:#fdba74;letter-spacing:.24em;font-weight:800;font-size:15px;text-transform:uppercase}
  h1{font:700 74px/1.05 Fredoka,sans-serif;margin:18px 0 10px}h1 em{font-style:normal;color:#fb923c}
  h2{font:700 60px/1.1 Fredoka,sans-serif;margin:0 0 18px}
  p{font-size:22px;line-height:1.5;color:#d6dcf7;margin:0 auto;max-width:900px}
  .pills{display:flex;gap:12px;justify-content:center;margin-top:30px;flex-wrap:wrap}.pills span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:9px 18px;font-weight:700;font-size:17px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:34px auto 0;max-width:960px;text-align:left}
  .grid div{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:14px 18px;font-size:17px;font-weight:700}.grid small{display:block;color:#c3cbef;font-weight:600;font-size:14px;margin-top:2px}
  </style>`;

  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

  // ---- Title ----
  await card(`${cardCss}<div class="w"><div class="k">Client walkthrough · Demo site</div><h1>Fun<em>Intended</em><br>Client Management</h1>
  <p>A guided click-through of the site a client's administrators and managers use to run their program: people, recognition, rewards, games, training, mentorship, reports and settings.</p>
  <div class="pills"><span>🎁 Fun Rewards</span><span>🎮 Fun &amp; Games</span><span>🚂 The Fun Train</span><span>🤝 FunFluence</span></div></div>`, 6500);

  // ---- 1 Login ----
  await page.goto(BASE); await page.waitForSelector('input[name=email]'); await page.evaluate(() => document.fonts.ready);
  await caption(1, 'Sign in', 'Each client gets its own branded management site', 'This is the Acme Corp demo. Administrators and managers sign in here; employees use a separate site.');
  await wait(1800);
  await type('input[name=email]', 'admin@acme.demo');
  await type('input[name=password]', 'demo1234');
  await wait(400);
  await click('button[type=submit]', 1600);

  // ---- 2 Dashboard ----
  await page.waitForSelector('.fi-sidebar');
  await caption(2, 'Dashboard', 'See how the whole company is doing at a glance', 'Headcount, recognition in the last 30 days, reward orders waiting to be fulfilled and training completion.');
  for (const s of ['.stat >> nth=0', '.stat >> nth=1', '.stat >> nth=2', '.stat >> nth=3']) { await hover(s, 600); await wait(700); }
  await wait(600);
  await caption(3, 'Dashboard', 'Latest recognition, overdue training and top performers', 'Everything that needs attention is one click away, with shortcuts into each program.');
  await hover('text=Latest Recognition', 800); await wait(1300);
  await hover('text=Overdue Training', 800); await wait(1300);
  await hover('.donut, svg >> nth=-1', 800).catch(() => {}); await wait(800);
  await hover('text=Most Recognized', 800); await wait(1800);

  // ---- 3 Employees ----
  await click('.fi-nav >> text=Employees', 900);
  await caption(4, 'Employees', 'Everyone who can sign in, in one list', 'Roles, departments, point balances and account status. Admins can add, edit or disable anyone.');
  await hover('tbody tr >> nth=2', 800); await wait(900);
  await hover('tbody tr >> nth=5', 800); await wait(1600);
  await click('[data-act=add-user]', 900);
  await capPos('top');
  await caption(5, 'Employees', 'Add a new employee in seconds', 'Set their role, title, department, starting points, birthday and hire date. A password is generated if you leave it blank.', 'top');
  await type('.fi-modal input[name=name]', 'Jordan Lee');
  await type('.fi-modal input[name=email]', 'jordan@acme.demo');
  await choose('.fi-modal select[name=role]', 'employee');
  await type('.fi-modal input[name=title]', 'Account Executive');
  await type('.fi-modal input[name=department]', 'Sales');
  await type('.fi-modal input[name=points]', '500');
  await wait(700);
  await click('.fi-modal button[type=submit]', 1400);
  await caption(6, 'Employees', 'Share the sign-in details', 'The new person can sign in to the employee site right away with these credentials.', 'top');
  await hover('.fi-modal pre', 800); await wait(2600);
  await click('.fi-modal [data-close] >> nth=-1', 900);
  await capPos('bottom');
  await caption(7, 'Employees', 'Edit details or disable an account', 'Change roles, reset a password, adjust points, or switch someone off when they leave.');
  await scrollTo(400, 1200);
  await hover('tr:has-text("Jordan Lee")', 800); await wait(900);
  await click('tr:has-text("Ben Cutler") [data-act=edit-user]', 1000);
  await capPos('top');
  await hover('.fi-modal input[name=points]', 800); await wait(900);
  await hover('.fi-modal .toggle', 800); await wait(1600);
  await click('.fi-modal [data-close] >> nth=-1', 800);
  await capPos('bottom'); await scrollTo(0, 600);

  // ---- 4 Recognition ----
  await click('.fi-nav >> text=Recognition', 900);
  await caption(8, 'Recognition', 'Moderate the Fun Rewards feed', 'Every recognition and post employees share, with values, points, likes and comments. Remove anything that shouldn’t be there.');
  await hover('.list .item >> nth=0', 800); await wait(1300);
  await hover('.list .item >> nth=1', 700); await wait(1000);
  await hover('[data-act=del-post] >> nth=0', 800); await wait(2000);

  // ---- 5 Rewards ----
  await click('.fi-nav >> text=Rewards & Orders', 900);
  await caption(9, 'Rewards & Orders', 'Fulfil reward redemptions', 'When employees spend points in the rewards shop, the order lands here. Update its status as you fulfil it.');
  await hover('tbody tr >> nth=0', 800); await wait(1000);
  await choose('select[data-order] >> nth=0', 'Ordered');
  await wait(1800);
  await click('.tabs >> text=Rewards Catalog', 1000);
  await caption(10, 'Rewards & Orders', 'Choose what’s in your rewards shop', 'Switch any reward on or off for your people, or add rewards of your own.');
  await hover('.fi-cols-3 .card >> nth=1', 800); await wait(800);
  await click('.fi-cols-3 .card >> nth=1 >> .toggle', 1200);
  await click('.fi-cols-3 .card >> nth=1 >> .toggle', 1200);
  await click('[data-act=cat-add]', 900);
  await capPos('top');
  await caption(11, 'Rewards & Orders', 'Add a company-specific reward', 'Give it a name, description, emoji or image, and a point cost. It appears in the employee shop straight away.', 'top');
  await type('.fi-modal input[name=name]', 'Extra Day Off');
  await type('.fi-modal input[name=description]', 'Take a bonus paid day off, on us.');
  await type('.fi-modal input[name=emoji]', '🌴');
  await type('.fi-modal input[name=cost]', '5000');
  await wait(600);
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1500);
  await hover('.card:has-text("Extra Day Off")', 900); await wait(2200);
  await scrollTo(0, 800);

  // ---- 6 Games ----
  await click('.fi-nav >> text=Games', 900);
  await caption(12, 'Fun & Games', 'See who’s playing', 'Every game result, score and the points it earned, newest first.');
  await hover('tbody tr >> nth=0', 800); await wait(2400);
  await click('.tabs >> text=Game Library', 1000);
  await caption(13, 'Fun & Games', 'Pick which games your people can play', 'Turn games on or off, or add your own trivia, word scramble or memory game.');
  await hover('.fi-cols-3 .card >> nth=0', 800); await wait(900);
  await hover('.fi-cols-3 .card >> nth=2', 800); await wait(1200);
  await hover('[data-act=cat-add]', 800); await wait(1500);

  // ---- 7 Training ----
  await click('.fi-nav >> text=Training', 900);
  await caption(14, 'The Fun Train', 'Track every training assignment', 'Due dates, progress bars and status for each person, with overdue items flagged in red.');
  await hover('tbody tr >> nth=0', 800); await wait(900);
  await hover('tbody .pill.red', 800).catch(() => {}); await wait(1400);
  await click('[data-act=assign]', 900);
  await capPos('top');
  await caption(15, 'The Fun Train', 'Assign training to several people at once', 'Pick a course, set a due date and tick everyone who needs it.', 'top');
  await choose('.fi-modal select[name=courseId]', { label: 'Cybersecurity Awareness' });
  await click('.fi-modal .toggle:has-text("Ben Cutler")', 500);
  await click('.fi-modal .toggle:has-text("Emma Parker")', 500);
  await click('.fi-modal .toggle:has-text("Jordan Lee")', 700);
  await click('.fi-modal button[type=submit]', 1400);
  await capPos('bottom');
  await hover('tbody tr:has-text("Jordan Lee")', 900); await wait(1800);
  await click('.tabs >> text=Training Library', 1000);
  await caption(16, 'The Fun Train', 'Curate the training library', 'Choose which courses are available, or add your own with a link to the content.');
  await hover('.fi-cols-3 .card >> nth=0', 800); await wait(900);
  await scrollTo(450, 1500); await hover('.fi-cols-3 .card >> nth=6', 800); await wait(1300);
  await scrollTo(0, 900);

  // ---- 8 Mentorship ----
  await click('.fi-nav >> text=Mentorship', 900);
  await caption(17, 'FunFluence', 'Run your mentorship program', 'See every mentor and mentee pairing, their goal and how many sessions they’ve completed.');
  await hover('.list .item >> nth=0', 800); await wait(1400);
  await hover('text=Group Sessions', 800); await wait(1300);
  await click('[data-act=pair]', 900);
  await capPos('top');
  await caption(18, 'FunFluence', 'Pair a mentor with a mentee', 'Choose the two people, set a goal and the number of planned sessions.', 'top');
  await choose('.fi-modal select[name=mentorId]', { label: 'Emma Parker' });
  await choose('.fi-modal select[name=menteeId]', { label: 'Jordan Lee' });
  await type('.fi-modal input[name=goal]', 'Learn the Acme sales playbook');
  await wait(500);
  await click('.fi-modal button[type=submit]', 1400);
  await click('.list .item:has-text("Jordan Lee") [data-act=add-session]', 900);
  await caption(19, 'FunFluence', 'Schedule sessions with a suggested prompt', 'Sessions show up for both people on the employee site, ready to be marked complete.', 'top');
  await type('.fi-modal input[name=title]', 'Kickoff: goals and expectations');
  const d = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await click('.fi-modal input[name=date]', 200); await page.locator('.fi-modal input[name=date]').fill(d); await wait(400);
  await type('.fi-modal textarea[name=prompt]', 'What does success look like for you in six months?');
  await wait(500);
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await hover('.list .item:has-text("Jordan Lee")', 800); await wait(1800);

  // ---- 9 Reports ----
  await click('.fi-nav >> text=Reports', 900);
  await caption(20, 'Reports', 'Engagement by department', 'Points, recognition given and received, and training completion for each team. Download it all as a CSV.');
  await hover('tbody tr >> nth=0', 800); await wait(1000);
  await hover('tbody tr >> nth=1', 600); await wait(1000);
  const dl = page.waitForEvent('download').catch(() => null);
  await click('[data-act=csv]', 1500); await dl;
  await wait(800);

  // ---- 10 Settings ----
  await click('.fi-nav >> text=Settings', 900);
  await caption(21, 'Settings', 'Make it look and feel like your company', 'Display name, logo, button and navigation colors, company values and the points limit per recognition.');
  await hover('input[name=companyName]', 800); await wait(900);
  await hover('input[name=primaryColor]', 800); await wait(900);
  await append('input[name=values]', ', Have Fun');
  await wait(600);
  await scrollTo(380, 1400);
  await caption(22, 'Settings', 'Rename the pages your employees see', 'Override any heading or subheading on the employee site. Blank fields keep the FunIntended default.');
  await type('input[name="home.title"]', 'Welcome to Acme Fun!');
  await wait(600);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1400);
  await click('form[data-form=settings] button.primary', 1600);
  await caption(23, 'Settings', 'Features are switched on by FunIntended', 'Which modules this client has is controlled from the FunIntended backend, so admins always see what’s included.');
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1200);
  await hover('section:has-text("Enabled features") .row', 900); await wait(2400);
  await scrollTo(0, 800);

  // ---- 11 Manager view ----
  await caption(24, 'Roles', 'Managers get a lighter view', 'Next, the same site signed in as David, a manager, rather than an administrator.');
  await click('[data-action=logout]', 1200);
  await type('input[name=email]', 'david@acme.demo');
  await type('input[name=password]', 'demo1234');
  await click('button[type=submit]', 1500);
  await page.waitForSelector('.fi-sidebar');
  await caption(25, 'Roles', 'No admin-only controls for managers', 'Managers can recognize, assign training and pair mentors, but can’t add employees or change settings.');
  await hover('.fi-nav', 900); await wait(1200);
  await click('.fi-nav >> text=Employees', 900);
  await hover('thead', 800); await wait(2400);

  // ---- 12 Sign out ----
  await caption(26, 'Sign out', 'Sign out when you’re done', 'Sessions are per person, so every change is tied to whoever made it.');
  await click('[data-action=logout]', 2400);
  await hideCaption(); await wait(500);

  // ---- Closing ----
  await card(`${cardCss}<div class="w"><h2>Everything a client needs<br>to run their program</h2>
  <div class="grid"><div>👥 Employees<small>Add, edit, disable</small></div><div>🌟 Recognition<small>Moderate the feed</small></div><div>🎁 Rewards<small>Orders and shop catalog</small></div>
  <div>🎮 Fun &amp; Games<small>Results and game library</small></div><div>🚂 The Fun Train<small>Assign and track training</small></div><div>🤝 FunFluence<small>Pairings and sessions</small></div>
  <div>📊 Reports<small>By department, CSV export</small></div><div>🎨 Settings<small>Branding and page text</small></div><div>🔐 Roles<small>Admins and managers</small></div></div>
  <p style="margin-top:34px;font-size:20px"><b style="color:#fb923c">FunIntended</b> · Rewards, games, training and mentorship in one place</p></div>`, 7000);

  const tEnd = Date.now() / 1000; await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify({ meta, tEnd }));
  console.log('frames', meta.length, 'duration', (meta.at(-1).t - meta[0].t).toFixed(1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
