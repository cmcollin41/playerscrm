import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ rosterId: string }>;
}

/** POST body: { invoice_id: string | null } — attach or detach the roster spot’s primary invoice link. */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { rosterId } = await params;
    const body = await req.json();
    const invoice_id =
      body.invoice_id === null ||
      body.invoice_id === undefined ||
      body.invoice_id === ""
        ? null
        : String(body.invoice_id);

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
