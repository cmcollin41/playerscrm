-- event-bundled products: per-event product attachments and per-registrant
-- variant selections.
--
-- adds two tables and a handful of columns so events (camps, clinics, etc.)
-- can bundle products (e.g. a camp t-shirt) into registration. each
-- registrant picks a variant (size) during signup. products may be required
-- (included at $0 or with a per-registrant upcharge) or optional add-ons.
-- delivery is configured per event: pickup at the event vs shipped to each
-- registrant.
--
-- fulfillment still flows through the existing store_orders pipeline. on
-- payment_intent.succeeded the stripe webhook creates a store_order linked
-- back to the event (new store_orders.event_id) with one store_order_item per
-- event_registration_item (new store_order_items.event_registration_id).
-- existing partner-grouping logic then pushes to printify/printful as usual.
--
-- rls posture:
--   - event_products: mirrors public.events (members can view; managers
--     write; admins delete). anon can view rows on published events so the
--     public registration page can render the pickers without login.
--   - event_registration_items: mirrors public.event_registrations (members
--     view; authenticated can insert when event is published; managers
--     update; admins delete). server-side service-role writes work
--     regardless (rls bypass).

-- ============================================================================
-- 1. extend events with delivery mode
-- ============================================================================
alter table public.events
  add column product_delivery_mode text
    check (product_delivery_mode in ('pickup_at_event','shipped_to_registrant'));

comment on column public.events.product_delivery_mode is
  'How bundled products are delivered to registrants. NULL when the event has no products attached.';

-- ============================================================================
-- 2. event_products — per-event product configuration
-- ============================================================================
create table public.event_products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  product_id uuid not null references public.org_products(id) on delete restrict,
  is_required boolean not null default false,
  price_cents bigint not null default 0 check (price_cents >= 0),
  description_override text,
  ordering integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, product_id)
);

comment on table public.event_products is
  'Products bundled into an event. is_required = every registrant must pick a variant (e.g. camp t-shirt). price_cents is the per-registrant upcharge: 0 means comp (cost is baked into events.fee_amount), >0 adds a Stripe line item per registrant.';

create index event_products_event_id_idx
  on public.event_products (event_id);
create index event_products_product_id_idx
  on public.event_products (product_id);

create trigger trg_event_products_updated_at
  before update on public.event_products
  for each row execute function public.store_set_updated_at();

alter table public.event_products enable row level security;

create policy "Members can view event products"
  on public.event_products for select
  to authenticated
  using (
    event_id in (
      select id from public.events
      where account_id in (select get_user_account_ids())
    )
  );

create policy "Anon can view event products on published events"
  on public.event_products for select
  to anon
  using (
    event_id in (
      select id from public.events where is_published = true
    )
  );

create policy "Managers can insert event products"
  on public.event_products for insert
  to authenticated
  with check (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can update event products"
  on public.event_products for update
  to authenticated
  using (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  )
  with check (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

create policy "Managers can delete event products"
  on public.event_products for delete
  to authenticated
  using (
    event_id in (
      select id from public.events where has_account_role(account_id, 'manager')
    )
  );

-- ============================================================================
-- 3. event_registration_items — per-registrant variant snapshot
-- ============================================================================
create table public.event_registration_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  event_product_id uuid not null references public.event_products(id) on delete restrict,
  variant_id uuid not null references public.org_product_variants(id) on delete restrict,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  options_snapshot jsonb not null default '{}'::jsonb,
  product_name_snapshot text,
  variant_sku_snapshot text,
  image_url_snapshot text,
  shipping_address jsonb,
  store_order_item_id uuid references public.store_order_items(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.event_registration_items is
  'Per-registrant variant pick for a bundled event product. unit_price_cents is snapshotted from event_products.price_cents at registration time. shipping_address is set only when events.product_delivery_mode = shipped_to_registrant. store_order_item_id is backfilled by the Stripe webhook after the store_order is created.';

create index event_registration_items_registration_id_idx
  on public.event_registration_items (registration_id);
create index event_registration_items_event_product_id_idx
  on public.event_registration_items (event_product_id);
create index event_registration_items_variant_id_idx
  on public.event_registration_items (variant_id);
create index event_registration_items_store_order_item_id_idx
  on public.event_registration_items (store_order_item_id)
  where store_order_item_id is not null;

alter table public.event_registration_items enable row level security;

create policy "Members can view event registration items"
  on public.event_registration_items for select
  to authenticated
  using (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where e.account_id in (select get_user_account_ids())
    )
  );

create policy "Users can create event registration items"
  on public.event_registration_items for insert
  to authenticated
  with check (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where e.is_published = true
         or has_account_role(e.account_id, 'manager')
    )
  );

create policy "Managers can update event registration items"
  on public.event_registration_items for update
  to authenticated
  using (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where has_account_role(e.account_id, 'manager')
    )
  )
  with check (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where has_account_role(e.account_id, 'manager')
    )
  );

create policy "Admins can delete event registration items"
  on public.event_registration_items for delete
  to authenticated
  using (
    registration_id in (
      select er.id from public.event_registrations er
      join public.events e on e.id = er.event_id
      where has_account_role(e.account_id, 'admin')
    )
  );

-- ============================================================================
-- 4. store_orders + store_order_items backlinks to events
-- ============================================================================
alter table public.store_orders
  add column event_id uuid references public.events(id) on delete set null;

create index store_orders_event_id_idx
  on public.store_orders (event_id)
  where event_id is not null;

comment on column public.store_orders.event_id is
  'When the order originated from an event registration (not a direct storefront purchase), points to the originating event. NULL for regular storefront orders.';

alter table public.store_order_items
  add column event_registration_id uuid references public.event_registrations(id) on delete set null;

create index store_order_items_event_registration_id_idx
  on public.store_order_items (event_registration_id)
  where event_registration_id is not null;

comment on column public.store_order_items.event_registration_id is
  'When the item is for a specific event registrant (set during the event-registration webhook), points to that registration. Used for per-registrant shipping in shipped_to_registrant mode and for refund-driven cancellation.';
