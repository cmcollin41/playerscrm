create table public.person_awards (
  id uuid not null default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  title text not null,
  year integer,
  created_at timestamp with time zone not null default now(),
  constraint person_awards_pkey primary key (id)
);

alter table public.person_awards enable row level security;

create policy "Users can view awards for their account people"
  on public.person_awards for select
  using (
    exists (
      select 1 from public.people pe
      join public.profiles p on p.account_id = pe.account_id
      where pe.id = person_awards.person_id
      and p.id = auth.uid()
    )
  );

create policy "Users can insert awards for their account people"
  on public.person_awards for insert
  with check (
    exists (
      select 1 from public.people pe
      join public.profiles p on p.account_id = pe.account_id
      where pe.id = person_awards.person_id
      and p.id = auth.uid()
    )
  );

create policy "Users can delete awards for their account people"
  on public.person_awards for delete
  using (
    exists (
      select 1 from public.people pe
      join public.profiles p on p.account_id = pe.account_id
      where pe.id = person_awards.person_id
      and p.id = auth.uid()
    )
  );
