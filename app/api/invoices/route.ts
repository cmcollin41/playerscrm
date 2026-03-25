import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

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
    isCustomInvoice
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

    const applicationFeeAmount = Math.round(amount * 100 * 0.03);
    const invoiceDescription = isCustomInvoice 
      ? description
      : `Team Roster Fee - ${athleteName} - ${teamName}`;

    const resolvedRosterId = rosterId ?? null;

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
          is_custom_invoice: isCustomInvoice
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
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      pending_invoice_items_behavior: 'include',
      application_fee_amount: applicationFeeAmount,
      metadata: {
        invoice_id: invoiceRecord.id,
        roster_id: resolvedRosterId,
        person_id,
        is_custom_invoice: isCustomInvoice
      },
      description: invoiceDescription,
      auto_advance: false
    }, {
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

    const sentInvoice = await stripe.invoices.sendInvoice(
      finalizedInvoice.id, 
      { stripeAccount: stripeAccountId }
    );

    // Update invoice status and add Stripe invoice ID
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        status: 'sent',
        invoice_number: sentInvoice.number,
        metadata: {
          ...invoiceRecord.metadata,
          stripe_invoice_id: sentInvoice.id
        }
      })
      .eq('id', invoiceRecord.id);

    if (updateError) {
      throw new Error('Failed to update invoice record');
    }

    return NextResponse.json({ 
      invoice: sentInvoice,
      internal_invoice: invoiceRecord
    });
  } catch (error: any) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
