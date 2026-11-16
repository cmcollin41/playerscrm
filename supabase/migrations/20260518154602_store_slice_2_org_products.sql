-- store slice 2: org_products
--
-- per-account instances of platform-curated product_templates. orgs pick a
-- template, set their sell price + customization (colors, logo, team name),
-- and publish. checkout/order tables live in slice 3.
--
-- rls:
--   - anon role can SELECT only rows where status='active' (powers the public
--     api in slice 5: GET /api/public/store/products?account_id=...).
--   - authenticated account members can SELECT any of their account's rows.
--   - authenticated account admins can INSERT/UPDATE/DELETE rows for their
--     account (uses the existing public.has_account_role helper).

create table public.org_products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  template_id uuid not null references public.product_templates(id) on delete restrict,
  slug text not null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  customization jsonb not null default '{}'::jsonb,
  image_url text,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, slug)
);

comment on table public.org_products is
  'Org-owned product instance cloned from a platform product_template. Customizations live in the customization jsonb. price_cents is the parent-facing sell price (must cover base_cost + min_markup; enforced in app code).';

create index org_products_account_id_status_idx
  on public.org_products (account_id, status);

create index org_products_template_id_idx
  on public.org_products (template_id);

create trigger trg_org_products_updated_at
  before update on public.org_products
  for each row execute function public.store_set_updated_at();

alter table public.org_products enable row level security;

-- public read of active rows for the public api / storefront widgets
create policy "Anon can view active org products"
  on public.org_products for select
  to anon
  using (status = 'active');

create policy "Authenticated can view active org products"
  on public.org_products for select
  to authenticated
  using (
    status = 'active'
    or public.has_account_role(account_id, 'member')
    or public.is_platform_admin()
  );

create policy "Account admins can insert org products"
  on public.org_products for insert
  to authenticated
  with check (public.has_account_role(account_id, 'admin'));

create policy "Account admins can update org products"
  on public.org_products for update
  to authenticated
  using (public.has_account_role(account_id, 'admin'))
  with check (public.has_account_role(account_id, 'admin'));

create policy "Account admins can delete org products"
  on public.org_products for delete
  to authenticated
  using (public.has_account_role(account_id, 'admin'));
