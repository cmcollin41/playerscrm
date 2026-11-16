-- event-registration checkout payments were written in cents into
-- payments.amount, which holds dollars. rows written by fixed code carry
-- data->>'amount_unit' = 'dollars' and are skipped.
--
-- apply this only after the code change that writes amount_unit is live in
-- production, otherwise rows written by old code after this runs stay wrong.
--
-- review before applying. preview the affected rows with:
--   select id, created_at, amount, amount / 100 as corrected, status
--   from public.payments
--   where invoice_id is null
--     and data->>'stripe_checkout_session_id' is not null
--     and data->>'amount_unit' is null
--   order by created_at;
-- spot-check a few against the stripe dashboard: the stripe charge in dollars
-- must equal the "corrected" column.

update public.payments
set
  amount = amount / 100,
  data = jsonb_set(data, '{amount_unit}', '"dollars"')
where invoice_id is null
  and data->>'stripe_checkout_session_id' is not null
  and data->>'amount_unit' is null;
