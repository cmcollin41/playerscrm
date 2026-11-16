-- Roster awards (replaces person_awards for roster context)
create table public.roster_awards (
  id uuid not null default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  title text not null,
  created_at timestamp with time zone not null default now(),
  constraint roster_awards_pkey primary key (id)
);

alter table public.roster_awards enable row level security;

create policy "Users can view roster awards for their teams"
  on public.roster_awards for select
  using (
    exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      join public.profiles p on p.account_id = t.account_id
      where r.id = roster_awards.roster_id and p.id = auth.uid()
    )
  );

create policy "Public can view roster awards for public rosters"
  on public.roster_awards for select
  using (
    exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id and t.is_public = true
      join public.people pe on pe.id = r.person_id and pe.is_public = true
      where r.id = roster_awards.roster_id
    )
  );

create policy "Users can insert roster awards for their teams"
  on public.roster_awards for insert
  with check (
    exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      join public.profiles p on p.account_id = t.account_id
      where r.id = roster_awards.roster_id and p.id = auth.uid()
    )
  );

create policy "Users can delete roster awards for their teams"
  on public.roster_awards for delete
  using (
    exists (
      select 1 from public.rosters r
      join public.teams t on t.id = r.team_id
      join public.profiles p on p.account_id = t.account_id
      where r.id = roster_awards.roster_id and p.id = auth.uid()
    )
  );

-- Roster photo (supersedes person photo for this roster)
alter table public.rosters add column if not exists photo text;

-- Staff photo (supersedes person photo for this team)
alter table public.staff add column if not exists photo text;
