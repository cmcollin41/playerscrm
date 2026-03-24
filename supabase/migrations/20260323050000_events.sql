-- Event registration system: events + event_registrations tables

-- ============================================================================
-- 1. Events table
-- ============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text not null,
  description text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer,
  fee_amount bigint not null default 0,
  fee_description text,
  is_published boolean not null default false,
  metadata jsonb default '{}',
  unique(account_id, slug)
);

create index idx_events_account on public.events(account_id);
create index idx_events_slug on public.events(slug);

alter table public.events enable row level security;

create policy "Members can view events"
  on public.events for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can create events"
  on public.events for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update events"
  on public.events for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete events"
  on public.events for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

create policy "Anon can view published events"
  on public.events for select
  to anon
  using (is_published = true);

-- ============================================================================
-- 2. Event registrations table
-- ============================================================================

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  person_id uuid not null references people(id),
  registered_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'waitlisted')),
  payment_id uuid references payments(id),
  metadata jsonb default '{}',
  unique(event_id, person_id)
);

create index idx_event_reg_event on public.event_registrations(event_id);
create index idx_event_reg_person on public.event_registrations(person_id);

alter table public.event_registrations enable row level security;

-- Authenticated users in the event's account can view registrations
create policy "Members can view event registrations"
  on public.event_registrations for select
  to authenticated
  using (
    event_id in (
      select id from events
      where account_id in (select get_user_account_ids())
    )
  );

-- Authenticated users can register for published events (self-registration)
-- OR managers can register people on their behalf
create policy "Users can create registrations"
  on public.event_registrations for insert
  to authenticated
  with check (
    event_id in (
      select id from events where is_published = true
    )
    or event_id in (
      select id from events where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update registrations"
  on public.event_registrations for update
  to authenticated
  using (
    event_id in (
      select id from events where has_account_role(account_id, 'manager')
    )
  )
  with check (
    event_id in (
      select id from events where has_account_role(account_id, 'manager')
    )
  );

create policy "Admins can delete registrations"
  on public.event_registrations for delete
  to authenticated
  using (
    event_id in (
      select id from events where has_account_role(account_id, 'admin')
    )
  );
