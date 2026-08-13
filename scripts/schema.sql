-- Rep Portal schema. Idempotent — safe to re-run.
-- Applied with: npm run db:schema

create table if not exists public.reps (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  first_name  text,
  last_name   text,
  agency_name text,
  title       text,
  work_phone  text,
  ext         text,
  mobile      text,
  addr1       text,
  addr2       text,
  city        text,
  state       text,
  postal      text,
  about       text,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Admin flag. Grants access to the browser admin page (admin.html) to approve reps.
-- Only the service role (bootstrap via scripts/make-admin.js) or an existing admin can set it.
alter table public.reps add column if not exists is_admin boolean not null default false;

alter table public.reps enable row level security;

-- Is the CURRENT auth user an admin? security definer => bypasses RLS, so referencing
-- public.reps here does NOT recurse through the reps policies below.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.reps where id = auth.uid() and is_admin); $$;

-- A rep may read only their own profile (approval gate reads reps.approved).
drop policy if exists reps_select_own on public.reps;
create policy reps_select_own on public.reps
  for select using (auth.uid() = id);

-- Admins may read every rep row (admin page lists all reps).
drop policy if exists reps_select_admin on public.reps;
create policy reps_select_admin on public.reps
  for select using (public.is_admin());

-- Admins may update rep rows (flip approved). with check keeps writes admin-only.
drop policy if exists reps_update_admin on public.reps;
create policy reps_update_admin on public.reps
  for update using (public.is_admin()) with check (public.is_admin());

-- No client INSERT policy on purpose:
--  * The reps row is created by the trigger below (runs as owner), not the client.
--  * approved stays false; a non-admin client has no update policy, so it cannot self-approve.
-- Drop the old client-insert policy if a previous version created it.
drop policy if exists reps_insert_own on public.reps;

-- Auto-create the rep profile when an auth user signs up.
-- Profile fields arrive in raw_user_meta_data (set via supabase.auth.signUp options.data).
-- security definer => bypasses RLS; runs whether or not email confirmation is on.
create or replace function public.handle_new_rep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reps (
    id, email, first_name, last_name, agency_name, title,
    work_phone, ext, mobile, addr1, addr2, city, state, postal, about
  ) values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'agency_name',
    new.raw_user_meta_data->>'title',
    new.raw_user_meta_data->>'work_phone',
    new.raw_user_meta_data->>'ext',
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'addr1',
    new.raw_user_meta_data->>'addr2',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'postal',
    new.raw_user_meta_data->>'about'
  )
  on conflict (id) do nothing;

  -- Consume the inquiry this signup was invited from, if any (rep-signup.html
  -- passes it through as signup metadata). Cleans up the lead row and stops
  -- the emailed invite link from being reusable once the account exists.
  if new.raw_user_meta_data->>'invite_token' is not null then
    delete from public.rep_leads where invite_token = new.raw_user_meta_data->>'invite_token';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_rep();

-- Auto-approve once the rep confirms their email. Review already happened at
-- the inquiry stage (admin approved the lead before the invite was ever sent),
-- so email confirmation is the last gate before login rather than a separate
-- manual approval step.
create or replace function public.handle_rep_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reps set approved = true where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row
  when (new.email_confirmed_at is not null and old.email_confirmed_at is null)
  execute function public.handle_rep_email_confirmed();

-- ===========================================================================
-- Rep inquiries ("Register" front door). A short, unauthenticated form
-- (name/email/phone/about) creates a row here — no auth account yet. An
-- admin reviews it in admin.html and either deletes it or approves it, which
-- stamps invite_token/invited_at and emails the applicant a link to
-- rep-signup.html?token=... (the detailed form that actually creates the
-- account). No anon SELECT policy on purpose — the invite token is looked up
-- through the get-lead edge function (service role), not a client query, so
-- it can't be enumerated.
-- ===========================================================================

create table if not exists public.rep_leads (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text,
  about        text,
  invite_token text unique,
  invited_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- One pending inquiry per email (case-insensitive) — race-safe, unlike a
-- pre-insert SELECT check.
create unique index if not exists rep_leads_email_unique on public.rep_leads (lower(email));

alter table public.rep_leads enable row level security;

-- Blocks a new inquiry from someone who already has a rep account. Anon can't
-- SELECT public.reps to check this client-side, so it's enforced here instead
-- — security definer bypasses RLS to read reps, runs before the insert lands.
create or replace function public.check_lead_email_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.reps where lower(email) = lower(new.email)) then
    raise exception 'This email is already registered. Sign in from the site header, or contact support if you need help.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_lead_email_available on public.rep_leads;
