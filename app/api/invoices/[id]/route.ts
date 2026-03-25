import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH: set or clear invoices.roster_id (must match person + team account). */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: invoiceId } = await params;
    const body = await req.json();
    const rosterIdRaw = body.roster_id;
    const roster_id =
      rosterIdRaw === null || rosterIdRaw === undefined || rosterIdRaw === ""
        ? null
        : String(rosterIdRaw);

    const supabase = await createClient();

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, person_id, account_id")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (roster_id === null) {
      const { error: upErr } = await supabase
        .from("invoices")
        .update({ roster_id: null })
        .eq("id", invoiceId);

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, roster_id: null });
    }

    const { data: roster, error: rErr } = await supabase
      .from("rosters")
      .select("id, person_id, team_id")
      .eq("id", roster_id)
      .single();

    if (rErr || !roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    if (roster.person_id !== invoice.person_id) {
      return NextResponse.json(
        { error: "Roster belongs to a different person" },
        { status: 400 },
      );
    }

    const { data: team, error: tErr } = await supabase
      .from("teams")
      .select("id, account_id")
      .eq("id", roster.team_id)
      .single();

    if (tErr || !team || team.account_id !== invoice.account_id) {
      return NextResponse.json(
        { error: "Roster team is not on the same account as this invoice" },
        { status: 400 },
      );
    }

    await supabase
      .from("invoices")
      .update({ roster_id: null })
      .eq("roster_id", roster_id)
      .eq("person_id", invoice.person_id);

    const { error: upErr } = await supabase
      .from("invoices")
      .update({ roster_id })
      .eq("id", invoiceId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, roster_id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
