/**
 * One-shot backfill: fetch receipt_url from Stripe for already-succeeded
 * event-registration payments that pre-date the webhook change capturing it.
 *
 * Run with:
 *   node --env-file=.env.local --import tsx scripts/backfill-event-receipt-urls.ts
 * (Node >= 22.x is already required by this repo)
 *
 * Requires STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SUPABASE_URL in env.
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

interface Row {
  id: string
  payment_intent_id: string
  data: Record<string, any> | null
  stripe_account_id: string | null
}

async function main() {
  const { data: rows, error } = await supabase
    .from("payments")
    .select("id, payment_intent_id, data, account_id, accounts!inner(stripe_id)")
    .eq("status", "succeeded")
    .not("payment_intent_id", "is", null)

  if (error) {
    console.error("Query failed:", error)
    process.exit(1)
  }

  // Only event-registration payments missing receipt_url
  const targets: Row[] = (rows ?? [])
    .filter((r: any) => {
      const isEventPayment =
        !!r.data?.event_id || !!r.data?.stripe_checkout_session_id
      const hasReceipt = !!r.data?.receipt_url
      return isEventPayment && !hasReceipt
    })
    .map((r: any) => ({
      id: r.id,
      payment_intent_id: r.payment_intent_id,
      data: r.data,
      stripe_account_id: r.accounts?.stripe_id ?? null,
    }))

  console.log(`Found ${targets.length} payments to backfill`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const row of targets) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        row.payment_intent_id,
        row.stripe_account_id
          ? { stripeAccount: row.stripe_account_id }
          : undefined,
      )

      const latestChargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id || null

      if (!latestChargeId) {
        console.log(`  skip ${row.id} (no latest_charge)`)
        skipped++
        continue
      }

      const charge = await stripe.charges.retrieve(
        latestChargeId,
        row.stripe_account_id
          ? { stripeAccount: row.stripe_account_id }
          : undefined,
      )

      if (!charge.receipt_url) {
        console.log(`  skip ${row.id} (no receipt_url on charge)`)
        skipped++
        continue
      }

      const { error: updateErr } = await supabase
        .from("payments")
        .update({ data: { ...(row.data ?? {}), receipt_url: charge.receipt_url } })
        .eq("id", row.id)

      if (updateErr) {
        console.error(`  fail ${row.id}:`, updateErr.message)
        failed++
        continue
      }

      console.log(`  ok ${row.id} → ${charge.receipt_url}`)
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
