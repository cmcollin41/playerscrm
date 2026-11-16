import { createElement } from "react"
import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  InvoiceEmail,
  invoiceEmailText,
  type InvoiceEmailProps,
} from "@/components/emails/invoice-email"
import {
  ReceiptEmail,
  receiptEmailText,
  type ReceiptEmailProps,
} from "@/components/emails/receipt-email"
import { sendTransactionalEmail } from "@/lib/email-service"
import { renderEmail } from "@/lib/emails/render"
import { resolveSender } from "@/lib/sender"
import { createClient } from "@/lib/supabase/server"

export interface SendInvoiceEmailResult {
  success: boolean
  sent_count: number
  failed_count: number
  error?: string
  payment_link?: string
}

interface Recipient {
  email: string
  name: string
  person_id: string
}

interface InvoicePerson {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  name: string | null
  dependent: boolean | null
}

const INVOICE_SELECT = `
  *,
  person:people (
    id,
    first_name,
    last_name,
    email,
    name,
    dependent
  ),
  account:accounts (
    id,
    name,
    logo,
    stripe_id,
    default_invoice_sender_id,
    default_sender_id,
    senders!senders_account_id_fkey (
      id,
      name,
      email
    )
  )
`

function failure(error: string): SendInvoiceEmailResult {
  return { success: false, sent_count: 0, failed_count: 0, error }
}

function personFullName(person: InvoicePerson | null): string | null {
  if (!person) return null
  const full = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  return full || person.name || null
}

/** Only absolute http(s) URLs render in email clients. */
function emailLogoUrl(logo: unknown): string | null {
  return typeof logo === "string" && /^https?:\/\//i.test(logo) ? logo : null
}

/**
 * Who gets billing email for a person: the person themselves when they have
 * an address, plus every primary guardian when they are a dependent.
 */
async function resolveBillingRecipients(
  supabase: SupabaseClient,
  person: InvoicePerson | null,
): Promise<Recipient[]> {
  const recipients: Recipient[] = []
  if (!person) return recipients

  if (person.email) {
    recipients.push({
      email: person.email,
      name: person.first_name || person.name || "there",
      person_id: person.id,
    })
  }

  if (!person.dependent) return recipients

  const { data: relationships } = await supabase
    .from("relationships")
    .select("person_id")
    .eq("relation_id", person.id)
    .eq("primary", true)

  if (!relationships || relationships.length === 0) return recipients

  const { data: guardians } = await supabase
    .from("people")
    .select("id, email, first_name, name")
    .in(
      "id",
      relationships.map((r) => r.person_id),
    )

  for (const guardian of guardians ?? []) {
    if (!guardian.email) continue
    if (recipients.some((r) => r.email === guardian.email)) continue
    recipients.push({
      email: guardian.email,
      name: guardian.first_name || guardian.name || "there",
      person_id: guardian.id,
    })
  }

  return recipients
}

/**
 * Send an invoice email from the account's verified Resend sender, linking
 * to the Stripe-hosted invoice URL. Replaces stripe.invoices.sendInvoice so
 * the email comes from the customer's domain instead of stripe.com.
 *
 * Requires the DB invoice row to already have metadata.stripe_invoice_id
 * (and either metadata.hosted_invoice_url or the ability to retrieve it
 * from Stripe via the account's stripe connection).
 */
