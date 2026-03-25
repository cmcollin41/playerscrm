-- add maxpreps_url to people and create player_season_stats table

alter table public.people
  add column if not exists maxpreps_url text null;

create table if not exists public.player_season_stats (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  person_id uuid not null,
  account_id uuid not null,
  sport text not null default 'basketball',
  season_label text not null,
  season_year_start integer null,
  season_year_end integer null,
  class_label text null,
  gp integer null,
  ppg numeric(5,1) null,
  rpg numeric(5,1) null,
  apg numeric(5,1) null,
  spg numeric(5,1) null,
  bpg numeric(5,1) null,
  fg_pct numeric(4,1) null,
  three_pct numeric(4,1) null,
  ft_pct numeric(4,1) null,
  topg numeric(5,1) null,
  mpg numeric(5,1) null,
  is_career_total boolean not null default false,
  source text not null default 'maxpreps',
  raw_data jsonb null,
  constraint player_season_stats_person_id_fkey
    foreign key (person_id) references public.people(id) on delete cascade,
  constraint player_season_stats_account_id_fkey
    foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint player_season_stats_unique_season
    unique (person_id, season_label, sport, is_career_total)
);

create index if not exists player_season_stats_person_id_idx
  on public.player_season_stats using btree (person_id);
create index if not exists player_season_stats_account_id_idx
  on public.player_season_stats using btree (account_id);

alter table public.player_season_stats enable row level security;

drop policy if exists "Allow authenticated select player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated insert player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated update player_season_stats" on public.player_season_stats;
drop policy if exists "Allow authenticated delete player_season_stats" on public.player_season_stats;
drop policy if exists "Allow anon read player_season_stats for public people" on public.player_season_stats;

-- authenticated: crud scoped to account
create policy "Allow authenticated select player_season_stats"
  on public.player_season_stats
  for select
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated insert player_season_stats"
  on public.player_season_stats
  for insert
  to authenticated
  with check (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated update player_season_stats"
  on public.player_season_stats
  for update
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated delete player_season_stats"
  on public.player_season_stats
  for delete
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

-- anon: read for public people
create policy "Allow anon read player_season_stats for public people"
  on public.player_season_stats
  for select
  to anon
  using (
    exists (
      select 1 from public.people p
      where p.id = player_season_stats.person_id
        and p.is_public = true
    )
  );
