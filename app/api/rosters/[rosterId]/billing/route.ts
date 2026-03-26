import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

interface RouteParams {
  params: Promise<{ rosterId: string }>
}

/**
 * PATCH body: { fee_id, custom_amount, payment_status, payment_status_note }
 * Updates the roster's billing template (what to charge next) and optional
 * manual payment status override.
 * Does NOT touch invoice links — invoices are linked at creation time
 * via POST /api/invoices and stay linked permanently.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { rosterId } = await params
    const body = await req.json().catch(() => ({}))

    const fee_id =
      body.fee_id === null ||
      body.fee_id === undefined ||
      body.fee_id === "" ||
      body.fee_id === "none"
        ? null
        : String(body.fee_id)

    let custom_amount: number | null = null
    const rawCustom = body.custom_amount
    if (rawCustom !== null && rawCustom !== undefined && rawCustom !== "") {
      const n =
        typeof rawCustom === "number" ? rawCustom : Number.parseFloat(String(rawCustom))
      if (Number.isNaN(n) || n <= 0) {
        return NextResponse.json(
          { error: "Custom amount must be a positive number" },
          { status: 400 },
        )
      }
      custom_amount = n
    }

    const VALID_PAYMENT_STATUSES = ["paid", "waived"]
    const rawPaymentStatus = body.payment_status
    const payment_status =
      rawPaymentStatus && VALID_PAYMENT_STATUSES.includes(rawPaymentStatus)
        ? rawPaymentStatus
        : null
    const payment_status_note = payment_status
      ? (body.payment_status_note ?? null)
      : null

    const userSb = await createClient()
    const {
      data: { user },
    } = await userSb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: roster, error: rErr } = await admin
      .from("rosters")
      .select("id, person_id, team_id")
      .eq("id", rosterId)
      .single()

    if (rErr || !roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 })
    }

    const { data: team, error: tErr } = await admin
      .from("teams")
      .select("account_id")
      .eq("id", roster.team_id)
      .single()

    if (tErr || !team?.account_id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const { data: allowed, error: rpcErr } = await userSb.rpc("has_account_role", {
      p_account_id: team.account_id,
      p_min_role: "member",
    })

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (fee_id) {
      const { data: feeRow } = await admin
        .from("fees")
        .select("id")
        .eq("id", fee_id)
        .eq("account_id", team.account_id)
        .eq("is_active", true)
        .maybeSingle()

      if (!feeRow) {
        return NextResponse.json(
          { error: "Invalid or inactive fee for this account" },
          { status: 400 },
        )
      }
    }

    const rosterUpdate: Record<string, unknown> = {
      payment_status,
      payment_status_note,
    }
    if ("fee_id" in body) rosterUpdate.fee_id = fee_id
    if ("custom_amount" in body) rosterUpdate.custom_amount = custom_amount

    const { error: rosterErr } = await admin
      .from("rosters")
      .update(rosterUpdate)
      .eq("id", rosterId)

    if (rosterErr) {
      return NextResponse.json({ error: rosterErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
