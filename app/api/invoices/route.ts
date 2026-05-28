import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createInvoice, type CreateInvoiceOpts } from "@/lib/payments/create-invoice"

/**
 * HTTP wrapper around createInvoice. Used by client-side callers.
 * The dispatch on `kind` mirrors the legacy body shape so existing clients
 * still work without modification.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      customerId,
      rosterId,
      athleteName,
      teamName,
      amount,
      accountId,
      stripeAccountId,
      person_id,
      description,
      isCustomInvoice,
      eventRegistrationId,
      eventId,
      eventName,
    } = body

    let opts: CreateInvoiceOpts
    if (eventRegistrationId) {
      opts = {
        kind: "event_registration",
        customerId,
        accountId,
        stripeAccountId,
        personId: person_id,
        amount,
        description,
        rosterId: rosterId ?? null,
        eventRegistrationId,
        eventId,
        eventName,
        athleteName,
      }
    } else if (rosterId && !isCustomInvoice) {
      opts = {
        kind: "roster_fee",
        customerId,
        accountId,
        stripeAccountId,
        personId: person_id,
        amount,
        description,
        rosterId,
        athleteName,
        teamName,
      }
    } else {
      opts = {
        kind: "custom",
        customerId,
        accountId,
        stripeAccountId,
        personId: person_id,
        amount,
        description,
        rosterId: rosterId ?? null,
      }
    }

    const supabase = await createClient()
    const result = await createInvoice(opts, supabase)

    if (result.resent) {
      return NextResponse.json({
        invoiceId: (result.internal_invoice as any).id,
        invoiceNumber: (result.internal_invoice as any).invoice_number,
        resent: true,
        sent_count: result.email.sent_count,
        failed_count: result.email.failed_count,
      })
    }

    return NextResponse.json({
      invoice: result.invoice,
      internal_invoice: result.internal_invoice,
      email: result.email,
    })
  } catch (error: any) {
    console.error("Invoice creation error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
