-- Fix leadership on the "Provo Basketball" account by name (previous migration used
-- Chris's existing membership, which may be a different account than Provo Basketball).

create temporary table provo_basketball_account (id uuid primary key) on commit drop;

insert into provo_basketball_account (id)
select a.id
from public.accounts a
where regexp_replace(lower(trim(both from a.name)), '\s+', ' ', 'g') = 'provo basketball'
limit 1;

-- Normalize roles: everyone on this account becomes member, then leaders are set below.
update public.account_members am
set role = 'member'
from provo_basketball_account pa
where am.account_id = pa.id;

-- Owner + admins (upsert so missing rows are created)
insert into public.account_members (account_id, profile_id, role)
select pa.id, p.id, 'owner'
from provo_basketball_account pa
cross join public.profiles p
where lower(trim(both from p.email)) = lower(trim(both from 'chris@alleyoop.app'))
on conflict (account_id, profile_id) do update set role = excluded.role;

insert into public.account_members (account_id, profile_id, role)
select pa.id, p.id, 'admin'
from provo_basketball_account pa
cross join public.profiles p
where lower(trim(both from p.email)) = lower(trim(both from 'jason@provobasketball.com'))
on conflict (account_id, profile_id) do update set role = excluded.role;

insert into public.account_members (account_id, profile_id, role)
select pa.id, p.id, 'admin'
from provo_basketball_account pa
cross join public.profiles p
where lower(trim(both from p.email)) = lower(trim(both from 'curtis@provobasketball.com'))
on conflict (account_id, profile_id) do update set role = excluded.role;

update public.profiles p
set role = 'admin'
where lower(trim(both from p.email)) in (
  lower(trim(both from 'chris@alleyoop.app')),
  lower(trim(both from 'jason@provobasketball.com')),
  lower(trim(both from 'curtis@provobasketball.com'))
);
