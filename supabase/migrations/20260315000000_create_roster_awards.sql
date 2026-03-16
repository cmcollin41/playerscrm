/*
  Migration: Create roster_awards table

  Purpose:
  - Awards should be tied to roster entries (person + team), not to people globally
  - This allows the same person to have different awards per team/season

  Affected Tables: roster_awards (new)
*/

create table if not exists public.roster_awards (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  roster_id uuid not null,
  title text not null,
  year integer null,
  constraint roster_awards_roster_id_fkey foreign key (roster_id) references public.rosters(id) on delete cascade
);

comment on table public.roster_awards is 'Awards earned by a player for a specific team/roster entry';

create index if not exists roster_awards_roster_id_idx on public.roster_awards using btree (roster_id);

-- Enable RLS
alter table public.roster_awards enable row level security;

-- Policy: Allow authenticated users full access
create policy "Allow authenticated access to roster_awards"
  on public.roster_awards
  for all
  to authenticated
  using (true)
  with check (true);

-- Policy: Allow anon to read (for public team/roster display)
create policy "Allow anon read roster_awards"
  on public.roster_awards
  for select
  to anon
  using (true);

-- Note: person_awards was migrated to roster_awards in a previous deployment.
-- person_awards has since been dropped (see 20260315120000_drop_person_awards.sql).
