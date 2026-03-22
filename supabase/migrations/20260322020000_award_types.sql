-- create award_types lookup table and link to roster_awards

-- add sport to accounts for org-level sport scoping
alter table public.accounts
  add column if not exists sport text not null default 'basketball';

-- award_types table
create table if not exists public.award_types (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid null,
  slug text not null,
  name text not null,
  category text not null,
  sport text not null default 'basketball',
  sort_order integer not null default 0,
  constraint award_types_account_id_fkey
    foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint award_types_unique_slug
    unique (account_id, slug)
);

create index if not exists award_types_account_id_idx
  on public.award_types using btree (account_id);

alter table public.award_types enable row level security;

-- authenticated: read global defaults + own account types
create policy "Allow authenticated select award_types"
  on public.award_types
  for select
  to authenticated
  using (
    account_id is null
    or account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated insert award_types"
  on public.award_types
  for insert
  to authenticated
  with check (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated update award_types"
  on public.award_types
  for update
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

create policy "Allow authenticated delete award_types"
  on public.award_types
  for delete
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = (select auth.uid()))
  );

-- anon: read account-specific types for public API
create policy "Allow anon read award_types"
  on public.award_types
  for select
  to anon
  using (true);

-- add award_type_id to roster_awards
alter table public.roster_awards
  add column if not exists award_type_id uuid null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'roster_awards_award_type_id_fkey'
  ) then
    alter table public.roster_awards
      add constraint roster_awards_award_type_id_fkey
      foreign key (award_type_id) references public.award_types(id) on delete set null;
  end if;
end $$;

-- seed global default basketball award types
insert into public.award_types (account_id, slug, name, category, sport, sort_order) values
  (null, '1st-team-all-state', '1st Team All-State', 'all-state', 'basketball', 10),
  (null, '2nd-team-all-state', '2nd Team All-State', 'all-state', 'basketball', 20),
  (null, '3rd-team-all-state', '3rd Team All-State', 'all-state', 'basketball', 30),
  (null, 'hm-all-state', 'Honorable Mention All-State', 'all-state', 'basketball', 40),
  (null, '1st-team-all-region', '1st Team All-Region', 'all-region', 'basketball', 50),
  (null, '2nd-team-all-region', '2nd Team All-Region', 'all-region', 'basketball', 60),
  (null, '3rd-team-all-region', '3rd Team All-Region', 'all-region', 'basketball', 70),
  (null, 'hm-all-region', 'Honorable Mention All-Region', 'all-region', 'basketball', 80),
  (null, 'region-mvp', 'Region MVP', 'all-region', 'basketball', 90),
  (null, 'all-american', 'All-American', 'national', 'basketball', 100),
  (null, 'gatorade-poy', 'Gatorade Player of the Year', 'national', 'basketball', 110),
  (null, 'mr-basketball', 'Mr. Basketball', 'national', 'basketball', 120),
  (null, '3a-mvp', '3A MVP', 'mvp', 'basketball', 130),
  (null, '4a-mvp', '4A MVP', 'mvp', 'basketball', 140),
  (null, '5a-mvp', '5A MVP', 'mvp', 'basketball', 150),
  (null, 'academic-all-state', 'Academic All-State', 'academic', 'basketball', 160),
  (null, '1000-point-scorer', '1,000 Point Scorer', 'milestone', 'basketball', 170),
  (null, 'captain', 'Captain', 'milestone', 'basketball', 180)
on conflict (account_id, slug) do nothing;
