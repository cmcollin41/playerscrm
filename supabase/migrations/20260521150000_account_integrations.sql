-- unified per-account integration state.
--
-- replaces account_partner_connections (for credentialed integrations like
-- Printify/Printful) and introduces simple enable/disable rows for code-only
-- integrations (event-type integrations + bundled-products). category and
-- placement live only in the code-side registry (lib/integrations/) — this
-- table just remembers which slugs an account has turned on, and stores
-- credentials + connection state for the ones that need them.

create table public.account_integrations (
  account_id uuid not null references public.accounts(id) on delete cascade,
  integration_slug text not null,
  is_enabled boolean not null default true,
  credentials_encrypted bytea,
  connection_state jsonb not null default '{}'::jsonb,
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, integration_slug)
);

comment on table public.account_integrations is
  'Per-account integration state. integration_slug is a soft pointer into lib/integrations/. credentials_encrypted is only set for integrations whose code-side entry has requiresCredentials=true (today: fulfillment partners). connection_state holds typed sidecar fields like external_shop_id / external_account_label / last_synced_at.';

create index account_integrations_slug_idx
  on public.account_integrations (integration_slug);

create or replace function public.touch_account_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger account_integrations_set_updated_at
  before update on public.account_integrations
  for each row execute function public.touch_account_integrations_updated_at();

alter table public.account_integrations enable row level security;

create policy "Members can view account integrations"
  on public.account_integrations for select
  to authenticated
  using (account_id in (select get_user_account_ids()));

create policy "Managers can insert account integrations"
  on public.account_integrations for insert
  to authenticated
  with check (has_account_role(account_id, 'manager'));

create policy "Managers can update account integrations"
  on public.account_integrations for update
  to authenticated
  using (has_account_role(account_id, 'manager'))
  with check (has_account_role(account_id, 'manager'));

create policy "Admins can delete account integrations"
  on public.account_integrations for delete
  to authenticated
  using (has_account_role(account_id, 'admin'));

-- Backfill from existing partner connections. Carries credentials over
-- verbatim and folds the typed sidecar columns into connection_state JSON.
insert into public.account_integrations (
  account_id, integration_slug, is_enabled,
  credentials_encrypted, connection_state, enabled_at
)
select
  c.account_id,
  fp.slug,
  c.is_active,
  c.credentials_encrypted,
  jsonb_strip_nulls(jsonb_build_object(
    'external_shop_id', c.external_shop_id,
    'external_account_label', c.external_account_label,
    'last_synced_at', c.last_synced_at,
    'auth_type', c.auth_type
  )),
  c.created_at
from public.account_partner_connections c
join public.fulfillment_partners fp on fp.id = c.partner_id
on conflict (account_id, integration_slug) do nothing;

-- Auto-enable the existing code-side event integrations for every account so
-- nothing disappears from the new-event picker the moment this lands. New
-- accounts created after this migration will get the same defaults from the
-- application-side onboarding.
insert into public.account_integrations (account_id, integration_slug, is_enabled)
select a.id, slug, true
from public.accounts a
cross join (
  values ('camp'), ('game'), ('practice'), ('tournament'), ('other'), ('products')
) as defaults(slug)
on conflict (account_id, integration_slug) do nothing;
