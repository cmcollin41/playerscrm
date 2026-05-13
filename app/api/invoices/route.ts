import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { calculateApplicationFeeFromDollars } from "@/lib/fees";
import { sendInvoiceEmail } from "@/lib/send-invoice-email";

export async function POST(req: Request) {
  const {
    customerId,
    rosterId,
    athleteName,
    teamName,
    amount,
    accountId,
    stripeAccountId,
    person_id,
    description,
    isCustomInvoice,
    eventRegistrationId,
    eventId,
    eventName,
  } = await req.json();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
      stripeAccount: stripeAccountId,
    });
    const supabase = await createClient();

    // Verify roster exists and belongs to this person when rosterId is provided
    if (rosterId) {
      const { data: roster, error: rosterError } = await supabase
        .from('rosters')
        .select('id, person_id')
        .eq('id', rosterId)
        .single();

      if (rosterError || !roster) {
        console.error('Roster verification error:', rosterError);
        throw new Error('Invalid roster ID');
      }
      if (roster.person_id !== person_id) {
        throw new Error('Roster does not belong to this person');
      }
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('application_fee, application_fee_flat')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found for invoice');
    }

    const applicationFeeAmount = calculateApplicationFeeFromDollars(amount, account);
    const trimmedDesc =
      typeof description === "string" ? description.trim() : "";
    let invoiceDescription: string;
    if (trimmedDesc !== "") {
      invoiceDescription = trimmedDesc;
    } else if (isCustomInvoice) {
      invoiceDescription = "Invoice";
    } else if (eventRegistrationId && eventName) {
      invoiceDescription = `Invoice to complete registration for ${athleteName} -- ${eventName}`;
    } else {
      invoiceDescription = `Invoice to complete registration for ${athleteName} -- ${teamName}`;
    }

    const resolvedRosterId = rosterId ?? null;
    const isEventInvoice = !!eventRegistrationId;

    // Idempotency for event invoices: if an unpaid invoice already exists
    // for this event_registration_id, re-send the email for the existing
    // Stripe invoice instead of creating a duplicate.
    if (isEventInvoice) {
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("id, status, metadata, invoice_number")
        .eq("account_id", accountId)
        .eq("metadata->>event_registration_id", eventRegistrationId)
        .not("status", "in", "(paid,succeeded,void)")
        .order("created_at", { ascending: false })
        .limit(1);

      const existing = existingInvoices?.[0];
      const existingStripeId = existing?.metadata?.stripe_invoice_id;

      if (existing && existingStripeId) {
        try {
          const resendResult = await sendInvoiceEmail(existing.id);
          if (!resendResult.success) {
            throw new Error(resendResult.error || "Failed to resend invoice email");
          }
          return NextResponse.json({
            invoiceId: existing.id,
            invoiceNumber: existing.invoice_number,
            resent: true,
            sent_count: resendResult.sent_count,
            failed_count: resendResult.failed_count,
          });
        } catch (resendErr: any) {
          console.error(
            "Failed to resend existing event invoice; falling back to create:",
            resendErr?.message,
          );
          // Fall through and create a new one — better to over-invoice than
          // to leave the user thinking nothing happened.
        }
      }
    }

    // Log the data we're trying to insert
    console.log('Attempting to insert invoice with data:', {
      account_id: accountId,
      person_id,
      amount,
      status: 'draft',
      description: invoiceDescription,
      roster_id: resolvedRosterId,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: {
        stripe_customer_id: customerId,
        stripe_account_id: stripeAccountId,
        application_fee_amount: applicationFeeAmount / 100,
        is_custom_invoice: isCustomInvoice
      }
    });

    // First create the invoice record in our database
    const { data: invoiceRecord, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        account_id: accountId,
        person_id,
        amount,
        status: 'draft',
        description: invoiceDescription,
        roster_id: resolvedRosterId,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: {
          stripe_customer_id: customerId,
          stripe_account_id: stripeAccountId,
          application_fee_amount: applicationFeeAmount / 100,
          is_custom_invoice: isCustomInvoice,
          ...(isEventInvoice
            ? { event_registration_id: eventRegistrationId, event_id: eventId }
            : {}),
        }
      })
      .select()
      .single();

    if (invoiceError) {
      // Log the actual error details
      console.error('Supabase invoice creation error:', invoiceError);
      throw new Error(`Failed to create invoice record: ${invoiceError.message}`);
    }

    // Create Stripe invoice
    const stripeInvoiceParams: Stripe.InvoiceCreateParams = {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      pending_invoice_items_behavior: 'include',
      metadata: {
        invoice_id: invoiceRecord.id,
        roster_id: resolvedRosterId,
        person_id,
        is_custom_invoice: isCustomInvoice,
        ...(isEventInvoice
          ? {
              event_registration_id: eventRegistrationId,
              event_id: eventId,
              account_id: accountId,
            }
          : {}),
      },
      description: invoiceDescription,
      auto_advance: false
    };
    if (applicationFeeAmount > 0) {
      stripeInvoiceParams.application_fee_amount = applicationFeeAmount;
    }
    const stripeInvoice = await stripe.invoices.create(stripeInvoiceParams, {
      stripeAccount: stripeAccountId,
    });

    // Create invoice item
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: amount * 100,
      currency: 'usd',
      invoice: stripeInvoice.id,
      description: invoiceDescription,
    }, {
      stripeAccount: stripeAccountId,
    });

    // Finalize and send the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      stripeInvoice.id,
      { auto_advance: false },
      { stripeAccount: stripeAccountId }
    );

    // For event invoices, thread the registration metadata onto the underlying
    // PaymentIntent so the existing payment_intent.succeeded webhook flips
    // the registration to "confirmed" and triggers the confirmation email.
    if (isEventInvoice) {
      const piId =
        typeof finalizedInvoice.payment_intent === "string"
          ? finalizedInvoice.payment_intent
          : finalizedInvoice.payment_intent?.id;

      if (piId) {
        try {
          await stripe.paymentIntents.update(
            piId,
            {
              metadata: {
                registration_ids: eventRegistrationId,
                event_id: eventId,
                account_id: accountId,
                source: "invoice",
              },
            },
            { stripeAccount: stripeAccountId },
          );
        } catch (piErr) {
          console.error("Failed to update PI metadata for event invoice:", piErr);
        }
      }
    }

    // Persist Stripe invoice ID + hosted URL on the DB row first so the
    // email helper can find the payment link without an extra Stripe call.
    // We skip stripe.invoices.sendInvoice on purpose — Stripe always emails
    // from invoice+statements@stripe.com, and we want all customer-facing
    // mail to come from the account's verified Resend domain instead.
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        invoice_number: finalizedInvoice.number,
        metadata: {
          ...invoiceRecord.metadata,
          stripe_invoice_id: finalizedInvoice.id,
          ...(finalizedInvoice.hosted_invoice_url
            ? { hosted_invoice_url: finalizedInvoice.hosted_invoice_url }
            : {}),
          ...(finalizedInvoice.invoice_pdf ? { invoice_pdf: finalizedInvoice.invoice_pdf } : {}),
        }
      })
      .eq('id', invoiceRecord.id);

    if (updateError) {
      throw new Error('Failed to update invoice record');
    }

    const emailResult = await sendInvoiceEmail(invoiceRecord.id);
    if (!emailResult.success) {
      console.error('Invoice email send failed:', emailResult.error);
    }

    return NextResponse.json({
      invoice: finalizedInvoice,
      internal_invoice: invoiceRecord,
      email: {
        success: emailResult.success,
        sent_count: emailResult.sent_count,
        failed_count: emailResult.failed_count,
        error: emailResult.error,
      },
    });
  } catch (error: any) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
