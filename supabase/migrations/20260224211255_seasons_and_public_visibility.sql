begin;

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  year_start int not null,
  year_end int not null,
  slug text not null,
  display_name text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists seasons_account_year_end_unique
  on public.seasons (account_id, year_end);

create unique index if not exists seasons_account_slug_unique
  on public.seasons (account_id, slug);

alter table public.teams
  add column if not exists season_id uuid references public.seasons(id) on delete set null,
  add column if not exists level text,
  add column if not exists is_public boolean not null default false,
  add column if not exists slug text;

alter table public.people
  add column if not exists slug text,
  add column if not exists jersey_number int,
  add column if not exists position text,
  add column if not exists height text,
  add column if not exists weight_lbs int,
  add column if not exists grad_year int,
  add column if not exists hometown text,
  add column if not exists bio text;

commit;
