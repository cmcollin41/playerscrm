INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'headshots',
  'headshots',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "Public headshots read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'headshots');

CREATE POLICY "Authenticated users can upload headshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'headshots');

CREATE POLICY "Authenticated users can update headshots"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'headshots');

CREATE POLICY "Authenticated users can delete headshots"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'headshots');
