import { stripe } from "@/lib/stripe";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { sendEventConfirmations } from "@/lib/events/event-confirmation";
import { NextResponse } from "next/server";


// Disable body parsing, we need the raw body for Stripe signature verification
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  // Stripe webhooks have no auth cookies — use the service-role admin client
  // so cross-tenant updates (event_registrations, payments) aren't filtered
  // by anon RLS.
  const supabase = createAdminClient();

  // Get the raw body as bytes — avoids any utf-8 decode/encode round trip
  // that can subtly mutate the signed payload.
  const rawBody = Buffer.from(await req.arrayBuffer());

  const signature = req.headers.get("stripe-signature");

  // Both the platform endpoint and the Connect endpoint deliver to this same
  // URL. Stripe does not send a `Stripe-Account` request header on webhook
  // deliveries (the connected account id is only inside the signed body),
  // so we can't pick a secret up-front. Try platform first, then connect —
  // whichever verifies wins.
  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET_KEY;

  if (!signature) {
    console.error("[stripe-webhook] missing stripe-signature header");
    return NextResponse.json(
      { message: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  if (!platformSecret && !connectSecret) {
    console.error("[stripe-webhook] no webhook secrets configured");
    return NextResponse.json(
      { message: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const candidates: Array<{ name: "platform" | "connect"; secret: string }> = [];
  if (platformSecret) candidates.push({ name: "platform", secret: platformSecret });
  if (connectSecret) candidates.push({ name: "connect", secret: connectSecret });

  let event: any = null;
  let verifiedWith: "platform" | "connect" | null = null;
  let lastError: any = null;

  for (const c of candidates) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, c.secret);
      verifiedWith = c.name;
      break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!event) {
    console.error("[stripe-webhook] signature verification failed against all secrets", {
      message: lastError?.message,
      tried: candidates.map((c) => c.name),
    });
    return NextResponse.json(
      { message: `Signature verification failed: ${lastError?.message || "unknown"}` },
      { status: 400 },
    );
  }

  console.log("[stripe-webhook] verified event", {
    type: event.type,
    id: event.id,
    livemode: event.livemode,
    account: event.account || null,
    verified_with: verifiedWith,
  });

  try {
    switch (event.type) {
      case "payment_intent.created":
      case "payment_intent.canceled":
      case "payment_intent.processing":
      case "payment_intent.payment_failed":
      case "payment_intent.succeeded":
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_succeeded":
      case "invoice.voided":
        await updateSupabase(event, supabase);
        break;
      default:
        console.log(`[stripe-webhook] unhandled event type ${event.type}`);
        // Return 200 so Stripe doesn't retry events we don't care about.
        return NextResponse.json(
          { message: "Unhandled event type — ignored" },
          { status: 200 },
        );
    }

    return NextResponse.json(
      { message: "EVENT PROCESSED SUCCESSFULLY" },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("[stripe-webhook] handler error", {
      type: event?.type,
      id: event?.id,
      message: err?.message,
      stack: err?.stack,
    });
    return NextResponse.json(
      { message: `Handler error: ${err?.message || "unknown"}` },
      { status: 500 },
    );
  }
}

const updateSupabase = async (event: any, supabase: any) => {
  // Handle invoice events
  if (event.type.startsWith('invoice.')) {
    const stripeInvoice = event.data.object;
    const status = getStatusFromInvoiceEvent(event.type);
    const mappedStatus = status === 'succeeded' ? 'paid' : status;

    let invoiceId = stripeInvoice.metadata?.invoice_id;
    let existingMetadata: Record<string, any> = {};

    // Fallback: if metadata.invoice_id is missing, look up by stripe_invoice_id
    if (!invoiceId && stripeInvoice.id) {
      const { data: matchedInvoice } = await supabase
        .from("invoices")
        .select("id, metadata")
        .eq("metadata->>stripe_invoice_id", stripeInvoice.id)
        .maybeSingle();

      if (matchedInvoice) {
        invoiceId = matchedInvoice.id;
        existingMetadata = matchedInvoice.metadata || {};
      }
    } else if (invoiceId) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("metadata")
        .eq("id", invoiceId)
        .maybeSingle();
      existingMetadata = existing?.metadata || {};
    }

    if (!invoiceId) {
      console.log("Could not resolve Supabase invoice ID for Stripe invoice:", stripeInvoice.id);
      return;
    }

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        status: mappedStatus,
        metadata: {
          ...existingMetadata,
          stripe_invoice_id: stripeInvoice.id,
          last_event: event.type,
          updated_at: new Date().toISOString(),
        }
      })
      .eq("id", invoiceId);

    if (invoiceError) {
      console.log("Error updating invoice status:", invoiceError);
      throw new Error(`invoice update failed: ${invoiceError.message}`);
    }

    console.log(`Invoice ${invoiceId} updated to status: ${mappedStatus}`);

    // If payment was successful, create a payment record (avoid duplicates)
    if (status === 'succeeded') {
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("invoice_id", invoiceId)
        .eq("status", "succeeded")
        .maybeSingle();

      if (!existingPayment) {
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            invoice_id: invoiceId,
            person_id: stripeInvoice.metadata?.person_id || null,
            account_id: stripeInvoice.metadata?.account_id || null,
            amount: stripeInvoice.amount_paid / 100,
            status: 'succeeded',
            payment_method: 'stripe',
            payment_intent_id: typeof stripeInvoice.payment_intent === 'string'
              ? stripeInvoice.payment_intent
              : stripeInvoice.payment_intent?.id || null,
          });

        if (paymentError) {
          console.log("Error creating payment record:", paymentError);
          throw new Error(`payment row write failed: ${paymentError.message}`);
        }
      } else {
        console.log(`Payment record already exists for invoice ${invoiceId}, skipping`);
      }
    }

    return;
  }

  // Handle payment intent events (for non-invoice payments)
  if (event.type.startsWith('payment_intent.')) {
    const paymentIntent = event.data.object;
    const piMetadata = paymentIntent.metadata || {};

    // Event registration flow — identified by registration_ids + event_id in metadata
    if (piMetadata.registration_ids && piMetadata.event_id) {
      const registrationIds = String(piMetadata.registration_ids)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Update payments row status (matched by payment_intent_id)
      await supabase
        .from("payments")
        .update({ status: paymentIntent.status })
        .eq("payment_intent_id", paymentIntent.id);

      if (event.type === "payment_intent.succeeded" && registrationIds.length > 0) {
        // Idempotency guard: only flip + email if at least one reg is still pending
        const { data: existingRegs } = await supabase
          .from("event_registrations")
          .select("id, status")
          .in("id", registrationIds);

        const needsConfirm = (existingRegs || []).some(
          (r: any) => r.status !== "confirmed"
        );

        if (needsConfirm) {
          await supabase
            .from("event_registrations")
            .update({ status: "confirmed" })
            .in("id", registrationIds);

          try {
            await sendEventConfirmations({
              eventId: piMetadata.event_id,
              registrationIds,
              supabase,
            });
          } catch (emailErr) {
            console.error("Event confirmation email failed:", emailErr);
          }
        }
      } else if (event.type === "payment_intent.canceled" && registrationIds.length > 0) {
        await supabase
          .from("event_registrations")
          .update({ status: "cancelled" })
          .in("id", registrationIds);
      }

      return;
    }

    // Only create/update payment record if we have an invoice_id in metadata
    if (paymentIntent.metadata.invoice_id) {
      const { error: paymentError } = await supabase
        .from("payments")
        .upsert({
          invoice_id: paymentIntent.metadata.invoice_id,
          person_id: paymentIntent.metadata.person_id,
          account_id: paymentIntent.metadata.account_id,
          amount: paymentIntent.amount / 100,
          status: paymentIntent.status,
          payment_method: 'stripe',
          metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            payment_method_details: paymentIntent.payment_method_details
          }
        });

      if (paymentError) {
        console.log("Error updating payment record:", paymentError);
        throw new Error(`payment row write failed: ${paymentError.message}`);
      }
    }
  }

  // Handle metadata updates (existing code)
  const metadata = event.data.object.metadata;
  if (metadata && metadata.rsvp && event.data.object.status === "succeeded") {
    console.log("Updating rsvp for single entry", JSON.stringify(metadata));
    const { error: rsvpError } = await supabase
      .from("rsvp")
      .update({
        status: "paid",
      })
      .eq("id", metadata.rsvp);

    if (rsvpError) console.log(rsvpError, "----- RSVP webhook update error");

    console.log("Multi RSVP Updated successfully", JSON.stringify(metadata));
  } else if (
    metadata &&
    metadata.rsvp_ids &&
    event.data.object.status === "succeeded"
  ) {
    console.log("Updating rsvp for multiple entry", JSON.stringify(metadata));
    const rsvpIds = metadata.rsvp_ids.split(",");
    const { error: rsvpError } = await supabase
      .from("rsvp")
      .update({
        status: "paid",
      })
      .in("id", rsvpIds)
      .single();

    if (rsvpError)
      console.log(rsvpError, "----- Multiple RSVP webhook update error");

    console.log("Multi RSVP Updated successfully", JSON.stringify(metadata));
  }
};

// Valid statuses: draft, sent, paid, void, overdue
function getStatusFromInvoiceEvent(eventType: string): string {
  switch (eventType) {
    case 'invoice.created':
      return 'draft'
    case 'invoice.finalized':
      return 'sent'
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return 'succeeded'
    case 'invoice.payment_failed':
      return 'overdue'
    case 'invoice.voided':
      return 'void'
    default:
      return 'sent'
  }
}

