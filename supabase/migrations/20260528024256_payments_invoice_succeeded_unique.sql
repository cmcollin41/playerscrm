-- prevent duplicate succeeded payment rows tied to the same invoice.
-- stripe occasionally delivers invoice.payment_succeeded twice within
-- milliseconds, and the check-then-insert in the webhook handler can't
-- deduplicate under that race; this index pushes the guarantee to the db
-- so the second insert fails with 23505 and the webhook can swallow it.
create unique index if not exists payments_invoice_succeeded_uniq
  on public.payments (invoice_id)
  where invoice_id is not null and status = 'succeeded';
