create policy "Public can view awards for public people"
  on public.person_awards for select
  using (
    exists (
      select 1 from public.people pe
      where pe.id = person_awards.person_id
      and pe.is_public = true
    )
  );
