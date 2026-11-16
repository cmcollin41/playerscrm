-- follow-up to fix_event_payment_amount_units. event payments written before
-- the switch to stripe hosted checkout (2026-03-24 to 2026-05-09) have no
-- stripe_checkout_session_id in data, so the first fix skipped them. the
-- register route was the only writer of payments rows carrying an event_id,
-- and from its first version until the amount_unit fix it always stored
-- events.fee_amount (cents) times the number of people. so every such row
-- without the amount_unit marker is in cents, whatever the event's fee is
-- today.

update public.payments
set
  amount = amount / 100,
  data = jsonb_set(data, '{amount_unit}', '"dollars"')
where invoice_id is null
  and data ? 'event_id'
  and data->>'amount_unit' is null;
