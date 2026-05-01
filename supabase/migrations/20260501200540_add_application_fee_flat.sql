-- Add a flat-cents component to the platform fee, alongside the existing
-- percent. Final fee = round(amount_cents * percent/100) + flat_cents.

alter table public.accounts
  add column application_fee_flat integer not null default 0;

comment on column public.accounts.application_fee
  is 'platform fee percent (e.g. 3 means 3%)';

comment on column public.accounts.application_fee_flat
  is 'platform fee flat amount in cents, added on top of the percent';
