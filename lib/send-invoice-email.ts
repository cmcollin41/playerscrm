import Stripe from "stripe"
import { sendTransactionalEmail } from "@/lib/email-service"
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
    .select(
      `
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
        stripe_id,
        default_invoice_sender_id,
        default_sender_id,
        senders (
          id,
          name,
          email
        )
      )
    `,
    )
    .eq("id", invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return {
      success: false,
      sent_count: 0,
      failed_count: 0,
      error: "Invoice not found",
    }
  }

  const recipients: Recipient[] = []

  if (invoice.person?.email) {
    recipients.push({
      email: invoice.person.email,
      name: invoice.person.first_name || invoice.person.name || "there",
      person_id: invoice.person.id,
    })
  }

  if (invoice.person?.dependent) {
    const { data: relationships } = await supabase
      .from("relationships")
      .select("person_id")
      .eq("relation_id", invoice.person.id)
      .eq("primary", true)

    if (relationships && relationships.length > 0) {
      const guardianIds = relationships.map((r: any) => r.person_id)
      const { data: guardians } = await supabase
        .from("people")
        .select("id, email, first_name, name")
        .in("id", guardianIds)

      if (guardians) {
        for (const guardian of guardians) {
          if (
            guardian.email &&
            !recipients.some((r) => r.email === guardian.email)
          ) {
            recipients.push({
              email: guardian.email,
              name: guardian.first_name || guardian.name || "there",
              person_id: guardian.id,
            })
          }
        }
      }
    }
  }

  if (recipients.length === 0) {
    return {
      success: false,
      sent_count: 0,
      failed_count: 0,
      error: "No email address found for recipient or their guardian(s)",
    }
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
      return {
        success: false,
        sent_count: 0,
        failed_count: 0,
        error:
          "No Stripe invoice found for this invoice. Cannot generate payment link.",
      }
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
    return {
      success: false,
      sent_count: 0,
      failed_count: 0,
      error:
        "Stripe invoice has no payment link. It may have been voided or already paid.",
    }
  }

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(invoice.amount || 0)

  const emailSubject = `Invoice ${invoice.invoice_number || invoice.id.slice(0, 8)} from ${invoice.account.name}`

  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${emailSubject}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .content { padding: 20px 0; }
              .invoice-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">${invoice.account.name}</h1>
              <p style="margin: 10px 0 0 0; color: #6c757d;">Invoice</p>
            </div>

            <div class="content">
              <p>Hello ${recipient.name},</p>

              <p>You have an invoice from <strong>${invoice.account.name}</strong>:</p>

              <div class="invoice-details">
                <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoice_number || invoice.id.slice(0, 8)}</p>
                <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${formattedAmount}</p>
                ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ""}
                ${invoice.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${invoice.description}</p>` : ""}
              </div>

              <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600;">Pay Invoice</a>

              <p>Or copy and paste this link into your browser:<br>
              <a href="${paymentLink}">${paymentLink}</a></p>

              <p>If you have any questions about this invoice, please contact ${invoice.account.name}.</p>
            </div>

            <div class="footer">
              <p>This is an automated message from ${invoice.account.name}.</p>
            </div>
          </body>
        </html>
      `

    const emailText = `
Invoice from ${invoice.account.name}

Hello ${recipient.name},

You have an invoice from ${invoice.account.name}:

Invoice Number: ${invoice.invoice_number || invoice.id.slice(0, 8)}
Amount Due: ${formattedAmount}
${invoice.due_date ? `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
${invoice.description ? `Description: ${invoice.description}` : ""}

To pay this invoice, please visit:
${paymentLink}

If you have any questions about this invoice, please contact ${invoice.account.name}.
      `.trim()

    const result = await sendTransactionalEmail({
      sender,
      to: recipient.email,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
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
