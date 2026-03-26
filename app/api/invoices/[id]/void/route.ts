import { NextResponse } from "next/server"
import Stripe from "stripe"
import { requireAccountAdminApi } from "@/lib/auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

const VOIDABLE_STATUSES = ["sent", "draft", "overdue"]

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id: invoiceId } = await params

    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { supabase, activeAccountId } = auth

    const { data: invoice, error: fetchErr } = await supabase
      .from("invoices")
      .select("id, status, metadata, account_id")
      .eq("id", invoiceId)
      .single()

    if (fetchErr || !invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    if (invoice.account_id !== activeAccountId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (!VOIDABLE_STATUSES.includes(invoice.status))
      return NextResponse.json(
        { error: `Cannot void an invoice with status "${invoice.status}"` },
        { status: 400 },
      )

    const meta = invoice.metadata as Record<string, unknown> | null
    const stripeInvoiceId = meta?.stripe_invoice_id as string | undefined
    const stripeAccountId = meta?.stripe_account_id as string | undefined

    if (stripeInvoiceId && stripeAccountId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-08-16",
      })

      try {
        await stripe.invoices.voidInvoice(stripeInvoiceId, {
          stripeAccount: stripeAccountId,
        })
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : "Stripe error"
        console.error("Stripe void error:", msg)
        if (!msg.includes("already been voided")) {
          return NextResponse.json(
            { error: `Stripe: ${msg}` },
            { status: 502 },
          )
        }
      }
    }

    const { error: updateErr } = await supabase
      .from("invoices")
      .update({
        status: "void",
        metadata: {
          ...(meta ?? {}),
          voided_at: new Date().toISOString(),
          last_event: "manual_void",
        },
      })
      .eq("id", invoiceId)

    if (updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, status: "void" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Void invoice error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
