import { stripe } from "@/lib/stripe";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { sendEventConfirmations } from "@/lib/events/event-confirmation";
import { sendReceiptEmail } from "@/lib/send-invoice-email";
import { dispatchPaidOrder } from "@/lib/store/dispatch-order";
import { cancelRegistrationDispatchesOnRefund } from "@/lib/events/dispatch-registration-products";
import { getEventIntegrations } from "@/lib/integrations/install";
import { getServerHooks } from "@/lib/integrations/server";
import { resolveInvoiceStatus } from "@/lib/invoice-status";
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
      // Platform subscription lifecycle (the $99/yr PlayersCRM plan).
      // These events arrive on the platform webhook with event.account = null
      // and carry an account_id in subscription.metadata, set by
      // createSubscriptionCheckoutSession in lib/billing.ts.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handlePlatformSubscription(event, supabase);
        break;
      case "checkout.session.completed":
        await handlePlatformCheckoutCompleted(event, supabase);
        break;

      // Connect-side tenant payments / invoices (existing flow).
      case "payment_intent.created":
      case "payment_intent.canceled":
      case "payment_intent.processing":
      case "payment_intent.payment_failed":
      case "payment_intent.succeeded":
      case "charge.refunded":
      case "checkout.session.expired":
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
  // Checkout Session abandoned/timed out — flip any still-pending
  // registrations linked to this session's payment to "cancelled".
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;

    // Match by checkout session id, not PI id. The PI may not exist
    // (customer never opened the checkout page), and even when it does we
    // don't store it on the payment row until payment_intent.succeeded
    // backfills it.
    const { data: pay } = await supabase
      .from("payments")
      .select("id")
      .eq("data->>stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (!pay) return;

    // Filter on payment_id so a re-attempt that re-pointed regs to a newer
    // payment row is left alone.
    await supabase
      .from("event_registrations")
      .update({ status: "cancelled" })
      .eq("payment_id", pay.id)
      .eq("status", "pending");

    await supabase
      .from("payments")
      .update({ status: "expired" })
      .eq("id", pay.id)
      .eq("status", "pending");

    return;
  }

  // Refund of an event registration that bundled products → cancel any
  // unfulfilled partner orders we created so the org doesn't get stuck with
  // print costs for a cancelled registrant.
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (paymentIntentId) {
      try {
        await cancelRegistrationDispatchesOnRefund({ paymentIntentId });
      } catch (err) {
        console.error("Registration refund cancellation failed:", err);
      }
    }
    return;
  }

  // Handle invoice events
  if (event.type.startsWith('invoice.')) {
    const stripeInvoice = event.data.object;
    const status = getStatusFromInvoiceEvent(event.type);
    const mappedStatus = status === 'succeeded' ? 'paid' : status;

    let invoiceId = stripeInvoice.metadata?.invoice_id;
    let existingMetadata: Record<string, any> = {};
    let currentStatus: string | null = null;
    let invoiceRow: { account_id: string | null; person_id: string | null } | null = null;

    // Fallback: if metadata.invoice_id is missing, look up by stripe_invoice_id
    if (!invoiceId && stripeInvoice.id) {
      const { data: matchedInvoice } = await supabase
        .from("invoices")
        .select("id, metadata, status, account_id, person_id")
        .eq("metadata->>stripe_invoice_id", stripeInvoice.id)
        .maybeSingle();

      if (matchedInvoice) {
        invoiceId = matchedInvoice.id;
        existingMetadata = matchedInvoice.metadata || {};
        currentStatus = matchedInvoice.status ?? null;
        invoiceRow = { account_id: matchedInvoice.account_id ?? null, person_id: matchedInvoice.person_id ?? null };
      }
    } else if (invoiceId) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("metadata, status, account_id, person_id")
        .eq("id", invoiceId)
        .maybeSingle();
      existingMetadata = existing?.metadata || {};
      currentStatus = existing?.status ?? null;
      invoiceRow = existing ? { account_id: existing.account_id ?? null, person_id: existing.person_id ?? null } : null;
    }

    if (!invoiceId) {
      console.log("Could not resolve Supabase invoice ID for Stripe invoice:", stripeInvoice.id);
      return;
    }

    const nextStatus = resolveInvoiceStatus(currentStatus, mappedStatus);

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        status: nextStatus,
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

    console.log(`Invoice ${invoiceId} updated to status: ${nextStatus}`);

    // If payment was successful, mark any linked event registration as paid.
    if (mappedStatus === 'paid') {
      const linkedRegId = existingMetadata?.event_registration_id
      if (linkedRegId) {
        await supabase
          .from("event_registrations")
          .update({ payment_status: "paid" })
          .eq("id", linkedRegId)
          .is("payment_status", null)
      }
    }

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
            person_id: invoiceRow?.person_id || stripeInvoice.metadata?.person_id || null,
            account_id: invoiceRow?.account_id || stripeInvoice.metadata?.account_id || null,
            amount: stripeInvoice.amount_paid / 100,
            status: 'succeeded',
            payment_method: 'stripe',
            payment_intent_id: typeof stripeInvoice.payment_intent === 'string'
              ? stripeInvoice.payment_intent
              : stripeInvoice.payment_intent?.id || null,
          });

        // 23505 = unique_violation. Stripe sometimes re-delivers
        // invoice.payment_succeeded within milliseconds; the partial unique
        // index payments_invoice_succeeded_uniq absorbs the race even when
        // both deliveries pass the check above.
        if (paymentError && paymentError.code !== "23505") {
          console.log("Error creating payment record:", paymentError);
          throw new Error(`payment row write failed: ${paymentError.message}`);
        }

        // The payment row is the once-only guard: only the delivery that
        // actually inserted it sends the receipt. A failed email must not
        // fail the webhook, or Stripe would retry an already-recorded payment.
        if (!paymentError) {
          try {
            const paidAtSeconds = stripeInvoice.status_transitions?.paid_at;
            const receipt = await sendReceiptEmail({
              supabase,
              invoiceId,
              amountPaid: stripeInvoice.amount_paid / 100,
              paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000) : new Date(),
              receiptLink: stripeInvoice.hosted_invoice_url,
            });
            if (!receipt.success) {
              console.error(`Receipt email not sent for invoice ${invoiceId}:`, receipt.error);
            }
          } catch (receiptErr) {
            console.error(`Receipt email failed for invoice ${invoiceId}:`, receiptErr);
          }
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

    // Storefront order flow — identified by store_order_id in metadata
    // (set in app/api/checkout/store/route.ts).
    if (piMetadata.store_order_id) {
      await handleStoreOrderPaymentIntent(event, paymentIntent, supabase);
      return;
    }

    // Event registration flow — identified by registration_ids + event_id in metadata
    if (piMetadata.registration_ids && piMetadata.event_id) {
      const registrationIds = String(piMetadata.registration_ids)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Resolve the payment row. Legacy direct-PI rows have payment_intent_id
      // set at insert time; Checkout Session rows don't know the PI id until
      // this webhook fires, so we backfill via the registration linkage.
      const { data: byPi } = await supabase
        .from("payments")
        .select("id")
        .eq("payment_intent_id", paymentIntent.id);

      let paymentIds: string[] = (byPi ?? []).map((p: any) => p.id);

      if (paymentIds.length) {
        await supabase
          .from("payments")
          .update({ status: paymentIntent.status })
          .in("id", paymentIds);
      } else if (event.type === "payment_intent.succeeded") {
        // Checkout Session path — fall back to the registration linkage and
        // backfill payment_intent_id. Scoped to .succeeded because if the
        // user re-registered after abandonment, the regs now point at a
        // newer payment row and a .canceled fallback would mis-cancel it.
        const { data: linkedRegs } = await supabase
          .from("event_registrations")
          .select("payment_id")
          .in("id", registrationIds);
        paymentIds = Array.from(
          new Set(
            (linkedRegs ?? [])
              .map((r: any) => r.payment_id)
              .filter(Boolean)
          )
        ) as string[];
        if (paymentIds.length) {
          await supabase
            .from("payments")
            .update({
              status: paymentIntent.status,
              payment_intent_id: paymentIntent.id,
            })
            .in("id", paymentIds);
        }
      }

      if (event.type === "payment_intent.succeeded" && registrationIds.length > 0) {
        // Capture the Stripe-hosted receipt URL so the registrations table
        // can show a "Receipt" link for Checkout-paid registrants (who
        // never had an invoice generated on our side).
        const latestChargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id || null;

        if (latestChargeId && paymentIds.length) {
          try {
            const charge = await stripe.charges.retrieve(
              latestChargeId,
              event.account ? { stripeAccount: event.account } : undefined,
            );
            if (charge.receipt_url) {
              const { data: existing } = await supabase
                .from("payments")
                .select("id, data")
                .in("id", paymentIds);
              for (const p of existing ?? []) {
                await supabase
                  .from("payments")
                  .update({
                    data: { ...(p.data ?? {}), receipt_url: charge.receipt_url },
                  })
                  .eq("id", p.id);
              }
            }
          } catch (err) {
            console.error("Failed to fetch charge for receipt URL:", err);
          }
        }

        // Always backfill payment_status — replays should heal rows whose
        // status was confirmed but never got payment_status set.
        await supabase
          .from("event_registrations")
          .update({ payment_status: "paid" })
          .in("id", registrationIds)
          .is("payment_status", null);

        // Idempotency guard: only flip status + email if at least one reg is
        // still pending — avoids re-sending confirmation emails on replay.
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

          // Fan out post-payment hooks to every integration installed on
          // this event. Each one handles its own follow-on work (e.g. the
          // bundled-products integration dispatches to Printify/Printful).
          try {
            const installedIntegrations = await getEventIntegrations(
              piMetadata.event_id,
              supabase,
            );
            for (const installed of installedIntegrations) {
              const hooks = getServerHooks(installed.integration.slug);
              if (!hooks.onRegistrationConfirmed) continue;
              try {
                await hooks.onRegistrationConfirmed(
                  {
                    eventId: piMetadata.event_id,
                    registrationIds,
                    stripePaymentIntentId: paymentIntent.id,
                    admin: supabase,
                  },
                  installed.config,
                );
              } catch (hookErr) {
                console.error(
                  `[integrations] ${installed.integration.slug}.onRegistrationConfirmed failed:`,
                  hookErr,
                );
              }
            }
          } catch (dispatchErr) {
            console.error(
              "Event onRegistrationConfirmed dispatch failed:",
              dispatchErr,
            );
          }
        }
      } else if (event.type === "payment_intent.canceled" && paymentIds.length) {
        // Cancel only registrations still linked to THIS payment. A
        // re-attempt would have re-pointed regs to a newer payment_id, so
        // this filter prevents stomping the new pending state.
        await supabase
          .from("event_registrations")
          .update({ status: "cancelled" })
          .in("payment_id", paymentIds)
          .eq("status", "pending");
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

// =============================================================================
// Platform subscription handlers
// =============================================================================

// Map Stripe subscription.status to our public.accounts.subscription_status
// check constraint values.
function mapSubscriptionStatus(stripeStatus: string | undefined): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "incomplete";
  }
}

