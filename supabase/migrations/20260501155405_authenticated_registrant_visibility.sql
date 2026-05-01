-- Widen authenticated SELECT visibility for the public-facing registrant flow.
-- Until now RLS treated authenticated as synonymous with staff, which meant a
-- parent signed in to register their kid couldn't read the event row, the
-- account row, or their own registration. This adds three policies that
-- mirror the existing anon visibility for logged-in users, plus an own-
-- registrations policy keyed off registered_by and profiles.people_id.

-- Events
drop policy if exists "Authenticated can view published events" on public.events;

create policy "Authenticated can view published events"
  on public.events for select
  to authenticated
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

-- Accounts (anon already has using = true; mirror for authenticated)
drop policy if exists "Authenticated can view accounts" on public.accounts;

create policy "Authenticated can view accounts"
  on public.accounts for select
  to authenticated
  using (true);

-- Event registrations: users see ones they created, or that target their own
-- person record. Covers parent-registers-self, parent-registers-dependent
-- (via registered_by), and direct self-registration.
drop policy if exists "Users can view own registrations" on public.event_registrations;

create policy "Users can view own registrations"
  on public.event_registrations for select
  to authenticated
  using (
    registered_by = (select auth.uid())
    or person_id in (
      select people_id
      from public.profiles
      where id = (select auth.uid())
        and people_id is not null
    )
  );
