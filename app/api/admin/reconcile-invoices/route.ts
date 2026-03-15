import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const BATCH_SIZE = 20

export async function POST() {
  try {
    const supabase = await createClient()

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

    const { data: staleInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, metadata, amount, person_id, account_id, status")
      .eq("account_id", callerProfile.account_id)
      .in("status", ["sent", "draft"])
      .not("metadata->stripe_invoice_id", "is", null)
      .order("created_at", { ascending: true })

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch invoices: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!staleInvoices || staleInvoices.length === 0) {
      return NextResponse.json({
        message: "No stale invoices found",
        updated: 0,
        checked: 0,
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

    const invoicesByAccount = new Map<string, typeof staleInvoices>()
    for (const inv of staleInvoices) {
      const stripeAcct = (inv.metadata as any)?.stripe_account_id
      if (!stripeAcct) continue
      const list = invoicesByAccount.get(stripeAcct) || []
      list.push(inv)
      invoicesByAccount.set(stripeAcct, list)
    }

    const accountEntries = Array.from(invoicesByAccount.entries())
    for (const [stripeAccountId, invoices] of accountEntries) {
      for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
        const batch = invoices.slice(i, i + BATCH_SIZE)

        const settled = await Promise.allSettled(
          batch.map(async (inv) => {
            const stripeInvoiceId = (inv.metadata as any)?.stripe_invoice_id
            if (!stripeInvoiceId) return null

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
                  throw new Error(
                    `Supabase update failed: ${updateError.message}`
                  )
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

              return stripeInvoice.status
            } catch (err: any) {
              errorCount++
              results.push({
                invoiceId: inv.id,
                stripeId: stripeInvoiceId,
                oldStatus: inv.status,
                newStatus: null,
                error: err.message,
              })
              return null
            }
          })
        )

        if (i + BATCH_SIZE < invoices.length) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    return NextResponse.json({
      message: `Reconciliation complete`,
      checked: checkedCount,
      updated: updatedCount,
      errors: errorCount,
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