async function applySubscriptionToAccount(
  supabase: any,
  accountId: string,
  subscription: any,
): Promise<void> {
  const mapped = mapSubscriptionStatus(subscription?.status);
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const patch: Record<string, unknown> = {
    subscription_id: subscription?.id ?? null,
    subscription_status: mapped,
    subscription_current_period_end: periodEnd,
  };

  const { error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", accountId);

  if (error) {
    console.error(
      "[stripe-webhook] account subscription update failed",
      error.message,
    );
    throw new Error(
      `accounts subscription update failed: ${error.message}`,
    );
  }

  console.log(
    `[stripe-webhook] account ${accountId} -> ${mapped} (sub ${subscription?.id})`,
  );
}

async function handlePlatformSubscription(
  event: any,
  supabase: any,
): Promise<void> {
  // Only platform-side events should hit this path. Connect-account
  // subscription events (none of our tenants currently have any) would
  // arrive with event.account set; skip those defensively.
  if (event.account) {
    console.log(
      `[stripe-webhook] ignoring Connect subscription event for account ${event.account}`,
    );
    return;
  }

  const subscription = event.data.object;
  const accountId = subscription?.metadata?.account_id as string | undefined;

  if (!accountId) {
    console.warn(
      "[stripe-webhook] subscription event missing metadata.account_id",
      { id: subscription?.id, type: event.type },
    );
    return;
  }

  await applySubscriptionToAccount(supabase, accountId, subscription);
}

// Safety net for the synchronous update done by /billing/success — if a
// user closes the tab before being redirected back, this still runs.
async function handlePlatformCheckoutCompleted(
  event: any,
  supabase: any,
): Promise<void> {
  if (event.account) return; // Connect Checkout sessions are tenant payment flows.

  const session = event.data.object;
  if (session?.mode !== "subscription") return;

  const accountId =
    (session.metadata?.account_id as string | undefined) ??
    (session.client_reference_id as string | undefined);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!accountId || !subscriptionId) {
    console.warn(
      "[stripe-webhook] checkout.session.completed missing account_id or subscription",
      { session: session?.id },
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applySubscriptionToAccount(supabase, accountId, subscription);
}

// =============================================================================
// Storefront order helpers (store model b)
// =============================================================================

async function handleStoreOrderPaymentIntent(
  event: any,
  paymentIntent: any,
  supabase: any,
): Promise<void> {
  const orderId = paymentIntent.metadata.store_order_id as string;

  // Backfill the PI id on the order row in case it wasn't written at create
  // time (defensive — the checkout route does write it).
  if (event.type === "payment_intent.succeeded") {
    const { error: updateErr } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", orderId)
      .neq("status", "paid");

    if (updateErr) {
      console.error("[stripe-webhook] store_orders paid update failed", updateErr.message);
      throw new Error(`store_orders update failed: ${updateErr.message}`);
    }

    // Push to fulfillment partners. Synchronous on purpose — Printify
    // createOrder is fast (sub-second) and partner-side errors should land
    // on the dispatch row so the dashboard can surface them. Failures here
    // do NOT bubble up; the order is paid regardless of partner outcome.
    try {
      const results = await dispatchPaidOrder(orderId);
      console.log("[stripe-webhook] store order dispatched", {
        orderId,
        results,
      });
    } catch (err) {
      console.error("[stripe-webhook] store order dispatch failed", {
        orderId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    await supabase
      .from("store_orders")
      .update({ status: "failed" })
      .eq("id", orderId)
      .eq("status", "pending");
    return;
  }

  if (event.type === "payment_intent.canceled") {
    await supabase
      .from("store_orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending");
    return;
  }

  // payment_intent.created / .processing — nothing to do.
}

// =============================================================================
// Tenant / Connect-side helpers (existing)
// =============================================================================

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

