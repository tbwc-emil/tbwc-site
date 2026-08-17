-- Rep Portal schema. Idempotent — safe to re-run.
-- Applied with: npm run db:schema

-- Carries a pre-existing reps table (from before the users rename) over to the
-- new name. No-op on a fresh install (table doesn't exist yet) or a re-run
-- (already renamed).
alter table if exists public.reps rename to users;

create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  first_name  text,
  last_name   text,
  agency_name text,
  url         text,
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

-- Backfills url onto a pre-existing users table (create table above only applies fresh).
alter table public.users add column if not exists url text;

-- Admin flag. Grants access to the browser admin page (admin.html) to approve reps.
-- Only the service role (bootstrap via scripts/make-admin.js) or an existing admin can set it.
alter table public.users add column if not exists is_admin boolean not null default false;

-- User type: rep (default — the original signup flow), customer, or employee
-- (internal staff, gated by the can_see_orders/can_approve_rep_leads flags below).
alter table public.users add column if not exists type text not null default 'rep';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_type_check') then
    alter table public.users add constraint users_type_check check (type in ('rep', 'customer', 'employee'));
  end if;
end $$;

-- Permission flags for order visibility / rep-lead approval. Normally set on
-- employee rows, but also respected for admins — is_admin does NOT imply
-- either flag; an admin must be granted them explicitly like anyone else.
alter table public.users add column if not exists can_see_orders boolean not null default false;
alter table public.users add column if not exists can_approve_rep_leads boolean not null default false;

alter table public.users enable row level security;

-- Is the CURRENT auth user an admin? security definer => bypasses RLS, so referencing
-- public.users here does NOT recurse through the users policies below.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.users where id = auth.uid() and is_admin); $$;

-- Is the CURRENT auth user flagged to see all orders? Checked regardless of
-- type/is_admin — an admin only sees every order if this flag is also on.
create or replace function public.can_see_orders()
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.users where id = auth.uid() and can_see_orders); $$;

-- Is the CURRENT auth user flagged to approve rep leads? Checked regardless of
-- type/is_admin — an admin only reviews leads if this flag is also on.
create or replace function public.can_approve_rep_leads()
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.users where id = auth.uid() and can_approve_rep_leads); $$;

-- A user may read only their own profile (approval gate reads users.approved).
drop policy if exists reps_select_own on public.users;
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

-- Admins may read every user row (admin page lists all reps).
drop policy if exists reps_select_admin on public.users;
drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select using (public.is_admin());

-- Admins may update user rows (flip approved, flags). with check keeps writes admin-only.
drop policy if exists reps_update_admin on public.users;
drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- Admins may delete user rows (remove a rep/employee/customer from the portal).
drop policy if exists reps_delete_admin on public.users;
drop policy if exists users_delete_admin on public.users;
create policy users_delete_admin on public.users
  for delete using (public.is_admin());

-- No client INSERT policy on purpose:
--  * The users row is created by the confirm-signup edge function (service role),
--    once the rep confirms their email — not by the client, and not at signup
--    time, so an abandoned/never-verified signup leaves no row for admin.html to
--    show as a stray "pending" rep. See supabase/functions/confirm-signup.
--  * approved stays false until that point; a non-admin client has no update
--    policy, so it cannot self-approve.
-- Drop the old client-insert policy if a previous version created it.
drop policy if exists reps_insert_own on public.users;
drop policy if exists users_insert_own on public.users;

-- Both the signup-time trigger and the later email-confirm trigger that replaced
-- it (handle_new_rep, then handle_rep_email_confirmed) are gone — creating the
-- profile row and consuming the invite lead now happens in the confirm-signup
-- edge function instead of a DB trigger, so the database stays limited to
-- storage/RLS and doesn't carry app-specific automation.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_rep();
drop trigger if exists on_auth_user_email_confirmed on auth.users;
drop function if exists public.handle_rep_email_confirmed();

