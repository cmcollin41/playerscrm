/*
  Migration: Update RLS Policies for Multi-Account Membership
*/

-- TEAMS TABLE POLICIES
drop policy if exists "Users can view teams from their account" on public.teams;
drop policy if exists "Users can insert teams for their account" on public.teams;
drop policy if exists "Users can update teams from their account" on public.teams;
drop policy if exists "Users can delete teams from their account" on public.teams;

create policy "Members can view teams from their accounts" on public.teams for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Managers can create teams" on public.teams for insert to authenticated
with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update teams" on public.teams for update to authenticated
using (public.has_account_role(account_id, 'manager'))
with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete teams" on public.teams for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- PEOPLE TABLE POLICIES
drop policy if exists "Users can view people from their account" on public.people;
drop policy if exists "Users can insert people for their account" on public.people;
drop policy if exists "Users can update people from their account" on public.people;
drop policy if exists "Users can delete people from their account" on public.people;

create policy "Members can view people from their accounts" on public.people for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Managers can create people" on public.people for insert to authenticated
with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update people" on public.people for update to authenticated
using (public.has_account_role(account_id, 'manager'))
with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete people" on public.people for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- ROSTERS TABLE POLICIES
drop policy if exists "Users can view rosters from their account" on public.rosters;
drop policy if exists "Users can insert rosters for their account" on public.rosters;
drop policy if exists "Users can update rosters from their account" on public.rosters;
drop policy if exists "Users can delete rosters from their account" on public.rosters;

create policy "Members can view rosters" on public.rosters for select to authenticated
using (team_id in (select id from public.teams where account_id in (select public.get_user_account_ids())));

