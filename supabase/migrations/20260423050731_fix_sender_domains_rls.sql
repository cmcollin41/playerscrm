-- Fix sender_domains RLS to use get_user_account_ids() instead of profiles.account_id
-- This matches the pattern used by senders, events, and other tables

drop policy if exists "Users can view sender domains from their account" on public.sender_domains;
drop policy if exists "Users can insert sender domains for their account" on public.sender_domains;
drop policy if exists "Users can update sender domains from their account" on public.sender_domains;
drop policy if exists "Users can delete sender domains from their account" on public.sender_domains;

create policy "Members can view sender domains"
  on public.sender_domains for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Admins can insert sender domains"
  on public.sender_domains for insert
  to authenticated
  with check (has_account_role(account_id, 'admin'));

create policy "Admins can update sender domains"
  on public.sender_domains for update
  to authenticated
  using (has_account_role(account_id, 'admin'))
  with check (has_account_role(account_id, 'admin'));

create policy "Admins can delete sender domains"
  on public.sender_domains for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));
