-- optional dollars override for a roster spot (used for invoices + checkout when set)
alter table public.rosters
  add column if not exists custom_amount numeric(12, 2);

comment on column public.rosters.custom_amount is
  'optional price in dollars for this roster row; when set, overrides fees.amount for billing ui and checkout';
