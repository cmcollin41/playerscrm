-- waivers: account-level reusable liability/consent templates that organizers
-- attach to events (m2m). registrants sign them during public registration;
-- each signature snapshots the waiver title + body for audit, plus
-- timestamp/ip/user_agent.

-- ============================================================================
-- 1. waivers — account-level reusable templates
-- ============================================================================
create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

comment on table public.waivers is
  'Account-level waiver templates (liability release, photo release, etc.). Attach to events via event_waivers. Body is markdown.';

create index waivers_account_id_idx on public.waivers (account_id);
create index waivers_active_idx on public.waivers (account_id) where is_active = true;

create or replace function public.waivers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_waivers_updated_at
  before update on public.waivers
  for each row execute function public.waivers_set_updated_at();

alter table public.waivers enable row level security;

create policy "Members can view waivers"
  on public.waivers for select
  to authenticated
  using (account_id in (select public.get_user_account_ids()));

create policy "Managers can insert waivers"
  on public.waivers for insert
  to authenticated
  with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update waivers"
  on public.waivers for update
  to authenticated
  using (public.has_account_role(account_id, 'manager'))
  with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete waivers"
  on public.waivers for delete
  to authenticated
  using (public.has_account_role(account_id, 'admin'));

-- ============================================================================
-- 2. event_waivers — m2m attaching waivers to events
-- ============================================================================
create table public.event_waivers (
  event_id uuid not null references public.events(id) on delete cascade,
  waiver_id uuid not null references public.waivers(id) on delete restrict,
  is_required boolean not null default true,
  requires_guardian boolean not null default false,
  ordering integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (event_id, waiver_id)
);

comment on table public.event_waivers is
  'Attaches waiver templates to an event. requires_guardian forces guardian signing regardless of registrant age.';

create index event_waivers_waiver_id_idx on public.event_waivers (waiver_id);

alter table public.event_waivers enable row level security;

create policy "Members can view event waivers"
  on public.event_waivers for select
  to authenticated
  using (
    event_id in (
      select id from public.events
      where account_id in (select public.get_user_account_ids())
    )
  );

create policy "Anon can view event waivers on published events"
  on public.event_waivers for select
  to anon
  using (
    event_id in (
      select id from public.events where is_published = true
    )
  );

create policy "Authenticated can view event waivers on published events"
  on public.event_waivers for select
  to authenticated
  using (
    event_id in (
      select id from public.events where is_published = true
    )
  );

create policy "Managers can insert event waivers"
  on public.event_waivers for insert
  to authenticated
  with check (
    event_id in (
      select id from public.events where public.has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update event waivers"
  on public.event_waivers for update
  to authenticated
  using (
    event_id in (
      select id from public.events where public.has_account_role(account_id, 'manager')
    )
  )
  with check (
    event_id in (
      select id from public.events where public.has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can delete event waivers"
  on public.event_waivers for delete
  to authenticated
  using (
    event_id in (
      select id from public.events where public.has_account_role(account_id, 'manager')
    )
  );

-- waivers select policies that reference event_waivers (created after event_waivers exists)
create policy "Anon can view waivers on published events"
  on public.waivers for select
  to anon
  using (
    id in (
      select waiver_id from public.event_waivers ew
      join public.events e on e.id = ew.event_id
      where e.is_published = true
    )
  );

create policy "Authenticated can view waivers on published events"
  on public.waivers for select
  to authenticated
  using (
    id in (
      select waiver_id from public.event_waivers ew
      join public.events e on e.id = ew.event_id
      where e.is_published = true
    )
  );

-- ============================================================================
-- 3. waiver_acceptances — audit record per signed waiver
-- ============================================================================
create table public.waiver_acceptances (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  waiver_id uuid not null references public.waivers(id) on delete restrict,
  signed_for_person_id uuid references public.people(id) on delete set null,
  title_snapshot text not null,
  body_snapshot text not null,
  signer_name text not null,
  signer_relationship text not null
    check (signer_relationship in ('self', 'guardian', 'other')),
  signer_email text,
  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now()
);

comment on table public.waiver_acceptances is
  'One row per signed waiver per registration. title_snapshot and body_snapshot freeze the waiver text at signing time for audit/legal purposes.';

create index waiver_acceptances_registration_id_idx
  on public.waiver_acceptances (registration_id);
create index waiver_acceptances_waiver_id_idx
  on public.waiver_acceptances (waiver_id);

alter table public.waiver_acceptances enable row level security;

create policy "Members can view waiver acceptances"
  on public.waiver_acceptances for select
  to authenticated
  using (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where e.account_id in (select public.get_user_account_ids())
    )
  );

create policy "Registrant can view own waiver acceptances"
  on public.waiver_acceptances for select
  to authenticated
  using (
    registration_id in (
      select id from public.event_registrations
      where registered_by = (select auth.uid())
    )
  );

create policy "Users can create waiver acceptances"
  on public.waiver_acceptances for insert
  to authenticated
  with check (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where e.is_published = true
         or public.has_account_role(e.account_id, 'manager')
    )
  );

create policy "Admins can delete waiver acceptances"
  on public.waiver_acceptances for delete
  to authenticated
  using (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where public.has_account_role(e.account_id, 'admin')
    )
  );
