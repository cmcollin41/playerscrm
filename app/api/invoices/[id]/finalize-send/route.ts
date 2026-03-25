import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Finalize and email an existing Stripe invoice that is still in draft.
 * DB row must be status draft with metadata.stripe_invoice_id (and stripe account).
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, account_id, status, metadata")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: allowed } = await supabase.rpc("has_account_role", {
      p_account_id: invoice.account_id,
      p_min_role: "member",
    });
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invoice.status !== "draft") {
      return NextResponse.json(
        {
          error:
            "Only draft invoices can be sent from here. Use Resend on the roster for invoices already marked sent.",
        },
        { status: 400 },
      );
    }

    const meta = (invoice.metadata ?? {}) as Record<string, unknown>;
    const stripeInvoiceId =
      typeof meta.stripe_invoice_id === "string" ? meta.stripe_invoice_id : null;
    const stripeAccountId =
      typeof meta.stripe_account_id === "string" ? meta.stripe_account_id : null;

    if (!stripeInvoiceId || !stripeAccountId) {
      return NextResponse.json(
        {
          error:
            "This draft is not tied to a Stripe invoice yet. Unlink it in step 1, save, then use “Email invoice” to create a new Stripe invoice.",
        },
        { status: 422 },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
    });

    const finalized = await stripe.invoices.finalizeInvoice(
      stripeInvoiceId,
      { auto_advance: false },
      { stripeAccount: stripeAccountId },
    );

    const sent = await stripe.invoices.sendInvoice(finalized.id, {
      stripeAccount: stripeAccountId,
    });

    const { error: upErr } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        invoice_number: sent.number,
        metadata: {
          ...meta,
          stripe_invoice_id: sent.id,
        },
      })
      .eq("id", invoiceId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
