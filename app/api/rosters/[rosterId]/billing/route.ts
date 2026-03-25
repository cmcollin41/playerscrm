import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ rosterId: string }>;
}

/**
 * PATCH body: { fee_id, custom_amount, invoice_id }
 * Updates roster billing. When invoice_id is set, attaches that invoice only (other roster
 * invoices are left in place). When invoice_id is null, clears roster_id from all invoices
 * for this spot. Uses service role after auth + membership.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { rosterId } = await params;
    const body = await req.json().catch(() => ({}));

    const fee_id =
      body.fee_id === null ||
      body.fee_id === undefined ||
      body.fee_id === "" ||
      body.fee_id === "none"
        ? null
        : String(body.fee_id);

    const invoice_id =
      body.invoice_id === null ||
      body.invoice_id === undefined ||
      body.invoice_id === "" ||
      body.invoice_id === "__none__"
        ? null
        : String(body.invoice_id);

    let custom_amount: number | null = null;
    const rawCustom = body.custom_amount;
    if (rawCustom !== null && rawCustom !== undefined && rawCustom !== "") {
      const n =
        typeof rawCustom === "number" ? rawCustom : Number.parseFloat(String(rawCustom));
      if (Number.isNaN(n) || n <= 0) {
        return NextResponse.json(
          { error: "Custom amount must be a positive number" },
          { status: 400 },
        );
      }
      custom_amount = n;
    }

    const userSb = await createClient();
    const {
      data: { user },
    } = await userSb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: roster, error: rErr } = await admin
      .from("rosters")
      .select("id, person_id, team_id")
      .eq("id", rosterId)
      .single();

    if (rErr || !roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    const { data: team, error: tErr } = await admin
      .from("teams")
      .select("account_id")
      .eq("id", roster.team_id)
      .single();

    if (tErr || !team?.account_id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: allowed, error: rpcErr } = await userSb.rpc("has_account_role", {
      p_account_id: team.account_id,
      p_min_role: "member",
    });

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (fee_id) {
      const { data: feeRow } = await admin
        .from("fees")
        .select("id")
        .eq("id", fee_id)
        .eq("account_id", team.account_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!feeRow) {
        return NextResponse.json(
          { error: "Invalid or inactive fee for this account" },
          { status: 400 },
        );
      }
    }

    const { error: rosterErr } = await admin
      .from("rosters")
      .update({ fee_id, custom_amount })
      .eq("id", rosterId);

    if (rosterErr) {
      return NextResponse.json({ error: rosterErr.message }, { status: 500 });
    }

    // Unlink only when explicitly clearing the dropdown — do not wipe other
    // installment invoices when attaching another (invoice_id non-null).
    if (!invoice_id) {
      const { error: clearErr } = await admin
        .from("invoices")
        .update({ roster_id: null })
        .eq("roster_id", rosterId)
        .eq("person_id", roster.person_id);

      if (clearErr) {
        return NextResponse.json({ error: clearErr.message }, { status: 500 });
      }
    }

    if (invoice_id) {
      const { data: invoice, error: iErr } = await admin
        .from("invoices")
        .select("id, person_id, account_id")
        .eq("id", invoice_id)
        .single();

      if (iErr || !invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      if (invoice.person_id !== roster.person_id) {
        return NextResponse.json(
          { error: "Invoice is for a different person" },
          { status: 400 },
        );
      }

      if (invoice.account_id !== team.account_id) {
        return NextResponse.json(
          { error: "Invoice is not on this account" },
          { status: 400 },
        );
      }

      const { error: linkErr } = await admin
        .from("invoices")
        .update({ roster_id: rosterId })
        .eq("id", invoice_id);

      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
