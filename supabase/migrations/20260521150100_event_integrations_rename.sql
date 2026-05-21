-- rename event_apps_installed → event_integrations to align with the unified
-- "integration" vocabulary (see account_integrations migration). Column
-- app_slug → integration_slug for the same reason. RLS policies follow the
-- table automatically; rename them for clarity. Indexes get renamed so
-- future ALTERs hit predictable names — for the unique constraint, the
-- backing-index rename also renames the constraint, so we don't issue a
-- separate ALTER TABLE RENAME CONSTRAINT for it.

alter table public.event_apps_installed rename to event_integrations;
alter table public.event_integrations rename column app_slug to integration_slug;

alter index public.event_apps_installed_pkey
  rename to event_integrations_pkey;
alter index public.event_apps_installed_event_id_app_slug_key
  rename to event_integrations_event_id_integration_slug_key;
alter index public.event_apps_installed_event_id_idx
  rename to event_integrations_event_id_idx;
alter index public.event_apps_installed_app_slug_idx
  rename to event_integrations_integration_slug_idx;

alter table public.event_integrations
  rename constraint event_apps_installed_event_id_fkey
  to event_integrations_event_id_fkey;

alter policy "Members can view installed apps"
  on public.event_integrations rename to "Members can view event integrations";
alter policy "Anon can view installed apps on published events"
  on public.event_integrations rename to "Anon can view event integrations on published events";
alter policy "Managers can insert installed apps"
  on public.event_integrations rename to "Managers can insert event integrations";
alter policy "Managers can update installed apps"
  on public.event_integrations rename to "Managers can update event integrations";
alter policy "Managers can delete installed apps"
  on public.event_integrations rename to "Managers can delete event integrations";

comment on table public.event_integrations is
  'Integrations installed on an event. integration_slug is a soft pointer into lib/integrations/. config is per-event integration settings (most store nothing here). Replaces the deprecated events.event_type column as the source of truth for which behaviors / form sections apply to an event.';

-- Denormalized pointer to the single type-picker integration this event was
-- created with (camp/game/practice/tournament/other/...). Replaces the
-- legacy events.event_type column. Kept nullable for the back-compat window
-- — a follow-up migration will set NOT NULL after every write site is on
-- the new code path.
alter table public.events
  add column event_primary_integration text;

update public.events
  set event_primary_integration = coalesce(nullif(event_type, ''), 'other');

comment on column public.events.event_primary_integration is
  'Slug of the type-picker integration this event was created with. Soft pointer into lib/integrations/. Replaces events.event_type (kept for one release for back-compat reads).';
