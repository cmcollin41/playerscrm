-- Set organizations.logo when a file already exists at {id}/logo but the column was never updated.

update public.organizations o
set logo = o.id::text || '/logo'
where (o.logo is null or trim(o.logo) = '')
  and exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'organization-logos'
      and so.name = o.id::text || '/logo'
  );
