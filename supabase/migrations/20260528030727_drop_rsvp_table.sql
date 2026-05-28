-- the rsvp flow (legacy paymentintent-based event checkout) was removed in
-- the payment-refactor branch; the table no longer has any writers or
-- readers in the codebase. drop it if it still exists in any environment
-- so the schema can't drift back into accidental use.
drop table if exists public.rsvp cascade;
