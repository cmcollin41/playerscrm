/**
 * Single source of truth for "is this thing paid?" across registrations,
 * roster billing rows, and invoices. The recent Nixon-Tanner bug came from
 * each call-site answering this question with its own slightly-different
 * inline check — keep callers honest by importing from here.
 */

export interface PaymentLike {
  status?: string | null
  data?: { receipt_url?: string | null } | null
}

export interface InvoiceLike {
  status?: string | null
  metadata?: { hosted_invoice_url?: string | null; invoice_pdf?: string | null } | null
}

export interface PaidEntityLike {
  payment_status?: string | null
  payments?: PaymentLike | null
  invoice?: InvoiceLike | null
}

/** A succeeded Stripe payment or a manually-marked paid registration. */
export function isPaid(entity: PaidEntityLike): boolean {
  return (
    entity.payment_status === "paid" ||
    entity.payments?.status === "succeeded" ||
    entity.invoice?.status === "paid" ||
    entity.invoice?.status === "succeeded"
  )
}

export function isWaived(entity: PaidEntityLike): boolean {
  return entity.payment_status === "waived"
}

/** Stripe invoice status, normalized — both "paid" and "succeeded" count. */
export function isInvoicePaid(invoice: InvoiceLike | null | undefined): boolean {
  if (!invoice?.status) return false
  return invoice.status === "paid" || invoice.status === "succeeded"
}

/**
 * Pick the best evidence URL for a paid-or-billed registration:
 *   1. Invoice marked paid → invoice URL (has line itemization)
 *   2. Stripe payment succeeded → charge receipt URL
 *   3. Outstanding invoice → invoice URL (to pay)
 *   4. Else → null
 *
 * Mirrors the precedence used in the admin event-detail Receipt/Invoice
 * button; keeping it in one place prevents Nixon-style drift.
 */
export function getPaymentEvidenceUrl(
  entity: PaidEntityLike,
): { kind: "receipt" | "invoice"; url: string } | null {
  const invoice = entity.invoice
  const invoiceUrl = invoice?.metadata?.hosted_invoice_url || null
  const receiptUrl = entity.payments?.data?.receipt_url || null
  const stripePaid = entity.payments?.status === "succeeded"

  if (isInvoicePaid(invoice) && invoiceUrl) {
    return { kind: "receipt", url: invoiceUrl }
  }
  if (stripePaid && receiptUrl) {
    return { kind: "receipt", url: receiptUrl }
  }
  if (invoice && invoiceUrl) {
    return { kind: "invoice", url: invoiceUrl }
  }
  return null
}
