/*
  Migration: Email System Improvements
  
  Purpose:
  - Add click tracking to emails
  - Add sender domain verification tracking
  - Create broadcast stat increment function
  - Add indexes for better performance
  - Add email type field for categorization
  
  Affected Tables: emails, broadcasts, sender_domains (new)
*/

-- Add click tracking to emails table
alter table public.emails add column if not exists clicked_at timestamp with time zone null;
alter table public.emails add column if not exists click_count integer not null default 0;

-- Add email type for better categorization
alter table public.emails add column if not exists email_type text not null default 'one-off';
alter table public.emails add column if not exists template_name text null;

-- Add batch_id for grouping batch sends
alter table public.emails add column if not exists batch_id text null;

comment on column public.emails.email_type is 'Type of email: one-off, batch, broadcast, transactional';
comment on column public.emails.batch_id is 'Resend batch ID for emails sent in batch';
comment on column public.emails.clicked_at is 'When the email was first clicked';
comment on column public.emails.click_count is 'Number of times links in the email were clicked';

-- Create sender_domains table for domain verification tracking
create table if not exists public.sender_domains (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  account_id uuid not null,
  domain text not null,
  verified_at timestamp with time zone null,
  verification_status text not null default 'pending',
  dns_records jsonb null,
  resend_domain_id text null,
  constraint sender_domains_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade,
  constraint sender_domains_account_domain_unique unique (account_id, domain),
  constraint sender_domains_verification_status_check check (verification_status in ('pending', 'verified', 'failed'))
);

comment on table public.sender_domains is 'Tracks sender domain verification status for email sending';

-- Create indexes for sender_domains
create index if not exists sender_domains_account_id_idx on public.sender_domains using btree (account_id);
create index if not exists sender_domains_verification_status_idx on public.sender_domains using btree (verification_status);

-- Add indexes for new email fields
create index if not exists emails_clicked_at_idx on public.emails using btree (clicked_at);
create index if not exists emails_email_type_idx on public.emails using btree (email_type);
create index if not exists emails_batch_id_idx on public.emails using btree (batch_id);

-- Enable Row Level Security on sender_domains
alter table public.sender_domains enable row level security;

create policy "Users can view sender domains from their account"
on public.sender_domains
for select
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can insert sender domains for their account"
on public.sender_domains
for insert
to authenticated
with check (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

create policy "Users can update sender domains from their account"
on public.sender_domains
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

create policy "Users can delete sender domains from their account"
on public.sender_domains
for delete
to authenticated
using (
  account_id in (
    select account_id
    from public.profiles
    where id = (select auth.uid())
  )
);

-- Create function to increment broadcast statistics
create or replace function increment_broadcast_stat(
  p_broadcast_id uuid,
  p_stat_name text
) returns void
language plpgsql
security definer
as $$
begin
  case p_stat_name
    when 'sent' then
      update public.broadcasts 
      set total_sent = total_sent + 1,
          updated_at = timezone('utc'::text, now())
      where id = p_broadcast_id;
    when 'delivered' then
      update public.broadcasts 
      set total_delivered = total_delivered + 1,
          updated_at = timezone('utc'::text, now())
      where id = p_broadcast_id;
    when 'opened' then
      update public.broadcasts 
      set total_opened = total_opened + 1,
          updated_at = timezone('utc'::text, now())
      where id = p_broadcast_id;
    when 'clicked' then
      update public.broadcasts 
      set total_clicked = total_clicked + 1,
          updated_at = timezone('utc'::text, now())
      where id = p_broadcast_id;
  end case;
end;
$$;

comment on function increment_broadcast_stat is 'Increments broadcast statistics counters atomically';

-- Create function to get email analytics
create or replace function get_email_analytics(
  p_account_id uuid,
  p_days integer default 30
) returns table (
  total_sent bigint,
  total_delivered bigint,
  total_opened bigint,
  total_clicked bigint,
  total_bounced bigint,
  total_complained bigint,
  delivery_rate numeric,
  open_rate numeric,
  click_rate numeric,
  bounce_rate numeric
)
language plpgsql
security definer
as $$
declare
  v_total_sent bigint;
  v_total_delivered bigint;
  v_total_opened bigint;
  v_total_clicked bigint;
  v_total_bounced bigint;
  v_total_complained bigint;
begin
  -- Get counts for the specified period
  select 
    count(*) filter (where status in ('sent', 'delivered', 'opened')) as sent,
    count(*) filter (where status = 'delivered' or status = 'opened') as delivered,
    count(*) filter (where opened_at is not null) as opened,
    count(*) filter (where clicked_at is not null) as clicked,
    count(*) filter (where status = 'bounced') as bounced,
    count(*) filter (where status = 'complained') as complained
  into 
    v_total_sent,
    v_total_delivered,
    v_total_opened,
    v_total_clicked,
    v_total_bounced,
    v_total_complained
  from public.emails
  where account_id = p_account_id
    and created_at >= timezone('utc'::text, now()) - (p_days || ' days')::interval;

  -- Calculate rates
  return query select
    v_total_sent,
    v_total_delivered,
    v_total_opened,
    v_total_clicked,
    v_total_bounced,
    v_total_complained,
    case when v_total_sent > 0 then round((v_total_delivered::numeric / v_total_sent::numeric) * 100, 2) else 0 end as delivery_rate,
    case when v_total_delivered > 0 then round((v_total_opened::numeric / v_total_delivered::numeric) * 100, 2) else 0 end as open_rate,
    case when v_total_delivered > 0 then round((v_total_clicked::numeric / v_total_delivered::numeric) * 100, 2) else 0 end as click_rate,
    case when v_total_sent > 0 then round((v_total_bounced::numeric / v_total_sent::numeric) * 100, 2) else 0 end as bounce_rate;
end;
$$;

comment on function get_email_analytics is 'Returns comprehensive email analytics for an account';

-- Add metadata column to senders table if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'senders' 
    and column_name = 'verified'
  ) then
    alter table public.senders add column verified boolean not null default false;
    alter table public.senders add column resend_domain_id text null;
  end if;
end $$;

comment on column public.senders.verified is 'Whether the sender email domain is verified with Resend';
comment on column public.senders.resend_domain_id is 'Resend domain ID for tracking verification';

