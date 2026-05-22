/**
 * Printify adapter.
 *
 * Slice 2: validateCredentials (connect flow).
 * Slice 3: listSyncProducts + syncProduct (catalog browse + publish).
 * Slices 4, 5: calculateShipping, createOrder, webhooks.
 *
 * Docs: https://developers.printify.com/
 * Auth: Bearer personal access token from https://printify.com/app/account/api
 * Rate limit: ~600 req / 30min per shop.
 */

import crypto from "node:crypto"
import type {
  ConnectionContext,
  ConnectionCredentials,
  CreateOrderInput,
  CreateOrderResult,
  DispatchStatus,
  FulfillmentAdapter,
  FulfillmentLine,
  PartnerSyncProduct,
  PartnerSyncVariant,
  ShippingAddress,
  ShippingQuote,
  ValidationResult,
  WebhookEvent,
} from "../../types"

const PRINTIFY_BASE = "https://api.printify.com/v1"
const UA = "athletes.app/store-model-b"

interface PrintifyShop {
  id: number
  title: string
  sales_channel?: string
}

interface PrintifyOptionValue {
  id: number
  title: string
  colors?: string[]
}

interface PrintifyOption {
  name: string
  type?: string
  values: PrintifyOptionValue[]
}

interface PrintifyVariant {
  id: number
  sku?: string | null
  cost: number // cents
  price: number // cents
  title?: string
  options: number[] // value ids
  is_enabled: boolean
  is_default?: boolean
  is_available?: boolean
}

interface PrintifyImage {
  src: string
  variant_ids: number[]
  position?: string
  is_default?: boolean
}

interface PrintifyProductListItem {
  id: string | number
  title: string
  description?: string
  visible?: boolean
  variants?: PrintifyVariant[]
  images?: PrintifyImage[]
}

interface PrintifyProductDetail extends PrintifyProductListItem {
  options: PrintifyOption[]
  variants: PrintifyVariant[]
  images: PrintifyImage[]
}

interface PrintifyListResponse<T> {
  current_page: number
  last_page: number
  total: number
  data: T[]
}

interface PrintifyFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
}

async function printifyFetch<T>(
  token: string,
  path: string,
  opts: PrintifyFetchOptions = {},
): Promise<T> {
  const method = opts.method ?? "GET"
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)

  const res = await fetch(`${PRINTIFY_BASE}${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Printify ${method} ${path} responded ${res.status}: ${body.slice(0, 200)}`,
    )
  }
  // Printify's cancel endpoint returns 200 with empty body on success.
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

// ---------------------------------------------------------------------------
// Slice 2: validateCredentials
// ---------------------------------------------------------------------------

