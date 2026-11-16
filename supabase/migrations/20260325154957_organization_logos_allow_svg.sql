-- Allow SVG uploads for organization logos (vector marks preferred for crisp UI).

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]
where id = 'organization-logos';
