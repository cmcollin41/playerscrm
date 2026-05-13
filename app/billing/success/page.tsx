import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { redirect } from "next/navigation"
import { stripe } from "@/lib/stripe"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>
}

/**
 * Post-checkout landing. Reads the Stripe Checkout session, confirms the
 * subscription is real, and writes the canonical state onto the account
 * row synchronously so the user can step into the dashboard immediately
 * without waiting for the webhook (which is the backup path).
 */
export default async function BillingSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const sp = await searchParams
  const sessionId = sp.session_id

  if (!sessionId) {
    redirect("/billing")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let displayMessage = "Your subscription is active. Welcome aboard."
  let proceedHref = "/"

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })

    const accountId = session.client_reference_id
    const subscription = session.subscription
    const subscriptionId =
      typeof subscription === "string" ? subscription : subscription?.id

    if (
      accountId &&
      subscriptionId &&
      (session.payment_status === "paid" ||
        session.payment_status === "no_payment_required" ||
        session.status === "complete")
    ) {
      const subObject =
        typeof subscription === "string"
          ? await stripe.subscriptions.retrieve(subscription)
          : subscription
      const periodEndUnix = subObject?.current_period_end
      const periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null
      const status = subObject?.status ?? "active"
      const mappedStatus =
        status === "active" || status === "trialing"
          ? "active"
          : status === "past_due"
            ? "past_due"
            : status === "canceled"
              ? "cancelled"
              : "incomplete"

      const admin = createAdminClient()
      const { error: updateError } = await admin
        .from("accounts")
        .update({
          subscription_id: subscriptionId,
          subscription_status: mappedStatus,
          subscription_current_period_end: periodEnd,
        })
        .eq("id", accountId)

      if (updateError) {
        console.error("billing/success accounts update:", updateError.message)
      }

      proceedHref = "/"
    } else {
      displayMessage =
        "We're confirming your payment. It usually takes a few seconds — refresh this page if it doesn't update."
    }
  } catch (err: any) {
    console.error("billing/success error:", err?.message ?? err)
    displayMessage =
      "We couldn't confirm your subscription. Try refreshing or contact support."
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl ring-1 ring-black/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl text-gray-900">
          You&apos;re in.
        </h1>
        <p className="mt-2 text-sm text-gray-600">{displayMessage}</p>
        <Link href={proceedHref} className="mt-6 inline-block w-full">
          <Button
            size="lg"
            className="w-full bg-gray-900 font-semibold hover:bg-gray-800"
          >
            Go to your dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
