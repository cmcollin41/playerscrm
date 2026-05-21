-- store model b slice 4a: orders + dispatches + items
--
-- buyer-facing orders for the public storefront. each order can route to
-- multiple fulfillment partners — items are grouped into
-- store_order_dispatches by account_partner_connections.connection_id. after
-- the stripe payment_intent succeeds, the webhook iterates dispatches and
-- calls the matching adapter's createOrder, persisting external_order_id.
--
-- rls posture:
--   - anon: no access. guest order pages resolve by public_token through a
--     server route using the service-role admin client.
--   - authenticated: account members + platform admin can read their account's
--     orders for the dashboard.
--   - all writes (checkout api, stripe webhook, partner webhooks) go through
--     the service-role admin client, which bypasses rls. matches existing
--     payments / event_registrations pattern.

-- ============================================================================
-- store_orders
-- ============================================================================
create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  buyer_profile_id uuid references public.profiles(id) on delete set null,
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  -- buyer + ship-to (snapshot; always required for receipt routing)
  buyer_email text not null,
  buyer_name text not null,
  buyer_phone text,
  shipping_address jsonb not null,

  -- money (cents). subtotal = sum of item lines; total = subtotal + shipping.
  currency text not null default 'usd',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),

  -- stripe (on the account's connected Stripe)
  stripe_payment_intent_id text,
  stripe_customer_id text,

  -- lifecycle
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled','refunded','failed')),
  paid_at timestamptz,
  cancelled_at timestamptz,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_orders is
  'Buyer-facing storefront order. One Stripe PaymentIntent per order, on the account''s connected Stripe (lib/stripe.ts + accounts.stripe_id) with an application_fee_amount computed via lib/fees.ts. Items are routed to fulfillment partners through store_order_dispatches.';
comment on column public.store_orders.public_token is
  'URL-safe token used by guest buyers to look up their order at /store/orders/[token]. Resolved server-side via the service-role admin client (anon has no select policy).';
comment on column public.store_orders.shipping_address is
  'Snapshot of ship-to: { name, address1, address2?, city, region?, postalCode, country, phone?, email? }. Mirrors lib/fulfillment/types.ShippingAddress.';

create unique index store_orders_stripe_payment_intent_id_idx
  on public.store_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index store_orders_account_id_created_at_idx
  on public.store_orders (account_id, created_at desc);

create index store_orders_buyer_profile_id_idx
  on public.store_orders (buyer_profile_id)
  where buyer_profile_id is not null;

create trigger trg_store_orders_updated_at
  before update on public.store_orders
  for each row execute function public.store_set_updated_at();

alter table public.store_orders enable row level security;

create policy "Account members can view own orders"
  on public.store_orders for select
  to authenticated
  using (
    public.has_account_role(account_id, 'member')
    or public.is_platform_admin()
  );

-- ============================================================================
-- store_order_dispatches
-- ============================================================================
create table public.store_order_dispatches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  connection_id uuid not null references public.account_partner_connections(id) on delete restrict,
  partner_slug text not null,
  external_order_id text,
  external_order_url text,
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  status text not null default 'queued'
    check (status in ('queued','sent','accepted','fulfilled','cancelled','failed')),
  tracking jsonb,
  error text,
  pushed_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, connection_id)
);

comment on table public.store_order_dispatches is
  'One row per fulfillment partner involved in an order. Created at checkout (status=queued); after payment_intent.succeeded the stripe webhook pushes to the partner via the adapter and stamps external_order_id + status=sent. Partner webhooks later flip status to accepted/fulfilled and write tracking.';

create index store_order_dispatches_order_id_idx
  on public.store_order_dispatches (order_id);
create index store_order_dispatches_connection_id_idx
  on public.store_order_dispatches (connection_id);
create index store_order_dispatches_external_order_id_idx
  on public.store_order_dispatches (connection_id, external_order_id)
  where external_order_id is not null;

create trigger trg_store_order_dispatches_updated_at
  before update on public.store_order_dispatches
  for each row execute function public.store_set_updated_at();

alter table public.store_order_dispatches enable row level security;

create policy "Account members can view own dispatches"
  on public.store_order_dispatches for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.store_orders o
      where o.id = store_order_dispatches.order_id
        and public.has_account_role(o.account_id, 'member')
    )
  );

-- ============================================================================
-- store_order_items
-- ============================================================================
create table public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  dispatch_id uuid not null references public.store_order_dispatches(id) on delete cascade,
  variant_id uuid not null references public.org_product_variants(id) on delete restrict,
  product_id uuid not null references public.org_products(id) on delete restrict,
  external_variant_id text not null,
  product_name text not null,
  variant_sku text not null,
  options_snapshot jsonb not null default '{}'::jsonb,
  image_url text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

comment on table public.store_order_items is
  'Line items on a store order. Each line is bound to exactly one dispatch (= one fulfillment partner). Snapshots product_name / variant_sku / options / image / unit_price so historical orders survive edits to org_products and org_product_variants.';

create index store_order_items_order_id_idx
  on public.store_order_items (order_id);
create index store_order_items_dispatch_id_idx
  on public.store_order_items (dispatch_id);

alter table public.store_order_items enable row level security;

create policy "Account members can view own order items"
  on public.store_order_items for select
  to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.store_orders o
      where o.id = store_order_items.order_id
        and public.has_account_role(o.account_id, 'member')
    )
  );
