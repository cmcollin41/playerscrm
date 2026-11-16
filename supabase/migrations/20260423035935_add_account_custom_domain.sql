-- Add custom_domain column for CNAME support
-- e.g. "app.provobasketball.com" → maps to the provobasketball account

alter table public.accounts
  add column custom_domain text unique;

create index idx_accounts_custom_domain on public.accounts(custom_domain);
