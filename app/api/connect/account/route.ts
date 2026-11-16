import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { requireAccountAdminApi } from "@/lib/auth"

export async function POST() {
  const auth = await requireAccountAdminApi()
  if (!auth.ok) return auth.response

  const { data: account } = await auth.supabase
    .from("accounts")
    .select("stripe_id")
    .eq("id", auth.activeAccountId)
    .single()

  if (!account?.stripe_id) {
    return NextResponse.json(
      { error: "No Stripe account connected" },
      { status: 404 },
    )
  }

  try {
    const acct = await stripe.accounts.retrieve(account.stripe_id)

    return NextResponse.json({
      id: acct.id,
      type: acct.type,
      email: acct.email,
      payouts_enabled: acct.payouts_enabled,
      charges_enabled: acct.charges_enabled,
      details_submitted: acct.details_submitted,
      business_profile: {
        name: acct.business_profile?.name ?? null,
        url: acct.business_profile?.url ?? null,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Could not load Stripe account" },
      { status: 400 },
    )
  }
}
