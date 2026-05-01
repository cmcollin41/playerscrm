import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { event_id, person_ids } = await req.json()

    if (!event_id || !person_ids?.length) {
      return NextResponse.json({ error: "Missing event_id or person_ids" }, { status: 400 })
    }

    // Use the admin client for tenant data ops — registrants aren't members
    // of the event's account, so RLS would hide the event under the
    // authenticated role. Auth was already verified above.
    const admin = createAdminClient()

    // Fetch event with account info
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("*, accounts(id, stripe_id, application_fee)")
      .eq("id", event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!event.is_published) {
      return NextResponse.json({ error: "Event is not open for registration" }, { status: 400 })
    }

    // Check capacity
    if (event.capacity) {
      const { count } = await admin
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event_id)
        .in("status", ["pending", "confirmed"])

      if ((count || 0) + person_ids.length > event.capacity) {
        return NextResponse.json({ error: "Event is at capacity" }, { status: 400 })
      }
    }

    // Create registrations
    const registrations = person_ids.map((person_id: string) => ({
      event_id,
      person_id,
      registered_by: user.id,
      status: event.fee_amount > 0 ? "pending" : "confirmed",
    }))

    const { data: regs, error: regError } = await admin
      .from("event_registrations")
      .upsert(registrations, { onConflict: "event_id,person_id" })
      .select()

    if (regError) {
      return NextResponse.json({ error: regError.message }, { status: 500 })
    }

    // Ensure account_people rows exist
    for (const person_id of person_ids) {
      await admin
        .from("account_people")
        .upsert(
          { account_id: event.account_id, person_id },
          { onConflict: "account_id,person_id" }
        )
    }

    // If free event, we're done
    if (event.fee_amount <= 0) {
      return NextResponse.json({ success: true, registrations: regs })
    }

    // Create Stripe payment intent
    const account = event.accounts as any
    const totalAmount = event.fee_amount * person_ids.length
    const applicationFee = account.application_fee
      ? Math.round(totalAmount * (account.application_fee / 100))
      : 0

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalAmount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        event_id,
        person_ids: person_ids.join(","),
        registration_ids: regs!.map((r: any) => r.id).join(","),
        account_id: event.account_id,
      },
    }

    if (account.stripe_id) {
      paymentIntentParams.application_fee_amount = applicationFee
    }

    const paymentIntent = account.stripe_id
      ? await stripe.paymentIntents.create(paymentIntentParams, {
          stripeAccount: account.stripe_id,
        })
      : await stripe.paymentIntents.create(paymentIntentParams)

    // Create payment record
    const { data: payment } = await admin
      .from("payments")
      .insert({
        account_id: event.account_id,
        person_id: person_ids[0],
        amount: totalAmount,
        status: "pending",
        payment_intent_id: paymentIntent.id,
        data: { event_id, person_ids, registration_ids: regs!.map((r: any) => r.id) },
      })
      .select("id")
      .single()

    // Link payment to registrations
    if (payment) {
      await admin
        .from("event_registrations")
        .update({ payment_id: payment.id })
        .in("id", regs!.map((r: any) => r.id))
    }

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      stripe_account: account.stripe_id || null,
      registrations: regs,
    })
  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    )
  }
}
