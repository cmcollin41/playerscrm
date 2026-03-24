-- Step 3: Switch people + relationships RLS policies to use account_people
-- This makes cross-account people visible to all their associated accounts.

-- ============================================================================
-- 1. Drop old people policies (keep anon policy)
-- ============================================================================

drop policy if exists "Members can view people from their accounts" on public.people;
drop policy if exists "Managers can create people" on public.people;
drop policy if exists "Managers can update people" on public.people;
drop policy if exists "Admins can delete people" on public.people;

-- ============================================================================
-- 2. New people policies via account_people
-- ============================================================================

-- SELECT: person has a row in account_people for any of user's accounts
create policy "Members can view people from their accounts"
  on public.people for select
  to authenticated
  using (
    id in (
      select ap.person_id from account_people ap
      where ap.account_id in (select get_user_account_ids())
    )
  );

-- INSERT: still check people.account_id (needed during transition since we
-- still write account_id, and account_people row doesn't exist yet at insert time)
create policy "Managers can create people"
  on public.people for insert
  to authenticated
  with check (
    has_account_role(account_id, 'manager')
  );

-- UPDATE: person is in an account where user is manager+
create policy "Managers can update people"
  on public.people for update
  to authenticated
  using (
    id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'manager')
    )
  )
  with check (
    id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'manager')
    )
  );

-- DELETE: person is in an account where user is admin+
create policy "Admins can delete people"
  on public.people for delete
  to authenticated
  using (
    id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'admin')
    )
  );

-- ============================================================================
-- 3. Drop old relationships policies (keep anon policy)
-- ============================================================================

drop policy if exists "Members can view relationships" on public.relationships;
drop policy if exists "Managers can create relationships" on public.relationships;
drop policy if exists "Managers can update relationships" on public.relationships;
drop policy if exists "Managers can delete relationships" on public.relationships;

-- ============================================================================
-- 4. New relationships policies via account_people
-- ============================================================================

-- SELECT: either person_id or relation_id is in user's accounts
create policy "Members can view relationships"
  on public.relationships for select
  to authenticated
  using (
    person_id in (
      select ap.person_id from account_people ap
      where ap.account_id in (select get_user_account_ids())
    )
    or relation_id in (
      select ap.person_id from account_people ap
      where ap.account_id in (select get_user_account_ids())
    )
  );

-- INSERT: person_id is in user's accounts where user is manager+
create policy "Managers can create relationships"
  on public.relationships for insert
  to authenticated
  with check (
    person_id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'manager')
    )
  );

-- UPDATE: person_id is in user's accounts where user is manager+
create policy "Managers can update relationships"
  on public.relationships for update
  to authenticated
  using (
    person_id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'manager')
    )
  )
  with check (
    person_id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'manager')
    )
  );

-- DELETE: person_id is in user's accounts where user is admin+
create policy "Admins can delete relationships"
  on public.relationships for delete
  to authenticated
  using (
    person_id in (
      select ap.person_id from account_people ap
      where has_account_role(ap.account_id, 'admin')
    )
  );
