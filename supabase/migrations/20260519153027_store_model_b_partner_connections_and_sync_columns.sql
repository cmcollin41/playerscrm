-- model b slice 2: per-account partner connections + reshape org products
--
-- adds account_partner_connections (per-account, per-partner credentials,
-- encrypted with AES-256-GCM on the application layer). reshapes
-- org_products/org_product_variants to be synced mirrors of partner products.
--
-- existing org_products data is pre-launch test data tied to the now-dropped
-- product_templates (slice 1). truncating cleanly is acceptable.

-- 1. clear stale pre-launch test data (cascade through child variants)
truncate table public.org_products, public.org_product_variants cascade;

-- 2. re-seed fulfillment_partners as integration registry
delete from public.fulfillment_partners;

insert into public.fulfillment_partners (slug, name, adapter_key, is_active, config) values
  ('printify', 'Printify',           'printify', true,
   '{"docs_url":"https://developers.printify.com/","token_setup_url":"https://printify.com/app/account/api","description":"Print on demand — wide variety of products"}'::jsonb),
  ('printful', 'Printful',           'printful', true,
   '{"docs_url":"https://developers.printful.com/docs/","token_setup_url":"https://www.printful.com/developers","description":"Print on demand — quality apparel"}'::jsonb),
  ('manual',   'Manual fulfillment', 'manual',   true,
   '{"description":"For partners without an API. Admin marks orders shipped from the dashboard."}'::jsonb);

-- 3. account_partner_connections
create table public.account_partner_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  partner_id uuid not null references public.fulfillment_partners(id) on delete restrict,
  credentials_encrypted bytea not null,
  external_shop_id text,
  external_account_label text,
  auth_type text not null default 'personal_token'
    check (auth_type in ('personal_token','oauth')),
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, partner_id)
);

comment on table public.account_partner_connections is
  'Per-account credentials for a fulfillment partner integration. credentials_encrypted holds an AES-256-GCM-encrypted JSON blob: { token, refresh_token?, expires_at?, webhook_secret? }.';

create index account_partner_connections_account_id_idx
  on public.account_partner_connections (account_id);

create trigger trg_account_partner_connections_updated_at
  before update on public.account_partner_connections
  for each row execute function public.store_set_updated_at();

alter table public.account_partner_connections enable row level security;

-- RLS: mirror org_products pattern. account members read; account admins write.
create policy "Account members can view own connections"
  on public.account_partner_connections for select
  to authenticated
  using (public.has_account_role(account_id, 'member') or public.is_platform_admin());

create policy "Account admins can insert own connections"
  on public.account_partner_connections for insert
  to authenticated
  with check (public.has_account_role(account_id, 'admin'));

create policy "Account admins can update own connections"
  on public.account_partner_connections for update
  to authenticated
  using (public.has_account_role(account_id, 'admin'))
  with check (public.has_account_role(account_id, 'admin'));

create policy "Account admins can delete own connections"
  on public.account_partner_connections for delete
  to authenticated
  using (public.has_account_role(account_id, 'admin'));

-- 4. reshape org_products: add partner sync columns
alter table public.org_products
  add column connection_id uuid not null references public.account_partner_connections(id) on delete cascade,
  add column external_product_id text not null,
  add column last_synced_at timestamptz,
  add column sync_status text not null default 'synced'
    check (sync_status in ('synced','stale','error','deleted'));

create unique index org_products_connection_external_product_idx
  on public.org_products (connection_id, external_product_id);

create index org_products_connection_id_idx
  on public.org_products (connection_id);

comment on column public.org_products.connection_id is
  'Which partner connection this product was synced from.';
comment on column public.org_products.external_product_id is
  'The partner-side product ID (Printify product_id, Printful sync_product_id, etc.).';

-- 5. reshape org_product_variants: add partner sync columns
alter table public.org_product_variants
  add column external_variant_id text not null,
  add column external_options jsonb not null default '{}'::jsonb,
  add column partner_cost_cents int;

create unique index org_product_variants_product_external_variant_idx
  on public.org_product_variants (product_id, external_variant_id);

comment on column public.org_product_variants.external_variant_id is
  'The partner-side variant ID (Printify variant_id, Printful sync_variant_id, etc.).';
comment on column public.org_product_variants.external_options is
  'Partner-defined option map for this variant, e.g. {"size":"M","color":"Red"}. Schemaless because partners differ.';
comment on column public.org_product_variants.partner_cost_cents is
  'Informational: what the partner charges the merchant for production. Surfaced in the dashboard for margin display; not used in checkout pricing (price_cents drives the buyer-facing price).';
comment on column public.org_product_variants.options is
  'Legacy: option name → value map for storefront buy panel. Will be removed in a later slice once external_options is the read path.';