create policy "Managers can create rosters" on public.rosters for insert to authenticated
with check (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')));

create policy "Managers can update rosters" on public.rosters for update to authenticated
using (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')))
with check (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')));

create policy "Managers can delete rosters" on public.rosters for delete to authenticated
using (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')));

-- STAFF TABLE POLICIES
drop policy if exists "Users can view staff from their account" on public.staff;
drop policy if exists "Users can insert staff for their account" on public.staff;
drop policy if exists "Users can update staff from their account" on public.staff;
drop policy if exists "Users can delete staff from their account" on public.staff;

create policy "Members can view staff" on public.staff for select to authenticated
using (team_id in (select id from public.teams where account_id in (select public.get_user_account_ids())));

create policy "Managers can create staff" on public.staff for insert to authenticated
with check (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')));

create policy "Managers can update staff" on public.staff for update to authenticated
using (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')))
with check (team_id in (select id from public.teams where public.has_account_role(account_id, 'manager')));

create policy "Admins can delete staff" on public.staff for delete to authenticated
using (team_id in (select id from public.teams where public.has_account_role(account_id, 'admin')));

-- RELATIONSHIPS TABLE POLICIES
drop policy if exists "Users can view relationships from their account" on public.relationships;
drop policy if exists "Users can insert relationships for their account" on public.relationships;
drop policy if exists "Users can update relationships from their account" on public.relationships;
drop policy if exists "Users can delete relationships from their account" on public.relationships;

create policy "Members can view relationships" on public.relationships for select to authenticated
using (person_id in (select id from public.people where account_id in (select public.get_user_account_ids())));

create policy "Managers can create relationships" on public.relationships for insert to authenticated
with check (person_id in (select id from public.people where public.has_account_role(account_id, 'manager')));

create policy "Managers can update relationships" on public.relationships for update to authenticated
using (person_id in (select id from public.people where public.has_account_role(account_id, 'manager')))
with check (person_id in (select id from public.people where public.has_account_role(account_id, 'manager')));

create policy "Managers can delete relationships" on public.relationships for delete to authenticated
using (person_id in (select id from public.people where public.has_account_role(account_id, 'manager')));

-- LISTS TABLE POLICIES
drop policy if exists "Users can view lists from their account" on public.lists;
drop policy if exists "Users can insert lists for their account" on public.lists;
drop policy if exists "Users can update lists from their account" on public.lists;
drop policy if exists "Users can delete lists from their account" on public.lists;

create policy "Members can view lists" on public.lists for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Managers can create lists" on public.lists for insert to authenticated
with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update lists" on public.lists for update to authenticated
using (public.has_account_role(account_id, 'manager'))
with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete lists" on public.lists for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- LIST_PEOPLE TABLE POLICIES
drop policy if exists "Users can view list_people from their account" on public.list_people;
drop policy if exists "Users can insert list_people for their account" on public.list_people;
drop policy if exists "Users can delete list_people from their account" on public.list_people;

create policy "Members can view list_people" on public.list_people for select to authenticated
using (list_id in (select id from public.lists where account_id in (select public.get_user_account_ids())));

create policy "Managers can create list_people" on public.list_people for insert to authenticated
with check (list_id in (select id from public.lists where public.has_account_role(account_id, 'manager')));

create policy "Managers can delete list_people" on public.list_people for delete to authenticated
using (list_id in (select id from public.lists where public.has_account_role(account_id, 'manager')));

-- EMAILS TABLE POLICIES
drop policy if exists "Users can view emails from their account" on public.emails;
drop policy if exists "Users can insert emails for their account" on public.emails;
drop policy if exists "Users can update emails from their account" on public.emails;
drop policy if exists "Users can delete emails from their account" on public.emails;

create policy "Members can view emails" on public.emails for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Managers can create emails" on public.emails for insert to authenticated
with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update emails" on public.emails for update to authenticated
using (public.has_account_role(account_id, 'manager'))
with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete emails" on public.emails for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- BROADCASTS TABLE POLICIES
drop policy if exists "Users can view broadcasts from their account" on public.broadcasts;
drop policy if exists "Users can insert broadcasts for their account" on public.broadcasts;
drop policy if exists "Users can update broadcasts from their account" on public.broadcasts;
drop policy if exists "Users can delete broadcasts from their account" on public.broadcasts;

create policy "Members can view broadcasts" on public.broadcasts for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Managers can create broadcasts" on public.broadcasts for insert to authenticated
with check (public.has_account_role(account_id, 'manager'));

create policy "Managers can update broadcasts" on public.broadcasts for update to authenticated
using (public.has_account_role(account_id, 'manager'))
with check (public.has_account_role(account_id, 'manager'));

create policy "Admins can delete broadcasts" on public.broadcasts for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- SENDERS TABLE POLICIES
drop policy if exists "Users can view senders from their account" on public.senders;
drop policy if exists "Users can insert senders for their account" on public.senders;
drop policy if exists "Users can update senders from their account" on public.senders;
drop policy if exists "Users can delete senders from their account" on public.senders;

create policy "Members can view senders" on public.senders for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Admins can create senders" on public.senders for insert to authenticated
with check (public.has_account_role(account_id, 'admin'));

create policy "Admins can update senders" on public.senders for update to authenticated
using (public.has_account_role(account_id, 'admin'))
with check (public.has_account_role(account_id, 'admin'));

create policy "Admins can delete senders" on public.senders for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- SENDER_DOMAINS TABLE POLICIES
drop policy if exists "Users can view sender domains from their account" on public.sender_domains;
drop policy if exists "Users can insert sender domains for their account" on public.sender_domains;
drop policy if exists "Users can update sender domains from their account" on public.sender_domains;
drop policy if exists "Users can delete sender domains from their account" on public.sender_domains;

create policy "Members can view sender_domains" on public.sender_domains for select to authenticated
using (account_id in (select public.get_user_account_ids()));

create policy "Admins can create sender_domains" on public.sender_domains for insert to authenticated
with check (public.has_account_role(account_id, 'admin'));

create policy "Admins can update sender_domains" on public.sender_domains for update to authenticated
using (public.has_account_role(account_id, 'admin'))
with check (public.has_account_role(account_id, 'admin'));

create policy "Admins can delete sender_domains" on public.sender_domains for delete to authenticated
using (public.has_account_role(account_id, 'admin'));

-- ACCOUNTS TABLE POLICIES
drop policy if exists "Users can view their accounts" on public.accounts;
drop policy if exists "Users can update their accounts" on public.accounts;

create policy "Members can view their accounts" on public.accounts for select to authenticated
using (id in (select public.get_user_account_ids()));

create policy "Admins can update accounts" on public.accounts for update to authenticated
using (public.has_account_role(id, 'admin'))
with check (public.has_account_role(id, 'admin'));

create policy "Owners can delete accounts" on public.accounts for delete to authenticated
using (public.has_account_role(id, 'owner'));

create policy "Authenticated users can create accounts" on public.accounts for insert to authenticated
with check (true);

-- PROFILES TABLE POLICIES
drop policy if exists "Users can view their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;

create policy "Users can view own profile" on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users can update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
