-- the parent column whitelist on people decided "is this an admin" from
-- auth.uid(), which is null when server code writes with the service role.
-- the dashboard's person update route authorizes the caller itself and then
-- writes with the service role, so every such update was treated as a
-- parent edit and rejected as soon as an admin-managed column differed
-- (most often tags: null in the row, [] from the form). requests with no
-- end-user role (service role, or sql run directly) now skip the whitelist.

create or replace function public.enforce_parent_people_column_whitelist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  if coalesce((select auth.role()), 'service_role') = 'service_role' then
    return new;
  end if;

  v_is_admin := exists (
    select 1 from public.account_people ap
    where ap.person_id = new.id
      and public.has_account_role(ap.account_id, 'manager')
  );

  if v_is_admin then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'people.id cannot be modified';
  end if;
  if new.account_id is distinct from old.account_id then
    raise exception 'people.account_id is admin-managed';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'people.created_at cannot be modified';
  end if;
  if new.tags is distinct from old.tags then
    raise exception 'people.tags is admin-managed';
  end if;
  if new.dependent is distinct from old.dependent then
    raise exception 'people.dependent is admin-managed';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'people.stripe_customer_id is admin-managed';
  end if;
  if new.is_public is distinct from old.is_public then
    raise exception 'people.is_public is admin-managed';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'people.slug is admin-managed';
  end if;

  return new;
end;
$$;
