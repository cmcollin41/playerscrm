-- Extend events to support team-level schedule items (practices, games)

-- ============================================================================
-- 1. New columns on events
-- ============================================================================

alter table public.events
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists event_type text not null default 'camp',
  add column if not exists opponent_name text,
  add column if not exists is_home boolean,
  add column if not exists arrival_time timestamptz;

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
    check (event_type in ('camp', 'practice', 'game', 'other'));

create index if not exists idx_events_team on public.events(team_id, starts_at);

-- ============================================================================
-- 2. Refresh anon select policy so private team events stay hidden
-- ============================================================================

drop policy if exists "Anon can view published events" on public.events;

create policy "Anon can view published events"
  on public.events for select
  to anon
  using (
    is_published = true
    and (
      team_id is null
      or exists (
        select 1 from public.teams t
        where t.id = events.team_id
          and t.is_public = true
      )
    )
  );
