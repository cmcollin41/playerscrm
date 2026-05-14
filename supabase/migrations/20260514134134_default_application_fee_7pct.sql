-- Make $1 + 7% the default application fee on new public.accounts rows.
-- Aligns the schema default with the published marketing rate. Existing
-- rows (e.g. the three grandfathered Provo HS accounts at 5% + $1) are
-- unchanged -- altering a default doesn't backfill rows.

alter table public.accounts
  alter column application_fee set default 7,
  alter column application_fee_flat set default 100;
