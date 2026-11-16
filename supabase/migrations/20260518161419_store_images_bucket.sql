insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_images_public_read" on storage.objects;
drop policy if exists "store_images_platform_admin_write" on storage.objects;
drop policy if exists "store_images_platform_admin_update" on storage.objects;
drop policy if exists "store_images_platform_admin_delete" on storage.objects;
drop policy if exists "store_images_account_admin_write" on storage.objects;
drop policy if exists "store_images_account_admin_update" on storage.objects;
drop policy if exists "store_images_account_admin_delete" on storage.objects;

create policy "store_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'store-images');

create policy "store_images_platform_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-images'
    and (split_part(name, '/', 1) = 'templates' or split_part(name, '/', 1) = 'template-variants')
    and public.is_platform_admin()
  );

create policy "store_images_platform_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-images'
    and (split_part(name, '/', 1) = 'templates' or split_part(name, '/', 1) = 'template-variants')
    and public.is_platform_admin()
  )
  with check (
    bucket_id = 'store-images'
    and (split_part(name, '/', 1) = 'templates' or split_part(name, '/', 1) = 'template-variants')
    and public.is_platform_admin()
  );

create policy "store_images_platform_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-images'
    and (split_part(name, '/', 1) = 'templates' or split_part(name, '/', 1) = 'template-variants')
    and public.is_platform_admin()
  );

create policy "store_images_account_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-images'
    and split_part(name, '/', 1) in ('org-products', 'org-product-variants')
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );

create policy "store_images_account_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-images'
    and split_part(name, '/', 1) in ('org-products', 'org-product-variants')
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  )
  with check (
    bucket_id = 'store-images'
    and split_part(name, '/', 1) in ('org-products', 'org-product-variants')
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );

create policy "store_images_account_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-images'
    and split_part(name, '/', 1) in ('org-products', 'org-product-variants')
    and public.has_account_role(split_part(name, '/', 2)::uuid, 'admin')
  );
