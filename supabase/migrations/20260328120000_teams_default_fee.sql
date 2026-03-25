-- default catalog fee for new roster rows on this team (optional)
alter table public.teams
  add column if not exists fee_id uuid null;

alter table public.teams
  drop constraint if exists teams_fee_id_fkey;

alter table public.teams
  add constraint teams_fee_id_fkey
  foreign key (fee_id) references public.fees (id) on delete set null;

create index if not exists teams_fee_id_idx on public.teams using btree (fee_id);

comment on column public.teams.fee_id is
  'optional account fee used as default when adding players to this team roster';
