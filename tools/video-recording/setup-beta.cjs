// Records the Beta Client 1 management-site walkthrough (new client setup) via CDP screencast.
// Needs a fresh local run built for beta1: rm .dev-data.json; DEV_CLIENT=beta1 node scripts/dev.mjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'frames');
const BASE = 'http://localhost:8802/';
const DRY = process.argv.includes('--dry'); const PW = {};
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
  await card(`${cardCss}<div class="w"><div class="k">Client walkthrough · Beta Client 1</div><h1>Setting up a<br><em>new client</em> on FunIntended</h1>
  <p>A brand-new client starts with an empty site. Follow their administrator from first sign-in to a program that’s ready for employees: branding, people, rewards, games, training and mentorship.</p>
  <div class="pills"><span>🎨 Brand it</span><span>👥 Add people</span><span>🎁 Stock the shop</span><span>🚂 Assign training</span><span>🤝 Pair mentors</span></div></div>`, 7000);

  // ---- 1 Login ----
  await page.goto(BASE); await page.waitForSelector('input[name=email]'); await page.evaluate(() => document.fonts.ready);
  await caption(1, 'Day one', 'The client’s own management site', 'FunIntended creates the site and a first administrator login. This is Beta Client 1’s admin signing in for the first time.');
  await wait(2000);
  await type('input[name=email]', 'admin@beta1.client');
  await type('input[name=password]', 'demo1234');
  await wait(400);
  await click('button[type=submit]', 1600);

  // ---- 2 Empty dashboard ----
  await page.waitForSelector('.fi-sidebar');
  await caption(2, 'Dashboard', 'A clean slate', 'No employees, recognition, orders or training yet. Every module is switched on and waiting to be set up.');
  for (const s of ['.stat >> nth=0', '.stat >> nth=1', '.stat >> nth=2', '.stat >> nth=3']) { await hover(s, 550); await wait(550); }
  await hover('text=No recognition yet', 800); await wait(1000);
  await hover('text=No training assigned yet', 800); await wait(1600);
  await caption(3, 'Setup plan', 'Five steps to launch', 'Brand the site, add the team, choose rewards and games, assign training, then pair mentors. Let’s start with Settings.');
  await hover('.fi-nav', 900); await wait(2200);

  // ---- 3 Settings / branding ----
  await click('.fi-nav >> text=Settings', 1000);
  await caption(4, 'Settings', 'Make it look like your company', 'Pick your own button and navigation colors. The whole site, and the employee site, switch over once you save.');
  await hover('input[name=companyName]', 800); await wait(900);
  await hover('input[name=logoUrl]', 700); await wait(900);
  await hover('input[name=primaryColor]', 800); await page.locator('input[name=primaryColor]').fill('#0e9f8e'); await wait(1100);
  await hover('input[name=accentColor]', 800); await page.locator('input[name=accentColor]').fill('#173f5f'); await wait(1300);
  await caption(5, 'Settings', 'Your values, your recognition rules', 'Employees tag each recognition with one of these values. Set a cap on how many points one recognition can give.');
  await type('input[name=values]', 'Customer First, Own It, Better Together, Keep It Fun');
  await type('input[name=maxPerRecognition]', '200');
  await wait(600);
  await scrollTo(380, 1400);
  await caption(6, 'Settings', 'Welcome people in your own words', 'Rename any heading on the employee site. {firstName} is filled in for whoever is signed in.');
  await type('input[name="home.title"]', 'Welcome to the team, {firstName}!');
  await type('input[name="home.subtitle"]', 'Recognition, games, learning and mentoring at Beta Client 1.');
  await wait(600);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1400);
  await hover('section:has-text("Enabled features") .row', 900); await wait(1500);
  await click('form[data-form=settings] button.primary', 1800);
  await caption(7, 'Settings', 'Saved, and the new colors apply instantly', 'Features themselves are switched on by FunIntended, so the admin always sees exactly what their plan includes.');
  await wait(1200);
  await scrollTo(0, 1200);
  await hover('.fi-sidebar', 900); await wait(1600);

  // ---- 4 Employees ----
  await click('.fi-nav >> text=Employees', 1000);
  await caption(8, 'Employees', 'Only the admin so far', 'Next, add the people who will use FunIntended. Start with a manager.');
  await hover('tbody tr >> nth=0', 800); await wait(1400);
  await click('[data-act=add-user]', 900);
  await capPos('top');
  await caption(9, 'Employees', 'Add a manager', 'Managers can recognize, assign training and pair mentors, but can’t change settings or add people.', 'top');
  await type('.fi-modal input[name=name]', 'Maria Gonzalez');
  await type('.fi-modal input[name=email]', 'maria@beta1.client');
  await choose('.fi-modal select[name=role]', 'manager');
  await type('.fi-modal input[name=title]', 'Operations Manager');
  await type('.fi-modal input[name=department]', 'Operations');
  await type('.fi-modal input[name=points]', '1000');
  await click('.fi-modal input[name=hireDate]', 200); await page.locator('.fi-modal input[name=hireDate]').fill('2021-03-15'); await wait(500);
  await hover('.fi-modal input[name=password]', 700); await wait(900);
  await click('.fi-modal button[type=submit]', 1400);
  await caption(10, 'Employees', 'A password is generated for you', 'Copy these details to the new person. We’ll use Maria’s to sign in as a manager at the end.', 'top');
  const creds = await page.locator('.fi-modal pre').textContent();
  const mariaPw = /Password:\s*(\S+)/.exec(creds)[1]; PW.maria = mariaPw;
  await hover('.fi-modal pre', 800); await wait(2600);
  await click('.fi-modal [data-close] >> nth=-1', 900);
  await click('[data-act=add-user]', 900);
  await caption(11, 'Employees', 'Then the rest of the team', 'Give everyone a starting points balance so they can recognize colleagues and shop from day one.', 'top');
  await type('.fi-modal input[name=name]', 'Tyler Brooks');
  await type('.fi-modal input[name=email]', 'tyler@beta1.client');
  await type('.fi-modal input[name=title]', 'Warehouse Lead');
  await type('.fi-modal input[name=department]', 'Operations');
  await type('.fi-modal input[name=points]', '500');
  await click('.fi-modal input[name=birthday]', 200); await page.locator('.fi-modal input[name=birthday]').fill('1994-12-02'); await wait(500);
  await click('.fi-modal button[type=submit]', 1200);
  PW.tyler = /Password:\s*(\S+)/.exec(await page.locator('.fi-modal pre').textContent())[1];
  await click('.fi-modal [data-close] >> nth=-1', 800);
  await click('[data-act=add-user]', 800);
  await type('.fi-modal input[name=name]', 'Priya Shah');
  await type('.fi-modal input[name=email]', 'priya@beta1.client');
  await type('.fi-modal input[name=title]', 'Support Specialist');
  await type('.fi-modal input[name=department]', 'Customer Success');
  await type('.fi-modal input[name=points]', '500');
  await click('.fi-modal button[type=submit]', 1200);
  PW.priya = /Password:\s*(\S+)/.exec(await page.locator('.fi-modal pre').textContent())[1];
  await click('.fi-modal [data-close] >> nth=-1', 900);
  await capPos('bottom');
  await caption(12, 'Employees', 'The team is in', 'Roles, departments and point balances at a glance. Edit anyone later to change their role, reset a password or disable the account.');
  await hover('tr:has-text("Maria Gonzalez")', 800); await wait(900);
  await hover('tr:has-text("Tyler Brooks")', 700); await wait(900);
  await hover('tr:has-text("Priya Shah")', 700); await wait(1000);
  await click('tr:has-text("Priya Shah") [data-act=edit-user]', 1000);
  await capPos('top');
  await hover('.fi-modal input[name=points]', 800); await wait(800);
  await hover('.fi-modal .toggle', 800); await wait(1600);
  await click('.fi-modal [data-close] >> nth=-1', 800);
  await capPos('bottom');

  // ---- 5 Rewards ----
  await click('.fi-nav >> text=Rewards & Orders', 1000);
  await caption(13, 'Rewards & Orders', 'Orders will appear here', 'When employees spend points in the rewards shop, each redemption lands on this list for the admin to fulfil.');
  await hover('text=No orders yet', 800); await wait(1600);
  await click('.tabs >> text=Rewards Catalog', 1000);
  await caption(14, 'Rewards & Orders', 'Choose what’s in your shop', 'FunIntended supplies a starter catalog. Switch off anything that doesn’t fit your budget.');
  await hover('.fi-cols-3 .card >> nth=0', 800); await wait(800);
  await hover('.fi-cols-3 .card:has-text("Wireless Headphones")', 800); await wait(600);
  await click('.fi-cols-3 .card:has-text("Wireless Headphones") >> .toggle', 1400);
  await click('[data-act=cat-add]', 900);
  await capPos('top');
  await caption(15, 'Rewards & Orders', 'Add rewards only your company offers', 'Name, description, emoji or image, and a point cost. It shows up in the employee shop straight away.', 'top');
  await type('.fi-modal input[name=name]', 'Lunch with the CEO');
  await type('.fi-modal input[name=description]', 'An hour and a meal with our CEO, your pick of restaurant.');
  await type('.fi-modal input[name=emoji]', '🥂');
  await type('.fi-modal input[name=cost]', '2500');
  await wait(600);
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1500);
  await hover('.card:has-text("Lunch with the CEO")', 900); await wait(2200);
  await scrollTo(0, 800);

  // ---- 6 Games ----
  await click('.fi-nav >> text=Games', 1000);
  await caption(16, 'Fun & Games', 'Scores will show up here', 'Every game played, with the score and points earned. Empty for now, until employees start playing.');
  await hover('text=No games played yet', 800); await wait(1600);
  await click('.tabs >> text=Game Library', 1000);
  await caption(17, 'Fun & Games', 'Pick the games for your people', 'Trivia, word scramble, memory and more. Turn off any you don’t want, or add your own.');
  await hover('.fi-cols-3 .card >> nth=0', 800); await wait(900);
  await hover('.fi-cols-3 .card >> nth=1', 700); await wait(700);
  await click('.fi-cols-3 .card:has-text("Leaderboard Race") >> .toggle', 1400);
  await hover('.fi-cols-3 .card >> nth=3', 700); await wait(1200);

  // ---- 7 Training ----
  await click('.fi-nav >> text=Training', 1000);
  await click('.tabs >> text=Training Library', 1000);
  await caption(18, 'The Fun Train', 'A ready-made training library', 'Courses on leadership, security, communication and more come included, and you can add your own.');
  await hover('.fi-cols-3 .card >> nth=0', 800); await wait(800);
  await hover('.fi-cols-3 .card >> nth=2', 700); await wait(900);
  await click('[data-act=cat-add]', 900);
  await capPos('top');
  await caption(19, 'The Fun Train', 'Add your own onboarding course', 'Link to your existing content, a video, document or slide deck, and set how long it takes.', 'top');
  await type('.fi-modal input[name=name]', 'Welcome to Beta Client 1');
  await type('.fi-modal input[name=description]', 'Our story, our values and the tools you’ll use every day.');
  await type('.fi-modal input[name=emoji]', '👋');
  await type('.fi-modal input[name=minutes]', '30');
  await type('.fi-modal input[name=contentUrl]', 'https://intranet.example.com/onboarding');
  await wait(500);
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await wait(1500);
  await hover('.card:has-text("Welcome to Beta Client 1")', 900); await wait(1800);
  await scrollTo(0, 800);
  await click('.tabs >> text=Assignments', 1000);
  await caption(20, 'The Fun Train', 'Assign it to everyone', 'Pick the course, set a due date and tick the people who need it.');
  await hover('text=No assignments yet', 700); await wait(900);
  await click('[data-act=assign]', 900);
  await capPos('top');
  await choose('.fi-modal select[name=courseId]', { label: 'Welcome to Beta Client 1' });
  await click('.fi-modal .toggle:has-text("Maria Gonzalez")', 450);
  await click('.fi-modal .toggle:has-text("Tyler Brooks")', 450);
  await click('.fi-modal .toggle:has-text("Priya Shah")', 700);
  await click('.fi-modal button[type=submit]', 1400);
  await click('[data-act=assign]', 900);
  await caption(21, 'The Fun Train', 'Layer on role-specific training', 'Priya works with customers, so she also gets Customer Service Excellence.', 'top');
  await choose('.fi-modal select[name=courseId]', { label: 'Customer Service Excellence' });
  await click('.fi-modal .toggle:has-text("Priya Shah")', 700);
  await click('.fi-modal button[type=submit]', 1400);
  await capPos('bottom');
  await caption(22, 'The Fun Train', 'Progress tracked for every person', 'Each assignment shows its due date, a progress bar and status. Overdue items turn red automatically.');
  await hover('tbody tr >> nth=0', 800); await wait(900);
  await hover('tbody tr >> nth=3', 700); await wait(1800);

  // ---- 8 Mentorship ----
  await click('.fi-nav >> text=Mentorship', 1000);
  await caption(23, 'FunFluence', 'Start a mentorship program', 'Pair experienced people with newer ones and give each pairing a goal.');
  await hover('text=No pairings yet', 800); await wait(1000);
  await click('[data-act=pair]', 900);
  await capPos('top');
  await choose('.fi-modal select[name=mentorId]', { label: 'Maria Gonzalez' });
  await choose('.fi-modal select[name=menteeId]', { label: 'Tyler Brooks' });
  await type('.fi-modal input[name=goal]', 'Grow into a shift supervisor role');
  await type('.fi-modal input[name=totalSessions]', '8');
  await wait(500);
  await click('.fi-modal button[type=submit]', 1400);
  await click('.list .item:has-text("Tyler Brooks") [data-act=add-session]', 900);
  await caption(24, 'FunFluence', 'Schedule the first session', 'Add a suggested prompt to get the conversation going. Both people see it on the employee site.', 'top');
  await type('.fi-modal input[name=title]', 'Kickoff: where do you want to be in a year?');
  const d1 = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await click('.fi-modal input[name=date]', 200); await page.locator('.fi-modal input[name=date]').fill(d1); await wait(400);
  await type('.fi-modal textarea[name=prompt]', 'What part of the job do you enjoy most, and what would you like to do more of?');
  await wait(500);
  await click('.fi-modal button[type=submit]', 1300);
  await click('[data-act=add-group]', 900);
  await caption(25, 'FunFluence', 'Plan a group session for everyone', 'Group sessions like a lunch and learn appear for the whole company to join.', 'top');
  await type('.fi-modal input[name=title]', 'Lunch & Learn: Meet the team');
  const d2 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await click('.fi-modal input[name=date]', 200); await page.locator('.fi-modal input[name=date]').fill(d2); await wait(400);
  await click('.fi-modal input[name=time]', 200); await page.locator('.fi-modal input[name=time]').fill('12:00'); await wait(400);
  await click('.fi-modal .toggle:has-text("Maria Gonzalez")', 700);
  await click('.fi-modal button[type=submit]', 1400);
  await capPos('bottom');
  await hover('.list .item:has-text("Tyler Brooks")', 800); await wait(1200);
  await hover('text=Lunch & Learn: Meet the team', 800); await wait(1800);

  // ---- 9 Recognition ----
  await click('.fi-nav >> text=Recognition', 1000);
  await caption(26, 'Recognition', 'Ready for the first shout-out', 'Once employees sign in, their recognition and posts fill this feed, and the admin can remove anything inappropriate.');
  await hover('text=No posts yet', 800); await wait(2400);

  // ---- 10 Reports ----
  await click('.fi-nav >> text=Reports', 1000);
  await caption(27, 'Reports', 'Engagement by department, from day one', 'Operations and Customer Success already appear, with points balances and training progress. Export to CSV any time.');
  await hover('tbody tr >> nth=0', 800); await wait(1000);
  await hover('tbody tr >> nth=1', 600); await wait(1000);
  const dl = page.waitForEvent('download').catch(() => null);
  await click('[data-act=csv]', 1500); await dl;
  await wait(600);

  // ---- 11 Dashboard after ----
  await click('.fi-nav >> text=Dashboard', 1000);
  await caption(28, 'Dashboard', 'Set up and ready to launch', 'Three people, one manager, four training assignments and a mentorship under way, all in about ten minutes.');
  for (const s of ['.stat >> nth=0', '.stat >> nth=3']) { await hover(s, 650); await wait(900); }
  await hover('.donut', 800); await wait(1600);

  // ---- 12 Manager hand-off ----
  await caption(29, 'Hand-off', 'Maria signs in as a manager', 'Using the password generated when she was added, Maria gets her own, lighter view of the same site.');
  await click('[data-action=logout]', 1200);
  await type('input[name=email]', 'maria@beta1.client');
  await type('input[name=password]', mariaPw);
  await click('button[type=submit]', 1600);
  await page.waitForSelector('.fi-sidebar');
  await caption(30, 'Roles', 'No Settings, no adding people', 'Managers see the programs and reports, and can assign training and pair mentors for their team.');
  await hover('.fi-nav', 900); await wait(1400);
  await click('.fi-nav >> text=Training', 1000);
  await hover('tbody tr >> nth=0', 800); await wait(1800);

  // ---- 13 Sign out ----
  await caption(31, 'Sign out', 'Next stop: the employee site', 'Tyler and Priya can now sign in to Beta Client 1’s employee site to recognize, play, learn and connect.');
  await click('[data-action=logout]', 2600);
  await hideCaption(); await wait(500);

  // ---- Closing ----
  await card(`${cardCss}<div class="w"><h2>From empty site to launch-ready</h2>
  <div class="grid"><div>🎨 Branded<small>Colors, values, page text</small></div><div>👥 Team added<small>Manager and employees</small></div><div>🎁 Shop stocked<small>Catalog plus a custom reward</small></div>
  <div>🎮 Games chosen<small>Library switched on or off</small></div><div>🚂 Training assigned<small>Custom onboarding course</small></div><div>🤝 Mentoring started<small>Pairing and group session</small></div>
  <div>📊 Reports live<small>By department, CSV export</small></div><div>🔐 Roles in place<small>Admin and manager views</small></div><div>🚀 Ready for employees<small>Sign-in details shared</small></div></div>
  <p style="margin-top:34px;font-size:20px"><b style="color:#fb923c">FunIntended</b> · Rewards, games, training and mentorship in one place</p></div>`, 7000);

  fs.writeFileSync(path.join(__dirname, 'beta-passwords.json'), JSON.stringify(PW)); const tEnd = Date.now() / 1000; await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify({ meta, tEnd }));
  console.log('frames', meta.length, 'duration', (meta.at(-1).t - meta[0].t).toFixed(1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
