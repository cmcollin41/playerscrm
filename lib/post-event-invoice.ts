/**
 * Create & send a Stripe invoice for an event registration.
 * Pairs with the existing payment_intent.succeeded webhook, which auto-flips
 * the registration to "confirmed" and emails the confirmation when paid.
 */
export interface PostEventInvoiceParams {
  eventRegistrationId: string
  eventId: string
  eventName: string
  athleteName: string
  amount: number
  recipientEmail: string
  /** Payer's `people.id` when the recipient is a guardian (not the athlete) */
  payerPersonId?: string
  /** Overrides default "Event Registration - …" line item / memo */
  description?: string
  accountId: string
  stripeAccountId: string
  /** The athlete's `people.id` (the person being registered) */
  person_id: string
}

export async function postEventInvoice(
  params: PostEventInvoiceParams,
): Promise<{ resent: boolean }> {
  const {
    eventRegistrationId,
    eventId,
    eventName,
    athleteName,
    amount,
    recipientEmail,
    payerPersonId,
    description,
    accountId,
    stripeAccountId,
    person_id,
  } = params

  if (!eventRegistrationId) throw new Error("Event registration ID is required")
  if (!eventId) throw new Error("Event ID is required")
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

  const invoiceResponse = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      eventRegistrationId,
      eventId,
      eventName,
      athleteName,
      amount,
      accountId,
      stripeAccountId,
      person_id,
      isCustomInvoice: false,
      ...(description?.trim() ? { description: description.trim() } : {}),
    }),
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
