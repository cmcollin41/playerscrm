-- roster_awards had a single "for all to authenticated using (true)" policy,
-- so any signed-in user could write any tenant's awards. replace it with one
-- policy per operation. reads stay as open as the existing anon read policy;
-- writes require manager on the account that owns the roster's team.

drop policy if exists "Allow authenticated access to roster_awards" on public.roster_awards;

drop policy if exists "Authenticated can read roster awards" on public.roster_awards;
create policy "Authenticated can read roster awards"
  on public.roster_awards for select
  to authenticated
  using (true);

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
