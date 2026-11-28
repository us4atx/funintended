-- FunIntended database schema for Supabase.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
--
-- The backend stores each record set as one JSON document:
--   key = 'platform'        platform admins, features, page content, catalogs, client list
--   key = 'client/<id>'     one client's settings, users, posts, orders, trainings, mentorships...
-- Only the backend (FunIntended server on the VPS, using the service role key) reads or writes this table.

create table if not exists public.fi_documents (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock the table down: no access from the browser (anon/authenticated keys).
-- The service role key used by the backend bypasses RLS.
alter table public.fi_documents enable row level security;
revoke all on public.fi_documents from anon, authenticated;
