import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const PAGE_SIZE = 10

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { offset = 0 } = await req.json().catch(() => ({ offset: 0 }))

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", user.id)
      .single()

    if (!callerProfile?.account_id || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("account_id", callerProfile.account_id)
      .in("status", ["sent", "draft"])
      .not("metadata->>stripe_invoice_id", "is", null)

    const { data: batch, error: fetchError } = await supabase
      .from("invoices")
      .select("id, metadata, amount, person_id, account_id, status")
      .eq("account_id", callerProfile.account_id)
      .in("status", ["sent", "draft"])
      .not("metadata->>stripe_invoice_id", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch invoices: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!batch || batch.length === 0) {
      return NextResponse.json({
        done: true,
        message: "No more invoices to process",
        checked: 0,
        updated: 0,
        errors: 0,
        total: count || 0,
        offset,
        results: [],
      })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
    })

    let updatedCount = 0
    let checkedCount = 0
    let errorCount = 0
    const results: Array<{
      invoiceId: string
      stripeId: string
      oldStatus: string
      newStatus: string | null
      error?: string
    }> = []

    for (const inv of batch) {
      const stripeInvoiceId = (inv.metadata as any)?.stripe_invoice_id
      const stripeAccountId = (inv.metadata as any)?.stripe_account_id
      if (!stripeInvoiceId || !stripeAccountId) continue

      checkedCount++

      try {
        const stripeInvoice = await stripe.invoices.retrieve(
          stripeInvoiceId,
          { stripeAccount: stripeAccountId }
        )

        const newStatus = mapStripeStatus(stripeInvoice.status || "")

        if (newStatus && newStatus !== inv.status) {
          const { error: updateError } = await supabase
            .from("invoices")
            .update({
              status: newStatus,
              metadata: {
                ...(inv.metadata as object),
                last_event: `reconciliation:${stripeInvoice.status}`,
                reconciled_at: new Date().toISOString(),
              },
            })
            .eq("id", inv.id)

          if (updateError) {
            throw new Error(`Supabase update failed: ${updateError.message}`)
          }

          if (
            newStatus === "paid" &&
            stripeInvoice.amount_paid &&
            stripeInvoice.amount_paid > 0
          ) {
            const { data: existingPayment } = await supabase
              .from("payments")
              .select("id")
              .eq("invoice_id", inv.id)
              .eq("status", "succeeded")
              .maybeSingle()

            if (!existingPayment) {
              await supabase.from("payments").insert({
                invoice_id: inv.id,
                person_id: inv.person_id,
                account_id: inv.account_id,
                amount: stripeInvoice.amount_paid / 100,
                status: "succeeded",
                payment_method: "stripe",
                payment_intent_id:
                  typeof stripeInvoice.payment_intent === "string"
                    ? stripeInvoice.payment_intent
                    : stripeInvoice.payment_intent?.id || null,
              })
            }
          }

          updatedCount++
          results.push({
            invoiceId: inv.id,
            stripeId: stripeInvoiceId,
            oldStatus: inv.status,
            newStatus,
          })
        }
      } catch (err: any) {
        errorCount++
        results.push({
          invoiceId: inv.id,
          stripeId: stripeInvoiceId,
          oldStatus: inv.status,
          newStatus: null,
          error: err.message,
        })
      }
    }

    const nextOffset = offset + batch.length
    const done = nextOffset >= (count || 0)

    return NextResponse.json({
      done,
      checked: checkedCount,
      updated: updatedCount,
      errors: errorCount,
      total: count || 0,
      offset,
      nextOffset: done ? null : nextOffset,
      results,
    })
  } catch (error: any) {
    console.error("Reconciliation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

function mapStripeStatus(stripeStatus: string): string | null {
  switch (stripeStatus) {
    case "paid":
      return "paid"
    case "open":
      return "sent"
    case "draft":
      return "draft"
    case "void":
      return "void"
    case "uncollectible":
      return "failed"
    default:
      return null
  }
}
