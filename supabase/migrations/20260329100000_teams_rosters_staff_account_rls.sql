-- Authenticated RLS for teams, rosters, and staff (phase1 only added anon read policies).

-- ----- teams -----
drop policy if exists "Members can view teams for their accounts" on public.teams;
create policy "Members can view teams for their accounts"
  on public.teams for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

drop policy if exists "Managers can create teams" on public.teams;
create policy "Managers can create teams"
  on public.teams for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

drop policy if exists "Managers can update teams" on public.teams;
create policy "Managers can update teams"
  on public.teams for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

drop policy if exists "Admins can delete teams" on public.teams;
create policy "Admins can delete teams"
  on public.teams for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- ----- rosters -----
drop policy if exists "Members can view rosters for their accounts" on public.rosters;
create policy "Members can view rosters for their accounts"
  on public.rosters for select
  to authenticated
  using (
    team_id in (
      select t.id
      from public.teams t
      where t.account_id in (select get_user_account_ids())
    )
  );

drop policy if exists "Managers can create rosters" on public.rosters;
create policy "Managers can create rosters"
  on public.rosters for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can update rosters" on public.rosters;
create policy "Managers can update rosters"
  on public.rosters for update
  to authenticated
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Admins can delete rosters" on public.rosters;
create policy "Admins can delete rosters"
  on public.rosters for delete
  to authenticated
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'admin')
    )
  );

-- ----- staff -----
drop policy if exists "Members can view staff for their accounts" on public.staff;
create policy "Members can view staff for their accounts"
  on public.staff for select
  to authenticated
  using (
    team_id in (
      select t.id
      from public.teams t
      where t.account_id in (select get_user_account_ids())
    )
  );

drop policy if exists "Managers can create staff" on public.staff;
create policy "Managers can create staff"
  on public.staff for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Managers can update staff" on public.staff;
create policy "Managers can update staff"
  on public.staff for update
  to authenticated
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'manager')
    )
  );

drop policy if exists "Admins can delete staff" on public.staff;
create policy "Admins can delete staff"
  on public.staff for delete
  to authenticated
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and has_account_role(t.account_id, 'admin')
    )
  );
