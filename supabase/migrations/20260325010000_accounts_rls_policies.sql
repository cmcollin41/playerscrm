-- Add missing RLS policies for the accounts table.
-- RLS was enabled in phase1 but no policies were added for authenticated users.
-- Drop first so re-runs are idempotent (e.g. after MCP or manual policy creation).

drop policy if exists "Members can view their accounts" on public.accounts;
drop policy if exists "Org admins can create accounts" on public.accounts;
drop policy if exists "Account admins can update accounts" on public.accounts;
drop policy if exists "Org owners can delete accounts" on public.accounts;
drop policy if exists "Allow anon read accounts" on public.accounts;

-- Select: members can view accounts they belong to (via account_members or org membership)
create policy "Members can view their accounts"
  on public.accounts for select
  to authenticated
  using (id in (select public.get_user_account_ids()));

-- Insert: org admins can create new accounts under their org
create policy "Org admins can create accounts"
  on public.accounts for insert
  to authenticated
  with check (
    organization_id is not null
    and public.has_org_role(organization_id, 'admin')
  );

-- Update: account admins can update their account
create policy "Account admins can update accounts"
  on public.accounts for update
  to authenticated
  using (public.has_account_role(id, 'admin'))
  with check (public.has_account_role(id, 'admin'));

-- Delete: org owners only
create policy "Org owners can delete accounts"
  on public.accounts for delete
  to authenticated
  using (
    organization_id is not null
    and public.has_org_role(organization_id, 'owner')
  );

-- Anon: allow public access for registration/portal pages
create policy "Allow anon read accounts"
  on public.accounts for select
  to anon
  using (true);