async function validateCredentials(
  credentials: ConnectionCredentials,
): Promise<ValidationResult> {
  if (!credentials.token || typeof credentials.token !== "string") {
    return { valid: false, error: "Personal access token is required." }
  }
  try {
    const shops = await printifyFetch<PrintifyShop[]>(
      credentials.token,
      "/shops.json",
    )
    if (shops.length === 0) {
      return {
        valid: false,
        error:
          "Token is valid but no Printify shops are linked to this account. Create one at https://printify.com/app/store-manager and try again.",
      }
    }
    const shop = shops[0]
    return {
      valid: true,
      externalShopId: String(shop.id),
      externalAccountLabel: shop.title,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { valid: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Slice 3: listSyncProducts + syncProduct
// ---------------------------------------------------------------------------

function requireShopId(ctx: ConnectionContext): string {
  if (!ctx.externalShopId) {
    throw new Error(
      "Printify connection is missing external_shop_id. Reconnect the integration to pull the shop ID.",
    )
  }
  return ctx.externalShopId
}

function pickThumbnail(images: PrintifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null
  const def = images.find((i) => i.is_default)
  return def?.src ?? images[0].src
}

async function listSyncProducts(
  ctx: ConnectionContext,
): Promise<PartnerSyncProduct[]> {
  const shopId = requireShopId(ctx)
  // MVP: fetch page 1 only (limit=50, Printify's max). Larger shops can
  // paginate later.
  const res = await printifyFetch<PrintifyListResponse<PrintifyProductListItem>>(
    ctx.credentials.token,
    `/shops/${shopId}/products.json?limit=50`,
  )
  return res.data.map((p) => ({
    externalId: String(p.id),
    title: p.title,
    description: p.description ?? null,
    thumbnailUrl: pickThumbnail(p.images),
    variantCount: (p.variants ?? []).filter((v) => v.is_enabled).length,
    status: p.visible === false ? "inactive" : "active",
  }))
}

/**
 * Build a {OptionName: ValueTitle} map for a variant.
 *
 * Printify's variant.options is an array of option *value* IDs; the human
 * labels live in product.options[].values[]. We resolve here so the rest of
 * Athletes.app sees a tidy {"Size":"M","Color":"Red"} shape.
 */
function resolveVariantOptions(
  product: PrintifyProductDetail,
  variant: PrintifyVariant,
): Record<string, string> {
  const out: Record<string, string> = {}
  const productOptions = product.options ?? []
  for (let i = 0; i < productOptions.length; i++) {
    const opt = productOptions[i]
    const valueId = (variant.options ?? [])[i]
    if (valueId == null) continue
    const value = opt.values.find((v) => v.id === valueId)
    if (!value) continue
    // Normalize Size / Color naming so the storefront swatch logic
    // (which special-cases "Color") still works without partner-specific code.
    const name = normalizeOptionName(opt.name)
    out[name] = value.title
  }
  return out
}

/**
 * Some Printify products (older blueprints, certain manual setups) come
 * back without a product.options array, so resolveVariantOptions can't
 * map IDs → labels and returns {}. Variant.title in that case is still
 * populated as a human-readable string like "S / Black" or "Royal Blue".
 * Split it into axes so the storefront has at least one picker to render.
 */
function fallbackOptionsFromTitle(
  title: string | null | undefined,
): Record<string, string> {
  if (!title) return {}
  const parts = title
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { Variant: parts[0] }
  if (parts.length === 2) return { Size: parts[0], Color: parts[1] }
  const out: Record<string, string> = {}
  parts.forEach((p, i) => {
    out[`Option ${i + 1}`] = p
  })
  return out
}

function normalizeOptionName(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower === "colors" || lower === "color") return "Color"
  if (lower === "sizes" || lower === "size") return "Size"
  if (lower.length === 0) return raw
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function variantImageUrl(
  product: PrintifyProductDetail,
  variantId: number,
): string | null {
  for (const img of product.images) {
    if (img.variant_ids.includes(variantId)) return img.src
  }
  return null
}

async function syncProduct(
  ctx: ConnectionContext,
  externalProductId: string,
): Promise<{
  product: PartnerSyncProduct
  variants: PartnerSyncVariant[]
  images: string[]
}> {
  const shopId = requireShopId(ctx)
  const detail = await printifyFetch<PrintifyProductDetail>(
    ctx.credentials.token,
    `/shops/${shopId}/products/${externalProductId}.json`,
  )

  const enabled = detail.variants.filter((v) => v.is_enabled)
  const images = (detail.images ?? []).map((i) => i.src)
  const thumbnail = pickThumbnail(detail.images)

  const variants: PartnerSyncVariant[] = enabled.map((v) => {
    const resolved = resolveVariantOptions(detail, v)
    const options =
      Object.keys(resolved).length > 0
        ? resolved
        : fallbackOptionsFromTitle(v.title)
    return {
      externalId: String(v.id),
      sku: v.sku ?? null,
      title: v.title ?? null,
      options,
      retailPriceCents: v.price,
      partnerCostCents: v.cost,
      imageUrl: variantImageUrl(detail, v.id) ?? thumbnail,
      isActive: v.is_available !== false,
    }
  })

  const product: PartnerSyncProduct = {
    externalId: String(detail.id),
    title: detail.title,
    description: detail.description ?? null,
    thumbnailUrl: thumbnail,
    variantCount: variants.length,
    status: detail.visible === false ? "inactive" : "active",
  }

  return { product, variants, images }
}

// ---------------------------------------------------------------------------
// Publish acknowledgement
//
// Printify locks a product in "Publishing..." state any time publishing is
// initiated (either by us calling syncProduct or by the merchant clicking
// "Publish" in the Printify dashboard). The product stays locked — and the
// merchant cannot edit it — until our storefront posts back to one of these
// two endpoints. Without this call every imported product is stuck.
// ---------------------------------------------------------------------------

async function markPublishSucceeded(
  ctx: ConnectionContext,
  externalProductId: string,
  publication: { externalId: string; handle: string },
): Promise<void> {
  const shopId = requireShopId(ctx)
  await printifyFetch(
    ctx.credentials.token,
    `/shops/${shopId}/products/${externalProductId}/publishing_succeeded.json`,
    {
      method: "POST",
      body: {
        external: {
          id: publication.externalId,
          handle: publication.handle,
        },
      },
    },
  )
}

async function markPublishFailed(
  ctx: ConnectionContext,
  externalProductId: string,
  reason: string,
): Promise<void> {
  const shopId = requireShopId(ctx)
  await printifyFetch(
    ctx.credentials.token,
    `/shops/${shopId}/products/${externalProductId}/publishing_failed.json`,
    {
      method: "POST",
      body: { reason },
    },
  )
}

// ---------------------------------------------------------------------------
// Webhook registration
//
// Printify registers webhooks per-topic. We subscribe to every topic we care
// about and store the resulting secret on the connection so verifyWebhook can
// HMAC-check inbound deliveries. Idempotent: existing registrations for the
// same {shop, topic, url} tuple get their secret rotated rather than duped.
// ---------------------------------------------------------------------------

const PRINTIFY_WEBHOOK_TOPICS = [
  "product:publish:started",
  "order:created",
  "order:updated",
  "order:sent-to-production",
  "order:shipment:created",
  "order:shipment:delivered",
  "order:canceled",
]

interface PrintifyWebhookRow {
  id: string
  topic: string
  url: string
}

async function registerWebhooks(
  ctx: ConnectionContext,
  opts: { url: string; secret: string },
): Promise<void> {
  const shopId = requireShopId(ctx)
  const token = ctx.credentials.token

  const existing = await printifyFetch<PrintifyWebhookRow[]>(
    token,
    `/shops/${shopId}/webhooks.json`,
  ).catch(() => [] as PrintifyWebhookRow[])

  for (const topic of PRINTIFY_WEBHOOK_TOPICS) {
    const matching = existing.filter((w) => w.topic === topic)
    const ours = matching.find((w) => w.url === opts.url)

    // Delete any same-topic webhooks pointing at stale URLs (e.g. an old
    // tenant subdomain) so we don't double-deliver.
    for (const stale of matching) {
      if (stale.url === opts.url) continue
      await printifyFetch(
        token,
        `/shops/${shopId}/webhooks/${stale.id}.json`,
        { method: "DELETE" },
      ).catch(() => undefined)
    }

    if (ours) {
      // Rotate secret + url on the existing webhook.
      await printifyFetch(
        token,
        `/shops/${shopId}/webhooks/${ours.id}.json`,
        {
          method: "PUT",
          body: { url: opts.url, secret: opts.secret },
        },
      ).catch((err) => {
        console.error("[printify] webhook update failed", topic, err)
      })
    } else {
      await printifyFetch(
        token,
        `/shops/${shopId}/webhooks.json`,
        {
          method: "POST",
          body: { topic, url: opts.url, secret: opts.secret },
        },
      ).catch((err) => {
        console.error("[printify] webhook create failed", topic, err)
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Slice 4: calculateShipping
// ---------------------------------------------------------------------------

interface PrintifyShippingResponse {
  // All amounts in cents.
  standard?: number
  express?: number
  priority?: number
  printify_express?: number
  economy?: number
}

interface PrintifyAddressTo {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  country: string
  region?: string
  address1: string
  address2?: string
  city: string
  zip: string
}

function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (!trimmed) return { first: "Customer", last: "" }
  const idx = trimmed.indexOf(" ")
  if (idx < 0) return { first: trimmed, last: "" }
  return {
    first: trimmed.slice(0, idx),
    last: trimmed.slice(idx + 1).trim(),
  }
}

function toPrintifyAddress(address: ShippingAddress): PrintifyAddressTo {
  const { first, last } = splitName(address.name)
  return {
    first_name: first,
    last_name: last || first,
    email: address.email,
    phone: address.phone,
    country: address.country,
    region: address.region,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    zip: address.postalCode,
  }
}

async function calculateShipping(
  ctx: ConnectionContext,
  lines: FulfillmentLine[],
  address: ShippingAddress,
): Promise<ShippingQuote> {
  const shopId = requireShopId(ctx)
  if (lines.length === 0) return { shippingCents: 0 }

  const body = {
    line_items: lines.map((l) => ({
      product_id: l.externalProductId,
      variant_id: Number(l.externalVariantId),
      quantity: l.quantity,
    })),
    address_to: toPrintifyAddress(address),
  }

  const res = await printifyFetch<PrintifyShippingResponse>(
    ctx.credentials.token,
    `/shops/${shopId}/orders/shipping.json`,
    { method: "POST", body },
  )

  // Default to standard. Premium tiers can be exposed later as a UI choice.
  const cents = res.standard ?? res.economy ?? res.priority ?? res.express ?? 0
  return { shippingCents: cents, breakdown: res }
}

// ---------------------------------------------------------------------------
// Slice 5: createOrder
// ---------------------------------------------------------------------------

interface PrintifyOrderCreateResponse {
  id: string
}

async function createOrder(
  ctx: ConnectionContext,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const shopId = requireShopId(ctx)

  const body = {
    external_id: input.externalOrderRef,
    label: `athletes.app · ${input.externalOrderRef}`,
    line_items: input.lines.map((l) => ({
      product_id: l.externalProductId,
      variant_id: Number(l.externalVariantId),
      quantity: l.quantity,
    })),
    shipping_method: 1, // 1 = standard. Premium tiers can be exposed later.
    send_shipping_notification: false,
    address_to: toPrintifyAddress(input.address),
  }

  const created = await printifyFetch<PrintifyOrderCreateResponse>(
    ctx.credentials.token,
    `/shops/${shopId}/orders.json`,
    { method: "POST", body },
  )

  // Push the order into production. Without this Printify keeps it in "on
  // hold" — useful for review but not what merchants want once payment lands.
  await printifyFetch(
    ctx.credentials.token,
    `/shops/${shopId}/orders/${created.id}/send_to_production.json`,
    { method: "POST", body: {} },
  ).catch((err) => {
    // Don't fail the whole dispatch if production send fails — the order
    // already exists on Printify and an admin can release it manually.
    console.error(
      "[printify] send_to_production failed for order",
      created.id,
      err instanceof Error ? err.message : err,
    )
  })

  return {
    externalOrderId: created.id,
    externalOrderUrl: `https://printify.com/app/orders/${shopId}/details/${created.id}`,
  }
}

// ---------------------------------------------------------------------------
// cancelOrder — used by the refund path
// ---------------------------------------------------------------------------

async function cancelOrder(
  ctx: ConnectionContext,
  externalOrderId: string,
): Promise<void> {
  const shopId = requireShopId(ctx)
  // Printify only allows cancellation while the order is still "on-hold".
  // Once it's been sent to production they return 400 and an admin has to
  // handle it manually — bubble that up as a thrown error so the dispatch
  // row gets marked needs_review.
  await printifyFetch(
    ctx.credentials.token,
    `/shops/${shopId}/orders/${externalOrderId}/cancel.json`,
    { method: "POST", body: {} },
  )
}

// ---------------------------------------------------------------------------
// Slice 5: webhooks (verify + handle)
// ---------------------------------------------------------------------------

interface PrintifyWebhookPayload {
  id?: string
  type?: string
  created_at?: string
  shop_id?: number | string
  resource?: {
    id?: string
    data?: {
      shipments?: Array<{
        carrier?: string
        number?: string
        url?: string
      }>
    }
  }
}

async function verifyWebhook(
  req: Request,
  ctx: ConnectionContext,
): Promise<boolean> {
  const secret = (ctx.credentials.webhook_secret as string | undefined) ?? ""
  if (!secret) return false
  const signatureHeader = req.headers.get("x-pfy-signature") ?? ""
  if (!signatureHeader) return false

  // Stripe-style "sha256=hexdigest". Accept either bare hex or prefixed.
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader

  const raw = Buffer.from(await req.clone().arrayBuffer())
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex")

  if (expected.length !== provided.length) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    )
  } catch {
    return false
  }
}

function mapPrintifyEventType(type: string | undefined): DispatchStatus | null {
  switch (type) {
    case "order:created":
      return "sent"
    case "order:sent-to-production":
      return "accepted"
    case "order:shipment:created":
    case "order:shipment:delivered":
      return "fulfilled"
    case "order:canceled":
      return "cancelled"
    default:
      return null
  }
}

async function handleWebhook(
  body: unknown,
  _ctx: ConnectionContext,
): Promise<WebhookEvent | null> {
  const payload = (body ?? {}) as PrintifyWebhookPayload

  if (payload.type === "product:publish:started") {
    const externalProductId = payload.resource?.id
    if (!externalProductId) return null
    return { kind: "product_publish_started", externalProductId }
  }

  const externalOrderId = payload.resource?.id
  const status = mapPrintifyEventType(payload.type)
  if (!externalOrderId || !status) return null

  const shipment = payload.resource?.data?.shipments?.[0]
  const tracking = shipment
    ? {
        number: shipment.number,
        url: shipment.url,
        carrier: shipment.carrier,
      }
    : undefined

  return {
    kind: "order",
    externalOrderId,
    status,
    tracking,
  }
}

export const printifyAdapter: FulfillmentAdapter = {
  key: "printify",
  validateCredentials,
  listSyncProducts,
  syncProduct,
  markPublishSucceeded,
  markPublishFailed,
  registerWebhooks,
  calculateShipping,
  createOrder,
  cancelOrder,
  verifyWebhook,
  handleWebhook,
}
