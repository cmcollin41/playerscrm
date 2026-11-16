-- Add subdomain column to accounts for tenant routing
-- e.g. "provobasketball" → provobasketball.athletes.app

alter table public.accounts
  add column subdomain text unique;

create index idx_accounts_subdomain on public.accounts(subdomain);

-- Allow anon to look up accounts by subdomain (for public registration pages)
create policy "Anon can read account by subdomain"
  on public.accounts for select
  to anon
  using (subdomain is not null);

-- Backfill: set subdomain for Provo Basketball account
update public.accounts
set subdomain = 'provobasketball'
where regexp_replace(lower(trim(both from name)), '\s+', ' ', 'g') = 'provo basketball';
