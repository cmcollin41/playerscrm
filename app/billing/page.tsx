import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { resolveActiveAccountId } from "@/lib/auth"
import {
  accountHasActiveSubscription,
  createSubscriptionCheckoutSession,
  getOrCreatePlatformCustomer,
  type SubscriptionPlan,
} from "@/lib/billing"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

/**
 * Paywall + subscription start page. Reached when:
 *  - a user finishes signup but bails out of checkout (PR B redirect target)
 *  - PR C bounces a user whose active account isn't subscribed
 *
 * Action buttons POST back to this page with a `?plan=` query, which
 * triggers a server action that creates a fresh Checkout session and
 * redirects to Stripe.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "account_id, current_account_id, first_name, accounts:current_account_id(id, name, subscription_status, subscription_current_period_end, platform_stripe_customer_id, subscription_id)",
    )
    .eq("id", user.id)
    .maybeSingle()

  const accountId = resolveActiveAccountId(profile)
  if (!accountId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl ring-1 ring-black/5">
          <p className="text-sm text-gray-600">
            We couldn&apos;t find an account on your profile. Sign out and back
            in, or contact support.
          </p>
        </div>
      </div>
    )
  }

  // pull the active account directly to bypass any RLS subtleties.
  const admin = createAdminClient()
  const { data: account } = await admin
    .from("accounts")
    .select(
      "id, name, subscription_status, subscription_current_period_end, platform_stripe_customer_id, subscription_id",
    )
    .eq("id", accountId)
    .maybeSingle()

  if (!account) {
    redirect("/login")
  }

  if (accountHasActiveSubscription(account)) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
          Subscription
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-gray-900">
          Start your subscription.
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{account.name}</span>{" "}
          needs an active subscription to use the dashboard. Pick a plan and
          we&apos;ll send you to Stripe Checkout.
        </p>

        {sp.error && (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {sp.error}
          </div>
        )}

        <form action={startCheckout} className="mt-6 space-y-3">
          <input type="hidden" name="account_id" value={account.id} />
          <input type="hidden" name="email" value={user.email ?? ""} />

          <SubmitPlanButton plan="annual">
            <span className="text-left">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Annual
              </span>
              <span className="font-display text-2xl text-gray-900">$99</span>
              <span className="ml-1 text-xs text-gray-500">/year</span>
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Save $21
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-gray-500" />
          </SubmitPlanButton>

          <SubmitPlanButton plan="monthly">
            <span className="text-left">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Monthly
              </span>
              <span className="font-display text-2xl text-gray-900">$10</span>
              <span className="ml-1 text-xs text-gray-500">/month</span>
            </span>
            <ArrowRight className="h-4 w-4 text-gray-500" />
          </SubmitPlanButton>
        </form>

        <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
          Status:{" "}
          <span className="font-medium text-gray-700">
            {account.subscription_status}
          </span>
          . Stripe processing fees (2.9% + $0.30) and the per-transaction
          Athletes App fee ($1 + 7%) apply separately to parent payments —
          this is just the platform subscription.
        </p>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs text-gray-500 hover:underline">
            Sign in as a different user
          </Link>
        </div>
      </div>
    </div>
  )
}

function SubmitPlanButton({
  plan,
  children,
}: {
  plan: SubscriptionPlan
  children: React.ReactNode
}) {
  return (
    <Button
      type="submit"
      name="plan"
      value={plan}
      variant="outline"
      className="flex h-auto w-full items-center justify-between gap-3 rounded-lg border-gray-200 bg-white px-4 py-3 hover:border-orange-500 hover:bg-orange-50/40"
    >
      {children}
    </Button>
  )
}

async function startCheckout(formData: FormData): Promise<void> {
  "use server"
  const accountId = String(formData.get("account_id") ?? "")
  const email = String(formData.get("email") ?? "")
  const rawPlan = String(formData.get("plan") ?? "annual")
  const plan: SubscriptionPlan = rawPlan === "monthly" ? "monthly" : "annual"

  if (!accountId) {
    redirect("/billing?error=missing+account")
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from("accounts")
    .select(
      "id, name, platform_stripe_customer_id, subscription_id, subscription_status, subscription_current_period_end",
    )
    .eq("id", accountId)
    .maybeSingle()

  if (!account) {
    redirect("/billing?error=account+not+found")
  }

  try {
    const customerId = await getOrCreatePlatformCustomer(admin, account, email)
    const checkoutUrl = await createSubscriptionCheckoutSession(account.id, {
      plan,
      customerId,
    })
    redirect(checkoutUrl)
  } catch (err: any) {
    // redirect() throws to break out of the function, so check for that.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err
    console.error("startCheckout:", err?.message ?? err)
    redirect(
      `/billing?error=${encodeURIComponent("Could not start checkout. Try again.")}`,
    )
  }
}
