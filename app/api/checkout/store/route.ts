/**
 * POST /api/checkout/store
 *
 * Buyer-facing storefront checkout. Tenant resolved from the request
 * subdomain (proxy.ts sets x-subdomain). All writes go through the
 * service-role admin client so guest buyers (anon) can create orders without
 * tripping RLS.
 *
 * Flow:
 *   1. Validate cart lines against the tenant's active products + variants.
 *   2. Snapshot prices server-side (never trust client-supplied amounts).
 *   3. Group lines by org_products.connection_id → one store_order_dispatches
 *      row per distinct fulfillment partner involved in the order.
 *   4. Call each adapter's calculateShipping() for a live shipping quote.
 *   5. Insert pending store_orders + dispatches + items.
 *   6. Reuse/create a Stripe customer on the account's CONNECTED Stripe,
 *      then create a PaymentIntent there with application_fee_amount
 *      (lib/fees.ts). metadata.store_order_id lets the webhook route the
 *      payment back to this order.
 *   7. Return { clientSecret, stripeAccountId, publishableKey, orderToken }
 *      to the checkout UI. The webhook (Slice 8) handles partner dispatch
 *      after payment_intent.succeeded.
 */

import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getTenantAccount } from "@/lib/tenant"
import { loadConnection } from "@/lib/integrations/products/connections"
import { calculateApplicationFeeCents } from "@/lib/fees"
import type {
  FulfillmentLine,
  ShippingAddress,
} from "@/lib/integrations/products/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CheckoutRequestLine {
  variantId: string
  quantity: number
}

