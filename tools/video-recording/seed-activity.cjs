// Adds a little first-week activity to the freshly set-up beta1 client (run after setup-beta.cjs).
const fs = require('fs'), path = require('path');
const PW = JSON.parse(fs.readFileSync(path.join(__dirname, 'beta-passwords.json')));
const B = 'http://localhost:8803/api';
const STORE = process.argv[2];
async function call(tok, p, method = 'GET', body) {
  const r = await fetch(B + p, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json(); if (!r.ok) throw new Error(p + ' ' + JSON.stringify(d)); return d;
}
const login = async (email, password) => (await call(null, '/auth/login', 'POST', { email, password, clientId: 'beta1' })).token;
(async () => {
  const maria = await login('maria@beta1.client', PW.maria), priya = await login('priya@beta1.client', PW.priya);
  const boot = await call(maria, '/c/beta1/bootstrap');
  const id = (n) => boot.users.find((u) => u.name === n).id;
  const r1 = await call(maria, '/c/beta1/recognize', 'POST', { toUserId: id('Tyler Brooks'), value: 'Own It', points: 200, text: 'Welcome aboard, Tyler! First week in and you already reorganized the loading dock schedule so the morning trucks go out on time. Great start!' });
  const p1 = await call(priya, '/c/beta1/posts', 'POST', { text: 'Hi everyone! 👋 Just finished setting up my desk in Customer Success. Who else is coming to the Lunch & Learn?' });
  await call(maria, `/c/beta1/posts/${p1.id}`, 'POST', { action: 'like' });
  await call(maria, `/c/beta1/posts/${p1.id}`, 'POST', { action: 'comment', text: 'Wouldn’t miss it. Welcome Priya!' });
  await call(priya, `/c/beta1/posts/${r1.id}`, 'POST', { action: 'like' });
  const r2 = await call(maria, '/c/beta1/recognize', 'POST', { toUserId: id('Priya Shah'), value: 'Customer First', points: 150, text: 'Took a call from a frustrated customer on her second day and turned it into a five-star review. Way to go Priya!' });
  const g1 = await call(priya, '/c/beta1/play', 'POST', { gameId: 'g-trivia', score: 500 });
  const g2 = await call(maria, '/c/beta1/play', 'POST', { gameId: 'g-memory', score: 680 });
  const grp = boot.sessions.find((s) => s.group);
  await call(priya, `/c/beta1/sessions/${grp.id}`, 'PATCH', { join: true });
  // Backdate so the feed reads like a first week.
  const db = JSON.parse(fs.readFileSync(STORE)); const doc = db['client/beta1'];
  const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();
  const set = (list, oid, h) => { const x = doc[list].find((y) => y.id === oid); x.createdAt = ago(h); (x.comments || []).forEach((c) => (c.createdAt = ago(h - 1))); };
  set('posts', r1.id, 30); set('posts', p1.id, 22); set('posts', r2.id, 6); set('results', g1.result.id, 4); set('results', g2.result.id, 3);
  fs.writeFileSync(STORE, JSON.stringify(db, null, 2));
  console.log('ok', doc.users.map((u) => `${u.name}:${u.points}`).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
