alter table public.event_registrations
  add column payment_status text null,
  add column payment_status_note text null;

alter table public.event_registrations
  add constraint event_registrations_payment_status_check
  check (payment_status in ('paid', 'waived') or payment_status is null);

comment on column public.event_registrations.payment_status is 'Manual payment status override: paid, waived, or null (derive from linked payments row)';
comment on column public.event_registrations.payment_status_note is 'Admin note explaining the manual payment status (e.g. payment method or waiver reason)';
