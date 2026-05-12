import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH body: { payment_status: 'paid' | 'waived' | null, payment_status_note?: string | null }
 * Manual override for registrations settled outside of Stripe checkout.
 * Mirrors /api/rosters/[rosterId]/billing.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const VALID = ["paid", "waived"]
    const raw = body.payment_status
    const payment_status =
      raw === null || raw === undefined || raw === ""
        ? null
        : VALID.includes(raw)
          ? raw
          : undefined

    if (payment_status === undefined) {
      return NextResponse.json(
        { error: "payment_status must be 'paid', 'waived', or null" },
        { status: 400 },
      )
    }

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

    const { data: reg, error: rErr } = await admin
      .from("event_registrations")
      .select("id, event_id")
      .eq("id", id)
      .single()

    if (rErr || !reg) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const { data: event, error: eErr } = await admin
      .from("events")
      .select("account_id")
      .eq("id", reg.event_id)
      .single()

    if (eErr || !event?.account_id) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const { data: allowed, error: rpcErr } = await userSb.rpc("has_account_role", {
      p_account_id: event.account_id,
      p_min_role: "member",
    })

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: updateErr } = await admin
      .from("event_registrations")
      .update({ payment_status, payment_status_note })
      .eq("id", id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
