-- account_invitations becomes the record behind invite links. rows are
-- written and read only by server code using the service role:
--   * admins could read every token on their account, including one for an
--     owner invitation, and redeem it themselves
--   * admins could insert an owner invitation directly, bypassing the api
-- so the client-facing policies and grants are removed.

alter table public.account_invitations
  add column if not exists people_id uuid references public.people(id) on delete set null;

comment on column public.account_invitations.people_id is 'person record the new login should be linked to, when the invitation was sent from a person page';

drop policy if exists "Admins can view account invitations" on public.account_invitations;
drop policy if exists "Admins can create account invitations" on public.account_invitations;
drop policy if exists "Admins can delete account invitations" on public.account_invitations;

revoke all on table public.account_invitations from anon, authenticated;

comment on table public.account_invitations is 'single-use invitations to join an account; row level security is on with no policies, so only the service role reads or writes';
