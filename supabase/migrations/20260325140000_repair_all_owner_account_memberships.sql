-- Repair clusters where every member was set to owner (legacy backfill mapped admin→owner
-- while profiles.role was often 'admin' for all users).
-- For any account with 10+ members who are all owners, keep the earliest membership as owner
-- and demote the rest to member.
-- Does not change profiles.role (global legacy field; may still say admin).

create temporary table repair_accounts (account_id uuid primary key) on commit drop;

insert into repair_accounts (account_id)
select account_id
from public.account_members
group by account_id
having count(*) >= 10
  and count(*) filter (where role = 'owner') = count(*);

create temporary table repair_keepers (account_id uuid primary key, profile_id uuid not null) on commit drop;

insert into repair_keepers (account_id, profile_id)
select distinct on (am.account_id)
  am.account_id,
  am.profile_id
from public.account_members am
inner join repair_accounts r on r.account_id = am.account_id
order by am.account_id, am.created_at asc;

update public.account_members am
set role = 'member'
from repair_accounts r
where am.account_id = r.account_id
  and am.role = 'owner'
  and not exists (
    select 1 from repair_keepers k
    where k.account_id = am.account_id
      and k.profile_id = am.profile_id
  );
