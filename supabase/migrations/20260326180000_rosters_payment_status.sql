alter table public.rosters
  add column payment_status text null,
  add column payment_status_note text null;

alter table public.rosters
  add constraint rosters_payment_status_check
  check (payment_status in ('paid', 'waived') or payment_status is null);

comment on column public.rosters.payment_status is 'Manual payment status: paid, waived, or null (derive from invoices)';
comment on column public.rosters.payment_status_note is 'Admin note explaining the manual payment status';
