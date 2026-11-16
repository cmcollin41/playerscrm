-- add social media columns to people

alter table public.people
  add column if not exists instagram text null,
  add column if not exists twitter text null,
  add column if not exists hudl_url text null;
