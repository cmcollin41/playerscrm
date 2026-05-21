/**
 * Post-payment fulfillment for event registrations that bundle products
 * (e.g. a camp t-shirt). Called from the Stripe webhook on
 * payment_intent.succeeded once registrations have been flipped to
 * confirmed.
 *
 * Strategy:
 *   - shipped_to_registrant: one store_orders row per registration (each
 *     registrant has their own address), with dispatches grouped by partner
 *     within. Auto-dispatches to the partner.
 *   - pickup_at_event: skipped for v1. Items remain in
 *     event_registration_items; the admin pushes to the partner manually
 *     from the dashboard once they're ready (out of scope here).
 *
 * Idempotency: items already linked to a store_order_item_id are skipped,
 * so a webhook retry won't double-create.
 */

import "server-only"

import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { dispatchPaidOrder } from "@/lib/store/dispatch-order"
import { calculateApplicationFeeCents } from "@/lib/fees"

export async function dispatchRegistrationProducts(args: {
  eventId: string
  registrationIds: string[]
  stripePaymentIntentId: string
}): Promise<{ createdOrderIds: string[] }> {
  const supabase = createAdminClient()

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select(
      "id, account_id, product_delivery_mode, accounts(id, application_fee, application_fee_flat)",
    )
    .eq("id", args.eventId)
    .single()

  if (eventErr || !event) {
    console.error(
      "[dispatch-reg-products] event not found",
      args.eventId,
      eventErr,
    )
    return { createdOrderIds: [] }
  }

  // Only auto-fulfill the shipped path in v1.
  if (event.product_delivery_mode !== "shipped_to_registrant") {
    return { createdOrderIds: [] }
  }

  const { data: items, error: itemsErr } = await supabase
    .from("event_registration_items")
    .select(
      "id, registration_id, event_product_id, variant_id, unit_price_cents, options_snapshot, product_name_snapshot, variant_sku_snapshot, image_url_snapshot, shipping_address, store_order_item_id, org_product_variants(id, sku, external_variant_id, image_path, product_id, org_products(id, name, image_path, external_product_id, connection_id, account_partner_connections(id, fulfillment_partners(slug))))",
    )
    .in("registration_id", args.registrationIds)

  if (itemsErr) {
    console.error("[dispatch-reg-products] items load failed", itemsErr.message)
    return { createdOrderIds: [] }
  }

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("id, person_id, registered_by, people(first_name, last_name)")
    .in("id", args.registrationIds)

  const regsById = new Map<string, any>(
    (registrations ?? []).map((r) => [r.id, r]),
  )

  // Lookup the buyer email from the registering user's profile.
  const registeredByIds = Array.from(
    new Set((registrations ?? []).map((r) => r.registered_by).filter(Boolean)),
  )
  const { data: profiles } = registeredByIds.length
    ? await supabase
        .from("profiles")
        .select("id, email")
        .in("id", registeredByIds)
    : { data: [] as any[] }
  const emailByProfileId = new Map<string, string>(
    (profiles ?? []).map((p: any) => [p.id, p.email]),
  )

  // Group items by registration (one store_order per registrant in shipped
  // mode).
  const itemsByReg = new Map<string, any[]>()
  for (const it of items ?? []) {
    if (it.store_order_item_id) continue // already dispatched
    if (!it.shipping_address) continue // shouldn't happen in shipped mode
    const list = itemsByReg.get(it.registration_id as string) ?? []
    list.push(it)
    itemsByReg.set(it.registration_id as string, list)
  }

  const createdOrderIds: string[] = []

  for (const entry of Array.from(itemsByReg.entries())) {
    const registrationId = entry[0]
    const regItems = entry[1]
    const reg = regsById.get(registrationId)
    if (!reg) continue
    const firstAddress = regItems[0]?.shipping_address as any
    if (!firstAddress) continue

    const subtotalCents = regItems.reduce(
      (s: number, it: any) => s + (Number(it.unit_price_cents) || 0),
      0,
    )
    const applicationFeeCents = calculateApplicationFeeCents(
      subtotalCents,
      (event.accounts as any) ?? {},
    )
    const buyerEmail =
      emailByProfileId.get(reg.registered_by) ||
      (firstAddress?.email as string) ||
      "noreply@example.com"
    const buyerName =
      firstAddress?.name ||
      `${reg.people?.first_name ?? ""} ${reg.people?.last_name ?? ""}`.trim() ||
      "Registrant"

    const { data: orderRow, error: orderErr } = await supabase
      .from("store_orders")
      .insert({
        account_id: event.account_id,
        event_id: event.id,
        buyer_email: buyerEmail,
        buyer_name: buyerName,
        shipping_address: firstAddress,
        currency: "usd",
        subtotal_cents: subtotalCents,
        shipping_cents: 0,
        total_cents: subtotalCents,
        application_fee_cents: applicationFeeCents,
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: args.stripePaymentIntentId,
      })
      .select("id")
      .single()

    if (orderErr || !orderRow) {
      console.error(
        "[dispatch-reg-products] store_orders insert failed",
        orderErr,
      )
      continue
    }
    const orderId = orderRow.id as string
    createdOrderIds.push(orderId)

    // Group this registration's items by partner connection → dispatches.
    const itemsByConnection = new Map<string, any[]>()
    for (const it of regItems) {
      const product = (it.org_product_variants?.org_products ?? null) as any
      const connectionId = product?.connection_id as string | null
      if (!connectionId) continue
      const list = itemsByConnection.get(connectionId) ?? []
      list.push(it)
      itemsByConnection.set(connectionId, list)
    }

    const dispatchInserts = Array.from(itemsByConnection.entries()).map(
      ([connectionId, list]) => {
        const product = (list[0].org_product_variants?.org_products ??
          null) as any
        const partnerSlug =
          product?.account_partner_connections?.fulfillment_partners?.slug ??
          "unknown"
        return {
          order_id: orderId,
          connection_id: connectionId,
          partner_slug: partnerSlug,
          shipping_cents: 0,
          status: "queued" as const,
        }
      },
    )
    if (dispatchInserts.length === 0) {
      console.warn(
        "[dispatch-reg-products] no partner connections on items, skipping dispatch",
        { orderId },
      )
      continue
    }

    const { data: dispatchRows, error: dispatchErr } = await supabase
      .from("store_order_dispatches")
      .insert(dispatchInserts)
      .select("id, connection_id")
    if (dispatchErr || !dispatchRows) {
      console.error(
        "[dispatch-reg-products] dispatches insert failed",
        dispatchErr,
      )
      continue
    }
    const dispatchByConn = new Map<string, string>(
      dispatchRows.map((d) => [d.connection_id as string, d.id as string]),
    )

    // Insert one store_order_item per event_registration_item; backfill the
    // link so refund cancellation can find them later.
    for (const it of regItems) {
      const variant = it.org_product_variants as any
      const product = variant?.org_products as any
      const dispatchId = dispatchByConn.get(product?.connection_id as string)
      if (!dispatchId) continue

      const { data: itemRow, error: itemErr } = await supabase
        .from("store_order_items")
        .insert({
          order_id: orderId,
          dispatch_id: dispatchId,
          variant_id: it.variant_id,
          product_id: product?.id,
          external_variant_id: variant?.external_variant_id ?? "",
          product_name: it.product_name_snapshot ?? product?.name ?? "",
          variant_sku: it.variant_sku_snapshot ?? variant?.sku ?? "",
          options_snapshot: it.options_snapshot ?? {},
          image_url: it.image_url_snapshot ?? variant?.image_path ?? null,
          quantity: 1,
          unit_price_cents: it.unit_price_cents,
          event_registration_id: registrationId,
        })
        .select("id")
        .single()
      if (itemErr || !itemRow) {
        console.error(
          "[dispatch-reg-products] store_order_item insert failed",
          itemErr,
        )
        continue
      }

      await supabase
        .from("event_registration_items")
        .update({ store_order_item_id: itemRow.id })
        .eq("id", it.id)
    }

    // Push to partner. Failures land on the dispatch row; do not throw.
    try {
      await dispatchPaidOrder(orderId)
    } catch (err) {
      console.error("[dispatch-reg-products] dispatchPaidOrder failed", {
        orderId,
        err,
      })
    }
  }

  return { createdOrderIds }
}

