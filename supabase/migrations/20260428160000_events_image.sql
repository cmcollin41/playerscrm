-- Add image_url to events + create event-images storage bucket with RLS

-- ============================================================================
-- 1. Add image_url column
-- ============================================================================

alter table public.events
  add column if not exists image_url text;

-- ============================================================================
-- 2. Public bucket for event hero images
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 3. Storage RLS — path scheme is `{account_id}/{uuid}.{ext}`
-- ============================================================================

drop policy if exists "event_images_public_read" on storage.objects;
drop policy if exists "event_images_manager_insert" on storage.objects;
drop policy if exists "event_images_manager_update" on storage.objects;
drop policy if exists "event_images_manager_delete" on storage.objects;

create policy "event_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'event-images');

create policy "event_images_manager_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and has_account_role(split_part(name, '/', 1)::uuid, 'manager')
  );

create policy "event_images_manager_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-images'
    and has_account_role(split_part(name, '/', 1)::uuid, 'manager')
  )
  with check (
    bucket_id = 'event-images'
    and has_account_role(split_part(name, '/', 1)::uuid, 'manager')
  );

create policy "event_images_manager_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-images'
    and has_account_role(split_part(name, '/', 1)::uuid, 'manager')
  );
