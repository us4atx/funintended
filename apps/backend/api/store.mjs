// Storage adapter. Every document is a plain JSON object stored under a key:
//   "platform"        -> platform admins, features, page content, catalogs, client index
//   "client/<id>"     -> one client's settings, users and activity
//
// Where the data lives, in order of preference:
//   1. FI_DEV_STORE=<path>            local JSON file (npm run dev)
//   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   Supabase table public.fi_documents (see supabase/schema.sql)
//   3. otherwise                      Netlify Blobs
import fs from 'node:fs/promises';

const mode = () => (process.env.FI_DEV_STORE ? 'file' : process.env.SUPABASE_URL ? 'supabase' : 'blobs');

// ---------- local file ----------
async function readFileDb(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; }
}
async function writeFileDb(mutate) {
  const file = process.env.FI_DEV_STORE;
  const db = await readFileDb(file);
  mutate(db);
  await fs.writeFile(file, JSON.stringify(db, null, 2));
}

// ---------- Supabase (REST API, no extra packages) ----------
async function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the backend site');
  const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/fi_documents${path}`, {
    ...opts,
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- Netlify Blobs ----------
let blobStore = null;
async function netlifyStore() {
  if (!blobStore) {
    const { getStore } = await import('@netlify/blobs');
    blobStore = getStore({ name: 'funintended', consistency: 'strong' });
  }
  return blobStore;
}

// ---------- public API ----------
export async function getDoc(key) {
  const m = mode();
  if (m === 'file') return (await readFileDb(process.env.FI_DEV_STORE))[key] ?? null;
  if (m === 'supabase') {
    const rows = await sb(`?key=eq.${encodeURIComponent(key)}&select=data`);
    return rows?.[0]?.data ?? null;
  }
  return (await (await netlifyStore()).get(key, { type: 'json' })) ?? null;
}

export async function setDoc(key, value) {
  const m = mode();
  if (m === 'file') return writeFileDb((db) => { db[key] = value; });
  if (m === 'supabase') {
    await sb('?on_conflict=key', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, data: value, updated_at: new Date().toISOString() }),
    });
    return;
  }
  await (await netlifyStore()).setJSON(key, value);
}

export async function deleteDoc(key) {
  const m = mode();
  if (m === 'file') return writeFileDb((db) => { delete db[key]; });
  if (m === 'supabase') { await sb(`?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' }); return; }
  await (await netlifyStore()).delete(key);
}
