-- Add slug columns to teams and people for URL-friendly identifiers
-- Safe to run: only adds column if it doesn't exist

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'slug'
  ) then
    alter table public.teams add column slug text null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'slug'
  ) then
    alter table public.people add column slug text null;
  end if;
end $$;
