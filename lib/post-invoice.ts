/**
 * Client-side wrapper that hits `/api/stripe-customers` then `/api/invoices`
 * to create and send a Stripe invoice. Two flavors today: event-registration
 * and roster-fee. Custom invoices go through create-invoice-modal directly.
 */

interface PostInvoiceBase {
  /** Email of the billing contact / payer. */
  recipientEmail: string
  /** Optional payer person_id when billing a guardian for a dependent. */
  payerPersonId?: string
  amount: number
  accountId: string
  stripeAccountId: string
  /** Athlete `people.id`. */
  person_id: string
  /** Optional override for the line-item / memo. */
  description?: string
}

export interface PostEventInvoiceParams extends PostInvoiceBase {
  kind: "event_registration"
  eventRegistrationId: string
  eventId: string
  eventName: string
  athleteName: string
}

export interface PostRosterInvoiceParams extends PostInvoiceBase {
  kind: "roster_fee"
  rosterId: string
  athleteName: string
  teamName: string
}

export type PostInvoiceParams = PostEventInvoiceParams | PostRosterInvoiceParams

export async function postInvoice(
  params: PostInvoiceParams,
): Promise<{ resent: boolean }> {
  const {
    recipientEmail,
    payerPersonId,
    amount,
    accountId,
    stripeAccountId,
    person_id,
    description,
  } = params

  if (!recipientEmail) throw new Error("Recipient email is required")
  if (!accountId) throw new Error("Account ID is required")
  if (!stripeAccountId) throw new Error("Stripe account ID is required")
  if (!person_id) throw new Error("Person ID is required")
  if (!amount || amount <= 0) throw new Error("Invalid amount")

  const customerResponse = await fetch("/api/stripe-customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: recipientEmail,
      accountId,
      ...(payerPersonId
        ? { payerPersonId, athletePersonId: person_id }
        : {}),
    }),
  })

  const customerData = await customerResponse.json()
  if (!customerResponse.ok) {
    throw new Error(customerData.error || "Failed to create/get customer")
  }
  const { customerId, error: customerError } = customerData
  if (customerError || !customerId) {
    throw new Error(customerError || "No customer ID returned")
  }

  const trimmedDesc = description?.trim()
  const invoiceBody: Record<string, unknown> = {
    customerId,
    amount,
    accountId,
    stripeAccountId,
    person_id,
    isCustomInvoice: false,
    ...(trimmedDesc ? { description: trimmedDesc } : {}),
  }

  if (params.kind === "event_registration") {
    invoiceBody.eventRegistrationId = params.eventRegistrationId
    invoiceBody.eventId = params.eventId
    invoiceBody.eventName = params.eventName
    invoiceBody.athleteName = params.athleteName
  } else {
    invoiceBody.rosterId = params.rosterId
    invoiceBody.athleteName = params.athleteName
    invoiceBody.teamName = params.teamName
  }

  const invoiceResponse = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoiceBody),
  })

  if (!invoiceResponse.ok) {
    const errorData = await invoiceResponse.json()
    throw new Error(errorData.error || "Failed to create invoice")
  }

  const data = (await invoiceResponse.json().catch(() => ({}))) as {
    resent?: boolean
  }
  return { resent: !!data.resent }
}
