-- Financial Agreement Analyzer - Supabase Schema
--
-- Contract text, clauses and files are encrypted by the backend (AES-256-GCM) before they
-- reach Supabase. The database only sees ownership, status and timestamps in plain text.

create table if not exists agreements (
  id uuid primary key,
  user_id text not null,
  status text not null default 'processing',
  payload_enc text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_agreements_user_created on agreements(user_id, created_at desc);
create index if not exists idx_agreements_status on agreements(status) where status = 'processing';

-- Row level security: the backend always filters by user_id, and RLS adds a second barrier for
-- any client that connects with a user JWT instead of the service role key.
alter table agreements enable row level security;

drop policy if exists "Users read own agreements" on agreements;
drop policy if exists "Users insert own agreements" on agreements;
drop policy if exists "Users update own agreements" on agreements;
drop policy if exists "Users delete own agreements" on agreements;

create policy "Users read own agreements" on agreements
  for select using (auth.jwt() ->> 'sub' = user_id);
create policy "Users insert own agreements" on agreements
  for insert with check (auth.jwt() ->> 'sub' = user_id);
create policy "Users update own agreements" on agreements
  for update using (auth.jwt() ->> 'sub' = user_id) with check (auth.jwt() ->> 'sub' = user_id);
create policy "Users delete own agreements" on agreements
  for delete using (auth.jwt() ->> 'sub' = user_id);

-- Encrypted document files live in a PRIVATE storage bucket (no public access):
insert into storage.buckets (id, name, public)
values ('agreement-documents', 'agreement-documents', false)
on conflict (id) do update set public = false;
