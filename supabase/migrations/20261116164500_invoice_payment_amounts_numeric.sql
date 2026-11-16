-- invoices.amount and payments.amount hold dollars but were bigint, so any
-- amount with cents (a $1.50 invoice, a $52.50 payment) failed with
-- "invalid input syntax for type bigint". Widen to numeric; existing whole
-- dollar values convert losslessly.
alter table public.invoices
  alter column amount type numeric(12, 2) using amount::numeric(12, 2),
  alter column amount set default 0;

alter table public.payments
  alter column amount type numeric(12, 2) using amount::numeric(12, 2),
  alter column amount set default 0;
