-- award_types, team_awards and player_season_stats decided access from the
-- legacy profiles.account_id, which ignores roles: any login whose home
-- account matched could write, including read-only members and portal
-- parents. access now comes from account membership via has_account_role.
-- anon read policies are unchanged.

-- ---------------------------------------------------------------------------
-- award_types: any signed-in user may read (anon already can); admins write
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated select award_types" on public.award_types;
drop policy if exists "Allow authenticated insert award_types" on public.award_types;
drop policy if exists "Allow authenticated update award_types" on public.award_types;
drop policy if exists "Allow authenticated delete award_types" on public.award_types;

drop policy if exists "Authenticated can read award types" on public.award_types;
create policy "Authenticated can read award types"
  on public.award_types for select
  to authenticated
  using (true);

drop policy if exists "Admins can create award types" on public.award_types;
create policy "Admins can create award types"
  on public.award_types for insert
  to authenticated
  with check (account_id is not null and public.has_account_role(account_id, 'admin'));

drop policy if exists "Admins can update award types" on public.award_types;
create policy "Admins can update award types"
  on public.award_types for update
  to authenticated
  using (account_id is not null and public.has_account_role(account_id, 'admin'))
  with check (account_id is not null and public.has_account_role(account_id, 'admin'));

drop policy if exists "Admins can delete award types" on public.award_types;
create policy "Admins can delete award types"
  on public.award_types for delete
  to authenticated
  using (account_id is not null and public.has_account_role(account_id, 'admin'));

-- ---------------------------------------------------------------------------
-- team_awards: members read, managers write. adds the missing update policy.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view awards for their account teams" on public.team_awards;
drop policy if exists "Users can insert awards for their account teams" on public.team_awards;
drop policy if exists "Users can delete awards for their account teams" on public.team_awards;

drop policy if exists "Members can read team awards" on public.team_awards;
create policy "Members can read team awards"
  on public.team_awards for select
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and public.has_account_role(t.account_id, 'member')
    )
  );

drop policy if exists "Managers can create team awards" on public.team_awards;
create policy "Managers can create team awards"
  on public.team_awards for insert
  to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can update team awards" on public.team_awards;
create policy "Managers can update team awards"
  on public.team_awards for update
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and public.has_account_role(t.account_id, 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can delete team awards" on public.team_awards;
create policy "Managers can delete team awards"
  on public.team_awards for delete
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- player_season_stats: members read, managers write
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated select player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated insert player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated update player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated delete player_season_stats" on public.player_season_stats;

drop policy if exists "Members can read player season stats" on public.player_season_stats;
create policy "Members can read player season stats"
  on public.player_season_stats for select
  to authenticated
  using (public.has_account_role(account_id, 'member'));

drop policy if exists "Managers can create player season stats" on public.player_season_stats;
create policy "Managers can create player season stats"
  on public.player_season_stats for insert
  to authenticated
  with check (public.has_account_role(account_id, 'manager'));

drop policy if exists "Managers can update player season stats" on public.player_season_stats;
create policy "Managers can update player season stats"
  on public.player_season_stats for update
  to authenticated
  using (public.has_account_role(account_id, 'manager'))
  with check (public.has_account_role(account_id, 'manager'));

drop policy if exists "Managers can delete player season stats" on public.player_season_stats;
create policy "Managers can delete player season stats"
  on public.player_season_stats for delete
  to authenticated
  using (public.has_account_role(account_id, 'manager'));

-- ---------------------------------------------------------------------------
-- roster_awards: remove the last legacy read policy. members, parents and
-- public rosters are covered by the policies added on 2026-11-16 and before.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view roster awards for their teams" on public.roster_awards;
