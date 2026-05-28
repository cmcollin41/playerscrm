import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

import { stripe } from "@/lib/stripe"

export interface ResolveStripeCustomerInput {
  accountId: string
  email: string
  /** Guardian / payer `people.id`. Required when the registrant is a dependent. */
  payerPersonId?: string
  /** Athlete `people.id`. Used to verify a primary guardian relationship. */
  athletePersonId?: string
  /** Service-role client. Needed because guardians may not appear under RLS. */
  admin: SupabaseClient
}

export type ResolveStripeCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string; status: number }

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Resolve (or create) a Stripe customer for an invoice payer.
 *
 * Pure server logic — caller is responsible for authentication and account
 * membership checks. The supplied `admin` client should be service-role so
 * we can look up guardians who may not pass the requester's RLS.
 */
export async function resolveStripeCustomer(
  input: ResolveStripeCustomerInput,
): Promise<ResolveStripeCustomerResult> {
  const { accountId, email: emailRaw, payerPersonId, athletePersonId, admin } = input

  if (!emailRaw?.trim() || !accountId) {
    return { ok: false, error: "email and accountId are required", status: 400 }
  }

  const email = emailRaw.trim()
  const emailLower = normEmail(email)

  let person: {
    id: string
    stripe_customer_id: string | null
    email: string | null
  } | null = null

  if (payerPersonId) {
    const { data: payerRow, error: payerErr } = await admin
      .from("people")
      .select("id, stripe_customer_id, email")
      .eq("id", payerPersonId)
      .eq("account_id", accountId)
      .maybeSingle()

    if (payerErr || !payerRow) {
      console.error("Stripe customer payer lookup:", payerErr)
      return {
        ok: false,
        error:
          "Billing contact not found for this account. Check guardian is linked to this org.",
        status: 404,
      }
    }

    const payerEmail = payerRow.email ? normEmail(payerRow.email) : ""
    if (payerEmail !== emailLower) {
      return {
        ok: false,
        error:
          "Email does not match this billing contact’s profile. Update the contact email or use the address on file.",
        status: 400,
      }
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
        return {
          ok: false,
          error:
            "Billing contact is not marked as the primary guardian for this player.",
          status: 400,
        }
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
      return {
        ok: false,
        error:
          "Could not look up billing contact. Try again or pass payer person id from the roster.",
        status: 500,
      }
    }

    if (!rows?.length) {
      return {
        ok: false,
        error:
          "No person in your account has this email. Add the guardian as a person with this email, or link them from the player’s profile.",
        status: 404,
      }
    }

    if (rows.length > 1) {
      return {
        ok: false,
        error:
          "Multiple people share this email; open billing from the team roster so we can use the guardian record.",
        status: 409,
      }
    }

    person = rows[0] ?? null
  }

  if (!person) {
    return { ok: false, error: "Person not found", status: 404 }
  }

  if (person.stripe_customer_id) {
    return { ok: true, customerId: person.stripe_customer_id }
  }

  const { data: account } = await admin
    .from("accounts")
    .select("stripe_id")
    .eq("id", accountId)
    .single()

  const customer = await stripe.customers.create(
    {
      email,
      metadata: {
        source: "athletes.app",
        person_id: person.id,
      },
    },
    account?.stripe_id ? { stripeAccount: account.stripe_id } : undefined,
  )

  const { error: updateError } = await admin
    .from("people")
    .update({ stripe_customer_id: customer.id })
    .eq("id", person.id)

  if (updateError) {
    console.error("Error updating person with customer ID:", updateError)
    return { ok: false, error: "Failed to update person record", status: 500 }
  }

  return { ok: true, customerId: customer.id }
}
