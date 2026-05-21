/**
 * POST /api/store/shipping-quote
 *
 * Body: {
 *   lines: [{ variantId: string, quantity: number }],
 *   address: ShippingAddress,
 * }
 *
 * Tenant is resolved from the request subdomain (proxy.ts sets x-subdomain).
 * Groups cart lines by org_products.connection_id, asks each partner adapter
 * for a live shipping quote, sums the result.
 *
 * Used by /store/checkout before creating the PaymentIntent so the buyer
 * sees their real shipping cost before confirming.
 */

import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { getTenantAccount } from "@/lib/tenant"
import { loadConnection } from "@/lib/fulfillment/connections"
import type {
  FulfillmentLine,
  ShippingAddress,
} from "@/lib/fulfillment/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface QuoteRequestLine {
  variantId: string
  quantity: number
}

interface QuoteRequestBody {
  lines?: QuoteRequestLine[]
  address?: ShippingAddress
}

interface PerConnectionQuote {
  connectionId: string
  partnerSlug: string
  shippingCents: number
  error?: string
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
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

  let body: QuoteRequestBody
  try {
    body = (await req.json()) as QuoteRequestBody
  } catch {
    return badRequest("Invalid JSON body.")
  }

  const lines = body.lines ?? []
  if (lines.length === 0) return badRequest("Cart is empty.")
  if (!isValidAddress(body.address)) {
    return badRequest("Address is missing required fields.")
  }
  const address = body.address

  // Admin client: anon RLS would let us read active variants, but using the
  // admin client keeps the validation logic identical to checkout/dispatch.
  const supabase = createAdminClient()

  const variantIds = Array.from(
    new Set(lines.map((l) => l.variantId).filter(Boolean)),
  )
  const { data: variantRows, error } = await supabase
    .from("org_product_variants")
    .select(
      "id, external_variant_id, is_active, org_products!inner(id, account_id, status, connection_id, external_product_id)",
    )
    .in("id", variantIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byVariant = new Map<string, any>()
  for (const row of variantRows ?? []) {
    byVariant.set(row.id as string, row)
  }

  // Validate every cart line and group by connection.
  const groups = new Map<string, FulfillmentLine[]>()
  for (const line of lines) {
    const row = byVariant.get(line.variantId)
    if (!row) return badRequest(`Variant ${line.variantId} not found.`)
    if (!row.is_active) {
      return badRequest(`Variant ${line.variantId} is no longer available.`)
    }
    const product = Array.isArray(row.org_products)
      ? row.org_products[0]
      : row.org_products
    if (!product || product.account_id !== account.id) {
      return badRequest(`Variant ${line.variantId} does not belong to this store.`)
    }
    if (product.status !== "active") {
      return badRequest(`Product is no longer available.`)
    }
    const qty = Math.max(1, Math.floor(line.quantity))
    const key = product.connection_id as string
    const existing = groups.get(key) ?? []
    existing.push({
      externalProductId: product.external_product_id,
      externalVariantId: row.external_variant_id,
      quantity: qty,
    })
    groups.set(key, existing)
  }

  // Per-connection adapter calls. Manual partners (no live API) bill $0
  // shipping for now — surface in the UI as "Calculated separately" later.
  const perConnection: PerConnectionQuote[] = []
  for (const [connectionId, partnerLines] of Array.from(groups.entries())) {
    try {
      const conn = await loadConnection(connectionId, account.id, supabase)
      if (!conn.adapter.calculateShipping) {
        perConnection.push({
          connectionId,
          partnerSlug: conn.partnerSlug,
          shippingCents: 0,
        })
        continue
      }
      const quote = await conn.adapter.calculateShipping(
        conn.ctx,
        partnerLines,
        address,
      )
      perConnection.push({
        connectionId,
        partnerSlug: conn.partnerSlug,
        shippingCents: quote.shippingCents,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[shipping-quote] partner quote failed", {
        connectionId,
        message,
      })
      perConnection.push({
        connectionId,
        partnerSlug: "unknown",
        shippingCents: 0,
        error: message,
      })
    }
  }

  const totalShippingCents = perConnection.reduce(
    (sum, q) => sum + q.shippingCents,
    0,
  )

  return NextResponse.json({
    totalShippingCents,
    perConnection,
  })
}
