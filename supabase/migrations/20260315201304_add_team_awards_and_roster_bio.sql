-- Create team_awards table
create table public.team_awards (
  id uuid not null default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  year integer,
  created_at timestamp with time zone not null default now(),
  constraint team_awards_pkey primary key (id)
);

-- Enable RLS
alter table public.team_awards enable row level security;

-- RLS policies for team_awards
create policy "Users can view awards for their account teams"
  on public.team_awards for select
  using (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.account_id = t.account_id
      where t.id = team_awards.team_id
      and p.id = auth.uid()
    )
  );

create policy "Users can insert awards for their account teams"
  on public.team_awards for insert
  with check (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.account_id = t.account_id
      where t.id = team_awards.team_id
      and p.id = auth.uid()
    )
  );

create policy "Users can delete awards for their account teams"
  on public.team_awards for delete
  using (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.account_id = t.account_id
      where t.id = team_awards.team_id
      and p.id = auth.uid()
    )
  );

-- Add bio column to rosters table
alter table public.rosters add column if not exists bio text;
