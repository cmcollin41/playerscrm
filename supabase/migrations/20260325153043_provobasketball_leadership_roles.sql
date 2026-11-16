-- Provo Basketball leadership: set account_members roles on the account where
-- Chris Collinsworth is a member. Demote other owners on that account to member.

create temporary table leadership_target_account (account_id uuid primary key) on commit drop;

insert into leadership_target_account (account_id)
select am.account_id
from public.account_members am
inner join public.profiles p on p.id = am.profile_id
where lower(trim(p.email)) = lower(trim('chris@alleyoop.app'))
limit 1;

-- No matching account: skip safely (no rows in temp table)
update public.account_members am
set role = 'member'
from leadership_target_account t
where am.account_id = t.account_id
  and am.role = 'owner'
  and am.profile_id <> (
    select p.id
    from public.profiles p
    where lower(trim(p.email)) = lower(trim('chris@alleyoop.app'))
    limit 1
  );

update public.account_members am
set role = 'owner'
from leadership_target_account t
where am.account_id = t.account_id
  and am.profile_id = (
    select p.id
    from public.profiles p
    where lower(trim(p.email)) = lower(trim('chris@alleyoop.app'))
    limit 1
  );

update public.account_members am
set role = 'admin'
from leadership_target_account t
where am.account_id = t.account_id
  and am.profile_id in (
    select p.id
    from public.profiles p
    where lower(trim(p.email)) in (
      lower(trim('jason@provobasketball.com')),
      lower(trim('curtis@provobasketball.com'))
    )
  );

-- Legacy global role for dashboard/nav that still keys off profiles.role
update public.profiles p
set role = 'admin'
where lower(trim(p.email)) in (
  lower(trim('chris@alleyoop.app')),
  lower(trim('jason@provobasketball.com')),
  lower(trim('curtis@provobasketball.com'))
);
