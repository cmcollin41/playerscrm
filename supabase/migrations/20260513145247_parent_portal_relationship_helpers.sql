-- Parent portal: data-model foundation.
--
-- The existing public.relationships table already models guardian <-> dependent
-- links: person_id is the guardian, relation_id is the dependent, name is a
-- human label ("Parent"), primary flags the household's lead contact.
--
-- This migration:
--   1. Cleans up one duplicate (person_id, relation_id) pair and prevents future
--      duplicates / self-loops.
--   2. Adds btree indexes used by the helper functions below.
--   3. Adds SECURITY DEFINER helpers the parent-portal RLS policies (next
--      migration) call:
--        - current_user_person_id()             : profiles.people_id for auth.uid()
--        - current_user_accessible_person_ids() : self + every people row linked
--                                                 to it via relationships in
--                                                 either direction
--        - current_user_can_access_person(uuid) : boolean convenience
--
-- Helpers are STABLE SECURITY DEFINER with search_path = '' (matches the
-- project's existing has_account_role / get_user_account_ids pattern). They
-- return data the calling profile is logically entitled to see; downstream RLS
-- uses them to gate row access.

-- ============================================================================
-- 1. Dedupe + integrity constraints on public.relationships
-- ============================================================================

-- Drop the single observed duplicate before adding the unique index.
with ranked as (
  select id,
         row_number() over (
           partition by person_id, relation_id
           order by "primary" desc nulls last, created_at asc, id asc
         ) as rn
  from public.relationships
)
delete from public.relationships
where id in (select id from ranked where rn > 1);

create unique index if not exists ux_relationships_pair
  on public.relationships(person_id, relation_id);

alter table public.relationships
  add constraint relationships_no_self_loop
  check (person_id <> relation_id) not valid;

alter table public.relationships
  validate constraint relationships_no_self_loop;

-- Indexes for the helper functions and parent-portal joins.
create index if not exists idx_relationships_person_id
  on public.relationships(person_id);

create index if not exists idx_relationships_relation_id
  on public.relationships(relation_id);

-- ============================================================================
-- 2. Helper: current_user_person_id()
--    Returns profiles.people_id for the authenticated user, or null when the
--    profile has no people row bound (admins, unbound users).
-- ============================================================================

create or replace function public.current_user_person_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select p.people_id
  from public.profiles p
  where p.id = (select auth.uid())
$$;

-- ============================================================================
-- 3. Helper: current_user_accessible_person_ids()
--    SETOF uuid the calling profile is entitled to see in the parent portal:
--      - their own people row (profiles.people_id)
--      - dependents linked to them as guardian
--          (relationships where person_id = self -> relation_id is dependent)
--      - guardians linked to them as dependent
--          (relationships where relation_id = self -> person_id is guardian)
--    The bidirectional union covers both "parent viewing kids" and "player
--    viewing parents" without picking a side.
-- ============================================================================

create or replace function public.current_user_accessible_person_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  with self as (
    select public.current_user_person_id() as id
  )
  select id from self where id is not null
  union
  select r.relation_id
  from public.relationships r, self
  where r.person_id = self.id and self.id is not null
  union
  select r.person_id
  from public.relationships r, self
  where r.relation_id = self.id and self.id is not null
$$;

-- ============================================================================
-- 4. Helper: current_user_can_access_person(uuid)
--    Boolean convenience for inline RLS checks. Avoids SETOF subqueries when
--    a policy just needs "yes/no for this single id".
-- ============================================================================

create or replace function public.current_user_can_access_person(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.current_user_accessible_person_ids() as ap(id)
    where ap.id = p_id
  )
$$;

-- ============================================================================
-- 5. Grants
-- ============================================================================

grant execute on function public.current_user_person_id()
  to authenticated;

grant execute on function public.current_user_accessible_person_ids()
  to authenticated;

grant execute on function public.current_user_can_access_person(uuid)
  to authenticated;
