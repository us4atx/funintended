// Records the Beta Client 1 employee-site walkthrough (Tyler Brooks' first week) via CDP screencast.
// Needs the beta1 setup first: rm .dev-data.json; DEV_CLIENT=beta1 node scripts/dev.mjs, then
// node setup-beta.cjs --dry (the beta admin video run silently, saves beta-passwords.json) and
// node seed-activity.cjs <path to .dev-data.json> (a little first-week activity from Maria and Priya).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'frames');
const BASE = 'http://localhost:8803/';
const DRY = process.argv.includes('--dry');
const PW = JSON.parse(fs.readFileSync(path.join(__dirname, 'beta-passwords.json')));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const OVERLAY = `
(() => {
  if (window.__ov) return; window.__ov = true;
  const css = \`
  #rec-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  .rec-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #0e9f8e;z-index:2147483646;pointer-events:none;animation:recr .55s ease-out forwards}
  @keyframes recr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #rec-cap{position:fixed;left:50%;bottom:22px;transform:translate(-50%,30px);opacity:0;transition:opacity .45s ease,transform .45s ease;z-index:2147483640;pointer-events:none;
    width:min(940px,calc(100vw - 80px));background:rgba(19,52,79,.96);color:#fff;border-radius:18px;padding:16px 22px;display:flex;gap:18px;align-items:center;
    box-shadow:0 18px 50px rgba(10,16,50,.35);border:1px solid rgba(255,255,255,.08);font-family:'Nunito',system-ui,sans-serif}
  #rec-cap.on{opacity:1;transform:translate(-50%,0)}
  #rec-cap.top{bottom:auto;top:76px;transform:translate(-50%,-30px)} #rec-cap.top.on{transform:translate(-50%,0)}
  #rec-cap .n{flex:0 0 auto;width:50px;height:50px;border-radius:13px;background:linear-gradient(160deg,#2dd4bf,#0e9f8e);display:grid;place-items:center;font:700 22px 'Fredoka',sans-serif}
  #rec-cap .k{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#5eead4;font-weight:800}
  #rec-cap .t{font:600 21px/1.25 'Fredoka',sans-serif;margin:2px 0}
  #rec-cap .s{font-size:14.5px;color:#cfe3ec;line-height:1.4}
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
  background:radial-gradient(700px 480px at 78% 12%,rgba(45,212,191,.30),transparent 70%),radial-gradient(900px 600px at 8% 105%,rgba(14,159,142,.45),transparent 70%),linear-gradient(160deg,#1f5578,#122f47)}
  .w{text-align:center;max-width:1100px;padding:0 40px;animation:in 1s ease both}@keyframes in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  .k{color:#5eead4;letter-spacing:.24em;font-weight:800;font-size:15px;text-transform:uppercase}
  h1{font:700 74px/1.05 Fredoka,sans-serif;margin:18px 0 10px}h1 em{font-style:normal;color:#2dd4bf}
  h2{font:700 60px/1.1 Fredoka,sans-serif;margin:0 0 18px}
  p{font-size:22px;line-height:1.5;color:#d3e6ee;margin:0 auto;max-width:900px}
  .pills{display:flex;gap:12px;justify-content:center;margin-top:30px;flex-wrap:wrap}.pills span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:9px 18px;font-weight:700;font-size:17px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:34px auto 0;max-width:960px;text-align:left}
  .grid div{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:14px 18px;font-size:17px;font-weight:700}.grid small{display:block;color:#bcd6e2;font-weight:600;font-size:14px;margin-top:2px}
  </style>`;


  // ---- game helpers: play the placeholder games "for real" by reading the screen ----
  const TRIVIA = {
    'What does “KPI” stand for?': 0, 'Which planet is known as the Red Planet?': 1, 'How many minutes are in a full day?': 0,
    'What is the most common password mistake?': 1, 'Which of these is a phishing red flag?': 0, 'Which ocean is the largest?': 2,
  };
  const WORDS = ['TEAMWORK', 'KUDOS', 'MENTOR', 'REWARD', 'TRAINING', 'CELEBRATE'];
  async function answerTrivia() {
    const labels = await page.locator('.fi-modal .field > label:first-child').allTextContents();
    for (let i = 0; i < labels.length; i++) {
      const q = labels[i].replace(/^\d+\.\s*/, '').trim();
      const j = TRIVIA[q] ?? 0;
      await click(`.fi-modal label.row:has(input[name=q${i}][value="${j}"])`, 650);
    }
  }
  async function playMemory() {
    const seen = {}; const done = new Set(); const face = (i) => page.evaluate((i) => document.querySelector(`#mem button[data-i="${i}"]`)?.textContent.trim() ?? '', i);
    const flip = async (i) => { await click(`#mem button[data-i="${i}"]`, 380); const f = await face(i); seen[i] = f; return f; };
    let guard = 0;
    while (done.size < 12 && guard++ < 40 && await page.locator('#mem').count()) {
      const pair = Object.entries(seen).filter(([i]) => !done.has(+i)).map(([i, f]) => [+i, f])
        .find(([i, f], k, arr) => arr.some(([j, g]) => j !== i && g === f));
      if (pair) { const other = Object.entries(seen).find(([j, g]) => +j !== pair[0] && g === pair[1] && !done.has(+j)); await flip(pair[0]); await flip(+other[0]); done.add(pair[0]); done.add(+other[0]); await wait(250); continue; }
      const unknown = [...Array(12).keys()].filter((i) => !(i in seen));
      const a = unknown[0]; const fa = await flip(a);
      const match = Object.entries(seen).find(([j, g]) => +j !== a && g === fa && !done.has(+j));
      const b = match ? +match[0] : unknown[1];
      const fb = await flip(b);
      if (fa === fb) { done.add(a); done.add(b); await wait(250); } else await wait(650);
      if (done.size === 12) break;
    }
  }


  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

  // ---- Title ----
  await card(`${cardCss}<div class="w"><div class="k">Employee walkthrough · Beta Client 1</div><h1>Tyler’s first week<br>at <em>Beta Client 1</em></h1>
  <p>The admin set up the site, the team and the programs. Now Tyler Brooks, a new warehouse lead, signs in and puts it to work: onboarding, recognition, games, rewards and a mentor.</p>
  <div class="pills"><span>👋 Onboarding</span><span>🌟 Recognition</span><span>🎮 Games</span><span>🎁 Rewards</span><span>🤝 Mentorship</span></div></div>`, 7000);

  let ch = 0; const C = (...a) => caption(++ch, ...a);

  // ---- Sign in ----
  await page.goto(BASE); await page.waitForSelector('input[name=email]'); await page.evaluate(() => document.fonts.ready);
  await C('Sign in', 'Beta Client 1’s own employee site', 'Their name and teal brand color, set by their admin. Tyler signs in with the details he was given when he was added.');
  await wait(2200);
  await type('input[name=email]', 'tyler@beta1.client');
  await type('input[name=password]', PW.tyler);
  await wait(400);
  await click('button[type=submit]', 1600);

  // ---- Home ----
  await page.waitForSelector('.fi-sidebar');
  await C('Home', 'A welcome written by his own company', '“Welcome to the team, Tyler!” is the heading the admin wrote in Settings, with his first name filled in.');
  await hover('.fi-hero h1, .fi-content h1', 800); await wait(1600);
  for (let i = 0; i < 4; i++) { await hover(`.fi-content .fi-cols-4 > a >> nth=${i}`, 600); await wait(500); }
  await hover('.fi-content .card:has-text("My Points")', 800); await wait(900);
  await C('Home', '700 points to start with', 'The 500 the admin gave him, plus 200 from his manager Maria, who already recognized him this week.');
  await hover('section:has-text("Recent Recognition") .post:has-text("Tyler Brooks")', 900); await wait(2400);
  await scrollTo(520, 1400);
  await C('Home', 'What’s next for Tyler', 'His onboarding course is due December 4, Maria is his mentor and their first session is already booked.');
  await hover('section:has-text("My Trainings")', 800); await wait(1300);
  await hover('section:has-text("Mentorship") >> nth=-1', 800); await wait(1300);
  await hover('text=Birthdays & Anniversaries', 800); await wait(1300);
  await scrollTo(0, 900);

  // ---- Onboarding training ----
  await click('.fi-topbar .links >> text=Training', 1000);
  await C('The Fun Train', 'Day one: the company’s own onboarding course', '“Welcome to Beta Client 1” was added by the admin and assigned to everyone, so it’s first on Tyler’s list.');
  await hover('.fi-content .card.inner:has-text("Welcome to Beta Client 1")', 800); await wait(1800);
  await click('.card.inner:has-text("Welcome to Beta Client 1") [data-act=train]', 900);
  await capPos('top');
  await C('The Fun Train', 'Their content, tracked in FunIntended', 'The course links to Beta Client 1’s own onboarding material. Tyler works through it a lesson at a time.', 'top');
  await hover('.fi-modal a.btn', 800); await wait(1600);
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await hover('.fi-content .card.inner:has-text("Welcome to Beta Client 1") .bar', 700); await wait(1000);
  await click('.card.inner:has-text("Welcome to Beta Client 1") [data-act=train]', 800);
  await capPos('top');
  await hover('.fi-modal .bar', 600); await wait(700);
  await click('.fi-modal button[type=submit]', 1200);
  await click('.card.inner:has-text("Welcome to Beta Client 1") [data-act=train]', 800);
  await C('The Fun Train', 'Last lesson', 'Progress saves after each lesson, so he can stop and pick up again any time.', 'top');
  await hover('.fi-modal .bar', 600); await wait(1000);
  await click('.fi-modal button[type=submit]', 1500);
  await capPos('bottom');
  await C('The Fun Train', 'Onboarding done, well ahead of the due date', 'It moves to Completed and the chart fills in. The admin’s training report updates at the same moment.');
  await hover('.fi-content section:has-text("Completed Trainings") .card.inner >> nth=0', 800); await wait(1200);
  await hover('.donut, .fi-content svg >> nth=-1', 800).catch(() => {}); await wait(1500);
  await click('.fi-nav >> text=Training Library', 900);
  await C('The Fun Train', 'Signing up for more', 'Tyler wants to become a shift supervisor, so he enrolls himself in Leadership Basics from the library.');
  await hover('.fi-cols-2 .card:has-text("Welcome to Beta Client 1")', 700).catch(() => {}); await wait(800);
  await hover('.fi-cols-2 .card:has-text("Leadership Basics")', 800); await wait(800);
  await click('.fi-cols-2 .card:has-text("Leadership Basics") [data-act=enroll]', 1400);
  await hover('.fi-cols-2 .card:has-text("Leadership Basics") .pill >> nth=-1', 700); await wait(1400);
  await scrollTo(0, 800);

  // ---- Recognize a coworker ----
  await click('.fi-topbar .links >> text=Rewards', 1000);
  await C('Fun Rewards', 'A team feed that’s already going', 'Maria welcomed Tyler, Priya introduced herself and Maria recognized Priya. Everyone sees it all.');
  await hover('.post >> nth=0', 800); await wait(1100);
  await scrollTo(420, 1300); await hover('.post:has-text("Who else is coming")', 800); await wait(1300);
  await scrollTo(0, 900);
  await click('.fi-hero [data-act=recognize]', 900);
  await capPos('top');
  await C('Fun Rewards', 'Tyler’s first recognition', 'He thanks Priya, tagging it with one of Beta Client 1’s own values. Points are capped at the 200 the admin chose.', 'top');
  await choose('.fi-modal select[name=toUserId]', { label: 'Priya Shah' });
  await choose('.fi-modal select[name=value]', 'Better Together');
  await type('.fi-modal input[name=points]', '150');
  await type('.fi-modal textarea[name=text]', 'Walked me through the order system on my first morning and saved me hours. Thanks Priya!');
  await wait(600);
  await click('.fi-modal button[type=submit]', 1500);
  await capPos('bottom');
  await C('Fun Rewards', 'Straight to the top of the feed', 'Priya gets 150 points right away, and the whole company sees the thank-you.');
  await hover('.post >> nth=0', 800); await wait(2200);
  await C('Fun Rewards', 'Like, comment and post', 'Tyler likes Maria’s shout-out for Priya, replies to her Lunch & Learn question and shares some good news.');
  await click('.post:has-text("five-star review") [data-act=like]', 1100);
  await click('.post:has-text("Who else is coming") [data-act=comment]', 900);
  await capPos('top');
  await type('.fi-modal textarea[name=text]', 'I’ll be there! Save me a seat 🙌');
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await hover('.post:has-text("Who else is coming") .comment >> nth=-1', 900); await wait(1400);
  await scrollTo(0, 900);
  await type('#composer', 'All three morning trucks out the door by 7:15 today. Nice work, Operations crew! 🚚');
  await click('[data-act=post]', 1400);
  await hover('.post >> nth=0', 800); await wait(1800);

  // ---- Games ----
  await click('.fi-topbar .links >> text=Games', 1000);
  await C('Fun & Games', 'The games Beta Client 1 picked', 'Four games, because the admin switched Leaderboard Race off. Maria and Priya have already set scores to beat.');
  await hover('.fi-content .pill:has-text("games")', 700); await wait(900);
  await hover('.fi-cols-2 .card >> nth=0', 600); await wait(500);
  await hover('.fi-cols-2 .card >> nth=2', 600); await wait(700);
  await hover('.fi-stack .card:has-text("Challenges Leaderboard") .list', 800); await wait(1300);
  await click('.fi-cols-2 .card:has-text("Trivia Challenge") [data-act=play]', 900);
  await capPos('top');
  await C('Fun & Games', 'Trivia Challenge', 'Three questions, a chance to earn up to 145 points.', 'top');
  await answerTrivia(); await wait(400);
  await click('.fi-modal button[type=submit]', 2300);
  await C('Fun & Games', 'Word Scramble', 'The faster he unscrambles it, the higher the score.', 'top');
  await click('.fi-cols-2 .card:has-text("Word Scramble") [data-act=play]', 1000);
  const mixed = (await page.locator('.fi-modal p.center').textContent()).trim();
  const word = WORDS.find((w) => w.split('').sort().join('') === mixed.split('').sort().join('')) || WORDS[0];
  await wait(900);
  await type('.fi-modal input[name=answer]', word.toLowerCase());
  await click('.fi-modal button[type=submit]', 2300);
  await C('Fun & Games', 'Memory Match', 'Find all six pairs in as few moves as possible.', 'top');
  await click('.fi-cols-2 .card:has-text("Memory Match") [data-act=play]', 900);
  await playMemory();
  await wait(2200);
  await capPos('bottom');
  await C('Fun & Games', 'On the board', 'Tyler’s results join the feed of recent games, and he climbs the Challenges Leaderboard.');
  await scrollTo(99999, 1500);
  await hover('.fi-content section:has-text("Recent Results") .item >> nth=0', 800); await wait(1500);
  await scrollTo(0, 900);
  await click('.fi-nav >> text=Leaderboard', 900);
  await hover('.fi-content .list .item:has-text("Tyler Brooks")', 800); await wait(1700);

  // ---- Shop ----
  await click('.fi-topbar .links >> text=Rewards', 900);
  await click('.fi-nav >> text=Rewards Shop', 900);
  await C('Rewards Shop', 'Beta Client 1’s shop, with its own reward', 'Lunch with the CEO is the reward the admin added. The headphones they switched off don’t appear at all.');
  await hover('.fi-content .pill.blue', 700); await wait(900);
  await hover('.fi-cols-3 .card:has-text("Lunch with the CEO")', 900); await wait(800);
  await C('Rewards Shop', 'Something to aim for', 'Tyler can see exactly how many more points Lunch with the CEO needs. For now he picks something he can afford.');
  await hover('.fi-cols-3 .card:has-text("Lunch with the CEO") .muted >> nth=-1', 700); await wait(1600);
  await hover('.fi-cols-3 .card:has-text("Coffee Mug")', 800); await wait(500);
  await click('.fi-cols-3 .card:has-text("Coffee Mug") [data-act=redeem]', 900);
  await capPos('top');
  await C('Rewards Shop', 'Confirm the order', 'A branded mug for 800 points. The new balance is shown before he confirms.', 'top');
  await hover('.fi-modal .body', 700); await wait(1700);
  await click('.fi-modal button[type=submit]', 1600);
  await capPos('bottom');
  await C('My Orders', 'His first order', 'It goes to Beta Client 1’s admin to fulfil, and the status here updates as they do.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(2000);
  await click('.fi-nav >> text=My Points', 900);
  await C('My Points', 'Every point accounted for', 'Recognition from Maria, three games and the mug, newest first.');
  await hover('.fi-content .list .item >> nth=0', 700); await wait(700);
  await hover('.fi-content .list .item >> nth=-1', 800); await wait(1600);
  await click('.fi-nav >> text=Birthdays', 900);
  await C('Celebrations', 'Birthdays and work anniversaries', 'From the dates the admin entered: Tyler’s birthday is coming up, and Maria’s sixth anniversary is in March.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(1000);
  await hover('.fi-content .list .item >> nth=1', 700); await wait(1600);

  // ---- Mentorship ----
  await click('.fi-topbar .links >> text=Mentorship', 1000);
  await C('FunFluence', 'Tyler’s mentor is his manager, Maria', 'The pairing the admin set up, with its goal: grow into a shift supervisor role over eight sessions.');
  await hover('.fi-content .card.inner >> nth=0', 800); await wait(1400);
  await hover('.fi-content .card.inner >> nth=0 >> text=Goal', 700).catch(() => {}); await wait(1200);
  await C('FunFluence', 'Ready for the kickoff session', 'The first session and Maria’s suggested prompt, so Tyler can think about his answer ahead of time.');
  await scrollTo(300, 1200);
  await hover('text=Suggested Prompt for Next Session', 800); await wait(1800);
  await type('#private-note', 'Tell Maria I’d like to lead the morning dispatch huddle.');
  await click('[data-act=note]', 1500); await hover('.fi-content .comment >> nth=-1', 700); await wait(1300);
  await C('FunFluence', 'Join the Lunch & Learn', 'The group session the admin planned is open to everyone. Priya’s already in, and Tyler joins with one click.');
  await scrollTo(0, 900);
  await hover('.fi-stack .card:has-text("Upcoming Group Sessions")', 700); await wait(800);
  await click('[data-act=join-group]', 1800);
  await hover('.fi-stack .card:has-text("Upcoming Group Sessions") .row', 700); await wait(1200);
  await click('.fi-nav >> text=Sessions', 900);
  await C('FunFluence', 'Both sessions on his calendar', 'His one-to-one kickoff with Maria and the company-wide Lunch & Learn.');
  await hover('.fi-content .list .item >> nth=0', 700); await wait(900);
  await hover('.fi-content .list .item >> nth=1', 700); await wait(1600);

  // ---- Back home + sign out ----
  await click('.fi-topbar .links >> text=Home', 1000);
  await C('Home', 'One week in', 'Onboarding finished, a coworker thanked, three games played, a reward ordered and a mentor lined up.');
  await hover('.fi-content .card:has-text("My Points")', 800); await wait(1200);
  await hover('section:has-text("Recent Recognition") .post >> nth=0', 800); await wait(1300);
  await scrollTo(520, 1200);
  await hover('section:has-text("My Trainings")', 800); await wait(1600);
  await scrollTo(0, 800);
  await C('Sign out', 'Signed out, everything saved', 'Tyler’s points, progress and notes stay with his own login.');
  await click('[data-action=logout]', 2400);
  await hideCaption(); await wait(500);

  // ---- Closing ----
  await card(`${cardCss}<div class="w"><h2>Beta Client 1’s program,<br>live for its people</h2>
  <div class="grid"><div>🎨 Their brand<small>Teal colors, their welcome</small></div><div>👋 Onboarding<small>Their own course, completed</small></div><div>📚 Self-enrolment<small>Leadership Basics</small></div>
  <div>🌟 Recognition<small>Their values, their point cap</small></div><div>💬 Team feed<small>Likes, comments, posts</small></div><div>🎮 Games<small>The four they chose</small></div>
  <div>🎁 Rewards<small>Lunch with the CEO and more</small></div><div>🎂 Celebrations<small>Birthdays, anniversaries</small></div><div>🤝 Mentorship<small>Maria, a goal, a Lunch &amp; Learn</small></div></div>
  <p style="margin-top:34px;font-size:20px"><b style="color:#2dd4bf">FunIntended</b> · Rewards, games, training and mentorship in one place</p></div>`, 7000);

  const tEnd = Date.now() / 1000; await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify({ meta, tEnd }));
  console.log('frames', meta.length, 'duration', (meta.at(-1).t - meta[0].t).toFixed(1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