-- ===========================================================================
-- Rep inquiries ("Register" front door). A short, unauthenticated form
-- (name/email/phone/about) creates a row here — no auth account yet, and no
-- admin notification yet either. submit-rep-lead emails the applicant a
-- verify-your-email link (verify-lead-email); only once they click it does
-- email_verified flip true and the admin get notified — admin.html gates the
-- Approve button on that. Approving stamps invite_token/invited_at and emails
-- the applicant a link to rep-signup.html?token=... (the detailed form that
-- actually creates the account — no second email-confirm step there, since
-- this stage already proved they control the address). No anon SELECT policy
-- on purpose — tokens are looked up through edge functions (service role),
-- not a client query, so they can't be enumerated.
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

-- Backfills onto a pre-existing rep_leads table (create table above only applies fresh).
alter table public.rep_leads add column if not exists email_verified boolean not null default false;
alter table public.rep_leads add column if not exists verify_token text unique;
alter table public.rep_leads add column if not exists verified_at timestamptz;

-- One pending inquiry per email (case-insensitive) — race-safe, unlike a
-- pre-insert SELECT check.
create unique index if not exists rep_leads_email_unique on public.rep_leads (lower(email));

alter table public.rep_leads enable row level security;

-- The "already has a user account" guard that used to run here as a BEFORE
-- INSERT trigger (check_lead_email_available) is gone — that check now runs in
-- the submit-rep-lead edge function instead (service role, same reasoning: anon
-- can't SELECT public.users to check this client-side without a policy that
-- would let emails be enumerated). newrep-request.html goes through that
-- function, not a direct insert, so the guard still applies to the app's own
-- flow — a request straight against the REST API with this policy would skip it.
drop trigger if exists check_lead_email_available on public.rep_leads;
drop function if exists public.check_lead_email_available();

-- Public inquiry form — anyone may create a lead. Not a meaningful security
-- boundary on its own (same trust model as the Turnstile-then-write pattern
-- used elsewhere in this app: the client verifies Turnstile before calling
-- this insert, RLS itself doesn't check it).
drop policy if exists rep_leads_insert_public on public.rep_leads;
create policy rep_leads_insert_public on public.rep_leads
  for insert with check (true);

-- Anyone (admin or employee) flagged can_approve_rep_leads may review/approve
-- leads. is_admin alone does NOT grant this — see can_approve_rep_leads() above.
drop policy if exists rep_leads_select_admin on public.rep_leads;
create policy rep_leads_select_admin on public.rep_leads
  for select using (public.can_approve_rep_leads());

drop policy if exists rep_leads_update_admin on public.rep_leads;
create policy rep_leads_update_admin on public.rep_leads
  for update using (public.can_approve_rep_leads())
  with check (public.can_approve_rep_leads());

drop policy if exists rep_leads_delete_admin on public.rep_leads;
create policy rep_leads_delete_admin on public.rep_leads
  for delete using (public.can_approve_rep_leads());

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
as $$ select exists (select 1 from public.users where id = auth.uid() and type = 'rep' and approved); $$;

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
alter table public."order" add column if not exists rep_id uuid references public.users (id);

alter table public."order" enable row level security;

-- A rep may read only their own orders. Read-only by design — no insert/update
-- policy for reps, so the rep portal grid stays view-only via RLS itself.
drop policy if exists order_select_own_rep on public."order";
create policy order_select_own_rep on public."order"
  for select using (rep_id = auth.uid());

-- Anyone (admin or employee) flagged can_see_orders may read every order.
-- is_admin alone does NOT grant this — see can_see_orders() above.
drop policy if exists order_select_admin on public."order";
drop policy if exists order_select_employee on public."order";
create policy order_select_employee on public."order"
  for select using (public.can_see_orders());

drop policy if exists order_insert_admin on public."order";
create policy order_insert_admin on public."order"
  for insert with check (public.is_admin());

drop policy if exists order_update_admin on public."order";
create policy order_update_admin on public."order"
  for update using (public.is_admin()) with check (public.is_admin());
