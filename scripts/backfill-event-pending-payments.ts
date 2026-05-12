/**
 * One-shot backfill for event-registration payments that are still
 * status=pending with payment_intent_id=null but have a stored
 * stripe_checkout_session_id. These are pre-fix-9bc1ec4 records where the
 * webhook flipped the registration to "confirmed" but couldn't update the
 * payment row.
 *
 * Looks up each row's Checkout Session in Stripe, resolves PI + charge,
 * and writes back status=succeeded, payment_intent_id, and receipt_url.
 *
 * Run with:
 *   set -a && source .env.local && set +a && \
 *   STRIPE_SECRET_KEY=sk_live_xxx npx -y tsx scripts/backfill-event-pending-payments.ts
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
    .from("payments")
    .select("id, payment_intent_id, status, data, account_id, accounts!inner(stripe_id)")
    .eq("status", "pending")
    .is("payment_intent_id", null)

  if (error) {
    console.error("Query failed:", error)
    process.exit(1)
  }

  const targets = (rows ?? []).filter(
    (r: any) => !!r.data?.stripe_checkout_session_id,
  )

  console.log(`Found ${targets.length} stuck event payments`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const row of targets as any[]) {
    const sessionId = row.data.stripe_checkout_session_id
    const stripeAccountId = row.accounts?.stripe_id || null
    try {
      const session = await stripe.checkout.sessions.retrieve(
        sessionId,
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
      )

      if (session.payment_status !== "paid") {
        console.log(
          `  skip ${row.id} (session payment_status=${session.payment_status})`,
        )
        skipped++
        continue
      }

      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null

      if (!piId) {
        console.log(`  skip ${row.id} (no PI on paid session)`)
        skipped++
        continue
      }

      const pi = await stripe.paymentIntents.retrieve(
        piId,
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
      )

      let receiptUrl: string | null = null
      const latestChargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id || null
      if (latestChargeId) {
        try {
          const charge = await stripe.charges.retrieve(
            latestChargeId,
            stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
          )
          receiptUrl = charge.receipt_url || null
        } catch (err) {
          console.warn(`  warn ${row.id}: charge fetch failed`, err)
        }
      }

      const newData = {
        ...(row.data ?? {}),
        ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
      }

      const { error: updateErr } = await supabase
        .from("payments")
        .update({
          status: "succeeded",
          payment_intent_id: piId,
          data: newData,
        })
        .eq("id", row.id)

      if (updateErr) {
        console.error(`  fail ${row.id}:`, updateErr.message)
        failed++
        continue
      }

      console.log(`  ok ${row.id} → pi=${piId}${receiptUrl ? " + receipt" : ""}`)
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
