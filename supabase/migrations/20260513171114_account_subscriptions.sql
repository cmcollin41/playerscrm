-- Per-account platform subscriptions (PR A of onboarding+billing).
--
-- Each account is billed independently for the $99/year platform fee. The
-- existing accounts.stripe_id is the *Connect* account a tenant uses to
-- collect payments from parents -- different role from the columns below,
-- which are the platform-side customer + subscription the tenant pays us
-- from.
--
-- subscription_status state machine:
--   none           -- no subscription created yet (default for new accounts)
--   incomplete     -- checkout started but not finished
--   active         -- currently paid + renewing
--   past_due       -- last invoice failed, retrying
--   cancelled      -- subscription ended / user cancelled
--   grandfathered  -- platform-issued free access (no Stripe involvement)

alter table public.accounts
  add column if not exists platform_stripe_customer_id text,
  add column if not exists subscription_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_current_period_end timestamptz;

alter table public.accounts
  add constraint accounts_subscription_status_valid
  check (
    subscription_status in (
      'none',
      'incomplete',
      'active',
      'past_due',
      'cancelled',
      'grandfathered'
    )
  );

create index if not exists idx_accounts_subscription_status
  on public.accounts(subscription_status);

create index if not exists idx_accounts_subscription_id
  on public.accounts(subscription_id);

-- Grandfather the three existing Provo High School accounts so they don't
-- bounce to the paywall when PR C lands. New accounts get
-- subscription_status='none' by the default above.
update public.accounts a
set subscription_status = 'grandfathered'
where a.organization_id = (
  select id from public.organizations where slug = 'provo-high'
)
and a.subscription_status = 'none';
