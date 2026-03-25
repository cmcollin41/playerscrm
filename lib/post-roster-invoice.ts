/**
 * Create & send a Stripe roster fee invoice (non-custom line item).
 */
export interface PostRosterInvoiceParams {
  rosterId: string;
  athleteName: string;
  teamName: string;
  amount: number;
  guardianEmail: string;
  accountId: string;
  stripeAccountId: string;
  person_id: string;
}

export async function postRosterInvoice(
  params: PostRosterInvoiceParams,
): Promise<void> {
  const {
    rosterId,
    athleteName,
    teamName,
    amount,
    guardianEmail,
    accountId,
    stripeAccountId,
    person_id,
  } = params;

  if (!rosterId) throw new Error("Invalid roster ID");
  if (!guardianEmail) throw new Error("Guardian email is required");
  if (!accountId) throw new Error("Account ID is required");
  if (!stripeAccountId) throw new Error("Stripe account ID is required");
  if (!person_id) throw new Error("Person ID is required");
  if (!amount || amount <= 0) throw new Error("Invalid amount");

  const customerResponse = await fetch("/api/stripe-customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: guardianEmail, accountId }),
  });

  const customerData = await customerResponse.json();
  if (!customerResponse.ok) {
    throw new Error(customerData.error || "Failed to create/get customer");
  }
  const { customerId, error: customerError } = customerData;
  if (customerError || !customerId) {
    throw new Error(customerError || "No customer ID returned");
  }

  const invoiceResponse = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      rosterId,
      athleteName,
      teamName,
      amount,
      accountId,
      stripeAccountId,
      person_id,
      isCustomInvoice: false,
    }),
  });

  if (!invoiceResponse.ok) {
    const errorData = await invoiceResponse.json();
    throw new Error(errorData.error || "Failed to create invoice");
  }
}
