-- Step 4: Deprecate people.account_id
-- Make it nullable and add a comment. We keep writing it during transition
-- but the source of truth is now account_people.

alter table public.people
  alter column account_id drop not null;

comment on column public.people.account_id is
  'DEPRECATED: Use account_people join table instead. Kept for backward compatibility during transition.';
