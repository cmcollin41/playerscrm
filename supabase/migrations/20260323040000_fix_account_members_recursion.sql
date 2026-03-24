-- Fix infinite recursion in account_members and organization_members policies
-- All policies self-referenced their own table, causing infinite recursion when RLS was enabled.
-- Fix: use SECURITY DEFINER helper functions that bypass RLS.

-- ============================================================================
-- 1. Fix account_members
-- ============================================================================

drop policy if exists "Users can view account memberships for their accounts" on public.account_members;
drop policy if exists "Owners and admins can insert account members" on public.account_members;
drop policy if exists "Owners and admins can update account members" on public.account_members;
drop policy if exists "Owners can delete account members or self-removal" on public.account_members;

-- Helper: direct role check bypassing RLS
create or replace function public.has_account_member_role(p_account_id uuid, p_min_role text)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.account_members
    where account_id = p_account_id
      and profile_id = (select auth.uid())
      and case p_min_role
        when 'member' then role in ('member', 'manager', 'admin', 'owner')
        when 'manager' then role in ('manager', 'admin', 'owner')
        when 'admin' then role in ('admin', 'owner')
        when 'owner' then role = 'owner'
        else false
      end
  )
$$;

create policy "Users can view account memberships for their accounts"
  on public.account_members for select
  to authenticated
  using (account_id in (select public.get_user_account_ids()));

create policy "Owners and admins can insert account members"
  on public.account_members for insert
  to authenticated
  with check (
    public.has_account_member_role(account_id, 'admin')
    or not exists (
      select 1 from public.account_members am
      where am.account_id = account_members.account_id
    )
  );

create policy "Owners and admins can update account members"
  on public.account_members for update
  to authenticated
  using (public.has_account_member_role(account_id, 'admin'))
  with check (public.has_account_member_role(account_id, 'admin'));

create policy "Owners can delete account members or self-removal"
  on public.account_members for delete
  to authenticated
  using (
    public.has_account_member_role(account_id, 'owner')
    or (
      profile_id = (select auth.uid())
      and role != 'owner'
    )
  );

-- ============================================================================
-- 2. Fix organization_members
-- ============================================================================

drop policy if exists "Members can view org memberships" on public.organization_members;
drop policy if exists "Org admins can add members" on public.organization_members;
drop policy if exists "Org owners can update members" on public.organization_members;
drop policy if exists "Org owners can remove members or self-removal" on public.organization_members;

create or replace function public.has_org_role(p_organization_id uuid, p_min_role text)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and profile_id = (select auth.uid())
      and case p_min_role
        when 'viewer' then role in ('viewer', 'admin', 'owner')
        when 'admin' then role in ('admin', 'owner')
        when 'owner' then role = 'owner'
        else false
      end
  )
$$;

create or replace function public.get_user_org_ids()
returns setof uuid
language sql
stable security definer
set search_path to ''
as $$
  select organization_id from public.organization_members
  where profile_id = (select auth.uid())
$$;

create policy "Members can view org memberships"
  on public.organization_members for select
  to authenticated
  using (organization_id in (select public.get_user_org_ids()));

create policy "Org admins can add members"
  on public.organization_members for insert
  to authenticated
  with check (
    public.has_org_role(organization_id, 'admin')
    or not exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );

create policy "Org owners can update members"
  on public.organization_members for update
  to authenticated
  using (public.has_org_role(organization_id, 'owner'))
  with check (public.has_org_role(organization_id, 'owner'));

create policy "Org owners can remove members or self-removal"
  on public.organization_members for delete
  to authenticated
  using (
    public.has_org_role(organization_id, 'owner')
    or (
      profile_id = (select auth.uid())
      and role != 'owner'
    )
  );
