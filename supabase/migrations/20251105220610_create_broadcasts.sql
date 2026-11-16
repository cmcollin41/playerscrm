/*
  Migration: Create broadcasts and update lists/emails tables for Resend integration
  
  Purpose: 
  - Create broadcasts table for tracking newsletter campaigns
  - Add resend_segment_id to lists for Resend integration
  - Add broadcast_id to emails for linking broadcast emails
  - Enable RLS for secure access control
  
  Affected Tables: broadcasts (new), lists (altered), emails (altered)
*/

-- Create lists table if it doesn't exist
create table if not exists public.lists (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid null,
  name text not null,
  description text null,
  resend_segment_id text null,
  constraint lists_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade
);

comment on table public.lists is 'Lists (segments) for grouping people. Syncs with Resend segments for broadcasts.';

-- Create list_people join table if it doesn't exist
create table if not exists public.list_people (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  list_id uuid not null,
  person_id uuid not null,
  resend_contact_id text null,
  constraint list_people_list_id_fkey foreign key (list_id) references public.lists(id) on delete cascade,
  constraint list_people_person_id_fkey foreign key (person_id) references public.people(id) on delete cascade,
  constraint list_people_list_person_unique unique (list_id, person_id)
);

comment on table public.list_people is 'Join table connecting people to lists. Tracks Resend contact IDs for sync.';

-- Create broadcasts table
create table public.broadcasts (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid null,
  list_id uuid null,
  resend_broadcast_id text null,
  resend_segment_id text null,
  name text not null,
  subject text not null,
  content text not null,
  sender text not null,
  status text not null default 'draft',
  scheduled_at timestamp with time zone null,
  sent_at timestamp with time zone null,
  total_recipients integer null default 0,
  total_sent integer null default 0,
  total_delivered integer null default 0,
  total_opened integer null default 0,
  total_clicked integer null default 0,
  metadata jsonb null,
  constraint broadcasts_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint broadcasts_list_id_fkey foreign key (list_id) references public.lists(id) on delete set null,
  constraint broadcasts_status_check check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed'))
);

comment on table public.broadcasts is 'Newsletter broadcasts sent to lists/segments. Integrates with Resend broadcasts API.';

-- Add broadcast_id to emails table if not exists
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'emails' 
    and column_name = 'broadcast_id'
  ) then
    alter table public.emails add column broadcast_id uuid null;
    alter table public.emails add constraint emails_broadcast_id_fkey 
      foreign key (broadcast_id) references public.broadcasts(id) on delete set null;
  end if;
end $$;

-- Create indexes
create index if not exists lists_account_id_idx on public.lists using btree (account_id);
create index if not exists lists_resend_segment_id_idx on public.lists using btree (resend_segment_id);

create index if not exists list_people_list_id_idx on public.list_people using btree (list_id);
create index if not exists list_people_person_id_idx on public.list_people using btree (person_id);

create index if not exists broadcasts_account_id_idx on public.broadcasts using btree (account_id);
create index if not exists broadcasts_list_id_idx on public.broadcasts using btree (list_id);
create index if not exists broadcasts_status_idx on public.broadcasts using btree (status);
create index if not exists broadcasts_created_at_idx on public.broadcasts using btree (created_at desc);

create index if not exists emails_broadcast_id_idx on public.emails using btree (broadcast_id);

-- Enable Row Level Security on lists
alter table public.lists enable row level security;

create policy "Users can view lists from their account"
on public.lists
for select
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can insert lists for their account"
on public.lists
for insert
to authenticated
with check (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can update lists from their account"
on public.lists
for update
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
)
with check (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can delete lists from their account"
on public.lists
for delete
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

-- Enable Row Level Security on list_people
alter table public.list_people enable row level security;

create policy "Users can view list_people from their account"
on public.list_people
for select
to authenticated
using (
  list_id in (
    select id
    from public.lists
    where account_id in (
      select account_id
      from public.profiles
      where id = (select auth.uid())
    )
  )
);

create policy "Users can insert list_people for their account"
on public.list_people
for insert
to authenticated
with check (
  list_id in (
    select id
    from public.lists
    where account_id in (
      select account_id
      from public.profiles
      where id = (select auth.uid())
    )
  )
);

create policy "Users can delete list_people from their account"
on public.list_people
for delete
to authenticated
using (
  list_id in (
    select id
    from public.lists
    where account_id in (
      select account_id
      from public.profiles
      where id = (select auth.uid())
    )
  )
);

-- Enable Row Level Security on broadcasts
alter table public.broadcasts enable row level security;

create policy "Users can view broadcasts from their account"
on public.broadcasts
for select
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can insert broadcasts for their account"
on public.broadcasts
for insert
to authenticated
with check (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can update broadcasts from their account"
on public.broadcasts
for update
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
)
with check (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can delete broadcasts from their account"
on public.broadcasts
for delete
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

