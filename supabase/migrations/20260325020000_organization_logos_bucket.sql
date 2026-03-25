-- Public bucket for organization logos; uploads restricted to org admins (path prefix = organization id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organization_logos_public_read" on storage.objects;
drop policy if exists "organization_logos_org_admin_insert" on storage.objects;
drop policy if exists "organization_logos_org_admin_update" on storage.objects;
drop policy if exists "organization_logos_org_admin_delete" on storage.objects;

create policy "organization_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'organization-logos');

create policy "organization_logos_org_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = split_part(name, '/', 1)
        and om.profile_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  );

create policy "organization_logos_org_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = split_part(name, '/', 1)
        and om.profile_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = split_part(name, '/', 1)
        and om.profile_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  );

create policy "organization_logos_org_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id::text = split_part(name, '/', 1)
        and om.profile_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  );
