-- Backfill slugs for existing teams and people
-- Uses same logic as lib/slug.ts: lowercase, hyphens, alphanumeric

create or replace function public.slugify_text(t text)
returns text
language sql immutable
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(trim(coalesce(t, ''))),
        '[^\w\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;

-- Backfill teams
with base as (
  select
    id,
    account_id,
    coalesce(nullif(trim(name), ''), 'team') as name_val
  from public.teams
  where slug is null
),
slugged as (
  select
    id,
    account_id,
    name_val,
    case
      when slugify_text(name_val) = '' then 'team'
      else slugify_text(name_val)
    end as base_slug
  from base
),
ranked as (
  select
    s.id,
    s.base_slug,
    row_number() over (
      partition by s.account_id, s.base_slug
      order by s.id
    ) as rn
  from slugged s
),
final_slugs as (
  select
    id,
    case when rn > 1 then base_slug || '-' || (rn - 1) else base_slug end as slug
  from ranked
)
update public.teams t
set slug = f.slug
from final_slugs f
where t.id = f.id;

-- Backfill people
with base as (
  select
    id,
    account_id,
    coalesce(
      nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
      nullif(trim(name), ''),
      'person'
    ) as name_val
  from public.people
  where slug is null
),
slugged as (
  select
    id,
    account_id,
    name_val,
    case
      when slugify_text(name_val) = '' then 'person'
      else slugify_text(name_val)
    end as base_slug
  from base
),
ranked as (
  select
    s.id,
    s.base_slug,
    row_number() over (
      partition by s.account_id, s.base_slug
      order by s.id
    ) as rn
  from slugged s
),
final_slugs as (
  select
    id,
    case when rn > 1 then base_slug || '-' || (rn - 1) else base_slug end as slug
  from ranked
)
update public.people p
set slug = f.slug
from final_slugs f
where p.id = f.id;
