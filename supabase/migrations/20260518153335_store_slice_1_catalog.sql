-- store slice 1: platform-curated catalog
--
-- introduces:
--   - public.is_platform_admin()      helper (mirrors existing profiles.role='admin' pattern)
--   - public.set_updated_at()         shared bumper for updated_at columns
--   - public.fulfillment_partners     platform-owned list of fulfillment vendors (prolook, truwear, ...)
--   - public.product_templates        platform-curated SKU templates that orgs clone-and-customize
--   - public.product_template_variants  size/color/SKU variants per template
--
-- rls model:
--   - all authenticated users can SELECT active partners/templates/variants
--     (orgs need to read them to clone into org_products in slice 2)
--   - only platform admins (profiles.role = 'admin') can INSERT/UPDATE/DELETE
--   - no anon access on any of these tables

-- ----------------------------------------------------------------------------
-- helpers
-- ----------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select p.role = 'admin'
    from public.profiles p
    where p.id = (select auth.uid())
  ), false);
$$;

create or replace function public.store_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- fulfillment_partners
-- ----------------------------------------------------------------------------

create table public.fulfillment_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  adapter_key text not null,
  contact_email text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fulfillment_partners is
  'Platform-owned list of fulfillment vendors (prolook, truwear, ...). adapter_key points to a module in lib/fulfillment/registry.';

create trigger trg_fulfillment_partners_updated_at
  before update on public.fulfillment_partners
  for each row execute function public.store_set_updated_at();

alter table public.fulfillment_partners enable row level security;

create policy "Authenticated can view active partners"
  on public.fulfillment_partners for select
  to authenticated
  using (is_active or public.is_platform_admin());

create policy "Platform admins can insert partners"
  on public.fulfillment_partners for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "Platform admins can update partners"
  on public.fulfillment_partners for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can delete partners"
  on public.fulfillment_partners for delete
  to authenticated
  using (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- product_templates
-- ----------------------------------------------------------------------------

create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.fulfillment_partners(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  category text not null check (category in ('uniform','apparel','accessory')),
  base_cost_cents integer not null check (base_cost_cents >= 0),
  min_markup_cents integer not null default 0 check (min_markup_cents >= 0),
  shipping_flat_cents integer not null default 0 check (shipping_flat_cents >= 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.product_templates is
  'Platform-curated catalog of SKU templates. Orgs clone into org_products and customize price/colors/logo (slice 2).';

create index product_templates_partner_id_idx
  on public.product_templates (partner_id, is_active);

create trigger trg_product_templates_updated_at
  before update on public.product_templates
  for each row execute function public.store_set_updated_at();

alter table public.product_templates enable row level security;

create policy "Authenticated can view active templates"
  on public.product_templates for select
  to authenticated
  using (is_active or public.is_platform_admin());

create policy "Platform admins can insert templates"
  on public.product_templates for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "Platform admins can update templates"
  on public.product_templates for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can delete templates"
  on public.product_templates for delete
  to authenticated
  using (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- product_template_variants
-- ----------------------------------------------------------------------------

create table public.product_template_variants (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.product_templates(id) on delete cascade,
  sku text not null,
  size text,
  color text,
  delta_cost_cents integer not null default 0,
  ordering integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, sku)
);

comment on table public.product_template_variants is
  'Size/color/SKU variants attached to a product_template. delta_cost_cents adjusts the partner cost vs. the template base.';

create index product_template_variants_template_id_idx
  on public.product_template_variants (template_id, ordering);

create trigger trg_product_template_variants_updated_at
  before update on public.product_template_variants
  for each row execute function public.store_set_updated_at();

alter table public.product_template_variants enable row level security;

create policy "Authenticated can view active variants"
  on public.product_template_variants for select
  to authenticated
  using (
    public.is_platform_admin()
    or (
      is_active
      and exists (
        select 1 from public.product_templates t
        where t.id = product_template_variants.template_id
          and t.is_active
      )
    )
  );

create policy "Platform admins can insert variants"
  on public.product_template_variants for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "Platform admins can update variants"
  on public.product_template_variants for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can delete variants"
  on public.product_template_variants for delete
  to authenticated
  using (public.is_platform_admin());
