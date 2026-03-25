-- Backfill account_members from profiles.account_id for existing users.
-- Maps legacy profiles.role to account_members.role:
--   admin  → admin (full settings access; use owner sparingly for billing/destructive ops)
--   general → member

insert into public.account_members (account_id, profile_id, role)
select
  p.account_id,
  p.id,
  case p.role
    when 'admin' then 'admin'
    else 'member'
  end
from public.profiles p
where p.account_id is not null
on conflict (account_id, profile_id) do nothing;
