import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { calculateApplicationFeeCents } from "@/lib/fees"
import { confirmedPersonIds } from "@/lib/events/registration-status"
import { getEventIntegrations } from "@/lib/integrations/install"
import { getServerHooks } from "@/lib/integrations/server"
import type { IntegrationValidateResult } from "@/lib/integrations"
import { centsToDollars } from "@/lib/money"

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

    const { event_id, person_ids, items, waiver_acceptances } = await req.json()

    if (!event_id || !person_ids?.length) {
      return NextResponse.json(
        { error: "Missing event_id or person_ids" },
        { status: 400 },
      )
    }

    const incomingItems: Array<{
      person_id: string
      event_product_id: string
      variant_id: string
      shipping_address?: Record<string, any>
    }> = Array.isArray(items) ? items : []

    const incomingAcceptances: Array<{
      person_id: string
      waiver_id: string
      signer_name: string
      signer_relationship: "self" | "guardian" | "other"
    }> = Array.isArray(waiver_acceptances) ? waiver_acceptances : []

    // Use the admin client for tenant data ops — registrants aren't members
    // of the event's account, so RLS would hide the event under the
    // authenticated role. Auth was already verified above.
    const admin = createAdminClient()

    // Fetch event with account info
    const { data: event, error: eventError } = await admin
      .from("events")
      .select(
        "*, accounts(id, stripe_id, application_fee, application_fee_flat)",
      )
      .eq("id", event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!event.is_published) {
      return NextResponse.json(
        { error: "Event is not open for registration" },
        { status: 400 },
      )
    }

    const { data: existingRegs, error: existingRegsError } = await admin
      .from("event_registrations")
      .select("person_id, status")
      .eq("event_id", event_id)
      .in("person_id", person_ids)

    if (existingRegsError) {
      return NextResponse.json(
        { error: existingRegsError.message },
        { status: 500 },
      )
    }

    const alreadyConfirmed = confirmedPersonIds(existingRegs ?? [])
    if (alreadyConfirmed.length > 0) {
      return NextResponse.json(
        {
          error: "One or more people are already registered for this event",
          person_ids: alreadyConfirmed,
        },
        { status: 409 },
      )
    }

    // event_registrations.registered_by → profiles(id). Race-safe upsert so two
    // concurrent registers can't both INSERT and one 500 on the PK.
    const { error: profileUpsertError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        account_id: event.account_id,
        current_account_id: event.account_id,
        role: "general",
      },
      { onConflict: "id", ignoreDuplicates: true },
    )
    if (profileUpsertError) {
      return NextResponse.json(
        { error: profileUpsertError.message },
        { status: 500 },
      )
    }

    // Check capacity
    if (event.capacity) {
      const { count } = await admin
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event_id)
        .in("status", ["pending", "confirmed"])

      if ((count || 0) + person_ids.length > event.capacity) {
        return NextResponse.json(
          { error: "Event is at capacity" },
          { status: 400 },
        )
      }
    }

    // Validate waivers up front, before any inserts. Fetching attachedWaivers
    // once here and reusing it below avoids orphan registrations on a missing
    // signature and keeps a single source of truth for the snapshot insert.
    const { data: attachedWaivers, error: waiverFetchError } = await admin
      .from("event_waivers")
      .select("waiver_id, is_required, waiver:waivers(id, title, body)")
      .eq("event_id", event_id)

    if (waiverFetchError) {
      return NextResponse.json(
        { error: waiverFetchError.message },
        { status: 500 },
      )
    }

    const requiredWaiverIds = (attachedWaivers ?? [])
      .filter((w: any) => w.is_required)
      .map((w: any) => w.waiver_id as string)

    if (requiredWaiverIds.length > 0) {
      const acceptanceIndex = new Map<
        string,
        (typeof incomingAcceptances)[number]
      >()
      for (const a of incomingAcceptances) {
        acceptanceIndex.set(`${a.person_id}:${a.waiver_id}`, a)
      }
      for (const pid of person_ids as string[]) {
        for (const wid of requiredWaiverIds) {
          const a = acceptanceIndex.get(`${pid}:${wid}`)
          if (!a || !a.signer_name?.trim()) {
            return NextResponse.json(
              {
                error:
                  "All required waivers must be signed for every registrant",
              },
              { status: 400 },
            )
          }
        }
      }
    }

    // Run validateRegistration on every installed integration. Each one
    // contributes its own extraCents, Stripe line items, and an optional
    // persist callback to insert per-integration rows after registrations
    // exist.
    const installedIntegrations = await getEventIntegrations(event_id, admin)
    const validateResults: IntegrationValidateResult[] = []
    const payload = { items: incomingItems }
    for (const installed of installedIntegrations) {
      const hooks = getServerHooks(installed.integration.slug)
      if (!hooks.validateRegistration) continue
      const result = await hooks.validateRegistration(
        {
          eventId: event_id,
          accountId: event.account_id,
          personIds: person_ids,
          payload,
          admin,
        },
        installed.config,
      )
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "Validation failed" },
          { status: 400 },
        )
      }
      validateResults.push(result)
    }

    const itemsTotalCents = validateResults.reduce(
      (s, r) => s + (r.extraCents ?? 0),
      0,
    )
    const collectedStripeLines: Stripe.Checkout.SessionCreateParams.LineItem[] =
      validateResults.flatMap(
        (r) =>
          (r.stripeLineItems ??
            []) as Stripe.Checkout.SessionCreateParams.LineItem[],
      )

    // Create registrations
    const registrations = person_ids.map((person_id: string) => ({
      event_id,
      person_id,
      registered_by: user.id,
      status:
        event.fee_amount > 0 || itemsTotalCents > 0 ? "pending" : "confirmed",
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
          { onConflict: "account_id,person_id" },
        )
    }

    const regByPerson = new Map<string, string>()
    for (const r of regs ?? []) {
      regByPerson.set(r.person_id as string, r.id as string)
    }

    // Persist waiver acceptances. Validation already ran up front.
    if (incomingAcceptances.length > 0 && (attachedWaivers?.length ?? 0) > 0) {
      const waiverById = new Map<
        string,
        { id: string; title: string; body: string }
      >()
      for (const w of attachedWaivers as any[]) {
        const tpl = Array.isArray(w.waiver) ? w.waiver[0] : w.waiver
        if (tpl) waiverById.set(tpl.id, tpl)
      }

      const fwd = req.headers.get("x-forwarded-for") ?? ""
      const ipAddress = fwd.split(",")[0]?.trim() || null
      const userAgent = req.headers.get("user-agent") ?? null

      const rows: any[] = []
      for (const a of incomingAcceptances) {
        const tpl = waiverById.get(a.waiver_id)
        const regId = regByPerson.get(a.person_id)
        if (!tpl || !regId) continue
        rows.push({
          registration_id: regId,
          waiver_id: a.waiver_id,
          signed_for_person_id: a.person_id,
          title_snapshot: tpl.title,
          body_snapshot: tpl.body,
          signer_name: a.signer_name.trim(),
          signer_relationship: a.signer_relationship,
          signer_email: user.email ?? null,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
      }

      if (rows.length > 0) {
        const { error: insErr } = await admin
          .from("waiver_acceptances")
          .insert(rows)
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 })
        }
      }
    }

    // Run each app's persist callback so per-app rows that FK back to
    // event_registrations can be inserted (e.g. event_registration_items).
    for (const result of validateResults) {
      if (!result.persist) continue
      try {
        await result.persist(regByPerson, admin)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    const grandTotalCents =
      event.fee_amount * person_ids.length + itemsTotalCents

    // If nothing to charge (free event + comp products only), we're done.
    if (grandTotalCents <= 0) {
      return NextResponse.json({ success: true, registrations: regs })
    }

    // Create Stripe-hosted Checkout Session
    const account = event.accounts as any
    const totalAmount = grandTotalCents
    const applicationFee = calculateApplicationFeeCents(totalAmount, account)

    const origin = req.headers.get("origin") || new URL(req.url).origin
    const registrationIdsCsv = regs!.map((r: any) => r.id).join(",")

    const eventLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      event.fee_amount > 0
        ? [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: event.name,
                  ...(event.description
                    ? { description: event.description }
                    : {}),
                },
                unit_amount: event.fee_amount,
              },
              quantity: person_ids.length,
            },
          ]
        : []

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [...eventLineItems, ...collectedStripeLines],
      success_url: `${origin}/register/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/register/${event.slug}?canceled=1`,
      // Stripe minimum is 30 minutes; 1 hour gives a comfortable buffer.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      metadata: {
        event_id,
        registration_ids: registrationIdsCsv,
        account_id: event.account_id,
      },
      payment_intent_data: {
        metadata: {
          event_id,
          person_ids: person_ids.join(","),
          registration_ids: registrationIdsCsv,
          account_id: event.account_id,
        },
        ...(account.stripe_id && applicationFee > 0
          ? { application_fee_amount: applicationFee }
          : {}),
      },
    }

    const session = account.stripe_id
      ? await stripe.checkout.sessions.create(sessionParams, {
          stripeAccount: account.stripe_id,
        })
      : await stripe.checkout.sessions.create(sessionParams)

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null

    // Create payment record
    const { data: payment } = await admin
      .from("payments")
      .insert({
        account_id: event.account_id,
        person_id: person_ids[0],
        amount: centsToDollars(totalAmount),
        status: "pending",
        payment_intent_id: paymentIntentId,
        data: {
          amount_unit: "dollars",
          event_id,
          person_ids,
          registration_ids: regs!.map((r: any) => r.id),
          stripe_checkout_session_id: session.id,
        },
      })
      .select("id")
      .single()

    // Link payment to registrations
    if (payment) {
      await admin
        .from("event_registrations")
        .update({ payment_id: payment.id })
        .in(
          "id",
          regs!.map((r: any) => r.id),
        )
    }

    return NextResponse.json({
      success: true,
      url: session.url,
      registrations: regs,
    })
  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 },
    )
  }
}
