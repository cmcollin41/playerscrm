-- roster_awards writes were not role-scoped. the live database let anyone
-- whose profiles.account_id matched the team's account insert and delete
-- awards (including read-only members and portal parents); databases built
-- from the original migration file had a single
-- "for all to authenticated using (true)" policy instead. drop both shapes
-- and require manager on the account that owns the roster's team.
--
-- existing select policies (public rosters, parent access, legacy
-- "users can view") are left in place; a member-scoped read is added so
-- staff reads do not depend on the legacy profiles.account_id column.

drop policy if exists "Allow authenticated access to roster_awards" on public.roster_awards;
drop policy if exists "Users can insert roster awards for their teams" on public.roster_awards;
drop policy if exists "Users can delete roster awards for their teams" on public.roster_awards;

drop policy if exists "Members can read roster awards" on public.roster_awards;
create policy "Members can read roster awards"
  on public.roster_awards for select
  to authenticated
  using (
    exists (
      select 1
      from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_awards.roster_id
        and public.has_account_role(t.account_id, 'member')
    )
  );

drop policy if exists "Managers can create roster awards" on public.roster_awards;
create policy "Managers can create roster awards"
  on public.roster_awards for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_awards.roster_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can update roster awards" on public.roster_awards;
create policy "Managers can update roster awards"
  on public.roster_awards for update
  to authenticated
  using (
    exists (
      select 1
      from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_awards.roster_id
        and public.has_account_role(t.account_id, 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_awards.roster_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can delete roster awards" on public.roster_awards;
create policy "Managers can delete roster awards"
  on public.roster_awards for delete
  to authenticated
  using (
    exists (
      select 1
      from public.rosters r
      join public.teams t on t.id = r.team_id
      where r.id = roster_awards.roster_id
        and public.has_account_role(t.account_id, 'manager')
    )
  );
