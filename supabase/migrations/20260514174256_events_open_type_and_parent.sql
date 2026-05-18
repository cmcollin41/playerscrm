-- Make event_type free-form so it can act as a soft "app slug" pointing to
-- a code-defined event-app registry. Existing values (camp/practice/game/other)
-- remain valid and resolve to built-in apps with the same slugs.
alter table public.events
  drop constraint if exists events_event_type_check;

-- Allow events to nest under a parent for grouping (tournament -> games,
-- camp -> day-events when we eventually migrate from event_sessions, etc.).
-- on delete cascade so removing a parent removes its children.
alter table public.events
  add column if not exists parent_event_id uuid
  references public.events(id) on delete cascade;

create index if not exists events_parent_event_id_idx
  on public.events (account_id, parent_event_id)
  where parent_event_id is not null;
