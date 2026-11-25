// Records the FunIntended Employee site walkthrough via CDP screencast.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'frames');
const BASE = 'http://localhost:8803/';
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
  await card(`${cardCss}<div class="w"><div class="k">Employee walkthrough · Demo site</div><h1>Fun<em>Intended</em><br>Employee Experience</h1>
  <p>A guided click-through of the site every employee uses: giving and earning recognition, spending points, playing games, completing training and working with a mentor.</p>
  <div class="pills"><span>🎁 Fun Rewards</span><span>🎮 Fun &amp; Games</span><span>🚂 The Fun Train</span><span>🤝 FunFluence</span></div></div>`, 6500);

  // ---- Login ----
  let ch = 0; const C = (...a) => caption(++ch, ...a);
  await page.goto(BASE); await page.waitForSelector('input[name=email]'); await page.evaluate(() => document.fonts.ready);
  await C('Sign in', 'Employees sign in to their company’s own site', 'This is the Acme Corp demo. We’ll follow Sarah Kim, a marketing specialist, through her day.');
  await wait(1800);
  await type('input[name=email]', 'sarah@acme.demo');
  await type('input[name=password]', 'demo1234');
  await wait(400);
  await click('button[type=submit]', 1600);

  // ---- Home ----
  await page.waitForSelector('.fi-sidebar');
  await C('Home', 'A personal hub for everything FunIntended', 'A welcome, shortcuts into the four programs and Sarah’s point balance, all on one screen.');
  for (let i = 0; i < 4; i++) { await hover(`.fi-content .fi-cols-4 > a >> nth=${i}`, 650); await wait(650); }
  await hover('.fi-content .card:has-text("My Points")', 800); await wait(1300);
  await C('Home', 'Recognition, training, mentorship and celebrations', 'Recent shout-outs, what training is due, the next mentor session and upcoming birthdays.');
  await hover('text=Recent Recognition', 800); await wait(900);
  await hover('text=Challenges Leaderboard', 800); await wait(900);
  await scrollTo(520, 1400);
  await hover('section:has-text("My Trainings")', 800); await wait(1200);
  await hover('section:has-text("Mentorship") >> nth=-1', 800); await wait(1200);
  await hover('text=Birthdays & Anniversaries', 800); await wait(1300);
  await scrollTo(0, 900);

  // ---- Give recognition ----
  await click('.fi-hero [data-act=recognize], [data-act=recognize] >> nth=0', 900);
  await capPos('top');
  await C('Fun Rewards', 'Recognize a coworker in a few seconds', 'Pick who, the company value they showed and how many points to send, then say what they did.', 'top');
  await choose('.fi-modal select[name=toUserId]', { label: 'Ben Cutler' });
  await choose('.fi-modal select[name=value]', 'Customer First');
  await type('.fi-modal input[name=points]', '150');
  await type('.fi-modal textarea[name=text]', 'Stayed late to rescue the Henderson launch and kept the client smiling the whole time. Thank you Ben!');
  await wait(600);
  await click('.fi-modal button[type=submit]', 1500);
  await capPos('bottom');

  // ---- Feed ----
  await C('Fun Rewards', 'It goes straight to the company feed', 'Everyone sees the recognition, and Ben’s points arrive instantly.');
  await hover('.post >> nth=0', 800); await wait(2200);
  await C('Fun Rewards', 'Like, comment and celebrate together', 'The feed works like a friendly company social network.');
  await scrollTo(560, 1300);
  await click('.post:has-text("Guess the office costume party") [data-act=like]', 1200);
  await click('.post:has-text("Helped train the new team member") [data-act=comment]', 900);
  await capPos('top');
  await type('.fi-modal textarea[name=text]', 'Couldn’t agree more, Ben is a great teacher! 🙌');
  await click('.fi-modal button[type=submit]', 1300);
  await capPos('bottom');
  await hover('.post:has-text("Helped train the new team member") .comment >> nth=-1', 900); await wait(1500);
  await scrollTo(0, 1000);
  await C('Fun Rewards', 'Share news, photos and GIFs', 'Not every post has to be a recognition. Anyone can share something fun.');
  await type('#composer', 'Pizza in the break room at 3pm to celebrate hitting our Q4 goal! 🍕');
  await click('[data-act=post]', 1400);
  await hover('.post >> nth=0', 800); await wait(1800);

  // ---- Shop ----
  await click('.fi-nav >> text=Rewards Shop', 900);
  await C('Rewards Shop', 'Spend points on real rewards', 'Gift cards, swag, experiences and time off. Rewards you can’t afford yet are greyed out.');
  await hover('.fi-cols-3 .card >> nth=0', 700); await wait(700);
  await hover('.fi-cols-3 .card >> nth=3', 700); await wait(1000);
  await hover('.fi-cols-3 .card:has-text("Team Lunch")', 700); await wait(600);
  await click('.fi-cols-3 .card:has-text("Team Lunch") [data-act=redeem]', 900);
  await capPos('top');
  await C('Rewards Shop', 'Confirm and see your new balance', 'Sarah redeems a team lunch for 3,000 points.', 'top');
  await hover('.fi-modal .body', 700); await wait(1600);
  await click('.fi-modal button[type=submit]', 1600);
  await capPos('bottom');
  await C('My Orders', 'Track every order', 'The company’s admins fulfil it from the management site, and the status updates here.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(2200);

  // ---- Points ----
  await click('.fi-nav >> text=My Points', 900);
  await C('My Points', 'A full history of points in and out', 'Recognition received, games played and rewards redeemed, newest first.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(900);
  await hover('.fi-content .list .item >> nth=2', 700); await wait(1600);

  // ---- Celebrations ----
  await click('.fi-nav >> text=Birthdays', 900);
  await C('Celebrations', 'Never miss a birthday or work anniversary', 'Upcoming celebrations across the company, each with a one-click way to send kudos.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(900);
  await hover('.fi-content .list .item >> nth=1 >> [data-act=recognize]', 800); await wait(1600);

  // ---- Leaderboard ----
  await click('.fi-nav >> text=Leaderboards', 900);
  await C('Leaderboards', 'See who’s been recognized most', 'A friendly points leaderboard keeps recognition top of mind.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(1000);
  await hover('.fi-content .list .item:has-text("Sarah Kim")', 800); await wait(1600);

  // ---- Games ----
  await click('.fi-topbar .links >> text=Games', 1000);
  await C('Fun & Games', 'Quick games that earn points', 'Trivia, word scrambles, memory and more. Scores feed the company leaderboard.');
  await hover('.fi-cols-2 .card >> nth=0', 700); await wait(700);
  await hover('.fi-cols-2 .card >> nth=1', 700); await wait(700);
  await hover('.fi-cols-2 .card >> nth=3', 700); await wait(900);
  await click('.fi-cols-2 .card:has-text("Trivia Challenge") [data-act=play]', 900);
  await capPos('top');
  await C('Fun & Games', 'Trivia Challenge', 'Three quick questions. Every correct answer adds to the score.', 'top');
  await answerTrivia(); await wait(400);
  await click('.fi-modal button[type=submit]', 2200);
  await C('Fun & Games', 'Word Scramble', 'Unscramble the word. The faster you solve it, the higher the score.', 'top');
  await click('.fi-cols-2 .card:has-text("Word Scramble") [data-act=play]', 1000);
  const mixed = (await page.locator('.fi-modal p.center').textContent()).trim();
  const word = WORDS.find((w) => w.split('').sort().join('') === mixed.split('').sort().join('')) || WORDS[0];
  await wait(900);
  await type('.fi-modal input[name=answer]', word.toLowerCase());
  await click('.fi-modal button[type=submit]', 2200);
  await C('Fun & Games', 'Memory Match', 'Flip the cards and find all six pairs in as few moves as possible.', 'top');
  await click('.fi-cols-2 .card:has-text("Memory Match") [data-act=play]', 900);
  await playMemory();
  await wait(2200);
  await capPos('bottom');
  await C('Fun & Games', 'Results show up for everyone', 'Sarah’s new scores appear in Recent Results and on the leaderboard.');
  await scrollTo(99999, 1500);
  await hover('.fi-content section:has-text("Recent Results") .item >> nth=0', 800); await wait(1800);
  await scrollTo(0, 900);
  await click('.fi-nav >> text=My Progress', 900);
  await C('Fun & Games', 'Personal progress and the challenge leaderboard', 'Games played, best score and points earned, plus how Sarah stacks up against her coworkers.');
  await hover('.fi-content .stat >> nth=0', 600); await wait(500);
  await hover('.fi-content .stat >> nth=1', 600); await wait(500);
  await hover('.fi-content .stat >> nth=2', 600); await wait(900);
  await click('.fi-nav >> text=Leaderboard', 900);
  await hover('.fi-content .list .item >> nth=0', 800); await wait(1600);

  // ---- Training ----
  await click('.fi-topbar .links >> text=Training', 1000);
  await C('The Fun Train', 'Assigned training, with due dates and progress', 'Overdue and due-today items are flagged so nothing slips. The chart shows completed vs overdue.');
  await hover('.fi-content .card.inner >> nth=0', 800); await wait(900);
  await hover('.fi-content .card.inner:has-text("Project Management") ', 800); await wait(900);
  await hover('.donut, .fi-content svg >> nth=-1', 800).catch(() => {}); await wait(1200);
  await click('.card.inner:has-text("Project Management") [data-act=train]', 900);
  await capPos('top');
  await C('The Fun Train', 'Pick up where you left off', 'Courses can be video, slides, a SCORM package or a link. Sarah finishes the last lesson.', 'top');
  await hover('.fi-modal .bar', 800); await wait(1400);
  await click('.fi-modal button[type=submit]', 1500);
  await capPos('bottom');
  await C('The Fun Train', 'Completed training moves to the done list', 'Progress, the chart and the admin’s training report all update automatically.');
  await scrollTo(99999, 1500);
  await hover('.card.inner:has-text("Project Management")', 800); await wait(1600);
  await scrollTo(0, 900);
  await click('.fi-nav >> text=Training Library', 900);
  await C('The Fun Train', 'The full training library', 'Every course the company offers, with Sarah’s status on each. Anything new can be self-enrolled.');
  await hover('.fi-cols-2 .card >> nth=0', 700); await wait(700);
  await scrollTo(380, 1200);
  await hover('.fi-cols-2 .card >> nth=5', 700); await wait(1200);
  await wait(1200);
  await click('.fi-nav >> text=Quiz Your Skills', 900);
  await C('The Fun Train', 'Quiz your skills', 'Short topic quizzes help people see where they could brush up.');
  await hover('.fi-cols-2 .card >> nth=0', 700); await wait(700);
  await hover('.fi-cols-2 .card >> nth=2', 700); await wait(1400);

  // ---- FunFluence ----
  await click('.fi-topbar .links >> text=Mentorship', 1000);
  await C('FunFluence', 'Sarah’s mentor, at a glance', 'Her match with David, the next session and how far through the program they are.');
  await hover('.fi-content .card.inner >> nth=0', 800); await wait(900);
  await click('[data-act=join-session]', 1800);
  await hover('.fi-content .bar', 800); await wait(800);
  await C('FunFluence', 'Prompts and private notes', 'Each session comes with a suggested conversation starter. Notes stay private to Sarah.');
  await scrollTo(330, 1300);
  await hover('text=Suggested Prompt for Next Session', 800); await wait(1300);
  await type('#private-note', 'Ask David about presenting to the leadership team.');
  await click('[data-act=note]', 1500); await hover('.fi-content .comment >> nth=-1', 700); await wait(1200);
  await C('FunFluence', 'Join a group session', 'Company-wide mentoring sessions are open to everyone. Sarah signs up with one click.');
  await scrollTo(0, 900);
  await click('[data-act=join-group]', 1800);
  await hover('.fi-content [data-act=join-group]', 600); await wait(900);
  await click('.fi-nav >> text="Mentors"', 900);
  await C('FunFluence', 'Find a mentor', 'Browse available mentors and send a request to the program admin.');
  await hover('.fi-cols-2 .card >> nth=1', 800); await wait(600);
  await click('.fi-cols-2 .card >> nth=1 >> [data-act=request-mentor]', 1800);
  await click('.fi-nav >> text=Sessions', 900);
  await C('FunFluence', 'Every session in one place', 'One-to-one and group sessions, past and upcoming.');
  await hover('.fi-content .list .item >> nth=0', 800); await wait(900);
  await hover('.fi-content .list .item >> nth=2', 800); await wait(1600);

  // ---- Back home + sign out ----
  await click('.fi-topbar .links >> text=Home', 1000);
  await C('Home', 'Everything Sarah did shows up on her home page', 'New points balance, her recognition in the feed and updated training.');
  await hover('.fi-content .card:has-text("My Points")', 800); await wait(1200);
  await hover('section:has-text("Recent Recognition") .post >> nth=0', 800); await wait(1800);
  await C('Sign out', 'Sign out when you’re done', 'Each person has their own login, so points and progress always belong to the right person.');
  await click('[data-action=logout]', 2400);
  await hideCaption(); await wait(500);

  // ---- Closing ----
  await card(`${cardCss}<div class="w"><h2>One fun place for<br>every employee</h2>
  <div class="grid"><div>🌟 Recognition<small>Shout-outs with points</small></div><div>💬 Company feed<small>Likes, comments, posts</small></div><div>🎁 Rewards Shop<small>Spend points on real rewards</small></div>
  <div>🎮 Fun &amp; Games<small>Trivia, scramble, memory</small></div><div>🚂 The Fun Train<small>Training, library, quizzes</small></div><div>🤝 FunFluence<small>Mentors, sessions, notes</small></div>
  <div>🎂 Celebrations<small>Birthdays and anniversaries</small></div><div>🏆 Leaderboards<small>Points and challenges</small></div><div>🏠 Home<small>Everything at a glance</small></div></div>
  <p style="margin-top:34px;font-size:20px"><b style="color:#fb923c">FunIntended</b> · Rewards, games, training and mentorship in one place</p></div>`, 7000);

  const tEnd = Date.now() / 1000; await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(__dirname, 'frames.json'), JSON.stringify({ meta, tEnd }));
  console.log('frames', meta.length, 'duration', (meta.at(-1).t - meta[0].t).toFixed(1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
