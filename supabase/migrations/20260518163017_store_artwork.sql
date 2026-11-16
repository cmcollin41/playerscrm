-- store: org_products.artwork_path + private store-artwork bucket.
--
-- separates the storefront mockup (org_products.image_path, public)
-- from the partner deliverable (org_products.artwork_path, private). the
-- partner only needs the artwork at fulfillment time; the storefront only
-- shows the mockup.

alter table public.org_products
  add column artwork_path text;

comment on column public.org_products.artwork_path is
  'Path inside the store-artwork private bucket. The design file (PNG/SVG/PDF) the fulfillment partner needs to print this product.';

-- ----------------------------------------------------------------------------
-- private bucket: store-artwork
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-artwork',
  'store-artwork',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_artwork_account_member_read" on storage.objects;
drop policy if exists "store_artwork_platform_admin_read" on storage.objects;
drop policy if exists "store_artwork_account_admin_write" on storage.objects;
drop policy if exists "store_artwork_account_admin_update" on storage.objects;
drop policy if exists "store_artwork_account_admin_delete" on storage.objects;

-- account members can read their account's artwork (preview in dashboard)
create policy "store_artwork_account_member_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'store-artwork'
    and split_part(name, '/', 1) = 'org-products'
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'member')
  );

-- platform admins can read everything (needed for partner handoff)
create policy "store_artwork_platform_admin_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'store-artwork'
    and public.is_platform_admin()
  );

-- account admins can upload / replace / remove their artwork
create policy "store_artwork_account_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-artwork'
    and split_part(name, '/', 1) = 'org-products'
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );

create policy "store_artwork_account_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-artwork'
    and split_part(name, '/', 1) = 'org-products'
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  )
  with check (
    bucket_id = 'store-artwork'
    and split_part(name, '/', 1) = 'org-products'
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );

create policy "store_artwork_account_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-artwork'
    and split_part(name, '/', 1) = 'org-products'
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );
