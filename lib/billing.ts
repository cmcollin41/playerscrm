import type { SupabaseClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"

/**
 * Per-account platform billing. Each public.accounts row has its own
 * platform-side Stripe customer (different from accounts.stripe_id, which
 * is the Connect account a tenant uses to collect from parents) and its
 * own subscription to the $99/year Athletes App plan.
 */

export type SubscriptionStatus =
  | "none"
  | "incomplete"
  | "active"
  | "past_due"
  | "cancelled"
  | "grandfathered"

export interface AccountBillingState {
  id: string
  name: string | null
  platform_stripe_customer_id: string | null
  subscription_id: string | null
  subscription_status: SubscriptionStatus
  subscription_current_period_end: string | null
}

/**
 * Statuses that grant the account full access to the dashboard. Anything
 * outside this set lands the active account in the paywall.
 */
const ACCESS_GRANTING_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "grandfathered",
])

export function accountHasActiveSubscription(
  account:
    | Pick<AccountBillingState, "subscription_status">
    | { subscription_status?: string | null }
    | null
    | undefined,
): boolean {
  const status = account?.subscription_status as
    | SubscriptionStatus
    | undefined
  if (!status) return false
  return ACCESS_GRANTING_STATUSES.has(status)
}

/**
 * Stripe price lookup_keys. Storing keys rather than raw price IDs lets us
 * swap prices in Stripe (e.g. a price hike) without a deploy — just point
 * the lookup_key at a new active price.
 */
export const PRICE_LOOKUP_KEYS = {
  annual: "athletes_app_annual_v1",
  monthly: "athletes_app_monthly_v1",
} as const

export type SubscriptionPlan = keyof typeof PRICE_LOOKUP_KEYS

/**
 * Resolve a plan slug to a live Stripe price ID via lookup_key. The lookup
 * is fast (~one Stripe API call) and is only called at checkout creation,
 * so the latency is irrelevant in practice.
 */
export async function resolvePriceId(plan: SubscriptionPlan): Promise<string> {
  const lookupKey = PRICE_LOOKUP_KEYS[plan]
  const result = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  const price = result.data[0]
  if (!price) {
    throw new Error(
      `No active Stripe price found for lookup_key "${lookupKey}". Create the price in Stripe with this lookup_key, or update PRICE_LOOKUP_KEYS in lib/billing.ts.`,
    )
  }
  return price.id
}

function getBillingBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (explicit) return explicit
  return process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"
}

/**
 * Resolve the Stripe customer for this account, creating one if it doesn't
 * exist yet. Caller must pass an *admin* Supabase client when running from
 * unauthenticated paths (signup); a normal authed client works elsewhere.
 */
export async function getOrCreatePlatformCustomer(
  admin: SupabaseClient,
  account: AccountBillingState,
  ownerEmail: string,
): Promise<string> {
  if (account.platform_stripe_customer_id) {
    return account.platform_stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: account.name ?? undefined,
    metadata: {
      account_id: account.id,
      account_name: account.name ?? "",
    },
  })

  const { error } = await admin
    .from("accounts")
    .update({ platform_stripe_customer_id: customer.id })
    .eq("id", account.id)

  if (error) {
    console.error(
      "getOrCreatePlatformCustomer update accounts:",
      error.message,
    )
  }

  return customer.id
}

interface CheckoutSessionOptions {
  /** annual ($99/yr) or monthly ($10/mo). Defaults to annual. */
  plan?: SubscriptionPlan
  /** Where Stripe sends the user after success. */
  successPath?: string
  /** Where Stripe sends the user after cancel. */
  cancelPath?: string
  /** Pre-fill customer email when no Stripe customer exists yet. */
  customerEmail?: string
  /** Existing Stripe customer to attach the subscription to. */
  customerId?: string
}

/**
 * Create a Stripe Checkout session for the Athletes App subscription.
 * Returns the redirect URL. Either customerId or customerEmail must be
 * provided.
 */
export async function createSubscriptionCheckoutSession(
  accountId: string,
  opts: CheckoutSessionOptions,
): Promise<string> {
  const baseUrl = getBillingBaseUrl()
  const plan = opts.plan ?? "annual"
  const priceId = await resolvePriceId(plan)

  const successUrl = `${baseUrl}${opts.successPath ?? "/billing/success"}?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${baseUrl}${opts.cancelPath ?? "/billing"}`

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: opts.customerId,
    customer_email: opts.customerId ? undefined : opts.customerEmail,
    client_reference_id: accountId,
    subscription_data: {
      metadata: {
        account_id: accountId,
        plan,
      },
    },
    metadata: {
      account_id: accountId,
      plan,
    },
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL")
  }

  return session.url
}
