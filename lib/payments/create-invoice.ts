import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

import { stripe } from "@/lib/stripe"
import { calculateApplicationFeeFromDollars } from "@/lib/fees"
import { sendInvoiceEmail } from "@/lib/send-invoice-email"

interface CreateInvoiceBase {
  /** Stripe customer to bill. */
  customerId: string
  /** Account that owns the invoice. */
  accountId: string
  /** Connected Stripe account id for the platform. */
  stripeAccountId: string
  /** Athlete `people.id` — the person the invoice is FOR (not necessarily the payer). */
  personId: string
  /** Invoice amount in DOLLARS (not cents). */
  amount: number
  /** Optional override for the line-item / memo. */
  description?: string
  /** Optional roster linkage (set on the DB row even for event invoices when present). */
  rosterId?: string | null
}

interface EventRegistrationInvoice extends CreateInvoiceBase {
  kind: "event_registration"
  eventRegistrationId: string
  eventId: string
  eventName: string
  athleteName: string
}

interface RosterFeeInvoice extends CreateInvoiceBase {
  kind: "roster_fee"
  rosterId: string
  athleteName: string
  teamName: string
}

interface CustomInvoice extends CreateInvoiceBase {
  kind: "custom"
}

export type CreateInvoiceOpts =
  | EventRegistrationInvoice
  | RosterFeeInvoice
  | CustomInvoice

export interface CreateInvoiceResult {
  invoice: Stripe.Invoice
  internal_invoice: Record<string, unknown>
  resent?: boolean
  email: {
    success: boolean
    sent_count: number
    failed_count: number
    error?: string
  }
}

/**
 * Build the description / line-item label that ends up on both our internal
 * invoice row and the Stripe-hosted invoice. Mirrors the legacy fallback
 * order from `/api/invoices/route.ts`.
 */
function descriptionFor(opts: CreateInvoiceOpts): string {
  const override = opts.description?.trim()
  if (override) return override

  if (opts.kind === "event_registration") {
    return `Invoice to complete registration for ${opts.athleteName} -- ${opts.eventName}`
  }
  if (opts.kind === "roster_fee") {
    return `Invoice to complete registration for ${opts.athleteName} -- ${opts.teamName}`
  }
  return "Invoice"
}

/**
 * Create + finalize + email a Stripe invoice for any billable entity in the
 * app. Server-only — pass an authenticated/service-role supabase client.
 *
 * For event-registration invoices, we look up any existing unpaid invoice
 * with the same `event_registration_id` and resend the email instead of
 * creating a duplicate. This is the only kind with built-in idempotency
 * because it's the only kind a bulk admin action targets.
 */
