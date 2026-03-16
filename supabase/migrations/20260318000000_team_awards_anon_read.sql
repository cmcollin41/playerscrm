-- Allow anonymous read of team_awards for public teams (used by public API)
create policy "Allow anon read team_awards for public teams"
  on public.team_awards
  for select
  to anon
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_awards.team_id
        and t.is_public = true
        and t.is_active = true
    )
  );
