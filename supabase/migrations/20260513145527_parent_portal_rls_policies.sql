-- Parent portal: additive RLS policies (PR 2/6).
--
-- Layers new "Parents can ..." policies on top of the existing admin/member
-- policies. PostgreSQL OR's policies of the same role+command, so admins keep
-- their access untouched while parents get scoped read (and limited write)
-- access to rows tied to people they're related to through public.relationships.
--
-- Eligibility is computed by the helpers added in
-- 20260513145247_parent_portal_relationship_helpers.sql:
--   current_user_can_access_person(uuid) -> bool
--   current_user_accessible_person_ids() -> setof uuid
--
-- WRITE access on people is restricted to a column whitelist via a BEFORE
-- UPDATE trigger; admins bypass the trigger.

-- ============================================================================
-- 1. people: SELECT + UPDATE for parents (column-whitelisted)
-- ============================================================================

create policy "Parents can view accessible people"
  on public.people for select
  to authenticated
  using (public.current_user_can_access_person(id));

create policy "Parents can update accessible people"
  on public.people for update
  to authenticated
  using (public.current_user_can_access_person(id))
  with check (public.current_user_can_access_person(id));

-- Column whitelist. Admin/manager updates bypass; non-admin updates may only
-- change non-blocklisted columns. Trigger raises if a blocked column actually
-- changed (is distinct from old), so submitting an unchanged value is fine.
create or replace function public.enforce_parent_people_column_whitelist()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := exists (
    select 1 from public.account_people ap
    where ap.person_id = new.id
      and public.has_account_role(ap.account_id, 'manager')
  );

  if v_is_admin then
    return new;
  end if;

  -- Non-admin path: only the column whitelist may change. Anything below
  -- raises. Listed in schema order for grep-ability.
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

drop trigger if exists trg_enforce_parent_people_column_whitelist on public.people;

create trigger trg_enforce_parent_people_column_whitelist
  before update on public.people
  for each row
  execute function public.enforce_parent_people_column_whitelist();

-- ============================================================================
-- 2. relationships: SELECT for both endpoints of an accessible link
-- ============================================================================

create policy "Parents can view their relationships"
  on public.relationships for select
  to authenticated
  using (
    public.current_user_can_access_person(person_id)
    or public.current_user_can_access_person(relation_id)
  );

-- ============================================================================
-- 3. rosters + roster_awards: SELECT scoped via roster.person_id
-- ============================================================================

create policy "Parents can view accessible rosters"
  on public.rosters for select
  to authenticated
  using (public.current_user_can_access_person(person_id));

create policy "Parents can view accessible roster awards"
  on public.roster_awards for select
  to authenticated
  using (
    exists (
      select 1 from public.rosters r
      where r.id = roster_awards.roster_id
        and public.current_user_can_access_person(r.person_id)
    )
  );

-- ============================================================================
-- 4. teams + seasons: SELECT transitively via rosters
-- ============================================================================

create policy "Parents can view teams for accessible rosters"
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1 from public.rosters r
      where r.team_id = teams.id
        and public.current_user_can_access_person(r.person_id)
    )
  );

create policy "Parents can view seasons for accessible teams"
  on public.seasons for select
  to authenticated
  using (
    exists (
      select 1
      from public.teams t
      join public.rosters r on r.team_id = t.id
      where t.season_id = seasons.id
        and public.current_user_can_access_person(r.person_id)
    )
  );

-- ============================================================================
-- 5. event_registrations + events: SELECT via registration person_id
-- ============================================================================

create policy "Parents can view accessible event registrations"
  on public.event_registrations for select
  to authenticated
  using (public.current_user_can_access_person(person_id));

-- Events visible to a parent: any event one of their accessible people is
-- registered for, OR an event tied to a team one of their accessible people
-- is on (so parents see game schedules even without a registration row).
create policy "Parents can view events for accessible people"
  on public.events for select
  to authenticated
  using (
    exists (
      select 1 from public.event_registrations er
      where er.event_id = events.id
        and public.current_user_can_access_person(er.person_id)
    )
    or (
      events.team_id is not null
      and exists (
        select 1 from public.rosters r
        where r.team_id = events.team_id
          and public.current_user_can_access_person(r.person_id)
      )
    )
  );

-- ============================================================================
-- 6. invoices: SELECT for invoices billed to an accessible person
-- ============================================================================

create policy "Parents can view accessible invoices"
  on public.invoices for select
  to authenticated
  using (public.current_user_can_access_person(person_id));
