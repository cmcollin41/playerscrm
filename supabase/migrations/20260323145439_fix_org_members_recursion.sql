
-- Fix self-referencing policies on organization_members

drop policy if exists "Members can view org memberships" on public.organization_members;
drop policy if exists "Org admins can add members" on public.organization_members;
drop policy if exists "Org owners can update members" on public.organization_members;
drop policy if exists "Org owners can remove members or self-removal" on public.organization_members;

-- Helper function to check org role (SECURITY DEFINER, bypasses RLS)
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

-- Helper to get user's org IDs (SECURITY DEFINER)
create or replace function public.get_user_org_ids()
returns setof uuid
language sql
stable security definer
set search_path to ''
as $$
  select organization_id from public.organization_members
  where profile_id = (select auth.uid())
$$;

-- SELECT: user can see memberships for orgs they belong to
create policy "Members can view org memberships"
  on public.organization_members for select
  to authenticated
  using (organization_id in (select public.get_user_org_ids()));

-- INSERT: org admin/owner can add, or first member (bootstrap)
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

-- UPDATE: org owner only
create policy "Org owners can update members"
  on public.organization_members for update
  to authenticated
  using (public.has_org_role(organization_id, 'owner'))
  with check (public.has_org_role(organization_id, 'owner'));

-- DELETE: org owner, or self-removal (non-owners)
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
