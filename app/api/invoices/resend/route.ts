import { NextResponse } from "next/server"
import { sendTransactionalEmail } from "@/lib/email-service"
import { createClient } from "@/lib/supabase/server"
import Stripe from "stripe"

export const maxDuration = 60

/**
 * Resend invoice email
 * Migrated to use unified email service
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      )
    }

    // Fetch invoice with all related data
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
        roster:rosters (
          id,
          team:teams (
            id,
            name
          )
        ),
        account:accounts (
          id,
          name,
          stripe_id,
          senders (
            id,
            name,
            email
          )
        )
      `
      )
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoice) {
      console.error("Invoice fetch error:", invoiceError)
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Verify user has access to this invoice's account
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single()

    if (profile?.account_id !== invoice.account_id) {
      return NextResponse.json(
        { error: "Unauthorized access to invoice" },
        { status: 403 }
      )
    }

    // Get recipient email — if the person is a dependent, look up their parent/guardian
    let recipientEmail = invoice.person?.email
    let recipientName = invoice.person?.first_name || invoice.person?.name || "there"

    if (!recipientEmail && invoice.person?.dependent) {
      const { data: relationship } = await supabase
        .from("relationships")
        .select("person_id")
        .eq("relation_id", invoice.person.id)
        .eq("primary", true)
        .single()

      if (relationship) {
        const { data: guardian } = await supabase
          .from("people")
          .select("email, first_name, name")
          .eq("id", relationship.person_id)
          .single()

        if (guardian?.email) {
          recipientEmail = guardian.email
          recipientName = guardian.first_name || guardian.name || recipientName
        }
      }
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "No email address found for recipient or their guardian" },
        { status: 400 }
      )
    }

    // Determine sender
    const sender = invoice.account?.senders?.[0]?.email
      ? `${invoice.account.name} <${invoice.account.senders[0].email}>`
      : null

    if (!sender) {
      return NextResponse.json(
        { error: "No sender email configured for account" },
        { status: 400 }
      )
    }

    // Retrieve the Stripe hosted invoice URL for payment
    const stripeInvoiceId = invoice.metadata?.stripe_invoice_id
    const stripeAccountId = invoice.account?.stripe_id || invoice.metadata?.stripe_account_id

    if (!stripeInvoiceId || !stripeAccountId) {
      return NextResponse.json(
        { error: "No Stripe invoice found for this invoice. Cannot generate payment link." },
        { status: 400 }
      )
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
    })

    const stripeInvoice = await stripe.invoices.retrieve(
      stripeInvoiceId,
      { stripeAccount: stripeAccountId }
    )

    const paymentLink = stripeInvoice.hosted_invoice_url
    if (!paymentLink) {
      return NextResponse.json(
        { error: "Stripe invoice has no payment link. It may have been voided or already paid." },
        { status: 400 }
      )
    }

    // Format amount
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format((invoice.amount || 0) / 100)

    // Prepare email content
    const emailSubject = `Invoice ${invoice.invoice_number || invoice.id.slice(0, 8)} from ${invoice.account.name}`
    
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
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">${invoice.account.name}</h1>
            <p style="margin: 10px 0 0 0; color: #6c757d;">Invoice</p>
          </div>
          
          <div class="content">
            <p>Hello ${recipientName},</p>
            
            <p>You have an invoice from <strong>${invoice.account.name}</strong>:</p>
            
            <div class="invoice-details">
              <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoice_number || invoice.id.slice(0, 8)}</p>
              <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${formattedAmount}</p>
              ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ""}
              ${invoice.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${invoice.description}</p>` : ""}
            </div>
            
            <a href="${paymentLink}" class="button">Pay Invoice</a>
            
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

Hello ${recipientName},

You have an invoice from ${invoice.account.name}:

Invoice Number: ${invoice.invoice_number || invoice.id.slice(0, 8)}
Amount Due: ${formattedAmount}
${invoice.due_date ? `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
${invoice.description ? `Description: ${invoice.description}` : ""}

To pay this invoice, please visit:
${paymentLink}

If you have any questions about this invoice, please contact ${invoice.account.name}.
    `.trim()

    // Send via unified email service
    const result = await sendTransactionalEmail({
      sender,
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      account_id: invoice.account_id,
      person_id: invoice.person_id,
      metadata: {
        type: "invoice",
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send invoice email", details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully",
      data: result.data,
    })
  } catch (error: any) {
    console.error("Error in /api/invoices/resend:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    )
  }
}
