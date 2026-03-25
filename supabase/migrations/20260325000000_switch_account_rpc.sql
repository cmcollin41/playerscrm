-- switch_account() RPC: lets a user change their active account
-- Validates the user is a member of the target account (directly or via org).
-- Drop first so CREATE is safe if a prior deployment used a different return type.

drop function if exists public.switch_account(uuid);

create or replace function public.switch_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- check the user has access to this account (direct member or org member)
  if not public.is_account_member(p_account_id) then
    raise exception 'you do not have access to this account';
  end if;

  update public.profiles
  set current_account_id = p_account_id
  where id = v_uid;
end;
$$;
