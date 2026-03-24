-- Phase 1: Enable RLS on all public tables and standardize policies
-- This migration enables row-level security on every table that currently has it disabled,
-- removes broken/legacy policies, and adds proper account_members-based policies.

-- ============================================================================
-- STEP 1: Enable RLS on all tables that have it disabled
-- ============================================================================

alter table public.accounts enable row level security;
alter table public.emails enable row level security;
alter table public.fees enable row level security;
alter table public.invoices enable row level security;
alter table public.pages enable row level security;
alter table public.participants enable row level security;
alter table public.payments enable row level security;
alter table public.people enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.relationships enable row level security;
alter table public.rosters enable row level security;
alter table public.seasons enable row level security;
alter table public.senders enable row level security;
alter table public.sites enable row level security;
alter table public.staff enable row level security;
alter table public.tags enable row level security;
alter table public.teams enable row level security;

-- ============================================================================
-- STEP 2: Drop broken/legacy policies on teams
-- ============================================================================

-- This policy allows ANY user (including anon) to read ALL teams — no tenant check
drop policy if exists "Enable read access for all users" on public.teams;

-- This policy allows any authenticated user to insert teams with no account check
drop policy if exists "Enable insert for authenticated users only" on public.teams;

-- This policy compares auth.uid() (user UUID) to account_id (account UUID) — always false
drop policy if exists "Enable update for authenticated users" on public.teams;

-- ============================================================================
-- STEP 3: Drop legacy policies on people
-- ============================================================================

-- These use the old single-account profiles.account_id pattern instead of account_members
drop policy if exists "account_people_policy" on public.people;
drop policy if exists "account_people_insert_policy" on public.people;

-- ============================================================================
-- STEP 4: Add anon read policies for public-facing data
-- ============================================================================

-- Teams: anon can read public teams (needed for public team pages)
create policy "Allow anon read public teams"
  on public.teams for select
  to anon
  using (is_public = true);

-- People: anon can read public people (needed for public player profiles)
create policy "Allow anon read public people"
  on public.people for select
  to anon
  using (is_public = true);

-- Rosters: anon can read rosters for public teams with public people
create policy "Allow anon read public rosters"
  on public.rosters for select
  to anon
  using (
    exists (
      select 1 from teams t
      join people p on p.id = person_id
      where t.id = team_id
        and t.is_public = true
        and p.is_public = true
    )
  );

-- Staff: anon can read staff for public teams
create policy "Allow anon read public staff"
  on public.staff for select
  to anon
  using (
    exists (
      select 1 from teams t
      where t.id = team_id and t.is_public = true
    )
  );

-- Relationships: anon can read relationships for public people
create policy "Allow anon read public relationships"
  on public.relationships for select
  to anon
  using (
    exists (
      select 1 from people p
      where p.id = person_id and p.is_public = true
    )
  );

-- ============================================================================
-- STEP 5: Add policies for tables that had NONE (fees, invoices, payments,
--         seasons, sites, tags, pages, posts, participants)
-- ============================================================================

-- ----- fees -----
create policy "Members can view fees"
  on public.fees for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create fees"
  on public.fees for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update fees"
  on public.fees for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete fees"
  on public.fees for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- ----- invoices -----
create policy "Members can view invoices"
  on public.invoices for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create invoices"
  on public.invoices for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update invoices"
  on public.invoices for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete invoices"
  on public.invoices for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- ----- payments -----
create policy "Members can view payments"
  on public.payments for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create payments"
  on public.payments for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update payments"
  on public.payments for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete payments"
  on public.payments for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- Anon: allow portal users to view their own invoices/payments (via person lookup)
create policy "Anon can view own invoices"
  on public.invoices for select
  to anon
  using (false); -- placeholder: wire up when portal auth exists

create policy "Anon can view own payments"
  on public.payments for select
  to anon
  using (false); -- placeholder: wire up when portal auth exists

-- ----- seasons -----
create policy "Members can view seasons"
  on public.seasons for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create seasons"
  on public.seasons for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update seasons"
  on public.seasons for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete seasons"
  on public.seasons for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- ----- sites -----
create policy "Members can view sites"
  on public.sites for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Admins can create sites"
  on public.sites for insert
  to authenticated
  with check (has_account_role(account_id, 'admin'));

create policy "Admins can update sites"
  on public.sites for update
  to authenticated
  using (has_account_role(account_id, 'admin'))
  with check (has_account_role(account_id, 'admin'));

create policy "Admins can delete sites"
  on public.sites for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- Anon: allow public site access (for public-facing site pages)
create policy "Allow anon read public sites"
  on public.sites for select
  to anon
  using (true); -- sites are public by nature (accessed by subdomain)

-- ----- tags -----
create policy "Members can view tags"
  on public.tags for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create tags"
  on public.tags for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update tags"
  on public.tags for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete tags"
  on public.tags for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- ----- pages (no account_id — scoped via site_id → sites.account_id) -----
create policy "Members can view pages"
  on public.pages for select
  to authenticated
  using (
    site_id in (
      select id from sites
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Admins can create pages"
  on public.pages for insert
  to authenticated
  with check (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'admin')
    )
  );

create policy "Admins can update pages"
  on public.pages for update
  to authenticated
  using (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'admin')
    )
  )
  with check (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'admin')
    )
  );

create policy "Admins can delete pages"
  on public.pages for delete
  to authenticated
  using (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'admin')
    )
  );

-- Anon: public pages accessible via site
create policy "Allow anon read public pages"
  on public.pages for select
  to anon
  using (true); -- pages are public content

-- ----- posts (no account_id — scoped via site_id → sites.account_id) -----
create policy "Members can view posts"
  on public.posts for select
  to authenticated
  using (
    site_id in (
      select id from sites
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Managers can create posts"
  on public.posts for insert
  to authenticated
  with check (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update posts"
  on public.posts for update
  to authenticated
  using (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'manager')
    )
  )
  with check (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Admins can delete posts"
  on public.posts for delete
  to authenticated
  using (
    site_id in (
      select id from sites
      where has_account_role(account_id, 'admin')
    )
  );

-- Anon: published posts are public
create policy "Allow anon read published posts"
  on public.posts for select
  to anon
  using (published = true);

-- ----- participants (no account_id — scoped via person_id → people.account_id) -----
create policy "Members can view participants"
  on public.participants for select
  to authenticated
  using (
    person_id in (
      select id from people
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Managers can create participants"
  on public.participants for insert
  to authenticated
  with check (
    person_id in (
      select id from people
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update participants"
  on public.participants for update
  to authenticated
  using (
    person_id in (
      select id from people
      where has_account_role(account_id, 'manager')
    )
  )
  with check (
    person_id in (
      select id from people
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Admins can delete participants"
  on public.participants for delete
  to authenticated
  using (
    person_id in (
      select id from people
      where has_account_role(account_id, 'admin')
    )
  );

-- ============================================================================
-- STEP 6: Add authenticated policies for profiles
-- Profiles already have "view own" and "update own" policies.
-- Admins also need to view profiles in their accounts (for team management).
-- ============================================================================

create policy "Admins can view account profiles"
  on public.profiles for select
  to authenticated
  using (
    id in (
      select am.profile_id from account_members am
      where am.account_id in (select get_user_account_ids())
    )
  );

-- ============================================================================
-- STEP 7: Fix the 1 orphaned person with NULL account_id
-- ============================================================================

-- Assign orphaned people to the primary account so they aren't invisible
update public.people
set account_id = '0b2390b7-8da9-44c8-b55e-38d5a29115f2'
where account_id is null;