export async function createInvoice(
  opts: CreateInvoiceOpts,
  supabase: SupabaseClient,
): Promise<CreateInvoiceResult> {
  if (!opts.accountId) throw new Error("Account ID is required")
  if (!opts.customerId) throw new Error("Customer ID is required")
  if (!opts.stripeAccountId) throw new Error("Stripe account ID is required")
  if (!opts.personId) throw new Error("Person ID is required")
  if (!opts.amount || opts.amount <= 0) throw new Error("Invalid amount")

  const { customerId, accountId, stripeAccountId, personId, amount } = opts
  const isEventInvoice = opts.kind === "event_registration"
  const isCustomInvoice = opts.kind === "custom"
  const rosterId = opts.rosterId ?? (opts.kind === "roster_fee" ? opts.rosterId : null)
  const invoiceDescription = descriptionFor(opts)

  // Idempotency for event invoices: resend the existing unpaid invoice
  // instead of creating a duplicate. Mirrors the prior route behavior.
  if (isEventInvoice) {
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, status, metadata, invoice_number")
      .eq("account_id", accountId)
      .eq("metadata->>event_registration_id", opts.eventRegistrationId)
      .not("status", "in", "(paid,succeeded,void)")
      .order("created_at", { ascending: false })
      .limit(1)

    const existing = existingInvoices?.[0]
    const existingStripeId = (existing?.metadata as any)?.stripe_invoice_id

    if (existing && existingStripeId) {
      const resendResult = await sendInvoiceEmail(existing.id)
      if (resendResult.success) {
        return {
          invoice: { id: existingStripeId } as Stripe.Invoice,
          internal_invoice: existing as Record<string, unknown>,
          resent: true,
          email: {
            success: true,
            sent_count: resendResult.sent_count,
            failed_count: resendResult.failed_count,
          },
        }
      }
      // Fall through and create a new one — better to over-invoice than to
      // leave the user thinking nothing happened.
      console.error(
        "Failed to resend existing event invoice; falling back to create:",
        resendResult.error,
      )
    }
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("application_fee, application_fee_flat")
    .eq("id", accountId)
    .single()

  if (accountError || !account) {
    throw new Error("Account not found for invoice")
  }

  const applicationFeeAmount = calculateApplicationFeeFromDollars(amount, account)

  const baseMetadata = {
    stripe_customer_id: customerId,
    stripe_account_id: stripeAccountId,
    application_fee_amount: applicationFeeAmount / 100,
    is_custom_invoice: isCustomInvoice,
    ...(isEventInvoice
      ? { event_registration_id: opts.eventRegistrationId, event_id: opts.eventId }
      : {}),
  }

  const { data: invoiceRecord, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      account_id: accountId,
      person_id: personId,
      amount,
      status: "draft",
      description: invoiceDescription,
      roster_id: rosterId,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: baseMetadata,
    })
    .select()
    .single()

  if (invoiceError || !invoiceRecord) {
    console.error("Supabase invoice creation error:", invoiceError)
    throw new Error(
      `Failed to create invoice record: ${invoiceError?.message ?? "unknown"}`,
    )
  }

  const stripeInvoiceParams: Stripe.InvoiceCreateParams = {
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 30,
    pending_invoice_items_behavior: "include",
    metadata: {
      invoice_id: invoiceRecord.id,
      roster_id: rosterId,
      person_id: personId,
      is_custom_invoice: String(isCustomInvoice),
      ...(isEventInvoice
        ? {
            event_registration_id: opts.eventRegistrationId,
            event_id: opts.eventId,
            account_id: accountId,
          }
        : {}),
    },
    description: invoiceDescription,
    auto_advance: false,
  }
  if (applicationFeeAmount > 0) {
    stripeInvoiceParams.application_fee_amount = applicationFeeAmount
  }

  const stripeInvoice = await stripe.invoices.create(stripeInvoiceParams, {
    stripeAccount: stripeAccountId,
  })

  await stripe.invoiceItems.create(
    {
      customer: customerId,
      amount: amount * 100,
      currency: "usd",
      invoice: stripeInvoice.id,
      description: invoiceDescription,
    },
    { stripeAccount: stripeAccountId },
  )

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(
    stripeInvoice.id,
    { auto_advance: false },
    { stripeAccount: stripeAccountId },
  )

  // For event invoices, thread the registration metadata onto the underlying
  // PaymentIntent so the existing payment_intent.succeeded webhook flips the
  // registration to "confirmed" and triggers the confirmation email.
  if (isEventInvoice) {
    const piId =
      typeof finalizedInvoice.payment_intent === "string"
        ? finalizedInvoice.payment_intent
        : finalizedInvoice.payment_intent?.id

    if (piId) {
      try {
        await stripe.paymentIntents.update(
          piId,
          {
            metadata: {
              registration_ids: opts.eventRegistrationId,
              event_id: opts.eventId,
              account_id: accountId,
              source: "invoice",
            },
          },
          { stripeAccount: stripeAccountId },
        )
      } catch (piErr) {
        console.error("Failed to update PI metadata for event invoice:", piErr)
      }
    }
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "sent",
      invoice_number: finalizedInvoice.number,
      metadata: {
        ...baseMetadata,
        stripe_invoice_id: finalizedInvoice.id,
        ...(finalizedInvoice.hosted_invoice_url
          ? { hosted_invoice_url: finalizedInvoice.hosted_invoice_url }
          : {}),
        ...(finalizedInvoice.invoice_pdf
          ? { invoice_pdf: finalizedInvoice.invoice_pdf }
          : {}),
      },
    })
    .eq("id", invoiceRecord.id)

  if (updateError) {
    throw new Error("Failed to update invoice record")
  }

  const emailResult = await sendInvoiceEmail(invoiceRecord.id)
  if (!emailResult.success) {
    console.error("Invoice email send failed:", emailResult.error)
  }

  return {
    invoice: finalizedInvoice,
    internal_invoice: invoiceRecord as Record<string, unknown>,
    email: {
      success: emailResult.success,
      sent_count: emailResult.sent_count,
      failed_count: emailResult.failed_count,
      error: emailResult.error,
    },
  }
}
