import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

interface RouteParams {
  params: Promise<{ rosterId: string }>
}

/**
 * POST body: { invoice_id }
 * One-time link: sets invoice.roster_id so an existing (orphan) invoice
 * is associated with this roster spot. Does not unlink other invoices.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { rosterId } = await params
    const body = await req.json().catch(() => ({}))
    const invoiceId = body.invoice_id

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 })
    }

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

    const { data: invoice, error: iErr } = await admin
      .from("invoices")
      .select("id, person_id, account_id, roster_id")
      .eq("id", invoiceId)
      .single()

    if (iErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.person_id !== roster.person_id) {
      return NextResponse.json(
        { error: "Invoice belongs to a different person" },
        { status: 400 },
      )
    }

    if (invoice.account_id !== team.account_id) {
      return NextResponse.json(
        { error: "Invoice is not on this account" },
        { status: 400 },
      )
    }

    if (invoice.roster_id && invoice.roster_id !== rosterId) {
      return NextResponse.json(
        { error: "Invoice is already linked to another roster" },
        { status: 409 },
      )
    }

    const { error: linkErr } = await admin
      .from("invoices")
      .update({ roster_id: rosterId })
      .eq("id", invoiceId)

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