interface CheckoutRequestBody {
  lines?: CheckoutRequestLine[]
  buyer?: { email?: string; name?: string; phone?: string }
  address?: ShippingAddress
  profileId?: string
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function isValidAddress(a: unknown): a is ShippingAddress {
  if (!a || typeof a !== "object") return false
  const x = a as Partial<ShippingAddress>
  return (
    typeof x.name === "string" &&
    x.name.trim().length > 0 &&
    typeof x.address1 === "string" &&
    x.address1.trim().length > 0 &&
    typeof x.city === "string" &&
    x.city.trim().length > 0 &&
    typeof x.postalCode === "string" &&
    x.postalCode.trim().length > 0 &&
    typeof x.country === "string" &&
    x.country.trim().length === 2
  )
}

export async function POST(req: Request) {
  const account = await getTenantAccount()
  if (!account) return badRequest("No store on this domain.")
  if (!account.stripe_id) {
    return NextResponse.json(
      { error: "This store hasn't connected Stripe yet." },
      { status: 409 },
    )
  }

  let body: CheckoutRequestBody
  try {
    body = (await req.json()) as CheckoutRequestBody
  } catch {
    return badRequest("Invalid JSON body.")
  }

  const lines = body.lines ?? []
  if (lines.length === 0) return badRequest("Cart is empty.")
  if (!isValidAddress(body.address)) {
    return badRequest("Shipping address is incomplete.")
  }
  if (!body.buyer || !isValidEmail(body.buyer.email)) {
    return badRequest("A valid buyer email is required.")
  }
  if (!body.buyer.name || body.buyer.name.trim().length === 0) {
    return badRequest("Buyer name is required.")
  }

  const address = body.address
  const buyerEmail = body.buyer.email.trim().toLowerCase()
  const buyerName = body.buyer.name.trim()
  const buyerPhone = body.buyer.phone?.trim() || null

  const supabase = createAdminClient()

  // Load every variant in the cart with its parent product.
  const variantIds = Array.from(
    new Set(lines.map((l) => l.variantId).filter(Boolean)),
  )
  const { data: variantRows, error: variantErr } = await supabase
    .from("org_product_variants")
    .select(
      "id, external_variant_id, sku, price_cents, options, image_path, is_active, inventory_qty, org_products!inner(id, name, account_id, status, connection_id, external_product_id, image_path)",
    )
    .in("id", variantIds)

  if (variantErr) {
    return NextResponse.json({ error: variantErr.message }, { status: 500 })
  }

  const byVariant = new Map<string, any>()
  for (const row of variantRows ?? []) {
    byVariant.set(row.id as string, row)
  }

  // Validate + group, building both DB-insert payloads and partner lines.
  interface ResolvedLine {
    variantRow: any
    productRow: any
    quantity: number
  }
  const resolved: ResolvedLine[] = []
  const partnerLinesByConn = new Map<string, FulfillmentLine[]>()

  for (const line of lines) {
    const row = byVariant.get(line.variantId)
    if (!row) return badRequest(`Variant ${line.variantId} not found.`)
    if (!row.is_active) {
      return badRequest(`Variant ${row.sku} is no longer available.`)
    }
    const product = Array.isArray(row.org_products)
      ? row.org_products[0]
      : row.org_products
    if (!product || product.account_id !== account.id) {
      return badRequest("A product in your cart is not from this store.")
    }
    if (product.status !== "active") {
      return badRequest(`"${product.name}" is no longer available.`)
    }
    const qty = Math.max(1, Math.floor(line.quantity))
    if (row.inventory_qty != null && row.inventory_qty < qty) {
      return badRequest(`"${product.name}" only has ${row.inventory_qty} in stock.`)
    }

    resolved.push({ variantRow: row, productRow: product, quantity: qty })
    const conn = product.connection_id as string
    const existing = partnerLinesByConn.get(conn) ?? []
    existing.push({
      externalProductId: product.external_product_id,
      externalVariantId: row.external_variant_id,
      quantity: qty,
    })
    partnerLinesByConn.set(conn, existing)
  }

  // Live shipping quote per partner connection.
  interface ShippingPerConn {
    connectionId: string
    partnerSlug: string
    shippingCents: number
  }
  const shippingPerConn: ShippingPerConn[] = []
  for (const [connectionId, partnerLines] of Array.from(
    partnerLinesByConn.entries(),
  )) {
    try {
      const conn = await loadConnection(connectionId, account.id, supabase)
      let cents = 0
      if (conn.adapter.calculateShipping) {
        const quote = await conn.adapter.calculateShipping(
          conn.ctx,
          partnerLines,
          address,
        )
        cents = quote.shippingCents
      }
      shippingPerConn.push({
        connectionId,
        partnerSlug: conn.partnerSlug,
        shippingCents: cents,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[checkout/store] shipping quote failed", {
        connectionId,
        message,
      })
      return NextResponse.json(
        {
          error: `Couldn't get a shipping quote (${message}). Please try again.`,
        },
        { status: 502 },
      )
    }
  }

  const subtotalCents = resolved.reduce(
    (s, r) => s + r.variantRow.price_cents * r.quantity,
    0,
  )
  const totalShippingCents = shippingPerConn.reduce(
    (s, c) => s + c.shippingCents,
    0,
  )
  const totalCents = subtotalCents + totalShippingCents
  if (totalCents <= 0) return badRequest("Order total is zero.")

  const applicationFeeCents = calculateApplicationFeeCents(totalCents, {
    application_fee: (account as any).application_fee,
    application_fee_flat: (account as any).application_fee_flat,
  })

  // Insert pending order.
  const { data: orderRow, error: orderErr } = await supabase
    .from("store_orders")
    .insert({
      account_id: account.id,
      buyer_profile_id: body.profileId ?? null,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      shipping_address: address,
      currency: "usd",
      subtotal_cents: subtotalCents,
      shipping_cents: totalShippingCents,
      total_cents: totalCents,
      application_fee_cents: applicationFeeCents,
      status: "pending",
    })
    .select("id, public_token")
    .single()

  if (orderErr || !orderRow) {
    console.error("[checkout/store] order insert failed", orderErr)
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 },
    )
  }
  const orderId = orderRow.id as string
  const orderToken = orderRow.public_token as string

  // Insert one dispatch per connection.
  const dispatchInserts = shippingPerConn.map((c) => ({
    order_id: orderId,
    connection_id: c.connectionId,
    partner_slug: c.partnerSlug,
    shipping_cents: c.shippingCents,
    status: "queued" as const,
  }))
  const { data: dispatchRows, error: dispatchErr } = await supabase
    .from("store_order_dispatches")
    .insert(dispatchInserts)
    .select("id, connection_id")
  if (dispatchErr || !dispatchRows) {
    console.error("[checkout/store] dispatch insert failed", dispatchErr)
    return NextResponse.json(
      { error: "Failed to create dispatches." },
      { status: 500 },
    )
  }
  const dispatchByConn = new Map<string, string>()
  for (const d of dispatchRows) {
    dispatchByConn.set(d.connection_id as string, d.id as string)
  }

  // Insert items, each pointed at its dispatch.
  const itemInserts = resolved.map((r) => {
    const conn = r.productRow.connection_id as string
    const dispatchId = dispatchByConn.get(conn)!
    const variantImagePath = r.variantRow.image_path ?? r.productRow.image_path
    return {
      order_id: orderId,
      dispatch_id: dispatchId,
      variant_id: r.variantRow.id,
      product_id: r.productRow.id,
      external_variant_id: r.variantRow.external_variant_id,
      product_name: r.productRow.name,
      variant_sku: r.variantRow.sku,
      options_snapshot: r.variantRow.options ?? {},
      image_url: variantImagePath ?? null,
      quantity: r.quantity,
      unit_price_cents: r.variantRow.price_cents,
    }
  })
  const { error: itemErr } = await supabase
    .from("store_order_items")
    .insert(itemInserts)
  if (itemErr) {
    console.error("[checkout/store] item insert failed", itemErr)
    return NextResponse.json(
      { error: "Failed to create order items." },
      { status: 500 },
    )
  }

  // Reuse / create a customer on the connected Stripe.
  const stripeAccountId = account.stripe_id as string
  let customerId: string | null = null
  try {
    const { data: existing } = await stripe.customers.list(
      { email: buyerEmail, limit: 1 },
      { stripeAccount: stripeAccountId },
    )
    if (existing.length > 0) {
      customerId = existing[0].id
      await stripe.customers.update(
        customerId,
        { name: buyerName, phone: buyerPhone ?? undefined },
        { stripeAccount: stripeAccountId },
      )
    } else {
      const created = await stripe.customers.create(
        { email: buyerEmail, name: buyerName, phone: buyerPhone ?? undefined },
        { stripeAccount: stripeAccountId },
      )
      customerId = created.id
    }
  } catch (err) {
    console.error("[checkout/store] stripe customer error", err)
  }

  // Create the PaymentIntent on the connected account.
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: "usd",
        customer: customerId ?? undefined,
        receipt_email: buyerEmail,
        automatic_payment_methods: { enabled: true },
        application_fee_amount:
          applicationFeeCents > 0 ? applicationFeeCents : undefined,
        metadata: {
          store_order_id: orderId,
          store_order_token: orderToken,
          account_id: account.id,
        },
      },
      { stripeAccount: stripeAccountId },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[checkout/store] paymentIntent create failed", message)
    await supabase
      .from("store_orders")
      .update({ status: "failed" })
      .eq("id", orderId)
    return NextResponse.json(
      { error: `Payment setup failed: ${message}` },
      { status: 502 },
    )
  }

  await supabase
    .from("store_orders")
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
    })
    .eq("id", orderId)

  return NextResponse.json({
    orderId,
    orderToken,
    clientSecret: paymentIntent.client_secret,
    stripeAccountId,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    subtotalCents,
    shippingCents: totalShippingCents,
    totalCents,
  })
}
