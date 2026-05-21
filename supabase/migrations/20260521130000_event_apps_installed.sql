-- event apps platform: per-event installed-apps list.
--
-- Today events have a single `event_type` text column (free-form, soft
-- pointer into lib/event-apps/). This was fine when an event was one of
-- five fixed types (camp / practice / game / tournament / other). As we
-- grow toward sport-specific camps + composable features (bundled
-- products, livestream, sponsors, ...) we need many apps per event, so
-- we add an `event_apps_installed` join table.
--
-- This migration also backfills one install row per existing event from
-- its current event_type. The `event_type` column stays as a back-compat
-- shim for one release; a follow-up migration drops it once all read
-- sites are migrated.
--
-- rls posture mirrors event_products: members of the event's account can
-- view; managers write; admins delete; anon can read on published events
-- so the public register page can resolve installed apps.

create table public.event_apps_installed (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  app_slug text not null,
  config jsonb not null default '{}'::jsonb,
  ordering integer not null default 0,
  installed_at timestamptz not null default now(),
  unique (event_id, app_slug)
);

comment on table public.event_apps_installed is
  'Apps installed on an event. app_slug is a soft pointer into lib/event-apps/; config is per-app per-event settings (most apps store nothing here). Replaces the single events.event_type column as the source of truth for which behaviors / form sections apply to an event.';

create index event_apps_installed_event_id_idx
  on public.event_apps_installed (event_id);
create index event_apps_installed_app_slug_idx
  on public.event_apps_installed (app_slug);

alter table public.event_apps_installed enable row level security;

create policy "Members can view installed apps"
  on public.event_apps_installed for select
  to authenticated
  using (
    event_id in (
      select id from public.events
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Anon can view installed apps on published events"
  on public.event_apps_installed for select
  to anon
  using (
    event_id in (
      select id from public.events where is_published = true
    )
  );

create policy "Managers can insert installed apps"
  on public.event_apps_installed for insert
  to authenticated
  with check (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update installed apps"
  on public.event_apps_installed for update
  to authenticated
  using (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  )
  with check (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can delete installed apps"
  on public.event_apps_installed for delete
  to authenticated
  using (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

-- Backfill: one install row per existing event from its current event_type.
-- Guarantees every existing event (incl. Bulldog Basketball Camp '26) shows
-- up to the new code as having the equivalent app installed.
insert into public.event_apps_installed (event_id, app_slug, config, ordering)
select id, coalesce(nullif(event_type, ''), 'other'), '{}'::jsonb, 0
from public.events
where event_type is not null
on conflict (event_id, app_slug) do nothing;
