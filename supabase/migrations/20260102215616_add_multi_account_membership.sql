/*
  Migration: Add Multi-Account Membership with Roles
*/

-- Create account_members table
create table if not exists public.account_members (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid not null,
  profile_id uuid not null,
  role text not null default 'member',
  invited_by uuid null,
  invited_at timestamp with time zone null,
  accepted_at timestamp with time zone null,
  
  constraint account_members_account_id_fkey 
    foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint account_members_profile_id_fkey 
    foreign key (profile_id) references public.profiles(id) on delete cascade,
  constraint account_members_invited_by_fkey 
    foreign key (invited_by) references public.profiles(id) on delete set null,
  constraint account_members_account_profile_unique 
    unique (account_id, profile_id),
  constraint account_members_role_check 
    check (role in ('owner', 'admin', 'manager', 'member'))
);

comment on table public.account_members is 'Join table linking users to accounts with role-based permissions.';

-- Create indexes
create index if not exists account_members_account_id_idx on public.account_members using btree (account_id);
create index if not exists account_members_profile_id_idx on public.account_members using btree (profile_id);
create index if not exists account_members_role_idx on public.account_members using btree (role);

-- Enable RLS
alter table public.account_members enable row level security;

-- RLS Policies for account_members
create policy "Users can view account memberships for their accounts"
on public.account_members for select to authenticated
using (account_id in (select am.account_id from public.account_members am where am.profile_id = (select auth.uid())));

create policy "Owners and admins can insert account members"
on public.account_members for insert to authenticated
with check (
  exists (select 1 from public.account_members am where am.account_id = account_members.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin'))
  or not exists (select 1 from public.account_members am where am.account_id = account_members.account_id)
);

create policy "Owners and admins can update account members"
on public.account_members for update to authenticated
using (exists (select 1 from public.account_members am where am.account_id = account_members.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin')))
with check (exists (select 1 from public.account_members am where am.account_id = account_members.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin')));

create policy "Owners can delete account members or self-removal"
on public.account_members for delete to authenticated
using (
  exists (select 1 from public.account_members am where am.account_id = account_members.account_id and am.profile_id = (select auth.uid()) and am.role = 'owner')
  or (profile_id = (select auth.uid()) and (role != 'owner' or (select count(*) from public.account_members where account_id = account_members.account_id and role = 'owner') > 1))
);

-- Add current_account_id to profiles
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_account_id') then
    alter table public.profiles add column current_account_id uuid null;
  end if;
  
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_id') then
    update public.profiles set current_account_id = account_id where current_account_id is null;
  end if;
end $$;

-- Migrate existing data to account_members
insert into public.account_members (account_id, profile_id, role, accepted_at)
select p.account_id, p.id, 'owner', p.created_at
from public.profiles p
where p.account_id is not null
  and not exists (select 1 from public.account_members am where am.account_id = p.account_id and am.profile_id = p.id);

-- Helper functions
create or replace function public.is_account_member(p_account_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.account_members where account_id = p_account_id and profile_id = (select auth.uid()));
$$;

create or replace function public.has_account_role(p_account_id uuid, p_min_role text)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.account_members 
    where account_id = p_account_id and profile_id = (select auth.uid())
      and case p_min_role
        when 'member' then role in ('member', 'manager', 'admin', 'owner')
        when 'manager' then role in ('manager', 'admin', 'owner')
        when 'admin' then role in ('admin', 'owner')
        when 'owner' then role = 'owner'
        else false
      end
  );
$$;

create or replace function public.get_account_role(p_account_id uuid)
returns text language sql security definer stable set search_path = '' as $$
  select role from public.account_members where account_id = p_account_id and profile_id = (select auth.uid()) limit 1;
$$;

create or replace function public.get_user_account_ids()
returns setof uuid language sql security definer stable set search_path = '' as $$
  select account_id from public.account_members where profile_id = (select auth.uid());
$$;

create or replace function public.get_current_account_id()
returns uuid language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select current_account_id from public.profiles where id = (select auth.uid())),
    (select account_id from public.account_members where profile_id = (select auth.uid()) limit 1)
  );
$$;

create or replace function public.switch_account(p_account_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.account_members where account_id = p_account_id and profile_id = (select auth.uid())) then
    raise exception 'User is not a member of this account';
  end if;
  update public.profiles set current_account_id = p_account_id where id = (select auth.uid());
  return true;
end;
$$;

-- Trigger for updated_at
create or replace function public.update_account_members_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists update_account_members_updated_at_trigger on public.account_members;
create trigger update_account_members_updated_at_trigger
before update on public.account_members for each row execute function public.update_account_members_updated_at();

-- Create account_invitations table
create table if not exists public.account_invitations (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid not null,
  email text not null,
  role text not null default 'member',
  invited_by uuid not null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamp with time zone not null default (timezone('utc'::text, now()) + interval '7 days'),
  accepted_at timestamp with time zone null,
  
  constraint account_invitations_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint account_invitations_invited_by_fkey foreign key (invited_by) references public.profiles(id) on delete cascade,
  constraint account_invitations_role_check check (role in ('owner', 'admin', 'manager', 'member')),
  constraint account_invitations_account_email_unique unique (account_id, email)
);

create index if not exists account_invitations_account_id_idx on public.account_invitations using btree (account_id);
create index if not exists account_invitations_email_idx on public.account_invitations using btree (email);
create index if not exists account_invitations_token_idx on public.account_invitations using btree (token);

alter table public.account_invitations enable row level security;

create policy "Admins can view account invitations"
on public.account_invitations for select to authenticated
using (exists (select 1 from public.account_members am where am.account_id = account_invitations.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin')));

create policy "Admins can create account invitations"
on public.account_invitations for insert to authenticated
with check (exists (select 1 from public.account_members am where am.account_id = account_invitations.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin')));

create policy "Admins can delete account invitations"
on public.account_invitations for delete to authenticated
using (exists (select 1 from public.account_members am where am.account_id = account_invitations.account_id and am.profile_id = (select auth.uid()) and am.role in ('owner', 'admin')));

-- Function to accept invitation
create or replace function public.accept_account_invitation(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_invitation record;
  v_user_id uuid;
  v_user_email text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then raise exception 'User must be authenticated'; end if;
  
  select email into v_user_email from auth.users where id = v_user_id;
  
  select * into v_invitation from public.account_invitations
  where token = p_token and email = v_user_email and accepted_at is null and expires_at > now();
  
  if v_invitation is null then raise exception 'Invalid or expired invitation'; end if;
  
  insert into public.account_members (account_id, profile_id, role, invited_by, invited_at, accepted_at)
  values (v_invitation.account_id, v_user_id, v_invitation.role, v_invitation.invited_by, v_invitation.created_at, now())
  on conflict (account_id, profile_id) do update set role = excluded.role, updated_at = now();
  
  update public.account_invitations set accepted_at = now() where id = v_invitation.id;
  update public.profiles set current_account_id = v_invitation.account_id where id = v_user_id and current_account_id is null;
  
  return jsonb_build_object('success', true, 'account_id', v_invitation.account_id, 'role', v_invitation.role);
end;
$$;
