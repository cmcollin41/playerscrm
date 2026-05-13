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

export function getSubscriptionPriceId(): string {
  const id = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
  if (!id) {
    throw new Error(
      "STRIPE_SUBSCRIPTION_PRICE_ID is not set. Create a $99/year recurring price in Stripe and add its ID to .env.local.",
    )
  }
  return id
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
 * Create a Stripe Checkout session for the $99/year subscription. Returns
 * the redirect URL. Either customerId or customerEmail must be provided.
 */
export async function createSubscriptionCheckoutSession(
  accountId: string,
  opts: CheckoutSessionOptions,
): Promise<string> {
  const baseUrl = getBillingBaseUrl()
  const priceId = getSubscriptionPriceId()

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
      },
    },
    metadata: {
      account_id: accountId,
    },
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL")
  }

  return session.url
}
