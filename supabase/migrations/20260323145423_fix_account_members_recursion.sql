
-- Fix infinite recursion in account_members policies
-- All 4 policies self-reference account_members causing recursion.
-- Replace with SECURITY DEFINER function calls that bypass RLS.

-- Drop all existing policies
drop policy if exists "Users can view account memberships for their accounts" on public.account_members;
drop policy if exists "Owners and admins can insert account members" on public.account_members;
drop policy if exists "Owners and admins can update account members" on public.account_members;
drop policy if exists "Owners can delete account members or self-removal" on public.account_members;

-- Helper: check if user has a specific role in an account (bypasses RLS)
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

-- SELECT: user can see memberships for accounts they belong to
create policy "Users can view account memberships for their accounts"
  on public.account_members for select
  to authenticated
  using (account_id in (select public.get_user_account_ids()));

-- INSERT: owner/admin of the account can add members, OR first member (bootstrap)
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

-- UPDATE: owner/admin of the account can update members
create policy "Owners and admins can update account members"
  on public.account_members for update
  to authenticated
  using (public.has_account_member_role(account_id, 'admin'))
  with check (public.has_account_member_role(account_id, 'admin'));

-- DELETE: owner can remove members, or self-removal (non-owners)
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