create trigger check_lead_email_available
  before insert on public.rep_leads
  for each row execute function public.check_lead_email_available();

-- Public inquiry form — anyone may create a lead. Not a meaningful security
-- boundary on its own (same trust model as the Turnstile-then-write pattern
-- used elsewhere in this app: the client verifies Turnstile before calling
-- this insert, RLS itself doesn't check it).
drop policy if exists rep_leads_insert_public on public.rep_leads;
create policy rep_leads_insert_public on public.rep_leads
  for insert with check (true);

drop policy if exists rep_leads_select_admin on public.rep_leads;
create policy rep_leads_select_admin on public.rep_leads
  for select using (public.is_admin());

drop policy if exists rep_leads_update_admin on public.rep_leads;
create policy rep_leads_update_admin on public.rep_leads
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists rep_leads_delete_admin on public.rep_leads;
create policy rep_leads_delete_admin on public.rep_leads
  for delete using (public.is_admin());

-- ===========================================================================
-- Rep-facing documents: private Storage bucket + access policies.
-- Bytes are served only via short-lived signed URLs minted for an authed rep.
-- A direct object URL with no token returns 403 — this is what gates downloads
-- to logged-in reps (a static file in the repo could not be gated this way).
-- ===========================================================================

-- Is the CURRENT auth user an approved rep? security definer bypasses RLS.
create or replace function public.is_approved_rep()
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.reps where id = auth.uid() and approved); $$;

-- Private bucket (public = false => no anonymous object access).
insert into storage.buckets (id, name, public)
values ('rep-docs', 'rep-docs', false)
on conflict (id) do nothing;

-- Approved reps (and admins) may list objects + mint signed URLs.
drop policy if exists rep_docs_select on storage.objects;
create policy rep_docs_select on storage.objects
  for select using (
    bucket_id = 'rep-docs' and (public.is_approved_rep() or public.is_admin())
  );

-- Only admins may upload / overwrite / delete documents.
drop policy if exists rep_docs_insert on storage.objects;
create policy rep_docs_insert on storage.objects
  for insert with check (bucket_id = 'rep-docs' and public.is_admin());

drop policy if exists rep_docs_update on storage.objects;
create policy rep_docs_update on storage.objects
  for update using (bucket_id = 'rep-docs' and public.is_admin())
  with check (bucket_id = 'rep-docs' and public.is_admin());

drop policy if exists rep_docs_delete on storage.objects;
create policy rep_docs_delete on storage.objects
  for delete using (bucket_id = 'rep-docs' and public.is_admin());

-- ===========================================================================
-- Orders (imported from "TBWC & Dent Build List.xlsx", "2026 Orders" sheet
-- via scripts/create-order-table.js). Admin-only read from the client;
-- the anon/authenticated grants Supabase applies by default to new public
-- tables would otherwise leave this readable with just the anon key.
-- ===========================================================================

create table if not exists public."order" (
  id bigint generated always as identity primary key,
  customer      text,
  build_notes   text,
  exp           text,
  inv_stat      text,
  tbwc_number   text,
  po_number     text,
  received_date date,
  ship_nlt      text,
  shipment_date text,
  rep           text,
  job_name      text,
  jay           text,
  notes         text,
  dnc           numeric(12,2),
  sold_for      numeric(12,2),
  comm_15       numeric(12,2),
  ovg_75_25     numeric(12,2),
  proj_adm      numeric(12,2),
  comm_total    numeric(12,2),
  trade_ally    text,
  su            text
);

-- Links an order to the rep it belongs to (rep-portal filtering). Nullable so
-- existing/unassigned orders don't break; scripts/backfill-order-rep.js
-- one-time-defaults every pre-existing row to the sole rep at the time (Emil Guirguis).
alter table public."order" add column if not exists rep_id uuid references public.reps (id);

alter table public."order" enable row level security;

drop policy if exists order_select_admin on public."order";
create policy order_select_admin on public."order"
  for select using (public.is_admin());

-- A rep may read only their own orders. Read-only by design — no insert/update
-- policy for reps, so the rep portal grid stays view-only via RLS itself.
drop policy if exists order_select_own_rep on public."order";
create policy order_select_own_rep on public."order"
  for select using (rep_id = auth.uid());

drop policy if exists order_insert_admin on public."order";
create policy order_insert_admin on public."order"
  for insert with check (public.is_admin());

drop policy if exists order_update_admin on public."order";
create policy order_update_admin on public."order"
  for update using (public.is_admin()) with check (public.is_admin());
