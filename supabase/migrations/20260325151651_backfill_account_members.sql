-- Backfill account_members from profiles.account_id for existing users.
-- Maps legacy profiles.role to account_members.role:
--   admin  → owner (existing admins get full control)
--   general → member

insert into public.account_members (account_id, profile_id, role)
select
  p.account_id,
  p.id,
  case p.role
    when 'admin' then 'owner'
    else 'member'
  end
from public.profiles p
where p.account_id is not null
on conflict (account_id, profile_id) do nothing;
