-- Fix infinite-recursion error in RLS policy evaluation introduced by
-- 20260513145527_parent_portal_rls_policies.sql.
--
-- The parent-portal SELECT policies on teams/events/seasons/roster_awards
-- subselected directly from rosters. The pre-existing "Members can view
-- rosters" policy on rosters subselects from teams. Postgres OR's all
-- permissive policies, so the teams<->rosters policy graph self-cycles and
-- errors with 42P17 ("infinite recursion detected") on every read of those
-- tables. Net effect: the dashboard's teams and events queries returned
-- nothing.
--
-- Fix: wrap each per-row parent-side check in a SECURITY DEFINER helper that
-- bypasses RLS when walking rosters/teams, mirroring the existing
-- current_user_can_access_person pattern from
-- 20260513145247_parent_portal_relationship_helpers.sql.

-- ============================================================================
-- 1. SECURITY DEFINER helpers
-- ============================================================================

create or replace function public.current_user_can_access_team(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.rosters r
    where r.team_id = t_id
      and r.person_id in (
        select id from public.current_user_accessible_person_ids() as ap(id)
      )
  )
$$;

create or replace function public.current_user_can_access_roster(r_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.rosters r
    where r.id = r_id
      and r.person_id in (
        select id from public.current_user_accessible_person_ids() as ap(id)
      )
  )
$$;

create or replace function public.current_user_can_access_event(e_id uuid, e_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.event_registrations er
    where er.event_id = e_id
      and er.person_id in (
        select id from public.current_user_accessible_person_ids() as ap(id)
      )
  ) or (
    e_team_id is not null and public.current_user_can_access_team(e_team_id)
  )
$$;

create or replace function public.current_user_can_access_season(s_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.teams t
    join public.rosters r on r.team_id = t.id
    where t.season_id = s_id
      and r.person_id in (
        select id from public.current_user_accessible_person_ids() as ap(id)
      )
  )
$$;

grant execute on function public.current_user_can_access_team(uuid) to authenticated;
grant execute on function public.current_user_can_access_roster(uuid) to authenticated;
grant execute on function public.current_user_can_access_event(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_access_season(uuid) to authenticated;

-- ============================================================================
-- 2. Replace each recursive policy with a definer-helper call
-- ============================================================================

drop policy if exists "Parents can view teams for accessible rosters" on public.teams;
create policy "Parents can view teams for accessible rosters"
  on public.teams for select
  to authenticated
  using (public.current_user_can_access_team(id));

drop policy if exists "Parents can view events for accessible people" on public.events;
create policy "Parents can view events for accessible people"
  on public.events for select
  to authenticated
  using (public.current_user_can_access_event(id, team_id));

drop policy if exists "Parents can view seasons for accessible teams" on public.seasons;
create policy "Parents can view seasons for accessible teams"
  on public.seasons for select
  to authenticated
  using (public.current_user_can_access_season(id));

drop policy if exists "Parents can view accessible roster awards" on public.roster_awards;
create policy "Parents can view accessible roster awards"
  on public.roster_awards for select
  to authenticated
  using (public.current_user_can_access_roster(roster_id));