/**
 * Cancel any unfulfilled partner orders linked to refunded event
 * registrations. Called from the Stripe webhook on charge.refunded.
 */
export async function cancelRegistrationDispatchesOnRefund(args: {
  paymentIntentId: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { loadConnection } = await import("@/lib/fulfillment/connections")

  const { data: orders } = await supabase
    .from("store_orders")
    .select("id, account_id, event_id, status")
    .eq("stripe_payment_intent_id", args.paymentIntentId)
    .not("event_id", "is", null)

  if (!orders || orders.length === 0) return

  for (const order of orders) {
    await supabase
      .from("store_orders")
      .update({ status: "refunded" })
      .eq("id", order.id)

    const { data: dispatches } = await supabase
      .from("store_order_dispatches")
      .select("id, connection_id, status, external_order_id")
      .eq("order_id", order.id)

    for (const d of dispatches ?? []) {
      if (d.status === "fulfilled") {
        await supabase
          .from("store_order_dispatches")
          .update({
            status: "fulfilled",
            error: "Refunded after fulfillment — needs manual review",
          })
          .eq("id", d.id as string)
        continue
      }
      if (!d.external_order_id) {
        await supabase
          .from("store_order_dispatches")
          .update({ status: "cancelled" })
          .eq("id", d.id as string)
        continue
      }
      try {
        const conn = await loadConnection(
          d.connection_id as string,
          order.account_id as string,
          supabase,
        )
        if (conn.adapter.cancelOrder) {
          await conn.adapter.cancelOrder(
            conn.ctx,
            d.external_order_id as string,
          )
          await supabase
            .from("store_order_dispatches")
            .update({ status: "cancelled" })
            .eq("id", d.id as string)
        } else {
          await supabase
            .from("store_order_dispatches")
            .update({
              status: "failed",
              error: "Refund cancellation not supported by partner — manual action required",
            })
            .eq("id", d.id as string)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await supabase
          .from("store_order_dispatches")
          .update({ status: "failed", error: `Refund cancel failed: ${message}` })
          .eq("id", d.id as string)
      }
    }
  }
}
