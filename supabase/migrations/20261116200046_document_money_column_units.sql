-- records the unit of every money column. comments only: no data, type or
-- name changes. rule: billing records are dollars; prices, store amounts and
-- anything exchanged with stripe are integer cents; *_cents is always cents.

comment on column public.invoices.amount is 'dollars, numeric(12,2)';
comment on column public.payments.amount is 'dollars, numeric(12,2). stripe amounts are cents: convert with centsToDollars() in lib/money.ts';
comment on column public.rosters.custom_amount is 'dollars. per-roster override of the fee';
comment on column public.fees.amount is 'whole dollars (stored in a bigint)';
comment on column public.events.fee_amount is 'integer cents per person (5000 = $50.00), despite the name';
comment on column public.event_products.price_cents is 'integer cents';
comment on column public.event_registration_items.unit_price_cents is 'integer cents';
comment on column public.org_product_variants.price_cents is 'integer cents';
comment on column public.org_product_variants.partner_cost_cents is 'integer cents';
comment on column public.store_order_items.unit_price_cents is 'integer cents';
comment on column public.store_orders.subtotal_cents is 'integer cents';
comment on column public.store_orders.shipping_cents is 'integer cents';
comment on column public.store_orders.total_cents is 'integer cents';
comment on column public.store_orders.application_fee_cents is 'integer cents';
comment on column public.store_order_dispatches.shipping_cents is 'integer cents';
comment on column public.accounts.application_fee_flat is 'integer cents added to the platform fee';
comment on column public.accounts.application_fee is 'platform fee percent (5 = 5%), not a money amount';
