-- platform admin used to mean profiles.role = 'admin', the legacy per-tenant
-- admin flag, so every tenant admin could manage fulfillment partners and
-- read every tenant's store orders. it is now an explicit list. the table
-- has row level security on and no policies: only the service role (or the
-- sql editor) can read or change it. it starts empty on purpose.

create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);

comment on table public.platform_admins is 'people who operate the platform itself, across all tenants. managed by hand; see is_platform_admin().';

alter table public.platform_admins enable row level security;

revoke all on table public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.profile_id = (select auth.uid())
  );
$$;
