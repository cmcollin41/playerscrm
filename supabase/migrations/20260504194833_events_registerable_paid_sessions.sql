-- Make registerable / paid explicit on events, and add sessions

-- ============================================================================
-- 1. Flags on events
-- ============================================================================

alter table public.events
  add column if not exists is_registerable boolean not null default false,
  add column if not exists is_paid boolean not null default false;

-- Backfill: anything that wasn't a game/practice was treated as registerable,
-- and anything with a non-zero fee was treated as paid.
update public.events
set is_registerable = true
where event_type in ('camp', 'other');

update public.events
set is_paid = true
where fee_amount > 0;

-- ============================================================================
-- 2. event_sessions child table
-- ============================================================================

create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  ordering integer not null default 0
);

create index if not exists idx_event_sessions_event
  on public.event_sessions(event_id, ordering, starts_at);

alter table public.event_sessions enable row level security;

create policy "Members can view event sessions"
  on public.event_sessions for select
  to authenticated
  using (
    event_id in (
      select id from public.events
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Anon can view sessions of published events"
  on public.event_sessions for select
  to anon
  using (
    event_id in (
      select e.id from public.events e
      left join public.teams t on t.id = e.team_id
      where e.is_published = true
        and (e.team_id is null or t.is_public = true)
    )
  );

create policy "Managers can create event sessions"
  on public.event_sessions for insert
  to authenticated
  with check (
    event_id in (
      select id from public.events
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update event sessions"
  on public.event_sessions for update
  to authenticated
  using (
    event_id in (
      select id from public.events
      where has_account_role(account_id, 'manager')
    )
  )
  with check (
    event_id in (
      select id from public.events
      where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can delete event sessions"
  on public.event_sessions for delete
  to authenticated
  using (
    event_id in (
      select id from public.events
      where has_account_role(account_id, 'manager')
    )
  );