export async function sendInvoiceEmail(
  invoiceId: string,
): Promise<SendInvoiceEmailResult> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .single()

  if (invoiceError || !invoice) {
    console.error(
      "sendInvoiceEmail: could not load invoice",
      invoiceId,
      invoiceError?.message,
    )
    return failure("Invoice not found")
  }

  const recipients = await resolveBillingRecipients(supabase, invoice.person)
  if (recipients.length === 0) {
    return failure("No email address found for recipient or their guardian(s)")
  }

  const sender = resolveSender(invoice.account, "invoice")

  const metadata = (invoice.metadata ?? {}) as Record<string, unknown>
  let paymentLink =
    typeof metadata.hosted_invoice_url === "string"
      ? metadata.hosted_invoice_url
      : null

  const stripeInvoiceId =
    typeof metadata.stripe_invoice_id === "string"
      ? metadata.stripe_invoice_id
      : null
  const stripeAccountId =
    invoice.account?.stripe_id ||
    (typeof metadata.stripe_account_id === "string"
      ? metadata.stripe_account_id
      : null)

  if (!paymentLink) {
    if (!stripeInvoiceId || !stripeAccountId) {
      return failure(
        "No Stripe invoice found for this invoice. Cannot generate payment link.",
      )
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
    })
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      stripeAccount: stripeAccountId,
    })
    paymentLink = stripeInvoice.hosted_invoice_url ?? null
  }

  if (!paymentLink) {
    return failure(
      "Stripe invoice has no payment link. It may have been voided or already paid.",
    )
  }

  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8)
  const accountName = invoice.account.name
  const subject = `Invoice ${invoiceNumber} from ${accountName}`
  const billedFor = personFullName(invoice.person)

  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    const props: InvoiceEmailProps = {
      accountName,
      logoUrl: emailLogoUrl(invoice.account.logo),
      recipientName: recipient.name,
      invoiceNumber,
      amount: Number(invoice.amount || 0),
      dueDate: invoice.due_date,
      description: invoice.description,
      billedFor: recipient.person_id === invoice.person?.id ? null : billedFor,
      paymentLink,
    }
    const { html, text } = await renderEmail(
      createElement(InvoiceEmail, props),
      invoiceEmailText(props),
    )

    const result = await sendTransactionalEmail({
      sender,
      to: recipient.email,
      subject,
      html,
      text,
      account_id: invoice.account_id,
      person_id: recipient.person_id,
      metadata: {
        type: "invoice",
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
      },
    })

    if (result.success) {
      sentCount++
    } else {
      failedCount++
      console.error(
        `Failed to send invoice to ${recipient.email}:`,
        result.error,
      )
    }
  }

  return {
    success: sentCount > 0,
    sent_count: sentCount,
    failed_count: failedCount,
    payment_link: paymentLink,
  }
}

interface SendReceiptEmailOptions {
  /** Service-role client — receipts are sent from the Stripe webhook. */
  supabase: SupabaseClient
  invoiceId: string
  /** Dollars actually collected. */
  amountPaid: number
  paidAt: Date
  /** Stripe-hosted invoice page, which shows the paid state and receipt. */
  receiptLink?: string | null
}

/**
 * Email a payment receipt for a paid invoice to the same people who received
 * the invoice. Callers must make sure this runs once per payment.
 */
export async function sendReceiptEmail(
  options: SendReceiptEmailOptions,
): Promise<SendInvoiceEmailResult> {
  const { supabase, invoiceId, amountPaid, paidAt } = options

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .single()

  if (invoiceError || !invoice) {
    console.error(
      "sendReceiptEmail: could not load invoice",
      invoiceId,
      invoiceError?.message,
    )
    return failure("Invoice not found")
  }

  const recipients = await resolveBillingRecipients(supabase, invoice.person)
  if (recipients.length === 0) {
    return failure("No email address found for recipient or their guardian(s)")
  }

  const metadata = (invoice.metadata ?? {}) as Record<string, unknown>
  const receiptLink =
    options.receiptLink ||
    (typeof metadata.hosted_invoice_url === "string"
      ? metadata.hosted_invoice_url
      : null)

  const sender = resolveSender(invoice.account, "invoice")
  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8)
  const accountName = invoice.account.name
  const subject = `Receipt from ${accountName} — invoice ${invoiceNumber}`
  const billedFor = personFullName(invoice.person)

  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    const props: ReceiptEmailProps = {
      accountName,
      logoUrl: emailLogoUrl(invoice.account.logo),
      recipientName: recipient.name,
      invoiceNumber,
      amountPaid,
      paidAt,
      description: invoice.description,
      billedFor: recipient.person_id === invoice.person?.id ? null : billedFor,
      receiptLink,
    }
    const { html, text } = await renderEmail(
      createElement(ReceiptEmail, props),
      receiptEmailText(props),
    )

    const result = await sendTransactionalEmail({
      supabase,
      sender,
      to: recipient.email,
      subject,
      html,
      text,
      account_id: invoice.account_id,
      person_id: recipient.person_id,
      metadata: { type: "receipt", invoice_id: invoice.id },
    })

    if (result.success) {
      sentCount++
    } else {
      failedCount++
      console.error(
        `Failed to send receipt to ${recipient.email}:`,
        result.error,
      )
    }
  }

  return {
    success: sentCount > 0,
    sent_count: sentCount,
    failed_count: failedCount,
  }
}
