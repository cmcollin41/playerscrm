-- adds series fields to events for clone-on-create recurring events.
-- backward compatible: all new columns are nullable; existing rows
-- (including the live basketball camp) get null and behave identically
-- to non-recurring events.

alter table public.events
  add column if not exists series_id uuid,
  add column if not exists series_index integer;

create index if not exists events_series_id_idx
  on public.events (account_id, series_id, series_index)
  where series_id is not null;
