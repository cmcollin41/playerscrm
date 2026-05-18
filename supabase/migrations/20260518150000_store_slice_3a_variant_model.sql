-- store slice 3a: switch to shopify-style product/variant model.
--
-- shopify rule: "products are not sold; variants are." every checkout line
-- references a variant, not a product. this migration reshapes the schema:
--
--   product_templates           gains options (array of {name, values})
--                               and image_path.
--   product_template_variants   drops size/color denorm columns; adds
--                               options jsonb (canonical {name: value} map)
--                               and image_path. delta_cost_cents stays.
--   org_products                drops price_cents and image_url; adds
--                               image_path and options. an org_product is
--                               an umbrella with no price of its own.
--   org_product_variants (new)  the sellable unit. has its own price_cents,
--                               image_path, sku, options, inventory_qty.
--
-- nothing references org_products yet (0 rows; 2 template rows w/ 0 variants).
-- safe to drop columns cleanly.

-- ----------------------------------------------------------------------------
-- product_templates: image + options
-- ----------------------------------------------------------------------------
alter table public.product_templates
  add column options jsonb not null default '[]'::jsonb,
  add column image_path text;

comment on column public.product_templates.options is
  'Array of option definitions, e.g. [{"name":"Size","values":["YS","S","M","L"]}]. Variants are combinations of these option values.';

comment on column public.product_templates.image_path is
  'Path inside the store-images bucket. Use lib/storage/store-images getStoreImagePublicUrl() to render.';

-- ----------------------------------------------------------------------------
-- product_template_variants: options map + image
-- ----------------------------------------------------------------------------
alter table public.product_template_variants
  drop column size,
  drop column color,
  add column options jsonb not null default '{}'::jsonb,
  add column image_path text;

comment on column public.product_template_variants.options is
  'Map of option name to value, e.g. {"Size":"M","Color":"Red"}. Must reference values declared in the parent template options.';

-- ----------------------------------------------------------------------------
-- org_products: drop price/url; add image_path + options
-- ----------------------------------------------------------------------------
alter table public.org_products
  drop column price_cents,
  drop column image_url,
  add column image_path text,
  add column options jsonb not null default '[]'::jsonb;

comment on column public.org_products.options is
  'Array of option definitions the org is offering. Usually cloned from the parent template; orgs can restrict to a subset of template option values.';

-- ----------------------------------------------------------------------------
-- org_product_variants: the sellable unit
-- ----------------------------------------------------------------------------
create table public.org_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.org_products(id) on delete cascade,
  template_variant_id uuid references public.product_template_variants(id) on delete set null,
  sku text not null,
  options jsonb not null default '{}'::jsonb,
  price_cents integer not null check (price_cents >= 0),
  image_path text,
  inventory_qty integer check (inventory_qty is null or inventory_qty >= 0),
  is_active boolean not null default true,
  ordering integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);

comment on table public.org_product_variants is
  'Sellable unit. Every checkout line references one of these. price_cents is the parent-facing sell price for this option combination; image_path overrides the parent product image when set.';

create index org_product_variants_product_id_idx
  on public.org_product_variants (product_id, is_active, ordering);

create trigger trg_org_product_variants_updated_at
  before update on public.org_product_variants
  for each row execute function public.store_set_updated_at();

alter table public.org_product_variants enable row level security;

create policy "Anon can view active variants of active products"
  on public.org_product_variants for select
  to anon
  using (
    is_active
    and exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and p.status = 'active'
    )
  );

create policy "Authenticated can view org product variants"
  on public.org_product_variants for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and (
          (is_active and p.status = 'active')
          or public.has_account_role(p.account_id, 'member')
        )
    )
  );

create policy "Account admins can insert org product variants"
  on public.org_product_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and public.has_account_role(p.account_id, 'admin')
    )
  );

create policy "Account admins can update org product variants"
  on public.org_product_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and public.has_account_role(p.account_id, 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and public.has_account_role(p.account_id, 'admin')
    )
  );

create policy "Account admins can delete org product variants"
  on public.org_product_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.org_products p
      where p.id = org_product_variants.product_id
        and public.has_account_role(p.account_id, 'admin')
    )
  );
