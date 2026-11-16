-- Phase 2 Step 1: Organizations + account_people
-- Non-breaking DB-only migration. No app code changes required.
-- Create all tables first, then policies (to avoid forward-reference issues)

-- ============================================================================
-- 1. Create tables
-- ============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  logo text,
  domain text,
  sport text,
  metadata jsonb default '{}'
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'viewer')),
  unique(organization_id, profile_id)
);

create index idx_org_members_org on public.organization_members(organization_id);
create index idx_org_members_profile on public.organization_members(profile_id);

alter table public.accounts
  add column organization_id uuid references organizations(id);

create index idx_accounts_org on public.accounts(organization_id);

create table public.account_people (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  created_at timestamptz not null default now(),
  tags text[] default '{}',
  notes text,
  unique(account_id, person_id)
);

create index idx_account_people_account on public.account_people(account_id);
create index idx_account_people_person on public.account_people(person_id);

-- ============================================================================
-- 2. Enable RLS
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.account_people enable row level security;

-- ============================================================================
-- 3. Organizations policies
-- ============================================================================

create policy "Members can view their organizations"
  on public.organizations for select
  to authenticated
  using (
    id in (
      select organization_id from organization_members
      where profile_id = (select auth.uid())
    )
    or id in (
      select a.organization_id from accounts a
      join account_members am on am.account_id = a.id
      where am.profile_id = (select auth.uid())
      and a.organization_id is not null
    )
  );

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (true);

create policy "Org admins can update organizations"
  on public.organizations for update
  to authenticated
  using (
    exists (
      select 1 from organization_members
      where organization_id = id
        and profile_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from organization_members
      where organization_id = id
        and profile_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

create policy "Org owners can delete organizations"
  on public.organizations for delete
  to authenticated
  using (
    exists (
      select 1 from organization_members
      where organization_id = id
        and profile_id = (select auth.uid())
        and role = 'owner'
    )
  );

create policy "Allow anon read organizations"
  on public.organizations for select
  to anon
  using (true);

-- ============================================================================
-- 4. Organization members policies
-- ============================================================================

create policy "Members can view org memberships"
  on public.organization_members for select
  to authenticated
  using (
    organization_id in (
      select om.organization_id from organization_members om
      where om.profile_id = (select auth.uid())
    )
  );

create policy "Org admins can add members"
  on public.organization_members for insert
  to authenticated
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.profile_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
    or not exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );

create policy "Org owners can update members"
  on public.organization_members for update
  to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.profile_id = (select auth.uid())
        and om.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.profile_id = (select auth.uid())
        and om.role = 'owner'
    )
  );

create policy "Org owners can remove members or self-removal"
  on public.organization_members for delete
  to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.profile_id = (select auth.uid())
        and om.role = 'owner'
    )
    or (
      profile_id = (select auth.uid())
      and role != 'owner'
    )
  );

-- ============================================================================
-- 5. Account people policies
-- ============================================================================

create policy "Members can view account_people"
  on public.account_people for select
  to authenticated
  using (account_id in (select public.get_user_account_ids()));

create policy "Managers can add people to account"
  on public.account_people for insert
  to authenticated
  with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update account_people"
  on public.account_people for update
  to authenticated
  using (public.has_account_role(account_id, 'manager'))
  with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can remove people from account"
  on public.account_people for delete
  to authenticated
  using (public.has_account_role(account_id, 'admin'));

-- ============================================================================
-- 6. Update helper functions for org-level access
-- ============================================================================

create or replace function public.get_user_account_ids()
returns setof uuid
language sql
stable security definer
set search_path to ''
as $$
  select account_id from public.account_members
  where profile_id = (select auth.uid())
  union
  select a.id from public.accounts a
  join public.organization_members om on om.organization_id = a.organization_id
  where om.profile_id = (select auth.uid())
    and a.organization_id is not null
$$;

create or replace function public.has_account_role(p_account_id uuid, p_min_role text)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.account_members
    where account_id = p_account_id and profile_id = (select auth.uid())
      and case p_min_role
        when 'member' then role in ('member', 'manager', 'admin', 'owner')
        when 'manager' then role in ('manager', 'admin', 'owner')
        when 'admin' then role in ('admin', 'owner')
        when 'owner' then role = 'owner'
        else false
      end
  ) or exists (
    select 1 from public.accounts a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = p_account_id
      and om.profile_id = (select auth.uid())
      and a.organization_id is not null
      and case p_min_role
        when 'member' then om.role in ('viewer', 'admin', 'owner')
        when 'manager' then om.role in ('admin', 'owner')
        when 'admin' then om.role in ('admin', 'owner')
        when 'owner' then om.role = 'owner'
        else false
      end
  )
$$;

create or replace function public.is_account_member(p_account_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.account_members
    where account_id = p_account_id and profile_id = (select auth.uid())
  ) or exists (
    select 1 from public.accounts a
    join public.organization_members om on om.organization_id = a.organization_id
    where a.id = p_account_id
      and om.profile_id = (select auth.uid())
      and a.organization_id is not null
  )
$$;

-- ============================================================================
-- 7. Backfill
-- ============================================================================

-- Create "Provo High School" organization
insert into public.organizations (id, name, slug)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Provo High School',
  'provo-high'
);

-- Link both existing accounts to the org
update public.accounts
set organization_id = 'a0000000-0000-0000-0000-000000000001'
where id in (
  '0b2390b7-8da9-44c8-b55e-38d5a29115f2',
  'c9a64bac-337a-4037-870a-0ff4bfd8909a'
);

-- Populate account_people from existing people.account_id
insert into public.account_people (account_id, person_id, tags)
select account_id, id, coalesce(tags, '{}')
from public.people
where account_id is not null
on conflict (account_id, person_id) do nothing;
