/**
 * Post-payment fulfillment dispatch. Called from the Stripe webhook on
 * payment_intent.succeeded for orders carrying a `store_order_id` metadata.
 *
 * For each store_order_dispatches row on the order, load the partner
 * connection and push the order to the partner via the adapter. Persist
 * external_order_id + status. Failures are recorded on the dispatch row
 * (status='failed', error=...) so an admin can retry from the dashboard
 * without blocking the rest of the order.
 */

import "server-only"

import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { loadConnection } from "@/lib/fulfillment/connections"
import type { FulfillmentLine } from "@/lib/fulfillment/types"

interface DispatchResult {
  dispatchId: string
  status: "sent" | "failed"
  externalOrderId?: string
  error?: string
}

export async function dispatchPaidOrder(
  orderId: string,
): Promise<DispatchResult[]> {
  const supabase = createAdminClient()

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select("id, account_id, shipping_address, status")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    throw new Error(`Order ${orderId} not found: ${orderErr?.message ?? ""}`)
  }

  const { data: dispatches, error: dispatchErr } = await supabase
    .from("store_order_dispatches")
    .select("id, connection_id, partner_slug, status, external_order_id")
    .eq("order_id", orderId)

  if (dispatchErr) {
    throw new Error(`Dispatches load failed: ${dispatchErr.message}`)
  }

  const { data: items, error: itemsErr } = await supabase
    .from("store_order_items")
    .select(
      "id, dispatch_id, external_variant_id, quantity, product_id, org_products(external_product_id)",
    )
    .eq("order_id", orderId)

  if (itemsErr) throw new Error(`Items load failed: ${itemsErr.message}`)

  const itemsByDispatch = new Map<string, FulfillmentLine[]>()
  for (const it of items ?? []) {
    const product = Array.isArray((it as any).org_products)
      ? (it as any).org_products[0]
      : (it as any).org_products
    const list = itemsByDispatch.get(it.dispatch_id as string) ?? []
    list.push({
      externalProductId: product?.external_product_id ?? "",
      externalVariantId: it.external_variant_id as string,
      quantity: it.quantity as number,
    })
    itemsByDispatch.set(it.dispatch_id as string, list)
  }

  const results: DispatchResult[] = []

  for (const d of dispatches ?? []) {
    // Idempotency: skip dispatches already sent. Webhook can fire twice.
    if (d.external_order_id) {
      results.push({
        dispatchId: d.id as string,
        status: "sent",
        externalOrderId: d.external_order_id as string,
      })
      continue
    }

    const lines = itemsByDispatch.get(d.id as string) ?? []
    if (lines.length === 0) {
      results.push({
        dispatchId: d.id as string,
        status: "failed",
        error: "No items found for this dispatch.",
      })
      continue
    }

    try {
      const conn = await loadConnection(
        d.connection_id as string,
        order.account_id as string,
        supabase,
      )
      if (!conn.adapter.createOrder) {
        // Manual partners — leave queued; the dashboard surfaces these for
        // human fulfillment. Don't mark as failed.
        await supabase
          .from("store_order_dispatches")
          .update({ status: "queued" })
          .eq("id", d.id as string)
        results.push({ dispatchId: d.id as string, status: "sent" })
        continue
      }

      const result = await conn.adapter.createOrder(conn.ctx, {
        externalOrderRef: d.id as string,
        lines,
        address: order.shipping_address as any,
        shippingCents: 0,
      })

      await supabase
        .from("store_order_dispatches")
        .update({
          status: "sent",
          external_order_id: result.externalOrderId,
          external_order_url: result.externalOrderUrl ?? null,
          pushed_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", d.id as string)

      results.push({
        dispatchId: d.id as string,
        status: "sent",
        externalOrderId: result.externalOrderId,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[dispatch] partner push failed", {
        orderId,
        dispatchId: d.id,
        message,
      })
      await supabase
        .from("store_order_dispatches")
        .update({ status: "failed", error: message })
        .eq("id", d.id as string)
      results.push({
        dispatchId: d.id as string,
        status: "failed",
        error: message,
      })
    }
  }

  return results
}
