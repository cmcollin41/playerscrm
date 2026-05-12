/**
 * One-shot backfill: fetch hosted_invoice_url + invoice_pdf from Stripe for
 * already-sent invoices that pre-date the change capturing those fields.
 *
 * Run with:
 *   set -a && source .env.local && set +a && \
 *   STRIPE_SECRET_KEY=sk_live_xxx npx -y tsx scripts/backfill-invoice-hosted-urls.ts
 */
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any })

async function main() {
  const { data: rows, error } = await supabase
    .from("invoices")
    .select("id, metadata")

  if (error) {
    console.error("Query failed:", error)
    process.exit(1)
  }

  const targets = (rows ?? []).filter((r: any) => {
    const stripeInvoiceId = r.metadata?.stripe_invoice_id
    const hostedUrl = r.metadata?.hosted_invoice_url
    return !!stripeInvoiceId && !hostedUrl
  })

  console.log(`Found ${targets.length} invoices to backfill`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const row of targets) {
    const stripeInvoiceId = row.metadata.stripe_invoice_id
    const stripeAccountId = row.metadata.stripe_account_id
    try {
      const inv = await stripe.invoices.retrieve(
        stripeInvoiceId,
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
      )

      if (!inv.hosted_invoice_url && !inv.invoice_pdf) {
        console.log(`  skip ${row.id} (no URLs returned)`)
        skipped++
        continue
      }

      const { error: updateErr } = await supabase
        .from("invoices")
        .update({
          metadata: {
            ...row.metadata,
            ...(inv.hosted_invoice_url
              ? { hosted_invoice_url: inv.hosted_invoice_url }
              : {}),
            ...(inv.invoice_pdf ? { invoice_pdf: inv.invoice_pdf } : {}),
          },
        })
        .eq("id", row.id)

      if (updateErr) {
        console.error(`  fail ${row.id}:`, updateErr.message)
        failed++
        continue
      }

      console.log(`  ok ${row.id} → ${inv.hosted_invoice_url}`)
      ok++
    } catch (err: any) {
      console.error(`  fail ${row.id}:`, err?.message || err)
      failed++
    }
  }

  console.log(`\nDone: ${ok} updated, ${skipped} skipped, ${failed} failed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
