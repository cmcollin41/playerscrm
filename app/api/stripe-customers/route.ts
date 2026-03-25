import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Resolve Stripe customer for an invoice payer.
 *
 * The error "Person not found" is returned when no matching `people` row exists
 * for this account — it does not come from Stripe.
 *
 * Guardians may not appear in user-scoped RLS reads; we use the service role
 * after session auth + account membership. Optional `payerPersonId` + `athletePersonId`
 * verify a primary guardian relationship for dependents.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const emailRaw = typeof body.email === "string" ? body.email : ""
    const accountId = typeof body.accountId === "string" ? body.accountId : ""
    const payerPersonId =
      typeof body.payerPersonId === "string" ? body.payerPersonId : undefined
    const athletePersonId =
      typeof body.athletePersonId === "string" ? body.athletePersonId : undefined

    if (!emailRaw.trim() || !accountId) {
      return NextResponse.json(
        { error: "email and accountId are required" },
        { status: 400 },
      )
    }

    const email = emailRaw.trim()
    const emailLower = normEmail(email)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: allowed, error: rpcErr } = await supabase.rpc(
      "has_account_role",
      {
        p_account_id: accountId,
        p_min_role: "member",
      },
    )

    if (rpcErr || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createAdminClient()

    let person: { id: string; stripe_customer_id: string | null; email: string | null } | null =
      null

    if (payerPersonId) {
      const { data: payerRow, error: payerErr } = await admin
        .from("people")
        .select("id, stripe_customer_id, email")
        .eq("id", payerPersonId)
        .eq("account_id", accountId)
        .maybeSingle()

      if (payerErr || !payerRow) {
        console.error("Stripe customer payer lookup:", payerErr)
        return NextResponse.json(
          {
            error:
              "Billing contact not found for this account. Check guardian is linked to this org.",
          },
          { status: 404 },
        )
      }

      const payerEmail = payerRow.email ? normEmail(payerRow.email) : ""
      if (payerEmail !== emailLower) {
        return NextResponse.json(
          {
            error:
              "Email does not match this billing contact’s profile. Update the contact email or use the address on file.",
          },
          { status: 400 },
        )
      }

      if (athletePersonId && athletePersonId !== payerPersonId) {
        const { data: rel } = await admin
          .from("relationships")
          .select("id")
          .eq("person_id", payerPersonId)
          .eq("relation_id", athletePersonId)
          .eq("primary", true)
          .maybeSingle()

        if (!rel) {
          return NextResponse.json(
            {
              error:
                "Billing contact is not marked as the primary guardian for this player.",
            },
            { status: 400 },
          )
        }
      }

      person = payerRow
    } else {
      const { data: rows, error: personError } = await admin
        .from("people")
        .select("id, stripe_customer_id, email")
        .eq("account_id", accountId)
        .ilike("email", emailLower)

      if (personError) {
        console.error("Person lookup error:", personError)
        return NextResponse.json(
          {
            error:
              "Could not look up billing contact. Try again or pass payer person id from the roster.",
          },
          { status: 500 },
        )
      }

      if (!rows?.length) {
        return NextResponse.json(
          {
            error:
              "No person in your account has this email. Add the guardian as a person with this email, or link them from the player’s profile.",
          },
          { status: 404 },
        )
      }

      if (rows.length > 1) {
        return NextResponse.json(
          {
            error:
              "Multiple people share this email; open billing from the team roster so we can use the guardian record.",
          },
          { status: 409 },
        )
      }

      person = rows[0] ?? null
    }

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }

    if (person.stripe_customer_id) {
      return NextResponse.json({ customerId: person.stripe_customer_id })
    }

    const { data: account } = await admin
      .from("accounts")
      .select("stripe_id")
      .eq("id", accountId)
      .single()

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
      stripeAccount: account?.stripe_id ?? undefined,
    })

    const customer = await stripe.customers.create({
      email,
      metadata: {
        source: "athletes.app",
        person_id: person.id,
      },
    })

    const { error: updateError } = await admin
      .from("people")
      .update({ stripe_customer_id: customer.id })
      .eq("id", person.id)

    if (updateError) {
      console.error("Error updating person with customer ID:", updateError)
      return NextResponse.json(
        { error: "Failed to update person record" },
        { status: 500 },
      )
    }

    return NextResponse.json({ customerId: customer.id })
  } catch (error: unknown) {
    console.error("Customer creation error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
