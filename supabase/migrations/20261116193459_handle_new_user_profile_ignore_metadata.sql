-- the trigger copied account_id, role and people_id from signup metadata,
-- which the caller of supabase auth signup controls. it now creates a bare
-- profile: the account, person link and role are set afterwards by server
-- code using the service role (syncProfileAfterSignup for invited signups).
-- the "metadata has account_id" condition is kept so the set of signups
-- that get a trigger-created profile does not change; the value is ignored.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'account_id' then
    insert into public.profiles (id, first_name, last_name, email, role)
    values (
      new.id,
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name',
      new.email,
      'general'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
