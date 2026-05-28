import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { resolveStripeCustomer } from "@/lib/payments/customer"

/**
 * HTTP wrapper around resolveStripeCustomer. Used by client-side callers
 * (create-invoice-modal). Server-side callers should import the lib directly
 * to skip the auth roundtrip when they already have an authenticated context.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email : ""
    const accountId = typeof body.accountId === "string" ? body.accountId : ""
    const payerPersonId =
      typeof body.payerPersonId === "string" ? body.payerPersonId : undefined
    const athletePersonId =
      typeof body.athletePersonId === "string" ? body.athletePersonId : undefined

    if (!email.trim() || !accountId) {
      return NextResponse.json(
        { error: "email and accountId are required" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: allowed, error: rpcErr } = await supabase.rpc(
      "has_account_role",
      { p_account_id: accountId, p_min_role: "member" },
    )

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await resolveStripeCustomer({
      accountId,
      email,
      payerPersonId,
      athletePersonId,
      admin: createAdminClient(),
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ customerId: result.customerId })
  } catch (error: unknown) {
    console.error("Customer creation error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
