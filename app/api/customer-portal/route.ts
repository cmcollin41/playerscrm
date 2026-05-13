import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { NextResponse } from "next/server"
import resend from "@/lib/resend"

interface AccountRef {
  id: string
  name: string | null
  stripe_id: string | null
}

interface PersonRow {
  id: string
  email: string | null
  stripe_customer_id: string | null
  account_id: string | null
  accounts: AccountRef | null
}

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (explicit) return explicit
  return process.env.NODE_ENV === "production"
    ? "https://app.athletes.app"
    : "http://app.localhost:3000"
}

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If we found an account matching that email, we've sent a billing portal link.",
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabase = await createClient()

    const { data: people } = await supabase
      .from("people")
      .select(
        "id, email, stripe_customer_id, account_id, accounts (id, name, stripe_id)",
      )
      .eq("email", normalizedEmail)
      .returns<PersonRow[]>()

    const eligible = (people ?? []).filter(
      (p): p is PersonRow & { accounts: AccountRef & { stripe_id: string } } =>
        !!p.accounts?.stripe_id,
    )

    // Always return generic success to prevent email enumeration. Bail
    // silently when there's nothing to do.
    if (eligible.length === 0) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const baseUrl = getBaseUrl()

    // Dedupe by connected Stripe account so a customer with the same email
    // under two tenants on the same Stripe account doesn't get two links.
    const seenStripeAccounts = new Set<string>()
    const links: { accountName: string; url: string }[] = []

    for (const person of eligible) {
      const connectedAccountId = person.accounts.stripe_id
      if (seenStripeAccounts.has(connectedAccountId)) continue
      seenStripeAccounts.add(connectedAccountId)

      let stripeCustomerId = person.stripe_customer_id

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
          {
            email: normalizedEmail,
            metadata: { person_id: person.id },
          },
          { stripeAccount: connectedAccountId },
        )

        await supabase
          .from("people")
          .update({ stripe_customer_id: customer.id })
          .eq("id", person.id)

        stripeCustomerId = customer.id
      }

      const session = await stripe.billingPortal.sessions.create(
        {
          customer: stripeCustomerId,
          return_url: `${baseUrl}/`,
        },
        { stripeAccount: connectedAccountId },
      )

      links.push({
        accountName: person.accounts.name?.trim() || "Athletes App",
        url: session.url,
      })
    }

    const linkListHtml = links
      .map(
        (l) =>
          `<li style="margin-bottom: 8px;"><a href="${l.url}">${escapeHtml(
            l.accountName,
          )} — Open billing portal</a></li>`,
      )
      .join("")

    const intro =
      links.length === 1
        ? `<p>Here's your secure link to manage billing for <strong>${escapeHtml(
            links[0].accountName,
          )}</strong>:</p>`
        : `<p>We found ${links.length} accounts associated with this email. Here are your secure billing portal links:</p>`

    const linkSection =
      links.length === 1
        ? `<p><a href="${links[0].url}">Open billing portal</a></p>`
        : `<ul>${linkListHtml}</ul>`

    await resend.emails.send({
      from: "Athletes App <noreply@e.athletes.app>",
      to: normalizedEmail,
      subject: "Your Athletes App billing portal link",
      html: `
        <h2>Access your billing portal</h2>
        ${intro}
        ${linkSection}
        <p>These links expire in a few minutes for security.</p>
        <p>If you didn't request this email, you can safely ignore it.</p>
      `,
    })

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (error: any) {
    console.error("customer-portal error:", error)
    return NextResponse.json(
      { error: "Unable to process billing portal request" },
      { status: 500 },
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
